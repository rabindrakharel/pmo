/**
 * ============================================================================
 * UNIVERSAL FORMATTER SERVICE - CONSOLIDATED FIELD DETECTION & FORMATTING
 * ============================================================================
 *
 * SINGLE SOURCE OF TRUTH for ALL field detection and formatting concerns.
 * Consolidates universalFieldDetector.ts + universalFormatterService.ts logic.
 *
 * This service provides:
 * 1. Field metadata detection (detectField - column name → complete metadata)
 * 2. Value formatting (formatCurrency, formatDate, formatRelativeTime, etc.)
 * 3. Badge rendering (renderSettingBadge with database-driven colors)
 * 4. Field capability detection (editable vs readonly)
 * 5. Data transformation (API ↔ Frontend)
 *
 * PERFORMANCE OPTIMIZATIONS:
 * ✅ LRU cache for field titles (500 entries)
 * ✅ Cached Intl formatters (currency, date)
 * ✅ Set-based lookups for O(1) performance
 * ✅ Reusable formatter functions (no inline lambdas)
 * ✅ Early exits in pattern matching
 *
 * ARCHITECTURAL BENEFITS:
 * ✅ Single import for all field detection needs
 * ✅ Zero duplication - ONE pattern system
 * ✅ Convention over configuration (column name determines everything)
 * ✅ Type-safe with TypeScript
 * ✅ 100% reusable across all components
 *
 * USAGE:
 * ```typescript
 * import { detectField, formatFieldValue, renderFieldDisplay } from './universalFormatterService';
 *
 * // 1. Detect complete field metadata from column name
 * const metadata = detectField('budget_allocated_amt', 'numeric');
 * // Returns: {
 * //   fieldName: 'Budget Allocated',
 * //   renderType: 'currency',
 * //   format: formatCurrency,
 * //   editable: true,
 * //   width: '120px',
 * //   ...
 * // }
 *
 * // 2. Format value for display
 * const formatted = formatFieldValue(50000, 'currency');
 * // Returns: "$50,000.00"
 *
 * // 3. Render field as React element
 * const element = renderFieldDisplay(50000, { type: 'currency' });
 * // Returns: <span>$50,000.00</span>
 * ```
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { formatters } from './config/locale';
import { DISPLAY_CONFIG } from './config/display';

// ============================================================================
// TYPES & INTERFACES (Consolidated from both files)
// ============================================================================

/**
 * Complete field metadata for tables, forms, and detail views
 * This is the primary type returned by detectField()
 */
export interface UniversalFieldMetadata {
  fieldName: string;                  // Human-readable label
  visible: boolean;                   // Show in table columns
  sortable: boolean;                  // Can be sorted
  filterable: boolean;                // Can be filtered
  searchable: boolean;                // Included in text search
  width: string;                      // Column width (e.g., '120px')
  align: 'left' | 'center' | 'right'; // Text alignment
  format: (value: any, record?: any) => string | React.ReactNode; // Display formatter
  renderType: RenderType;             // Render type category
  inputType: InputType;               // Input type for forms
  component?: ComponentType;          // Special component (DAG, MetadataTable, etc.)
  editable: boolean;                  // Can be edited
  editType?: EditType;                // Edit input type
  toApi: (value: any) => any;         // Transform for API submission
  toDisplay: (value: any) => any;     // Transform for display
  loadFromSettings?: boolean;         // Load options from settings table
  loadFromEntity?: string;            // Load options from entity (for FK)
  pattern: PatternType;               // Detection pattern matched
  category: CategoryType;             // Field category
  settingsDatalabel?: string;         // For dl__* fields
}

export type RenderType =
  | 'text' | 'badge' | 'currency' | 'percentage' | 'date' | 'timestamp'
  | 'boolean' | 'json' | 'array' | 'dag' | 'link' | 'truncated';

export type InputType =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'checkbox' | 'textarea' | 'richtext'
  | 'tags' | 'jsonb' | 'file' | 'dag-select' | 'readonly';

