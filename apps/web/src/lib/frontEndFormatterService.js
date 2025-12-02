/**
 * ============================================================================
 * UNIVERSAL FORMATTER SERVICE - BACKEND-DRIVEN METADATA ARCHITECTURE
 * ============================================================================
 *
 * **ARCHITECTURE PRINCIPLE:**
 * Frontend MUST rely exclusively on backend-provided metadata.
 * Zero frontend pattern detection.
 *
 * ============================================================================
 * ✅ BACKEND-DRIVEN RENDERING (v8.0.0)
 * ============================================================================
 *
 * **View Mode**: Uses format-at-read pattern via formatDataset()
 * - Data formatted once at read time using React Query's select option
 * - Returns FormattedRow with display strings and style classes
 * - See: formatDataset() in lib/formatters/formatDataset.ts
 *
 * **Edit Mode**: Uses renderEditModeFromMetadata()
 * - Renders interactive input components based on backend metadata
 * - Datalabel fields automatically use BadgeDropdownSelect with cached options
 * - All colors converted via colorCodeToTailwindClass()
 *
 * ```typescript
 * import {
 *   renderEditModeFromMetadata,     // Edit mode (uses backend metadata)
 *   hasBackendMetadata,             // Type guard for metadata responses
 * } from '../../../lib/frontEndFormatterService';
 *
 * // Check if response has backend metadata
 * if (hasBackendMetadata(apiResponse)) {
 *   const fieldMeta = apiResponse.metadata.fields.find(f => f.key === 'budget_allocated_amt');
 *
 *   // Render edit mode using backend metadata
 *   const editElement = renderEditModeFromMetadata(50000, fieldMeta, onChange);
 * }
 * ```
 *
 * ============================================================================
 * ✅ PURE FORMATTERS (No pattern detection)
 * ============================================================================
 *
 * - formatCurrency() - Pure currency formatter
 * - formatRelativeTime() - Pure time formatter
 * - formatFriendlyDate() - Pure date formatter
 * - transformForApi() - Data transformation
 * - transformFromApi() - Data transformation
 */
import React from 'react';
import { formatters } from './config/locale';
import { DebouncedInput, DebouncedTextarea } from '../components/shared/ui/DebouncedInput';
// v9.0.0: Use Dexie sync cache for non-hook datalabel access
import { getDatalabelSync } from '../db/tanstack-index';
import { BadgeDropdownSelect } from '../components/shared/ui/BadgeDropdownSelect';
import { EntityInstanceNameSelect } from '../components/shared/ui/EntityInstanceNameSelect';
// v9.4.0: Multi-select for array of entity references (_IDS fields)
import { EntityInstanceNameMultiSelect } from '../components/shared/ui/EntityInstanceNameMultiSelect';
import { colorCodeToTailwindClass } from './formatters/valueFormatters';
import { formatRelativeTime as formatRelativeTimeUtil, formatLocalizedDate } from './utils/dateUtils';
// ============================================================================
// PURE FORMATTERS (No pattern detection)
// ============================================================================
/**
 * Format currency value (pure function)
 */
export function formatCurrency(value, currency = 'CAD') {
    if (value === null || value === undefined || value === '')
        return '-';
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numericValue))
        return '-';
    return formatters.currency(numericValue);
}
/**
 * Format relative time using date-fns (pure function)
 */
export function formatRelativeTime(dateString) {
    return formatRelativeTimeUtil(dateString, '-');
}
/**
 * Format friendly date using date-fns (pure function)
 *
 * Uses parseISO from date-fns which correctly interprets date-only strings
 * (YYYY-MM-DD) as LOCAL dates, avoiding the UTC timezone shift issue.
 */
export function formatFriendlyDate(dateString) {
    return formatLocalizedDate(dateString, 'en-CA', '-');
}
// ============================================================================
// DATA TRANSFORMERS (API <-> Frontend)
// ============================================================================
/**
 * Transform data for API submission
 */
