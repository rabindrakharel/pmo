// ============================================================================
// API-Only Data Source Adapter
// ============================================================================
// Direct API access without caching
// Used when cache is disabled or in api-only mode
// ============================================================================

import { apiClient } from '@/lib/api';
import { BaseDataSourceAdapter } from './base';
import type {
  EntityCode,
  EntityInstance,
  EntityLink,
  DataSourceResult,
} from '../types';

// ============================================================================
// In-memory minimal stores for sync access
// ============================================================================

// These are minimal stores just for sync access functions
// They don't persist to IndexedDB - just hold data from last API call
const memoryEntityCodes = new Map<string, EntityCode>();
let memoryAllEntityCodes: EntityCode[] | null = null;

const memoryEntityInstances = new Map<string, Map<string, EntityInstance>>();

// Links are not cached in API-only mode - always fetch from API
// Parent → Children mapping (temporary, from last fetch)
const memoryForwardLinks = new Map<string, string[]>();

// Entity instance names (accumulated from API responses)
const memoryEntityInstanceNames = new Map<string, Record<string, string>>();

// ============================================================================
// API Adapter Implementation
// ============================================================================

export class APIDataSourceAdapter extends BaseDataSourceAdapter {
  constructor(debug = false) {
    super(debug);
  }

  // ========================================
  // Layer 1: Entity Codes
  // ========================================

  async fetchEntityCodes(): Promise<DataSourceResult<EntityCode[]>> {
    this.log('Fetching entity codes from API...');

    const response = await apiClient.get<{ data: EntityCode[]; syncedAt: number }>(
      '/api/v1/entity/types'
    );

    const entities = response.data;

    // Store in memory for sync access
    memoryAllEntityCodes = entities;
    memoryEntityCodes.clear();
    for (const entity of entities) {
      memoryEntityCodes.set(entity.code, entity);
    }

    this.log(`Fetched ${entities.length} entity codes`);
    return { data: entities, source: 'api', syncedAt: Date.now() };
  }

  getEntityCodeSync(code: string): EntityCode | null {
    return memoryEntityCodes.get(code) ?? null;
  }

  getAllEntityCodesSync(): EntityCode[] | null {
    return memoryAllEntityCodes;
  }

  getChildEntityCodesSync(parentCode: string): string[] {
    return memoryEntityCodes.get(parentCode)?.child_entity_codes ?? [];
  }

  // ========================================
  // Layer 2: Entity Instances
  // ========================================

  async fetchEntityInstances(_since?: number): Promise<DataSourceResult<EntityInstance[]>> {
    // In API-only mode, we don't fetch all instances upfront
    // Instead, instances are fetched per-entity-type as needed
    this.log('Skipping bulk entity instance fetch in API-only mode');
    return { data: [], source: 'api', syncedAt: Date.now() };
  }

  getEntityInstancesSync(entityCode: string): EntityInstance[] {
    const instanceMap = memoryEntityInstances.get(entityCode);
    return instanceMap ? Array.from(instanceMap.values()) : [];
  }

  getEntityInstanceSync(entityCode: string, entityInstanceId: string): EntityInstance | null {
    return memoryEntityInstances.get(entityCode)?.get(entityInstanceId) ?? null;
  }

  /**
   * Store instances from API response in memory
   * Called after each API list fetch
   */
  storeInstancesFromResponse(entityCode: string, entities: Array<{ id: string; name: string; code?: string }>): void {
    if (!memoryEntityInstances.has(entityCode)) {
      memoryEntityInstances.set(entityCode, new Map());
    }

    const instanceMap = memoryEntityInstances.get(entityCode)!;
    for (const entity of entities) {
      if (entity.id && entity.name) {
        instanceMap.set(entity.id, {
          entity_code: entityCode,
          entity_instance_id: entity.id,
          entity_instance_name: entity.name,
          code: entity.code,
        });
      }
    }
  }

  // ========================================
  // Layer 3: Entity Links
  // ========================================

  async fetchEntityLinks(_since?: number): Promise<DataSourceResult<EntityLink[]>> {
    // In API-only mode, we don't fetch all links upfront
    // Links are derived from parent-child queries
    this.log('Skipping bulk entity link fetch in API-only mode');
    return { data: [], source: 'api', syncedAt: Date.now() };
  }

  getChildIdsSync(parentCode: string, parentId: string, childCode: string): string[] {
    const key = `${parentCode}:${parentId}:${childCode}`;
    return memoryForwardLinks.get(key) ?? [];
  }

