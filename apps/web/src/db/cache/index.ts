// ============================================================================
// Cache Layer - Public API
// ============================================================================
// TanStack Query based caching with sync accessors for non-hook access
// v11.0.0: Removed separate sync stores - accessors read from queryClient.getQueryData()
// ============================================================================

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
  // Legacy aliases (deprecated)
  CACHE_STALE_TIME,
  CACHE_STALE_TIME_LIST,
  CACHE_STALE_TIME_METADATA,
  CACHE_STALE_TIME_DATALABEL,
  CACHE_STALE_TIME_ENTITY_CODES,
  CACHE_STALE_TIME_ENTITY_LINKS,
  CACHE_GC_TIME,
  DEXIE_HYDRATION_MAX_AGE,
  DEXIE_DATA_MAX_AGE,
  type SessionStore,
  type OndemandStore,
  type SpecialStore,
  type StoreName,
} from './constants';

// Keys
export {
  QUERY_KEYS,
  DEXIE_KEYS,
  createQueryHash,
  parseCompositeKey,
  parseLinkForwardKey,
  type QueryKeyFactory,
  type DexieKeyFactory,
} from './keys';

// Types
export type {
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
  EntityListResponse,
  EntityInstanceDataParams,
  UseGlobalSettingsResult,
  UseDatalabelResult,
  UseEntityCodesResult,
  UseEntityInstanceNamesResult,
  UseEntityLinksResult,
  UseEntityInstanceMetadataResult,
  UseEntityInstanceDataResult,
  UseDraftResult,
  ConnectionStatus,
  InvalidatePayload,
  NormalizedInvalidatePayload,
  WebSocketMessage,
  CacheStrategy,
  CacheConfig,
} from './types';

export { DEFAULT_CACHE_CONFIG } from './types';

// v11.0.0: Sync Accessors (for non-hook access)
// These read directly from queryClient.getQueryData() - no separate sync stores
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
  // Cache Statistics (for debugging)
  getCacheStats,
} from './stores';
