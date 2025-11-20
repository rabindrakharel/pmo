/**
 * ============================================================================
 * BACKEND FORMATTER SERVICE - Convention-Based Metadata Generation
 * ============================================================================
 *
 * PURPOSE:
 * Generate complete field metadata from database column names using
 * convention over configuration. Backend becomes the single source of truth
 * for all field formatting, rendering, and validation rules.
 *
 * RESPONSIBILITIES:
 * - Analyze column names and detect field types (currency, date, badge, etc.)
 * - Generate complete FieldMetadata for each column
 * - Apply pattern-based detection rules (35+ patterns)
 * - Cache metadata per entity (in-memory/Redis)
 * - Return structured metadata to frontend via API responses
 *
 * NOT RESPONSIBLE FOR:
 * - RBAC (handled by Entity Infrastructure Service)
 * - Data queries (handled by route modules)
 * - Actual rendering (handled by frontend formatter service)
 *
 * USAGE:
 * ```typescript
 * import { getEntityMetadata } from './services/backend-formatter.service';
 *
 * // In route handler
 * const metadata = await getEntityMetadata('project');
 * return reply.send({ data: projects, metadata });
 * ```
 */

import type { InferSelectModel } from 'drizzle-orm';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Component Visibility Control
 * Explicit per-component visibility - backend tells each component what to show
 */
export interface ComponentVisibility {
  EntityDataTable: boolean;        // Data table (list view)
  EntityDetailView: boolean;        // Detail view (single entity)
  EntityFormContainer: boolean;     // Create/edit forms
  KanbanView: boolean;              // Kanban board
  CalendarView: boolean;            // Calendar view
  // Add new components here - TypeScript will error until all fields updated
}

/**
 * Composite Field Configuration
 * Defines fields derived from multiple source fields
 */
export interface CompositeFieldConfig {
  composedFrom: string[];           // Source field keys
  compositeType: 'progress-bar' | 'date-range' | 'address' | 'full-name' | 'calculated';
  calculation?: string;             // Optional calculation formula
  showPercentage?: boolean;
  showDates?: boolean;
  highlightOverdue?: boolean;
  startField?: string;              // For date ranges
  endField?: string;                // For date ranges
}

export interface FieldMetadata {
  // Identification
  key: string;
  label: string;

  // Type & Format
  type: FieldType;
  dataType?: string;
  format: FormatConfig;

  // Rendering (View Mode)
  renderType: RenderType;
  viewType: ViewType;
  component?: ComponentType;

  // Input (Edit Mode)
  inputType: InputType;
  editType?: EditType;

  // Behavior - OBJECT-BASED VISIBILITY
  visible: ComponentVisibility;     // ✅ NEW: Per-component visibility
  sortable: boolean;
  filterable: boolean;
  searchable: boolean;
  editable: boolean;
  required?: boolean;

  // Composite Field Support
  composite?: boolean;              // ✅ NEW: Is this a composite field?
  compositeConfig?: CompositeFieldConfig;  // ✅ NEW: Composite field configuration

  // Layout
  align: 'left' | 'right' | 'center';
  width: string;

  // Options (for dropdowns/selects)
  endpoint?: string;
  loadFromDataLabels?: boolean;
  loadFromEntity?: string;
  settingsDatalabel?: string;
  options?: StaticOption[];

  // Validation
  validation?: ValidationRules;

  // Help
  help?: string;
  placeholder?: string;

  // Pattern Metadata
  pattern?: PatternType;
  category?: CategoryType;
}

export type FieldType =
  | 'text' | 'currency' | 'percentage' | 'date' | 'timestamp'
  | 'boolean' | 'reference' | 'array-reference' | 'badge'
  | 'json' | 'url' | 'uuid';

export type RenderType =
  | 'text' | 'badge' | 'currency' | 'percentage' | 'date' | 'timestamp'
  | 'boolean' | 'json' | 'array' | 'dag' | 'link' | 'truncated'
  | 'progress-bar' | 'date-range' | 'composite';  // ✅ NEW: Composite field rendering

