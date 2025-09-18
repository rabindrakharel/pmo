// ============================================================================
// ENTITY CONFIGURATION TYPES
// ============================================================================
//
// TypeScript types for the comprehensive entity configuration system.
// These types define the structure for modular entity configs that include
// database mapping, API configuration, UI behavior, and business logic.

// ============================================================================
// BASIC TYPES
// ============================================================================

export type DataType = 
  | 'uuid' | 'string' | 'text' | 'number' | 'boolean' | 'date' | 'datetime' 
  | 'array' | 'json' | 'email' | 'phone' | 'currency' | 'percentage' | 'geometry';

export type InputType = 
  | 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'datetime' 
  | 'select' | 'multiselect' | 'relationship' | 'tags' | 'json' | 'currency'
  | 'email' | 'phone' | 'checkbox' | 'radio' | 'file' | 'coordinates' | 'hidden';

export type RenderType = 
  | 'text' | 'badge' | 'currency' | 'date' | 'datetime' | 'hours' | 'percentage' 
  | 'link' | 'image' | 'json' | 'tags' | 'boolean' | 'progress';

export type ViewMode = 'table' | 'grid' | 'tree' | 'kanban';

export type ActionStyle = 'primary' | 'secondary' | 'danger' | 'warning' | 'success';

export type PermissionType = 'create' | 'read' | 'update' | 'delete' | 'export' | 'share';

export type AlignType = 'left' | 'center' | 'right';

// ============================================================================
// FIELD CONFIGURATION
// ============================================================================

export interface FieldOption {
  value: any;
  label: string;
  color?: string;
  icon?: string;
  disabled?: boolean;
}

export interface ValidationConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp | string;
  unique?: boolean;
  custom?: (value: any) => string | null; // Custom validation function
}

export interface FieldRelationshipConfig {
  entity: string;
  endpoint: string;
  displayField: string;
  valueField: string;
  allowEmpty?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  filters?: Record<string, any>;
  cascade?: boolean;
}

export interface UIBehavior {
  sort: boolean;
  filter: boolean;
  visible: boolean;
  searchable?: boolean;
  width?: string | number;
  priority?: number; // Higher priority fields shown first
  align?: AlignType;
  renderAs?: RenderType;
  className?: string;
  responsive?: {
    xs?: boolean; // Show on extra small screens
    sm?: boolean; // Show on small screens
    md?: boolean; // Show on medium screens
    lg?: boolean; // Show on large screens
  };
}

export interface FieldConfig {
  // Database and API mapping
  ddlField: string;
  apiField: string;
  dataType: DataType;
  inputType: InputType;
  
  // Display configuration
  label: string;
  placeholder?: string;
  description?: string;
  icon?: string;
  
  // Behavior configuration
  required?: boolean;
  generated?: boolean;
  hidden?: boolean;
  readonly?: boolean;
  pii?: boolean; // Personally Identifiable Information
  
  // Validation
  validation?: ValidationConfig;
  
  // Default values
  defaultValue?: any;
  
  // Options for select/radio inputs
  options?: FieldOption[];
  
  // Relationship configuration
  relationshipConfig?: FieldRelationshipConfig;
  
  // Array/JSON configuration
  itemType?: DataType;
  arrayConfig?: {
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
  };
  
  // UI behavior
  uiBehavior: UIBehavior;
  
  // Conditional display
  showWhen?: {
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in';
    value: any;
  };
}

// ============================================================================
// SCHEMA AND API CONFIGURATION
// ============================================================================

export interface SchemaConfig {
  schemaName: string;
  tableName: string;
  primaryKey: string;
  softDelete?: boolean;
  timestamps?: boolean;
  versioning?: boolean; // SCD Type 2
}

export interface EndpointConfig {
  list: string;
  get: string;
  create: string;
  update: string;
  delete: string;
  [key: string]: string; // Additional custom endpoints
}

export interface APIConfig {
  baseEndpoint: string;
  endpoints: EndpointConfig;
  defaultLimit?: number;
  maxLimit?: number;
  enablePagination?: boolean;
  enableSearch?: boolean;
  enableFilters?: boolean;
  enableSorting?: boolean;
}

// ============================================================================
// UI CONFIGURATION
// ============================================================================

export interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
}

export interface LayoutConfig {
  defaultView: ViewMode;
  enableMultiView?: boolean;
  showSummaryCards?: boolean;
  enableQuickActions?: boolean;
  enableBulkActions?: boolean;
}

export interface TableConfig {
  defaultPageSize: number;
  pageSizeOptions?: number[];
  enableSearch: boolean;
  enableFilters: boolean;
  enableSorting: boolean;
  enableExport: boolean;
  stickyHeader?: boolean;
  rowActions: string[];
  enableRowSelection?: boolean;
  enableColumnReorder?: boolean;
  enableColumnResize?: boolean;
}

export interface SummaryCard {
  title: string;
  value: 'count' | 'sum' | 'avg' | 'percentage' | 'custom';
  field?: string;
  filter?: Record<string, any>;
  numerator?: Record<string, any>; // For percentage calculations
  denominator?: 'total' | Record<string, any>; // For percentage calculations
  icon: string;
  color: string;
  customCalculation?: (data: any[]) => number;
}

export interface UIConfig {
  sidebarIcon: string;
  theme: ThemeConfig;
  layout: LayoutConfig;
  table: TableConfig;
  summaryCards?: SummaryCard[];
  quickFilters?: Array<{
    label: string;
    field: string;
    value: any;
    icon?: string;
  }>;
}

// ============================================================================
// FORM CONFIGURATION
// ============================================================================

