// ============================================================================
// RxDB Database Configuration
// ============================================================================
// Provides offline-first, persistent storage with automatic sync
// ============================================================================

import {
  createRxDatabase,
  addRxPlugin,
  type RxDatabase,
  type RxCollection,
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';

import { entitySchema, type EntityDocType } from './schemas/entity.schema';
import { draftSchema, type DraftDocType } from './schemas/draft.schema';
import { metadataSchema, type MetadataDocType } from './schemas/metadata.schema';

// Add plugins
addRxPlugin(RxDBLeaderElectionPlugin);  // Multi-tab sync via leader election
addRxPlugin(RxDBQueryBuilderPlugin);     // Query builder support
addRxPlugin(RxDBUpdatePlugin);           // Update plugin for atomic updates

// Development mode: Add dev-mode plugin
if (import.meta.env.DEV) {
  import('rxdb/plugins/dev-mode').then(({ RxDBDevModePlugin }) => {
    addRxPlugin(RxDBDevModePlugin);
  });
}

// ============================================================================
// Collection Types
// ============================================================================

export type EntityCollection = RxCollection<EntityDocType>;
export type DraftCollection = RxCollection<DraftDocType>;
export type MetadataCollection = RxCollection<MetadataDocType>;

export interface DatabaseCollections {
  entities: EntityCollection;
  drafts: DraftCollection;
  metadata: MetadataCollection;
}

export type PMODatabase = RxDatabase<DatabaseCollections>;

// ============================================================================
// Database Instance (Singleton)
// ============================================================================

let dbPromise: Promise<PMODatabase> | null = null;

/**
 * Get or create the RxDB database instance
 * Uses IndexedDB (Dexie) for persistence
 */
export async function getDatabase(): Promise<PMODatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = createDatabase();
  return dbPromise;
}

/**
 * Create a new RxDB database
 */
async function createDatabase(): Promise<PMODatabase> {
  console.log('[RxDB] Creating database...');

  const storage = wrappedValidateAjvStorage({
    storage: getRxStorageDexie(),
  });

  const db = await createRxDatabase<DatabaseCollections>({
    name: 'pmo_db',
    storage,
    multiInstance: true,      // Enable multi-tab support
    eventReduce: true,        // Optimize event handling
    cleanupPolicy: {
      minimumDeletedTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      minimumCollectionAge: 1000 * 60 * 60 * 24,   // 1 day
      runEach: 1000 * 60 * 60,                      // Run every hour
      awaitReplicationsInSync: true,
      waitForLeadership: true,
    },
  });

  console.log('[RxDB] Database created, adding collections...');

  // Add collections
  await db.addCollections({
    entities: {
      schema: entitySchema,
      migrationStrategies: {
        // Migration from version 0 to 1 (if needed)
        1: (oldDoc) => oldDoc,
      },
    },
    drafts: {
      schema: draftSchema,
    },
    metadata: {
      schema: metadataSchema,
    },
  });

  console.log('[RxDB] Collections added successfully');

  // Set up leader election callback
  db.waitForLeadership().then(() => {
    console.log('[RxDB] This tab is now the leader');
  });

  return db;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.destroy();
    dbPromise = null;
    console.log('[RxDB] Database closed');
  }
}

/**
 * Clear all data from the database
 */
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.remove();
  dbPromise = null;
  console.log('[RxDB] Database cleared');
}
