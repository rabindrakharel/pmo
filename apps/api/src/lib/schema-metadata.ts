/**
 * Schema-driven utility for automatic column visibility and API restrictions
 * Based on the schema category map defined in /db/README.md
 * 
 * This utility automatically determines:
 * - Which columns should be visible/hidden in UI
 * - Which columns require PII masking
 * - Which columns are restricted in API responses
 * - UI behavior hints (search, sort, color, etc.)
 */

export interface ColumnMetadata {
  // API Restrictions
  'api:restrict'?: boolean;          // Hide in write paths, expose via audit endpoints
  'api:pii_masking'?: boolean;       // Mask unless user owns record or has clearance
  'api:financial_masking'?: boolean; // Restrict financial data based on authorization
  'api:auth_field'?: boolean;        // Authentication field - never expose
  'api:safety_info'?: boolean;       // Safety protocols - controlled access
  
  // UI Visibility
  'ui:invisible'?: boolean;          // Hide by default, use for joins/references
  'ui:search'?: boolean;             // Include in search functionality
  'ui:sort'?: boolean;               // Default sort field
  'ui:color_field'?: boolean;        // Contains color codes for styling
  'ui:wip_limit'?: boolean;          // WIP limit field for Kanban
  
  // UI Data Types
  'ui:geographic'?: boolean;         // PostGIS geometry field
  'ui:timezone'?: boolean;           // Timezone information
  'ui:currency'?: boolean;           // Currency code
  'ui:hierarchy'?: boolean;          // Self-referencing parent field
  'ui:cost_center'?: boolean;        // Cost center identifier
  'ui:operational_hours'?: boolean;  // Operating hours info
  'ui:job_info'?: boolean;           // Job family/level information
  'ui:employment'?: boolean;         // Employment type/status
  'ui:skills'?: boolean;             // Skills/certifications/education
  'ui:timeline'?: boolean;           // Date/timestamp for timelines
  'ui:stakeholders'?: boolean;       // Stakeholder arrays
  'ui:progress'?: boolean;           // Progress/completion tracking
  'ui:assignment'?: boolean;         // Assignment information
  'ui:planning'?: boolean;           // Planning-related fields
  'ui:dependencies'?: boolean;       // Task dependencies
  'ui:quality'?: boolean;            // Quality gates/criteria
  'ui:logs'?: boolean;               // Log entries/content
  
  // Flexible Data
  'flexible'?: boolean;              // JSON data - treat as key-value
}

export interface TableMetadata {
  tableName: string;
  columns: Record<string, ColumnMetadata>;
  defaultBehavior: ColumnMetadata;
}

/**
 * Schema metadata map based on the database schema category definitions
 * This mirrors the JSON structure defined in /db/README.md
 */
