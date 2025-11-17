/**
 * ============================================================================
 * UNIVERSAL FORMATTER SERVICE - Complete Formatting System
 * ============================================================================
 *
 * SINGLE SOURCE OF TRUTH for all formatting concerns across the application.
 * Behaves like a service - everything is LOCAL, no API calls needed for formatting.
 *
 * This service consolidates:
 * 1. Naming convention detection (column name → format type)
 * 2. All formatters (formatCurrency, formatDate, formatRelativeTime, etc.)
 * 3. Badge rendering (renderSettingBadge, renderBadge)
 * 4. Field capability detection (editable vs readonly)
 * 5. Data transformation (API ↔ Frontend)
 *
 * ARCHITECTURAL BENEFITS:
 * ✅ Single import for all formatting needs
 * ✅ No API calls - everything is local logic
 * ✅ Convention over configuration (column name determines behavior)
 * ✅ DRY principle - zero duplication
 * ✅ Type-safe with TypeScript
 * ✅ 100% reusable across all components
 *
 * USAGE:
 * ```typescript
 * import {
 *   detectFieldFormat,
 *   formatFieldValue,
 *   renderFieldDisplay,
 *   getEditType
 * } from './universalFormatterService';
 *
 * // 1. Detect format from column name + data type
 * const format = detectFieldFormat('budget_allocated_amt', 'numeric');
 * // Returns: { type: 'currency', label: 'Budget Allocated', width: '120px', align: 'right' }
 *
 * // 2. Format value for display
 * const formatted = formatFieldValue(50000, 'currency');
 * // Returns: "$50,000.00"
 *
 * // 3. Render field for display (React element)
 * const element = renderFieldDisplay(50000, { type: 'currency' });
 * // Returns: <span>$50,000.00</span>
 *
 * // 4. Get edit type
 * const editType = getEditType('budget_allocated_amt', 'numeric');
 * // Returns: 'number'
 * ```
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { formatters } from './config/locale';
import { DISPLAY_CONFIG } from './config/display';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type FormatType =
  | 'text' | 'currency' | 'number' | 'percentage'
  | 'date' | 'datetime' | 'relative-time'
  | 'badge' | 'tags' | 'reference' | 'boolean';

export type EditType =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'checkbox' | 'boolean'
  | 'textarea' | 'tags' | 'jsonb' | 'datatable' | 'file'
  | 'dag-select' | 'readonly';

export interface FieldFormat {
  type: FormatType;
  label: string;                      // Human-readable label
  width: string;                      // Column width (e.g., '120px')
  align: 'left' | 'center' | 'right'; // Text alignment
  sortable: boolean;                  // Can be sorted
  filterable: boolean;                // Can be filtered
  editable: boolean;                  // Can be edited
  editType: EditType;                 // Input type for editing

  // Optional properties
  settingsDatalabel?: string;         // For badge type
  entityType?: string;                // For reference type
  dateFormat?: string;                // For date type
}

export interface FieldCapability {
  inlineEditable: boolean;
  editType: EditType;
  loadOptionsFromSettings?: boolean;
  settingsDatalabel?: string;
  acceptedFileTypes?: string;
  isFileUpload: boolean;
}

// ============================================================================
// PART 1: NAMING CONVENTION DETECTION
// ============================================================================

/**
 * System fields that should be hidden from UI
 */
const SYSTEM_FIELDS = new Set([
  'id',
  'created_ts',
  'updated_ts',
  'created_by',
  'updated_by',
  'from_ts',
  'to_ts',
  'active_flag',
  'version'
]);

/**
 * Readonly fields that cannot be edited
 */
const READONLY_FIELDS = new Set([
  'id',
  'created_ts',
  'updated_ts',
  'created_by',
  'updated_by',
  'from_ts',
  'to_ts',
  'parent_id',
  'parent_type',
  'parent_name',
  'child_count',
  'version'
]);

/**
 * Field naming patterns for detection
 */
