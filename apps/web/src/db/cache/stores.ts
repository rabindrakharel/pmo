// ============================================================================
// Sync Stores - In-Memory Cache for Non-Hook Access
// ============================================================================
// These stores are populated by TanStack Query hooks and provide synchronous
// access for formatters, utilities, and other non-React code.
//
// Usage:
//   import { getDatalabelSync, getEntityCodesSync } from '@/db/cache/stores';
//   const options = getDatalabelSync('project_stage');
// ============================================================================

import type {
  GlobalSettings,
  DatalabelOption,
  EntityCode,
  EntityInstanceMetadata,
  LinkForwardIndex,
  LinkReverseIndex,
} from './types';

// ============================================================================
// Generic Store Classes
// ============================================================================

/**
 * Simple sync store for single values
 */
class SyncStore<T> {
  private data: T | null = null;

  set(value: T): void {
    this.data = value;
  }

  get(): T | null {
    return this.data;
  }

  clear(): void {
    this.data = null;
  }

  has(): boolean {
    return this.data !== null;
  }
}

/**
 * Map-based store for keyed values
 */
class MapStore<K extends string, V> {
  private data = new Map<K, V>();

  set(key: K, value: V): void {
    this.data.set(key, value);
  }

  get(key: K): V | undefined {
    return this.data.get(key);
  }

  has(key: K): boolean {
    return this.data.has(key);
  }

  delete(key: K): boolean {
    return this.data.delete(key);
  }

  getAll(): Map<K, V> {
    return new Map(this.data);
  }

  keys(): K[] {
    return Array.from(this.data.keys());
  }

  values(): V[] {
    return Array.from(this.data.values());
  }

  clear(): void {
    this.data.clear();
  }

  size(): number {
    return this.data.size;
  }
}

// ============================================================================
// Specialized Store Classes
// ============================================================================

/**
 * Entity Codes Store with helper methods
 */
class EntityCodesStore {
  private byCode = new Map<string, EntityCode>();
  private all: EntityCode[] | null = null;

  set(codes: EntityCode[]): void {
    this.all = codes;
    this.byCode.clear();
    for (const entityCode of codes) {
      this.byCode.set(entityCode.code, entityCode);
    }
  }

  getByCode(code: string): EntityCode | null {
    return this.byCode.get(code) ?? null;
  }

  getAll(): EntityCode[] | null {
    return this.all;
  }

  getChildCodes(parentCode: string): string[] {
    return this.byCode.get(parentCode)?.child_entity_codes ?? [];
  }

  clear(): void {
    this.byCode.clear();
    this.all = null;
  }

  size(): number {
    return this.byCode.size;
  }
}

/**
 * Entity Instance Names Store (entityCode -> { instanceId: name })
 */
class EntityInstanceNamesStore {
  private byType = new Map<string, Record<string, string>>();

  set(entityCode: string, entityInstanceId: string, name: string): void;
  set(entityCode: string, names: Record<string, string>): void;
  set(
    entityCode: string,
    entityInstanceIdOrNames: string | Record<string, string>,
    name?: string
  ): void {
    if (typeof entityInstanceIdOrNames === 'string') {
      // Single name mode
      const existing = this.byType.get(entityCode) ?? {};
      existing[entityInstanceIdOrNames] = name!;
      this.byType.set(entityCode, existing);
    } else {
      // Batch mode - replace all
      this.byType.set(entityCode, entityInstanceIdOrNames);
    }
  }

  merge(entityCode: string, names: Record<string, string>): void {
    const existing = this.byType.get(entityCode) ?? {};
    this.byType.set(entityCode, { ...existing, ...names });
  }

  mergeAll(data: Record<string, Record<string, string>>): void {
    for (const [entityCode, names] of Object.entries(data)) {
      this.merge(entityCode, names);
    }
  }

  getNames(entityCode: string): Record<string, string> {
    return this.byType.get(entityCode) ?? {};
  }

  getName(entityCode: string, entityInstanceId: string): string | null {
    return this.byType.get(entityCode)?.[entityInstanceId] ?? null;
  }

