/**
 * Central Pagination Configuration
 * ================================
 * Single source of truth for all pagination defaults across the frontend.
 * This mirrors the backend config in apps/api/src/lib/pagination.ts
 *
 * v8.1.0: Centralized configuration for consistent pagination behavior
 *
 * Usage:
 * ```typescript
 * import { PAGINATION_CONFIG, getEntityLimit } from '@/lib/pagination.config';
 *
 * // Use defaults
 * const { data } = useEntityInstanceList('project', {
 *   pageSize: getEntityLimit('project')
 * });
 * ```
 */

export const PAGINATION_CONFIG = {
  /** Default page number when not specified */
  DEFAULT_PAGE: 1,

  /** Default records per page for list views (standard pagination) */
  DEFAULT_PAGE_SIZE: 20,

  /** Default limit for bulk data loading (format-at-read pattern) */
  DEFAULT_LIMIT: 20000,

  /** Maximum allowed limit per request */
  MAX_LIMIT: 100000,

  /** Minimum allowed limit */
  MIN_LIMIT: 1,

  /** Default for child entity lists (e.g., project tasks) */
  CHILD_ENTITY_LIMIT: 100,

  /** Default for dropdown/select options */
  DROPDOWN_LIMIT: 1000,

  /** Default for settings/datalabel lists */
  SETTINGS_LIMIT: 500,

  /** Entity-specific limits (override DEFAULT_LIMIT for specific entities) */
  ENTITY_LIMITS: {
    project: 1000,
    task: 1000,
    employee: 5000,
    client: 5000,
  } as Record<string, number>,
} as const;

/**
 * Get the default limit for a specific entity type
 * Falls back to DEFAULT_LIMIT if no entity-specific limit is configured
 *
 * @param entityCode - Entity type code (e.g., 'project', 'task')
 * @returns The configured limit for this entity type
 *
 * @example
 * const limit = getEntityLimit('project'); // Returns 3000
 * const limit = getEntityLimit('wiki');    // Returns DEFAULT_LIMIT (20000)
 */
export function getEntityLimit(entityCode: string): number {
  return PAGINATION_CONFIG.ENTITY_LIMITS[entityCode] ?? PAGINATION_CONFIG.DEFAULT_LIMIT;
}

// Export type for the config
export type PaginationConfig = typeof PAGINATION_CONFIG;
