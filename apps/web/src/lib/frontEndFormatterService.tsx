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
import { Copy, Check } from 'lucide-react';
import { formatters } from './config/locale';
import { DebouncedInput, DebouncedTextarea } from '../components/shared/ui/DebouncedInput';
// v9.0.0: Use Dexie sync cache for non-hook datalabel access
import { getDatalabelSync } from '../db/tanstack-index';
import { BadgeDropdownSelect, type BadgeDropdownSelectOption } from '../components/shared/ui/BadgeDropdownSelect';
import { EntityInstanceNameSelect } from '../components/shared/ui/EntityInstanceNameSelect';
// v9.4.0: Multi-select for array of entity references (_IDS fields)
import { EntityInstanceNameMultiSelect } from '../components/shared/ui/EntityInstanceNameMultiSelect';
import { colorCodeToTailwindClass } from './formatters/valueFormatters';
import {
  formatRelativeTime as formatRelativeTimeUtil,
  formatLocalizedDate
} from './utils/dateUtils';

// ============================================================================
// BACKEND METADATA TYPES
// ============================================================================

/**
 * Component visibility per view type (backend-provided)
 */
export interface ComponentVisibility {
  EntityListOfInstancesTable: boolean;
  EntityDetailView: boolean;
  EntityInstanceFormContainer: boolean;
  KanbanView: boolean;
  CalendarView: boolean;
}

/**
 * Composite field configuration (backend-provided)
 */
export interface CompositeFieldConfig {
  composedFrom: string[];
  compositeType: 'progress-bar' | 'date-range' | 'address' | 'full-name' | 'calculated';
  showPercentage?: boolean;
  showDates?: boolean;
  highlightOverdue?: boolean;
  startField?: string;
  endField?: string;
}

/**
 * Complete field metadata from backend
 */
export interface BackendFieldMetadata {
  key: string;
  label: string;

  /**
   * Index in data array (1-based)
   * Used for indexed data format where data is sent as arrays instead of objects
   * Backend uses this to convert between object and array formats
   */
  index: number;

  renderType: string;
  inputType: string;
  format?: Record<string, any>;
  visible: ComponentVisibility;
  editable: boolean;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  validation?: Record<string, any>;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;

  // Backend-driven field loading (matches backend property names)
  // v12.0.0: Renamed lookupSource → lookupSourceTable, datalabelKey → lookupField
  lookupSourceTable?: 'datalabel' | 'entityInstance';  // Backend lookup type
  lookupEntity?: string;                               // Entity code for entityInstance lookup
  lookupField?: string;                                // Field name for lookup (datalabel key or field name)

  // Badge colors (backend-provided)
  color?: string;  // Tailwind color classes from backend (e.g., 'bg-red-100 text-red-700')
  colorMap?: Record<string, string>;  // Value -> color mapping from datalabel endpoint

  // Composite fields
  composite?: boolean;
  compositeConfig?: CompositeFieldConfig;
  component?: string;

  // v8.3.2: Component-specific rendering (backend-driven)
  EntityInstanceFormContainer_viz_container?: {
    view?: string;
    edit?: string;
  };
  EntityListOfInstancesTable_edit_component?: 'BadgeDropdownSelect' | 'DataLabelSelect' | 'input';
}

/**
 * Datalabel option from backend
 */
export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string | null;
  parent_id?: number | null;  // Legacy single parent (deprecated)
  parent_ids?: number[];      // ✅ NEW: Array of parent IDs for DAG visualization
  sort_order: number;
  color_code: string;
  active_flag: boolean;
}

/**
 * Datalabel data container (for DAG visualization)
 */
export interface DatalabelData {
  name: string;
  options: DatalabelOption[];
}

/**
 * Entity metadata container (backend response)
 */
export interface EntityMetadata {
  entity: string;
  fields: BackendFieldMetadata[];
}

/**
 * API response with metadata and datalabels
 */
