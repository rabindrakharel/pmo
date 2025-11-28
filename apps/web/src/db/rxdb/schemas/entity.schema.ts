// ============================================================================
// Entity Schema for RxDB
// ============================================================================
// Generic entity storage for all entity types (project, task, employee, etc.)
// ============================================================================

import type { RxJsonSchema } from 'rxdb';

/**
 * Entity document type - stores any entity instance
 * Uses a composite key of entityCode + id for uniqueness
 */
export interface EntityDocType {
  // Composite primary key: entityCode:id
  _id: string;

  // Entity identification
  entityCode: string;          // Entity type (project, task, employee)
  id: string;                  // Entity instance UUID

  // Raw entity data from server
  data: Record<string, unknown>;

  // Reference data for entity lookups (from ref_data_entityInstance)
  refData?: Record<string, Record<string, string>>;

  // Field metadata for rendering (full structure from API)
  // Structure: { entityDataTable: { viewType, editType }, fields: [...] }
  metadata?: Record<string, unknown>;

  // Sync tracking (no underscore prefix - RxDB reserves _ for internal use)
  version: number;             // Server version for conflict resolution
  syncedAt: number;            // Last sync timestamp (ms)
  localUpdatedAt?: number;     // Local update timestamp (for dirty tracking)

  // Soft delete (RxDB reserved field)
  _deleted: boolean;
}

/**
 * RxDB Schema for entities collection
 */
export const entitySchema: RxJsonSchema<EntityDocType> = {
  version: 0,  // Reset to 0 with SCHEMA_VERSION='v2' in database.ts
  primaryKey: '_id',
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 150,  // entityCode:uuid format
    },
    entityCode: {
      type: 'string',
      maxLength: 50,
    },
    id: {
      type: 'string',
      maxLength: 100,
    },
    data: {
      type: 'object',
      additionalProperties: true,
    },
    refData: {
      type: 'object',
      additionalProperties: true,
    },
    metadata: {
      type: 'object',
      additionalProperties: true,  // Full metadata structure from API
    },
    version: {
      type: 'integer',
      minimum: 0,
      maximum: 9007199254740991,  // Number.MAX_SAFE_INTEGER
      multipleOf: 1,
      default: 0,
    },
    syncedAt: {
      type: 'integer',
      minimum: 0,
      maximum: 9007199254740991,  // Number.MAX_SAFE_INTEGER (timestamp in ms)
      multipleOf: 1,
    },
    localUpdatedAt: {
      type: 'integer',
      minimum: 0,
      maximum: 9007199254740991,  // Number.MAX_SAFE_INTEGER (timestamp in ms)
      multipleOf: 1,
    },
    _deleted: {
      type: 'boolean',
      default: false,
    },
  },
  required: ['_id', 'entityCode', 'id', 'data', 'version', 'syncedAt', '_deleted'],
  indexes: [
    'entityCode',
    ['entityCode', 'syncedAt'],
    ['entityCode', '_deleted'],
  ],
};

/**
 * Create composite ID for entity
 */
export function createEntityId(entityCode: string, id: string): string {
  return `${entityCode}:${id}`;
}

/**
 * Parse composite ID to extract entityCode and id
 */
export function parseEntityId(compositeId: string): { entityCode: string; id: string } {
  const [entityCode, ...idParts] = compositeId.split(':');
  return { entityCode, id: idParts.join(':') };
}
