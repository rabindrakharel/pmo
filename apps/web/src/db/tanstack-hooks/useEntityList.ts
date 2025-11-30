// ============================================================================
// useEntityList Hook
// ============================================================================
// Fetches entity list with TanStack Query + Dexie persistence
// Stores data and metadata separately for efficiency
// ============================================================================

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import {
  db,
  createEntityInstanceKey,
  createEntityInstanceDataKey,
  createQueryHash,
} from '../dexie/database';
import { wsManager } from '../tanstack-sync/WebSocketManager';
import { apiClient } from '../../lib/api';

// ============================================================================
// Types
// ============================================================================

export interface UseEntityListParams {
  /** Number of items per page */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Search query */
  search?: string;
  /** Sort field */
  sort?: string;
  /** Sort order */
  order?: 'asc' | 'desc';
  /** Additional filter parameters */
  [key: string]: unknown;
}

interface UseEntityListOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Override default stale time */
  staleTime?: number;
  /** Refetch on mount */
  refetchOnMount?: boolean | 'always';
}

interface EntityListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  metadata?: Record<string, unknown>;
  ref_data_entityInstance?: Record<string, Record<string, string>>;
}

export interface UseEntityListResult<T> {
  /** Array of entity data */
  data: T[] | undefined;
  /** Total count from server */
  total: number;
  /** Items per page */
  limit: number;
  /** Current offset */
  offset: number;
  /** Field metadata for rendering */
  metadata: Record<string, unknown> | undefined;
  /** Reference data for entity lookups */
  refData: Record<string, Record<string, string>> | undefined;
  /** Initial loading state */
  isLoading: boolean;
  /** Background refetch in progress */
  isFetching: boolean;
  /** Data is stale and being refreshed in background */
  isStale: boolean;
  /** Error occurred */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Manual refetch function */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching and subscribing to an entity list
 *
 * TanStack Query Key: ['entityInstanceData', entityCode, params]
 * Dexie Tables: entityInstanceData (data), entityInstanceMetadata (fields), entityInstance (names)
 *
 * Features:
 * - Automatic pagination support
 * - Filtering and search via params
 * - Persistence to IndexedDB via Dexie
 * - Real-time updates via WebSocket subscription
 * - Auto-subscribe to all loaded entity IDs
 * - Separates data and metadata storage
 *
 * @example
 * const { data, total, isLoading } = useEntityList<Project>('project', {
 *   limit: 20,
 *   offset: 0,
 *   search: 'kitchen',
 *   dl__project_stage: 'planning'
 * });
 */
export function useEntityList<T = Record<string, unknown>>(
  entityCode: string,
  params: UseEntityListParams = {},
  options: UseEntityListOptions = {}
): UseEntityListResult<T> {
  const { enabled = true, staleTime = 2 * 60 * 1000, refetchOnMount = true } = options;

  // Stable query hash for caching list results
  const queryHash = useMemo(() => createQueryHash(params), [params]);

  const query = useQuery<EntityListResponse<T>, Error>({
    queryKey: ['entityInstanceData', entityCode, params],
    queryFn: async () => {
      // Fetch from API
      const response = await apiClient.get(`/api/v1/${entityCode}`, { params });
      const apiData = response.data;

      const items = apiData.data || [];
      const entityIds: string[] = [];
      const now = Date.now();

      // Store metadata ONCE per entity type (not per record)
      if (apiData.metadata?.entityListOfInstancesTable) {
        const metadataTable = apiData.metadata.entityListOfInstancesTable;
        await db.entityInstanceMetadata.put({
          _id: entityCode,
          entityCode,
          fields: Object.keys(metadataTable.viewType || {}),
          viewType: metadataTable.viewType || {},
          editType: metadataTable.editType || {},
          syncedAt: now,
        });
      }

      // Collect entity IDs
      for (const item of items as Array<{ id: string }>) {
        entityIds.push(item.id);
      }

      // Persist entity instance names from ref_data_entityInstance
      if (apiData.ref_data_entityInstance) {
        for (const [refEntityCode, names] of Object.entries(apiData.ref_data_entityInstance)) {
          for (const [id, name] of Object.entries(names as Record<string, string>)) {
            await db.entityInstance.put({
              _id: createEntityInstanceKey(refEntityCode, id),
              entityCode: refEntityCode,
              entityInstanceId: id,
              entityInstanceName: name,
              syncedAt: now,
            });
          }
        }
      }

      // Persist list query result to entityInstanceData
      await db.entityInstanceData.put({
        _id: createEntityInstanceDataKey(entityCode, params),
        entityCode,
        queryHash,
        params,
        data: items,
        total: apiData.total || items.length,
        syncedAt: now,
      });

      return {
        data: items,
        total: apiData.total || items.length,
        limit: apiData.limit || params.limit || 20,
        offset: apiData.offset || params.offset || 0,
        metadata: apiData.metadata,
        ref_data_entityInstance: apiData.ref_data_entityInstance,
      };
    },
    enabled,
    staleTime,
    refetchOnMount,
    placeholderData: (previousData) => previousData,
  });

  // Auto-subscribe to all loaded entity IDs
  useEffect(() => {
    if (query.data?.data) {
      const entityIds = (query.data.data as Array<{ id: string }>).map((d) => d.id);
      if (entityIds.length > 0) {
        wsManager.subscribe(entityCode, entityIds);
      }
    }
  }, [entityCode, query.data]);

  // Wrap refetch to return void
  const refetch = async (): Promise<void> => {
    await query.refetch();
  };

  return {
    data: query.data?.data,
    total: query.data?.total ?? 0,
    limit: query.data?.limit ?? params.limit ?? 20,
    offset: query.data?.offset ?? params.offset ?? 0,
    metadata: query.data?.metadata,
    refData: query.data?.ref_data_entityInstance,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isStale: query.isStale,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}

// ============================================================================
// Entity Metadata Hook (for getting field metadata without data)
// ============================================================================

export interface UseEntityMetadataResult {
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
 * TanStack Query Key: ['entityInstanceMetadata', entityCode]
 * Dexie Table: entityInstanceMetadata
 *
 * Use when you need metadata without fetching data (e.g., empty child tabs)
 */
export function useEntityMetadata(entityCode: string): UseEntityMetadataResult {
  const query = useQuery({
    queryKey: ['entityInstanceMetadata', entityCode],
    queryFn: async () => {
      // Try Dexie first
      const cached = await db.entityInstanceMetadata.get(entityCode);
      if (cached) {
        return cached;
      }

      // Fetch from API with limit=1 to get metadata
      const response = await apiClient.get(`/api/v1/${entityCode}`, { params: { limit: 1 } });
      const metadata = response.data.metadata?.entityListOfInstancesTable;

      if (metadata) {
        const record = {
          _id: entityCode,
          entityCode,
          fields: Object.keys(metadata.viewType || {}),
          viewType: metadata.viewType || {},
          editType: metadata.editType || {},
          syncedAt: Date.now(),
        };
        await db.entityInstanceMetadata.put(record);
        return record;
      }

      return {
        _id: entityCode,
        entityCode,
        fields: [],
        viewType: {},
        editType: {},
        syncedAt: Date.now(),
      };
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
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
  metadata: Record<string, unknown> | undefined;
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
  params: Omit<UseEntityListParams, 'offset'> = {},
  options: UseEntityListOptions = {}
): UseEntityInfiniteListResult<T> {
  const { enabled = true, staleTime = 2 * 60 * 1000 } = options;
  const limit = params.limit || 20;

  const query = useInfiniteQuery<EntityListResponse<T>, Error>({
    queryKey: ['entityInstanceData-infinite', entityCode, params],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { ...params, limit, offset: pageParam },
      });
      const apiData = response.data;
      const now = Date.now();

      // Store metadata ONCE per entity type (first page only)
      if (apiData.metadata?.entityListOfInstancesTable && pageParam === 0) {
        const metadataTable = apiData.metadata.entityListOfInstancesTable;
        await db.entityInstanceMetadata.put({
          _id: entityCode,
          entityCode,
          fields: Object.keys(metadataTable.viewType || {}),
          viewType: metadataTable.viewType || {},
          editType: metadataTable.editType || {},
          syncedAt: now,
        });
      }

      // Store entity instance names
      if (apiData.ref_data_entityInstance) {
        for (const [refEntityCode, names] of Object.entries(apiData.ref_data_entityInstance)) {
          for (const [id, name] of Object.entries(names as Record<string, string>)) {
            await db.entityInstance.put({
              _id: createEntityInstanceKey(refEntityCode, id),
              entityCode: refEntityCode,
              entityInstanceId: id,
              entityInstanceName: name,
              syncedAt: now,
            });
          }
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
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled,
    staleTime,
  });

  // Flatten all pages into single array
  const flatData = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.data) ?? [];
  }, [query.data]);

  // Get metadata from first page
  const metadata = query.data?.pages[0]?.metadata;
  const refData = query.data?.pages[0]?.ref_data_entityInstance;
  const total = query.data?.pages[0]?.total ?? 0;

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
