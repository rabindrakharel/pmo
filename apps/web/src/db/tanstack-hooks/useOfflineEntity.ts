// ============================================================================
// useOfflineEntity Hooks
// ============================================================================
// Dexie-only hooks for offline-first scenarios
// Reads directly from IndexedDB without network requests
// ============================================================================

import { useLiveQuery } from 'dexie-react-hooks';
import { db, createEntityKey } from '../dexie/database';

// ============================================================================
// Types
// ============================================================================

export interface UseOfflineEntityResult<T> {
  /** Entity data from cache */
  data: T | undefined;
  /** Field metadata */
  metadata: Record<string, unknown> | undefined;
  /** Reference data */
  refData: Record<string, Record<string, string>> | undefined;
  /** Loading from IndexedDB */
  isLoading: boolean;
  /** Data is older than staleTime */
  isStale: boolean;
  /** When data was last synced */
  syncedAt: number | undefined;
  /** Data version */
  version: number | undefined;
}

export interface UseOfflineEntityListResult<T> {
  /** Array of entity data from cache */
  data: T[] | undefined;
  /** Loading from IndexedDB */
  isLoading: boolean;
  /** Number of items in cache */
  count: number;
}

// ============================================================================
// Single Entity Hook
// ============================================================================

/**
 * Offline-first hook that reads directly from Dexie/IndexedDB
 *
 * Use this when:
 * - You need reactive updates from local cache only
 * - Network is unavailable
 * - You want instant display of cached data
 *
 * Note: This does NOT fetch from server. Use useEntity for network + cache.
 *
 * @example
 * const { data, isStale, syncedAt } = useOfflineEntity<Project>('project', projectId);
 * if (isStale) {
 *   // Data is old, might want to trigger refresh
 * }
 */
export function useOfflineEntity<T = Record<string, unknown>>(
  entityCode: string,
  entityId: string | undefined
): UseOfflineEntityResult<T> {
  // Reactive query - auto-updates when IndexedDB changes
  const cached = useLiveQuery(
    async () => {
      if (!entityId) return null;
      const entity = await db.entities.get(createEntityKey(entityCode, entityId));
      return entity?.isDeleted ? null : entity;
    },
    [entityCode, entityId]
  );

  // Consider data stale after 5 minutes
  const STALE_THRESHOLD = 5 * 60 * 1000;
  const isStale = cached
    ? Date.now() - cached.syncedAt > STALE_THRESHOLD
    : true;

  return {
    data: cached?.data as T | undefined,
    metadata: cached?.metadata as Record<string, unknown> | undefined,
    refData: cached?.refData,
    isLoading: cached === undefined,
    isStale,
    syncedAt: cached?.syncedAt,
    version: cached?.version,
  };
}

// ============================================================================
// Entity List Hook
// ============================================================================

/**
 * Offline-first list hook - reads all entities of a type from Dexie
 *
 * Note: This returns ALL cached entities of this type, not paginated.
 * For paginated/filtered data, use useEntityList instead.
 *
 * @example
 * const { data, count } = useOfflineEntityList<Task>('task');
 */
export function useOfflineEntityList<T = Record<string, unknown>>(
  entityCode: string
): UseOfflineEntityListResult<T> {
  // Reactive query - auto-updates when IndexedDB changes
  const items = useLiveQuery(
    async () => {
      return db.entities
        .where('entityCode')
        .equals(entityCode)
        .and((item) => !item.isDeleted)
        .sortBy('syncedAt');
    },
    [entityCode]
  );

  return {
    data: items?.map((i) => i.data) as T[] | undefined,
    isLoading: items === undefined,
    count: items?.length ?? 0,
  };
}

// ============================================================================
// Check if Entity Exists in Cache
// ============================================================================

/**
 * Check if an entity exists in local cache
 *
 * @example
 * const exists = await isEntityCached('project', projectId);
 */
export async function isEntityCached(
  entityCode: string,
  entityId: string
): Promise<boolean> {
  const entity = await db.entities.get(createEntityKey(entityCode, entityId));
  return !!entity && !entity.isDeleted;
}

// ============================================================================
// Get Cached Entity Sync (for non-hook contexts)
// ============================================================================

/**
 * Get cached entity synchronously (returns promise)
 * For use in non-hook contexts like formatters
 *
 * @example
 * const project = await getCachedEntity('project', projectId);
 */
export async function getCachedEntity<T = Record<string, unknown>>(
  entityCode: string,
  entityId: string
): Promise<T | null> {
  const entity = await db.entities.get(createEntityKey(entityCode, entityId));
  if (!entity || entity.isDeleted) return null;
  return entity.data as T;
}
