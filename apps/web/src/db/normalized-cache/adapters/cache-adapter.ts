// ============================================================================
// Cache Data Source Adapter
// ============================================================================
// Implementation using TanStack Query + Dexie + In-Memory Stores
// Provides cached data access with persistence
// ============================================================================

import { apiClient } from '@/lib/api';
import { queryClient } from '../../query/queryClient';
import {
  db,
  createEntityInstanceKey,
  buildLinkIndexes,
  createEntityInstanceNameKey,
} from '../../dexie/database';
import { BaseDataSourceAdapter } from './base';
import {
  entityCodesStore,
  entityInstancesStore,
  entityLinksStore,
  entityInstanceNamesStore,
  clearAllStores,
} from '../stores';
import type {
  EntityCode,
  EntityInstance,
  EntityLink,
  DataSourceResult,
  CacheConfig,
} from '../types';
import { getCacheConfig } from '../config';

// ============================================================================
// Query Keys
// ============================================================================

export const QUERY_KEYS = {
  ENTITY_CODES: ['entity', 'codes'] as const,
  ENTITY_INSTANCES: ['entity_instance', 'all'] as const,
  ENTITY_LINKS: ['entity_instance_link', 'all'] as const,
  ENTITY_INSTANCE_NAMES: (entityCode: string) => ['entity_instance_name', entityCode] as const,
};

// ============================================================================
// Cache Adapter Implementation
// ============================================================================

export class CacheDataSourceAdapter extends BaseDataSourceAdapter {
  private ready = false;

  constructor(debug = false) {
    super(debug);
  }

  // ========================================
  // Layer 1: Entity Codes
  // ========================================

  async fetchEntityCodes(): Promise<DataSourceResult<EntityCode[]>> {
    const config = getCacheConfig();
    this.log('Fetching entity codes...');

    const response = await apiClient.get<{ data: EntityCode[]; syncedAt: number }>(
      '/api/v1/entity/types'
    );

    // response.data is the axios response body: { data: EntityCode[], syncedAt: number }
    const entities = response.data.data;
    const now = Date.now();

    // Update TanStack Query cache
    queryClient.setQueryData(QUERY_KEYS.ENTITY_CODES, entities);

    // Update sync store
    entityCodesStore.set(entities);

    // Persist to Dexie if enabled
    if (config.persistToIndexedDB) {
      await db.entityTypes.bulkPut(
        entities.map(entity => ({
          _id: entity.code,
          ...entity,
          syncedAt: now,
        }))
      );
    }

    this.log(`Fetched ${entities.length} entity codes`);
    return { data: entities, source: 'api', syncedAt: now };
  }

  getEntityCodeSync(code: string): EntityCode | null {
    return entityCodesStore.getByCode(code);
  }

  getAllEntityCodesSync(): EntityCode[] | null {
    return entityCodesStore.getAll();
  }

  getChildEntityCodesSync(parentCode: string): string[] {
    return entityCodesStore.getChildCodes(parentCode);
  }

  // ========================================
  // Layer 2: Entity Instances
  // ========================================

  async fetchEntityInstances(since?: number): Promise<DataSourceResult<EntityInstance[]>> {
    const config = getCacheConfig();
    this.log('Fetching entity instances...', since ? `since=${since}` : 'full sync');

    const url = since && since > 0 && config.deltaSync
      ? `/api/v1/entity-instance/all?since=${since}`
      : '/api/v1/entity-instance/all';

    const response = await apiClient.get<{
      data: EntityInstance[];
      syncedAt: number;
      hasMore: boolean;
    }>(url);

    // response.data is the axios response body: { data: EntityInstance[], syncedAt, hasMore }
    const instances = response.data.data;
    const now = Date.now();

    // Group by entity_code
    const grouped = new Map<string, EntityInstance[]>();
    for (const instance of instances) {
      if (!grouped.has(instance.entity_code)) {
        grouped.set(instance.entity_code, []);
      }
      grouped.get(instance.entity_code)!.push(instance);
    }

    // Update TanStack Query cache
    queryClient.setQueryData(QUERY_KEYS.ENTITY_INSTANCES, grouped);

    // Update sync store
    entityInstancesStore.setGrouped(grouped);

    // Persist to Dexie if enabled
    if (config.persistToIndexedDB) {
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
    }

    this.log(`Fetched ${instances.length} entity instances`);
    return { data: instances, source: 'api', syncedAt: now };
  }

