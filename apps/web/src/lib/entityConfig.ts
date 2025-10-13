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

export type ViewMode = 'table' | 'kanban' | 'grid';

export interface ColumnDef {
  key: string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (value: any, record: any) => React.ReactNode;
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
}

export interface EntityConfig {
  name: string;
  displayName: string;
  pluralName: string;
  apiEndpoint: string;
  icon?: string; // lucide-react icon name

  // Table configuration
  columns: ColumnDef[];

  // Form/detail configuration
  fields: FieldDef[];

  // Supported view modes
  supportedViews: ViewMode[];
  defaultView: ViewMode;

  // Child entities (for tabs)
  childEntities?: string[];

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

export const renderTags = (tags?: string[]): React.ReactElement | null => {
  if (!tags || tags.length === 0) return null;
  return React.createElement(
    'div',
    { className: 'flex flex-wrap gap-1' },
    ...tags.slice(0, 2).map((tag, index) =>
      React.createElement(
        'span',
        { key: index, className: 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800' },
        tag
      )
    ),
    tags.length > 2 ? React.createElement(
      'span',
      { className: 'text-xs text-gray-500' },
      `+${tags.length - 2}`
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
    icon: 'FolderOpen',

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
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Project Name', type: 'text', required: true },
      { key: 'code', label: 'Project Code', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'project_stage', label: 'Stage', type: 'select', options: [] }, // populated from setting_project_stage
      { key: 'budget_allocated', label: 'Budget', type: 'number' },
      { key: 'planned_start_date', label: 'Start Date', type: 'date' },
      { key: 'planned_end_date', label: 'End Date', type: 'date' },
      { key: 'tags', label: 'Tags', type: 'array' },
      { key: 'metadata', label: 'Metadata', type: 'jsonb' }
    ],

    supportedViews: ['table'],
    defaultView: 'table',

    childEntities: ['task', 'wiki', 'artifact', 'form']
  },

  // --------------------------------------------------------------------------
  // TASK
  // --------------------------------------------------------------------------
  task: {
    name: 'task',
    displayName: 'Task',
    pluralName: 'Tasks',
    apiEndpoint: '/api/v1/task',
    icon: 'CheckSquare',

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
        render: (value) => renderBadge(value, {
          'High': 'bg-red-100 text-red-800',
          'Medium': 'bg-yellow-100 text-yellow-800',
          'Low': 'bg-green-100 text-green-800'
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
        key: 'tags',
        title: 'Tags',
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Task Name', type: 'text', required: true },
      { key: 'code', label: 'Task Code', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'richtext' },
      { key: 'stage', label: 'Stage', type: 'select', options: [] }, // from setting_task_stage
      { key: 'priority_level', label: 'Priority', type: 'select', options: [
        { value: 'High', label: 'High' },
        { value: 'Medium', label: 'Medium' },
        { value: 'Low', label: 'Low' }
      ]},
      { key: 'estimated_hours', label: 'Estimated Hours', type: 'number' },
      { key: 'assignee_employee_ids', label: 'Assignees', type: 'multiselect', options: [] },
      { key: 'tags', label: 'Tags', type: 'array' }
    ],

    supportedViews: ['table', 'kanban'],
    defaultView: 'table',

    kanban: {
      groupByField: 'stage',
      metaTable: 'setting_task_stage',
      cardFields: ['name', 'priority_level', 'estimated_hours', 'assignee_employee_ids']
    },

    childEntities: ['form', 'artifact']
  },

  // --------------------------------------------------------------------------
  // WIKI
  // --------------------------------------------------------------------------
  wiki: {
    name: 'wiki',
    displayName: 'Wiki',
    pluralName: 'Wiki Pages',
    apiEndpoint: '/api/v1/wiki',
    icon: 'BookOpen',

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
        render: (value) => {
          const status = value || 'draft';
          return renderBadge(status, {
            'published': 'bg-green-100 text-green-800',
            'draft': 'bg-yellow-100 text-yellow-800',
            'archived': 'bg-gray-100 text-gray-800',
            'deprecated': 'bg-red-100 text-red-800'
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
      { key: 'publication_status', label: 'Publication Status', type: 'select', options: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'archived', label: 'Archived' },
        { value: 'deprecated', label: 'Deprecated' }
      ]},
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
    icon: 'FileText',

    columns: [
      {
        key: 'name',
        title: 'Name',
        sortable: true,
        filterable: true,
        render: (value, record) => React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'font-medium text-gray-900' }, value),
          record.descr && React.createElement('div', { className: 'text-sm text-gray-500 truncate max-w-md' }, record.descr)
        )
      },
      {
        key: 'artifact_type',
        title: 'Type',
        sortable: true,
        filterable: true,
        render: (value) => renderBadge(value, {
          'Document': 'bg-blue-100 text-blue-800',
          'Design': 'bg-purple-100 text-purple-800',
          'Model': 'bg-green-100 text-green-800',
          'Template': 'bg-yellow-100 text-yellow-800'
        })
      },
      {
        key: 'source_type',
        title: 'Source',
        sortable: true,
        filterable: true
      },
      {
        key: 'updated_ts',
        title: 'Updated',
        sortable: true,
        render: formatDate
      }
    ],

    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'descr', label: 'Description', type: 'textarea' },
      { key: 'artifact_type', label: 'Type', type: 'select', options: [
        { value: 'Document', label: 'Document' },
        { value: 'Design', label: 'Design' },
        { value: 'Model', label: 'Model' },
        { value: 'Template', label: 'Template' }
      ]},
      { key: 'source_type', label: 'Source Type', type: 'select', options: [
        { value: 'upload', label: 'Upload' },
        { value: 'link', label: 'Link' },
        { value: 'generated', label: 'Generated' }
      ]},
      { key: 'uri', label: 'URI/Path', type: 'text' },
      { key: 'tags', label: 'Tags', type: 'array' }
    ],

