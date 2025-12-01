// ============================================================================
// Unified Cache Architecture - Public API
// ============================================================================
// Single entry point for the cache system
//
// Usage:
//   import { useEntityInstanceData, useDatalabel, CacheProvider } from '@/db';
//
// Architecture:
//   7 unified stores (6 session-level + 1 on-demand)
//   TanStack Query (in-memory) + Dexie (persistent) + WebSocket (realtime)
// ============================================================================

// ============================================================================
// Provider
// ============================================================================

export {
  CacheProvider,
  useCacheContext,
  useSyncStatus,
  useIsAppReady,
  useIsMetadataLoaded,
  useHydrationResult,
  // Legacy exports
  TanstackCacheProvider,
  connectWebSocket,
  disconnectWebSocket,
  prefetchAllMetadata,
} from './Provider';

// ============================================================================
// Hooks
// ============================================================================

export {
  // Session-Level Stores
  useGlobalSettings,
  useDatalabel,
  useAllDatalabels,
  useEntityCodes,
  // On-Demand Store
  useEntityInstanceData,
  useEntityList, // Deprecated alias
  // Prefetch Functions
  prefetchGlobalSettings,
  prefetchAllDatalabels,
  prefetchEntityCodes,
  // Clear Functions
  clearGlobalSettingsCache,
  clearDatalabelCache,
  clearEntityCodesCache,
  clearEntityInstanceDataCache,
  // Sync Access
  getGlobalSettingsSync,
  getSettingSync,
  getDatalabelSync,
  setDatalabelSync,
  getEntityCodesSync,
  getEntityCodeSync,
  getChildEntityCodesSync,
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  getChildIdsSync,
  getParentsSync,
  getEntityInstanceMetadataSync,
} from './cache/hooks';

// ============================================================================
// Cache Layer
// ============================================================================

export {
  // Query Client
  queryClient,
  invalidateStore,
  invalidateEntityQueries,
  invalidateMetadataCache,
  clearQueryCache,
  setQueryData,
  getQueryData,
  removeQuery,
  prefetchQuery,
} from './cache/client';

// Constants
export {
  SESSION_STORE_CONFIG,
  ONDEMAND_STORE_CONFIG,
  HYDRATION_CONFIG,
  WEBSOCKET_CONFIG,
  SESSION_STORES,
  ONDEMAND_STORES,
  SPECIAL_STORES,
  STORE_STALE_TIMES,
  // Legacy aliases
  CACHE_STALE_TIME,
  CACHE_STALE_TIME_LIST,
  CACHE_STALE_TIME_METADATA,
  CACHE_STALE_TIME_DATALABEL,
  CACHE_STALE_TIME_ENTITY_CODES,
  CACHE_STALE_TIME_ENTITY_LINKS,
  CACHE_GC_TIME,
  DEXIE_HYDRATION_MAX_AGE,
  DEXIE_DATA_MAX_AGE,
} from './cache/constants';

// Keys
export {
  QUERY_KEYS,
  DEXIE_KEYS,
  createQueryHash,
  parseCompositeKey,
  parseLinkForwardKey,
} from './cache/keys';

// Stores
export {
  globalSettingsStore,
  datalabelStore,
  entityCodesStore,
  entityInstanceNamesStore,
  entityLinksStore,
  entityInstanceMetadataStore,
  clearAllSyncStores,
  getSyncStoreStats,
} from './cache/stores';

// ============================================================================
// Persistence Layer
// ============================================================================

export {
  // Database
  db,
  CacheDatabase,
  isDatabaseReady,
  getDatabaseStats,
  closeDatabase,
  // Hydration
  hydrateFromDexie,
  // Operations
  clearAllExceptDrafts,
  clearAllStores,
  clearStaleData,
} from './persistence';

// ============================================================================
// Realtime Layer
// ============================================================================

export { wsManager } from './realtime';

// ============================================================================
// Types
// ============================================================================

export type {
  // Core Types
  GlobalSettings,
  CurrencySettings,
  DateSettings,
  DatalabelOption,
  EntityCode,
  EntityInstance,
  EntityLink,
  LinkForwardIndex,
  LinkReverseIndex,
  ViewFieldMetadata,
  EditFieldMetadata,
  EntityInstanceMetadata,
  Draft,
  // API Response Types
  EntityListResponse,
  EntityInstanceDataParams,
  // Hook Result Types
  UseGlobalSettingsResult,
  UseDatalabelResult,
  UseEntityCodesResult,
  UseEntityInstanceNamesResult,
  UseEntityLinksResult,
  UseEntityInstanceMetadataResult,
  UseEntityInstanceDataResult,
  UseDraftResult,
  // WebSocket Types
  ConnectionStatus,
  InvalidatePayload,
  NormalizedInvalidatePayload,
  WebSocketMessage,
  // Config Types
  CacheStrategy,
  CacheConfig,
  SessionStore,
  OndemandStore,
  SpecialStore,
  StoreName,
} from './cache/types';

export type { HydrationResult } from './persistence/hydrate';

// ============================================================================
// Legacy Re-exports (for backward compatibility during migration)
// ============================================================================

// These are exported from the old locations and will be removed in a future version
// Import from the new locations above instead

export * from './tanstack-index';
