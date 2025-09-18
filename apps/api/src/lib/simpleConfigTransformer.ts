import type { EntityConfig } from '../entityConfig/meta/types.js';

export interface SimpleFrontendConfig {
  entityType: string;
  displayName: string;
  displayNamePlural: string;
  description: string;
  api: {
    endpoints: {
      list: string;
      create: string;
      read: string;
      update: string;
      delete: string;
    };
  };
  fields: Record<string, {
    apiField: string;
    label: string;
    uiBehavior: {
      visible: boolean;
      priority?: number;
      sort?: boolean;
      filter?: boolean;
      width?: number | string;
      renderAs?: string;
    };
  }>;
  ui: {
    sidebarIcon: string;
    table: {
      enableSearch: boolean;
      enableFilters: boolean;
      defaultPageSize: number;
    };
  };
  actions: {
    row: Array<{
      key: string;
      label: string;
      icon: string;
      action: string;
      style: string;
    }>;
  };
}

export function transformSimpleConfigForFrontend(config: EntityConfig): SimpleFrontendConfig {
  return {
    entityType: config.entityType,
    displayName: config.displayName,
    displayNamePlural: config.displayNamePlural,
    description: config.description,

    api: {
      endpoints: config.api.endpoints
    },

    fields: config.fields,

    ui: config.ui,

    actions: config.actions
  };
}