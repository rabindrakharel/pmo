// ============================================================================
// Unified Cache Hooks
// ============================================================================
// 7 hooks for the 7-store unified cache architecture
// Naming: use{StoreName}
// ============================================================================

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { STORE_CONFIG, SESSION_STORES } from '../cache/constants';
import { QUERY_KEYS, DEXIE_KEYS, createQueryHash } from '../cache/keys';
import {
  globalSettingsStore,
  datalabelStore,
  entityCodesStore,
  entityInstanceNamesStore,
  entityLinksStore,
  entityInstanceMetadataStore,
  type EntityCode,
  type DatalabelOption,
  type ViewFieldMetadata,
  type EditFieldMetadata,
} from '../cache/stores';
import { db } from '../persistence/schema';
import * as ops from '../persistence/operations';
import { wsManager } from '../realtime/manager';
import { apiClient } from '../../lib/api';

// ============================================================================
// 1. useGlobalSettings
// ============================================================================

export interface UseGlobalSettingsResult {
  settings: Record<string, unknown> | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  getSetting: <T>(key: string) => T | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching global application settings
 * Session-level store: prefetched at login
 */
export function useGlobalSettings(): UseGlobalSettingsResult {
  const query = useQuery({
    queryKey: QUERY_KEYS.globalSettings,
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/setting');
      const settings = response.data?.data || response.data || {};

      // Persist to Dexie
      await ops.setGlobalSettings(settings);

      // Update sync store
      globalSettingsStore.set(settings);

      return settings;
    },
    staleTime: STORE_CONFIG.globalSettings.staleTime,
    gcTime: STORE_CONFIG.globalSettings.gcTime,
  });

  // Update sync store when data changes
  useMemo(() => {
    if (query.data) {
      globalSettingsStore.set(query.data);
    }
  }, [query.data]);

