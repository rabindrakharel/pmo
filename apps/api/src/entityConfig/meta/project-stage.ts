// ============================================================================
// PROJECT STAGE META CONFIGURATION
// ============================================================================

import type { EntityPageConfig } from '../types.js';

export const projectStageConfig: EntityPageConfig = {
  entityName: 'projectStage',
  displayName: 'Project Stage',
  displayNamePlural: 'Project Stages',
  description: 'Project lifecycle stages for project phase management',
  
  schema: {
    schemaName: 'app',
    tableName: 'meta_project_stage',
    primaryKey: 'id',
  },

  api: {
    baseEndpoint: '/api/v1/meta/project-stage',
    endpoints: {
      list: 'GET /api/v1/meta?category=project-stage',
      get: 'GET /api/v1/meta/project-stage/:id',
      create: 'POST /api/v1/meta/project-stage',
      update: 'PUT /api/v1/meta/project-stage/:id',
      delete: 'DELETE /api/v1/meta/project-stage/:id',
    },
  },

  ui: {
    sidebarIcon: 'trending-up',
    theme: {
      primaryColor: 'purple',
      accentColor: 'violet',
      gradientFrom: 'from-purple-600',
      gradientTo: 'to-violet-600',
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
        icon: 'trending-up',
        color: 'purple',
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
      placeholder: 'Describe this project stage',
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

    levelId: {
      ddlField: 'level_id',
      apiField: 'level_id',
      dataType: 'number',
      inputType: 'number',
      label: 'Stage Level',
      placeholder: '1, 2, 3...',
      pii: false,
      validation: {
        min: 1,
        max: 20,
      },
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        priority: 2,
        width: '100px',
        align: 'center',
      },
      icon: 'layers',
    },

    durationWeeks: {
      ddlField: 'duration_weeks',
      apiField: 'duration_weeks',
      dataType: 'number',
      inputType: 'number',
      label: 'Duration (Weeks)',
      placeholder: 'Expected duration in weeks',
      pii: false,
      validation: {
        min: 1,
        max: 104, // 2 years
      },
      uiBehavior: {
        sort: true,
        filter: false,
        visible: true,
        priority: 3,
        width: '120px',
        align: 'right',
      },
      icon: 'calendar',
    },

    sortOrder: {
      ddlField: 'sort_order',
      apiField: 'sort_order',
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
      title: 'Create Project Stage',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description'],
        },
        {
          title: 'Stage Properties',
          fields: ['levelId', 'durationWeeks', 'sortOrder'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    edit: {
      title: 'Edit Project Stage',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description'],
        },
        {
          title: 'Stage Properties',
          fields: ['levelId', 'durationWeeks', 'sortOrder'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    view: {
      title: 'Project Stage Details',
      readonly: true,
      sections: [
        {
          title: 'Overview',
          fields: ['name', 'description'],
        },
        {
          title: 'Properties',
          fields: ['levelId', 'durationWeeks', 'sortOrder'],
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
      { label: 'Project Stages', path: '/meta/project-stage' },
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
        confirmMessage: 'Are you sure you want to delete this project stage?',
      },
    ],
  },
};

export default projectStageConfig;