export const SCHEMA_METADATA: Record<string, TableMetadata> = {
  // Default behaviors applied to all tables
  '$defaults': {
    tableName: '$defaults',
    defaultBehavior: {
      'api:restrict': true,           // from_ts, to_ts, active, created, updated
      'flexible': true,               // tags, attr
      'ui:invisible': true,           // id, *_id
      'api:pii_masking': true,        // addr, birth_date, ssn, sin, phone, mobile, emergency_contact
      'ui:search': true,              // name, descr
      'ui:sort': true,                // name
    },
    columns: {
      // Standard audit fields (apply to all tables)
      'from_ts': { 'api:restrict': true },
      'to_ts': { 'api:restrict': true },
      'active': { 'api:restrict': true },
      'created': { 'api:restrict': true },
      'updated': { 'api:restrict': true },
      
      // Standard flexible fields
      'tags': { 'flexible': true },
      'attr': { 'flexible': true },
      
      // Standard invisible fields
      'id': { 'ui:invisible': true },
      '*_id': { 'ui:invisible': true }, // Pattern match for any field ending in _id
      
      // Standard PII fields
      'addr': { 'api:pii_masking': true },
      'birth_date': { 'api:pii_masking': true },
      'ssn': { 'api:pii_masking': true },
      'sin': { 'api:pii_masking': true },
      'phone': { 'api:pii_masking': true },
      'mobile': { 'api:pii_masking': true },
      'emergency_contact': { 'api:pii_masking': true },
      
      // Standard searchable fields
      'name': { 'ui:search': true, 'ui:sort': true },
      'descr': { 'ui:search': true },
    }
  },

  // Meta configuration tables
  'app.meta_biz_level': {
    tableName: 'app.meta_biz_level',
    defaultBehavior: {},
    columns: {
      'sort_order': { 'ui:sort': true },
    }
  },

  'app.meta_loc_level': {
    tableName: 'app.meta_loc_level',
    defaultBehavior: {},
    columns: {
      'sort_order': { 'ui:sort': true },
    }
  },

  'app.meta_hr_level': {
    tableName: 'app.meta_hr_level',
    defaultBehavior: {},
    columns: {
      'sort_order': { 'ui:sort': true },
      'salary_band_min': { 'api:pii_masking': true },
      'salary_band_max': { 'api:pii_masking': true },
    }
  },

  'app.meta_project_status': {
    tableName: 'app.meta_project_status',
    defaultBehavior: {},
    columns: {
      'code': { 'ui:search': true, 'ui:sort': true },
      'sort_id': { 'ui:sort': true },
      'color_hex': { 'ui:color_field': true },
    }
  },

  'app.meta_task_status': {
    tableName: 'app.meta_task_status',
    defaultBehavior: {},
    columns: {
      'code': { 'ui:search': true, 'ui:sort': true },
      'sort_id': { 'ui:sort': true },
      'color_hex': { 'ui:color_field': true },
    }
  },

  'app.meta_task_stage': {
    tableName: 'app.meta_task_stage',
    defaultBehavior: {},
    columns: {
      'code': { 'ui:search': true, 'ui:sort': true },
      'sort_id': { 'ui:sort': true },
      'color_hex': { 'ui:color_field': true },
      'wip_limit': { 'ui:wip_limit': true },
    }
  },

  // Scope hierarchy tables
  'app.d_scope_location': {
    tableName: 'app.d_scope_location',
    defaultBehavior: {},
    columns: {
      'postal_code': { 'api:pii_masking': true, 'ui:search': true },
      'emergency_contacts': { 'api:pii_masking': true },
      'geom': { 'ui:geographic': true },
      'time_zone': { 'ui:timezone': true },
      'currency_code': { 'ui:currency': true },
    }
  },

  'app.d_scope_business': {
    tableName: 'app.d_scope_business',
    defaultBehavior: {},
    columns: {
      'code': { 'ui:search': true },
      'budget_allocated': { 'api:financial_masking': true },
      'approval_limit': { 'api:financial_masking': true },
      'parent_id': { 'ui:hierarchy': true },
      'cost_center_code': { 'ui:cost_center': true },
    }
  },

  'app.d_scope_worksite': {
    tableName: 'app.d_scope_worksite',
    defaultBehavior: {},
    columns: {
      'worksite_code': { 'ui:search': true },
      'geom': { 'ui:geographic': true },
      'safety_protocols': { 'api:safety_info': true },
      'access_hours': { 'ui:operational_hours': true },
    }
  },

  'app.d_scope_hr': {
    tableName: 'app.d_scope_hr',
    defaultBehavior: {},
    columns: {
      'position_code': { 'ui:search': true },
      'salary_band_min': { 'api:pii_masking': true },
      'salary_band_max': { 'api:pii_masking': true },
      'bonus_target_pct': { 'api:pii_masking': true },
      'approval_limit': { 'api:pii_masking': true },
      'parent_id': { 'ui:hierarchy': true },
      'job_family': { 'ui:job_info': true },
      'job_level': { 'ui:job_info': true },
    }
  },

  // Domain tables
  'app.d_employee': {
    tableName: 'app.d_employee',
    defaultBehavior: {},
    columns: {
      'email': { 'api:pii_masking': true },
      'emp_code': { 'ui:search': true },
      'employment_type': { 'ui:employment': true },
      'work_mode': { 'ui:employment': true },
      'status': { 'ui:employment': true },
      'skills': { 'ui:skills': true },
      'certifications': { 'ui:skills': true },
      'education': { 'ui:skills': true },
      'password_hash': { 'api:auth_field': true },
    }
  },

  // Operational tables
  'app.ops_project_head': {
    tableName: 'app.ops_project_head',
    defaultBehavior: {},
    columns: {
      'project_code': { 'ui:search': true },
      'budget_allocated': { 'api:financial_masking': true },
      'planned_start_date': { 'ui:timeline': true },
      'planned_end_date': { 'ui:timeline': true },
      'actual_start_date': { 'ui:timeline': true },
      'actual_end_date': { 'ui:timeline': true },
      'project_managers': { 'ui:stakeholders': true },
      'project_sponsors': { 'ui:stakeholders': true },
      'approvers': { 'ui:stakeholders': true },
      'estimated_hours': { 'ui:progress': true },
      'actual_hours': { 'ui:progress': true },
    }
  },

  'app.ops_task_head': {
    tableName: 'app.ops_task_head',
    defaultBehavior: {},
    columns: {
      'title': { 'ui:search': true },
      'task_code': { 'ui:search': true },
      'assignee_id': { 'ui:assignment': true },
      'reporter_id': { 'ui:assignment': true },
      'reviewers': { 'ui:assignment': true },
      'approvers': { 'ui:assignment': true },
      'collaborators': { 'ui:assignment': true },
      'estimated_hours': { 'ui:planning': true },
      'story_points': { 'ui:planning': true },
      'planned_start_date': { 'ui:planning': true },
      'planned_end_date': { 'ui:planning': true },
      'depends_on_tasks': { 'ui:dependencies': true },
      'blocks_tasks': { 'ui:dependencies': true },
      'related_tasks': { 'ui:dependencies': true },
    }
  },

  'app.ops_task_records': {
    tableName: 'app.ops_task_records',
    defaultBehavior: {},
    columns: {
      'status_name': { 'ui:search': true },
      'stage_name': { 'ui:search': true },
      'completion_percentage': { 'ui:progress': true },
      'actual_hours': { 'ui:progress': true },
      'time_spent': { 'ui:progress': true },
      'actual_start_date': { 'ui:timeline': true },
      'actual_end_date': { 'ui:timeline': true },
      'start_ts': { 'ui:timeline': true },
      'end_ts': { 'ui:timeline': true },
      'acceptance_criteria': { 'ui:quality': true },
      'acceptance_status': { 'ui:quality': true },
      'quality_gate_status': { 'ui:quality': true },
      'work_log': { 'ui:logs': true },
      'log_content': { 'ui:logs': true },
      'attachments': { 'ui:logs': true },
    }
  },

  // Relationship tables
  'app.rel_hr_biz_loc': {
    tableName: 'app.rel_hr_biz_loc',
    defaultBehavior: {},
    columns: {
      'assignment_type': { 'ui:search': true },
      'assignment_pct': { 'ui:assignment': true },
      'effective_from': { 'ui:assignment': true },
      'effective_to': { 'ui:assignment': true },
    }
  },
};