    supportedViews: ['table', 'grid'],
    defaultView: 'table',

    grid: {
      cardFields: ['name', 'descr', 'artifact_type', 'source_type'],
      imageField: 'uri'
    }
  },

  // --------------------------------------------------------------------------
  // FORM
  // --------------------------------------------------------------------------
  form: {
    name: 'form',
    displayName: 'Form',
    pluralName: 'Forms',
    apiEndpoint: '/api/v1/form',
    icon: 'FileText',

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
    icon: 'Building2',

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
        key: 'level_name',
        title: 'Level',
        sortable: true,
        filterable: true,
        render: (value) => renderBadge(value, {
          'Department': 'bg-blue-100 text-blue-800',
          'Division': 'bg-purple-100 text-purple-800',
          'Corporate': 'bg-green-100 text-green-800',
          'Business Unit': 'bg-indigo-100 text-indigo-800'
        })
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
      { key: 'level_id', label: 'Level', type: 'number', required: true },
      { key: 'level_name', label: 'Level Name', type: 'text', required: true },
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
      levelField: 'level_id'
    },

    childEntities: ['project', 'task', 'wiki', 'artifact', 'form']
  },

  // --------------------------------------------------------------------------
  // OFFICE
  // --------------------------------------------------------------------------
  office: {
    name: 'office',
    displayName: 'Office',
    pluralName: 'Offices',
    apiEndpoint: '/api/v1/office',
    icon: 'MapPin',

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
        key: 'level_name',
        title: 'Level',
        sortable: true,
        filterable: true,
        render: (value) => renderBadge(value, {
          'Office': 'bg-blue-100 text-blue-800',
          'District': 'bg-purple-100 text-purple-800',
          'Region': 'bg-green-100 text-green-800',
          'Corporate': 'bg-yellow-100 text-yellow-800'
        })
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
      { key: 'level_id', label: 'Level', type: 'select', options: [] }, // from setting_office_level
      { key: 'parent_id', label: 'Parent Office', type: 'select', options: [] }
    ],

    supportedViews: ['table'],
    defaultView: 'table',

    hierarchical: {
      levels: 4,
      levelNames: ['Office', 'District', 'Region', 'Corporate'],
      metaTable: 'setting_office_level',
      levelField: 'level_id'
    },

    childEntities: ['worksite', 'employee', 'wiki', 'task', 'artifact', 'form']
  },

  // --------------------------------------------------------------------------
  // EMPLOYEE
  // --------------------------------------------------------------------------
  employee: {
    name: 'employee',
    displayName: 'Employee',
    pluralName: 'Employees',
    apiEndpoint: '/api/v1/employee',
    icon: 'Users',

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

    supportedViews: ['table', 'grid'],
    defaultView: 'table',

    grid: {
      cardFields: ['name', 'email', 'employee_number', 'phone']
    }
  },

  // --------------------------------------------------------------------------
  // ROLE
  // --------------------------------------------------------------------------
  role: {
    name: 'role',
    displayName: 'Role',
    pluralName: 'Roles',
    apiEndpoint: '/api/v1/role',
    icon: 'Shield',

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
    icon: 'MapPin',

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
    },

    childEntities: ['task', 'form']
  },

  // --------------------------------------------------------------------------
  // CLIENT
  // --------------------------------------------------------------------------
  client: {
    name: 'client',
    displayName: 'Client',
    pluralName: 'Clients',
    apiEndpoint: '/api/v1/client',
    icon: 'Building',

    columns: [
      {
        key: 'name',
        title: 'Client Name',
        sortable: true,
        filterable: true
      },
      {
        key: 'email',
        title: 'Email',
        sortable: true,
        filterable: true
      },
      {
        key: 'phone',
        title: 'Phone',
        sortable: true
      },
      {
        key: 'tags',
        title: 'Tags',
        render: renderTags
      }
    ],

    fields: [
      { key: 'name', label: 'Client Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'addr', label: 'Address', type: 'textarea' },
      { key: 'tags', label: 'Tags', type: 'array' }
    ],

    supportedViews: ['table', 'grid'],
    defaultView: 'table',

    grid: {
      cardFields: ['name', 'email', 'phone']
    }
  },

  // --------------------------------------------------------------------------
  // POSITION
  // --------------------------------------------------------------------------
  position: {
    name: 'position',
    displayName: 'Position',
    pluralName: 'Positions',
    apiEndpoint: '/api/v1/position',
    icon: 'Briefcase',

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
    apiEndpoint: '/api/v1/setting?category=project-stage',
    icon: 'KanbanSquare',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Stage Name', sortable: true, filterable: true },
      { key: 'descr', title: 'Description', sortable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'color_code',
        title: 'Color',
        render: (value) => value ? React.createElement('div', {
          className: 'flex items-center gap-2'
        },
          React.createElement('div', {
            className: 'w-4 h-4 rounded border border-gray-300',
            style: { backgroundColor: value }
          }),
          React.createElement('span', { className: 'text-xs font-mono text-gray-600' }, value)
        ) : '-'
      },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'level_name', label: 'Stage Name', type: 'text', required: true },
      { key: 'level_descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
      { key: 'color_code', label: 'Color Code', type: 'text', placeholder: '#3B82F6' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: PROJECT STATUS
  // --------------------------------------------------------------------------
  projectStatus: {
    name: 'projectStatus',
    displayName: 'Project Status',
    pluralName: 'Project Statuses',
    apiEndpoint: '/api/v1/setting?category=project-status',
    icon: 'ListChecks',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Status Name', sortable: true, filterable: true },
      { key: 'descr', title: 'Description', sortable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'level_name', label: 'Status Name', type: 'text', required: true },
      { key: 'level_descr', label: 'Description', type: 'textarea' },
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
    apiEndpoint: '/api/v1/setting?category=task-stage',
    icon: 'KanbanSquare',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Stage Name', sortable: true, filterable: true },
      { key: 'descr', title: 'Description', sortable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'color_code',
        title: 'Color',
        render: (value) => value ? React.createElement('div', {
          className: 'flex items-center gap-2'
        },
          React.createElement('div', {
            className: 'w-4 h-4 rounded border border-gray-300',
            style: { backgroundColor: value }
          }),
          React.createElement('span', { className: 'text-xs font-mono text-gray-600' }, value)
        ) : '-'
      },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'level_name', label: 'Stage Name', type: 'text', required: true },
      { key: 'level_descr', label: 'Description', type: 'textarea' },
      { key: 'sort_order', label: 'Sort Order', type: 'number' },
      { key: 'color_code', label: 'Color Code', type: 'text', placeholder: '#3B82F6' }
    ],

    supportedViews: ['table'],
    defaultView: 'table'
  },

  // --------------------------------------------------------------------------
  // META: TASK STATUS
  // --------------------------------------------------------------------------
  taskStatus: {
    name: 'taskStatus',
    displayName: 'Task Status',
    pluralName: 'Task Statuses',
    apiEndpoint: '/api/v1/setting?category=task-status',
    icon: 'ListChecks',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Status Name', sortable: true, filterable: true },
      { key: 'descr', title: 'Description', sortable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'level_name', label: 'Status Name', type: 'text', required: true },
      { key: 'level_descr', label: 'Description', type: 'textarea' },
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
    apiEndpoint: '/api/v1/setting?category=business-level',
    icon: 'Building2',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Level Name', sortable: true, filterable: true },
      { key: 'descr', title: 'Description', sortable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'level_name', label: 'Level Name', type: 'text', required: true },
      { key: 'level_descr', label: 'Description', type: 'textarea' },
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
    apiEndpoint: '/api/v1/setting?category=orgLevel',
    icon: 'MapPin',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Level Name', sortable: true, filterable: true },
      { key: 'descr', title: 'Description', sortable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'level_name', label: 'Level Name', type: 'text', required: true },
      { key: 'level_descr', label: 'Description', type: 'textarea' },
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
    apiEndpoint: '/api/v1/setting?category=hr-level',
    icon: 'Crown',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Level Name', sortable: true, filterable: true },
      { key: 'descr', title: 'Description', sortable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'level_name', label: 'Level Name', type: 'text', required: true },
      { key: 'level_descr', label: 'Description', type: 'textarea' },
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
    apiEndpoint: '/api/v1/setting?category=client-level',
    icon: 'Users',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Level Name', sortable: true, filterable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Level Name', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'authority_description', label: 'Authority Description', type: 'textarea' }
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
    apiEndpoint: '/api/v1/setting?category=position-level',
    icon: 'Star',

    columns: [
      { key: 'level_id', title: 'Level ID', sortable: true, align: 'center' },
      { key: 'name', title: 'Level Name', sortable: true, filterable: true },
      { key: 'sort_order', title: 'Sort Order', sortable: true, align: 'center' },
      {
        key: 'active',
        title: 'Status',
        render: (value) => renderBadge(value ? 'Active' : 'Inactive', {
          'Active': 'bg-green-100 text-green-800',
          'Inactive': 'bg-red-100 text-red-800'
        })
      }
    ],

    fields: [
      { key: 'level_id', label: 'Level ID', type: 'number', required: true },
      { key: 'name', label: 'Level Name', type: 'text', required: true },
      { key: 'slug', label: 'Slug', type: 'text', required: true },
      { key: 'authority_description', label: 'Authority Description', type: 'textarea' }
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
