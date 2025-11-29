// ============================================================================
// Dexie Database Schema v3 - 4-Layer Normalized Cache Architecture
// ============================================================================
// Lightweight IndexedDB wrapper for offline-first persistence
// Mirrors database infrastructure tables: entity, entity_instance,
// entity_instance_link, and entity_instance_name (derived from entity_instance)
// ============================================================================

import Dexie, { type Table } from 'dexie';

// ============================================================================
// LAYER 1: Entity Type Metadata (mirrors app.entity)
// ============================================================================

/**
 * Entity type metadata - cached at login, rarely changes
 * Source: GET /api/v1/entity/types
 */
export interface EntityTypeRecord {
  /** Primary key: entity code (e.g., 'project', 'task') */
  _id: string;
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  db_table?: string;
  db_model_type?: string;
  /** Array of child entity codes */
  child_entity_codes: string[];
  display_order: number;
  domain_code?: string;
  column_metadata?: unknown[];
  active_flag: boolean;
  syncedAt: number;
}

// ============================================================================
// LAYER 2: Entity Instance Registry (mirrors app.entity_instance)
// ============================================================================

/**
 * Entity instance record - cached at login, updated throughout session
 * Source: GET /api/v1/entity-instance/all
 */
export interface EntityInstanceRecord {
  /** Composite key: `${entity_code}:${entity_instance_id}` */
  _id: string;
  entity_code: string;
  entity_instance_id: string;
  entity_instance_name: string;
  /** Business code (e.g., 'PROJ-001') */
  code?: string | null;
  order_id?: number;
  updated_ts?: string;
  syncedAt: number;
  /** Soft delete flag for local cache */
  isDeleted?: boolean;
}

// ============================================================================
// LAYER 3: Entity Instance Link (mirrors app.entity_instance_link)
// ============================================================================

/**
 * Forward link record - indexed by parent → children
 * Source: GET /api/v1/entity-instance-link/all (processed into forward index)
 */
export interface EntityLinkForwardRecord {
  /** Composite key: `${parentCode}:${parentId}:${childCode}` */
  _id: string;
  parentCode: string;
  parentId: string;
  childCode: string;
  /** Array of child entity instance IDs */
  childIds: string[];
  /** Map of childId → relationship_type */
  relationships: Record<string, string>;
  syncedAt: number;
}

/**
 * Reverse link record - indexed by child → parents
 * Enables O(1) lookup: "What projects is this task linked to?"
 */
export interface EntityLinkReverseRecord {
  /** Composite key: `${childCode}:${childId}` */
  _id: string;
  childCode: string;
  childId: string;
  /** Array of parent references */
  parents: Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
  syncedAt: number;
}

/**
 * Raw link record - stores individual links before processing
 * Used for delta sync and rebuilding indexes
 */
export interface EntityLinkRawRecord {
  /** Primary key: link UUID */
  _id: string;
  entity_code: string;
  entity_instance_id: string;
  child_entity_code: string;
  child_entity_instance_id: string;
  relationship_type: string;
  updated_ts?: string;
  syncedAt: number;
}

// ============================================================================
// LAYER 4: Entity Instance Name Lookup (derived from entity_instance)
// ============================================================================

/**
 * Entity instance name record - accumulated from API responses
 * Source: Extracted from API response.entity_instance_name (formerly ref_data_entityInstance)
 */
export interface EntityInstanceNameRecord {
  /** Composite key: `${entityCode}:${entityInstanceId}` */
  _id: string;
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  syncedAt: number;
}

// ============================================================================
// LEGACY TABLES (for backward compatibility during migration)
// ============================================================================

/**
 * Cached entity record - stores individual entity data
 * @deprecated Use normalized cache layers instead
 */
export interface CachedEntity {
  /** Composite key: `${entityCode}:${entityId}` */
  _id: string;
  /** Entity type code (e.g., 'project', 'task') */
  entityCode: string;
  /** Entity instance UUID */
  entityId: string;
  /** Raw entity data from API */
  data: Record<string, unknown>;
  /** Field metadata for rendering */
  metadata?: Record<string, unknown>;
  /** Reference data for entity lookups */
  refData?: Record<string, Record<string, string>>;
  /** Data version for conflict resolution */
  version: number;
  /** Last sync timestamp */
  syncedAt: number;
  /** Soft delete flag */
  isDeleted?: boolean;
}

/**
 * Cached entity list - stores query results
 * @deprecated Use normalized cache with derived queries instead
 */
