// ============================================================================
// ORGANIZATION LEVEL META CONFIGURATION
// ============================================================================

import type { EntityPageConfig } from '../types.js';

export const orgLevelConfig: EntityPageConfig = {
  entityName: 'orgLevel',
  displayName: 'Organization Level',
  displayNamePlural: 'Organization Levels',
  description: 'Geographic hierarchy levels for organization structure',
  
  schema: {
    schemaName: 'app',
    tableName: 'meta_loc_level',
    primaryKey: 'id',
  },

  api: {
    baseEndpoint: '/api/v1/meta/org-level',
    endpoints: {
      list: 'GET /api/v1/meta?category=org_level',
      get: 'GET /api/v1/meta/org-level/:id',
      create: 'POST /api/v1/meta/org-level',
      update: 'PUT /api/v1/meta/org-level/:id',
      delete: 'DELETE /api/v1/meta/org-level/:id',
    },
  },

  ui: {
    sidebarIcon: 'map-pin',
    theme: {
      primaryColor: 'emerald',
      accentColor: 'green',
      gradientFrom: 'from-emerald-600',
      gradientTo: 'to-green-600',
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
        icon: 'map-pin',
        color: 'emerald',
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
      placeholder: 'e.g., Country, Province, City',
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
      title: 'Create Organization Level',
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
      title: 'Edit Organization Level',
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
      title: 'Organization Level Details',
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
      { label: 'Organization Level', path: '/meta/org-level' },
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
        confirmMessage: 'Are you sure you want to delete this organization level?',
      },
    ],
  },
};

export default orgLevelConfig;