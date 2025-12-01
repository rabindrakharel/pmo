/**
 * RefData Resolver Utilities (v8.3.1)
 *
 * Utilities for resolving entity reference UUIDs to human-readable names
 * using the ref_data_entityInstance lookup table from API responses.
 *
 * IMPORTANT: Backend metadata is the single source of truth for:
 * - Whether a field is a reference (renderType/inputType === 'entityInstanceId')
 * - Which entity to look up (lookupEntity)
 *
 * v8.3.1 Changes:
 * - Backend now uses renderType/inputType = 'entityInstanceId' (singular) or 'entityInstanceIds' (array)
 * - Frontend context-switches between view and edit mode based on usage
 * - lookupSource: 'entityInstance' and lookupEntity from backend metadata
 *
 * ref_data_entityInstance structure:
 * {
 *   "employee": { "uuid-123": "James Miller", "uuid-456": "Sarah Johnson" },
 *   "business": { "uuid-bus": "Huron Home Services" }
 * }
 */

import type { RefData } from '@/db/tanstack-index';

// ============================================================================
// Types
// ============================================================================

/**
 * Resolved reference result
 */
export interface ResolvedReference {
  uuid: string;
  name: string;
  entityCode: string;
}

/**
 * Field metadata structure (from backend)
 * Backend provides this - frontend does NOT detect patterns
 *
 * v8.3.1: Backend uses renderType/inputType (both set to 'entityInstanceId')
 * Frontend context-switches between view and edit mode based on usage
 */
export interface FieldMetadata {
  key: string;
  renderType?: string;    // View mode type (e.g., 'entityInstanceId', 'currency', 'badge')
  inputType?: string;     // Edit mode type (e.g., 'entityInstanceId', 'currency', 'select')
  lookupSource?: 'entityInstance' | 'datalabel';
  lookupEntity?: string;
  dtype?: string;
}

// ============================================================================
// Metadata-Based Detection (v8.3.1 - Backend is source of truth)
// ============================================================================

/**
 * Check if a field is an entity reference using backend metadata
 *
 * v8.3.1: Uses renderType/inputType = 'entityInstanceId' (or 'entityInstanceIds' for arrays)
 *
 * @param fieldMeta - Field metadata from backend
 * @returns true if field is an entity reference
 */
export function isEntityReferenceField(fieldMeta: FieldMetadata | undefined): boolean {
  if (!fieldMeta) return false;
  return (
    fieldMeta.renderType === 'entityInstanceId' ||
    fieldMeta.renderType === 'entityInstanceIds' ||
    fieldMeta.inputType === 'entityInstanceId' ||
    fieldMeta.inputType === 'entityInstanceIds' ||
    fieldMeta.lookupSource === 'entityInstance'
  );
}

/**
 * Get the entity code from field metadata
 *
 * @param fieldMeta - Field metadata from backend
 * @returns Entity code or null
 */
export function getEntityCodeFromMetadata(fieldMeta: FieldMetadata | undefined): string | null {
  if (!fieldMeta) return null;
  return fieldMeta.lookupEntity ?? null;
}

/**
 * Check if field is an array reference
 *
 * v8.3.1: Uses renderType/inputType = 'entityInstanceIds' for arrays
 *
 * @param fieldMeta - Field metadata from backend
 * @returns true if field is an array of entity references
 */
export function isArrayReferenceField(fieldMeta: FieldMetadata | undefined): boolean {
  if (!fieldMeta) return false;
  return (
    fieldMeta.renderType === 'entityInstanceIds' ||
    fieldMeta.inputType === 'entityInstanceIds' ||
    fieldMeta.dtype === 'array[uuid]'
  );
}

// ============================================================================
// Single Value Resolution
// ============================================================================

/**
 * Resolve a single UUID to its entity name
 *
 * @param uuid - Entity UUID
 * @param entityCode - Entity type code (e.g., "employee")
 * @param refData - RefData lookup table
 * @returns Resolved name or undefined if not found
 *
 * @example
 * const name = resolveEntityName("uuid-123", "employee", refData);
 * // Returns: "James Miller"
 */
