// ============================================================================
// useEntityList Hook
// ============================================================================
// Fetches entity list with TanStack Query + Dexie persistence
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { db, createEntityKey, createQueryHash } from '../dexie/database';
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
 * Features:
 * - Automatic pagination support
 * - Filtering and search via params
 * - Persistence to IndexedDB via Dexie
 * - Real-time updates via WebSocket subscription
 * - Auto-subscribe to all loaded entity IDs
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
    queryKey: ['entity-list', entityCode, params],
    queryFn: async () => {
      // Fetch from API
      const response = await apiClient.get(`/api/v1/${entityCode}`, { params });
      const apiData = response.data;

      const items = apiData.data || [];
      const entityIds: string[] = [];

      // Persist individual entities to Dexie
      for (const item of items as Array<{ id: string; version?: number }>) {
        entityIds.push(item.id);

        await db.entities.put({
          _id: createEntityKey(entityCode, item.id),
          entityCode,
          entityId: item.id,
          data: item,
          metadata: apiData.metadata,
          refData: apiData.ref_data_entityInstance,
          version: item.version || Date.now(),
          syncedAt: Date.now(),
          isDeleted: false,
        });
      }

      // Persist list query result
      await db.entityLists.put({
        _id: `${entityCode}:${queryHash}`,
        entityCode,
        queryHash,
        params,
        entityIds,
        total: apiData.total || items.length,
        metadata: apiData.metadata,
        syncedAt: Date.now(),
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
    isError: query.isError,
    error: query.error,
    refetch,
  };
}

// ============================================================================
// Infinite Query Hook (for load more patterns)
// ============================================================================

import { useInfiniteQuery } from '@tanstack/react-query';

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
    queryKey: ['entity-list-infinite', entityCode, params],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { ...params, limit, offset: pageParam },
      });
      const apiData = response.data;

      // Persist individual entities
      for (const item of apiData.data || []) {
        await db.entities.put({
          _id: createEntityKey(entityCode, item.id),
          entityCode,
          entityId: item.id,
          data: item,
          version: item.version || Date.now(),
          syncedAt: Date.now(),
          isDeleted: false,
        });
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
