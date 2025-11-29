// ============================================================================
// Normalized Cache Hooks
// ============================================================================
// React hooks that use the appropriate data source adapter based on config
// ============================================================================

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { queryClient } from '../query/queryClient';
import { createEntityInstanceKey, type EntityLinkForwardRecord } from '../dexie/database';

import type { EntityCode, EntityInstance, EntityLink, ListQueryParams } from './types';
import { getCacheConfig, isCacheEnabled, getStaleTime, isLayerEnabledSync } from './config';
import { cacheAdapter, apiAdapter, QUERY_KEYS } from './adapters';
import {
  entityCodesStore,
  entityInstancesStore,
  entityLinksStore,
  entityInstanceNamesStore,
} from './stores';

// ============================================================================
// Adapter Selection
// ============================================================================

/**
 * Get the active adapter based on configuration
 */
function getAdapter() {
  return isCacheEnabled() ? cacheAdapter : apiAdapter;
}

// ============================================================================
// Layer 1: Entity Codes Hook
// ============================================================================

export function useEntityCodes(): UseQueryResult<EntityCode[]> & {
  getEntityByCode: (code: string) => EntityCode | undefined;
  getChildCodes: (code: string) => string[];
} {
  const query = useQuery({
    queryKey: QUERY_KEYS.ENTITY_CODES,
    queryFn: async () => {
      const adapter = getAdapter();
      const result = await adapter.fetchEntityCodes();
      return result.data;
    },
    staleTime: getStaleTime('entityCodes'),
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Update sync store when data changes
  useMemo(() => {
    if (query.data) {
      entityCodesStore.set(query.data);
    }
  }, [query.data]);

  const getEntityByCode = useCallback((code: string) => {
    return query.data?.find(e => e.code === code);
  }, [query.data]);

  const getChildCodes = useCallback((code: string) => {
    return query.data?.find(e => e.code === code)?.child_entity_codes ?? [];
  }, [query.data]);

  return {
    ...query,
    getEntityByCode,
    getChildCodes,
  };
}

// ============================================================================
// Layer 2: Entity Instances Hook
// ============================================================================

export function useEntityInstances(): UseQueryResult<Map<string, EntityInstance[]>> & {
  getByCode: (entityCode: string) => EntityInstance[];
  getInstance: (entityCode: string, entityInstanceId: string) => EntityInstance | undefined;
} {
  const isEnabled = isLayerEnabledSync('entityInstances');

  const query = useQuery({
    queryKey: QUERY_KEYS.ENTITY_INSTANCES,
    queryFn: async () => {
      const adapter = getAdapter();
      await adapter.fetchEntityInstances();

      // Return grouped map from store
      const grouped = new Map<string, EntityInstance[]>();
      const allCodes = entityCodesStore.getAll() ?? [];

      for (const entityCode of allCodes) {
        const instances = entityInstancesStore.getByCode(entityCode.code);
        if (instances.length > 0) {
          grouped.set(entityCode.code, instances);
        }
      }

      return grouped;
    },
    enabled: isEnabled,
    staleTime: getStaleTime('entityInstances'),
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Update sync store when data changes
  useMemo(() => {
    if (query.data) {
      entityInstancesStore.setGrouped(query.data);
    }
  }, [query.data]);

  const getByCode = useCallback((entityCode: string): EntityInstance[] => {
    return query.data?.get(entityCode) ?? [];
  }, [query.data]);

  const getInstance = useCallback((entityCode: string, entityInstanceId: string): EntityInstance | undefined => {
    return query.data?.get(entityCode)?.find(i => i.entity_instance_id === entityInstanceId);
  }, [query.data]);

  return {
    ...query,
    getByCode,
    getInstance,
  };
}

// ============================================================================
// Layer 3: Entity Links Hook
// ============================================================================

export function useEntityLinks(): {
  isLoading: boolean;
  getChildIds: (parentCode: string, parentId: string, childCode: string) => string[];
  getParents: (childCode: string, childId: string) => Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
  getTabCounts: (parentCode: string, parentId: string) => Record<string, number>;
} {
  const isEnabled = isLayerEnabledSync('entityLinks');

  const query = useQuery({
    queryKey: QUERY_KEYS.ENTITY_LINKS,
    queryFn: async () => {
      const adapter = getAdapter();
      await adapter.fetchEntityLinks();
      return true;
    },
    enabled: isEnabled,
    staleTime: getStaleTime('entityLinks'),
    gcTime: 30 * 60 * 1000,
  });

  const getChildIds = useCallback((parentCode: string, parentId: string, childCode: string): string[] => {
    return entityLinksStore.getChildIds(parentCode, parentId, childCode);
  }, []);

  const getParents = useCallback((childCode: string, childId: string) => {
    return entityLinksStore.getParents(childCode, childId);
  }, []);

  const getTabCounts = useCallback((parentCode: string, parentId: string): Record<string, number> => {
    return entityLinksStore.getTabCounts(parentCode, parentId, (code) =>
      entityCodesStore.getChildCodes(code)
    );
  }, []);

  return {
    isLoading: query.isLoading,
    getChildIds,
    getParents,
    getTabCounts,
  };
}

// ============================================================================
// Layer 4: Entity Instance Names Hook
// ============================================================================

export function useEntityInstanceNames(entityCode: string): UseQueryResult<Record<string, string>> & {
  getName: (entityInstanceId: string) => string | undefined;
} {
  const isEnabled = isLayerEnabledSync('entityInstanceNames');

  const query = useQuery({
    queryKey: QUERY_KEYS.ENTITY_INSTANCE_NAMES(entityCode),
    queryFn: async () => {
      // First try to get from entityInstances store
      const instances = entityInstancesStore.getByCode(entityCode);
      if (instances.length > 0) {
        const names: Record<string, string> = {};
        for (const instance of instances) {
          names[instance.entity_instance_id] = instance.entity_instance_name;
        }
        return names;
      }

      // Otherwise return from names store
      return entityInstanceNamesStore.getNames(entityCode);
    },
    enabled: isEnabled,
    staleTime: getStaleTime('entityInstanceNames'),
    gcTime: 30 * 60 * 1000,
  });

  // Update sync store when data changes
  useMemo(() => {
    if (query.data) {
      entityInstanceNamesStore.set(entityCode, query.data);
    }
  }, [entityCode, query.data]);

  const getName = useCallback((entityInstanceId: string): string | undefined => {
    return query.data?.[entityInstanceId];
  }, [query.data]);

  return {
    ...query,
    getName,
  };
}

// ============================================================================
// Derived Query: Normalized Entity List
// ============================================================================

export interface NormalizedEntityListOptions extends ListQueryParams {
  /** Force API call even if cache has data */
  skipCache?: boolean;
}

export interface NormalizedEntityListResult<T> {
  data: T[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  isFromCache: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useNormalizedEntityList<T = EntityInstance>(
  entityCode: string,
  options: NormalizedEntityListOptions = {}
): NormalizedEntityListResult<T> {
  const {
    parentEntityCode,
    parentEntityInstanceId,
    limit = 100,
    offset = 0,
    skipCache = false,
  } = options;

  const hasParentFilter = !!(parentEntityCode && parentEntityInstanceId);
  const cacheEnabled = isCacheEnabled() && !skipCache;

  const { data: instances, isLoading: instancesLoading } = useEntityInstances();
  const { isLoading: linksLoading } = useEntityLinks();

  // Check if we can derive from cache
  const cacheResult = useMemo(() => {
    if (!cacheEnabled || instancesLoading || linksLoading || !instances) {
      return null;
    }

    const allInstances = instances.get(entityCode) ?? [];

    // If no instances in cache for this type, need API
    if (allInstances.length === 0) {
      return null;
    }

    if (!hasParentFilter) {
      // No parent filter - return all instances
      return {
        data: allInstances.slice(offset, offset + limit) as T[],
        total: allInstances.length,
      };
    }

    // Get child IDs from link graph
    const childIds = entityLinksStore.getChildIds(parentEntityCode!, parentEntityInstanceId!, entityCode);

    // Check if link graph is populated for this parent
    const linkKey = entityLinksStore.createForwardKey(parentEntityCode!, parentEntityInstanceId!, entityCode);
    const hasLinkData = entityLinksStore.hasForward(linkKey);

    if (!hasLinkData) {
      return null; // Link graph not populated - need API
    }

    // Derive filtered list from cache
    const childIdSet = new Set(childIds);
    const filtered = allInstances.filter(i => childIdSet.has(i.entity_instance_id));
    const paginated = filtered.slice(offset, offset + limit);

    return {
      data: paginated as T[],
      total: filtered.length,
    };
  }, [entityCode, parentEntityCode, parentEntityInstanceId, instances, instancesLoading, linksLoading, limit, offset, hasParentFilter, cacheEnabled]);

  // API fallback query
  const apiQuery = useQuery({
    queryKey: ['normalized-entity-list', entityCode, parentEntityCode, parentEntityInstanceId, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (parentEntityCode) params.set('parent_entity_code', parentEntityCode);
      if (parentEntityInstanceId) params.set('parent_entity_instance_id', parentEntityInstanceId);

      const response = await apiClient.get<{
        data: T[];
        total: number;
        metadata?: Record<string, unknown>;
        ref_data_entityInstance?: Record<string, Record<string, string>>;
        entity_instance_name?: Record<string, Record<string, string>>;
      }>(`/api/v1/${entityCode}?${params}`);

      // Merge entity instance names
      const refData = response.entity_instance_name || response.ref_data_entityInstance;
      if (refData) {
        const adapter = getAdapter();
        adapter.mergeEntityInstanceNames(refData);
      }

      // Update instances cache
      const now = Date.now();
      for (const entity of response.data as any[]) {
        if (entity.id && entity.name) {
          const instance: EntityInstance = {
            entity_code: entityCode,
            entity_instance_id: entity.id,
            entity_instance_name: entity.name,
            code: entity.code,
          };
          entityInstancesStore.addInstance(instance);
        }
      }

      // Update link graph if parent filter was used
      if (hasParentFilter && response.data.length > 0) {
        const childIds = (response.data as any[]).map(e => e.id).filter(Boolean);
        const linkKey = entityLinksStore.createForwardKey(parentEntityCode!, parentEntityInstanceId!, entityCode);

        const forwardRecord: EntityLinkForwardRecord = {
          _id: linkKey,
          parentCode: parentEntityCode!,
          parentId: parentEntityInstanceId!,
          childCode: entityCode,
          childIds,
          relationships: {},
          syncedAt: now,
        };

        entityLinksStore.setForward(linkKey, forwardRecord);
      }

      return {
        data: response.data,
        total: response.total,
      };
    },
    // Only run when cache misses
    enabled: cacheResult === null && !instancesLoading && !linksLoading,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Return cache result if available
  if (cacheResult !== null) {
    return {
      data: cacheResult.data,
      total: cacheResult.total,
      isLoading: false,
      isFetching: false,
      isFromCache: true,
      error: null,
      refetch: () => {
        queryClient.invalidateQueries({
          queryKey: ['normalized-entity-list', entityCode, parentEntityCode, parentEntityInstanceId],
        });
      },
    };
  }

  return {
    data: (apiQuery.data?.data ?? []) as T[],
    total: apiQuery.data?.total ?? 0,
    isLoading: instancesLoading || linksLoading || apiQuery.isLoading,
    isFetching: apiQuery.isFetching,
    isFromCache: false,
    error: apiQuery.error as Error | null,
    refetch: () => apiQuery.refetch(),
  };
}

// ============================================================================
// Sync Access Functions (Non-Hook)
// ============================================================================

// Layer 1
export function getEntityCodeSync(code: string): EntityCode | null {
  return entityCodesStore.getByCode(code);
}

export function getAllEntityCodesSync(): EntityCode[] | null {
  return entityCodesStore.getAll();
}

export function getChildEntityCodesSync(parentCode: string): string[] {
  return entityCodesStore.getChildCodes(parentCode);
}

// Layer 2
export function getEntityInstancesSync(entityCode: string): EntityInstance[] {
  return entityInstancesStore.getByCode(entityCode);
}

export function getEntityInstanceSync(entityCode: string, entityInstanceId: string): EntityInstance | null {
  return entityInstancesStore.getInstance(entityCode, entityInstanceId);
}

// Layer 3
export function getChildIdsSync(parentCode: string, parentId: string, childCode: string): string[] {
  return entityLinksStore.getChildIds(parentCode, parentId, childCode);
}

export function getParentsSync(childCode: string, childId: string): Array<{
  entity_code: string;
  entity_instance_id: string;
  relationship_type: string;
}> {
  return entityLinksStore.getParents(childCode, childId);
}

// Layer 4
export function getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null {
  return entityInstanceNamesStore.getName(entityCode, entityInstanceId);
}

export function getEntityInstanceNamesForTypeSync(entityCode: string): Record<string, string> {
  return entityInstanceNamesStore.getNames(entityCode);
}

export function mergeEntityInstanceNames(data: Record<string, Record<string, string>>): void {
  const adapter = getAdapter();
  adapter.mergeEntityInstanceNames(data);
}

// ============================================================================
// Lifecycle Functions
// ============================================================================

export async function hydrateNormalizedCache(): Promise<void> {
  const adapter = getAdapter();
  await adapter.hydrate();
}

export async function prefetchNormalizedCache(): Promise<void> {
  const adapter = getAdapter();
  await adapter.prefetch();
}

export function clearNormalizedCacheMemory(): void {
  const adapter = getAdapter();
  adapter.clear();
}

// ============================================================================
// Invalidation Functions
// ============================================================================

export function invalidateEntityInstance(entityCode: string, entityInstanceId: string): void {
  const adapter = getAdapter();
  adapter.invalidateEntityInstance(entityCode, entityInstanceId);
}

export function invalidateEntityLinks(): void {
  entityLinksStore.clear();
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ENTITY_LINKS });
}

export function addLinkToCache(link: EntityLink): void {
  const adapter = getAdapter();
  adapter.addLinkToCache(link);
}

export function removeLinkFromCache(link: EntityLink): void {
  const adapter = getAdapter();
  adapter.removeLinkFromCache(link);
}

// ============================================================================
// Prefetch Functions
// ============================================================================

export async function prefetchEntityCodes(): Promise<number> {
  const adapter = getAdapter();
  const result = await adapter.fetchEntityCodes();
  return result.data.length;
}

export async function prefetchEntityInstances(): Promise<number> {
  const adapter = getAdapter();
  const result = await adapter.fetchEntityInstances();
  return result.data.length;
}

export async function prefetchEntityLinks(): Promise<{ raw: number; forward: number; reverse: number }> {
  const adapter = getAdapter();
  const result = await adapter.fetchEntityLinks();
  return {
    raw: result.data.length,
    forward: entityLinksStore.forwardSize(),
    reverse: entityLinksStore.reverseSize(),
  };
}
