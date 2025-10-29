import type { EntityConfig } from '../types';

export const bizConfig: EntityConfig = {
  entityType: 'biz',
  displayName: 'Business Unit',
  displayNamePlural: 'Business Units',
  description: 'Business unit management and organization',

  api: {
    endpoints: {
      list: 'GET /api/v1/biz',
      create: 'POST /api/v1/biz',
      read: 'GET /api/v1/biz/:id',
      update: 'PUT /api/v1/biz/:id',
      delete: 'DELETE /api/v1/biz/:id'
    }
  },

  fields: {
    id: {
      apiField: 'id',
      label: 'ID',
      uiBehavior: { visible: false, priority: 0 }
    },
    name: {
      apiField: 'name',
      label: 'Business Unit Name',
      uiBehavior: { visible: true, priority: 1, sort: true, filter: true, width: 200 }
    },
    code: {
      apiField: 'code',
      label: 'Code',
      uiBehavior: { visible: true, priority: 2, filter: true, width: 100 }
    },
    descr: {
      apiField: 'descr',
      label: 'Description',
      uiBehavior: { visible: true, priority: 3, filter: true, width: 300 }
    },
    business_type: {
      apiField: 'business_type',
      label: 'Type',
      uiBehavior: { visible: true, priority: 4, filter: true, renderAs: 'badge', width: 120 }
    },
    business_status: {
      apiField: 'business_status',
      label: 'Status',
      uiBehavior: { visible: true, priority: 5, filter: true, renderAs: 'badge', width: 120 }
    },
    business_level: {
      apiField: 'business_level',
      label: 'Level',
      uiBehavior: { visible: true, priority: 6, filter: true, renderAs: 'badge', width: 120 }
    },
    parent_business_name: {
      apiField: 'parent_business_name',
      label: 'Parent Unit',
      uiBehavior: { visible: true, priority: 7, filter: true, width: 180 }
    },
    created_ts: {
      apiField: 'created_ts',
      label: 'Created',
      uiBehavior: { visible: false, priority: 8, sort: true }
    },
    updated_ts: {
      apiField: 'updated_ts',
      label: 'Updated',
      uiBehavior: { visible: false, priority: 9, sort: true }
    }
  },

  ui: {
    sidebarIcon: 'Building2',
    table: {
      enableSearch: true,
      enableFilters: true,
      defaultPageSize: 20
    }
  },

  actions: {
    row: [
      { key: 'view', label: 'View', icon: 'eye', action: 'view', style: 'default' },
      { key: 'edit', label: 'Edit', icon: 'edit', action: 'edit', style: 'primary' },
      { key: 'delete', label: 'Delete', icon: 'trash', action: 'delete', style: 'danger' }
    ]
  }
};