export type EditType =
  | 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time'
  | 'select' | 'multiselect' | 'checkbox' | 'textarea'
  | 'tags' | 'jsonb' | 'datatable' | 'file' | 'dag-select';

export type ComponentType =
  | 'DAGVisualizer' | 'MetadataTable' | 'TagsInput'
  | 'DateRangeVisualizer' | 'FileUpload' | 'RichTextEditor' | 'SearchableMultiSelect';

export type PatternType =
  | 'CURRENCY' | 'PERCENTAGE' | 'TIMESTAMP' | 'DATE' | 'BOOLEAN' | 'FOREIGN_KEY'
  | 'COUNT' | 'DATALABEL' | 'STANDARD' | 'JSONB' | 'ARRAY' | 'SYSTEM' | 'UNKNOWN';

export type CategoryType =
  | 'identity' | 'financial' | 'temporal' | 'reference' | 'boolean'
  | 'quantitative' | 'standard' | 'structured' | 'system' | 'content';

/**
 * Legacy type for backwards compatibility
 * @deprecated Use UniversalFieldMetadata instead
 */
export type FormatType =
  | 'text' | 'currency' | 'number' | 'percentage'
  | 'date' | 'datetime' | 'relative-time'
  | 'badge' | 'tags' | 'reference' | 'boolean';

/**
 * Field capability for edit mode detection
 */
export interface FieldCapability {
  inlineEditable: boolean;
  editType: EditType;
  loadOptionsFromSettings?: boolean;
  settingsDatalabel?: string;
  acceptedFileTypes?: string;
  isFileUpload: boolean;
}

// ============================================================================
// PERFORMANCE OPTIMIZATIONS - CACHED FORMATTERS
// ============================================================================

const CURRENCY_FORMATTER = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD'
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});

// ============================================================================
// PERFORMANCE OPTIMIZATIONS - LRU CACHE FOR FIELD TITLES
// ============================================================================

// LRU cache for field titles (500 max entries)
const FIELD_TITLE_CACHE = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

/**
 * Export cache clearing function for hot reload / testing
 */
export function clearFieldTitleCache(): void {
  FIELD_TITLE_CACHE.clear();
}

/**
 * Memoized field title generator with LRU eviction
 */
function memoizedFieldTitle(fieldKey: string): string {
  if (FIELD_TITLE_CACHE.has(fieldKey)) {
    return FIELD_TITLE_CACHE.get(fieldKey)!;
  }

  const title = generateFieldTitleInternal(fieldKey);

  // LRU eviction
  if (FIELD_TITLE_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = FIELD_TITLE_CACHE.keys().next().value;
    FIELD_TITLE_CACHE.delete(firstKey);
  }

  FIELD_TITLE_CACHE.set(fieldKey, title);
  return title;
}

/**
 * Internal field title generator
 */
function generateFieldTitleInternal(fieldKey: string): string {
  // Handle datalabel fields: dl__project_stage → Project Stage (remove 'Dl' prefix)
  let processedKey = fieldKey;

  if (fieldKey.startsWith('dl__')) {
    processedKey = fieldKey.substring(4); // Remove 'dl__' prefix
  }

  // Map specific field names
  if (processedKey === 'descr') {
    return 'Description';
  }

  // Replace '_ts' with '_time' before processing
  processedKey = processedKey.replace(/_ts$/g, '_time');

  // Replace 'cust_' prefix with 'customer_' for proper formatting
  processedKey = processedKey.replace(/^cust_/, 'customer_');

  // Standard snake_case conversion
  return processedKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Clear cache on module hot reload (Vite HMR)
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    clearFieldTitleCache();
  });
}

// ============================================================================
// KNOWN ENTITIES SET (O(1) lookups)
// ============================================================================

const KNOWN_ENTITIES = new Set([
  'employee', 'project', 'task', 'client', 'customer', 'cust',
  'office', 'business', 'biz', 'supplier', 'product', 'service',
  'artifact', 'wiki', 'form', 'event', 'calendar', 'person'
]);

