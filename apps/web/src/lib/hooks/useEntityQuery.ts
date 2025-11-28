/**
 * Entity Query Hooks - TanStack Query + Dexie Offline-First Architecture
 *
 * ARCHITECTURE (v9.0.0 - TanStack Query + Dexie):
 * - TanStack Query: Server state management with automatic caching
 * - Dexie: IndexedDB persistence for offline-first
 * - WebSocket: Real-time cache invalidation via PubSub service
 * - Formatting: Happens on READ via memoization
 *
 * Benefits:
 * - Offline-first: Works without network connection
 * - Persistent: Survives browser restart via Dexie
 * - Multi-tab sync: TanStack Query handles tab focus
 * - Draft persistence: Unsaved edits survive refresh
 * - Reactive: UI auto-updates via TanStack Query
 * - Unified: Single cache system with TanStack Query + Dexie
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { APIFactory, type EntityMetadata, type PaginatedResponse } from '../api';
import type { DatalabelData } from '../frontEndFormatterService';

// Import format-at-read utilities
import { formatDataset, formatRow, type FormattedRow, type ComponentMetadata } from '../formatters';
// Centralized pagination config
import { getEntityLimit, PAGINATION_CONFIG } from '../pagination.config';

// v8.3.2: Unified ref_data_entityInstance cache for dropdown + view resolution
import { upsertRefDataEntityInstanceCache } from './useRefDataEntityInstanceCache';

// v9.0.0: TanStack Query + Dexie hooks - SINGLE SOURCE OF TRUTH
import {
  useEntity,
  useEntityList,
  useEntityMutation as useTanstackEntityMutation,
  useDatalabel,
  useAllDatalabels as useTanstackAllDatalabels,
  useEntityCodes as useTanstackEntityCodes,
  useGlobalSettings as useTanstackGlobalSettings,
  invalidateMetadataCache,
  clearAllMetadataCache,
  type DatalabelOption,
  type EntityCodeData,
  type GlobalSettings,
} from '../../db/tanstack-hooks';

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache TTL Configuration - Industry Standard (v6.0.0)
 *
 * Based on data volatility and user expectations:
 * - Reference data: Users tolerate 1-hour staleness
 * - Metadata: Schema changes are deployment-time (15 min)
 * - Entity data: Stale-while-revalidate for near real-time
 */
