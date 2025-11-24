/**
 * ============================================================================
 * VALUE FORMATTERS - Pure formatting functions for each field type
 * ============================================================================
 *
 * Each formatter is a pure function that takes a value and metadata,
 * and returns a FormattedValue with display string and optional style.
 *
 * Colors for datalabels are looked up from the datalabelMetadataStore
 * at fetch time, not render time.
 */

import { useDatalabelMetadataStore } from '../../stores/datalabelMetadataStore';
import type { FieldMetadata, FormattedValue } from './types';

/**
 * Convert color code from database to Tailwind badge classes
 */
export function colorCodeToTailwindClass(colorCode: string | null | undefined): string {
  if (!colorCode) return 'bg-gray-100 text-gray-600';

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-600',
    cyan: 'bg-cyan-100 text-cyan-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    pink: 'bg-pink-100 text-pink-700',
    lime: 'bg-lime-100 text-lime-700',
    teal: 'bg-teal-100 text-teal-700',
    sky: 'bg-sky-100 text-sky-700',
  };

  return colorMap[colorCode.toLowerCase()] || 'bg-gray-100 text-gray-600';
}

/**
 * Format currency values
 */
export function formatCurrency(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) {
    return { display: '—' };
  }

  const symbol = metadata?.symbol || metadata?.currencySymbol || '$';
  const decimals = metadata?.decimals ?? 2;
  const locale = metadata?.locale || 'en-CA';

  const formatted = num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return { display: `${symbol}${formatted}` };
}

/**
 * Format badge/datalabel values with color lookup
 */
export function formatBadge(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const displayValue = String(value);
  let color = 'bg-gray-100 text-gray-600'; // Default

  // Look up color from datalabel store
  if (metadata?.datalabelKey) {
    const options = useDatalabelMetadataStore.getState().getDatalabel(metadata.datalabelKey);
    if (options) {
      const match = options.find(opt => opt.name === value);
      if (match?.color_code) {
        // ✅ Convert color_code (e.g., 'blue') to Tailwind classes
        color = colorCodeToTailwindClass(match.color_code);
      }
    }
  }

  // Override with explicit color if provided (already in Tailwind format)
  if (metadata?.color) {
    color = metadata.color;
  }

  return { display: displayValue, style: color };
}

/**
 * Format date values
 */
export function formatDate(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { display: '—' };
    }

    const locale = metadata?.locale || 'en-CA';
    return { display: date.toLocaleDateString(locale) };
  } catch {
    return { display: String(value) };
  }
}

/**
 * Format timestamp as relative time
 */
export function formatRelativeTime(
  value: any,
  _metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { display: '—' };
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    if (diffSec < 60) return { display: 'just now' };
    if (diffMin < 60) return { display: `${diffMin}m ago` };
    if (diffHour < 24) return { display: `${diffHour}h ago` };
    if (diffDay < 7) return { display: `${diffDay}d ago` };
    if (diffWeek < 4) return { display: `${diffWeek}w ago` };
    if (diffMonth < 12) return { display: `${diffMonth}mo ago` };
    return { display: date.toLocaleDateString('en-CA') };
  } catch {
    return { display: String(value) };
  }
}

/**
 * Format boolean values
 */
export function formatBoolean(
  value: any,
  _metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined) {
    return { display: '—' };
  }

  const isTrue = value === true || value === 'true' || value === 1;
  return { display: isTrue ? '✓' : '✗' };
}

/**
 * Format percentage values
 */
export function formatPercentage(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) {
    return { display: '—' };
  }

  const decimals = metadata?.decimals ?? 0;
  return { display: `${num.toFixed(decimals)}%` };
}

/**
 * Format text values (default)
 */
export function formatText(value: any): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }
  return { display: String(value) };
}

/**
 * Format UUID (truncated for display)
 */
export function formatUuid(value: any): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }
  const str = String(value);
  // Show first 8 chars of UUID
  return { display: str.length > 8 ? `${str.substring(0, 8)}...` : str };
}

/**
 * Format JSON (prettified preview)
 */
export function formatJson(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { display: '—' };
  }
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return { display: str.length > 50 ? `${str.substring(0, 50)}...` : str };
  } catch {
    return { display: '[JSON]' };
  }
}

/**
 * Format array values
 */
export function formatArray(value: any): FormattedValue {
  if (!Array.isArray(value) || value.length === 0) {
    return { display: '—' };
  }
  return { display: `[${value.length} items]` };
}

/**
 * Format reference/entity ID fields
 */
export function formatReference(value: any): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }
  const str = String(value);
  // Show truncated UUID
  return { display: str.length > 8 ? `${str.substring(0, 8)}...` : str };
}