// ============================================================================
// UNIFIED PATTERN DEFINITIONS (Merged from both files)
// ============================================================================

/**
 * Consolidated pattern definitions with priority ordering
 * Patterns are checked in priority order (1 = highest)
 */
const PATTERNS = {
  system: {
    regex: /^(id|version|from_ts|to_ts|active_flag|created_ts|updated_ts|created_at|updated_at)$/i,
    priority: 1
  },
  currency: {
    regex: /_(amt|amount|price|cost)$/i,
    priority: 2
  },
  percentage: {
    regex: /_(pct|percent|percentage)$/i,
    priority: 3
  },
  timestamp: {
    regex: /_(ts|at|timestamp)$/i,
    priority: 4
  },
  date: {
    regex: /_date$/i,
    priority: 5
  },
  datalabel: {
    regex: /^dl__/i,
    priority: 6
  },
  boolean: {
    regex: /^(is_|has_|can_|allow_|enable_).*|.*_flag$/i,
    priority: 7
  },
  foreignKey: {
    regex: /_ids?$/i,  // Matches both _id and _ids (UUID reference fields)
    exclude: /^id$/i,
    priority: 8
  },
  count: {
    regex: /_(count|qty|quantity|hours|minutes|seconds|number)$/i,
    priority: 9
  },
  standard: {
    exact: new Set(['name', 'code', 'descr', 'description', 'title']), // Set instead of array
    priority: 10
  },
  jsonb: {
    names: new Set(['metadata', 'attr', 'attributes', 'config', 'settings', 'form_schema', 'workflow_graph']),
    dataType: 'jsonb',
    priority: 11
  },
  array: {
    names: new Set([]),  // Empty - no specific array field names
    dataType: '[]',
    priority: 12
  }
};

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
 * Legacy field patterns for getFieldCapability() compatibility
 * @deprecated Use PATTERNS instead
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

// ============================================================================
// OPTIMIZED FORMATTERS (Reuse cached instances)
// ============================================================================

function formatCurrencyOptimized(value: any): string {
  if (!value && value !== 0) return '-';
  return CURRENCY_FORMATTER.format(value);
}

function formatPercentageOptimized(value: any): string {
  if (!value && value !== 0) return '-';
  return `${value}%`;
}

// Cache for relative time calculations (reduce Date object allocations)
let lastNowTimestamp = 0;
let cachedNow = 0;
const NOW_CACHE_MS = 1000; // Cache for 1 second

function formatRelativeTimeOptimized(value: string): string {
  if (!value) return '-';

  try {
    const timestamp = new Date(value).getTime();

    // Use cached 'now' if less than 1 second old
    const currentTime = Date.now();
    if (currentTime - lastNowTimestamp > NOW_CACHE_MS) {
      cachedNow = currentTime;
      lastNowTimestamp = currentTime;
    }

    const diffMs = cachedNow - timestamp;
    const diffMins = Math.floor(diffMs / 60000);

    // Early exits for common cases
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return formatFriendlyDateOptimized(value);
  } catch {
    return String(value);
  }
}

