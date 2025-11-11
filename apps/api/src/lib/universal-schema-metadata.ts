/**
 * Universal Schema Metadata System
 * 
 * This system automatically classifies columns based on naming conventions
 * rather than requiring table-specific metadata. It analyzes column names
 * and applies appropriate behaviors for API restrictions, UI rendering,
 * and permission handling.
 * 
 * Based on comprehensive analysis of all DDL files in the PMO system.
 */

export interface ColumnMetadata {
  // API Restrictions
  'api:restrict'?: boolean;          // Hide in write paths, expose via audit endpoints
  'api:pii_masking'?: boolean;       // Mask unless user owns record or has clearance
  'api:financial_masking'?: boolean; // Restrict financial data based on authorization
  'api:auth_field'?: boolean;        // Authentication field - never expose
  'api:safety_info'?: boolean;       // Safety protocols - controlled access
  'api:system_field'?: boolean;      // System-managed field - read only
  
  // UI Visibility & Behavior
  'ui:invisible'?: boolean;          // Hide by default, use for joins/references
  'ui:search'?: boolean;             // Include in search functionality
  'ui:sort'?: boolean;               // Default sort field
  'ui:readonly'?: boolean;           // Display only, not editable
  
  // UI Field Types
  'ui:color_field'?: boolean;        // Contains color codes for styling
  'ui:geographic'?: boolean;         // PostGIS geometry field
  'ui:timezone'?: boolean;           // Timezone information
  'ui:currency'?: boolean;           // Currency code
  'ui:hierarchy'?: boolean;          // Self-referencing parent field
  'ui:multiselect'?: boolean;        // Multi-select dropdown
  'ui:textarea'?: boolean;           // Multi-line text input
  'ui:date'?: boolean;               // Date picker
  'ui:datetime'?: boolean;           // Date-time picker
  'ui:email'?: boolean;              // Email input with validation
  'ui:phone'?: boolean;              // Phone input with formatting
  'ui:url'?: boolean;                // URL input with validation
  'ui:number'?: boolean;             // Numeric input
  'ui:percentage'?: boolean;         // Percentage input (0-100)
  'ui:rating'?: boolean;             // Rating/star input
  'ui:toggle'?: boolean;             // Boolean toggle switch
  'ui:json'?: boolean;               // JSON editor
  'ui:code'?: boolean;               // Code input with highlighting
  'ui:file'?: boolean;               // File upload
  'ui:image'?: boolean;              // Image upload
  'ui:rich_text'?: boolean;          // Rich text editor
  
  // UI Display Modes
  'ui:badge'?: boolean;              // Display as badge/pill
  'ui:progress'?: boolean;           // Progress bar
  'ui:avatar'?: boolean;             // User avatar
  'ui:timeline'?: boolean;           // Timeline/date display
  'ui:stakeholders'?: boolean;       // User/stakeholder list
  'ui:tags'?: boolean;               // Tag/chip display
  'ui:status'?: boolean;             // Status indicator
  'ui:priority'?: boolean;           // Priority indicator
  
  // Special Behaviors
  'flexible'?: boolean;              // JSON data - treat as key-value
  'audit'?: boolean;                 // Audit trail field
  'hierarchy'?: boolean;             // Part of hierarchical structure
  'permission'?: boolean;            // Permission-related field
  'financial'?: boolean;             // Financial/budget data
  'contact'?: boolean;               // Contact information
  'location'?: boolean;              // Geographic/location data
  'identity'?: boolean;              // Identity/authentication data
  'temporal'?: boolean;              // Time-based data
  'classification'?: boolean;        // Category/type classification
  'workflow'?: boolean;              // Workflow state
  'performance'?: boolean;           // Performance/metrics data
}

/**
 * Universal column classification based on naming patterns
 * Analyzed from comprehensive DDL file review
 */
