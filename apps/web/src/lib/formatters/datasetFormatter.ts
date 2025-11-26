/**
 * ============================================================================
 * DATASET FORMATTER - Main formatting logic called ONCE at fetch time
 * ============================================================================
 *
 * This module provides the core formatDataset() function that transforms
 * raw API data into pre-formatted rows for instant rendering.
 *
 * v8.1.0: Fixed metadata coupling - now correctly extracts viewType from
 * nested component metadata structure { viewType: {...}, editType: {...} }
 *
 * PERFORMANCE: Called once when data is fetched, not during scroll/render.
 */

import type {
  FieldMetadata,
  ViewFieldMetadata,
  ComponentMetadata,
  FlatComponentMetadata,
  FormattedRow,
  FormattedValue,
} from './types';
import { extractViewType, isNestedComponentMetadata } from './types';
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
 * Formatter registry - maps renderType to formatter function
 */
const FORMATTERS: Record<string, (value: any, meta?: ViewFieldMetadata | FieldMetadata) => FormattedValue> = {
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

  // References
  'reference': formatReference,
  'entityInstance_Id': formatReference,

  // Default
  'text': formatText,
};

/**
 * Format a single value based on metadata
 */
export function formatValue(
  value: any,
  key: string,
  metadata: ViewFieldMetadata | FieldMetadata | undefined
): FormattedValue {
  const renderType = metadata?.renderType || 'text';
  const formatter = FORMATTERS[renderType] || formatText;
  return formatter(value, metadata);
}

/**
 * Format a single row using viewType metadata
 *
 * v8.1.0: Now accepts ComponentMetadata (nested) or FlatComponentMetadata (legacy)
 * and correctly extracts viewType for formatting
 */
export function formatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | FlatComponentMetadata | null
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  // v8.1.0: Extract viewType from nested structure (or use flat structure directly)
  const viewType = extractViewType(metadata);

  for (const [key, value] of Object.entries(row)) {
    const fieldMeta = viewType?.[key];
    const formatted = formatValue(value, key, fieldMeta as ViewFieldMetadata | FieldMetadata | undefined);

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
 * v8.1.0: Now accepts ComponentMetadata (nested) or FlatComponentMetadata (legacy)
 * and correctly extracts viewType for formatting
 *
 * @param data - Raw data array from API
 * @param metadata - Component metadata (e.g., entityDataTable) - can be nested or flat
 * @returns Array of formatted rows with raw, display, and styles
 *
 * @example
 * // New nested format (correct)
 * const formattedData = formatDataset(response.data, response.metadata?.entityDataTable);
 * // metadata.entityDataTable = { viewType: {...}, editType: {...} }
 *
 * // Legacy flat format (backwards compatible)
 * const formattedData = formatDataset(response.data, flatMetadata);
 * // flatMetadata = { fieldName: { renderType: 'currency', ... } }
 */
export function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | FlatComponentMetadata | null
): FormattedRow<T>[] {
  if (!data || data.length === 0) {
    return [];
  }

  // v8.1.0: Extract viewType once for logging and validation
  const viewType = extractViewType(metadata);

  console.log(`%c[FORMAT] Formatting ${data.length} rows`, 'color: #be4bdb; font-weight: bold', {
    hasMetadata: !!metadata,
    isNestedFormat: isNestedComponentMetadata(metadata),
    hasViewType: !!viewType,
    fieldCount: viewType ? Object.keys(viewType).length : 0,
  });

  const startTime = performance.now();

  const result = data.map(row => formatRow(row, metadata));

  const duration = performance.now() - startTime;
  console.log(`%c[FORMAT] Formatted in ${duration.toFixed(2)}ms`, 'color: #be4bdb');

  return result;
}

/**
 * Re-format a single row after update (for optimistic updates)
 */
export function reformatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | FlatComponentMetadata | null
): FormattedRow<T> {
  return formatRow(row, metadata);
}

/**
 * Check if data is already formatted (has FormattedRow structure)
 */
export function isFormattedData<T>(data: any[]): data is FormattedRow<T>[] {
  if (!data || data.length === 0) return false;
  const first = data[0];
  return first && typeof first === 'object' && 'raw' in first && 'display' in first;
}