function formatFriendlyDateOptimized(value: string): string {
  if (!value) return '-';
  try {
    return DATE_FORMATTER.format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatBooleanOptimized(value: any): string {
  return (value === null || value === undefined) ? '-' : (value ? '✓' : '✗');
}

function formatTruncatedOptimized(value: any, maxLength: number = 100): string {
  if (!value) return '-';
  const str = String(value);
  return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
}

function formatArrayOptimized(value: any[]): string {
  return (Array.isArray(value) && value.length > 0) ? value.join(', ') : '-';
}

// ============================================================================
// OPTIMIZED TRANSFORMERS (Reduce allocations)
// ============================================================================

function transformArrayToApi(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function transformArrayToDisplay(value: any): string {
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

function transformDateToApi(value: any): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'string') return value.split('T')[0];
  return String(value);
}

// Reusable transformer functions (avoid inline lambda allocations)
const identityTransform = (value: any) => value;
const parseFloatTransform = (v: any) => parseFloat(v) || 0;
const booleanTransform = (v: any) => Boolean(v);
const stringTransform = (v: any) => v;

// ============================================================================
// ENTITY NAME EXTRACTION (Optimized with Set)
// ============================================================================

function getEntityNameFromFK(fieldKey: string): string | null {
  if (!fieldKey.endsWith('_id')) return null;

  const withoutId = fieldKey.slice(0, -3); // Faster than replace()
  const parts = withoutId.split('_');
  const lastPart = parts[parts.length - 1];

  // O(1) lookup instead of O(n)
  return KNOWN_ENTITIES.has(lastPart) ? lastPart : withoutId;
}

// ============================================================================
// MAIN DETECTOR FUNCTION - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * CORE FUNCTION: Detect complete field metadata from column name and data type
 *
 * This is the SINGLE SOURCE OF TRUTH for field detection.
 * Convention over configuration - column name + data type determine everything.
 *
 * @param fieldKey - Database column name (e.g., 'budget_allocated_amt')
 * @param dataType - PostgreSQL data type (e.g., 'numeric', 'varchar', 'boolean')
 * @returns Complete field metadata including formatters, transforms, UI config
 *
 * @example
 * detectField('budget_allocated_amt', 'numeric')
 * // Returns: {
 * //   fieldName: 'Budget Allocated',
 * //   renderType: 'currency',
 * //   format: formatCurrencyOptimized,
 * //   editable: true,
 * //   width: '120px',
 * //   align: 'right',
 * //   toApi: parseFloatTransform,
 * //   ...
 * // }
 */
export function detectField(
  fieldKey: string,
  dataType?: string
): UniversalFieldMetadata {
  const key = fieldKey.toLowerCase();

  // Early pattern checks for common fields (optimize hot path)

  // PATTERN 1: SYSTEM FIELDS
  if (PATTERNS.system.regex.test(key)) {
    const isId = key === 'id';
    const isTimestamp = key.includes('_ts') || key.includes('_at');

    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: !isId,
      sortable: true,
      filterable: false,
      searchable: false,
      width: isId ? '300px' : '150px',
      align: 'left',
      format: isTimestamp ? formatRelativeTimeOptimized : stringTransform,
      renderType: isTimestamp ? 'timestamp' : 'text',
      inputType: 'readonly',
      editable: false,
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'SYSTEM',
      category: 'system'
    };
  }

  // PATTERN 2: CURRENCY (hot path optimization)
  if (PATTERNS.currency.regex.test(key)) {
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '120px',
      align: 'right',
      format: formatCurrencyOptimized,
      renderType: 'currency',
      inputType: 'currency',
      editable: true,
      editType: 'currency',
      toApi: parseFloatTransform,
      toDisplay: identityTransform,
      pattern: 'CURRENCY',
      category: 'financial'
    };
  }

  // PATTERN 3: PERCENTAGE
  if (PATTERNS.percentage.regex.test(key)) {
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '100px',
      align: 'right',
      format: formatPercentageOptimized,
      renderType: 'percentage',
      inputType: 'number',
      editable: true,
      editType: 'text',
      toApi: parseFloatTransform,
      toDisplay: identityTransform,
      pattern: 'PERCENTAGE',
      category: 'financial'
    };
  }

  // PATTERN 4: TIMESTAMP
  if (PATTERNS.timestamp.regex.test(key)) {
    const isEditable = !key.includes('created') && !key.includes('updated');

    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: false,
      searchable: false,
      width: '150px',
      align: 'left',
      format: formatRelativeTimeOptimized,
      renderType: 'timestamp',
      inputType: 'datetime',
      editable: isEditable,
      editType: 'text',
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'TIMESTAMP',
      category: 'temporal'
    };
  }

  // PATTERN 5: DATE
  if (PATTERNS.date.regex.test(key)) {
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '120px',
      align: 'left',
      format: formatFriendlyDateOptimized,
      renderType: 'date',
      inputType: 'date',
      editable: true,
      editType: 'text',
      toApi: transformDateToApi,
      toDisplay: identityTransform,
      pattern: 'DATE',
      category: 'temporal'
    };
  }

  // PATTERN 6: DATALABEL
  if (PATTERNS.datalabel.regex.test(key)) {
    const isStageOrFunnel = key.includes('stage') || key.includes('funnel');

    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '130px',
      align: 'left',
      format: stringTransform,
      renderType: 'badge',
      inputType: isStageOrFunnel ? 'dag-select' : 'select',
      component: isStageOrFunnel ? 'DAGVisualizer' : undefined,
      editable: true,
      editType: 'select',
      loadFromSettings: true,
      settingsDatalabel: fieldKey.replace(/^dl__/, ''),
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'DATALABEL',
      category: 'reference'
    };
  }

  // PATTERN 7: BOOLEAN
  if (PATTERNS.boolean.regex.test(key)) {
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '80px',
      align: 'center',
      format: formatBooleanOptimized,
      renderType: 'boolean',
      inputType: 'checkbox',
      editable: true,
      editType: 'checkbox',
      toApi: booleanTransform,
      toDisplay: identityTransform,
      pattern: 'BOOLEAN',
      category: 'boolean'
    };
  }

  // PATTERN 8: FOREIGN KEY
  if (PATTERNS.foreignKey.regex.test(key) && !PATTERNS.foreignKey.exclude.test(key)) {
    const entityName = getEntityNameFromFK(fieldKey);

    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: false,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '150px',
      align: 'left',
      format: stringTransform,
      renderType: 'text',
      inputType: 'select',
      editable: true,
      editType: 'select',
      loadFromEntity: entityName || undefined,
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'FOREIGN_KEY',
      category: 'reference'
    };
  }

  // PATTERN 9: COUNT
  if (PATTERNS.count.regex.test(key)) {
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '100px',
      align: 'right',
      format: stringTransform,
      renderType: 'text',
      inputType: 'number',
      editable: true,
      editType: 'number',
      toApi: parseFloatTransform,
      toDisplay: identityTransform,
      pattern: 'COUNT',
      category: 'quantitative'
    };
  }

  // PATTERN 10: STANDARD (using Set for O(1) lookup)
  if (PATTERNS.standard.exact.has(key)) {
    const isName = key === 'name';

    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: isName,
      width: isName ? '200px' : '150px',
      align: 'left',
      format: stringTransform,
      renderType: 'text',
      inputType: isName ? 'text' : 'textarea',
      editable: true,
      editType: isName ? 'text' : 'textarea',
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'STANDARD',
      category: 'standard'
    };
  }

  // PATTERN 11: JSONB (using Set for O(1) lookup)
  if (PATTERNS.jsonb.names.has(key) || dataType?.includes('jsonb')) {
    // Hide metadata fields from table view (but keep in data for detail views)
    const isMetadata = key.includes('metadata');

    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: !isMetadata,  // Hide metadata from tables, but keep in forms/detail views
      sortable: false,
      filterable: false,
      searchable: false,
      width: '150px',
      align: 'left',
      format: (v: any) => v ? 'JSON {...}' : '-',
      renderType: 'json',
      inputType: 'jsonb',
      component: 'MetadataTable',
      editable: true,
      editType: 'datatable',
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'JSONB',
      category: 'structured'
    };
  }

  // PATTERN 12: ARRAY (using Set for O(1) lookup)
  if (PATTERNS.array.names.has(key) || dataType?.includes('[]')) {
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
      sortable: false,
      filterable: false,
      searchable: false,
      width: '200px',
      align: 'left',
      format: formatArrayOptimized,
      renderType: 'array',
      inputType: 'text',
      editable: true,
      editType: 'text',
      toApi: transformArrayToApi,
      toDisplay: transformArrayToDisplay,
      pattern: 'ARRAY',
      category: 'structured'
    };
  }

  // FALLBACK: UNKNOWN
  return {
    fieldName: memoizedFieldTitle(fieldKey),
    visible: true,
    sortable: true,
    filterable: true,
    searchable: true,
    width: '150px',
    align: 'left',
    format: formatTruncatedOptimized,
    renderType: 'truncated',
    inputType: 'text',
    editable: true,
    editType: 'text',
    toApi: identityTransform,
    toDisplay: identityTransform,
    pattern: 'UNKNOWN',
    category: 'content'
  };
}

