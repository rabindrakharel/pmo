// ============================================================================
// TanStack Query Client Configuration
// ============================================================================
// Manages server state with automatic caching, deduplication, and background refresh
// ============================================================================

import { QueryClient } from '@tanstack/react-query';
import { db, type CachedEntity } from '../dexie/database';

// ============================================================================
// Query Client Instance
// ============================================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data becomes stale after 5 minutes
      staleTime: 5 * 60 * 1000,

      // Keep in cache for 30 minutes after last use
      gcTime: 30 * 60 * 1000,

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
  const maxAge = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();

  try {
    // Hydrate entity cache - only non-stale, non-deleted entries
    const entities = await db.entities
      .filter((e) => !e.isDeleted && now - e.syncedAt < maxAge)
      .toArray();

    for (const entity of entities) {
      queryClient.setQueryData(
        ['entity', entity.entityCode, entity.entityId],
        {
          data: entity.data,
          metadata: entity.metadata,
          ref_data_entityInstance: entity.refData,
        }
      );
    }

    // Hydrate metadata cache
    const metadata = await db.metadata.toArray();
    for (const meta of metadata) {
      if (meta.type === 'datalabel' && meta.key) {
        queryClient.setQueryData(['datalabel', meta.key], meta.data);
      } else if (meta.type === 'entityCodes') {
        queryClient.setQueryData(['entityCodes'], meta.data);
      } else if (meta.type === 'globalSettings') {
        queryClient.setQueryData(['globalSettings'], meta.data);
      }
    }

    console.log(
      `%c[QueryClient] Hydrated ${entities.length} entities, ${metadata.length} metadata from Dexie`,
      'color: #51cf66; font-weight: bold'
    );

    return entities.length;
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

  // Clear Dexie cache
  await Promise.all([
    db.entities.clear(),
    db.entityLists.clear(),
    db.metadata.clear(),
    // Note: Drafts are NOT cleared - they survive logout
  ]);

  console.log('[QueryClient] All caches cleared');
}

/**
 * Invalidate queries for a specific entity type
 * Called by WebSocket manager on INVALIDATE messages
 */
export function invalidateEntityQueries(
  entityCode: string,
  entityId?: string
): void {
  if (entityId) {
    // Invalidate specific entity
    queryClient.invalidateQueries({
      queryKey: ['entity', entityCode, entityId],
      refetchType: 'active',
    });
  }

  // Always invalidate list queries for this entity type
  queryClient.invalidateQueries({
    queryKey: ['entity-list', entityCode],
    refetchType: 'active',
  });
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
    queryKey: ['entity', entityCode, entityId],
    queryFn: fetchFn,
    staleTime: 5 * 60 * 1000,
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
    'entity',
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
  queryClient.setQueryData(['entity', entityCode, entityId], { data });
}

/**
 * Remove entity from cache
 * Used when entity is deleted
 */
export function removeCachedEntity(entityCode: string, entityId: string): void {
  queryClient.removeQueries({
    queryKey: ['entity', entityCode, entityId],
  });
}

// ============================================================================
// Metadata Cache Invalidation
// ============================================================================

/**
 * Invalidate metadata cache by type
 * Used when datalabels, entity codes, or settings are updated
 *
 * @param type - Type of metadata: 'datalabel' | 'entity' | 'settings' | 'component'
 * @param key - Optional key for specific item (e.g., datalabel name)
 */
export async function invalidateMetadataCache(
  type: 'datalabel' | 'entity' | 'settings' | 'component',
  key?: string
): Promise<void> {
  switch (type) {
    case 'datalabel':
      if (key) {
        queryClient.invalidateQueries({ queryKey: ['datalabel', key], refetchType: 'active' });
        // Remove from Dexie
        await db.metadata.delete(`datalabel:${key}`);
      } else {
        queryClient.invalidateQueries({ queryKey: ['datalabel'], refetchType: 'active' });
        // Remove all datalabels from Dexie
        await db.metadata.where('type').equals('datalabel').delete();
      }
      break;

    case 'entity':
      queryClient.invalidateQueries({ queryKey: ['entityCodes'], refetchType: 'active' });
      await db.metadata.delete('entityCodes');
      break;

    case 'settings':
      queryClient.invalidateQueries({ queryKey: ['globalSettings'], refetchType: 'active' });
      await db.metadata.delete('globalSettings');
      break;

    case 'component':
      if (key) {
        // Invalidate component metadata for specific entity
        queryClient.invalidateQueries({ queryKey: ['componentMetadata', key], refetchType: 'active' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['componentMetadata'], refetchType: 'active' });
      }
      break;
  }

  console.log(`%c[QueryClient] Metadata cache invalidated: ${type}${key ? `:${key}` : ''}`, 'color: #ff6b6b');
}

/**
 * Clear all metadata caches
 * Used on logout or for complete cache refresh
 */
export async function clearAllMetadataCache(): Promise<void> {
  // Clear TanStack Query metadata caches
  queryClient.invalidateQueries({ queryKey: ['datalabel'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['entityCodes'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['globalSettings'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['componentMetadata'], refetchType: 'all' });

  // Clear Dexie metadata table
  await db.metadata.clear();

  console.log('%c[QueryClient] All metadata caches cleared', 'color: #ff6b6b');
}
