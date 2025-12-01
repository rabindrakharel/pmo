// ============================================================================
// Unified Dexie Schema (v5)
// ============================================================================
// IndexedDB persistence layer with 8 tables
// Unified naming between TanStack Query keys and Dexie tables
// ============================================================================

import Dexie, { type Table } from 'dexie';
import { DEXIE_CONFIG } from '../cache/constants';
import type {
  EntityCode,
  DatalabelOption,
  ViewFieldMetadata,
  EditFieldMetadata,
} from '../cache/stores';

// ============================================================================
// RECORD INTERFACES
// ============================================================================

/**
 * Global settings record (singleton)
 */
export interface GlobalSettingsRecord {
  /** Primary key: 'settings' */
  _id: string;
  settings: Record<string, unknown>;
  syncedAt: number;
}

/**
 * Datalabel record
 */
export interface DatalabelRecord {
  /** Primary key: datalabel key (e.g., 'project_stage') */
  _id: string;
  key: string;
  options: DatalabelOption[];
  syncedAt: number;
}

/**
 * Entity codes record (singleton)
 */
export interface EntityCodesRecord {
  /** Primary key: 'all' */
  _id: string;
  codes: EntityCode[];
  syncedAt: number;
}

/**
 * Entity instance name record
 */
export interface EntityInstanceNameRecord {
  /** Composite key: `${entityCode}:${entityInstanceId}` */
  _id: string;
  entityCode: string;
  entityInstanceId: string;
  entityInstanceName: string;
  instanceCode?: string | null;
  syncedAt: number;
}

/**
 * Entity link forward record
 */
export interface EntityLinkForwardRecord {
  /** Composite key: `${parentCode}:${parentId}:${childCode}` */
  _id: string;
  parentCode: string;
  parentId: string;
  childCode: string;
  childIds: string[];
  relationships: Record<string, string>;
  syncedAt: number;
}

/**
 * Entity instance metadata record
 */
export interface EntityInstanceMetadataRecord {
  /** Primary key: entityCode */
  _id: string;
  entityCode: string;
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  syncedAt: number;
}

/**
 * Entity instance data record (query results)
 */
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

/**
 * Draft record (unsaved form edits)
 */
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
 * v5: Unified Cache Architecture - 8 tables
 *
 * Session-level stores (prefetched at login):
 * - globalSettings: App-wide settings (singleton)
 * - datalabel: Settings dropdown options
 * - entityCodes: Entity type definitions (singleton)
 * - entityInstanceNames: UUID → name lookups
 * - entityLinks: Parent-child relationships (forward index)
 * - entityInstanceMetadata: Field definitions per entity type
 *
 * On-demand stores (fetched when needed):
 * - entityInstanceData: Query results with pagination
 *
 * User data:
 * - draft: Unsaved form edits with undo/redo
 *
 * Features:
 * - Automatic multi-tab sync via IndexedDB
 * - Unified naming with TanStack Query keys
 * - Delta sync support with timestamps
 * - Small bundle size (~25KB)
 */
export class PMODatabase extends Dexie {
  // Session-level stores
  globalSettings!: Table<GlobalSettingsRecord, string>;
  datalabel!: Table<DatalabelRecord, string>;
  entityCodes!: Table<EntityCodesRecord, string>;
  entityInstanceNames!: Table<EntityInstanceNameRecord, string>;
  entityLinks!: Table<EntityLinkForwardRecord, string>;
  entityInstanceMetadata!: Table<EntityInstanceMetadataRecord, string>;

  // On-demand stores
  entityInstanceData!: Table<EntityInstanceDataRecord, string>;

  // User data
  draft!: Table<DraftRecord, string>;

  constructor() {
    super(DEXIE_CONFIG.dbName);

    this.version(1).stores({
      // Session-level stores
      globalSettings: '_id',
      datalabel: '_id, key',
      entityCodes: '_id',
      entityInstanceNames: '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',
      entityLinks: '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',
      entityInstanceMetadata: '_id, entityCode',

      // On-demand stores
      entityInstanceData: '_id, entityCode, queryHash, syncedAt',

      // User data
      draft: '_id, entityCode, entityId, updatedAt',
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const db = new PMODatabase();

// ============================================================================
// DATABASE UTILITIES
// ============================================================================

/**
 * Clear all cached data (for logout)
 * Note: Drafts are NOT cleared - they survive logout
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.globalSettings.clear(),
    db.datalabel.clear(),
    db.entityCodes.clear(),
    db.entityInstanceNames.clear(),
    db.entityLinks.clear(),
    db.entityInstanceMetadata.clear(),
    db.entityInstanceData.clear(),
    // Note: draft table is NOT cleared - drafts survive logout
  ]);
  console.log('[Dexie] All cache data cleared');
}

/**
 * Clear stale data older than maxAge
 */
export async function clearStaleData(maxAgeMs: number = DEXIE_CONFIG.maxAge): Promise<number> {
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
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  globalSettings: number;
  datalabel: number;
  entityCodes: number;
  entityInstanceNames: number;
  entityLinks: number;
  entityInstanceMetadata: number;
  entityInstanceData: number;
  draft: number;
  total: number;
}> {
  const [
    globalSettings,
    datalabel,
    entityCodes,
    entityInstanceNames,
    entityLinks,
    entityInstanceMetadata,
    entityInstanceData,
    draft,
  ] = await Promise.all([
    db.globalSettings.count(),
    db.datalabel.count(),
    db.entityCodes.count(),
    db.entityInstanceNames.count(),
    db.entityLinks.count(),
    db.entityInstanceMetadata.count(),
    db.entityInstanceData.count(),
    db.draft.count(),
  ]);

  return {
    globalSettings,
    datalabel,
    entityCodes,
    entityInstanceNames,
    entityLinks,
    entityInstanceMetadata,
    entityInstanceData,
    draft,
    total:
      globalSettings +
      datalabel +
      entityCodes +
      entityInstanceNames +
      entityLinks +
      entityInstanceMetadata +
      entityInstanceData +
      draft,
  };
}

/**
 * Clear all drafts (use with caution)
 */
export async function clearAllDrafts(): Promise<void> {
  await db.draft.clear();
  console.log('[Dexie] All drafts cleared');
}
