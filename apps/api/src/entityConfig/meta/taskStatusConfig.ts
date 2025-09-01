// ============================================================================
// TASK STATUS META CONFIGURATION
// ============================================================================

import type { EntityPageConfig } from '../types';

export const taskStatusConfig: EntityPageConfig = {
  entityName: 'task-status',
  displayName: 'Task Status',
  displayNamePlural: 'Task Statuses',
  description: 'Task status workflow states for task management',
  
  schema: {
    schemaName: 'app',
    tableName: 'meta_task_status',
    primaryKey: 'id',
  },

  api: {
    baseEndpoint: '/api/v1/meta/task-status',
    endpoints: {
      list: 'GET /api/v1/meta?category=task-status',
      get: 'GET /api/v1/meta/task-status/:id',
      create: 'POST /api/v1/meta/task-status',
      update: 'PUT /api/v1/meta/task-status/:id',
      delete: 'DELETE /api/v1/meta/task-status/:id',
    },
  },

  ui: {
    sidebarIcon: 'list-checks',
    theme: {
      primaryColor: 'green',
      accentColor: 'emerald',
      gradientFrom: 'from-green-600',
      gradientTo: 'to-emerald-600',
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
        icon: 'list-checks',
        color: 'green',
      },
      {
        title: 'Active Statuses',
        value: 'count',
        filter: { active: true },
        icon: 'check-circle',
        color: 'emerald',
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
      placeholder: 'e.g., TODO, IN_PROGRESS',
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

    colorHex: {
      ddlField: 'color_hex',
      apiField: 'color',
      dataType: 'string',
      inputType: 'text',
      label: 'Color',
      placeholder: '#3B82F6',
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

    sortId: {
      ddlField: 'sort_id',
      apiField: 'sort_id',
      dataType: 'number',
      inputType: 'number',
      label: 'Sort Order',
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
      icon: 'arrow-up-down',
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
        priority: 5,
        width: '80px',
        renderAs: 'boolean',
        align: 'center',
      },
      icon: 'check',
    },
  },

  forms: {
    create: {
      title: 'Create Task Status',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'code'],
        },
        {
          title: 'Display & Ordering',
          fields: ['colorHex', 'sortId'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    edit: {
      title: 'Edit Task Status',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'code'],
        },
        {
          title: 'Display & Ordering',
          fields: ['colorHex', 'sortId'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    view: {
      title: 'Task Status Details',
      readonly: true,
      sections: [
        {
          title: 'Overview',
          fields: ['name', 'description', 'code'],
        },
        {
          title: 'Display',
          fields: ['colorHex', 'sortId'],
        },
        {
          title: 'Status',
          fields: ['active'],
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
      { label: 'Task Statuses', path: '/meta/task-status' },
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
        confirmMessage: 'Are you sure you want to delete this task status?',
      },
    ],
  },
};

export default taskStatusConfig;