/**
 * Datalabel Schema
 *
 * Schema definition for the datalabel collection.
 * Datalabels are dropdown/status options for dl__* fields.
 * This is reference data synced from the backend (pull-only).
 */
import type { RxJsonSchema } from 'rxdb';

/**
 * Datalabel document interface
 */
export interface DatalabelDoc {
  id: string;                           // Composite: {datalabel_key}:{option_id}
  datalabel_key: string;                // e.g., 'project_stage', 'task_status'
  option_id: number;                    // Original ID from backend
  name: string;                         // Display name
  descr?: string | null;                // Description
  color_code?: string | null;           // Badge color (hex or named color)
  sort_order: number;                   // Display order
  parent_ids?: number[];                // DAG support for multi-parent options
  active_flag: boolean;                 // Soft delete flag
  _deleted: boolean;                    // RxDB deletion marker
}

/**
 * Datalabel collection schema
 */
export const datalabelSchema: RxJsonSchema<DatalabelDoc> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 200  // "{datalabel_key}:{option_id}"
    },
    datalabel_key: {
      type: 'string',
      maxLength: 100
    },
    option_id: {
      type: 'integer'
    },
    name: {
      type: 'string',
      maxLength: 255
    },
    descr: {
      type: ['string', 'null'],
      maxLength: 1000
    },
    color_code: {
      type: ['string', 'null'],
      maxLength: 20
    },
    sort_order: {
      type: 'integer',
      default: 0
    },
    parent_ids: {
      type: 'array',
      items: { type: 'integer' },
      default: []
    },
    active_flag: {
      type: 'boolean',
      default: true
    },
    _deleted: {
      type: 'boolean',
      default: false
    }
  },
  required: ['id', 'datalabel_key', 'option_id', 'name'],
  indexes: [
    'datalabel_key',
    ['datalabel_key', 'sort_order'],
    ['datalabel_key', 'active_flag']
  ]
};

/**
 * Helper to create datalabel document ID
 */
export function createDatalabelId(datalabelKey: string, optionId: number): string {
  return `${datalabelKey}:${optionId}`;
}

/**
 * Helper to parse datalabel document ID
 */
export function parseDatalabelId(id: string): { datalabelKey: string; optionId: number } | null {
  const parts = id.split(':');
  if (parts.length !== 2) return null;

  const optionId = parseInt(parts[1], 10);
  if (isNaN(optionId)) return null;

  return {
    datalabelKey: parts[0],
    optionId
  };
}