const FIELD_PATTERNS = {
  // Currency fields
  currency: /_(amt|amount|price|cost)$|^(budget|revenue|expense)_/i,

  // Percentage fields
  percentage: /_(pct|percentage|rate)$/i,

  // Settings/datalabel fields (dl__*)
  settings: /^dl__/,

  // Boolean fields
  boolean: /_flag$|^is_|^has_|^can_/i,

  // Date fields
  date: /_date$/i,

  // Timestamp fields
  timestamp: /_(ts|at)$/i,

  // Tag/array fields
  tags: /^tags$|_tags$/i,

  // Reference fields (*_id with uuid type)
  reference: /_id$/,

  // Number fields
  number: /_(count|qty|quantity|level|order)$/i,

  // Readonly patterns
  readonly: /^(id|created_ts|updated_ts|created_by|updated_by|version|from_ts|to_ts|parent_id|parent_type|parent_name|child_count|total_|sum_|avg_|max_|min_)$/i,

  // File upload fields
  file: /^attachment$|attachment_object_key$|_file$|_document$/i
};

/**
 * CORE FUNCTION: Detect field format from column name and data type
 *
 * This is the SINGLE SOURCE OF TRUTH for format detection.
 * Convention over configuration - column name + data type determine everything.
 *
 * @param columnName - Database column name (e.g., 'budget_allocated_amt')
 * @param dataType - PostgreSQL data type (e.g., 'numeric', 'varchar', 'boolean')
 * @returns Complete field format specification
 *
 * @example
 * detectFieldFormat('budget_allocated_amt', 'numeric')
 * // Returns: {
 * //   type: 'currency',
 * //   label: 'Budget Allocated',
 * //   width: '120px',
 * //   align: 'right',
 * //   editType: 'number',
 * //   ...
 * // }
 */
export function detectFieldFormat(columnName: string, dataType: string): FieldFormat {
  const label = generateFieldLabel(columnName);
  const isReadonly = READONLY_FIELDS.has(columnName);
  const isVisible = !isInvisibleField(columnName);

  // ⭐ CURRENCY FIELDS → formatCurrency()
  if (FIELD_PATTERNS.currency.test(columnName)) {
    return {
      type: 'currency',
      label,
      width: '120px',
      align: 'right',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'number'
    };
  }

  // ⭐ PERCENTAGE FIELDS → formatPercentage()
  if (FIELD_PATTERNS.percentage.test(columnName)) {
    return {
      type: 'percentage',
      label,
      width: '100px',
      align: 'right',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'number'
    };
  }

  // ⭐ SETTINGS FIELDS (dl__*) → renderSettingBadge()
  if (FIELD_PATTERNS.settings.test(columnName)) {
    return {
      type: 'badge',
      label,
      width: '150px',
      align: 'center',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'select',
      settingsDatalabel: columnName.replace('dl__', '')
    };
  }

  // ⭐ BOOLEAN FIELDS → checkbox + badge
  if (dataType === 'boolean' || FIELD_PATTERNS.boolean.test(columnName)) {
    return {
      type: 'boolean',
      label,
      width: '100px',
      align: 'center',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'boolean'
    };
  }

  // ⭐ DATE FIELDS → formatDate()
  if (dataType === 'date' || FIELD_PATTERNS.date.test(columnName)) {
    return {
      type: 'date',
      label,
      width: '120px',
      align: 'left',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'date',
      dateFormat: 'MMM DD, YYYY'
    };
  }

  // ⭐ TIMESTAMP FIELDS → formatRelativeTime() or formatDateTime()
  if ((dataType === 'timestamp with time zone' || dataType === 'timestamp without time zone') ||
      FIELD_PATTERNS.timestamp.test(columnName)) {
    // System timestamps (created_ts, updated_ts) use relative time
    if (columnName.match(/^(created|updated)_ts$/)) {
      return {
        type: 'relative-time',
        label,
        width: '150px',
        align: 'left',
        sortable: true,
        filterable: true,
        editable: false,
        editType: 'readonly'
      };
    }

    // Other timestamps use datetime format
    return {
      type: 'datetime',
      label,
      width: '150px',
      align: 'left',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'date'
    };
  }

  // ⭐ TAG/ARRAY FIELDS → renderTags()
  if (dataType === 'ARRAY' || dataType.startsWith('_') || FIELD_PATTERNS.tags.test(columnName)) {
    return {
      type: 'tags',
      label,
      width: '150px',
      align: 'left',
      sortable: false,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'tags'
    };
  }

  // ⭐ REFERENCE FIELDS (*_id) → renderReference()
  if (FIELD_PATTERNS.reference.test(columnName) && dataType === 'uuid') {
    const entityType = extractEntityType(columnName);
    return {
      type: 'reference',
      label,
      width: '150px',
      align: 'left',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'text',
      entityType
    };
  }

  // ⭐ NUMERIC FIELDS → formatNumber()
  if (['integer', 'bigint', 'numeric', 'decimal', 'double precision', 'real'].includes(dataType)) {
    return {
      type: 'number',
      label,
      width: '100px',
      align: 'right',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'number'
    };
  }

  // ⭐ FILE FIELDS → file upload
  if (FIELD_PATTERNS.file.test(columnName)) {
    return {
      type: 'text',
      label,
      width: '150px',
      align: 'left',
      sortable: true,
      filterable: true,
      editable: !isReadonly,
      editType: isReadonly ? 'readonly' : 'file'
    };
  }

  // ⭐ DEFAULT: Plain text
  return {
    type: 'text',
    label,
    width: columnName === 'name' ? '200px' : columnName === 'code' ? '120px' : '150px',
    align: 'left',
    sortable: true,
    filterable: true,
    editable: !isReadonly,
    editType: isReadonly ? 'readonly' : 'text'
  };
}

