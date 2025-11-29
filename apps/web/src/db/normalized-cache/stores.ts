// ============================================================================
// Normalized Cache Stores
// ============================================================================
// In-memory sync caches for O(1) non-hook access
// These stores mirror TanStack Query cache for sync access in formatters/utilities
// ============================================================================

import type {
  EntityCode,
  EntityInstance,
  LinkForwardIndex,
  LinkReverseIndex,
} from './types';
import type { EntityLinkForwardRecord, EntityLinkReverseRecord } from '../dexie/database';

// ============================================================================
// Layer 1: Entity Codes Store
// ============================================================================

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

// ============================================================================
// Layer 2: Entity Instances Store
// ============================================================================

class EntityInstancesStore {
  private byType = new Map<string, Map<string, EntityInstance>>();

  set(entityCode: string, instances: EntityInstance[]): void {
    const instanceMap = new Map<string, EntityInstance>();
    for (const instance of instances) {
      instanceMap.set(instance.entity_instance_id, instance);
    }
    this.byType.set(entityCode, instanceMap);
  }

  setGrouped(grouped: Map<string, EntityInstance[]>): void {
    this.byType.clear();
    for (const [entityCode, instances] of grouped.entries()) {
      this.set(entityCode, instances);
    }
  }

  getByCode(entityCode: string): EntityInstance[] {
    const instanceMap = this.byType.get(entityCode);
    return instanceMap ? Array.from(instanceMap.values()) : [];
  }

  getInstance(entityCode: string, entityInstanceId: string): EntityInstance | null {
    return this.byType.get(entityCode)?.get(entityInstanceId) ?? null;
  }

  addInstance(instance: EntityInstance): void {
    if (!this.byType.has(instance.entity_code)) {
      this.byType.set(instance.entity_code, new Map());
    }
    this.byType.get(instance.entity_code)!.set(instance.entity_instance_id, instance);
  }

  removeInstance(entityCode: string, entityInstanceId: string): boolean {
    return this.byType.get(entityCode)?.delete(entityInstanceId) ?? false;
  }

  clear(): void {
    this.byType.clear();
  }

  clearType(entityCode: string): void {
    this.byType.delete(entityCode);
  }

  size(): number {
    let count = 0;
    for (const map of this.byType.values()) {
      count += map.size;
    }
    return count;
  }
}

// ============================================================================
// Layer 3: Entity Links Store
// ============================================================================

class EntityLinksStore {
  private forward = new Map<string, EntityLinkForwardRecord>();
  private reverse = new Map<string, EntityLinkReverseRecord>();

  // Forward index operations
  setForward(key: string, record: EntityLinkForwardRecord): void {
    this.forward.set(key, record);
  }

  setForwardBulk(records: EntityLinkForwardRecord[]): void {
    this.forward.clear();
    for (const record of records) {
      this.forward.set(record._id, record);
    }
  }

  getForward(key: string): EntityLinkForwardRecord | null {
    return this.forward.get(key) ?? null;
  }

  hasForward(key: string): boolean {
    return this.forward.has(key);
  }

  getChildIds(parentCode: string, parentId: string, childCode: string): string[] {
    const key = this.createForwardKey(parentCode, parentId, childCode);
    return this.forward.get(key)?.childIds ?? [];
  }

  // Reverse index operations
  setReverse(key: string, record: EntityLinkReverseRecord): void {
    this.reverse.set(key, record);
  }

  setReverseBulk(records: EntityLinkReverseRecord[]): void {
    this.reverse.clear();
    for (const record of records) {
      this.reverse.set(record._id, record);
    }
  }

  getReverse(key: string): EntityLinkReverseRecord | null {
    return this.reverse.get(key) ?? null;
  }

