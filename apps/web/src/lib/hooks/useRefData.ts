/**
 * useRefData Hook (v8.3.1)
 *
 * React hook for accessing and resolving entity references using ref_data_entityInstance.
 *
 * IMPORTANT: Backend metadata is the single source of truth.
 * - renderType === 'entityInstanceId' indicates a reference field
 * - lookupEntity tells us which entity to look up
 * - Frontend does NOT detect patterns from field names
 *
 * Features:
 * - Extracts ref_data_entityInstance from entity queries automatically
 * - Provides convenient resolution methods using metadata
 * - Caches entity lookup results with React Query
 *
 * Usage:
 * - View mode: Use ref_data_entityInstance from entity query for O(1) lookups
 * - Edit mode: Use useEntityLookup for full dropdown options
 */

import { useMemo, useCallback } from 'react';
import {
  type RefData,
  resolveEntityName,
  resolveEntityNames,
  resolveFieldWithMetadata,
  resolveFieldDisplayWithMetadata,
  resolveRowWithMetadata,
  isEntityReferenceField,
  getEntityCodeFromMetadata,
  isArrayReferenceField,
  getReferencedEntityCodesFromMetadata,
  mergeRefData,
  type FieldMetadata,
  type ResolvedReference,
} from '../refDataResolver';

// ============================================================================
// Types
// ============================================================================

export interface UseRefDataResult {
  /**
   * The ref_data_entityInstance lookup table
   */
  refData: RefData | undefined;

  /**
   * Check if ref_data_entityInstance is available
   */
  hasRefData: boolean;

  /**
   * Resolve a single UUID to entity name (requires entityCode)
   */
  resolveName: (uuid: string | null | undefined, entityCode: string) => string | undefined;

  /**
   * Resolve an array of UUIDs to entity names (requires entityCode)
   */
  resolveNames: (uuids: string[] | null | undefined, entityCode: string) => string[];

  /**
   * Resolve a field value using field metadata (NO pattern matching)
   */
  resolveField: (
    fieldMeta: FieldMetadata | undefined,
    value: string | string[] | null | undefined
  ) => string | string[] | undefined;

  /**
   * Resolve a field value to display string using field metadata
   */
  resolveFieldDisplay: (
    fieldMeta: FieldMetadata | undefined,
    value: string | string[] | null | undefined,
    fallback?: 'uuid' | 'empty' | 'unknown'
  ) => string;

  /**
   * Resolve all reference fields in a row using field metadata map
   */
  resolveRow: (
    row: Record<string, any>,
    fieldMetadataMap: Record<string, FieldMetadata>
  ) => Record<string, string>;

  /**
   * Check if a field is a reference field using metadata
   */
  isRefField: (fieldMeta: FieldMetadata | undefined) => boolean;

  /**
   * Get entity code from field metadata
   */
  getEntityCode: (fieldMeta: FieldMetadata | undefined) => string | null;

  /**
   * Check if field is an array reference
   */
  isArrayRef: (fieldMeta: FieldMetadata | undefined) => boolean;

