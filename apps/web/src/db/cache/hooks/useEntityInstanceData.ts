// ============================================================================
// useEntityInstanceData Hook
// ============================================================================
// Hook for fetching entity list data with pagination and filtering
// On-demand store - 5 min staleTime, never prefetch
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS, createQueryHash } from '../keys';
import { ONDEMAND_STORE_CONFIG } from '../constants';
import { entityInstanceNamesStore } from '../stores';
import type {
  EntityInstanceDataParams,
  UseEntityInstanceDataResult,
  EntityListResponse,
  EntityInstanceMetadata,
} from '../types';
import {
  getEntityInstanceData,
  setEntityInstanceData,
  clearEntityInstanceData as clearEntityInstanceDataDexie,
} from '../../persistence/operations';
import {
  persistToEntityInstanceData,
  persistToEntityInstanceNames,
} from '../../persistence/hydrate';
import { wsManager } from '../../realtime/manager';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching entity list data
 *
 * STORE: entityInstanceData
 * LAYER: On-demand (5 min staleTime, never prefetch)
 * PERSISTENCE: Dexie IndexedDB with 30-min TTL
 *
 * Features:
 * - Pre-subscribes to WebSocket for real-time updates
 * - Supports pagination, search, and filtering
 * - Returns metadata for field definitions
 * - Returns refData for entity instance name lookups
 *
 * @param entityCode - Entity type code (e.g., 'project', 'task')
 * @param params - Query parameters (limit, offset, search, filters)
 */
export function useEntityInstanceData<T = Record<string, unknown>>(
  entityCode: string,
  params: EntityInstanceDataParams = {}
): UseEntityInstanceDataResult<T> {
  // Pre-subscribe to WebSocket to close race window
  const hasSubscribedRef = useRef(false);
  useEffect(() => {
    if (!hasSubscribedRef.current) {
      wsManager.subscribe(entityCode, []);
      hasSubscribedRef.current = true;
    }
    return () => {
      hasSubscribedRef.current = false;
    };
  }, [entityCode]);

  const queryHash = useMemo(() => createQueryHash(params), [params]);

  const query = useQuery<{
    data: T[];
    total: number;
    metadata?: EntityInstanceMetadata;
    refData?: Record<string, Record<string, string>>;
  }>({
    queryKey: QUERY_KEYS.entityInstanceData(entityCode, params),
    queryFn: async () => {
      // Layer 2: Check Dexie
      const cached = await getEntityInstanceData(entityCode, params);
      if (cached) {
        // Return cached data but trigger background refresh
        return {
          data: cached.data as T[],
          total: cached.total,
          metadata: cached.metadata,
          refData: cached.refData,
        };
      }

      // Layer 3: Fetch from API
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });

      const response = await apiClient.get<EntityListResponse<T>>(
        `/api/v1/${entityCode}?${searchParams}`
      );

      const result = {
        data: response.data || [],
        total: response.total || 0,
        metadata: response.metadata?.entityListOfInstancesTable,
        refData: response.ref_data_entityInstance,
      };

      // Persist to Dexie
      await persistToEntityInstanceData(
        entityCode,
        queryHash,
        params,
        result.data as Record<string, unknown>[],
        result.total,
        result.metadata,
        result.refData
      );

      // Persist entity instance names from refData
      if (result.refData) {
        for (const [code, names] of Object.entries(result.refData)) {
          await persistToEntityInstanceNames(code, names);
          // Update sync store
          entityInstanceNamesStore.merge(code, names);
        }
      }

      return result;
    },
    staleTime: ONDEMAND_STORE_CONFIG.staleTime,
    gcTime: ONDEMAND_STORE_CONFIG.gcTime,
  });

  const refetch = async (): Promise<void> => {
    await query.refetch();
  };

  return {
    data: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    metadata: query.data?.metadata,
    refData: query.data?.refData,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isStale: query.isStale,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}

// ============================================================================
// Clear Function
// ============================================================================

/**
 * Clear entity instance data cache
 * @param entityCode - Optional specific entity code to clear
 */
export async function clearEntityInstanceDataCache(
  entityCode?: string
): Promise<void> {
  const { queryClient } = await import('../client');

  if (entityCode) {
    queryClient.removeQueries({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });
    await clearEntityInstanceDataDexie(entityCode);
  } else {
    queryClient.removeQueries({ queryKey: ['entityInstanceData'] });
    await clearEntityInstanceDataDexie();
  }
}

// ============================================================================
// Alias for backward compatibility
// ============================================================================

/**
 * @deprecated Use useEntityInstanceData instead
 */
export const useEntityList = useEntityInstanceData;
