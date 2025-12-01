// ============================================================================
// useEntityInstanceData Hook
// ============================================================================
// Hook for fetching entity list data with pagination and filtering
// On-demand store - 5 min staleTime, never prefetch
// ============================================================================

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS, createQueryHash } from '../keys';
import { ONDEMAND_STORE_CONFIG, SESSION_STORE_CONFIG } from '../constants';
import { entityInstanceNamesStore } from '../stores';

// ============================================================================
// DEBUG LOGGING - Cache Layer Diagnostics
// ============================================================================
// Set to true to enable detailed cache debugging for staleness issues
const DEBUG_CACHE = true;

const debugCache = (message: string, data?: Record<string, unknown>) => {
  if (DEBUG_CACHE) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(
      `%c[${timestamp}] [DATA-FETCH] ${message}`,
      'color: #10b981; font-weight: bold',
      data || ''
    );
  }
};
import type {
  EntityInstanceDataParams,
  EntityListResponse,
  EntityInstanceMetadata,
  UseEntityInstanceDataResult,
  ViewFieldMetadata,
  EditFieldMetadata,
} from '../types';
// Re-export type for consumers
export type { UseEntityInstanceDataResult } from '../types';
import {
  getEntityInstanceData,
  getEntityInstanceMetadata,
  setEntityInstanceMetadata,
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
  params: EntityInstanceDataParams = {},
  options: { enabled?: boolean } = {}
): UseEntityInstanceDataResult<T> {
  const { enabled = true } = options;

  // Pre-subscribe to WebSocket to close race window
  const hasSubscribedRef = useRef(false);
  useEffect(() => {
    if (enabled && !hasSubscribedRef.current) {
      wsManager.subscribe(entityCode, []);
      hasSubscribedRef.current = true;
    }
    return () => {
      hasSubscribedRef.current = false;
    };
  }, [entityCode, enabled]);

  const queryHash = useMemo(() => createQueryHash(params), [params]);

  // Define result type
  type QueryResult = {
    data: T[];
    total: number;
    metadata?: EntityInstanceMetadata;
    refData?: Record<string, Record<string, string>>;
  };

  const query = useQuery({
    queryKey: QUERY_KEYS.entityInstanceData(entityCode, params),
    queryFn: async () => {
      debugCache(`🔍 queryFn called - checking Dexie (IndexedDB)...`, {
        entityCode,
        params,
        queryKey: JSON.stringify(QUERY_KEYS.entityInstanceData(entityCode, params)),
      });

      // Layer 2: Check Dexie (with TTL validation)
      const cached = await getEntityInstanceData(entityCode, params);
      if (cached) {
        const cacheAgeMs = Date.now() - (cached.syncedAt || 0);
        const isStale = cacheAgeMs > ONDEMAND_STORE_CONFIG.staleTime;

        debugCache(isStale ? '⏰ Dexie cache STALE - will fetch from API' : '✅ Dexie cache HIT - returning cached data', {
          entityCode,
          cacheAgeMs: `${Math.round(cacheAgeMs / 1000)}s`,
          staleTimeMs: `${ONDEMAND_STORE_CONFIG.staleTime / 1000}s`,
          isStale,
          rowCount: cached.data?.length,
          firstRowBudget: (cached.data?.[0] as any)?.budget_allocated_amt,
          firstRowUpdatedTs: (cached.data?.[0] as any)?.updated_ts,
        });

        // Only return cached data if within TTL
        if (!isStale) {
          return {
            data: cached.data as T[],
            total: cached.total,
            metadata: cached.metadata,
            refData: cached.refData,
          };
        }
        // Cache is stale, fall through to API fetch
      } else {
        debugCache('❌ Dexie cache MISS - will fetch from API', { entityCode, params });
      }

      // Layer 3: Fetch from API
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });

      debugCache(`📡 Fetching from API...`, { entityCode, url: `/api/v1/${entityCode}?${searchParams}` });

      const response = await apiClient.get<EntityListResponse<T>>(
        `/api/v1/${entityCode}?${searchParams}`
      );
      const apiData = response.data;

      const result = {
        data: apiData.data || [],
        total: apiData.total || 0,
        metadata: apiData.metadata?.entityListOfInstancesTable,
        refData: apiData.ref_data_entityInstance,
      };

      debugCache('📥 API response received - persisting to Dexie', {
        entityCode,
        rowCount: result.data.length,
        total: result.total,
        firstRowBudget: (result.data[0] as any)?.budget_allocated_amt,
        firstRowVersion: (result.data[0] as any)?.version,
        firstRowUpdatedTs: (result.data[0] as any)?.updated_ts,
      });

      // Persist to Dexie
      debugCache(`💾 Persisting to Dexie (IndexedDB)...`, { entityCode, queryHash });
      await persistToEntityInstanceData(
        entityCode,
        queryHash,
        params,
        result.data as Record<string, unknown>[],
        result.total,
        result.metadata,
        result.refData
      );
      debugCache(`✅ Dexie persistence complete`, { entityCode });

      // Persist entity instance names from refData
      if (result.refData) {
        for (const [code, names] of Object.entries(result.refData)) {
          await persistToEntityInstanceNames(code, names);
          // Update sync store
          entityInstanceNamesStore.merge(code, names);
        }
      }

      debugCache(`✅ queryFn complete - returning fresh data`, {
        entityCode,
        rowCount: result.data.length,
      });
      return result;
    },
    staleTime: ONDEMAND_STORE_CONFIG.staleTime,
    gcTime: ONDEMAND_STORE_CONFIG.gcTime,
    enabled,
  });

  const refetch = async (): Promise<void> => {
    // Clear Dexie cache for this entity before refetching to ensure fresh data
    // This is critical after PATCH/POST operations to avoid returning stale cached data
    debugCache('🔄 refetch() called - clearing Dexie cache before API fetch', { entityCode, params });
    await clearEntityInstanceDataDexie(entityCode);
    debugCache('🗑️ Dexie cache cleared - now calling query.refetch()', { entityCode });
    await query.refetch();
    debugCache('✅ refetch() complete', { entityCode });
  };

  // Type assertion for query result
  const result = query.data as QueryResult | undefined;

  return {
    data: result?.data ?? [],
    total: result?.total ?? 0,
    metadata: result?.metadata,
    refData: result?.refData,
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
// Entity Metadata Hook (for getting field metadata without data)
// ============================================================================

export interface UseEntityInstanceMetadataResult {
  /** Field names */
  fields: string[];
  /** View type metadata */
  viewType: Record<string, unknown>;
  /** Edit type metadata */
  editType: Record<string, unknown>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
}

/**
 * Hook for fetching entity field metadata only
 *
 * STORE: entityInstanceMetadata
 * LAYER: Session-level (30 min staleTime)
 * PERSISTENCE: Dexie IndexedDB (per entity + component)
 *
 * Uses content=metadata API parameter to get metadata without data transfer.
 * This is more efficient than limit=1 as it skips the data query entirely.
 *
 * @param entityCode - Entity type code (e.g., 'project', 'task')
 * @param component - Component view type (default: 'entityListOfInstancesTable')
 */
export function useEntityInstanceMetadata(
  entityCode: string,
  component: string = 'entityListOfInstancesTable'
): UseEntityInstanceMetadataResult {
  // Define the record type for query
  interface MetadataRecord {
    _id: string;
    entityCode: string;
    fields: string[];
    viewType: Record<string, ViewFieldMetadata>;
    editType: Record<string, EditFieldMetadata>;
    syncedAt: number;
  }

  const query = useQuery<MetadataRecord>({
    queryKey: QUERY_KEYS.entityInstanceMetadata(entityCode, component),
    queryFn: async () => {
      // Try Dexie cache first (per entity + component)
      const cached = await getEntityInstanceMetadata(entityCode, component);
      if (cached && Date.now() - cached.syncedAt < SESSION_STORE_CONFIG.staleTime) {
        return cached;
      }

      // Fetch metadata-only from API (no data transferred)
      // Uses content=metadata parameter - skips data query on backend
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { content: 'metadata' },
      });

      // Response structure: { data: [], fields: [], metadata: { [component]: { viewType, editType } } }
      const componentMetadata = response.data.metadata?.[component] as {
        viewType?: Record<string, ViewFieldMetadata>;
        editType?: Record<string, EditFieldMetadata>;
      } | undefined;
      const fields = (response.data.fields || []) as string[];

      const record: MetadataRecord = {
        _id: `${entityCode}:${component}`,
        entityCode,
        fields: fields.length > 0 ? fields : Object.keys(componentMetadata?.viewType || {}),
        viewType: componentMetadata?.viewType || {},
        editType: componentMetadata?.editType || {},
        syncedAt: Date.now(),
      };

      // Persist to Dexie with component key
      await setEntityInstanceMetadata(
        entityCode,
        component,
        record.fields,
        record.viewType,
        record.editType
      );
      return record;
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,
    gcTime: SESSION_STORE_CONFIG.gcTime,
  });

  return {
    fields: query.data?.fields ?? [],
    viewType: query.data?.viewType ?? {},
    editType: query.data?.editType ?? {},
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// ============================================================================
// Infinite Query Hook (for load more patterns)
// ============================================================================

export interface UseEntityInfiniteListResult<T> {
  /** Flattened array of all loaded pages */
  data: T[] | undefined;
  /** Total count from server */
  total: number;
  /** Field metadata */
  metadata: EntityInstanceMetadata | undefined;
  /** Reference data */
  refData: Record<string, Record<string, string>> | undefined;
  /** Initial loading */
  isLoading: boolean;
  /** Loading more pages */
  isFetchingNextPage: boolean;
  /** Has more pages to load */
  hasNextPage: boolean;
  /** Error occurred */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Load next page */
  fetchNextPage: () => Promise<void>;
  /** Manual refetch all */
  refetch: () => Promise<void>;
}

/**
 * Hook for infinite scrolling entity lists
 *
 * @example
 * const { data, hasNextPage, fetchNextPage } = useEntityInfiniteList<Task>('task', {
 *   limit: 20,
 *   dl__task_stage: 'in_progress'
 * });
 */
export function useEntityInfiniteList<T = Record<string, unknown>>(
  entityCode: string,
  params: Omit<EntityInstanceDataParams, 'offset'> = {},
  options: { enabled?: boolean; staleTime?: number } = {}
): UseEntityInfiniteListResult<T> {
  const { enabled = true, staleTime = ONDEMAND_STORE_CONFIG.staleTime } = options;
  const limit = params.limit || 20;

  // Pre-subscribe to entity type (close race window)
  const hasSubscribedRef = useRef(false);
  useEffect(() => {
    if (enabled && !hasSubscribedRef.current) {
      wsManager.subscribe(entityCode, []);
      hasSubscribedRef.current = true;
    }
    return () => {
      hasSubscribedRef.current = false;
    };
  }, [entityCode, enabled]);

  const query = useInfiniteQuery<EntityListResponse<T>, Error>({
    queryKey: QUERY_KEYS.entityInstanceDataInfinite(entityCode, params),
    queryFn: async ({ pageParam = 0 }) => {
      const searchParams = new URLSearchParams();
      Object.entries({ ...params, limit, offset: pageParam }).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });

      const response = await apiClient.get<EntityListResponse<T>>(
        `/api/v1/${entityCode}?${searchParams}`
      );
      const apiData = response.data;

      // Store metadata ONCE per entity type (first page only)
      if (apiData.metadata?.entityListOfInstancesTable && pageParam === 0) {
        const metadataTable = apiData.metadata.entityListOfInstancesTable;
        await setEntityInstanceMetadata(
          entityCode,
          'entityListOfInstancesTable',
          Object.keys(metadataTable.viewType || {}),
          metadataTable.viewType || {},
          metadataTable.editType || {}
        );
      }

      // Store entity instance names
      if (apiData.ref_data_entityInstance) {
        for (const [refEntityCode, names] of Object.entries(apiData.ref_data_entityInstance)) {
          await persistToEntityInstanceNames(refEntityCode, names as Record<string, string>);
          entityInstanceNamesStore.merge(refEntityCode, names as Record<string, string>);
        }
      }

      return {
        data: apiData.data || [],
        total: apiData.total || 0,
        limit: apiData.limit || limit,
        offset: pageParam as number,
        metadata: apiData.metadata,
        ref_data_entityInstance: apiData.ref_data_entityInstance,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: EntityListResponse<T> & { offset: number; limit: number }) => {
      const nextOffset = (lastPage.offset ?? 0) + (lastPage.limit ?? limit);
      return nextOffset < (lastPage.total ?? 0) ? nextOffset : undefined;
    },
    enabled,
    staleTime,
  });

  // Type for page result
  type PageResult = EntityListResponse<T> & { offset: number; limit: number };

  // Flatten all pages into single array
  const flatData = useMemo(() => {
    const pages = query.data?.pages as PageResult[] | undefined;
    return pages?.flatMap((page) => page.data) ?? [];
  }, [query.data]);

  // Get metadata from first page
  const pages = query.data?.pages as PageResult[] | undefined;
  const metadata = pages?.[0]?.metadata?.entityListOfInstancesTable;
  const refData = pages?.[0]?.ref_data_entityInstance;
  const total = pages?.[0]?.total ?? 0;

  // Auto-subscribe to all loaded entity IDs
  useEffect(() => {
    if (flatData.length > 0) {
      const entityIds = (flatData as Array<{ id: string }>).map((d) => d.id);
      wsManager.subscribe(entityCode, entityIds);
    }
  }, [entityCode, flatData]);

  return {
    data: flatData as T[],
    total,
    metadata,
    refData,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    isError: query.isError,
    error: query.error,
    fetchNextPage: async () => {
      await query.fetchNextPage();
    },
    refetch: async () => {
      await query.refetch();
    },
  };
}

