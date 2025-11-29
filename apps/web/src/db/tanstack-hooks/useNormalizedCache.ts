// ============================================================================
// 4-Layer Normalized Cache Hooks
// ============================================================================
// TanStack Query hooks for the 4-layer normalized cache architecture:
// Layer 1: Entity Types (useEntityTypes)
// Layer 2: Entity Instances (useEntityInstances)
// Layer 3: Entity Links (useEntityLinks)
// Layer 4: Entity Instance Names (useEntityInstanceNames)
// ============================================================================

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  db,
  createEntityInstanceKey,
  createLinkForwardKey,
  createLinkReverseKey,
  createEntityInstanceNameKey,
  buildLinkIndexes,
  type EntityTypeRecord,
  type EntityInstanceRecord,
  type EntityLinkForwardRecord,
  type EntityLinkReverseRecord,
  type EntityLinkRawRecord,
  type EntityInstanceNameRecord,
} from '../dexie/database';
import { queryClient } from '../query/queryClient';

// ============================================================================
// Types
// ============================================================================

export interface EntityType {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  db_table?: string;
  db_model_type?: string;
  child_entity_codes: string[];
  display_order: number;
  domain_code?: string;
  column_metadata?: unknown[];
  active_flag: boolean;
}

export interface EntityInstance {
  entity_code: string;
  entity_instance_id: string;
  entity_instance_name: string;
  code?: string | null;
  order_id?: number;
}

export interface EntityLink {
  id: string;
  entity_code: string;
  entity_instance_id: string;
  child_entity_code: string;
  child_entity_instance_id: string;
  relationship_type: string;
}

// ============================================================================
// Sync Caches (In-Memory for Non-Hook Access)
// ============================================================================

// Layer 1: Entity Types sync cache
const entityTypesCache = new Map<string, EntityType>();
let allEntityTypesCache: EntityType[] | null = null;

// Layer 2: Entity Instances sync cache (grouped by entity_code)
const entityInstancesCache = new Map<string, Map<string, EntityInstance>>();

// Layer 3: Entity Links sync cache
const entityLinksForwardCache = new Map<string, EntityLinkForwardRecord>();
const entityLinksReverseCache = new Map<string, EntityLinkReverseRecord>();

// Layer 4: Entity Instance Names sync cache (grouped by entity_code)
const entityInstanceNamesCache = new Map<string, Record<string, string>>();

// ============================================================================
// LAYER 1: Entity Types
// ============================================================================

/**
 * Query key for entity types
 */
export const ENTITY_TYPES_KEY = ['entity', 'types'];

/**
 * Hook to get all entity types
 * Cached at login, rarely invalidated
 */
