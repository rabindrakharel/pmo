// ============================================================================
// Normalized Cache Types
// ============================================================================
// Shared types for the 4-layer normalized cache architecture
// ============================================================================

/**
 * Layer 1: Entity Code Metadata (Entity Type Registry)
 */
export interface EntityCode {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  db_table?: string;
  db_model_type?: string;
  child_entity_codes: string[];
  display_order: number;
  domain_code?: string;
  column_metadata?: unknown[];
  active_flag: boolean;
}

/**
 * Layer 2: Entity Instance
 */
export interface EntityInstance {
  entity_code: string;
  entity_instance_id: string;
  entity_instance_name: string;
  code?: string | null;
  order_id?: number;
}

/**
 * Layer 3: Entity Link
 */
export interface EntityLink {
  id: string;
  entity_code: string;
  entity_instance_id: string;
  child_entity_code: string;
  child_entity_instance_id: string;
  relationship_type: string;
}

/**
 * Forward Link Index (parent → children)
 */
export interface LinkForwardIndex {
  parentCode: string;
  parentId: string;
  childCode: string;
  childIds: string[];
  relationships: Record<string, string>;
}

/**
 * Reverse Link Index (child → parents)
 */
export interface LinkReverseIndex {
  childCode: string;
  childId: string;
  parents: Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
}

/**
 * Entity Instance Name Map
 */
export type EntityInstanceNameMap = Record<string, string>;

/**
 * Generic list query params
 */
export interface ListQueryParams {
  parentEntityCode?: string;
  parentEntityInstanceId?: string;
  limit?: number;
  offset?: number;
  search?: string;
  [key: string]: unknown;
}

/**
 * Generic list query result
 */
export interface ListQueryResult<T> {
  data: T[];
  total: number;
  metadata?: Record<string, unknown>;
  entity_instance_name?: Record<string, Record<string, string>>;
}

/**
 * Hook result with loading/error states
 */
export interface QueryHookResult<T> {
  data: T;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * List hook result with pagination
 */
export interface ListHookResult<T> extends QueryHookResult<T[]> {
  total: number;
  isFromCache: boolean;
}

// ============================================================================
// Cache Configuration Types
// ============================================================================

/**
 * Cache strategy mode
 */
export type CacheStrategy = 'cache-first' | 'api-first' | 'cache-only' | 'api-only';

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Global cache enable/disable */
  enabled: boolean;
  /** Strategy for data fetching */
  strategy: CacheStrategy;
  /** Layer-specific overrides */
  layers: {
    entityCodes: boolean;
    entityInstances: boolean;
    entityLinks: boolean;
    entityInstanceNames: boolean;
  };
  /** Stale times per layer (ms) */
  staleTimes: {
    entityCodes: number;
    entityInstances: number;
    entityLinks: number;
    entityInstanceNames: number;
  };
  /** Enable delta sync for instances/links */
  deltaSync: boolean;
  /** Enable persistence to IndexedDB */
  persistToIndexedDB: boolean;
  /** Debug logging */
  debug: boolean;
}

// Import centralized cache timing constants
import {
  CACHE_STALE_TIME,
  CACHE_STALE_TIME_DATALABEL,
  CACHE_STALE_TIME_ENTITY_CODES,
  CACHE_STALE_TIME_ENTITY_LINKS,
} from '../query/queryClient';

/**
 * Default cache configuration
 * Uses centralized constants from queryClient.ts for consistency
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  strategy: 'cache-first',
  layers: {
    entityCodes: true,
    entityInstances: true,
    entityLinks: true,
    entityInstanceNames: true,
  },
  staleTimes: {
    entityCodes: CACHE_STALE_TIME_ENTITY_CODES,      // 30 minutes
    entityInstances: CACHE_STALE_TIME,              // 5 minutes
    entityLinks: CACHE_STALE_TIME_ENTITY_LINKS,     // 5 minutes
    entityInstanceNames: CACHE_STALE_TIME_DATALABEL, // 10 minutes
  },
  deltaSync: true,
  persistToIndexedDB: true,
  debug: false,
};

// ============================================================================
// Data Source Interface Types
// ============================================================================

/**
 * Data source result wrapper
 */
export interface DataSourceResult<T> {
  data: T;
  source: 'cache' | 'api';
  syncedAt?: number;
}

/**
 * Entity codes data source interface
 */
export interface EntityCodesDataSource {
  getAll(): Promise<DataSourceResult<EntityCode[]>>;
  getByCode(code: string): EntityCode | null;
  getChildCodes(parentCode: string): string[];
}

/**
 * Entity instances data source interface
 */
export interface EntityInstancesDataSource {
  getAll(): Promise<DataSourceResult<Map<string, EntityInstance[]>>>;
  getByCode(entityCode: string): EntityInstance[];
  getInstance(entityCode: string, entityInstanceId: string): EntityInstance | null;
}

/**
 * Entity links data source interface
 */
export interface EntityLinksDataSource {
  getChildIds(parentCode: string, parentId: string, childCode: string): string[];
  getParents(childCode: string, childId: string): Array<{
    entity_code: string;
    entity_instance_id: string;
    relationship_type: string;
  }>;
  getTabCounts(parentCode: string, parentId: string): Record<string, number>;
}

/**
 * Entity instance names data source interface
 */
export interface EntityInstanceNamesDataSource {
  getNames(entityCode: string): Record<string, string>;
  getName(entityCode: string, entityInstanceId: string): string | null;
  merge(data: Record<string, Record<string, string>>): void;
}

/**
 * Unified data source interface
 */
export interface DataSource {
  entityCodes: EntityCodesDataSource;
  entityInstances: EntityInstancesDataSource;
  entityLinks: EntityLinksDataSource;
  entityInstanceNames: EntityInstanceNamesDataSource;

  // Lifecycle
  hydrate(): Promise<void>;
  prefetch(): Promise<void>;
  clear(): void;

  // Status
  isReady(): boolean;
}
