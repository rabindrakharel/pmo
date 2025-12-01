// ============================================================================
// Cache Types - Unified Type Definitions
// ============================================================================
// All type definitions for the cache system in one place
// ============================================================================

// ============================================================================
// Global Settings Types
// ============================================================================

export interface CurrencySettings {
  symbol: string;
  decimals: number;
  locale: string;
}

export interface DateSettings {
  format: string;
  locale: string;
}

export interface GlobalSettings {
  currency: CurrencySettings;
  date: DateSettings;
  [key: string]: unknown;
}

// ============================================================================
// Datalabel Types
// ============================================================================

export interface DatalabelOption {
  /** Unique ID */
  id: number;
  /** Display name */
  name: string;
  /** Description */
  descr?: string;
  /** Parent ID for hierarchical datalabels */
  parent_id?: number | null;
  /** Parent IDs for multi-level hierarchy */
  parent_ids?: number[];
  /** Display order */
  sort_order: number;
  /** Badge color code */
  color_code?: string;
  /** Active status */
  active_flag?: boolean;
}

// ============================================================================
// Entity Code Types
// ============================================================================

export interface EntityCode {
  /** Entity type code (e.g., 'project', 'task') */
  code: string;
  /** Entity name */
  name: string;
  /** UI display label */
  ui_label: string;
  /** UI icon name */
  ui_icon?: string;
  /** Database table name */
  db_table?: string;
  /** Database model type */
  db_model_type?: string;
  /** Child entity type codes */
  child_entity_codes: string[];
  /** Display order in navigation */
  display_order: number;
  /** Domain code for grouping */
  domain_code?: string;
  /** Column metadata for the entity */
  column_metadata?: unknown[];
  /** Whether entity type is active */
  active_flag: boolean;
}

// ============================================================================
// Entity Instance Types
// ============================================================================

export interface EntityInstance {
  /** Entity type code */
  entity_code: string;
  /** Entity instance UUID */
  entity_instance_id: string;
  /** Display name */
  entity_instance_name: string;
  /** Business code (e.g., 'PROJ-001') */
  code?: string | null;
}

// ============================================================================
// Entity Link Types
// ============================================================================

export interface EntityLink {
  /** Link ID */
  id: string;
  /** Parent entity type code */
  entity_code: string;
  /** Parent entity instance ID */
  entity_instance_id: string;
  /** Child entity type code */
  child_entity_code: string;
  /** Child entity instance ID */
  child_entity_instance_id: string;
  /** Relationship type (e.g., 'contains', 'references') */
  relationship_type: string;
}

export interface LinkForwardIndex {
  /** Parent entity type code */
  parentCode: string;
  /** Parent entity instance ID */
  parentId: string;
  /** Child entity type code */
  childCode: string;
  /** Array of child entity instance IDs */
  childIds: string[];
  /** Map of childId -> relationshipType */
  relationships: Record<string, string>;
}

export interface LinkReverseIndex {
  /** Child entity type code */
  childCode: string;
  /** Child entity instance ID */
  childId: string;
  /** Array of parent references */
  parents: Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
}

// ============================================================================
// Entity Instance Metadata Types
// ============================================================================

export interface ViewFieldMetadata {
  /** Data type */
  dtype: string;
  /** Display label */
  label: string;
  /** Render type for display */
  renderType?: string;
  /** Entity type for lookups */
  lookupEntity?: string;
  /** Lookup source (e.g., 'entityInstance', 'datalabel') */
  lookupSource?: string;
  /** Datalabel key for badge fields */
  datalabelKey?: string;
  /** Field behavior flags */
  behavior?: Record<string, boolean>;
  /** Style configuration */
  style?: Record<string, unknown>;
}

export interface EditFieldMetadata {
  /** Data type */
  dtype: string;
  /** Display label */
  label: string;
  /** Input type for editing */
  inputType?: string;
  /** Entity type for lookups */
  lookupEntity?: string;
  /** Lookup source */
  lookupSource?: string;
  /** Datalabel key */
  datalabelKey?: string;
  /** Field behavior flags */
  behavior?: Record<string, boolean>;
  /** Validation rules */
  validation?: Record<string, unknown>;
}

export interface EntityInstanceMetadata {
  /** Field names in order */
  fields: string[];
  /** View mode metadata per field */
  viewType: Record<string, ViewFieldMetadata>;
  /** Edit mode metadata per field */
  editType: Record<string, EditFieldMetadata>;
}

// ============================================================================
// Draft Types
// ============================================================================

