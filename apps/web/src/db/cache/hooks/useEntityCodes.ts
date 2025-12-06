// ============================================================================
// useEntityCodes Hook
// ============================================================================
// Hook for accessing entity type definitions
// Session-level store - prefetch on login, 30 min staleTime
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '../keys';
import { SESSION_STORE_CONFIG, STORE_STALE_TIMES } from '../constants';
import type { EntityCode, UseEntityCodesResult } from '../types';
import {
  getEntityCodes,
  clearEntityCodes,
} from '../../persistence/operations';
import { persistToEntityCodes } from '../../persistence/hydrate';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for accessing entity type definitions
 *
 * STORE: entityCodes
 * LAYER: Session-level (prefetch on login, 30 min staleTime)
 * PERSISTENCE: Dexie IndexedDB with 24-hour TTL
 *
 * Features:
 * - Returns all entity type definitions
 * - Helper methods for lookup by code
 * - Child entity codes for tabs
 *
 * @param options.enabled - Whether to enable the query (default: true)
 */
export function useEntityCodes(options: { enabled?: boolean } = {}): UseEntityCodesResult {
  const { enabled = true } = options;

  const query = useQuery<EntityCode[]>({
    queryKey: QUERY_KEYS.entityCodes(),
    queryFn: async () => {
      // Layer 2: Check Dexie
      const cached = await getEntityCodes();

      // Layer 3: Fetch from API
      try {
        const response = await apiClient.get<{ data: EntityCode[] }>(
          '/api/v1/entity/codes'
        );
        const codes = response.data?.data || [];

        // Persist to Dexie
        await persistToEntityCodes(codes);

        return codes;
      } catch (error) {
        // If API fails but we have cached data, use it
        if (cached) {
          return cached;
        }
        throw error;
      }
    },
    staleTime: STORE_STALE_TIMES.entityCodes,
    gcTime: SESSION_STORE_CONFIG.gcTime,
    placeholderData: [],
    enabled,
  });

  // v11.0.0: Removed sync store update - TanStack Query cache is the source of truth

  const getByCode = useCallback(
    (code: string): EntityCode | undefined => {
      return query.data?.find((e) => e.code === code);
    },
    [query.data]
  );

  const getChildCodes = useCallback(
    (code: string): string[] => {
      return query.data?.find((e) => e.code === code)?.child_entity_codes ?? [];
    },
    [query.data]
  );

  return {
    codes: query.data ?? [],
    // Alias for backward compatibility
    entityCodes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getByCode,
    // Alias for backward compatibility
    getEntityByCode: getByCode,
    getChildCodes,
  };
}

// ============================================================================
// Prefetch Function
// ============================================================================

/**
 * Prefetch entity codes into cache
 * Called during app initialization
 */
export async function prefetchEntityCodes(): Promise<number> {
  try {
    const response = await apiClient.get<{ data: EntityCode[] }>(
      '/api/v1/entity/codes'
    );
    const codes = response.data?.data || [];

    // v11.0.0: Set in query cache and Dexie only (no sync store)
    const { queryClient } = await import('../client');
    queryClient.setQueryData(QUERY_KEYS.entityCodes(), codes);

    // Persist to Dexie
    await persistToEntityCodes(codes);

    return codes.length;
  } catch (error) {
    console.error('[useEntityCodes] Prefetch failed:', error);
    return 0;
  }
}

// ============================================================================
// Clear Function
// ============================================================================

/**
 * Clear entity codes cache
 * Called on logout
 */
export async function clearEntityCodesCache(): Promise<void> {
  // v11.0.0: Only clear TanStack Query cache and Dexie (no sync store)
  const { queryClient } = await import('../client');
  queryClient.removeQueries({ queryKey: QUERY_KEYS.entityCodes() });
  await clearEntityCodes();
}

// ============================================================================
// Sync Access (Re-export for convenience)
// ============================================================================

export {
  getEntityCodesSync,
  getEntityCodeSync,
  getChildEntityCodesSync,
} from '../stores';
