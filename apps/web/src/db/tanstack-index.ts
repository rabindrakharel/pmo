// ============================================================================
// TanStack Query + Dexie - Main Exports
// ============================================================================
// Public API for the TanStack Query + Dexie caching system
// ============================================================================

// ============================================================================
// Dexie Database
// ============================================================================

export {
  db,
  PMODatabase,
  // Key generators
  createDatalabelKey,
  createEntityInstanceKey,
  createEntityInstanceDataKey,
  createEntityLinkKey,
  createDraftKey,
  createQueryHash,
  // Cache management
  clearAllData,
  clearStaleData,
  getDatabaseStats,
  // Entity helpers
  getChildIdsFromCache,
  getEntityInstanceNameFromCache,
  getEntityInstanceNamesForType,
  addLinkToCache,
  removeLinkFromCache,
  getEntityCodeFromCache,
  getAllEntityCodesFromCache,
  getChildEntityCodesFromCache,
  // Types
  type DatalabelOption,
  type DatalabelRecord,
  type EntityCodeDefinition,
  type EntityCodeRecord,
  type GlobalSettingRecord,
  type EntityInstanceDataRecord,
  type ViewFieldMetadata,
  type EditFieldMetadata,
  type EntityInstanceMetadataRecord,
  type EntityInstanceRecord,
  type EntityLinkRecord,
  type DraftRecord,
} from './dexie/database';

// ============================================================================
// Query Client
// ============================================================================

export {
  queryClient,
  hydrateQueryCache,
  clearAllCaches,
  invalidateEntityQueries,
  prefetchEntity,
  getCachedEntity as getQueryCachedEntity,
  setCachedEntity,
  removeCachedEntity,
} from './query/queryClient';

// ============================================================================
// WebSocket Manager
// ============================================================================

export {
  wsManager,
  type ConnectionStatus,
} from './tanstack-sync/WebSocketManager';

// ============================================================================
// Provider
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
// Hooks
// ============================================================================

export * from './tanstack-hooks';
