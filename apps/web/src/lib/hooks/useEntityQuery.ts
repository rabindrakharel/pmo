/**
 * Entity Query Hooks - React Query + Zustand Integration
 *
 * Provides unified data fetching hooks that combine:
 * - React Query for server state management and caching
 * - Zustand stores for local state and optimistic updates
 * - TTL-based cache invalidation with different cache tiers
 *
 * Cache Tiers:
 * - Session-level (30 min): Entity types, global settings, datalabels, component metadata
 * - Short-lived (5 min): Entity instance data, entity lists
 *
 * Store Architecture:
 * - globalSettingsMetadataStore: Currency, date, timestamp formatting
 * - datalabelMetadataStore: Dropdown options (dl__* fields)
 * - entityComponentMetadataStore: Field metadata keyed by entityCode:componentName
 * - entityCodeMetadataStore: Entity types for sidebar navigation
 * - entityInstanceDataStore: Single entity data for optimistic updates
 * - entityInstanceListDataStore: List data for tables/grids
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { APIFactory, type EntityMetadata, type PaginatedResponse } from '../api';
import { useEntityEditStore } from '../../stores/useEntityEditStore';
import type { DatalabelData } from '../frontEndFormatterService';

// Import specialized Zustand stores
import { useGlobalSettingsMetadataStore } from '../../stores/globalSettingsMetadataStore';
import { useDatalabelMetadataStore } from '../../stores/datalabelMetadataStore';
import { useEntityComponentMetadataStore } from '../../stores/entityComponentMetadataStore';
import { useEntityCodeMetadataStore } from '../../stores/entityCodeMetadataStore';
import { useEntityInstanceDataStore } from '../../stores/entityInstanceDataStore';
import { useEntityInstanceListDataStore, generateQueryHash } from '../../stores/entityInstanceListDataStore';

// ============================================================================
// Cache Configuration
// ============================================================================

/** Cache time constants in milliseconds */
export const CACHE_TTL = {
  // Session-level caching (30 minutes) - rarely changes
  SESSION: 30 * 60 * 1000,           // 30 minutes - session-level data
  ENTITY_TYPES: 30 * 60 * 1000,      // 30 minutes - sidebar navigation
  DATALABELS: 30 * 60 * 1000,        // 30 minutes - dropdown options
  GLOBAL_SETTINGS: 30 * 60 * 1000,   // 30 minutes - app settings
  ENTITY_METADATA: 30 * 60 * 1000,   // 30 minutes - field definitions

  // Short-lived caching (5 minutes) - frequently changes
  ENTITY_LIST: 5 * 60 * 1000,        // 5 minutes - list data
  ENTITY_DETAIL: 5 * 60 * 1000,      // 5 minutes - detail data
} as const;

/** Query key factories for consistent cache keys */
export const queryKeys = {
  entityCodes: () => ['entity-codes'] as const,
  entityMetadata: (entityCode: string) => ['entity-metadata', entityCode] as const,
  datalabels: (entityCode: string) => ['datalabels', entityCode] as const,
  entityInstanceList: (entityCode: string, params?: Record<string, any>) =>
    ['entity-instance-list', entityCode, params] as const,
  entityInstance: (entityCode: string, id: string) =>
    ['entity-instance', entityCode, id] as const,
  globalSettings: () => ['global-settings'] as const,
};

// ============================================================================
// Types
// ============================================================================

export interface EntityInstanceListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  search?: string;
  view?: string;
  [key: string]: any;
}