export function useEntityTypes(): UseQueryResult<EntityType[]> & {
  getByCode: (code: string) => EntityType | undefined;
  getChildCodes: (code: string) => string[];
} {
  const query = useQuery({
    queryKey: ENTITY_TYPES_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{ data: EntityType[]; syncedAt: number }>(
        '/api/v1/entity/types'
      );
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Update sync cache when data changes
  useMemo(() => {
    if (query.data) {
      allEntityTypesCache = query.data;
      entityTypesCache.clear();
      for (const entity of query.data) {
        entityTypesCache.set(entity.code, entity);
      }
    }
  }, [query.data]);

  const getByCode = useCallback((code: string) => {
    return query.data?.find(e => e.code === code);
  }, [query.data]);

  const getChildCodes = useCallback((code: string) => {
    return query.data?.find(e => e.code === code)?.child_entity_codes ?? [];
  }, [query.data]);

  return {
    ...query,
    getByCode,
    getChildCodes,
  };
}

/**
 * Get entity type by code (sync - for non-hook contexts)
 */
export function getEntityTypeSync(code: string): EntityType | null {
  return entityTypesCache.get(code) ?? null;
}

/**
 * Get all entity types (sync - for non-hook contexts)
 */
export function getAllEntityTypesSync(): EntityType[] | null {
  return allEntityTypesCache;
}

/**
 * Get child entity codes for a parent type (sync)
 */
export function getChildEntityCodesSync(parentCode: string): string[] {
  return entityTypesCache.get(parentCode)?.child_entity_codes ?? [];
}

/**
 * Prefetch entity types at login
 */
export async function prefetchEntityTypes(): Promise<number> {
  console.log('[NormalizedCache] Prefetching entity types...');
  const startTime = Date.now();

  try {
    const response = await apiClient.get<{ data: EntityType[]; syncedAt: number }>(
      '/api/v1/entity/types'
    );

    const entities = response.data;
    const now = Date.now();

    // Update TanStack Query cache
    queryClient.setQueryData(ENTITY_TYPES_KEY, entities);

    // Update sync cache
    allEntityTypesCache = entities;
    entityTypesCache.clear();
    for (const entity of entities) {
      entityTypesCache.set(entity.code, entity);
    }

    // Persist to Dexie
    await db.entityTypes.bulkPut(
      entities.map(entity => ({
        _id: entity.code,
        ...entity,
        syncedAt: now,
      }))
    );

    console.log(
      `[NormalizedCache] Prefetched ${entities.length} entity types in ${Date.now() - startTime}ms`
    );
    return entities.length;
  } catch (error) {
    console.error('[NormalizedCache] Failed to prefetch entity types:', error);
    throw error;
  }
}

// ============================================================================
// LAYER 2: Entity Instances
// ============================================================================

/**
 * Query key for entity instances
 */
export const ENTITY_INSTANCES_KEY = ['entity_instance', 'all'];

/**
 * Hook to get all entity instances (grouped by entity_code)
 */
export function useEntityInstances(): UseQueryResult<Map<string, EntityInstance[]>> & {
  getByCode: (entityCode: string) => EntityInstance[];
  getInstance: (entityCode: string, entityInstanceId: string) => EntityInstance | undefined;
} {
  const query = useQuery({
    queryKey: ENTITY_INSTANCES_KEY,
    queryFn: async () => {
      const response = await apiClient.get<{
        data: EntityInstance[];
        syncedAt: number;
        hasMore: boolean;
      }>('/api/v1/entity-instance/all');

      // Group by entity_code
      const grouped = new Map<string, EntityInstance[]>();
      for (const instance of response.data) {
        if (!grouped.has(instance.entity_code)) {
          grouped.set(instance.entity_code, []);
        }
        grouped.get(instance.entity_code)!.push(instance);
      }

      return grouped;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Update sync cache when data changes
  useMemo(() => {
    if (query.data) {
      entityInstancesCache.clear();
      for (const [entityCode, instances] of query.data.entries()) {
        const instanceMap = new Map<string, EntityInstance>();
        for (const instance of instances) {
          instanceMap.set(instance.entity_instance_id, instance);
        }
        entityInstancesCache.set(entityCode, instanceMap);
      }
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

/**
 * Get entity instances by code (sync)
 */
export function getEntityInstancesSync(entityCode: string): EntityInstance[] {
  const instanceMap = entityInstancesCache.get(entityCode);
  return instanceMap ? Array.from(instanceMap.values()) : [];
}

/**
 * Get single entity instance (sync)
 */
export function getEntityInstanceSync(entityCode: string, entityInstanceId: string): EntityInstance | null {
  return entityInstancesCache.get(entityCode)?.get(entityInstanceId) ?? null;
}

/**
 * Prefetch entity instances at login
 */
export async function prefetchEntityInstances(): Promise<number> {
  console.log('[NormalizedCache] Prefetching entity instances...');
  const startTime = Date.now();

  // Check last sync timestamp
  const syncRecord = await db.metadata.get('entity_instance_last_sync');
  const since = syncRecord?.data as number | undefined;

  try {
    const url = since && since > 0
      ? `/api/v1/entity-instance/all?since=${since}`
      : '/api/v1/entity-instance/all';

    const response = await apiClient.get<{
      data: EntityInstance[];
      syncedAt: number;
      hasMore: boolean;
    }>(url);

    const instances = response.data;
    const now = Date.now();

    // Group by entity_code for TanStack Query cache
    const grouped = new Map<string, EntityInstance[]>();
    for (const instance of instances) {
      if (!grouped.has(instance.entity_code)) {
        grouped.set(instance.entity_code, []);
      }
      grouped.get(instance.entity_code)!.push(instance);
    }

    // Update TanStack Query cache
    queryClient.setQueryData(ENTITY_INSTANCES_KEY, grouped);

    // Update sync cache
    entityInstancesCache.clear();
    for (const [entityCode, entityInstances] of grouped.entries()) {
      const instanceMap = new Map<string, EntityInstance>();
      for (const instance of entityInstances) {
        instanceMap.set(instance.entity_instance_id, instance);
      }
      entityInstancesCache.set(entityCode, instanceMap);
    }

    // Persist to Dexie
    await db.entityInstances.bulkPut(
      instances.map(instance => ({
        _id: createEntityInstanceKey(instance.entity_code, instance.entity_instance_id),
        ...instance,
        syncedAt: now,
      }))
    );

    // Update sync timestamp
    await db.metadata.put({
      _id: 'entity_instance_last_sync',
      type: 'sync',
      key: 'entity_instance_last_sync',
      data: now,
      syncedAt: now,
    });

    console.log(
      `[NormalizedCache] Prefetched ${instances.length} entity instances in ${Date.now() - startTime}ms`
    );
    return instances.length;
  } catch (error) {
    console.error('[NormalizedCache] Failed to prefetch entity instances:', error);
    throw error;
  }
}

// ============================================================================
// LAYER 3: Entity Links
// ============================================================================

/**
 * Query key for entity links
 */
export const ENTITY_LINKS_KEY = ['entity_instance_link', 'all'];

/**
 * Hook to access the link graph (forward index)
 * Use getChildIds for parent → children lookups
 */
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
  const query = useQuery({
    queryKey: ENTITY_LINKS_KEY,
    queryFn: async () => {
      // This query just triggers the fetch - actual data is in Dexie indexes
      return true;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const getChildIds = useCallback((parentCode: string, parentId: string, childCode: string): string[] => {
    const key = createLinkForwardKey(parentCode, parentId, childCode);
    return entityLinksForwardCache.get(key)?.childIds ?? [];
  }, []);

  const getParents = useCallback((childCode: string, childId: string) => {
    const key = createLinkReverseKey(childCode, childId);
    return entityLinksReverseCache.get(key)?.parents ?? [];
  }, []);

  const getTabCounts = useCallback((parentCode: string, parentId: string): Record<string, number> => {
    const counts: Record<string, number> = {};
    const childCodes = getChildEntityCodesSync(parentCode);

    for (const childCode of childCodes) {
      const key = createLinkForwardKey(parentCode, parentId, childCode);
      const forward = entityLinksForwardCache.get(key);
      counts[childCode] = forward?.childIds.length ?? 0;
    }

    return counts;
  }, []);

  return {
    isLoading: query.isLoading,
    getChildIds,
    getParents,
    getTabCounts,
  };
}

/**
 * Get child IDs from link cache (sync)
 * O(1) lookup - no API call
 */
export function getChildIdsSync(parentCode: string, parentId: string, childCode: string): string[] {
  const key = createLinkForwardKey(parentCode, parentId, childCode);
  return entityLinksForwardCache.get(key)?.childIds ?? [];
}

/**
 * Get parents from link cache (sync)
 * O(1) lookup - no API call
 */
export function getParentsSync(childCode: string, childId: string): Array<{
  entity_code: string;
  entity_instance_id: string;
  relationship_type: string;
}> {
  const key = createLinkReverseKey(childCode, childId);
  return entityLinksReverseCache.get(key)?.parents ?? [];
}

/**
 * Prefetch entity links at login and build indexes
 */
export async function prefetchEntityLinks(): Promise<{ raw: number; forward: number; reverse: number }> {
  console.log('[NormalizedCache] Prefetching entity links...');
  const startTime = Date.now();

  // Check last sync timestamp
  const syncRecord = await db.metadata.get('entity_links_last_sync');
  const since = syncRecord?.data as number | undefined;

  try {
    const url = since && since > 0
      ? `/api/v1/entity-instance-link/all?since=${since}`
      : '/api/v1/entity-instance-link/all';

    const response = await apiClient.get<{
      data: EntityLink[];
      syncedAt: number;
      hasMore: boolean;
    }>(url);

    const links = response.data;
    const now = Date.now();

    // Store raw links in Dexie
    await db.entityLinksRaw.bulkPut(
      links.map(link => ({
        _id: link.id,
        entity_code: link.entity_code,
        entity_instance_id: link.entity_instance_id,
        child_entity_code: link.child_entity_code,
        child_entity_instance_id: link.child_entity_instance_id,
        relationship_type: link.relationship_type,
        syncedAt: now,
      }))
    );

    // Build forward/reverse indexes in Dexie
    const { forwardCount, reverseCount } = await buildLinkIndexes();

    // Load indexes into sync cache
    const forwardRecords = await db.entityLinksForward.toArray();
    const reverseRecords = await db.entityLinksReverse.toArray();

    entityLinksForwardCache.clear();
    for (const record of forwardRecords) {
      entityLinksForwardCache.set(record._id, record);
    }

    entityLinksReverseCache.clear();
    for (const record of reverseRecords) {
      entityLinksReverseCache.set(record._id, record);
    }

    // Update sync timestamp
    await db.metadata.put({
      _id: 'entity_links_last_sync',
      type: 'sync',
      key: 'entity_links_last_sync',
      data: now,
      syncedAt: now,
    });

    // Mark TanStack Query as fetched
    queryClient.setQueryData(ENTITY_LINKS_KEY, true);

    console.log(
      `[NormalizedCache] Prefetched ${links.length} links, built ${forwardCount} forward + ${reverseCount} reverse indexes in ${Date.now() - startTime}ms`
    );

    return { raw: links.length, forward: forwardCount, reverse: reverseCount };
  } catch (error) {
    console.error('[NormalizedCache] Failed to prefetch entity links:', error);
    throw error;
  }
}

// ============================================================================
// LAYER 4: Entity Instance Names
// ============================================================================

/**
 * Query key for entity instance names (per entity type)
 */
export const ENTITY_INSTANCE_NAMES_KEY = (entityCode: string) => ['entity_instance_name', entityCode];

/**
 * Hook to get entity instance names for a type
 * Returns a map of { uuid: name }
 */
export function useEntityInstanceNames(entityCode: string): UseQueryResult<Record<string, string>> & {
  getName: (entityInstanceId: string) => string | undefined;
} {
  const query = useQuery({
    queryKey: ENTITY_INSTANCE_NAMES_KEY(entityCode),
    queryFn: async () => {
      // First try to get from entityInstances cache
      const instances = getEntityInstancesSync(entityCode);
      if (instances.length > 0) {
        const names: Record<string, string> = {};
        for (const instance of instances) {
          names[instance.entity_instance_id] = instance.entity_instance_name;
        }
        return names;
      }

      // If not available, return empty - will be populated from API responses
      return entityInstanceNamesCache.get(entityCode) ?? {};
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Update sync cache when data changes
  useMemo(() => {
    if (query.data) {
      entityInstanceNamesCache.set(entityCode, query.data);
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

/**
 * Get entity instance name (sync)
 * O(1) lookup
 */
export function getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null {
  return entityInstanceNamesCache.get(entityCode)?.[entityInstanceId] ?? null;
}

/**
 * Get all entity instance names for a type (sync)
 */
export function getEntityInstanceNamesForTypeSync(entityCode: string): Record<string, string> {
  return entityInstanceNamesCache.get(entityCode) ?? {};
}

/**
 * Merge entity_instance_name from API response into cache
 * Call this after every API response that contains entity_instance_name
 *
 * Handles both new format (entity_instance_name) and legacy format (ref_data_entityInstance)
 */
export function mergeEntityInstanceNames(
  data: Record<string, Record<string, string>> | undefined
): void {
  if (!data) return;

  const now = Date.now();

  for (const [entityCode, nameMap] of Object.entries(data)) {
    // Update TanStack Query cache
    queryClient.setQueryData<Record<string, string>>(
      ENTITY_INSTANCE_NAMES_KEY(entityCode),
      (old = {}) => ({ ...old, ...nameMap })
    );

    // Update sync cache
    const existing = entityInstanceNamesCache.get(entityCode) ?? {};
    entityInstanceNamesCache.set(entityCode, { ...existing, ...nameMap });

    // Persist to Dexie (async, don't await)
    const records: EntityInstanceNameRecord[] = Object.entries(nameMap).map(([id, name]) => ({
      _id: createEntityInstanceNameKey(entityCode, id),
      entityCode,
      entityInstanceId: id,
      entityInstanceName: name,
      syncedAt: now,
    }));

    db.entityInstanceNames.bulkPut(records).catch(err => {
      console.error('[NormalizedCache] Failed to persist entity instance names:', err);
    });
  }
}

// ============================================================================
// Derived Queries - The Magic!
// ============================================================================

/**
 * Get filtered entity list - tries cache first, falls back to API
 *
 * Strategy:
 * 1. If cache has data → derive filtered list in O(1)
 * 2. If cache is empty → fall back to API call
 * 3. API response updates cache for future queries
 *
 * Before: GET /api/v1/task?parent_entity_code=project&parent_entity_instance_id=123
 * After: Derive from cache in O(1), or API if cache miss
 */
export function useNormalizedEntityList<T = EntityInstance>(
  entityCode: string,
  options: {
    parentEntityCode?: string;
    parentEntityInstanceId?: string;
    limit?: number;
    offset?: number;
    /** Force API call even if cache has data */
    skipCache?: boolean;
  } = {}
): {
  data: T[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  isFromCache: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { parentEntityCode, parentEntityInstanceId, limit = 100, offset = 0, skipCache = false } = options;
  const hasParentFilter = !!(parentEntityCode && parentEntityInstanceId);

  const { data: instances, isLoading: instancesLoading } = useEntityInstances();
  const { isLoading: linksLoading } = useEntityLinks();

  // Check if we can derive from cache
  const cacheResult = useMemo(() => {
    if (skipCache || instancesLoading || linksLoading || !instances) {
      return null; // Cache not ready
    }

    const allInstances = instances.get(entityCode) ?? [];

    // If no instances in cache for this type, we need to fetch
    if (allInstances.length === 0) {
      return null; // Cache miss - need API
    }

    if (!hasParentFilter) {
      // No parent filter - return all instances of this type
      return {
        data: allInstances.slice(offset, offset + limit) as T[],
        total: allInstances.length,
      };
    }

    // Get child IDs from link graph
    const childIds = getChildIdsSync(parentEntityCode!, parentEntityInstanceId!, entityCode);

    // Check if link graph is populated for this parent
    const linkKey = `${parentEntityCode}:${parentEntityInstanceId}:${entityCode}`;
    const hasLinkData = entityLinksForwardCache.has(linkKey);

    if (!hasLinkData) {
      // Link graph not populated for this parent - need API
      return null;
    }

    // Derive filtered list from cache
    const childIdSet = new Set(childIds);
    const filtered = allInstances.filter(i => childIdSet.has(i.entity_instance_id));
    const paginated = filtered.slice(offset, offset + limit);

    return {
      data: paginated as T[],
      total: filtered.length,
    };
  }, [entityCode, parentEntityCode, parentEntityInstanceId, instances, instancesLoading, linksLoading, limit, offset, hasParentFilter, skipCache]);

  // API fallback query - only runs when cache misses
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

      // Merge entity instance names into cache (handles both key names)
      const refData = response.entity_instance_name || response.ref_data_entityInstance;
      if (refData) {
        mergeEntityInstanceNames(refData);
      }

      // Update entity instances cache with returned data
      const now = Date.now();
      for (const entity of response.data as any[]) {
        if (entity.id && entity.name) {
          const instanceKey = createEntityInstanceKey(entityCode, entity.id);
          const instance: EntityInstance = {
            entity_code: entityCode,
            entity_instance_id: entity.id,
            entity_instance_name: entity.name,
            code: entity.code,
          };

          // Update sync cache
          if (!entityInstancesCache.has(entityCode)) {
            entityInstancesCache.set(entityCode, new Map());
          }
          entityInstancesCache.get(entityCode)!.set(entity.id, instance);

          // Persist to Dexie (async)
          db.entityInstances.put({
            _id: instanceKey,
            ...instance,
            syncedAt: now,
          }).catch(() => {});
        }
      }

      // Update link graph if parent filter was used
      if (hasParentFilter && response.data.length > 0) {
        const childIds = (response.data as any[]).map(e => e.id).filter(Boolean);
        const linkKey = createLinkForwardKey(parentEntityCode!, parentEntityInstanceId!, entityCode);

        const forwardRecord: EntityLinkForwardRecord = {
          _id: linkKey,
          parentCode: parentEntityCode!,
          parentId: parentEntityInstanceId!,
          childCode: entityCode,
          childIds,
          relationships: {},
          syncedAt: now,
        };

        entityLinksForwardCache.set(linkKey, forwardRecord);

        // Persist to Dexie (async)
        db.entityLinksForward.put(forwardRecord).catch(() => {});
      }

      return {
        data: response.data,
        total: response.total,
      };
    },
    // Only run API query when cache misses
    enabled: cacheResult === null && !instancesLoading && !linksLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Return cache result if available, otherwise API result
  if (cacheResult !== null) {
    return {
      data: cacheResult.data,
      total: cacheResult.total,
      isLoading: false,
      isFetching: false,
      isFromCache: true,
      error: null,
      refetch: () => {
        // Force refetch by invalidating
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
// Hydration - Load from Dexie on App Start
// ============================================================================

/**
 * Hydrate all 4 cache layers from Dexie
 * Called on app startup before login
 */
export async function hydrateNormalizedCache(): Promise<{
  entityTypes: number;
  entityInstances: number;
  linksForward: number;
  linksReverse: number;
  entityInstanceNames: number;
}> {
  console.log('[NormalizedCache] Hydrating from Dexie...');
  const startTime = Date.now();

  // Layer 1: Entity Types
  const entityTypes = await db.entityTypes.toArray();
  if (entityTypes.length > 0) {
    const types = entityTypes.map(et => ({
      code: et.code,
      name: et.name,
      ui_label: et.ui_label,
      ui_icon: et.ui_icon,
      db_table: et.db_table,
      db_model_type: et.db_model_type,
      child_entity_codes: et.child_entity_codes,
      display_order: et.display_order,
      domain_code: et.domain_code,
      column_metadata: et.column_metadata,
      active_flag: et.active_flag,
    }));
    queryClient.setQueryData(ENTITY_TYPES_KEY, types);
    allEntityTypesCache = types;
    for (const t of types) {
      entityTypesCache.set(t.code, t);
    }
  }

  // Layer 2: Entity Instances
  const entityInstances = await db.entityInstances
    .filter(ei => !ei.isDeleted)
    .toArray();

  if (entityInstances.length > 0) {
    const grouped = new Map<string, EntityInstance[]>();
    for (const ei of entityInstances) {
      if (!grouped.has(ei.entity_code)) {
        grouped.set(ei.entity_code, []);
      }
      grouped.get(ei.entity_code)!.push({
        entity_code: ei.entity_code,
        entity_instance_id: ei.entity_instance_id,
        entity_instance_name: ei.entity_instance_name,
        code: ei.code,
        order_id: ei.order_id,
      });
    }
    queryClient.setQueryData(ENTITY_INSTANCES_KEY, grouped);

    entityInstancesCache.clear();
    for (const [entityCode, instances] of grouped.entries()) {
      const instanceMap = new Map<string, EntityInstance>();
      for (const instance of instances) {
        instanceMap.set(instance.entity_instance_id, instance);
      }
      entityInstancesCache.set(entityCode, instanceMap);
    }
  }

  // Layer 3: Entity Links (forward + reverse)
  const forwardRecords = await db.entityLinksForward.toArray();
  const reverseRecords = await db.entityLinksReverse.toArray();

  entityLinksForwardCache.clear();
  for (const record of forwardRecords) {
    entityLinksForwardCache.set(record._id, record);
  }

  entityLinksReverseCache.clear();
  for (const record of reverseRecords) {
    entityLinksReverseCache.set(record._id, record);
  }

  if (forwardRecords.length > 0) {
    queryClient.setQueryData(ENTITY_LINKS_KEY, true);
  }

  // Layer 4: Entity Instance Names
  const nameRecords = await db.entityInstanceNames.toArray();
  const namesByCode = new Map<string, Record<string, string>>();

  for (const record of nameRecords) {
    if (!namesByCode.has(record.entityCode)) {
      namesByCode.set(record.entityCode, {});
    }
    namesByCode.get(record.entityCode)![record.entityInstanceId] = record.entityInstanceName;
  }

  for (const [entityCode, names] of namesByCode.entries()) {
    queryClient.setQueryData(ENTITY_INSTANCE_NAMES_KEY(entityCode), names);
    entityInstanceNamesCache.set(entityCode, names);
  }

  console.log(
    `[NormalizedCache] Hydrated in ${Date.now() - startTime}ms:`,
    `${entityTypes.length} types,`,
    `${entityInstances.length} instances,`,
    `${forwardRecords.length} forward links,`,
    `${reverseRecords.length} reverse links,`,
    `${nameRecords.length} names`
  );

  return {
    entityTypes: entityTypes.length,
    entityInstances: entityInstances.length,
    linksForward: forwardRecords.length,
    linksReverse: reverseRecords.length,
    entityInstanceNames: nameRecords.length,
  };
}

/**
 * Prefetch all 4 layers at login
 */
export async function prefetchNormalizedCache(): Promise<void> {
  console.log('[NormalizedCache] Prefetching all layers...');
  const startTime = Date.now();

  await Promise.all([
    prefetchEntityTypes(),
    prefetchEntityInstances(),
    prefetchEntityLinks(),
  ]);

  console.log(
    `[NormalizedCache] All layers prefetched in ${Date.now() - startTime}ms`
  );
}

// ============================================================================
// Cache Invalidation
// ============================================================================

/**
 * Clear all normalized cache data
 */
export function clearNormalizedCacheMemory(): void {
  // Clear sync caches
  entityTypesCache.clear();
  allEntityTypesCache = null;
  entityInstancesCache.clear();
  entityLinksForwardCache.clear();
  entityLinksReverseCache.clear();
  entityInstanceNamesCache.clear();

  // Clear TanStack Query cache
  queryClient.removeQueries({ queryKey: ENTITY_TYPES_KEY });
  queryClient.removeQueries({ queryKey: ENTITY_INSTANCES_KEY });
  queryClient.removeQueries({ queryKey: ENTITY_LINKS_KEY });
  queryClient.removeQueries({ queryKey: ['entity_instance_name'] });
}

/**
 * Invalidate entity instance (after CREATE/UPDATE/DELETE)
 */
export function invalidateEntityInstance(entityCode: string, entityInstanceId: string): void {
  // Remove from sync cache
  entityInstancesCache.get(entityCode)?.delete(entityInstanceId);

  // Invalidate TanStack Query
  queryClient.invalidateQueries({ queryKey: ENTITY_INSTANCES_KEY });
}

/**
 * Invalidate link graph (after link CREATE/DELETE)
 */
export function invalidateEntityLinks(): void {
  entityLinksForwardCache.clear();
  entityLinksReverseCache.clear();
  queryClient.invalidateQueries({ queryKey: ENTITY_LINKS_KEY });
}

/**
 * Add link to cache (optimistic update)
 */
export function addLinkToCache(link: EntityLink): void {
  const now = Date.now();

  // Update forward index
  const forwardKey = createLinkForwardKey(
    link.entity_code,
    link.entity_instance_id,
    link.child_entity_code
  );

  const existingForward = entityLinksForwardCache.get(forwardKey);
  if (existingForward) {
    if (!existingForward.childIds.includes(link.child_entity_instance_id)) {
      existingForward.childIds.push(link.child_entity_instance_id);
    }
    existingForward.relationships[link.child_entity_instance_id] = link.relationship_type;
  } else {
    entityLinksForwardCache.set(forwardKey, {
      _id: forwardKey,
      parentCode: link.entity_code,
      parentId: link.entity_instance_id,
      childCode: link.child_entity_code,
      childIds: [link.child_entity_instance_id],
      relationships: { [link.child_entity_instance_id]: link.relationship_type },
      syncedAt: now,
    });
  }

  // Update reverse index
  const reverseKey = createLinkReverseKey(
    link.child_entity_code,
    link.child_entity_instance_id
  );

  const existingReverse = entityLinksReverseCache.get(reverseKey);
  if (existingReverse) {
    const parentExists = existingReverse.parents.some(
      p => p.entity_code === link.entity_code && p.entity_instance_id === link.entity_instance_id
    );
    if (!parentExists) {
      existingReverse.parents.push({
        entity_code: link.entity_code,
        entity_instance_id: link.entity_instance_id,
        relationship_type: link.relationship_type,
      });
    }
  } else {
    entityLinksReverseCache.set(reverseKey, {
      _id: reverseKey,
      childCode: link.child_entity_code,
      childId: link.child_entity_instance_id,
      parents: [{
        entity_code: link.entity_code,
        entity_instance_id: link.entity_instance_id,
        relationship_type: link.relationship_type,
      }],
      syncedAt: now,
    });
  }
}

/**
 * Remove link from cache (optimistic update)
 */
export function removeLinkFromCache(link: EntityLink): void {
  // Update forward index
  const forwardKey = createLinkForwardKey(
    link.entity_code,
    link.entity_instance_id,
    link.child_entity_code
  );

  const existingForward = entityLinksForwardCache.get(forwardKey);
  if (existingForward) {
    existingForward.childIds = existingForward.childIds.filter(
      id => id !== link.child_entity_instance_id
    );
    delete existingForward.relationships[link.child_entity_instance_id];

    if (existingForward.childIds.length === 0) {
      entityLinksForwardCache.delete(forwardKey);
    }
  }

  // Update reverse index
  const reverseKey = createLinkReverseKey(
    link.child_entity_code,
    link.child_entity_instance_id
  );

  const existingReverse = entityLinksReverseCache.get(reverseKey);
  if (existingReverse) {
    existingReverse.parents = existingReverse.parents.filter(
      p => !(p.entity_code === link.entity_code && p.entity_instance_id === link.entity_instance_id)
    );

    if (existingReverse.parents.length === 0) {
      entityLinksReverseCache.delete(reverseKey);
    }
  }
}
