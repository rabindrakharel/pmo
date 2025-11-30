// ============================================================================
// Dexie Database Schema v4 - Unified Cache Architecture
// ============================================================================
// Lightweight IndexedDB wrapper for offline-first persistence
// Unified naming between TanStack Query keys and Dexie tables
// ============================================================================

import Dexie, { type Table } from 'dexie';

// ============================================================================
// INTERFACES
// ============================================================================

// Datalabel
export interface DatalabelOption {
  /** Unique ID */
  id: number;
  /** Display name */
  name: string;
  /** Description */
  descr?: string;
  /** Parent ID for hierarchical datalabels */
  parent_id?: number | null;
  /** Parent IDs for multi-level hierarchy */
  parent_ids?: number[];
  /** Display order */
  sort_order: number;
  /** Badge color code */
  color_code?: string;
  /** Active status */
  active_flag?: boolean;
}

export interface DatalabelRecord {
  /** Primary key: datalabel key (e.g., 'project_stage') */
  _id: string;
  key: string;
  options: DatalabelOption[];
  syncedAt: number;
}

// Entity Code (consolidates entity type metadata)
export interface EntityCodeDefinition {
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

export interface EntityCodeRecord {
  /** Primary key: 'all' for complete list */
  _id: string;
  codes: EntityCodeDefinition[];
  syncedAt: number;
}

// Global Setting
export interface GlobalSettingRecord {
  /** Primary key: 'settings' */
  _id: string;
  settings: Record<string, unknown>;
  syncedAt: number;
}

// Entity Instance Data (query results)
export interface EntityInstanceDataRecord {
  /** Composite key: `${entityCode}:${queryHash}` */
  _id: string;
  entityCode: string;
  queryHash: string;
  params: Record<string, unknown>;
  data: Record<string, unknown>[];
  total: number;
  syncedAt: number;
}

// Entity Instance Metadata (field definitions per entity type)
export interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType?: string;
  lookupEntity?: string;
  lookupSource?: string;
  datalabelKey?: string;
  behavior?: Record<string, boolean>;
  style?: Record<string, unknown>;
}

export interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType?: string;
  lookupEntity?: string;
  lookupSource?: string;
  datalabelKey?: string;
  behavior?: Record<string, boolean>;
  validation?: Record<string, unknown>;
}

export interface EntityInstanceMetadataRecord {
  /** Primary key: entityCode (e.g., 'project') */
  _id: string;
  entityCode: string;
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  syncedAt: number;
}

// Entity Instance (UUID -> name lookup)
export interface EntityInstanceRecord {
  /** Composite key: `${entityCode}:${entityInstanceId}` */
  _id: string;
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  /** Business code (e.g., 'PROJ-001') */
  instanceCode?: string | null;
  syncedAt: number;
}

// Entity Link (forward index: parent -> children)
export interface EntityLinkRecord {
  /** Composite key: `${parentCode}:${parentId}:${childCode}` */
  _id: string;
  parentCode: string;
  parentId: string;
  childCode: string;
  childIds: string[];
  relationships: Record<string, string>;
  syncedAt: number;
}

// Draft (unsaved form edits)
export interface DraftRecord {
  /** Composite key: `draft:${entityCode}:${entityId}` */
  _id: string;
  entityCode: string;
  entityId: string;
  originalData: Record<string, unknown>;
  currentData: Record<string, unknown>;
  undoStack: Record<string, unknown>[];
  redoStack: Record<string, unknown>[];
  updatedAt: number;
}

// ============================================================================
// DATABASE CLASS
// ============================================================================

/**
 * PMO Database using Dexie (IndexedDB wrapper)
 * v4: Unified Cache Architecture - 8 tables
 *
 * Metadata stores (separated):
 * - datalabel: Settings dropdown options
 * - entityCode: Entity type definitions
 * - globalSetting: App-wide settings
 *
 * Entity data (separated):
 * - entityInstanceData: Query results with pagination
 * - entityInstanceMetadata: Field definitions per entity type
 * - entityInstance: UUID -> name lookups
 * - entityLink: Parent-child relationships (forward index)
 *
 * Drafts:
 * - draft: Unsaved form edits with undo/redo
 *
 * Features:
 * - Automatic multi-tab sync via IndexedDB
 * - Unified naming with TanStack Query keys
 * - Delta sync support with timestamps
 * - Small bundle size (~25KB)
 */
export class PMODatabase extends Dexie {
  // ════════════════════════════════════════════════════════════════════════
  // Separated Metadata Stores
  // ════════════════════════════════════════════════════════════════════════
  datalabel!: Table<DatalabelRecord, string>;
  entityCode!: Table<EntityCodeRecord, string>;
  globalSetting!: Table<GlobalSettingRecord, string>;