export interface FormSection {
  title: string;
  description?: string;
  fields: string[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  showWhen?: {
    field: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in';
    value: any;
  };
}

export interface FormConfig {
  title: string;
  description?: string;
  sections: FormSection[];
  submitText?: string;
  cancelText?: string;
  readonly?: boolean;
  enableDrafts?: boolean;
  autoSave?: boolean;
  validateOnChange?: boolean;
}

export interface FormsConfig {
  create: FormConfig;
  edit: FormConfig;
  view: FormConfig;
  [key: string]: FormConfig; // Additional custom forms
}

// ============================================================================
// PERMISSIONS AND RELATIONSHIPS
// ============================================================================

export interface EntityRelationshipConfig {
  entity: string;
  field: string;
  foreignKey: string;
  displayName: string;
  displayField: string;
  valueField: string;
  endpoint?: string;
  cascade?: boolean;
}

export interface RelationshipsConfig {
  belongsTo?: EntityRelationshipConfig[];
  hasMany?: EntityRelationshipConfig[];
  hasOne?: EntityRelationshipConfig[];
  manyToMany?: Array<EntityRelationshipConfig & {
    pivotTable: string;
    pivotForeignKey: string;
    pivotRelatedForeignKey: string;
  }>;
}

export interface PermissionsConfig {
  create: string[];
  read: string[];
  update: string[];
  delete: string[];
  export?: string[];
  share?: string[];
  [key: string]: string[] | undefined; // Additional custom permissions
}

// ============================================================================
// NAVIGATION AND ACTIONS
// ============================================================================

export interface Breadcrumb {
  label: string;
  path: string;
  dynamic?: boolean; // If path contains parameters like :id
}

export interface Tab {
  key: string;
  label: string;
  icon: string;
  count?: boolean; // Show count badge
  endpoint?: string; // Custom endpoint for tab data
  component?: string; // Custom component name
  permissions?: string[];
}

export interface NavigationConfig {
  breadcrumbs: Breadcrumb[];
  tabs?: Tab[];
  sidebar?: {
    order: number;
    group?: string;
    badge?: string;
  };
}

export interface ActionConfig {
  key: string;
  label: string;
  icon: string;
  action: 'create' | 'edit' | 'view' | 'delete' | 'export' | 'share' | 'navigate' | 'custom' | 'bulk_delete' | 'bulk_export';
  path?: string; // For navigate actions
  permissions: string[];
  style: ActionStyle;
  confirmRequired?: boolean;
  confirmMessage?: string;
  disabled?: (record: any) => boolean;
  visible?: (record: any) => boolean;
  customHandler?: string; // Name of custom handler function
}

export interface ActionsConfig {
  primary?: ActionConfig[];
  row: ActionConfig[];
  bulk?: ActionConfig[];
  custom?: Record<string, ActionConfig>;
}

// ============================================================================
// MAIN ENTITY PAGE CONFIGURATION
// ============================================================================

export interface EntityPageConfig {
  // Basic entity metadata
  entityName: string;
  displayName: string;
  displayNamePlural: string;
  description: string;
  
  // Database configuration
  schema: SchemaConfig;
  
  // API configuration
  api: APIConfig;
  
  // UI configuration
  ui: UIConfig;
  
  // Field definitions
  fields: Record<string, FieldConfig>;
  
  // Form configurations
  forms: FormsConfig;
  
  // Permissions
  permissions: PermissionsConfig;
  
  // Relationships
  relationships?: RelationshipsConfig;
  
  // Navigation
  navigation: NavigationConfig;
  
  // Actions
  actions: ActionsConfig;
  
  // Business logic hooks (optional)
  hooks?: {
    beforeCreate?: string;
    afterCreate?: string;
    beforeUpdate?: string;
    afterUpdate?: string;
    beforeDelete?: string;
    afterDelete?: string;
    [key: string]: string | undefined;
  };
  
  // Custom configurations
  custom?: Record<string, any>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface EntityConfigRegistry {
  [entityName: string]: EntityPageConfig;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigContext {
  user: {
    id: string;
    roles: string[];
    permissions: string[];
  };
  tenant?: {
    id: string;
    settings: Record<string, any>;
  };
  environment: 'development' | 'staging' | 'production';
}

// ============================================================================
// SIMPLIFIED ENTITY CONFIG (for meta configurations)
// ============================================================================

export interface EntityConfig {
  entityType: string;
  displayName: string;
  displayNamePlural: string;
  description: string;

  api: {
    endpoints: {
      list: string;
      create: string;
      read: string;
      update: string;
      delete: string;
    };
  };

  fields: Record<string, {
    apiField: string;
    label: string;
    uiBehavior: {
      visible: boolean;
      priority?: number;
      sort?: boolean;
      filter?: boolean;
      width?: number | string;
      renderAs?: string;
    };
  }>;

  ui: {
    sidebarIcon: string;
    table: {
      enableSearch: boolean;
      enableFilters: boolean;
      defaultPageSize: number;
    };
  };

  actions: {
    row: Array<{
      key: string;
      label: string;
      icon: string;
      action: string;
      style: string;
    }>;
  };
}

// ============================================================================
// HELPER FUNCTIONS TYPES
// ============================================================================

export type FieldValueFormatter = (value: any, field: FieldConfig, record: any) => string;
export type FieldValidator = (value: any, field: FieldConfig, record: any) => string | null;
export type ActionHandler = (action: string, record: any, context: ConfigContext) => Promise<void>;
export type PermissionChecker = (permission: string, record: any, context: ConfigContext) => boolean;

export interface ConfigHelpers {
  formatField: FieldValueFormatter;
  validateField: FieldValidator;
  handleAction: ActionHandler;
  checkPermission: PermissionChecker;
}