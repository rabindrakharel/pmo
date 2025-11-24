/**
 * ============================================================================
 * BACKEND FORMATTER SERVICE - Component-Aware Metadata Generation
 * ============================================================================
 *
 * PURPOSE:
 * Generate component-specific metadata from column names using pattern matching.
 * Backend decides all field behavior based on naming conventions.
 *
 * ARCHITECTURE:
 * - Column name → Explicit config check → Pattern match → YAML mappings → Component-specific config
 * - Separate metadata per component (EntityDataTable, EntityFormContainer, KanbanView)
 * - Global settings for cross-cutting concerns (currency, date formats, etc.)
 * - Datalabels extracted and fetched separately
 *
 * YAML MAPPING FILES (v6.0):
 * - pattern-mapping.yaml: Maps field name patterns to fieldBusinessType
 * - view-type-mapping.yaml: Maps fieldBusinessType to VIEW rendering config
 * - edit-type-mapping.yaml: Maps fieldBusinessType to EDIT/INPUT config
 *
 * EXPLICIT CONFIG (v5.0):
 * - Fields can be explicitly configured in config/entity-field-config.ts
 * - Explicit config takes PRECEDENCE over pattern detection
 * - Use for non-standard naming or special formatting requirements
 *
 * USAGE:
 * ```typescript
 * import { generateEntityResponse } from './backend-formatter.service';
 *
 * // In route handler
 * const response = generateEntityResponse('project', projects, {
 *   components: ['entityDataTable', 'entityFormContainer']
 * });
 * return reply.send(response);
 * ```
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { getFieldConfig, hasExplicitConfig, type FieldConfig } from '../config/entity-field-config.js';

// Get current directory for YAML file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ComponentName =
  | 'entityDataTable'      // Table view for entity lists
  | 'entityFormContainer'  // Create/edit forms (also used for detail view)
  | 'kanbanView'           // Kanban board view
  | 'calendarView'         // Calendar view for events
  | 'gridView'             // Grid/card view
  | 'dagView'              // Workflow DAG visualizer
  | 'hierarchyGraphView';  // Hierarchy graph view

export interface FieldMetadataBase {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb' | 'array[str]' | 'array[uuid]';
  format: string;  // 'text', 'currency', 'date:YYYY-MM-DD', 'timestamp-relative', 'badge', etc.
  internal: boolean;
  visible: boolean;
  filterable: boolean;
  sortable: boolean;
  editable: boolean;
  viewType: string;
  editType: string;
  width?: string;
  align?: 'left' | 'center' | 'right';

  // Optional fields
  searchable?: boolean;
  required?: boolean;
  placeholder?: string;
  help?: string;

  // For currency
  currencySymbol?: string;
  decimals?: number;
  locale?: string;

  // For percentage
  min?: number;
  max?: number;

  // For dates
  dateFormat?: string;

  // For timestamps
  timestampFormat?: 'relative' | 'datetime' | 'date';

  // For booleans
  trueLabel?: string;
  falseLabel?: string;
  trueColor?: string;
  falseColor?: string;

  // For references / entity lookups
  loadFromEntity?: string;
  loadFromDataLabels?: boolean;
  endpoint?: string;
  displayField?: string;
  valueField?: string;
  datalabelKey?: string;
}

export interface ComponentMetadata {
  [fieldName: string]: FieldMetadataBase;
}

export interface EntityMetadata {
  entityDataTable?: ComponentMetadata;
  entityFormContainer?: ComponentMetadata;
  kanbanView?: ComponentMetadata;
  calendarView?: ComponentMetadata;
  gridView?: ComponentMetadata;
  dagView?: ComponentMetadata;
  hierarchyGraphView?: ComponentMetadata;
}

export interface DatalabelOption {
  id: number;
  name: string;
  descr?: string | null;
  parent_id: number | null;
  sort_order: number;
  color_code: string;
  active_flag: boolean;
}

export interface DatalabelData {
  key: string;
  label: string;
  options: DatalabelOption[];
}

export interface GlobalSettings {
  currency: {
    symbol: string;
    decimals: number;
    locale: string;
    position: 'prefix' | 'suffix';
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  date: {
    style: 'short' | 'long' | 'medium' | 'full';
    locale: string;
    format?: string;
  };
  timestamp: {
    style: 'datetime' | 'relative' | 'timestamp';
    locale: string;
    includeSeconds: boolean;
  };
  boolean: {
    trueLabel: string;
    falseLabel: string;
    trueColor: string;
    falseColor: string;
    trueIcon?: string;
    falseIcon?: string;
  };
}

export interface EntityResponse {
  data: any[];
  fields: string[];
  metadata: EntityMetadata;
  total: number;
  limit: number;
  offset: number;
  format?: 'object' | 'indexed';
}
// Note: datalabels and globalSettings are fetched via dedicated endpoints:
// - GET /api/v1/settings/global (globalSettings)
// - GET /api/v1/datalabel?name=<name> (individual datalabel)
// - GET /api/v1/settings/datalabels/all (all datalabels)

// ============================================================================
// GLOBAL SETTINGS
// ============================================================================

export const GLOBAL_SETTINGS: GlobalSettings = {
  currency: {
    symbol: '$',
    decimals: 2,
    locale: 'en-CA',
    position: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  date: {
    style: 'short',
    locale: 'en-US',
    format: 'MM/DD/YYYY'
  },
  timestamp: {
    style: 'relative',      // Default: "5 minutes ago", "2 hours ago"
    locale: 'en-US',
    includeSeconds: false
  },
  boolean: {
    trueLabel: 'Yes',
    falseLabel: 'No',
    trueColor: 'green',
    falseColor: 'gray',
    trueIcon: 'check',
    falseIcon: 'x'
  }
};

// ============================================================================
// YAML MAPPING LOADER
// ============================================================================

interface PatternMappingEntry {
  pattern: string;
  exact: boolean;
  fieldBusinessType: string;
}

interface PatternMappingYaml {
  patterns: PatternMappingEntry[];
  defaultFieldBusinessType: string;
}

interface ViewTypeMappingYaml {
  defaults: Record<string, any>;
  fieldBusinessTypes: Record<string, {
    dtype: string;
    inherit?: string;
    entityDataTable?: Record<string, any>;
    entityFormContainer?: Record<string, any>;
    kanbanView?: Record<string, any>;
    gridView?: Record<string, any>;
    calendarView?: Record<string, any>;
    dagView?: Record<string, any>;
    hierarchyGraphView?: Record<string, any>;
  }>;
}

interface EditTypeMappingYaml {
  defaults: Record<string, any>;
  fieldBusinessTypes: Record<string, {
    dtype: string;
    inherit?: string;
    editable?: boolean;
    loadFromDataLabels?: boolean;
    loadFromEntity?: boolean;
    entityDataTable?: Record<string, any>;
    entityFormContainer?: Record<string, any>;
    kanbanView?: Record<string, any>;
    gridView?: Record<string, any>;
    calendarView?: Record<string, any>;
    dagView?: Record<string, any>;
    hierarchyGraphView?: Record<string, any>;
  }>;
  formFieldTypeMapping: Record<string, string>;
}

// Load YAML mapping files (cached)
let _patternMapping: PatternMappingYaml | null = null;
let _viewTypeMapping: ViewTypeMappingYaml | null = null;
let _editTypeMapping: EditTypeMappingYaml | null = null;

function loadPatternMapping(): PatternMappingYaml {
  if (!_patternMapping) {
    const filePath = join(__dirname, 'pattern-mapping.yaml');
    const content = readFileSync(filePath, 'utf-8');
    _patternMapping = yaml.load(content) as PatternMappingYaml;
  }
  return _patternMapping;
}

function loadViewTypeMapping(): ViewTypeMappingYaml {
  if (!_viewTypeMapping) {
    const filePath = join(__dirname, 'view-type-mapping.yaml');
    const content = readFileSync(filePath, 'utf-8');
    _viewTypeMapping = yaml.load(content) as ViewTypeMappingYaml;
  }
  return _viewTypeMapping;
}

function loadEditTypeMapping(): EditTypeMappingYaml {
  if (!_editTypeMapping) {
    const filePath = join(__dirname, 'edit-type-mapping.yaml');
    const content = readFileSync(filePath, 'utf-8');
    _editTypeMapping = yaml.load(content) as EditTypeMappingYaml;
  }
  return _editTypeMapping;
}

/**
 * Match field name against pattern (supports * wildcard at start or end)
 */