  getEntityInstancesSync(entityCode: string): EntityInstance[] {
    return entityInstancesStore.getByCode(entityCode);
  }

  getEntityInstanceSync(entityCode: string, entityInstanceId: string): EntityInstance | null {
    return entityInstancesStore.getInstance(entityCode, entityInstanceId);
  }

  // ========================================
  // Layer 3: Entity Links
  // ========================================

  async fetchEntityLinks(since?: number): Promise<DataSourceResult<EntityLink[]>> {
    const config = getCacheConfig();
    this.log('Fetching entity links...', since ? `since=${since}` : 'full sync');

    const url = since && since > 0 && config.deltaSync
      ? `/api/v1/entity-instance-link/all?since=${since}`
      : '/api/v1/entity-instance-link/all';

    const response = await apiClient.get<{
      data: EntityLink[];
      syncedAt: number;
      hasMore: boolean;
    }>(url);

    // response.data is the axios response body: { data: EntityLink[], syncedAt, hasMore }
    const links = response.data.data;
    const now = Date.now();

    // Store raw links in Dexie if enabled
    if (config.persistToIndexedDB) {
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

      // Build indexes in Dexie
      await buildLinkIndexes();

      // Update sync timestamp
      await db.metadata.put({
        _id: 'entity_links_last_sync',
        type: 'sync',
        key: 'entity_links_last_sync',
        data: now,
        syncedAt: now,
      });
    }

    // Load indexes into sync stores
    const forwardRecords = await db.entityLinksForward.toArray();
    const reverseRecords = await db.entityLinksReverse.toArray();

    entityLinksStore.setForwardBulk(forwardRecords);
    entityLinksStore.setReverseBulk(reverseRecords);

    // Mark TanStack Query as fetched
    queryClient.setQueryData(QUERY_KEYS.ENTITY_LINKS, true);

    this.log(`Fetched ${links.length} links, built ${forwardRecords.length} forward + ${reverseRecords.length} reverse indexes`);
    return { data: links, source: 'api', syncedAt: now };
  }

  getChildIdsSync(parentCode: string, parentId: string, childCode: string): string[] {
    return entityLinksStore.getChildIds(parentCode, parentId, childCode);
  }

