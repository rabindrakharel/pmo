/**
 * ============================================================================
 * BACKEND FORMATTER SERVICE v5.0 - Component-Aware Metadata Generation
 * ============================================================================
 *
 * PURPOSE:
 * Generate component-specific metadata from column names using pattern matching.
 * Backend decides all field behavior based on naming conventions.
 *
 * ARCHITECTURE:
 * - Column name → Pattern match → Component-specific config
 * - Separate metadata per component (EntityDataTable, EntityFormContainer, KanbanView)
 * - Global settings for cross-cutting concerns (currency, date formats, etc.)
 * - Datalabels extracted and fetched separately
 *
 * USAGE:
 * ```typescript
 * import { generateEntityResponse } from './backend-formatter-v5.service';
 *
 * // In route handler
 * const response = generateEntityResponse('project', projects, {
 *   components: ['entityDataTable', 'entityFormContainer']
 * });
 * return reply.send(response);
 * ```
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ComponentName = 'entityDataTable' | 'entityFormContainer' | 'kanbanView';

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

  // For references
  loadFromEntity?: string;
  loadFromDataLabels?: boolean;
  endpoint?: string;
  displayField?: string;
  datalabelKey?: string;
}

export interface ComponentMetadata {
  [fieldName: string]: FieldMetadataBase;
}

export interface EntityMetadata {
  entityDataTable?: ComponentMetadata;
  entityFormContainer?: ComponentMetadata;
  kanbanView?: ComponentMetadata;
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
  datalabels: DatalabelData[];
  globalSettings: GlobalSettings;
  total: number;
  limit: number;
  offset: number;
  format?: 'object' | 'indexed';
}

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
    style: 'datetime',
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
// PATTERN RULES - COMPONENT-SPECIFIC BEHAVIOR
// ============================================================================

interface PatternRule {
  entityDataTable: Partial<FieldMetadataBase>;
  entityFormContainer: Partial<FieldMetadataBase>;
  kanbanView: Partial<FieldMetadataBase>;
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
      viewType: 'timestamp',
      editType: 'readonly',
      width: '160px',
      align: 'left',
      timestampFormat: 'relative',
      locale: 'en-US'
    },
    entityFormContainer: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'timestamp',
      editType: 'readonly'
    },
    kanbanView: {
      dtype: 'timestamp',
      format: 'timestamp-relative',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'timestamp',
      editType: 'readonly'
    }
  },

  'updated_ts': {
    entityDataTable: {
      dtype: 'timestamp',
      format: 'timestamp-absolute',
      internal: false,
      visible: false,
      filterable: false,
      sortable: true,
      editable: false,
      viewType: 'timestamp',
      editType: 'readonly',
      width: '160px',
      align: 'left',
      timestampFormat: 'datetime'
    },
    entityFormContainer: {
      dtype: 'timestamp',
      format: 'timestamp-absolute',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'timestamp',
      editType: 'readonly'
    },
    kanbanView: {
      dtype: 'timestamp',
      format: 'timestamp-absolute',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'timestamp',
      editType: 'readonly'
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
      format: 'badge',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'badge',
      editType: 'select',
      width: '140px',
      align: 'left',
      loadFromDataLabels: true
    },
    entityFormContainer: {
      dtype: 'str',
      format: 'badge',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'badge',
      editType: 'select',
      loadFromDataLabels: true
    },
    kanbanView: {
      dtype: 'str',
      format: 'badge',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'badge',
      editType: 'select',
      loadFromDataLabels: true
    }
  },

  // ========================================
  // REFERENCE FIELDS (FOREIGN KEYS)
  // ========================================
  '*__employee_id': {
    entityDataTable: {
      dtype: 'uuid',
      format: 'reference',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'text',
      editType: 'select',
      width: '150px',
      align: 'left',
      loadFromEntity: 'employee',
      endpoint: '/api/v1/entity/employee/entity-instance-lookup',
      displayField: 'name',
      searchable: true
    },
    entityFormContainer: {
      dtype: 'uuid',
      format: 'reference',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'text',
      editType: 'select',
      loadFromEntity: 'employee',
      endpoint: '/api/v1/entity/employee/entity-instance-lookup',
      displayField: 'name',
      searchable: true
    },
    kanbanView: {
      dtype: 'uuid',
      format: 'reference',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'select'
    }
  },

  '*__employee_ids': {
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
      loadFromEntity: 'employee',
      endpoint: '/api/v1/entity/employee/entity-instance-lookup'
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

  '*_id': {
    entityDataTable: {
      dtype: 'uuid',
      format: 'reference',
      internal: false,
      visible: true,
      filterable: true,
      sortable: true,
      editable: true,
      viewType: 'text',
      editType: 'select',
      width: '150px',
      align: 'left',
      searchable: true
    },
    entityFormContainer: {
      dtype: 'uuid',
      format: 'reference',
      internal: false,
      visible: true,
      filterable: false,
      sortable: false,
      editable: true,
      viewType: 'text',
      editType: 'select',
      searchable: true
    },
    kanbanView: {
      dtype: 'uuid',
      format: 'reference',
      internal: false,
      visible: false,
      filterable: false,
      sortable: false,
      editable: false,
      viewType: 'text',
      editType: 'select'
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
  let label = fieldName
    .replace(/^dl__/, '')
    .replace(/^parent__/, 'Parent ')
    .replace(/__employee_id(s)?$/, '')
    .replace(/_id$/, '')
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
 */