export type ViewType =
  | 'text' | 'badge' | 'tags' | 'link' | 'json-viewer';

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
  | 'DateRangeVisualizer' | 'FileUpload' | 'RichTextEditor'
  | 'SearchableMultiSelect' | 'ProgressBar';  // ✅ NEW: Progress bar for composite fields

export type PatternType =
  | 'CURRENCY' | 'PERCENTAGE' | 'TIMESTAMP' | 'DATE' | 'BOOLEAN'
  | 'FOREIGN_KEY' | 'COUNT' | 'DATALABEL' | 'STANDARD'
  | 'JSONB' | 'ARRAY' | 'SYSTEM' | 'UNKNOWN';

export type CategoryType =
  | 'identity' | 'financial' | 'temporal' | 'reference' | 'boolean'
  | 'quantitative' | 'standard' | 'structured' | 'system' | 'content';

export interface FormatConfig {
  symbol?: string;
  decimals?: number;
  locale?: string;
  style?: 'short' | 'long' | 'relative' | 'datetime';
  timeZone?: string;
  loadFromDataLabels?: boolean;
  colorMap?: Record<string, string>;
  trueLabel?: string;
  falseLabel?: string;
  trueColor?: string;
  falseColor?: string;
  entity?: string;
  displayField?: string;
}

export interface StaticOption {
  value: string | number | boolean;
  label: string;
  color?: string;
  icon?: string;
  order?: number;
}

export interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: string;
}

export interface EntityMetadata {
  entity: string;
  label: string;
  labelPlural: string;
  icon?: string;
  fields: FieldMetadata[];
  primaryKey: string;
  displayField: string;
  apiEndpoint: string;
  supportedViews?: string[];
  defaultView?: string;
  generated_at: string;
}

// ============================================================================
// PATTERN DETECTION RULES
// ============================================================================

interface PatternRule extends Partial<FieldMetadata> {
  componentFn?: (fieldKey: string) => ComponentType | undefined;
}