export interface EntityInstanceListResult<T = any> {
  data: T[];
  metadata: EntityMetadata | null;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
// Note: datalabels and globalSettings are fetched via dedicated endpoints

export interface EntityInstanceResult<T = any> {
  data: T;
  metadata: EntityMetadata | null;
  fields?: string[];  // Field names list from backend
}
// Note: datalabels fetched via useDatalabels hook, globalSettings via useGlobalSettings hook

// ============================================================================
// useEntityInstanceList - Fetch entity list with caching
// ============================================================================

/**
 * Hook for fetching entity lists with React Query
 *
 * Features:
 * - Automatic caching with configurable TTL (5 min for lists)
 * - Pagination support
 * - Metadata and datalabels extraction
 * - Integration with specialized Zustand stores
 *
 * @example
 * const { data, isLoading, refetch } = useEntityInstanceList('project', { page: 1, pageSize: 100 });
 */
export function useEntityInstanceList<T = any>(
  entityCode: string,
  params: EntityInstanceListParams = {},
  options?: Omit<UseQueryOptions<EntityInstanceListResult<T>>, 'queryKey' | 'queryFn'>
) {
  // Specialized Zustand stores
  const componentMetadataStore = useEntityComponentMetadataStore();
  const listDataStore = useEntityInstanceListDataStore();
  const queryClient = useQueryClient();

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
    () => queryKeys.entityInstanceList(entityCode, normalizedParams),
    [entityCode, normalizedParams]
  );

  // Generate query hash for Zustand list store
  const queryHash = useMemo(() => generateQueryHash(normalizedParams), [normalizedParams]);

  const query = useQuery<EntityInstanceListResult<T>>({
    queryKey,
    queryFn: async () => {
      console.log(`%c[API FETCH] 📡 useEntityInstanceList: ${entityCode}`, 'color: #ff6b6b; font-weight: bold', {
        params: normalizedParams,
        queryKey,
      });

      const api = APIFactory.getAPI(entityCode);
      const response = await api.list(normalizedParams);

      // Note: datalabels and globalSettings are fetched via dedicated endpoints
      const result: EntityInstanceListResult<T> = {
        data: response.data || [],
        metadata: response.metadata || null,
        total: response.total || 0,
        page: normalizedParams.page,
        pageSize: normalizedParams.pageSize,
        hasMore: (response.data?.length || 0) === normalizedParams.pageSize,
      };

      console.log(`%c[API FETCH] ✅ Received ${result.data.length} items for ${entityCode}`, 'color: #ff6b6b', {
        total: result.total,
        hasMetadata: !!result.metadata,
      });

      // Cache list data in entityInstanceListDataStore (5 min TTL)
      listDataStore.setList(entityCode, queryHash, {
        data: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
      });

      // Cache component metadata in entityComponentMetadataStore (30 min TTL)
      if (result.metadata) {
        const componentName = normalizedParams.view || 'entityDataTable';
        componentMetadataStore.setComponentMetadata(entityCode, componentName, result.metadata);
      }

      return result;
    },
    staleTime: CACHE_TTL.ENTITY_LIST,
    gcTime: CACHE_TTL.ENTITY_LIST * 2,
    refetchOnWindowFocus: false,
    ...options,
  });

  // Log cache status only when data changes (not on every render)
  const prevDataRef = useRef<EntityInstanceListResult<T> | undefined>(undefined);
  useEffect(() => {
    if (query.data && query.data !== prevDataRef.current) {
      prevDataRef.current = query.data;
      const cacheState = queryClient.getQueryState(queryKey);
      const isFromCache = cacheState && cacheState.dataUpdateCount > 1 && !query.isRefetching;
      console.log(
        `%c[CACHE ${isFromCache ? 'HIT' : 'MISS'}] 💾 useEntityInstanceList: ${entityCode}`,
        `color: ${isFromCache ? '#51cf66' : '#fcc419'}; font-weight: bold`,
        {
          source: isFromCache ? 'React Query Cache' : 'Fresh API Response',
          itemCount: query.data.data.length,
          total: query.data.total,
          staleTime: `${CACHE_TTL.ENTITY_LIST / 1000}s`,
          dataUpdatedAt: cacheState?.dataUpdatedAt ? new Date(cacheState.dataUpdatedAt).toLocaleTimeString() : 'N/A',
        }
      );
    }
  }, [query.data, query.isRefetching, queryClient, queryKey, entityCode]);

  return query;
}

// ============================================================================
// useEntityInstance - Fetch single entity with caching
// ============================================================================

/**
 * Hook for fetching single entity details with React Query
 *
 * Features:
 * - Automatic caching with configurable TTL (5 min for details)
 * - Metadata and datalabels extraction
 * - Integration with specialized Zustand stores
 * - Optimistic update support via entityInstanceDataStore
 *
 * @example
 * const { data, isLoading, refetch } = useEntityInstance('project', 'uuid-123');
 */