/**
 * Generate human-readable label from column name
 *
 * @example
 * generateFieldLabel('budget_allocated_amt') → 'Budget Allocated'
 * generateFieldLabel('dl__project_stage') → 'Project Stage'
 * generateFieldLabel('updated_ts') → 'Updated'
 */
export function generateFieldLabel(columnName: string): string {
  // Remove common prefixes/suffixes
  let label = columnName
    .replace(/^dl__/, '')          // Remove dl__ prefix
    .replace(/_ts$/, '')           // Remove _ts suffix
    .replace(/_amt$/, '')          // Remove _amt suffix
    .replace(/_id$/, '')           // Remove _id suffix
    .replace(/_flag$/, '')         // Remove _flag suffix
    .replace(/_pct$/, '');         // Remove _pct suffix

  // Convert snake_case to Title Case
  label = label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return label;
}

/**
 * Determine if field should be invisible by default
 */
function isInvisibleField(columnName: string): boolean {
  // Hide ID fields (used for joins/references)
  if (columnName.endsWith('_id') && columnName !== 'id') {
    return true;
  }

  // Hide metadata fields
  if (columnName === 'metadata') {
    return true;
  }

  return false;
}

/**
 * Extract entity type from reference column name
 *
 * @example
 * extractEntityType('manager_employee_id') → 'employee'
 * extractEntityType('project_id') → 'project'
 */
function extractEntityType(columnName: string): string | undefined {
  const match = columnName.match(/^(.+?)_?(employee|project|task|business|office|customer|role|cust|event|calendar)_id$/);
  if (match) {
    const entityType = match[2];
    return entityType === 'cust' ? 'customer' : entityType;
  }
  return undefined;
}

/**
 * Get edit type from column name and data type
 */
export function getEditType(columnName: string, dataType: string): EditType {
  if (READONLY_FIELDS.has(columnName)) {
    return 'readonly';
  }

  if (FIELD_PATTERNS.settings.test(columnName)) {
    return 'select';
  }

  if (dataType === 'boolean' || FIELD_PATTERNS.boolean.test(columnName)) {
    return 'boolean';
  }

  if (dataType === 'date' || FIELD_PATTERNS.date.test(columnName)) {
    return 'date';
  }

  if (dataType.includes('timestamp') || FIELD_PATTERNS.timestamp.test(columnName)) {
    return 'date';
  }

  if (['integer', 'bigint', 'numeric', 'decimal', 'double precision', 'real'].includes(dataType) ||
      FIELD_PATTERNS.number.test(columnName)) {
    return 'number';
  }

  if (dataType === 'ARRAY' || dataType.startsWith('_') || FIELD_PATTERNS.tags.test(columnName)) {
    return 'tags';
  }

  if (FIELD_PATTERNS.file.test(columnName)) {
    return 'file';
  }

  return 'text';
}

