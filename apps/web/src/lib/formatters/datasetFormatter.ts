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
 * Formatter registry - maps renderType to formatter function
 */
const FORMATTERS: Record<string, (value: any, meta?: ViewFieldMetadata) => FormattedValue> = {
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
  metadata: ViewFieldMetadata | undefined
): FormattedValue {
  const renderType = metadata?.renderType || 'text';
  const formatter = FORMATTERS[renderType] || formatText;
  return formatter(value, metadata);
}

/**
 * Format a single row using viewType metadata
 *
 * v8.2.0: Only accepts ComponentMetadata with { viewType, editType } structure
 */
export function formatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | null
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  // Extract viewType from nested structure
  const viewType = extractViewType(metadata);

  for (const [key, value] of Object.entries(row)) {
    const fieldMeta = viewType?.[key];
    const formatted = formatValue(value, key, fieldMeta);

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
 *
 * @param data - Raw data array from API
 * @param metadata - Component metadata with viewType and editType
 * @returns Array of formatted rows with raw, display, and styles
 *
 * @example
 * const formattedData = formatDataset(response.data, response.metadata?.entityDataTable);
 * // metadata.entityDataTable = { viewType: {...}, editType: {...} }
 */
export function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | null
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
  metadata: ComponentMetadata | null
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
