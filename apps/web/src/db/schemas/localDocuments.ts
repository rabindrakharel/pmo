/**
 * Local Document Type Definitions
 *
 * RxDB local documents are device-specific state that persists
 * in IndexedDB but does NOT sync to the backend.
 *
 * These replace the Zustand stores for persistent local state.
 *
 * Local document keys use the pattern: _local/{key}
 */

/**
 * Global Settings (replaces globalSettingsMetadataStore)
 *
 * Stores formatting preferences for currency, dates, timestamps, and booleans.
 * Persists across browser sessions.
 */
export interface GlobalSettingsLocal {
  currency: {
    symbol: string;
    decimals: number;
    locale: string;
    position: 'prefix' | 'suffix';
    thousandsSeparator: string;
    decimalSeparator: string;
  };
  date: {
    style: 'short' | 'medium' | 'long' | 'full';
    locale: string;
    format: string;  // e.g., 'YYYY-MM-DD'
  };
  timestamp: {
    style: 'short' | 'medium' | 'long' | 'full';
    locale: string;
    includeSeconds: boolean;
  };
  boolean: {
    trueLabel: string;
    falseLabel: string;
    trueColor: string;
    falseColor: string;
    trueIcon: string;
    falseIcon: string;
  };
  _updatedAt: number;  // Last update timestamp
}

/**
 * Default global settings values
 */
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettingsLocal = {
  currency: {
    symbol: '$',
    decimals: 2,
    locale: 'en-CA',
    position: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  date: {
    style: 'medium',
    locale: 'en-CA',
    format: 'YYYY-MM-DD'
  },
  timestamp: {
    style: 'medium',
    locale: 'en-CA',
    includeSeconds: false
  },
  boolean: {
    trueLabel: 'Yes',
    falseLabel: 'No',
    trueColor: 'green',
    falseColor: 'red',
    trueIcon: 'check',
    falseIcon: 'x'
  },
  _updatedAt: 0
};

/**
 * Component Metadata (replaces entityComponentMetadataStore)
 *
 * Stores field metadata for entity components (table, form, kanban, etc.).
 * Cached per entityCode:componentName combination.
 */
export interface ComponentMetadataLocal {
  entityCode: string;
  componentName: string;
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
  _updatedAt: number;
  _ttl: number;  // TTL for auto-invalidation (ms)
}

/**
 * View field metadata (for rendering)
 */
export interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType: string;
  style?: Record<string, unknown>;
  lookupEntity?: string;
  lookupSource?: string;
  datalabelKey?: string;
  component?: string;
  vizContainer?: { view?: string; edit?: string };
}

/**
 * Edit field metadata (for forms)
 */
export interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;
  required?: boolean;
  lookupEntity?: string;
  lookupSource?: string;
  datalabelKey?: string;
  validation?: Record<string, unknown>;
}

/**
 * Edit State (replaces useEntityEditStore)
 *
 * Stores the current edit session state for an entity.
 * Persists draft edits across page refreshes!
 */
export interface EditStateLocal {
  entityType: string;
  entityId: string;
  originalData: Record<string, unknown>;
  currentData: Record<string, unknown>;
  dirtyFields: string[];  // Array instead of Set (JSON-serializable)
  isEditing: boolean;
  undoStack: Array<{ field: string; value: unknown }>;
  redoStack: Array<{ field: string; value: unknown }>;
  _updatedAt: number;
}

/**
 * Default edit state
 */
export const DEFAULT_EDIT_STATE: EditStateLocal = {
  entityType: '',
  entityId: '',
  originalData: {},
  currentData: {},
  dirtyFields: [],
  isEditing: false,
  undoStack: [],
  redoStack: [],
  _updatedAt: 0
};

/**
 * UI Preferences (new - optional)
 *
 * Stores user UI preferences that persist across sessions.
 */
export interface UIPreferencesLocal {
  sidebarCollapsed: boolean;
  defaultView: 'table' | 'grid' | 'kanban' | 'calendar';
  theme: 'light' | 'dark' | 'system';
  recentEntities: string[];  // Last 10 viewed entities
  _updatedAt: number;
}

/**
 * Default UI preferences
 */
export const DEFAULT_UI_PREFERENCES: UIPreferencesLocal = {
  sidebarCollapsed: false,
  defaultView: 'table',
  theme: 'system',
  recentEntities: [],
  _updatedAt: 0
};

/**
 * Ref Data Entity Instance Cache (replaces useRefDataEntityInstanceCache)
 *
 * Stores entity instance name lookups for reference resolution.
 * Structure: { [entityCode]: { [uuid]: name } }
 */
export interface RefDataCacheLocal {
  [entityCode: string]: Record<string, string>;
}

/**
 * Local document key generators
 */
export const LocalDocKeys = {
  globalSettings: 'global-settings',
  componentMetadata: (entityCode: string, componentName: string) =>
    `component-metadata:${entityCode}:${componentName}`,
  editState: (entityType: string, entityId: string) =>
    `edit-state:${entityType}:${entityId}`,
  uiPreferences: 'ui-preferences',
  refDataCache: (entityCode: string) => `ref-data-cache:${entityCode}`
} as const;