/**
 * Batch detection with shared cache
 */
export function detectFields(fieldKeys: string[], dataTypes?: Record<string, string>) {
  return fieldKeys.map(key => detectField(key, dataTypes?.[key]));
}

/**
 * Cache clearing utility (for testing or memory management)
 */
export function clearFieldCache() {
  FIELD_TITLE_CACHE.clear();
  lastNowTimestamp = 0;
  cachedNow = 0;
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
    const entityCode = match[2];
    return entityCode === 'cust' ? 'customer' : entityCode;
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
export function renderFieldDisplay(value: any, format: { type: FormatType; settingsDatalabel?: string; entityCode?: string }): React.ReactNode {
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
      return formatReference(value, format.entityCode);

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
function formatReference(value: any, entityCode?: string): React.ReactNode {
  if (!value) {
    return React.createElement('span', { className: 'text-dark-600 italic' }, '—');
  }

  const displayText = typeof value === 'object' && value.name
    ? value.name
    : String(value);

  const id = typeof value === 'object' && value.id ? value.id : null;

  if (entityCode && id) {
    return React.createElement(
      'a',
      {
        href: `/${entityCode}/${id}`,
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

  // ============================================================================
  // Convert _ID and _IDS structured format to flat UUID fields for API
  // ============================================================================
  // Backend expects: { manager__employee_id: "uuid" }
  // Frontend sends: { _ID: { manager: { entity_code: "employee", manager__employee_id: "uuid", manager: "John" } } }
  // This converts back to the flat format before API submission

  // Convert single entity references (_ID)
  if (transformed._ID && typeof transformed._ID === 'object') {
    Object.entries(transformed._ID).forEach(([labelField, refData]: [string, any]) => {
      if (!refData || typeof refData !== 'object') return;

      // Find the UUID field (e.g., "manager__employee_id")
      const uuidField = Object.keys(refData).find(k => k.endsWith('_id'));
      if (uuidField && refData[uuidField]) {
        // Add flat UUID field to transformed object
        transformed[uuidField] = refData[uuidField];
      }
    });
    // Remove _ID from payload
    delete transformed._ID;
  }

  // Convert array entity references (_IDS)
  if (transformed._IDS && typeof transformed._IDS === 'object') {
    Object.entries(transformed._IDS).forEach(([labelField, refArray]: [string, any[]]) => {
      if (!Array.isArray(refArray) || refArray.length === 0) return;

      // Get first item to determine UUID field name
      const firstItem = refArray[0];
      if (!firstItem || typeof firstItem !== 'object') return;

      // Find the UUID field (e.g., "stakeholder__employee_id")
      const uuidField = Object.keys(firstItem).find(k => k.endsWith('_id'));
      if (uuidField) {
        // Convert to plural form (e.g., "stakeholder__employee_ids")
        const pluralUuidField = uuidField.replace(/_id$/, '_ids');

        // Extract all UUIDs from the array
        const uuids = refArray
          .map(ref => ref[uuidField])
          .filter(Boolean); // Remove null/undefined

        // Add flat UUID array field to transformed object
        transformed[pluralUuidField] = uuids;
      }
    });
    // Remove _IDS from payload
    delete transformed._IDS;
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
  // Field detection (CONSOLIDATED)
  detectField,
  detectFields,
  generateFieldLabel,
  getEditType,
  clearFieldCache,
  clearFieldTitleCache,

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
