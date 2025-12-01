// ============================================================================
// TanStack Query Client Configuration
// ============================================================================
// Manages server state with automatic caching, deduplication, and background refresh
// ============================================================================

import { QueryClient } from '@tanstack/react-query';
import { db } from '../dexie/database';

// ============================================================================
// Cache Timing Constants (Centralized - Single Source of Truth)
// ============================================================================
// These values are used across TanStack Query, Dexie hydration, and hooks.
// Changing a value here updates the behavior everywhere.

/** How long before data is considered stale and background refetch triggers */
export const CACHE_STALE_TIME = 5 * 60 * 1000; // 5 minutes

/** How long before data is considered stale for entity lists (matches default) */
export const CACHE_STALE_TIME_LIST = 5 * 60 * 1000; // 5 minutes (was 2 min - now consistent)

/** How long before metadata is considered stale (less frequent updates) */
export const CACHE_STALE_TIME_METADATA = 30 * 60 * 1000; // 30 minutes

/** How long before datalabel options are considered stale */
export const CACHE_STALE_TIME_DATALABEL = 10 * 60 * 1000; // 10 minutes

/** How long before entity codes are considered stale */
export const CACHE_STALE_TIME_ENTITY_CODES = 30 * 60 * 1000; // 30 minutes

/** How long before entity links are considered stale */
export const CACHE_STALE_TIME_ENTITY_LINKS = 5 * 60 * 1000; // 5 minutes

/** How long to keep data in memory after last use (garbage collection) */
export const CACHE_GC_TIME = 30 * 60 * 1000; // 30 minutes

/** Max age for Dexie hydration - data older than this is not loaded into TanStack */
export const DEXIE_HYDRATION_MAX_AGE = 30 * 60 * 1000; // 30 minutes

/** Max age for Dexie data to be considered valid (for offline scenarios) */
export const DEXIE_DATA_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Query Client Instance
// ============================================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data becomes stale after 5 minutes
      staleTime: CACHE_STALE_TIME,

      // Keep in cache for 30 minutes after last use
      gcTime: CACHE_GC_TIME,

      // Don't refetch on window focus (we have WebSocket for real-time)
      refetchOnWindowFocus: false,

      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Show previous data while refetching
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// ============================================================================
// Hydration from Dexie
// ============================================================================

/**
 * Hydrate TanStack Query cache from Dexie on startup
 *
 * This provides instant data on page load from IndexedDB,
 * while TanStack Query handles background refresh.
 */
export async function hydrateQueryCache(): Promise<number> {
  const maxAge = DEXIE_HYDRATION_MAX_AGE;
  const now = Date.now();
  let hydratedCount = 0;

  try {
    // Hydrate entity instance names (for reference lookups)
    const entityInstances = await db.entityInstance
      .filter((e) => now - e.syncedAt < maxAge)
      .toArray();

    // Group by entityCode for efficient hydration
    const instancesByCode = new Map<string, Record<string, string>>();
    for (const instance of entityInstances) {
      if (!instancesByCode.has(instance.entityCode)) {
        instancesByCode.set(instance.entityCode, {});
      }
      instancesByCode.get(instance.entityCode)![instance.entityInstanceId] =
        instance.entityInstanceName;
    }

    // Hydrate as entityInstance query data
    for (const [entityCode, names] of instancesByCode.entries()) {
      queryClient.setQueryData(['entityInstance', entityCode], names);
    }
    hydratedCount += entityInstances.length;

    // Hydrate datalabels
    const datalabels = await db.datalabel
      .filter((d) => now - d.syncedAt < maxAge)
      .toArray();

    for (const datalabel of datalabels) {
      queryClient.setQueryData(['datalabel', datalabel.key], datalabel.options);
    }
    hydratedCount += datalabels.length;

    // Hydrate entity codes
    const entityCodes = await db.entityCode.toArray();
    if (entityCodes.length > 0) {
      // Assuming single record with all entity codes
      const allCodes = entityCodes[0];
      if (allCodes?.codes) {
        queryClient.setQueryData(['entityCode'], allCodes.codes);
      }
    }

    // Hydrate global settings
    const globalSettings = await db.globalSetting.toArray();
    if (globalSettings.length > 0) {
      const settings = globalSettings[0];
      if (settings?.settings) {
        queryClient.setQueryData(['globalSetting'], settings.settings);
      }
    }

    // Hydrate entity instance metadata (field definitions per entity type)
    const entityMetadata = await db.entityInstanceMetadata
      .filter((m) => now - m.syncedAt < maxAge)
      .toArray();

    for (const meta of entityMetadata) {
      queryClient.setQueryData(['entityInstanceMetadata', meta.entityCode], {
        fields: meta.fields,
        viewType: meta.viewType,
        editType: meta.editType,
      });
    }
    hydratedCount += entityMetadata.length;

    console.log(
      `%c[QueryClient] Hydrated ${hydratedCount} records from Dexie (${entityInstances.length} instances, ${datalabels.length} datalabels, ${entityMetadata.length} metadata)`,
      'color: #51cf66; font-weight: bold'
    );

    return hydratedCount;
  } catch (error) {
    console.error('[QueryClient] Hydration failed:', error);
    return 0;
  }
}

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Clear all TanStack Query and Dexie caches
 * Used on logout
 */
export async function clearAllCaches(): Promise<void> {
  // Clear TanStack Query cache
  queryClient.clear();

  // Clear Dexie cache (all tables except draft - drafts survive logout)
  await Promise.all([
    db.datalabel.clear(),
    db.entityCode.clear(),
    db.globalSetting.clear(),
    db.entityInstanceData.clear(),
    db.entityInstanceMetadata.clear(),
    db.entityInstance.clear(),
    db.entityLink.clear(),
    // Note: draft table is NOT cleared - drafts survive logout
  ]);

  console.log('[QueryClient] All caches cleared');
}