  delete(entityCode: string, entityInstanceId: string): void {
    const existing = this.byType.get(entityCode);
    if (existing) {
      delete existing[entityInstanceId];
    }
  }

  clear(): void {
    this.byType.clear();
  }

  clearByCode(entityCode: string): void {
    this.byType.delete(entityCode);
  }

  clearAll(): void {
    this.byType.clear();
  }

  clearType(entityCode: string): void {
    this.byType.delete(entityCode);
  }

  size(): number {
    let count = 0;
    for (const names of this.byType.values()) {
      count += Object.keys(names).length;
    }
    return count;
  }
}

/**
 * Entity Links Store with forward and reverse indexes
 */
class EntityLinksStore {
  private forward = new Map<string, LinkForwardIndex & { syncedAt: number }>();
  private reverse = new Map<string, LinkReverseIndex & { syncedAt: number }>();

  // Key helpers
  createForwardKey(
    parentCode: string,
    parentId: string,
    childCode: string
  ): string {
    return `${parentCode}:${parentId}:${childCode}`;
  }

  createReverseKey(childCode: string, childId: string): string {
    return `${childCode}:${childId}`;
  }

  // Forward index operations
  setForward(key: string, record: LinkForwardIndex & { syncedAt: number }): void {
    this.forward.set(key, record);
  }

  getForward(key: string): (LinkForwardIndex & { syncedAt: number }) | null {
    return this.forward.get(key) ?? null;
  }

  hasForward(key: string): boolean {
    return this.forward.has(key);
  }

  getChildIds(
    parentCode: string,
    parentId: string,
    childCode: string
  ): string[] {
    const key = this.createForwardKey(parentCode, parentId, childCode);
    return this.forward.get(key)?.childIds ?? [];
  }

  // Reverse index operations
  setReverse(key: string, record: LinkReverseIndex & { syncedAt: number }): void {
    this.reverse.set(key, record);
  }

  getReverse(key: string): (LinkReverseIndex & { syncedAt: number }) | null {
    return this.reverse.get(key) ?? null;
  }

