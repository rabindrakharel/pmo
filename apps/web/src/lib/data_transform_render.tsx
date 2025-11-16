/**
 * ============================================================================
 * DATA TRANSFORM & RENDER - "HOW" (Behavior & Logic)
 * ============================================================================
 *
 * ARCHITECTURAL ROLE: Imperative data processing and field behavior
 *
 * This file defines HOW data behaves and is processed:
 * - How to transform data between API and Frontend
 * - How to detect field capabilities (what can be edited)
 * - How to render fields in the UI
 * - How to format data for display
 *
 * WHAT THIS FILE DOES:
 * ✅ Transforms data: API ↔ Frontend (* ✅ Detects capabilities: Auto-determines editability by field name
 * ✅ Formats display: "3 days ago", "Oct 28, 2024"
 * ✅ Renders components: MetadataField, MetadataRow
 * ✅ Processes business logic: Validation, coercion, normalization
 *
 * WHAT THIS FILE DOES NOT DO:
 * ❌ Does NOT define entity schemas (see entityConfig.ts)
 * ❌ Does NOT declare field types (see entityConfig.ts)
 * ❌ Does NOT configure views/columns (see entityConfig.ts)
 *
 * SEPARATION OF CONCERNS:
 * - entityConfig.ts        = WHAT - Schema definition (declarative)
 * - data_transform_render.ts = HOW  - Data behavior (imperative) ← THIS FILE
 *
 * Think of it as:
 * - entityConfig.ts        = Database schema / Type definitions
 * - data_transform_render.ts = Business logic / Data processing ← THIS FILE
 *
 * CONSOLIDATES (v2.5):
 * This file merged 3 previous libraries into ONE:
 * 1. dataTransformers.ts → Part 1 & 2 (transformation + display)
 * 2. fieldCapabilities.ts → Part 3 (capability detection)
 * 3. MetadataField.tsx → Part 4 (UI components)
 *
 * USAGE:
 * ```typescript
 * import { transformForApi, getFieldCapability, formatRelativeTime } from './data_transform_render';
 *
 * // Transform user input for API
 * const apiData = transformForApi({ tag2" }); // → { "tag2"] }
 *
 * // Detect if field is editable
 * const capability = getFieldCapability({ key: 'tags' }); // → { inlineEditable: true, editType: 'tags' }
 *
 * // Format timestamp for display
 * const display = formatRelativeTime('2025-10-25T12:00:00Z'); // → "3 days ago"
 * ```
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import type { ColumnDef, FieldDef } from './entityConfig';

// ============================================================================
// PART 1: DATA TRANSFORMATION (API Communication)
// ============================================================================

/**
 * Transforms edited data before sending to API
 *
 * This is the CENTRALIZED transformation function used by:
 * - EntityDetailPage (form edits)
 * - EntityCreatePage (entity creation)
 * - FilteredDataTable (inline table edits)
 *
 * Handles:
 * - Empty strings → null (API validation requires null, not "")
 * - Date fields: ISO timestamp → yyyy-MM-dd format (2024-08-04T00:00:00.000Z → 2024-08-04)
 * - Tags: string → array conversion
 * - Arrays: comma-separated strings → array
 * - File uploads: File objects → URLs/metadata
 *
 * NOTE: This works in conjunction with date input handlers that also convert "" → null.
 * This creates a two-layer defense: inputs clean data on change, this function cleans
 * any remaining issues before API submission (e.g., from database, untouched fields).
 */
export function transformForApi(data: Record<string, any>, originalRecord?: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = { ...data };

  // Process each field
  for (const [key, value] of Object.entries(transformed)) {
    // Skip null/undefined
    if (value === null || value === undefined) {
      continue;
    }

    // 1. Date field transformation (ISO timestamp → yyyy-MM-dd)
    if (isDateField(key) && typeof value === 'string') {
      transformed[key] = transformDateField(value);
    }

    // 2. Array field transformation (comma-separated string → array)
    else if (Array.isArray(originalRecord?.[key])) {
      transformed[key] = transformArrayField(value);
    }

    // 3. File upload field transformation
    else if (isFileField(key, value)) {
      // File uploads are handled separately via presigned URLs
      // Remove from payload if it's a File object (not yet uploaded)
      if (value instanceof File || value instanceof FileList) {
        delete transformed[key];
      }
    }

    // 4. Empty string handling - convert to null for optional fields
    else if (value === '') {
      transformed[key] = null;
    }
  }

  return transformed;
}

