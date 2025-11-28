// ============================================================================
// Metadata Schema for RxDB
// ============================================================================
// Stores cached metadata: datalabels, entity types, global settings
// ============================================================================

import type { RxJsonSchema } from 'rxdb';

/**
 * Metadata document type - stores various cached metadata
 */
export interface MetadataDocType {
  // Primary key: type:key (e.g., "datalabel:project_stage", "entity:project")
  _id: string;

  // Metadata type
  type: 'datalabel' | 'entity' | 'settings' | 'component';

  // Key within type
  key: string;

  // Metadata content (varies by type)
  data: unknown;

  // Cache control
  cachedAt: number;            // When cached
  ttl: number;                 // Time-to-live in ms
  version?: number;            // Server version for invalidation

  // Soft delete
  _deleted: boolean;
}

/**
 * RxDB Schema for metadata collection
 */
export const metadataSchema: RxJsonSchema<MetadataDocType> = {
  version: 0,
  primaryKey: '_id',
  type: 'object',
  properties: {
    _id: {
      type: 'string',
      maxLength: 200,
    },
    type: {
      type: 'string',
      enum: ['datalabel', 'entity', 'settings', 'component'],
    },
    key: {
      type: 'string',
      maxLength: 100,
    },
    data: {
      // Can be any type depending on metadata type
    },
    cachedAt: {
      type: 'integer',
      minimum: 0,
    },
    ttl: {
      type: 'integer',
      minimum: 0,
    },
    version: {
      type: 'integer',
      minimum: 0,
    },
    _deleted: {
      type: 'boolean',
      default: false,
    },
  },
  required: ['_id', 'type', 'key', 'data', 'cachedAt', 'ttl', '_deleted'],
  indexes: [
    'type',
    ['type', 'key'],
    'cachedAt',
  ],
};

/**
 * Create metadata ID
 */
export function createMetadataId(type: MetadataDocType['type'], key: string): string {
  return `${type}:${key}`;
}

/**
 * TTL constants for different metadata types
 */
export const METADATA_TTL = {
  datalabel: 60 * 60 * 1000,      // 1 hour
  entity: 60 * 60 * 1000,         // 1 hour
  settings: 60 * 60 * 1000,       // 1 hour
  component: 15 * 60 * 1000,      // 15 minutes
} as const;

/**
 * Check if metadata is still valid (not expired)
 */
export function isMetadataValid(doc: MetadataDocType): boolean {
  const expiresAt = doc.cachedAt + doc.ttl;
  return Date.now() < expiresAt;
}
