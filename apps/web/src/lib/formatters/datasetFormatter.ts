/**
 * ============================================================================
 * DATASET FORMATTER - Main formatting logic called ONCE at fetch time
 * ============================================================================
 *
 * This module provides the core formatDataset() function that transforms
 * raw API data into pre-formatted rows for instant rendering.
 *
 * v8.2.0: Removed legacy flat metadata support - only accepts nested
 * component metadata structure { viewType: {...}, editType: {...} }
 *
 * v8.3.2: Added ref_data_entityInstance support for entity reference resolution.
 * Reference fields (renderType: 'entityInstanceId') now resolve UUID to names.
 *
 * PERFORMANCE: Called once when data is fetched, not during scroll/render.
 */

import type {
  ViewFieldMetadata,
  ComponentMetadata,
  FormattedRow,
  FormattedValue,
} from './types';
import { extractViewType, isValidComponentMetadata } from './types';
import {
  formatCurrency,
  formatBadge,
  formatDate,
  formatRelativeTime,
  formatBoolean,
  formatPercentage,
  formatText,
  formatUuid,
  formatJson,
  formatArray,
  formatReference,
} from './valueFormatters';

/**
 * RefData type for entity instance name resolution (v8.3.2)
 * Structure: { entityCode: { uuid: name } }
 */
export type RefData = Record<string, Record<string, string>>;

/**
 * Reference render types that need refData for name resolution
 */
const REFERENCE_RENDER_TYPES = new Set([
  'reference',
  'entityInstanceId',
  'entityInstanceIds',  // v8.3.2: Array of entity references
]);

/**
 * Formatter registry - maps renderType to formatter function
 * Note: formatReference requires refData for name resolution (v8.3.2)
 */
const FORMATTERS: Record<string, (value: any, meta?: ViewFieldMetadata, refData?: RefData) => FormattedValue> = {
  // Currency
  'currency': formatCurrency,

  // Badges/Datalabels
  'badge': formatBadge,
  'datalabel': formatBadge,
  'datalabels': formatBadge,
  'dag': formatBadge,
  'select': formatBadge,

  // Dates
  'date': formatDate,
  'date_readonly': formatDate,

  // Timestamps
  'timestamp': formatRelativeTime,
  'timestamp_readonly': formatRelativeTime,
  'relative-time': formatRelativeTime,

  // Boolean
  'boolean': formatBoolean,

  // Percentage
  'percentage': formatPercentage,

  // Special types
  'uuid': formatUuid,
  'json': formatJson,
  'jsonb': formatJson,
  'array': formatArray,

  // References - use refData for name resolution (v8.3.2)
  'reference': formatReference,
  'entityInstanceId': formatReference,
  'entityInstanceIds': formatReference,  // v8.3.2: Array of entity references

  // Default
  'text': formatText,
};

/**
 * Format a single value based on metadata
 *
 * v8.3.2: Added refData parameter for entity reference resolution
 */
export function formatValue(
  value: any,
  key: string,
  metadata: ViewFieldMetadata | undefined,
  refData?: RefData
): FormattedValue {
  const renderType = metadata?.renderType || 'text';
  const formatter = FORMATTERS[renderType] || formatText;

  // Pass refData to formatters that need it (reference types)
  if (REFERENCE_RENDER_TYPES.has(renderType)) {
    return formatter(value, metadata, refData);
  }

  return formatter(value, metadata);
}

/**
 * Format a single row using viewType metadata
 *
 * v8.2.0: Only accepts ComponentMetadata with { viewType, editType } structure
 * v8.3.2: Added refData parameter for entity reference resolution
 */
export function formatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | null,
  refData?: RefData
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  // Extract viewType from nested structure
  const viewType = extractViewType(metadata);

  for (const [key, value] of Object.entries(row)) {
    const fieldMeta = viewType?.[key];
    const formatted = formatValue(value, key, fieldMeta, refData);

    display[key] = formatted.display;
    if (formatted.style) {
      styles[key] = formatted.style;
    }
  }

  return { raw: row, display, styles };
}

/**
 * Format entire dataset (call ONCE at fetch time)
 *
 * v8.2.0: Only accepts ComponentMetadata with { viewType, editType } structure
 * v8.3.2: Added refData parameter for entity reference resolution
 *
 * @param data - Raw data array from API
 * @param metadata - Component metadata with viewType and editType
 * @param refData - ref_data_entityInstance for entity name resolution (v8.3.2)
 * @returns Array of formatted rows with raw, display, and styles
 *
 * @example
 * const formattedData = formatDataset(response.data, response.metadata?.entityDataTable, response.ref_data_entityInstance);
 * // metadata.entityDataTable = { viewType: {...}, editType: {...} }
 */
export function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | null,
  refData?: RefData
): FormattedRow<T>[] {
  if (!data || data.length === 0) {
    return [];
  }

  // Extract viewType once for logging and validation
  const viewType = extractViewType(metadata);

  console.log(`%c[FORMAT] Formatting ${data.length} rows`, 'color: #be4bdb; font-weight: bold', {
    hasMetadata: !!metadata,
    isValid: isValidComponentMetadata(metadata),
    hasViewType: !!viewType,
    fieldCount: viewType ? Object.keys(viewType).length : 0,
    hasRefData: !!refData,
    refDataEntities: refData ? Object.keys(refData) : [],
  });

  const startTime = performance.now();

  const result = data.map(row => formatRow(row, metadata, refData));

  const duration = performance.now() - startTime;
  console.log(`%c[FORMAT] Formatted in ${duration.toFixed(2)}ms`, 'color: #be4bdb');

  return result;
}

/**
 * Re-format a single row after update (for optimistic updates)
 *
 * v8.3.2: Added refData parameter for entity reference resolution
 */
export function reformatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | null,
  refData?: RefData
): FormattedRow<T> {
  return formatRow(row, metadata, refData);
}

/**
 * Check if data is already formatted (has FormattedRow structure)
 */
export function isFormattedData<T>(data: any[]): data is FormattedRow<T>[] {
  if (!data || data.length === 0) return false;
  const first = data[0];
  return first && typeof first === 'object' && 'raw' in first && 'display' in first;
}