export const CACHE_TTL = {
  // =========================================================================
  // TIER 2: Reference Data (1 hour) - Rarely changes
  // =========================================================================
  ENTITY_TYPES: 60 * 60 * 1000,      // 1 hour - sidebar navigation
  DATALABELS: 60 * 60 * 1000,        // 1 hour - dropdown options
  GLOBAL_SETTINGS: 60 * 60 * 1000,   // 1 hour - app settings

  // =========================================================================
  // TIER 3: Metadata (15 minutes) - May change with deployments
  // =========================================================================
  ENTITY_METADATA: 15 * 60 * 1000,   // 15 minutes - field definitions

  // =========================================================================
  // TIER 4: Entity Lists - Stale-While-Revalidate
  // =========================================================================
  // Show cached data immediately, refetch in background
  ENTITY_LIST_STALE: 30 * 1000,      // 30 seconds - mark as stale
  ENTITY_LIST_CACHE: 5 * 60 * 1000,  // 5 minutes - keep for back navigation

  // =========================================================================
  // TIER 5: Entity Details - Near Real-time
  // =========================================================================
  // Short stale time for actively edited records
  ENTITY_DETAIL_STALE: 10 * 1000,    // 10 seconds - mark as stale
  ENTITY_DETAIL_CACHE: 2 * 60 * 1000, // 2 minutes - keep for navigation

  // =========================================================================
  // TIER 6: Reference Data (1 hour) - Entity name lookups (v8.3.0)
  // =========================================================================
  // Used for entity reference dropdowns in edit mode
  REF_DATA_STALE: 60 * 60 * 1000,     // 1 hour stale time
  REF_DATA_CACHE: 2 * 60 * 60 * 1000, // 2 hours cache time (GC)
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
  // v8.3.0: Reference data lookup (entity UUID → name)
  refData: (entityCode: string) => ['ref-data', entityCode] as const,
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

/**
 * v8.3.0: RefData type - response-level entity reference lookup table
 * Structure: { entity_code: { uuid: name } }
 */
export type RefData = Record<string, Record<string, string>>;

/**
 * Raw entity list result - cached as-is in React Query (v8.0.0)
 */
export interface EntityInstanceListResult<T = any> {
  data: T[];
  metadata: EntityMetadata | null;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  ref_data_entityInstance?: RefData;  // v8.3.0: Entity reference lookup table
}

/**
 * Formatted entity list result - created by select transform (v8.0.0)
 */
export interface FormattedEntityInstanceListResult<T = any> extends EntityInstanceListResult<T> {
  formattedData: FormattedRow<T>[];
}

/**
 * Raw entity instance result - cached as-is in React Query (v8.0.0)
 */
export interface EntityInstanceResult<T = any> {
  data: T;
  metadata: EntityMetadata | null;
  fields?: string[];
  ref_data_entityInstance?: RefData;  // v8.3.0: Entity reference lookup table
}

/**
 * Formatted entity instance result - created by select transform (v8.0.0)
 */
export interface FormattedEntityInstanceResult<T = any> extends EntityInstanceResult<T> {
  formattedData: FormattedRow<T>;
}

// ============================================================================
// useEntityInstanceList - Fetch RAW entity list with TanStack Query + Dexie (v9.0.0)
// ============================================================================

/**
 * Hook for fetching RAW entity lists with TanStack Query + Dexie offline-first storage
 *
 * v9.0.0: TanStack Query + Dexie Offline-First Pattern
 * - Data persisted in IndexedDB via Dexie
 * - TanStack Query handles caching and deduplication
 * - Auto-subscribe to WebSocket for real-time updates
 * - Works offline, syncs when connection restored
 *
 * Features:
 * - Instant display from IndexedDB cache
 * - Background sync with server
 * - Pagination support
 * - Metadata extraction
 *
 * @example
 * // Raw data (for editing, exports, etc.)
 * const { data } = useEntityInstanceList('project', { page: 1, pageSize: 100 });
 *
 * // Formatted data (for display) - use useFormattedEntityList instead
 * const { data } = useFormattedEntityList('project', { page: 1, pageSize: 100 });
 */
export function useEntityInstanceList<T = any>(
  entityCode: string,
  params: EntityInstanceListParams = {},
  options?: Omit<UseQueryOptions<EntityInstanceListResult<T>>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient();

  // Map view mode to component name for backend metadata filtering
  const viewComponentMap: Record<string, string> = {
    table: 'entityListOfInstancesTable',
    kanban: 'kanbanView',
    grid: 'gridView',
    calendar: 'calendarView',
    dag: 'dagView',
    hierarchy: 'hierarchyGraphView',
  };

  const mappedView = params.view ? viewComponentMap[params.view] || params.view : 'entityListOfInstancesTable';

  const normalizedParams = useMemo(() => ({
    ...params,
    page: params.page || 1,
    pageSize: params.pageSize || getEntityLimit(entityCode),
    view: mappedView,
    limit: params.pageSize || getEntityLimit(entityCode),
    offset: ((params.page || 1) - 1) * (params.pageSize || getEntityLimit(entityCode)),
  }), [params, mappedView, entityCode]);

  // v9.0.0: Use TanStack Query + Dexie for entity data with offline-first storage
  const tsResult = useEntityList<T>(entityCode, normalizedParams, {
    enabled: options?.enabled,
  });

  // Transform TanStack result to legacy result format
  const result: EntityInstanceListResult<T> = useMemo(() => ({
    data: tsResult.data || [],
    metadata: tsResult.metadata as EntityMetadata | null,
    total: tsResult.total,
    page: normalizedParams.page,
    pageSize: normalizedParams.pageSize,
    hasMore: (tsResult.data?.length || 0) === normalizedParams.pageSize,
    ref_data_entityInstance: tsResult.refData,
  }), [tsResult.data, tsResult.metadata, tsResult.total, tsResult.refData, normalizedParams]);

  // Cache ref_data_entityInstance for entity reference resolution
  useEffect(() => {
    if (result.ref_data_entityInstance) {
      upsertRefDataEntityInstanceCache(queryClient, result.ref_data_entityInstance);
    }
  }, [result.ref_data_entityInstance, queryClient]);

  // Log TanStack Query cache status
  const prevDataRef = useRef<T[] | undefined>(undefined);
  useEffect(() => {
    if (tsResult.data && tsResult.data !== prevDataRef.current) {
      prevDataRef.current = tsResult.data;
      console.log(
        `%c[TanStack ${tsResult.isStale ? 'STALE' : 'FRESH'}] 💾 useEntityInstanceList: ${entityCode}`,
        `color: ${tsResult.isStale ? '#fcc419' : '#51cf66'}; font-weight: bold`,
        {
          source: 'TanStack Query + Dexie',
          itemCount: tsResult.data.length,
          total: tsResult.total,
          isStale: tsResult.isStale,
          isLoading: tsResult.isLoading,
        }
      );
    }
  }, [tsResult.data, tsResult.isStale, tsResult.isLoading, tsResult.total, entityCode]);

  // Return React Query-compatible object for backwards compatibility
  return {
    data: result,
    isLoading: tsResult.isLoading,
    isPending: tsResult.isLoading,
    isError: tsResult.isError,
    error: tsResult.error,
    isStale: tsResult.isStale,
    isFetching: tsResult.isFetching,
    isRefetching: tsResult.isFetching && !tsResult.isLoading,
    refetch: tsResult.refetch,
    // Additional React Query compatibility properties
    status: tsResult.isLoading ? 'pending' as const : tsResult.isError ? 'error' as const : 'success' as const,
    fetchStatus: tsResult.isFetching ? 'fetching' as const : 'idle' as const,
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    isSuccess: !tsResult.isLoading && !tsResult.isError,
    isFetched: !tsResult.isLoading,
    isFetchedAfterMount: !tsResult.isLoading,
    isInitialLoading: tsResult.isLoading && (tsResult.data?.length || 0) === 0,
    isLoadingError: false,
    isPlaceholderData: false,
    isRefetchError: false,
  };
}

// ============================================================================
// useEntityInstance - Fetch RAW single entity with TanStack Query + Dexie (v9.0.0)
// ============================================================================

/**
 * Hook for fetching RAW single entity details with TanStack Query + Dexie offline-first storage
 *
 * v9.0.0: TanStack Query + Dexie Offline-First Pattern
 * - Data persisted in IndexedDB via Dexie
 * - TanStack Query handles caching and deduplication
 * - Auto-subscribe to WebSocket for real-time updates
 * - Works offline, syncs when connection restored
 *
 * Features:
 * - Instant display from IndexedDB cache
 * - Background sync with server
 * - Metadata extraction with backend field definitions
 *
 * @example
 * // Raw data (for editing)
 * const { data } = useEntityInstance('project', 'uuid-123');
 *
 * // Formatted data (for display) - use useFormattedEntityInstance instead
 * const { data } = useFormattedEntityInstance('project', 'uuid-123');
 */
export function useEntityInstance<T = any>(
  entityCode: string,
  id: string | undefined,
  options?: Omit<UseQueryOptions<EntityInstanceResult<T>>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient();

  // v9.0.0: Use TanStack Query + Dexie for entity data with offline-first storage
  const tsResult = useEntity<T>(entityCode, id, {
    enabled: options?.enabled !== false,
  });

  // Transform TanStack result to legacy result format
  const result: EntityInstanceResult<T> | undefined = useMemo(() => {
    if (!tsResult.data) return undefined;
    return {
      data: tsResult.data,
      metadata: tsResult.metadata as EntityMetadata | null,
      fields: undefined, // Fields are included in metadata
      ref_data_entityInstance: tsResult.refData,
    };
  }, [tsResult.data, tsResult.metadata, tsResult.refData]);

  // Cache metadata and refData in stores for other components
  useEffect(() => {
    if (result?.ref_data_entityInstance) {
      upsertRefDataEntityInstanceCache(queryClient, result.ref_data_entityInstance);
    }
  }, [result?.ref_data_entityInstance, queryClient]);

  // Log TanStack Query cache status
  const prevDataRef = useRef<T | null>(null);
  useEffect(() => {
    if (tsResult.data && tsResult.data !== prevDataRef.current && id) {
      prevDataRef.current = tsResult.data;
      console.log(
        `%c[TanStack ${tsResult.isStale ? 'STALE' : 'FRESH'}] 💾 useEntityInstance: ${entityCode}/${id}`,
        `color: ${tsResult.isStale ? '#fcc419' : '#51cf66'}; font-weight: bold`,
        {
          source: 'TanStack Query + Dexie',
          isStale: tsResult.isStale,
          isLoading: tsResult.isLoading,
          hasMetadata: !!tsResult.metadata,
          hasRefData: !!tsResult.refData,
        }
      );
    }
  }, [tsResult.data, tsResult.isStale, tsResult.isLoading, tsResult.metadata, tsResult.refData, entityCode, id]);

  // Return React Query-compatible object for backwards compatibility
  return {
    data: result,
    isLoading: tsResult.isLoading,
    isPending: tsResult.isLoading,
    isError: tsResult.isError,
    error: tsResult.error,
    isStale: tsResult.isStale,
    isFetching: tsResult.isFetching,
    isRefetching: tsResult.isFetching && !tsResult.isLoading,
    refetch: tsResult.refetch,
    // Additional React Query compatibility properties
    status: tsResult.isLoading ? 'pending' as const : tsResult.isError ? 'error' as const : 'success' as const,
    fetchStatus: tsResult.isFetching ? 'fetching' as const : 'idle' as const,
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    isSuccess: !tsResult.isLoading && !tsResult.isError && !!tsResult.data,
    isFetched: !tsResult.isLoading,
    isFetchedAfterMount: !tsResult.isLoading,
    isInitialLoading: tsResult.isLoading && !tsResult.data,
    isLoadingError: false,
    isPlaceholderData: false,
    isRefetchError: false,
  };
}

// ============================================================================
// useFormattedEntityList - Format at Read pattern with TanStack Query + Dexie (v9.0.0)
// ============================================================================

/**
 * Hook for fetching FORMATTED entity lists using TanStack Query + Dexie + formatting
 *
 * v9.0.0: TanStack Query + Dexie Offline-First + Format at Read
 * - Uses TanStack Query + Dexie for offline-first storage
 * - Applies formatting on read (memoized)
 * - Real-time updates via WebSocket sync
 *
 * Benefits:
 * - Offline-first with IndexedDB persistence
 * - Fresh formatting with latest datalabel colors
 * - TanStack Query handles tab focus sync
 *
 * @example
 * const { data } = useFormattedEntityList('project', { page: 1, pageSize: 100 });
 * // data.formattedData contains FormattedRow[] ready for rendering
 */
export function useFormattedEntityList<T = any>(
  entityCode: string,
  params: EntityInstanceListParams = {},
  options?: Omit<UseQueryOptions<FormattedEntityInstanceListResult<T>>, 'queryKey' | 'queryFn' | 'select'>
) {
  // Map view mode to component name for backend metadata filtering
  const viewComponentMap: Record<string, string> = {
    table: 'entityListOfInstancesTable',
    kanban: 'kanbanView',
    grid: 'gridView',
    calendar: 'calendarView',
    dag: 'dagView',
    hierarchy: 'hierarchyGraphView',
  };

  const mappedView = params.view ? viewComponentMap[params.view] || params.view : 'entityListOfInstancesTable';

  // Use RxDB-backed base hook
  const rawResult = useEntityInstanceList<T>(entityCode, params, options as any);

  // Format data on read (memoized)
  const formattedResult = useMemo((): FormattedEntityInstanceListResult<T> | undefined => {
    if (!rawResult.data) return undefined;

    const startTime = performance.now();
    const raw = rawResult.data;

    // Get component metadata for formatting
    const componentMetadata = (raw.metadata as any)?.[mappedView] as ComponentMetadata | null;

    // Format with ref_data_entityInstance for entity name resolution
    const formattedData = formatDataset(raw.data, componentMetadata, raw.ref_data_entityInstance);

    const duration = performance.now() - startTime;
    console.log(
      `%c[FORMAT AT READ] 🎨 Formatted ${raw.data.length} rows in ${duration.toFixed(2)}ms`,
      'color: #be4bdb; font-weight: bold',
      { entityCode, view: mappedView, hasMetadata: !!componentMetadata, hasRefData: !!raw.ref_data_entityInstance }
    );

    return {
      ...raw,
      formattedData,
    };
  }, [rawResult.data, entityCode, mappedView]);

  // Return React Query-compatible object with formatted data
  return {
    ...rawResult,
    data: formattedResult,
  };
}

// ============================================================================
// useFormattedEntityInstance - Format at Read pattern with TanStack Query + Dexie (v9.0.0)
// ============================================================================

/**
 * Hook for fetching FORMATTED single entity using TanStack Query + Dexie + formatting
 *
 * v9.0.0: TanStack Query + Dexie Offline-First + Format at Read
 * - Uses TanStack Query + Dexie for offline-first storage
 * - Applies formatting on read (memoized)
 * - Real-time updates via WebSocket sync
 *
 * @example
 * const { data } = useFormattedEntityInstance('project', 'uuid-123');
 * // data.formattedData contains FormattedRow ready for rendering
 */
export function useFormattedEntityInstance<T = any>(
  entityCode: string,
  id: string | undefined,
  componentName: string = 'entityInstanceFormContainer',
  options?: Omit<UseQueryOptions<FormattedEntityInstanceResult<T>>, 'queryKey' | 'queryFn' | 'select'>
) {
  // Use RxDB-backed base hook
  const rawResult = useEntityInstance<T>(entityCode, id, options as any);

  // Format data on read (memoized)
  const formattedResult = useMemo((): FormattedEntityInstanceResult<T> | undefined => {
    if (!rawResult.data) return undefined;

    const startTime = performance.now();
    const raw = rawResult.data;

    const componentMetadata = (raw.metadata as any)?.[componentName] as ComponentMetadata | null;
    // Format with ref_data_entityInstance for entity name resolution
    const formattedData = formatRow(raw.data, componentMetadata, raw.ref_data_entityInstance);

    const duration = performance.now() - startTime;
    console.log(
      `%c[FORMAT AT READ] 🎨 Formatted entity in ${duration.toFixed(2)}ms`,
      'color: #be4bdb; font-weight: bold',
      { entityCode, id, component: componentName, hasMetadata: !!componentMetadata, hasRefData: !!raw.ref_data_entityInstance }
    );

    return {
      ...raw,
      formattedData,
    };
  }, [rawResult.data, entityCode, id, componentName]);

  // Return React Query-compatible object with formatted data
  return {
    ...rawResult,
    data: formattedResult,
  };
}

// ============================================================================
// useEntityCodes - Fetch entity codes (TanStack Query + Dexie v9.0.0)
// ============================================================================

/**
 * Hook for fetching entity codes with TanStack Query + Dexie offline-first storage
 *
 * v9.0.0: Uses TanStack Query + Dexie IndexedDB for persistent, offline-first caching
 *
 * @example
 * const { data, entityCodes, getEntityByCode, isLoading } = useEntityCodes();
 */
export function useEntityCodes() {
  const tsResult = useTanstackEntityCodes();

  // Return compatible object structure
  return {
    data: tsResult.entityCodesMap,
    entityCodes: tsResult.entityCodes,
    entityCodesMap: tsResult.entityCodesMap,
    getEntityByCode: tsResult.getEntityByCode,
    isLoading: tsResult.isLoading,
    isPending: tsResult.isLoading,
    isError: tsResult.isError,
    error: tsResult.error,
    refetch: tsResult.refetch,
    // React Query compatibility
    status: tsResult.isLoading ? 'pending' as const : tsResult.isError ? 'error' as const : 'success' as const,
    isFetching: tsResult.isLoading,
    isSuccess: !tsResult.isLoading && !tsResult.isError,
  };
}

// ============================================================================
// useEntityMutation - Unified mutation hook using TanStack Query + Dexie (v9.0.0)
// ============================================================================

/**
 * Hook for entity mutations with TanStack Query + Dexie storage
 *
 * v9.0.0: TanStack Query + Dexie Offline-First Mutations
 * - Updates sent to server and stored in Dexie
 * - Automatic cache update via TanStack Query
 * - Works offline (queues for sync when online)
 *
 * @example
 * const { updateEntity, deleteEntity, isUpdating } = useEntityMutation('project');
 */
export function useEntityMutation(entityCode: string) {
  // v9.0.0: Use TanStack Query + Dexie mutation hook
  const tsMutation = useTanstackEntityMutation(entityCode);

  // Wrap TanStack methods to maintain backwards compatibility
  const updateEntity = useCallback(
    async ({ id, data }: { id: string; data: Record<string, any> }) => {
      await tsMutation.updateEntity(id, data);
      return data;
    },
    [tsMutation]
  );

  const deleteEntity = useCallback(
    async (id: string) => {
      await tsMutation.deleteEntity(id);
      return { success: true };
    },
    [tsMutation]
  );

  const createEntity = useCallback(
    async (data: Record<string, any>) => {
      const id = await tsMutation.createEntity(data);
      return { id, ...data };
    },
    [tsMutation]
  );

  return {
    updateEntity,
    deleteEntity,
    createEntity,
    isUpdating: tsMutation.isLoading,
    isDeleting: tsMutation.isLoading,
    isCreating: tsMutation.isLoading,
    updateError: tsMutation.error,
    deleteError: tsMutation.error,
    createError: tsMutation.error,
  };
}

// ============================================================================
// useDatalabels - Fetch datalabel options (TanStack Query + Dexie v9.0.0)
// ============================================================================

/**
 * Hook for fetching datalabel options with TanStack Query + Dexie offline-first storage
 *
 * v9.0.0: Uses TanStack Query + Dexie IndexedDB for persistent, offline-first caching
 *
 * @example
 * const { options, isLoading } = useDatalabels('dl__project_stage');
 */
export function useDatalabels(fieldKey: string) {
  const tsResult = useDatalabel(fieldKey);

  // Return compatible object structure
  return {
    data: tsResult.options,
    options: tsResult.options,
    isLoading: tsResult.isLoading,
    isPending: tsResult.isLoading,
    isError: tsResult.isError,
    error: tsResult.error,
    refetch: tsResult.refetch,
    // React Query compatibility
    status: tsResult.isLoading ? 'pending' as const : tsResult.isError ? 'error' as const : 'success' as const,
    isFetching: tsResult.isLoading,
    isSuccess: !tsResult.isLoading && !tsResult.isError,
  };
}

// ============================================================================
// useDatalabelMutation - Mutate datalabel with TanStack Query + Dexie cache invalidation
// ============================================================================

/**
 * Hook for datalabel mutations with automatic TanStack Query + Dexie cache invalidation
 *
 * v9.0.0: Uses TanStack Query + Dexie for cache invalidation
 *
 * @example
 * const { addItem, updateItem, deleteItem, reorderItems } = useDatalabelMutation('dl__project_stage');
 */
export function useDatalabelMutation(datalabelName: string) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // Helper to invalidate TanStack Query + Dexie datalabel cache
  const invalidateDatalabelCache = useCallback(async () => {
    // Invalidate TanStack Query + Dexie metadata cache
    await invalidateMetadataCache('datalabel', datalabelName);
    console.log(`%c[TanStack] 🗑️ Cache invalidated: datalabel:${datalabelName}`, 'color: #ff6b6b');
  }, [datalabelName]);

  const addItemMutation = useMutation({
    mutationFn: async (item: { name: string; descr?: string; color_code?: string; parent_id?: number }) => {
      const response = await fetch(`${apiUrl}/api/v1/datalabel/${datalabelName}/item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
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
      const response = await fetch(`${apiUrl}/api/v1/datalabel/${datalabelName}/item/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
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
      const response = await fetch(`${apiUrl}/api/v1/datalabel/${datalabelName}/item/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete item');
      return response.json();
    },
    onSettled: invalidateDatalabelCache,
  });

  const reorderItemsMutation = useMutation({
    mutationFn: async (orderedIds: number[]) => {
      const response = await fetch(`${apiUrl}/api/v1/datalabel/${datalabelName}/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
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
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const query = useQuery({
    queryKey: ['entity-lookup', entityCode],
    queryFn: async () => {
      console.log(`%c[API FETCH] 🔄 Fetching entity-instance: ${entityCode}`, 'color: #ff6b6b');

      const response = await fetch(
        `${apiUrl}/api/v1/entity/${entityCode}/entity-instance?active_only=true&limit=500`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch entity lookup: ${entityCode}`);
      }

      const data = await response.json();
      const options = data.data || data || [];

      console.log(`%c[API FETCH] ✅ Received entity-instance ${entityCode}`, 'color: #51cf66', {
        optionCount: options.length,
      });

      return options;
    },
    staleTime: CACHE_TTL.ENTITY_METADATA,  // 15 minutes - dropdown data
    gcTime: CACHE_TTL.ENTITY_METADATA * 2,
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
// useEntityMetadata - Get cached entity metadata (TanStack Query + Dexie v9.0.0)
// ============================================================================

/**
 * Hook for accessing cached entity metadata with TanStack Query + Dexie offline-first storage
 *
 * v9.0.0: Uses TanStack Query + Dexie IndexedDB for persistent, offline-first caching
 * Note: Component metadata is extracted from entity list/detail API responses.
 *
 * @example
 * const { metadata, isLoading } = useEntityMetadata('project', 'entityListOfInstancesTable');
 */
export function useEntityMetadata(entityCode: string, componentName: string = 'entityListOfInstancesTable') {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const query = useQuery({
    queryKey: ['componentMetadata', entityCode, componentName],
    queryFn: async () => {
      // Fetch from API - component metadata is included in entity responses
      const response = await fetch(
        `${apiUrl}/api/v1/${entityCode}?limit=1&view=${componentName}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${entityCode}`);
      }

      const data = await response.json();
      return (data.metadata as any)?.[componentName] || null;
    },
    staleTime: CACHE_TTL.ENTITY_METADATA,
    gcTime: CACHE_TTL.ENTITY_METADATA * 2,
    refetchOnWindowFocus: false,
    enabled: !!entityCode,
  });

  return {
    data: query.data,
    metadata: query.data,
    isLoading: query.isLoading,
    isPending: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

// ============================================================================
// useGlobalSettings - Fetch global settings (TanStack Query + Dexie v9.0.0)
// ============================================================================

/**
 * Hook for fetching global settings with TanStack Query + Dexie offline-first storage
 *
 * v9.0.0: Uses TanStack Query + Dexie IndexedDB for persistent, offline-first caching
 *
 * @example
 * const { data: settings, isLoading } = useGlobalSettings();
 */
export function useGlobalSettings() {
  const tsResult = useTanstackGlobalSettings();

  // Return compatible object structure
  return {
    data: tsResult.settings,
    isLoading: tsResult.isLoading,
    isPending: tsResult.isLoading,
    isError: tsResult.isError,
    error: tsResult.error,
    refetch: tsResult.refetch,
    // React Query compatibility
    status: tsResult.isLoading ? 'pending' as const : tsResult.isError ? 'error' as const : 'success' as const,
    isFetching: tsResult.isLoading,
    isSuccess: !tsResult.isLoading && !tsResult.isError,
  };
}

// ============================================================================
// useAllDatalabels - Fetch all datalabels (TanStack Query + Dexie v9.0.0)
// ============================================================================

/**
 * Hook for fetching all datalabels with TanStack Query + Dexie offline-first storage
 *
 * v9.0.0: Uses TanStack Query + Dexie IndexedDB for persistent, offline-first caching
 *
 * @example
 * const { datalabels, getDatalabel, isLoading } = useAllDatalabels();
 */
export function useAllDatalabels() {
  const tsResult = useTanstackAllDatalabels();

  // Return compatible object structure
  return {
    data: {
      data: Object.entries(tsResult.datalabels).map(([name, options]) => ({ name, options })),
      total: Object.keys(tsResult.datalabels).length,
    },
    datalabels: tsResult.datalabels,
    getDatalabel: tsResult.getDatalabel,
    isLoading: tsResult.isLoading,
    isPending: tsResult.isLoading,
    isError: false,
    error: null,
    refetch: tsResult.refetch,
    // React Query compatibility
    status: tsResult.isLoading ? 'pending' as const : 'success' as const,
    isFetching: tsResult.isLoading,
    isSuccess: !tsResult.isLoading,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to invalidate entity caches (TanStack Query + Dexie v9.0.0)
 *
 * v9.0.0: Uses TanStack Query + Dexie for all cache invalidation
 *
 * @example
 * const { invalidateEntity, invalidateAll } = useCacheInvalidation();
 * invalidateEntity('project', 'uuid-123');
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();

  // v9.0.0: TanStack Query + Dexie is single source of truth for data cache
  const invalidateEntity = useCallback(async (entityCode: string, id?: string) => {
    // TanStack Query invalidation
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });
    }
    queryClient.invalidateQueries({ queryKey: ['entity-instance-list', entityCode] });
    queryClient.invalidateQueries({ queryKey: ['entity-list', entityCode] });

    // Invalidate TanStack Query + Dexie component metadata for this entity
    await invalidateMetadataCache('component', entityCode);
    console.log(`%c[TanStack] 🗑️ Cache invalidated: entity ${entityCode}${id ? `/${id}` : ''}`, 'color: #ff6b6b');
  }, [queryClient]);

  const invalidateAll = useCallback(async () => {
    // Invalidate all TanStack Query cache
    queryClient.invalidateQueries();

    // Clear all TanStack Query + Dexie metadata cache
    await clearAllMetadataCache();
    console.log('%c[TanStack] 🗑️ All caches cleared', 'color: #ff6b6b');
  }, [queryClient]);

  const invalidateEntityCodes = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.entityCodes() });
    await invalidateMetadataCache('entity');
    console.log('%c[TanStack] 🗑️ Entity codes cache invalidated', 'color: #ff6b6b');
  }, [queryClient]);

  const invalidateGlobalSettings = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.globalSettings() });
    await invalidateMetadataCache('settings');
    console.log('%c[TanStack] 🗑️ Global settings cache invalidated', 'color: #ff6b6b');
  }, [queryClient]);

  const invalidateDatalabels = useCallback(async (name?: string) => {
    if (name) {
      queryClient.invalidateQueries({ queryKey: queryKeys.datalabels(name) });
      await invalidateMetadataCache('datalabel', name);
      console.log(`%c[TanStack] 🗑️ Datalabel cache invalidated: ${name}`, 'color: #ff6b6b');
    } else {
      queryClient.invalidateQueries({ queryKey: ['settings', 'datalabels'] });
      await invalidateMetadataCache('datalabel');
      console.log('%c[TanStack] 🗑️ All datalabel caches invalidated', 'color: #ff6b6b');
    }
  }, [queryClient]);

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
        const response = await api.get(id, { view: 'entityInstanceFormContainer' });
        return {
          data: response.data || response,
          metadata: response.metadata || null,
          datalabels: response.datalabels || [],
        };
      },
      staleTime: CACHE_TTL.ENTITY_DETAIL_STALE,
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
          pageSize: params?.pageSize || PAGINATION_CONFIG.CHILD_ENTITY_LIMIT,
          hasMore: (response.data?.length || 0) === (params?.pageSize || PAGINATION_CONFIG.CHILD_ENTITY_LIMIT),
        };
      },
      staleTime: CACHE_TTL.ENTITY_LIST_STALE,
    });
  }, [queryClient]);

  return { prefetchEntity, prefetchList };
}