  /**
   * Get all referenced entity codes from field metadata map
   */
  getReferencedEntityCodes: (fieldMetadataMap: Record<string, FieldMetadata>) => string[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for accessing and resolving entity references using ref_data_entityInstance
 *
 * @param refData - RefData lookup table from entity query response
 * @returns Resolution utilities bound to the provided refData
 *
 * @example
 * // Get ref_data_entityInstance from entity query
 * const { data } = useEntityInstance('project', projectId);
 * const { resolveName, resolveFieldDisplay } = useRefData(data?.ref_data_entityInstance);
 *
 * // Resolve references using metadata
 * const managerField = metadata.fields.find(f => f.key === 'manager__employee_id');
 * const displayValue = resolveFieldDisplay(managerField, project.manager__employee_id);
 */
export function useRefData(refData: RefData | undefined): UseRefDataResult {
  // Memoize resolution functions to prevent unnecessary re-renders
  const resolveName = useCallback(
    (uuid: string | null | undefined, entityCode: string): string | undefined => {
      return resolveEntityName(uuid, entityCode, refData);
    },
    [refData]
  );

  const resolveNames = useCallback(
    (uuids: string[] | null | undefined, entityCode: string): string[] => {
      return resolveEntityNames(uuids, entityCode, refData);
    },
    [refData]
  );

  const resolveField = useCallback(
    (
      fieldMeta: FieldMetadata | undefined,
      value: string | string[] | null | undefined
    ): string | string[] | undefined => {
      return resolveFieldWithMetadata(fieldMeta, value, refData);
    },
    [refData]
  );

  const resolveFieldDisplay = useCallback(
    (
      fieldMeta: FieldMetadata | undefined,
      value: string | string[] | null | undefined,
      fallback: 'uuid' | 'empty' | 'unknown' = 'uuid'
    ): string => {
      return resolveFieldDisplayWithMetadata(fieldMeta, value, refData, fallback);
    },
    [refData]
  );

  const resolveRow = useCallback(
    (
      row: Record<string, any>,
      fieldMetadataMap: Record<string, FieldMetadata>
    ): Record<string, string> => {
      return resolveRowWithMetadata(row, fieldMetadataMap, refData);
    },
    [refData]
  );

  const isRefField = useCallback((fieldMeta: FieldMetadata | undefined): boolean => {
    return isEntityReferenceField(fieldMeta);
  }, []);

  const getEntityCode = useCallback((fieldMeta: FieldMetadata | undefined): string | null => {
    return getEntityCodeFromMetadata(fieldMeta);
  }, []);

  const isArrayRef = useCallback((fieldMeta: FieldMetadata | undefined): boolean => {
    return isArrayReferenceField(fieldMeta);
  }, []);

  const getReferencedEntityCodes = useCallback(
    (fieldMetadataMap: Record<string, FieldMetadata>): string[] => {
      return getReferencedEntityCodesFromMetadata(fieldMetadataMap);
    },
    []
  );

  return {
    refData,
    hasRefData: !!refData && Object.keys(refData).length > 0,
    resolveName,
    resolveNames,
    resolveField,
    resolveFieldDisplay,
    resolveRow,
    isRefField,
    getEntityCode,
    isArrayRef,
    getReferencedEntityCodes,
  };
}

// ============================================================================
// Merged RefData Hook
// ============================================================================

/**
 * Hook for merging multiple ref_data_entityInstance sources
 *
 * Useful when you have ref_data_entityInstance from multiple entity queries that need to be combined.
 *
 * @param sources - Array of RefData objects to merge
 * @returns UseRefDataResult with merged ref_data_entityInstance
 *
 * @example
 * const { data: projects } = useEntityInstanceList('project');
 * const { data: tasks } = useEntityInstanceList('task');
 * const { resolveFieldDisplay } = useMergedRefData(projects?.ref_data_entityInstance, tasks?.ref_data_entityInstance);
 */
export function useMergedRefData(...sources: (RefData | undefined)[]): UseRefDataResult {
  const mergedRefData = useMemo(() => mergeRefData(...sources), [sources]);
  return useRefData(mergedRefData);
}

// ============================================================================
// Field-Specific Hook
// ============================================================================

/**
 * Hook for resolving a specific reference field using metadata
 *
 * @param fieldMeta - Field metadata from backend
 * @param value - UUID or array of UUIDs
 * @param refData - RefData lookup table
 * @returns Resolved display value
 *
 * @example
 * const managerField = metadata.fields.find(f => f.key === 'manager__employee_id');
 * const managerName = useResolvedField(managerField, project.manager__employee_id, refData);
 */
export function useResolvedField(
  fieldMeta: FieldMetadata | undefined,
  value: string | string[] | null | undefined,
  refData: RefData | undefined
): string {
  return useMemo(() => {
    return resolveFieldDisplayWithMetadata(fieldMeta, value, refData);
  }, [fieldMeta, value, refData]);
}

// ============================================================================
// Row Resolution Hook
// ============================================================================

/**
 * Hook for resolving all reference fields in a row using metadata
 *
 * @param row - Entity data row
 * @param fieldMetadataMap - Map of field key to field metadata
 * @param refData - RefData lookup table
 * @returns Object with resolved display values for each reference field
 *
 * @example
 * const fieldMetadataMap = Object.fromEntries(metadata.fields.map(f => [f.key, f]));
 * const resolvedFields = useResolvedRow(project, fieldMetadataMap, refData);
 * // resolvedFields.manager__employee_id = "James Miller"
 */
export function useResolvedRow(
  row: Record<string, any> | undefined,
  fieldMetadataMap: Record<string, FieldMetadata>,
  refData: RefData | undefined
): Record<string, string> {
  return useMemo(() => {
    if (!row) return {};
    return resolveRowWithMetadata(row, fieldMetadataMap, refData);
  }, [row, fieldMetadataMap, refData]);
}

// Re-export types and utilities for convenience
export type { RefData, ResolvedReference, FieldMetadata };
export {
  isEntityReferenceField,
  getEntityCodeFromMetadata,
  isArrayReferenceField,
  mergeRefData,
};
