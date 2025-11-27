/**
 * RxDB Database Initialization
 *
 * Creates and configures the local-first database with:
 * - 27+ entity collections (synced with backend)
 * - Metadata collections (datalabels, entity types)
 * - Local documents (RxState for UI state)
 *
 * ARCHITECTURE:
 * - Replaces React Query (data cache) with RxDB collections
 * - Replaces Zustand stores with RxDB local documents
 * - Provides offline-first, persistent cache with background sync
 */
import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBLocalDocumentsPlugin } from 'rxdb/plugins/local-documents';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';

// Schema imports
import {
  projectSchema,
  taskSchema,
  employeeSchema,
  datalabelSchema,
  entityTypeSchema,
} from './schemas';

import type {
  ProjectDoc,
  TaskDoc,
  EmployeeDoc,
  DatalabelDoc,
  EntityTypeDoc,
} from './schemas';

// ============================================================================
// Plugin Setup
// ============================================================================

// Add RxDB plugins
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBLocalDocumentsPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);

// Dev mode plugin (development only - adds validation warnings)
if (import.meta.env.DEV) {
  import('rxdb/plugins/dev-mode').then(({ RxDBDevModePlugin }) => {
    addRxPlugin(RxDBDevModePlugin);
  });
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * All entity collections in the database
 */
export interface PMODatabaseCollections {
  // Entity data collections (synced with backend)
  project: RxCollection<ProjectDoc>;
  task: RxCollection<TaskDoc>;
  employee: RxCollection<EmployeeDoc>;

  // Metadata collections (synced, pull-only)
  datalabel: RxCollection<DatalabelDoc>;
  entity_type: RxCollection<EntityTypeDoc>;
}

/**
 * PMO Database type with all collections
 */
export type PMODatabase = RxDatabase<PMODatabaseCollections>;

// ============================================================================
// Database Instance Management
// ============================================================================

// Singleton database instance
let dbPromise: Promise<PMODatabase> | null = null;
let dbInstance: PMODatabase | null = null;

/**
 * Get or create the database instance
 *
 * This is lazy-loaded and cached for the lifetime of the app.
 * Call this after authentication to initialize the database.
 *
 * @returns Promise resolving to the database instance
 *
 * @example
 * const db = await getDatabase();
 * const projects = await db.project.find().exec();
 */
export async function getDatabase(): Promise<PMODatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = createPMODatabase();
  return dbPromise;
}

/**
 * Get the current database instance synchronously (if initialized)
 *
 * @returns Database instance or null if not yet initialized
 */
export function getDatabaseSync(): PMODatabase | null {
  return dbInstance;
}

/**
 * Create the PMO database with all collections
 */
async function createPMODatabase(): Promise<PMODatabase> {
  console.log('%c[RxDB] Creating database...', 'color: #7c3aed; font-weight: bold');

  const db = await createRxDatabase<PMODatabaseCollections>({
    name: 'pmo_db',                       // Database name in IndexedDB
    storage: getRxStorageDexie(),         // Use Dexie.js for IndexedDB
    multiInstance: true,                  // Allow multiple browser tabs
    eventReduce: true,                    // Optimize change events
    ignoreDuplicate: true,                // Allow re-creation after hot reload
    localDocuments: true                  // Enable RxState local documents
  });

  console.log('%c[RxDB] Database created, adding collections...', 'color: #7c3aed');

  // Add all entity collections
  await db.addCollections({
    // =========================================
    // Entity Data Collections (Synced with Backend)
    // =========================================
    project: {
      schema: projectSchema,
      localDocuments: true  // Enable local docs for edit state
    },
    task: {
      schema: taskSchema,
      localDocuments: true
    },
    employee: {
      schema: employeeSchema,
      localDocuments: true
    },

    // =========================================
    // Metadata Collections (Pull-Only Sync)
    // =========================================
    datalabel: {
      schema: datalabelSchema
    },
    entity_type: {
      schema: entityTypeSchema
    }
  });

  // Store reference for sync access
  dbInstance = db;

  console.log(
    '%c[RxDB] ✅ Added %d collections',
    'color: #22c55e; font-weight: bold',
    Object.keys(db.collections).length
  );

  return db;
}

/**
 * Destroy the database instance
 *
 * Call this on logout to clean up resources.
 * Data persists in IndexedDB until explicitly removed.
 */
export async function destroyDatabase(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.destroy();
      console.log('%c[RxDB] Database destroyed', 'color: #f97316');
    } catch (error) {
      console.error('[RxDB] Error destroying database:', error);
    } finally {
      dbPromise = null;
      dbInstance = null;
    }
  }
}

/**
 * Remove the database entirely from IndexedDB
 *
 * Use this for complete data reset (e.g., logout + clear data).
 */
export async function removeDatabase(): Promise<void> {
  await destroyDatabase();

  // Remove from IndexedDB
  const request = indexedDB.deleteDatabase('pmo_db');
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      console.log('%c[RxDB] Database removed from IndexedDB', 'color: #f97316');
      resolve();
    };
    request.onerror = () => {
      console.error('[RxDB] Error removing database');
      reject(request.error);
    };
  });
}

/**
 * Clear all data from collections (but keep schemas)
 *
 * Use this for testing or data reset without destroying the database.
 */
export async function clearAllCollections(): Promise<void> {
  const db = await getDatabase();

  const collectionNames = Object.keys(db.collections) as (keyof PMODatabaseCollections)[];

  for (const collectionName of collectionNames) {
    const collection = db.collections[collectionName];
    await collection.remove();
    console.log(`%c[RxDB] Cleared collection: ${collectionName}`, 'color: #f97316');
  }

  console.log('%c[RxDB] All collections cleared', 'color: #22c55e');
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return dbInstance !== null;
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  collections: Record<string, number>;
  totalDocuments: number;
}> {
  const db = await getDatabase();
  const stats: Record<string, number> = {};
  let total = 0;

  for (const [name, collection] of Object.entries(db.collections)) {
    const count = await collection.count().exec();
    stats[name] = count;
    total += count;
  }

  return {
    collections: stats,
    totalDocuments: total
  };
}

// Re-export types and schemas for convenience
export * from './schemas';