export interface CachedEntityList {
  /** Composite key: `${entityCode}:${queryHash}` */
  _id: string;
  /** Entity type code */
  entityCode: string;
  /** Hash of query parameters */
  queryHash: string;
  /** Original query parameters */
  params: Record<string, unknown>;
  /** Array of entity IDs in this result set */
  entityIds: string[];
  /** Total count from server */
  total: number;
  /** Field metadata for rendering */
  metadata?: Record<string, unknown>;
  /** Last sync timestamp */
  syncedAt: number;
}

/**
 * Cached metadata - stores datalabels, entity codes, settings
 */
export interface CachedMetadata {
  /** Unique key: 'datalabel:project_stage', 'entityCodes', 'globalSettings' */
  _id: string;
  /** Metadata type for indexing */
  type: 'datalabel' | 'entityCodes' | 'globalSettings' | 'component' | 'sync';
  /** Sub-key for datalabels (e.g., 'project_stage') */
  key?: string;
  /** The actual metadata payload */
  data: unknown;
  /** When this was cached */
  syncedAt: number;
}

/**
 * Cached draft - stores unsaved form edits with undo/redo
 */
export interface CachedDraft {
  /** Composite key: `draft:${entityCode}:${entityId}` */
  _id: string;
  /** Entity type code */
  entityCode: string;
  /** Entity instance UUID */
  entityId: string;
  /** Original data before edits */
  originalData: Record<string, unknown>;
  /** Current edited data */
  currentData: Record<string, unknown>;
  /** Stack of previous states for undo */
  undoStack: Record<string, unknown>[];
  /** Stack of undone states for redo */
  redoStack: Record<string, unknown>[];
  /** Last update timestamp */
  updatedAt: number;
}

// ============================================================================
// Database Class
// ============================================================================

/**
 * PMO Database using Dexie (IndexedDB wrapper)
 * v3: 4-Layer Normalized Cache Architecture
 *
 * Layer 1: entityTypes - Entity type metadata (fetched at login)
 * Layer 2: entityInstances - Entity instance registry (fetched at login, updated)
 * Layer 3: entityLinks* - Relationship graph (forward/reverse indexes)
 * Layer 4: entityInstanceNames - Name lookups (accumulated from responses)
 *
 * Features:
 * - Automatic multi-tab sync via IndexedDB
 * - Delta sync support with timestamps
 * - Forward/reverse link indexes for O(1) lookups
 * - Small bundle size (~25KB)
 */
export class PMODatabase extends Dexie {
  // ════════════════════════════════════════════════════════════════════════
  // Layer 1: Entity Types
  // ════════════════════════════════════════════════════════════════════════
  entityTypes!: Table<EntityTypeRecord, string>;

  // ════════════════════════════════════════════════════════════════════════
  // Layer 2: Entity Instances
  // ════════════════════════════════════════════════════════════════════════
  entityInstances!: Table<EntityInstanceRecord, string>;

  // ════════════════════════════════════════════════════════════════════════
  // Layer 3: Entity Links (Forward + Reverse + Raw)
  // ════════════════════════════════════════════════════════════════════════
  entityLinksForward!: Table<EntityLinkForwardRecord, string>;
  entityLinksReverse!: Table<EntityLinkReverseRecord, string>;
  entityLinksRaw!: Table<EntityLinkRawRecord, string>;

  // ════════════════════════════════════════════════════════════════════════
  // Layer 4: Entity Instance Names
  // ════════════════════════════════════════════════════════════════════════
  entityInstanceNames!: Table<EntityInstanceNameRecord, string>;

  // ════════════════════════════════════════════════════════════════════════
  // Legacy Tables (for backward compatibility)
  // ════════════════════════════════════════════════════════════════════════
  entities!: Table<CachedEntity, string>;
  entityLists!: Table<CachedEntityList, string>;
  metadata!: Table<CachedMetadata, string>;
  drafts!: Table<CachedDraft, string>;

