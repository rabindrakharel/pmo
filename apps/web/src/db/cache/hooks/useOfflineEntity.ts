// ============================================================================
// useOfflineEntity Hooks
// ============================================================================
// Dexie-only hooks for offline-first scenarios
// Reads directly from IndexedDB without network requests
// ============================================================================

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../persistence/schema';
import { DEXIE_KEYS } from '../keys';
import { ONDEMAND_STORE_CONFIG } from '../constants';

// ============================================================================
// Types
// ============================================================================

export interface UseOfflineEntityResult<T> {
  /** Entity instance name from cache */
  entityName: string | undefined;
  /** Loading from IndexedDB */
  isLoading: boolean;
  /** Data is older than staleTime */
  isStale: boolean;
  /** When data was last synced */
  syncedAt: number | undefined;
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
 * Offline-first hook that reads entity instance name from Dexie/IndexedDB
 *
 * STORE: entityInstance (Dexie only)
 * LAYER: Dexie persistence layer
 * PERSISTENCE: IndexedDB via Dexie
 *
 * Use this when:
 * - You need reactive updates from local cache only
 * - Network is unavailable
 * - You want instant display of cached entity names
 *
 * Note: This does NOT fetch from server. Use useEntity for network + cache.
 *
 * @example
 * const { entityName, isStale, syncedAt } = useOfflineEntity<Project>('project', projectId);
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
      return db.entityInstance.get(DEXIE_KEYS.entityInstance(entityCode, entityId));
    },
    [entityCode, entityId]
  );

  // Use centralized stale threshold from constants
  const isStale = cached
    ? Date.now() - cached.syncedAt > ONDEMAND_STORE_CONFIG.staleTime
    : true;

  return {
    entityName: cached?.entityInstanceName,
    isLoading: cached === undefined,
    isStale,
    syncedAt: cached?.syncedAt,
  };
}

// ============================================================================
// Entity List Hook
// ============================================================================

/**
 * Offline-first list hook - reads all entity instance names of a type from Dexie
 *
 * Note: This returns ALL cached entity names of this type, not data.
 * For full data, use useEntityInstanceData instead.
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
      return db.entityInstance
        .where('entityCode')
        .equals(entityCode)
        .sortBy('syncedAt');
    },
    [entityCode]
  );

  return {
    data: items?.map((i) => ({
      id: i.entityInstanceId,
      name: i.entityInstanceName,
    })) as T[] | undefined,
    isLoading: items === undefined,
    count: items?.length ?? 0,
  };
}

// ============================================================================
// Check if Entity Exists in Cache
// ============================================================================

/**
 * Check if an entity instance exists in local cache
 *
 * @example
 * const exists = await isEntityCached('project', projectId);
 */
export async function isEntityCached(
  entityCode: string,
  entityId: string
): Promise<boolean> {
  const entity = await db.entityInstance.get(
    DEXIE_KEYS.entityInstance(entityCode, entityId)
  );
  return !!entity;
}

// ============================================================================
// Get Cached Entity Sync (for non-hook contexts)
// ============================================================================

/**
 * Get cached entity instance name (returns promise)
 * For use in non-hook contexts like formatters
 *
 * @example
 * const projectName = await getCachedEntity('project', projectId);
 */
export async function getCachedEntity<T = Record<string, unknown>>(
  entityCode: string,
  entityId: string
): Promise<{ id: string; name: string } | null> {
  const entity = await db.entityInstance.get(
    DEXIE_KEYS.entityInstance(entityCode, entityId)
  );
  if (!entity) return null;
  return { id: entity.entityInstanceId, name: entity.entityInstanceName };
}
