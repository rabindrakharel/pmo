/**
 * Metadata Replication Handler
 *
 * Configures pull-only sync for metadata collections:
 * - datalabel: Dropdown options for dl__* fields
 * - entity_type: Entity definitions for sidebar/navigation
 *
 * These are reference data that rarely change, so we use:
 * - Pull-only (no push)
 * - Longer intervals between syncs
 * - Full refresh on each pull (not incremental)
 */
import { replicateRxCollection } from 'rxdb/plugins/replication';
import type { RxReplicationState } from 'rxdb';
import axios from 'axios';
import type { PMODatabase } from '../index';
import type { DatalabelDoc } from '../schemas/datalabel.schema';
import type { EntityTypeDoc } from '../schemas/entityType.schema';
import { createDatalabelId } from '../schemas/datalabel.schema';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const DATALABEL_SYNC_INTERVAL = 15 * 60 * 1000; // 15 minutes
const ENTITY_TYPE_SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour

// ============================================================================
// Main Setup
// ============================================================================

/**
 * Setup pull-only replication for metadata collections
 *
 * @param db - RxDB database instance
 * @param authToken - JWT auth token
 * @returns Array of replication states
 */
export function setupMetadataReplication(
  db: PMODatabase,
  authToken: string
): RxReplicationState<unknown, unknown>[] {
  const replications: RxReplicationState<unknown, unknown>[] = [];

  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Datalabel replication
  const datalabelReplication = setupDatalabelReplication(
    db.datalabel,
    apiClient
  );
  replications.push(datalabelReplication as RxReplicationState<unknown, unknown>);

  // Entity type replication
  const entityTypeReplication = setupEntityTypeReplication(
    db.entity_type,
    apiClient
  );
  replications.push(entityTypeReplication as RxReplicationState<unknown, unknown>);

  return replications;
}

// ============================================================================
// Datalabel Replication
// ============================================================================

interface DatalabelApiResponse {
  name: string;
  label?: string;
  icon?: string;
  options: Array<{
    id: number;
    name: string;
    descr?: string;
    color_code?: string;
    sort_order: number;
    parent_ids?: number[];
    active_flag?: boolean;
  }>;
}

function setupDatalabelReplication(
  collection: PMODatabase['datalabel'],
  apiClient: ReturnType<typeof axios.create>
): RxReplicationState<DatalabelDoc, { updatedAt: string }> {
  console.log('[Replication] Setting up datalabel sync');

  return replicateRxCollection({
    collection,
    replicationIdentifier: 'rest-datalabel',
    deletedField: '_deleted',

    pull: {
      async handler(_checkpoint, _batchSize) {
        try {
          const response = await apiClient.get<DatalabelApiResponse[]>(
            '/api/v1/datalabel/all'
          );

          // Transform datalabel API response to RxDB documents
          const documents: DatalabelDoc[] = [];

          for (const dl of response.data) {
            for (const opt of dl.options) {
              documents.push({
                id: createDatalabelId(dl.name, opt.id),
                datalabel_key: dl.name,
                option_id: opt.id,
                name: opt.name,
                descr: opt.descr ?? null,
                color_code: opt.color_code ?? null,
                sort_order: opt.sort_order,
                parent_ids: opt.parent_ids || [],
                active_flag: opt.active_flag !== false,
                _deleted: false
              });
            }
          }

          return {
            documents,
            checkpoint: { updatedAt: new Date().toISOString() }
          };
        } catch (error) {
          console.error('[Replication] Datalabel pull failed:', error);
          throw error;
        }
      },
      batchSize: 1000,  // Get all at once
      modifier: (doc) => doc
    },

    // No push - read-only reference data
    push: undefined,

    autoStart: true,
    live: false,  // Don't continuously poll
    retryTime: DATALABEL_SYNC_INTERVAL
  });
}

// ============================================================================
// Entity Type Replication
// ============================================================================

interface EntityTypeApiResponse {
  code: string;
  name: string;
  label: string;
  icon?: string;
  descr?: string;
  child_entity_codes?: string[];
  parent_entity_codes?: string[];
  active_flag: boolean;
}

function setupEntityTypeReplication(
  collection: PMODatabase['entity_type'],
  apiClient: ReturnType<typeof axios.create>
): RxReplicationState<EntityTypeDoc, { updatedAt: string }> {
  console.log('[Replication] Setting up entity_type sync');

  return replicateRxCollection({
    collection,
    replicationIdentifier: 'rest-entity-type',
    deletedField: '_deleted',

    pull: {
      async handler(_checkpoint, _batchSize) {
        try {
          const response = await apiClient.get<EntityTypeApiResponse[]>(
            '/api/v1/entity/types'
          );

          const documents: EntityTypeDoc[] = response.data.map(entity => ({
            code: entity.code,
            name: entity.name,
            label: entity.label,
            icon: entity.icon ?? null,
            descr: entity.descr ?? null,
            child_entity_codes: entity.child_entity_codes || [],
            parent_entity_codes: entity.parent_entity_codes || [],
            active_flag: entity.active_flag,
            _deleted: false
          }));

          return {
            documents,
            checkpoint: { updatedAt: new Date().toISOString() }
          };
        } catch (error) {
          console.error('[Replication] Entity type pull failed:', error);
          throw error;
        }
      },
      batchSize: 100,
      modifier: (doc) => doc
    },

    // No push - read-only reference data
    push: undefined,

    autoStart: true,
    live: false,
    retryTime: ENTITY_TYPE_SYNC_INTERVAL
  });
}

// ============================================================================
// Manual Sync Functions
// ============================================================================

/**
 * Force refresh datalabels from server
 */
export async function forceDatalabelSync(
  db: PMODatabase,
  authToken: string
): Promise<void> {
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${authToken}` }
  });

  const response = await apiClient.get<DatalabelApiResponse[]>(
    '/api/v1/datalabel/all'
  );

  const documents: DatalabelDoc[] = [];
  for (const dl of response.data) {
    for (const opt of dl.options) {
      documents.push({
        id: createDatalabelId(dl.name, opt.id),
        datalabel_key: dl.name,
        option_id: opt.id,
        name: opt.name,
        descr: opt.descr ?? null,
        color_code: opt.color_code ?? null,
        sort_order: opt.sort_order,
        parent_ids: opt.parent_ids || [],
        active_flag: opt.active_flag !== false,
        _deleted: false
      });
    }
  }

  await db.datalabel.bulkUpsert(documents);
  console.log(`[Replication] Force synced ${documents.length} datalabel options`);
}

/**
 * Force refresh entity types from server
 */
export async function forceEntityTypeSync(
  db: PMODatabase,
  authToken: string
): Promise<void> {
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: { Authorization: `Bearer ${authToken}` }
  });

  const response = await apiClient.get<EntityTypeApiResponse[]>(
    '/api/v1/entity/types'
  );

  const documents: EntityTypeDoc[] = response.data.map(entity => ({
    code: entity.code,
    name: entity.name,
    label: entity.label,
    icon: entity.icon ?? null,
    descr: entity.descr ?? null,
    child_entity_codes: entity.child_entity_codes || [],
    parent_entity_codes: entity.parent_entity_codes || [],
    active_flag: entity.active_flag,
    _deleted: false
  }));

  await db.entity_type.bulkUpsert(documents);
  console.log(`[Replication] Force synced ${documents.length} entity types`);
}
