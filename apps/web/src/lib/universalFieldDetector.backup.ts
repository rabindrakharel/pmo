/**
 * ============================================================================
 * UNIVERSAL FIELD DETECTOR - Single Source of Truth
 * ============================================================================
 *
 * INPUT:  Column name from database (e.g., "budget_allocated_amt", "dl__project_stage")
 * OUTPUT: Complete field metadata for tables, forms, and transformations
 *
 * ONE function replaces:
 * - fieldCategoryRegistry.ts (715 LOC)
 * - columnGenerator.ts (231 LOC)
 * - data_transform_render.tsx (1,117 LOC)
 * - EntityFormContainer.tsx (653 LOC)
 *
 * Database Analysis: 802 columns, 12 patterns identified
 * Source: docs/FIELD_DETECTOR_COMPLETE_ANALYSIS.md
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UniversalFieldMetadata {
  // === Display & Presentation ===
  fieldName: string;              // Formatted title: "Budget Allocated Amount"
  visible: boolean;               // Show in UI tables? (false for id, *_id, system fields)

  // === Table Column Config ===
  sortable: boolean;              // Can sort by this column?
  filterable: boolean;            // Can filter by this column?
  searchable: boolean;            // Include in text search?
  width: string;                  // Column width: "120px", "200px"
  align: 'left' | 'center' | 'right'; // Text alignment

  // === Formatting & Display ===
  format: (value: any, record?: any) => string | React.ReactNode;  // Display formatter
  renderType: RenderType;         // How to render: 'text', 'badge', 'currency', 'date', 'json'

  // === Form Input Config ===
  inputType: InputType;           // Form input: 'text', 'select', 'checkbox', 'currency', 'date'
  component?: ComponentType;      // React component: 'DAGVisualizer', 'MetadataTable', 'TagsInput'

  // === Inline Editing ===
  editable: boolean;              // Can edit inline in table?
  editType?: EditType;            // Edit control: 'text', 'select', 'checkbox', 'tags', 'jsonb'

  // === Data Transformation ===
  toApi: (value: any) => any;     // Frontend → API transform
  toDisplay: (value: any) => any; // API → Frontend transform

  // === Options & Settings ===
  loadFromSettings?: boolean;     // Load dropdown options from settings table?
  loadFromEntity?: string;        // Load options from entity: 'employee', 'project', etc.

  // === Pattern Metadata ===
  pattern: PatternType;           // Detected pattern: 'CURRENCY', 'TIMESTAMP', 'BOOLEAN', etc.
  category: CategoryType;         // Category: 'financial', 'temporal', 'reference', etc.
}

export type RenderType =
  | 'text'           // Plain text
  | 'badge'          // Colored badge (status, priority, etc.)
  | 'currency'       // $1,234.56
  | 'percentage'     // 25%
  | 'date'           // Mar 15, 2025
  | 'timestamp'      // 3 days ago
  | 'boolean'        // ✓ / ✗
  | 'json'           // JSON viewer
  | 'array'          // Comma-separated list
  | 'dag'            // DAG visualizer
  | 'link'           // Clickable link
  | 'truncated';     // Text with ellipsis

export type InputType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'textarea'
  | 'richtext'
  | 'tags'
  | 'jsonb'
  | 'file'
  | 'dag-select'
  | 'readonly';

export type EditType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'textarea'
  | 'tags'
  | 'jsonb'
  | 'datatable'
  | 'file'
  | 'dag-select';

export type ComponentType =
  | 'DAGVisualizer'
  | 'MetadataTable'
  | 'TagsInput'
  | 'DateRangeVisualizer'
  | 'FileUpload'
  | 'RichTextEditor'
  | 'SearchableMultiSelect';

export type PatternType =
  | 'CURRENCY'        // *_amt, *_price, *_cost
  | 'PERCENTAGE'      // *_pct, *_percent
  | 'TIMESTAMP'       // *_ts, *_at
  | 'DATE'            // *_date
  | 'BOOLEAN'         // *_flag, is_*, has_*
  | 'FOREIGN_KEY'     // *_id (except 'id')
  | 'COUNT'           // *_count, *_qty, *_hours
  | 'DATALABEL'       // dl__*
  | 'STANDARD'        // name, code, descr
  | 'JSONB'           // metadata, attr, *_json
  | 'ARRAY'           // tags, *_ids (dataType check)
  | 'SYSTEM'          // id, created_ts, updated_ts, version, active_flag
  | 'UNKNOWN';

export type CategoryType =
  | 'identity'        // id, uuid
  | 'financial'       // amounts, prices, costs
  | 'temporal'        // dates, timestamps
  | 'reference'       // foreign keys, entity refs
  | 'boolean'         // flags
  | 'quantitative'    // counts, quantities
  | 'standard'        // name, code, descr
  | 'structured'      // json, arrays
  | 'system'          // internal system fields
  | 'content';        // text, long text

// ============================================================================
// PATTERN DETECTION (Priority Order)
// ============================================================================

const PATTERNS = {
  // System fields (highest priority - always readonly/hidden)
  system: {
    regex: /^(id|version|from_ts|to_ts|active_flag|created_ts|updated_ts|created_at|updated_at)$/i,
    priority: 1
  },

  // Currency fields (before general numbers)
  currency: {
    regex: /_(amt|amount|price|cost)$/i,
    priority: 2
  },

  // Percentage fields
  percentage: {
    regex: /_(pct|percent|percentage)$/i,
    priority: 3
  },

  // Timestamps (before general dates)
  timestamp: {
    regex: /_(ts|at|timestamp)$/i,
    priority: 4
  },

  // Dates
  date: {
    regex: /_date$/i,
    priority: 5
  },

  // Datalabel fields (settings-driven)
  datalabel: {
    regex: /^dl__/i,
    priority: 6
  },

  // Boolean fields (NOT readonly!)
  boolean: {
    regex: /^(is_|has_|can_|allow_|enable_).*|.*_flag$/i,
    priority: 7
  },

  // Foreign keys (before general counts)
  foreignKey: {
    regex: /_id$/i,
    exclude: /^id$/i, // Exclude primary key 'id'
    priority: 8
  },

  // Counts and quantities
  count: {
    regex: /_(count|qty|quantity|hours|minutes|seconds|number)$/i,
    priority: 9
  },

  // Standard entity fields
  standard: {
    exact: ['name', 'code', 'descr', 'description', 'title'],
    priority: 10
  },

  // JSONB fields (requires dataType check)
  jsonb: {
    names: ['metadata', 'attr', 'attributes', 'config', 'settings', 'form_schema', 'workflow_graph'],
    dataType: 'jsonb',
    priority: 11
  },

  // Array fields (requires dataType check)
  array: {
    names: ['tags'],
    dataType: '[]',
    priority: 12
  }
};

// ============================================================================
// FORMATTERS (Pure Functions)
// ============================================================================

function formatCurrency(value: any, currency: string = 'CAD'): string {
  if (!value && value !== 0) return '-';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency
  }).format(value);
}

function formatPercentage(value: any): string {
  if (!value && value !== 0) return '-';
  return `${value}%`;
}

function formatRelativeTime(value: string): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return formatFriendlyDate(value);
  } catch {
    return String(value);
  }
}

function formatFriendlyDate(value: string): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(value);
  }
}

function formatBoolean(value: any): string {
  if (value === null || value === undefined) return '-';
  return value ? '✓' : '✗';
}

function formatTruncated(value: any, maxLength: number = 100): string {
  if (!value) return '-';
  const str = String(value);
  return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
}

function formatArray(value: any[]): string {
  if (!Array.isArray(value) || value.length === 0) return '-';
  return value.join(', ');
}

// ============================================================================
// TRANSFORMERS
// ============================================================================

function transformTagsToApi(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function transformTagsToDisplay(value: any): string {
  if (Array.isArray(value)) return value.join(', ');
  return String(value || '');
}

function transformDateToApi(value: any): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'string') return value.split('T')[0];
  return String(value);
}

const identityTransform = (value: any) => value;

// ============================================================================
// TITLE GENERATOR
// ============================================================================

function generateFieldTitle(fieldKey: string): string {
  // Handle datalabel fields: dl__project_stage → Project Stage
  if (fieldKey.startsWith('dl__')) {
    return fieldKey
      .substring(4) // Remove dl__
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Standard camelCase/snake_case conversion
  return fieldKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ============================================================================
// ENTITY NAME EXTRACTION (for FK columns)
// ============================================================================

function getEntityNameFromFK(fieldKey: string): string | null {
  if (!fieldKey.endsWith('_id')) return null;

  const withoutId = fieldKey.replace(/_id$/, '');
  const parts = withoutId.split('_');

  // Known entity types (from d_entity table)
  const knownEntities = [
    'employee', 'project', 'task', 'client', 'customer', 'cust',
    'office', 'business', 'biz', 'supplier', 'product', 'service',
    'artifact', 'wiki', 'form', 'event', 'calendar', 'person'
  ];

  // Check last part first (e.g., manager_employee_id → employee)
  const lastPart = parts[parts.length - 1];
  if (knownEntities.includes(lastPart)) {
    return lastPart;
  }

  // Fall back to full prefix
  return withoutId;
}

// ============================================================================
// MAIN DETECTOR FUNCTION
// ============================================================================

/**
 * Universal Field Detector
 *
 * ONE function that provides ALL metadata for a database column.
 *
 * @param fieldKey - Column name from database
 * @param dataType - Optional SQL data type (for JSONB/array detection)
 * @returns Complete field metadata
 *
 * @example
 * const meta = detectField('budget_allocated_amt');
 * // Returns: currency input, $ formatting, right-aligned, editable, etc.
 *
 * const meta2 = detectField('dl__project_stage');
 * // Returns: DAG visualizer, dropdown, settings-driven, badge display, etc.
 */
