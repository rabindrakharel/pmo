import React from 'react';
import {
  SETTINGS_REGISTRY,
  createSettingsEntityConfig,
  renderColorBadge,
  renderSettingBadge,
  applySettingsBadgeRenderers
} from './settingsConfig';
import type { SettingOption } from './settingsLoader';
import { generateColumns, generateStandardColumns } from './columnGenerator';
import {
  generateEntityFields,
  getStandardEntityFields,
  getBooleanField,
  getDatalabelField,
  getAmountField
} from './fieldGenerator';

/**
 * ============================================================================
 * ENTITY CONFIGURATION SYSTEM - "WHAT" (Schema & Structure)
 * ============================================================================
 *
 * ARCHITECTURAL ROLE: Declarative schema definition for all entities
 *
 * This file defines WHAT data exists and HOW it's structured:
 * - Entity metadata (name, displayName, apiEndpoint)
 * - Column definitions (what fields appear in tables)
 * - Field definitions (what can be edited in forms)
 * - View configurations (table, kanban, grid)
 * - Relationships (parent-child, hierarchies)
 *
 * WHAT THIS FILE DOES:
 * ✅ Declares the structure of 18+ entity types
 * ✅ Defines which fields exist on each entity
 * ✅ Specifies UI metadata (labels, types, options)
 * ✅ Configures view modes and capabilities
 *
 * WHAT THIS FILE DOES NOT DO:
 * ❌ Does NOT transform data (see data_transform_render.ts)
 * ❌ Does NOT detect field capabilities (see data_transform_render.ts)
 * ❌ Does NOT render UI components (see data_transform_render.ts)
 * ❌ Does NOT process or validate data (see data_transform_render.ts)
 *
 * SEPARATION OF CONCERNS:
 * - entityConfig.ts        = WHAT (this file) - Schema definition (declarative)
 * - data_transform_render.ts = HOW             - Data behavior (imperative)
 *
 * Think of it as:
 * - entityConfig.ts        = Database schema / Type definitions
 * - data_transform_render.ts = Business logic / Data processing
 *
 * USAGE:
 * ```typescript
 * import { entityConfigs } from './entityConfig';
 * const projectConfig = entityConfigs.project;
 * // projectConfig.fields tells you WHAT fields exist
 * // data_transform_render.ts tells you HOW to process them
 * ```
 *
 * ============================================================================
 * CENTRALIZED FORMATTING SYSTEM - DRY ARCHITECTURE
 * ============================================================================
 *
 * This file uses a sophisticated DRY (Don't Repeat Yourself) architecture for
 * automatic column and field generation from database schema.
 *
 * CORE COMPONENTS:
 *
 * 1. **fieldCategoryRegistry.ts** - SINGLE SOURCE OF TRUTH
 *    - Defines ALL properties for each field category (NAME, CODE, AMOUNT, DATE, etc.)
 *    - Each category specifies: width, alignment, sortable, filterable, render function
 *    - Example: All *_amt fields automatically get right-alignment, currency formatting, 120px width
 *    - Pattern matching: *_stage → LABEL category with dropdown + colored badge
 *    - 15+ field categories covering all common patterns
 *
 * 2. **generateFieldTitle()** - Smart Title Generation
 *    - Converts field keys to human-readable titles
 *    - Examples:
 *      - 'name' → 'Name'
 *      - 'dl__task_stage' → 'Task Stage' (strips dl__ prefix, converts snake_case)
 *      - 'budget_allocated_amt' → 'Budget Allocated Amount'
 *    - Handles special cases: *_ts → removes '_ts', *_amt → removes '_amt' suffix
 *
 * 3. **generateStandardColumns()** - Auto-Column Generation
 *    - Takes array of field keys, returns full ColumnDef[] with all properties
 *    - Automatically detects field category from key pattern
 *    - Applies ALL category properties (width, align, sortable, filterable, render)
 *    - Ensures standard fields (name, code, descr) appear first
 *    - Filters out system columns (id, from_ts, to_ts, active_flag, created_ts, updated_ts, version)
 *    - Example usage:
 *      ```typescript
 *      columns: generateStandardColumns([
 *        'name', 'code', 'dl__project_stage', 'budget_allocated_amt', 'planned_start_date'
 *      ])
 *      // Auto-generates 5 columns with proper width, alignment, sorting, rendering
 *      ```
 *
 * 4. **settingsLoader.ts** - Dynamic Dropdown Options
 *    - Loads dropdown options from settings tables at runtime
 *    - API: GET /api/v1/entity/:type/options
 *    - Returns options for all dl__* fields (stage, status, priority, etc.)
 *    - Caches options per entity type to avoid repeated API calls
 *    - Integrates with loadOptionsFromSettings flag in ColumnDef and FieldDef
 *    - Example: dl__task_stage → loads from setting_task_stage table
 *
 * BENEFITS OF THIS ARCHITECTURE:
 * ✅ DRY Principle: Define category once, all fields inherit properties
 * ✅ Consistency: All *_amt fields behave identically across all entities
 * ✅ Maintainability: Change currency format in ONE place, affects ALL amount fields
 * ✅ Type Safety: Field categories are enum-based with compile-time checking
 * ✅ Auto-Detection: New fields automatically get correct rendering based on name pattern
 * ✅ Minimal Code: Single-line column generation for entire entity tables
 *
 * DATA FLOW EXAMPLE:
 * 1. Entity config specifies field keys: ['name', 'dl__project_stage', 'budget_allocated_amt']
 * 2. generateStandardColumns() processes each key:
 *    - 'name' → detects NAME category → 300px width, left-align, sortable, filterable
 *    - 'dl__project_stage' → detects LABEL category → loadOptionsFromSettings, colored badge, 150px
 *    - 'budget_allocated_amt' → detects AMOUNT category → currency render, right-align, 120px
 * 3. generateFieldTitle() creates titles: 'Name', 'Project Stage', 'Budget Allocated Amount'
 * 4. settingsLoader fetches dl__project_stage options from API on mount
 * 5. FilteredDataTable renders columns with all auto-applied properties
 *
 * HOW TO ADD NEW ENTITIES:
 *
 * Basic entity configuration (auto-generates all column properties):
 * ```typescript
 * export const entityConfigs = {
 *   project: {
 *     name: 'project',
 *     displayName: 'Project',
 *     apiEndpoint: '/api/v1/project',
 *
 *     // Specify field keys - all properties auto-generated
 *     columns: generateStandardColumns([
 *       'name', 'code', 'descr', 'dl__project_stage',
 *       'budget_allocated_amt', 'planned_start_date'
 *     ]),
 *
 *     fields: generateEntityFields([
 *       'name', 'code', 'descr', 'dl__project_stage'
 *     ])
 *   }
 * }
 * ```
 *
 * With overrides for special cases:
 * ```typescript
 * columns: generateStandardColumns(
 *   ['name', 'budget_allocated_amt', 'budget_spent_amt'],
 *   {
 *     overrides: {
 *       budget_allocated_amt: {
 *         title: 'Budget',
 *         render: (v, r) => formatCurrency(v, r.budget_currency)
 *       }
 *     }
 *   }
 * )
 * ```
 *
 * That's it! The system handles:
 * - Column widths, alignment, sorting, filtering
 * - Human-readable titles from field keys
 * - Currency formatting, date rendering, badge colors
 * - Dropdown options from settings tables
 * - System column filtering (id, timestamps, etc.)
 *
 * SOURCE OF TRUTH: DDL CREATE TABLE Statements
 * - All field keys come from database schema (db/*.ddl files)
 * - API SELECT queries match DDL columns exactly
 * - Entity configs reference only columns that exist in CREATE TABLE
 * - generateStandardColumns() validates against actual schema
 * - fieldCategoryRegistry patterns align with database naming conventions
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type ViewMode = 'table' | 'kanban' | 'grid' | 'calendar' | 'graph';

export interface ColumnDef {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (value: any, record: any) => React.ReactNode;
  /**
   * When true, options for this column will be dynamically loaded from settings tables
   * for use in inline editing dropdowns. The column key will be mapped to the appropriate
   * settings category.
   */
  loadOptionsFromSettings?: boolean;
  /**
   * Static options for inline editing dropdowns (alternative to loadOptionsFromSettings)
   * Use this when options are hardcoded (e.g., color_code field in settings tables)
   */
  options?: SettingOption[];
  /**
   * When true, this column can be edited inline in the DataTable.
   * Fields with loadOptionsFromSettings automatically become editable with dropdowns.
   * Tags fields are also automatically editable with text inputs.
   */
  inlineEditable?: boolean;
}

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'richtext' | 'number' | 'date' | 'select' | 'multiselect' | 'jsonb' | 'array';
  required?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: (value: any) => string | null;
  /**
   * When true, selected values of 'true'/'false' will be coerced to booleans before saving.
   * Useful for boolean fields represented as select inputs.
   */
  coerceBoolean?: boolean;
  /**
   * When true, options will be dynamically loaded from settings tables.
   * The field key will be mapped to the appropriate settings category.
   * Example: project_stage → loads from setting_project_stage table
   *
   * NOTE: Fields with loadOptionsFromSettings that contain 'stage' or 'funnel'
   * in their name will automatically use DAGVisualizer for workflow visualization.
   */
  loadOptionsFromSettings?: boolean;
  /**
   * When set, options will be dynamically loaded from the specified entity type.
   * Uses the universal entity options API to fetch {id, name} pairs.
   * Example: 'employee' → loads from GET /api/v1/entity/employee/options
   */
  loadOptionsFromEntity?: string;
}

export interface EntityConfig {
  name: string;
  displayName: string;
  pluralName: string;
  apiEndpoint: string;

  // Table configuration
  columns: ColumnDef[];

  // Form/detail configuration
  fields: FieldDef[];

  // Supported view modes
  supportedViews: ViewMode[];
  defaultView: ViewMode;

  // Sharing configuration
  shareable?: boolean; // Whether this entity supports shared URLs

  // Hierarchical configuration (for office/business)
  hierarchical?: {
    levels: number;
    levelNames: string[];
    metaTable: string;
    levelField: string;
  };

  // Kanban configuration (for task)
  kanban?: {
    groupByField: string; // e.g., 'stage' or 'status'
    metaTable?: string; // e.g., 'setting_task_stage'
    cardFields: string[]; // fields to show on kanban cards
  };

  // Grid configuration
  grid?: {
    cardFields: string[]; // fields to show on grid cards
    imageField?: string; // field for card image/thumbnail
  };