  getParents(
    childCode: string,
    childId: string
  ): Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }> {
    const key = this.createReverseKey(childCode, childId);
    return this.reverse.get(key)?.parents ?? [];
  }

  // Tab counts (for child entity tabs)
  getTabCounts(
    parentCode: string,
    parentId: string,
    getChildCodesFunc: (code: string) => string[]
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    const childCodes = getChildCodesFunc(parentCode);

    for (const childCode of childCodes) {
      const key = this.createForwardKey(parentCode, parentId, childCode);
      const forwardRecord = this.forward.get(key);
      counts[childCode] = forwardRecord?.childIds.length ?? 0;
    }

    return counts;
  }

  // Convenience methods for link manipulation
  addForwardChild(
    forwardKey: string,
    childId: string,
    relationshipType: string
  ): void {
    const existing = this.forward.get(forwardKey);
    if (existing) {
      if (!existing.childIds.includes(childId)) {
        existing.childIds.push(childId);
      }
      existing.relationships[childId] = relationshipType;
      existing.syncedAt = Date.now();
    }
  }

  addReverseParent(
    reverseKey: string,
    parent: {
      entity_code: string;
      entity_instance_id: string;
      relationship_type: string;
    }
  ): void {
    const existing = this.reverse.get(reverseKey);
    if (existing) {
      const parentExists = existing.parents.some(
        (p) =>
          p.entity_code === parent.entity_code &&
          p.entity_instance_id === parent.entity_instance_id
      );
      if (!parentExists) {
        existing.parents.push(parent);
        existing.syncedAt = Date.now();
      }
    }
  }

  removeForwardChild(forwardKey: string, childId: string): void {
    const existing = this.forward.get(forwardKey);
    if (existing) {
      existing.childIds = existing.childIds.filter((id) => id !== childId);
      delete existing.relationships[childId];
      if (existing.childIds.length === 0) {
        this.forward.delete(forwardKey);
      }
    }
  }

  removeReverseParent(reverseKey: string, parentInstanceId: string): void {
    const existing = this.reverse.get(reverseKey);
    if (existing) {
      existing.parents = existing.parents.filter(
        (p) => p.entity_instance_id !== parentInstanceId
      );
      if (existing.parents.length === 0) {
        this.reverse.delete(reverseKey);
      }
    }
  }

  // Add/remove link operations (for optimistic updates)
  addLink(
    entityCode: string,
    entityInstanceId: string,
    childEntityCode: string,
    childEntityInstanceId: string,
    relationshipType: string
  ): void {
    const now = Date.now();

    // Update forward index
    const forwardKey = this.createForwardKey(
      entityCode,
      entityInstanceId,
      childEntityCode
    );
    const existingForward = this.forward.get(forwardKey);

    if (existingForward) {
      if (!existingForward.childIds.includes(childEntityInstanceId)) {
        existingForward.childIds.push(childEntityInstanceId);
      }
      existingForward.relationships[childEntityInstanceId] = relationshipType;
      existingForward.syncedAt = now;
    } else {
      this.forward.set(forwardKey, {
        parentCode: entityCode,
        parentId: entityInstanceId,
        childCode: childEntityCode,
        childIds: [childEntityInstanceId],
        relationships: { [childEntityInstanceId]: relationshipType },
        syncedAt: now,
      });
    }

    // Update reverse index
    const reverseKey = this.createReverseKey(
      childEntityCode,
      childEntityInstanceId
    );
    const existingReverse = this.reverse.get(reverseKey);

    if (existingReverse) {
      const parentExists = existingReverse.parents.some(
        (p) =>
          p.entity_code === entityCode &&
          p.entity_instance_id === entityInstanceId
      );
      if (!parentExists) {
        existingReverse.parents.push({
          entity_code: entityCode,
          entity_instance_id: entityInstanceId,
          relationship_type: relationshipType,
        });
        existingReverse.syncedAt = now;
      }
    } else {
      this.reverse.set(reverseKey, {
        childCode: childEntityCode,
        childId: childEntityInstanceId,
        parents: [
          {
            entity_code: entityCode,
            entity_instance_id: entityInstanceId,
            relationship_type: relationshipType,
          },
        ],
        syncedAt: now,
      });
    }
  }

  removeLink(
    entityCode: string,
    entityInstanceId: string,
    childEntityCode: string,
    childEntityInstanceId: string
  ): void {
    // Update forward index
    const forwardKey = this.createForwardKey(
      entityCode,
      entityInstanceId,
      childEntityCode
    );
    const existingForward = this.forward.get(forwardKey);

    if (existingForward) {
      existingForward.childIds = existingForward.childIds.filter(
        (id) => id !== childEntityInstanceId
      );
      delete existingForward.relationships[childEntityInstanceId];

      if (existingForward.childIds.length === 0) {
        this.forward.delete(forwardKey);
      }
    }

    // Update reverse index
    const reverseKey = this.createReverseKey(
      childEntityCode,
      childEntityInstanceId
    );
    const existingReverse = this.reverse.get(reverseKey);

    if (existingReverse) {
      existingReverse.parents = existingReverse.parents.filter(
        (p) =>
          !(
            p.entity_code === entityCode &&
            p.entity_instance_id === entityInstanceId
          )
      );

      if (existingReverse.parents.length === 0) {
        this.reverse.delete(reverseKey);
      }
    }
  }

  // Clear operations
  clear(): void {
    this.forward.clear();
    this.reverse.clear();
  }

  clearForward(): void {
    this.forward.clear();
  }

  clearReverse(): void {
    this.reverse.clear();
  }

  // Size info
  forwardSize(): number {
    return this.forward.size;
  }

  reverseSize(): number {
    return this.reverse.size;
  }
}

// ============================================================================
// Singleton Store Instances
// ============================================================================

export const globalSettingsStore = new SyncStore<GlobalSettings>();
export const datalabelStore = new MapStore<string, DatalabelOption[]>();
export const entityCodesStore = new EntityCodesStore();
export const entityInstanceNamesStore = new EntityInstanceNamesStore();
export const entityLinksStore = new EntityLinksStore();
export const entityInstanceMetadataStore = new MapStore<
  string,
  EntityInstanceMetadata
