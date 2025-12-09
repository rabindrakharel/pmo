// ============================================================================
// useDatalabel Hook
// ============================================================================
// Hook for accessing datalabel dropdown options
// Session-level store - prefetch on login, 10 min staleTime
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS, DEXIE_KEYS } from '../keys';
import { STORE_STALE_TIMES, STORE_GC_TIMES } from '../constants';
import type { DatalabelOption, UseDatalabelResult } from '../types';
import {
  getDatalabel,
  setDatalabel,
  clearDatalabel,
} from '../../persistence/operations';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for accessing datalabel dropdown options
 *
 * STORE: datalabel
 * LAYER: Session-level (prefetch on login, 10 min staleTime)
 * PERSISTENCE: Dexie IndexedDB with 24-hour TTL
 *
 * @param key - Datalabel key (e.g., 'project_stage' or 'dl__project_stage')
 */
export function useDatalabel(key: string): UseDatalabelResult {
  // Normalize key (strip 'dl__' prefix if present)
  const normalizedKey = DEXIE_KEYS.datalabel(key);

  const query = useQuery<DatalabelOption[]>({
    queryKey: QUERY_KEYS.datalabel(normalizedKey),
    queryFn: async () => {
      // v14.0.0: Stale-While-Revalidate Pattern
      // 1. Check Dexie first - if fresh enough, return immediately (no API call)
      // 2. If stale or missing, fetch from API
      // 3. On API error, fallback to Dexie cache
      const cached = await getDatalabel(normalizedKey);

      // If Dexie has data, return it - TanStack Query will background refetch if stale
      // This provides instant UI rendering from IndexedDB
      if (cached && cached.length > 0) {
        // Still update from API in background (non-blocking)
        apiClient.get<{ data: DatalabelOption[] }>(
          `/api/v1/datalabel/${normalizedKey}`
        ).then(response => {
          const options = response.data?.data || [];
          if (options.length > 0) {
            setDatalabel(normalizedKey, options);
          }
        }).catch(() => {
          // Silently ignore - we have cached data
        });

        return cached;
      }

      // No cache - must fetch from API
      try {
        const response = await apiClient.get<{ data: DatalabelOption[] }>(
          `/api/v1/datalabel/${normalizedKey}`
        );
        const options = response.data?.data || [];

        // Persist to Dexie
        await setDatalabel(normalizedKey, options);

        return options;
      } catch (error) {
        // If API fails but we have cached data, use it
        if (cached) {
          return cached;
        }
        throw error;
      }
    },
    staleTime: STORE_STALE_TIMES.datalabel,
    // v14.0.0: Use STORE_GC_TIMES.datalabel (Infinity) to NEVER garbage collect
    // Datalabels are critical for badge colors and dropdowns - must persist for entire session
    gcTime: STORE_GC_TIMES.datalabel,
    placeholderData: [],
  });

  // v11.0.0: Removed sync store update - TanStack Query cache is the source of truth

  const getById = useCallback(
    (id: number): DatalabelOption | undefined => {
      return query.data?.find((opt) => opt.id === id);
    },
    [query.data]
  );

  const getByName = useCallback(
    (name: string): DatalabelOption | undefined => {
      return query.data?.find((opt) => opt.name === name);
    },
    [query.data]
  );

  return {
    options: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getById,
    getByName,
  };
}

// ============================================================================
// useAllDatalabels Hook
// ============================================================================

/**
 * Hook for fetching all datalabels at once
 * Used during prefetch to populate cache
 */
export function useAllDatalabels(): {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const query = useQuery({
    queryKey: QUERY_KEYS.datalabelAll(),
    queryFn: async () => {
      // v12.0.0: API returns array format, transform to record in queryFn
      const response = await apiClient.get<{
        data: Array<{ name: string; label: string; icon: string | null; options: DatalabelOption[] }>;
      }>('/api/v1/datalabel/all');

      // Transform array to record: { "dl__project_stage": [...options] }
      const allDatalabels: Record<string, DatalabelOption[]> = {};
      for (const item of response.data?.data || []) {
        allDatalabels[item.name] = item.options;
      }

      // v11.0.0: Persist each datalabel to Dexie (TanStack Query cache is auto-populated)
      for (const [key, options] of Object.entries(allDatalabels)) {
        await setDatalabel(key, options);
      }

      return allDatalabels;
    },
    staleTime: STORE_STALE_TIMES.datalabel,
    // v14.0.0: Use STORE_GC_TIMES.datalabel (Infinity) to NEVER garbage collect
    gcTime: STORE_GC_TIMES.datalabel,
  });

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}

// ============================================================================
// Prefetch Function
// ============================================================================

/**
 * Prefetch all datalabels into cache
 * Called during app initialization
 */
export async function prefetchAllDatalabels(): Promise<number> {
  try {
    // v12.0.0: API returns array format, transform to record
    const response = await apiClient.get<{
      data: Array<{ name: string; label: string; icon: string | null; options: DatalabelOption[] }>;
    }>('/api/v1/datalabel/all');

    // Transform array to record: { "dl__project_stage": [...options] }
    const allDatalabels: Record<string, DatalabelOption[]> = {};
    for (const item of response.data?.data || []) {
      allDatalabels[item.name] = item.options;
    }

    const { queryClient } = await import('../client');

    let count = 0;
    for (const [key, options] of Object.entries(allDatalabels)) {
      // v11.0.0: Set in query cache and Dexie only (no sync store)
      queryClient.setQueryData(QUERY_KEYS.datalabel(key), options);

      // Persist to Dexie
      await setDatalabel(key, options);

      count++;
    }

    return count;
  } catch (error) {
    console.error('[useDatalabel] Prefetch failed:', error);
    return 0;
  }
}

// ============================================================================
// Clear Function
// ============================================================================

/**
 * Clear datalabel cache
 * @param key - Optional specific key to clear
 */
export async function clearDatalabelCache(key?: string): Promise<void> {
  const { queryClient } = await import('../client');

  // v11.0.0: Only clear TanStack Query cache and Dexie (no sync store)
  if (key) {
    const normalizedKey = DEXIE_KEYS.datalabel(key);
    queryClient.removeQueries({ queryKey: QUERY_KEYS.datalabel(normalizedKey) });
    await clearDatalabel(normalizedKey);
  } else {
    queryClient.removeQueries({ queryKey: ['datalabel'] });
    await clearDatalabel();
  }
}

// ============================================================================
// Sync Access (Re-export for convenience)
// ============================================================================

export { getDatalabelSync } from '../stores';
