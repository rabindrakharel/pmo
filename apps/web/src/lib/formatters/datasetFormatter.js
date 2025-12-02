/**
 * ============================================================================
 * DATASET FORMATTER - Main formatting logic called ONCE at fetch time
 * ============================================================================
 *
 * This module provides the core formatDataset() function that transforms
 * raw API data into pre-formatted rows for instant rendering.
 *
 * v11.0.0: Entity reference resolution uses TanStack Query cache via
 * getEntityInstanceNameSync(). API responses populate the cache via
 * upsertRefDataEntityInstance().
 *
 * PERFORMANCE: Called once when data is fetched, not during scroll/render.
 */
import { extractViewType } from './types';
import { formatCurrency, formatBadge, formatDate, formatRelativeTime, formatBoolean, formatPercentage, formatText, formatUuid, formatJson, formatArray, formatReference, } from './valueFormatters';
/**
 * Reference render types that use TanStack Query cache for name resolution
 * v11.0.0: These types read from queryClient.getQueryData() via getEntityInstanceNameSync()
 */
const REFERENCE_RENDER_TYPES = new Set([
    'reference',
    'entityInstanceId',
    'entityInstanceIds', // v8.3.2: Array of entity references
    'component', // v9.4.0: Component-based rendering may use centralized cache
]);
/**
 * Component names that require refData for entity reference resolution
 * These map component names from YAML to their rendering behavior
 */
const ENTITY_REFERENCE_COMPONENTS = new Set([
    'EntityInstanceName', // Single entity reference (view mode)
    'EntityInstanceNames', // Multiple entity references (view mode)
]);
/**
 * Formatter registry - maps renderType to formatter function
 * v11.0.0: formatReference uses TanStack Query cache via getEntityInstanceNameSync()
 */
const FORMATTERS = {
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
    'entityInstanceIds': formatReference, // v8.3.2: Array of entity references
    // Default
    'text': formatText,
};
/**
 * Format a single value based on metadata
 *
 * v8.3.2: Added refData parameter for entity reference resolution
 * v9.4.0: Added component-based routing for renderType: 'component'
 * v11.0.0: Uses TanStack Query cache via getEntityInstanceNameSync()
 *
 * @param value - The raw value to format
 * @param key - The field key
 * @param metadata - View field metadata from backend
 */
export function formatValue(value, key, metadata) {
    const renderType = metadata?.renderType || 'text';
    // v9.4.0: Handle component-based rendering (YAML pattern)
    // When renderType is 'component', route based on the component field
    if (renderType === 'component' && metadata?.component) {
        const componentName = metadata.component;
        // Entity reference components use formatReference (reads from centralized cache)
        if (ENTITY_REFERENCE_COMPONENTS.has(componentName)) {
            return formatReference(value, metadata);
        }
        // DAGVisualizer and MetadataTable are special view-only components
        // They render at the component level, not value level
        // Return formatted text as fallback for table display
        if (componentName === 'DAGVisualizer' || componentName === 'MetadataTable') {
            return formatText(value);
        }
        // Unknown component, fallback to text
        return formatText(value);
    }
    const formatter = FORMATTERS[renderType] || formatText;
    // Reference types read from TanStack Query cache via getEntityInstanceNameSync()
    if (REFERENCE_RENDER_TYPES.has(renderType)) {
        return formatter(value, metadata);
    }
    return formatter(value, metadata);
}
/**
 * Format a single row using viewType metadata
 *
 * v8.2.0: Only accepts ComponentMetadata with { viewType, editType } structure
 * v11.0.0: Uses TanStack Query cache via getEntityInstanceNameSync()
 *
 * @param row - The raw data row
 * @param metadata - Component metadata with viewType and editType
 */
export function formatRow(row, metadata) {
    const display = {};
    const styles = {};
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
 * v11.0.0: Entity reference resolution uses TanStack Query cache via
 *          getEntityInstanceNameSync(). API responses populate the cache
 *          via upsertRefDataEntityInstance().
 *
 * @param data - Raw data array from API
 * @param metadata - Component metadata with viewType and editType
 * @returns Array of formatted rows with raw, display, and styles
 *
 * @example
 * // API response populates cache automatically
 * const formattedData = formatDataset(response.data, response.metadata?.entityListOfInstancesTable);
 */
export function formatDataset(data, metadata) {
    if (!data || data.length === 0) {
        return [];
    }
    return data.map(row => formatRow(row, metadata));
}
/**
 * Re-format a single row after update (for optimistic updates)
 *
 * v11.0.0: Uses TanStack Query cache via getEntityInstanceNameSync()
 *
 * @param row - The raw data row
 * @param metadata - Component metadata with viewType and editType
 */
export function reformatRow(row, metadata) {
    return formatRow(row, metadata);
}
/**
 * Check if data is already formatted (has FormattedRow structure)
 */
export function isFormattedData(data) {
    if (!data || data.length === 0)
        return false;
    const first = data[0];
    return first && typeof first === 'object' && 'raw' in first && 'display' in first;
}