// ============================================================================
// PART 2: VALUE FORMATTERS (Display Logic)
// ============================================================================

/**
 * Format a value based on format type
 * Returns plain string or number (no React elements)
 *
 * @param value - Value to format
 * @param formatType - Format type (currency, date, etc.)
 * @returns Formatted string
 */
export function formatFieldValue(value: any, formatType: FormatType): string {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  switch (formatType) {
    case 'currency':
      return formatCurrency(value);

    case 'number':
      return formatters.number(value);

    case 'percentage':
      return formatters.percentage(value);

    case 'date':
      return formatters.date(value);

    case 'datetime':
      return formatters.datetime(value);

    case 'relative-time':
      return formatRelativeTime(value);

    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'tags':
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);

    case 'badge':
    case 'reference':
    case 'text':
    default:
      return String(value);
  }
}

/**
 * Format currency value
 * Uses centralized locale formatter
 */
export function formatCurrency(value: number | string | null | undefined, currency: string = 'CAD'): string {
  if (value === null || value === undefined || value === '') return '—';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '—';

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency
  }).format(numValue);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 10) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;
  if (diffYears === 1) return '1 year ago';
  return `${diffYears} years ago`;
}

/**
 * Format friendly date
 */
export function formatFriendlyDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Check if a field is a currency field
 */
export function isCurrencyField(key: string): boolean {
  return FIELD_PATTERNS.currency.test(key);
}

// ============================================================================
// PART 3: BADGE RENDERING
// ============================================================================

/**
 * Color mapping: Database color_code → Tailwind CSS classes
 */
export const COLOR_MAP: Record<string, string> = {
  'blue': 'bg-dark-100 text-dark-600 border border-dark-400',
  'purple': 'bg-purple-100 text-purple-800 border border-purple-200',
  'green': 'bg-green-100 text-green-800 border border-green-200',
  'red': 'bg-red-100 text-red-800 border border-red-200',
  'yellow': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  'orange': 'bg-orange-100 text-orange-800 border border-orange-200',
  'gray': 'bg-dark-100 text-dark-600 border border-dark-300',
  'cyan': 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  'pink': 'bg-pink-100 text-pink-800 border border-pink-200',
  'amber': 'bg-amber-100 text-amber-800 border border-amber-200'
};

/**
 * Settings color cache
 * Stores mapping of datalabel → (value → color_code)
 */
const settingsColorCache = new Map<string, Map<string, string>>();

/**
 * Load colors for a settings datalabel from API
 */
export async function loadSettingsColors(datalabel: string): Promise<void> {
  if (settingsColorCache.has(datalabel)) {
    return;
  }

  try {
    const { getSettingDatalabel, loadSettingOptions } = await import('./settingsLoader');
    const mappedDatalabel = getSettingDatalabel(datalabel) || datalabel;
    const options = await loadSettingOptions(mappedDatalabel);

    const colorMap = new Map<string, string>();
    for (const option of options) {
      const label = String(option.label);
      const colorCode = option.metadata?.color_code;
      if (colorCode) {
        colorMap.set(label, colorCode);
      }
    }

    settingsColorCache.set(datalabel, colorMap);
  } catch (error) {
    console.error(`Failed to load colors for ${datalabel}:`, error);
    settingsColorCache.set(datalabel, new Map());
  }
}

/**
 * Get color code for a settings value
 */
export function getSettingColor(datalabel: string, value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const colorMap = settingsColorCache.get(datalabel);
  return colorMap?.get(value);
}

/**
 * Preload colors for multiple datalabels
 */
export async function preloadSettingsColors(datalabels: string[]): Promise<void> {
  await Promise.all(datalabels.map(dl => loadSettingsColors(dl)));
}

/**
 * Render setting badge with database-driven colors
 */
