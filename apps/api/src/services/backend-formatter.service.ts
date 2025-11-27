/**
 * ============================================================================
 * BACKEND FORMATTER SERVICE - Component-Aware Metadata Generation
 * ============================================================================
 * Version: 11.0.0
 *
 * PURPOSE:
 * Generate component-specific metadata from column names using YAML pattern matching.
 * Backend decides all field behavior based on naming conventions.
 *
 * ARCHITECTURE:
 * - Column name → Explicit config check → YAML mappings → Default text field
 * - Separate metadata per component (EntityDataTable, EntityFormContainer, KanbanView)
 * - Global settings for cross-cutting concerns (currency, date formats, etc.)
 * - Datalabels extracted and fetched separately
 *
 * v11.0.0 CHANGES:
 * - Removed legacy PATTERN_RULES (~900 lines) - YAML is now sole source of truth
 * - Removed findMatchingRule, matchPattern, COMPONENT_INHERITANCE
 * - Simplified to: explicit config → YAML → default text
 *
 * ============================================================================
 * API OUTPUT STRUCTURE (v10.0.0)
 * ============================================================================
 *
 * The API returns metadata with viewType and editType as top-level containers:
 *
 * {
 *   "data": [...],
 *   "fields": ["id", "name", "budget_allocated_amt", ...],
 *   "metadata": {
 *     "entityDataTable": {
 *       "viewType": {
 *         "budget_allocated_amt": {
 *           "dtype": "float",
 *           "label": "Budget Allocated",
 *           "type": "currency",              // renderType from view-type-mapping.yaml
 *           "component": "CurrencyCell",     // Only when type is "component"
 *           "behavior": { "visible": true, "sortable": true, "filterable": true },
 *           "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2 }
 *         }
 *       },
 *       "editType": {
 *         "budget_allocated_amt": {
 *           "dtype": "float",
 *           "label": "Budget Allocated",
 *           "type": "number",                // inputType from edit-type-mapping.yaml
 *           "component": "CurrencyInput",    // Only when type is "component" or "select"
 *           "behavior": { "editable": true },
 *           "style": { "symbol": "$", "decimals": 2 },
 *           "validation": { "min": 0 },
 *           "lookupSource": "datalabel",     // For dropdown fields
 *           "lookupEntity": "employee",      // For entity reference fields
 *           "datalabelKey": "dl__status"     // For datalabel fields
 *         }
 *       }
 *     },
 *     "entityFormContainer": { "viewType": {...}, "editType": {...} },
 *     "kanbanView": { "viewType": {...}, "editType": {...} }
 *   }
 * }
 *
 * ============================================================================
 * YAML MAPPING FILES (v3.0.0)
 * ============================================================================
 *
 * - pattern-mapping.yaml: Maps field name patterns to fieldBusinessType
 * - view-type-mapping.yaml: Maps fieldBusinessType to VIEW rendering config (renderType)
 * - edit-type-mapping.yaml: Maps fieldBusinessType to EDIT/INPUT config (inputType)
 *
 * YAML STRUCTURE (v3.0.0 - Three Categories):
 *   behavior: { visible, sortable, filterable, searchable, editable }
 *   style: { width, align, symbol, decimals, locale, truncate, ... }
 *   validation: { required, min, max, pattern, ... } (edit-type only)
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

// View metadata structure - matches YAML structure with behavior/style
export interface ViewMetadata {
  renderType: string;     // 'text', 'date', 'currency', 'component', etc.
  component?: string;     // Component name when renderType is 'component'
  // Lookup source for entity reference fields (v8.3.2)
  lookupEntity?: string;  // Entity code for ref_data_entityInstance resolution
  // Three categories matching YAML structure
  behavior: {
    visible?: boolean;
    filterable?: boolean;
    sortable?: boolean;
    searchable?: boolean;
  };
  style: Record<string, any>;  // width, align, symbol, decimals, etc.
}

// Edit metadata structure - matches YAML structure with behavior/style/validation
export interface EditMetadata {
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', etc.
  component?: string;     // Component name when inputType is 'select' or 'component'
  // Lookup source for dropdowns
  lookupSource?: 'datalabel' | 'entityInstance';
  lookupEntity?: string;  // Entity code when lookupSource is 'entityInstance'
  datalabelKey?: string;  // Datalabel key when lookupSource is 'datalabel'
  // Three categories matching YAML structure
  behavior: {
    editable?: boolean;
  };
  style: Record<string, any>;      // symbol, decimals, step, etc.
  validation: Record<string, any>; // required, min, max, pattern, etc.
}

export interface FieldMetadataBase {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb' | 'array[str]' | 'array[uuid]';
  label: string;
  // Separated view and edit metadata
  view: ViewMetadata;
  edit: EditMetadata;

  // Legacy flat fields (deprecated - for backward compatibility)
  format?: string;
  internal?: boolean;
  visible?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  viewType?: string;
  editType?: string;
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
  // v8.3.2: Datalabels detected by pattern-mapping.yaml (dl__* pattern)
  endpoint?: string;
  displayField?: string;
  valueField?: string;
  datalabelKey?: string;

  // Component-specific visualization containers
  EntityFormContainer_viz_container?: 'DAGVisualizer' | 'MetadataTable' | string;
}

// Old structure (deprecated)
export interface ComponentMetadataLegacy {
  [fieldName: string]: FieldMetadataBase;
}

// New structure: viewType and editType as top-level containers
export interface ViewTypeMetadata {
  [fieldName: string]: ViewMetadata & { dtype: string; label: string };
}

export interface EditTypeMetadata {
  [fieldName: string]: EditMetadata & { dtype: string; label: string };
}

export interface ComponentMetadata {
  viewType: ViewTypeMetadata;
  editType: EditTypeMetadata;
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
    renderType?: string;      // NEW: 'text', 'email', 'date', 'component', etc.
    component?: string;       // NEW: Component name when renderType is 'component'
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
    lookupSource?: 'datalabel' | 'entityInstance';  // Unified lookup source
    loadFromEntity?: boolean;  // For entity references only
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
 * Returns: ViewMetadata { type, component, behavior, style }
 *
 * YAML structure (v3.0.0):
 *   entityDataTable:
 *     behavior: { visible, sortable, filterable, searchable }
 *     style: { width, align, symbol, decimals, ... }
 */