  // ════════════════════════════════════════════════════════════════════════
  // Entity Data + Metadata (Separated)
  // ════════════════════════════════════════════════════════════════════════
  entityInstanceData!: Table<EntityInstanceDataRecord, string>;
  entityInstanceMetadata!: Table<EntityInstanceMetadataRecord, string>;
  entityInstance!: Table<EntityInstanceRecord, string>;

  // ════════════════════════════════════════════════════════════════════════
  // Entity Links (Forward Index Only)
  // ════════════════════════════════════════════════════════════════════════
  entityLink!: Table<EntityLinkRecord, string>;

  // ════════════════════════════════════════════════════════════════════════
  // Drafts
  // ════════════════════════════════════════════════════════════════════════
  draft!: Table<DraftRecord, string>;

  constructor() {
    super('pmo-cache-v4');

    this.version(1).stores({
      // Separated metadata stores
      datalabel: '_id, key',
      entityCode: '_id',
      globalSetting: '_id',

      // Entity data + metadata
      entityInstanceData: '_id, entityCode, queryHash, syncedAt',
      entityInstanceMetadata: '_id, entityCode',
      entityInstance: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

      // Entity links (forward index)
      entityLink: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',

      // Drafts
      draft: '_id, entityCode, entityId, updatedAt',
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const db = new PMODatabase();

// ============================================================================
// KEY GENERATORS (Unified with TanStack Query keys)
// ============================================================================

/**
 * Create datalabel cache key
 * TanStack: ['datalabel', key]
 * Dexie: key
 */
export function createDatalabelKey(key: string): string {
  return key.startsWith('dl__') ? key.slice(4) : key;
}

/**
 * Create entity instance data cache key
 * TanStack: ['entityInstanceData', entityCode, params]
 * Dexie: `${entityCode}:${queryHash}`
 */
export function createEntityInstanceDataKey(entityCode: string, params: Record<string, unknown>): string {
  return `${entityCode}:${createQueryHash(params)}`;
}

/**
 * Create entity instance cache key
 * TanStack: ['entityInstance', entityCode, entityInstanceId]
 * Dexie: `${entityCode}:${entityInstanceId}`
 */
export function createEntityInstanceKey(entityCode: string, entityInstanceId: string): string {
  return `${entityCode}:${entityInstanceId}`;
}

/**
 * Create entity link cache key
 * TanStack: ['entityLink', parentCode, parentId, childCode]
 * Dexie: `${parentCode}:${parentId}:${childCode}`
 */
export function createEntityLinkKey(parentCode: string, parentId: string, childCode: string): string {
  return `${parentCode}:${parentId}:${childCode}`;
}

/**
 * Create draft cache key
 * TanStack: ['draft', entityCode, entityId]
 * Dexie: `draft:${entityCode}:${entityId}`
 */
export function createDraftKey(entityCode: string, entityId: string): string {
  return `draft:${entityCode}:${entityId}`;
}

/**
 * Create stable hash from query params for list caching
 */
export function createQueryHash(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
}

// ============================================================================
// LEGACY KEY GENERATORS (for backward compatibility during transition)
// ============================================================================

/**
 * @deprecated Use createEntityInstanceKey instead
 */
export function createEntityKey(entityCode: string, entityId: string): string {
  return `${entityCode}:${entityId}`;
}

/**
 * @deprecated Use createDatalabelKey instead
 */
export function createMetadataKey(type: string, key?: string): string {
  return key ? `${type}:${key}` : type;
}

// ============================================================================
// CACHE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Clear all cached data (for logout)
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.datalabel.clear(),
    db.entityCode.clear(),
    db.globalSetting.clear(),
    db.entityInstanceData.clear(),
    db.entityInstanceMetadata.clear(),
    db.entityInstance.clear(),
    db.entityLink.clear(),
    db.draft.clear(),
  ]);
  console.log('[Dexie] All data cleared');
}

/**
 * Clear stale data older than maxAge
 */
export async function clearStaleData(maxAgeMs: number = 30 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  let count = 0;

  // Clear stale entity instance data
  const staleData = await db.entityInstanceData
    .where('syncedAt')
    .below(cutoff)
    .count();
  await db.entityInstanceData.where('syncedAt').below(cutoff).delete();
  count += staleData;

  // Clear stale datalabels
  const staleDatalabels = await db.datalabel
    .filter((d) => d.syncedAt < cutoff)
    .count();
  await db.datalabel.filter((d) => d.syncedAt < cutoff).delete();
  count += staleDatalabels;

  if (count > 0) {
    console.log(`[Dexie] Cleared ${count} stale entries`);
  }

  return count;
}

/**
 * Get database stats for debugging
 */
export async function getDatabaseStats(): Promise<{
  datalabel: number;
  entityCode: number;
  globalSetting: number;
  entityInstanceData: number;
  entityInstanceMetadata: number;
  entityInstance: number;
  entityLink: number;
  draft: number;
  total: number;
}> {
  const [
    datalabel,
    entityCode,
    globalSetting,
    entityInstanceData,
    entityInstanceMetadata,
    entityInstance,
    entityLink,
    draft,
  ] = await Promise.all([
    db.datalabel.count(),
    db.entityCode.count(),
    db.globalSetting.count(),
    db.entityInstanceData.count(),
    db.entityInstanceMetadata.count(),
    db.entityInstance.count(),
    db.entityLink.count(),
    db.draft.count(),
  ]);

  return {
    datalabel,
    entityCode,
    globalSetting,
    entityInstanceData,
    entityInstanceMetadata,
    entityInstance,
    entityLink,
    draft,
    total: datalabel + entityCode + globalSetting + entityInstanceData +
      entityInstanceMetadata + entityInstance + entityLink + draft,
  };
}

// ============================================================================
// ENTITY LINK HELPERS
// ============================================================================

/**
 * Get child entity IDs from forward link index
 * O(1) lookup - no API call needed
 */
export async function getChildIdsFromCache(
  parentCode: string,
  parentId: string,
  childCode: string
): Promise<string[] | null> {
  const key = createEntityLinkKey(parentCode, parentId, childCode);
  const record = await db.entityLink.get(key);
  return record?.childIds ?? null;
}

/**
 * Get entity instance name from cache
 * O(1) lookup
 */
export async function getEntityInstanceNameFromCache(
  entityCode: string,
  entityInstanceId: string
): Promise<string | null> {
  const key = createEntityInstanceKey(entityCode, entityInstanceId);
  const record = await db.entityInstance.get(key);
  return record?.entityInstanceName ?? null;
}

/**
 * Get all entity instance names for a type
 * Returns map: { uuid: name }
 */
export async function getEntityInstanceNamesForType(
  entityCode: string
): Promise<Record<string, string>> {
  const records = await db.entityInstance
    .where('entityCode')
    .equals(entityCode)
    .toArray();

  const result: Record<string, string> = {};
  for (const record of records) {
    result[record.entityInstanceId] = record.entityInstanceName;
  }
  return result;
}

/**
 * Add a link to the cache (for optimistic updates)
 */
export async function addLinkToCache(
  parentCode: string,
  parentId: string,
  childCode: string,
  childId: string,
  relationshipType: string = 'contains'
): Promise<void> {
  const key = createEntityLinkKey(parentCode, parentId, childCode);
  const existing = await db.entityLink.get(key);
  const now = Date.now();

  if (existing) {
    if (!existing.childIds.includes(childId)) {
      existing.childIds.push(childId);
    }
    existing.relationships[childId] = relationshipType;
    existing.syncedAt = now;
    await db.entityLink.put(existing);
  } else {
    await db.entityLink.put({
      _id: key,
      parentCode,
      parentId,
      childCode,
      childIds: [childId],
      relationships: { [childId]: relationshipType },
      syncedAt: now,
    });
  }
}

/**
 * Remove a link from the cache (for optimistic updates)
 */
export async function removeLinkFromCache(
  parentCode: string,
  parentId: string,
  childCode: string,
  childId: string
): Promise<void> {
  const key = createEntityLinkKey(parentCode, parentId, childCode);
  const existing = await db.entityLink.get(key);

  if (existing) {
    existing.childIds = existing.childIds.filter((id) => id !== childId);
    delete existing.relationships[childId];

    if (existing.childIds.length === 0) {
      await db.entityLink.delete(key);
    } else {
      await db.entityLink.put(existing);
    }
  }
}

// ============================================================================
// ENTITY CODE HELPERS
// ============================================================================

/**
 * Get entity code definition from cache
 */
export async function getEntityCodeFromCache(
  code: string
): Promise<EntityCodeDefinition | null> {
  const record = await db.entityCode.get('all');
  return record?.codes.find((c) => c.code === code) ?? null;
}

/**
 * Get all entity code definitions from cache
 */
export async function getAllEntityCodesFromCache(): Promise<EntityCodeDefinition[]> {
  const record = await db.entityCode.get('all');
  return record?.codes ?? [];
}

/**
 * Get child entity codes for a parent
 */
export async function getChildEntityCodesFromCache(
  parentCode: string
): Promise<string[]> {
  const entity = await getEntityCodeFromCache(parentCode);
  return entity?.child_entity_codes ?? [];
}