export function useEntityInstance<T = any>(
  entityCode: string,
  id: string | undefined,
  options?: Omit<UseQueryOptions<EntityInstanceResult<T>>, 'queryKey' | 'queryFn'>
) {
  // Specialized Zustand stores
  const instanceDataStore = useEntityInstanceDataStore();
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => id ? queryKeys.entityInstance(entityCode, id) : ['entity-instance', entityCode, 'undefined'],
    [entityCode, id]
  );

  const query = useQuery<EntityInstanceResult<T>>({
    queryKey,
    queryFn: async () => {
      if (!id) {
        throw new Error('Entity ID is required');
      }

      console.log(`%c[API FETCH] 📡 useEntityInstance: ${entityCode}/${id}`, 'color: #ff6b6b; font-weight: bold', {
        queryKey,
      });

      const api = APIFactory.getAPI(entityCode);
      const response = await api.get(id, { view: 'entityFormContainer' });

      // Extract data, metadata, fields from response
      // Note: datalabels and globalSettings are fetched via dedicated endpoints
      let data = response.data || response;
      let metadata = null;
      let fields: string[] | undefined;

      // Check if response has backend metadata structure
      if (response && typeof response === 'object' && 'metadata' in response && 'data' in response) {
        metadata = response.metadata;
        data = response.data;

        if ('fields' in response && Array.isArray(response.fields)) {
          fields = response.fields;
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

      console.log(`%c[API FETCH] ✅ Received entity ${entityCode}/${id}`, 'color: #ff6b6b', {
        hasMetadata: !!metadata,
        hasFields: !!fields,
        dataKeys: Object.keys(data),
      });

      // Cache instance data in entityInstanceDataStore (5 min TTL)
      instanceDataStore.setInstance(entityCode, id, data);

      return { data, metadata, fields };
    },
    enabled: !!id,
    staleTime: CACHE_TTL.ENTITY_DETAIL,
    gcTime: CACHE_TTL.ENTITY_DETAIL * 2,
    refetchOnWindowFocus: false,
    ...options,
  });

  // Log cache status only when data changes (not on every render)
  const prevInstanceDataRef = useRef<EntityInstanceResult<T> | undefined>(undefined);
  useEffect(() => {
    if (query.data && id && query.data !== prevInstanceDataRef.current) {
      prevInstanceDataRef.current = query.data;
      const cacheState = queryClient.getQueryState(queryKey);
      const isFromCache = cacheState && cacheState.dataUpdateCount > 1 && !query.isRefetching;
      console.log(
        `%c[CACHE ${isFromCache ? 'HIT' : 'MISS'}] 💾 useEntityInstance: ${entityCode}/${id}`,
        `color: ${isFromCache ? '#51cf66' : '#fcc419'}; font-weight: bold`,
        {
          source: isFromCache ? 'React Query Cache' : 'Fresh API Response',
          staleTime: `${CACHE_TTL.ENTITY_DETAIL / 1000}s`,
          dataUpdatedAt: cacheState?.dataUpdatedAt ? new Date(cacheState.dataUpdatedAt).toLocaleTimeString() : 'N/A',
          hasMetadata: !!query.data.metadata,
          hasFields: !!query.data.fields,
        }
      );
    }
  }, [query.data, query.isRefetching, queryClient, queryKey, entityCode, id]);

  return query;
}

// ============================================================================
// useEntityCodes - Fetch entity codes for sidebar navigation
// ============================================================================

/**
 * Hook for fetching entity codes with session-level caching
 *
 * Features:
 * - 30-minute TTL for sidebar navigation stability
 * - Integration with entityCodeMetadataStore
 * - Automatic transformation to Map format
 *
 * @example
 * const { entityCodes, isLoading, refetch } = useEntityCodes();
 */
export function useEntityCodes(
  options?: Omit<UseQueryOptions<Map<string, import('../../stores/entityCodeMetadataStore').EntityCodeData>>, 'queryKey' | 'queryFn'>
) {
  // Specialized Zustand store
  const entityCodeStore = useEntityCodeMetadataStore();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.entityCodes();

  // Check if already cached in Zustand
  const cachedEntityCodes = entityCodeStore.getEntityCodesMap();

  const query = useQuery<Map<string, import('../../stores/entityCodeMetadataStore').EntityCodeData>>({
    queryKey,
    queryFn: async () => {
      console.log(`%c[API FETCH] 📡 useEntityCodes: fetching entity types`, 'color: #ff6b6b; font-weight: bold');

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
      const entityMap = new Map<string, import('../../stores/entityCodeMetadataStore').EntityCodeData>();
      entities.forEach((entity: import('../../stores/entityCodeMetadataStore').EntityCodeData) => {
        entityMap.set(entity.code, entity);
      });

      console.log(`%c[API FETCH] ✅ Received ${entityMap.size} entity types`, 'color: #ff6b6b', {
        codes: Array.from(entityMap.keys()),
      });

      // Cache in entityCodeMetadataStore (30 min TTL)
      entityCodeStore.setEntityCodes(Array.from(entityMap.values()));

      return entityMap;
    },
    initialData: cachedEntityCodes || undefined,
    staleTime: CACHE_TTL.ENTITY_TYPES,
    gcTime: CACHE_TTL.ENTITY_TYPES * 2,
    refetchOnWindowFocus: false,
    ...options,
  });

  // Log cache status only when data changes (not on every render)
  const prevEntityCodesRef = useRef<Map<string, import('../../stores/entityCodeMetadataStore').EntityCodeData> | undefined>(undefined);
  useEffect(() => {
    if (query.data && query.data !== prevEntityCodesRef.current) {
      prevEntityCodesRef.current = query.data;
      const cacheState = queryClient.getQueryState(queryKey);
      const isFromCache = cacheState && cacheState.dataUpdateCount > 1 && !query.isRefetching;
      console.log(
        `%c[CACHE ${isFromCache ? 'HIT' : 'MISS'}] 💾 useEntityCodes`,
        `color: ${isFromCache ? '#51cf66' : '#fcc419'}; font-weight: bold`,
        {
          source: isFromCache ? 'React Query Cache' : 'Fresh API Response',
          entityCount: query.data.size,
          staleTime: `${CACHE_TTL.ENTITY_TYPES / 1000}s`,
          dataUpdatedAt: cacheState?.dataUpdatedAt ? new Date(cacheState.dataUpdatedAt).toLocaleTimeString() : 'N/A',
        }
      );
    }
  }, [query.data, query.isRefetching, queryClient, queryKey]);

  return query;
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

  // Zustand stores for comprehensive invalidation
  const componentMetadataStore = useEntityComponentMetadataStore();
  const instanceDataStore = useEntityInstanceDataStore();
  const listDataStore = useEntityInstanceListDataStore();

  // Helper to invalidate all caches for this entity (React Query + Zustand)
  const invalidateAllCaches = (id?: string) => {
    // React Query invalidation
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });
      instanceDataStore.invalidate(entityCode, id);
    }
    queryClient.invalidateQueries({ queryKey: ['entity-instance-list', entityCode] });

    // Zustand store invalidation - ensures no stale data
    componentMetadataStore.invalidateEntity(entityCode);
    listDataStore.invalidate(entityCode);
    instanceDataStore.invalidateEntity(entityCode);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const api = APIFactory.getAPI(entityCode);
      return api.update(id, data);
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKeys.entityInstance(entityCode, id));

      // Optimistically update cache
      queryClient.setQueryData(
        queryKeys.entityInstance(entityCode, id),
        (old: EntityInstanceResult | undefined) => old ? {
          ...old,
          data: { ...old.data, ...data },
        } : old
      );

      return { previousData };
    },
    onError: (_error, { id }, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.entityInstance(entityCode, id), context.previousData);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Invalidate ALL caches (React Query + Zustand) to refetch fresh data
      invalidateAllCaches(id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const api = APIFactory.getAPI(entityCode);
      return api.delete(id);
    },
    onSettled: (_data, _error, id) => {
      // Invalidate ALL caches after delete
      invalidateAllCaches(id);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const api = APIFactory.getAPI(entityCode);
      return api.create(data);
    },
    onSettled: () => {
      // Invalidate ALL caches after create
      invalidateAllCaches();
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
 * Hook for fetching datalabel options with session-level caching
 *
 * Features:
 * - 30-minute TTL for dropdown stability
 * - Automatic deduplication
 * - Integration with datalabelMetadataStore
 *
 * @example
 * const { options, isLoading } = useDatalabels('dl__project_stage');
 */
export function useDatalabels(
  fieldKey: string,
  options?: Omit<UseQueryOptions<DatalabelData['options']>, 'queryKey' | 'queryFn'>
) {
  // Specialized Zustand store
  const datalabelStore = useDatalabelMetadataStore();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.datalabels(fieldKey);

  // Check if already cached in Zustand
  const cachedOptions = datalabelStore.getDatalabel(fieldKey);
  if (cachedOptions) {
    console.log(`%c[ZUSTAND CACHE HIT] 🗄️ useDatalabels: ${fieldKey}`, 'color: #be4bdb; font-weight: bold', {
      source: 'datalabelMetadataStore',
      optionCount: cachedOptions.length,
    });
  }

  const query = useQuery<DatalabelData['options']>({
    queryKey,
    queryFn: async () => {
      console.log(`%c[API FETCH] 📡 useDatalabels: ${fieldKey}`, 'color: #ff6b6b; font-weight: bold');

      const token = localStorage.getItem('auth_token');
      if (!token) {
        return [];
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/v1/datalabel?name=${fieldKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch datalabel: ${fieldKey}`);
      }

      const data = await response.json();
      const opts = data.data || data || [];

      console.log(`%c[API FETCH] ✅ Received datalabel ${fieldKey}`, 'color: #ff6b6b', {
        optionCount: opts.length,
        options: opts,
      });

      // Cache in datalabelMetadataStore (30 min TTL)
      datalabelStore.setDatalabel(fieldKey, opts);

      return opts;
    },
    initialData: cachedOptions || undefined,
    staleTime: CACHE_TTL.DATALABELS,
    gcTime: CACHE_TTL.DATALABELS * 2,
    refetchOnWindowFocus: false,
    enabled: !!fieldKey && fieldKey.startsWith('dl__'),
    ...options,
  });

  // Log React Query cache status only when data changes (not on every render)
  const prevDatalabelsRef = useRef<DatalabelData['options'] | undefined>(undefined);
  useEffect(() => {
    if (query.data && fieldKey && query.data !== prevDatalabelsRef.current) {
      prevDatalabelsRef.current = query.data;
      const cacheState = queryClient.getQueryState(queryKey);
      const isFromCache = cacheState && cacheState.dataUpdateCount > 1 && !query.isRefetching;
      console.log(
        `%c[CACHE ${isFromCache ? 'HIT' : 'MISS'}] 💾 useDatalabels: ${fieldKey}`,
        `color: ${isFromCache ? '#51cf66' : '#fcc419'}; font-weight: bold`,
        {
          source: isFromCache ? 'React Query Cache' : 'Fresh API Response',
          optionCount: query.data.length,
          staleTime: `${CACHE_TTL.DATALABELS / 1000}s`,
        }
      );
    }
  }, [query.data, query.isRefetching, queryClient, queryKey, fieldKey]);

  return query;
}

// ============================================================================
// useDatalabelMutation - Mutate datalabel with proper cache invalidation
// ============================================================================

/**
 * Hook for datalabel mutations with automatic cache invalidation
 *
 * Ensures both React Query and Zustand caches are invalidated on mutation.
 * This prevents stale datalabel data (like outdated dropdown options).
 *
 * @example
 * const { addItem, updateItem, deleteItem, reorderItems } = useDatalabelMutation('dl__project_stage');
 */
export function useDatalabelMutation(datalabelName: string) {
  const queryClient = useQueryClient();
  const datalabelStore = useDatalabelMetadataStore();

  // Helper to invalidate all datalabel caches
  const invalidateDatalabelCache = () => {
    // Invalidate React Query cache for this specific datalabel
    queryClient.invalidateQueries({ queryKey: queryKeys.datalabels(datalabelName) });
    // Invalidate all datalabels query (used by some components)
    queryClient.invalidateQueries({ queryKey: ['settings', 'datalabels', 'all'] });
    // Invalidate Zustand store
    datalabelStore.invalidate(datalabelName);

    console.log(`%c[DatalabelMutation] Cache invalidated: ${datalabelName}`, 'color: #ff6b6b');
  };

  const addItemMutation = useMutation({
    mutationFn: async (item: { name: string; descr?: string; color_code?: string; parent_id?: number }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/datalabel/${datalabelName}/item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error('Failed to add item');
      return response.json();
    },
    onSettled: invalidateDatalabelCache,
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; descr?: string; color_code?: string; parent_id?: number } }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/datalabel/${datalabelName}/item/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update item');
      return response.json();
    },
    onSettled: invalidateDatalabelCache,
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/datalabel/${datalabelName}/item/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete item');
      return response.json();
    },
    onSettled: invalidateDatalabelCache,
  });

  const reorderItemsMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/datalabel/${datalabelName}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ item_ids: orderedIds }),
      });
      if (!response.ok) throw new Error('Failed to reorder items');
      return response.json();
    },
    onSettled: invalidateDatalabelCache,
  });

  return {
    addItem: addItemMutation.mutateAsync,
    updateItem: updateItemMutation.mutateAsync,
    deleteItem: deleteItemMutation.mutateAsync,
    reorderItems: reorderItemsMutation.mutateAsync,
    isAdding: addItemMutation.isPending,
    isUpdating: updateItemMutation.isPending,
    isDeleting: deleteItemMutation.isPending,
    isReordering: reorderItemsMutation.isPending,
    invalidateCache: invalidateDatalabelCache,
  };
}

// ============================================================================
// useEntityLookup - Fetch entity options for reference dropdowns
// ============================================================================

/**
 * Hook for fetching entity lookup options with proper caching
 *
 * Used by EntitySelect and other reference dropdowns.
 * Uses React Query for fetching with 5-min TTL.
 *
 * @example
 * const { options, isLoading } = useEntityLookup('employee');
 */
export function useEntityLookup(entityCode: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['entity-lookup', entityCode],
    queryFn: async () => {
      console.log(`%c[API FETCH] 🔄 Fetching entity-instance-lookup: ${entityCode}`, 'color: #ff6b6b');

      const response = await fetch(
        `${API_BASE_URL}/api/v1/entity/${entityCode}/entity-instance-lookup?active_only=true&limit=500`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch entity lookup: ${entityCode}`);
      }

      const data = await response.json();
      const options = data.data || data || [];

      console.log(`%c[API FETCH] ✅ Received entity-instance-lookup ${entityCode}`, 'color: #51cf66', {
        optionCount: options.length,
      });

      return options;
    },
    staleTime: CACHE_TTL.ENTITY_DETAIL,  // 5 minutes
    gcTime: CACHE_TTL.ENTITY_DETAIL * 2,
    refetchOnWindowFocus: false,
    enabled: !!entityCode,
  });

  return {
    options: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// useEntityMetadata - Get cached entity metadata for specific component
// ============================================================================

/**
 * Hook for accessing cached entity metadata for a specific component
 *
 * Features:
 * - Session-level TTL (30 minutes)
 * - Component-specific metadata (entityDataTable, entityFormContainer, etc.)
 * - Populated by useEntityInstanceList/useEntityInstance hooks
 *
 * @example
 * const metadata = useEntityMetadata('project', 'entityDataTable');
 */
export function useEntityMetadata(entityCode: string, componentName?: string) {
  // Specialized Zustand store
  const componentMetadataStore = useEntityComponentMetadataStore();

  // If component name specified, get specific component metadata
  if (componentName) {
    const metadata = componentMetadataStore.getComponentMetadata(entityCode, componentName);
    if (metadata) {
      console.log(`%c[CACHE HIT] 💾 useEntityMetadata: ${entityCode}:${componentName}`, 'color: #51cf66; font-weight: bold');
    }
    return metadata;
  }

  // Otherwise, get all component metadata for the entity
  const allMetadata = componentMetadataStore.getAllComponentMetadata(entityCode);
  if (allMetadata) {
    console.log(`%c[CACHE HIT] 💾 useEntityMetadata: ${entityCode} (all components)`, 'color: #51cf66; font-weight: bold', {
      components: Object.keys(allMetadata),
    });
  }
  return allMetadata;
}

// ============================================================================
// useGlobalSettings - Fetch global formatting settings
// ============================================================================

/**
 * Hook for fetching global settings (currency, date, timestamp, boolean formatting)
 *
 * Features:
 * - Session-level TTL (30 minutes)
 * - Shared across all components
 * - Integration with globalSettingsMetadataStore
 *
 * @example
 * const { data: globalSettings, isLoading } = useGlobalSettings();
 */
export function useGlobalSettings() {
  // Specialized Zustand store
  const globalSettingsStore = useGlobalSettingsMetadataStore();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.globalSettings();

  // Check if already cached in Zustand
  const cachedSettings = globalSettingsStore.getGlobalSettings();

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      console.log('%c[API FETCH] 📡 useGlobalSettings: fetching global settings', 'color: #ff6b6b; font-weight: bold');

      const token = localStorage.getItem('auth_token');
      if (!token) {
        return null;
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/v1/settings/global`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch global settings');
      }

      const data = await response.json();

      console.log('%c[API FETCH] ✅ Received global settings', 'color: #ff6b6b', data);

      // Cache in globalSettingsMetadataStore (30 min TTL)
      globalSettingsStore.setGlobalSettings(data);

      return data;
    },
    initialData: cachedSettings || undefined,
    staleTime: CACHE_TTL.GLOBAL_SETTINGS,
    gcTime: CACHE_TTL.GLOBAL_SETTINGS * 2,
    refetchOnWindowFocus: false,
  });

  // Log cache status only when data changes (not on every render)
  const prevGlobalSettingsRef = useRef<any>(undefined);
  useEffect(() => {
    if (query.data && query.data !== prevGlobalSettingsRef.current) {
      prevGlobalSettingsRef.current = query.data;
      const cacheState = queryClient.getQueryState(queryKey);
      const isFromCache = cacheState && cacheState.dataUpdateCount > 1 && !query.isRefetching;
      console.log(
        `%c[CACHE ${isFromCache ? 'HIT' : 'MISS'}] 💾 useGlobalSettings`,
        `color: ${isFromCache ? '#51cf66' : '#fcc419'}; font-weight: bold`,
        {
          source: isFromCache ? 'React Query Cache' : 'Fresh API Response',
          staleTime: `${CACHE_TTL.GLOBAL_SETTINGS / 1000}s`,
        }
      );
    }
  }, [query.data, query.isRefetching, queryClient, queryKey]);

  return query;
}

// ============================================================================
// useAllDatalabels - Fetch all datalabels at session start
// ============================================================================

/**
 * Hook for prefetching all datalabels at session start
 *
 * Features:
 * - Session-level TTL (30 minutes)
 * - Populates datalabelMetadataStore for all dropdowns
 * - Should be called once at app initialization
 *
 * @example
 * const { data: datalabels, isLoading } = useAllDatalabels();
 */
export function useAllDatalabels() {
  // Specialized Zustand store
  const datalabelStore = useDatalabelMetadataStore();
  const queryClient = useQueryClient();
  const queryKey = ['settings', 'datalabels', 'all'];

  // Check if already cached in Zustand
  const cachedDatalabels = datalabelStore.getAllDatalabels();

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      console.log('%c[API FETCH] 📡 useAllDatalabels: fetching all datalabels', 'color: #ff6b6b; font-weight: bold');

      const token = localStorage.getItem('auth_token');
      if (!token) {
        return { data: [], total: 0 };
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/v1/settings/datalabels/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch all datalabels');
      }

      const result = await response.json();

      console.log(`%c[API FETCH] ✅ Received ${result.total} datalabels`, 'color: #ff6b6b', {
        datalabelNames: result.data.map((d: any) => d.name),
      });

      // Cache all datalabels in datalabelMetadataStore (30 min TTL)
      datalabelStore.setAllDatalabels(result.data);

      return result;
    },
    initialData: cachedDatalabels ? { data: Object.entries(cachedDatalabels).map(([name, options]) => ({ name, options })), total: Object.keys(cachedDatalabels).length } : undefined,
    staleTime: CACHE_TTL.DATALABELS,
    gcTime: CACHE_TTL.DATALABELS * 2,
    refetchOnWindowFocus: false,
  });

  // Log cache status only when data changes (not on every render)
  const prevAllDatalabelsRef = useRef<any>(undefined);
  useEffect(() => {
    if (query.data && query.data !== prevAllDatalabelsRef.current) {
      prevAllDatalabelsRef.current = query.data;
      const cacheState = queryClient.getQueryState(queryKey);
      const isFromCache = cacheState && cacheState.dataUpdateCount > 1 && !query.isRefetching;
      console.log(
        `%c[CACHE ${isFromCache ? 'HIT' : 'MISS'}] 💾 useAllDatalabels`,
        `color: ${isFromCache ? '#51cf66' : '#fcc419'}; font-weight: bold`,
        {
          source: isFromCache ? 'React Query Cache' : 'Fresh API Response',
          total: query.data.total,
          staleTime: `${CACHE_TTL.DATALABELS / 1000}s`,
        }
      );
    }
  }, [query.data, query.isRefetching, queryClient, queryKey]);

  return query;
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to invalidate entity caches across all Zustand stores
 *
 * @example
 * const { invalidateEntity, invalidateAll } = useCacheInvalidation();
 * invalidateEntity('project', 'uuid-123');
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();

  // All specialized Zustand stores
  const globalSettingsStore = useGlobalSettingsMetadataStore();
  const datalabelStore = useDatalabelMetadataStore();
  const componentMetadataStore = useEntityComponentMetadataStore();
  const entityCodeStore = useEntityCodeMetadataStore();
  const instanceDataStore = useEntityInstanceDataStore();
  const listDataStore = useEntityInstanceListDataStore();

  const invalidateEntity = useCallback((entityCode: string, id?: string) => {
    // Invalidate React Query cache
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });
      // Invalidate specific instance in Zustand
      instanceDataStore.invalidate(entityCode, id);
    }
    queryClient.invalidateQueries({ queryKey: ['entity-instance-list', entityCode] });

    // Invalidate Zustand stores for this entity
    componentMetadataStore.invalidateEntity(entityCode);
    listDataStore.invalidate(entityCode);
    instanceDataStore.invalidateEntity(entityCode);
  }, [queryClient, componentMetadataStore, listDataStore, instanceDataStore]);

  const invalidateAll = useCallback(() => {
    // Invalidate all React Query cache
    queryClient.invalidateQueries();

    // Clear all Zustand stores
    globalSettingsStore.clear();
    datalabelStore.clear();
    componentMetadataStore.clear();
    entityCodeStore.clear();
    instanceDataStore.clear();
    listDataStore.clear();
  }, [queryClient, globalSettingsStore, datalabelStore, componentMetadataStore, entityCodeStore, instanceDataStore, listDataStore]);

  const invalidateEntityCodes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.entityCodes() });
    entityCodeStore.clear();
  }, [queryClient, entityCodeStore]);

  const invalidateGlobalSettings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.globalSettings() });
    globalSettingsStore.clear();
  }, [queryClient, globalSettingsStore]);

  const invalidateDatalabels = useCallback((name?: string) => {
    if (name) {
      queryClient.invalidateQueries({ queryKey: queryKeys.datalabels(name) });
      datalabelStore.invalidate(name);
    } else {
      queryClient.invalidateQueries({ queryKey: ['settings', 'datalabels'] });
      datalabelStore.clear();
    }
  }, [queryClient, datalabelStore]);

  return {
    invalidateEntity,
    invalidateAll,
    invalidateEntityCodes,
    invalidateGlobalSettings,
    invalidateDatalabels,
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
      queryKey: queryKeys.entityInstance(entityCode, id),
      queryFn: async () => {
        const api = APIFactory.getAPI(entityCode);
        const response = await api.get(id, { view: 'entityFormContainer' });
        return {
          data: response.data || response,
          metadata: response.metadata || null,
          datalabels: response.datalabels || [],
        };
      },
      staleTime: CACHE_TTL.ENTITY_DETAIL,
    });
  }, [queryClient]);

  const prefetchList = useCallback(async (entityCode: string, params?: EntityInstanceListParams) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.entityInstanceList(entityCode, params),
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
