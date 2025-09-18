import type { EntityConfig } from '../types';

export const projectConfig: EntityConfig = {
  entityType: 'project',
  displayName: 'Project',
  displayNamePlural: 'Projects',
  description: 'Project management and tracking',

  api: {
    endpoints: {
      list: 'GET /api/v1/project',
      create: 'POST /api/v1/project',
      read: 'GET /api/v1/project/:id',
      update: 'PUT /api/v1/project/:id',
      delete: 'DELETE /api/v1/project/:id'
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
      label: 'Project Name',
      uiBehavior: { visible: true, priority: 1, sort: true, filter: true, width: 200 }
    },
    descr: {
      apiField: 'descr',
      label: 'Description',
      uiBehavior: { visible: true, priority: 2, filter: true, width: 300 }
    },
    project_type: {
      apiField: 'project_type',
      label: 'Type',
      uiBehavior: { visible: true, priority: 3, filter: true, renderAs: 'badge', width: 120 }
    },
    project_status: {
      apiField: 'project_status',
      label: 'Status',
      uiBehavior: { visible: true, priority: 4, filter: true, renderAs: 'badge', width: 120 }
    },
    project_stage: {
      apiField: 'project_stage',
      label: 'Stage',
      uiBehavior: { visible: true, priority: 5, filter: true, renderAs: 'badge', width: 120 }
    },
    planned_start_date: {
      apiField: 'planned_start_date',
      label: 'Start Date',
      uiBehavior: { visible: true, priority: 6, sort: true, width: 120 }
    },
    planned_end_date: {
      apiField: 'planned_end_date',
      label: 'End Date',
      uiBehavior: { visible: true, priority: 7, sort: true, width: 120 }
    },
    budget_allocated: {
      apiField: 'budget_allocated',
      label: 'Budget',
      uiBehavior: { visible: true, priority: 8, renderAs: 'currency', width: 120 }
    },
    created: {
      apiField: 'created',
      label: 'Created',
      uiBehavior: { visible: false, priority: 9, sort: true }
    },
    updated: {
      apiField: 'updated',
      label: 'Updated',
      uiBehavior: { visible: false, priority: 10, sort: true }
    }
  },

  ui: {
    sidebarIcon: 'FolderOpen',
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