// ============================================================================
// TanStack Query + Dexie - Main Exports
// ============================================================================
// Public API for the unified cache system (TanStack Query + Dexie)
// v11.0.0: Single in-memory cache (TanStack Query) with Dexie for persistence
// ============================================================================

// ============================================================================
// Cache Hooks - Primary API
// ============================================================================

export * from './cache/hooks';

// ============================================================================
// Sync Accessors - For non-hook access (formatters, utilities)
// v11.0.0: Read directly from queryClient.getQueryData() - no separate stores
// ============================================================================

export {
  // Global Settings
  getGlobalSettingsSync,
  getSettingSync,
  // Datalabels
  getDatalabelSync,
  // Entity Codes
  getEntityCodesSync,
  getEntityCodeSync,
  getChildEntityCodesSync,
  // Entity Instance Names
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  // Entity Links
  getChildIdsSync,
  getParentsSync,
  // Entity Instance Metadata
  getEntityInstanceMetadataSync,
  // Cache Statistics (debugging)
  getCacheStats,
} from './cache/stores';

// ============================================================================
// Cache Constants
// ============================================================================

export {
  STORE_STALE_TIMES,
  STORE_GC_TIMES,
  STORE_PERSIST_TTL,
  SESSION_STORE_CONFIG,
  ONDEMAND_STORE_CONFIG,
  HYDRATION_CONFIG,
  WEBSOCKET_CONFIG,
} from './cache/constants';

// ============================================================================
// Cache Types
// ============================================================================

export type {
  GlobalSettings,
  CurrencySettings,
  DateSettings,
  DatalabelOption,
  EntityCode,
  EntityInstance,
  EntityInstanceMetadata,
  EntityLink,
  LinkForwardIndex,
  LinkReverseIndex,
  ViewFieldMetadata,
  EditFieldMetadata,
  Draft,
  EntityListResponse,
  EntityInstanceDataParams,
  UseEntityInstanceDataResult,
  ConnectionStatus,
  InvalidatePayload,
  NormalizedInvalidatePayload,
  RefData,
} from './cache/types';

// ============================================================================
// Cache Keys
// ============================================================================

export { QUERY_KEYS, DEXIE_KEYS, createQueryHash } from './cache/keys';

// ============================================================================
// Query Client
// ============================================================================

export {
  queryClient,
  invalidateStore,
  invalidateEntityQueries,
  invalidateMetadataCache,
  clearAllMetadataCache,
  clearQueryCache,
  clearAllCaches,
  setQueryData,
  getQueryData,
} from './cache/client';

// ============================================================================
// Persistence Layer (Dexie)
// ============================================================================

export { db } from './persistence/schema';
export type {
  GlobalSettingsRecord,
  DatalabelRecord,
  EntityCodesRecord,
  EntityInstanceNameRecord,
  EntityLinkForwardRecord,
  EntityLinkReverseRecord,
  EntityInstanceMetadataRecord,
  EntityInstanceDataRecord,
  DraftRecord,
} from './persistence/schema';

export {
  clearAllExceptDrafts,
  clearAllStores,
  clearStaleData,
  clearEntityInstanceData,
  updateEntityInstanceDataItem,
  deleteEntityInstanceDataItem,
  addEntityInstanceDataItem,
  replaceEntityInstanceDataItem,
  resetDatabase,
} from './persistence/operations';

export {
  hydrateFromDexie,
  persistToGlobalSettings,
  persistToDatalabel,
  persistToEntityCodes,
  persistToEntityInstanceNames,
  persistToEntityInstanceData,
} from './persistence/hydrate';

// ============================================================================
// Real-time Layer (WebSocket)
// ============================================================================

export { wsManager, WS_URL, WS_RECONNECT_DELAY } from './realtime/manager';

// ============================================================================
// Provider (v11.0.0: Consolidated to CacheProvider)
// ============================================================================

export {
  CacheProvider,
  useCacheContext,
  useSyncStatus,
  useIsAppReady,
  useIsMetadataLoaded,
  useHydrationResult,
} from './Provider';