export interface ApiResponseWithMetadata {
  data: any;
  metadata: EntityMetadata;
  datalabels?: DatalabelData[];  // ✅ NEW: Preloaded datalabel data
  total?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// PURE FORMATTERS (No pattern detection)
// ============================================================================

/**
 * Format currency value (pure function)
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency: string = 'CAD'
): string {
  if (value === null || value === undefined || value === '') return '-';
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) return '-';

  return formatters.currency(numericValue);
}

/**
 * Format relative time using date-fns (pure function)
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  return formatRelativeTimeUtil(dateString, '-');
}

/**
 * Format friendly date using date-fns (pure function)
 *
 * Uses parseISO from date-fns which correctly interprets date-only strings
 * (YYYY-MM-DD) as LOCAL dates, avoiding the UTC timezone shift issue.
 */
export function formatFriendlyDate(dateString: string | Date | null | undefined): string {
  return formatLocalizedDate(dateString, 'en-CA', '-');
}

// ============================================================================
// DATA TRANSFORMERS (API <-> Frontend)
// ============================================================================

/**
 * Transform data for API submission
 */
export function transformForApi(data: Record<string, any>, originalRecord?: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = {};

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
export function transformArrayField(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Transform date field
 */
export function transformDateField(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'string') {
    try {
      const date = new Date(value);
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Transform data from API
 */
export function transformFromApi(data: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = {};

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
export function hasBackendMetadata(response: any): response is ApiResponseWithMetadata {
  return response && typeof response === 'object' && 'metadata' in response && 'data' in response;
}

/**
 * Get field metadata from response
 */
export function getFieldMetadataFromResponse(
  response: ApiResponseWithMetadata,
  fieldKey: string
): BackendFieldMetadata | undefined {
  return response.metadata?.fields?.find(f => f.key === fieldKey);
}

/**
 * Get all field metadata from response
 */
export function getAllFieldMetadataFromResponse(response: ApiResponseWithMetadata): BackendFieldMetadata[] {
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
export function renderEditModeFromMetadata(
  value: any,
  metadata: BackendFieldMetadata,
  onChange: (value: any) => void,
  options?: {
    required?: boolean;
    disabled?: boolean;
    className?: string;
  }
): React.ReactElement {
  const { required, disabled, className = '' } = options || {};

  // Render based on backend-specified inputType
  switch (metadata.inputType) {
    case 'currency':
    case 'number':
      return (
        <DebouncedInput
          type="number"
          step={metadata.inputType === 'currency' ? '0.01' : '1'}
          value={value ?? ''}
          onChange={(val) => onChange(val ? parseFloat(val) : null)}
          debounceMs={300}
          onBlurCommit={true}
          required={required}
          disabled={disabled}
          placeholder={metadata.placeholder}
          className={className || 'px-2 py-1 border rounded'}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={className || 'px-2 py-1 border rounded'}
        />
      );

    case 'datetime':
      return (
        <input
          type="datetime-local"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={className || 'px-2 py-1 border rounded'}
        />
      );

    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4"
        />
      );

    case 'textarea':
      return (
        <DebouncedTextarea
          value={value ?? ''}
          onChange={(val) => onChange(val)}
          debounceMs={300}
          onBlurCommit={true}
          required={required}
          disabled={disabled}
          placeholder={metadata.placeholder}
          className={className || 'px-2 py-1 border rounded'}
          rows={4}
        />
      );

    // v9.8.0: EntityInstanceNameSelect - single entity reference (edit mode)
    // Backend: inputType: EntityInstanceNameSelect (from edit-type-mapping.yaml)
    case 'EntityInstanceNameSelect': {
      const entityCode = metadata.lookupEntity;

      if (!entityCode) {
        console.warn(`[EDIT] Missing lookupEntity for field ${metadata.key}`);
        return (
          <DebouncedInput
            type="text"
            value={value ?? ''}
            onChange={(val) => onChange(val)}
            debounceMs={300}
            onBlurCommit={true}
            required={required}
            disabled={disabled}
            placeholder={metadata.placeholder || 'Missing entity configuration'}
            className={className || 'px-2 py-1 border rounded'}
          />
        );
      }

      return (
        <EntityInstanceNameSelect
          entityCode={entityCode}
          value={value ?? ''}
          onChange={(uuid, _label) => onChange(uuid)}
          disabled={disabled}
          required={required}
          placeholder={metadata.placeholder || `Select ${entityCode}...`}
          className={className}
        />
      );
    }

    // v9.4.0: EntityInstanceNameMultiSelect - multi-select entity reference (edit mode)
    // Backend: inputType: EntityInstanceNameMultiSelect (from edit-type-mapping.yaml)
    case 'EntityInstanceNameMultiSelect': {
      const entityCode = metadata.lookupEntity;

      if (!entityCode) {
        console.warn(`[EDIT] Missing lookupEntity for field ${metadata.key}`);
        return (
          <DebouncedInput
            type="text"
            value={Array.isArray(value) ? value.join(', ') : (value ?? '')}
            onChange={(val) => onChange(val)}
            debounceMs={300}
            onBlurCommit={true}
            required={required}
            disabled={disabled}
            placeholder={metadata.placeholder || 'Missing entity configuration'}
            className={className || 'px-2 py-1 border rounded'}
          />
        );
      }

      // Ensure value is an array
      const arrayValue = Array.isArray(value) ? value : (value ? [value] : []);

      return (
        <EntityInstanceNameMultiSelect
          entityCode={entityCode}
          value={arrayValue}
          onChange={(uuids) => onChange(uuids)}
          disabled={disabled}
          required={required}
          placeholder={metadata.placeholder || `Select ${entityCode}...`}
          className={className}
        />
      );
    }

    // v9.4.0: Handle component-based inputType (YAML pattern: inputType: 'component' with component: '<name>')
    case 'component': {
      const componentName = metadata.component;

      if (!componentName) {
        console.warn(`[EDIT] inputType: 'component' but no component specified for field ${metadata.key}`);
        return (
          <DebouncedInput
            type="text"
            value={value ?? ''}
            onChange={(val) => onChange(val)}
            debounceMs={300}
            onBlurCommit={true}
            required={required}
            disabled={disabled}
            placeholder={metadata.placeholder || 'Missing component configuration'}
            className={className || 'px-2 py-1 border rounded'}
          />
        );
      }

      // Route to appropriate component based on component name
      switch (componentName) {
        case 'EntityInstanceNameSelect': {
          const entityCode = metadata.lookupEntity;
          if (!entityCode) {
            console.warn(`[EDIT] Missing lookupEntity for EntityInstanceNameSelect field ${metadata.key}`);
            return <DebouncedInput type="text" value={value ?? ''} onChange={(val) => onChange(val)} debounceMs={300} onBlurCommit={true} />;
          }
          return (
            <EntityInstanceNameSelect
              entityCode={entityCode}
              value={value ?? ''}
              onChange={(uuid, _label) => onChange(uuid)}
              disabled={disabled}
              required={required}
              placeholder={metadata.placeholder || `Select ${entityCode}...`}
              className={className}
            />
          );
        }

        case 'EntityInstanceNameMultiSelect': {
          const entityCode = metadata.lookupEntity;
          if (!entityCode) {
            console.warn(`[EDIT] Missing lookupEntity for EntityInstanceNameMultiSelect field ${metadata.key}`);
            return <DebouncedInput type="text" value={value ?? ''} onChange={(val) => onChange(val)} debounceMs={300} onBlurCommit={true} />;
          }
          const arrayValue = Array.isArray(value) ? value : (value ? [value] : []);
          return (
            <EntityInstanceNameMultiSelect
              entityCode={entityCode}
              value={arrayValue}
              onChange={(uuids) => onChange(uuids)}
              disabled={disabled}
              required={required}
              placeholder={metadata.placeholder || `Select ${entityCode}...`}
              className={className}
            />
          );
        }

        // v12.2.0: DataLabelSelect and BadgeDropdownSelect both handle datalabel dropdowns
        case 'DataLabelSelect':
        case 'BadgeDropdownSelect': {
          // v12.0.0: Use lookupField instead of datalabelKey
          const lookupField = metadata.lookupField || metadata.key;
          const datalabelOptions = getDatalabelSync(lookupField);

          if (datalabelOptions && datalabelOptions.length > 0) {
            const coloredOptions: BadgeDropdownSelectOption[] = datalabelOptions.map(opt => ({
              value: opt.name,
              label: opt.name,
              metadata: {
                color_code: colorCodeToTailwindClass(opt.color_code)
              }
            }));

            return (
              <BadgeDropdownSelect
                value={value ?? ''}
                options={coloredOptions}
                onChange={onChange}
                placeholder={metadata.placeholder || 'Select...'}
              />
            );
          }

          // Fallback if options not loaded
          return (
            <select
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              required={required}
              disabled={disabled}
              className={className || 'px-2 py-1 border rounded'}
            >
              <option value="">Loading...</option>
            </select>
          );
        }

        case 'MetadataTable':
        case 'DAGVisualizer':
          // These are view-only components, not edit components
          // Fallback to readonly display
          return (
            <div className="text-dark-500 italic">View-only component</div>
          );

        default:
          console.warn(`[EDIT] Unknown component: ${componentName} for field ${metadata.key}`);
          return (
            <DebouncedInput
              type="text"
              value={value ?? ''}
              onChange={(val) => onChange(val)}
              debounceMs={300}
              onBlurCommit={true}
              required={required}
              disabled={disabled}
              placeholder={metadata.placeholder}
              className={className || 'px-2 py-1 border rounded'}
            />
          );
      }
    }

    // v12.2.0: Legacy 'select' inputType removed - use inputType: 'component' with component: 'DataLabelSelect'

    case 'text':
    default:
      return (
        <DebouncedInput
          type="text"
          value={value ?? ''}
          onChange={(val) => onChange(val)}
          debounceMs={300}
          onBlurCommit={true}
          required={required}
          disabled={disabled}
          placeholder={metadata.placeholder}
          className={className || 'px-2 py-1 border rounded'}
        />
      );
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
