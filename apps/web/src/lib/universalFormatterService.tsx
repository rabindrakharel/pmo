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
 * ✅ BACKEND-DRIVEN RENDERING
 * ============================================================================
 *
 * ```typescript
 * import {
 *   renderViewModeFromMetadata,     // View mode (uses backend metadata)
 *   renderEditModeFromMetadata,     // Edit mode (uses backend metadata)
 *   hasBackendMetadata,             // Type guard for metadata responses
 *   formatValueFromMetadata         // Format using backend metadata
 * } from './universalFormatterService';
 *
 * // Check if response has backend metadata
 * if (hasBackendMetadata(apiResponse)) {
 *   const fieldMeta = apiResponse.metadata.fields.find(f => f.key === 'budget_allocated_amt');
 *
 *   // Render using backend metadata
 *   const viewElement = renderViewModeFromMetadata(50000, fieldMeta);
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
 * - renderDataLabelBadge() - Pure badge renderer
 * - transformForApi() - Data transformation
 * - transformFromApi() - Data transformation
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { formatters } from './config/locale';

// ============================================================================
// BACKEND METADATA TYPES
// ============================================================================

/**
 * Component visibility per view type (backend-provided)
 */
export interface ComponentVisibility {
  EntityDataTable: boolean;
  EntityDetailView: boolean;
  EntityFormContainer: boolean;
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

  // Backend-driven field loading
  loadFromDataLabels?: boolean;
  loadFromEntity?: string;
  datalabelKey?: string;

  // Composite fields
  composite?: boolean;
  compositeConfig?: CompositeFieldConfig;
  component?: string;
}

/**
 * Entity metadata container (backend response)
 */
export interface EntityMetadata {
  entity: string;
  fields: BackendFieldMetadata[];
}

/**
 * API response with metadata
 */
export interface ApiResponseWithMetadata {
  data: any;
  metadata: EntityMetadata;
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
 * Format relative time (pure function)
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '-';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
    if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
    return `${Math.floor(diffDay / 365)}y ago`;
  } catch (e) {
    return '-';
  }
}

/**
 * Format friendly date (pure function)
 */
export function formatFriendlyDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-CA');
  } catch (e) {
    return '-';
  }
}

// ============================================================================
// BADGE COLORS (Constants)
// ============================================================================

export const COLOR_MAP: Record<string, string> = {
  // Priority levels
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',

  // Status colors
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',

  // Boolean states
  true: 'bg-green-100 text-green-700',
  false: 'bg-gray-100 text-gray-600',
  yes: 'bg-green-100 text-green-700',
  no: 'bg-gray-100 text-gray-600',

  // Default
  default: 'bg-gray-100 text-gray-600'
};

/**
 * Get badge color from settings (pure lookup)
 */
let settingsColorsCache: Map<string, Map<string, string>> | null = null;

export function getSettingColor(datalabel: string, value: string | null | undefined): string | undefined {
  if (!value || !settingsColorsCache) return undefined;
  const datalabelColors = settingsColorsCache.get(datalabel);
  return datalabelColors?.get(value.toLowerCase());
}

/**
 * Load settings colors into cache
 */
export async function loadSettingsColors(datalabels: string[]): Promise<void> {
  settingsColorsCache = new Map();
  // Implementation would fetch from API
  // For now, use COLOR_MAP as fallback
}

/**
 * Render datalabel badge (pure renderer)
 */
export function renderDataLabelBadge(
  value: string,
  datalabel: string,
  metadata?: { color?: string }
): React.ReactElement {
  const color = metadata?.color || getSettingColor(datalabel, value) || COLOR_MAP[value?.toLowerCase()] || COLOR_MAP.default;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {value}
    </span>
  );
}

/**
 * Render generic badge (pure renderer)
 */
export function renderBadge(
  value: string,
  color?: string
): React.ReactElement {
  const badgeColor = color || COLOR_MAP[value?.toLowerCase()] || COLOR_MAP.default;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
      {value}
    </span>
  );
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

/**
 * Format value using backend metadata
 */
export function formatValueFromMetadata(
  value: any,
  metadata: BackendFieldMetadata
): string {
  if (value === null || value === undefined || value === '') return '-';

  switch (metadata.renderType) {
    case 'currency':
      return formatCurrency(value, metadata.format?.currency);

    case 'date':
      return formatFriendlyDate(value);

    case 'timestamp':
      return formatRelativeTime(value);

    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'badge':
      return value;

    default:
      return String(value);
  }
}

// ============================================================================
// BACKEND-DRIVEN RENDERERS (View & Edit Modes)
// ============================================================================

/**
 * Render field in VIEW mode using backend metadata
 */
export function renderViewModeFromMetadata(
  value: any,
  metadata: BackendFieldMetadata,
  record?: Record<string, any>
): React.ReactElement {
  // Handle empty values
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">—</span>;
  }

  // Render based on backend-specified renderType
  switch (metadata.renderType) {
    case 'currency':
      const formatted = formatCurrency(value, metadata.format?.currency);
      return <span className="font-mono text-right">{formatted}</span>;

    case 'date':
      return <span>{formatFriendlyDate(value)}</span>;

    case 'timestamp':
      return <span className="text-sm text-gray-600">{formatRelativeTime(value)}</span>;

    case 'boolean':
      return (
        <span className={value ? 'text-green-600' : 'text-gray-400'}>
          {value ? '✓' : '✗'}
        </span>
      );

    case 'badge':
      if (metadata.loadFromDataLabels && metadata.datalabelKey) {
        return renderDataLabelBadge(value, metadata.datalabelKey);
      }
      return renderBadge(value);

    case 'json':
      return (
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(value, null, 2)}
        </pre>
      );

    case 'array':
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                {String(item)}
              </span>
            ))}
          </div>
        );
      }
      return <span>{String(value)}</span>;

    case 'reference':
      return <span className="text-blue-600">{value}</span>;

    default:
      return <span>{String(value)}</span>;
  }
}

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
        <input
          type="number"
          step={metadata.inputType === 'currency' ? '0.01' : '1'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          required={required}
          disabled={disabled}
          placeholder={metadata.placeholder}
          className={`px-2 py-1 border rounded ${className}`}
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
          className={`px-2 py-1 border rounded ${className}`}
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
          className={`px-2 py-1 border rounded ${className}`}
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
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={metadata.placeholder}
          className={`px-2 py-1 border rounded ${className}`}
          rows={4}
        />
      );

    case 'select':
      return (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={`px-2 py-1 border rounded ${className}`}
        >
          <option value="">Select...</option>
          {/* Options would be loaded from backend via loadFromDataLabels or loadFromEntity */}
        </select>
      );

    case 'text':
    default:
      return (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={metadata.placeholder}
          className={`px-2 py-1 border rounded ${className}`}
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

  // Badge renderers
  renderDataLabelBadge,
  renderBadge,
  getSettingColor,
  loadSettingsColors,

  // Data transformers
  transformForApi,
  transformFromApi,
  transformArrayField,
  transformDateField,

  // Backend metadata helpers
  hasBackendMetadata,
  getFieldMetadataFromResponse,
  getAllFieldMetadataFromResponse,
  formatValueFromMetadata,

  // Backend-driven renderers
  renderViewModeFromMetadata,
  renderEditModeFromMetadata,

  // Constants
  COLOR_MAP,
  SYSTEM_FIELDS,
  READONLY_FIELDS
};