function matchYamlPattern(fieldName: string, pattern: string, exact: boolean): boolean {
  if (exact) {
    return fieldName === pattern;
  }

  // Convert YAML pattern to regex
  // *_amt → .*_amt$
  // dl__* → ^dl__.*
  // *__*_id → .*__.*_id$
  const regexPattern = pattern
    .replace(/\*/g, '.*');

  return new RegExp(`^${regexPattern}$`).test(fieldName);
}

/**
 * Get fieldBusinessType from field name using pattern-mapping.yaml
 */
function getFieldBusinessType(fieldName: string): string {
  const patternMapping = loadPatternMapping();

  for (const entry of patternMapping.patterns) {
    if (matchYamlPattern(fieldName, entry.pattern, entry.exact)) {
      return entry.fieldBusinessType;
    }
  }

  return patternMapping.defaultFieldBusinessType;
}

/**
 * Resolve inheritance for a fieldBusinessType in the mapping
 */
function resolveInheritance(
  businessType: string,
  mapping: Record<string, any>,
  visited = new Set<string>()
): Record<string, any> | null {
  if (visited.has(businessType)) {
    // Circular reference protection
    return null;
  }
  visited.add(businessType);

  const typeConfig = mapping[businessType];
  if (!typeConfig) {
    return null;
  }

  if (typeConfig.inherit) {
    const parentConfig = resolveInheritance(typeConfig.inherit, mapping, visited);
    if (parentConfig) {
      // Deep merge parent with current
      return deepMerge(parentConfig, typeConfig);
    }
  }

  return typeConfig;
}