  const getSetting = useCallback(
    <T,>(key: string): T | null => {
      return (query.data?.[key] as T) ?? null;
    },
    [query.data]
  );

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getSetting,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// 2. useDatalabel
// ============================================================================

export interface UseDatalabelResult {
  options: DatalabelOption[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  getOption: (id: number) => DatalabelOption | undefined;
  getLabel: (id: number) => string;
  getColor: (id: number) => string | undefined;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching datalabel options
 * Session-level store: prefetched at login
 *
 * @param datalabelKey - Key like 'project_stage' or 'dl__project_stage'
 */
export function useDatalabel(datalabelKey: string | null): UseDatalabelResult {
  const normalizedKey = useMemo(() => {
    if (!datalabelKey) return null;
    return DEXIE_KEYS.datalabel(datalabelKey);
  }, [datalabelKey]);

  const query = useQuery({
    queryKey: normalizedKey ? QUERY_KEYS.datalabel(normalizedKey) : ['datalabel', null],
    queryFn: async () => {
      if (!normalizedKey) return [];

      const response = await apiClient.get(`/api/v1/datalabel?name=${normalizedKey}`);
      const options = response.data?.data || response.data || [];

      // Persist to Dexie
      await ops.setDatalabel(normalizedKey, options);

      // Update sync store
      datalabelStore.set(normalizedKey, options);

      return options as DatalabelOption[];
    },
    enabled: !!normalizedKey,
    staleTime: STORE_CONFIG.datalabel.staleTime,
    gcTime: STORE_CONFIG.datalabel.gcTime,
  });

  // Update sync store when data changes
  useMemo(() => {
    if (query.data && normalizedKey) {
      datalabelStore.set(normalizedKey, query.data);
    }
  }, [query.data, normalizedKey]);

  const getOption = useCallback(
    (id: number): DatalabelOption | undefined => {
      return query.data?.find((o) => o.id === id);
    },
    [query.data]
  );

  const getLabel = useCallback(
    (id: number): string => {
      const option = query.data?.find((o) => o.id === id);
      return option?.name ?? String(id);
    },
    [query.data]
  );

  const getColor = useCallback(
    (id: number): string | undefined => {
      const option = query.data?.find((o) => o.id === id);
      return option?.color_code;
    },
    [query.data]
  );

  return {
    options: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getOption,
    getLabel,
    getColor,
    refetch: async () => {
      await query.refetch();
    },
  };
}

/**
 * Hook for fetching all datalabels at once
 */
export function useAllDatalabels(): {
  datalabels: Record<string, DatalabelOption[]>;
  isLoading: boolean;
  getDatalabel: (key: string) => DatalabelOption[] | null;
  refetch: () => Promise<void>;
} {
  const query = useQuery({
    queryKey: QUERY_KEYS.datalabelAll,
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/datalabel/all');
      const datalabelList = response.data?.data || [];

      const result: Record<string, DatalabelOption[]> = {};

      for (const dl of datalabelList) {
        const key = dl.name;
        const options = dl.options || [];
        result[key] = options;

        // Persist to Dexie
        await ops.setDatalabel(key, options);

        // Update sync store
        datalabelStore.set(key, options);
      }

      return result;
    },
    staleTime: STORE_CONFIG.datalabel.staleTime,
    gcTime: STORE_CONFIG.datalabel.gcTime,
  });

  const getDatalabel = useCallback(
    (key: string): DatalabelOption[] | null => {
      const normalizedKey = DEXIE_KEYS.datalabel(key);
      return query.data?.[normalizedKey] ?? null;
    },
    [query.data]
  );

  return {
    datalabels: query.data ?? {},
    isLoading: query.isLoading,
    getDatalabel,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// 3. useEntityCodes
// ============================================================================

export interface UseEntityCodesResult {
  entityCodes: EntityCode[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  getByCode: (code: string) => EntityCode | undefined;
  getChildCodes: (code: string) => string[];
  getLabel: (code: string) => string;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching entity type definitions
 * Session-level store: prefetched at login
 */
export function useEntityCodes(): UseEntityCodesResult {
  const query = useQuery({
    queryKey: QUERY_KEYS.entityCodes,
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/entity/types');
      const codes = response.data?.data || response.data || [];

      // Persist to Dexie
      await ops.setEntityCodes(codes);

      // Update sync store
      entityCodesStore.set(codes);

      return codes as EntityCode[];
    },
    staleTime: STORE_CONFIG.entityCodes.staleTime,
    gcTime: STORE_CONFIG.entityCodes.gcTime,
  });

  // Update sync store when data changes
  useMemo(() => {
    if (query.data) {
      entityCodesStore.set(query.data);
    }
  }, [query.data]);

  const getByCode = useCallback(
    (code: string): EntityCode | undefined => {
      return query.data?.find((e) => e.code === code);
    },
    [query.data]
  );

  const getChildCodes = useCallback(
    (code: string): string[] => {
      return query.data?.find((e) => e.code === code)?.child_entity_codes ?? [];
    },
    [query.data]
  );

  const getLabel = useCallback(
    (code: string): string => {
      return query.data?.find((e) => e.code === code)?.ui_label ?? code;
    },
    [query.data]
  );

  return {
    entityCodes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getByCode,
    getChildCodes,
    getLabel,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// 4. useEntityInstanceNames
// ============================================================================

export interface UseEntityInstanceNamesResult {
  names: Record<string, string>;
  isLoading: boolean;
  getName: (entityInstanceId: string) => string | undefined;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching entity instance name lookups for a specific type
 * Session-level store: prefetched at login
 *
 * @param entityCode - Entity type code (e.g., 'project')
 */
export function useEntityInstanceNames(entityCode: string): UseEntityInstanceNamesResult {
  const query = useQuery({
    queryKey: QUERY_KEYS.entityInstanceNames(entityCode),
    queryFn: async () => {
      // First try sync store
      const cached = entityInstanceNamesStore.getNames(entityCode);
      if (Object.keys(cached).length > 0) {
        return cached;
      }

      // Then try Dexie
      const dexieNames = await ops.getEntityInstanceNamesForType(entityCode);
      if (Object.keys(dexieNames).length > 0) {
        entityInstanceNamesStore.set(entityCode, dexieNames);
        return dexieNames;
      }

      // Fall back to API
      const response = await apiClient.get(`/api/v1/${entityCode}?limit=1000`);
      const items = response.data?.data || [];
      const names: Record<string, string> = {};

      for (const item of items) {
        if (item.id && item.name) {
          names[item.id] = item.name;
        }
      }

      // Persist to Dexie
      await ops.setEntityInstanceNames(entityCode, names);

      // Update sync store
      entityInstanceNamesStore.set(entityCode, names);

      return names;
    },
    staleTime: STORE_CONFIG.entityInstanceNames.staleTime,
    gcTime: STORE_CONFIG.entityInstanceNames.gcTime,
  });

  const getName = useCallback(
    (entityInstanceId: string): string | undefined => {
      return query.data?.[entityInstanceId];
    },
    [query.data]
  );

  return {
    names: query.data ?? {},
    isLoading: query.isLoading,
    getName,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// 5. useEntityLinks
// ============================================================================

export interface UseEntityLinksResult {
  isLoading: boolean;
  getChildIds: (parentCode: string, parentId: string, childCode: string) => string[];
  getParents: (childCode: string, childId: string) => Array<{
    entityCode: string;
    entityInstanceId: string;
    relationshipType: string;
  }>;
  getTabCounts: (parentCode: string, parentId: string) => Record<string, number>;
}

/**
 * Hook for entity link graph (parent-child relationships)
 * Session-level store: prefetched at login
 */
export function useEntityLinks(): UseEntityLinksResult {
  const { entityCodes } = useEntityCodes();

  const query = useQuery({
    queryKey: QUERY_KEYS.entityLinks,
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/linkage/all');
      const links = response.data?.data || [];

      // Build forward index
      const forwardMap = new Map<string, { childIds: string[]; relationships: Record<string, string> }>();

      for (const link of links) {
        const key = DEXIE_KEYS.entityLinkForward(
          link.entity_code,
          link.entity_instance_id,
          link.child_entity_code
        );
        const existing = forwardMap.get(key) || { childIds: [], relationships: {} };
        existing.childIds.push(link.child_entity_instance_id);
        existing.relationships[link.child_entity_instance_id] = link.relationship_type || 'contains';
        forwardMap.set(key, existing);
      }

      // Persist to Dexie and sync store
      for (const [key, value] of forwardMap) {
        const [parentCode, parentId, childCode] = key.split(':');
        await ops.setEntityLink(parentCode, parentId, childCode, value.childIds, value.relationships);
        entityLinksStore.setForward(parentCode, parentId, childCode, {
          parentCode,
          parentId,
          childCode,
          ...value,
        });
      }

      return true;
    },
    staleTime: STORE_CONFIG.entityLinks.staleTime,
    gcTime: STORE_CONFIG.entityLinks.gcTime,
  });

  const getChildIds = useCallback(
    (parentCode: string, parentId: string, childCode: string): string[] => {
      return entityLinksStore.getChildIds(parentCode, parentId, childCode);
    },
    []
  );

  const getParents = useCallback(
    (childCode: string, childId: string) => {
      return entityLinksStore.getParents(childCode, childId);
    },
    []
  );

  const getTabCounts = useCallback(
    (parentCode: string, parentId: string): Record<string, number> => {
      const childCodes = entityCodesStore.getChildCodes(parentCode);
      return entityLinksStore.getTabCounts(parentCode, parentId, childCodes);
    },
    []
  );

  return {
    isLoading: query.isLoading,
    getChildIds,
    getParents,
    getTabCounts,
  };
}

// ============================================================================
// 6. useEntityInstanceMetadata
// ============================================================================

export interface UseEntityInstanceMetadataResult {
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching entity field metadata
 * Session-level store: uses content=metadata API
 *
 * @param entityCode - Entity type code (e.g., 'project')
 */
export function useEntityInstanceMetadata(entityCode: string): UseEntityInstanceMetadataResult {
  const query = useQuery({
    queryKey: QUERY_KEYS.entityInstanceMetadata(entityCode),
    queryFn: async () => {
      // Try Dexie cache first
      const cached = await ops.getEntityInstanceMetadata(entityCode);
      if (cached && Date.now() - (await db.entityInstanceMetadata.get(entityCode))!.syncedAt < STORE_CONFIG.entityInstanceMetadata.staleTime) {
        entityInstanceMetadataStore.set(entityCode, cached);
        return cached;
      }

      // Fetch metadata-only from API
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { content: 'metadata' },
      });

      const metadata = response.data.metadata?.entityListOfInstancesTable;
      const fields = response.data.fields || [];

      const record = {
        fields: fields.length > 0 ? fields : Object.keys(metadata?.viewType || {}),
        viewType: metadata?.viewType || {},
        editType: metadata?.editType || {},
      };

      // Persist to Dexie
      await ops.setEntityInstanceMetadata(entityCode, record);

      // Update sync store
      entityInstanceMetadataStore.set(entityCode, record);

      return record;
    },
    staleTime: STORE_CONFIG.entityInstanceMetadata.staleTime,
    gcTime: STORE_CONFIG.entityInstanceMetadata.gcTime,
  });

  return {
    fields: query.data?.fields ?? [],
    viewType: query.data?.viewType ?? {},
    editType: query.data?.editType ?? {},
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// 7. useEntityInstanceData
// ============================================================================

export interface UseEntityInstanceDataParams {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface UseEntityInstanceDataResult<T> {
  data: T[] | undefined;
  total: number;
  limit: number;
  offset: number;
  metadata: Record<string, unknown> | undefined;
  refData: Record<string, Record<string, string>> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isStale: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching entity instance data (list queries)
 * On-demand store: fetched when needed, not prefetched
 *
 * @param entityCode - Entity type code (e.g., 'project')
 * @param params - Query parameters (pagination, filters, etc.)
 * @param options - Query options
 */
export function useEntityInstanceData<T = Record<string, unknown>>(
  entityCode: string,
  params: UseEntityInstanceDataParams = {},
  options: { enabled?: boolean; staleTime?: number } = {}
): UseEntityInstanceDataResult<T> {
  const { enabled = true, staleTime = STORE_CONFIG.entityInstanceData.staleTime } = options;

  // Pre-subscribe to entity type for WebSocket updates
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

  const query = useQuery({
    queryKey: QUERY_KEYS.entityInstanceData(entityCode, params),
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/${entityCode}`, { params });
      const apiData = response.data;
      const items = apiData.data || [];
      const now = Date.now();

      // Store metadata once per entity type
      if (apiData.metadata?.entityListOfInstancesTable) {
        const metadataTable = apiData.metadata.entityListOfInstancesTable;
        await ops.setEntityInstanceMetadata(entityCode, {
          fields: Object.keys(metadataTable.viewType || {}),
          viewType: metadataTable.viewType || {},
          editType: metadataTable.editType || {},
        });
        entityInstanceMetadataStore.set(entityCode, {
          fields: Object.keys(metadataTable.viewType || {}),
          viewType: metadataTable.viewType || {},
          editType: metadataTable.editType || {},
        });
      }

      // Persist entity instance names from ref_data_entityInstance
      if (apiData.ref_data_entityInstance) {
        await ops.mergeEntityInstanceNames(apiData.ref_data_entityInstance);
        entityInstanceNamesStore.mergeAll(apiData.ref_data_entityInstance);
      }

      // Persist list query result
      await ops.setEntityInstanceData(entityCode, params, items, apiData.total || items.length);

      return {
        data: items as T[],
        total: apiData.total || items.length,
        limit: apiData.limit || params.limit || 20,
        offset: apiData.offset || params.offset || 0,
        metadata: apiData.metadata,
        ref_data_entityInstance: apiData.ref_data_entityInstance,
      };
    },
    enabled,
    staleTime,
    gcTime: STORE_CONFIG.entityInstanceData.gcTime,
    placeholderData: (previousData) => previousData,
  });

  // Auto-subscribe to loaded entity IDs
  useEffect(() => {
    if (query.data?.data) {
      const entityIds = (query.data.data as Array<{ id: string }>).map((d) => d.id).filter(Boolean);
      if (entityIds.length > 0) {
        wsManager.subscribe(entityCode, entityIds);
      }
    }
  }, [entityCode, query.data]);

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
    refetch: async () => {
      await query.refetch();
    },
  };
}

/**
 * Hook for infinite scrolling entity lists
 */
export function useEntityInstanceDataInfinite<T = Record<string, unknown>>(
  entityCode: string,
  params: Omit<UseEntityInstanceDataParams, 'offset'> = {},
  options: { enabled?: boolean; staleTime?: number } = {}
): {
  data: T[] | undefined;
  total: number;
  metadata: Record<string, unknown> | undefined;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isError: boolean;
  error: Error | null;
  fetchNextPage: () => Promise<void>;
  refetch: () => Promise<void>;
} {
  const { enabled = true, staleTime = STORE_CONFIG.entityInstanceData.staleTime } = options;
  const limit = params.limit || 20;

  // Pre-subscribe
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

  const query = useInfiniteQuery({
    queryKey: QUERY_KEYS.entityInstanceDataInfinite(entityCode, params),
    queryFn: async ({ pageParam = 0 }) => {
      const response = await apiClient.get(`/api/v1/${entityCode}`, {
        params: { ...params, limit, offset: pageParam },
      });
      const apiData = response.data;

      // Store metadata (first page only)
      if (apiData.metadata?.entityListOfInstancesTable && pageParam === 0) {
        const metadataTable = apiData.metadata.entityListOfInstancesTable;
        await ops.setEntityInstanceMetadata(entityCode, {
          fields: Object.keys(metadataTable.viewType || {}),
          viewType: metadataTable.viewType || {},
          editType: metadataTable.editType || {},
        });
      }

      // Persist entity instance names
      if (apiData.ref_data_entityInstance) {
        await ops.mergeEntityInstanceNames(apiData.ref_data_entityInstance);
        entityInstanceNamesStore.mergeAll(apiData.ref_data_entityInstance);
      }

      return {
        data: apiData.data || [],
        total: apiData.total || 0,
        limit: apiData.limit || limit,
        offset: pageParam as number,
        metadata: apiData.metadata,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled,
    staleTime,
    gcTime: STORE_CONFIG.entityInstanceData.gcTime,
  });

  const flatData = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.data) ?? [];
  }, [query.data]);

  const metadata = query.data?.pages[0]?.metadata;
  const total = query.data?.pages[0]?.total ?? 0;

  // Auto-subscribe to loaded entity IDs
  useEffect(() => {
    if (flatData.length > 0) {
      const entityIds = (flatData as Array<{ id: string }>).map((d) => d.id).filter(Boolean);
      wsManager.subscribe(entityCode, entityIds);
    }
  }, [entityCode, flatData]);

  return {
    data: flatData as T[],
    total,
    metadata,
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

// ============================================================================
// PREFETCH FUNCTIONS
// ============================================================================

/**
 * Prefetch all session-level stores at login
 */
export async function prefetchSessionStores(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  console.log('%c[Cache] Prefetching session stores...', 'color: #74c0fc');

  await Promise.all([
    // Global settings
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.globalSettings,
      queryFn: async () => {
        const response = await apiClient.get('/api/v1/setting');
        const settings = response.data?.data || response.data || {};
        await ops.setGlobalSettings(settings);
        globalSettingsStore.set(settings);
        return settings;
      },
    }),

    // All datalabels
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.datalabelAll,
      queryFn: async () => {
        const response = await apiClient.get('/api/v1/datalabel/all');
        const datalabelList = response.data?.data || [];
        const result: Record<string, DatalabelOption[]> = {};
        for (const dl of datalabelList) {
          result[dl.name] = dl.options || [];
          await ops.setDatalabel(dl.name, dl.options || []);
          datalabelStore.set(dl.name, dl.options || []);
        }
        return result;
      },
    }),

    // Entity codes
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.entityCodes,
      queryFn: async () => {
        const response = await apiClient.get('/api/v1/entity/types');
        const codes = response.data?.data || response.data || [];
        await ops.setEntityCodes(codes);
        entityCodesStore.set(codes);
        return codes;
      },
    }),

    // Entity links
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.entityLinks,
      queryFn: async () => {
        const response = await apiClient.get('/api/v1/linkage/all');
        const links = response.data?.data || [];
        const forwardMap = new Map<string, { childIds: string[]; relationships: Record<string, string> }>();
        for (const link of links) {
          const key = DEXIE_KEYS.entityLinkForward(link.entity_code, link.entity_instance_id, link.child_entity_code);
          const existing = forwardMap.get(key) || { childIds: [], relationships: {} };
          existing.childIds.push(link.child_entity_instance_id);
          existing.relationships[link.child_entity_instance_id] = link.relationship_type || 'contains';
          forwardMap.set(key, existing);
        }
        for (const [key, value] of forwardMap) {
          const [parentCode, parentId, childCode] = key.split(':');
          await ops.setEntityLink(parentCode, parentId, childCode, value.childIds, value.relationships);
          entityLinksStore.setForward(parentCode, parentId, childCode, { parentCode, parentId, childCode, ...value });
        }
        return true;
      },
    }),
  ]);

  console.log('%c[Cache] Session stores prefetched', 'color: #51cf66; font-weight: bold');
}
