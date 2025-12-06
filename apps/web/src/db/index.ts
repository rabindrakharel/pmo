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
  // Entity Instance Data (On-Demand)
  useEntityInstanceData,
  useEntityInstanceMetadata,
  // Single Entity
  useEntity,
  useEntityMutation,
  // Entity Links
  useEntityLinks,
  // Entity Instance Names
  useEntityInstanceNames,
  mergeEntityInstanceNames,
  // Drafts
  useDraft,
  useRecoverDrafts,
  // Prefetch Functions
  prefetchGlobalSettings,
  prefetchAllDatalabels,
  prefetchEntityCodes,
  prefetchEntityLinks,
  // Clear Functions
  clearGlobalSettingsCache,
  clearDatalabelCache,
  clearEntityCodesCache,
  clearEntityInstanceDataCache,
  clearEntityLinksCache,
  clearEntityInstanceNamesCache,
  // Link manipulation
  addLinkToCache,
  removeLinkFromCache,
  // Sync Access (v11.0.0: read from queryClient.getQueryData())
  getGlobalSettingsSync,
  getSettingSync,
  getDatalabelSync,
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
  STORE_GC_TIMES,
  STORE_PERSIST_TTL,
  // Store types
  type SessionStore,
  type OndemandStore,
  type SpecialStore,
  type StoreName,
} from './cache/constants';

// Keys
export {
  QUERY_KEYS,
  DEXIE_KEYS,
  createQueryHash,
  parseCompositeKey,
  parseLinkForwardKey,
} from './cache/keys';

// v11.0.0: Sync Accessors - read from queryClient.getQueryData() (no separate stores)
export {
  getCacheStats,
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
  persistToGlobalSettings,
  persistToDatalabel,
  persistToEntityCodes,
  persistToEntityInstanceNames,
  persistToEntityInstanceData,
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
} from './cache/types';

export type { HydrationResult } from './persistence/hydrate';

// Persistence record types
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
