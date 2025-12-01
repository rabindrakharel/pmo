// ============================================================================
// Dexie Database Schema v5 - Unified Cache Architecture
// ============================================================================
// IndexedDB wrapper for offline-first persistence
// 8 tables matching the 7 unified stores + draft
// ============================================================================

import Dexie, { type Table } from 'dexie';
import type {
  GlobalSettings,
  DatalabelOption,
  EntityCode,
  EntityInstanceMetadata,
  LinkForwardIndex,
  LinkReverseIndex,
} from '../cache/types';

// ============================================================================
// Record Types (Dexie table schemas)
// ============================================================================

/**
 * Global settings record
 */
export interface GlobalSettingsRecord {
  /** Primary key: 'settings' */
  _id: string;
  settings: GlobalSettings;
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
 * Entity codes record (all entity types in one record)
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
  name: string;
  /** Business code (e.g., 'PROJ-001') */
  instanceCode?: string | null;
  syncedAt: number;
}

/**
 * Entity link forward index record
 */
export interface EntityLinkForwardRecord extends LinkForwardIndex {
  /** Composite key: `${parentCode}:${parentId}:${childCode}` */
  _id: string;
  syncedAt: number;
}

/**
 * Entity link reverse index record
 */
export interface EntityLinkReverseRecord extends LinkReverseIndex {
  /** Composite key: `${childCode}:${childId}` */
  _id: string;
  syncedAt: number;
}

/**
 * Entity instance metadata record
 */
export interface EntityInstanceMetadataRecord {
  /** Primary key: entityCode (e.g., 'project') */
  _id: string;
  entityCode: string;
  metadata: EntityInstanceMetadata;
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
  metadata?: EntityInstanceMetadata;
  refData?: Record<string, Record<string, string>>;
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
// Database Class
// ============================================================================

/**
 * PMO Database using Dexie (IndexedDB wrapper)
 * v5: Unified Cache Architecture
 *
 * Session-Level Stores (6 stores):
 * - globalSettings: App-wide settings
 * - datalabel: Dropdown options
 * - entityCodes: Entity type definitions
 * - entityInstanceNames: UUID -> name lookups
 * - entityLinkForward: Parent -> children index
 * - entityLinkReverse: Child -> parents index
 * - entityInstanceMetadata: Field definitions per entity type
 *
 * On-Demand Store (1 store):
 * - entityInstanceData: Query results with pagination
 *
 * Special Store (1 store):
 * - draft: Unsaved form edits with undo/redo (survives logout)
 *
 * Features:
 * - Automatic multi-tab sync via IndexedDB
 * - Unified naming with TanStack Query keys
 * - Delta sync support with timestamps
 * - Small bundle size (~25KB)
 */
export class CacheDatabase extends Dexie {
  // Session-Level Stores
  globalSettings!: Table<GlobalSettingsRecord, string>;
  datalabel!: Table<DatalabelRecord, string>;
  entityCodes!: Table<EntityCodesRecord, string>;
  entityInstanceNames!: Table<EntityInstanceNameRecord, string>;
  entityLinkForward!: Table<EntityLinkForwardRecord, string>;
  entityLinkReverse!: Table<EntityLinkReverseRecord, string>;
  entityInstanceMetadata!: Table<EntityInstanceMetadataRecord, string>;

  // On-Demand Store
  entityInstanceData!: Table<EntityInstanceDataRecord, string>;

  // Special Store
  draft!: Table<DraftRecord, string>;

  constructor() {
    super('pmo-cache-v5');

    this.version(1).stores({
      // Session-Level Stores
      globalSettings: '_id',
      datalabel: '_id, key',
      entityCodes: '_id',
      entityInstanceNames:
        '_id, entityCode, entityInstanceId, [entityCode+entityInstanceId]',
      entityLinkForward:
        '_id, parentCode, parentId, childCode, [parentCode+parentId+childCode]',
      entityLinkReverse: '_id, childCode, childId, [childCode+childId]',
      entityInstanceMetadata: '_id, entityCode',

      // On-Demand Store
      entityInstanceData: '_id, entityCode, queryHash, syncedAt',

      // Special Store
      draft: '_id, entityCode, entityId, updatedAt',
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const db = new CacheDatabase();

// ============================================================================
// Database Utilities
// ============================================================================

/**
 * Check if database is ready
 */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    await db.open();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  globalSettings: number;
  datalabel: number;
  entityCodes: number;
  entityInstanceNames: number;
  entityLinkForward: number;
  entityLinkReverse: number;
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
    entityLinkForward,
    entityLinkReverse,
    entityInstanceMetadata,
    entityInstanceData,
    draft,
  ] = await Promise.all([
    db.globalSettings.count(),
    db.datalabel.count(),
    db.entityCodes.count(),
    db.entityInstanceNames.count(),
    db.entityLinkForward.count(),
    db.entityLinkReverse.count(),
    db.entityInstanceMetadata.count(),
    db.entityInstanceData.count(),
    db.draft.count(),
  ]);

  return {
    globalSettings,
    datalabel,
    entityCodes,
    entityInstanceNames,
    entityLinkForward,
    entityLinkReverse,
    entityInstanceMetadata,
    entityInstanceData,
    draft,
    total:
      globalSettings +
      datalabel +
      entityCodes +
      entityInstanceNames +
      entityLinkForward +
      entityLinkReverse +
      entityInstanceMetadata +
      entityInstanceData +
      draft,
  };
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  db.close();
}
