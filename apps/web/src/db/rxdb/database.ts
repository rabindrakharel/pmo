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
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';

import { entitySchema, type EntityDocType } from './schemas/entity.schema';
import { draftSchema, type DraftDocType } from './schemas/draft.schema';
import { metadataSchema, type MetadataDocType } from './schemas/metadata.schema';

// Add plugins
addRxPlugin(RxDBLeaderElectionPlugin);  // Multi-tab sync via leader election
addRxPlugin(RxDBQueryBuilderPlugin);     // Query builder support
addRxPlugin(RxDBUpdatePlugin);           // Update plugin for atomic updates
addRxPlugin(RxDBMigrationSchemaPlugin);  // Schema migration support

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

// Schema version hash - change this when schemas have breaking changes
// This allows automatic database reset without manual IndexedDB clearing
// Bumped to v4 to store full metadata structure (metadata.entityDataTable.viewType)
const SCHEMA_VERSION = 'v4';

/**
 * Create a new RxDB database
 * Uses versioned database name to handle schema migrations cleanly
 */
async function createDatabase(): Promise<PMODatabase> {
  console.log('[RxDB] Creating database...');

  const dbName = `pmo_db_${SCHEMA_VERSION}`;

  const storage = wrappedValidateAjvStorage({
    storage: getRxStorageDexie(),
  });

  // In development, auto-reset on schema errors
  let db: PMODatabase;
  try {
    db = await createRxDatabase<DatabaseCollections>({
      name: dbName,
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
  } catch (error) {
    // If database creation fails (schema mismatch), try to recover
    console.warn('[RxDB] Database creation failed, attempting recovery...', error);

    // Delete the old database and try again
    const { deleteRxDatabase } = await import('rxdb');
    await deleteRxDatabase(dbName, storage);
    console.log('[RxDB] Old database deleted, creating fresh database...');

    db = await createRxDatabase<DatabaseCollections>({
      name: dbName,
      storage,
      multiInstance: true,
      eventReduce: true,
      cleanupPolicy: {
        minimumDeletedTime: 1000 * 60 * 60 * 24 * 7,
        minimumCollectionAge: 1000 * 60 * 60 * 24,
        runEach: 1000 * 60 * 60,
        awaitReplicationsInSync: true,
        waitForLeadership: true,
      },
    });
  }

  console.log('[RxDB] Database created, adding collections...');

  // Collection configurations
  // All schemas at version 0 - no migrations needed
  // When schema changes are needed, bump SCHEMA_VERSION instead
  const collectionConfigs = {
    entities: {
      schema: entitySchema,
    },
    drafts: {
      schema: draftSchema,
    },
    metadata: {
      schema: metadataSchema,
    },
  };

  // Add collections with auto-recovery on schema errors
  try {
    await db.addCollections(collectionConfigs);
  } catch (error) {
    console.warn('[RxDB] Collection creation failed, resetting database...', error);

    // Destroy current db and delete from storage
    await db.destroy();
    const { deleteRxDatabase } = await import('rxdb');
    await deleteRxDatabase(dbName, storage);

    // Create fresh database
    const freshDb = await createRxDatabase<DatabaseCollections>({
      name: dbName,
      storage,
      multiInstance: true,
      eventReduce: true,
      cleanupPolicy: {
        minimumDeletedTime: 1000 * 60 * 60 * 24 * 7,
        minimumCollectionAge: 1000 * 60 * 60 * 24,
        runEach: 1000 * 60 * 60,
        awaitReplicationsInSync: true,
        waitForLeadership: true,
      },
    });

    await freshDb.addCollections(collectionConfigs);
    console.log('[RxDB] Fresh database created successfully');

    freshDb.waitForLeadership().then(() => {
      console.log('[RxDB] This tab is now the leader');
    });

    return freshDb;
  }

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