  getParentsSync(childCode: string, childId: string): Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }> {
    return entityLinksStore.getParents(childCode, childId);
  }

  getTabCountsSync(parentCode: string, parentId: string): Record<string, number> {
    return entityLinksStore.getTabCounts(parentCode, parentId, (code) =>
      entityCodesStore.getChildCodes(code)
    );
  }

  // ========================================
  // Layer 4: Entity Instance Names
  // ========================================

  getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null {
    return entityInstanceNamesStore.getName(entityCode, entityInstanceId);
  }

  getEntityInstanceNamesForTypeSync(entityCode: string): Record<string, string> {
    return entityInstanceNamesStore.getNames(entityCode);
  }

  mergeEntityInstanceNames(data: Record<string, Record<string, string>>): void {
    if (!data) return;

    const config = getCacheConfig();
    const now = Date.now();

    for (const [entityCode, nameMap] of Object.entries(data)) {
      // Update TanStack Query cache
      queryClient.setQueryData<Record<string, string>>(
        QUERY_KEYS.ENTITY_INSTANCE_NAMES(entityCode),
        (old = {}) => ({ ...old, ...nameMap })
      );

      // Update sync store
      entityInstanceNamesStore.merge(entityCode, nameMap);

      // Persist to Dexie if enabled (async, don't await)
      if (config.persistToIndexedDB) {
        const records = Object.entries(nameMap).map(([id, name]) => ({
          _id: createEntityInstanceNameKey(entityCode, id),
          entityCode,
          entityInstanceId: id,
          entityInstanceName: name,
          syncedAt: now,
        }));

        db.entityInstanceNames.bulkPut(records).catch(err => {
          console.error('[CacheAdapter] Failed to persist entity instance names:', err);
        });
      }
    }
  }

  // ========================================
  // Lifecycle
  // ========================================

  async hydrate(): Promise<void> {
    this.log('Hydrating from Dexie...');
    const startTime = Date.now();

    // Layer 1: Entity Codes
    const entityCodes = await db.entityTypes.toArray();
    if (entityCodes.length > 0) {
      const codes = entityCodes.map(et => ({
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
      queryClient.setQueryData(QUERY_KEYS.ENTITY_CODES, codes);
      entityCodesStore.set(codes);
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
      queryClient.setQueryData(QUERY_KEYS.ENTITY_INSTANCES, grouped);
      entityInstancesStore.setGrouped(grouped);
    }

    // Layer 3: Entity Links (forward + reverse indexes)
    const forwardRecords = await db.entityLinksForward.toArray();
    const reverseRecords = await db.entityLinksReverse.toArray();

    entityLinksStore.setForwardBulk(forwardRecords);
    entityLinksStore.setReverseBulk(reverseRecords);

    if (forwardRecords.length > 0) {
      queryClient.setQueryData(QUERY_KEYS.ENTITY_LINKS, true);
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
      queryClient.setQueryData(QUERY_KEYS.ENTITY_INSTANCE_NAMES(entityCode), names);
      entityInstanceNamesStore.set(entityCode, names);
    }

    this.ready = true;
    this.log(
      `Hydrated in ${Date.now() - startTime}ms:`,
      `${entityCodes.length} codes,`,
      `${entityInstances.length} instances,`,
      `${forwardRecords.length} forward links,`,
      `${reverseRecords.length} reverse links,`,
      `${nameRecords.length} names`
    );
  }

  async prefetch(): Promise<void> {
    this.log('Prefetching all layers...');
    const startTime = Date.now();

    // Get last sync timestamps for delta sync
    const instanceSyncRecord = await db.metadata.get('entity_instance_last_sync');
    const linksSyncRecord = await db.metadata.get('entity_links_last_sync');

    const instanceSince = instanceSyncRecord?.data as number | undefined;
    const linksSince = linksSyncRecord?.data as number | undefined;

    await Promise.all([
      this.fetchEntityCodes(),
      this.fetchEntityInstances(instanceSince),
      this.fetchEntityLinks(linksSince),
    ]);

    this.ready = true;
    this.log(`All layers prefetched in ${Date.now() - startTime}ms`);
  }

  clear(): void {
    // Clear sync stores
    clearAllStores();

    // Clear TanStack Query cache
    queryClient.removeQueries({ queryKey: QUERY_KEYS.ENTITY_CODES });
    queryClient.removeQueries({ queryKey: QUERY_KEYS.ENTITY_INSTANCES });
    queryClient.removeQueries({ queryKey: QUERY_KEYS.ENTITY_LINKS });
    queryClient.removeQueries({ queryKey: ['entity_instance_name'] });

    // Clear Dexie tables (async, don't await)
    Promise.all([
      db.entityTypes.clear(),
      db.entityInstances.clear(),
      db.entityLinksRaw.clear(),
      db.entityLinksForward.clear(),
      db.entityLinksReverse.clear(),
      db.entityInstanceNames.clear(),
    ]).catch(err => {
      console.error('[CacheAdapter] Failed to clear Dexie tables:', err);
    });

    this.ready = false;
    this.log('Cache cleared');
  }

  // ========================================
  // Granular Invalidation
  // ========================================

  invalidateEntityInstance(entityCode: string, entityInstanceId: string): void {
    this.log(`Invalidating entity instance: ${entityCode}:${entityInstanceId}`);

    // Remove from sync store
    entityInstancesStore.removeInstance(entityCode, entityInstanceId);

    // Update Dexie (mark as deleted)
    const key = createEntityInstanceKey(entityCode, entityInstanceId);
    db.entityInstances.update(key, { isDeleted: true }).catch(() => {});

    // Invalidate TanStack Query (will trigger refetch)
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.ENTITY_INSTANCES,
    });

    // Also invalidate any entity-specific queries
    queryClient.invalidateQueries({
      queryKey: ['entity', entityCode, entityInstanceId],
    });
  }

  invalidateEntityType(entityCode: string): void {
    this.log(`Invalidating entity type: ${entityCode}`);

    // Clear instances for this type from store
    entityInstancesStore.clearType(entityCode);

    // Invalidate TanStack Query
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.ENTITY_INSTANCES,
    });

    // Also invalidate list queries for this type
    queryClient.invalidateQueries({
      queryKey: ['entity', entityCode],
    });
  }

  invalidateLink(
    parentCode: string,
    parentId: string,
    childCode: string,
    _childId?: string
  ): void {
    this.log(`Invalidating link: ${parentCode}:${parentId} → ${childCode}`);

    // Invalidate the link queries
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.ENTITY_LINKS,
    });

    // Also invalidate derived list queries for this parent-child combination
    queryClient.invalidateQueries({
      queryKey: ['normalized-entity-list', childCode, parentCode, parentId],
    });
  }

  addLinkToCache(link: EntityLink): void {
    this.log(`Adding link to cache: ${link.entity_code}:${link.entity_instance_id} → ${link.child_entity_code}:${link.child_entity_instance_id}`);

    entityLinksStore.addLink(
      link.entity_code,
      link.entity_instance_id,
      link.child_entity_code,
      link.child_entity_instance_id,
      link.relationship_type
    );

    // Persist to Dexie (async)
    const forwardKey = entityLinksStore.createForwardKey(
      link.entity_code,
      link.entity_instance_id,
      link.child_entity_code
    );
    const forward = entityLinksStore.getForward(forwardKey);
    if (forward) {
      db.entityLinksForward.put(forward).catch(() => {});
    }

    const reverseKey = entityLinksStore.createReverseKey(
      link.child_entity_code,
      link.child_entity_instance_id
    );
    const reverse = entityLinksStore.getReverse(reverseKey);
    if (reverse) {
      db.entityLinksReverse.put(reverse).catch(() => {});
    }
  }

  removeLinkFromCache(link: EntityLink): void {
    this.log(`Removing link from cache: ${link.entity_code}:${link.entity_instance_id} → ${link.child_entity_code}:${link.child_entity_instance_id}`);

    entityLinksStore.removeLink(
      link.entity_code,
      link.entity_instance_id,
      link.child_entity_code,
      link.child_entity_instance_id
    );

    // Update Dexie (async)
    const forwardKey = entityLinksStore.createForwardKey(
      link.entity_code,
      link.entity_instance_id,
      link.child_entity_code
    );
    const forward = entityLinksStore.getForward(forwardKey);
    if (forward) {
      db.entityLinksForward.put(forward).catch(() => {});
    } else {
      db.entityLinksForward.delete(forwardKey).catch(() => {});
    }

    const reverseKey = entityLinksStore.createReverseKey(
      link.child_entity_code,
      link.child_entity_instance_id
    );
    const reverse = entityLinksStore.getReverse(reverseKey);
    if (reverse) {
      db.entityLinksReverse.put(reverse).catch(() => {});
    } else {
      db.entityLinksReverse.delete(reverseKey).catch(() => {});
    }
  }

  // ========================================
  // Status
  // ========================================

  isReady(): boolean {
    return this.ready;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const cacheAdapter = new CacheDataSourceAdapter(false);
