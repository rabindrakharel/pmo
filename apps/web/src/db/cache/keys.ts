// ============================================================================
// Unified Cache Key Factories
// ============================================================================
// Query keys for TanStack Query and Dexie composite keys
// ============================================================================

// ============================================================================
// TANSTACK QUERY KEYS
// ============================================================================

/**
 * Query key factories for TanStack Query
 * These provide type-safe, consistent key generation
 */
export const QUERY_KEYS = {
  // Session-level stores
  globalSettings: ['globalSettings'] as const,
  datalabel: (key: string) => ['datalabel', key] as const,
  datalabelAll: ['datalabel', 'all'] as const,
  entityCodes: ['entityCodes'] as const,
  entityInstanceNames: (entityCode: string) => ['entityInstanceNames', entityCode] as const,
  entityLinks: ['entityLinks'] as const,
  entityInstanceMetadata: (entityCode: string) => ['entityInstanceMetadata', entityCode] as const,

  // On-demand stores
  entityInstanceData: (entityCode: string, params: Record<string, unknown>) =>
    ['entityInstanceData', entityCode, params] as const,
  entityInstanceDataInfinite: (entityCode: string, params: Record<string, unknown>) =>
    ['entityInstanceData-infinite', entityCode, params] as const,

  // Single entity queries
  entity: (entityCode: string, entityId: string) =>
    ['entity', entityCode, entityId] as const,

  // Draft queries
  draft: (entityCode: string, entityId: string) =>
    ['draft', entityCode, entityId] as const,
  draftAll: ['draft', 'all'] as const,
} as const;

// ============================================================================
// DEXIE COMPOSITE KEYS
// ============================================================================

/**
 * Dexie key factories - matches TanStack Query key structure
 */
export const DEXIE_KEYS = {
  /**
   * Global settings key (singleton)
   */
  globalSettings: () => 'settings' as const,

  /**
   * Datalabel key - normalizes dl__ prefix
   * @param key - Datalabel key with or without 'dl__' prefix
   */
  datalabel: (key: string): string => {
    return key.startsWith('dl__') ? key.slice(4) : key;
  },

  /**
   * Entity codes key (singleton)
   */
  entityCodes: () => 'all' as const,

  /**
   * Entity instance name key
   */
  entityInstanceName: (entityCode: string, entityInstanceId: string): string => {
    return `${entityCode}:${entityInstanceId}`;
  },

  /**
   * Entity link forward key (parent → children)
   */
  entityLinkForward: (parentCode: string, parentId: string, childCode: string): string => {
    return `${parentCode}:${parentId}:${childCode}`;
  },

  /**
   * Entity link reverse key (child → parents)
   */
  entityLinkReverse: (childCode: string, childId: string): string => {
    return `${childCode}:${childId}`;
  },

  /**
   * Entity instance metadata key
   */
  entityInstanceMetadata: (entityCode: string): string => {
    return entityCode;
  },

  /**
   * Entity instance data key (query result)
   */
  entityInstanceData: (entityCode: string, params: Record<string, unknown>): string => {
    return `${entityCode}:${createQueryHash(params)}`;
  },

  /**
   * Single entity key
   */
  entity: (entityCode: string, entityId: string): string => {
    return `${entityCode}:${entityId}`;
  },

  /**
   * Draft key
   */
  draft: (entityCode: string, entityId: string): string => {
    return `draft:${entityCode}:${entityId}`;
  },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create stable hash from query params for list caching
 * Ensures consistent key generation regardless of param order
 */
export function createQueryHash(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      // Skip undefined values
      if (params[key] !== undefined) {
        acc[key] = params[key];
      }
      return acc;
    }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
}

/**
 * Parse entity code and ID from composite key
 */
export function parseEntityKey(key: string): { entityCode: string; entityId: string } | null {
  const parts = key.split(':');
  if (parts.length === 2) {
    return { entityCode: parts[0], entityId: parts[1] };
  }
  return null;
}

/**
 * Parse link forward key
 */
export function parseLinkForwardKey(key: string): {
  parentCode: string;
  parentId: string;
  childCode: string;
} | null {
  const parts = key.split(':');
  if (parts.length === 3) {
    return { parentCode: parts[0], parentId: parts[1], childCode: parts[2] };
  }
  return null;
}
