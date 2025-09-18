import type { EntityConfig } from '../types';

export const artifactConfig: EntityConfig = {
  entityType: 'artifact',
  displayName: 'Artifact',
  displayNamePlural: 'Artifacts',
  description: 'Document and file management',

  api: {
    endpoints: {
      list: 'GET /api/v1/artifact',
      create: 'POST /api/v1/artifact',
      read: 'GET /api/v1/artifact/:id',
      update: 'PUT /api/v1/artifact/:id',
      delete: 'DELETE /api/v1/artifact/:id'
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
      label: 'Artifact Name',
      uiBehavior: { visible: true, priority: 1, sort: true, filter: true, width: 200 }
    },
    descr: {
      apiField: 'descr',
      label: 'Description',
      uiBehavior: { visible: true, priority: 2, filter: true, width: 300 }
    },
    artifact_type: {
      apiField: 'artifact_type',
      label: 'Type',
      uiBehavior: { visible: true, priority: 3, filter: true, renderAs: 'badge', width: 120 }
    },
    file_name: {
      apiField: 'file_name',
      label: 'File Name',
      uiBehavior: { visible: true, priority: 4, filter: true, width: 180 }
    },
    file_size: {
      apiField: 'file_size',
      label: 'Size',
      uiBehavior: { visible: true, priority: 5, renderAs: 'large', width: 100 }
    },
    mime_type: {
      apiField: 'mime_type',
      label: 'MIME Type',
      uiBehavior: { visible: true, priority: 6, filter: true, width: 120 }
    },
    version_number: {
      apiField: 'version_number',
      label: 'Version',
      uiBehavior: { visible: true, priority: 7, width: 80 }
    },
    is_current_version: {
      apiField: 'is_current_version',
      label: 'Current',
      uiBehavior: { visible: true, priority: 8, renderAs: 'boolean', width: 80 }
    },
    created: {
      apiField: 'created',
      label: 'Created',
      uiBehavior: { visible: true, priority: 9, sort: true, width: 120 }
    },
    updated: {
      apiField: 'updated',
      label: 'Updated',
      uiBehavior: { visible: false, priority: 10, sort: true }
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
      { key: 'download', label: 'Download', icon: 'download', action: 'download', style: 'primary' },
      { key: 'delete', label: 'Delete', icon: 'trash', action: 'delete', style: 'danger' }
    ]
  }
};