// ============================================================================
// Cache Timing Constants - Single Source of Truth
// ============================================================================
// All cache timing configurations are centralized here.
// Changes here affect TanStack Query, Dexie hydration, and all hooks.
// ============================================================================

// ============================================================================
// Session-Level Stores (6 stores)
// ============================================================================
// Prefetch on login, background refresh every 10 minutes
// These stores contain metadata that changes infrequently

export const SESSION_STORE_CONFIG = {
  /** How long before data is considered stale (triggers background refetch) */
  staleTime: 10 * 60 * 1000, // 10 minutes

  /** How long to keep data in memory after last use (garbage collection) */
  gcTime: 60 * 60 * 1000, // 1 hour

  /** Background refresh interval for session stores */
  backgroundRefreshInterval: 10 * 60 * 1000, // 10 minutes

  /** Max age for Dexie persistence (how long data is valid in IndexedDB) */
  persistMaxAge: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// ============================================================================
// On-Demand Store (entityInstanceData only)
// ============================================================================
// Never prefetch, 1 min TTL, invalidation applies
// This store contains query results that change frequently

export const ONDEMAND_STORE_CONFIG = {
  /** How long before data is considered stale */
  staleTime: 1 * 60 * 1000, // 1 minute - synced with metadata TTL to prevent stale rendering

  /** How long to keep data in memory after last use */
  gcTime: 30 * 60 * 1000, // 30 minutes

  /** Max age for Dexie persistence (for hydration) */
  persistMaxAge: 30 * 60 * 1000, // 30 minutes
} as const;

// ============================================================================
// Hydration Configuration
// ============================================================================
// Controls how data is loaded from IndexedDB on startup

export const HYDRATION_CONFIG = {
  /** Maximum age of data to hydrate from Dexie (older data is skipped) */
  maxAge: 30 * 60 * 1000, // 30 minutes
} as const;

// ============================================================================
// WebSocket Configuration
// ============================================================================
// Real-time sync configuration

export const WEBSOCKET_CONFIG = {
  /** Maximum number of reconnection attempts */
  maxReconnectAttempts: 10,

  /** Initial delay before first reconnect attempt */
  initialReconnectDelay: 1000, // 1 second

  /** Maximum delay between reconnect attempts */
  maxReconnectDelay: 30000, // 30 seconds

  /** Interval between heartbeat pings */
  pingInterval: 30000, // 30 seconds

  /** Maximum version entries to track (for out-of-order message handling) */
  maxVersionEntries: 1000,

  /** TTL for version entries (for memory cleanup) */
  versionEntryTtl: 10 * 60 * 1000, // 10 minutes
} as const;

// ============================================================================
// Store Categories
// ============================================================================
// Used for type-safe store operations

export const SESSION_STORES = [
  'globalSettings',
  'datalabel',
  'entityCodes',
  'entityInstanceNames',
  'entityLinks',
  'entityInstanceMetadata',
] as const;

export const ONDEMAND_STORES = ['entityInstanceData'] as const;

export const SPECIAL_STORES = ['draft'] as const;

export type SessionStore = (typeof SESSION_STORES)[number];
export type OndemandStore = (typeof ONDEMAND_STORES)[number];
export type SpecialStore = (typeof SPECIAL_STORES)[number];
export type StoreName = SessionStore | OndemandStore | SpecialStore;

// ============================================================================
// Individual Store Stale Times (for fine-grained control)
// ============================================================================
// These can override the session/on-demand defaults for specific stores

export const STORE_STALE_TIMES = {
  globalSettings: SESSION_STORE_CONFIG.staleTime,
  datalabel: 10 * 60 * 1000, // 10 minutes
  entityCodes: 30 * 60 * 1000, // 30 minutes (changes rarely)
  entityInstanceNames: SESSION_STORE_CONFIG.staleTime,
  entityLinks: 5 * 60 * 1000, // 5 minutes (changes with entity updates)
  entityInstanceMetadata: 1 * 60 * 1000, // 1 minute - synced with data TTL to prevent stale rendering
  entityInstanceData: ONDEMAND_STORE_CONFIG.staleTime,
} as const;

export const STORE_GC_TIMES = {
  globalSettings: SESSION_STORE_CONFIG.gcTime,
  datalabel: Infinity,  // NEVER garbage collect - badge colors must persist
  entityCodes: Infinity,  // NEVER garbage collect - entity type definitions rarely change
  entityInstanceNames: SESSION_STORE_CONFIG.gcTime,
  entityLinks: SESSION_STORE_CONFIG.gcTime,
  entityInstanceMetadata: SESSION_STORE_CONFIG.gcTime,
  entityInstanceData: ONDEMAND_STORE_CONFIG.gcTime,
} as const;

export const STORE_PERSIST_TTL = {
  globalSettings: SESSION_STORE_CONFIG.persistMaxAge,
  datalabel: SESSION_STORE_CONFIG.persistMaxAge,
  entityCodes: SESSION_STORE_CONFIG.persistMaxAge,
  entityInstanceNames: SESSION_STORE_CONFIG.persistMaxAge,
  entityLinks: SESSION_STORE_CONFIG.persistMaxAge,
  entityInstanceMetadata: SESSION_STORE_CONFIG.persistMaxAge,
  entityInstanceData: ONDEMAND_STORE_CONFIG.persistMaxAge,
} as const;

