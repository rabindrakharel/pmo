// ============================================================================
// Unified Cache System - Main Exports
// ============================================================================
// Single entry point for the 7-store cache architecture
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================

export {
  SESSION_STORE_CONFIG,
  ONDEMAND_STORE_CONFIG,
  STORE_CONFIG,
  DEXIE_CONFIG,
  WS_CONFIG,
  SESSION_STORES,
  ONDEMAND_STORES,
  getStaleTime,
  getGcTime,
  isSessionStore,
  type StoreName,
} from './cache/constants';

// ============================================================================
// KEYS
// ============================================================================

export {
  QUERY_KEYS,
  DEXIE_KEYS,
  createQueryHash,
  parseEntityKey,
  parseLinkForwardKey,
} from './cache/keys';

// ============================================================================
// SYNC STORES (for non-hook access)
// ============================================================================

export {
  // Types
  type EntityCode,
  type DatalabelOption,
  type EntityInstance,
  type LinkForwardRecord,
  type ViewFieldMetadata,
  type EditFieldMetadata,

  // Stores (for advanced use)
  globalSettingsStore,
  datalabelStore,
  entityCodesStore,
  entityInstanceNamesStore,
  entityLinksStore,
  entityInstanceMetadataStore,

  // Global Settings
  getGlobalSettingsSync,
  getSettingSync,

  // Datalabels
  getDatalabelSync,
  getDatalabelOptionSync,
  getDatalabelLabelSync,
  getDatalabelColorSync,

  // Entity Codes
  getEntityCodesSync,
  getEntityCodeSync,
  getChildEntityCodesSync,
  getEntityLabelSync,
  getEntityIconSync,

  // Entity Instance Names
  getEntityInstanceNameSync,
  getEntityInstanceNamesForTypeSync,
  mergeEntityInstanceNamesSync,

  // Entity Links
  getChildIdsSync,
  getParentsSync,
  getTabCountsSync,
  addLinkSync,
  removeLinkSync,

  // Entity Metadata
  getEntityMetadataSync,
  getEntityFieldsSync,
  getEntityViewTypeSync,
  getEntityEditTypeSync,

  // Utilities
  clearAllStores,
  getStoreStats,
} from './cache/stores';

// ============================================================================
// PERSISTENCE (Dexie)
// ============================================================================

export {
  // Database
  db,
  PMODatabase,
  clearAllData,
  clearStaleData,
  getDatabaseStats,
  clearAllDrafts,

  // Record Types
  type GlobalSettingsRecord,
  type DatalabelRecord,
  type EntityCodesRecord,
  type EntityInstanceNameRecord,
  type EntityLinkForwardRecord,
  type EntityInstanceMetadataRecord,
  type EntityInstanceDataRecord,
  type DraftRecord,
} from './persistence/schema';

export {
  // Operations
  getGlobalSettings,
  setGlobalSettings,
  getDatalabel,
  setDatalabel,
  getAllDatalabels,
  setAllDatalabels,
  getEntityCodes,
  setEntityCodes,
  getEntityInstanceName,
  setEntityInstanceName,
  getEntityInstanceNamesForType,
  setEntityInstanceNames,
  mergeEntityInstanceNames,
  deleteEntityInstanceName,
  getEntityLinkChildIds,
  setEntityLink,
  addLinkChild,
  removeLinkChild,
  getAllEntityLinks,
  getEntityInstanceMetadata,
  setEntityInstanceMetadata,
  getEntityInstanceData,
  setEntityInstanceData,
  deleteEntityInstanceData,
  getDraft,
  setDraft,
  deleteDraft,
  getAllDrafts,
  getDraftsByEntity,
} from './persistence/operations';

export {
  // Hydration
  hydrateFromDexie,
  hydrateQueryCacheFromStores,
  hasCachedData,
  getOldestCacheAge,
} from './persistence/hydrate';

// ============================================================================
// REALTIME (WebSocket)
// ============================================================================

export {
  wsManager,
  type ConnectionStatus,
  type InvalidatePayload,
  type NormalizedInvalidatePayload,
  type LinkChangePayload,
} from './realtime/manager';

export {
  createInvalidationHandler,
  invalidateEntityData,
  invalidateMetadataCache,
  clearAllCaches,
  type InvalidationHandler,
  type EntityChangeEvent,
  type LinkChangeEvent,
} from './realtime/handlers';

// ============================================================================
// HOOKS
// ============================================================================

export {
  // 1. Global Settings
  useGlobalSettings,
  type UseGlobalSettingsResult,

  // 2. Datalabels
  useDatalabel,
  useAllDatalabels,
  type UseDatalabelResult,

  // 3. Entity Codes
  useEntityCodes,
  type UseEntityCodesResult,

  // 4. Entity Instance Names
  useEntityInstanceNames,
  type UseEntityInstanceNamesResult,

  // 5. Entity Links
  useEntityLinks,
  type UseEntityLinksResult,

  // 6. Entity Instance Metadata
  useEntityInstanceMetadata,
  type UseEntityInstanceMetadataResult,

  // 7. Entity Instance Data
  useEntityInstanceData,
  useEntityInstanceDataInfinite,
  type UseEntityInstanceDataParams,
  type UseEntityInstanceDataResult,

  // Prefetch
  prefetchSessionStores,
} from './hooks';

// ============================================================================
// PROVIDER
// ============================================================================

export {
  CacheProvider,
  queryClient,
  useCacheContext,
  useSyncStatus,
  useIsAppReady,
  useIsSessionLoaded,
} from './CacheProvider';

// ============================================================================
// LEGACY COMPATIBILITY (to be removed after migration)
// ============================================================================

// Aliases for backward compatibility
export { getDatalabelSync as setDatalabelSync } from './cache/stores';
export { getEntityCodesSync as getAllEntityCodesSync } from './cache/stores';

// Re-export old names that consumers might use
export { useEntityInstanceData as useEntityList } from './hooks';
export { useEntityInstanceDataInfinite as useEntityInfiniteList } from './hooks';
export { useEntityInstanceMetadata as useEntityMetadata } from './hooks';