const PATTERN_RULES: Record<string, PatternRule> = {
  // === CURRENCY ===
  '*_amt': {
    type: 'currency',
    renderType: 'currency',
    inputType: 'currency',
    editType: 'number',
    format: { symbol: '$', decimals: 2, locale: 'en-CA' },
    align: 'right',
    width: '140px',
    pattern: 'CURRENCY',
    category: 'financial',
    visible: true,
    sortable: true,
    filterable: true,
    searchable: false,
    editable: true
  },
  '*_price': {
    type: 'currency',
    renderType: 'currency',
    inputType: 'currency',
    editType: 'number',
    format: { symbol: '$', decimals: 2, locale: 'en-CA' },
    align: 'right',
    width: '120px',
    pattern: 'CURRENCY',
    category: 'financial',
    visible: true,
    sortable: true,
    filterable: true,
    editable: true
  },
  '*_cost': {
    type: 'currency',
    renderType: 'currency',
    inputType: 'currency',
    editType: 'number',
    format: { symbol: '$', decimals: 2, locale: 'en-CA' },
    align: 'right',
    width: '120px',
    pattern: 'CURRENCY',
    category: 'financial',
    visible: true,
    sortable: true,
    filterable: true,
    editable: true
  },

  // === PERCENTAGE ===
  '*_pct': {
    type: 'percentage',
    renderType: 'percentage',
    inputType: 'number',
    editType: 'number',
    format: { decimals: 1 },
    align: 'right',
    width: '100px',
    pattern: 'PERCENTAGE',
    category: 'quantitative',
    visible: true,
    sortable: true,
    editable: true
  },
  '*_rate': {
    type: 'percentage',
    renderType: 'percentage',
    inputType: 'number',
    editType: 'number',
    format: { decimals: 1 },
    align: 'right',
    width: '100px',
    pattern: 'PERCENTAGE',
    category: 'quantitative',
    visible: true,
    sortable: true,
    editable: true
  },

  // === DATE/TIME ===
  '*_date': {
    type: 'date',
    renderType: 'date',
    inputType: 'date',
    editType: 'date',
    format: { style: 'short', locale: 'en-US' },
    align: 'left',
    width: '120px',
    pattern: 'DATE',
    category: 'temporal',
    visible: true,
    sortable: true,
    filterable: true,
    editable: true
  },
  '*_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'relative' },
    align: 'left',
    width: '120px',
    pattern: 'TIMESTAMP',
    category: 'temporal',
    visible: false,
    sortable: true,
    editable: false
  },
  'created_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'datetime', locale: 'en-US' },
    align: 'left',
    width: '160px',
    pattern: 'TIMESTAMP',
    category: 'temporal',
    visible: true,
    sortable: true,
    editable: false
  },
  'updated_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'datetime', locale: 'en-US' },
    align: 'left',
    width: '160px',
    pattern: 'TIMESTAMP',
    category: 'temporal',
    visible: true,
    sortable: true,
    editable: false
  },
  'from_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'relative' },
    align: 'left',
    width: '120px',
    pattern: 'TIMESTAMP',
    category: 'temporal',
    visible: false,
    sortable: true,
    editable: false
  },
  'to_ts': {
    type: 'timestamp',
    renderType: 'timestamp',
    inputType: 'readonly',
    format: { style: 'relative' },
    align: 'left',
    width: '120px',
    pattern: 'TIMESTAMP',
    category: 'temporal',
    visible: false,
    sortable: true,
    editable: false
  },

  // === BOOLEAN ===
  '*_flag': {
    type: 'boolean',
    renderType: 'boolean',
    viewType: 'badge',
    inputType: 'checkbox',
    editType: 'checkbox',
    format: { trueLabel: 'Yes', falseLabel: 'No', trueColor: 'green', falseColor: 'gray' },
    align: 'center',
    width: '100px',
    pattern: 'BOOLEAN',
    category: 'boolean',
    visible: true,
    sortable: true,
    filterable: true,
    editable: true
  },
  'is_*': {
    type: 'boolean',
    renderType: 'boolean',
    viewType: 'badge',
    inputType: 'checkbox',
    editType: 'checkbox',
    format: { trueLabel: 'Yes', falseLabel: 'No', trueColor: 'green', falseColor: 'gray' },
    align: 'center',
    width: '100px',
    pattern: 'BOOLEAN',
    category: 'boolean',
    visible: true,
    sortable: true,
    editable: true
  },

  // === BADGE (Settings) ===
  'dl__*': {
    type: 'badge',
    renderType: 'badge',
    viewType: 'badge',
    inputType: 'select',
    editType: 'select',
    format: { loadFromDataLabels: true },
    align: 'left',
    width: '140px',
    pattern: 'DATALABEL',
    category: 'standard',
    loadFromDataLabels: true,
    visible: true,
    sortable: true,
    filterable: true,
    editable: true,
    // ✅ EXPLICIT: Detect DAG component for stage/status/funnel fields
    // EntityFormContainer uses component field (overrides renderType)
    // EntityDataTable ignores component field (uses renderType only)
    componentFn: (fieldKey: string) => {
      const lowerKey = fieldKey.toLowerCase();
      if (lowerKey.includes('_stage') ||
          lowerKey.includes('_status') ||
          lowerKey.includes('_funnel')) {
        return 'DAGVisualizer';
      }
      return undefined;  // Other dl__ fields: no component, just badge
    }
  },

  // === REFERENCE (Foreign Keys) ===
  '*__employee_id': {
    type: 'reference',
    renderType: 'text',
    inputType: 'select',
    editType: 'select',
    format: { entity: 'employee', displayField: 'name' },
    align: 'left',
    width: '150px',
    pattern: 'FOREIGN_KEY',
    category: 'reference',
    loadFromEntity: 'employee',
    visible: true,
    sortable: true,
    filterable: true,
    editable: true
  },
  '*__employee_ids': {
    type: 'array-reference',
    renderType: 'array',
    viewType: 'tags',
    inputType: 'multiselect',
    editType: 'multiselect',
    component: 'SearchableMultiSelect',
    format: { entity: 'employee', displayField: 'name' },
    align: 'left',
    width: 'auto',
    pattern: 'ARRAY',
    category: 'reference',
    loadFromEntity: 'employee',
    visible: true,
    sortable: false,
    filterable: false,
    editable: true
  },
  '*_id': {
    type: 'reference',
    renderType: 'text',
    inputType: 'select',
    editType: 'select',
    align: 'left',
    width: '150px',
    pattern: 'FOREIGN_KEY',
    category: 'reference',
    visible: true,
    sortable: true,
    filterable: true,
    editable: true
  },

  // === URL ===
  '*_url': {
    type: 'url',
    renderType: 'link',
    viewType: 'link',
    inputType: 'text',
    editType: 'text',
    align: 'left',
    width: 'auto',
    pattern: 'STANDARD',
    category: 'reference',
    visible: true,
    sortable: false,
    editable: true
  },

  // === JSON ===
  'metadata': {
    type: 'json',
    renderType: 'json',
    viewType: 'json-viewer',
    inputType: 'jsonb',
    editType: 'jsonb',
    component: 'MetadataTable',
    align: 'left',
    width: 'auto',
    pattern: 'JSONB',
    category: 'structured',
    visible: false,
    sortable: false,
    filterable: false,
    editable: false
  },

  // === SYSTEM ===
  'id': {
    type: 'uuid',
    renderType: 'text',
    inputType: 'readonly',
    align: 'left',
    width: 'auto',
    pattern: 'SYSTEM',
    category: 'identity',
    visible: false,
    sortable: false,
    filterable: false,
    editable: false
  },
  'version': {
    type: 'text',
    renderType: 'text',
    inputType: 'readonly',
    align: 'right',
    width: '80px',
    pattern: 'SYSTEM',
    category: 'system',
    visible: false,
    sortable: false,
    editable: false
  },

  // === STANDARD ===
  'code': {
    type: 'text',
    renderType: 'text',
    inputType: 'text',
    editType: 'text',
    align: 'left',
    width: '120px',
    pattern: 'STANDARD',
    category: 'identity',
    visible: true,
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    required: true,
    validation: { maxLength: 50 }
  },
  'name': {
    type: 'text',
    renderType: 'text',
    inputType: 'text',
    editType: 'text',
    align: 'left',
    width: 'auto',
    pattern: 'STANDARD',
    category: 'identity',
    visible: true,
    sortable: true,
    filterable: true,
    searchable: true,
    editable: true,
    required: true,
    validation: { minLength: 3, maxLength: 200 }
  },
  'descr': {
    type: 'text',
    renderType: 'truncated',
    inputType: 'textarea',
    editType: 'textarea',
    align: 'left',
    width: 'auto',
    pattern: 'STANDARD',
    category: 'content',
    visible: true,
    sortable: false,
    filterable: false,
    searchable: true,
    editable: true
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Match field name against pattern (supports * wildcard)
 */
function matchPattern(fieldName: string, pattern: string): boolean {
  const regexPattern = pattern.replace(/\*/g, '.*');
  return new RegExp(`^${regexPattern}$`).test(fieldName);
}

/**
 * Generate human-readable label from field name
 */
function generateLabel(fieldName: string): string {
  let label = fieldName
    // Remove common prefixes
    .replace(/^dl__/, '')
    .replace(/^parent__/, 'Parent ')
    // Remove common suffixes
    .replace(/__employee_id(s)?$/, '')
    .replace(/_id$/, '')
    .replace(/_amt$/, '')
    .replace(/_date$/, '')
    .replace(/_ts$/, '')
    .replace(/_flag$/, '')
    .replace(/_url$/, '')
    .replace(/_hours$/, '')
    .replace(/_points$/, '')
    .replace(/_pct$/, '')
    .replace(/_rate$/, '');

  // Special cases
  if (label === 'descr') label = 'description';

  // Convert snake_case to Title Case
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect entity name from reference field
 */
function detectEntityFromFieldName(fieldName: string): string | null {
  // Pattern 1: *__entity_id → entity
  const match1 = fieldName.match(/^.*__(\w+)_id$/);
  if (match1) return match1[1];

  // Pattern 2: entity_id → entity
  const match2 = fieldName.match(/^(\w+)_id$/);
  if (match2 && match2[1] !== 'id') return match2[1];

  // Pattern 3: parent__entity_id → entity
  const match3 = fieldName.match(/^parent__(.+)_id$/);
  if (match3) return match3[1];

  return null;
}

/**
 * Generate endpoint for field options
 */
function generateEndpoint(metadata: Partial<FieldMetadata>, fieldKey: string): string | undefined {
  if (metadata.loadFromDataLabels && fieldKey.startsWith('dl__')) {
    const datalabelName = fieldKey.substring(4); // Remove 'dl__'
    return `/api/v1/setting?datalabel=dl__${datalabelName}`;
  }

  if (metadata.loadFromEntity) {
    return `/api/v1/entity/${metadata.loadFromEntity}/entity-instance-lookup`;
  }

  return undefined;
}

/**
 * Create default ComponentVisibility object
 * By default, all components can see all fields (opt-out model)
 */
function createDefaultVisibility(overrides?: Partial<ComponentVisibility>): ComponentVisibility {
  return {
    EntityDataTable: true,
    EntityDetailView: true,
    EntityFormContainer: true,
    KanbanView: true,
    CalendarView: true,
    ...overrides
  };
}

/**
 * Create visibility for composite fields
 * Composites typically only shown in detail view
 */
function createCompositeVisibility(): ComponentVisibility {
  return {
    EntityDataTable: false,        // Don't show in table (too complex)
    EntityDetailView: true,         // Show in detail view (primary use case)
    EntityFormContainer: false,     // Don't show in form (edit source fields instead)
    KanbanView: false,              // Don't show in kanban
    CalendarView: false             // Don't show in calendar
  };
}

/**
 * Create visibility for source fields of composite
 * Hide from detail view (composite shows instead), but keep in other views
 */
function createSourceFieldVisibility(): ComponentVisibility {
  return {
    EntityDataTable: true,          // Show in table
    EntityDetailView: false,        // Hide in detail (composite replaces)
    EntityFormContainer: true,      // Show in form for editing
    KanbanView: true,               // Show in kanban
    CalendarView: true              // Show in calendar
  };
}

/**
 * Generate field metadata from column name
 */
function generateFieldMetadata(fieldName: string, dataType?: string): FieldMetadata {
  // Default metadata
  let metadata: FieldMetadata = {
    key: fieldName,
    label: generateLabel(fieldName),
    type: 'text',
    dataType,
    format: {},
    renderType: 'text',
    viewType: 'text',
    inputType: 'text',
    visible: createDefaultVisibility(),  // ✅ NEW: Object-based visibility
    sortable: true,
    filterable: true,
    searchable: false,
    editable: true,
    align: 'left',
    width: 'auto'
  };

  // Apply pattern rules (first match wins)
  for (const [pattern, rules] of Object.entries(PATTERN_RULES)) {
    if (matchPattern(fieldName, pattern)) {
      // Filter out 'visible' from rules (we manage visibility separately now)
      const { visible: _unusedVisible, ...rulesWithoutVisible } = rules as any;

      // Apply all rule properties (except visible)
      metadata = { ...metadata, ...rulesWithoutVisible };

      // Handle component function
      if (rules.componentFn) {
        metadata.component = rules.componentFn(fieldName);
        delete (metadata as any).componentFn; // Remove function from metadata
      }

      // Auto-detect entity for *_id references
      if (pattern === '*_id' && !fieldName.includes('__')) {
        const detectedEntity = detectEntityFromFieldName(fieldName);
        if (detectedEntity) {
          metadata.format = { ...metadata.format, entity: detectedEntity, displayField: 'name' };
          metadata.loadFromEntity = detectedEntity;
        }
      }

      // Generate endpoint
      metadata.endpoint = generateEndpoint(metadata, fieldName);

      // Set settingsDatalabel for dl__* fields
      if (pattern === 'dl__*') {
        metadata.settingsDatalabel = fieldName;
      }

      break; // First match wins
    }
  }

  return metadata;
}

// ============================================================================
// ENTITY CONFIGURATION
// ============================================================================

const ENTITY_CONFIG: Record<string, Partial<EntityMetadata>> = {
  office: {
    entity: 'office',
    label: 'Office',
    labelPlural: 'Offices',
    icon: 'building',
    primaryKey: 'id',
    displayField: 'name',
    apiEndpoint: '/api/v1/office',
    supportedViews: ['table', 'grid'],
    defaultView: 'table'
  },
  business: {
    entity: 'business',
    label: 'Business',
    labelPlural: 'Businesses',
    icon: 'briefcase',
    primaryKey: 'id',
    displayField: 'name',
    apiEndpoint: '/api/v1/business',
    supportedViews: ['table', 'grid'],
    defaultView: 'table'
  },
  project: {
    entity: 'project',
    label: 'Project',
    labelPlural: 'Projects',
    icon: 'folder',
    primaryKey: 'id',
    displayField: 'name',
    apiEndpoint: '/api/v1/project',
    supportedViews: ['table', 'kanban', 'grid'],
    defaultView: 'table'
  },
  task: {
    entity: 'task',
    label: 'Task',
    labelPlural: 'Tasks',
    icon: 'check-square',
    primaryKey: 'id',
    displayField: 'name',
    apiEndpoint: '/api/v1/task',
    supportedViews: ['table', 'kanban', 'grid'],
    defaultView: 'table'
  }
};

// ============================================================================
// METADATA CACHE
// ============================================================================

const metadataCache = new Map<string, EntityMetadata>();

/**
 * Clear metadata cache (call after schema changes)
 */
export function clearMetadataCache(entityCode?: string): void {
  if (entityCode) {
    metadataCache.delete(entityCode);
  } else {
    metadataCache.clear();
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Detect composite field patterns from field names
 * Returns array of composite field metadata
 */
function detectCompositeFields(fieldNames: string[]): FieldMetadata[] {
  const compositeFields: FieldMetadata[] = [];
  const fieldSet = new Set(fieldNames);

  // Pattern 1: start_date + end_date → progress bar
  if (fieldSet.has('start_date') && fieldSet.has('end_date')) {
    compositeFields.push({
      key: 'start_date_end_date_composite',
      label: 'Progress',
      type: 'composite' as any,
      dataType: 'composite',
      format: {
        startField: 'start_date',
        endField: 'end_date',
        compositeType: 'progress-bar',
        showPercentage: true,
        showDates: true,
        highlightOverdue: true
      },
      renderType: 'progress-bar',
      viewType: 'text' as any,
      component: 'ProgressBar',
      inputType: 'readonly',
      visible: createCompositeVisibility(),  // Only show in detail view
      composite: true,
      compositeConfig: {
        composedFrom: ['start_date', 'end_date'],
        compositeType: 'progress-bar',
        startField: 'start_date',
        endField: 'end_date',
        showPercentage: true,
        showDates: true,
        highlightOverdue: true
      },
      sortable: false,
      filterable: false,
      searchable: false,
      editable: false,
      align: 'left',
      width: '200px',
      pattern: 'STANDARD',
      category: 'composite'
    });
  }

  // Pattern 2: from_ts + to_ts → date range
  if (fieldSet.has('from_ts') && fieldSet.has('to_ts')) {
    compositeFields.push({
      key: 'from_ts_to_ts_composite',
      label: 'Date Range',
      type: 'composite' as any,
      dataType: 'composite',
      format: {
        startField: 'from_ts',
        endField: 'to_ts',
        compositeType: 'date-range'
      },
      renderType: 'date-range',
      viewType: 'text' as any,
      component: 'DateRangeVisualizer',
      inputType: 'readonly',
      visible: createCompositeVisibility(),
      composite: true,
      compositeConfig: {
        composedFrom: ['from_ts', 'to_ts'],
        compositeType: 'date-range',
        startField: 'from_ts',
        endField: 'to_ts'
      },
      sortable: false,
      filterable: false,
      searchable: false,
      editable: false,
      align: 'left',
      width: '200px',
      pattern: 'STANDARD',
      category: 'composite'
    });
  }

  // TODO: Add more composite patterns:
  // - first_name + last_name → full_name
  // - street_address + city + state + zip_code → full_address
  // - budget_allocated_amt + budget_spent_amt → budget_utilization

  return compositeFields;
}

/**
 * Update visibility for source fields that have composite counterparts
 */
function updateSourceFieldVisibility(fields: FieldMetadata[], compositeFields: FieldMetadata[]): void {
  const compositeSourceFields = new Set<string>();

  // Collect all source field names from composites
  compositeFields.forEach(composite => {
    if (composite.compositeConfig?.composedFrom) {
      composite.compositeConfig.composedFrom.forEach(fieldName => {
        compositeSourceFields.add(fieldName);
      });
    }
  });

  // Update visibility for source fields
  fields.forEach(field => {
    if (compositeSourceFields.has(field.key)) {
      field.visible = createSourceFieldVisibility();  // Hide from detail view
    }
  });
}

/**
 * Generate metadata for an entity from sample data
 */
export function generateEntityMetadata(
  entityCode: string,
  sampleRow?: any
): EntityMetadata {
  // Get entity config
  const config = ENTITY_CONFIG[entityCode];
  if (!config) {
    throw new Error(`Unknown entity: ${entityCode}`);
  }

  // Get field names from sample row or use defaults
  const fieldNames = sampleRow
    ? Object.keys(sampleRow)
    : ['id', 'code', 'name', 'descr', 'active_flag', 'created_ts', 'updated_ts', 'version'];

  // Generate field metadata
  const fields: FieldMetadata[] = fieldNames.map(fieldName => {
    const dataType = sampleRow ? typeof sampleRow[fieldName] : undefined;
    return generateFieldMetadata(fieldName, dataType);
  });

  // Detect and generate composite fields
  const compositeFields = detectCompositeFields(fieldNames);

  // Update visibility for source fields (hide from detail view if composite exists)
  updateSourceFieldVisibility(fields, compositeFields);

  // Combine original fields + composite fields
  const allFields = [...fields, ...compositeFields];

  return {
    ...config,
    entity: entityCode,
    fields: allFields,
    generated_at: new Date().toISOString()
  } as EntityMetadata;
}

/**
 * Get entity metadata (cached)
 */
export function getEntityMetadata(
  entityCode: string,
  sampleRow?: any
): EntityMetadata {
  // Check cache (only if no sample row provided)
  if (!sampleRow && metadataCache.has(entityCode)) {
    return metadataCache.get(entityCode)!;
  }

  // Generate fresh metadata
  const metadata = generateEntityMetadata(entityCode, sampleRow);

  // Cache it (only if no sample row)
  if (!sampleRow) {
    metadataCache.set(entityCode, metadata);
  }

  return metadata;
}

/**
 * Get field metadata for a specific field
 */
export function getFieldMetadata(fieldName: string, dataType?: string): FieldMetadata {
  return generateFieldMetadata(fieldName, dataType);
}