/**
 * Transforms array fields from string to array
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
 * Checks if a field is a date field based on naming convention
 * Matches fields ending with _date or _ts, or starting with date_
 * Examples: actual_start_date, created_ts, date_modified
 */
function isDateField(key: string): boolean {
  return /_(date|ts)$|^date_/i.test(key);
}

/**
 * Transforms date field from various formats to yyyy-MM-dd format
 * Handles:
 * - ISO timestamps: "2024-11-30T00:00:00.000Z" → "2024-11-30"
 * - Already formatted: "2024-11-30" → "2024-11-30"
 * - Date objects: new Date() → "2024-11-30"
 */
export function transformDateField(value: any): string | null {
  if (!value) {
    return null;
  }

  try {
    // If already in yyyy-MM-dd format, return as-is
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // Parse date and format to yyyy-MM-dd
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return null;
    }

    // Format as yyyy-MM-dd
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
 * Checks if a field is a file upload field
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
 * Transforms display data from API for form editing
 * Handles:
 * - Arrays: array → comma-separated string
 */
export function transformFromApi(data: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = { ...data };

  for (const [key, value] of Object.entries(transformed)) {
    // Skip null/undefined
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
// PART 2: DISPLAY TRANSFORMERS (UI Rendering)
// ============================================================================

/**
 * Format a timestamp as relative time (e.g., "20 seconds ago", "3 days ago")
 * Used for created_ts, updated_ts, and other timestamp fields
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';

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
 * Format date in a friendly format (e.g., "Oct 31, 2024")
 */
export function formatFriendlyDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Date range progress metadata
 */
export interface DateRangeProgress {
  startDate: Date;
  endDate: Date;
  today: Date;
  totalDays: number;
  daysPassed: number;
  daysRemaining: number;
  progressPercent: number;
  isBeforeStart: boolean;
  isAfterEnd: boolean;
  isActive: boolean;
}

/**
 * Format a number as currency with thousands separator and $ sign
 * Used for cost, amount, price, revenue fields
 */
export function formatCurrency(value: number | string | null | undefined, currency: string = 'CAD'): string {
  if (value === null || value === undefined || value === '') return '-';

  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '-';

  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency
  }).format(numValue);
}

/**
 * Check if a field key represents a currency/money field
 * Returns true for fields like: cost_amt_lcl, revenue_amt_local, unit_price_cad, etc.
 */
export function isCurrencyField(key: string): boolean {
  const currencyPatterns = [
    '_amt', '_amount', '_cost', '_price', '_revenue', '_budget',
    'amount_', 'cost_', 'price_', 'revenue_', 'budget_',
    'budgeted_amt', 'forecasted_amt', 'outstanding'
  ];

  const lowerKey = key.toLowerCase();
  return currencyPatterns.some(pattern => lowerKey.includes(pattern));
}

/**
 * Calculate date range progress for visualization
 * Used for project/task timelines showing days passed, remaining, and progress
 */
export function calculateDateRangeProgress(
  startDateString: string | Date | null | undefined,
  endDateString: string | Date | null | undefined
): DateRangeProgress | null {
  if (!startDateString || !endDateString) return null;

  const startDate = typeof startDateString === 'string' ? new Date(startDateString) : startDateString;
  const endDate = typeof endDateString === 'string' ? new Date(endDateString) : endDateString;
  const today = new Date();

  // Set all dates to midnight for consistent day counting
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const progressPercent = totalDays > 0 ? Math.max(0, Math.min(100, (daysPassed / totalDays) * 100)) : 0;

  const isBeforeStart = today < startDate;
  const isAfterEnd = today > endDate;
  const isActive = !isBeforeStart && !isAfterEnd;

  return {
    startDate,
    endDate,
    today,
    totalDays,
    daysPassed: Math.max(0, daysPassed),
    daysRemaining: Math.max(0, daysRemaining),
    progressPercent,
    isBeforeStart,
    isAfterEnd,
    isActive
  };
}

// ============================================================================
// PART 3: FIELD CAPABILITY DETECTION (Convention over Configuration)
// ============================================================================

/**
 * Field capability metadata determined from configuration
 */
export interface FieldCapability {
  inlineEditable: boolean;
  editType: 'text' | 'select' | 'tags' | 'file' | 'number' | 'date' | 'readonly';
  loadOptionsFromSettings?: boolean;
  settingsDatalabel?: string;
  acceptedFileTypes?: string;
  isFileUpload: boolean;
}

/**
 * Field naming patterns that indicate specific types
 */
const FIELD_PATTERNS = {
  // Standardized attachment fields - editable with drag-drop upload
  // Primary pattern: "attachment" field (main S3 URI)
  // Supporting fields: attachment_format, attachment_size_bytes, attachment_object_bucket, attachment_object_key
  file: /^attachment$|attachment_object_key$/i,

  // Settings/data label fields - identified by _name suffix and loadOptionsFromSettings
  settingsField: /_name$|_id$|_level$|_stage$|_status$|_tier$|_priority$|_type$/i,

  // Readonly fields - system fields that should never be edited inline
  readonly: /^(id|created_ts|updated_ts|created_by|updated_by|version|from_ts|to_ts)$/i,

  // Date fields
  date: /_(date|ts)$|^date_/i,

  // Number fields (note: _amt is standard for all amounts)
  number: /_(amt|amount|count|qty|quantity|price|cost|revenue|id|level_id|stage_id|sort_order)$/i
};

/**
 * CENTRAL FUNCTION: Determines if a field can be inline edited
 * This is the SINGLE SOURCE OF TRUTH - no manual flags needed!
 *
 * Convention over Configuration:
 * - Settings fields (loadOptionsFromSettings): Auto-editable as dropdown
 * - File fields: Auto-editable with drag-drop
 * - Date fields: Auto-editable as date picker
 * - Number fields: Auto-editable as number input
 * - Readonly patterns: Never editable (id, timestamps, computed fields)
 * - Special readonly: parent_id, parent_type, child_count, aggregate fields
 * - Everything else: Editable as text input (default)
 *
 * This ensures "Add new row" works seamlessly - all columns get input boxes
 * unless they're explicitly system/readonly fields.
 */
export function getFieldCapability(column: ColumnDef | FieldDef): FieldCapability {
  const key = column.key;

  // Rule 1: Readonly fields are NEVER editable
  if (FIELD_PATTERNS.readonly.test(key)) {
    return {
      inlineEditable: false,
      editType: 'readonly',
      isFileUpload: false
    };
  }

  // Rule 2: File/attachment fields are ALWAYS editable with drag-drop
  if (FIELD_PATTERNS.file.test(key)) {
    return {
      inlineEditable: true,
      editType: 'file',
      isFileUpload: true,
      acceptedFileTypes: getAcceptedFileTypes(key)
    };
  }

  // Rule 3: Settings/data label fields with loadOptionsFromSettings are ALWAYS editable as dropdowns
  if (column.loadOptionsFromSettings) {
    return {
      inlineEditable: true,
      editType: 'select',
      loadOptionsFromSettings: true,
      settingsDatalabel: extractSettingsDatalabel(key),
      isFileUpload: false
    };
  }

  // Rule 4: Number fields are editable as number inputs
  if (FIELD_PATTERNS.number.test(key) && !FIELD_PATTERNS.readonly.test(key)) {
    return {
      inlineEditable: true,
      editType: 'number',
      isFileUpload: false
    };
  }

  // Rule 5: Date fields are editable as date inputs
  if (FIELD_PATTERNS.date.test(key) && !FIELD_PATTERNS.readonly.test(key)) {
    return {
      inlineEditable: true,
      editType: 'date',
      isFileUpload: false
    };
  }

  // Rule 6: Simple text fields (name, descr, etc.) are editable by default
  // UNLESS they're in a readonly entity or have specific patterns
  const isSimpleTextField = /^(name|descr|description|title|notes|comments?)$/i.test(key);
  if (isSimpleTextField) {
    return {
      inlineEditable: true,
      editType: 'text',
      isFileUpload: false
    };
  }

  // Rule 7: Special columns that should remain readonly
  // These are typically computed, derived, or reference fields that shouldn't be edited directly
  const isSpecialReadonly = /^(parent_id|parent_type|parent_name|child_count|total_|sum_|avg_|max_|min_)$/i.test(key);
  if (isSpecialReadonly) {
    return {
      inlineEditable: false,
      editType: 'readonly',
      isFileUpload: false
    };
  }

  // Rule 8: Actions column is never editable
  if (key === '_actions' || key === '_selection') {
    return {
      inlineEditable: false,
      editType: 'readonly',
      isFileUpload: false
    };
  }

  // Default: All other fields are editable as text
  // This ensures "Add new row" functionality works seamlessly across all entities
  // Any field not matching the above patterns can be edited as text input
  return {
    inlineEditable: true,
    editType: 'text',
    isFileUpload: false
  };
}

/**
 * Extracts settings datalabel from field name
 * Examples:
 * - opportunity_funnel_stage_name → opportunity_funnel_stage
 * - customer_tier_name → customer_tier
 * - project_stage → project_stage
 */
function extractSettingsDatalabel(fieldName: string): string {
  // Remove _name, _id, _level suffixes
  return fieldName
    .replace(/_name$/, '')
    .replace(/_id$/, '')
    .replace(/_level$/, '');
}

/**
 * Determines accepted file types based on field name
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
  // Default: allow all common file types
  return '*';
}

/**
 * Batch capability detection for all columns
 * Used by DataTable to determine which columns are editable
 */
export function detectColumnCapabilities(columns: ColumnDef[]): Map<string, FieldCapability> {
  const capabilities = new Map<string, FieldCapability>();

  for (const column of columns) {
    capabilities.set(column.key, getFieldCapability(column));
  }

  return capabilities;
}

/**
 * Check if ANY column in the entity is inline editable
 * Used to determine if we should show edit icons
 */
export function hasAnyEditableColumns(columns: ColumnDef[]): boolean {
  return columns.some(col => getFieldCapability(col).inlineEditable);
}

/**
 * Get all editable column keys for an entity
 */
export function getEditableColumnKeys(columns: ColumnDef[]): string[] {
  return columns
    .filter(col => getFieldCapability(col).inlineEditable)
    .map(col => col.key);
}

// ============================================================================
// PART 4: BADGE RENDERING (Settings & Labels - Database-Driven Colors)
// ============================================================================

/**
 * UNIFIED BADGE RENDERING SYSTEM
 * ================================
 *
 * DRY PRINCIPLE: Single source of truth for all badge rendering across the app.
 * Colors always come from the database via API - no hardcoded color maps!
 *
 * USAGE GUIDE:
 * ------------
 *
 * 1. SETTINGS TABLES (showing color_code field)
 *    When rendering settings data that includes color_code:
 *    ```typescript
 *    render: (value, record) => renderSettingBadge(record.color_code, value)
 *    ```
 *
 * 2. ENTITY TABLES (showing settings values)
 *    When rendering entity data that references settings:
 *    ```typescript
 *    // In entityConfig.ts
 *    {
 *      key: 'project_stage',
 *      title: 'Stage',
 *      render: (value) => renderSettingBadge(value, { datalabel: 'project_stage' })
 *    }
 *    ```
 *
 * 3. FILTER DROPDOWNS
 *    When rendering options in filter dropdowns:
 *    ```typescript
 *    renderSettingBadge(option.metadata?.color_code, option.label)
 *    ```
 *
 * 4. FILTER CHIPS (Active Filters)
 *    When rendering active filter badges:
 *    ```typescript
 *    const colorCode = getSettingColor(datalabel, value);
 *    renderSettingBadge(colorCode, value);
 *    ```
 *
 * 5. PRELOADING COLORS
 *    On page mount, preload colors for better UX:
 *    ```typescript
 *    useEffect(() => {
 *      preloadSettingsColors(['project_stage', 'task_stage', 'task_priority']);
 *    }, []);
 *    ```
 *
 * DATA FLOW:
 * ----------
 * 1. Database: setting_datalabel_* tables have color_code field ('blue', 'purple', etc.)
 * 2. API: Returns settings with metadata: { color_code: 'purple' }
 * 3. Frontend Cache: loadSettingsColors() caches datalabel → (value → color_code)
 * 4. Lookup: getSettingColor(datalabel, value) retrieves from cache
 * 5. Render: COLOR_MAP translates 'purple' → Tailwind classes
 * 6. Display: Badge shows with correct color from database
 *
 * BENEFITS:
 * ---------
 * ✅ Single source of truth (data_transform_render.tsx)
 * ✅ Colors always from database - no hardcoding
 * ✅ Works everywhere: tables, filters, chips, detail pages
 * ✅ Automatic color loading and caching
 * ✅ Type-safe with TypeScript
 * ✅ Easy to extend with new colors
 */

/**
 * Color mapping: Database color_code → Tailwind CSS classes
 * Single source of truth for all color styling
 *
 * Database stores: 'blue', 'purple', 'green', etc.
 * Frontend translates to: Tailwind utility classes
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
  'amber': 'bg-amber-100 text-amber-800 border border-amber-200'};

/**
 * Settings Color Cache
 * Stores mapping of datalabel → (value → color_code)
 * Populated by loadSettingsColors()
 *
 * Example structure:
 * {
 *   'project_stage': Map { 'Planning' → 'purple', 'Execution' → 'yellow' },
 *   'task_priority': Map { 'High' → 'red', 'Low' → 'green' }
 * }
 */
const settingsColorCache = new Map<string, Map<string, string>>();

/**
 * Load colors for a settings datalabel from API
 * Caches the results for subsequent lookups
 *
 * @param datalabel - Settings datalabel (e.g., 'project_stage', 'task_priority')
 * @returns Promise that resolves when colors are loaded
 *
 * @example
 * await loadSettingsColors('project_stage');
 * const color = getSettingColor('project_stage', 'Planning'); // 'purple'
 */
export async function loadSettingsColors(datalabel: string): Promise<void> {
  // Already loaded
  if (settingsColorCache.has(datalabel)) {
    return;
  }

  try {
    // Import dynamically to avoid circular dependency
    const { getSettingDatalabel, loadSettingOptions } = await import('./settingsLoader');

    // Map field key to actual datalabel if needed (e.g., 'dl__opportunity_funnel_stage' -> 'opportunity_funnel_stage')
    const mappedDatalabel = getSettingDatalabel(datalabel) || datalabel;

    // Load settings from API (includes color_code in metadata)
    const options = await loadSettingOptions(mappedDatalabel);

    // Build color map for this datalabel
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
    // Set empty map to prevent retries
    settingsColorCache.set(datalabel, new Map());
  }
}

/**
 * Get color code for a settings value
 * Returns the color_code from database or undefined if not found
 *
 * @param datalabel - Settings datalabel (e.g., 'project_stage')
 * @param value - The value to look up (e.g., 'Planning')
 * @returns Color code (e.g., 'purple') or undefined
 *
 * @example
 * const color = getSettingColor('project_stage', 'Planning'); // 'purple'
 * const color = getSettingColor('task_priority', 'High'); // 'red'
 */
export function getSettingColor(datalabel: string, value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  const colorMap = settingsColorCache.get(datalabel);
  return colorMap?.get(value);
}

/**
 * Preload colors for multiple datalabels
 * Useful for batch loading on page mount
 *
 * @param datalabels - Array of datalabel names
 *
 * @example
 * await preloadSettingsColors(['project_stage', 'task_stage', 'task_priority']);
 */
export async function preloadSettingsColors(datalabels: string[]): Promise<void> {
  await Promise.all(datalabels.map(dl => loadSettingsColors(dl)));
}

/**
 * UNIVERSAL BADGE RENDERER WITH DATABASE-DRIVEN COLORS
 *
 * Renders a colored badge for settings/label values.
 * Colors come from database via API and are automatically looked up.
 *
 * Works everywhere: tables, filters, chips, detail pages
 *
 * TWO USAGE MODES:
 *
 * MODE 1: Direct color code (for settings tables showing color_code field)
 * @example
 * render: (value, record) => renderSettingBadge(record.color_code, value)
 *
 * MODE 2: Datalabel-based lookup (for entity tables with settings values)
 * @example
 * render: (value) => renderSettingBadge(value, { datalabel: 'project_stage' })
 * // Looks up color from database: 'Planning' → 'purple'
 *
 * MODE 3: Filter dropdowns with loaded options
 * @example
 * renderSettingBadge(option.metadata?.color_code, option.label)
 *
 * @param colorCodeOrValue - Either the direct color_code OR the value to look up
 * @param labelOrOptions - Either the label string OR options object with datalabel
 * @param size - Badge size: 'xs' (default) | 'sm' | 'md'
 * @returns React element with colored badge
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
    // colorCodeOrValue is actually the value to display
    // labelOrOptions contains the datalabel
    label = colorCodeOrValue;
    const datalabel = labelOrOptions.datalabel;

    // Look up color from cache
    if (label) {
      colorCode = getSettingColor(datalabel, label);
    }
  } else {
    // MODE 1 or 3: Direct color code
    // colorCodeOrValue is the actual color_code
    // labelOrOptions is the label
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
 * BADGE RENDERER FOR PLAIN TEXT
 *
 * Renders a badge without color lookup (for non-settings fields)
 * Useful for static badges, status indicators, or generic labels
 *
 * @param label - Text to display
 * @param variant - Color variant: 'default' | 'primary' | 'success' | 'warning' | 'danger'
 * @param size - Badge size: 'xs' (default) | 'sm' | 'md'
 *
 * @example
 * renderBadge('Active', 'success')
 * renderBadge('Pending', 'warning', 'sm')
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
// PART 5: METADATA RENDERING COMPONENTS (UI)
// ============================================================================

interface MetadataFieldProps {
  label: string;
  value: string;
  isEditing?: boolean;
  canCopy?: boolean;
  copiedField?: string | null;
  fieldKey: string;
  onCopy?: (value: string, key: string) => void;
  onChange?: (key: string, value: string) => void;
  placeholder?: string;
  prefix?: string;
  className?: string;
  inputWidth?: string;
  badge?: React.ReactNode;
}

/**
 * MetadataField Component
 *
 * Reusable component for displaying entity metadata with:
 * - Compact inline layout
 * - Copy to clipboard functionality
 * - Inline editing support
 * - Consistent styling
 *
 * DRY principle: Single component handles all metadata field types
 */
export function MetadataField({
  label,
  value,
  isEditing = false,
  canCopy = true,
  copiedField,
  fieldKey,
  onCopy,
  onChange,
  placeholder,
  prefix,
  className = '',
  inputWidth = '10rem',
  badge
}: MetadataFieldProps) {
  const labelClass = 'text-gray-400 font-normal text-xs flex-shrink-0';
  const valueClass = `text-gray-700 font-medium text-sm ${className}`;

  if (!value && !isEditing) return null;

  return (
    <>
      <span className={labelClass}>{label}:</span>

      {badge ? (
        // Badge rendering (for version, status, etc.)
        badge
      ) : isEditing ? (
        // Edit mode - input field
        <div className="flex items-center">
          {prefix && <span className="text-dark-700 text-xs mr-0.5">{prefix}</span>}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange?.(fieldKey, e.target.value)}
            placeholder={placeholder}
            className={`${valueClass} border-0 bg-dark-100/80 focus:bg-dark-100 focus:ring-1 focus:ring-dark-700 rounded px-2 py-0.5 transition-all duration-200`}
            style={{
              width: inputWidth
            }}
          />
        </div>
      ) : (
        // View mode - text with copy button
        <div className="flex items-center gap-1 group">
          <span className={valueClass}>
            {prefix}{value}
          </span>
          {canCopy && onCopy && (
            <button
              onClick={() => onCopy(value, fieldKey)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all duration-200"
              title={`Copy ${label.toLowerCase()}`}
            >
              {copiedField === fieldKey ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}

interface MetadataRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * MetadataRow Component
 *
 * Container for metadata fields with consistent, compact spacing
 */
export function MetadataRow({ children, className = '' }: MetadataRowProps) {
  return (
    <div className={`flex items-center gap-3 flex-wrap ${className}`}>
      {children}
    </div>
  );
}

interface MetadataSeparatorProps {
  show?: boolean;
}

/**
 * MetadataSeparator Component
 *
 * Visual separator between metadata fields
 */
export function MetadataSeparator({ show = true }: MetadataSeparatorProps) {
  if (!show) return null;
  return <span className="text-gray-200 flex-shrink-0 mx-2">·</span>;
}