export function detectField(
  fieldKey: string,
  dataType?: string
): UniversalFieldMetadata {
  const key = fieldKey.toLowerCase();

  // ========================================================================
  // PATTERN 1: SYSTEM FIELDS (readonly, often hidden from UI)
  // ========================================================================
  if (PATTERNS.system.regex.test(key)) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: key === 'id' ? false : true, // Hide 'id' column from UI (but still in data!)
      sortable: true,
      filterable: false,
      searchable: false,
      width: key === 'id' ? '300px' : '150px',
      align: 'left',
      format: key.includes('_ts') || key.includes('_at') ? formatRelativeTime : (v) => v,
      renderType: key.includes('_ts') || key.includes('_at') ? 'timestamp' : 'text',
      inputType: 'readonly',
      editable: false,
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'SYSTEM',
      category: 'system'
    };
  }

  // ========================================================================
  // PATTERN 2: CURRENCY (amounts, prices, costs)
  // ========================================================================
  if (PATTERNS.currency.regex.test(key)) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '120px',
      align: 'right',
      format: formatCurrency,
      renderType: 'currency',
      inputType: 'currency',
      editable: true,
      editType: 'currency',
      toApi: (v) => parseFloat(v) || 0,
      toDisplay: identityTransform,
      pattern: 'CURRENCY',
      category: 'financial'
    };
  }

  // ========================================================================
  // PATTERN 3: PERCENTAGE
  // ========================================================================
  if (PATTERNS.percentage.regex.test(key)) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '100px',
      align: 'right',
      format: formatPercentage,
      renderType: 'percentage',
      inputType: 'number',
      editable: true,
      editType: 'text',
      toApi: (v) => parseFloat(v) || 0,
      toDisplay: identityTransform,
      pattern: 'PERCENTAGE',
      category: 'financial'
    };
  }

  // ========================================================================
  // PATTERN 4: TIMESTAMP (created_ts, updated_ts, *_at)
  // ========================================================================
  if (PATTERNS.timestamp.regex.test(key)) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: false,
      searchable: false,
      width: '150px',
      align: 'left',
      format: formatRelativeTime,
      renderType: 'timestamp',
      inputType: 'datetime',
      editable: !key.includes('created') && !key.includes('updated'),
      editType: 'text',
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'TIMESTAMP',
      category: 'temporal'
    };
  }

  // ========================================================================
  // PATTERN 5: DATE (start_date, end_date, *_date)
  // ========================================================================
  if (PATTERNS.date.regex.test(key)) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '120px',
      align: 'left',
      format: formatFriendlyDate,
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

  // ========================================================================
  // PATTERN 6: DATALABEL (dl__project_stage, dl__sales_funnel)
  // ========================================================================
  if (PATTERNS.datalabel.regex.test(key)) {
    const isStageOrFunnel = key.includes('stage') || key.includes('funnel');
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '130px',
      align: 'left',
      format: (v) => v || '-',
      renderType: 'badge',
      inputType: isStageOrFunnel ? 'dag-select' : 'select',
      component: isStageOrFunnel ? 'DAGVisualizer' : undefined,
      editable: true,
      editType: 'select',
      loadFromSettings: true,
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'DATALABEL',
      category: 'reference'
    };
  }

  // ========================================================================
  // PATTERN 7: BOOLEAN (is_*, has_*, *_flag)
  // ========================================================================
  if (PATTERNS.boolean.regex.test(key)) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '80px',
      align: 'center',
      format: formatBoolean,
      renderType: 'boolean',
      inputType: 'checkbox',
      editable: true, // ✅ FIX: Booleans ARE editable!
      editType: 'checkbox',
      toApi: (v) => Boolean(v),
      toDisplay: identityTransform,
      pattern: 'BOOLEAN',
      category: 'boolean'
    };
  }

  // ========================================================================
  // PATTERN 8: FOREIGN KEY (*_id except 'id')
  // ========================================================================
  if (PATTERNS.foreignKey.regex.test(key) && !PATTERNS.foreignKey.exclude.test(key)) {
    const entityName = getEntityNameFromFK(fieldKey);
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: false, // Hide FK column, show *_name instead
      sortable: true,
      filterable: true,
      searchable: false,
      width: '150px',
      align: 'left',
      format: (v) => v || '-',
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

  // ========================================================================
  // PATTERN 9: COUNT/QUANTITY (*_count, *_qty, *_hours)
  // ========================================================================
  if (PATTERNS.count.regex.test(key)) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: false,
      width: '100px',
      align: 'right',
      format: (v) => v?.toLocaleString() || '-',
      renderType: 'text',
      inputType: 'number',
      editable: true,
      editType: 'text',
      toApi: (v) => parseInt(v) || 0,
      toDisplay: identityTransform,
      pattern: 'COUNT',
      category: 'quantitative'
    };
  }

  // ========================================================================
  // PATTERN 10: STANDARD FIELDS (name, code, descr)
  // ========================================================================
  if (PATTERNS.standard.exact.includes(key)) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: true,
      filterable: true,
      searchable: true,
      width: key === 'name' || key === 'title' ? '200px' : key === 'code' ? '120px' : '250px',
      align: 'left',
      format: key === 'descr' || key === 'description' ?
        (v) => formatTruncated(v, 100) : (v) => v || '-',
      renderType: key === 'descr' || key === 'description' ? 'truncated' : 'text',
      inputType: key === 'descr' || key === 'description' ? 'textarea' : 'text',
      editable: true,
      editType: 'text',
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'STANDARD',
      category: 'standard'
    };
  }

  // ========================================================================
  // PATTERN 11: JSONB (metadata, form_schema, etc.)
  // ========================================================================
  if (PATTERNS.jsonb.names.includes(key) || dataType?.includes('jsonb')) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: false,
      filterable: false,
      searchable: false,
      width: '150px',
      align: 'left',
      format: (v) => v ? 'JSON {...}' : '-',
      renderType: 'json',
      inputType: 'jsonb',
      component: 'MetadataTable',
      editable: true,
      editType: 'datatable', // MetadataTable renders as a datatable editor
      toApi: identityTransform,
      toDisplay: identityTransform,
      pattern: 'JSONB',
      category: 'structured'
    };
  }

  // ========================================================================
  // PATTERN 12: ARRAY (tags, *_ids if dataType is array)
  // ========================================================================
  if (PATTERNS.array.names.includes(key) || dataType?.includes('[]')) {
    return {
      fieldName: generateFieldTitle(fieldKey),
      visible: true,
      sortable: false,
      filterable: false,
      searchable: true,
      width: '200px',
      align: 'left',
      format: formatArray,
      renderType: 'array',
      inputType: 'tags',
      component: 'TagsInput',
      editable: true,
      editType: 'tags',
      toApi: transformTagsToApi,
      toDisplay: transformTagsToDisplay,
      pattern: 'ARRAY',
      category: 'structured'
    };
  }

  // ========================================================================
  // DEFAULT: UNKNOWN PATTERN (plain text)
  // ========================================================================
  return {
    fieldName: generateFieldTitle(fieldKey),
    visible: true,
    sortable: true,
    filterable: true,
    searchable: true,
    width: '150px',
    align: 'left',
    format: (v) => v || '-',
    renderType: 'text',
    inputType: 'text',
    editable: true,
    editType: 'text',
    toApi: identityTransform,
    toDisplay: identityTransform,
    pattern: 'UNKNOWN',
    category: 'content'
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Generate complete column config for data tables
 */
export function generateTableColumn(fieldKey: string, dataType?: string) {
  const meta = detectField(fieldKey, dataType);
  return {
    key: fieldKey,
    title: meta.fieldName,
    visible: meta.visible,
    sortable: meta.sortable,
    filterable: meta.filterable,
    width: meta.width,
    align: meta.align,
    render: meta.format
  };
}

/**
 * Generate form field config
 */
export function generateFormField(fieldKey: string, dataType?: string) {
  const meta = detectField(fieldKey, dataType);
  return {
    key: fieldKey,
    label: meta.fieldName,
    type: meta.inputType,
    component: meta.component,
    editable: meta.editable,
    loadOptionsFromSettings: meta.loadFromSettings,
    loadOptionsFromEntity: meta.loadFromEntity
  };
}

/**
 * Batch process multiple fields
 */
export function detectFields(fieldKeys: string[], dataTypes?: Record<string, string>) {
  return fieldKeys.map(key => detectField(key, dataTypes?.[key]));
}