const UNIVERSAL_COLUMN_PATTERNS: Record<string, ColumnMetadata> = {
  // =================================================================
  // PRIMARY IDENTIFIERS
  // =================================================================
  'id': { 
    'ui:invisible': true, 
    'api:system_field': true 
  },
  
  // =================================================================
  // STANDARD AUDIT FIELDS (SCD Type 2)
  // =================================================================
  'name': { 
    'ui:search': true, 
    'ui:sort': true 
  },
  'descr': { 
    'ui:search': true, 
    'ui:textarea': true 
  },
  'tags': { 
    'flexible': true, 
    'ui:tags': true, 
    'ui:json': true 
  },
  'attr': { 
    'flexible': true, 
    'ui:json': true 
  },
  'from_ts': { 
    'api:restrict': true, 
    'audit': true, 
    'temporal': true, 
    'ui:datetime': true 
  },
  'to_ts': { 
    'api:restrict': true, 
    'audit': true, 
    'temporal': true, 
    'ui:datetime': true 
  },
  'active_flag': {
    'api:restrict': true,
    'ui:toggle': true,
    'ui:status': true
  },
  'created_ts': {
    'api:restrict': true,
    'audit': true,
    'temporal': true,
    'ui:datetime': true,
    'ui:readonly': true
  },
  'updated_ts': {
    'api:restrict': true,
    'audit': true,
    'temporal': true,
    'ui:datetime': true,
    'ui:readonly': true
  },

  // =================================================================
  // FOREIGN KEY PATTERNS
  // =================================================================
  // Pattern: *_id fields
  'parent_id': { 
    'ui:hierarchy': true, 
    'hierarchy': true, 
    'ui:invisible': true 
  },
  'level_id': { 
    'ui:invisible': true, 
    'hierarchy': true 
  },
  'tenant_id': { 
    'ui:invisible': true, 
    'api:system_field': true 
  },

  // =================================================================
  // CONTACT INFORMATION
  // =================================================================
  'email': { 
    'api:pii_masking': true, 
    'ui:search': true, 
    'ui:email': true, 
    'contact': true, 
    'identity': true 
  },
  'phone': { 
    'api:pii_masking': true, 
    'ui:phone': true, 
    'contact': true 
  },
  'mobile': { 
    'api:pii_masking': true, 
    'ui:phone': true, 
    'contact': true 
  },
  'addr': { 
    'api:pii_masking': true, 
    'ui:textarea': true, 
    'contact': true, 
    'location': true 
  },
  'postal_code': { 
    'api:pii_masking': true, 
    'ui:search': true, 
    'location': true 
  },

  // =================================================================
  // AUTHENTICATION & SECURITY
  // =================================================================
  'password_hash': { 
    'api:auth_field': true, 
    'identity': true 
  },
  'security_clearance': { 
    'api:pii_masking': true, 
    'classification': true, 
    'ui:badge': true 
  },
  'security_level': { 
    'api:safety_info': true, 
    'classification': true, 
    'ui:badge': true 
  },
  'security_classification': { 
    'api:safety_info': true, 
    'classification': true, 
    'ui:badge': true 
  },

  // =================================================================
  // FINANCIAL DATA
  // =================================================================
  'budget_allocated_amt': { 
    'api:financial_masking': true, 
    'financial': true, 
    'ui:number': true 
  },
  'budget_currency': { 
    'ui:currency': true, 
    'financial': true 
  },
  'approval_limit': { 
    'api:financial_masking': true, 
    'financial': true, 
    'ui:number': true 
  },
  'salary_band_min': { 
    'api:pii_masking': true, 
    'financial': true, 
    'ui:number': true 
  },
  'salary_band_max': { 
    'api:pii_masking': true, 
    'financial': true, 
    'ui:number': true 
  },
  'bonus_target_pct': { 
    'api:pii_masking': true, 
    'financial': true, 
    'ui:percentage': true 
  },
  'fte_allocation': { 
    'financial': true, 
    'ui:number': true 
  },

  // =================================================================
  // GEOGRAPHIC & LOCATION
  // =================================================================
  'geom': { 
    'ui:geographic': true, 
    'location': true 
  },
  'time_zone': { 
    'ui:timezone': true, 
    'location': true 
  },
  'timezone': { 
    'ui:timezone': true, 
    'location': true 
  },
  'country_code': { 
    'location': true, 
    'ui:badge': true 
  },
  'province_code': { 
    'location': true, 
    'ui:badge': true 
  },
  'currency_code': { 
    'ui:currency': true, 
    'location': true 
  },
  'language_primary': { 
    'location': true, 
    'ui:badge': true 
  },
  'language_secondary': { 
    'location': true, 
    'ui:badge': true 
  },

  // =================================================================
  // PROJECT & TASK MANAGEMENT
  // =================================================================
  'estimated_hours': { 
    'performance': true, 
    'ui:number': true 
  },
  'actual_hours': { 
    'performance': true, 
    'ui:number': true 
  },
  'story_points': { 
    'performance': true, 
    'ui:number': true, 
    'ui:rating': true 
  },
  'completion_percentage': { 
    'performance': true, 
    'ui:percentage': true, 
    'ui:progress': true 
  },
  'time_spent': { 
    'performance': true, 
    'ui:number': true 
  },
  'project_managers': { 
    'ui:stakeholders': true, 
    'ui:multiselect': true 
  },
  'project_sponsors': { 
    'ui:stakeholders': true, 
    'ui:multiselect': true 
  },
  'project_leads': { 
    'ui:stakeholders': true, 
    'ui:multiselect': true 
  },
  'approvers': { 
    'ui:stakeholders': true, 
    'ui:multiselect': true, 
    'workflow': true 
  },
  'reviewers': { 
    'ui:stakeholders': true, 
    'ui:multiselect': true, 
    'workflow': true 
  },
  'collaborators': { 
    'ui:stakeholders': true, 
    'ui:multiselect': true 
  },
  'watchers': { 
    'ui:stakeholders': true, 
    'ui:multiselect': true 
  },
  'clients': { 
    'ui:stakeholders': true, 
    'ui:multiselect': true 
  },

  // =================================================================
  // STATUS & WORKFLOW
  // =================================================================
  'status': { 
    'workflow': true, 
    'ui:status': true, 
    'ui:badge': true 
  },
  'project_status': { 
    'workflow': true, 
    'ui:status': true, 
    'ui:badge': true, 
    'ui:color_field': true 
  },
  'operational_status': { 
    'workflow': true, 
    'ui:status': true, 
    'ui:badge': true 
  },
  'employment_status': { 
    'workflow': true, 
    'ui:status': true, 
    'ui:badge': true 
  },
  'acceptance_status': { 
    'workflow': true, 
    'ui:status': true, 
    'ui:badge': true 
  },
  'quality_gate_status': { 
    'workflow': true, 
    'ui:status': true, 
    'ui:badge': true 
  },

  // =================================================================
  // PRIORITY & CLASSIFICATION
  // =================================================================
  'priority': { 
    'classification': true, 
    'ui:priority': true, 
    'ui:badge': true, 
    'ui:color_field': true 
  },
  'priority_level': { 
    'classification': true, 
    'ui:priority': true, 
    'ui:badge': true, 
    'ui:color_field': true 
  },

  // =================================================================
  // EMERGENCY & SAFETY
  // =================================================================
  'emergency_contact': { 
    'api:pii_masking': true, 
    'contact': true, 
    'ui:json': true 
  },
  'emergency_contacts': { 
    'api:pii_masking': true, 
    'contact': true, 
    'ui:json': true 
  },
  'safety_protocols': { 
    'api:safety_info': true, 
    'ui:json': true 
  },

  // =================================================================
  // COMPLIANCE & GOVERNANCE
  // =================================================================
  'compliance_requirements': { 
    'classification': true, 
    'ui:json': true, 
    'ui:tags': true 
  },
  'risk_assessment': { 
    'classification': true, 
    'ui:json': true 
  },
  'regulatory_region': { 
    'classification': true, 
    'location': true, 
    'ui:badge': true 
  },
  'tax_jurisdiction': { 
    'financial': true, 
    'location': true, 
    'ui:json': true 
  },

  // =================================================================
  // PERSONAL INFORMATION
  // =================================================================
  'birth_date': { 
    'api:pii_masking': true, 
    'temporal': true, 
    'ui:date': true, 
    'identity': true 
  },
  'hire_date': { 
    'temporal': true, 
    'ui:date': true, 
    'ui:timeline': true 
  },
  'skills': { 
    'flexible': true, 
    'ui:json': true, 
    'ui:tags': true 
  },
  'certifications': { 
    'flexible': true, 
    'ui:json': true, 
    'ui:tags': true 
  },
  'education': { 
    'flexible': true, 
    'ui:json': true 
  },
  'labels': { 
    'flexible': true, 
    'ui:tags': true, 
    'ui:json': true 
  },

  // =================================================================
  // OPERATIONAL HOURS & ACCESS
  // =================================================================
  'access_hours': { 
    'ui:json': true, 
    'location': true 
  },

  // =================================================================
  // FORM & DYNAMIC DATA
  // =================================================================
  'schema': { 
    'api:system_field': true, 
    'ui:json': true, 
    'ui:code': true 
  },
  'data': { 
    'flexible': true, 
    'ui:json': true 
  },
  'props_schema': { 
    'api:system_field': true, 
    'ui:json': true, 
    'ui:code': true 
  },

  // =================================================================
  // SPECIAL FIELDS
  // =================================================================
  'slug': { 
    'ui:search': true, 
    'ui:code': true 
  },
  'version': { 
    'api:system_field': true, 
    'ui:readonly': true, 
    'ui:number': true 
  },
  'sort_order': { 
    'ui:sort': true, 
    'ui:number': true 
  },
  'sort_id': { 
    'ui:sort': true, 
    'ui:number': true 
  },
  'wip_limit': { 
    'workflow': true, 
    'ui:number': true 
  },
  'milestones': { 
    'flexible': true, 
    'ui:json': true, 
    'ui:timeline': true 
  },
  'deliverables': { 
    'flexible': true, 
    'ui:json': true 
  },
};