/**
 * Deep merge two objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (key === 'inherit') continue; // Skip inherit key

    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Get VIEW metadata for a fieldBusinessType and component from YAML
 */
function getViewMetadataFromYaml(
  fieldBusinessType: string,
  component: ComponentName
): Partial<FieldMetadataBase> | null {
  const viewMapping = loadViewTypeMapping();
  const resolved = resolveInheritance(fieldBusinessType, viewMapping.fieldBusinessTypes);

  if (!resolved) {
    return null;
  }

  const componentConfig = resolved[component];
  if (!componentConfig) {
    return null;
  }

  // Build base metadata
  const metadata: Partial<FieldMetadataBase> = {
    dtype: resolved.dtype as FieldMetadataBase['dtype'],
    visible: componentConfig.visible ?? true,
    sortable: componentConfig.sortable ?? false,
    filterable: componentConfig.filterable ?? false,
    width: componentConfig.width,
    align: componentConfig.align,
    viewType: fieldBusinessType,
  };

  // Copy format settings
  if (componentConfig.format) {
    Object.assign(metadata, componentConfig.format);
  }

  return metadata;
}

/**
 * Get EDIT metadata for a fieldBusinessType and component from YAML
 */
function getEditMetadataFromYaml(
  fieldBusinessType: string,
  component: ComponentName
): Partial<FieldMetadataBase> | null {
  const editMapping = loadEditTypeMapping();
  const resolved = resolveInheritance(fieldBusinessType, editMapping.fieldBusinessTypes);

  if (!resolved) {
    return null;
  }

  const componentConfig = resolved[component];

  // Build base metadata
  const metadata: Partial<FieldMetadataBase> = {
    dtype: resolved.dtype as FieldMetadataBase['dtype'],
    editable: resolved.editable ?? true,
    editType: fieldBusinessType,
  };

  // Handle special flags
  if (resolved.loadFromDataLabels) {
    metadata.loadFromDataLabels = true;
  }
  if (resolved.loadFromEntity) {
    metadata.loadFromEntity = String(resolved.loadFromEntity);
  }

  // Copy component-specific config
  if (componentConfig) {
    if (componentConfig.inputType) {
      metadata.editType = componentConfig.inputType;
    }
    if (componentConfig.validation) {
      if (componentConfig.validation.required !== undefined) {
        metadata.required = componentConfig.validation.required;
      }
      if (componentConfig.validation.min !== undefined) {
        metadata.min = componentConfig.validation.min;
      }
      if (componentConfig.validation.max !== undefined) {
        metadata.max = componentConfig.validation.max;
      }
    }
    if (componentConfig.format) {
      Object.assign(metadata, componentConfig.format);
    }
  }

  return metadata;
}

// ============================================================================
// PATTERN RULES - COMPONENT-SPECIFIC BEHAVIOR (Legacy fallback)
// ============================================================================

interface PatternRule {
  // Required components - must be defined
  entityDataTable: Partial<FieldMetadataBase>;
  entityFormContainer: Partial<FieldMetadataBase>;

  // Optional components - will inherit from defaults if not specified
  kanbanView?: Partial<FieldMetadataBase>;
  calendarView?: Partial<FieldMetadataBase>;
  gridView?: Partial<FieldMetadataBase>;
  dagView?: Partial<FieldMetadataBase>;
  hierarchyGraphView?: Partial<FieldMetadataBase>;
}

