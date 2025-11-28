// ============================================================================
// useEntityCodes Hook
// ============================================================================
// Fetches entity type definitions with TanStack Query + Dexie persistence
// Includes sync cache for non-hook access
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { db, createMetadataKey } from '../dexie/database';
import { apiClient } from '../../lib/api';

// ============================================================================
// Types
// ============================================================================

export interface EntityCodeData {
  /** Entity type code (e.g., 'project', 'task') */
  code: string;
  /** Internal name */
  name: string;
  /** Display label */
  label: string;
  /** Lucide icon name */
  icon: string | null;
  /** Description */
  descr?: string;
  /** Child entity types */
  child_entity_codes?: string[];
  /** Parent entity types */
  parent_entity_codes?: string[];
  /** Active status */
  active_flag: boolean;
}

export interface UseEntityCodesResult {
  /** Array of all entity codes */
  entityCodes: EntityCodeData[];
  /** Map for O(1) lookups */
  entityCodesMap: Map<string, EntityCodeData>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Get entity by code */
  getEntityByCode: (code: string) => EntityCodeData | null;
  /** Get label for code */
  getLabel: (code: string) => string;
  /** Get icon for code */
  getIcon: (code: string) => string | null;
  /** Get child entity codes */
  getChildCodes: (code: string) => string[];
  /** Manual refetch */
  refetch: () => Promise<void>;
}

// ============================================================================
// Sync Cache (for non-hook access)
// ============================================================================

let entityCodesSyncCache: EntityCodeData[] | null = null;

/**
 * Get entity codes synchronously from in-memory cache
 *
 * @returns Array of entity codes or null if not cached
 */
export function getEntityCodesSync(): EntityCodeData[] | null {
  return entityCodesSyncCache;
}

/**
 * Get entity by code synchronously
 *
 * @param code - Entity type code (e.g., 'project')
 * @returns Entity code data or undefined
 */
export function getEntityByCodeSync(code: string): EntityCodeData | undefined {
  return entityCodesSyncCache?.find((e) => e.code === code);
}

/**
 * Clear entity codes sync cache
 */
export function clearEntityCodesCache(): void {
  entityCodesSyncCache = null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching entity type definitions
 *
 * @example
 * const { entityCodes, getEntityByCode, isLoading } = useEntityCodes();
 * const projectEntity = getEntityByCode('project');
 * const childEntities = projectEntity?.child_entity_codes || [];
 */
export function useEntityCodes(): UseEntityCodesResult {
  const query = useQuery<EntityCodeData[], Error>({
    queryKey: ['entityCodes'],
    queryFn: async () => {
      // Fetch from API
      const response = await apiClient.get('/api/v1/entity/codes');
      const codes = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      // Persist to Dexie
      await db.metadata.put({
        _id: createMetadataKey('entityCodes'),
        type: 'entityCodes',
        data: codes,
        syncedAt: Date.now(),
      });

      // Update sync cache
      entityCodesSyncCache = codes;

      return codes;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Build Map for O(1) lookups
  const entityCodesMap = useMemo(() => {
    const map = new Map<string, EntityCodeData>();
    (query.data ?? []).forEach((entity) => map.set(entity.code, entity));
    return map;
  }, [query.data]);

  // Helper functions
  const getEntityByCode = useCallback(
    (code: string): EntityCodeData | null => {
      return entityCodesMap.get(code) || null;
    },
    [entityCodesMap]
  );

  const getLabel = useCallback(
    (code: string): string => {
      return entityCodesMap.get(code)?.label ?? code;
    },
    [entityCodesMap]
  );

  const getIcon = useCallback(
    (code: string): string | null => {
      return entityCodesMap.get(code)?.icon ?? null;
    },
    [entityCodesMap]
  );

  const getChildCodes = useCallback(
    (code: string): string[] => {
      return entityCodesMap.get(code)?.child_entity_codes ?? [];
    },
    [entityCodesMap]
  );

  return {
    entityCodes: query.data ?? [],
    entityCodesMap,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getEntityByCode,
    getLabel,
    getIcon,
    getChildCodes,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// Prefetch Entity Codes
// ============================================================================

/**
 * Prefetch entity codes from server
 * Called at login to populate cache
 */
export async function prefetchEntityCodes(): Promise<number> {
  try {
    const response = await apiClient.get('/api/v1/entity/codes');
    const codes = Array.isArray(response.data)
      ? response.data
      : response.data?.data || [];

    // Persist to Dexie
    await db.metadata.put({
      _id: createMetadataKey('entityCodes'),
      type: 'entityCodes',
      data: codes,
      syncedAt: Date.now(),
    });

    // Update sync cache
    entityCodesSyncCache = codes;

    console.log(
      `%c[EntityCodes] Prefetched ${codes.length} entity types`,
      'color: #51cf66; font-weight: bold'
    );

    return codes.length;
  } catch (error) {
    console.error('[EntityCodes] Prefetch failed:', error);

    // Fallback: Load from Dexie cache
    const cached = await db.metadata.get(createMetadataKey('entityCodes'));
    if (cached) {
      entityCodesSyncCache = cached.data as EntityCodeData[];
      return entityCodesSyncCache.length;
    }

    return 0;
  }
}
