// ============================================================================
// useEntityLinks Hook
// ============================================================================
// Hook for managing entity parent-child link relationships
// Session-level store - prefetch on login, 30 min staleTime
//
// v11.0.0: Removed sync store - uses TanStack Query cache directly
// ============================================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '../keys';
import { SESSION_STORE_CONFIG } from '../constants';
import { getChildEntityCodesSync } from '../stores';
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

interface LinkIndexes {
  forward: Map<string, { childIds: string[]; relationships: Record<string, string> }>;
  reverse: Map<string, Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>>;
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
 * v11.0.0: TanStack Query cache is the source of truth (no sync store)
 *
 * Features:
 * - Forward lookups: parent → children
 * - Reverse lookups: child → parents
 * - Tab count calculations
 */
export function useEntityLinks(): UseEntityLinksResult {
  const queryClient = useQueryClient();

  const query = useQuery<LinkIndexes>({
    queryKey: QUERY_KEYS.entityLinks(),
    queryFn: async () => {
      // Fetch all entity links from API
      const response = await apiClient.get<{ data: EntityLink[] }>(
        '/api/v1/entity-instance-link'
      );
      const links = response.data?.data || [];

      // Build forward and reverse indexes
      const forward = new Map<
        string,
        { childIds: string[]; relationships: Record<string, string> }
      >();
      const reverse = new Map<
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
        if (!forward.has(forwardKey)) {
          forward.set(forwardKey, { childIds: [], relationships: {} });
        }
        const forwardEntry = forward.get(forwardKey)!;
        forwardEntry.childIds.push(link.child_entity_instance_id);
        forwardEntry.relationships[link.child_entity_instance_id] =
          link.relationship_type || 'contains';

        // Reverse: child → parents
        const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;
        if (!reverse.has(reverseKey)) {
          reverse.set(reverseKey, []);
        }
        reverse.get(reverseKey)!.push({
          entity_code: link.entity_code,
          entity_instance_id: link.entity_instance_id,
          relationship_type: link.relationship_type || 'contains',
        });
      }

      // Persist to Dexie
      for (const [key, value] of forward.entries()) {
        const [parentCode, parentId, childCode] = key.split(':');
        await setEntityLinkForward({
          parentCode,
          parentId,
          childCode,
          childIds: value.childIds,
          relationships: value.relationships,
        });
      }

      for (const [key, parents] of reverse.entries()) {
        const [childCode, childId] = key.split(':');
        await setEntityLinkReverse({
          childCode,
          childId,
          parents,
        });
      }

      return { forward, reverse };
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,
    gcTime: SESSION_STORE_CONFIG.gcTime,
  });

  // v11.0.0: Access TanStack Query cache directly
  const getChildIds = useCallback(
    (parentCode: string, parentId: string, childCode: string): string[] => {
      const data = query.data;
      if (!data) return [];
      const key = `${parentCode}:${parentId}:${childCode}`;
      return data.forward.get(key)?.childIds ?? [];
    },
    [query.data]
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
      const data = query.data;
      if (!data) return [];
      const key = `${childCode}:${childId}`;
      return data.reverse.get(key) ?? [];
    },
    [query.data]
  );

