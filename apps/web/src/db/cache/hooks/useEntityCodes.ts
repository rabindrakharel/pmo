// ============================================================================
// useEntityCodes Hook
// ============================================================================
// Hook for accessing entity type definitions
// Session-level store - prefetch on login, 30 min staleTime
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '../keys';
import { SESSION_STORE_CONFIG, STORE_STALE_TIMES } from '../constants';
import { entityCodesStore } from '../stores';
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
 */
export function useEntityCodes(): UseEntityCodesResult {
  const query = useQuery<EntityCode[]>({
    queryKey: QUERY_KEYS.entityCodes(),
    queryFn: async () => {
      // Layer 2: Check Dexie
      const cached = await getEntityCodes();

      // Layer 3: Fetch from API
      try {
        const response = await apiClient.get<{ data: EntityCode[] }>(
          '/api/v1/entity/types'
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
  });

  // Update sync store when data changes
  useEffect(() => {
    if (query.data) {
      entityCodesStore.set(query.data);
    }
  }, [query.data]);

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
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getByCode,
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
      '/api/v1/entity/types'
    );
    const codes = response.data?.data || [];

    // Set in query cache
    const { queryClient } = await import('../client');
    queryClient.setQueryData(QUERY_KEYS.entityCodes(), codes);

    // Set in sync store
    entityCodesStore.set(codes);

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
  const { queryClient } = await import('../client');
  queryClient.removeQueries({ queryKey: QUERY_KEYS.entityCodes() });
  entityCodesStore.clear();
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
