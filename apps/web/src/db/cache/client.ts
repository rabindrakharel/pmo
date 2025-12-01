// ============================================================================
// TanStack Query Client Configuration
// ============================================================================
// Centralized QueryClient with default options based on store configs
// ============================================================================

import { QueryClient } from '@tanstack/react-query';
import { ONDEMAND_STORE_CONFIG, SESSION_STORE_CONFIG } from './constants';

// ============================================================================
// Query Client Instance
// ============================================================================

/**
 * TanStack Query client with optimized defaults
 *
 * Features:
 * - On-demand store timing as default (5 min stale, 30 min gc)
 * - WebSocket handles real-time updates (no refetch on window focus)
 * - Retry with exponential backoff (max 30s)
 * - Keep previous data while refetching
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data becomes stale after 5 minutes (on-demand default)
      staleTime: ONDEMAND_STORE_CONFIG.staleTime,

      // Keep in cache for 30 minutes after last use
      gcTime: ONDEMAND_STORE_CONFIG.gcTime,

      // Don't refetch on window focus (WebSocket handles real-time)
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
// Cache Invalidation Utilities
// ============================================================================

/**
 * Invalidate queries for a specific store
 *
 * @param storeName - Store name or query key prefix
 * @param key - Optional secondary key (e.g., entity code, datalabel key)
 */
export async function invalidateStore(
  storeName: string,
  key?: string
): Promise<void> {
  const queryKey = key ? [storeName, key] : [storeName];
  await queryClient.invalidateQueries({
    queryKey,
    refetchType: 'active',
  });
}

/**
 * Invalidate all queries for an entity type
 * Used by WebSocket on INVALIDATE messages
 *
 * @param entityCode - Entity type code
 * @param entityId - Optional specific entity instance ID
 */
export async function invalidateEntityQueries(
  entityCode: string,
  entityId?: string
): Promise<void> {
  if (entityId) {
    // Invalidate specific entity instance
    await queryClient.invalidateQueries({
      queryKey: ['entityInstance', entityCode, entityId],
      refetchType: 'active',
    });
  }

  // Always invalidate list queries for this entity type
  await queryClient.invalidateQueries({
    queryKey: ['entityInstanceData', entityCode],
    refetchType: 'active',
  });
}

/**
 * Invalidate metadata cache by type
 *
 * @param type - Metadata type
 * @param key - Optional specific key
 */
export async function invalidateMetadataCache(
  type: 'datalabel' | 'entityCodes' | 'globalSettings' | 'entityInstanceMetadata',
  key?: string
): Promise<void> {
  switch (type) {
    case 'datalabel':
      await queryClient.invalidateQueries({
        queryKey: key ? ['datalabel', key] : ['datalabel'],
        refetchType: 'active',
      });
      break;

    case 'entityCodes':
      await queryClient.invalidateQueries({
        queryKey: ['entityCodes'],
        refetchType: 'active',
      });
      break;

    case 'globalSettings':
      await queryClient.invalidateQueries({
        queryKey: ['globalSettings'],
        refetchType: 'active',
      });
      break;

    case 'entityInstanceMetadata':
      await queryClient.invalidateQueries({
        queryKey: key ? ['entityInstanceMetadata', key] : ['entityInstanceMetadata'],
        refetchType: 'active',
      });
      break;
  }
}

/**
 * Clear all metadata caches (datalabels, entity codes, global settings, entity metadata)
 * Used for full cache refresh
 */
export async function clearAllMetadataCache(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['datalabel'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['entityCodes'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['globalSettings'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['entityInstanceMetadata'], refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: ['entityInstanceNames'], refetchType: 'active' }),
  ]);
}

/**
 * Clear all TanStack Query cache
 * Used on logout
 */
export function clearQueryCache(): void {
  queryClient.clear();
}

/**
 * Set data in query cache manually
 * Used for optimistic updates
 */
export function setQueryData<T>(queryKey: readonly unknown[], data: T): void {
  queryClient.setQueryData(queryKey, data);
}

/**
 * Get data from query cache
 * Returns undefined if not cached
 */
export function getQueryData<T>(queryKey: readonly unknown[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Remove query from cache
 * Used when entity is deleted
 */
export function removeQuery(queryKey: readonly unknown[]): void {
  queryClient.removeQueries({ queryKey });
}

/**
 * Prefetch query into cache
 * Useful for hover prefetch on links
 */
export async function prefetchQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  staleTime: number = SESSION_STORE_CONFIG.staleTime
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime,
  });
}