function getViewMetadataFromYaml(
  fieldBusinessType: string,
  component: ComponentName
): { dtype: string; view: ViewMetadata } | null {
  const viewMapping = loadViewTypeMapping();
  const resolved = resolveInheritance(fieldBusinessType, viewMapping.fieldBusinessTypes);

  if (!resolved) {
    return null;
  }

  const componentConfig = resolved[component];
  if (!componentConfig) {
    return null;
  }

  // Extract behavior and style from new structure
  const yamlBehavior = componentConfig.behavior || {};
  const yamlStyle = componentConfig.style || {};

  // Build behavior object - read from behavior (new) with fallback to flat (legacy/defaults)
  const behaviorObj = {
    visible: yamlBehavior.visible ?? componentConfig.visible ?? true,
    sortable: yamlBehavior.sortable ?? componentConfig.sortable ?? false,
    filterable: yamlBehavior.filterable ?? componentConfig.filterable ?? false,
    searchable: yamlBehavior.searchable ?? componentConfig.searchable ?? false,
  };

  // Build style object - merge width/align from flat (defaults) with yamlStyle
  const styleObj: Record<string, any> = {};
  const width = yamlStyle.width ?? componentConfig.width;
  const align = yamlStyle.align ?? componentConfig.align;
  if (width) styleObj.width = width;
  if (align) styleObj.align = align;
  // Add all other style properties (symbol, decimals, etc.)
  for (const [key, value] of Object.entries(yamlStyle)) {
    if (key !== 'width' && key !== 'align') {
      styleObj[key] = value;
    }
  }

  // Build ViewMetadata with separate behavior and style objects
  // renderType priority: componentConfig.renderType > resolved.renderType > fieldBusinessType
  const view: ViewMetadata = {
    renderType: componentConfig.renderType || resolved.renderType || fieldBusinessType,
    behavior: behaviorObj,
    style: styleObj,
  };

  // Add component only when renderType is 'component'
  if (view.renderType === 'component') {
    if (componentConfig.component) {
      view.component = componentConfig.component;
    } else if (resolved.component) {
      view.component = resolved.component;
    }
  }

  return {
    dtype: resolved.dtype,
    view
  };
}

