// ============================================================================
// PROJECT STATUS META CONFIGURATION
// ============================================================================

import type { EntityPageConfig } from '../types';

export const projectStatusConfig: EntityPageConfig = {
  entityName: 'project-status',
  displayName: 'Project Status',
  displayNamePlural: 'Project Statuses',
  description: 'Project status workflow states for project lifecycle management',
  
  schema: {
    schemaName: 'app',
    tableName: 'meta_project_status',
    primaryKey: 'id',
  },

  api: {
    baseEndpoint: '/api/v1/meta/project-status',
    endpoints: {
      list: 'GET /api/v1/meta?category=project-status',
      get: 'GET /api/v1/meta/project-status/:id',
      create: 'POST /api/v1/meta/project-status',
      update: 'PUT /api/v1/meta/project-status/:id',
      delete: 'DELETE /api/v1/meta/project-status/:id',
    },
  },

  ui: {
    sidebarIcon: 'activity',
    theme: {
      primaryColor: 'blue',
      accentColor: 'indigo',
      gradientFrom: 'from-blue-600',
      gradientTo: 'to-indigo-600',
    },
    
    layout: {
      defaultView: 'table',
      enableMultiView: false,
      showSummaryCards: true,
      enableQuickActions: true,
    },

    table: {
      defaultPageSize: 20,
      enableSearch: true,
      enableFilters: true,
      enableSorting: true,
      enableExport: false,
      stickyHeader: true,
      rowActions: ['view', 'edit', 'delete'],
    },

    summaryCards: [
      {
        title: 'Total Statuses',
        value: 'count',
        icon: 'activity',
        color: 'blue',
      },
      {
        title: 'Active Statuses',
        value: 'count',
        filter: { active: true },
        icon: 'check-circle',
        color: 'green',
      },
      {
        title: 'Terminal States',
        value: 'count',
        filter: { is_terminal_state: true },
        icon: 'flag',
        color: 'red',
      },
    ],
  },

  fields: {
    id: {
      ddlField: 'id',
      apiField: 'id',
      dataType: 'uuid',
      inputType: 'hidden',
      label: 'ID',
      generated: true,
      hidden: true,
      pii: false,
      validation: {},
      uiBehavior: {
        sort: false,
        filter: false,
        visible: false,
      },
    },

    name: {
      ddlField: 'name',
      apiField: 'name',
      dataType: 'string',
      inputType: 'text',
      label: 'Status Name',
      required: true,
      placeholder: 'Enter status name',
      pii: false,
      validation: {
        required: true,
        minLength: 1,
        maxLength: 100,
      },
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        searchable: true,
        priority: 1,
      },
      icon: 'type',
    },

    description: {
      ddlField: 'descr',
      apiField: 'descr',
      dataType: 'text',
      inputType: 'textarea',
      label: 'Description',
      placeholder: 'Describe what this status represents',
      pii: false,
      validation: {},
      uiBehavior: {
        sort: false,
        filter: false,
        visible: false,
        searchable: true,
      },
      icon: 'align-left',
    },

    code: {
      ddlField: 'code',
      apiField: 'code',
      dataType: 'string',
      inputType: 'text',
      label: 'Code',
      placeholder: 'e.g., ACTIVE, ON_HOLD',
      pii: false,
      validation: {
        maxLength: 50,
        pattern: /^[A-Z0-9_-]+$/,
      },
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        priority: 2,
        width: '120px',
      },
      icon: 'hash',
    },

    color: {
      ddlField: 'color',
      apiField: 'color',
      dataType: 'string',
      inputType: 'text',
      label: 'Color',
      placeholder: '#3B82F6 or blue',
      pii: false,
      validation: {},
      uiBehavior: {
        sort: false,
        filter: false,
        visible: true,
        priority: 3,
        width: '100px',
        renderAs: 'badge',
      },
      icon: 'palette',
    },

    workflowSequence: {
      ddlField: 'workflow_sequence',
      apiField: 'workflow_sequence',
      dataType: 'number',
      inputType: 'number',
      label: 'Workflow Order',
      placeholder: '1, 2, 3...',
      pii: false,
      validation: {
        min: 1,
        max: 100,
      },
      uiBehavior: {
        sort: true,
        filter: false,
        visible: true,
        priority: 4,
        width: '100px',
        align: 'center',
      },
      icon: 'arrow-right',
    },

    isTerminalState: {
      ddlField: 'is_terminal_state',
      apiField: 'is_terminal_state',
      dataType: 'boolean',
      inputType: 'checkbox',
      label: 'Terminal State',
      description: 'Is this a final state in the workflow?',
      pii: false,
      defaultValue: false,
      validation: {},
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        priority: 5,
        width: '100px',
        renderAs: 'boolean',
        align: 'center',
      },
      icon: 'flag',
    },

    isSuccessState: {
      ddlField: 'is_success_state',
      apiField: 'is_success_state',
      dataType: 'boolean',
      inputType: 'checkbox',
      label: 'Success State',
      description: 'Does this represent a successful completion?',
      pii: false,
      defaultValue: false,
      validation: {},
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        priority: 6,
        width: '100px',
        renderAs: 'boolean',
        align: 'center',
      },
      icon: 'check-circle',
    },

    active: {
      ddlField: 'active',
      apiField: 'active',
      dataType: 'boolean',
      inputType: 'checkbox',
      label: 'Active',
      pii: false,
      defaultValue: true,
      validation: {},
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        priority: 7,
        width: '80px',
        renderAs: 'boolean',
        align: 'center',
      },
      icon: 'check',
    },
  },

  forms: {
    create: {
      title: 'Create Project Status',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'code'],
        },
        {
          title: 'Display & Workflow',
          fields: ['color', 'workflowSequence'],
        },
        {
          title: 'Status Properties',
          fields: ['isTerminalState', 'isSuccessState', 'active'],
        },
      ],
    },

    edit: {
      title: 'Edit Project Status',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'code'],
        },
        {
          title: 'Display & Workflow',
          fields: ['color', 'workflowSequence'],
        },
        {
          title: 'Status Properties',
          fields: ['isTerminalState', 'isSuccessState', 'active'],
        },
      ],
    },

    view: {
      title: 'Project Status Details',
      readonly: true,
      sections: [
        {
          title: 'Overview',
          fields: ['name', 'description', 'code'],
        },
        {
          title: 'Workflow',
          fields: ['workflowSequence', 'isTerminalState', 'isSuccessState'],
        },
        {
          title: 'Display',
          fields: ['color', 'active'],
        },
      ],
    },
  },

  permissions: {
    create: ['admin', 'system_admin'],
    read: ['admin', 'system_admin', 'manager', 'employee'],
    update: ['admin', 'system_admin'],
    delete: ['admin', 'system_admin'],
  },

  navigation: {
    breadcrumbs: [
      { label: 'Meta Data', path: '/meta' },
      { label: 'Project Statuses', path: '/meta/project-status' },
    ],
  },

  actions: {
    primary: [
      {
        key: 'create',
        label: 'New Status',
        icon: 'plus',
        action: 'create',
        permissions: ['create'],
        style: 'primary',
      },
    ],
    row: [
      {
        key: 'edit',
        label: 'Edit Status',
        icon: 'edit',
        action: 'edit',
        permissions: ['update'],
        style: 'secondary',
      },
      {
        key: 'delete',
        label: 'Delete Status',
        icon: 'trash',
        action: 'delete',
        permissions: ['delete'],
        style: 'danger',
        confirmRequired: true,
        confirmMessage: 'Are you sure you want to delete this project status?',
      },
    ],
  },
};

export default projectStatusConfig;