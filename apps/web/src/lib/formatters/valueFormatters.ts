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

// v9.0.0: Use Dexie sync cache for non-hook datalabel access
// v10.0.0: Use centralized entityInstanceNames store for entity reference resolution
import { getDatalabelSync, getEntityInstanceNameSync } from '../../db/tanstack-index';
import { formatLocalizedDate, formatRelativeTime as formatRelativeTimeUtil, parseDateSafe } from '../utils/dateUtils';
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

  // v9.0.0: Look up color from Dexie sync cache (populated at login via prefetchAllDatalabels)
  if (metadata?.datalabelKey) {
    const options = getDatalabelSync(metadata.datalabelKey);
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
 * Format date values using date-fns
 *
 * Uses parseISO from date-fns which correctly interprets date-only strings
 * (YYYY-MM-DD) as LOCAL dates, avoiding the UTC timezone shift issue.
 */
export function formatDate(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const locale = metadata?.locale || 'en-CA';
  return { display: formatLocalizedDate(value, locale, '—') };
}

/**
 * Format timestamp as relative time using date-fns
 */
export function formatRelativeTime(
  value: any,
  _metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  return { display: formatRelativeTimeUtil(value, '—') };
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
 *
 * v10.0.0: Uses centralized entityInstanceNames sync store for name resolution.
 * The cache is populated when API responses with ref_data_entityInstance arrive.
 * Falls back to truncated UUID if name not found in cache.
 *
 * @param value - UUID or array of UUIDs
 * @param metadata - Field metadata with lookupEntity
 * @param _refData - DEPRECATED: No longer used. Kept for backward compatibility.
 */
// Debug flag for formatReference - set to true to trace name resolution issues
const DEBUG_FORMAT_REFERENCE = true;

export function formatReference(
  value: any,
  metadata?: FieldMetadata,
  _refData?: Record<string, Record<string, string>>
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  // Get the entity code from metadata
  const entityCode = metadata?.lookupEntity;

  // Handle array of UUIDs
  if (Array.isArray(value)) {
    if (value.length === 0) return { display: '—' };

    const names = value.map(uuid => {
      // v10.0.0: Use centralized sync store
      if (entityCode) {
        const name = getEntityInstanceNameSync(entityCode, uuid);
        if (DEBUG_FORMAT_REFERENCE && !name) {
          console.warn(`[formatReference] MISS: entityCode=${entityCode}, uuid=${uuid.substring(0, 8)}...`);
        }
        if (name) return name;
      }
      return String(uuid).substring(0, 8) + '...';
    });

    return { display: names.join(', ') };
  }

  // Single UUID
  const uuid = String(value);

  // v10.0.0: Try to resolve from centralized sync store
  if (entityCode) {
    const name = getEntityInstanceNameSync(entityCode, uuid);
    if (DEBUG_FORMAT_REFERENCE) {
      if (name) {
        // Only log misses, not hits (too noisy)
      } else {
        console.warn(`[formatReference] MISS: entityCode=${entityCode}, uuid=${uuid.substring(0, 8)}...`);
      }
    }
    if (name) return { display: name };
  } else if (DEBUG_FORMAT_REFERENCE) {
    console.warn(`[formatReference] NO entityCode in metadata for uuid=${uuid.substring(0, 8)}...`);
  }

  // Fallback: truncated UUID
  return { display: uuid.length > 8 ? `${uuid.substring(0, 8)}...` : uuid };
}