/**
 * Get metadata for a specific table and column
 */
export function getColumnMetadata(tableName: string, columnName: string): ColumnMetadata {
  const tableMetadata = SCHEMA_METADATA[tableName];
  const defaultMetadata = SCHEMA_METADATA['$defaults'];
  
  let metadata: ColumnMetadata = {};
  
  // Apply defaults first
  if (defaultMetadata?.columns[columnName]) {
    metadata = { ...metadata, ...defaultMetadata.columns[columnName] };
  }
  
  // Check for pattern matches (e.g., *_id)
  for (const [pattern, patternMetadata] of Object.entries(defaultMetadata?.columns || {})) {
    if (pattern.includes('*') && matchesPattern(columnName, pattern)) {
      metadata = { ...metadata, ...patternMetadata };
    }
  }
  
  // Apply table-specific overrides
  if (tableMetadata?.columns[columnName]) {
    metadata = { ...metadata, ...tableMetadata.columns[columnName] };
  }
  
  return metadata;
}

/**
 * Check if a column name matches a pattern (supports * wildcard)
 */
function matchesPattern(columnName: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return columnName === pattern;
  }
  
  const regex = new RegExp(pattern.replace('*', '.*'));
  return regex.test(columnName);
}

/**
 * Get all columns that should be hidden in UI
 */
export function getInvisibleColumns(tableName: string, columns: string[]): string[] {
  return columns.filter(column => {
    const metadata = getColumnMetadata(tableName, column);
    return metadata['ui:invisible'];
  });
}

/**
 * Get all columns that require PII masking
 */
export function getPIIMaskingColumns(tableName: string, columns: string[]): string[] {
  return columns.filter(column => {
    const metadata = getColumnMetadata(tableName, column);
    return metadata['api:pii_masking'];
  });
}

/**
 * Get all columns that should be restricted in API responses
 */
export function getRestrictedColumns(tableName: string, columns: string[]): string[] {
  return columns.filter(column => {
    const metadata = getColumnMetadata(tableName, column);
    return metadata['api:restrict'];
  });
}

/**
 * Get all columns that should be included in search
 */
export function getSearchableColumns(tableName: string, columns: string[]): string[] {
  return columns.filter(column => {
    const metadata = getColumnMetadata(tableName, column);
    return metadata['ui:search'];
  });
}

/**
 * Get default sort columns
 */
export function getSortColumns(tableName: string, columns: string[]): string[] {
  return columns.filter(column => {
    const metadata = getColumnMetadata(tableName, column);
    return metadata['ui:sort'];
  });
}

/**
 * Get columns by UI category (for React components)
 */
export function getColumnsByCategory(tableName: string, columns: string[], category: keyof ColumnMetadata): string[] {
  return columns.filter(column => {
    const metadata = getColumnMetadata(tableName, column);
    return metadata[category];
  });
}

/**
 * Filter an object to remove restricted/invisible columns
 */
