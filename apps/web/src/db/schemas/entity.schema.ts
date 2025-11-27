/**
 * Base Entity Schema Factory
 *
 * Creates RxDB schemas for any entity type with standard fields.
 * All 27+ PMO entities extend this base schema.
 *
 * RxDB Requirements:
 * - primaryKey: string field with maxLength
 * - _deleted: boolean for soft-delete sync
 * - indexes: array of field names for query optimization
 */
import type { RxJsonSchema } from 'rxdb';

/**
 * Base fields present on all entity documents
 */
export interface BaseEntityDoc {
  id: string;                           // UUID primary key
  code?: string | null;                 // Business code (e.g., 'PROJ-001')
  name: string;                         // Display name
  descr?: string | null;                // Description
  active_flag: boolean;                 // Soft delete flag
  metadata?: Record<string, unknown>;   // JSONB extension field
  created_ts: string;                   // ISO timestamp
  updated_ts: string;                   // ISO timestamp
  version: number;                      // Optimistic locking

  // RxDB sync fields
  _deleted: boolean;                    // Deleted flag for replication
  _rev?: string;                        // Revision for conflict detection
}

/**
 * Schema property definition for additional fields
 */
export interface SchemaProperty {
  type: string | string[];
  maxLength?: number;
  format?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  additionalProperties?: boolean;
  enum?: string[];
}

/**
 * Create a generic RxDB schema for an entity collection
 *
 * @param entityCode - Entity type code (e.g., 'project')
 * @param additionalProperties - Entity-specific fields beyond base fields
 * @param additionalIndexes - Entity-specific indexes
 * @returns RxJsonSchema configured for the entity
 *
 * @example
 * const projectSchema = createEntitySchema('project', {
 *   budget_allocated_amt: { type: ['number', 'null'] },
 *   manager__employee_id: { type: ['string', 'null'], maxLength: 36 }
 * }, ['manager__employee_id', 'dl__project_stage']);
 */
export function createEntitySchema<T extends BaseEntityDoc>(
  entityCode: string,
  additionalProperties: Record<string, SchemaProperty> = {},
  additionalIndexes: (string | string[])[] = []
): RxJsonSchema<T> {
  return {
    version: 0,  // Increment for schema migrations
    primaryKey: 'id',
    type: 'object',
    properties: {
      // ========================================
      // Base Fields (all entities have these)
      // ========================================
      id: {
        type: 'string',
        maxLength: 36  // UUID length
      },
      code: {
        type: ['string', 'null'],
        maxLength: 100
      },
      name: {
        type: 'string',
        maxLength: 500
      },
      descr: {
        type: ['string', 'null'],
        maxLength: 10000
      },
      active_flag: {
        type: 'boolean',
        default: true
      },
      metadata: {
        type: 'object',
        properties: {},
        additionalProperties: true
      },
      created_ts: {
        type: 'string',
        format: 'date-time'
      },
      updated_ts: {
        type: 'string',
        format: 'date-time'
      },
      version: {
        type: 'integer',
        minimum: 1,
        default: 1
      },

      // ========================================
      // RxDB Sync Fields
      // ========================================
      _deleted: {
        type: 'boolean',
        default: false
      },
      _rev: {
        type: 'string'
      },

      // ========================================
      // Entity-Specific Fields
      // ========================================
      ...additionalProperties
    } as Record<string, SchemaProperty>,
    required: ['id', 'name', 'active_flag', '_deleted'],
    indexes: [
      // Base indexes (all entities)
      'code',
      'active_flag',
      'updated_ts',
      ['active_flag', 'updated_ts'],  // Compound index for sync queries

      // Entity-specific indexes
      ...additionalIndexes
    ]
  } as RxJsonSchema<T>;
}

/**
 * Standard reference field schema (UUID foreign key)
 */
export const referenceFieldSchema: SchemaProperty = {
  type: ['string', 'null'],
  maxLength: 36
};

/**
 * Standard datalabel field schema (dl__* fields)
 */
export const datalabelFieldSchema: SchemaProperty = {
  type: ['string', 'null'],
  maxLength: 100
};

/**
 * Standard currency amount field schema
 */
export const currencyFieldSchema: SchemaProperty = {
  type: ['number', 'null']
};

/**
 * Standard date field schema
 */
export const dateFieldSchema: SchemaProperty = {
  type: ['string', 'null'],
  format: 'date'
};

/**
 * Standard timestamp field schema
 */
export const timestampFieldSchema: SchemaProperty = {
  type: ['string', 'null'],
  format: 'date-time'
};

/**
 * Standard array of references field schema
 */
export const referenceArrayFieldSchema: SchemaProperty = {
  type: 'array',
  items: {
    type: 'string',
    maxLength: 36
  }
};