  // Detail page navigation configuration
  detailPageIdField?: string; // Field to use for detail page URL (default: 'id')
}

// ============================================================================
// Helper Functions for Column Renderers
// ============================================================================

import { formatRelativeTime, formatFriendlyDate } from './data_transform_render';

export const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-CA');
};

// Centralized date/timestamp renderers
export const renderTimestamp = (value?: string) => {
  return formatRelativeTime(value);
};

export const renderDate = (value?: string) => {
  return formatFriendlyDate(value);
};

export const formatCurrency = (amount?: number, currency: string = 'CAD') => {
  if (!amount) return '-';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency
  }).format(amount);
};

export const renderBadge = (value: string, colorMap: Record<string, string>): React.ReactElement => {
  const colorClass = colorMap[value] || 'bg-dark-100 text-dark-600';
  return React.createElement(
    'span',
    { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}` },
    value
  );
};

// renderColorBadge is now imported from settingsConfig.ts

export const renderTags = (tags?: string[] | string): React.ReactElement | null => {
  // Handle both array and JSON string formats
  let tagsArray: string[] = [];

  if (!tags) return null;

  if (typeof tags === 'string') {
    try {
      tagsArray = JSON.parse(tags);
    } catch {
      // If parsing fails, treat as empty
      return null;
    }
  } else if (Array.isArray(tags)) {
    tagsArray = tags;
  }

  if (tagsArray.length === 0) return null;

  return React.createElement(
    'div',
    { className: 'flex flex-wrap gap-1' },
    ...tagsArray.slice(0, 2).map((tag, index) =>
      React.createElement(
        'span',
        { key: index, className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-dark-100 text-dark-600' },
        tag
      )
    ),
    tagsArray.length > 2 ? React.createElement(
      'span',
      { className: 'text-xs text-dark-700' },
      `+${tagsArray.length - 2}`
    ) : null
  );
};

/**
 * Render employee names from array
 * Backend API returns employee names in assignee_employee_names field
 */
export const renderEmployeeNames = (names?: string[] | string, record?: any): React.ReactElement | null => {
  // Try to use assignee_employee_names from the record first (populated by backend)
  const employeeNames = record?.assignee_employee_names || names;

  if (!employeeNames) return React.createElement('span', { className: 'text-dark-600' }, '-');

  // Handle both array and JSON string formats
  let namesArray: string[] = [];

  if (typeof employeeNames === 'string') {
    try {
      namesArray = JSON.parse(employeeNames);
    } catch {
      namesArray = [employeeNames];
    }
  } else if (Array.isArray(employeeNames)) {
    namesArray = employeeNames;
  }

  if (namesArray.length === 0) return React.createElement('span', { className: 'text-dark-600' }, '-');

  return React.createElement(
    'div',
    { className: 'flex flex-wrap gap-1' },
    ...namesArray.slice(0, 2).map((name, index) =>
      React.createElement(
        'span',
        {
          key: index,
          className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800'
        },
        name
      )
    ),
    namesArray.length > 2 ? React.createElement(
      'span',
      { className: 'text-xs text-dark-700' },
      `+${namesArray.length - 2} more`
    ) : null
  );
};

// ============================================================================
// CENTRALIZED FIELD TYPE DETECTION & FORMATTING (DRY SYSTEM)
// ============================================================================
/**
 * Field categorization, width assignment, sortable/filterable/searchable config,
 * and rendering logic have been moved to fieldCategoryRegistry.ts
 *
 * This provides a SINGLE SOURCE OF TRUTH where:
 * - Each field category is defined ONCE with all its properties
 * - Changes to a category automatically apply to ALL fields of that category
 * - Zero duplication across the codebase
 *
 * See: apps/web/src/lib/fieldCategoryRegistry.ts
 */

// ============================================================================
// Entity Configurations
// ============================================================================

export const entityConfigs: Record<string, EntityConfig> = {
  // --------------------------------------------------------------------------
  // PROJECT
  // --------------------------------------------------------------------------
  project: {
    name: 'project',
    displayName: 'Project',
    pluralName: 'Projects',
    apiEndpoint: '/api/v1/project',

    columns: generateStandardColumns(
      ['name', 'code', 'descr', 'dl__project_stage', 'budget_allocated_amt', 'budget_spent_amt', 'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'complexity', 'priority', 'risk_level', 'project_type', 'manager_employee_id', 'created_ts', 'updated_ts']
    ),

    fields: [
      { key: 'name', label: 'Project Name', type: 'text', required: true },
      { key: 'code', label: 'Project Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'dl__project_stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'budget_allocated_amt', label: 'Budget', type: 'number' },
      { key: 'planned_start_date', label: 'Start Date', type: 'date' },
      { key: 'planned_end_date', label: 'End Date', type: 'date' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // TASK
  // --------------------------------------------------------------------------
  task: {
    name: 'task',
    displayName: 'Task',
    pluralName: 'Tasks',
    apiEndpoint: '/api/v1/task',
    shareable: true,

    columns: generateStandardColumns(
      ['name', 'code', 'descr', 'dl__task_stage', 'dl__task_priority', 'estimated_hours', 'actual_hours', 'task_type', 'story_points', 'deliverable', 'assignee_employee_ids', 'created_ts', 'updated_ts']
    ),

    fields: [
      { key: 'name', label: 'Task Name', type: 'text', required: true },
      { key: 'code', label: 'Task Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'dl__task_stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'dl__task_priority', label: 'Priority', type: 'select', loadOptionsFromSettings: true },
      { key: 'estimated_hours', label: 'Estimated Hours', type: 'number' },
      { key: 'assignee_employee_ids', label: 'Assignees', type: 'multiselect', loadOptionsFromEntity: 'employee' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    kanban: {
      groupByField: 'dl__task_stage',
      metaTable: 'dl__task_stage',
      cardFields: ['name', 'dl__task_priority', 'estimated_hours', 'assignee_employee_ids']
    }
  },

  // --------------------------------------------------------------------------
  // WIKI
  // --------------------------------------------------------------------------
  wiki: {
    name: 'wiki',
    displayName: 'Wiki',
    pluralName: 'Wiki Pages',
    apiEndpoint: '/api/v1/wiki',
    shareable: true,

    columns: generateColumns(['title', 'wiki_type', 'publication_status', 'category']),

    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'wiki_type', label: 'Type', type: 'select', options: [
        { value: 'page', label: 'Page' },
        { value: 'template', label: 'Template' },
        { value: 'workflow', label: 'Workflow' },
        { value: 'guide', label: 'Guide' },
        { value: 'policy', label: 'Policy' },
        { value: 'checklist', label: 'Checklist' }
      ]},
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'publication_status', label: 'Publication Status', type: 'select', loadOptionsFromSettings: true },
      { key: 'visibility', label: 'Visibility', type: 'select', options: [
        { value: 'public', label: 'Public' },
        { value: 'internal', label: 'Internal' },
        { value: 'restricted', label: 'Restricted' },
        { value: 'private', label: 'Private' }
      ]},
      { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'keywords', label: 'Keywords', type: 'array' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // ARTIFACT
  // --------------------------------------------------------------------------
  artifact: {
    name: 'artifact',
    displayName: 'Artifact',
    pluralName: 'Artifacts',
    apiEndpoint: '/api/v1/artifact',
    shareable: true,

    columns: generateColumns(
      ['name', 'code', 'artifact_type', 'visibility', 'security_classification', 'confidentiality', 'compliance_standard', 'attachment_format', 'attachment_size_bytes', 'entity_type', 'legal_review', 'created_by', 'created_ts', 'updated_ts']
    ),

    fields: [
      // ========== BASIC INFORMATION ==========
      { key: 'name', label: 'Artifact Name', type: 'text', required: true, placeholder: 'Auto-populated from uploaded filename' },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., ART-2025-001' },
      { key: 'descr', label: 'Description', type: 'richtext', placeholder: 'Describe the purpose and contents of this artifact...' },

      // ========== CLASSIFICATION ==========
      {
        key: 'artifact_type',
        label: 'Artifact Type',
        type: 'select',
        defaultValue: 'document',
        options: [
          { value: 'document', label: 'Document' },
          { value: 'template', label: 'Template' },
          { value: 'image', label: 'Image' },
          { value: 'video', label: 'Video' },
          { value: 'blueprint', label: 'Blueprint' },
          { value: 'contract', label: 'Contract' },
          { value: 'report', label: 'Report' },
          { value: 'presentation', label: 'Presentation' },
          { value: 'spreadsheet', label: 'Spreadsheet' }
        ]
      },
      {
        key: 'visibility',
        label: 'Visibility',
        type: 'select',
        defaultValue: 'internal',
        required: true,
        options: [
          { value: 'public', label: 'Public' },
          { value: 'internal', label: 'Internal' },
          { value: 'restricted', label: 'Restricted' },
          { value: 'private', label: 'Private - Owner and assigned users only' }
        ]
      },
      {
        key: 'security_classification',
        label: 'Security Classification',
        type: 'select',
        defaultValue: 'general',
        required: true,
        options: [
          { value: 'general', label: 'General' },
          { value: 'confidential', label: 'Confidential' },
          { value: 'restricted', label: 'Restricted' }
        ]
      },

      // ========== ADDITIONAL ==========,
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // FORM
  // --------------------------------------------------------------------------
  form: {
    name: 'form',
    displayName: 'Form',
    pluralName: 'Forms',
    apiEndpoint: '/api/v1/form',
    shareable: true,

    columns: generateColumns(['name', 'code', 'form_type', 'descr', 'shared_url', 'internal_url', 'created_ts', 'updated_ts']),

    fields: [
      { key: 'name', label: 'Form Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'url', label: 'Public Form URL', type: 'text', readonly: true },
      { key: 'schema', label: 'Form Schema', type: 'jsonb', required: true },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // BUSINESS (biz)
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // BUSINESS (Operational Teams Only)
  // --------------------------------------------------------------------------
  // NOTE: Business hierarchy management is separate (d_business_hierarchy table)
  // This config is for operational business units (teams doing actual work)
  biz: {
    name: 'biz',
    displayName: 'Business Unit',
    pluralName: 'Business Units',
    apiEndpoint: '/api/v1/biz',

    columns: generateStandardColumns(
      ['name', 'code', 'operational_status', 'current_headcount', 'office_id', 'descr', 'active_flag', 'created_ts', 'updated_ts']
    ),

    fields: [
      { key: 'name', label: 'Business Unit Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'office_id', label: 'Office', type: 'select', options: [] },
      { key: 'current_headcount', label: 'Current Headcount', type: 'number' },
      { key: 'operational_status', label: 'Operational Status', type: 'text' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // OFFICE (Physical Locations Only)
  // --------------------------------------------------------------------------
  // NOTE: Office hierarchy management is separate (d_office_hierarchy table)
  // This config is for operational office locations (addresses, contacts, etc.)
  office: {
    name: 'office',
    displayName: 'Office',
    pluralName: 'Offices',
    apiEndpoint: '/api/v1/office',

    columns: generateColumns(['name', 'code', 'city', 'province', 'country', 'office_type', 'phone', 'email', 'postal_code', 'capacity_employees', 'square_footage', 'created_ts', 'updated_ts']),

    fields: [
      { key: 'name', label: 'Office Name', type: 'text', required: true },
      { key: 'code', label: 'Office Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'address_line1', label: 'Address Line 1', type: 'text' },
      { key: 'address_line2', label: 'Address Line 2', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'province', label: 'Province', type: 'text' },
      { key: 'postal_code', label: 'Postal Code', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'office_type', label: 'Office Type', type: 'text' },
      { key: 'capacity_employees', label: 'Employee Capacity', type: 'number' },
      { key: 'square_footage', label: 'Square Footage', type: 'number' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------
  employee: {
    name: 'employee',
    displayName: 'Employee',
    pluralName: 'Employees',
    apiEndpoint: '/api/v1/employee',

    columns: generateColumns(['name', 'code', 'email', 'phone', 'mobile', 'title', 'department', 'employee_type', 'hire_date', 'city', 'province', 'tags', 'created_ts', 'updated_ts']),

    fields: [
      { key: 'employee_number', label: 'Employee Number', type: 'text', required: true },
      { key: 'first_name', label: 'First Name', type: 'text', required: true },
      { key: 'last_name', label: 'Last Name', type: 'text', required: true },
      { key: 'name', label: 'Full Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'mobile', label: 'Mobile', type: 'text' },
      { key: 'title', label: 'Job Title', type: 'text' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'employee_type', label: 'Employment Type', type: 'select', options: [
        { value: 'full-time', label: 'Full Time' },
        { value: 'part-time', label: 'Part Time' },
        { value: 'contractor', label: 'Contractor' },
        { value: 'temporary', label: 'Temporary' }
      ]},
      { key: 'skills_service_categories', label: 'Service Skills', type: 'multiselect', loadOptionsFromSettings: 'dl__service_category' },
      { key: 'hire_date', label: 'Hire Date', type: 'date' },
      { key: 'address_line1', label: 'Address Line 1', type: 'text' },
      { key: 'address_line2', label: 'Address Line 2', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'province', label: 'Province', type: 'text' },
      { key: 'postal_code', label: 'Postal Code', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text' },
      { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // ROLE
  // --------------------------------------------------------------------------
  role: {
    name: 'role',
    displayName: 'Role',
    pluralName: 'Roles',
    apiEndpoint: '/api/v1/role',

    columns: generateColumns(['name', 'descr'], {}),

    fields: [
      { key: 'name', label: 'Role Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // WORKSITE
  // --------------------------------------------------------------------------
  worksite: {
    name: 'worksite',
    displayName: 'Worksite',
    pluralName: 'Worksites',
    apiEndpoint: '/api/v1/worksite',

    columns: generateColumns(['name', 'descr', 'created_ts']),

    fields: [
      { key: 'name', label: 'Worksite Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table', 'grid'],
    defaultView: 'table',

    grid: {
      cardFields: ['name', 'descr']
    }
  },

  // --------------------------------------------------------------------------
  // CUSTOMER
  // --------------------------------------------------------------------------
  cust: {
    name: 'cust',
    displayName: 'Customer',
    pluralName: 'Customers',
    apiEndpoint: '/api/v1/cust',

    columns: generateStandardColumns(
      ['name', 'code', 'cust_number', 'cust_type', 'cust_status', 'primary_contact_name', 'primary_email', 'primary_phone', 'city', 'province', 'postal_code', 'business_type', 'dl__customer_opportunity_funnel', 'dl__industry_sector', 'dl__acquisition_channel', 'dl__customer_tier', 'created_ts', 'updated_ts']
    ),

    fields: [
      { key: 'name', label: 'Customer Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'cust_number', label: 'Customer Number', type: 'text', required: true },
      { key: 'cust_type', label: 'Customer Type', type: 'select', options: [
        { value: 'residential', label: 'Residential' },
        { value: 'commercial', label: 'Commercial' },
        { value: 'municipal', label: 'Municipal' },
        { value: 'industrial', label: 'Industrial' }
      ]},
      { key: 'primary_contact_name', label: 'Primary Contact', type: 'text' },
      { key: 'primary_email', label: 'Email', type: 'text' },
      { key: 'primary_phone', label: 'Phone', type: 'text' },
      { key: 'primary_address', label: 'Address', type: 'textarea' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'province', label: 'Province', type: 'text' },
      { key: 'postal_code', label: 'Postal Code', type: 'text' },
      { key: 'dl__customer_opportunity_funnel', label: 'Opportunity Funnel', type: 'select', loadOptionsFromSettings: true },
      { key: 'dl__industry_sector', label: 'Industry Sector', type: 'select', loadOptionsFromSettings: true },
      { key: 'dl__acquisition_channel', label: 'Acquisition Channel', type: 'select', loadOptionsFromSettings: true },
      { key: 'dl__customer_tier', label: 'Customer Tier', type: 'select', loadOptionsFromSettings: true },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // POSITION
  // --------------------------------------------------------------------------
  position: {
    name: 'position',
    displayName: 'Position',
    pluralName: 'Positions',
    apiEndpoint: '/api/v1/position',

    columns: generateColumns(['name', 'descr'], {
      overrides: {
        name: {
          title: 'Position Name'
        }
      }
    }),

    fields: [
      { key: 'name', label: 'Position Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // SETTINGS ENTITIES (DRY - Generated from Registry)
  // --------------------------------------------------------------------------
  // All settings entities use the factory pattern from settingsConfig.ts
  // This eliminates ~600 lines of repetitive code

  // Project Stage
  projectStage: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'projectStage')!
    )
  },

  // Project Status
  projectStatus: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'projectStatus')!
    )
  },

  // Task Stage
  taskStage: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'taskStage')!
    )
  },

  // Task Priority
  taskPriority: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'taskPriority')!
    )
  },

  // Business Level
  businessLevel: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'businessLevel')!
    )
  },

  // Office Level
  orgLevel: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'orgLevel')!
    )
  },

  // HR Level
  hrLevel: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'hrLevel')!
    )
  },

  // Client Level
  clientLevel: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'clientLevel')!
    )
  },

  // Position Level
  positionLevel: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'positionLevel')!
    )
  },

  // Opportunity Funnel Stage
  opportunityFunnelLevel: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'opportunityFunnelLevel')!
    )
  },

  // Industry Sector
  industrySector: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'industrySector')!
    )
  },

  // Acquisition Channel
  acquisitionChannel: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'acquisitionChannel')!
    )
  },

  // Customer Tier
  customerTier: {
    ...createSettingsEntityConfig(
      SETTINGS_REGISTRY.find(s => s.key === 'customerTier')!
    )
  },

  // --------------------------------------------------------------------------
  // INVENTORY
  // --------------------------------------------------------------------------
  inventory: {
    name: 'inventory',
    displayName: 'Inventory',
    pluralName: 'Inventory',
    apiEndpoint: '/api/v1/inventory',

    columns: [
      {
        key: 'product_id',
        title: 'Product',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'store_id',
        title: 'Store/Location',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'qty',
        title: 'Quantity',
        sortable: true,
        align: 'right',
        render: (value) => value ? parseFloat(value).toFixed(2) : '0.00'
      },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'product_id', label: 'Product ID', type: 'text', required: true },
      { key: 'store_id', label: 'Store/Location ID', type: 'text' },
      { key: 'qty', label: 'Quantity', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // ORDER
  // --------------------------------------------------------------------------
  order: {
    name: 'order',
    displayName: 'Order',
    pluralName: 'Orders',
    apiEndpoint: '/api/v1/order',

    columns: [
      {
        key: 'order_number',
        title: 'Order Number',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement('div', { className: 'font-medium text-dark-600' }, value)
      },
      {
        key: 'client_name',
        title: 'Client',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'order_date',
        title: 'Order Date',
        sortable: true,
        render: renderDate
      },
      {
        key: 'order_status',
        title: 'Status',
        sortable: true,
        filterable: true,
        render: (value) => renderBadge(value || 'pending', {
          'quote': 'bg-dark-100 text-dark-600',
          'pending': 'bg-dark-100 text-dark-600',
          'confirmed': 'bg-purple-100 text-purple-800',
          'processing': 'bg-yellow-100 text-yellow-800',
          'shipped': 'bg-green-100 text-green-800',
          'delivered': 'bg-green-100 text-green-800',
          'cancelled': 'bg-red-100 text-red-800'
        })
      },
      {
        key: 'line_total_cad',
        title: 'Total',
        sortable: true,
        align: 'right',
        render: (value) => formatCurrency(value, 'CAD')
      }
    ],

    fields: [
      { key: 'order_number', label: 'Order Number', type: 'text', required: true },
      { key: 'client_name', label: 'Client Name', type: 'text' },
      { key: 'product_id', label: 'Product ID', type: 'text', required: true },
      { key: 'quantity_ordered', label: 'Quantity', type: 'number', required: true },
      { key: 'order_status', label: 'Status', type: 'select', options: [
        { value: 'quote', label: 'Quote' },
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'processing', label: 'Processing' },
        { value: 'shipped', label: 'Shipped' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'cancelled', label: 'Cancelled' }
      ]},
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // SHIPMENT
  // --------------------------------------------------------------------------
  shipment: {
    name: 'shipment',
    displayName: 'Shipment',
    pluralName: 'Shipments',
    apiEndpoint: '/api/v1/shipment',

    columns: [
      {
        key: 'shipment_number',
        title: 'Shipment Number',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement('div', { className: 'font-medium text-dark-600' }, value)
      },
      {
        key: 'client_name',
        title: 'Client',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'tracking_number',
        title: 'Tracking',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'shipment_date',
        title: 'Ship Date',
        sortable: true,
        render: renderDate
      },
      {
        key: 'shipment_status',
        title: 'Status',
        sortable: true,
        filterable: true,
        render: (value) => renderBadge(value || 'pending', {
          'pending': 'bg-dark-100 text-dark-600',
          'picked': 'bg-dark-100 text-dark-600',
          'packed': 'bg-purple-100 text-purple-800',
          'shipped': 'bg-yellow-100 text-yellow-800',
          'in_transit': 'bg-orange-100 text-orange-800',
          'delivered': 'bg-green-100 text-green-800',
          'exception': 'bg-red-100 text-red-800'
        })
      },
      {
        key: 'carrier_name',
        title: 'Carrier',
        sortable: true,
        render: (value) => value || '-'
      }
    ],

    fields: [
      { key: 'shipment_number', label: 'Shipment Number', type: 'text', required: true },
      { key: 'client_name', label: 'Client Name', type: 'text' },
      { key: 'product_id', label: 'Product ID', type: 'text', required: true },
      { key: 'quantity_shipped', label: 'Quantity', type: 'number', required: true },
      { key: 'tracking_number', label: 'Tracking Number', type: 'text' },
      { key: 'carrier_name', label: 'Carrier', type: 'text' },
      { key: 'shipment_status', label: 'Status', type: 'select', options: [
        { value: 'pending', label: 'Pending' },
        { value: 'picked', label: 'Picked' },
        { value: 'packed', label: 'Packed' },
        { value: 'shipped', label: 'Shipped' },
        { value: 'in_transit', label: 'In Transit' },
        { value: 'delivered', label: 'Delivered' }
      ]},
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // INVOICE
  // --------------------------------------------------------------------------
  invoice: {
    name: 'invoice',
    displayName: 'Invoice',
    pluralName: 'Invoices',
    apiEndpoint: '/api/v1/invoice',

    columns: [
      {
        key: 'invoice_number',
        title: 'Invoice Number',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement('div', { className: 'font-medium text-dark-600' }, value)
      },
      {
        key: 'client_name',
        title: 'Client',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'invoice_date',
        title: 'Invoice Date',
        sortable: true,
        render: renderDate
      },
      {
        key: 'due_date',
        title: 'Due Date',
        sortable: true,
        render: renderDate
      },
      {
        key: 'invoice_status',
        title: 'Status',
        sortable: true,
        filterable: true,
        render: (value) => renderBadge(value || 'draft', {
          'draft': 'bg-dark-100 text-dark-600',
          'sent': 'bg-dark-100 text-dark-600',
          'viewed': 'bg-purple-100 text-purple-800',
          'partial': 'bg-yellow-100 text-yellow-800',
          'paid': 'bg-green-100 text-green-800',
          'overdue': 'bg-red-100 text-red-800'
        })
      },
      {
        key: 'line_total_cad',
        title: 'Total',
        sortable: true,
        align: 'right',
        render: (value) => formatCurrency(value, 'CAD')
      },
      {
        key: 'amount_outstanding_cad',
        title: 'Outstanding',
        sortable: true,
        align: 'right',
        render: (value) => formatCurrency(value, 'CAD')
      },
      {
        key: 'attachment_format',
        title: 'Format',
        sortable: true,
        filterable: true,
        width: '90px',
        render: (value) => value ? React.createElement(
          'span',
          { className: 'inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-dark-100 text-dark-600 rounded border border-dark-300' },
          value.toUpperCase()
        ) : '-'
      },
      {
        key: 'attachment_size_bytes',
        title: 'Size',
        sortable: true,
        width: '90px',
        align: 'right' as const,
        render: (value) => {
          if (!value) return '-';
          const kb = value / 1024;
          const mb = kb / 1024;
          if (mb >= 1) {
            return React.createElement('span', { className: 'text-dark-600 font-medium' }, `${mb.toFixed(1)} MB`);
          }
          return React.createElement('span', { className: 'text-dark-600 font-medium' }, `${kb.toFixed(0)} KB`);
        }
      }
    ],

    fields: [
      // ========== ATTACHMENT ==========
      {
        key: 'attachment',
        label: 'Invoice PDF',
        type: 'text',
        readonly: true,
        placeholder: 'S3 URI - Auto-populated from uploaded invoice'
      },
      {
        key: 'attachment_format',
        label: 'File Format',
        type: 'text',
        readonly: true,
        placeholder: 'Auto-populated from uploaded invoice (e.g., pdf)'
      },
      {
        key: 'attachment_size_bytes',
        label: 'File Size (bytes)',
        type: 'number',
        readonly: true,
        placeholder: 'Auto-populated from uploaded invoice'
      },

      // ========== BASIC INFORMATION ==========
      { key: 'invoice_number', label: 'Invoice Number', type: 'text', required: true },
      { key: 'client_name', label: 'Client Name', type: 'text' },
      { key: 'product_id', label: 'Product ID', type: 'text' },
      { key: 'quantity_billed', label: 'Quantity', type: 'number', required: true },
      { key: 'unit_price_cad', label: 'Unit Price (CAD)', type: 'number', required: true },
      { key: 'invoice_status', label: 'Status', type: 'select', options: [
        { value: 'draft', label: 'Draft' },
        { value: 'sent', label: 'Sent' },
        { value: 'viewed', label: 'Viewed' },
        { value: 'partial', label: 'Partially Paid' },
        { value: 'paid', label: 'Paid' },
        { value: 'overdue', label: 'Overdue' }
      ]},
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // MARKETING (Email Templates)
  // --------------------------------------------------------------------------
  marketing: {
    name: 'marketing',
    displayName: 'Email Template',
    pluralName: 'Email Templates',
    apiEndpoint: '/api/v1/email-template',

    columns: [
      {
        key: 'name',
        title: 'Name',
        sortable: true,
        filterable: true
      },
      {
        key: 'code',
        title: 'Code',
        sortable: true,
        filterable: true
      },
      {
        key: 'subject',
        title: 'Subject Line',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement('div', { className: 'max-w-md truncate text-dark-600' }, value || '-')
      },
      {
        key: 'status',
        title: 'Status',
        sortable: true,
        filterable: true,
        render: (value) => renderBadge(value, {
          'draft': 'bg-dark-100 text-dark-600',
          'published': 'bg-green-100 text-green-800',
          'archived': 'bg-red-100 text-red-800'
        })
      },
      {
        key: 'from_name',
        title: 'From',
        sortable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'text-sm text-dark-600' }, value || '-'),
          record.from_email && React.createElement('div', { className: 'text-xs text-dark-700' }, record.from_email)
        )
      },
      {
        key: 'updated_ts',
        title: 'Last Updated',
        sortable: true,
        render: renderTimestamp
      }
    ],

    fields: [
      { key: 'name', label: 'Template Name', type: 'text', required: true },
      { key: 'code', label: 'Template Code', type: 'text' },
      { key: 'subject', label: 'Email Subject', type: 'text', required: true },
      { key: 'preview_text', label: 'Preview Text', type: 'text', placeholder: 'Text shown in email preview' },
      { key: 'descr', label: 'Description', type: 'textarea' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'published', label: 'Published' },
          { value: 'archived', label: 'Archived' }
        ]
      },
      { key: 'from_name', label: 'From Name', type: 'text', placeholder: 'Huron Home Services' },
      { key: 'from_email', label: 'From Email', type: 'text', placeholder: 'info@huronhome.ca' },
      { key: 'reply_to_email', label: 'Reply To Email', type: 'text', placeholder: 'support@huronhome.ca' },
      { key: 'template_schema', label: 'Template Content', type: 'jsonb', readonly: true },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table', 'grid'],
    defaultView: 'table',

    grid: {
      cardFields: ['name', 'subject', 'status', 'updated_ts']
    }
  },

  // --------------------------------------------------------------------------
  // WORKFLOW AUTOMATION
  // --------------------------------------------------------------------------
  workflow_automation: {
    name: 'workflow_automation',
    displayName: 'Workflow Automation',
    pluralName: 'Workflow Automations',
    apiEndpoint: '/api/v1/workflow-automation',

    columns: [
      {
        key: 'workflow_name',
        title: 'Workflow Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-dark-600' }, value),
          record.workflow_description && React.createElement('div', { className: 'text-sm text-dark-700 truncate max-w-md' }, record.workflow_description)
        )
      },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        filterable: true,
        align: 'center',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-dark-100 text-dark-600'
        })
      },
      {
        key: 'trigger_entity_type',
        title: 'Trigger Entity',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement('span', { className: 'capitalize text-dark-600' }, value)
      },
      {
        key: 'trigger_action_type',
        title: 'Trigger Action',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement(
          'span',
          { className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-dark-100 text-dark-600' },
          value.replace('_', ' ').toUpperCase()
        )
      },
      {
        key: 'action_entity_type',
        title: 'Action Entity',
        sortable: true,
        render: (value) => React.createElement('span', { className: 'capitalize text-dark-600' }, value)
      },
      {
        key: 'execution_count',
        title: 'Executions',
        sortable: true,
        align: 'center',
        render: (value, record) => React.createElement(
          'div',
          { className: 'text-sm' },
          React.createElement('div', { className: 'font-medium text-dark-600' }, value || 0),
          record.max_executions > 0 && React.createElement('div', { className: 'text-xs text-dark-700' }, `/ ${record.max_executions}`)
        )
      },
      {
        key: 'last_executed_at',
        title: 'Last Executed',
        sortable: true,
        render: renderTimestamp
      }
    ],

    fields: [
      { key: 'workflow_name', label: 'Workflow Name', type: 'text', required: true },
      { key: 'workflow_description', label: 'Description', type: 'textarea' },
      {
        key: 'active_flag',
        label: 'Active',
        type: 'select',
        options: [
          { value: 'true', label: 'Active' },
          { value: 'false', label: 'Inactive' }
        ],
        coerceBoolean: true
      },
      {
        key: 'trigger_entity_type',
        label: 'Trigger Entity Type',
        type: 'select',
        required: true,
        options: [
          { value: 'project', label: 'Project' },
          { value: 'task', label: 'Task' },
          { value: 'client', label: 'Client' },
          { value: 'worksite', label: 'Worksite' },
          { value: 'employee', label: 'Employee' },
          { value: 'office', label: 'Office' },
          { value: 'business', label: 'Business' },
          { value: 'role', label: 'Role' },
          { value: 'position', label: 'Position' },
          { value: 'artifact', label: 'Artifact' },
          { value: 'wiki', label: 'Wiki' },
          { value: 'form', label: 'Form' },
          { value: 'report', label: 'Report' }
        ]
      },
      {
        key: 'trigger_action_type',
        label: 'Trigger Action Type',
        type: 'select',
        required: true,
        options: [
          { value: 'create', label: 'Create' },
          { value: 'update', label: 'Update' },
          { value: 'delete', label: 'Delete' },
          { value: 'status_change', label: 'Status Change' },
          { value: 'field_change', label: 'Field Change' },
          { value: 'assign', label: 'Assign' },
          { value: 'complete', label: 'Complete' }
        ]
      },
      {
        key: 'trigger_scope',
        label: 'Trigger Scope',
        type: 'select',
        options: [
          { value: 'all', label: 'All Entities' },
          { value: 'specific', label: 'Specific Entity' }
        ]
      },
      { key: 'trigger_entity_id', label: 'Trigger Entity ID (if specific)', type: 'text', placeholder: 'UUID of specific entity' },
      { key: 'trigger_conditions', label: 'Trigger Conditions (JSON)', type: 'jsonb', placeholder: '{"field": "status", "operator": "equals", "value": "completed"}' },
      {
        key: 'action_entity_type',
        label: 'Action Entity Type',
        type: 'select',
        required: true,
        options: [
          { value: 'project', label: 'Project' },
          { value: 'task', label: 'Task' },
          { value: 'client', label: 'Client' },
          { value: 'worksite', label: 'Worksite' },
          { value: 'employee', label: 'Employee' },
          { value: 'office', label: 'Office' },
          { value: 'business', label: 'Business' },
          { value: 'role', label: 'Role' },
          { value: 'position', label: 'Position' },
          { value: 'artifact', label: 'Artifact' },
          { value: 'wiki', label: 'Wiki' },
          { value: 'form', label: 'Form' },
          { value: 'report', label: 'Report' },
          { value: 'notification', label: 'Notification' },
          { value: 'email', label: 'Email' }
        ]
      },
      {
        key: 'action_scope',
        label: 'Action Scope',
        type: 'select',
        options: [
          { value: 'same', label: 'Same Entity (Triggered)' },
          { value: 'related', label: 'Related Entities' },
          { value: 'specific', label: 'Specific Entity' },
          { value: 'all', label: 'All Entities' }
        ]
      },
      { key: 'action_entity_id', label: 'Action Entity ID (if specific)', type: 'text', placeholder: 'UUID of specific entity' },
      { key: 'actions', label: 'Actions (JSON Array)', type: 'jsonb', required: true, placeholder: '[{"type": "update_field", "field": "status", "value": "in_progress"}]' },
      { key: 'execution_order', label: 'Execution Order', type: 'number', placeholder: '0 (lower = higher priority)' },
      { key: 'max_executions', label: 'Max Executions', type: 'number', placeholder: '-1 (unlimited)' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // COST
  // --------------------------------------------------------------------------
  cost: {
    name: 'cost',
    displayName: 'Cost',
    pluralName: 'Costs',
    apiEndpoint: '/api/v1/cost',

    columns: [
      {
        key: 'name',
        title: 'Cost Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-dark-600' }, value),
          record.cost_code && React.createElement('div', { className: 'text-sm text-dark-700' }, record.cost_code)
        )
      },
      {
        key: 'cost_amt_lcl',
        title: 'Cost Amount',
        sortable: true,
        align: 'right',
        render: (value, record) => formatCurrency(value, record.invoice_currency || 'CAD')
      },
      {
        key: 'cost_amt_invoice',
        title: 'Invoice Amount',
        sortable: true,
        align: 'right',
        render: (value, record) => formatCurrency(value, record.invoice_currency || 'CAD')
      },
      {
        key: 'invoice_currency',
        title: 'Currency',
        sortable: true,
        filterable: true
      },
      {
        key: 'cust_budgeted_amt_lcl',
        title: 'Budgeted Amount',
        sortable: true,
        align: 'right',
        render: (value) => formatCurrency(value, 'CAD')
      },
      {
        key: 'attachment_format',
        title: 'Format',
        sortable: true,
        filterable: true,
        width: '90px',
        render: (value) => value ? React.createElement(
          'span',
          { className: 'inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-dark-100 text-dark-600 rounded border border-dark-300' },
          value.toUpperCase()
        ) : '-'
      },
      {
        key: 'attachment_size_bytes',
        title: 'Size',
        sortable: true,
        width: '90px',
        align: 'right' as const,
        render: (value) => {
          if (!value) return '-';
          const kb = value / 1024;
          const mb = kb / 1024;
          if (mb >= 1) {
            return React.createElement('span', { className: 'text-dark-600 font-medium' }, `${mb.toFixed(1)} MB`);
          }
          return React.createElement('span', { className: 'text-dark-600 font-medium' }, `${kb.toFixed(0)} KB`);
        }
      }
    ],

    fields: [
      // ========== ATTACHMENT ==========
      {
        key: 'attachment',
        label: 'Invoice Attachment',
        type: 'text',
        readonly: true,
        placeholder: 'S3 URI - Auto-populated from uploaded invoice'
      },
      {
        key: 'attachment_format',
        label: 'File Format',
        type: 'text',
        readonly: true,
        placeholder: 'Auto-populated from uploaded invoice (e.g., pdf, png, jpg)'
      },
      {
        key: 'attachment_size_bytes',
        label: 'File Size (bytes)',
        type: 'number',
        readonly: true,
        placeholder: 'Auto-populated from uploaded invoice'
      },

      // ========== BASIC INFORMATION ==========
      { key: 'name', label: 'Cost Name', type: 'text', required: true, placeholder: 'e.g., Office Supplies Q1 2025' },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., CST-2025-001' },
      { key: 'cost_code', label: 'Cost Code', type: 'text', required: true, placeholder: 'e.g., EXP-OFFICE-SUPPLIES' },
      { key: 'descr', label: 'Description', type: 'richtext', placeholder: 'Describe the cost item and its purpose...' },

      // ========== FINANCIAL INFORMATION ==========
      { key: 'cost_amt_lcl', label: 'Cost Amount (CAD)', type: 'number', required: true, placeholder: '0.00' },
      { key: 'cost_amt_invoice', label: 'Invoice Amount', type: 'number', placeholder: '0.00' },
      {
        key: 'invoice_currency',
        label: 'Currency',
        type: 'select',
        defaultValue: 'CAD',
        options: [
          { value: 'CAD', label: 'CAD' },
          { value: 'USD', label: 'USD' },
          { value: 'EUR', label: 'EUR' },
          { value: 'GBP', label: 'GBP' }
        ]
      },
      { key: 'exch_rate', label: 'Exchange Rate', type: 'number', placeholder: '1.00' },
      { key: 'cust_budgeted_amt_lcl', label: 'Budgeted Amount (CAD)', type: 'number', placeholder: '0.00' },

      // ========== ADDITIONAL ==========,
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // REVENUE
  // --------------------------------------------------------------------------
  revenue: {
    name: 'revenue',
    displayName: 'Revenue',
    pluralName: 'Revenue',
    apiEndpoint: '/api/v1/revenue',

    columns: [
      {
        key: 'name',
        title: 'Revenue Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-dark-600' }, value),
          record.revenue_code && React.createElement('div', { className: 'text-sm text-dark-700' }, record.revenue_code)
        )
      },
      {
        key: 'revenue_amt_local',
        title: 'Revenue Amount',
        sortable: true,
        align: 'right',
        render: (value, record) => formatCurrency(value, record.invoice_currency || 'CAD')
      },
      {
        key: 'revenue_amt_invoice',
        title: 'Invoice Amount',
        sortable: true,
        align: 'right',
        render: (value, record) => formatCurrency(value, record.invoice_currency || 'CAD')
      },
      {
        key: 'revenue_forecasted_amt_lcl',
        title: 'Forecasted Amount',
        sortable: true,
        align: 'right',
        render: (value) => formatCurrency(value, 'CAD')
      },
      {
        key: 'invoice_currency',
        title: 'Currency',
        sortable: true,
        filterable: true
      },
      {
        key: 'attachment_format',
        title: 'Format',
        sortable: true,
        filterable: true,
        width: '90px',
        render: (value) => value ? React.createElement(
          'span',
          { className: 'inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-dark-100 text-dark-600 rounded border border-dark-300' },
          value.toUpperCase()
        ) : '-'
      },
      {
        key: 'attachment_size_bytes',
        title: 'Size',
        sortable: true,
        width: '90px',
        align: 'right' as const,
        render: (value) => {
          if (!value) return '-';
          const kb = value / 1024;
          const mb = kb / 1024;
          if (mb >= 1) {
            return React.createElement('span', { className: 'text-dark-600 font-medium' }, `${mb.toFixed(1)} MB`);
          }
          return React.createElement('span', { className: 'text-dark-600 font-medium' }, `${kb.toFixed(0)} KB`);
        }
      }
    ],

    fields: [
      // ========== ATTACHMENT ==========
      {
        key: 'attachment',
        label: 'Receipt Attachment',
        type: 'text',
        readonly: true,
        placeholder: 'S3 URI - Auto-populated from uploaded receipt'
      },
      {
        key: 'attachment_format',
        label: 'File Format',
        type: 'text',
        readonly: true,
        placeholder: 'Auto-populated from uploaded receipt (e.g., pdf, png, jpg)'
      },
      {
        key: 'attachment_size_bytes',
        label: 'File Size (bytes)',
        type: 'number',
        readonly: true,
        placeholder: 'Auto-populated from uploaded receipt'
      },

      // ========== BASIC INFORMATION ==========
      { key: 'name', label: 'Revenue Name', type: 'text', required: true, placeholder: 'e.g., Product Sales Q1 2025' },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., REV-2025-001' },
      { key: 'revenue_code', label: 'Revenue Code', type: 'text', required: true, placeholder: 'e.g., INC-PRODUCT-SALES' },
      { key: 'descr', label: 'Description', type: 'richtext', placeholder: 'Describe the revenue source and details...' },

      // ========== FINANCIAL INFORMATION ==========
      { key: 'revenue_amt_local', label: 'Revenue Amount (CAD)', type: 'number', required: true, placeholder: '0.00' },
      { key: 'revenue_amt_invoice', label: 'Invoice Amount', type: 'number', placeholder: '0.00' },
      {
        key: 'invoice_currency',
        label: 'Currency',
        type: 'select',
        defaultValue: 'CAD',
        options: [
          { value: 'CAD', label: 'CAD' },
          { value: 'USD', label: 'USD' },
          { value: 'EUR', label: 'EUR' },
          { value: 'GBP', label: 'GBP' }
        ]
      },
      { key: 'exch_rate', label: 'Exchange Rate', type: 'number', placeholder: '1.00' },
      { key: 'revenue_forecasted_amt_lcl', label: 'Forecasted Amount (CAD)', type: 'number', placeholder: '0.00' },

      // ========== ADDITIONAL ==========,
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // SERVICE
  // --------------------------------------------------------------------------
  service: {
    name: 'service',
    displayName: 'Service',
    pluralName: 'Services',
    apiEndpoint: '/api/v1/service',

    columns: generateStandardColumns(
      ['name', 'code', 'service_category', 'standard_rate_amt', 'estimated_hours', 'minimum_charge_amt', 'skill_level', 'equipment_required', 'permit_required', 'requires_certification_flag', 'warranty_months', 'taxable_flag', 'created_ts', 'updated_ts']
    ),

    // ✅ DRY Pattern: Using field generators for automatic field definitions
    // Universal fields (metadata, created_ts, updated_ts) are auto-appended
    fields: generateEntityFields(
      [
        'name',                        // Auto-detected: text, required
        'code',                        // Auto-detected: text, required
        'descr',                       // Auto-detected: richtext
        'service_category',            // Auto-detected: text
        'standard_rate_amt',           // Auto-detected: number (suffix: _amt)
        'estimated_hours',             // Auto-detected: number
        'minimum_charge_amt',          // Auto-detected: number (suffix: _amt)
        'taxable_flag',                // Auto-detected: boolean select (suffix: _flag)
        'requires_certification_flag'  // Auto-detected: boolean select (suffix: _flag)
      ],
      {
        overrides: {
          name: { label: 'Service Name' },
          code: { label: 'Service Code' },
          service_category: {
            label: 'Category',
            loadOptionsFromSettings: 'dl__service_category'
          }
        }
      }
    ),

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // PRODUCT
  // --------------------------------------------------------------------------
  product: {
    name: 'product',
    displayName: 'Product',
    pluralName: 'Products',
    apiEndpoint: '/api/v1/product',

    columns: generateStandardColumns(
      ['name', 'code', 'style', 'sku', 'upc', 'product_category', 'dl__product_brand', 'item_level', 'tran_level', 'unit_of_measure', 'reorder_level_qty', 'reorder_qty', 'taxable_flag', 'supplier_part_number', 'active_flag', 'created_ts', 'updated_ts']
    ),

    // ✅ DRY Pattern: Using field generators for automatic field definitions
    fields: generateEntityFields(
      [
        'name',
        'code',
        'descr',
        'product_category',
        'unit_price_amt',         // Auto-detected: number (suffix: _amt)
        'cost_amt',               // Auto-detected: number (suffix: _amt)
        'unit_of_measure',
        'on_hand_qty',
        'reorder_level_qty',
        'reorder_qty',
        'taxable_flag',           // Auto-detected: boolean select (suffix: _flag)
        'supplier_name',          // Auto-detected: text (suffix: _name)
        'supplier_part_number',
        'warranty_months'
      ],
      {
        overrides: {
          name: { label: 'Product Name' },
          code: { label: 'Product Code (SKU)' },
          product_category: { label: 'Category' },
          unit_of_measure: { label: 'Unit of Measure', placeholder: 'each, box, gallon, etc.' }
        }
      }
    ),

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // QUOTE
  // --------------------------------------------------------------------------
  quote: {
    name: 'quote',
    displayName: 'Quote',
    pluralName: 'Quotes',
    apiEndpoint: '/api/v1/quote',
    shareable: true,

    columns: generateStandardColumns(
      ['name', 'code', 'dl__quote_stage', 'customer_name', 'customer_email', 'customer_phone', 'subtotal_amt', 'discount_amt', 'tax_amt', 'quote_total_amt', 'valid_until_date', 'prepared_by', 'created_ts', 'updated_ts']
    ),

    // ✅ DRY Pattern: Using field generators for automatic field definitions
    fields: generateEntityFields(
      [
        'name',
        'code',
        'descr',
        'dl__quote_stage',        // Auto-detected: select + loadOptionsFromSettings (prefix: dl__)
        'customer_name',          // Auto-detected: text (suffix: _name)
        'customer_email',         // Auto-detected: text (suffix: _email)
        'customer_phone',         // Auto-detected: text (suffix: _phone)
        'quote_items',
        'subtotal_amt',           // Auto-detected: number (suffix: _amt)
        'discount_pct',           // Auto-detected: number (suffix: _pct)
        'discount_amt',           // Auto-detected: number (suffix: _amt)
        'tax_pct',                // Auto-detected: number (suffix: _pct)
        'quote_tax_amt',          // Auto-detected: number (suffix: _amt)
        'quote_total_amt',        // Auto-detected: number (suffix: _amt)
        'valid_until_date',       // Auto-detected: date (suffix: _date)
        'sent_date',              // Auto-detected: date (suffix: _date)
        'accepted_date',          // Auto-detected: date (suffix: _date)
        'rejected_date',          // Auto-detected: date (suffix: _date)
        'internal_notes',
        'customer_notes'
      ],
      {
        overrides: {
          name: { label: 'Quote Name' },
          code: { label: 'Quote Code' },
          quote_items: { label: 'Quote Items', type: 'jsonb' },
          internal_notes: { type: 'textarea' },
          customer_notes: { type: 'textarea' },
          discount_pct: { label: 'Discount %' },
          tax_pct: { label: 'Tax %' }
        }
      }
    ),

    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    kanban: {
      groupByField: 'dl__quote_stage',
      metaTable: 'dl__quote_stage',
      cardFields: ['name', 'quote_total_amt', 'customer_name', 'valid_until_date']
    }
  },

  // --------------------------------------------------------------------------
  // WORK ORDER
  // --------------------------------------------------------------------------
  work_order: {
    name: 'work_order',
    displayName: 'Work Order',
    pluralName: 'Work Orders',
    apiEndpoint: '/api/v1/work_order',
    shareable: true,

    columns: generateStandardColumns(
      ['name', 'code', 'dl__work_order_status', 'customer_name', 'scheduled_date', 'started_ts', 'completed_ts', 'labor_hours', 'labor_cost_amt', 'materials_cost_amt', 'total_cost_amt', 'phase', 'total_phases', 'quote_id', 'customer_signature_flag', 'created_ts', 'updated_ts']
    ),

    // ✅ DRY Pattern: Using field generators for automatic field definitions
    fields: [
      ...generateEntityFields(
        [
          'name',
          'code',
          'descr',
          'dl__work_order_status',     // Auto-detected: select + loadOptionsFromSettings (prefix: dl__)
          'scheduled_date',             // Auto-detected: date (suffix: _date)
          'scheduled_start_time',
          'scheduled_end_time',
          'labor_hours',
          'labor_cost_amt',             // Auto-detected: number (suffix: _amt)
          'materials_cost_amt',         // Auto-detected: number (suffix: _amt)
          'total_cost_amt',             // Auto-detected: number (suffix: _amt)
          'customer_name',              // Auto-detected: text (suffix: _name)
          'customer_email',             // Auto-detected: text (suffix: _email)
          'customer_phone',             // Auto-detected: text (suffix: _phone)
          'service_address_line1',
          'service_city',
          'service_postal_code',
          'customer_signature_flag',    // Auto-detected: boolean select (suffix: _flag)
          'customer_satisfaction_rating',
          'completion_notes',
          'internal_notes'
        ],
        {
          overrides: {
            name: { label: 'Work Order Name' },
            code: { label: 'Work Order Code' },
            dl__work_order_status: { label: 'Status' },
            service_city: { label: 'City' },
            service_postal_code: { label: 'Postal Code' },
            customer_signature_flag: {
              label: 'Customer Signature',
              options: [
                { value: 'true', label: 'Signed' },
                { value: 'false', label: 'Not Signed' }
              ]
            },
            customer_satisfaction_rating: { label: 'Satisfaction Rating (1-5)' },
            completion_notes: { type: 'textarea' },
            internal_notes: { type: 'textarea' }
          }
        }
      ).filter(f => !['metadata', 'created_ts', 'updated_ts'].includes(f.key)),
      // Add multi-select for technician assignment (similar to task assignees)
      { key: 'assigned_technician_ids', label: 'Assigned Technicians', type: 'multiselect', loadOptionsFromEntity: 'employee' },
      // Add back universal fields
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    kanban: {
      groupByField: 'dl__work_order_status',
      metaTable: 'dl__work_order_status',
      cardFields: ['name', 'scheduled_date', 'assigned_technician_ids', 'total_cost_amt', 'customer_name']
    }
  },

  // --------------------------------------------------------------------------
  // WORKFLOW
  // --------------------------------------------------------------------------
  workflow: {
    name: 'workflow',
    displayName: 'Workflow',
    pluralName: 'Workflows',
    apiEndpoint: '/api/v1/workflow',

    columns: generateStandardColumns(
      ['workflow_instance_id', 'code', 'name', 'workflow_template_name', 'workflow_template_code', 'industry_sector', 'current_state_name', 'current_state_id', 'entity_name', 'entity_id', 'terminal_flag', 'created_ts', 'updated_ts']
    ),

    fields: [
      { key: 'workflow_instance_id', label: 'Workflow Instance ID', type: 'text', readonly: true },
      { key: 'workflow_template_id', label: 'Template ID', type: 'text', readonly: true },
      { key: 'workflow_template_name', label: 'Template Name', type: 'text', readonly: true },
      { key: 'industry_sector', label: 'Industry', type: 'text', readonly: true },
      { key: 'customer_entity_id', label: 'Customer ID', type: 'text', readonly: true },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table',

    // Use workflow_instance_id for detail page navigation instead of id
    detailPageIdField: 'workflow_instance_id'
  },

  // --------------------------------------------------------------------------
  // EVENT (Meetings, Appointments, Trainings, Consultations)
  // --------------------------------------------------------------------------
  event: {
    name: 'event',
    displayName: 'Event',
    pluralName: 'Events',
    apiEndpoint: '/api/v1/event',
    shareable: true,

    columns: generateStandardColumns(
      ['name', 'code', 'event_type', 'event_platform_provider_name', 'from_ts', 'to_ts', 'timezone', 'event_addr', 'event_instructions', 'created_ts']
    ),

    fields: [
      { key: 'code', label: 'Event Code', type: 'text', required: true },
      { key: 'name', label: 'Event Title', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      {
        key: 'event_type',
        label: 'Event Type',
        type: 'select',
        required: true,
        options: [
          { value: 'onsite', label: 'On-site' },
          { value: 'virtual', label: 'Virtual' }
        ]
      },
      {
        key: 'event_platform_provider_name',
        label: 'Platform/Venue',
        type: 'select',
        required: true,
        options: [
          { value: 'zoom', label: 'Zoom' },
          { value: 'teams', label: 'Microsoft Teams' },
          { value: 'google_meet', label: 'Google Meet' },
          { value: 'physical_hall', label: 'Physical Hall' },
          { value: 'office', label: 'Office' }
        ]
      },
      { key: 'event_addr', label: 'Address or Meeting URL', type: 'text' },
      { key: 'event_instructions', label: 'Special Instructions', type: 'textarea' },
      { key: 'from_ts', label: 'Start Time', type: 'date', required: true },
      { key: 'to_ts', label: 'End Time', type: 'date', required: true },
      { key: 'timezone', label: 'Timezone', type: 'text' },
      { key: 'event_metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table', 'calendar'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // PERSON CALENDAR (Universal Availability/Booking Calendar)
  // --------------------------------------------------------------------------
  person_calendar: {
    name: 'person_calendar',
    displayName: 'Calendar Slot',
    pluralName: 'Calendar',
    apiEndpoint: '/api/v1/person-calendar',

    columns: generateStandardColumns(
      ['name', 'code', 'person_entity_type', 'person_entity_id', 'event_id', 'from_ts', 'to_ts', 'timezone', 'availability_flag', 'title', 'appointment_medium', 'appointment_addr', 'instructions', 'confirmation_sent_flag', 'reminder_sent_flag', 'created_ts', 'updated_ts']
    ),

    fields: [
      { key: 'name', label: 'Slot Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },

      // Person Identification
      { key: 'person_entity_type', label: 'Person Type', type: 'select', required: true, options: [
        { value: 'employee', label: 'Employee' },
        { value: 'client', label: 'Client' },
        { value: 'customer', label: 'Customer' }
      ]},
      { key: 'person_entity_id', label: 'Person', type: 'text', required: true },

      // Time Slot
      { key: 'from_ts', label: 'Start Time', type: 'timestamp', required: true },
      { key: 'to_ts', label: 'End Time', type: 'timestamp', required: true },
      { key: 'timezone', label: 'Timezone', type: 'text' },

      // Availability
      { key: 'availability_flag', label: 'Available', type: 'checkbox' },

      // Appointment Details (when booked)
      { key: 'title', label: 'Appointment Title', type: 'text' },
      { key: 'appointment_medium', label: 'Meeting Type', type: 'select', options: [
        { value: 'onsite', label: 'Onsite' },
        { value: 'virtual', label: 'Virtual' }
      ]},
      { key: 'appointment_addr', label: 'Address', type: 'textarea' },
      { key: 'instructions', label: 'Instructions', type: 'textarea' },

      // Metadata (project_id, task_id, interaction_id, etc.)
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },

      // Notifications
      { key: 'reminder_sent_flag', label: 'Reminder Sent', type: 'checkbox', readonly: true },
      { key: 'confirmation_sent_flag', label: 'Confirmation Sent', type: 'checkbox', readonly: true },

      // Timestamps
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table', 'kanban', 'calendar'],
    defaultView: 'table',

    kanbanConfig: {
      groupByField: 'availability_flag',
      titleField: 'title',
      subtitleField: 'from_ts'
    },

    calendarConfig: {
      dateField: 'from_ts',
      endDateField: 'to_ts',
      titleField: 'title',
      personField: 'person_entity_id',
      personTypeField: 'person_entity_type',
      statusField: 'availability_flag'
    }
  },

  // --------------------------------------------------------------------------
  // INTERACTION (Customer Interactions)
  // --------------------------------------------------------------------------
  interaction: {
    name: 'interaction',
    displayName: 'Interaction',
    pluralName: 'Interactions',
    apiEndpoint: '/api/v1/interaction',

    columns: generateStandardColumns(
      ['interaction_number', 'interaction_type', 'interaction_subtype', 'channel', 'interaction_ts', 'duration_seconds', 'wait_time_seconds', 'talk_time_seconds', 'sentiment_score', 'sentiment_label', 'customer_satisfaction_score', 'emotion_tags', 'interaction_reason', 'interaction_category', 'priority_level', 'consent_recorded', 'attachment_count', 'content_summary', 'created_ts', 'updated_ts']
    ),

    fields: [
      // Identification
      { key: 'interaction_number', label: 'Interaction Number', type: 'text', required: true },
      { key: 'interaction_type', label: 'Type', type: 'select', required: true, options: [
        { value: 'voice_call', label: 'Voice Call' },
        { value: 'chat', label: 'Chat' },
        { value: 'email', label: 'Email' },
        { value: 'sms', label: 'SMS' },
        { value: 'video_call', label: 'Video Call' },
        { value: 'social_media', label: 'Social Media' },
        { value: 'in_person', label: 'In Person' }
      ]},
      { key: 'interaction_subtype', label: 'Subtype', type: 'select', options: [
        { value: 'inbound', label: 'Inbound' },
        { value: 'outbound', label: 'Outbound' },
        { value: 'follow_up', label: 'Follow Up' },
        { value: 'escalation', label: 'Escalation' }
      ]},
      { key: 'channel', label: 'Channel', type: 'select', required: true, options: [
        { value: 'phone', label: 'Phone' },
        { value: 'live_chat', label: 'Live Chat' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'email', label: 'Email' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'twitter', label: 'Twitter' },
        { value: 'zoom', label: 'Zoom' },
        { value: 'in_store', label: 'In Store' }
      ]},

      // Timing
      { key: 'interaction_ts', label: 'Interaction Time', type: 'timestamp' },
      { key: 'duration_seconds', label: 'Duration (seconds)', type: 'number' },

      // Person Entities (JSONB)
      { key: 'interaction_person_entities', label: 'People Involved', type: 'jsonb' },
      { key: 'interaction_intention_entity', label: 'Intention (Create)', type: 'select', options: [
        { value: 'task', label: 'Task' },
        { value: 'project', label: 'Project' },
        { value: 'quote', label: 'Quote' },
        { value: 'opportunity', label: 'Opportunity' }
      ]},

      // Content
      { key: 'content_format', label: 'Content Format', type: 'text' },
      { key: 'content_text', label: 'Content Text', type: 'textarea' },
      { key: 'content_summary', label: 'Summary', type: 'textarea' },
      { key: 'transcript_text', label: 'Transcript', type: 'textarea' },

      // Sentiment & Analytics
      { key: 'sentiment_score', label: 'Sentiment Score (-100 to 100)', type: 'number' },
      { key: 'sentiment_label', label: 'Sentiment', type: 'select', options: [
        { value: 'positive', label: 'Positive' },
        { value: 'neutral', label: 'Neutral' },
        { value: 'negative', label: 'Negative' },
        { value: 'mixed', label: 'Mixed' }
      ]},
      { key: 'customer_satisfaction_score', label: 'CSAT Score', type: 'number' },
      { key: 'emotion_tags', label: 'Emotion Tags', type: 'array' },

      // Classification
      { key: 'interaction_reason', label: 'Reason', type: 'text' },
      { key: 'interaction_category', label: 'Category', type: 'text' },
      { key: 'priority_level', label: 'Priority', type: 'select', options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'critical', label: 'Critical' }
      ]},

      // Metadata
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },

      // Timestamps
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // CALENDAR
  // --------------------------------------------------------------------------
  calendar: {
    name: 'calendar',
    displayName: 'Calendar',
    pluralName: 'Calendars',
    apiEndpoint: '/api/v1/person-calendar',

    columns: generateStandardColumns(
      ['name', 'code', 'person_entity_type', 'person_entity_id', 'event_id', 'from_ts', 'to_ts', 'timezone', 'availability_flag', 'title', 'appointment_medium', 'appointment_addr', 'instructions', 'confirmation_sent_flag', 'reminder_sent_flag', 'created_ts', 'updated_ts']
    ),

    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Slot Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      {
        key: 'person_entity_type',
        label: 'Person Type',
        type: 'select',
        required: true,
        options: [
          { value: 'employee', label: 'Employee' },
          { value: 'client', label: 'Client' },
          { value: 'customer', label: 'Customer' }
        ]
      },
      {
        key: 'person_entity_id',
        label: 'Person',
        type: 'select',
        required: true,
        loadOptionsFrom: 'employee', // Default to employee, will be overridden by conditional logic
        conditionalOptions: {
          dependsOn: 'person_entity_type',
          mapping: {
            'employee': 'employee',
            'client': 'client',
            'customer': 'cust'
          }
        }
      },
      { key: 'from_ts', label: 'Start Time', type: 'date', required: true },
      { key: 'to_ts', label: 'End Time', type: 'date', required: true },
      { key: 'timezone', label: 'Timezone', type: 'text' },
      {
        key: 'availability_flag',
        label: 'Available',
        type: 'select',
        options: [
          { value: 'true', label: 'Available' },
          { value: 'false', label: 'Booked' }
        ],
        coerceBoolean: true
      },
      { key: 'title', label: 'Event Title', type: 'text' },
      {
        key: 'appointment_medium',
        label: 'Appointment Medium',
        type: 'select',
        options: [
          { value: 'onsite', label: 'Onsite' },
          { value: 'virtual', label: 'Virtual' }
        ]
      },
      { key: 'appointment_addr', label: 'Address/URL', type: 'textarea' },
      { key: 'instructions', label: 'Instructions', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table', 'calendar'],
    defaultView: 'calendar'
  },

  // --------------------------------------------------------------------------
  // CHAT (AI Chat Widget)
  // --------------------------------------------------------------------------
  chat: {
    name: 'chat',
    displayName: 'AI Chat',
    pluralName: 'AI Chat',
    apiEndpoint: '/api/v1/chat',

    columns: [],

    fields: [],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // MESSAGE SCHEMA (Email/SMS/Push Templates)
  // --------------------------------------------------------------------------
  message_schema: {
    name: 'message_schema',
    displayName: 'Message Schema',
    pluralName: 'Message Schemas',
    apiEndpoint: '/api/v1/message-schema',

    columns: generateStandardColumns(
      ['code', 'name', 'message_delivery_method', 'status', 'subject', 'from_email', 'from_name', 'sms_sender_id', 'created_ts'],
      {
        overrides: {
          message_delivery_method: {
            title: 'Type',
            render: (value) => renderBadge(value || 'EMAIL', {
              'EMAIL': 'bg-blue-100 text-blue-800',
              'SMS': 'bg-green-100 text-green-800',
              'PUSH': 'bg-purple-100 text-purple-800'
            })
          },
          status: {
            title: 'Status',
            render: (value) => renderBadge(value || 'draft', {
              'published': 'bg-green-100 text-green-800',
              'draft': 'bg-yellow-100 text-yellow-800',
              'archived': 'bg-gray-100 text-gray-800'
            })
          }
        }
      }
    ),

    fields: [
      { key: 'name', label: 'Template Name', type: 'text', required: true },
      { key: 'code', label: 'Template Code', type: 'text', required: true },
      {
        key: 'message_delivery_method',
        label: 'Delivery Method',
        type: 'select',
        required: true,
        options: [
          { value: 'EMAIL', label: 'Email' },
          { value: 'SMS', label: 'SMS' },
          { value: 'PUSH', label: 'Push Notification' }
        ]
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'published', label: 'Published' },
          { value: 'archived', label: 'Archived' }
        ]
      },
      { key: 'subject', label: 'Subject (Email Only)', type: 'text' },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'from_name', label: 'From Name (Email)', type: 'text' },
      { key: 'from_email', label: 'From Email', type: 'text' },
      { key: 'reply_to_email', label: 'Reply To Email', type: 'text' },
      { key: 'sms_sender_id', label: 'SMS Sender ID', type: 'text' },
      { key: 'push_priority', label: 'Push Priority', type: 'select', options: [
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' }
      ]},
      { key: 'push_ttl', label: 'Push TTL (seconds)', type: 'number' },
      { key: 'template_schema', label: 'Template Schema', type: 'jsonb' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // MESSAGE (Sent/Scheduled Messages)
  // --------------------------------------------------------------------------
  message: {
    name: 'message',
    displayName: 'Message',
    pluralName: 'Messages',
    apiEndpoint: '/api/v1/message-data',

    columns: generateStandardColumns(
      ['code', 'message_delivery_method', 'status', 'recipient_email', 'recipient_phone', 'recipient_name', 'subject', 'scheduled_ts', 'sent_ts', 'delivered_ts', 'created_ts'],
      {
        overrides: {
          message_delivery_method: {
            title: 'Type',
            render: (value) => renderBadge(value || 'EMAIL', {
              'EMAIL': 'bg-blue-100 text-blue-800',
              'SMS': 'bg-green-100 text-green-800',
              'PUSH': 'bg-purple-100 text-purple-800'
            })
          },
          status: {
            title: 'Status',
            render: (value) => renderBadge(value || 'pending', {
              'pending': 'bg-yellow-100 text-yellow-800',
              'scheduled': 'bg-blue-100 text-blue-800',
              'sent': 'bg-green-100 text-green-800',
              'delivered': 'bg-emerald-100 text-emerald-800',
              'failed': 'bg-red-100 text-red-800',
              'bounced': 'bg-orange-100 text-orange-800'
            })
          },
          recipient_email: {
            title: 'Email',
            render: (value) => value || '-'
          },
          recipient_phone: {
            title: 'Phone',
            render: (value) => value || '-'
          }
        }
      }
    ),

    fields: [
      { key: 'message_schema_id', label: 'Message Template', type: 'select', loadOptionsFromEntity: 'message_schema', required: true },
      { key: 'recipient_email', label: 'Recipient Email', type: 'text' },
      { key: 'recipient_phone', label: 'Recipient Phone', type: 'text' },
      { key: 'recipient_device_token', label: 'Device Token (Push)', type: 'text' },
      { key: 'recipient_name', label: 'Recipient Name', type: 'text' },
      { key: 'recipient_entity_id', label: 'Recipient Entity ID', type: 'text' },
      { key: 'scheduled_ts', label: 'Scheduled Time', type: 'date' },
      { key: 'content_data', label: 'Content Data', type: 'jsonb', required: true },
      { key: 'status', label: 'Status', type: 'text', readonly: true },
      { key: 'sent_ts', label: 'Sent Time', type: 'date', readonly: true },
      { key: 'delivered_ts', label: 'Delivered Time', type: 'date', readonly: true },
      { key: 'error_code', label: 'Error Code', type: 'text', readonly: true },
      { key: 'error_message', label: 'Error Message', type: 'textarea', readonly: true },
      { key: 'retry_count', label: 'Retry Count', type: 'number', readonly: true },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // OFFICE HIERARCHY (Organizational Structure)
  // --------------------------------------------------------------------------
  office_hierarchy: {
    name: 'office_hierarchy',
    displayName: 'Office Hierarchy',
    pluralName: 'Office Hierarchies',
    apiEndpoint: '/api/v1/office-hierarchy',

    columns: generateStandardColumns(
      ['code', 'name', 'dl__office_hierarchy_level', 'parent_id', 'manager_employee_id', 'budget_allocated_amt', 'created_ts']
    ),

    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'parent_id', label: 'Parent Node', type: 'select', loadOptionsFromEntity: 'office_hierarchy' },
      { key: 'dl__office_hierarchy_level', label: 'Level', type: 'select', loadOptionsFromSettings: true, required: true },
      { key: 'manager_employee_id', label: 'Manager', type: 'select', loadOptionsFromEntity: 'employee' },
      { key: 'budget_allocated_amt', label: 'Budget Allocated', type: 'number' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // BUSINESS HIERARCHY (Organizational Structure)
  // --------------------------------------------------------------------------
  business_hierarchy: {
    name: 'business_hierarchy',
    displayName: 'Business Hierarchy',
    pluralName: 'Business Hierarchies',
    apiEndpoint: '/api/v1/business-hierarchy',

    columns: generateStandardColumns(
      ['code', 'name', 'dl__business_hierarchy_level', 'parent_id', 'manager_employee_id', 'budget_allocated_amt', 'created_ts']
    ),

    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'parent_id', label: 'Parent Node', type: 'select', loadOptionsFromEntity: 'business_hierarchy' },
      { key: 'dl__business_hierarchy_level', label: 'Level', type: 'select', loadOptionsFromSettings: true, required: true },
      { key: 'manager_employee_id', label: 'Manager', type: 'select', loadOptionsFromEntity: 'employee' },
      { key: 'budget_allocated_amt', label: 'Budget Allocated', type: 'number' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // PRODUCT HIERARCHY (Product Categorization)
  // --------------------------------------------------------------------------
  product_hierarchy: {
    name: 'product_hierarchy',
    displayName: 'Product Hierarchy',
    pluralName: 'Product Hierarchies',
    apiEndpoint: '/api/v1/product-hierarchy',

    columns: generateStandardColumns(
      ['code', 'name', 'dl__product_hierarchy_level', 'parent_id', 'created_ts']
    ),

    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'parent_id', label: 'Parent Node', type: 'select', loadOptionsFromEntity: 'product_hierarchy' },
      { key: 'dl__product_hierarchy_level', label: 'Level', type: 'select', loadOptionsFromSettings: true, required: true },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  }
};

// ============================================================================
// AUTO-APPLY SETTINGS BADGE RENDERERS (DRY Enhancement)
// ============================================================================

/**
 * Automatically apply badge renderers to all columns with loadOptionsFromSettings
 * This eliminates the need to manually specify render functions for settings fields
 *
 * BEFORE (Manual):
 * { key: 'project_stage', loadOptionsFromSettings: true, render: renderSettingBadge('project_stage') }
 *
 * AFTER (Automatic):
 * { key: 'project_stage', loadOptionsFromSettings: true }  // ← render added automatically!
 */
Object.keys(entityConfigs).forEach(entityKey => {
  const config = entityConfigs[entityKey];
  if (config.columns) {
    config.columns = applySettingsBadgeRenderers(config.columns);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get entity configuration by name
 */
export function getEntityConfig(entityName: string): EntityConfig | undefined {
  return entityConfigs[entityName];
}

/**
 * Get all entity names
 */
export function getAllEntityNames(): string[] {
  return Object.keys(entityConfigs);
}

/**
 * Check if entity supports a specific view
 */
export function supportsView(entityName: string, view: ViewMode): boolean {
  const config = getEntityConfig(entityName);
  return config ? config.supportedViews.includes(view) : false;
}

/**
 * Get default view for entity
 */
export function getDefaultView(entityName: string): ViewMode {
  const config = getEntityConfig(entityName);
  return config?.defaultView || 'table';
}

/**
 * Get all shareable entity names
 * Returns: ['task', 'artifact', 'wiki', 'form']
 */
export function getShareableEntities(): string[] {
  return Object.keys(entityConfigs).filter(
    name => entityConfigs[name].shareable === true
  );
}

/**
 * Check if entity supports sharing
 */
export function isShareable(entityName: string): boolean {
  const config = getEntityConfig(entityName);
  return config?.shareable === true;
}

/**
 * Shareable entities configuration
 * Centralized list of entities that support shared URLs
 */
export const SHAREABLE_ENTITIES = {
  task: {
    name: 'task',
    displayName: 'Task',
    icon: 'CheckSquare',
    detailFields: ['name', 'descr', 'stage', 'priority_level', 'estimated_hours', 'actual_hours', 'story_points'],
    hasUpdates: true, // Shows task updates/comments
  },
  artifact: {
    name: 'artifact',
    displayName: 'Artifact',
    icon: 'FileText',
    detailFields: ['name', 'descr', 'artifact_type', 'file_format', 'file_size_bytes'],
    hasUpdates: false},
  wiki: {
    name: 'wiki',
    displayName: 'Wiki',
    icon: 'BookOpen',
    detailFields: ['name', 'descr'],
    hasUpdates: false,
    customRenderer: true, // Uses WikiContentRenderer
  },
  form: {
    name: 'form',
    displayName: 'Form',
    icon: 'FileText',
    detailFields: ['name', 'descr', 'form_schema'],
    hasUpdates: false,
    customRenderer: true, // Uses InteractiveForm
  }} as const;

export type ShareableEntityType = keyof typeof SHAREABLE_ENTITIES;
