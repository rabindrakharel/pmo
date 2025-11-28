// ============================================================================
// Dexie Database Schema
// ============================================================================
// Lightweight IndexedDB wrapper for offline-first persistence
// Simple, smaller footprint (~25KB vs previous solutions)
// ============================================================================

import Dexie, { type Table } from 'dexie';

// ============================================================================
// Types
// ============================================================================

/**
 * Cached entity record - stores individual entity data
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
  type: 'datalabel' | 'entityCodes' | 'globalSettings' | 'component';
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
 *
 * Features:
 * - Automatic multi-tab sync via IndexedDB
 * - Simple schema definition
 * - Reactive queries via useLiveQuery
 * - Small bundle size (~25KB)
 */
export class PMODatabase extends Dexie {
  entities!: Table<CachedEntity, string>;
  entityLists!: Table<CachedEntityList, string>;
  metadata!: Table<CachedMetadata, string>;
  drafts!: Table<CachedDraft, string>;

  constructor() {
    super('pmo-cache-v2');

    // Schema version 1
    // Only indexed fields need to be listed
    // Primary key is the first field (before comma)
    this.version(1).stores({
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
// Helper Functions
// ============================================================================

/**
 * Create entity cache key
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

/**
 * Clear all cached data (for logout)
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.entities.clear(),
    db.entityLists.clear(),
    db.metadata.clear(),
    db.drafts.clear(),
  ]);
  console.log('[Dexie] All data cleared');
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
  entities: number;
  entityLists: number;
  metadata: number;
  drafts: number;
}> {
  const [entities, entityLists, metadata, drafts] = await Promise.all([
    db.entities.count(),
    db.entityLists.count(),
    db.metadata.count(),
    db.drafts.count(),
  ]);

  return { entities, entityLists, metadata, drafts };
}
