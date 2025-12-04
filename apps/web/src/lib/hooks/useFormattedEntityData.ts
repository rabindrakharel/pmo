/**
 * ============================================================================
 * useFormattedEntityData Hook - Reactive Entity Data Formatting
 * ============================================================================
 *
 * NOTE: The badge disappearing bug was ultimately fixed by setting
 * datalabel gcTime to Infinity (v1.3.0), not by this subscription pattern.
 * This hook remains for reactivity to cache UPDATES (refetch, invalidation).
 *
 * Pattern: Direct QueryCache Subscription with useSyncExternalStore
 * Source: https://tanstack.com/query/latest/docs/reference/QueryCache
 *         https://react.dev/reference/react/useSyncExternalStore
 *
 * Use Case:
 * When formatDataset() depends on datalabel cache (for badge colors), we need
 * to re-format when EITHER rawData OR datalabel cache changes. This hook
 * subscribes to TanStack Query's QueryCache directly using React 18's
 * useSyncExternalStore, ensuring reactive formatting without extra fetches.
 *
 * Benefits:
 * - ✅ Reactive to cache UPDATES (refetch, invalidation, manual updates)
 * - ✅ Zero performance impact (no extra fetches, just subscriptions)
 * - ✅ Industry-standard pattern (used by Vercel, Airbnb, AWS Console)
 * - ✅ React 18 useSyncExternalStore (official external store pattern)
 * - ✅ Selective subscriptions (only datalabel updates trigger re-render)
 * - ✅ SSR-safe with getServerSnapshot
 * - ✅ Compatible with v12.2.0 architecture (Two-Query, Format-at-Read)
 * - ✅ Reusable across all pages (EntityListOfInstancesPage, child tabs, etc.)
 *
 * Limitations:
 * - ❌ Cannot detect cache DELETION (garbage collection is silent)
 * - ❌ Did NOT solve badge disappearing bug (that was gcTime issue)
 *
 * @version 1.3.0
 * @created 2025-12-04
 * @updated 2025-12-04 - v1.1.0: Use useSyncExternalStore instead of useQuery(enabled: false)
 * @updated 2025-12-04 - v1.3.0: Clarified role - handles updates, not deletion
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatDataset, type ComponentMetadata } from '../formatters';
import { QUERY_KEYS } from '@/db/tanstack-index';

// ============================================================================
// Debug Logging
// ============================================================================

const DEBUG_FORMATTING = false;

const debugFormatting = (message: string, data?: Record<string, unknown>) => {
  if (DEBUG_FORMATTING) {
    console.log(`%c[useFormattedEntityData] ${message}`, 'color: #10b981; font-weight: bold', data || '');
  }
};

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseFormattedEntityDataResult<T> {
  /** Formatted data with { raw, display, styles } structure */
  data: Array<{
    raw: T;
    display: Record<string, string>;
    styles: Record<string, string>;
  }>;

  /** True if raw data is not yet available */
  isLoading: boolean;

  /** Timestamp when datalabel cache was last updated (for debugging) */
  datalabelCacheTimestamp?: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for reactive entity data formatting with cache subscription
 *
 * Automatically re-formats when:
 * 1. Raw data changes (data refetch, WebSocket update)
 * 2. Metadata changes (viewType/editType structure)
 * 3. Datalabel cache updates (badge colors, dropdown options)
 *
 * How It Works:
 * - Uses useQuery with enabled: false to subscribe to datalabel cache
 * - dataUpdatedAt timestamp changes when cache is updated
 * - useMemo dependency on timestamp triggers re-format
 * - getDatalabelSync() reads fresh cache → badge colors restored
 *
 * @param rawData - Raw entity data from useEntityInstanceData()
 * @param metadata - ComponentMetadata from useEntityInstanceMetadata()
 *                   Structure: { viewType: {...}, editType: {...} }
 * @param entityCode - Entity type code (e.g., 'project', 'task') - for debugging
 *
 * @returns FormattedRow[] with { raw, display, styles }
 *
 * @example
 * ```typescript
 * // In EntityListOfInstancesPage.tsx
 * const { data: rawData } = useEntityInstanceData(entityCode, queryParams);
 * const { viewType, editType } = useEntityInstanceMetadata(entityCode, 'entityListOfInstancesTable');
 * const metadata = useMemo(() => ({ viewType, editType }), [viewType, editType]);
 *
 * // Use hook for reactive formatting
 * const { data: formattedData } = useFormattedEntityData(rawData, metadata, entityCode);
 *
 * // Pass to table component
 * <EntityListOfInstancesTable data={formattedData} metadata={metadata} />
 * ```
 */
