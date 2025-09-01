// ============================================================================
// LOCATION LEVEL META CONFIGURATION
// ============================================================================

import type { EntityPageConfig } from '../types';

export const locationLevelConfig: EntityPageConfig = {
  entityName: 'location-level',
  displayName: 'Location Level',
  displayNamePlural: 'Location Levels',
  description: 'Geographic hierarchy levels for location organization structure',
  
  schema: {
    schemaName: 'app',
    tableName: 'meta_loc_level',
    primaryKey: 'id',
  },

  api: {
    baseEndpoint: '/api/v1/meta/location-level',
    endpoints: {
      list: 'GET /api/v1/meta?category=loc_level',
      get: 'GET /api/v1/meta/location-level/:id',
      create: 'POST /api/v1/meta/location-level',
      update: 'PUT /api/v1/meta/location-level/:id',
      delete: 'DELETE /api/v1/meta/location-level/:id',
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

    description: {
      ddlField: 'descr',
      apiField: 'descr',
      dataType: 'text',
      inputType: 'textarea',
      label: 'Description',
      placeholder: 'Describe this location level',
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
      placeholder: '0, 1, 2...',
      pii: false,
      validation: {
        min: 0,
        max: 10,
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

    countryCode: {
      ddlField: 'country_code',
      apiField: 'country_code',
      dataType: 'string',
      inputType: 'select',
      label: 'Country',
      pii: false,
      options: [
        { value: 'CA', label: 'Canada' },
        { value: 'US', label: 'United States' },
      ],
      validation: {},
      uiBehavior: {
        sort: true,
        filter: true,
        visible: true,
        priority: 3,
        width: '100px',
      },
      icon: 'flag',
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
      title: 'Create Location Level',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description'],
        },
        {
          title: 'Level Properties',
          fields: ['levelId', 'countryCode', 'sortOrder'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    edit: {
      title: 'Edit Location Level',
      sections: [
        {
          title: 'Basic Information',
          fields: ['name', 'description'],
        },
        {
          title: 'Level Properties',
          fields: ['levelId', 'countryCode', 'sortOrder'],
        },
        {
          title: 'Settings',
          fields: ['active'],
        },
      ],
    },

    view: {
      title: 'Location Level Details',
      readonly: true,
      sections: [
        {
          title: 'Overview',
          fields: ['name', 'description'],
        },
        {
          title: 'Properties',
          fields: ['levelId', 'countryCode', 'sortOrder'],
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
      { label: 'Location Levels', path: '/meta/location-level' },
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
        confirmMessage: 'Are you sure you want to delete this location level?',
      },
    ],
  },
};

export default locationLevelConfig;