/**
 * Invalidate queries for a specific entity type
 * Called by WebSocket manager on INVALIDATE messages
 *
 * IMPORTANT: Also clears Dexie entityInstanceData to prevent stale hydration.
 * This ensures that on next page load, fresh data is fetched instead of
 * loading outdated cached data from IndexedDB.
 */
export async function invalidateEntityQueries(
  entityCode: string,
  entityId?: string
): Promise<void> {
  if (entityId) {
    // Invalidate specific entity instance
    queryClient.invalidateQueries({
      queryKey: ['entityInstance', entityCode, entityId],
      refetchType: 'active',
    });

    // Also clear from Dexie entityInstance (name lookup)
    try {
      const key = `${entityCode}:${entityId}`;
      await db.entityInstance.delete(key);
    } catch {
      // May not exist - ignore
    }
  }

  // Always invalidate list queries for this entity type
  queryClient.invalidateQueries({
    queryKey: ['entityInstanceData', entityCode],
    refetchType: 'active',
  });

  // Clear stale Dexie entityInstanceData for this entity type
  // This prevents hydrating outdated data on next page load
  try {
    await db.entityInstanceData
      .where('entityCode')
      .equals(entityCode)
      .delete();
  } catch (error) {
    console.warn(`[QueryClient] Failed to clear Dexie cache for ${entityCode}:`, error);
  }
}

/**
 * Prefetch an entity into cache
 * Useful for hover prefetch on links
 */
export async function prefetchEntity(
  entityCode: string,
  entityId: string,
  fetchFn: () => Promise<unknown>
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: ['entityInstance', entityCode, entityId],
    queryFn: fetchFn,
    staleTime: CACHE_STALE_TIME,
  });
}

/**
 * Get cached entity data synchronously (if available)
 * Returns undefined if not in cache
 */
export function getCachedEntity<T = unknown>(
  entityCode: string,
  entityId: string
): T | undefined {
  const data = queryClient.getQueryData<{ data: T }>([
    'entityInstance',
    entityCode,
    entityId,
  ]);
  return data?.data;
}

/**
 * Set entity data in cache manually
 * Used by mutations for optimistic updates
 */
export function setCachedEntity<T = unknown>(
  entityCode: string,
  entityId: string,
  data: T
): void {
  queryClient.setQueryData(['entityInstance', entityCode, entityId], { data });
}

/**
 * Remove entity from cache
 * Used when entity is deleted
 */
export function removeCachedEntity(entityCode: string, entityId: string): void {
  queryClient.removeQueries({
    queryKey: ['entityInstance', entityCode, entityId],
  });
}

// ============================================================================
// Metadata Cache Invalidation
// ============================================================================

/**
 * Invalidate metadata cache by type
 * Used when datalabels, entity codes, or settings are updated
 *
 * @param type - Type of metadata: 'datalabel' | 'entityCode' | 'globalSetting' | 'entityInstanceMetadata'
 * @param key - Optional key for specific item (e.g., datalabel name or entity code)
 */
export async function invalidateMetadataCache(
  type: 'datalabel' | 'entityCode' | 'globalSetting' | 'entityInstanceMetadata',
  key?: string
): Promise<void> {
  switch (type) {
    case 'datalabel':
      if (key) {
        queryClient.invalidateQueries({
          queryKey: ['datalabel', key],
          refetchType: 'active',
        });
        // Remove from Dexie
        await db.datalabel.delete(key);
      } else {
        queryClient.invalidateQueries({
          queryKey: ['datalabel'],
          refetchType: 'active',
        });
        // Remove all datalabels from Dexie
        await db.datalabel.clear();
      }
      break;

    case 'entityCode':
      queryClient.invalidateQueries({
        queryKey: ['entityCode'],
        refetchType: 'active',
      });
      await db.entityCode.clear();
      break;

    case 'globalSetting':
      queryClient.invalidateQueries({
        queryKey: ['globalSetting'],
        refetchType: 'active',
      });
      await db.globalSetting.clear();
      break;

    case 'entityInstanceMetadata':
      if (key) {
        queryClient.invalidateQueries({
          queryKey: ['entityInstanceMetadata', key],
          refetchType: 'active',
        });
        await db.entityInstanceMetadata.delete(key);
      } else {
        queryClient.invalidateQueries({
          queryKey: ['entityInstanceMetadata'],
          refetchType: 'active',
        });
        await db.entityInstanceMetadata.clear();
      }
      break;
  }

  console.log(
    `%c[QueryClient] Metadata cache invalidated: ${type}${key ? `:${key}` : ''}`,
    'color: #ff6b6b'
  );
}

/**
 * Clear all metadata caches
 * Used on logout or for complete cache refresh
 */
export async function clearAllMetadataCache(): Promise<void> {
  // Clear TanStack Query metadata caches
  queryClient.invalidateQueries({ queryKey: ['datalabel'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['entityCode'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['globalSetting'], refetchType: 'all' });
  queryClient.invalidateQueries({
    queryKey: ['entityInstanceMetadata'],
    refetchType: 'all',
  });

  // Clear Dexie metadata tables
  await Promise.all([
    db.datalabel.clear(),
    db.entityCode.clear(),
    db.globalSetting.clear(),
    db.entityInstanceMetadata.clear(),
  ]);

  console.log('%c[QueryClient] All metadata caches cleared', 'color: #ff6b6b');
}