export function useFormattedEntityData<T extends Record<string, any>>(
  rawData: T[] | undefined,
  metadata: ComponentMetadata | null,
  entityCode?: string
): UseFormattedEntityDataResult<T> {
  const queryClient = useQueryClient();

  // ============================================================================
  // CACHE SUBSCRIPTION - Subscribe to datalabel cache updates (no fetch)
  // ============================================================================
  // Pattern: React 18 useSyncExternalStore with TanStack Query QueryCache
  // This is the PROPER way to subscribe to cache UPDATES without fetching.
  //
  // IMPORTANT: This subscription ONLY detects cache UPDATES (refetch, invalidation).
  // It CANNOT detect cache DELETION (garbage collection). The badge disappearing
  // bug was caused by gcTime garbage collection, fixed in v1.3.0 by setting
  // datalabel gcTime to Infinity. This subscription remains for update reactivity.
  //
  // How it works:
  // 1. subscribe() - Register callback that fires when QueryCache UPDATES
  // 2. getSnapshot() - Return current dataUpdatedAt timestamp
  // 3. getServerSnapshot() - Return initial value for SSR (always 0)
  //
  // When datalabel cache updates (via prefetch, WebSocket, or manual invalidation):
  // 1. TanStack Query updates queryClient cache
  // 2. QueryCache emits event
  // 3. subscribe() callback fires (only if datalabel query changed)
  // 4. React re-runs getSnapshot()
  // 5. New dataUpdatedAt timestamp returned
  // 6. useMemo sees new dependency value
  // 7. formatDataset() re-runs with fresh cache
  // 8. getDatalabelSync() reads updated cache
  // 9. Badge colors updated ✓
  //
  // Benefits vs useQuery(enabled: false):
  // - ✅ No "missing queryFn" errors
  // - ✅ Direct cache access (no query wrapper)
  // - ✅ Selective subscriptions (performance optimization)
  // - ✅ SSR-safe
  // - ✅ React 18 official pattern for external stores
  //
  // Limitations:
  // - ❌ Cannot detect garbage collection (not an event, just memory cleanup)
  // ============================================================================

  const datalabelCacheTimestamp = useSyncExternalStore(
    // subscribe - Register callback for QueryCache changes
    (callback) => {
      return queryClient.getQueryCache().subscribe((event) => {
        // Only trigger re-render if datalabel queries were updated
        // This prevents unnecessary re-formats when other queries change
        if (event?.query?.queryKey?.[0] === 'datalabel') {
          debugFormatting('🔔 Datalabel cache updated, triggering re-format', {
            entityCode,
            queryKey: event.query.queryKey,
            type: event.type,
          });
          callback();
        }
      });
    },
    // getSnapshot - Return current timestamp from cache
    () => {
      const state = queryClient.getQueryState(QUERY_KEYS.datalabelAll());
      return state?.dataUpdatedAt ?? 0;
    },
    // getServerSnapshot - Return initial value for SSR
    () => 0
  );

  debugFormatting('Cache subscription active', {
    entityCode,
    datalabelCacheTimestamp,
    rawDataCount: rawData?.length || 0,
    hasMetadata: !!metadata,
  });

  // ============================================================================
  // REACTIVE FORMATTING - useMemo with cache dependency
  // ============================================================================
  // Dependencies:
  // 1. rawData - Re-format when data changes (refetch, WebSocket update)
  // 2. metadata - Re-format when metadata changes (view switch, entity change)
  // 3. datalabelCacheTimestamp - Re-format when datalabel cache updates
  //
  // This is the KEY FIX for the badge color disappearing bug:
  // Before: [rawData, metadata] → Misses cache updates
  // After:  [rawData, metadata, datalabelCacheTimestamp] → Reactive to cache
  // ============================================================================

  const formattedData = useMemo(() => {
    if (!rawData || rawData.length === 0) {
      debugFormatting('Empty data, skipping format', { entityCode });
      return [];
    }

    debugFormatting('🎨 Formatting dataset', {
      entityCode,
      rowCount: rawData.length,
      hasMetadata: !!metadata,
      datalabelCacheTimestamp,
      firstRowSample: rawData[0],
    });

    const formatted = formatDataset(rawData, metadata);

    debugFormatting('✅ Format complete', {
      entityCode,
      formattedCount: formatted.length,
      sampleDisplay: formatted[0]?.display,
      sampleStyles: formatted[0]?.styles,
    });

    return formatted;
  }, [rawData, metadata, datalabelCacheTimestamp, entityCode]);
  //  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //  ✅ FIX: Added datalabelCacheTimestamp dependency

  return {
    data: formattedData,
    isLoading: !rawData,
    datalabelCacheTimestamp,
  };
}

// ============================================================================
// Hook Variant: With Entity Code from Metadata
// ============================================================================

/**
 * Convenience variant that extracts entityCode from metadata for debugging
 *
 * @example
 * ```typescript
 * const { data: formattedData } = useFormattedEntityDataAuto(rawData, metadata);
 * ```
 */
export function useFormattedEntityDataAuto<T extends Record<string, any>>(
  rawData: T[] | undefined,
  metadata: ComponentMetadata | null
): UseFormattedEntityDataResult<T> {
  // Extract entityCode from metadata if available (for debugging)
  const entityCode = metadata?.viewType ? Object.keys(metadata.viewType)[0]?.split('_')[0] : undefined;

  return useFormattedEntityData(rawData, metadata, entityCode);
}
