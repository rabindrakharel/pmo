// ============================================================================
// Draft Schema for RxDB
// ============================================================================
// Persists unsaved edits so they survive page refresh
// ============================================================================

import type { RxJsonSchema } from 'rxdb';

/**
 * Draft document type - stores unsaved entity edits
 */
export interface DraftDocType {
  // Composite primary key: entityCode:entityId
  _id: string;

  // Entity identification
  entityCode: string;          // Entity type (project, task, employee)
  entityId: string;            // Entity instance UUID

  // Original data (from server at time of edit start)
  originalData: Record<string, unknown>;

  // Current edited data (with unsaved changes)
  currentData: Record<string, unknown>;

  // Fields that have been modified
  dirtyFields: string[];

  // Undo/redo stacks
  undoStack: Array<{ field: string; value: unknown }>;
  redoStack: Array<{ field: string; value: unknown }>;

  // Timestamps
  createdAt: number;           // When draft was created
  updatedAt: number;           // Last modification time

  // Soft delete (for cleanup)
  _deleted: boolean;
}

/**
 * RxDB Schema for drafts collection
 */
export const draftSchema: RxJsonSchema<DraftDocType> = {
  version: 0,  // Reset to 0 with SCHEMA_VERSION='v2' in database.ts
  primaryKey: '_id',
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 150,
    },
    entityCode: {
      type: 'string',
      maxLength: 50,
    },
    entityId: {
      type: 'string',
      maxLength: 100,
    },
    originalData: {
      type: 'object',
      additionalProperties: true,
    },
    currentData: {
      type: 'object',
      additionalProperties: true,
    },
    dirtyFields: {
      type: 'array',
      items: { type: 'string' },
      default: [],
    },
    undoStack: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          value: {},  // Any type
        },
      },
      default: [],
    },
    redoStack: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          value: {},  // Any type
        },
      },
      default: [],
    },
    createdAt: {
      type: 'integer',
      minimum: 0,
      maximum: 9007199254740991,  // Number.MAX_SAFE_INTEGER
      multipleOf: 1,
    },
    updatedAt: {
      type: 'integer',
      minimum: 0,
      maximum: 9007199254740991,  // Number.MAX_SAFE_INTEGER
      multipleOf: 1,
    },
    _deleted: {
      type: 'boolean',
      default: false,
    },
  },
  required: ['_id', 'entityCode', 'entityId', 'originalData', 'currentData', 'createdAt', 'updatedAt', '_deleted'],
  indexes: [
    'entityCode',
    'updatedAt',
  ],
};

/**
 * Create draft ID from entity identifiers
 */
export function createDraftId(entityCode: string, entityId: string): string {
  return `${entityCode}:${entityId}`;
}
