// ============================================================================
// TASK STAGE META CONFIGURATION
// ============================================================================

import type { EntityPageConfig } from '../types';

export const taskStageConfig: EntityPageConfig = {
  entityName: 'taskStage',
  displayName: 'Task Stage',
  displayNamePlural: 'Task Stages',
  description: 'Task workflow stages for task lifecycle management',
  
  schema: {
    schemaName: 'app',
    tableName: 'meta_task_stage',
    primaryKey: 'id',
  },

  api: {
    baseEndpoint: '/api/v1/meta/task-stage',
    endpoints: {
      list: 'GET /api/v1/meta?category=task_stage',
      get: 'GET /api/v1/meta/task-stage/:id',
      create: 'POST /api/v1/meta/task-stage',
      update: 'PUT /api/v1/meta/task-stage/:id',
      delete: 'DELETE /api/v1/meta/task-stage/:id',
    },
  },

  ui: {
    sidebarIcon: 'kanban-square',
    theme: {
      primaryColor: 'orange',
      accentColor: 'amber',
      gradientFrom: 'from-orange-600',
      gradientTo: 'to-amber-600',
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
        title: 'Total Stages',
        value: 'count',
        icon: 'kanban-square',
        color: 'orange',
      },
      {
        title: 'Active Stages',
        value: 'count',
        filter: { active: true },
        icon: 'check-circle',
        color: 'green',
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
      label: 'Stage Name',
      required: true,
      placeholder: 'Enter stage name',
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
      placeholder: 'Describe this task stage',
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
      title: 'Create Task Stage',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    edit: {
      title: 'Edit Task Stage',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    view: {
      title: 'Task Stage Details',
      readonly: true,
      sections: [
        {
          title: 'Overview',
          fields: ['name', 'description'],
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
      { label: 'Task Stage', path: '/meta/taskStage' },
    ],
  },

  actions: {
    primary: [
      {
        key: 'create',
        label: 'New Stage',
        icon: 'plus',
        action: 'create',
        permissions: ['create'],
        style: 'primary',
      },
    ],
    row: [
      {
        key: 'edit',
        label: 'Edit Stage',
        icon: 'edit',
        action: 'edit',
        permissions: ['update'],
        style: 'secondary',
      },
      {
        key: 'delete',
        label: 'Delete Stage',
        icon: 'trash',
        action: 'delete',
        permissions: ['delete'],
        style: 'danger',
        confirmRequired: true,
        confirmMessage: 'Are you sure you want to delete this task stage?',
      },
    ],
  },
};

export default taskStageConfig;