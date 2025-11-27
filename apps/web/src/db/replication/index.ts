/**
 * RxDB Replication Setup
 *
 * Configures bidirectional sync between RxDB and backend REST API.
 *
 * Sync Strategy:
 * - Entity data: Pull + Push (bidirectional)
 * - Metadata (datalabels, entity_types): Pull only (reference data)
 * - Local documents: No sync (device-specific state)
 *
 * Conflict Resolution: Server wins (RBAC is authoritative)
 */
import type { RxReplicationState } from 'rxdb';
import type { PMODatabase } from '../index';
import { setupEntityReplication } from './entityReplication';
import { setupMetadataReplication } from './metadataReplication';

// ============================================================================
// State
// ============================================================================

// Active replication states (for cleanup)
const activeReplications: RxReplicationState<unknown, unknown>[] = [];

// ============================================================================
// Main Setup
// ============================================================================

/**
 * Setup replication for all collections
 *
 * @param db - RxDB database instance
 * @param authToken - JWT auth token for API requests
 */
export async function setupReplication(
  db: PMODatabase,
  authToken: string
): Promise<void> {
  console.log('%c[Replication] Setting up sync...', 'color: #7c3aed; font-weight: bold');

  // Stop any existing replications
  await stopAllReplications();

  // =========================================
  // Entity Collections (Bidirectional Sync)
  // =========================================
  const entityCollections = ['project', 'task', 'employee'] as const;

  for (const collectionName of entityCollections) {
    const collection = db.collections[collectionName];
    if (collection) {
      const replication = setupEntityReplication(
        collection,
        collectionName,
        authToken
      );
      activeReplications.push(replication);
    }
  }

  // =========================================
  // Metadata Collections (Pull-Only Sync)
  // =========================================
  const metadataReplications = setupMetadataReplication(db, authToken);
  activeReplications.push(...metadataReplications);

  console.log(
    '%c[Replication] ✅ Setup complete for %d collections',
    'color: #22c55e; font-weight: bold',
    activeReplications.length
  );
}

/**
 * Stop all active replications
 *
 * Call this on logout or when changing auth context.
 */
export async function stopAllReplications(): Promise<void> {
  if (activeReplications.length === 0) {
    return;
  }

  console.log(
    '%c[Replication] Stopping %d replications...',
    'color: #f97316',
    activeReplications.length
  );

  for (const replication of activeReplications) {
    try {
      await replication.cancel();
    } catch (error) {
      console.error('[Replication] Error stopping replication:', error);
    }
  }

  activeReplications.length = 0;
  console.log('%c[Replication] All replications stopped', 'color: #f97316');
}

/**
 * Get active replication count
 */
export function getActiveReplicationCount(): number {
  return activeReplications.length;
}

/**
 * Check if a specific collection is syncing
 */
export function isCollectionSyncing(collectionName: string): boolean {
  return activeReplications.some(r =>
    r.collection.name === collectionName && !r.isStopped()
  );
}

/**
 * Force sync all collections
 */
export async function forceSyncAll(): Promise<void> {
  console.log('%c[Replication] Forcing sync for all collections...', 'color: #7c3aed');

  for (const replication of activeReplications) {
    try {
      await replication.reSync();
    } catch (error) {
      console.error(`[Replication] Force sync failed for ${replication.collection.name}:`, error);
    }
  }
}

// Re-export sub-modules
export { setupEntityReplication } from './entityReplication';
export { setupMetadataReplication } from './metadataReplication';
