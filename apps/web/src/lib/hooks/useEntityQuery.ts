/**
 * Entity Query Hooks - React Query + Zustand Integration
 *
 * Provides unified data fetching hooks that combine:
 * - React Query for server state management and caching
 * - Zustand stores for local state and optimistic updates
 * - TTL-based cache invalidation with different cache tiers
 *
 * Cache Tiers (aligned with metadataCacheStore):
 * - Entity Types: 10 min TTL (sidebar navigation)
 * - Datalabels: 10 min TTL (dropdown options)
 * - Entity Metadata: 5 min TTL (field definitions)
 * - Entity Lists: URL-bound (refetch on filter change)
 * - Entity Details: URL-bound (refetch on navigation)
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { APIFactory, type EntityMetadata, type PaginatedResponse } from '../api';
import { useMetadataCacheStore } from '../../stores/metadataCacheStore';
import { useEntityEditStore } from '../../stores/useEntityEditStore';
import type { DatalabelData } from '../frontEndFormatterService';

// ============================================================================
// Cache Configuration
// ============================================================================

/** Cache time constants in milliseconds */
export const CACHE_TTL = {
  ENTITY_TYPES: 10 * 60 * 1000,      // 10 minutes - sidebar navigation
  DATALABELS: 10 * 60 * 1000,        // 10 minutes - dropdown options
  GLOBAL_SETTINGS: 10 * 60 * 1000,   // 10 minutes - app settings
  ENTITY_METADATA: 5 * 60 * 1000,    // 5 minutes - field definitions
  ENTITY_LIST: 2 * 60 * 1000,        // 2 minutes - list data (shorter for freshness)
  ENTITY_DETAIL: 5 * 60 * 1000,      // 5 minutes - detail data
} as const;

/** Query key factories for consistent cache keys */
export const queryKeys = {
  entityTypes: () => ['entity-types'] as const,
  entityMetadata: (entityCode: string) => ['entity-metadata', entityCode] as const,
  datalabels: (entityCode: string) => ['datalabels', entityCode] as const,
  entityList: (entityCode: string, params?: Record<string, any>) =>
    ['entity-list', entityCode, params] as const,
  entityDetail: (entityCode: string, id: string) =>
    ['entity-detail', entityCode, id] as const,
  globalSettings: () => ['global-settings'] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface EntityListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  search?: string;
  view?: string;
  [key: string]: any;
}