>();

// ============================================================================
// Convenience Functions - Global Settings
// ============================================================================

/**
 * Get global settings synchronously
 */
export function getGlobalSettingsSync(): GlobalSettings | null {
  return globalSettingsStore.get();
}

/**
 * Get a specific setting synchronously
 */
export function getSettingSync<K extends keyof GlobalSettings>(
  key: K
): GlobalSettings[K] | null {
  const settings = globalSettingsStore.get();
  return settings?.[key] ?? null;
}

// ============================================================================
// Convenience Functions - Datalabels
// ============================================================================

/**
 * Get datalabel options synchronously
 */
export function getDatalabelSync(key: string): DatalabelOption[] | null {
  const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
  return datalabelStore.get(normalizedKey) ?? null;
}

/**
 * Set datalabel options (called by hook when data changes)
 */
export function setDatalabelSync(
  key: string,
  options: DatalabelOption[]
): void {
  const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
  datalabelStore.set(normalizedKey, options);
}

// ============================================================================
// Convenience Functions - Entity Codes
// ============================================================================

/**
 * Get all entity codes synchronously
 */
export function getEntityCodesSync(): EntityCode[] | null {
  return entityCodesStore.getAll();
}

/**
 * Get entity code by code synchronously
 */
export function getEntityCodeSync(code: string): EntityCode | null {
  return entityCodesStore.getByCode(code);
}

/**
 * Get child entity codes synchronously
 */
export function getChildEntityCodesSync(parentCode: string): string[] {
  return entityCodesStore.getChildCodes(parentCode);
}

// ============================================================================
// Convenience Functions - Entity Instance Names
// ============================================================================

/**
 * Get entity instance name synchronously
 */
export function getEntityInstanceNameSync(
  entityCode: string,
  entityInstanceId: string
): string | null {
  return entityInstanceNamesStore.getName(entityCode, entityInstanceId);
}

/**
 * Get all entity instance names for a type synchronously
 */
export function getEntityInstanceNamesForTypeSync(
  entityCode: string
): Record<string, string> {
  return entityInstanceNamesStore.getNames(entityCode);
}

// ============================================================================
// Convenience Functions - Entity Links
// ============================================================================

/**
 * Get child IDs synchronously
 */
export function getChildIdsSync(
  parentCode: string,
  parentId: string,
  childCode: string
): string[] {
  return entityLinksStore.getChildIds(parentCode, parentId, childCode);
}

/**
 * Get parents synchronously
 */
export function getParentsSync(
  childCode: string,
  childId: string
): Array<{
  entity_code: string;
  entity_instance_id: string;
  relationship_type: string;
}> {
  return entityLinksStore.getParents(childCode, childId);
}

// ============================================================================
// Convenience Functions - Entity Instance Metadata
// ============================================================================

/**
 * Get entity instance metadata synchronously
 */
export function getEntityInstanceMetadataSync(
  entityCode: string
): EntityInstanceMetadata | null {
  return entityInstanceMetadataStore.get(entityCode) ?? null;
}

// ============================================================================
// Store Management Functions
// ============================================================================

/**
 * Clear all sync stores
 * Called on logout
 */
export function clearAllSyncStores(): void {
  globalSettingsStore.clear();
  datalabelStore.clear();
  entityCodesStore.clear();
  entityInstanceNamesStore.clear();
  entityLinksStore.clear();
  entityInstanceMetadataStore.clear();
}

/**
 * Get statistics about sync store contents
 */
export function getSyncStoreStats(): {
  globalSettings: boolean;
  datalabels: number;
  entityCodes: number;
  entityInstanceNames: number;
  linksForward: number;
  linksReverse: number;
  entityInstanceMetadata: number;
} {
  return {
    globalSettings: globalSettingsStore.has(),
    datalabels: datalabelStore.size(),
    entityCodes: entityCodesStore.size(),
    entityInstanceNames: entityInstanceNamesStore.size(),
    linksForward: entityLinksStore.forwardSize(),
    linksReverse: entityLinksStore.reverseSize(),
    entityInstanceMetadata: entityInstanceMetadataStore.size(),
  };
}