export function transformForApi(data, originalRecord) {
    const transformed = {};
    Object.keys(data).forEach(key => {
        let value = data[key];
        // Handle empty strings
        if (value === '') {
            value = null;
        }
        // Handle arrays
        if (Array.isArray(value)) {
            transformed[key] = value;
            return;
        }
        // Handle dates
        if (value instanceof Date) {
            transformed[key] = value.toISOString();
            return;
        }
        transformed[key] = value;
    });
    return transformed;
}
/**
 * Transform array field
 */
export function transformArrayField(value) {
    if (Array.isArray(value))
        return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
        }
        catch {
            return value.split(',').map(v => v.trim()).filter(Boolean);
        }
    }
    return [];
}
/**
 * Transform date field
 */
export function transformDateField(value) {
    if (!value)
        return null;
    if (value instanceof Date)
        return value.toISOString().split('T')[0];
    if (typeof value === 'string') {
        try {
            const date = new Date(value);
            return date.toISOString().split('T')[0];
        }
        catch {
            return null;
        }
    }
    return null;
}
/**
 * Transform data from API
 */
export function transformFromApi(data) {
    const transformed = {};
    Object.keys(data).forEach(key => {
        let value = data[key];
        // Handle null
        if (value === null) {
            transformed[key] = null;
            return;
        }
        // Handle dates
        if (key.endsWith('_date') || key.endsWith('_ts')) {
            transformed[key] = transformDateField(value);
            return;
        }
        transformed[key] = value;
    });
    return transformed;
}
// ============================================================================
// BACKEND METADATA HELPERS
// ============================================================================
/**
 * Type guard for API responses with metadata
 */
export function hasBackendMetadata(response) {
    return response && typeof response === 'object' && 'metadata' in response && 'data' in response;
}
/**
 * Get field metadata from response
 */
export function getFieldMetadataFromResponse(response, fieldKey) {
    return response.metadata?.fields?.find(f => f.key === fieldKey);
}
/**
 * Get all field metadata from response
 */
export function getAllFieldMetadataFromResponse(response) {
    return response.metadata?.fields || [];
}
// ============================================================================
// BACKEND-DRIVEN RENDERERS (Edit Mode Only)
// ============================================================================
// v7.0.0: View mode rendering removed - use format-at-fetch pattern instead
// Use FormattedRow.display[key] and FormattedRow.styles[key] from formatDataset()
// ============================================================================
/**
 * Render field in EDIT mode using backend metadata
 */