  const getTabCounts = useCallback(
    (parentCode: string, parentId: string): Record<string, number> => {
      const data = query.data;
      if (!data) return {};

      const counts: Record<string, number> = {};
      const childCodes = getChildEntityCodesSync(parentCode);

      for (const childCode of childCodes) {
        const key = `${parentCode}:${parentId}:${childCode}`;
        counts[childCode] = data.forward.get(key)?.childIds.length ?? 0;
      }

      return counts;
    },
    [query.data]
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
    const forward = new Map<
      string,
      { childIds: string[]; relationships: Record<string, string> }
    >();
    const reverse = new Map<
      string,
      Array<{
        entity_code: string;
        entity_instance_id: string;
        relationship_type: string;
      }>
    >();

    for (const link of links) {
      const forwardKey = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
      if (!forward.has(forwardKey)) {
        forward.set(forwardKey, { childIds: [], relationships: {} });
      }
      const forwardEntry = forward.get(forwardKey)!;
      forwardEntry.childIds.push(link.child_entity_instance_id);
      forwardEntry.relationships[link.child_entity_instance_id] =
        link.relationship_type || 'contains';

      const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;
      if (!reverse.has(reverseKey)) {
        reverse.set(reverseKey, []);
      }
      reverse.get(reverseKey)!.push({
        entity_code: link.entity_code,
        entity_instance_id: link.entity_instance_id,
        relationship_type: link.relationship_type || 'contains',
      });
    }

    for (const [key, value] of forward.entries()) {
      const [parentCode, parentId, childCode] = key.split(':');
      await setEntityLinkForward({
        parentCode,
        parentId,
        childCode,
        childIds: value.childIds,
        relationships: value.relationships,
      });
    }

    for (const [key, parents] of reverse.entries()) {
      const [childCode, childId] = key.split(':');
      await setEntityLinkReverse({
        childCode,
        childId,
        parents,
      });
    }

    // v11.0.0: Set in TanStack Query cache (no sync store)
    const { queryClient } = await import('../client');
    queryClient.setQueryData(QUERY_KEYS.entityLinks(), { forward, reverse });

    return {
      raw: links.length,
      forward: forward.size,
      reverse: reverse.size,
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
  // v11.0.0: Only clear TanStack Query cache and Dexie (no sync store)
  const { queryClient } = await import('../client');
  queryClient.removeQueries({ queryKey: QUERY_KEYS.entityLinks() });
  await clearEntityLinksDexie();
}

// ============================================================================
// Link Manipulation (Optimistic Updates)
// ============================================================================

/**
 * Add a link to the cache (optimistic update)
 * v11.0.0: Updates TanStack Query cache directly
 */
export async function addLinkToCache(link: EntityLink): Promise<void> {
  const { queryClient } = await import('../client');

  queryClient.setQueryData<LinkIndexes>(
    QUERY_KEYS.entityLinks(),
    (old) => {
      if (!old) return old;

      const forward = new Map(old.forward);
      const reverse = new Map(old.reverse);

      // Update forward index
      const forwardKey = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
      const existingForward = forward.get(forwardKey) || { childIds: [], relationships: {} };
      if (!existingForward.childIds.includes(link.child_entity_instance_id)) {
        existingForward.childIds.push(link.child_entity_instance_id);
      }
      existingForward.relationships[link.child_entity_instance_id] = link.relationship_type || 'contains';
      forward.set(forwardKey, existingForward);

      // Update reverse index
      const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;
      const existingReverse = reverse.get(reverseKey) || [];
      const parentExists = existingReverse.some(
        p => p.entity_code === link.entity_code && p.entity_instance_id === link.entity_instance_id
      );
      if (!parentExists) {
        existingReverse.push({
          entity_code: link.entity_code,
          entity_instance_id: link.entity_instance_id,
          relationship_type: link.relationship_type || 'contains',
        });
      }
      reverse.set(reverseKey, existingReverse);

      return { forward, reverse };
    }
  );
}

/**
 * Remove a link from the cache (optimistic update)
 * v11.0.0: Updates TanStack Query cache directly
 */
export async function removeLinkFromCache(link: EntityLink): Promise<void> {
  const { queryClient } = await import('../client');

  queryClient.setQueryData<LinkIndexes>(
    QUERY_KEYS.entityLinks(),
    (old) => {
      if (!old) return old;

      const forward = new Map(old.forward);
      const reverse = new Map(old.reverse);

      // Update forward index
      const forwardKey = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
      const existingForward = forward.get(forwardKey);
      if (existingForward) {
        existingForward.childIds = existingForward.childIds.filter(id => id !== link.child_entity_instance_id);
        delete existingForward.relationships[link.child_entity_instance_id];
        if (existingForward.childIds.length === 0) {
          forward.delete(forwardKey);
        } else {
          forward.set(forwardKey, existingForward);
        }
      }

      // Update reverse index
      const reverseKey = `${link.child_entity_code}:${link.child_entity_instance_id}`;
      const existingReverse = reverse.get(reverseKey);
      if (existingReverse) {
        const filtered = existingReverse.filter(
          p => !(p.entity_code === link.entity_code && p.entity_instance_id === link.entity_instance_id)
        );
        if (filtered.length === 0) {
          reverse.delete(reverseKey);
        } else {
          reverse.set(reverseKey, filtered);
        }
      }

      return { forward, reverse };
    }
  );
}
