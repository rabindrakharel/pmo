/**
 * useRefData Hook (v8.3.0)
 *
 * React hook for accessing and resolving entity references using ref_data.
 *
 * Features:
 * - Extracts ref_data from entity queries automatically
 * - Provides convenient resolution methods
 * - Falls back to entity lookup API for edit mode dropdowns
 * - Caches entity lookup results with 1 hour TTL
 *
 * Usage:
 * - View mode: Use ref_data from entity query for O(1) lookups
 * - Edit mode: Use useEntityLookup for full dropdown options
 */

import { useMemo, useCallback } from 'react';
import type { RefData } from './useEntityQuery';
import {
  resolveEntityName,
  resolveEntityNames,
  resolveFieldValue,
  resolveFieldValueDisplay,
  resolveRowReferences,
  parseReferenceField,
  isReferenceField,
  getEntityCodeFromField,
  mergeRefData,
  type ResolvedReference,
} from '../refDataResolver';

// ============================================================================
// Types
// ============================================================================

export interface UseRefDataResult {
  /**
   * The ref_data lookup table
   */
  refData: RefData | undefined;

  /**
   * Check if ref_data is available
   */
  hasRefData: boolean;

  /**
   * Resolve a single UUID to entity name
   */
  resolveName: (uuid: string | null | undefined, entityCode: string) => string | undefined;

  /**
   * Resolve an array of UUIDs to entity names
   */
  resolveNames: (uuids: string[] | null | undefined, entityCode: string) => string[];

  /**
   * Resolve a field value (auto-detects entity from field name)
   */
  resolveField: (fieldName: string, value: string | string[] | null | undefined) => string | string[] | undefined;

  /**
   * Resolve a field value to display string (comma-joined for arrays)
   */
  resolveFieldDisplay: (
    fieldName: string,
    value: string | string[] | null | undefined,
    fallback?: 'uuid' | 'empty' | 'unknown'
  ) => string;

  /**
   * Resolve all reference fields in a row
   */
  resolveRow: (row: Record<string, any>) => Record<string, string>;

  /**
   * Check if a field is a reference field
   */
  isRefField: (fieldName: string) => boolean;

  /**
   * Get entity code from a reference field name
   */
  getEntityCode: (fieldName: string) => string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for accessing and resolving entity references using ref_data
 *
 * @param refData - RefData lookup table from entity query response
 * @returns Resolution utilities bound to the provided refData
 *
 * @example
 * // Get ref_data from entity query
 * const { data } = useEntityInstance('project', projectId);
 * const { resolveName, resolveFieldDisplay } = useRefData(data?.ref_data);
 *
 * // Resolve references
 * const managerName = resolveName(project.manager__employee_id, 'employee');
 * const displayValue = resolveFieldDisplay('manager__employee_id', project.manager__employee_id);
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
    (fieldName: string, value: string | string[] | null | undefined): string | string[] | undefined => {
      return resolveFieldValue(fieldName, value, refData);
    },
    [refData]
  );

  const resolveFieldDisplay = useCallback(
    (
      fieldName: string,
      value: string | string[] | null | undefined,
      fallback: 'uuid' | 'empty' | 'unknown' = 'uuid'
    ): string => {
      return resolveFieldValueDisplay(fieldName, value, refData, fallback);
    },
    [refData]
  );

  const resolveRow = useCallback(
    (row: Record<string, any>): Record<string, string> => {
      return resolveRowReferences(row, refData);
    },
    [refData]
  );

  const isRefField = useCallback((fieldName: string): boolean => {
    return isReferenceField(fieldName);
  }, []);

  const getEntityCode = useCallback((fieldName: string): string | null => {
    return getEntityCodeFromField(fieldName);
  }, []);

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
  };
}

// ============================================================================
// Merged RefData Hook
// ============================================================================

/**
 * Hook for merging multiple ref_data sources
 *
 * Useful when you have ref_data from multiple entity queries that need to be combined.
 *
 * @param sources - Array of RefData objects to merge
 * @returns UseRefDataResult with merged ref_data
 *
 * @example
 * const { data: projects } = useEntityInstanceList('project');
 * const { data: tasks } = useEntityInstanceList('task');
 * const { resolveFieldDisplay } = useMergedRefData(projects?.ref_data, tasks?.ref_data);
 */
export function useMergedRefData(...sources: (RefData | undefined)[]): UseRefDataResult {
  const mergedRefData = useMemo(() => mergeRefData(...sources), [sources]);
  return useRefData(mergedRefData);
}

// ============================================================================
// Field-Specific Hook
// ============================================================================

/**
 * Hook for resolving a specific reference field
 *
 * @param fieldName - Reference field name
 * @param value - UUID or array of UUIDs
 * @param refData - RefData lookup table
 * @returns Resolved display value
 *
 * @example
 * const managerName = useResolvedField('manager__employee_id', project.manager__employee_id, refData);
 */
export function useResolvedField(
  fieldName: string,
  value: string | string[] | null | undefined,
  refData: RefData | undefined
): string {
  return useMemo(() => {
    return resolveFieldValueDisplay(fieldName, value, refData);
  }, [fieldName, value, refData]);
}

// ============================================================================
// Row Resolution Hook
// ============================================================================

/**
 * Hook for resolving all reference fields in a row
 *
 * @param row - Entity data row
 * @param refData - RefData lookup table
 * @returns Object with resolved display values for each reference field
 *
 * @example
 * const resolvedFields = useResolvedRow(project, refData);
 * // resolvedFields.manager__employee_id = "James Miller"
 * // resolvedFields.business_id = "Huron Home Services"
 */
export function useResolvedRow(
  row: Record<string, any> | undefined,
  refData: RefData | undefined
): Record<string, string> {
  return useMemo(() => {
    if (!row) return {};
    return resolveRowReferences(row, refData);
  }, [row, refData]);
}

// Re-export types and utilities for convenience
export type { RefData, ResolvedReference };
export {
  parseReferenceField,
  isReferenceField,
  getEntityCodeFromField,
  mergeRefData,
};
