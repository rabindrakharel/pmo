import type { EntityPageConfig } from '../entityConfig/types.js';

export interface FrontendEntityConfig {
  entityName: string;
  displayName: string;
  displayNamePlural: string;
  description: string;
  api: {
    baseEndpoint: string;
    endpoints: {
      list: string;
      get: string;
      create: string;
      update: string;
      delete: string;
    };
  };
  ui: {
    sidebarIcon: string;
    theme: {
      primaryColor: string;
      accentColor: string;
      gradientFrom: string;
      gradientTo: string;
    };
    layout: {
      defaultView: string;
      enableMultiView: boolean;
      showSummaryCards: boolean;
      enableQuickActions: boolean;
    };
    table: {
      defaultPageSize: number;
      enableSearch: boolean;
      enableFilters: boolean;
      enableSorting: boolean;
      enableExport: boolean;
      stickyHeader: boolean;
      rowActions: string[];
    };
    summaryCards: Array<{
      title: string;
      value: string;
      filter?: any;
      icon: string;
      color: string;
    }>;
  };
  fields: Record<string, {
    apiField: string;
    dataType: string;
    inputType: string;
    label: string;
    required?: boolean;
    placeholder?: string;
    description?: string;
    defaultValue?: any;
    options?: Array<{ value: string; label: string }>;
    validation: any;
    uiBehavior: {
      sort: boolean;
      filter: boolean;
      visible: boolean;
      searchable?: boolean;
      priority?: number;
      width?: string;
      align?: string;
      renderAs?: string;
    };
    icon?: string;
  }>;
  forms: {
    create: {
      title: string;
      sections: Array<{
        title: string;
        fields: string[];
      }>;
    };
    edit: {
      title: string;
      sections: Array<{
        title: string;
        fields: string[];
      }>;
    };
    view: {
      title: string;
      readonly: boolean;
      sections: Array<{
        title: string;
        fields: string[];
      }>;
    };
  };
  navigation: {
    breadcrumbs: Array<{
      label: string;
      path: string;
    }>;
  };
  actions: {
    primary: Array<{
      key: string;
      label: string;
      icon: string;
      action: string;
      style: string;
    }>;
    row: Array<{
      key: string;
      label: string;
      icon: string;
      action: string;
      style: string;
      confirmRequired?: boolean;
      confirmMessage?: string;
    }>;
  };
}

export function transformConfigForFrontend(config: EntityPageConfig): FrontendEntityConfig {
  const frontendConfig: FrontendEntityConfig = {
    entityName: config.entityName,
    displayName: config.displayName,
    displayNamePlural: config.displayNamePlural,
    description: config.description,
    
    api: {
      baseEndpoint: config.api.baseEndpoint,
      endpoints: {
        list: config.api.endpoints.list,
        get: config.api.endpoints.get,
        create: config.api.endpoints.create,
        update: config.api.endpoints.update,
        delete: config.api.endpoints.delete,
      }
    },
    
    ui: {
      sidebarIcon: config.ui.sidebarIcon,
      theme: { ...config.ui.theme },
      layout: { 
        enableMultiView: true,
        showSummaryCards: true,
        enableQuickActions: true,
        ...config.ui.layout 
      },
      table: { 
        stickyHeader: true,
        ...config.ui.table 
      },
      summaryCards: config.ui.summaryCards || [],
    },
    
    fields: {},
    
    forms: {
      create: {
        title: config.forms.create.title,
        sections: config.forms.create.sections.map(section => ({
          title: section.title,
          fields: section.fields,
        }))
      },
      edit: {
        title: config.forms.edit.title,
        sections: config.forms.edit.sections.map(section => ({
          title: section.title,
          fields: section.fields,
        }))
      },
      view: {
        title: config.forms.view.title,
        readonly: config.forms.view.readonly,
        sections: config.forms.view.sections.map(section => ({
          title: section.title,
          fields: section.fields,
        }))
      }
    },
    
    navigation: {
      breadcrumbs: config.navigation.breadcrumbs,
    },
    
    actions: {
      primary: config.actions.primary.map(action => ({
        key: action.key,
        label: action.label,
        icon: action.icon,
        action: action.action,
        style: action.style,
      })),
      row: config.actions.row.map(action => ({
        key: action.key,
        label: action.label,
        icon: action.icon,
        action: action.action,
        style: action.style,
        confirmRequired: action.confirmRequired,
        confirmMessage: action.confirmMessage,
      }))
    }
  };

  // Transform fields - remove sensitive database information
  Object.entries(config.fields).forEach(([fieldKey, fieldConfig]) => {
    frontendConfig.fields[fieldKey] = {
      // Use only apiField, not ddlField (database column name)
      apiField: fieldConfig.apiField,
      dataType: fieldConfig.dataType,
      inputType: fieldConfig.inputType,
      label: fieldConfig.label,
      required: fieldConfig.required,
      placeholder: fieldConfig.placeholder,
      description: fieldConfig.description,
      defaultValue: fieldConfig.defaultValue,
      options: typeof fieldConfig.options === 'string' ? fieldConfig.options : String(fieldConfig.options || ''),
      validation: fieldConfig.validation,
      uiBehavior: {
        sort: fieldConfig.uiBehavior.sort,
        filter: fieldConfig.uiBehavior.filter,
        visible: fieldConfig.uiBehavior.visible,
        searchable: fieldConfig.uiBehavior.searchable,
        priority: fieldConfig.uiBehavior.priority,
        width: fieldConfig.uiBehavior.width,
        align: fieldConfig.uiBehavior.align,
        renderAs: fieldConfig.uiBehavior.renderAs,
      },
      icon: fieldConfig.icon,
    };
  });

  return frontendConfig;
}