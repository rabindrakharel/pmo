/**
 * ============================================================================
 * DATASET FORMATTER - Main formatting logic called ONCE at fetch time
 * ============================================================================
 *
 * This module provides the core formatDataset() function that transforms
 * raw API data into pre-formatted rows for instant rendering.
 *
 * PERFORMANCE: Called once when data is fetched, not during scroll/render.
 */

import type { FieldMetadata, ComponentMetadata, FormattedRow, FormattedValue } from './types';
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
 * Formatter registry - maps viewType to formatter function
 */
const FORMATTERS: Record<string, (value: any, meta?: FieldMetadata) => FormattedValue> = {
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
  metadata: FieldMetadata | undefined
): FormattedValue {
  const viewType = metadata?.viewType || 'text';
  const formatter = FORMATTERS[viewType] || formatText;
  return formatter(value, metadata);
}

/**
 * Format a single row
 */
export function formatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | null
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    const fieldMeta = metadata?.[key];
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
 * @param data - Raw data array from API
 * @param metadata - Component metadata (e.g., entityDataTable)
 * @returns Array of formatted rows with raw, display, and styles
 *
 * @example
 * const formattedData = formatDataset(response.data, response.metadata?.entityDataTable);
 */
export function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | null
): FormattedRow<T>[] {
  if (!data || data.length === 0) {
    return [];
  }

  console.log(`%c[FORMAT] Formatting ${data.length} rows`, 'color: #be4bdb; font-weight: bold');
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