const PATTERN_RULES: Record<string, PatternRule> = {
  // ========================================
  // IDENTITY FIELDS
  // ========================================
  'id': {
    entityDataTable: {
      dtype: 'uuid',
      format: 'text',
      internal: true,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'readonly',
      width: 'auto',
      align: 'left',
      help: 'Hidden but kept for row actions'
    },
    entityFormContainer: {
      dtype: 'uuid',
      format: 'text',
      internal: true,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'readonly',
      help: 'Read-only UUID field'
    },
    kanbanView: {
      dtype: 'uuid',
      format: 'text',
      internal: true,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'readonly'
    }
  },

  'code': {
    entityDataTable: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'text',
      editType: 'text',
      width: '140px',
      align: 'left',
      searchable: true,
      required: true
    },
    entityFormContainer: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'text',
      editType: 'text',
      searchable: false,
      required: true,
      placeholder: 'Enter code...'
    },
    kanbanView: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'text'
    }
  },

  'name': {
    entityDataTable: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'text',
      editType: 'text',
      width: '250px',
      align: 'left',
      searchable: true,
      required: true
    },
    entityFormContainer: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'text',
      editType: 'text',
      required: true,
      placeholder: 'Enter name...'
    },
    kanbanView: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'text'
    }
  },

  'descr': {
    entityDataTable: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'truncated',
      editType: 'textarea',
      searchable: true,
      help: 'Hidden in table (too long)'
    },
    entityFormContainer: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'text',
      editType: 'textarea',
      placeholder: 'Enter description...'
    },
    kanbanView: {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'truncated',
      editType: 'textarea'
    }
  },

  // ========================================
  // FINANCIAL FIELDS
  // ========================================
  '*_amt': {
    entityDataTable: {
      dtype: 'float',
      format: 'currency',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'currency',
      editType: 'currency',
      width: '140px',
      align: 'right',
      currencySymbol: '$',
      decimals: 2,
      locale: 'en-CA'
    },
    entityFormContainer: {
      dtype: 'float',
      format: 'currency',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'currency',
      editType: 'currency',
      currencySymbol: '$',
      decimals: 2,
      placeholder: '0.00'
    },
    kanbanView: {
      dtype: 'float',
      format: 'currency',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'currency',
      editType: 'currency'
    }
  },

  '*_pct': {
    entityDataTable: {
      dtype: 'float',
      format: 'percentage',
      internal: false,
      visible: true,
      filterable: false,
      sortable: true,
      editable: true,
      viewType: 'percentage',
      editType: 'number',
      width: '100px',
      align: 'right',
      decimals: 0,
      min: 0,
      max: 100
    },
    entityFormContainer: {
      dtype: 'float',
      format: 'percentage',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'percentage',
      editType: 'number',
      decimals: 0,
      min: 0,
      max: 100,
      placeholder: '0'
    },
    kanbanView: {
      dtype: 'float',
      format: 'percentage',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'percentage',
      editType: 'number'
    }
  },

  // ========================================
  // TEMPORAL FIELDS
  // ========================================
  '*_date': {
    entityDataTable: {
      dtype: 'date',
      format: 'date:YYYY-MM-DD',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'date',
      editType: 'date',
      width: '120px',
      align: 'left',
      dateFormat: 'MM/DD/YYYY',
      locale: 'en-US'
    },
    entityFormContainer: {
      dtype: 'date',
      format: 'date:YYYY-MM-DD',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'date',
      editType: 'date',
      dateFormat: 'MM/DD/YYYY'
    },
    kanbanView: {
      dtype: 'date',
      format: 'date:YYYY-MM-DD',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'date',
      editType: 'date'
    }
  },

  'created_ts': {
    entityDataTable: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: true,
      filterable: false,
      sortable: true,
      editable: false,
      viewType: 'relative-time',   // Shows "5 minutes ago", "2 hours ago"
      editType: 'readonly',        // System field - not editable
      width: '140px',
      align: 'left',
      timestampFormat: 'relative',
      locale: 'en-US'
    },
    entityFormContainer: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'relative-time',   // Shows "5 minutes ago", "2 hours ago"
      editType: 'readonly',        // System field - not editable
      timestampFormat: 'relative'
    },
    kanbanView: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'relative-time',
      editType: 'readonly'
    }
  },

  'updated_ts': {
    entityDataTable: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: true,
      filterable: false,
      sortable: true,
      editable: false,
      viewType: 'relative-time',   // Shows "5 minutes ago", "2 hours ago"
      editType: 'readonly',        // System field - not editable
      width: '140px',
      align: 'left',
      timestampFormat: 'relative'
    },
    entityFormContainer: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'relative-time',   // Shows "5 minutes ago", "2 hours ago"
      editType: 'readonly',        // System field - not editable
      timestampFormat: 'relative'
    },
    kanbanView: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'relative-time',
      editType: 'readonly'
    }
  },

  // Generic timestamp fields (from_ts, to_ts, custom *_ts fields)
  // These are editable with datetime picker
  '*_ts': {
    entityDataTable: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'relative-time',   // Shows "5 minutes ago", "2 hours ago"
      editType: 'datetime',        // Calendar with time picker
      width: '140px',
      align: 'left',
      timestampFormat: 'relative'
    },
    entityFormContainer: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'relative-time',   // Shows "5 minutes ago", "2 hours ago"
      editType: 'datetime',        // Calendar with time picker
      timestampFormat: 'relative'
    },
    kanbanView: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'relative-time',
      editType: 'datetime'
    }
  },

  // ========================================
  // BOOLEAN FIELDS
  // ========================================
  '*_flag': {
    entityDataTable: {
      dtype: 'bool',
      format: 'boolean',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'boolean',
      editType: 'checkbox',
      width: '80px',
      align: 'center',
      trueLabel: 'Yes',
      falseLabel: 'No',
      trueColor: 'green',
      falseColor: 'gray'
    },
    entityFormContainer: {
      dtype: 'bool',
      format: 'boolean',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'boolean',
      editType: 'checkbox',
      trueLabel: 'Yes',
      falseLabel: 'No'
    },
    kanbanView: {
      dtype: 'bool',
      format: 'boolean',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'boolean',
      editType: 'checkbox'
    }
  },

  // ========================================
  // DATALABEL FIELDS (SETTINGS DROPDOWNS)
  // ========================================
  'dl__*': {
    entityDataTable: {
      dtype: 'str',
      format: 'datalabel_lookup',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'badge',       // ← Show as badge in table
      editType: 'select',
      width: '140px',
      align: 'left'
    },
    entityFormContainer: {
      dtype: 'str',
      format: 'datalabel_lookup',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'dag',         // ← Show as DAG in forms
      editType: 'select'
    },
    kanbanView: {
      dtype: 'str',
      format: 'datalabel_lookup',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'badge',       // ← Show as badge on kanban cards
      editType: 'select'
    },
    calendarView: {
      dtype: 'str',
      format: 'datalabel_lookup',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'badge',       // ← Show as badge on calendar events
      editType: 'select'
    },
    gridView: {
      dtype: 'str',
      format: 'datalabel_lookup',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'badge',       // ← Show as badge in grid cards
      editType: 'select'
    },
    dagView: {
      dtype: 'str',
      format: 'datalabel_lookup',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'dag',         // ← Show in DAG visualizer (workflow diagram)
      editType: 'select'
    },
    hierarchyGraphView: {
      dtype: 'str',
      format: 'datalabel_lookup',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'badge',       // ← Show as badge in hierarchy graph
      editType: 'select'
    }
  },

  // ========================================
  // REFERENCE FIELDS (FOREIGN KEYS)
  // ========================================
  // Prefixed entity references: {prefix}__{entity}_id
  // Examples: manager__employee_id, sponsor__client_id, parent__project_id
  // Entity is auto-detected from field name, loadFromEntity/endpoint set dynamically
  '*__*_id': {
    entityDataTable: {
      dtype: 'uuid',
      format: 'entityInstance_Id',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'entityInstance_Id',
      editType: 'entityInstance_Id',
      width: '150px',
      align: 'left',
      displayField: 'name',
      valueField: 'id',
      searchable: true
      // loadFromEntity and endpoint set dynamically in generateFieldMetadataForComponent()
    },
    entityFormContainer: {
      dtype: 'uuid',
      format: 'entityInstance_Id',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'entityInstance_Id',
      editType: 'entityInstance_Id',
      displayField: 'name',
      valueField: 'id',
      searchable: true
      // loadFromEntity and endpoint set dynamically in generateFieldMetadataForComponent()
    },
    kanbanView: {
      dtype: 'uuid',
      format: 'entityInstance_Id',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'entityInstance_Id',
      editType: 'entityInstance_Id',
      displayField: 'name',
      valueField: 'id'
    }
  },

  // Prefixed entity reference arrays: {prefix}__{entity}_ids
  // Examples: assigned__employee_ids, team__employee_ids
  // Entity is auto-detected from field name
  '*__*_ids': {
    entityDataTable: {
      dtype: 'array[uuid]',
      format: 'array',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'array',
      editType: 'multiselect',
      help: 'Array too complex for table'
      // loadFromEntity and endpoint set dynamically
    },
    entityFormContainer: {
      dtype: 'array[uuid]',
      format: 'array',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'array',
      editType: 'multiselect',
      displayField: 'name',
      valueField: 'id'
      // loadFromEntity and endpoint set dynamically
    },
    kanbanView: {
      dtype: 'array[uuid]',
      format: 'array',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'array',
      editType: 'multiselect'
    }
  },

  // Simple entity references: {entity}_id
  // Examples: office_id, business_id, project_id
  // Entity is auto-detected from field name
  '*_id': {
    entityDataTable: {
      dtype: 'uuid',
      format: 'entityInstance_Id',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'entityInstance_Id',
      editType: 'entityInstance_Id',
      width: '150px',
      align: 'left',
      searchable: true,
      displayField: 'name',
      valueField: 'id'
      // loadFromEntity and endpoint set dynamically in generateFieldMetadataForComponent()
    },
    entityFormContainer: {
      dtype: 'uuid',
      format: 'entityInstance_Id',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'entityInstance_Id',
      editType: 'entityInstance_Id',
      searchable: true,
      displayField: 'name',
      valueField: 'id'
      // loadFromEntity and endpoint set dynamically in generateFieldMetadataForComponent()
    },
    kanbanView: {
      dtype: 'uuid',
      format: 'entityInstance_Id',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'entityInstance_Id',
      editType: 'entityInstance_Id',
      displayField: 'name',
      valueField: 'id'
    }
  },

  // Simple entity reference arrays: {entity}_ids
  // Examples: employee_ids, project_ids, client_ids
  // Entity is auto-detected from field name
  '*_ids': {
    entityDataTable: {
      dtype: 'array[uuid]',
      format: 'array',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'array',
      editType: 'multiselect',
      help: 'Array too complex for table'
      // loadFromEntity and endpoint set dynamically
    },
    entityFormContainer: {
      dtype: 'array[uuid]',
      format: 'array',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'array',
      editType: 'multiselect',
      displayField: 'name',
      valueField: 'id'
      // loadFromEntity and endpoint set dynamically
    },
    kanbanView: {
      dtype: 'array[uuid]',
      format: 'array',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'array',
      editType: 'multiselect'
    }
  },

  // ========================================
  // STRUCTURED DATA
  // ========================================
  'metadata': {
    entityDataTable: {
      dtype: 'jsonb',
      format: 'json',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'json',
      editType: 'jsonb',
      help: 'Too complex for table'
    },
    entityFormContainer: {
      dtype: 'jsonb',
      format: 'json',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'json',
      editType: 'jsonb'
    },
    kanbanView: {
      dtype: 'jsonb',
      format: 'json',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'json',
      editType: 'jsonb'
    }
  },

  'tags': {
    entityDataTable: {
      dtype: 'array[str]',
      format: 'array',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'array',
      editType: 'tags',
      help: 'Array, shown in detail/form'
    },
    entityFormContainer: {
      dtype: 'array[str]',
      format: 'array',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'array',
      editType: 'tags'
    },
    kanbanView: {
      dtype: 'array[str]',
      format: 'array',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'array',
      editType: 'tags'
    }
  },

  // ========================================
  // SYSTEM FIELDS
  // ========================================
  'version': {
    entityDataTable: {
      dtype: 'int',
      format: 'text',
      internal: true,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'readonly',
      help: 'System field'
    },
    entityFormContainer: {
      dtype: 'int',
      format: 'text',
      internal: true,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'readonly'
    },
    kanbanView: {
      dtype: 'int',
      format: 'text',
      internal: true,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'readonly'
    }
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
 * Find matching pattern rule for field name
 */
function findMatchingRule(fieldName: string): PatternRule | null {
  // Exact match first
  if (PATTERN_RULES[fieldName]) {
    return PATTERN_RULES[fieldName];
  }

  // Pattern match
  for (const [pattern, rule] of Object.entries(PATTERN_RULES)) {
    if (matchPattern(fieldName, pattern)) {
      return rule;
    }
  }

  return null;
}

/**
 * Generate human-readable label from field name
 */
function generateLabel(fieldName: string): string {
  // Special case: field named just "id" stays as "Id"
  if (fieldName === 'id') {
    return 'Id';
  }

  // Special handling for entity reference fields with prefix: {prefix}__{entity}_id
  // Examples:
  //   manager__employee_id → "Manager Employee Name"
  //   sponsor__employee_id → "Sponsor Employee Name"
  //   parent__project_id → "Parent Project Name"
  const prefixedEntityMatch = fieldName.match(/^(.+?)__(\w+)_id$/);
  if (prefixedEntityMatch) {
    const prefix = prefixedEntityMatch[1];  // "manager", "sponsor", "parent"
    const entity = prefixedEntityMatch[2];  // "employee", "project"
    const prefixLabel = prefix.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1);
    return `${prefixLabel} ${entityLabel} Name`;  // "Manager Employee Name", "Sponsor Employee Name"
  }

  // Simple entity reference fields: entity_id → "Entity Name"
  // Examples:
  //   office_id → "Office Name"
  //   business_id → "Business Name"
  const simpleEntityMatch = fieldName.match(/^(\w+)_id$/);
  if (simpleEntityMatch) {
    const entity = simpleEntityMatch[1];
    const entityLabel = entity.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return `${entityLabel} Name`;  // "Office Name", "Business Name"
  }

  // Remove common suffixes and prefixes for clean labels
  let label = fieldName
    .replace(/^dl__/, '')
    .replace(/_amt$/, '')
    .replace(/_date$/, '')
    .replace(/_ts$/, '')
    .replace(/_flag$/, '')
    .replace(/_url$/, '')
    .replace(/_pct$/, '');

  if (label === 'descr') label = 'description';

  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect entity name from reference field
 * Supports both singular (_id) and plural (_ids) patterns
 */
function detectEntityFromFieldName(fieldName: string): string | null {
  // Pattern: *__entity_id → entity (prefixed singular)
  // Examples: manager__employee_id → employee, sponsor__client_id → client
  const match1 = fieldName.match(/^.*__(\w+)_id$/);
  if (match1) return match1[1];

  // Pattern: *__entity_ids → entity (prefixed plural/array)
  // Examples: assigned__employee_ids → employee, team__client_ids → client
  const match1b = fieldName.match(/^.*__(\w+)_ids$/);
  if (match1b) return match1b[1];

  // Pattern: entity_id → entity (simple singular)
  // Examples: office_id → office, business_id → business
  const match2 = fieldName.match(/^(\w+)_id$/);
  if (match2 && match2[1] !== 'id') return match2[1];

  // Pattern: entity_ids → entity (simple plural/array)
  // Examples: employee_ids → employee, project_ids → project
  const match2b = fieldName.match(/^(\w+)_ids$/);
  if (match2b) return match2b[1];

  return null;
}

/**
 * Component inheritance mapping
 * Components inherit rules from their parent if not explicitly defined
 */
const COMPONENT_INHERITANCE: Record<ComponentName, ComponentName | null> = {
  entityDataTable: null,           // Base component
  entityFormContainer: null,       // Base component (also used for detail view)
  kanbanView: 'entityDataTable',           // Inherits from table
  calendarView: 'entityDataTable',         // Inherits from table
  gridView: 'entityDataTable',             // Inherits from table
  dagView: 'entityDataTable',              // Inherits from table
  hierarchyGraphView: 'entityDataTable',   // Inherits from table
};

/**
 * Convert explicit field config to FieldMetadataBase
 */
function convertExplicitConfigToMetadata(
  config: FieldConfig,
  component: ComponentName,
  fieldName: string
): FieldMetadataBase {
  // Map renderType to dtype and format
  type DType = FieldMetadataBase['dtype'];
  const renderTypeMap: Record<string, { dtype: DType; format: string }> = {
    'currency': { dtype: 'float', format: 'currency' },
    'date': { dtype: 'date', format: 'date' },
    'timestamp': { dtype: 'timestamp', format: 'timestamp' },
    'boolean': { dtype: 'bool', format: 'boolean' },
    'badge': { dtype: 'str', format: 'datalabel_lookup' },
    'reference': { dtype: 'uuid', format: 'entityInstance_Id' },
    'entityInstance_Id': { dtype: 'uuid', format: 'entityInstance_Id' },
    'json': { dtype: 'jsonb', format: 'json' },
    'progress-bar': { dtype: 'float', format: 'progress_bar' },
    'percentage': { dtype: 'float', format: 'percentage' },
    'number': { dtype: 'int', format: 'number' },
    'text': { dtype: 'str', format: 'text' },
    'array': { dtype: 'array[str]', format: 'array' },
    'multiselect': { dtype: 'array[uuid]', format: 'array' },
  };

  const typeInfo = renderTypeMap[config.renderType || 'text'] || { dtype: 'str' as DType, format: 'text' };

  // Determine visibility for this component
  const visibilityMap: Record<ComponentName, boolean> = {
    entityDataTable: config.visible?.EntityDataTable ?? true,
    entityFormContainer: config.visible?.EntityFormContainer ?? true,
    kanbanView: config.visible?.KanbanView ?? true,
    calendarView: config.visible?.CalendarView ?? true,
    gridView: config.visible?.EntityDataTable ?? true,
    dagView: config.visible?.EntityFormContainer ?? true,
    hierarchyGraphView: config.visible?.EntityFormContainer ?? true,
  };

  return {
    dtype: typeInfo.dtype,
    format: typeInfo.format,
    internal: false,
    visible: visibilityMap[component] ?? true,
    filterable: component === 'entityDataTable',
    sortable: component === 'entityDataTable',
    editable: config.editable ?? (component === 'entityFormContainer'),
    viewType: config.renderType || 'text',
    editType: config.inputType || 'text',
    width: config.width || 'auto',
    align: config.align || 'left',
    // Additional properties from explicit config
    ...(config.loadFromDataLabels && { loadFromDataLabels: true, datalabelKey: fieldName }),
    ...(config.loadFromEntity && {
      loadFromEntity: config.loadFromEntity,
      endpoint: `/api/v1/entity/${config.loadFromEntity}/entity-instance-lookup`,
      displayField: 'name',
      valueField: 'id',
    }),
    ...(config.format && { formatConfig: config.format }),
    ...(config.label && { label: config.label }),
  };
}

/**
 * Generate field metadata for a specific component
 *
 * Priority order:
 * 1. Explicit config from entity-field-config.ts (highest priority)
 * 2. YAML mapping files (new preferred method)
 * 3. Legacy pattern detection rules (fallback)
 * 4. Default text field (lowest priority)
 */
function generateFieldMetadataForComponent(
  fieldName: string,
  component: ComponentName,
  entityCode?: string
): FieldMetadataBase | null {
  // STEP 1: Check explicit config FIRST (prevents silent failures on non-standard names)
  if (entityCode) {
    const explicitConfig = getFieldConfig(entityCode, fieldName);
    if (explicitConfig) {
      // Convert explicit config to FieldMetadataBase
      return convertExplicitConfigToMetadata(explicitConfig, component, fieldName);
    }
  }

  // STEP 2: Try YAML mappings (new preferred method)
  const fieldBusinessType = getFieldBusinessType(fieldName);
  const viewMeta = getViewMetadataFromYaml(fieldBusinessType, component);
  const editMeta = getEditMetadataFromYaml(fieldBusinessType, component);

  if (viewMeta || editMeta) {
    // Merge VIEW and EDIT metadata from YAML
    const yamlMetadata: FieldMetadataBase = {
      dtype: (viewMeta?.dtype || editMeta?.dtype || 'str') as FieldMetadataBase['dtype'],
      format: fieldBusinessType,
      internal: false,
      visible: viewMeta?.visible ?? true,
      filterable: viewMeta?.filterable ?? (component === 'entityDataTable'),
      sortable: viewMeta?.sortable ?? (component === 'entityDataTable'),
      editable: editMeta?.editable ?? (component === 'entityFormContainer'),
      viewType: viewMeta?.viewType || fieldBusinessType,
      editType: editMeta?.editType || fieldBusinessType,
      width: viewMeta?.width,
      align: viewMeta?.align,
    };

    // Copy additional properties from viewMeta
    if (viewMeta) {
      const { dtype, visible, filterable, sortable, width, align, viewType, ...viewExtras } = viewMeta;
      Object.assign(yamlMetadata, viewExtras);
    }

    // Copy additional properties from editMeta
    if (editMeta) {
      const { dtype, editable, editType, ...editExtras } = editMeta;
      Object.assign(yamlMetadata, editExtras);
    }

    // Auto-detect entity for ALL *_id and *_ids fields
    if ((fieldName.endsWith('_id') || fieldName.endsWith('_ids')) && fieldName !== 'id') {
      const entity = detectEntityFromFieldName(fieldName);
      if (entity) {
        yamlMetadata.loadFromEntity = entity;
        yamlMetadata.endpoint = `/api/v1/entity/${entity}/entity-instance-lookup`;
        yamlMetadata.displayField = 'name';
        yamlMetadata.valueField = 'id';
      }
    }

    // Set datalabelKey for dl__* fields
    if (fieldName.startsWith('dl__')) {
      yamlMetadata.datalabelKey = fieldName;
      yamlMetadata.loadFromDataLabels = true;
    }

    return yamlMetadata;
  }

  // STEP 3: Fall back to legacy pattern detection
  const rule = findMatchingRule(fieldName);

  if (!rule) {
    // Default text field for unknown patterns
    return {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: component === 'entityDataTable' ||
               component === 'entityFormContainer' ||
               component === 'gridView',
      filterable: component === 'entityDataTable',
      sortable: component === 'entityDataTable',
      editable: component === 'entityFormContainer',
      viewType: 'text',
      editType: 'text',
      width: 'auto',
      align: 'left'
    };
  }

  // Try to get component-specific rule, or inherit from parent component
  let componentRule = rule[component];

  if (!componentRule) {
    const parentComponent = COMPONENT_INHERITANCE[component];
    if (parentComponent) {
      componentRule = rule[parentComponent];
    }
  }

  // If still no rule (shouldn't happen), use entityDataTable as fallback
  if (!componentRule) {
    componentRule = rule.entityDataTable;
  }

  // Clone the rule to avoid mutation
  componentRule = { ...componentRule };

  // Auto-detect entity for ALL *_id and *_ids fields (both simple and prefixed)
  if ((fieldName.endsWith('_id') || fieldName.endsWith('_ids')) && fieldName !== 'id') {
    const entity = detectEntityFromFieldName(fieldName);
    if (entity) {
      componentRule.loadFromEntity = entity;
      componentRule.endpoint = `/api/v1/entity/${entity}/entity-instance-lookup`;
      componentRule.displayField = 'name';
      componentRule.valueField = 'id';
    }
  }

  // Set datalabelKey for dl__* fields
  if (fieldName.startsWith('dl__')) {
    componentRule.datalabelKey = fieldName;
  }

  return componentRule as FieldMetadataBase;
}

/**
 * Generate metadata for all requested components
 *
 * @param fieldNames - List of field names from the entity data
 * @param requestedComponents - Components to generate metadata for
 * @param entityCode - Entity type code (for explicit config lookup)
 */
export function generateMetadataForComponents(
  fieldNames: string[],
  requestedComponents: ComponentName[] = ['entityDataTable', 'entityFormContainer', 'kanbanView'],
  entityCode?: string
): EntityMetadata {
  const metadata: EntityMetadata = {};

  for (const component of requestedComponents) {
    const componentMetadata: ComponentMetadata = {};

    for (const fieldName of fieldNames) {
      const fieldMeta = generateFieldMetadataForComponent(fieldName, component, entityCode);
      if (fieldMeta) {
        // Add human-readable label (explicit config label takes precedence)
        if (!(fieldMeta as any).label) {
          (fieldMeta as any).label = generateLabel(fieldName);
        }
        componentMetadata[fieldName] = fieldMeta;
      }
    }

    metadata[component] = componentMetadata;
  }

  return metadata;
}

/**
 * Extract datalabel keys from metadata
 */
export function extractDatalabelKeys(metadata: EntityMetadata): string[] {
  const datalabelKeys = new Set<string>();

  for (const componentMetadata of Object.values(metadata)) {
    if (componentMetadata) {
      for (const fieldMeta of Object.values(componentMetadata) as FieldMetadataBase[]) {
        // Check if field is datalabel_lookup format and has datalabelKey
        if (fieldMeta.format === 'datalabel_lookup' && fieldMeta.datalabelKey) {
          datalabelKeys.add(fieldMeta.datalabelKey);
        }
      }
    }
  }

  return Array.from(datalabelKeys);
}

/**
 * Generate complete entity response
 */
export function generateEntityResponse(
  entityCode: string,
  data: any[],
  options: {
    components?: ComponentName[];
    total?: number;
    limit?: number;
    offset?: number;
  } = {}
): EntityResponse {
  const {
    components = ['entityDataTable', 'entityFormContainer', 'kanbanView'],
    total = data.length,
    limit = 20,
    offset = 0
  } = options;

  // Extract field names from first row
  const fieldNames = data.length > 0 ? Object.keys(data[0]) : [];

  // Generate metadata for requested components (pass entityCode for explicit config lookup)
  const metadata = generateMetadataForComponents(fieldNames, components, entityCode);

  return {
    data,
    fields: fieldNames,
    metadata,
    total,
    limit,
    offset
  };
}

