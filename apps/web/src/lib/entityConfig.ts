import React from 'react';

/**
 * Entity Configuration System
 *
 * Centralized configuration for all 13 core entities in the PMO system.
 * Defines columns, fields, views, and relationships for each entity type.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type ViewMode = 'table' | 'kanban' | 'grid' | 'graph';

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
   * NOTE: Fields with loadOptionsFromSettings may automatically use
   * SequentialStateVisualizer if they match patterns defined in
   * lib/sequentialStateConfig.ts (e.g., stage, funnel, status, level)
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
}

// ============================================================================
// Helper Functions for Column Renderers
// ============================================================================

export const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-CA');
};

export const formatCurrency = (amount?: number, currency: string = 'CAD') => {
  if (!amount) return '-';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency
  }).format(amount);
};

export const renderBadge = (value: string, colorMap: Record<string, string>): React.ReactElement => {
  const colorClass = colorMap[value] || 'bg-gray-100 text-gray-800';
  return React.createElement(
    'span',
    { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}` },
    value
  );
};

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
        { key: index, className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800' },
        tag
      )
    ),
    tagsArray.length > 2 ? React.createElement(
      'span',
      { className: 'text-xs text-gray-500' },
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

  if (!employeeNames) return React.createElement('span', { className: 'text-gray-400' }, '-');

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

  if (namesArray.length === 0) return React.createElement('span', { className: 'text-gray-400' }, '-');

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
      { className: 'text-xs text-gray-500' },
      `+${namesArray.length - 2} more`
    ) : null
  );
};

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

    columns: [
      {
        key: 'name',
        title: 'Project Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.code && React.createElement('div', { className: 'text-sm text-gray-500' }, record.code)
        )
      },
      {
        key: 'project_stage',
        title: 'Stage',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value) => renderBadge(value, {
          'Initiation': 'bg-blue-100 text-blue-800',
          'Planning': 'bg-purple-100 text-purple-800',
          'Execution': 'bg-yellow-100 text-yellow-800',
          'Monitoring': 'bg-orange-100 text-orange-800',
          'Closure': 'bg-green-100 text-green-800'
        })
      },
      {
        key: 'budget_allocated',
        title: 'Budget',
        sortable: true,
        align: 'right',
        render: (value, record) => formatCurrency(value, record.budget_currency)
      },
      {
        key: 'planned_start_date',
        title: 'Start Date',
        sortable: true,
        render: formatDate
      },
      {
        key: 'planned_end_date',
        title: 'End Date',
        sortable: true,
        render: formatDate
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Project Name', type: 'text', required: true },
      { key: 'code', label: 'Project Code', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'project_stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'budget_allocated', label: 'Budget', type: 'number' },
      { key: 'planned_start_date', label: 'Start Date', type: 'date' },
      { key: 'planned_end_date', label: 'End Date', type: 'date' },
      { key: 'tags', label: 'Tags', type: 'array' },
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

    columns: [
      {
        key: 'name',
        title: 'Task Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.code && React.createElement('div', { className: 'text-sm text-gray-500' }, record.code)
        )
      },
      {
        key: 'stage',
        title: 'Stage',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value) => renderBadge(value, {
          'Backlog': 'bg-gray-100 text-gray-800',
          'To Do': 'bg-blue-100 text-blue-800',
          'In Progress': 'bg-yellow-100 text-yellow-800',
          'In Review': 'bg-purple-100 text-purple-800',
          'Done': 'bg-green-100 text-green-800',
          'Blocked': 'bg-red-100 text-red-800'
        })
      },
      {
        key: 'priority_level',
        title: 'Priority',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value) => renderBadge(value, {
          'high': 'bg-red-100 text-red-800',
          'critical': 'bg-red-100 text-red-800',
          'urgent': 'bg-red-100 text-red-800',
          'medium': 'bg-yellow-100 text-yellow-800',
          'low': 'bg-green-100 text-green-800'
        })
      },
      {
        key: 'estimated_hours',
        title: 'Est. Hours',
        sortable: true,
        align: 'right',
        render: (value) => value ? `${value}h` : '-'
      },
      {
        key: 'actual_hours',
        title: 'Actual Hours',
        sortable: true,
        align: 'right',
        render: (value) => value ? `${value}h` : '-'
      },
      {
        key: 'assignee_employee_ids',
        title: 'Assignees',
        sortable: false,
        filterable: false,
        render: (value, record) => renderEmployeeNames(value, record)
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Task Name', type: 'text', required: true },
      { key: 'code', label: 'Task Code', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'stage', label: 'Stage', type: 'select', loadOptionsFromSettings: true },
      { key: 'priority_level', label: 'Priority', type: 'select', loadOptionsFromSettings: true },
      { key: 'estimated_hours', label: 'Estimated Hours', type: 'number' },
      { key: 'assignee_employee_ids', label: 'Assignees', type: 'multiselect', loadOptionsFromEntity: 'employee' },
      { key: 'tags', label: 'Tags', type: 'array' }
    ],

    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    kanban: {
      groupByField: 'stage',
      metaTable: 'setting_task_stage',
      cardFields: ['name', 'priority_level', 'estimated_hours', 'assignee_employee_ids']
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

    columns: [
      {
        key: 'title',
        title: 'Title',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement(
            'div',
            { className: 'flex items-center gap-2' },
            record.attr?.icon && React.createElement('span', { className: 'text-lg' }, record.attr.icon),
            React.createElement('span', { className: 'font-medium text-gray-900' }, value)
          ),
          record.slug && React.createElement('div', { className: 'text-sm text-gray-500' }, `/${record.slug}`)
        )
      },
      {
        key: 'wiki_type',
        title: 'Type',
        sortable: true,
        filterable: true,
        render: (value) => renderBadge(value || 'page', {
          'page': 'bg-blue-100 text-blue-800',
          'template': 'bg-purple-100 text-purple-800',
          'workflow': 'bg-green-100 text-green-800',
          'guide': 'bg-yellow-100 text-yellow-800',
          'policy': 'bg-red-100 text-red-800',
          'checklist': 'bg-indigo-100 text-indigo-800'
        })
      },
      {
        key: 'publication_status',
        title: 'Status',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value) => {
          const status = value || 'draft';
          return renderBadge(status, {
            'published': 'bg-green-100 text-green-800',
            'draft': 'bg-yellow-100 text-yellow-800',
            'review': 'bg-blue-100 text-blue-800',
            'archived': 'bg-gray-100 text-gray-800',
            'deprecated': 'bg-red-100 text-red-800',
            'private': 'bg-purple-100 text-purple-800'
          });
        }
      },
      {
        key: 'category',
        title: 'Category',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'updated_ts',
        title: 'Last Updated',
        sortable: true,
        render: formatDate
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
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
      { key: 'tags', label: 'Tags', type: 'array' },
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

    columns: [
      {
        key: 'name',
        title: 'Name',
        sortable: true,
        filterable: true,
        width: '300px',
        render: (value, record) => React.createElement(
          'div',
          { className: 'py-1' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-2 mb-0.5' },
            React.createElement('div', { className: 'font-medium text-gray-900' }, value),
            record.object_key && React.createElement(
              'div',
              { className: 'flex-shrink-0 w-2 h-2 rounded-full bg-green-500', title: 'File uploaded' },
              null
            )
          ),
          record.descr && React.createElement('div', { className: 'text-xs text-gray-500 line-clamp-1 mb-1' }, record.descr),
          React.createElement(
            'div',
            { className: 'flex items-center gap-1.5' },
            record.version > 1 && React.createElement(
              'span',
              { className: 'inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded border border-blue-200' },
              `v${record.version}`
            ),
            !record.object_key && React.createElement(
              'span',
              { className: 'inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded border border-amber-200' },
              'No file'
            )
          )
        )
      },
      {
        key: 'artifact_type',
        title: 'Type',
        sortable: true,
        filterable: true,
        width: '120px',
        render: (value) => renderBadge(value, {
          'document': 'bg-blue-100 text-blue-800',
          'template': 'bg-purple-100 text-purple-800',
          'image': 'bg-green-100 text-green-800',
          'video': 'bg-rose-100 text-rose-800',
          'spreadsheet': 'bg-emerald-100 text-emerald-800',
          'presentation': 'bg-orange-100 text-orange-800'
        })
      },
      {
        key: 'file_format',
        title: 'Format',
        sortable: true,
        filterable: true,
        width: '90px',
        render: (value) => value ? React.createElement(
          'span',
          { className: 'inline-flex items-center px-2 py-0.5 text-xs font-mono font-semibold bg-gray-100 text-gray-800 rounded border border-gray-200' },
          value.toUpperCase()
        ) : '-'
      },
      {
        key: 'file_size_bytes',
        title: 'Size',
        sortable: true,
        width: '90px',
        align: 'right' as const,
        render: (value) => {
          if (!value) return '-';
          const kb = value / 1024;
          const mb = kb / 1024;
          if (mb >= 1) {
            return React.createElement('span', { className: 'text-gray-700 font-medium' }, `${mb.toFixed(1)} MB`);
          }
          return React.createElement('span', { className: 'text-gray-700 font-medium' }, `${kb.toFixed(0)} KB`);
        }
      },
      {
        key: 'visibility',
        title: 'Visibility',
        sortable: true,
        filterable: true,
        width: '110px',
        render: (value) => renderBadge(value, {
          'public': 'bg-green-100 text-green-800',
          'internal': 'bg-blue-100 text-blue-800',
          'restricted': 'bg-amber-100 text-amber-800',
          'private': 'bg-gray-100 text-gray-800'
        })
      },
      {
        key: 'security_classification',
        title: 'Security',
        sortable: true,
        filterable: true,
        width: '120px',
        render: (value) => renderBadge(value, {
          'general': 'bg-gray-100 text-gray-700',
          'confidential': 'bg-orange-100 text-orange-800',
          'restricted': 'bg-red-100 text-red-800'
        })
      },
      {
        key: 'entity_type',
        title: 'Linked To',
        sortable: true,
        filterable: true,
        width: '110px',
        render: (value) => value ? renderBadge(value, {
          'project': 'bg-indigo-100 text-indigo-800',
          'task': 'bg-cyan-100 text-cyan-800',
          'office': 'bg-violet-100 text-violet-800',
          'business': 'bg-fuchsia-100 text-fuchsia-800'
        }) : '-'
      },
      {
        key: 'created_ts',
        title: 'Created',
        sortable: true,
        width: '100px',
        render: formatDate
      }
    ],

    fields: [
      // Basic Information
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g., Project Blueprint Q1 2025' },
      { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g., ART-2025-001' },
      { key: 'slug', label: 'Slug', type: 'text', required: true, placeholder: 'e.g., project-blueprint-q1-2025' },
      { key: 'descr', label: 'Description', type: 'textarea', placeholder: 'Describe the purpose and contents of this artifact...' },

      // Classification
      {
        key: 'artifact_type',
        label: 'Artifact Type',
        type: 'select',
        defaultValue: 'document',
        options: [
          { value: 'document', label: 'Document - General documentation' },
          { value: 'template', label: 'Template - Reusable template' },
          { value: 'image', label: 'Image - Photos, diagrams, screenshots' },
          { value: 'video', label: 'Video - Video files' },
          { value: 'blueprint', label: 'Blueprint - Technical drawings' },
          { value: 'contract', label: 'Contract - Legal agreements' },
          { value: 'report', label: 'Report - Analysis and reports' },
          { value: 'presentation', label: 'Presentation - Slides and presentations' },
          { value: 'spreadsheet', label: 'Spreadsheet - Data and calculations' }
        ]
      },
      {
        key: 'file_format',
        label: 'File Format',
        type: 'text',
        readonly: true,
        placeholder: 'Auto-populated from uploaded file (e.g., pdf, docx, png)'
      },
      {
        key: 'file_size_bytes',
        label: 'File Size (bytes)',
        type: 'number',
        readonly: true,
        placeholder: 'Auto-populated from uploaded file'
      },

      // Access Control
      {
        key: 'visibility',
        label: 'Visibility',
        type: 'select',
        defaultValue: 'internal',
        required: true,
        options: [
          { value: 'public', label: 'Public - Anyone with link can access' },
          { value: 'internal', label: 'Internal - Organization members only' },
          { value: 'restricted', label: 'Restricted - Limited team access' },
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
          { value: 'general', label: 'General - Standard business information' },
          { value: 'confidential', label: 'Confidential - Sensitive business data' },
          { value: 'restricted', label: 'Restricted - Highly sensitive information' }
        ]
      },

      // Metadata
      { key: 'tags', label: 'Tags', type: 'array', placeholder: 'Add tags for categorization...' }
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

    columns: [
      {
        key: 'name',
        title: 'Form Name',
        sortable: true,
        filterable: true
      },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        filterable: true,
        render: (value) => value
          ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
          : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800' }, 'Inactive')
      },
      {
        key: 'version',
        title: 'Version',
        sortable: true,
        align: 'center'
      },
      {
        key: 'updated_ts',
        title: 'Updated',
        sortable: true,
        render: formatDate
      }
    ],

    fields: [
      { key: 'name', label: 'Form Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'url', label: 'Public Form URL', type: 'text', readonly: true },
      { key: 'schema', label: 'Form Schema', type: 'jsonb', required: true },
      { key: 'active_flag', label: 'Active', type: 'select', options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' }
      ]},
      { key: 'tags', label: 'Tags', type: 'array' }
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

    columns: [
      {
        key: 'name',
        title: 'Business Unit',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          React.createElement(
            'div',
            { className: 'flex items-center text-xs text-gray-500 gap-2 mt-0.5' },
            record.code && React.createElement('span', null, record.code),
            record.slug && React.createElement('span', { className: 'text-gray-400' }, `/${record.slug}`)
          )
        )
      },
      {
        key: 'name',
        title: 'Level',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value, record) => value ? renderBadge(value, {
          'Department': 'bg-blue-100 text-blue-800',
          'Division': 'bg-purple-100 text-purple-800',
          'Corporate': 'bg-green-100 text-green-800',
          'Business Unit': 'bg-indigo-100 text-indigo-800'
        }) : '-'
      },
      {
        key: 'budget_allocated',
        title: 'Budget',
        sortable: true,
        align: 'right',
        render: (value) => value ? formatCurrency(value, 'CAD') : '-'
      },
      {
        key: 'descr',
        title: 'Description',
        sortable: true,
        filterable: true,
        render: (value) => value ? React.createElement('div', { className: 'max-w-xs truncate text-gray-600' }, value) : '-'
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        filterable: true,
        render: (value) => value !== false
          ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
          : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800' }, 'Inactive')
      }
    ],

    fields: [
      { key: 'name', label: 'Business Unit Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'name', label: 'Level Name', type: 'select', required: true, loadOptionsFromSettings: true },
      { key: 'parent_id', label: 'Parent Unit', type: 'select', options: [] },
      { key: 'office_id', label: 'Office', type: 'select', options: [] },
      { key: 'budget_allocated', label: 'Budget Allocated (CAD)', type: 'number' },
      { key: 'manager_employee_id', label: 'Manager', type: 'select', options: [] },
      { key: 'tags', label: 'Tags', type: 'array' },
      { key: 'active_flag', label: 'Active', type: 'select', options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' }
      ], coerceBoolean: true }
    ],

    supportedViews: ['table'],
    defaultView: 'table',

    hierarchical: {
      levels: 3,
      levelNames: ['Department', 'Division', 'Corporate'],
      metaTable: 'setting_business_level',
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

    columns: [
      {
        key: 'name',
        title: 'Office Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.addr && React.createElement('div', { className: 'text-sm text-gray-500 truncate max-w-xs' }, record.addr)
        )
      },
      {
        key: 'office_level_id',
        title: 'Level',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value, record) => record.level_name ? renderBadge(record.level_name, {
          'Office': 'bg-blue-100 text-blue-800',
          'District': 'bg-purple-100 text-purple-800',
          'Region': 'bg-green-100 text-green-800',
          'Corporate': 'bg-yellow-100 text-yellow-800'
        }) : '-'
      },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        render: (value) => value !== false
          ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
          : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800' }, 'Inactive')
      }
    ],

    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'addr', label: 'Address', type: 'textarea' },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'office_level_id', label: 'Level', type: 'select', loadOptionsFromSettings: true },
      { key: 'parent_id', label: 'Parent Office', type: 'select', options: [] }
    ],

    supportedViews: ['table'],
    defaultView: 'table',

    hierarchical: {
      levels: 4,
      levelNames: ['Office', 'District', 'Region', 'Corporate'],
      metaTable: 'setting_office_level',
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

    columns: [
      {
        key: 'name',
        title: 'Employee Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.email && React.createElement('div', { className: 'text-sm text-gray-500' }, record.email)
        )
      },
      {
        key: 'employee_number',
        title: 'Employee #',
        sortable: true,
        filterable: true
      },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        render: (value) => value !== false
          ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
          : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800' }, 'Inactive')
      }
    ],

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
      { key: 'hire_date', label: 'Hire Date', type: 'date' },
      { key: 'address_line1', label: 'Address Line 1', type: 'text' },
      { key: 'address_line2', label: 'Address Line 2', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'province', label: 'Province', type: 'text' },
      { key: 'postal_code', label: 'Postal Code', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text' },
      { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text' }
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

    columns: [
      {
        key: 'name',
        title: 'Role Name',
        sortable: true,
        filterable: true
      },
      {
        key: 'descr',
        title: 'Description',
        sortable: true,
        render: (value) => value || '-'
      },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        render: (value) => value !== false
          ? React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' }, 'Active')
          : React.createElement('span', { className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800' }, 'Inactive')
      }
    ],

    fields: [
      { key: 'name', label: 'Role Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'tags', label: 'Tags', type: 'array' }
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

    columns: [
      {
        key: 'name',
        title: 'Worksite Name',
        sortable: true,
        filterable: true
      },
      {
        key: 'descr',
        title: 'Description',
        sortable: true,
        render: (value) => value || '-'
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Worksite Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'tags', label: 'Tags', type: 'array' }
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

    columns: [
      {
        key: 'name',
        title: 'Customer Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.cust_number && React.createElement('div', { className: 'text-sm text-gray-500' }, record.cust_number)
        )
      },
      {
        key: 'descr',
        title: 'Description',
        sortable: true,
        filterable: true,
        render: (value) => value ? React.createElement('div', { className: 'max-w-xs truncate text-gray-600' }, value) : '-'
      },
      {
        key: 'city',
        title: 'City',
        sortable: true,
        filterable: true
      },
      {
        key: 'opportunity_funnel_stage_name',
        title: 'Opportunity Funnel',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value) => value ? renderBadge(value, {
          'Lead': 'bg-gray-100 text-gray-800',
          'Qualified': 'bg-blue-100 text-blue-800',
          'Site Visit Scheduled': 'bg-purple-100 text-purple-800',
          'Proposal Sent': 'bg-yellow-100 text-yellow-800',
          'Negotiation': 'bg-orange-100 text-orange-800',
          'Contract Signed': 'bg-green-100 text-green-800',
          'Lost': 'bg-red-100 text-red-800',
          'On Hold': 'bg-gray-100 text-gray-600'
        }) : '-'
      },
      {
        key: 'industry_sector_name',
        title: 'Industry Sector',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value) => value ? renderBadge(value, {
          'Residential': 'bg-blue-100 text-blue-800',
          'Commercial Real Estate': 'bg-purple-100 text-purple-800',
          'Healthcare': 'bg-green-100 text-green-800',
          'Education': 'bg-yellow-100 text-yellow-800',
          'Hospitality': 'bg-pink-100 text-pink-800',
          'Municipal/Government': 'bg-indigo-100 text-indigo-800',
          'Industrial': 'bg-gray-100 text-gray-800',
          'Property Management': 'bg-teal-100 text-teal-800'
        }) : '-'
      },
      {
        key: 'acquisition_channel_name',
        title: 'Acquisition Channel',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value) => value || '-'
      },
      {
        key: 'customer_tier_name',
        title: 'Customer Tier',
        sortable: true,
        filterable: true,
        loadOptionsFromSettings: true,
        inlineEditable: true,
        render: (value) => value ? renderBadge(value, {
          'Standard': 'bg-gray-100 text-gray-800',
          'Plus': 'bg-blue-100 text-blue-800',
          'Premium': 'bg-purple-100 text-purple-800',
          'Enterprise': 'bg-green-100 text-green-800',
          'Government': 'bg-indigo-100 text-indigo-800',
          'Strategic': 'bg-yellow-100 text-yellow-800'
        }) : '-'
      }
    ],

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
      { key: 'opportunity_funnel_stage_name', label: 'Opportunity Funnel', type: 'select', loadOptionsFromSettings: true },
      { key: 'industry_sector_name', label: 'Industry Sector', type: 'select', loadOptionsFromSettings: true },
      { key: 'acquisition_channel_name', label: 'Acquisition Channel', type: 'select', loadOptionsFromSettings: true },
      { key: 'customer_tier_name', label: 'Customer Tier', type: 'select', loadOptionsFromSettings: true },
      { key: 'tags', label: 'Tags', type: 'array' }
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

    columns: [
      {
        key: 'name',
        title: 'Position Name',
        sortable: true,
        filterable: true
      },
      {
        key: 'descr',
        title: 'Description',
        sortable: true,
        render: (value) => value || '-'
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Position Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'tags', label: 'Tags', type: 'array' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: PROJECT STAGE
  // --------------------------------------------------------------------------
  projectStage: {
    name: 'projectStage',
    displayName: 'Project Stage',
    pluralName: 'Project Stages',
    apiEndpoint: '/api/v1/setting?category=project_stage',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      {
        key: 'parent_id',
        title: 'Parent Stage',
        sortable: true,
        align: 'left',
        width: '150px',
        render: (value, record, allData) => {
          if (!value && value !== 0) return React.createElement('span', { className: 'text-gray-400' }, '-');
          const parent = allData?.find((item: any) => item.level_id === value);
          return parent
            ? React.createElement('span', { className: 'text-gray-700' }, parent.level_name)
            : React.createElement('span', { className: 'text-gray-400' }, `ID: ${value}`);
        }
      },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Stage Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
      { key: 'color_code', label: 'Color Code', type: 'text', placeholder: '#3B82F6' }
    ],

    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: PROJECT STATUS
  // --------------------------------------------------------------------------
  projectStatus: {
    name: 'projectStatus',
    displayName: 'Project Status',
    pluralName: 'Project Statuses',
    apiEndpoint: '/api/v1/setting?category=project_status',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Status Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: TASK STAGE
  // --------------------------------------------------------------------------
  taskStage: {
    name: 'taskStage',
    displayName: 'Task Stage',
    pluralName: 'Task Stages',
    apiEndpoint: '/api/v1/setting?category=task_stage',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      {
        key: 'parent_id',
        title: 'Parent Stage',
        sortable: true,
        align: 'left',
        width: '150px',
        render: (value, record, allData) => {
          if (!value && value !== 0) return React.createElement('span', { className: 'text-gray-400' }, '-');
          const parent = allData?.find((item: any) => item.level_id === value);
          return parent
            ? React.createElement('span', { className: 'text-gray-700' }, parent.level_name)
            : React.createElement('span', { className: 'text-gray-400' }, `ID: ${value}`);
        }
      },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Stage Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
      { key: 'color_code', label: 'Color Code', type: 'text', placeholder: '#3B82F6' }
    ],

    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: TASK STAGE
  // --------------------------------------------------------------------------
  taskStage: {
    name: 'taskStage',
    displayName: 'Task Stage',
    pluralName: 'Task Stages',
    apiEndpoint: '/api/v1/setting?category=task_stage',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Stage Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: BUSINESS LEVEL
  // --------------------------------------------------------------------------
  businessLevel: {
    name: 'businessLevel',
    displayName: 'Business Level',
    pluralName: 'Business Levels',
    apiEndpoint: '/api/v1/setting?category=business_level',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Level Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: OFFICE LEVEL (ORG LEVEL)
  // --------------------------------------------------------------------------
  orgLevel: {
    name: 'orgLevel',
    displayName: 'Office Level',
    pluralName: 'Office Levels',
    apiEndpoint: '/api/v1/setting?category=office_level',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Level Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: HR LEVEL
  // --------------------------------------------------------------------------
  hrLevel: {
    name: 'hrLevel',
    displayName: 'HR Level',
    pluralName: 'HR Levels',
    apiEndpoint: '/api/v1/setting?category=hr_level',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Level Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: CLIENT LEVEL
  // --------------------------------------------------------------------------
  clientLevel: {
    name: 'clientLevel',
    displayName: 'Client Level',
    pluralName: 'Client Levels',
    apiEndpoint: '/api/v1/setting?category=client_level',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Level Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: POSITION LEVEL
  // --------------------------------------------------------------------------
  positionLevel: {
    name: 'positionLevel',
    displayName: 'Position Level',
    pluralName: 'Position Levels',
    apiEndpoint: '/api/v1/setting?category=position_level',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Level Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: OPPORTUNITY FUNNEL LEVEL
  // --------------------------------------------------------------------------
  opportunityFunnelLevel: {
    name: 'opportunityFunnelLevel',
    displayName: 'Opportunity Funnel Stage',
    pluralName: 'Opportunity Funnel Stages',
    apiEndpoint: '/api/v1/setting?category=opportunity_funnel_stage',

    columns: [
      { key: 'stage_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'stage_name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'stage_descr', title: 'Description', sortable: true, inlineEditable: true },
      {
        key: 'parent_id',
        title: 'Parent Stage',
        sortable: true,
        align: 'left',
        width: '150px',
        render: (value, record, allData) => {
          if (!value && value !== 0) return React.createElement('span', { className: 'text-gray-400' }, '-');
          const parent = allData?.find((item: any) => item.stage_id === value);
          return parent
            ? React.createElement('span', { className: 'text-gray-700' }, parent.stage_name)
            : React.createElement('span', { className: 'text-gray-400' }, `ID: ${value}`);
        }
      },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'stage_id', label: 'Stage ID', type: 'number', required: true },
      { key: 'stage_name', label: 'Stage Name', type: 'text', required: true },
      { key: 'stage_descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
      { key: 'color_code', label: 'Color Code', type: 'text', placeholder: '#3B82F6' }
    ],

    supportedViews: ['table', 'graph'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: INDUSTRY SECTOR
  // --------------------------------------------------------------------------
  industrySector: {
    name: 'industrySector',
    displayName: 'Industry Sector',
    pluralName: 'Industry Sectors',
    apiEndpoint: '/api/v1/setting?category=industry_sector',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Sector Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: ACQUISITION CHANNEL
  // --------------------------------------------------------------------------
  acquisitionChannel: {
    name: 'acquisitionChannel',
    displayName: 'Acquisition Channel',
    pluralName: 'Acquisition Channels',
    apiEndpoint: '/api/v1/setting?category=acquisition_channel',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Channel Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: CUSTOMER TIER
  // --------------------------------------------------------------------------
  customerTier: {
    name: 'customerTier',
    displayName: 'Customer Tier',
    pluralName: 'Customer Tiers',
    apiEndpoint: '/api/v1/setting?category=customer_tier',

    columns: [
      { key: 'level_id', title: 'ID', sortable: true, align: 'center', width: '80px' },
      { key: 'name', title: 'Name', sortable: true, filterable: true, inlineEditable: true },
      { key: 'descr', title: 'Description', sortable: true, inlineEditable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center', width: '120px', inlineEditable: true },
      {
        key: 'active_flag',
        title: 'Status',
        sortable: true,
        align: 'center',
        width: '100px',
        render: (value) => renderBadge(value !== false ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Tier Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' }
    ],

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

    columns: [
      {
        key: 'name',
        title: 'Product Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.code && React.createElement('div', { className: 'text-sm text-gray-500' }, record.code)
        )
      },
      {
        key: 'department',
        title: 'Department',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'class',
        title: 'Class',
        sortable: true,
        filterable: true,
        render: (value) => value || '-'
      },
      {
        key: 'unit_of_measure',
        title: 'Unit',
        sortable: true,
        align: 'center',
        render: (value) => value || 'each'
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
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Product Name', type: 'text', required: true },
      { key: 'code', label: 'Product Code/SKU', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'department', label: 'Department', type: 'text' },
      { key: 'class', label: 'Class', type: 'text' },
      { key: 'subclass', label: 'Subclass', type: 'text' },
      { key: 'unit_of_measure', label: 'Unit of Measure', type: 'text', placeholder: 'each, ft, sqft, lb, gal' },
      { key: 'tags', label: 'Tags', type: 'array' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
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
      { key: 'notes', label: 'Notes', type: 'textarea' }
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
        render: (value) => React.createElement('div', { className: 'font-medium text-gray-900' }, value)
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
        render: formatDate
      },
      {
        key: 'order_status',
        title: 'Status',
        sortable: true,
        filterable: true,
        inlineEditable: true,
        render: (value) => renderBadge(value || 'pending', {
          'quote': 'bg-gray-100 text-gray-800',
          'pending': 'bg-blue-100 text-blue-800',
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
      { key: 'notes', label: 'Notes', type: 'textarea' }
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
        render: (value) => React.createElement('div', { className: 'font-medium text-gray-900' }, value)
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
        render: formatDate
      },
      {
        key: 'shipment_status',
        title: 'Status',
        sortable: true,
        filterable: true,
        inlineEditable: true,
        render: (value) => renderBadge(value || 'pending', {
          'pending': 'bg-gray-100 text-gray-800',
          'picked': 'bg-blue-100 text-blue-800',
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
      { key: 'notes', label: 'Notes', type: 'textarea' }
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
        render: (value) => React.createElement('div', { className: 'font-medium text-gray-900' }, value)
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
        render: formatDate
      },
      {
        key: 'due_date',
        title: 'Due Date',
        sortable: true,
        render: formatDate
      },
      {
        key: 'invoice_status',
        title: 'Status',
        sortable: true,
        filterable: true,
        inlineEditable: true,
        render: (value) => renderBadge(value || 'draft', {
          'draft': 'bg-gray-100 text-gray-800',
          'sent': 'bg-blue-100 text-blue-800',
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
      }
    ],

    fields: [
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
      { key: 'notes', label: 'Notes', type: 'textarea' }
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
        title: 'Template Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.code && React.createElement('div', { className: 'text-sm text-gray-500' }, record.code)
        )
      },
      {
        key: 'subject',
        title: 'Subject Line',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement('div', { className: 'max-w-md truncate text-gray-700' }, value || '-')
      },
      {
        key: 'status',
        title: 'Status',
        sortable: true,
        filterable: true,
        inlineEditable: true,
        render: (value) => renderBadge(value, {
          'draft': 'bg-gray-100 text-gray-800',
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
          React.createElement('div', { className: 'text-sm text-gray-900' }, value || '-'),
          record.from_email && React.createElement('div', { className: 'text-xs text-gray-500' }, record.from_email)
        )
      },
      {
        key: 'updated_ts',
        title: 'Last Updated',
        sortable: true,
        render: formatDate
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Template Name', type: 'text', required: true },
      { key: 'code', label: 'Template Code', type: 'text' },
      { key: 'slug', label: 'Slug', type: 'text' },
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
      { key: 'tags', label: 'Tags', type: 'array' },
      { key: 'template_schema', label: 'Template Content', type: 'jsonb', readonly: true }
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
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.workflow_description && React.createElement('div', { className: 'text-sm text-gray-500 truncate max-w-md' }, record.workflow_description)
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
          'Inactive': 'bg-gray-100 text-gray-800'
        })
      },
      {
        key: 'trigger_entity_type',
        title: 'Trigger Entity',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement('span', { className: 'capitalize text-gray-700' }, value)
      },
      {
        key: 'trigger_action_type',
        title: 'Trigger Action',
        sortable: true,
        filterable: true,
        render: (value) => React.createElement(
          'span',
          { className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800' },
          value.replace('_', ' ').toUpperCase()
        )
      },
      {
        key: 'action_entity_type',
        title: 'Action Entity',
        sortable: true,
        render: (value) => React.createElement('span', { className: 'capitalize text-gray-700' }, value)
      },
      {
        key: 'execution_count',
        title: 'Executions',
        sortable: true,
        align: 'center',
        render: (value, record) => React.createElement(
          'div',
          { className: 'text-sm' },
          React.createElement('div', { className: 'font-medium text-gray-900' }, value || 0),
          record.max_executions > 0 && React.createElement('div', { className: 'text-xs text-gray-500' }, `/ ${record.max_executions}`)
        )
      },
      {
        key: 'last_executed_at',
        title: 'Last Executed',
        sortable: true,
        render: formatDate
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
      { key: 'max_executions', label: 'Max Executions', type: 'number', placeholder: '-1 (unlimited)' }
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
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.cost_code && React.createElement('div', { className: 'text-sm text-gray-500' }, record.cost_code)
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
        filterable: true,
        inlineEditable: true
      },
      {
        key: 'cust_budgeted_amt_lcl',
        title: 'Budgeted Amount',
        sortable: true,
        align: 'right',
        render: (value) => formatCurrency(value, 'CAD')
      },
      {
        key: 'invoice_attachment',
        title: 'Invoice',
        render: (value) => value ? React.createElement(
          'a',
          { href: value, target: '_blank', rel: 'noopener noreferrer', className: 'text-blue-600 hover:underline' },
          'View'
        ) : React.createElement('span', { className: 'text-gray-400' }, '-')
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Cost Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'cost_code', label: 'Cost Code', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'cost_amt_lcl', label: 'Cost Amount (Local)', type: 'number', required: true },
      { key: 'cost_amt_invoice', label: 'Invoice Amount', type: 'number' },
      {
        key: 'invoice_currency',
        label: 'Currency',
        type: 'select',
        options: [
          { value: 'CAD', label: 'CAD - Canadian Dollar' },
          { value: 'USD', label: 'USD - US Dollar' },
          { value: 'EUR', label: 'EUR - Euro' },
          { value: 'GBP', label: 'GBP - British Pound' }
        ]
      },
      { key: 'exch_rate', label: 'Exchange Rate', type: 'number' },
      { key: 'cust_budgeted_amt_lcl', label: 'Budgeted Amount (Local)', type: 'number' },
      { key: 'invoice_attachment', label: 'Invoice Attachment (S3 URI)', type: 'text', placeholder: 's3://pmo-attachments/invoices/...' },
      { key: 'tags', label: 'Tags', type: 'array' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
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
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.revenue_code && React.createElement('div', { className: 'text-sm text-gray-500' }, record.revenue_code)
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
        filterable: true,
        inlineEditable: true
      },
      {
        key: 'sales_receipt_attachment',
        title: 'Receipt',
        render: (value) => value ? React.createElement(
          'a',
          { href: value, target: '_blank', rel: 'noopener noreferrer', className: 'text-blue-600 hover:underline' },
          'View'
        ) : React.createElement('span', { className: 'text-gray-400' }, '-')
      },
      {
        key: 'tags',
        title: 'Tags',
        inlineEditable: true,
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Revenue Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'revenue_code', label: 'Revenue Code', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'revenue_amt_local', label: 'Revenue Amount (Local)', type: 'number', required: true },
      { key: 'revenue_amt_invoice', label: 'Invoice Amount', type: 'number' },
      {
        key: 'invoice_currency',
        label: 'Currency',
        type: 'select',
        options: [
          { value: 'CAD', label: 'CAD - Canadian Dollar' },
          { value: 'USD', label: 'USD - US Dollar' },
          { value: 'EUR', label: 'EUR - Euro' },
          { value: 'GBP', label: 'GBP - British Pound' }
        ]
      },
      { key: 'exch_rate', label: 'Exchange Rate', type: 'number' },
      { key: 'revenue_forecasted_amt_lcl', label: 'Forecasted Amount (Local)', type: 'number' },
      { key: 'sales_receipt_attachment', label: 'Sales Receipt (S3 URI)', type: 'text', placeholder: 's3://pmo-attachments/receipts/...' },
      { key: 'tags', label: 'Tags', type: 'array' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  }
};

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
    detailFields: ['name', 'descr', 'stage', 'priority_level', 'estimated_hours', 'actual_hours', 'story_points', 'tags'],
    hasUpdates: true, // Shows task updates/comments
  },
  artifact: {
    name: 'artifact',
    displayName: 'Artifact',
    icon: 'FileText',
    detailFields: ['name', 'descr', 'artifact_type', 'file_format', 'file_size_bytes', 'tags'],
    hasUpdates: false,
  },
  wiki: {
    name: 'wiki',
    displayName: 'Wiki',
    icon: 'BookOpen',
    detailFields: ['name', 'descr', 'tags'],
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
  },
} as const;

export type ShareableEntityType = keyof typeof SHAREABLE_ENTITIES;