/**
 * Pattern-based classification rules
 * These rules match column name patterns and apply metadata
 */
const PATTERN_RULES: Array<{
  pattern: RegExp;
  metadata: ColumnMetadata;
}> = [
  // ID patterns
  { pattern: /_id$/, metadata: { 'ui:invisible': true } },
  { pattern: /^.*_id$/, metadata: { 'ui:invisible': true } },
  
  // Date/time patterns  
  { pattern: /_date$/, metadata: { 'temporal': true, 'ui:date': true } },
  { pattern: /_ts$/, metadata: { 'temporal': true, 'ui:datetime': true } },
  { pattern: /^(start|end|planned|actual)_.*_date$/, metadata: { 'ui:timeline': true } },
  
  // Code patterns
  { pattern: /_code$/, metadata: { 'ui:search': true, 'ui:badge': true, 'classification': true } },
  
  // Status patterns
  { pattern: /_status$/, metadata: { 'workflow': true, 'ui:status': true, 'ui:badge': true, 'ui:color_field': true } },
  
  // Type patterns
  { pattern: /_type$/, metadata: { 'classification': true, 'ui:badge': true } },
  
  // Boolean flag patterns
  { pattern: /^is_/, metadata: { 'ui:toggle': true } },
  { pattern: /^has_/, metadata: { 'ui:toggle': true } },
  { pattern: /^can_/, metadata: { 'ui:toggle': true, 'permission': true } },
  { pattern: /_allowed$/, metadata: { 'ui:toggle': true, 'permission': true } },
  { pattern: /_enabled$/, metadata: { 'ui:toggle': true } },
  { pattern: /_required$/, metadata: { 'ui:toggle': true } },
  
  // Percentage patterns
  { pattern: /_pct$/, metadata: { 'ui:percentage': true } },
  { pattern: /_percentage$/, metadata: { 'ui:percentage': true, 'ui:progress': true } },
  
  // Financial patterns
  { pattern: /^(budget|salary|amount|amt|cost|price|fee)/, metadata: { 'financial': true, 'api:financial_masking': true, 'ui:number': true } },
  { pattern: /_(amount|amt)$/, metadata: { 'financial': true, 'api:financial_masking': true, 'ui:number': true } },
  
  // Permission patterns
  { pattern: /_permission/, metadata: { 'permission': true, 'ui:json': true } },
  { pattern: /permission_/, metadata: { 'permission': true, 'ui:json': true } },
  
  // Array patterns (stakeholders, multi-select)
  { pattern: /^(managers|sponsors|leads|approvers|reviewers|collaborators|watchers|clients|locations|worksites)$/, 
    metadata: { 'ui:stakeholders': true, 'ui:multiselect': true } },
  
  // Performance/metrics patterns
  { pattern: /^(estimated|actual)_/, metadata: { 'performance': true, 'ui:number': true } },
  { pattern: /_hours$/, metadata: { 'performance': true, 'ui:number': true } },
  { pattern: /_count$/, metadata: { 'performance': true, 'ui:number': true, 'ui:readonly': true } },
  { pattern: /_points$/, metadata: { 'performance': true, 'ui:number': true } },
  
  // Contact patterns
  { pattern: /^(phone|mobile|email|contact)/, metadata: { 'contact': true, 'api:pii_masking': true } },
  
  // Geographic patterns
  { pattern: /^(country|province|region|city|location)/, metadata: { 'location': true } },
  { pattern: /_(country|province|region|city|location)/, metadata: { 'location': true } },
  
  // Workflow patterns
  { pattern: /^(depends_on|blocks|related)_/, metadata: { 'workflow': true, 'ui:multiselect': true } },
  
  // Log/audit patterns
  { pattern: /^log_/, metadata: { 'audit': true, 'flexible': true } },
  { pattern: /_log$/, metadata: { 'audit': true, 'flexible': true, 'ui:json': true } },
  
  // Hierarchy patterns
  { pattern: /^parent_/, metadata: { 'hierarchy': true, 'ui:hierarchy': true, 'ui:invisible': true } },
  { pattern: /_parent/, metadata: { 'hierarchy': true, 'ui:hierarchy': true, 'ui:invisible': true } },
  
  // Title/name patterns
  { pattern: /^(title|name)$/, metadata: { 'ui:search': true, 'ui:sort': true } },
  { pattern: /_(title|name)$/, metadata: { 'ui:search': true } },
  
  // Description patterns
  { pattern: /^(descr|description)/, metadata: { 'ui:search': true, 'ui:textarea': true } },
  { pattern: /_(descr|description)/, metadata: { 'ui:textarea': true } },
  
  // JSON/flexible patterns
  { pattern: /^(tags|attr|metadata|config|settings|options)/, metadata: { 'flexible': true, 'ui:json': true } },
];

