import type { EntityConfig } from '../types';

export const wikiConfig: EntityConfig = {
  entityCode: 'wiki',
  displayName: 'Wiki',
  displayNamePlural: 'Wiki Pages',
  description: 'Knowledge base and documentation',

  api: {
    endpoints: {
      list: 'GET /api/v1/wiki',
      create: 'POST /api/v1/wiki',
      read: 'GET /api/v1/wiki/:id',
      update: 'PUT /api/v1/wiki/:id',
      delete: 'DELETE /api/v1/wiki/:id'
    }
  },

  fields: {
    id: {
      apiField: 'id',
      label: 'ID',
      uiBehavior: { visible: false, priority: 0 }
    },
    title: {
      apiField: 'title',
      label: 'Title',
      uiBehavior: { visible: true, priority: 1, sort: true, filter: true, width: 250 }
    },
    content: {
      apiField: 'content',
      label: 'Content',
      uiBehavior: { visible: false, priority: 2 }
    },
    wiki_category: {
      apiField: 'wiki_category',
      label: 'Category',
      uiBehavior: { visible: true, priority: 3, filter: true, renderAs: 'badge', width: 120 }
    },
    wiki_status: {
      apiField: 'wiki_status',
      label: 'Status',
      uiBehavior: { visible: true, priority: 4, filter: true, renderAs: 'badge', width: 120 }
    },
    is_public: {
      apiField: 'is_public',
      label: 'Public',
      uiBehavior: { visible: true, priority: 5, renderAs: 'boolean', width: 80 }
    },
    tags: {
      apiField: 'tags',
      label: 'Tags',
      uiBehavior: { visible: true, priority: 6, filter: true, width: 180 }
    },
    created_ts: {
      apiField: 'created_ts',
      label: 'Created',
      uiBehavior: { visible: true, priority: 7, sort: true, width: 120 }
    },
    updated_ts: {
      apiField: 'updated_ts',
      label: 'Updated',
      uiBehavior: { visible: true, priority: 8, sort: true, width: 120 }
    }
  },

  ui: {
    sidebarIcon: 'Book',
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