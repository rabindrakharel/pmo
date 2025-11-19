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

export interface ConfigApiResponse {
  success: boolean;
  data: FrontendEntityConfig;
  entityCode: string;
  timestamp: string;
}

export interface EntityTypesApiResponse {
  success: boolean;
  data: Array<{
    entityCode: string;
    displayName: string;
    displayNamePlural: string;
    description: string;
    icon: string;
    endpoint: string;
  }>;
  total: number;
  timestamp: string;
}