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
  createEntityKey,
  createDraftKey,
  createMetadataKey,
  createQueryHash,
  clearAllData,
  clearStaleData,
  getDatabaseStats,
  type CachedEntity,
  type CachedEntityList,
  type CachedMetadata,
  type CachedDraft,
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
