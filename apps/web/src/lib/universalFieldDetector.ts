/**
 * ============================================================================
 * UNIVERSAL FIELD DETECTOR - OPTIMIZED VERSION
 * ============================================================================
 *
 * Performance optimizations:
 * 1. Cached formatters (Intl.NumberFormat, Date formatters)
 * 2. Memoized field titles (LRU cache with 500 entries)
 * 3. Set-based lookups instead of array includes()
 * 4. Pre-compiled common values
 * 5. Reduced object allocations
 * 6. Early exits in pattern matching
 * 7. Reused formatter functions instead of inline lambdas
 */

// ============================================================================
// TYPES (Same as before)
// ============================================================================

export interface UniversalFieldMetadata {
  fieldName: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  searchable: boolean;
  width: string;
  align: 'left' | 'center' | 'right';
  format: (value: any, record?: any) => string | React.ReactNode;
  renderType: RenderType;
  inputType: InputType;
  component?: ComponentType;
  editable: boolean;
  editType?: EditType;
  toApi: (value: any) => any;
  toDisplay: (value: any) => any;
  loadFromSettings?: boolean;
  loadFromEntity?: string;
  pattern: PatternType;
  category: CategoryType;
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

// ============================================================================
// CACHED FORMATTERS (Performance Optimization #1)
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
// MEMOIZATION CACHE (Performance Optimization #2)
// ============================================================================

// LRU cache for field titles (500 max entries)
const FIELD_TITLE_CACHE = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

// Export cache clearing function for hot reload / testing
export function clearFieldTitleCache(): void {
  FIELD_TITLE_CACHE.clear();
}

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

// Clear cache on module hot reload (Vite HMR)
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    clearFieldTitleCache();
  });
}

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

// ============================================================================
// KNOWN ENTITIES SET (Performance Optimization #3)
// ============================================================================

const KNOWN_ENTITIES = new Set([
  'employee', 'project', 'task', 'client', 'customer', 'cust',
  'office', 'business', 'biz', 'supplier', 'product', 'service',
  'artifact', 'wiki', 'form', 'event', 'calendar', 'person'
]);

// ============================================================================
// PATTERN DEFINITIONS
// ============================================================================

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
    regex: /_id$/i,
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

// ============================================================================
// OPTIMIZED FORMATTERS (Reuse cached instances)
// ============================================================================

function formatCurrency(value: any): string {
  if (!value && value !== 0) return '-';
  return CURRENCY_FORMATTER.format(value);
}

function formatPercentage(value: any): string {
  if (!value && value !== 0) return '-';
  return `${value}%`;
}

// Cache for relative time calculations (reduce Date object allocations)
let lastNowTimestamp = 0;
let cachedNow = 0;
const NOW_CACHE_MS = 1000; // Cache for 1 second

function formatRelativeTime(value: string): string {
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

    return formatFriendlyDate(value);
  } catch {
    return String(value);
  }
}

function formatFriendlyDate(value: string): string {
  if (!value) return '-';
  try {
    return DATE_FORMATTER.format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatBoolean(value: any): string {
  return (value === null || value === undefined) ? '-' : (value ? '✓' : '✗');
}

function formatTruncated(value: any, maxLength: number = 100): string {
  if (!value) return '-';
  const str = String(value);
  return str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;
}

function formatArray(value: any[]): string {
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
// MAIN DETECTOR FUNCTION (Optimized)
// ============================================================================

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
      format: isTimestamp ? formatRelativeTime : stringTransform,
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
      format: formatCurrency,
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
      format: formatPercentage,
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
      format: formatRelativeTime,
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
      format: formatBoolean,
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
    return {
      fieldName: memoizedFieldTitle(fieldKey),
      visible: true,
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
      format: formatArray,
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
    format: formatTruncated,
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

// Batch detection with shared cache
export function detectFields(fieldKeys: string[], dataTypes?: Record<string, string>) {
  return fieldKeys.map(key => detectField(key, dataTypes?.[key]));
}

// Cache clearing utility (for testing or memory management)
export function clearFieldCache() {
  FIELD_TITLE_CACHE.clear();
  lastNowTimestamp = 0;
  cachedNow = 0;
}