  getParentsSync(_childCode: string, _childId: string): Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }> {
    // In API-only mode, reverse lookups require API call
    // This is a limitation of API-only mode
    return [];
  }

  getTabCountsSync(parentCode: string, parentId: string): Record<string, number> {
    const counts: Record<string, number> = {};
    const childCodes = this.getChildEntityCodesSync(parentCode);

    for (const childCode of childCodes) {
      const key = `${parentCode}:${parentId}:${childCode}`;
      counts[childCode] = memoryForwardLinks.get(key)?.length ?? 0;
    }

    return counts;
  }

  /**
   * Store child IDs from API response
   * Called after fetching children list
   */
  storeChildIdsFromResponse(
    parentCode: string,
    parentId: string,
    childCode: string,
    childIds: string[]
  ): void {
    const key = `${parentCode}:${parentId}:${childCode}`;
    memoryForwardLinks.set(key, childIds);
  }

  // ========================================
  // Layer 4: Entity Instance Names
  // ========================================

  getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null {
    return memoryEntityInstanceNames.get(entityCode)?.[entityInstanceId] ?? null;
  }

  getEntityInstanceNamesForTypeSync(entityCode: string): Record<string, string> {
    return memoryEntityInstanceNames.get(entityCode) ?? {};
  }

  mergeEntityInstanceNames(data: Record<string, Record<string, string>>): void {
    if (!data) return;

    for (const [entityCode, nameMap] of Object.entries(data)) {
      const existing = memoryEntityInstanceNames.get(entityCode) ?? {};
      memoryEntityInstanceNames.set(entityCode, { ...existing, ...nameMap });
    }
  }

  // ========================================
  // Lifecycle
  // ========================================

  async hydrate(): Promise<void> {
    // No hydration in API-only mode
    this.log('Skipping hydration in API-only mode');
  }

  async prefetch(): Promise<void> {
    // Only fetch entity codes in API-only mode
    // Other data is fetched on-demand
    this.log('Prefetching entity codes only in API-only mode...');
    await this.fetchEntityCodes();
  }

  clear(): void {
    memoryEntityCodes.clear();
    memoryAllEntityCodes = null;
    memoryEntityInstances.clear();
    memoryForwardLinks.clear();
    memoryEntityInstanceNames.clear();
    this.log('Memory cleared');
  }

  // ========================================
  // Granular Invalidation
  // ========================================

  invalidateEntityInstance(entityCode: string, entityInstanceId: string): void {
    // Remove from memory
    memoryEntityInstances.get(entityCode)?.delete(entityInstanceId);
    this.log(`Invalidated entity instance: ${entityCode}:${entityInstanceId}`);
  }

  invalidateEntityType(entityCode: string): void {
    // Clear all instances for this type
    memoryEntityInstances.delete(entityCode);
    this.log(`Invalidated entity type: ${entityCode}`);
  }

  invalidateLink(
    parentCode: string,
    parentId: string,
    childCode: string,
    _childId?: string
  ): void {
    const key = `${parentCode}:${parentId}:${childCode}`;
    memoryForwardLinks.delete(key);
    this.log(`Invalidated link: ${key}`);
  }

  addLinkToCache(link: EntityLink): void {
    const key = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
    const existing = memoryForwardLinks.get(key) ?? [];
    if (!existing.includes(link.child_entity_instance_id)) {
      existing.push(link.child_entity_instance_id);
      memoryForwardLinks.set(key, existing);
    }
    this.log(`Added link to memory: ${key} → ${link.child_entity_instance_id}`);
  }

  removeLinkFromCache(link: EntityLink): void {
    const key = `${link.entity_code}:${link.entity_instance_id}:${link.child_entity_code}`;
    const existing = memoryForwardLinks.get(key);
    if (existing) {
      const filtered = existing.filter(id => id !== link.child_entity_instance_id);
      if (filtered.length > 0) {
        memoryForwardLinks.set(key, filtered);
      } else {
        memoryForwardLinks.delete(key);
      }
    }
    this.log(`Removed link from memory: ${key} → ${link.child_entity_instance_id}`);
  }

  // ========================================
  // Status
  // ========================================

  isReady(): boolean {
    // API adapter is always "ready" - it fetches on demand
    return true;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const apiAdapter = new APIDataSourceAdapter(false);