export function renderSettingBadge(
  colorCodeOrValue: string | null | undefined,
  labelOrOptions?: string | null | undefined | { datalabel: string },
  size: 'xs' | 'sm' | 'md' = 'xs'
): React.ReactElement {
  let label: string | null | undefined;
  let colorCode: string | undefined;

  // Determine usage mode
  if (typeof labelOrOptions === 'object' && labelOrOptions !== null && 'datalabel' in labelOrOptions) {
    // MODE 2: Datalabel-based lookup
    label = colorCodeOrValue;
    const datalabel = labelOrOptions.datalabel;
    if (label) {
      colorCode = getSettingColor(datalabel, label);
    }
  } else {
    // MODE 1: Direct color code
    colorCode = colorCodeOrValue || undefined;
    label = labelOrOptions as string | null | undefined;
  }

  // Handle null/undefined labels
  if (!label) {
    return React.createElement(
      'span',
      { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-100 text-dark-600 border border-dark-300' },
      '—'
    );
  }

  // Get color class (fallback to gray if not found)
  const colorClass = colorCode ? (COLOR_MAP[colorCode] || COLOR_MAP.gray) : COLOR_MAP.gray;

  // Size classes
  const sizeClasses = {
    xs: 'px-2.5 py-0.5 text-xs',
    sm: 'px-3 py-1 text-sm',
    md: 'px-3.5 py-1.5 text-sm'
  };

  return React.createElement(
    'span',
    {
      className: `inline-flex items-center rounded-full font-medium ${colorClass} ${sizeClasses[size]}`,
      title: label
    },
    label
  );
}

/**
 * Render plain badge without color lookup
 */
export function renderBadge(
  label: string | null | undefined,
  variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' = 'default',
  size: 'xs' | 'sm' | 'md' = 'xs'
): React.ReactElement {
  if (!label) {
    return React.createElement(
      'span',
      { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-100 text-dark-600 border border-dark-300' },
      '—'
    );
  }

  const variantClasses = {
    default: 'bg-dark-100 text-dark-600 border border-dark-300',
    primary: 'bg-dark-100 text-dark-600 border border-dark-400',
    success: 'bg-green-100 text-green-800 border border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    danger: 'bg-red-100 text-red-800 border border-red-200',
    info: 'bg-cyan-100 text-cyan-800 border border-cyan-200'
  };

  const sizeClasses = {
    xs: 'px-2.5 py-0.5 text-xs',
    sm: 'px-3 py-1 text-sm',
    md: 'px-3.5 py-1.5 text-sm'
  };

  return React.createElement(
    'span',
    {
      className: `inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]}`,
      title: label
    },
    label
  );
}

// ============================================================================
// PART 4: REACT ELEMENT RENDERING (Full Display with Components)
// ============================================================================

/**
 * Render field value as React element
 * Handles special cases like badges, tags, booleans with proper styling
 *
 * @param value - Value to render
 * @param format - Field format specification
 * @returns React element
 */
export function renderFieldDisplay(value: any, format: { type: FormatType; settingsDatalabel?: string; entityType?: string }): React.ReactNode {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return React.createElement('span', { className: 'text-dark-600 italic' }, '—');
  }

  switch (format.type) {
    case 'currency':
      return React.createElement('span', null, formatCurrency(value));

    case 'number':
      return React.createElement('span', null, formatters.number(value));

    case 'percentage':
      return React.createElement('span', null, formatters.percentage(value));

    case 'date':
      return React.createElement('span', null, formatters.date(value));

    case 'datetime':
      return React.createElement('span', null, formatters.datetime(value));

    case 'relative-time':
      return React.createElement('span', null, formatRelativeTime(value));

    case 'badge':
      const datalabel = format.settingsDatalabel || '';
      const colorCode = getSettingColor(datalabel, String(value));
      return renderSettingBadge(colorCode, String(value));

    case 'boolean':
      return formatBooleanBadge(value);

    case 'tags':
      return formatTagsList(value);

    case 'reference':
      return formatReference(value, format.entityType);

    case 'text':
    default:
      return React.createElement('span', null, String(value));
  }
}

/**
 * Format boolean as badge
 */
function formatBooleanBadge(value: boolean, isActiveFlag: boolean = false): React.ReactNode {
  if (isActiveFlag) {
    const colorClass = value
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-600';
    const label = value ? 'Active' : 'Inactive';

    return React.createElement(
      'span',
      { className: `px-2 py-1 rounded-full text-xs font-medium ${colorClass}` },
      label
    );
  }

  return React.createElement('span', { className: 'text-dark-600' }, value ? 'Yes' : 'No');
}

/**
 * Format tags list
 */
function formatTagsList(value: string[] | string): React.ReactNode {
  let tags: string[];

  if (typeof value === 'string') {
    tags = value.split(',').map(t => t.trim()).filter(Boolean);
  } else if (Array.isArray(value)) {
    tags = value;
  } else {
    return React.createElement('span', null, String(value));
  }

  if (tags.length === 0) {
    return React.createElement('span', { className: 'text-dark-600 italic' }, '—');
  }

  const maxDisplay = DISPLAY_CONFIG.MAX_TAGS_DISPLAY;
  const displayTags = tags.slice(0, maxDisplay);
  const remaining = tags.length - maxDisplay;

  return React.createElement(
    'span',
    { className: 'inline-flex items-center gap-1 flex-wrap' },
    ...displayTags.map((tag, i) =>
      React.createElement(
        'span',
        { key: i, className: 'px-2 py-0.5 bg-dark-100 text-dark-600 rounded text-xs' },
        tag
      )
    ),
    remaining > 0 && React.createElement(
      'span',
      { className: 'text-xs text-dark-600' },
      `+${remaining} more`
    )
  );
}

/**
 * Format reference link
 */
function formatReference(value: any, entityType?: string): React.ReactNode {
  if (!value) {
    return React.createElement('span', { className: 'text-dark-600 italic' }, '—');
  }

  const displayText = typeof value === 'object' && value.name
    ? value.name
    : String(value);

  const id = typeof value === 'object' && value.id ? value.id : null;

  if (entityType && id) {
    return React.createElement(
      'a',
      {
        href: `/${entityType}/${id}`,
        className: 'text-dark-600 hover:text-dark-600 underline',
        onClick: (e: React.MouseEvent) => e.stopPropagation()
      },
      displayText
    );
  }

  return React.createElement('span', { className: 'text-dark-600' }, displayText);
}

// ============================================================================
// PART 5: DATA TRANSFORMATION (API ↔ Frontend)
// ============================================================================

/**
 * Transform edited data before sending to API
 */
export function transformForApi(data: Record<string, any>, originalRecord?: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = { ...data };

  for (const [key, value] of Object.entries(transformed)) {
    if (value === null || value === undefined) {
      continue;
    }

    // Date field transformation
    if (isDateField(key) && typeof value === 'string') {
      transformed[key] = transformDateField(value);
    }
    // Array field transformation
    else if (Array.isArray(originalRecord?.[key])) {
      transformed[key] = transformArrayField(value);
    }
    // File upload field
    else if (isFileField(key, value)) {
      if (value instanceof File || value instanceof FileList) {
        delete transformed[key];
      }
    }
    // Empty string handling
    else if (value === '') {
      transformed[key] = null;
    }
  }

  return transformed;
}

/**
 * Transform array field from string to array
 */
export function transformArrayField(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      return [];
    }
    return value
      .split(',')
      .map(item => item.trim())
      .filter(item => item !== '');
  }

  return [];
}