/**
 * Get EDIT metadata for a fieldBusinessType and component from YAML
 * Returns: EditMetadata { type, component, behavior, style, validation }
 *
 * YAML structure (v3.3.0):
 *   entityDataTable:
 *     inputType: number
 *     behavior: { editable, filterable, sortable, visible }
 *     style: { step, symbol, decimals, ... }
 *     validation: { required, min, max, pattern, ... }
 */
function getEditMetadataFromYaml(
  fieldBusinessType: string,
  component: ComponentName
): { dtype: string; edit: EditMetadata } | null {
  const editMapping = loadEditTypeMapping();
  const resolved = resolveInheritance(fieldBusinessType, editMapping.fieldBusinessTypes);

  if (!resolved) {
    return null;
  }

  const componentConfig = resolved[component];

  // Extract behavior, style, and validation from new structure
  const yamlBehavior = componentConfig?.behavior || {};
  const yamlStyle = componentConfig?.style || {};
  const yamlValidation = componentConfig?.validation || {};

  // Build behavior object
  const behaviorObj = {
    editable: yamlBehavior.editable ?? componentConfig?.editable ?? resolved.editable ?? true,
  };

  // Build EditMetadata with separate behavior, style, validation objects
  const edit: EditMetadata = {
    inputType: componentConfig?.inputType || fieldBusinessType,
    behavior: behaviorObj,
    style: { ...yamlStyle },
    validation: { ...yamlValidation },
  };

  // Add component if specified
  if (componentConfig?.component) {
    edit.component = componentConfig.component;
  }

  // Include lookupSource directly from YAML
  if (resolved.lookupSource) {
    edit.lookupSource = resolved.lookupSource;
  }

  return {
    dtype: resolved.dtype,
    edit
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
 * Convert explicit field config to FieldMetadataBase with view{} and edit{} structure
 */
function convertExplicitConfigToMetadata(
  config: FieldConfig,
  component: ComponentName,
  fieldName: string
): FieldMetadataBase {
  // Map renderType to dtype
  // v8.3.2: Use entityInstanceId (camelCase) - matches YAML output
  type DType = FieldMetadataBase['dtype'];
  const renderTypeMap: Record<string, DType> = {
    'currency': 'float',
    'date': 'date',
    'timestamp': 'timestamp',
    'boolean': 'bool',
    'badge': 'str',
    'reference': 'uuid',
    'entityInstanceId': 'uuid',
    'entityInstanceIds': 'array[uuid]',
    'json': 'jsonb',
    'progress-bar': 'float',
    'percentage': 'float',
    'number': 'int',
    'text': 'str',
    'array': 'array[str]',
    'multiselect': 'array[uuid]',
  };

  const dtype = renderTypeMap[config.renderType || 'text'] || 'str' as DType;

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

  // Build view metadata with behavior/style structure
  const viewStyle: Record<string, any> = {};
  if (config.width) viewStyle.width = config.width;
  if (config.align) viewStyle.align = config.align;
  if (config.format) Object.assign(viewStyle, config.format);

  const view: ViewMetadata = {
    renderType: config.renderType || 'text',
    behavior: {
      visible: visibilityMap[component] ?? true,
      filterable: component === 'entityDataTable',
      sortable: component === 'entityDataTable',
      searchable: false,
    },
    style: viewStyle,
  };

  // Build edit metadata with behavior/style/validation structure
  const edit: EditMetadata = {
    inputType: config.inputType || 'text',
    behavior: {
      editable: config.editable ?? (component === 'entityFormContainer'),
    },
    style: {},
    validation: {},
  };

  // Handle lookup sources
  // v8.3.2: Datalabels auto-detected by pattern-mapping.yaml (dl__* pattern)
  if (config.loadFromEntity) {
    edit.lookupSource = 'entityInstance';
    edit.lookupEntity = config.loadFromEntity;
  }

  return {
    dtype,
    label: config.label || generateLabel(fieldName),
    view,
    edit,
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
 *
 * Returns metadata with separate view{} and edit{} objects
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
  const viewResult = getViewMetadataFromYaml(fieldBusinessType, component);
  const editResult = getEditMetadataFromYaml(fieldBusinessType, component);

  if (viewResult || editResult) {
    const dtype = (viewResult?.dtype || editResult?.dtype || 'str') as FieldMetadataBase['dtype'];

    // Build view metadata with behavior/style structure
    const view: ViewMetadata = viewResult?.view || {
      renderType: fieldBusinessType,
      behavior: { visible: true, sortable: false, filterable: false, searchable: false },
      style: {},
    };

    // Build edit metadata with behavior/style/validation structure
    const edit: EditMetadata = editResult?.edit || {
      inputType: fieldBusinessType,
      behavior: { editable: component === 'entityFormContainer' },
      style: {},
      validation: {},
    };

    // Extract lookupEntity from field name for entity reference fields
    // YAML provides lookupSource: entityInstance, we extract the specific entity from field name
    // e.g., manager__employee_id → lookupEntity: "employee"
    // v8.3.2: Add lookupEntity to BOTH view and edit for ref_data_entityInstance resolution
    if (edit.lookupSource === 'entityInstance') {
      const entity = detectEntityFromFieldName(fieldName);
      if (entity) {
        edit.lookupEntity = entity;
        view.lookupEntity = entity;  // v8.3.2: Also set on view for formatter resolution
      }
    }

    // Extract datalabelKey from field name for datalabel fields
    // YAML provides lookupSource: datalabel, we use field name as the key
    if (edit.lookupSource === 'datalabel') {
      edit.datalabelKey = fieldName;
    }

    // Build final metadata with separated view and edit
    const yamlMetadata: FieldMetadataBase = {
      dtype,
      label: generateLabel(fieldName),
      view,
      edit,
    };

    return yamlMetadata;
  }

  // STEP 3: Default text field for unknown patterns
  // v8.3.2: Legacy PATTERN_RULES removed - YAML mappings are sole source of truth
  return {
    dtype: 'str',
    label: generateLabel(fieldName),
    view: {
      renderType: 'text',
      behavior: {
        visible: component === 'entityDataTable' ||
                 component === 'entityFormContainer' ||
                 component === 'gridView',
        filterable: component === 'entityDataTable',
        sortable: component === 'entityDataTable',
        searchable: false,
      },
      style: { width: 'auto', align: 'left' },
    },
    edit: {
      inputType: 'text',
      behavior: { editable: component === 'entityFormContainer' },
      style: {},
      validation: {},
    },
  };
}

/**
 * Generate metadata for all requested components
 *
 * Structure: metadata.entityDataTable.viewType.{field} and metadata.entityDataTable.editType.{field}
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
    const viewTypeMetadata: ViewTypeMetadata = {};
    const editTypeMetadata: EditTypeMetadata = {};

    for (const fieldName of fieldNames) {
      const fieldMeta = generateFieldMetadataForComponent(fieldName, component, entityCode);
      if (fieldMeta) {
        // Split into viewType and editType containers
        viewTypeMetadata[fieldName] = {
          dtype: fieldMeta.dtype,
          label: fieldMeta.label,
          ...fieldMeta.view,
        };
        editTypeMetadata[fieldName] = {
          dtype: fieldMeta.dtype,
          label: fieldMeta.label,
          ...fieldMeta.edit,
        };
      }
    }

    metadata[component] = {
      viewType: viewTypeMetadata,
      editType: editTypeMetadata,
    };
  }

  return metadata;
}

/**
 * Extract datalabel keys from metadata
 */
export function extractDatalabelKeys(metadata: EntityMetadata): string[] {
  const datalabelKeys = new Set<string>();

  for (const componentMetadata of Object.values(metadata)) {
    if (componentMetadata?.editType) {
      for (const fieldMeta of Object.values(componentMetadata.editType) as (EditMetadata & { dtype: string; label: string })[]) {
        // Check new structure: lookupSource === 'datalabel' and datalabelKey
        if (fieldMeta.lookupSource === 'datalabel' && fieldMeta.datalabelKey) {
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

