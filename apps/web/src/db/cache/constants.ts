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
// Never prefetch, 5 min TTL, invalidation applies
// This store contains query results that change frequently

export const ONDEMAND_STORE_CONFIG = {
  /** How long before data is considered stale */
  staleTime: 5 * 60 * 1000, // 5 minutes

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
  entityInstanceMetadata: 30 * 60 * 1000, // 30 minutes (field definitions)
  entityInstanceData: ONDEMAND_STORE_CONFIG.staleTime,
} as const;

// ============================================================================
// Legacy Constant Aliases (for backward compatibility during migration)
// ============================================================================
// These map to the new constants for code that hasn't been migrated yet

/** @deprecated Use SESSION_STORE_CONFIG.staleTime or STORE_STALE_TIMES instead */
export const CACHE_STALE_TIME = ONDEMAND_STORE_CONFIG.staleTime;

/** @deprecated Use ONDEMAND_STORE_CONFIG.staleTime instead */
export const CACHE_STALE_TIME_LIST = ONDEMAND_STORE_CONFIG.staleTime;

/** @deprecated Use STORE_STALE_TIMES.entityInstanceMetadata instead */
export const CACHE_STALE_TIME_METADATA = STORE_STALE_TIMES.entityInstanceMetadata;

/** @deprecated Use STORE_STALE_TIMES.datalabel instead */
export const CACHE_STALE_TIME_DATALABEL = STORE_STALE_TIMES.datalabel;

/** @deprecated Use STORE_STALE_TIMES.entityCodes instead */
export const CACHE_STALE_TIME_ENTITY_CODES = STORE_STALE_TIMES.entityCodes;

/** @deprecated Use STORE_STALE_TIMES.entityLinks instead */
export const CACHE_STALE_TIME_ENTITY_LINKS = STORE_STALE_TIMES.entityLinks;

/** @deprecated Use SESSION_STORE_CONFIG.gcTime or ONDEMAND_STORE_CONFIG.gcTime instead */
export const CACHE_GC_TIME = ONDEMAND_STORE_CONFIG.gcTime;

/** @deprecated Use HYDRATION_CONFIG.maxAge instead */
export const DEXIE_HYDRATION_MAX_AGE = HYDRATION_CONFIG.maxAge;

/** @deprecated Use SESSION_STORE_CONFIG.persistMaxAge instead */
export const DEXIE_DATA_MAX_AGE = SESSION_STORE_CONFIG.persistMaxAge;