export interface EntityListResult<T = any> {
  data: T[];
  metadata: EntityMetadata | null;
  datalabels: DatalabelData[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface EntityDetailResult<T = any> {
  data: T;
  metadata: EntityMetadata | null;
  datalabels: DatalabelData[];
}

// ============================================================================
// useEntityList - Fetch entity list with caching
// ============================================================================

/**
 * Hook for fetching entity lists with React Query
 *
 * Features:
 * - Automatic caching with configurable TTL
 * - Pagination support
 * - Metadata and datalabels extraction
 * - Integration with Zustand metadata cache
 *
 * @example
 * const { data, isLoading, refetch } = useEntityList('project', { page: 1, pageSize: 100 });
 */
export function useEntityList<T = any>(
  entityCode: string,
  params: EntityListParams = {},
  options?: Omit<UseQueryOptions<EntityListResult<T>>, 'queryKey' | 'queryFn'>
) {
  const metadataCache = useMetadataCacheStore();

  // Map view mode to component name for backend metadata filtering
  const viewComponentMap: Record<string, string> = {
    table: 'entityDataTable',
    kanban: 'kanbanView',
    grid: 'gridView',
    calendar: 'calendarView',
    dag: 'dagView',
    hierarchy: 'hierarchyGraphView',
  };

  const normalizedParams = useMemo(() => ({
    page: params.page || 1,
    pageSize: params.pageSize || 100,
    view: params.view ? viewComponentMap[params.view] || params.view : 'entityDataTable',
    ...params,
  }), [params]);

  const queryKey = useMemo(
    () => queryKeys.entityList(entityCode, normalizedParams),
    [entityCode, normalizedParams]
  );

  return useQuery<EntityListResult<T>>({
    queryKey,
    queryFn: async () => {
      const api = APIFactory.getAPI(entityCode);
      const response = await api.list(normalizedParams);

      const result: EntityListResult<T> = {
        data: response.data || [],
        metadata: response.metadata || null,
        datalabels: response.datalabels || [],
        total: response.total || 0,
        page: normalizedParams.page,
        pageSize: normalizedParams.pageSize,
        hasMore: (response.data?.length || 0) === normalizedParams.pageSize,
      };

      // Cache metadata in Zustand store for reuse
      if (result.metadata) {
        metadataCache.setEntityMetadata(entityCode, result.metadata);
      }

      // Cache datalabels in Zustand store
      if (result.datalabels?.length > 0) {
        result.datalabels.forEach(dl => {
          metadataCache.setDatalabels(dl.name, dl.options);
        });
      }

      return result;
    },
    staleTime: CACHE_TTL.ENTITY_LIST,
    gcTime: CACHE_TTL.ENTITY_LIST * 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}

// ============================================================================
// useEntityDetail - Fetch single entity with caching
// ============================================================================

/**
 * Hook for fetching single entity details with React Query
 *
 * Features:
 * - Automatic caching with configurable TTL
 * - Metadata and datalabels extraction
 * - Integration with Zustand edit store
 * - Optimistic update support
 *
 * @example
 * const { data, isLoading, refetch } = useEntityDetail('project', 'uuid-123');
 */
export function useEntityDetail<T = any>(
  entityCode: string,
  id: string | undefined,
  options?: Omit<UseQueryOptions<EntityDetailResult<T>>, 'queryKey' | 'queryFn'>
) {
  const metadataCache = useMetadataCacheStore();

  const queryKey = useMemo(
    () => id ? queryKeys.entityDetail(entityCode, id) : ['entity-detail', entityCode, 'undefined'],
    [entityCode, id]
  );

  return useQuery<EntityDetailResult<T>>({
    queryKey,
    queryFn: async () => {
      if (!id) {
        throw new Error('Entity ID is required');
      }

      const api = APIFactory.getAPI(entityCode);
      const response = await api.get(id, { view: 'entityDetailView,entityFormContainer' });

      // Extract data and metadata from response
      let data = response.data || response;
      let metadata = null;
      let datalabels: DatalabelData[] = [];

      // Check if response has backend metadata structure
      if (response && typeof response === 'object' && 'metadata' in response && 'data' in response) {
        metadata = response.metadata;
        data = response.data;

        if ('datalabels' in response && Array.isArray(response.datalabels)) {
          datalabels = response.datalabels;
        }
      }

      // Parse metadata if it's a string
      if (data.metadata && typeof data.metadata === 'string') {
        try {
          data.metadata = JSON.parse(data.metadata);
        } catch {
          data.metadata = {};
        }
      }

      // Cache metadata in Zustand store
      if (metadata) {
        metadataCache.setEntityMetadata(entityCode, metadata);
      }

      // Cache datalabels in Zustand store
      if (datalabels.length > 0) {
        datalabels.forEach(dl => {
          metadataCache.setDatalabels(dl.name, dl.options);
        });
      }

      return { data, metadata, datalabels };
    },
    enabled: !!id,
    staleTime: CACHE_TTL.ENTITY_DETAIL,
    gcTime: CACHE_TTL.ENTITY_DETAIL * 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}

// ============================================================================
// useEntityTypes - Fetch entity types for sidebar navigation
// ============================================================================

interface EntityType {
  code: string;
  label: string;
  label_plural: string;
  icon: string;
  active_flag: boolean;
  child_entity_codes: string[];
  metadata: Record<string, any>;
}

/**
 * Hook for fetching entity types with long-term caching
 *
 * Features:
 * - 10-minute TTL for sidebar navigation stability
 * - Integration with EntityMetadataContext
 * - Automatic transformation to Map format
 *
 * @example
 * const { entityTypes, isLoading, refetch } = useEntityTypes();
 */
export function useEntityTypes(
  options?: Omit<UseQueryOptions<Map<string, EntityType>>, 'queryKey' | 'queryFn'>
) {
  const metadataCache = useMetadataCacheStore();

  return useQuery<Map<string, EntityType>>({
    queryKey: queryKeys.entityTypes(),
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return new Map();
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/v1/entity/types`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch entity types');
      }

      const data = await response.json();
      const entities = Array.isArray(data) ? data : data.data || [];

      // Transform to Map
      const entityMap = new Map<string, EntityType>();
      entities.forEach((entity: EntityType) => {
        entityMap.set(entity.code, entity);
      });

      // Cache in Zustand store
      metadataCache.setEntityTypes(Array.from(entityMap.values()));

      return entityMap;
    },
    staleTime: CACHE_TTL.ENTITY_TYPES,
    gcTime: CACHE_TTL.ENTITY_TYPES * 2,
    refetchOnWindowFocus: false,
    ...options,
  });
}

// ============================================================================
// useEntityMutation - Unified mutation hook for CRUD operations
// ============================================================================

/**
 * Hook for entity mutations with optimistic updates
 *
 * Features:
 * - Automatic cache invalidation
 * - Optimistic updates via Zustand edit store
 * - Error rollback
 *
 * @example
 * const { updateEntity, deleteEntity, isUpdating } = useEntityMutation('project');
 */
export function useEntityMutation(entityCode: string) {
  const queryClient = useQueryClient();
  const editStore = useEntityEditStore();

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const api = APIFactory.getAPI(entityCode);
      return api.update(id, data);
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.entityDetail(entityCode, id) });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKeys.entityDetail(entityCode, id));

      // Optimistically update cache
      queryClient.setQueryData(
        queryKeys.entityDetail(entityCode, id),
        (old: EntityDetailResult | undefined) => old ? {
          ...old,
          data: { ...old.data, ...data },
        } : old
      );

      return { previousData };
    },
    onError: (_error, { id }, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.entityDetail(entityCode, id), context.previousData);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.entityDetail(entityCode, id) });
      queryClient.invalidateQueries({ queryKey: ['entity-list', entityCode] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const api = APIFactory.getAPI(entityCode);
      return api.delete(id);
    },
    onSettled: () => {
      // Invalidate list queries after delete
      queryClient.invalidateQueries({ queryKey: ['entity-list', entityCode] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const api = APIFactory.getAPI(entityCode);
      return api.create(data);
    },
    onSettled: () => {
      // Invalidate list queries after create
      queryClient.invalidateQueries({ queryKey: ['entity-list', entityCode] });
    },
  });

  return {
    updateEntity: updateMutation.mutateAsync,
    deleteEntity: deleteMutation.mutateAsync,
    createEntity: createMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCreating: createMutation.isPending,
    updateError: updateMutation.error,
    deleteError: deleteMutation.error,
    createError: createMutation.error,
  };
}

// ============================================================================
// useDatalabels - Fetch datalabel options for a field
// ============================================================================

/**
 * Hook for fetching datalabel options with caching
 *
 * Features:
 * - 10-minute TTL for dropdown stability
 * - Automatic deduplication
 * - Integration with Zustand cache
 *
 * @example
 * const { options, isLoading } = useDatalabels('dl__project_stage');
 */
export function useDatalabels(
  fieldKey: string,
  options?: Omit<UseQueryOptions<DatalabelData['options']>, 'queryKey' | 'queryFn'>
) {
  const metadataCache = useMetadataCacheStore();

  // Check if already cached
  const cachedOptions = metadataCache.getDatalabels(fieldKey);

  return useQuery<DatalabelData['options']>({
    queryKey: queryKeys.datalabels(fieldKey),
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return [];
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/v1/setting?datalabel=${fieldKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch datalabel: ${fieldKey}`);
      }

      const data = await response.json();
      const opts = data.data || data || [];

      // Cache in Zustand store
      metadataCache.setDatalabels(fieldKey, opts);

      return opts;
    },
    initialData: cachedOptions || undefined,
    staleTime: CACHE_TTL.DATALABELS,
    gcTime: CACHE_TTL.DATALABELS * 2,
    refetchOnWindowFocus: false,
    enabled: !!fieldKey && fieldKey.startsWith('dl__'),
    ...options,
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to invalidate entity caches
 *
 * @example
 * const { invalidateEntity, invalidateAll } = useCacheInvalidation();
 * invalidateEntity('project', 'uuid-123');
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();
  const metadataCache = useMetadataCacheStore();

  const invalidateEntity = useCallback((entityCode: string, id?: string) => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityDetail(entityCode, id) });
    }
    queryClient.invalidateQueries({ queryKey: ['entity-list', entityCode] });
    metadataCache.invalidateEntity(entityCode);
  }, [queryClient, metadataCache]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
    metadataCache.clearCache();
  }, [queryClient, metadataCache]);