/**
 * Get metadata for a column based on universal patterns
 */
export function getUniversalColumnMetadata(columnName: string): ColumnMetadata {
  // Start with exact match
  const baseMetadata = UNIVERSAL_COLUMN_PATTERNS[columnName];
  // Avoid spreading undefined when no base metadata exists for the column
  let metadata: ColumnMetadata = baseMetadata ? { ...baseMetadata } : {};
  
  // Apply pattern-based rules
  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(columnName)) {
      metadata = { ...metadata, ...rule.metadata };
    }
  }
  
  return metadata;
}

/**
 * Get all columns with a specific metadata property
 */
export function getColumnsByMetadata(
  columns: string[], 
  metadataKey: keyof ColumnMetadata
): string[] {
  return columns.filter(column => {
    const metadata = getUniversalColumnMetadata(column);
    return metadata[metadataKey];
  });
}

/**
 * Filter object columns based on universal metadata and user permissions
 * Default behavior: Include all columns (opt-out), only exclude/mask specific ones
 */
export function filterUniversalColumns(
  data: Record<string, any>,
  userPermissions: {
    canSeePII?: boolean;
    canSeeFinancial?: boolean;
    canSeeSystemFields?: boolean;
    canSeeSafetyInfo?: boolean;
  } = {}
): Record<string, any> {
  const filtered: Record<string, any> = {};

  for (const [column, value] of Object.entries(data)) {
    const metadata = getUniversalColumnMetadata(column);

    // Skip auth fields entirely (password_hash, etc.)
    if (metadata['api:auth_field']) {
      continue;
    }

    // Skip system fields unless permitted
    if (metadata['api:system_field'] && !userPermissions.canSeeSystemFields) {
      continue;
    }

    // Handle PII masking
    if (metadata['api:pii_masking'] && !userPermissions.canSeePII) {
      filtered[column] = maskValue(value, column, 'pii');
      continue;
    }

    // Handle financial masking
    if (metadata['api:financial_masking'] && !userPermissions.canSeeFinancial) {
      filtered[column] = maskValue(value, column, 'financial');
      continue;
    }

    // Handle safety info restriction
    if (metadata['api:safety_info'] && !userPermissions.canSeeSafetyInfo) {
      filtered[column] = '[RESTRICTED]';
      continue;
    }

    // Include all other columns by default (opt-out behavior)
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
 * Get component props for a column based on universal metadata
 */
export function getUniversalComponentProps(columnName: string): Record<string, any> {
  const metadata = getUniversalColumnMetadata(columnName);
  const props: Record<string, any> = {};
  
  // Visibility
  if (metadata['ui:invisible']) props.hidden = true;
  if (metadata['ui:readonly']) props.readOnly = true;
  
  // Input types
  if (metadata['ui:email']) props.type = 'email';
  if (metadata['ui:phone']) props.type = 'tel';
  if (metadata['ui:url']) props.type = 'url';
  if (metadata['ui:number']) props.type = 'number';
  if (metadata['ui:date']) props.type = 'date';
  if (metadata['ui:datetime']) props.type = 'datetime-local';
  if (metadata['ui:textarea']) props.multiline = true;
  if (metadata['ui:toggle']) props.type = 'checkbox';
  if (metadata['ui:json']) props.jsonEditor = true;
  if (metadata['ui:code']) props.codeEditor = true;
  if (metadata['ui:percentage']) { props.type = 'number'; props.min = 0; props.max = 100; }
  
  // Display modes
  if (metadata['ui:badge']) props.displayAs = 'badge';
  if (metadata['ui:progress']) props.displayAs = 'progress';
  if (metadata['ui:avatar']) props.displayAs = 'avatar';
  if (metadata['ui:tags']) props.displayAs = 'tags';
  if (metadata['ui:status']) props.statusField = true;
  if (metadata['ui:priority']) props.priorityField = true;
  if (metadata['ui:color_field']) props.colorField = true;
  
  // Special behaviors
  if (metadata['ui:search']) props.searchable = true;
  if (metadata['ui:sort']) props.sortable = true;
  if (metadata['ui:hierarchy']) props.hierarchical = true;
  if (metadata['ui:multiselect']) props.multiSelect = true;
  if (metadata['ui:stakeholders']) props.stakeholderField = true;
  if (metadata['ui:timeline']) props.timelineField = true;
  if (metadata['ui:geographic']) props.mapField = true;
  
  // Categories for grouping
  if (metadata['financial']) props.category = 'financial';
  if (metadata['contact']) props.category = 'contact';
  if (metadata['location']) props.category = 'location';
  if (metadata['identity']) props.category = 'identity';
  if (metadata['workflow']) props.category = 'workflow';
  if (metadata['performance']) props.category = 'performance';
  if (metadata['audit']) props.category = 'audit';
  
  return props;
}

/**
 * System columns that should be hidden from data table responses
 * These are infrastructure/audit fields that users don't need to see
 */
const SYSTEM_COLUMNS = new Set([
  'id',           // Primary key
  'from_ts',      // SCD Type 2 start timestamp
  'to_ts',        // SCD Type 2 end timestamp
  'active_flag',  // SCD Type 2 active flag
  'created_ts',   // Creation timestamp
  'updated_ts',   // Update timestamp
  'version'       // Optimistic locking version
]);

/**
 * Filter system columns from data table responses
 * Removes infrastructure/audit fields that users don't need to see
 *
 * @param data - Single object or array of objects to filter
 * @returns Filtered data with system columns removed
 */
export function filterSystemColumns<T extends Record<string, any>>(
  data: T | T[]
): T | T[] {
  const filterObject = (obj: T): T => {
    const filtered = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      if (!SYSTEM_COLUMNS.has(key)) {
        filtered[key as keyof T] = value;
      }
    }
    return filtered;
  };

  if (Array.isArray(data)) {
    return data.map(item => filterObject(item));
  }

  return filterObject(data);
}

/**
 * Helper function to create a filtered paginated response
 * DRY pattern for all entity list endpoints
 *
 * @param data - Array of entity records from database
 * @param total - Total count of records
 * @param limit - Number of records per page
 * @param offset - Offset for pagination
 * @returns Paginated response with system columns filtered
 */
export function createFilteredPaginatedResponse<T extends Record<string, any>>(
  data: T[],
  total: number,
  limit: number,
  offset: number
) {
  return {
    data: filterSystemColumns(data) as T[],
    total,
    limit,
    offset,
  };
}

export default {
  getUniversalColumnMetadata,
  getColumnsByMetadata,
  filterUniversalColumns,
  filterSystemColumns,
  createFilteredPaginatedResponse,
  getUniversalComponentProps,
  UNIVERSAL_COLUMN_PATTERNS,
  PATTERN_RULES
};
