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

  // Field metadata for rendering
  metadata?: {
    viewType?: Record<string, unknown>;
    editType?: Record<string, unknown>;
  };

  // Sync tracking
  _version: number;            // Server version for conflict resolution
  _syncedAt: number;           // Last sync timestamp (ms)
  _localUpdatedAt?: number;    // Local update timestamp (for dirty tracking)

  // Soft delete
  _deleted: boolean;
}

/**
 * RxDB Schema for entities collection
 */
export const entitySchema: RxJsonSchema<EntityDocType> = {
  version: 0,
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
      properties: {
        viewType: { type: 'object', additionalProperties: true },
        editType: { type: 'object', additionalProperties: true },
      },
    },
    _version: {
      type: 'integer',
      minimum: 0,
      default: 0,
    },
    _syncedAt: {
      type: 'integer',
      minimum: 0,
    },
    _localUpdatedAt: {
      type: 'integer',
      minimum: 0,
    },
    _deleted: {
      type: 'boolean',
      default: false,
    },
  },
  required: ['_id', 'entityCode', 'id', 'data', '_version', '_syncedAt', '_deleted'],
  indexes: [
    'entityCode',
    ['entityCode', '_syncedAt'],
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
