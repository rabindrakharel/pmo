/**
 * Entity Query Hooks - React Query + Zustand Integration
 *
 * ARCHITECTURE (v6.0.0 - Industry Standard):
 * - React Query: SOLE data cache for entity instances (lists & details)
 * - Zustand: UI state only (edit state, preferences) + metadata caching
 *
 * Cache Strategy (Stale-While-Revalidate):
 * - Reference Data (1 hour): Entity types, global settings, datalabels
 * - Metadata (15 min): Field definitions, component schemas
 * - Entity Lists (30 sec stale, 5 min cache): Show cached, refetch in background
 * - Entity Details (10 sec stale, 2 min cache): Near real-time for edits
 *
 * Store Architecture (Metadata Only):
 * - globalSettingsMetadataStore: Currency, date, timestamp formatting
 * - datalabelMetadataStore: Dropdown options (dl__* fields)
 * - entityComponentMetadataStore: Field metadata keyed by entityCode:componentName
 * - entityCodeMetadataStore: Entity types for sidebar navigation
 *
 * REMOVED (v6.0.0 - Eliminated Dual Cache):
 * - entityInstanceDataStore: Now using React Query only
 * - entityInstanceListDataStore: Now using React Query only
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useMemo, useEffect, useRef } from 'react';
import { APIFactory, type EntityMetadata, type PaginatedResponse } from '../api';
import { useEntityEditStore } from '../../stores/useEntityEditStore';
import type { DatalabelData } from '../frontEndFormatterService';

// Import format-at-fetch utilities (v7.0.0)
import { formatDataset, formatRow, type FormattedRow, type ComponentMetadata } from '../formatters';

// Import specialized Zustand stores (METADATA ONLY - v6.0.0)
// Entity instance data now uses React Query as sole cache
import { useGlobalSettingsMetadataStore } from '../../stores/globalSettingsMetadataStore';
import { useDatalabelMetadataStore } from '../../stores/datalabelMetadataStore';
import { useEntityComponentMetadataStore } from '../../stores/entityComponentMetadataStore';
import { useEntityCodeMetadataStore } from '../../stores/entityCodeMetadataStore';

// Import normalized cache utilities (v6.1.0)
import {
  normalizeListResponse,
  updateNormalizedEntity,
  removeNormalizedEntity,
  addNormalizedEntity,
  getNormalizedEntity,
  invalidateEntityQueries,
} from '../cache/normalizedCache';

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
  formattedData: FormattedRow<T>[];  // v7.0.0: Pre-formatted data for instant rendering
  metadata: EntityMetadata | null;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
// Note: datalabels and globalSettings are fetched via dedicated endpoints

export interface EntityInstanceResult<T = any> {
  data: T;
  formattedData: FormattedRow<T>;  // v7.0.0: Pre-formatted data for instant rendering
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
  // ✅ INDUSTRY STANDARD: Use getState() for imperative store access
  // This prevents subscription-based re-renders from store changes
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

  // Map frontend view mode to backend component name
  const mappedView = params.view ? viewComponentMap[params.view] || params.view : 'entityDataTable';

  const normalizedParams = useMemo(() => ({
    ...params,  // Spread first so explicit values override
    page: params.page || 1,
    pageSize: params.pageSize || 5000,  // v7.0.0: Large page size for format-at-fetch
    view: mappedView,  // Use mapped view, not raw params.view
  }), [params, mappedView]);

  const queryKey = useMemo(
    () => queryKeys.entityInstanceList(entityCode, normalizedParams),
    [entityCode, normalizedParams]
  );

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
      // Preserve fields array for column ordering, and include it in metadata for downstream use
      const metadataWithFields = response.metadata ? {
        ...response.metadata,
        fields: response.fields || [],  // Include fields array in metadata
      } : null;

      // ═══════════════════════════════════════════════════════════════
      // v7.0.0: Format data ONCE at fetch time for optimal render performance
      // ═══════════════════════════════════════════════════════════════
      const componentMetadata = (metadataWithFields as any)?.entityDataTable as ComponentMetadata | null;
      const formattedData = formatDataset(response.data || [], componentMetadata);

      const result: EntityInstanceListResult<T> = {
        data: response.data || [],
        formattedData,  // v7.0.0: Pre-formatted for instant rendering
        metadata: metadataWithFields,
        total: response.total || 0,
        page: normalizedParams.page,
        pageSize: normalizedParams.pageSize,
        hasMore: (response.data?.length || 0) === normalizedParams.pageSize,
      };

      console.log(`%c[API FETCH] ✅ Received ${result.data.length} items for ${entityCode}`, 'color: #ff6b6b', {
        total: result.total,
        hasMetadata: !!result.metadata,
        metadataKeys: result.metadata ? Object.keys(result.metadata) : [],
        entityDataTableFieldCount: result.metadata?.entityDataTable ? Object.keys(result.metadata.entityDataTable).length : 0,
        fieldsCount: result.metadata?.fields?.length || 0,
      });

      // v6.1.0: Store entities in normalized cache for cross-view consistency
      normalizeListResponse(queryClient, { data: result.data, metadata: result.metadata, total: result.total }, entityCode);

      // Cache component metadata in entityComponentMetadataStore (15 min TTL)
      // Backend returns: { entityDataTable: {...}, entityFormContainer: {...}, ... }
      // Extract only the requested component's metadata
      if (result.metadata) {
        const componentName = normalizedParams.view || 'entityDataTable';
        const componentMetadata = (result.metadata as any)[componentName];
        if (componentMetadata && typeof componentMetadata === 'object') {
          // ✅ Use getState() for imperative access - no subscription needed
          useEntityComponentMetadataStore.getState().setComponentMetadata(entityCode, componentName, componentMetadata);
        }
      }

      // ✅ v6.2.0: Cache datalabels from API response (backend sends colors)
      // Backend returns: { datalabels: { dl__project_stage: [{ name, color_code }] } }
      if (response.datalabels && typeof response.datalabels === 'object') {
        Object.entries(response.datalabels).forEach(([datalabelKey, options]) => {
          if (Array.isArray(options)) {
            useDatalabelMetadataStore.getState().setDatalabel(datalabelKey, options);
          }
        });
        console.log(`%c[API FETCH] 🎨 Cached datalabels from API:`, 'color: #be4bdb', Object.keys(response.datalabels));
      }

      return result;
    },
    // v6.0.0: Stale-while-revalidate pattern
    staleTime: CACHE_TTL.ENTITY_LIST_STALE,  // 30 seconds - show cached, refetch in background
    gcTime: CACHE_TTL.ENTITY_LIST_CACHE,     // 5 minutes - keep for back navigation
    refetchOnWindowFocus: true,               // Industry standard: refresh when user returns
    refetchOnMount: true,                     // Always check freshness on mount
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
          staleTime: `${CACHE_TTL.ENTITY_LIST_STALE / 1000}s`,
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
 * - Automatic caching (10s stale, 2m cache) with stale-while-revalidate
 * - Metadata extraction with backend field definitions
 * - Integration with normalized cache for cross-view consistency
 * - Optimistic update support via normalized cache
 *
 * @example
 * const { data, isLoading, refetch } = useEntityInstance('project', 'uuid-123');
 */