export interface Draft {
  /** Entity type code */
  entityCode: string;
  /** Entity instance ID */
  entityId: string;
  /** Original data before edits */
  originalData: Record<string, unknown>;
  /** Current edited data */
  currentData: Record<string, unknown>;
  /** Undo history stack */
  undoStack: Record<string, unknown>[];
  /** Redo history stack */
  redoStack: Record<string, unknown>[];
  /** Last update timestamp */
  updatedAt: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface EntityListResponse<T = Record<string, unknown>> {
  /** Data array */
  data: T[];
  /** Total count */
  total: number;
  /** Limit used */
  limit?: number;
  /** Offset used */
  offset?: number;
  /** Field metadata */
  metadata?: {
    entityListOfInstancesTable?: {
      viewType: Record<string, ViewFieldMetadata>;
      editType: Record<string, EditFieldMetadata>;
    };
  };
  /** Entity instance name lookups */
  ref_data_entityInstance?: Record<string, Record<string, string>>;
}

// ============================================================================
// Query Parameter Types
// ============================================================================

export interface EntityInstanceDataParams {
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Search query */
  search?: string;
  /** Parent entity code for filtering */
  parent_entity_code?: string;
  /** Parent entity instance ID for filtering */
  parent_entity_instance_id?: string;
  /** Additional filter parameters */
  [key: string]: unknown;
}

// ============================================================================
// Hook Result Types
// ============================================================================

export interface UseGlobalSettingsResult {
  settings: GlobalSettings;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  getSetting: <K extends keyof GlobalSettings>(key: K) => GlobalSettings[K];
}

export interface UseDatalabelResult {
  options: DatalabelOption[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  getById: (id: number) => DatalabelOption | undefined;
  getByName: (name: string) => DatalabelOption | undefined;
}

export interface UseEntityCodesResult {
  codes: EntityCode[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  getByCode: (code: string) => EntityCode | undefined;
  getChildCodes: (code: string) => string[];
}

export interface UseEntityInstanceNamesResult {
  names: Record<string, string>;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  getName: (entityInstanceId: string) => string | undefined;
}

export interface UseEntityLinksResult {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  getChildIds: (
    parentCode: string,
    parentId: string,
    childCode: string
  ) => string[];
  getParents: (
    childCode: string,
    childId: string
  ) => Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
  getTabCounts: (parentCode: string, parentId: string) => Record<string, number>;
}

export interface UseEntityInstanceMetadataResult {
  metadata: EntityInstanceMetadata | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  fields: string[];
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

export interface UseEntityInstanceDataResult<T = Record<string, unknown>> {
  data: T[];
  total: number;
  metadata: EntityInstanceMetadata | undefined;
  refData: Record<string, Record<string, string>> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isStale: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseDraftResult {
  currentData: Record<string, unknown>;
  originalData: Record<string, unknown>;
  hasChanges: boolean;
  isLoading: boolean;
  updateField: (field: string, value: unknown) => void;
  updateFields: (fields: Record<string, unknown>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  save: () => Promise<void>;
  discard: () => void;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface InvalidatePayload {
  entityCode: string;
  changes: Array<{
    entityId: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    version: number;
  }>;
}

export interface NormalizedInvalidatePayload {
  table: 'entity' | 'entity_instance' | 'entity_instance_link';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_code?: string;
  entity_instance_id?: string;
  child_entity_code?: string;
  child_entity_instance_id?: string;
  relationship_type?: string;
}

export interface WebSocketMessage {
  type:
    | 'INVALIDATE'
    | 'NORMALIZED_INVALIDATE'
    | 'LINK_CHANGE'
    | 'SUBSCRIBED'
    | 'PONG'
    | 'TOKEN_EXPIRING_SOON'
    | 'ERROR';
  payload?: unknown;
}

// ============================================================================
// Cache Strategy Types
// ============================================================================

export type CacheStrategy =
  | 'cache-first' // Try cache first, fall back to API (default)
  | 'api-first' // Fetch from API, update cache
  | 'cache-only' // Never call API, use only cached data
  | 'api-only'; // Never use cache, always fetch from API

export interface CacheConfig {
  /** Whether cache is enabled */
  enabled: boolean;
  /** Default cache strategy */
  strategy: CacheStrategy;
  /** Per-layer enable flags */
  layers: {
    entityCodes: boolean;
    entityInstances: boolean;
    entityLinks: boolean;
    entityInstanceNames: boolean;
    entityInstanceMetadata: boolean;
  };
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  strategy: 'cache-first',
  layers: {
    entityCodes: true,
    entityInstances: true,
    entityLinks: true,
    entityInstanceNames: true,
    entityInstanceMetadata: true,
  },
};