/**
 * Check if field is a date field
 */
function isDateField(key: string): boolean {
  return /_(date|ts)$|^date_/i.test(key);
}

/**
 * Transform date field to yyyy-MM-dd format
 */
export function transformDateField(value: any): string | null {
  if (!value) {
    return null;
  }

  try {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return null;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error transforming date field:', error);
    return null;
  }
}

/**
 * Check if field is a file field
 */
function isFileField(key: string, value: any): boolean {
  const fileFieldPatterns = [
    'file', 'attachment', 'document', 'upload', 'image', 'photo', 'avatar'
  ];

  const isFileKey = fileFieldPatterns.some(pattern =>
    key.toLowerCase().includes(pattern)
  );

  const isFileValue = value instanceof File || value instanceof FileList;

  return isFileKey || isFileValue;
}

/**
 * Transform display data from API for form editing
 */
export function transformFromApi(data: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = { ...data };

  for (const [key, value] of Object.entries(transformed)) {
    if (value === null || value === undefined) {
      continue;
    }

    // Arrays → comma-separated string
    if (Array.isArray(value) && typeof value[0] === 'string') {
      transformed[key] = value.join(', ');
    }
  }

  return transformed;
}

// ============================================================================
// PART 6: FIELD CAPABILITY DETECTION
// ============================================================================

