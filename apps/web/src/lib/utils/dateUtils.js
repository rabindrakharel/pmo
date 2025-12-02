/**
 * ============================================================================
 * DATE UTILITIES - Centralized date handling using date-fns
 * ============================================================================
 *
 * Industry-standard date handling using date-fns library.
 * Solves timezone issues where date-only strings (YYYY-MM-DD) are parsed as
 * UTC midnight and shift to previous day in local timezones west of UTC.
 *
 * Key Behavior:
 * - parseISO() correctly interprets date-only strings as LOCAL dates
 * - Full ISO timestamps with time/timezone are handled correctly
 * - All functions are null-safe and return consistent fallback values
 *
 * @see https://date-fns.org/docs/parseISO
 */
import { parseISO, format, isValid, formatDistanceToNow } from 'date-fns';
/**
 * Parse a date string safely using date-fns
 *
 * @param value - Date string (YYYY-MM-DD or ISO timestamp) or Date object
 * @returns Valid Date object or null
 *
 * @example
 * parseDateSafe('2024-12-28') // Dec 28, 2024 in LOCAL timezone
 * parseDateSafe('2024-12-28T00:00:00.000Z') // Handles full ISO timestamp
 * parseDateSafe(null) // null
 */
export function parseDateSafe(value) {
    if (!value)
        return null;
    try {
        const date = typeof value === 'string' ? parseISO(value) : value;
        return isValid(date) ? date : null;
    }
    catch {
        return null;
    }
}
/**
 * Format date for display (YYYY-MM-DD format for en-CA locale)
 *
 * @param value - Date string or Date object
 * @param fallback - Value to return if date is invalid (default: '—')
 * @returns Formatted date string or fallback
 *
 * @example
 * formatDisplayDate('2024-12-28') // '2024-12-28'
 * formatDisplayDate(null) // '—'
 */
export function formatDisplayDate(value, fallback = '—') {
    const date = parseDateSafe(value);
    if (!date)
        return fallback;
    return format(date, 'yyyy-MM-dd');
}
/**
 * Format date in a user-friendly format (Dec 28, 2024)
 *
 * @param value - Date string or Date object
 * @param fallback - Value to return if date is invalid (default: '-')
 * @returns Formatted date string or fallback
 *
 * @example
 * formatFriendlyDate('2024-12-28') // 'Dec 28, 2024'
 * formatFriendlyDate(null) // '-'
 */
export function formatFriendlyDate(value, fallback = '-') {
    const date = parseDateSafe(value);
    if (!date)
        return fallback;
    return format(date, 'MMM d, yyyy');
}
/**
 * Format date with locale-specific formatting
 *
 * @param value - Date string or Date object
 * @param locale - Locale string (default: 'en-CA')
 * @param fallback - Value to return if date is invalid (default: '—')
 * @returns Locale-formatted date string or fallback
 *
 * @example
 * formatLocalizedDate('2024-12-28', 'en-US') // '12/28/2024'
 * formatLocalizedDate('2024-12-28', 'en-CA') // '2024-12-28'
 */
export function formatLocalizedDate(value, locale = 'en-CA', fallback = '—') {
    const date = parseDateSafe(value);
    if (!date)
        return fallback;
    return date.toLocaleDateString(locale);
}
/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 *
 * @param value - Timestamp string or Date object
 * @param fallback - Value to return if date is invalid (default: '—')
 * @returns Relative time string or fallback
 *
 * @example
 * formatRelativeTime('2024-12-28T10:30:00Z') // '2 hours ago'
 * formatRelativeTime(null) // '—'
 */
export function formatRelativeTime(value, fallback = '—') {
    const date = parseDateSafe(value);
    if (!date)
        return fallback;
    try {
        return formatDistanceToNow(date, { addSuffix: true });
    }
    catch {
        return fallback;
    }
}
/**
 * Check if a value is a valid date
 *
 * @param value - Value to check
 * @returns boolean indicating if the value is a valid date
 */
export function isValidDate(value) {
    if (!value)
        return false;
    const date = typeof value === 'string' ? parseISO(value) : value;
    return date instanceof Date && isValid(date);
}
/**
 * Format date for form input (YYYY-MM-DD format required by HTML date inputs)
 *
 * @param value - Date string or Date object
 * @returns YYYY-MM-DD formatted string or empty string
 *
 * @example
 * formatForInput('Dec 28, 2024') // '2024-12-28'
 * formatForInput(new Date(2024, 11, 28)) // '2024-12-28'
 */
export function formatForInput(value) {
    const date = parseDateSafe(value);
    if (!date)
        return '';
    return format(date, 'yyyy-MM-dd');
}
