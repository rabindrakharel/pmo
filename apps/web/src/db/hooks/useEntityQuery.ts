/**
 * useEntityQuery - Entity-Specific Query Hooks
 *
 * REPLACES: useEntityInstanceList, useFormattedEntityList from React Query hooks
 *
 * Features:
 * - Reactive queries with RxDB
 * - Format-at-read pattern (same as before)
 * - Pagination support
 * - Search/filter support
 */
import { useMemo, useCallback } from 'react';
import { useRxQuery, useRxQueryPaginated } from './useRxQuery';
import { useRxDocument } from './useRxDocument';
import { useComponentMetadata } from './useComponentMetadata';
import type { PMODatabaseCollections } from '../index';
import type { RxCollection } from 'rxdb';

// ============================================================================
// Types
// ============================================================================

export interface EntityQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { field: string; order: 'asc' | 'desc' };
  filters?: Record<string, unknown>;
  enabled?: boolean;
}

export interface FormattedRow<T> {
  raw: T;
  display: Record<string, string>;
  styles: Record<string, string>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Query entity list with automatic formatting
 *
 * @param entityCode - Entity type code (e.g., 'project')
 * @param params - Query parameters (page, search, filters, etc.)
 * @returns Raw data, formatted data, and query state
 *
 * @example
 * const { data, formattedData, isLoading, total } = useEntityList('project', {
 *   page: 1,
 *   pageSize: 20,
 *   search: 'kitchen',
 *   filters: { dl__project_stage: 'planning' }
 * });
 */
export function useEntityList<
  CollectionName extends keyof PMODatabaseCollections,
  T = PMODatabaseCollections[CollectionName] extends RxCollection<infer D> ? D : never
>(
  entityCode: CollectionName,
  params: EntityQueryParams = {}
) {
  const {
    page = 1,
    pageSize = 20,
    search,
    sort,
    filters = {},
    enabled = true
  } = params;

  // Build selector from filters
  const selector = useMemo(() => {
    const sel: Record<string, unknown> = {
      active_flag: true,
      _deleted: false,
      ...filters
    };

    // Add search filter if provided (client-side regex)
    if (search) {
      sel.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { code: { $regex: new RegExp(search, 'i') } },
        { descr: { $regex: new RegExp(search, 'i') } }
      ];
    }

    return sel;
  }, [filters, search]);

  // Build sort option
  const sortOption = useMemo(() => {
    if (sort) {
      return [{ [sort.field]: sort.order }];
    }
    return [{ updated_ts: 'desc' }];
  }, [sort]);

  // Query with pagination
  const queryResult = useRxQueryPaginated<CollectionName, T>(entityCode, {
    enabled,
    selector,
    sort: sortOption,
    pageSize
  });

  // Get metadata for formatting
  const { metadata, isExpired: metadataExpired } = useComponentMetadata(
    entityCode as string,
    'entityDataTable'
  );

  // Format data on read (memoized)
  const formattedData = useMemo(() => {
    if (!queryResult.data.length || !metadata.viewType) {
      return [];
    }
    return formatDataset(queryResult.data as T[], metadata.viewType);
  }, [queryResult.data, metadata.viewType]);

  return {
    // Raw data
    data: queryResult.data as T[],

    // Formatted data
    formattedData,

    // Query state
    isLoading: queryResult.isLoading,
    error: queryResult.error,
    isFetched: queryResult.isFetched,

    // Pagination
    total: queryResult.count,
    page: queryResult.page,
    pageSize: queryResult.pageSize,
    totalPages: queryResult.totalPages,
    hasNextPage: queryResult.hasNextPage,
    hasPrevPage: queryResult.hasPrevPage,
    setPage: queryResult.setPage,
    nextPage: queryResult.nextPage,
    prevPage: queryResult.prevPage,

    // Metadata
    metadata,
    metadataExpired,

    // Helpers
    refetch: queryResult.refetch
  };
}

/**
 * Get a single entity instance with formatting
 *
 * @example
 * const { data, formattedData, update, isLoading } = useEntityInstance('project', projectId);
 */
export function useEntityInstance<
  CollectionName extends keyof PMODatabaseCollections,
  T = PMODatabaseCollections[CollectionName] extends RxCollection<infer D> ? D : never
>(
  entityCode: CollectionName,
  entityId: string | null | undefined
) {
  const {
    data,
    document,
    isLoading,
    error,
    exists,
    update,
    softDelete,
    remove
  } = useRxDocument<CollectionName, T>(entityCode, entityId);

  const { metadata, isExpired: metadataExpired } = useComponentMetadata(
    entityCode as string,
    'entityFormContainer'
  );

  // Format single row
  const formattedData = useMemo(() => {
    if (!data || !metadata.viewType) {
      return null;
    }
    return formatRow(data as T, metadata.viewType);
  }, [data, metadata.viewType]);

  return {
    // Raw data
    data: data as T | null,

    // Formatted data
    formattedData,

    // RxDocument for direct operations
    document,

    // State
    isLoading,
    error,
    exists,

    // Mutations
    update,
    softDelete,
    remove,

    // Metadata
    metadata,
    metadataExpired
  };
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format a dataset using viewType metadata
 */
function formatDataset<T extends Record<string, unknown>>(
  data: T[],
  viewType: Record<string, { renderType?: string; style?: Record<string, unknown> }>
): FormattedRow<T>[] {
  return data.map(row => formatRow(row, viewType));
}

/**
 * Format a single row using viewType metadata
 */
function formatRow<T extends Record<string, unknown>>(
  raw: T,
  viewType: Record<string, { renderType?: string; style?: Record<string, unknown> }>
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  for (const [field, value] of Object.entries(raw)) {
    const fieldMeta = viewType[field];

    if (!fieldMeta) {
      display[field] = formatValue(value);
      continue;
    }

    // Format based on renderType
    display[field] = formatValueByType(value, fieldMeta.renderType);

    // Extract style class if present
    if (fieldMeta.style?.className) {
      styles[field] = fieldMeta.style.className as string;
    }
  }

  return { raw, display, styles };
}

/**
 * Format a value based on render type
 */
function formatValueByType(value: unknown, renderType?: string): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (renderType) {
    case 'currency':
      return formatCurrency(value as number);
    case 'date':
      return formatDate(value as string);
    case 'timestamp':
    case 'datetime':
      return formatTimestamp(value as string);
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'percentage':
      return `${value}%`;
    case 'badge':
      return String(value);
    default:
      return formatValue(value);
  }
}

/**
 * Basic value formatting
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Format currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(value);
}

/**
 * Format date
 */
function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString('en-CA');
  } catch {
    return value;
  }
}

/**
 * Format timestamp
 */
function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString('en-CA');
  } catch {
    return value;
  }
}