/**
 * Get field capability (editable vs readonly, edit type)
 */
export function getFieldCapability(columnKey: string, dataType?: string): FieldCapability {
  // Rule 1: Readonly fields are NEVER editable
  if (FIELD_PATTERNS.readonly.test(columnKey)) {
    return {
      inlineEditable: false,
      editType: 'readonly',
      isFileUpload: false
    };
  }

  // Rule 2: File fields are ALWAYS editable with drag-drop
  if (FIELD_PATTERNS.file.test(columnKey)) {
    return {
      inlineEditable: true,
      editType: 'file',
      isFileUpload: true,
      acceptedFileTypes: getAcceptedFileTypes(columnKey)
    };
  }

  // Rule 3: Settings fields with dl__ prefix are ALWAYS editable as dropdowns
  if (FIELD_PATTERNS.settings.test(columnKey)) {
    return {
      inlineEditable: true,
      editType: 'select',
      loadOptionsFromSettings: true,
      settingsDatalabel: columnKey.replace('dl__', ''),
      isFileUpload: false
    };
  }

  // Rule 4: Number fields are editable as number inputs
  if ((dataType && ['integer', 'bigint', 'numeric', 'decimal', 'double precision', 'real'].includes(dataType)) ||
      FIELD_PATTERNS.number.test(columnKey)) {
    return {
      inlineEditable: true,
      editType: 'number',
      isFileUpload: false
    };
  }

  // Rule 5: Date fields are editable as date inputs
  if ((dataType && dataType === 'date') || FIELD_PATTERNS.date.test(columnKey)) {
    return {
      inlineEditable: true,
      editType: 'date',
      isFileUpload: false
    };
  }

  // Rule 6: Boolean fields are editable as checkboxes
  if ((dataType && dataType === 'boolean') || FIELD_PATTERNS.boolean.test(columnKey)) {
    return {
      inlineEditable: true,
      editType: 'boolean',
      isFileUpload: false
    };
  }

  // Rule 7: Tags fields are editable as tag inputs
  if ((dataType && (dataType === 'ARRAY' || dataType.startsWith('_'))) || FIELD_PATTERNS.tags.test(columnKey)) {
    return {
      inlineEditable: true,
      editType: 'tags',
      isFileUpload: false
    };
  }

  // Rule 8: Special readonly columns
  const isSpecialReadonly = /^(parent_id|parent_type|parent_name|child_count|total_|sum_|avg_|max_|min_)$/i.test(columnKey);
  if (isSpecialReadonly) {
    return {
      inlineEditable: false,
      editType: 'readonly',
      isFileUpload: false
    };
  }

  // Default: editable as text
  return {
    inlineEditable: true,
    editType: 'text',
    isFileUpload: false
  };
}

/**
 * Get accepted file types based on field name
 */
function getAcceptedFileTypes(fieldName: string): string {
  if (/invoice/i.test(fieldName)) {
    return 'application/pdf,image/png,image/jpeg';
  }
  if (/receipt/i.test(fieldName)) {
    return 'application/pdf,image/png,image/jpeg';
  }
  if (/(image|photo|avatar)/i.test(fieldName)) {
    return 'image/*';
  }
  if (/document/i.test(fieldName)) {
    return 'application/pdf,.doc,.docx,.txt';
  }
  return '*';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Format detection
  detectFieldFormat,
  generateFieldLabel,
  getEditType,

  // Value formatting
  formatFieldValue,
  formatCurrency,
  formatRelativeTime,
  formatFriendlyDate,
  isCurrencyField,

  // Badge rendering
  renderSettingBadge,
  renderBadge,
  loadSettingsColors,
  getSettingColor,
  preloadSettingsColors,

  // React element rendering
  renderFieldDisplay,

  // Data transformation
  transformForApi,
  transformFromApi,
  transformArrayField,
  transformDateField,

  // Field capability
  getFieldCapability,

  // Constants
  COLOR_MAP,
  SYSTEM_FIELDS,
  READONLY_FIELDS
};
