import type { EntityConfig } from '../types';

export const taskConfig: EntityConfig = {
  entityType: 'task',
  displayName: 'Task',
  displayNamePlural: 'Tasks',
  description: 'Task management and tracking',

  api: {
    endpoints: {
      list: 'GET /api/v1/task',
      create: 'POST /api/v1/task',
      read: 'GET /api/v1/task/:id',
      update: 'PUT /api/v1/task/:id',
      delete: 'DELETE /api/v1/task/:id'
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
      label: 'Task Name',
      uiBehavior: { visible: true, priority: 1, sort: true, filter: true, width: 200 }
    },
    descr: {
      apiField: 'descr',
      label: 'Description',
      uiBehavior: { visible: true, priority: 2, filter: true, width: 300 }
    },
    task_type: {
      apiField: 'task_type',
      label: 'Type',
      uiBehavior: { visible: true, priority: 3, filter: true, renderAs: 'badge', width: 120 }
    },
    task_status: {
      apiField: 'task_status',
      label: 'Status',
      uiBehavior: { visible: true, priority: 4, filter: true, renderAs: 'badge', width: 120 }
    },
    task_stage: {
      apiField: 'task_stage',
      label: 'Stage',
      uiBehavior: { visible: true, priority: 5, filter: true, renderAs: 'badge', width: 120 }
    },
    priority_level: {
      apiField: 'priority_level',
      label: 'Priority',
      uiBehavior: { visible: true, priority: 6, filter: true, renderAs: 'badge', width: 100 }
    },
    planned_start_date: {
      apiField: 'planned_start_date',
      label: 'Start Date',
      uiBehavior: { visible: true, priority: 7, sort: true, width: 120 }
    },
    planned_end_date: {
      apiField: 'planned_end_date',
      label: 'End Date',
      uiBehavior: { visible: true, priority: 8, sort: true, width: 120 }
    },
    estimated_hours: {
      apiField: 'estimated_hours',
      label: 'Est. Hours',
      uiBehavior: { visible: true, priority: 9, width: 100 }
    },
    actual_hours: {
      apiField: 'actual_hours',
      label: 'Actual Hours',
      uiBehavior: { visible: true, priority: 10, width: 100 }
    },
    project_name: {
      apiField: 'project_name',
      label: 'Project',
      uiBehavior: { visible: true, priority: 11, filter: true, width: 150 }
    },
    created: {
      apiField: 'created',
      label: 'Created',
      uiBehavior: { visible: false, priority: 12, sort: true }
    },
    updated: {
      apiField: 'updated',
      label: 'Updated',
      uiBehavior: { visible: false, priority: 13, sort: true }
    }
  },

  ui: {
    sidebarIcon: 'CheckSquare',
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