// ============================================================================
// Query Key & Dexie Key Factories
// ============================================================================
// Unified key generation for TanStack Query and Dexie IndexedDB
// Ensures consistent key structure across the caching system
// ============================================================================

// ============================================================================
// TanStack Query Key Factories
// ============================================================================
// These keys are used for TanStack Query cache management
// Format: readonly tuple arrays for type-safe query invalidation

export const QUERY_KEYS = {
  // ────────────────────────────────────────────────────────────────────────
  // Session-Level Stores
  // ────────────────────────────────────────────────────────────────────────

  /** Global settings query key */
  globalSettings: () => ['globalSettings'] as const,

  /** Datalabel query key for specific key */
  datalabel: (key: string) => ['datalabel', key] as const,

  /** Datalabel query key for all datalabels */
  datalabelAll: () => ['datalabel', '__all__'] as const,

  /** Entity codes query key (all entity type definitions) */
  entityCodes: () => ['entityCodes'] as const,

  /** Entity instance names query key for specific entity type */
  entityInstanceNames: (entityCode: string) =>
    ['entityInstanceNames', entityCode] as const,

  /** Entity instance names query key (for invalidation of all types) */
  entityInstanceNamesAll: () => ['entityInstanceNames'] as const,

  /** Entity links query key */
  entityLinks: () => ['entityLinks'] as const,

  /** Entity links query key for specific parent */
  entityLinksByParent: (parentCode: string, parentId: string) =>
    ['entityLinks', parentCode, parentId] as const,

  /** Entity instance metadata query key for specific entity type */
  entityInstanceMetadata: (entityCode: string) =>
    ['entityInstanceMetadata', entityCode] as const,

  /** Entity instance metadata query key (for invalidation of all types) */
  entityInstanceMetadataAll: () => ['entityInstanceMetadata'] as const,

  // ────────────────────────────────────────────────────────────────────────
  // On-Demand Store
  // ────────────────────────────────────────────────────────────────────────

  /** Entity instance data query key (list results with params) */
  entityInstanceData: (entityCode: string, params: Record<string, unknown>) =>
    ['entityInstanceData', entityCode, params] as const,

  /** Entity instance data query key by entity code only (for invalidation) */
  entityInstanceDataByCode: (entityCode: string) =>
    ['entityInstanceData', entityCode] as const,

  /** Single entity instance query key */
  entityInstance: (entityCode: string, entityId: string) =>
    ['entityInstance', entityCode, entityId] as const,

  /** Entity instance data infinite query key (for load more patterns) */
  entityInstanceDataInfinite: (entityCode: string, params: Record<string, unknown>) =>
    ['entityInstanceDataInfinite', entityCode, params] as const,

  // ────────────────────────────────────────────────────────────────────────
  // Draft Store
  // ────────────────────────────────────────────────────────────────────────

  /** Draft query key */
  draft: (entityCode: string, entityId: string) =>
    ['draft', entityCode, entityId] as const,

  /** All drafts for an entity type */
  draftsByCode: (entityCode: string) => ['draft', entityCode] as const,

  /** All drafts (for listing recoverable drafts) */
  draftsAll: () => ['draft'] as const,
} as const;

// ============================================================================
// Dexie Key Factories
// ============================================================================
// These keys are used as IndexedDB primary keys
// Format: string keys for Dexie table lookups

export const DEXIE_KEYS = {
  // ────────────────────────────────────────────────────────────────────────
  // Session-Level Stores
  // ────────────────────────────────────────────────────────────────────────

  /** Global settings key (single record) */
  globalSettings: () => 'settings',

  /** Datalabel key (strip 'dl__' prefix if present) */
  datalabel: (key: string) => (key.startsWith('dl__') ? key.slice(4) : key),

  /** Entity codes key (single record containing all codes) */
  entityCodes: () => 'all',

  /** Entity instance name key */
  entityInstanceName: (entityCode: string, entityInstanceId: string) =>
    `${entityCode}:${entityInstanceId}`,

  /** Entity link forward index key */
  entityLinkForward: (
    parentCode: string,
    parentId: string,
    childCode: string
  ) => `${parentCode}:${parentId}:${childCode}`,

  /** Entity link reverse index key */
  entityLinkReverse: (childCode: string, childId: string) =>
    `${childCode}:${childId}`,

  /** Entity instance metadata key */
  entityInstanceMetadata: (entityCode: string) => entityCode,

  // ────────────────────────────────────────────────────────────────────────
  // On-Demand Store
  // ────────────────────────────────────────────────────────────────────────

  /** Entity instance data key (list results) */
  entityInstanceData: (entityCode: string, params: Record<string, unknown>) =>
    `${entityCode}:${createQueryHash(params)}`,

  /** Single entity instance key */
  entityInstance: (entityCode: string, entityInstanceId: string) =>
    `${entityCode}:${entityInstanceId}`,

  // ────────────────────────────────────────────────────────────────────────
  // Draft Store
  // ────────────────────────────────────────────────────────────────────────

  /** Draft key */
  draft: (entityCode: string, entityId: string) =>
    `draft:${entityCode}:${entityId}`,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a stable hash from query params for list caching
 * Params are sorted alphabetically to ensure consistent keys
 */
export function createQueryHash(params: Record<string, unknown>): string {
  // Remove undefined/null values and sort keys
  const cleaned = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, unknown>
    );

  return JSON.stringify(cleaned);
}

/**
 * Parse entity code and instance ID from a composite key
 * Used for entityInstance and entityInstanceName keys
 */
export function parseCompositeKey(key: string): {
  entityCode: string;
  entityInstanceId: string;
} | null {
  const parts = key.split(':');
  if (parts.length !== 2) return null;
  return {
    entityCode: parts[0],
    entityInstanceId: parts[1],
  };
}

/**
 * Parse forward link key into components
 */
export function parseLinkForwardKey(key: string): {
  parentCode: string;
  parentId: string;
  childCode: string;
} | null {
  const parts = key.split(':');
  if (parts.length !== 3) return null;
  return {
    parentCode: parts[0],
    parentId: parts[1],
    childCode: parts[2],
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type QueryKeyFactory = typeof QUERY_KEYS;
export type DexieKeyFactory = typeof DEXIE_KEYS;
