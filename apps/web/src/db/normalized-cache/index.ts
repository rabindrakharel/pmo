// ============================================================================
// Normalized Cache - Public API
// ============================================================================
// 4-Layer Normalized Cache Architecture
// Decoupled, modular, DRY implementation
//
// Usage:
//   import { useEntityCodes, useNormalizedEntityList, ... } from '@/db/normalized-cache';
//
// Configuration:
//   Wrap app with CacheConfigProvider to enable/disable cache layers
//   <CacheConfigProvider initialConfig={{ enabled: true }}>
//     <App />
//   </CacheConfigProvider>
//
// Strategy Modes:
//   - 'cache-first': Try cache first, fall back to API (default)
//   - 'api-first': Fetch from API, update cache
//   - 'cache-only': Never call API, use only cached data
//   - 'api-only': Never use cache, always fetch from API
// ============================================================================

// Types
export type {
  EntityCode,
  EntityInstance,
  EntityLink,
  LinkForwardIndex,
  LinkReverseIndex,
  EntityInstanceNameMap,
  ListQueryParams,
  ListQueryResult,
  QueryHookResult,
  ListHookResult,
  CacheConfig,
  CacheStrategy,
  DataSourceResult,
  EntityCodesDataSource,
  EntityInstancesDataSource,
  EntityLinksDataSource,
  EntityInstanceNamesDataSource,
  DataSource,
} from './types';

export { DEFAULT_CACHE_CONFIG } from './types';

// Configuration
export {
  CacheConfigProvider,
  useCacheConfig,
  useLayerEnabled,
  setGlobalCacheConfig,
  getCacheConfig,
  isCacheEnabled,
  isLayerEnabledSync,
  getStaleTime,
} from './config';

// Stores (for advanced usage)
export {
  entityCodesStore,
  entityInstancesStore,
  entityLinksStore,
  entityInstanceNamesStore,
  clearAllStores,
  getStoreStats,
} from './stores';

// Adapters
export {
  BaseDataSourceAdapter,
  CacheDataSourceAdapter,
  APIDataSourceAdapter,
  cacheAdapter,
  apiAdapter,
  createInvalidationHandler,
  QUERY_KEYS,
  type WebSocketInvalidation,
  type InvalidationHandler,
} from './adapters';

// Hooks
export {
  // Layer 1: Entity Codes
  useEntityCodes,
  getEntityCodeSync,
  getAllEntityCodesSync,
  getChildEntityCodesSync,
  prefetchEntityCodes,

  // Layer 2: Entity Instances
  useEntityInstances,
  getEntityInstancesSync,
  getEntityInstanceSync,
  prefetchEntityInstances,

  // Layer 3: Entity Links
  useEntityLinks,
  getChildIdsSync,
  getParentsSync,
  prefetchEntityLinks,

  // Layer 4: Entity Instance Names
  useEntityInstanceNames,
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  mergeEntityInstanceNames,

  // Derived Queries
  useNormalizedEntityList,
  type NormalizedEntityListOptions,
  type NormalizedEntityListResult,

  // Lifecycle
  hydrateNormalizedCache,
  prefetchNormalizedCache,
  clearNormalizedCacheMemory,

  // Invalidation
  invalidateEntityInstance,
  invalidateEntityLinks,
  addLinkToCache,
  removeLinkFromCache,
} from './hooks';

// Re-export query keys for external usage
export {
  QUERY_KEYS as ENTITY_CODES_KEY,
  QUERY_KEYS as ENTITY_INSTANCES_KEY,
  QUERY_KEYS as ENTITY_LINKS_KEY,
  QUERY_KEYS as ENTITY_INSTANCE_NAMES_KEY,
} from './adapters/cache-adapter';
