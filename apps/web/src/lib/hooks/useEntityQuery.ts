/**
 * Entity Query Hooks - RxDB + React Query Integration
 *
 * ARCHITECTURE (v8.5.0 - RxDB Offline-First):
 * - RxDB: PRIMARY data cache for entity instances (IndexedDB persistence)
 * - React Query: Metadata, datalabels, entity codes, global settings
 * - Zustand: UI state only (edit state, preferences)
 * - Formatting: Happens on READ via `select` option
 *
 * Cache Strategy:
 * - Entity Data (RxDB): Persistent, offline-first, reactive queries
 * - Reference Data (1 hour): Entity types, global settings, datalabels
 * - Metadata (15 min): Field definitions, component schemas
 *
 * RxDB Benefits (v8.5.0):
 * - Offline-first: Works without network connection
 * - Persistent: Survives browser restart
 * - Multi-tab sync: LeaderElection coordinates tabs
 * - Draft persistence: Unsaved edits survive refresh
 * - Reactive: UI auto-updates via RxJS observables
 *
 * Store Architecture:
 * - RxDB entities collection: Entity instance data
 * - RxDB drafts collection: Unsaved edits with undo/redo
 * - RxDB metadata collection: TTL-based metadata cache
 * - Zustand stores: UI state, preferences
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { APIFactory, type EntityMetadata, type PaginatedResponse } from '../api';
import { useEntityEditStore } from '../../stores/useEntityEditStore';
import type { DatalabelData } from '../frontEndFormatterService';

// Import format-at-read utilities
// Used by select option to transform raw cache data into formatted display data
import { formatDataset, formatRow, type FormattedRow, type ComponentMetadata } from '../formatters';
// Centralized pagination config (v8.1.0)
import { getEntityLimit, PAGINATION_CONFIG } from '../pagination.config';

// Import specialized Zustand stores (METADATA ONLY)
// Entity instance data now uses RxDB as primary cache
import { useGlobalSettingsMetadataStore } from '../../stores/globalSettingsMetadataStore';
import { useDatalabelMetadataStore } from '../../stores/datalabelMetadataStore';
import { useEntityComponentMetadataStore } from '../../stores/entityComponentMetadataStore';
import { useEntityCodeMetadataStore } from '../../stores/entityCodeMetadataStore';

// Import normalized cache utilities (for React Query compatibility during transition)
import {
  normalizeListResponse,
  updateNormalizedEntity,
  removeNormalizedEntity,
  addNormalizedEntity,
  getNormalizedEntity,
  invalidateEntityQueries,
} from '../cache/normalizedCache';

// v8.3.2: Unified ref_data_entityInstance cache for dropdown + view resolution
import { upsertRefDataEntityInstanceCache } from './useRefDataEntityInstanceCache';

// v8.5.0: RxDB hooks for offline-first entity data
import {
  useRxEntity,
  useRxEntityList,
  useRxEntityMutation,
  getReplicationManager,
} from '../../db/rxdb';

// v8.6.0: RxDB hooks for metadata (replaces Zustand stores)
import {
  useRxDatalabel,
  useRxAllDatalabels,
  useRxEntityCodes as useRxEntityCodesHook,
  useRxGlobalSettings as useRxGlobalSettingsHook,
  useRxComponentMetadata,
  cacheComponentMetadata,
  type DatalabelOption,
  type EntityCodeData as RxDBEntityCodeData,
  type GlobalSettings as RxDBGlobalSettings,
} from '../../db/rxdb';

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
// useEntityInstanceList - Fetch RAW entity list with RxDB caching (v8.5.0)
// ============================================================================

/**
 * Hook for fetching RAW entity lists with RxDB offline-first storage
 *
 * v8.5.0: RxDB Offline-First Pattern
 * - Data persisted in IndexedDB via RxDB
 * - Reactive queries via RxJS observables
 * - Auto-subscribe to WebSocket for real-time updates
 * - Works offline, syncs when connection restored
 *
 * Features:
 * - Instant display from IndexedDB cache
 * - Background sync with server
 * - Multi-tab coordination via LeaderElection
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
    table: 'entityDataTable',
    kanban: 'kanbanView',
    grid: 'gridView',
    calendar: 'calendarView',
    dag: 'dagView',
    hierarchy: 'hierarchyGraphView',
  };

  const mappedView = params.view ? viewComponentMap[params.view] || params.view : 'entityDataTable';

  const normalizedParams = useMemo(() => ({
    ...params,
    page: params.page || 1,
    pageSize: params.pageSize || getEntityLimit(entityCode),
    view: mappedView,
  }), [params, mappedView, entityCode]);

  // v8.5.0: Use RxDB for entity data with offline-first storage
  const rxResult = useRxEntityList<T>(entityCode, normalizedParams, {
    enabled: options?.enabled,
  });

  // Transform RxDB result to React Query-compatible format
  const result: EntityInstanceListResult<T> = useMemo(() => ({
    data: rxResult.data,
    metadata: rxResult.metadata as EntityMetadata | null,
    total: rxResult.total,
    page: normalizedParams.page,
    pageSize: normalizedParams.pageSize,
    hasMore: rxResult.data.length === normalizedParams.pageSize,
    ref_data_entityInstance: rxResult.refData,
  }), [rxResult.data, rxResult.metadata, rxResult.total, rxResult.refData, normalizedParams]);

  // Cache metadata in RxDB (v8.6.0) + Zustand stores (for backwards compatibility)
  useEffect(() => {
    if (result.metadata) {
      const componentName = normalizedParams.view || 'entityDataTable';
      const componentMetadata = (result.metadata as any)[componentName];
      if (componentMetadata && typeof componentMetadata === 'object') {
        // v8.6.0: Cache in RxDB
        cacheComponentMetadata(entityCode, componentName, componentMetadata).catch(console.error);
        // Legacy: Also cache in Zustand for backwards compatibility
        useEntityComponentMetadataStore.getState().setComponentMetadata(entityCode, componentName, componentMetadata);
      }
    }
    if (result.ref_data_entityInstance) {
      upsertRefDataEntityInstanceCache(queryClient, result.ref_data_entityInstance);
    }
  }, [result.metadata, result.ref_data_entityInstance, entityCode, normalizedParams.view, queryClient]);

  // Log RxDB cache status
  const prevDataRef = useRef<T[] | undefined>(undefined);
  useEffect(() => {
    if (rxResult.data && rxResult.data !== prevDataRef.current) {
      prevDataRef.current = rxResult.data;
      console.log(
        `%c[RxDB ${rxResult.isStale ? 'STALE' : 'FRESH'}] 💾 useEntityInstanceList: ${entityCode}`,
        `color: ${rxResult.isStale ? '#fcc419' : '#51cf66'}; font-weight: bold`,
        {
          source: 'RxDB (IndexedDB)',
          itemCount: rxResult.data.length,
          total: rxResult.total,
          isStale: rxResult.isStale,
          isLoading: rxResult.isLoading,
        }
      );
    }
  }, [rxResult.data, rxResult.isStale, rxResult.isLoading, rxResult.total, entityCode]);

  // Return React Query-compatible object for backwards compatibility
  return {
    data: result,
    isLoading: rxResult.isLoading,
    isPending: rxResult.isLoading,
    isError: !!rxResult.error,
    error: rxResult.error,
    isStale: rxResult.isStale,
    isFetching: rxResult.isLoading,
    isRefetching: false,
    refetch: rxResult.refetch,
    // Additional React Query compatibility properties
    status: rxResult.isLoading ? 'pending' as const : rxResult.error ? 'error' as const : 'success' as const,
    fetchStatus: rxResult.isLoading ? 'fetching' as const : 'idle' as const,
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    isSuccess: !rxResult.isLoading && !rxResult.error,
    isFetched: !rxResult.isLoading,
    isFetchedAfterMount: !rxResult.isLoading,
    isInitialLoading: rxResult.isLoading && rxResult.data.length === 0,
    isLoadingError: false,
    isPlaceholderData: false,
    isRefetchError: false,
  };
}

// ============================================================================
// useEntityInstance - Fetch RAW single entity with RxDB caching (v8.5.0)
// ============================================================================

/**
 * Hook for fetching RAW single entity details with RxDB offline-first storage
 *
 * v8.5.0: RxDB Offline-First Pattern
 * - Data persisted in IndexedDB via RxDB
 * - Reactive queries via RxJS observables
 * - Auto-subscribe to WebSocket for real-time updates
 * - Works offline, syncs when connection restored
 *
 * Features:
 * - Instant display from IndexedDB cache
 * - Background sync with server
 * - Multi-tab coordination via LeaderElection
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

  // v8.5.0: Use RxDB for entity data with offline-first storage
  const rxResult = useRxEntity<T>(entityCode, id, {
    enabled: options?.enabled !== false,
  });

  // Transform RxDB result to React Query-compatible format
  const result: EntityInstanceResult<T> | undefined = useMemo(() => {
    if (!rxResult.data) return undefined;
    return {
      data: rxResult.data,
      metadata: rxResult.metadata as EntityMetadata | null,
      fields: undefined, // Fields are included in metadata
      ref_data_entityInstance: rxResult.refData,
    };
  }, [rxResult.data, rxResult.metadata, rxResult.refData]);

  // Cache metadata and refData in stores for other components
  useEffect(() => {
    if (result?.ref_data_entityInstance) {
      upsertRefDataEntityInstanceCache(queryClient, result.ref_data_entityInstance);
    }
  }, [result?.ref_data_entityInstance, queryClient]);

  // Log RxDB cache status
  const prevDataRef = useRef<T | null>(null);
  useEffect(() => {
    if (rxResult.data && rxResult.data !== prevDataRef.current && id) {
      prevDataRef.current = rxResult.data;
      console.log(
        `%c[RxDB ${rxResult.isStale ? 'STALE' : 'FRESH'}] 💾 useEntityInstance: ${entityCode}/${id}`,
        `color: ${rxResult.isStale ? '#fcc419' : '#51cf66'}; font-weight: bold`,
        {
          source: 'RxDB (IndexedDB)',
          isStale: rxResult.isStale,
          isLoading: rxResult.isLoading,
          hasMetadata: !!rxResult.metadata,
          hasRefData: !!rxResult.refData,
        }
      );
    }
  }, [rxResult.data, rxResult.isStale, rxResult.isLoading, rxResult.metadata, rxResult.refData, entityCode, id]);

  // Return React Query-compatible object for backwards compatibility
  return {
    data: result,
    isLoading: rxResult.isLoading,
    isPending: rxResult.isLoading,
    isError: !!rxResult.error,
    error: rxResult.error,
    isStale: rxResult.isStale,
    isFetching: rxResult.isLoading,
    isRefetching: false,
    refetch: rxResult.refetch,
    // Additional React Query compatibility properties
    status: rxResult.isLoading ? 'pending' as const : rxResult.error ? 'error' as const : 'success' as const,
    fetchStatus: rxResult.isLoading ? 'fetching' as const : 'idle' as const,
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    isSuccess: !rxResult.isLoading && !rxResult.error && !!rxResult.data,
    isFetched: !rxResult.isLoading,
    isFetchedAfterMount: !rxResult.isLoading,
    isInitialLoading: rxResult.isLoading && !rxResult.data,
    isLoadingError: false,
    isPlaceholderData: false,
    isRefetchError: false,
  };
}

// ============================================================================
// useFormattedEntityList - Format at Read pattern with RxDB (v8.5.0)
// ============================================================================

/**
 * Hook for fetching FORMATTED entity lists using RxDB + formatting
 *
 * v8.5.0: RxDB Offline-First + Format at Read
 * - Uses RxDB for offline-first storage
 * - Applies formatting on read (memoized)
 * - Real-time updates via WebSocket sync
 *
 * Benefits:
 * - Offline-first with IndexedDB persistence
 * - Fresh formatting with latest datalabel colors
 * - Multi-tab sync via LeaderElection
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
    table: 'entityDataTable',
    kanban: 'kanbanView',
    grid: 'gridView',
    calendar: 'calendarView',
    dag: 'dagView',
    hierarchy: 'hierarchyGraphView',
  };

  const mappedView = params.view ? viewComponentMap[params.view] || params.view : 'entityDataTable';

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
// useFormattedEntityInstance - Format at Read pattern with RxDB (v8.5.0)
// ============================================================================

/**
 * Hook for fetching FORMATTED single entity using RxDB + formatting
 *
 * v8.5.0: RxDB Offline-First + Format at Read
 * - Uses RxDB for offline-first storage
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
  componentName: string = 'entityFormContainer',
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
  // ✅ INDUSTRY STANDARD: Use getState() to avoid store subscription
  // Subscribing to entire store causes re-renders on ANY state change
  const queryClient = useQueryClient();
  const queryKey = queryKeys.entityCodes();

  // Check if already cached in Zustand (imperative access)
  const cachedEntityCodes = useEntityCodeMetadataStore.getState().getEntityCodesMap();

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

      // Cache in entityCodeMetadataStore (30 min TTL) - use getState() inside callback
      useEntityCodeMetadataStore.getState().setEntityCodes(Array.from(entityMap.values()));

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
// useEntityMutation - Unified mutation hook using RxDB (v8.5.0)
// ============================================================================

/**
 * Hook for entity mutations with RxDB storage
 *
 * v8.5.0: RxDB Offline-First Mutations
 * - Updates sent to server and stored in RxDB
 * - Automatic cache update via reactive queries
 * - Works offline (queues for sync when online)
 *
 * @example
 * const { updateEntity, deleteEntity, isUpdating } = useEntityMutation('project');
 */
