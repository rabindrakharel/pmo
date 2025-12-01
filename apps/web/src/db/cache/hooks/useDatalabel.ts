// ============================================================================
// useDatalabel Hook
// ============================================================================
// Hook for accessing datalabel dropdown options
// Session-level store - prefetch on login, 10 min staleTime
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS, DEXIE_KEYS } from '../keys';
import { SESSION_STORE_CONFIG, STORE_STALE_TIMES } from '../constants';
import { datalabelStore, getDatalabelSync, setDatalabelSync } from '../stores';
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
      // Layer 2: Check Dexie
      const cached = await getDatalabel(normalizedKey);

      // Layer 3: Fetch from API
      try {
        const response = await apiClient.get<{ data: DatalabelOption[] }>(
          `/api/v1/datalabel/${normalizedKey}`
        );
        const options = response.data || [];

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
    gcTime: SESSION_STORE_CONFIG.gcTime,
    placeholderData: [],
  });

  // Update sync store when data changes
  useEffect(() => {
    if (query.data) {
      setDatalabelSync(normalizedKey, query.data);
    }
  }, [normalizedKey, query.data]);

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
      const response = await apiClient.get<{
        data: Record<string, DatalabelOption[]>;
      }>('/api/v1/datalabel');

      const allDatalabels = response.data || {};

      // Persist each datalabel to Dexie and sync store
      for (const [key, options] of Object.entries(allDatalabels)) {
        await setDatalabel(key, options);
        setDatalabelSync(key, options);
      }

      return allDatalabels;
    },
    staleTime: STORE_STALE_TIMES.datalabel,
    gcTime: SESSION_STORE_CONFIG.gcTime,
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
    const response = await apiClient.get<{
      data: Record<string, DatalabelOption[]>;
    }>('/api/v1/datalabel');

    const allDatalabels = response.data || {};
    const { queryClient } = await import('../client');

    let count = 0;
    for (const [key, options] of Object.entries(allDatalabels)) {
      // Set in query cache
      queryClient.setQueryData(QUERY_KEYS.datalabel(key), options);

      // Set in sync store
      setDatalabelSync(key, options);

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

  if (key) {
    const normalizedKey = DEXIE_KEYS.datalabel(key);
    queryClient.removeQueries({ queryKey: QUERY_KEYS.datalabel(normalizedKey) });
    datalabelStore.delete(normalizedKey);
    await clearDatalabel(normalizedKey);
  } else {
    queryClient.removeQueries({ queryKey: ['datalabel'] });
    datalabelStore.clear();
    await clearDatalabel();
  }
}

// ============================================================================
// Sync Access (Re-export for convenience)
// ============================================================================

export { getDatalabelSync, setDatalabelSync } from '../stores';