  const invalidateEntityTypes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.entityTypes() });
  }, [queryClient]);

  return {
    invalidateEntity,
    invalidateAll,
    invalidateEntityTypes,
  };
}

/**
 * Hook to prefetch entity data
 *
 * @example
 * const { prefetchEntity, prefetchList } = usePrefetch();
 * prefetchEntity('project', 'uuid-123');
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchEntity = useCallback(async (entityCode: string, id: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.entityDetail(entityCode, id),
      queryFn: async () => {
        const api = APIFactory.getAPI(entityCode);
        const response = await api.get(id, { view: 'entityDetailView,entityFormContainer' });
        return {
          data: response.data || response,
          metadata: response.metadata || null,
          datalabels: response.datalabels || [],
        };
      },
      staleTime: CACHE_TTL.ENTITY_DETAIL,
    });
  }, [queryClient]);

  const prefetchList = useCallback(async (entityCode: string, params?: EntityListParams) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.entityList(entityCode, params),
      queryFn: async () => {
        const api = APIFactory.getAPI(entityCode);
        const response = await api.list(params);
        return {
          data: response.data || [],
          metadata: response.metadata || null,
          datalabels: response.datalabels || [],
          total: response.total || 0,
          page: params?.page || 1,
          pageSize: params?.pageSize || 100,
          hasMore: (response.data?.length || 0) === (params?.pageSize || 100),
        };
      },
      staleTime: CACHE_TTL.ENTITY_LIST,
    });
  }, [queryClient]);

  return { prefetchEntity, prefetchList };
}
