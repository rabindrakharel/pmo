/**
 * ============================================================================
 * LOCALE CONFIGURATION - Centralized Internationalization Settings
 * ============================================================================
 *
 * Single source of truth for all locale-related configuration.
 * Eliminates 8 duplicate 'en-CA' hardcoded strings across the codebase.
 *
 * USAGE:
 * ```typescript
 * import { LOCALE_CONFIG, formatters } from '@/lib/config/locale';
 *
 * const formatted = formatters.number(1234.56); // "1,234.56"
 * const date = formatters.date(new Date()); // "Jan 15, 2025"
 * ```
 */
export const LOCALE_CONFIG = {
    /**
     * Default locale for the application
     */
    DEFAULT: 'en-CA',
    /**
     * Currency code
     */
    CURRENCY: 'CAD',
    /**
     * Timezone
     */
    TIMEZONE: 'America/Toronto'
};
/**
 * Pre-configured formatters for common use cases
 */
export const formatters = {
    /**
     * Format currency values
     * @example formatters.currency(50000) → "$50,000.00"
     */
    currency: (value) => {
        return new Intl.NumberFormat(LOCALE_CONFIG.DEFAULT, {
            style: 'currency',
            currency: LOCALE_CONFIG.CURRENCY,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    },
    /**
     * Format number with thousand separators
     * @example formatters.number(1234.56) → "1,234.56"
     */
    number: (value, decimals = {}) => {
        return new Intl.NumberFormat(LOCALE_CONFIG.DEFAULT, {
            minimumFractionDigits: decimals.min ?? 0,
            maximumFractionDigits: decimals.max ?? 2
        }).format(value);
    },
    /**
     * Format date
     * @example formatters.date(new Date()) → "Jan 15, 2025"
     */
    date: (value) => {
        const date = new Date(value);
        if (isNaN(date.getTime()))
            return String(value);
        return new Intl.DateTimeFormat(LOCALE_CONFIG.DEFAULT, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(date);
    },
    /**
     * Format datetime
     * @example formatters.datetime(new Date()) → "Jan 15, 2025, 2:30 PM"
     */
    datetime: (value) => {
        const date = new Date(value);
        if (isNaN(date.getTime()))
            return String(value);
        return new Intl.DateTimeFormat(LOCALE_CONFIG.DEFAULT, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        }).format(date);
    },
    /**
     * Format percentage
     * @example formatters.percentage(0.755) → "75.5%"
     */
    percentage: (value) => {
        return `${(value * 100).toFixed(1)}%`;
    }
};
