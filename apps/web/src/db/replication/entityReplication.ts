/**
 * Entity Replication Handler
 *
 * Configures bidirectional sync for entity collections (project, task, etc.)
 *
 * Sync Flow:
 * 1. Pull: GET /api/v1/{entity}/sync?since={timestamp}
 * 2. Push: POST/PATCH/DELETE /api/v1/{entity}/{id}
 *
 * Conflict Resolution: Server wins (RBAC is authoritative)
 */
import { replicateRxCollection } from 'rxdb/plugins/replication';
import type { RxCollection, RxReplicationState } from 'rxdb';
import axios from 'axios';

// ============================================================================
// Types
// ============================================================================

interface SyncCheckpoint {
  updatedAt: string;
}

interface SyncResponse<T> {
  data: T[];
  lastUpdatedAt: string;
  hasMore: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const PULL_BATCH_SIZE = 100;
const PUSH_BATCH_SIZE = 10;
const RETRY_INTERVAL = 5000; // 5 seconds

// ============================================================================
// Main Setup
// ============================================================================

/**
 * Setup bidirectional replication for an entity collection
 *
 * @param collection - RxDB collection
 * @param entityCode - Entity type code (e.g., 'project')
 * @param authToken - JWT auth token
 * @returns RxReplicationState
 */
export function setupEntityReplication<T>(
  collection: RxCollection<T>,
  entityCode: string,
  authToken: string
): RxReplicationState<T, SyncCheckpoint> {
  console.log(`[Replication] Setting up sync for ${entityCode}`);

  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  return replicateRxCollection({
    collection,
    replicationIdentifier: `rest-${entityCode}`,
    deletedField: '_deleted',

    // =========================================
    // Pull Changes from Server
    // =========================================
    pull: {
      async handler(checkpointOrNull, batchSize) {
        const checkpoint = checkpointOrNull as SyncCheckpoint | null;
        const since = checkpoint?.updatedAt || '1970-01-01T00:00:00.000Z';

        try {
          const response = await apiClient.get<SyncResponse<T>>(
            `/api/v1/${entityCode}/sync`,
            {
              params: { since, limit: batchSize }
            }
          );

          const documents = response.data.data.map((doc: T & { active_flag?: boolean }) => ({
            ...doc,
            _deleted: doc.active_flag === false
          }));

          return {
            documents,
            checkpoint: {
              updatedAt: response.data.lastUpdatedAt || new Date().toISOString()
            }
          };
        } catch (error) {
          console.error(`[Replication] Pull failed for ${entityCode}:`, error);
          throw error;
        }
      },
      batchSize: PULL_BATCH_SIZE,
      modifier: (doc) => doc
    },

    // =========================================
    // Push Changes to Server
    // =========================================
    push: {
      async handler(docs) {
        const results: T[] = [];

        for (const docData of docs) {
          const doc = docData.newDocumentState as T & {
            id: string;
            _deleted?: boolean;
          };

          try {
            if (doc._deleted) {
              // Soft delete
              await apiClient.delete(`/api/v1/${entityCode}/${doc.id}`);
              results.push(doc);
            } else if (!docData.assumedMasterState) {
              // New document (INSERT)
              const response = await apiClient.post(`/api/v1/${entityCode}`, doc);
              results.push(response.data);
            } else {
              // Update (PATCH)
              const response = await apiClient.patch(
                `/api/v1/${entityCode}/${doc.id}`,
                doc
              );
              results.push(response.data);
            }
          } catch (error: unknown) {
            const axiosError = error as { response?: { status?: number } };
            console.error(
              `[Replication] Push failed for ${entityCode}/${doc.id}:`,
              error
            );

            // Permission denied - don't retry
            if (axiosError.response?.status === 403) {
              console.warn(
                `[Replication] Permission denied for ${doc.id}, skipping`
              );
              continue;
            }

            throw error;
          }
        }

        return results;
      },
      batchSize: PUSH_BATCH_SIZE
    },

    // =========================================
    // Conflict Resolution
    // =========================================
    conflictHandler: async (input) => {
      console.warn(
        `[Replication] Conflict detected for ${entityCode}:`,
        input.documentId
      );
      // Server wins - return the master state
      return input.realMasterState;
    },

    // =========================================
    // Options
    // =========================================
    autoStart: true,
    retryTime: RETRY_INTERVAL,
    live: true  // Keep syncing continuously
  });
}

/**
 * Create a minimal sync endpoint handler for testing
 * (Backend should implement /api/v1/{entity}/sync)
 */
export function getSyncEndpointSpec(entityCode: string) {
  return {
    path: `/api/v1/${entityCode}/sync`,
    method: 'GET',
    queryParams: {
      since: 'ISO timestamp (optional, defaults to epoch)',
      limit: 'number (optional, defaults to 100)'
    },
    response: {
      data: `Array of ${entityCode} documents`,
      lastUpdatedAt: 'ISO timestamp of most recent document',
      hasMore: 'boolean indicating more documents available'
    },
    notes: [
      'Returns ALL documents modified since `since` timestamp',
      'Includes soft-deleted documents (active_flag: false)',
      'RBAC filtering still applies',
      'Order by updated_ts ASC'
    ]
  };
}