export function resolveEntityName(
  uuid: string | null | undefined,
  entityCode: string,
  refData: RefData | undefined
): string | undefined {
  if (!uuid || !refData) return undefined;

  const entityLookup = refData[entityCode];
  if (!entityLookup) return undefined;

  return entityLookup[uuid];
}

/**
 * Resolve a UUID with full details
 *
 * @param uuid - Entity UUID
 * @param entityCode - Entity type code
 * @param refData - RefData lookup table
 * @returns ResolvedReference or null
 */
export function resolveEntityReference(
  uuid: string | null | undefined,
  entityCode: string,
  refData: RefData | undefined
): ResolvedReference | null {
  if (!uuid || !refData) return null;

  const name = resolveEntityName(uuid, entityCode, refData);
  if (!name) return null;

  return {
    uuid,
    name,
    entityCode,
  };
}

// ============================================================================
// Array Value Resolution
// ============================================================================

/**
 * Resolve an array of UUIDs to entity names
 *
 * @param uuids - Array of entity UUIDs
 * @param entityCode - Entity type code
 * @param refData - RefData lookup table
 * @returns Array of resolved names (only includes found entries)
 *
 * @example
 * const names = resolveEntityNames(["uuid-1", "uuid-2"], "employee", refData);
 * // Returns: ["James Miller", "Sarah Johnson"]
 */
export function resolveEntityNames(
  uuids: string[] | null | undefined,
  entityCode: string,
  refData: RefData | undefined
): string[] {
  if (!uuids || !Array.isArray(uuids) || !refData) return [];

  const entityLookup = refData[entityCode];
  if (!entityLookup) return [];

  return uuids
    .map(uuid => entityLookup[uuid])
    .filter((name): name is string => !!name);
}

/**
 * Resolve an array of UUIDs with full details
 *
 * @param uuids - Array of entity UUIDs
 * @param entityCode - Entity type code
 * @param refData - RefData lookup table
 * @returns Array of ResolvedReferences
 */
export function resolveEntityReferences(
  uuids: string[] | null | undefined,
  entityCode: string,
  refData: RefData | undefined
): ResolvedReference[] {
  if (!uuids || !Array.isArray(uuids) || !refData) return [];

  const entityLookup = refData[entityCode];
  if (!entityLookup) return [];

  return uuids
    .map(uuid => {
      const name = entityLookup[uuid];
      if (!name) return null;
      return { uuid, name, entityCode };
    })
    .filter((ref): ref is ResolvedReference => ref !== null);
}

// ============================================================================
// Metadata-Based Resolution (Recommended)
// ============================================================================

/**
 * Resolve a field value using backend metadata
 *
 * Uses field metadata to determine entity code - NO pattern matching.
 *
 * @param fieldMeta - Field metadata from backend
 * @param value - UUID or array of UUIDs
 * @param refData - RefData lookup table
 * @returns Resolved name(s) or undefined
 *
 * @example
 * const fieldMeta = { key: 'manager__employee_id', lookupEntity: 'employee', renderType: 'entityInstanceId' };
 * const name = resolveFieldWithMetadata(fieldMeta, "uuid-123", refData);
 * // Returns: "James Miller"
 */
export function resolveFieldWithMetadata(
  fieldMeta: FieldMetadata | undefined,
  value: string | string[] | null | undefined,
  refData: RefData | undefined
): string | string[] | undefined {
  if (!value || !refData || !fieldMeta) return undefined;

  const entityCode = getEntityCodeFromMetadata(fieldMeta);
  if (!entityCode) return undefined;

  const isArray = isArrayReferenceField(fieldMeta);

  if (isArray && Array.isArray(value)) {
    return resolveEntityNames(value, entityCode, refData);
  }

  if (!isArray && typeof value === 'string') {
    return resolveEntityName(value, entityCode, refData);
  }

  return undefined;
}

