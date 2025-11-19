import type { EntityConfig } from '../types';

export const formConfig: EntityConfig = {
  entityCode: 'form',
  displayName: 'Form',
  displayNamePlural: 'Forms',
  description: 'Dynamic form management',

  api: {
    endpoints: {
      list: 'GET /api/v1/form',
      create: 'POST /api/v1/form',
      read: 'GET /api/v1/form/:id',
      update: 'PUT /api/v1/form/:id',
      delete: 'DELETE /api/v1/form/:id'
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
      label: 'Form Name',
      uiBehavior: { visible: true, priority: 1, sort: true, filter: true, width: 200 }
    },
    descr: {
      apiField: 'descr',
      label: 'Description',
      uiBehavior: { visible: true, priority: 2, filter: true, width: 300 }
    },
    form_type: {
      apiField: 'form_type',
      label: 'Type',
      uiBehavior: { visible: true, priority: 3, filter: true, renderAs: 'badge', width: 120 }
    },
    form_status: {
      apiField: 'form_status',
      label: 'Status',
      uiBehavior: { visible: true, priority: 4, filter: true, renderAs: 'badge', width: 120 }
    },
    form_category: {
      apiField: 'form_category',
      label: 'Category',
      uiBehavior: { visible: true, priority: 5, filter: true, renderAs: 'badge', width: 120 }
    },
    created_ts: {
      apiField: 'created_ts',
      label: 'Created',
      uiBehavior: { visible: true, priority: 6, sort: true, width: 120 }
    },
    updated_ts: {
      apiField: 'updated_ts',
      label: 'Updated',
      uiBehavior: { visible: true, priority: 7, sort: true, width: 120 }
    }
  },

  ui: {
    sidebarIcon: 'FileText',
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