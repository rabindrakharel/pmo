// ============================================================================
// useEntityLinks Hook
// ============================================================================
// Hook for managing entity parent-child link relationships
// Session-level store - prefetch on login, 30 min staleTime
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '../keys';
import { SESSION_STORE_CONFIG } from '../constants';
import { entityLinksStore, entityCodesStore } from '../stores';
import type { EntityLink } from '../types';
import {
  setEntityLinkForward,
  setEntityLinkReverse,
  clearEntityLinks as clearEntityLinksDexie,
} from '../../persistence/operations';

// ============================================================================
// Types
// ============================================================================

export interface UseEntityLinksResult {
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Get child IDs for a parent-child relationship */
  getChildIds: (parentCode: string, parentId: string, childCode: string) => string[];
  /** Get parents for a child entity */
  getParents: (
    childCode: string,
    childId: string
  ) => Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
  /** Get tab counts for all child types */
  getTabCounts: (parentCode: string, parentId: string) => Record<string, number>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for accessing entity link relationships
 *
 * STORE: entityLinks (forward + reverse)
 * LAYER: Session-level (30 min staleTime)
 * PERSISTENCE: Dexie IndexedDB
 *
 * Features:
 * - Forward lookups: parent → children
 * - Reverse lookups: child → parents
 * - Tab count calculations
 */
export function useEntityLinks(): UseEntityLinksResult {
  const query = useQuery({
    queryKey: QUERY_KEYS.entityLinks(),
    queryFn: async () => {
      // Fetch all entity links from API
      const response = await apiClient.get<{ data: EntityLink[] }>(
        '/api/v1/entity-instance-link'
      );
      const links = response.data?.data || [];

      // Build forward and reverse indexes
      const forwardMap = new Map<
        string,
        { childIds: string[]; relationships: Record<string, string> }
      >();
      const reverseMap = new Map<
        string,
        Array<{
          entity_code: string;
          entity_instance_id: string;
          relationship_type: string;
        }>
      >();

      for (const link of links) {
        // Forward: parent → children
        const forwardKey = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
        if (!forwardMap.has(forwardKey)) {
          forwardMap.set(forwardKey, { childIds: [], relationships: {} });
        }
        const forward = forwardMap.get(forwardKey)!;
        forward.childIds.push(link.child_entity_instance_id);
        forward.relationships[link.child_entity_instance_id] =
          link.relationship_type || 'contains';

        // Reverse: child → parents
        const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;
        if (!reverseMap.has(reverseKey)) {
          reverseMap.set(reverseKey, []);
        }
        reverseMap.get(reverseKey)!.push({
          entity_code: link.entity_code,
          entity_instance_id: link.entity_instance_id,
          relationship_type: link.relationship_type || 'contains',
        });
      }

      // Persist to Dexie and update sync store
      const now = Date.now();
      for (const [key, value] of forwardMap.entries()) {
        const [parentCode, parentId, childCode] = key.split(':');
        await setEntityLinkForward({
          parentCode,
          parentId,
          childCode,
          childIds: value.childIds,
          relationships: value.relationships,
        });
        entityLinksStore.setForward(key, {
          _id: key,
          parentCode,
          parentId,
          childCode,
          childIds: value.childIds,
          relationships: value.relationships,
          syncedAt: now,
        });
      }

      for (const [key, parents] of reverseMap.entries()) {
        const [childCode, childId] = key.split(':');
        await setEntityLinkReverse({
          childCode,
          childId,
          parents,
        });
        entityLinksStore.setReverse(key, {
          _id: key,
          childCode,
          childId,
          parents,
          syncedAt: now,
        });
      }

      return links;
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,
    gcTime: SESSION_STORE_CONFIG.gcTime,
  });

  const getChildIds = useCallback(
    (parentCode: string, parentId: string, childCode: string): string[] => {
      return entityLinksStore.getChildIds(parentCode, parentId, childCode);
    },
    []
  );

  const getParents = useCallback(
    (
      childCode: string,
      childId: string
    ): Array<{
      entity_code: string;
      entity_instance_id: string;
      relationship_type: string;
    }> => {
      return entityLinksStore.getParents(childCode, childId);
    },
    []
  );

  const getTabCounts = useCallback(
    (parentCode: string, parentId: string): Record<string, number> => {
      return entityLinksStore.getTabCounts(parentCode, parentId, (code) =>
        entityCodesStore.getChildCodes(code)
      );
    },
    []
  );

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getChildIds,
    getParents,
    getTabCounts,
  };
}

// ============================================================================
// Prefetch Function
// ============================================================================

/**
 * Prefetch entity links into cache
 */
export async function prefetchEntityLinks(): Promise<{
  raw: number;
  forward: number;
  reverse: number;
}> {
  try {
    const response = await apiClient.get<{ data: EntityLink[] }>(
      '/api/v1/entity-instance-link'
    );
    const links = response.data?.data || [];

    // Build indexes and persist (same logic as hook)
    const forwardMap = new Map<
      string,
      { childIds: string[]; relationships: Record<string, string> }
    >();
    const reverseMap = new Map<
      string,
      Array<{
        entity_code: string;
        entity_instance_id: string;
        relationship_type: string;
      }>
    >();

    for (const link of links) {
      const forwardKey = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
      if (!forwardMap.has(forwardKey)) {
        forwardMap.set(forwardKey, { childIds: [], relationships: {} });
      }
      const forward = forwardMap.get(forwardKey)!;
      forward.childIds.push(link.child_entity_instance_id);
      forward.relationships[link.child_entity_instance_id] =
        link.relationship_type || 'contains';

      const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;
      if (!reverseMap.has(reverseKey)) {
        reverseMap.set(reverseKey, []);
      }
      reverseMap.get(reverseKey)!.push({
        entity_code: link.entity_code,
        entity_instance_id: link.entity_instance_id,
        relationship_type: link.relationship_type || 'contains',
      });
    }

    const now = Date.now();
    for (const [key, value] of forwardMap.entries()) {
      const [parentCode, parentId, childCode] = key.split(':');
      await setEntityLinkForward({
        parentCode,
        parentId,
        childCode,
        childIds: value.childIds,
        relationships: value.relationships,
      });
      entityLinksStore.setForward(key, {
        _id: key,
        parentCode,
        parentId,
        childCode,
        childIds: value.childIds,
        relationships: value.relationships,
        syncedAt: now,
      });
    }

    for (const [key, parents] of reverseMap.entries()) {
      const [childCode, childId] = key.split(':');
      await setEntityLinkReverse({
        childCode,
        childId,
        parents,
      });
      entityLinksStore.setReverse(key, {
        _id: key,
        childCode,
        childId,
        parents,
        syncedAt: now,
      });
    }

    return {
      raw: links.length,
      forward: forwardMap.size,
      reverse: reverseMap.size,
    };
  } catch (error) {
    console.error('[useEntityLinks] Prefetch failed:', error);
    return { raw: 0, forward: 0, reverse: 0 };
  }
}

// ============================================================================
// Clear Function
// ============================================================================

/**
 * Clear entity links cache
 */
export async function clearEntityLinksCache(): Promise<void> {
  const { queryClient } = await import('../client');
  queryClient.removeQueries({ queryKey: QUERY_KEYS.entityLinks() });
  entityLinksStore.clear();
  await clearEntityLinksDexie();
}

// ============================================================================
// Link Manipulation
// ============================================================================

/**
 * Add a link to the cache (optimistic update)
 */
export function addLinkToCache(link: EntityLink): void {
  const forwardKey = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
  const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;

  entityLinksStore.addForwardChild(
    forwardKey,
    link.child_entity_instance_id,
    link.relationship_type || 'contains'
  );
  entityLinksStore.addReverseParent(reverseKey, {
    entity_code: link.entity_code,
    entity_instance_id: link.entity_instance_id,
    relationship_type: link.relationship_type || 'contains',
  });
}

/**
 * Remove a link from the cache (optimistic update)
 */
export function removeLinkFromCache(link: EntityLink): void {
  const forwardKey = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
  const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;

  entityLinksStore.removeForwardChild(forwardKey, link.child_entity_instance_id);
  entityLinksStore.removeReverseParent(reverseKey, link.entity_instance_id);
}
