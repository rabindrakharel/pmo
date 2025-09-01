// ============================================================================
// HR LEVEL META CONFIGURATION
// ============================================================================

import type { EntityPageConfig } from '../types';

export const hrLevelConfig: EntityPageConfig = {
  entityName: 'hrLevel',
  displayName: 'HR Level',
  displayNamePlural: 'HR Levels',
  description: 'Human resources hierarchy levels with salary bands and management indicators',
  
  schema: {
    schemaName: 'app',
    tableName: 'meta_hr_level',
    primaryKey: 'id',
  },

  api: {
    baseEndpoint: '/api/v1/meta/hr-level',
    endpoints: {
      list: 'GET /api/v1/meta?category=hr_level',
      get: 'GET /api/v1/meta/hr-level/:id',
      create: 'POST /api/v1/meta/hr-level',
      update: 'PUT /api/v1/meta/hr-level/:id',
      delete: 'DELETE /api/v1/meta/hr-level/:id',
    },
  },

  ui: {
    sidebarIcon: 'users',
    theme: {
      primaryColor: 'rose',
      accentColor: 'pink',
      gradientFrom: 'from-rose-600',
      gradientTo: 'to-pink-600',
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
        title: 'Total Levels',
        value: 'count',
        icon: 'users',
        color: 'rose',
      },
      {
        title: 'Management Levels',
        value: 'count',
        filter: { is_management_level: true },
        icon: 'crown',
        color: 'yellow',
      },
      {
        title: 'Executive Levels',
        value: 'count',
        filter: { is_executive_level: true },
        icon: 'star',
        color: 'purple',
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
      label: 'Level Name',
      required: true,
      placeholder: 'e.g., Junior, Senior, Manager',
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
      placeholder: 'Describe this HR level',
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
      label: 'Level ID',
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

    salaryBandMin: {
      ddlField: 'salary_band_min',
      apiField: 'salary_band_min',
      dataType: 'number',
      inputType: 'currency',
      label: 'Min Salary (CAD)',
      placeholder: 'Minimum salary for this level',
      pii: true,
      validation: {
        min: 0,
        max: 1000000,
      },
      uiBehavior: {
        sort: true,
        filter: false,
        visible: true,
        priority: 3,
        width: '120px',
        align: 'right',
        renderAs: 'currency',
      },
      icon: 'dollar-sign',
    },

    salaryBandMax: {
      ddlField: 'salary_band_max',
      apiField: 'salary_band_max',
      dataType: 'number',
      inputType: 'currency',
      label: 'Max Salary (CAD)',
      placeholder: 'Maximum salary for this level',
      pii: true,
      validation: {
        min: 0,
        max: 1000000,
      },
      uiBehavior: {
        sort: true,
        filter: false,
        visible: true,
        priority: 4,
        width: '120px',
        align: 'right',
        renderAs: 'currency',
      },
      icon: 'banknote',
    },

    isManagementLevel: {
      ddlField: 'is_management_level',
      apiField: 'is_management_level',
      dataType: 'boolean',
      inputType: 'checkbox',
      label: 'Management Level',
      description: 'Is this a management-level position?',
      pii: false,
      defaultValue: false,
      validation: {},
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        priority: 5,
        width: '120px',
        renderAs: 'boolean',
        align: 'center',
      },
      icon: 'crown',
    },

    isExecutiveLevel: {
      ddlField: 'is_executive_level',
      apiField: 'is_executive_level',
      dataType: 'boolean',
      inputType: 'checkbox',
      label: 'Executive Level',
      description: 'Is this an executive-level position?',
      pii: false,
      defaultValue: false,
      validation: {},
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        priority: 6,
        width: '120px',
        renderAs: 'boolean',
        align: 'center',
      },
      icon: 'star',
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
        visible: false,
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
      title: 'Create HR Level',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'levelId'],
        },
        {
          title: 'Salary Band',
          fields: ['salaryBandMin', 'salaryBandMax'],
        },
        {
          title: 'Level Properties',
          fields: ['isManagementLevel', 'isExecutiveLevel', 'sortOrder'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    edit: {
      title: 'Edit HR Level',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description', 'levelId'],
        },
        {
          title: 'Salary Band',
          fields: ['salaryBandMin', 'salaryBandMax'],
        },
        {
          title: 'Level Properties',
          fields: ['isManagementLevel', 'isExecutiveLevel', 'sortOrder'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    view: {
      title: 'HR Level Details',
      readonly: true,
      sections: [
        {
          title: 'Overview',
          fields: ['name', 'description', 'levelId'],
        },
        {
          title: 'Salary Information',
          fields: ['salaryBandMin', 'salaryBandMax'],
        },
        {
          title: 'Level Attributes',
          fields: ['isManagementLevel', 'isExecutiveLevel', 'sortOrder'],
        },
        {
          title: 'Status',
          fields: ['active'],
        },
      ],
    },
  },

  permissions: {
    create: ['admin', 'system_admin', 'hr_admin'],
    read: ['admin', 'system_admin', 'hr_admin', 'hr_manager'],
    update: ['admin', 'system_admin', 'hr_admin'],
    delete: ['admin', 'system_admin'],
  },

  navigation: {
    breadcrumbs: [
      { label: 'Meta Data', path: '/meta' },
      { label: 'HR Levels', path: '/meta/hrLevel' },
    ],
  },

  actions: {
    primary: [
      {
        key: 'create',
        label: 'New Level',
        icon: 'plus',
        action: 'create',
        permissions: ['create'],
        style: 'primary',
      },
    ],
    row: [
      {
        key: 'edit',
        label: 'Edit Level',
        icon: 'edit',
        action: 'edit',
        permissions: ['update'],
        style: 'secondary',
      },
      {
        key: 'delete',
        label: 'Delete Level',
        icon: 'trash',
        action: 'delete',
        permissions: ['delete'],
        style: 'danger',
        confirmRequired: true,
        confirmMessage: 'Are you sure you want to delete this HR level?',
      },
    ],
  },
};

export default hrLevelConfig;