export function useEntityInstance<T = any>(
  entityCode: string,
  id: string | undefined,
  options?: Omit<UseQueryOptions<EntityInstanceResult<T>>, 'queryKey' | 'queryFn'>
) {
  // ✅ INDUSTRY STANDARD: Use getState() for imperative store access
  // This prevents subscription-based re-renders from store changes
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

      // v6.1.0: Store entity in normalized cache for cross-view consistency
      addNormalizedEntity(queryClient, entityCode, data);

      // ═══════════════════════════════════════════════════════════════
      // v7.0.0: Format data ONCE at fetch time for optimal render performance
      // ═══════════════════════════════════════════════════════════════
      const componentMetadata = (metadata as any)?.entityFormContainer as ComponentMetadata | null;
      const formattedData = formatRow(data, componentMetadata);

      return { data, formattedData, metadata, fields };
    },
    enabled: !!id,
    // v6.0.0: Near real-time for actively edited records
    staleTime: CACHE_TTL.ENTITY_DETAIL_STALE,  // 10 seconds - short stale time
    gcTime: CACHE_TTL.ENTITY_DETAIL_CACHE,     // 2 minutes - keep for navigation
    refetchOnWindowFocus: true,                 // Industry standard: refresh when user returns
    refetchOnMount: 'always',                   // Always check freshness for details
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
          staleTime: `${CACHE_TTL.ENTITY_DETAIL_STALE / 1000}s`,
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

  // ✅ INDUSTRY STANDARD: Use getState() for imperative store access
  // This prevents subscription-based re-renders from store changes

  // v6.0.0: React Query is sole data cache - only invalidate RQ + metadata stores
  const invalidateAllCaches = useCallback((id?: string) => {
    // React Query invalidation (sole data cache)
    if (id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });
    }
    queryClient.invalidateQueries({ queryKey: ['entity-instance-list', entityCode] });

    // Only invalidate metadata store (not data stores - they're removed)
    useEntityComponentMetadataStore.getState().invalidateEntity(entityCode);
  }, [queryClient, entityCode]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const api = APIFactory.getAPI(entityCode);
      return api.update(id, data);
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });
      await queryClient.cancelQueries({ queryKey: ['entity-instance-list', entityCode] });

      // Snapshot previous values from normalized cache and React Query
      const previousNormalized = getNormalizedEntity(queryClient, entityCode, id);
      const previousRQData = queryClient.getQueryData(queryKeys.entityInstance(entityCode, id));

      // v6.1.0: Optimistically update normalized cache (reflects in ALL views)
      updateNormalizedEntity(queryClient, entityCode, id, data);

      // Also update React Query cache for immediate UI feedback
      queryClient.setQueryData(
        queryKeys.entityInstance(entityCode, id),
        (old: EntityInstanceResult | undefined) => old ? {
          ...old,
          data: { ...old.data, ...data },
        } : old
      );

      return { previousNormalized, previousRQData };
    },
    onError: (_error, { id }, context) => {
      // Rollback normalized cache
      if (context?.previousNormalized) {
        updateNormalizedEntity(queryClient, entityCode, id, context.previousNormalized);
      }
      // Rollback React Query cache
      if (context?.previousRQData) {
        queryClient.setQueryData(queryKeys.entityInstance(entityCode, id), context.previousRQData);
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Invalidate caches to refetch fresh data
      invalidateAllCaches(id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const api = APIFactory.getAPI(entityCode);
      return api.delete(id);
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['entity-instance-list', entityCode] });

      // Snapshot for rollback
      const previousEntity = getNormalizedEntity(queryClient, entityCode, id);

      // v6.1.0: Optimistically remove from normalized cache
      removeNormalizedEntity(queryClient, entityCode, id);

      return { previousEntity };
    },
    onError: (_error, id, context) => {
      // Rollback: re-add the entity
      if (context?.previousEntity) {
        addNormalizedEntity(queryClient, entityCode, context.previousEntity);
      }
    },
    onSettled: (_data, _error, id) => {
      // Invalidate caches after delete
      invalidateAllCaches(id);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const api = APIFactory.getAPI(entityCode);
      return api.create(data);
    },
    onSuccess: (response) => {
      // v6.1.0: Add new entity to normalized cache
      if (response && response.id) {
        addNormalizedEntity(queryClient, entityCode, response);
      }
    },
    onSettled: () => {
      // Invalidate list caches after create
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
      console.log(`%c[API FETCH] 🔄 Fetching entity-instance-lookup: ${entityCode}`, 'color: #ff6b6b');

      const response = await fetch(
        `${apiUrl}/api/v1/entity/${entityCode}/entity-instance-lookup?active_only=true&limit=500`,
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

      console.log(`%c[API FETCH] ✅ Received entity-instance-lookup ${entityCode}`, 'color: #51cf66', {
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
          pageSize: params?.pageSize || 100,
          hasMore: (response.data?.length || 0) === (params?.pageSize || 100),
        };
      },
      staleTime: CACHE_TTL.ENTITY_LIST_STALE,
    });
  }, [queryClient]);

  return { prefetchEntity, prefetchList };
}