  constructor() {
    super('pmo-cache-v3');

    // Schema version 1 - 4-Layer Normalized Cache
    this.version(1).stores({
      // ════════════════════════════════════════════════════════════════════
      // Layer 1: Entity Types (fetch at login, persist)
      // ════════════════════════════════════════════════════════════════════
      entityTypes: '_id, code, display_order, domain_code',

      // ════════════════════════════════════════════════════════════════════
      // Layer 2: Entity Instances (fetch at login, upsert, validate, invalidate)
      // ════════════════════════════════════════════════════════════════════
      entityInstances: '_id, entity_code, entity_instance_id, [entity_code+entity_instance_id], isDeleted, syncedAt',

      // ════════════════════════════════════════════════════════════════════
      // Layer 3: Entity Links
      // ════════════════════════════════════════════════════════════════════
      // Forward index: parent → children
      entityLinksForward: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',
      // Reverse index: child → parents
      entityLinksReverse: '_id, childCode, childId, [childCode+childId]',
      // Raw links for delta sync
      entityLinksRaw: '_id, entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, syncedAt',

      // ════════════════════════════════════════════════════════════════════
      // Layer 4: Entity Instance Names (accumulated from API responses)
      // ════════════════════════════════════════════════════════════════════
      entityInstanceNames: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',

      // ════════════════════════════════════════════════════════════════════
      // Legacy Tables (for backward compatibility)
      // ════════════════════════════════════════════════════════════════════
      entities: '_id, entityCode, entityId, syncedAt, isDeleted',
      entityLists: '_id, entityCode, queryHash, syncedAt',
      metadata: '_id, type, key',
      drafts: '_id, entityCode, entityId, updatedAt',
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const db = new PMODatabase();

// ============================================================================
// Helper Functions - Key Generation
// ============================================================================

/**
 * Create entity type cache key
 */
export function createEntityTypeKey(code: string): string {
  return code;
}

/**
 * Create entity instance cache key
 */
export function createEntityInstanceKey(entityCode: string, entityInstanceId: string): string {
  return `${entityCode}:${entityInstanceId}`;
}

/**
 * Create forward link cache key (parent → children of specific type)
 */
export function createLinkForwardKey(parentCode: string, parentId: string, childCode: string): string {
  return `${parentCode}:${parentId}:${childCode}`;
}

/**
 * Create reverse link cache key (child → parents)
 */
export function createLinkReverseKey(childCode: string, childId: string): string {
  return `${childCode}:${childId}`;
}

/**
 * Create entity instance name cache key
 */
export function createEntityInstanceNameKey(entityCode: string, entityInstanceId: string): string {
  return `${entityCode}:${entityInstanceId}`;
}

// ============================================================================
// Helper Functions - Legacy (for backward compatibility)
// ============================================================================

/**
 * Create entity cache key
 * @deprecated Use createEntityInstanceKey instead
 */
export function createEntityKey(entityCode: string, entityId: string): string {
  return `${entityCode}:${entityId}`;
}

/**
 * Create draft cache key
 */
export function createDraftKey(entityCode: string, entityId: string): string {
  return `draft:${entityCode}:${entityId}`;
}

/**
 * Create metadata cache key
 */
export function createMetadataKey(type: string, key?: string): string {
  return key ? `${type}:${key}` : type;
}

/**
 * Create stable hash from query params for list caching
 */
export function createQueryHash(params: Record<string, unknown>): string {
  // Sort keys for consistent hashing
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
}

// ============================================================================
// Cache Management Functions
// ============================================================================

/**
 * Clear all cached data (for logout)
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    // Layer 1-4
    db.entityTypes.clear(),
    db.entityInstances.clear(),
    db.entityLinksForward.clear(),
    db.entityLinksReverse.clear(),
    db.entityLinksRaw.clear(),
    db.entityInstanceNames.clear(),
    // Legacy
    db.entities.clear(),
    db.entityLists.clear(),
    db.metadata.clear(),
    db.drafts.clear(),
  ]);
  console.log('[Dexie] All data cleared');
}

/**
 * Clear only the 4-layer normalized cache
 */
export async function clearNormalizedCache(): Promise<void> {
  await Promise.all([
    db.entityTypes.clear(),
    db.entityInstances.clear(),
    db.entityLinksForward.clear(),
    db.entityLinksReverse.clear(),
    db.entityLinksRaw.clear(),
    db.entityInstanceNames.clear(),
  ]);
  console.log('[Dexie] Normalized cache cleared');
}

/**
 * Clear stale data older than maxAge
 */
export async function clearStaleData(maxAgeMs: number = 30 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;

  const staleEntities = await db.entities
    .where('syncedAt')
    .below(cutoff)
    .count();

  await db.entities.where('syncedAt').below(cutoff).delete();
  await db.entityLists.where('syncedAt').below(cutoff).delete();

  if (staleEntities > 0) {
    console.log(`[Dexie] Cleared ${staleEntities} stale entities`);
  }
}

/**
 * Get database stats for debugging
 */
export async function getDatabaseStats(): Promise<{
  // Layer 1-4
  entityTypes: number;
  entityInstances: number;
  entityLinksForward: number;
  entityLinksReverse: number;
  entityLinksRaw: number;
  entityInstanceNames: number;
  // Legacy
  entities: number;
  entityLists: number;
  metadata: number;
  drafts: number;
}> {
  const [
    entityTypes,
    entityInstances,
    entityLinksForward,
    entityLinksReverse,
    entityLinksRaw,
    entityInstanceNames,
    entities,
    entityLists,
    metadata,
    drafts,
  ] = await Promise.all([
    db.entityTypes.count(),
    db.entityInstances.count(),
    db.entityLinksForward.count(),
    db.entityLinksReverse.count(),
    db.entityLinksRaw.count(),
    db.entityInstanceNames.count(),
    db.entities.count(),
    db.entityLists.count(),
    db.metadata.count(),
    db.drafts.count(),
  ]);

  return {
    entityTypes,
    entityInstances,
    entityLinksForward,
    entityLinksReverse,
    entityLinksRaw,
    entityInstanceNames,
    entities,
    entityLists,
    metadata,
    drafts,
  };
}

// ============================================================================
// Link Index Management
// ============================================================================

/**
 * Build forward and reverse link indexes from raw links
 * Called after fetching all links from API
 */
export async function buildLinkIndexes(): Promise<{
  forwardCount: number;
  reverseCount: number;
}> {
  const rawLinks = await db.entityLinksRaw.toArray();

  // Build forward index: parent → children
  const forwardMap = new Map<string, EntityLinkForwardRecord>();

  // Build reverse index: child → parents
  const reverseMap = new Map<string, EntityLinkReverseRecord>();

  const now = Date.now();

  for (const link of rawLinks) {
    // Forward index key
    const forwardKey = createLinkForwardKey(
      link.entity_code,
      link.entity_instance_id,
      link.child_entity_code
    );

    if (!forwardMap.has(forwardKey)) {
      forwardMap.set(forwardKey, {
        _id: forwardKey,
        parentCode: link.entity_code,
        parentId: link.entity_instance_id,
        childCode: link.child_entity_code,
        childIds: [],
        relationships: {},
        syncedAt: now,
      });
    }
    const forward = forwardMap.get(forwardKey)!;
    if (!forward.childIds.includes(link.child_entity_instance_id)) {
      forward.childIds.push(link.child_entity_instance_id);
    }
    forward.relationships[link.child_entity_instance_id] = link.relationship_type;

    // Reverse index key
    const reverseKey = createLinkReverseKey(
      link.child_entity_code,
      link.child_entity_instance_id
    );

    if (!reverseMap.has(reverseKey)) {
      reverseMap.set(reverseKey, {
        _id: reverseKey,
        childCode: link.child_entity_code,
        childId: link.child_entity_instance_id,
        parents: [],
        syncedAt: now,
      });
    }
    const reverse = reverseMap.get(reverseKey)!;
    const parentExists = reverse.parents.some(
      p => p.entity_code === link.entity_code && p.entity_instance_id === link.entity_instance_id
    );
    if (!parentExists) {
      reverse.parents.push({
        entity_code: link.entity_code,
        entity_instance_id: link.entity_instance_id,
        relationship_type: link.relationship_type,
      });
    }
  }

  // Bulk write to Dexie
  await db.entityLinksForward.bulkPut(Array.from(forwardMap.values()));
  await db.entityLinksReverse.bulkPut(Array.from(reverseMap.values()));

  return {
    forwardCount: forwardMap.size,
    reverseCount: reverseMap.size,
  };
}

/**
 * Get child entity IDs from forward link index
 * O(1) lookup - no API call needed
 */
export async function getChildIdsFromCache(
  parentCode: string,
  parentId: string,
  childCode: string
): Promise<string[] | null> {
  const key = createLinkForwardKey(parentCode, parentId, childCode);
  const record = await db.entityLinksForward.get(key);
  return record?.childIds ?? null;
}

/**
 * Get parent entities from reverse link index
 * O(1) lookup - no API call needed
 */
export async function getParentsFromCache(
  childCode: string,
  childId: string
): Promise<Array<{ entity_code: string; entity_instance_id: string; relationship_type: string }> | null> {
  const key = createLinkReverseKey(childCode, childId);
  const record = await db.entityLinksReverse.get(key);
  return record?.parents ?? null;
}

/**
 * Get entity instance name from cache
 * O(1) lookup
 */
export async function getEntityInstanceNameFromCache(
  entityCode: string,
  entityInstanceId: string
): Promise<string | null> {
  const key = createEntityInstanceNameKey(entityCode, entityInstanceId);
  const record = await db.entityInstanceNames.get(key);
  return record?.entityInstanceName ?? null;
}

/**
 * Get all entity instance names for a type
 * Returns map: { uuid: name }
 */
export async function getEntityInstanceNamesForType(
  entityCode: string
): Promise<Record<string, string>> {
  const records = await db.entityInstanceNames
    .where('entityCode')
    .equals(entityCode)
    .toArray();

  const result: Record<string, string> = {};
  for (const record of records) {
    result[record.entityInstanceId] = record.entityInstanceName;
  }
  return result;
}
