/**
 * Entity Type Schema
 *
 * Schema definition for the entity_type collection.
 * Entity types define the 27+ entity kinds in the PMO system.
 * This is reference data synced from the backend (pull-only).
 */
import type { RxJsonSchema } from 'rxdb';

/**
 * Entity type document interface
 */
export interface EntityTypeDoc {
  code: string;                         // Primary key: 'project', 'task', etc.
  name: string;                         // Display name
  label: string;                        // UI label
  icon?: string | null;                 // Lucide icon name
  descr?: string | null;                // Description
  child_entity_codes?: string[];        // Child entity types (for tabs)
  parent_entity_codes?: string[];       // Parent entity types (for breadcrumbs)
  active_flag: boolean;                 // Soft delete flag
  _deleted: boolean;                    // RxDB deletion marker
}

/**
 * Entity type collection schema
 */
export const entityTypeSchema: RxJsonSchema<EntityTypeDoc> = {
  version: 0,
  primaryKey: 'code',  // Use code as primary key (not UUID)
  type: 'object',
  properties: {
    code: {
      type: 'string',
      maxLength: 50
    },
    name: {
      type: 'string',
      maxLength: 100
    },
    label: {
      type: 'string',
      maxLength: 100
    },
    icon: {
      type: ['string', 'null'],
      maxLength: 50
    },
    descr: {
      type: ['string', 'null'],
      maxLength: 1000
    },
    child_entity_codes: {
      type: 'array',
      items: { type: 'string', maxLength: 50 },
      default: []
    },
    parent_entity_codes: {
      type: 'array',
      items: { type: 'string', maxLength: 50 },
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
  required: ['code', 'name', 'label'],
  indexes: ['active_flag']
};
