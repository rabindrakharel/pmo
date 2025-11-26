/**
 * RefData Resolver Utilities (v8.3.0)
 *
 * Utilities for resolving entity reference UUIDs to human-readable names
 * using the ref_data lookup table from API responses.
 *
 * ref_data structure:
 * {
 *   "employee": { "uuid-123": "James Miller", "uuid-456": "Sarah Johnson" },
 *   "business": { "uuid-bus": "Huron Home Services" }
 * }
 *
 * Field naming patterns supported:
 * - Pattern 1: {label}__{entity}_id (e.g., manager__employee_id)
 * - Pattern 2: {label}__{entity}_ids (e.g., stakeholder__employee_ids)
 * - Pattern 3: {entity}_id (e.g., business_id)
 * - Pattern 4: {entity}_ids (e.g., tag_ids)
 */

import type { RefData } from './hooks/useEntityQuery';

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
 * Field parse result
 */
interface ParsedField {
  entityCode: string;
  label: string;
  isArray: boolean;
}

// ============================================================================
// Field Pattern Parsing
// ============================================================================

/**
 * Parse a field name to extract entity code and label
 *
 * @param fieldName - Field name like "manager__employee_id" or "business_id"
 * @returns Parsed field info or null if not a reference field
 */
export function parseReferenceField(fieldName: string): ParsedField | null {
  // Skip primary key
  if (fieldName === 'id') return null;

  // Pattern 1: {label}__{entity}_id (e.g., manager__employee_id)
  const labeledSingleMatch = fieldName.match(/^(.+)__([a-z_]+)_id$/);
  if (labeledSingleMatch) {
    return {
      label: labeledSingleMatch[1],
      entityCode: labeledSingleMatch[2],
      isArray: false,
    };
  }

  // Pattern 2: {label}__{entity}_ids (e.g., stakeholder__employee_ids)
  const labeledArrayMatch = fieldName.match(/^(.+)__([a-z_]+)_ids$/);
  if (labeledArrayMatch) {
    return {
      label: labeledArrayMatch[1],
      entityCode: labeledArrayMatch[2],
      isArray: true,
    };
  }

  // Pattern 3: {entity}_id (e.g., business_id)
  const simpleSingleMatch = fieldName.match(/^([a-z_]+)_id$/);
  if (simpleSingleMatch) {
    return {
      label: simpleSingleMatch[1],
      entityCode: simpleSingleMatch[1],
      isArray: false,
    };
  }

  // Pattern 4: {entity}_ids (e.g., tag_ids)
  const simpleArrayMatch = fieldName.match(/^([a-z_]+)_ids$/);
  if (simpleArrayMatch) {
    return {
      label: simpleArrayMatch[1],
      entityCode: simpleArrayMatch[1],
      isArray: true,
    };
  }

  return null;
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
// Field-Based Resolution (Auto-detect entity from field name)
// ============================================================================

/**
 * Resolve a field value to display name(s) based on field naming convention
 *
 * Automatically detects entity type from field name pattern and resolves.
 *
 * @param fieldName - Field name (e.g., "manager__employee_id")
 * @param value - UUID or array of UUIDs
 * @param refData - RefData lookup table
 * @returns Resolved name(s) or undefined
 *
 * @example
 * // Single reference
 * const name = resolveFieldValue("manager__employee_id", "uuid-123", refData);
 * // Returns: "James Miller"
 *
 * // Array reference
 * const names = resolveFieldValue("stakeholder__employee_ids", ["uuid-1", "uuid-2"], refData);
 * // Returns: ["James Miller", "Sarah Johnson"]
 */
export function resolveFieldValue(
  fieldName: string,
  value: string | string[] | null | undefined,
  refData: RefData | undefined
): string | string[] | undefined {
  if (!value || !refData) return undefined;

  const parsed = parseReferenceField(fieldName);
  if (!parsed) return undefined;

  if (parsed.isArray && Array.isArray(value)) {
    return resolveEntityNames(value, parsed.entityCode, refData);
  }

  if (!parsed.isArray && typeof value === 'string') {
    return resolveEntityName(value, parsed.entityCode, refData);
  }

  return undefined;
}

/**
 * Resolve a field value to display string (comma-joined for arrays)
 *
 * @param fieldName - Field name
 * @param value - UUID or array of UUIDs
 * @param refData - RefData lookup table
 * @param fallback - Fallback if not resolvable (default: UUID)
 * @returns Display string
 *
 * @example
 * resolveFieldValueDisplay("manager__employee_id", "uuid-123", refData)
 * // Returns: "James Miller" or "uuid-123" if not found
 */
export function resolveFieldValueDisplay(
  fieldName: string,
  value: string | string[] | null | undefined,
  refData: RefData | undefined,
  fallback: 'uuid' | 'empty' | 'unknown' = 'uuid'
): string {
  if (!value) return '';

  const resolved = resolveFieldValue(fieldName, value, refData);

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
// Row-Level Resolution
// ============================================================================

/**
 * Resolve all reference fields in a data row
 *
 * @param row - Entity data row
 * @param refData - RefData lookup table
 * @returns Object with resolved display values for each reference field
 *
 * @example
 * const resolved = resolveRowReferences(
 *   { id: "...", manager__employee_id: "uuid-123", business_id: "uuid-bus" },
 *   refData
 * );
 * // Returns: { manager__employee_id: "James Miller", business_id: "Huron Home Services" }
 */
export function resolveRowReferences(
  row: Record<string, any>,
  refData: RefData | undefined
): Record<string, string> {
  if (!row || !refData) return {};

  const resolved: Record<string, string> = {};

  for (const [fieldName, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;

    const parsed = parseReferenceField(fieldName);
    if (!parsed) continue;

    const displayValue = resolveFieldValueDisplay(fieldName, value, refData);
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
 * Check if a field is a reference field
 *
 * @param fieldName - Field name to check
 * @returns true if field is a reference field
 */
export function isReferenceField(fieldName: string): boolean {
  return parseReferenceField(fieldName) !== null;
}

/**
 * Get the entity code from a reference field name
 *
 * @param fieldName - Reference field name
 * @returns Entity code or null
 */
export function getEntityCodeFromField(fieldName: string): string | null {
  const parsed = parseReferenceField(fieldName);
  return parsed?.entityCode ?? null;
}

/**
 * Get all unique entity codes from a data row
 *
 * @param row - Entity data row
 * @returns Array of unique entity codes
 */
export function getReferencedEntityCodes(row: Record<string, any>): string[] {
  if (!row) return [];

  const entityCodes = new Set<string>();

  for (const fieldName of Object.keys(row)) {
    const parsed = parseReferenceField(fieldName);
    if (parsed) {
      entityCodes.add(parsed.entityCode);
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
