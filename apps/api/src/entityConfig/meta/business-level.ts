// ============================================================================
// BUSINESS LEVEL META CONFIGURATION
// ============================================================================

import type { EntityPageConfig } from '../types.js';

export const businessLevelConfig: EntityPageConfig = {
  entityName: 'businessLevel',
  displayName: 'Business Level',
  displayNamePlural: 'Business Levels',
  description: 'Organizational hierarchy levels for business unit structure',
  
  schema: {
    schemaName: 'app',
    tableName: 'meta_biz_level',
    primaryKey: 'id',
  },

  api: {
    baseEndpoint: '/api/v1/meta/business-level',
    endpoints: {
      list: 'GET /api/v1/meta?category=biz_level',
      get: 'GET /api/v1/meta/business-level/:id',
      create: 'POST /api/v1/meta/business-level',
      update: 'PUT /api/v1/meta/business-level/:id',
      delete: 'DELETE /api/v1/meta/business-level/:id',
    },
  },

  ui: {
    sidebarIcon: 'building-2',
    theme: {
      primaryColor: 'indigo',
      accentColor: 'blue',
      gradientFrom: 'from-indigo-600',
      gradientTo: 'to-blue-600',
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
        icon: 'building-2',
        color: 'indigo',
      },
      {
        title: 'Active Levels',
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
      label: 'Level Name',
      required: true,
      placeholder: 'e.g., Corporation, Division, Department',
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
        priority: 4,
        width: '80px',
        renderAs: 'boolean',
        align: 'center',
      },
      icon: 'check',
    },
  },

  forms: {
    create: {
      title: 'Create Business Level',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    edit: {
      title: 'Edit Business Level',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    view: {
      title: 'Business Level Details',
      readonly: true,
      sections: [
        {
          title: 'Overview',
          fields: ['name'],
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
      { label: 'Business Level', path: '/meta/business-level' },
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
        confirmMessage: 'Are you sure you want to delete this business level?',
      },
    ],
  },
};

export default businessLevelConfig;