// ============================================================================
// useEntityInstanceData Hook
// ============================================================================
// v14.0.0: Unified hook for entity list data with optional infinite scroll
// Supports both regular queries and infinite scroll via options.infiniteScroll
// On-demand store - 5 min staleTime, never prefetch
// ============================================================================

import { useQuery, useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS, createQueryHash } from '../keys';
import { ONDEMAND_STORE_CONFIG, SESSION_STORE_CONFIG } from '../constants';
// v9.4.0: Unified cache for edit mode entity reference resolution
import { upsertRefDataEntityInstance } from '@/lib/hooks/useRefDataEntityInstance';
import { queryClient } from '../client';

// ============================================================================
// DEBUG LOGGING - Cache Layer Diagnostics
// ============================================================================
// Set to true to enable detailed cache debugging for staleness issues
const DEBUG_CACHE = false;

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
// Re-export types for consumers
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
// Stable Empty State (Module-Level Constant)
// ============================================================================
// Prevents reference changes that cause infinite re-renders
// Frozen to prevent accidental mutation
const EMPTY_ARRAY: readonly unknown[] = Object.freeze([]);

// Stable disabled result - returned when query is disabled
// This prevents unnecessary object allocations on each render
const DISABLED_RESULT = Object.freeze({
  data: EMPTY_ARRAY,
  total: 0,
  metadata: undefined,
  refData: undefined,
  isLoading: false,
  isFetching: false,
  isStale: false,
  isError: false,
  error: null,
  refetch: async () => {},
  // v14.0.0: Infinite scroll props (always present, disabled when not in infinite mode)
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: undefined,
});

// ============================================================================
// Options interface for useEntityInstanceData
// ============================================================================
export interface UseEntityInstanceDataOptions {
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
  /**
   * v14.0.0: Enable infinite scroll mode (default: false)
   * When true, uses useInfiniteQuery internally with pagination
   */
  infiniteScroll?: boolean;
}

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
 * - INVARIANT: Returns stable empty state when entityCode is empty (fail-safe)
 * - v14.0.0: Supports infinite scroll via options.infiniteScroll
 *
 * @param entityCode - Entity type code (e.g., 'project', 'task'). MUST be non-empty.
 * @param params - Query parameters (limit, offset, search, filters)
 * @param options.enabled - Whether to enable the query (default: true)
 * @param options.infiniteScroll - Enable infinite scroll mode (default: false)
 *
 * @example
 * // Regular mode (loads all at once)
 * const { data, total } = useEntityInstanceData('project', { limit: 20000 });
 *
 * // Infinite scroll mode (loads pages on demand)
 * const { data, hasNextPage, fetchNextPage } = useEntityInstanceData('project',
 *   { limit: 50 },
 *   { infiniteScroll: true }
 * );
 */
