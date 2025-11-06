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
      ['name', 'code', 'descr', 'dl__project_stage', 'budget_allocated_amt', 'planned_start_date', 'planned_end_date', 'created_ts'],
      {
        overrides: {
          dl__project_stage: {
            title: 'Stage'
          },
          budget_allocated_amt: {
            title: 'Budget',
            render: (value, record) => formatCurrency(value, record.budget_currency)
          },
          planned_start_date: {
            title: 'Start Date'
          },
          planned_end_date: {
            title: 'End Date'
          }
        }
      }
    ),

    fields: [
      { key: 'name', label: 'Project Name', type: 'text', required: true },
      { key: 'code', label: 'Project Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'dl__project_stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'budget_allocated_amt', label: 'Budget', type: 'number' },
      { key: 'planned_start_date', label: 'Start Date', type: 'date' },
      { key: 'planned_end_date', label: 'End Date', type: 'date' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
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
      ['name', 'code', 'descr', 'dl__task_stage', 'dl__task_priority', 'estimated_hours', 'actual_hours', 'assignee_employee_ids', 'created_ts'],
      {
        overrides: {
          dl__task_stage: {
            title: 'Stage'
          },
          dl__task_priority: {
            title: 'Priority'
          },
          estimated_hours: {
            title: 'Est. Hours',
            render: (value) => value ? `${value}h` : '-'
          },
          actual_hours: {
            title: 'Actual Hours',
            render: (value) => value ? `${value}h` : '-'
          },
          assignee_employee_ids: {
            title: 'Assignees',
            sortable: false,
            filterable: false,
            render: (value, record) => renderEmployeeNames(value, record)
          }
        }
      }
    ),

    fields: [
      { key: 'name', label: 'Task Name', type: 'text', required: true },
      { key: 'code', label: 'Task Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'dl__task_stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'dl__task_priority', label: 'Priority', type: 'select', loadOptionsFromSettings: true },
      { key: 'estimated_hours', label: 'Estimated Hours', type: 'number' },
      { key: 'assignee_employee_ids', label: 'Assignees', type: 'multiselect', loadOptionsFromEntity: 'employee' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
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

    columns: generateColumns(['title', 'wiki_type', 'publication_status', 'category', 'updated_ts'], {
      overrides: {
        title: {
          render: (value, record) => React.createElement(
            'div',
            null,
            React.createElement(
              'div',
              { className: 'flex items-center gap-2' },
              record.attr?.icon && React.createElement('span', { className: 'text-lg' }, record.attr.icon),
              React.createElement('span', { className: 'font-medium text-dark-600' }, value)
            )
          )
        },
        wiki_type: {
          title: 'Type',
          render: (value) => renderBadge(value || 'page', {
            'page': 'bg-dark-100 text-dark-600',
            'template': 'bg-purple-100 text-purple-800',
            'workflow': 'bg-green-100 text-green-800',
            'guide': 'bg-yellow-100 text-yellow-800',
            'policy': 'bg-red-100 text-red-800',
            'checklist': 'bg-indigo-100 text-indigo-800'
          })
        },
        publication_status: {
          title: 'Status',
          loadOptionsFromSettings: true,
          render: (value) => {
            const status = value || 'draft';
            return renderBadge(status, {
              'published': 'bg-green-100 text-green-800',
              'draft': 'bg-yellow-100 text-yellow-800',
              'review': 'bg-dark-100 text-dark-600',
              'archived': 'bg-dark-100 text-dark-600',
              'deprecated': 'bg-red-100 text-red-800',
              'private': 'bg-purple-100 text-purple-800'
            });
          }
        },
        updated_ts: {
          title: 'Last Updated'
        }
      }
    }),

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
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
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
      ['name', 'artifact_type', 'visibility', 'security_classification', 'attachment_format', 'attachment_size_bytes', 'entity_type', 'created_ts'],
      {
        overrides: {
          name: {
            width: '300px',
            render: (value, record) => React.createElement(
              'div',
              { className: 'py-1' },
              React.createElement(
                'div',
                { className: 'flex items-center gap-2 mb-0.5' },
                React.createElement('div', { className: 'font-medium text-dark-600' }, value),
                record.attachment_object_key && React.createElement(
                  'div',
                  { className: 'flex-shrink-0 w-2 h-2 rounded-full bg-green-500', title: 'File uploaded' },
                  null
                )
              ),
              record.descr && React.createElement('div', { className: 'text-xs text-dark-700 line-clamp-1 mb-1' }, record.descr),
              React.createElement(
                'div',
                { className: 'flex items-center gap-1.5' },
                record.version > 1 && React.createElement(
                  'span',
                  { className: 'inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-dark-100 text-dark-700 rounded border border-dark-400' },
                  `v${record.version}`
                ),
                !record.attachment_object_key && React.createElement(
                  'span',
                  { className: 'inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded border border-amber-200' },
                  'No file'
                )
              )
            )
          },
          artifact_type: {
            title: 'Type',
            width: '120px',
            render: (value) => renderBadge(value, {
              'document': 'bg-dark-100 text-dark-600',
              'template': 'bg-purple-100 text-purple-800',
              'image': 'bg-green-100 text-green-800',
              'video': 'bg-rose-100 text-rose-800',
              'spreadsheet': 'bg-emerald-100 text-emerald-800',
              'presentation': 'bg-orange-100 text-orange-800'
            })
          },
          visibility: {
            width: '110px',
            render: (value) => renderBadge(value, {
              'public': 'bg-green-100 text-green-800',
              'internal': 'bg-dark-100 text-dark-600',
              'restricted': 'bg-amber-100 text-amber-800',
              'private': 'bg-dark-100 text-dark-600'
            })
          },
          security_classification: {
            title: 'Security',
            width: '120px',
            render: (value) => renderBadge(value, {
              'general': 'bg-dark-100 text-dark-600',
              'confidential': 'bg-orange-100 text-orange-800',
              'restricted': 'bg-red-100 text-red-800'
            })
          },
          attachment_format: {
            title: 'Format',
            width: '90px',
            render: (value) => value ? React.createElement(
              'span',
              { className: 'inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-dark-100 text-dark-600 rounded border border-dark-300' },
              value.toUpperCase()
            ) : '-'
          },
          attachment_size_bytes: {
            title: 'Size',
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
          },
          entity_type: {
            title: 'Linked To',
            width: '110px',
            render: (value) => value ? renderBadge(value, {
              'project': 'bg-indigo-100 text-indigo-800',
              'task': 'bg-cyan-100 text-cyan-800',
              'office': 'bg-violet-100 text-violet-800',
              'business': 'bg-fuchsia-100 text-fuchsia-800'
            }) : '-'
          },
          created_ts: {
            width: '100px'
          }
        }
      }
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
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
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

    columns: generateColumns(['name', 'active_flag', 'version', 'updated_ts'], {
      overrides: {
        name: {
          title: 'Form Name'
        },
        active_flag: {
          title: 'Status',
          render: (value) => value
            ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
            : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-100 text-dark-600' }, 'Inactive')
        },
        version: {
          align: 'center' as const
        }
      }
    }),

    fields: [
      { key: 'name', label: 'Form Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'url', label: 'Public Form URL', type: 'text', readonly: true },
      { key: 'schema', label: 'Form Schema', type: 'jsonb', required: true },
      { key: 'active_flag', label: 'Active', type: 'select', options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' }
      ]},
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // BUSINESS (biz)
  // --------------------------------------------------------------------------
  biz: {
    name: 'biz',
    displayName: 'Business Unit',
    pluralName: 'Business Units',
    apiEndpoint: '/api/v1/biz',

    columns: generateStandardColumns(
      ['name', 'code', 'dl__business_level', 'budget_allocated_amt', 'descr', 'active_flag', 'created_ts'],
      {
        overrides: {
          dl__business_level: {
            title: 'Level'
          },
          budget_allocated_amt: {
            title: 'Budget'
          },
          active_flag: {
            title: 'Status',
            render: (value) => value !== false
              ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
              : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800' }, 'Inactive')
          }
        }
      }
    ),

    fields: [
      { key: 'name', label: 'Business Unit Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'name', label: 'Level Name', type: 'select', required: true, loadOptionsFromSettings: true },
      { key: 'parent_id', label: 'Parent Unit', type: 'select', options: [] },
      { key: 'office_id', label: 'Office', type: 'select', options: [] },
      { key: 'budget_allocated_amt', label: 'Budget Allocated (CAD)', type: 'number' },
      { key: 'manager_employee_id', label: 'Manager', type: 'select', options: [] },
      { key: 'active_flag', label: 'Active', type: 'select', options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' }
      ], coerceBoolean: true },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table',

    hierarchical: {
      levels: 3,
      levelNames: ['Department', 'Division', 'Corporate'],
      metaTable: 'dl__business_level',
      levelField: 'name'
    }
  },

  // --------------------------------------------------------------------------
  // OFFICE
  // --------------------------------------------------------------------------
  office: {
    name: 'office',
    displayName: 'Office',
    pluralName: 'Offices',
    apiEndpoint: '/api/v1/office',

    columns: generateColumns(['name', 'dl__office_level', 'active_flag'], {
      overrides: {
        name: {
          title: 'Office Name',
          render: (value, record) => React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'font-medium text-dark-600' }, value),
            record.addr && React.createElement('div', { className: 'text-sm text-dark-700 truncate max-w-xs' }, record.addr)
          )
        },
        dl__office_level: {
          title: 'Level'
        },
        active_flag: {
          title: 'Status',
          render: (value) => value !== false
            ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
            : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800' }, 'Inactive')
        }
      }
    }),

    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'addr', label: 'Address', type: 'textarea' },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'dl__office_level', label: 'Level', type: 'select', loadOptionsFromSettings: true },
      { key: 'parent_id', label: 'Parent Office', type: 'select', options: [] },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table',

    hierarchical: {
      levels: 4,
      levelNames: ['Office', 'District', 'Region', 'Corporate'],
      metaTable: 'dl__office_level',
      levelField: 'level_id'
    }
  },

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------
  employee: {
    name: 'employee',
    displayName: 'Employee',
    pluralName: 'Employees',
    apiEndpoint: '/api/v1/employee',

    columns: generateColumns(['name', 'employee_number', 'active_flag'], {
      overrides: {
        name: {
          title: 'Employee Name',
          render: (value, record) => React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'font-medium text-dark-600' }, value),
            record.email && React.createElement('div', { className: 'text-sm text-dark-700' }, record.email)
          )
        },
        employee_number: {
          title: 'Employee #'
        },
        active_flag: {
          title: 'Status',
          render: (value) => value !== false
            ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
            : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800' }, 'Inactive')
        }
      }
    }),

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
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true },
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

    columns: generateColumns(['name', 'descr', 'active_flag', 'created_ts'], {
      overrides: {
        active_flag: {
          title: 'Status',
          render: (value) => value !== false
            ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
            : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800' }, 'Inactive')
        }
      }
    }),

    fields: [
      { key: 'name', label: 'Role Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
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
      ['name', 'code', 'descr', 'dl__customer_opportunity_funnel', 'dl__industry_sector', 'dl__acquisition_channel', 'dl__customer_tier'],
      {
        overrides: {
          name: {
            title: 'Customer Name'
          },
          code: {
            title: 'Customer Code'
          },
          dl__customer_opportunity_funnel: {
            title: 'Opportunity Funnel'
          },
          dl__industry_sector: {
            title: 'Industry Sector'
          },
          dl__acquisition_channel: {
            title: 'Acquisition Channel'
          },
          dl__customer_tier: {
            title: 'Customer Tier'
          }
        }
      }
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
      ['name', 'code', 'service_category', 'standard_rate_amt', 'estimated_hours', 'minimum_charge_amt', 'taxable_flag', 'created_ts'],
      {
        overrides: {
          service_category: {
            title: 'Category'
          },
          standard_rate_amt: {
            title: 'Rate',
            render: (value) => formatCurrency(value)
          },
          estimated_hours: {
            title: 'Est. Hours',
            render: (value) => value ? `${value}h` : '-'
          },
          minimum_charge_amt: {
            title: 'Min. Charge',
            render: (value) => formatCurrency(value)
          },
          taxable_flag: {
            title: 'Taxable',
            render: (value) => value ? 'Yes' : 'No'
          }
        }
      }
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
      ['name', 'code', 'product_category', 'unit_price_amt', 'cost_amt', 'on_hand_qty', 'unit_of_measure', 'supplier_name', 'created_ts'],
      {
        overrides: {
          product_category: {
            title: 'Category'
          },
          unit_price_amt: {
            title: 'Price',
            render: (value) => formatCurrency(value)
          },
          cost_amt: {
            title: 'Cost',
            render: (value) => formatCurrency(value)
          },
          on_hand_qty: {
            title: 'On Hand',
            align: 'right' as const
          },
          unit_of_measure: {
            title: 'UOM'
          },
          supplier_name: {
            title: 'Supplier'
          }
        }
      }
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
      ['name', 'code', 'dl__quote_stage', 'quote_total_amt', 'customer_name', 'valid_until_date', 'sent_date', 'created_ts'],
      {
        overrides: {
          dl__quote_stage: {
            title: 'Stage'
          },
          quote_total_amt: {
            title: 'Total',
            render: (value) => formatCurrency(value)
          },
          customer_name: {
            title: 'Customer'
          },
          valid_until_date: {
            title: 'Valid Until',
            render: renderDate
          },
          sent_date: {
            title: 'Sent',
            render: renderDate
          }
        }
      }
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
      ['name', 'code', 'dl__work_order_status', 'scheduled_date', 'assigned_technician_ids', 'total_cost_amt', 'customer_name', 'customer_signature_flag', 'created_ts'],
      {
        overrides: {
          dl__work_order_status: {
            title: 'Status'
          },
          scheduled_date: {
            title: 'Scheduled',
            render: renderDate
          },
          assigned_technician_ids: {
            title: 'Technicians',
            sortable: false,
            filterable: false,
            render: (value, record) => renderEmployeeNames(value, record)
          },
          total_cost_amt: {
            title: 'Total Cost',
            render: (value) => formatCurrency(value)
          },
          customer_name: {
            title: 'Customer'
          },
          customer_signature_flag: {
            title: 'Signed',
            render: (value) => value ? '✓' : '-'
          }
        }
      }
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
      ['workflow_instance_id', 'workflow_template_name', 'industry_sector', 'current_state_name', 'customer_entity_id', 'created_ts'],
      {
        overrides: {
          workflow_instance_id: {
            title: 'Instance ID'
          },
          workflow_template_name: {
            title: 'Template'
          },
          industry_sector: {
            title: 'Industry'
          },
          current_state_name: {
            title: 'Current State'
          },
          customer_entity_id: {
            title: 'Customer'
          }
        }
      }
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
  // BOOKING (Service Appointments)
  // --------------------------------------------------------------------------
  booking: {
    name: 'booking',
    displayName: 'Booking',
    pluralName: 'Bookings',
    apiEndpoint: '/api/v1/booking',

    columns: generateStandardColumns(
      ['booking_number', 'customer_name', 'service_name', 'requested_date', 'requested_time_start', 'booking_status', 'assigned_employee_name', 'urgency_level', 'created_ts'],
      {
        overrides: {
          booking_number: {
            title: 'Booking #',
            sortable: true
          },
          customer_name: {
            title: 'Customer',
            sortable: true
          },
          service_name: {
            title: 'Service',
            sortable: true
          },
          requested_date: {
            title: 'Date',
            sortable: true
          },
          requested_time_start: {
            title: 'Time',
            sortable: true
          },
          booking_status: {
            title: 'Status',
            sortable: true,
            render: (value) => {
              const statusColors: Record<string, string> = {
                'pending': 'bg-yellow-100 text-yellow-800',
                'confirmed': 'bg-blue-100 text-blue-800',
                'assigned': 'bg-indigo-100 text-indigo-800',
                'in_progress': 'bg-purple-100 text-purple-800',
                'completed': 'bg-green-100 text-green-800',
                'cancelled': 'bg-red-100 text-red-800',
                'no_show': 'bg-dark-100 text-dark-600'
              };
              return renderBadge(value || 'pending', statusColors);
            }
          },
          assigned_employee_name: {
            title: 'Assigned To',
            sortable: true
          },
          urgency_level: {
            title: 'Urgency',
            sortable: true,
            render: (value) => {
              const urgencyColors: Record<string, string> = {
                'low': 'bg-dark-100 text-dark-600',
                'normal': 'bg-blue-100 text-blue-800',
                'high': 'bg-orange-100 text-orange-800',
                'emergency': 'bg-red-100 text-red-800'
              };
              return renderBadge(value || 'normal', urgencyColors);
            }
          }
        }
      }
    ),

    fields: [
      { key: 'name', label: 'Booking Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'booking_number', label: 'Booking Number', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },

      // Customer Information
      { key: 'customer_name', label: 'Customer Name', type: 'text', required: true },
      { key: 'customer_email', label: 'Customer Email', type: 'text' },
      { key: 'customer_phone', label: 'Customer Phone', type: 'text', required: true },
      { key: 'customer_address', label: 'Address', type: 'text' },
      { key: 'customer_city', label: 'City', type: 'text' },
      { key: 'customer_province', label: 'Province', type: 'text' },
      { key: 'customer_postal_code', label: 'Postal Code', type: 'text' },

      // Service Details
      { key: 'service_id', label: 'Service', type: 'select', loadOptionsFromEntity: 'service', required: true },
      { key: 'service_name', label: 'Service Name', type: 'text', readonly: true },
      { key: 'service_category', label: 'Service Category', type: 'text', readonly: true },

      // Scheduling
      { key: 'requested_date', label: 'Requested Date', type: 'date', required: true },
      { key: 'requested_time_start', label: 'Start Time', type: 'text' },
      { key: 'requested_time_end', label: 'End Time', type: 'text' },
      { key: 'scheduled_ts', label: 'Scheduled', type: 'timestamp' },

      // Assignment
      { key: 'assigned_employee_id', label: 'Assigned Employee', type: 'select', loadOptionsFromEntity: 'employee' },
      { key: 'assigned_employee_name', label: 'Assigned To', type: 'text', readonly: true },

      // Status & Priority
      { key: 'booking_status', label: 'Status', type: 'select', options: [
        { value: 'pending', label: 'Pending' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'assigned', label: 'Assigned' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'no_show', label: 'No Show' }
      ]},
      { key: 'urgency_level', label: 'Urgency', type: 'select', options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
        { value: 'emergency', label: 'Emergency' }
      ]},

      // Pricing
      { key: 'estimated_cost_amt', label: 'Estimated Cost', type: 'number' },
      { key: 'quoted_cost_amt', label: 'Quoted Cost', type: 'number' },
      { key: 'final_cost_amt', label: 'Final Cost', type: 'number' },

      // Additional Info
      { key: 'special_instructions', label: 'Special Instructions', type: 'textarea' },
      { key: 'property_access_instructions', label: 'Property Access', type: 'textarea' },
      { key: 'parking_instructions', label: 'Parking Instructions', type: 'textarea' },
      { key: 'pet_information', label: 'Pet Information', type: 'textarea' },

      // Feedback
      { key: 'customer_rating', label: 'Customer Rating', type: 'number' },
      { key: 'customer_feedback', label: 'Customer Feedback', type: 'textarea' },

      // Metadata
      { key: 'booking_source', label: 'Source', type: 'text', readonly: true },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' },
      { key: 'created_ts', label: 'Created', type: 'timestamp', readonly: true },
      { key: 'updated_ts', label: 'Updated', type: 'timestamp', readonly: true }
    ],

    supportedViews: ['table'],
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
      ['person_entity_type', 'from_ts', 'to_ts', 'availability_flag', 'title', 'appointment_medium', 'created_ts'],
      {
        overrides: {
          person_entity_type: {
            title: 'Type',
            sortable: true,
            render: (value) => {
              const typeColors: Record<string, string> = {
                'employee': 'bg-blue-100 text-blue-800',
                'client': 'bg-green-100 text-green-800',
                'customer': 'bg-purple-100 text-purple-800'
              };
              return renderBadge(value || 'employee', typeColors);
            }
          },
          from_ts: {
            title: 'Start Time',
            sortable: true,
            render: (value) => value ? new Date(value).toLocaleString('en-CA', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : '-'
          },
          to_ts: {
            title: 'End Time',
            sortable: true,
            render: (value) => value ? new Date(value).toLocaleString('en-CA', {
              hour: '2-digit',
              minute: '2-digit'
            }) : '-'
          },
          availability_flag: {
            title: 'Status',
            sortable: true,
            render: (value) => {
              const statusColors: Record<string, string> = {
                'true': 'bg-green-100 text-green-800',
                'false': 'bg-red-100 text-red-800'
              };
              const displayValue = value ? 'Available' : 'Booked';
              return renderBadge(displayValue, statusColors);
            }
          },
          title: {
            title: 'Appointment',
            sortable: true
          },
          appointment_medium: {
            title: 'Medium',
            sortable: true,
            render: (value) => {
              if (!value) return '-';
              const mediumColors: Record<string, string> = {
                'onsite': 'bg-blue-100 text-blue-800',
                'virtual': 'bg-purple-100 text-purple-800'
              };
              return renderBadge(value, mediumColors);
            }
          }
        }
      }
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
      ['interaction_number', 'interaction_type', 'channel', 'interaction_ts', 'sentiment_label', 'priority_level', 'content_summary', 'created_ts'],
      {
        overrides: {
          interaction_number: {
            title: 'Interaction #',
            sortable: true
          },
          interaction_type: {
            title: 'Type',
            sortable: true,
            render: (value) => {
              const typeColors: Record<string, string> = {
                'voice_call': 'bg-blue-100 text-blue-800',
                'chat': 'bg-green-100 text-green-800',
                'email': 'bg-purple-100 text-purple-800',
                'sms': 'bg-yellow-100 text-yellow-800',
                'video_call': 'bg-indigo-100 text-indigo-800',
                'social_media': 'bg-pink-100 text-pink-800',
                'in_person': 'bg-gray-100 text-gray-800'
              };
              return renderBadge(value || 'chat', typeColors);
            }
          },
          channel: {
            title: 'Channel',
            sortable: true,
            render: (value) => {
              const channelColors: Record<string, string> = {
                'phone': 'bg-blue-100 text-blue-800',
                'live_chat': 'bg-green-100 text-green-800',
                'whatsapp': 'bg-green-100 text-green-800',
                'email': 'bg-purple-100 text-purple-800',
                'facebook': 'bg-blue-100 text-blue-800',
                'twitter': 'bg-sky-100 text-sky-800',
                'zoom': 'bg-indigo-100 text-indigo-800',
                'in_store': 'bg-gray-100 text-gray-800'
              };
              return renderBadge(value || 'phone', channelColors);
            }
          },
          interaction_ts: {
            title: 'Date',
            sortable: true,
            render: (value) => value ? new Date(value).toLocaleString('en-CA', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : '-'
          },
          sentiment_label: {
            title: 'Sentiment',
            sortable: true,
            render: (value) => {
              if (!value) return '-';
              const sentimentColors: Record<string, string> = {
                'positive': 'bg-green-100 text-green-800',
                'neutral': 'bg-gray-100 text-gray-800',
                'negative': 'bg-red-100 text-red-800',
                'mixed': 'bg-yellow-100 text-yellow-800'
              };
              return renderBadge(value, sentimentColors);
            }
          },
          priority_level: {
            title: 'Priority',
            sortable: true,
            render: (value) => {
              if (!value) return '-';
              const priorityColors: Record<string, string> = {
                'low': 'bg-gray-100 text-gray-800',
                'normal': 'bg-blue-100 text-blue-800',
                'high': 'bg-orange-100 text-orange-800',
                'urgent': 'bg-red-100 text-red-800',
                'critical': 'bg-red-100 text-red-800'
              };
              return renderBadge(value, priorityColors);
            }
          },
          content_summary: {
            title: 'Summary',
            sortable: false,
            render: (value) => value ? (value.length > 100 ? value.substring(0, 100) + '...' : value) : '-'
          }
        }
      }
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
      ['name', 'person_entity_type', 'from_ts', 'to_ts', 'availability_flag', 'title', 'appointment_medium', 'created_ts'],
      {
        overrides: {
          person_entity_type: {
            title: 'Person Type',
            width: '110px',
            render: (value) => renderBadge(value || 'employee', {
              'employee': 'bg-blue-100 text-blue-800',
              'client': 'bg-green-100 text-green-800',
              'customer': 'bg-purple-100 text-purple-800'
            })
          },
          from_ts: {
            title: 'From',
            render: renderTimestamp
          },
          to_ts: {
            title: 'To',
            render: renderTimestamp
          },
          availability_flag: {
            title: 'Available',
            width: '100px',
            render: (value) => renderBadge(value ? 'Available' : 'Booked', {
              'Available': 'bg-green-100 text-green-800',
              'Booked': 'bg-red-100 text-red-800'
            })
          },
          title: {
            title: 'Event Title'
          },
          appointment_medium: {
            title: 'Medium',
            width: '100px',
            render: (value) => value ? renderBadge(value, {
              'onsite': 'bg-blue-100 text-blue-800',
              'virtual': 'bg-purple-100 text-purple-800'
            }) : '-'
          }
        }
      }
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