function detectEntityFromFieldName(fieldName: string): string | null {
  // Pattern: *__entity_id → entity
  const match1 = fieldName.match(/^.*__(\w+)_id$/);
  if (match1) return match1[1];

  // Pattern: entity_id → entity
  const match2 = fieldName.match(/^(\w+)_id$/);
  if (match2 && match2[1] !== 'id') return match2[1];

  return null;
}

/**
 * Generate field metadata for a specific component
 */
function generateFieldMetadataForComponent(
  fieldName: string,
  component: ComponentName
): FieldMetadataBase | null {
  const rule = findMatchingRule(fieldName);

  if (!rule) {
    // Default text field for unknown patterns
    return {
      dtype: 'str',
      format: 'text',
      internal: false,
      visible: component === 'entityDataTable',
      filterable: component === 'entityDataTable',
      sortable: component === 'entityDataTable',
      editable: component !== 'kanbanView',
      viewType: 'text',
      editType: 'text',
      width: 'auto',
      align: 'left'
    };
  }

  const componentRule = rule[component];

  // Auto-detect entity for *_id fields
  if (fieldName.endsWith('_id') && !fieldName.includes('__')) {
    const entity = detectEntityFromFieldName(fieldName);
    if (entity) {
      componentRule.loadFromEntity = entity;
      componentRule.endpoint = `/api/v1/entity/${entity}/entity-instance-lookup`;
      componentRule.displayField = 'name';
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
 */
export function generateMetadataForComponents(
  fieldNames: string[],
  requestedComponents: ComponentName[] = ['entityDataTable', 'entityFormContainer', 'kanbanView']
): EntityMetadata {
  const metadata: EntityMetadata = {};

  for (const component of requestedComponents) {
    const componentMetadata: ComponentMetadata = {};

    for (const fieldName of fieldNames) {
      const fieldMeta = generateFieldMetadataForComponent(fieldName, component);
      if (fieldMeta) {
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
      for (const fieldMeta of Object.values(componentMetadata)) {
        if (fieldMeta.loadFromDataLabels && fieldMeta.datalabelKey) {
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
    datalabels?: DatalabelData[];
  } = {}
): EntityResponse {
  const {
    components = ['entityDataTable', 'entityFormContainer', 'kanbanView'],
    total = data.length,
    limit = 20,
    offset = 0,
    datalabels = []
  } = options;

  // Extract field names from first row
  const fieldNames = data.length > 0 ? Object.keys(data[0]) : [];

  // Generate metadata for requested components
  const metadata = generateMetadataForComponents(fieldNames, components);

  return {
    data,
    fields: fieldNames,
    metadata,
    datalabels,
    globalSettings: GLOBAL_SETTINGS,
    total,
    limit,
    offset
  };
}