export function useEntityMutation(entityCode: string) {
  // v8.5.0: Use RxDB mutation hook
  const rxMutation = useRxEntityMutation(entityCode);

  // Wrap RxDB methods to maintain backwards compatibility
  const updateEntity = useCallback(
    async ({ id, data }: { id: string; data: Record<string, any> }) => {
      await rxMutation.updateEntity(id, data);
      return data;
    },
    [rxMutation]
  );

  const deleteEntity = useCallback(
    async (id: string) => {
      await rxMutation.deleteEntity(id);
      return { success: true };
    },
    [rxMutation]
  );

  const createEntity = useCallback(
    async (data: Record<string, any>) => {
      const id = await rxMutation.createEntity(data);
      return { id, ...data };
    },
    [rxMutation]
  );

  return {
    updateEntity,
    deleteEntity,
    createEntity,
    isUpdating: rxMutation.isLoading,
    isDeleting: rxMutation.isLoading,
    isCreating: rxMutation.isLoading,
    updateError: rxMutation.error,
    deleteError: rxMutation.error,
    createError: rxMutation.error,
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
  // ✅ INDUSTRY STANDARD: Use getState() to avoid store subscription
  const queryClient = useQueryClient();
  const queryKey = queryKeys.datalabels(fieldKey);

  // Check if already cached in Zustand (imperative access)
  const cachedOptions = useDatalabelMetadataStore.getState().getDatalabel(fieldKey);
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

      // Cache in datalabelMetadataStore (30 min TTL) - use getState() inside callback
      useDatalabelMetadataStore.getState().setDatalabel(fieldKey, opts);

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
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  // ✅ INDUSTRY STANDARD: No store subscription - use getState() in callbacks

  // Helper to invalidate all datalabel caches
  const invalidateDatalabelCache = useCallback(() => {
    // Invalidate React Query cache for this specific datalabel
    queryClient.invalidateQueries({ queryKey: queryKeys.datalabels(datalabelName) });
    // Invalidate all datalabels query (used by some components)
    queryClient.invalidateQueries({ queryKey: ['settings', 'datalabels', 'all'] });
    // Invalidate Zustand store - use getState() inside callback
    useDatalabelMetadataStore.getState().invalidate(datalabelName);

    console.log(`%c[DatalabelMutation] Cache invalidated: ${datalabelName}`, 'color: #ff6b6b');
  }, [queryClient, datalabelName]);

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
  // ✅ INDUSTRY STANDARD: Use getState() to avoid store subscription
  // This is a synchronous lookup - no need to subscribe to store changes
  const store = useEntityComponentMetadataStore.getState();

  // If component name specified, get specific component metadata
  if (componentName) {
    const metadata = store.getComponentMetadata(entityCode, componentName);
    if (metadata) {
      console.log(`%c[CACHE HIT] 💾 useEntityMetadata: ${entityCode}:${componentName}`, 'color: #51cf66; font-weight: bold');
    }
    return metadata;
  }

  // Otherwise, get all component metadata for the entity
  const allMetadata = store.getAllComponentMetadata(entityCode);
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
  // ✅ INDUSTRY STANDARD: Use getState() to avoid store subscription
  const queryClient = useQueryClient();
  const queryKey = queryKeys.globalSettings();

  // Check if already cached in Zustand (imperative access)
  const cachedSettings = useGlobalSettingsMetadataStore.getState().getGlobalSettings();

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

      // Cache in globalSettingsMetadataStore (30 min TTL) - use getState() inside callback
      useGlobalSettingsMetadataStore.getState().setGlobalSettings(data);

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
  // ✅ INDUSTRY STANDARD: Use getState() to avoid store subscription
  const queryClient = useQueryClient();
  const queryKey = ['settings', 'datalabels', 'all'];

  // Check if already cached in Zustand (imperative access)
  const cachedDatalabels = useDatalabelMetadataStore.getState().getAllDatalabels();

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

      // Cache all datalabels in datalabelMetadataStore (30 min TTL) - use getState() inside callback
      useDatalabelMetadataStore.getState().setAllDatalabels(result.data);

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

  // ✅ INDUSTRY STANDARD: Use getState() for imperative store access
  // This prevents subscription-based re-renders from store changes

  // v6.0.0: React Query is sole data cache
  const invalidateEntity = useCallback((entityCode: string, id?: string) => {
    // React Query invalidation (sole data cache)
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });
    }
    queryClient.invalidateQueries({ queryKey: ['entity-instance-list', entityCode] });

    // Only invalidate metadata store (not data stores - they're removed)
    useEntityComponentMetadataStore.getState().invalidateEntity(entityCode);
  }, [queryClient]);

  const invalidateAll = useCallback(() => {
    // Invalidate all React Query cache (sole data cache)
    queryClient.invalidateQueries();

    // Clear metadata Zustand stores - use getState() for imperative access
    useGlobalSettingsMetadataStore.getState().clear();
    useDatalabelMetadataStore.getState().clear();
    useEntityComponentMetadataStore.getState().clear();
    useEntityCodeMetadataStore.getState().clear();
  }, [queryClient]);

  const invalidateEntityCodes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.entityCodes() });
    useEntityCodeMetadataStore.getState().clear();
  }, [queryClient]);

  const invalidateGlobalSettings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.globalSettings() });
    useGlobalSettingsMetadataStore.getState().clear();
  }, [queryClient]);

  const invalidateDatalabels = useCallback((name?: string) => {
    if (name) {
      queryClient.invalidateQueries({ queryKey: queryKeys.datalabels(name) });
      useDatalabelMetadataStore.getState().invalidate(name);
    } else {
      queryClient.invalidateQueries({ queryKey: ['settings', 'datalabels'] });
      useDatalabelMetadataStore.getState().clear();
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
        const response = await api.get(id, { view: 'entityFormContainer' });
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

// ============================================================================
// v8.6.0: RxDB-Based Metadata Hooks (New - Replaces Zustand + React Query)
// ============================================================================

/**
 * Hook for fetching entity codes using RxDB (v8.6.0)
 *
 * This is the RxDB-based replacement for useEntityCodes.
 * Uses IndexedDB for offline-first storage.
 *
 * @example
 * const { entityCodes, entityCodesMap, getEntityByCode, isLoading } = useEntityCodesV2();
 * const projectEntity = getEntityByCode('project');
 */
export function useEntityCodesV2() {
  const rxResult = useRxEntityCodesHook();

  // Return React Query-compatible object for backwards compatibility
  return {
    data: rxResult.entityCodesMap,
    entityCodes: rxResult.entityCodes,
    entityCodesMap: rxResult.entityCodesMap,
    getEntityByCode: rxResult.getEntityByCode,
    isLoading: rxResult.isLoading,
    isPending: rxResult.isLoading,
    isError: !!rxResult.error,
    error: rxResult.error,
    refetch: rxResult.refetch,
  };
}

/**
 * Hook for fetching datalabel options using RxDB (v8.6.0)
 *
 * This is the RxDB-based replacement for useDatalabels.
 * Uses IndexedDB for offline-first storage.
 *
 * @example
 * const { options, isLoading } = useDatalabelsV2('dl__project_stage');
 */
export function useDatalabelsV2(fieldKey: string) {
  const rxResult = useRxDatalabel(fieldKey);

  // Return React Query-compatible object for backwards compatibility
  return {
    data: rxResult.options,
    options: rxResult.options,
    isLoading: rxResult.isLoading,
    isPending: rxResult.isLoading,
    isError: !!rxResult.error,
    error: rxResult.error,
    refetch: rxResult.refetch,
  };
}

/**
 * Hook for fetching global settings using RxDB (v8.6.0)
 *
 * This is the RxDB-based replacement for useGlobalSettings.
 * Uses IndexedDB for offline-first storage.
 *
 * @example
 * const { data: settings, isLoading } = useGlobalSettingsV2();
 */
export function useGlobalSettingsV2() {
  const rxResult = useRxGlobalSettingsHook();

  // Return React Query-compatible object for backwards compatibility
  return {
    data: rxResult.settings,
    isLoading: rxResult.isLoading,
    isPending: rxResult.isLoading,
    isError: !!rxResult.error,
    error: rxResult.error,
    refetch: rxResult.refetch,
  };
}

/**
 * Hook for fetching all datalabels using RxDB (v8.6.0)
 *
 * This is the RxDB-based replacement for useAllDatalabels.
 * Uses IndexedDB for offline-first storage.
 *
 * @example
 * const { datalabels, getDatalabel, isLoading } = useAllDatalabelsV2();
 */
export function useAllDatalabelsV2() {
  const rxResult = useRxAllDatalabels();

  // Return React Query-compatible object for backwards compatibility
  return {
    data: {
      data: Object.entries(rxResult.datalabels).map(([name, options]) => ({ name, options })),
      total: Object.keys(rxResult.datalabels).length,
    },
    datalabels: rxResult.datalabels,
    getDatalabel: rxResult.getDatalabel,
    isLoading: rxResult.isLoading,
    isPending: rxResult.isLoading,
    isError: !!rxResult.error,
    error: rxResult.error,
    refetch: rxResult.refetch,
  };
}

/**
 * Hook for getting entity metadata using RxDB (v8.6.0)
 *
 * This is the RxDB-based replacement for useEntityMetadata.
 * Uses IndexedDB for offline-first storage.
 *
 * @example
 * const { metadata, isLoading } = useEntityMetadataV2('project', 'entityDataTable');
 */
export function useEntityMetadataV2(entityCode: string, componentName: string = 'entityDataTable') {
  const rxResult = useRxComponentMetadata(entityCode, componentName);

  return {
    data: rxResult.metadata,
    metadata: rxResult.metadata,
    isLoading: rxResult.isLoading,
    isPending: rxResult.isLoading,
    isError: !!rxResult.error,
    error: rxResult.error,
  };
}