/**
 * Resolve a field value to display string using backend metadata
 *
 * @param fieldMeta - Field metadata from backend
 * @param value - UUID or array of UUIDs
 * @param refData - RefData lookup table
 * @param fallback - Fallback if not resolvable (default: UUID)
 * @returns Display string
 *
 * @example
 * resolveFieldDisplayWithMetadata(fieldMeta, "uuid-123", refData)
 * // Returns: "James Miller" or "uuid-123" if not found
 */
export function resolveFieldDisplayWithMetadata(
  fieldMeta: FieldMetadata | undefined,
  value: string | string[] | null | undefined,
  refData: RefData | undefined,
  fallback: 'uuid' | 'empty' | 'unknown' = 'uuid'
): string {
  if (!value) return '';

  const resolved = resolveFieldWithMetadata(fieldMeta, value, refData);

  if (resolved === undefined) {
    // Not resolvable - return fallback
    if (fallback === 'empty') return '';
    if (fallback === 'unknown') return 'Unknown';
    // Default: return UUID(s)
    return Array.isArray(value) ? value.join(', ') : value;
  }

  if (Array.isArray(resolved)) {
    return resolved.join(', ');
  }

  return resolved;
}

// ============================================================================
// Row-Level Resolution with Metadata
// ============================================================================

/**
 * Resolve all reference fields in a data row using field metadata
 *
 * @param row - Entity data row
 * @param fieldMetadataMap - Map of field key to field metadata
 * @param refData - RefData lookup table
 * @returns Object with resolved display values for each reference field
 *
 * @example
 * const fieldMetadataMap = {
 *   'manager__employee_id': { key: 'manager__employee_id', lookupEntity: 'employee', renderType: 'entityInstanceId' },
 *   'business_id': { key: 'business_id', lookupEntity: 'business', renderType: 'entityInstanceId' }
 * };
 * const resolved = resolveRowWithMetadata(row, fieldMetadataMap, refData);
 * // Returns: { manager__employee_id: "James Miller", business_id: "Huron Home Services" }
 */
export function resolveRowWithMetadata(
  row: Record<string, any>,
  fieldMetadataMap: Record<string, FieldMetadata>,
  refData: RefData | undefined
): Record<string, string> {
  if (!row || !refData) return {};

  const resolved: Record<string, string> = {};

  for (const [fieldName, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;

    const fieldMeta = fieldMetadataMap[fieldName];
    if (!fieldMeta || !isEntityReferenceField(fieldMeta)) continue;

    const displayValue = resolveFieldDisplayWithMetadata(fieldMeta, value, refData);
    if (displayValue) {
      resolved[fieldName] = displayValue;
    }
  }

  return resolved;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all unique entity codes from field metadata
 *
 * @param fieldMetadataMap - Map of field key to field metadata
 * @returns Array of unique entity codes
 */
export function getReferencedEntityCodesFromMetadata(
  fieldMetadataMap: Record<string, FieldMetadata>
): string[] {
  const entityCodes = new Set<string>();

  for (const fieldMeta of Object.values(fieldMetadataMap)) {
    if (isEntityReferenceField(fieldMeta)) {
      const entityCode = getEntityCodeFromMetadata(fieldMeta);
      if (entityCode) {
        entityCodes.add(entityCode);
      }
    }
  }

  return Array.from(entityCodes);
}

/**
 * Merge multiple refData objects (useful for aggregating from multiple sources)
 *
 * @param sources - Array of RefData objects to merge
 * @returns Merged RefData object
 */
export function mergeRefData(...sources: (RefData | undefined)[]): RefData {
  const merged: RefData = {};

  for (const source of sources) {
    if (!source) continue;

    for (const [entityCode, lookups] of Object.entries(source)) {
      if (!merged[entityCode]) {
        merged[entityCode] = {};
      }
      Object.assign(merged[entityCode], lookups);
    }
  }

  return merged;
}