  getParents(childCode: string, childId: string): Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }> {
    const key = this.createReverseKey(childCode, childId);
    return this.reverse.get(key)?.parents ?? [];
  }

  // Tab counts (for child entity tabs)
  getTabCounts(parentCode: string, parentId: string, getChildCodesFunc: (code: string) => string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    const childCodes = getChildCodesFunc(parentCode);

    for (const childCode of childCodes) {
      const key = this.createForwardKey(parentCode, parentId, childCode);
      const forward = this.forward.get(key);
      counts[childCode] = forward?.childIds.length ?? 0;
    }

    return counts;
  }

  // Key helpers
  createForwardKey(parentCode: string, parentId: string, childCode: string): string {
    return `${parentCode}:${parentId}:${childCode}`;
  }

  createReverseKey(childCode: string, childId: string): string {
    return `${childCode}:${childId}`;
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
    const forwardKey = this.createForwardKey(entityCode, entityInstanceId, childEntityCode);
    const existingForward = this.forward.get(forwardKey);

    if (existingForward) {
      if (!existingForward.childIds.includes(childEntityInstanceId)) {
        existingForward.childIds.push(childEntityInstanceId);
      }
      existingForward.relationships[childEntityInstanceId] = relationshipType;
    } else {
      this.forward.set(forwardKey, {
        _id: forwardKey,
        parentCode: entityCode,
        parentId: entityInstanceId,
        childCode: childEntityCode,
        childIds: [childEntityInstanceId],
        relationships: { [childEntityInstanceId]: relationshipType },
        syncedAt: now,
      });
    }

    // Update reverse index
    const reverseKey = this.createReverseKey(childEntityCode, childEntityInstanceId);
    const existingReverse = this.reverse.get(reverseKey);

    if (existingReverse) {
      const parentExists = existingReverse.parents.some(
        p => p.entity_code === entityCode && p.entity_instance_id === entityInstanceId
      );
      if (!parentExists) {
        existingReverse.parents.push({
          entity_code: entityCode,
          entity_instance_id: entityInstanceId,
          relationship_type: relationshipType,
        });
      }
    } else {
      this.reverse.set(reverseKey, {
        _id: reverseKey,
        childCode: childEntityCode,
        childId: childEntityInstanceId,
        parents: [{
          entity_code: entityCode,
          entity_instance_id: entityInstanceId,
          relationship_type: relationshipType,
        }],
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
    const forwardKey = this.createForwardKey(entityCode, entityInstanceId, childEntityCode);
    const existingForward = this.forward.get(forwardKey);

    if (existingForward) {
      existingForward.childIds = existingForward.childIds.filter(
        id => id !== childEntityInstanceId
      );
      delete existingForward.relationships[childEntityInstanceId];

      if (existingForward.childIds.length === 0) {
        this.forward.delete(forwardKey);
      }
    }

    // Update reverse index
    const reverseKey = this.createReverseKey(childEntityCode, childEntityInstanceId);
    const existingReverse = this.reverse.get(reverseKey);

    if (existingReverse) {
      existingReverse.parents = existingReverse.parents.filter(
        p => !(p.entity_code === entityCode && p.entity_instance_id === entityInstanceId)
      );

      if (existingReverse.parents.length === 0) {
        this.reverse.delete(reverseKey);
      }
    }
  }
}

// ============================================================================
// Layer 4: Entity Instance Names Store
// ============================================================================

class EntityInstanceNamesStore {
  private byType = new Map<string, Record<string, string>>();

  set(entityCode: string, names: Record<string, string>): void {
    this.byType.set(entityCode, names);
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

  clear(): void {
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

// ============================================================================
// Singleton Instances
// ============================================================================

export const entityCodesStore = new EntityCodesStore();
export const entityInstancesStore = new EntityInstancesStore();
export const entityLinksStore = new EntityLinksStore();
export const entityInstanceNamesStore = new EntityInstanceNamesStore();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear all stores
 */
export function clearAllStores(): void {
  entityCodesStore.clear();
  entityInstancesStore.clear();
  entityLinksStore.clear();
  entityInstanceNamesStore.clear();
}

/**
 * Get store statistics
 */
export function getStoreStats(): {
  entityCodes: number;
  entityInstances: number;
  linksForward: number;
  linksReverse: number;
  entityInstanceNames: number;
} {
  return {
    entityCodes: entityCodesStore.size(),
    entityInstances: entityInstancesStore.size(),
    linksForward: entityLinksStore.forwardSize(),
    linksReverse: entityLinksStore.reverseSize(),
    entityInstanceNames: entityInstanceNamesStore.size(),
  };
}
