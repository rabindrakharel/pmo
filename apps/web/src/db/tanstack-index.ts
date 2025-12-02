// ============================================================================
// TanStack Query + Dexie - Main Exports
// ============================================================================
// Public API for the unified cache system (TanStack Query + Dexie)
// Re-exports from the new db/cache/ structure for backward compatibility
// ============================================================================

// ============================================================================
// New Unified Cache System (Primary Exports)
// ============================================================================

// Cache hooks - primary API
export * from './cache/hooks';

// v11.0.0: Sync Accessors - read from queryClient.getQueryData() (no separate stores)
export {
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
  getCacheStats,
} from './cache/stores';

// Cache constants
export {
  STORE_STALE_TIMES,
  STORE_GC_TIMES,
  STORE_PERSIST_TTL,
  SESSION_STORE_CONFIG,
  ONDEMAND_STORE_CONFIG,
  // Legacy aliases for backward compatibility
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

// Cache types
export type {
  GlobalSettings,
  DatalabelOption,
  EntityCode,
  EntityInstance,
  EntityInstanceMetadata,
  EntityLink,
  Draft,
  EntityListResponse,
  EntityInstanceDataParams,
  UseEntityInstanceDataResult,
  ConnectionStatus,
  InvalidatePayload,
  RefData,
} from './cache/types';

// Cache keys
export { QUERY_KEYS, DEXIE_KEYS, createQueryHash } from './cache/keys';

// Query client
export {
  queryClient,
  invalidateStore,
  invalidateEntityQueries,
  invalidateMetadataCache,
  clearAllMetadataCache,
} from './cache/client';

// ============================================================================
// Persistence Layer
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
// Real-time Layer
// ============================================================================

export { wsManager, WS_URL, WS_RECONNECT_DELAY } from './realtime/manager';

// ============================================================================
// Legacy Re-exports (for backward compatibility)
// ============================================================================

// From old dexie/database.ts - now in persistence/schema
export { db as PMODatabase } from './persistence/schema';
export {
  createQueryHash as createEntityInstanceDataKey,
} from './cache/keys';

// These key generators are now in DEXIE_KEYS
export const createDatalabelKey = (key: string) => key.startsWith('dl__') ? key.slice(4) : key;
export const createEntityInstanceKey = (entityCode: string, entityId: string) => `${entityCode}:${entityId}`;
export const createEntityLinkKey = (parentCode: string, parentId: string, childCode: string) => `${parentCode}:${parentId}:${childCode}`;
export const createDraftKey = (entityCode: string, entityId: string) => `draft:${entityCode}:${entityId}`;

// From old query/queryClient.ts
export { queryClient as hydrateQueryCache } from './cache/client';
// v11.0.0: Removed clearAllSyncStores - TanStack Query cache is the single source of truth
export const clearAllCaches = async () => {
  const { clearAllExceptDrafts } = await import('./persistence/operations');
  const { queryClient } = await import('./cache/client');
  await clearAllExceptDrafts();
  queryClient.clear();
};

// From old dexie/database.ts - cache helpers
export { getChildIdsSync as getChildIdsFromCache } from './cache/stores';
export { getEntityInstanceNameSync as getEntityInstanceNameFromCache } from './cache/stores';
export { getEntityInstanceNamesForTypeSync as getEntityInstanceNamesForType } from './cache/stores';
export { getEntityCodeSync as getEntityCodeFromCache } from './cache/stores';
export { getEntityCodesSync as getAllEntityCodesFromCache } from './cache/stores';
export { getChildEntityCodesSync as getChildEntityCodesFromCache } from './cache/stores';
export { addLinkToCache, removeLinkFromCache } from './cache/hooks';

// Legacy functions from dexie/database.ts
export const clearAllData = async () => {
  const { clearAllStores } = await import('./persistence/operations');
  await clearAllStores();
};
// v11.0.0: getCacheStats returns TanStack Query cache stats (no separate sync stores)
export const getDatabaseStats = async () => {
  const { getCacheStats } = await import('./cache/stores');
  return getCacheStats();
};

// ============================================================================
// Provider (unchanged - re-export from existing location)
// ============================================================================

export {
  TanstackCacheProvider,
  useCacheContext,
  useSyncStatus,
  useIsAppReady,
  useIsMetadataLoaded,
  connectWebSocket,
  disconnectWebSocket,
  prefetchAllMetadata,
} from './TanstackCacheProvider';

// ============================================================================
// Type Re-exports for Backward Compatibility
// ============================================================================

// These types were in dexie/database.ts
export type ViewFieldMetadata = Record<string, unknown>;
export type EditFieldMetadata = Record<string, unknown>;
export type EntityCodeDefinition = {
  code: string;
  ui_label: string;
  ui_icon: string | null;
  child_entity_codes: string[];
};

// From tanstack-hooks/index.ts
export type EntityCodeData = EntityCodeDefinition & {
  /** @deprecated Use ui_label instead */
  label?: string;
  /** @deprecated Use ui_icon instead */
  icon?: string | null;
  /** @deprecated */
  descr?: string;
  /** @deprecated */
  parent_entity_codes?: string[];
};

// Legacy function aliases
/** @deprecated Use getEntityCodesSync instead */
// getEntityCodesSync already exported above

/** @deprecated Use getEntityCodeSync instead */
// getEntityCodeSync already exported above as getEntityByCodeSync (use getEntityCodeSync)