export function renderEditModeFromMetadata(value, metadata, onChange, options) {
    const { required, disabled, className = '' } = options || {};
    // Render based on backend-specified inputType
    switch (metadata.inputType) {
        case 'currency':
        case 'number':
            return (React.createElement(DebouncedInput, { type: "number", step: metadata.inputType === 'currency' ? '0.01' : '1', value: value ?? '', onChange: (val) => onChange(val ? parseFloat(val) : null), debounceMs: 300, onBlurCommit: true, required: required, disabled: disabled, placeholder: metadata.placeholder, className: `px-2 py-1 border rounded ${className}` }));
        case 'date':
            return (React.createElement("input", { type: "date", value: value ?? '', onChange: (e) => onChange(e.target.value), required: required, disabled: disabled, className: `px-2 py-1 border rounded ${className}` }));
        case 'datetime':
            return (React.createElement("input", { type: "datetime-local", value: value ?? '', onChange: (e) => onChange(e.target.value), required: required, disabled: disabled, className: `px-2 py-1 border rounded ${className}` }));
        case 'checkbox':
            return (React.createElement("input", { type: "checkbox", checked: !!value, onChange: (e) => onChange(e.target.checked), disabled: disabled, className: "h-4 w-4" }));
        case 'textarea':
            return (React.createElement(DebouncedTextarea, { value: value ?? '', onChange: (val) => onChange(val), debounceMs: 300, onBlurCommit: true, required: required, disabled: disabled, placeholder: metadata.placeholder, className: `px-2 py-1 border rounded ${className}`, rows: 4 }));
        // v9.8.0: EntityInstanceNameSelect - single entity reference (edit mode)
        // Backend: inputType: EntityInstanceNameSelect (from edit-type-mapping.yaml)
        case 'EntityInstanceNameSelect': {
            const entityCode = metadata.lookupEntity;
            if (!entityCode) {
                console.warn(`[EDIT] Missing lookupEntity for field ${metadata.key}`);
                return (React.createElement(DebouncedInput, { type: "text", value: value ?? '', onChange: (val) => onChange(val), debounceMs: 300, onBlurCommit: true, required: required, disabled: disabled, placeholder: metadata.placeholder || 'Missing entity configuration', className: `px-2 py-1 border rounded ${className}` }));
            }
            return (React.createElement(EntityInstanceNameSelect, { entityCode: entityCode, value: value ?? '', onChange: (uuid, _label) => onChange(uuid), disabled: disabled, required: required, placeholder: metadata.placeholder || `Select ${entityCode}...`, className: className }));
        }
        // v9.4.0: EntityInstanceNameMultiSelect - multi-select entity reference (edit mode)
        // Backend: inputType: EntityInstanceNameMultiSelect (from edit-type-mapping.yaml)
        case 'EntityInstanceNameMultiSelect': {
            const entityCode = metadata.lookupEntity;
            if (!entityCode) {
                console.warn(`[EDIT] Missing lookupEntity for field ${metadata.key}`);
                return (React.createElement(DebouncedInput, { type: "text", value: Array.isArray(value) ? value.join(', ') : (value ?? ''), onChange: (val) => onChange(val), debounceMs: 300, onBlurCommit: true, required: required, disabled: disabled, placeholder: metadata.placeholder || 'Missing entity configuration', className: `px-2 py-1 border rounded ${className}` }));
            }
            // Ensure value is an array
            const arrayValue = Array.isArray(value) ? value : (value ? [value] : []);
            return (React.createElement(EntityInstanceNameMultiSelect, { entityCode: entityCode, value: arrayValue, onChange: (uuids) => onChange(uuids), disabled: disabled, required: required, placeholder: metadata.placeholder || `Select ${entityCode}...`, className: className }));
        }
        // v9.4.0: Handle component-based inputType (YAML pattern: inputType: 'component' with component: '<name>')
        case 'component': {
            const componentName = metadata.component;
            if (!componentName) {
                console.warn(`[EDIT] inputType: 'component' but no component specified for field ${metadata.key}`);
                return (React.createElement(DebouncedInput, { type: "text", value: value ?? '', onChange: (val) => onChange(val), debounceMs: 300, onBlurCommit: true, required: required, disabled: disabled, placeholder: metadata.placeholder || 'Missing component configuration', className: `px-2 py-1 border rounded ${className}` }));
            }
            // Route to appropriate component based on component name
            switch (componentName) {
                case 'EntityInstanceNameSelect': {
                    const entityCode = metadata.lookupEntity;
                    if (!entityCode) {
                        console.warn(`[EDIT] Missing lookupEntity for EntityInstanceNameSelect field ${metadata.key}`);
                        return React.createElement(DebouncedInput, { type: "text", value: value ?? '', onChange: (val) => onChange(val), debounceMs: 300, onBlurCommit: true });
                    }
                    return (React.createElement(EntityInstanceNameSelect, { entityCode: entityCode, value: value ?? '', onChange: (uuid, _label) => onChange(uuid), disabled: disabled, required: required, placeholder: metadata.placeholder || `Select ${entityCode}...`, className: className }));
                }
                case 'EntityInstanceNameMultiSelect': {
                    const entityCode = metadata.lookupEntity;
                    if (!entityCode) {
                        console.warn(`[EDIT] Missing lookupEntity for EntityInstanceNameMultiSelect field ${metadata.key}`);
                        return React.createElement(DebouncedInput, { type: "text", value: value ?? '', onChange: (val) => onChange(val), debounceMs: 300, onBlurCommit: true });
                    }
                    const arrayValue = Array.isArray(value) ? value : (value ? [value] : []);
                    return (React.createElement(EntityInstanceNameMultiSelect, { entityCode: entityCode, value: arrayValue, onChange: (uuids) => onChange(uuids), disabled: disabled, required: required, placeholder: metadata.placeholder || `Select ${entityCode}...`, className: className }));
                }
                case 'BadgeDropdownSelect': {
                    // v12.0.0: Use lookupField instead of datalabelKey
                    const lookupField = metadata.lookupField || metadata.key;
                    const datalabelOptions = getDatalabelSync(lookupField);
                    if (datalabelOptions && datalabelOptions.length > 0) {
                        const coloredOptions = datalabelOptions.map(opt => ({
                            value: opt.name,
                            label: opt.name,
                            metadata: {
                                color_code: colorCodeToTailwindClass(opt.color_code)
                            }
                        }));
                        return (React.createElement(BadgeDropdownSelect, { value: value ?? '', options: coloredOptions, onChange: onChange, placeholder: metadata.placeholder || 'Select...' }));
                    }
                    // Fallback if options not loaded
                    return (React.createElement("select", { value: value ?? '', onChange: (e) => onChange(e.target.value), required: required, disabled: disabled, className: `px-2 py-1 border rounded ${className}` },
                        React.createElement("option", { value: "" }, "Loading...")));
                }
                case 'MetadataTable':
                case 'DAGVisualizer':
                    // These are view-only components, not edit components
                    // Fallback to readonly display
                    return (React.createElement("div", { className: "text-gray-500 italic" }, "View-only component"));
                default:
                    console.warn(`[EDIT] Unknown component: ${componentName} for field ${metadata.key}`);
                    return (React.createElement(DebouncedInput, { type: "text", value: value ?? '', onChange: (val) => onChange(val), debounceMs: 300, onBlurCommit: true, required: required, disabled: disabled, placeholder: metadata.placeholder, className: `px-2 py-1 border rounded ${className}` }));
            }
        }
        case 'select': {
            // v12.0.0: Check if this is a datalabel field (lookupSourceTable === 'datalabel' or has lookupField)
            if (metadata.lookupField || metadata.lookupSourceTable === 'datalabel') {
                const lookupField = metadata.lookupField || metadata.key;
                // v9.0.0: Load options from Dexie sync cache (cached at login via prefetchAllMetadata)
                const datalabelOptions = getDatalabelSync(lookupField);
                if (datalabelOptions && datalabelOptions.length > 0) {
                    // Convert datalabel options to BadgeDropdownSelect format with Tailwind color classes
                    const coloredOptions = datalabelOptions.map(opt => ({
                        value: opt.name,
                        label: opt.name,
                        metadata: {
                            // Convert color_code (e.g., "blue") to Tailwind classes (e.g., "bg-blue-100 text-blue-700")
                            color_code: colorCodeToTailwindClass(opt.color_code)
                        }
                    }));
                    return (React.createElement(BadgeDropdownSelect, { value: value ?? '', options: coloredOptions, onChange: onChange, placeholder: metadata.placeholder || 'Select...' }));
                }
            }
            // Fallback to plain select if not a datalabel field or options not loaded
            return (React.createElement("select", { value: value ?? '', onChange: (e) => onChange(e.target.value), required: required, disabled: disabled, className: `px-2 py-1 border rounded ${className}` },
                React.createElement("option", { value: "" }, "Select...")));
        }
        case 'text':
        default:
            return (React.createElement(DebouncedInput, { type: "text", value: value ?? '', onChange: (val) => onChange(val), debounceMs: 300, onBlurCommit: true, required: required, disabled: disabled, placeholder: metadata.placeholder, className: `px-2 py-1 border rounded ${className}` }));
    }
}
// ============================================================================
// CONSTANTS
// ============================================================================
export const SYSTEM_FIELDS = ['id', 'created_ts', 'updated_ts', 'created_by', 'updated_by', 'version'];
export const READONLY_FIELDS = [...SYSTEM_FIELDS, 'deleted_flag', 'deleted_ts', 'deleted_by'];
// ============================================================================
// EXPORTS
// ============================================================================
export default {
    // Pure formatters
    formatCurrency,
    formatRelativeTime,
    formatFriendlyDate,
    // Data transformers
    transformForApi,
    transformFromApi,
    transformArrayField,
    transformDateField,
    // Backend metadata helpers
    hasBackendMetadata,
    getFieldMetadataFromResponse,
    getAllFieldMetadataFromResponse,
    // Backend-driven renderers (edit mode only)
    renderEditModeFromMetadata,
    // Constants
    SYSTEM_FIELDS,
    READONLY_FIELDS
};