export function useEntityInstanceData<T = Record<string, unknown>>(
  entityCode: string,
  params: EntityInstanceDataParams = {},
  options: UseEntityInstanceDataOptions = {}
): UseEntityInstanceDataResult<T> {
  const { enabled = true, infiniteScroll = false } = options;

  // ============================================================================
  // INVARIANT: entityCode must be non-empty for query to run
  // ============================================================================
  // This is the fail-safe layer - hook should NEVER make invalid API requests.
  // Even if caller forgets to pass enabled:false, we protect against empty entityCode.
  const isValidEntityCode = Boolean(entityCode && entityCode.trim());
  const isQueryEnabled = enabled && isValidEntityCode;

  // Development warning for misconfiguration
  if (process.env.NODE_ENV === 'development' && enabled && !isValidEntityCode) {
    console.warn(
      `[useEntityInstanceData] Called with empty entityCode="${entityCode}". ` +
        `Pass { enabled: false } or provide a valid entityCode to prevent invalid API calls.`
    );
  }

  // Pre-subscribe to WebSocket to close race window (only when enabled)
  const hasSubscribedRef = useRef(false);
  useEffect(() => {
    if (isQueryEnabled && !hasSubscribedRef.current) {
      wsManager.subscribe(entityCode, []);
      hasSubscribedRef.current = true;
    }
    return () => {
      hasSubscribedRef.current = false;
    };
  }, [entityCode, isQueryEnabled]);

  const queryHash = useMemo(() => createQueryHash(params), [params]);
  const limit = params.limit || 50;

  // Define result type
  type QueryResult = {
    data: T[];
    total: number;
    metadata?: EntityInstanceMetadata;
    refData?: Record<string, Record<string, string>>;
  };

  // ============================================================================
  // REGULAR QUERY (non-infinite scroll mode)
  // ============================================================================
  const regularQuery = useQuery({
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
          // v11.0.0: Upsert to TanStack Query cache for edit mode
          // This ensures EntityInstanceNameSelect can resolve UUIDs to names
          if (cached.refData) {
            upsertRefDataEntityInstance(queryClient, cached.refData);
            debugCache(`✅ TanStack Query cache hydrated from Dexie cache`, {
              entityCodes: Object.keys(cached.refData),
              counts: Object.fromEntries(
                Object.entries(cached.refData).map(([k, v]) => [k, Object.keys(v).length])
              ),
            });
          }
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

      const apiUrl = `/api/v1/${entityCode}?${searchParams}`;
      debugCache(`📡 Fetching from API...`, { entityCode, url: apiUrl });

      const response = await apiClient.get<EntityListResponse<T>>(apiUrl);
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
      });

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
        }
        upsertRefDataEntityInstance(queryClient, result.refData);
      }

      return result;
    },
    staleTime: ONDEMAND_STORE_CONFIG.staleTime,
    gcTime: ONDEMAND_STORE_CONFIG.gcTime,
    enabled: isQueryEnabled && !infiniteScroll,  // Disabled when in infinite scroll mode
  });

  // ============================================================================
  // INFINITE SCROLL QUERY (v14.0.0)
  // ============================================================================
  const infiniteQuery = useInfiniteQuery<EntityListResponse<T>, Error>({
    queryKey: QUERY_KEYS.entityInstanceDataInfinite(entityCode, params),
    queryFn: async ({ pageParam = 0 }) => {
      const searchParams = new URLSearchParams();
      Object.entries({ ...params, limit, offset: pageParam }).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });

      debugCache(`📡 Infinite scroll: Fetching page...`, { entityCode, offset: pageParam, limit });

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
        }
        upsertRefDataEntityInstance(queryClient, apiData.ref_data_entityInstance as Record<string, Record<string, string>>);
      }

      debugCache(`✅ Infinite scroll: Page loaded`, {
        entityCode,
        offset: pageParam,
        rowCount: apiData.data?.length,
        total: apiData.total,
      });

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
    enabled: isQueryEnabled && infiniteScroll,  // Only enabled in infinite scroll mode
    staleTime: ONDEMAND_STORE_CONFIG.staleTime,
  });

  // ============================================================================
  // EARLY RETURN: Stable disabled result when query is not enabled
  // ============================================================================
  if (!isQueryEnabled) {
    return DISABLED_RESULT as UseEntityInstanceDataResult<T>;
  }

  // ============================================================================
  // v14.0.0: UNIFIED RESULT - Select based on mode
  // ============================================================================
  if (infiniteScroll) {
    // Flatten all pages into single array
    type PageResult = EntityListResponse<T> & { offset: number; limit: number };
    const pages = infiniteQuery.data?.pages as PageResult[] | undefined;
    const flatData = pages?.flatMap((page) => page.data) ?? [];
    const metadata = pages?.[0]?.metadata?.entityListOfInstancesTable;
    const refData = pages?.[0]?.ref_data_entityInstance;
    const total = pages?.[0]?.total ?? 0;

    return {
      data: flatData as T[],
      total,
      metadata,
      refData,
      isLoading: infiniteQuery.isLoading,
      isFetching: infiniteQuery.isFetching,
      isStale: infiniteQuery.isStale,
      isError: infiniteQuery.isError,
      error: infiniteQuery.error,
      refetch: async () => {
        await infiniteQuery.refetch();
      },
      // Infinite scroll props
      hasNextPage: infiniteQuery.hasNextPage ?? false,
      isFetchingNextPage: infiniteQuery.isFetchingNextPage,
      fetchNextPage: async () => {
        await infiniteQuery.fetchNextPage();
      },
    };
  }

  // Regular mode result
  const refetch = async (): Promise<void> => {
    debugCache('🔄 refetch() called - clearing Dexie cache before API fetch', { entityCode, params });
    await clearEntityInstanceDataDexie(entityCode);
    await regularQuery.refetch();
    debugCache('✅ refetch() complete', { entityCode });
  };

  const result = regularQuery.data as QueryResult | undefined;

  return {
    data: result?.data ?? (EMPTY_ARRAY as T[]),
    total: result?.total ?? 0,
    metadata: result?.metadata,
    refData: result?.refData,
    isLoading: regularQuery.isLoading,
    isFetching: regularQuery.isFetching,
    isStale: regularQuery.isStale,
    isError: regularQuery.isError,
    error: regularQuery.error,
    refetch,
    // Infinite scroll props (disabled in regular mode)
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: undefined,
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
  /** View type metadata (undefined during load) */
  viewType: Record<string, unknown> | undefined;
  /** Edit type metadata (undefined during load) */
  editType: Record<string, unknown> | undefined;
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
    // Don't fetch if entityCode is empty/undefined
    enabled: Boolean(entityCode),
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
    viewType: query.data?.viewType,  // Return undefined when loading (not {})
    editType: query.data?.editType,  // Return undefined when loading (not {})
    isLoading: query.isLoading,
    isError: query.isError,
  };
}