export function filterObjectColumns(
  tableName: string, 
  data: Record<string, any>, 
  userPermissions?: { canSeePII?: boolean; canSeeFinancial?: boolean }
): Record<string, any> {
  const filtered: Record<string, any> = {};
  
  for (const [column, value] of Object.entries(data)) {
    const metadata = getColumnMetadata(tableName, column);
    
    // Skip auth fields entirely
    if (metadata['api:auth_field']) {
      continue;
    }
    
    // Skip restricted columns in regular responses
    if (metadata['api:restrict']) {
      continue;
    }
    
    // Handle PII masking
    if (metadata['api:pii_masking'] && !userPermissions?.canSeePII) {
      filtered[column] = maskValue(value, column);
      continue;
    }
    
    // Handle financial masking
    if (metadata['api:financial_masking'] && !userPermissions?.canSeeFinancial) {
      filtered[column] = maskValue(value, column, 'financial');
      continue;
    }
    
    filtered[column] = value;
  }
  
  return filtered;
}

/**
 * Mask a value based on its type
 */
function maskValue(value: any, columnName: string, type: 'pii' | 'financial' = 'pii'): any {
  if (value === null || value === undefined) {
    return value;
  }
  
  if (type === 'financial') {
    return typeof value === 'number' ? '***' : '[RESTRICTED]';
  }
  
  // PII masking
  if (columnName.includes('email') && typeof value === 'string') {
    return value.replace(/(.{2}).+@(.+)/, '$1***@$2');
  }
  
  if (columnName.includes('phone') && typeof value === 'string') {
    return value.replace(/(.{3}).+(.{4})/, '$1-***-$2');
  }
  
  if (typeof value === 'string' && value.length > 4) {
    return value.substring(0, 2) + '***' + value.substring(value.length - 2);
  }
  
  return '[MASKED]';
}

/**
 * Generate TypeScript schema based on table metadata
 */
export function generateTypeScriptSchema(tableName: string, columns: Record<string, any>): string {
  const metadata = SCHEMA_METADATA[tableName];
  const schemaName = tableName.split('.').pop()?.replace(/^./, c => c.toUpperCase()) + 'Schema';
  
  let schema = `const ${schemaName} = Type.Object({\n`;
  
  for (const [column, example] of Object.entries(columns)) {
    const columnMetadata = getColumnMetadata(tableName, column);
    const isOptional = !['id', 'name'].includes(column);
    const tsType = inferTypeScriptType(example, columnMetadata);
    
    schema += `  ${column}: ${isOptional ? 'Type.Optional(' : ''}${tsType}${isOptional ? ')' : ''},\n`;
  }
  
  schema += '});\n';
  return schema;
}

/**
 * Infer TypeScript type from example value and metadata
 */
function inferTypeScriptType(example: any, metadata: ColumnMetadata): string {
  if (metadata['ui:geographic']) return 'Type.Any()'; // PostGIS geometry
  if (metadata['flexible']) return 'Type.Object({})'; // JSONB
  if (metadata['ui:stakeholders']) return 'Type.Array(Type.String())'; // UUID arrays
  if (metadata['ui:timeline'] && typeof example === 'string') return 'Type.String({ format: "date-time" })';
  
  switch (typeof example) {
    case 'string':
      if (example.match(/^\d{4}-\d{2}-\d{2}$/)) return 'Type.String({ format: "date" })';
      if (example.includes('@')) return 'Type.String({ format: "email" })';
      if (example.match(/^[0-9a-f-]{36}$/i)) return 'Type.String({ format: "uuid" })';
      return 'Type.String()';
    case 'number':
      return Number.isInteger(example) ? 'Type.Number()' : 'Type.Number()';
    case 'boolean':
      return 'Type.Boolean()';
    case 'object':
      if (Array.isArray(example)) return 'Type.Array(Type.Any())';
      return 'Type.Object({})';
    default:
      return 'Type.Any()';
  }
}

/**
 * Get UI component props based on column metadata
 */
export function getUIComponentProps(tableName: string, columnName: string): Record<string, any> {
  const metadata = getColumnMetadata(tableName, columnName);
  const props: Record<string, any> = {};
  
  if (metadata['ui:invisible']) props.hidden = true;
  if (metadata['ui:search']) props.searchable = true;
  if (metadata['ui:sort']) props.sortable = true;
  if (metadata['ui:color_field']) props.colorField = true;
  if (metadata['ui:geographic']) props.mapField = true;
  if (metadata['ui:hierarchy']) props.treeField = true;
  if (metadata['ui:timeline']) props.timelineField = true;
  if (metadata['ui:progress']) props.progressField = true;
  if (metadata['flexible']) props.jsonField = true;
  
  return props;
}