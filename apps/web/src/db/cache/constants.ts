// ============================================================================
// Unified Cache Constants
// ============================================================================
// Single source of truth for all cache timing and configuration
// ============================================================================

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/**
 * Session-level stores: 10 minute stale time, 30 minute GC
 * Prefetched at login, background refresh every 10 minutes
 */
export const SESSION_STORE_CONFIG = {
  staleTime: 10 * 60 * 1000,    // 10 minutes
  gcTime: 30 * 60 * 1000,       // 30 minutes
  refreshInterval: 10 * 60 * 1000, // 10 minutes background warmup
} as const;

/**
 * On-demand stores: 5 minute stale time, 30 minute GC
 * Fetched when needed, not prefetched
 */
export const ONDEMAND_STORE_CONFIG = {
  staleTime: 5 * 60 * 1000,     // 5 minutes
  gcTime: 30 * 60 * 1000,       // 30 minutes
} as const;

/**
 * Individual store configurations
 */
export const STORE_CONFIG = {
  // Session-level stores (prefetched at login)
  globalSettings: SESSION_STORE_CONFIG,
  datalabel: SESSION_STORE_CONFIG,
  entityCodes: { ...SESSION_STORE_CONFIG, staleTime: 30 * 60 * 1000 }, // 30 min - rarely changes
  entityInstanceNames: SESSION_STORE_CONFIG,
  entityLinks: SESSION_STORE_CONFIG,
  entityInstanceMetadata: { ...SESSION_STORE_CONFIG, staleTime: 30 * 60 * 1000 }, // 30 min

  // On-demand stores (fetched when needed)
  entityInstanceData: ONDEMAND_STORE_CONFIG,
} as const;

/**
 * Dexie IndexedDB configuration
 */
export const DEXIE_CONFIG = {
  dbName: 'pmo-cache-v5',
  maxAge: 24 * 60 * 60 * 1000,   // 24 hours - max data age
  hydrationMaxAge: 30 * 60 * 1000, // 30 minutes - only hydrate recent data
} as const;

/**
 * WebSocket configuration
 */
export const WS_CONFIG = {
  url: import.meta.env.VITE_WS_URL || 'ws://localhost:4001',
  maxReconnectAttempts: 10,
  initialReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  pingInterval: 30000,
  versionEntryTTL: 10 * 60 * 1000, // 10 minutes
  maxVersionEntries: 1000,
} as const;

// ============================================================================
// STORE TYPES
// ============================================================================

/**
 * Store names for type safety
 */
export type StoreName = keyof typeof STORE_CONFIG;

/**
 * Session-level store names (prefetched at login)
 */
export const SESSION_STORES: StoreName[] = [
  'globalSettings',
  'datalabel',
  'entityCodes',
  'entityInstanceNames',
  'entityLinks',
  'entityInstanceMetadata',
];

/**
 * On-demand store names (fetched when needed)
 */
export const ONDEMAND_STORES: StoreName[] = [
  'entityInstanceData',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get stale time for a store
 */
export function getStaleTime(store: StoreName): number {
  return STORE_CONFIG[store].staleTime;
}

/**
 * Get GC time for a store
 */
export function getGcTime(store: StoreName): number {
  return STORE_CONFIG[store].gcTime;
}

/**
 * Check if store is session-level (prefetched)
 */
export function isSessionStore(store: StoreName): boolean {
  return SESSION_STORES.includes(store);
}
