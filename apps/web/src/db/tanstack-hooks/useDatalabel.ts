// ============================================================================
// useDatalabel Hook
// ============================================================================
// Fetches datalabel options with TanStack Query + Dexie persistence
// Includes sync cache for non-hook access
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { db, createDatalabelKey, type DatalabelOption } from '../dexie/database';
import { apiClient } from '../../lib/api';

// ============================================================================
// Types
// ============================================================================

export type { DatalabelOption };

export interface UseDatalabelResult {
  /** Array of datalabel options */
  options: DatalabelOption[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Get option by ID */
  getOption: (id: number) => DatalabelOption | undefined;
  /** Get label by ID */
  getLabel: (id: number) => string;
  /** Get color by ID */
  getColor: (id: number) => string | undefined;
  /** Manual refetch */
  refetch: () => Promise<void>;
}

// ============================================================================
// Sync Cache (for non-hook access)
// ============================================================================

const datalabelSyncCache = new Map<string, DatalabelOption[]>();

/**
 * Get datalabel options synchronously from in-memory cache
 * Used by formatters and other non-hook functions
 *
 * @param key - Datalabel key (with or without 'dl__' prefix)
 * @returns Array of options or null if not cached
 *
 * @example
 * const stages = getDatalabelSync('project_stage');
 * const stages = getDatalabelSync('dl__project_stage'); // Same result
 */
export function getDatalabelSync(key: string): DatalabelOption[] | null {
  const normalizedKey = createDatalabelKey(key);
  return datalabelSyncCache.get(normalizedKey) ?? null;
}

/**
 * Set datalabel options in sync cache
 * Called internally when data is fetched
 */
export function setDatalabelSync(key: string, options: DatalabelOption[]): void {
  const normalizedKey = createDatalabelKey(key);
  datalabelSyncCache.set(normalizedKey, options);
}

/**
 * Clear all datalabel sync cache
 * Called on logout
 */
export function clearDatalabelCache(): void {
  datalabelSyncCache.clear();
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching datalabel options
 *
 * TanStack Query Key: ['datalabel', key]
 * Dexie Table: datalabel
 *
 * @param datalabelKey - Key like 'project_stage' or 'dl__project_stage'
 *
 * @example
 * const { options, getLabel, isLoading } = useDatalabel('project_stage');
 * const stageName = getLabel(stageId);
 */
export function useDatalabel(datalabelKey: string | null): UseDatalabelResult {
  // Normalize key (remove dl__ prefix)
  const normalizedKey = useMemo(() => {
    if (!datalabelKey) return null;
    return createDatalabelKey(datalabelKey);
  }, [datalabelKey]);

  const query = useQuery<DatalabelOption[], Error>({
    queryKey: ['datalabel', normalizedKey],
    queryFn: async () => {
      if (!normalizedKey) return [];

      // Fetch from API
      const response = await apiClient.get(`/api/v1/datalabel?name=${normalizedKey}`);
      const options = response.data?.data || response.data || [];

      // Persist to Dexie datalabel table
      await db.datalabel.put({
        _id: normalizedKey,
        key: normalizedKey,
        options,
        syncedAt: Date.now(),
      });

      // Update sync cache
      setDatalabelSync(normalizedKey, options);

      return options;
    },
    enabled: !!normalizedKey,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Helper functions
  const getOption = useCallback(
    (id: number): DatalabelOption | undefined => {
      return query.data?.find((o) => o.id === id);
    },
    [query.data]
  );

  const getLabel = useCallback(
    (id: number): string => {
      const option = query.data?.find((o) => o.id === id);
      return option?.name ?? String(id);
    },
    [query.data]
  );

  const getColor = useCallback(
    (id: number): string | undefined => {
      const option = query.data?.find((o) => o.id === id);
      return option?.color_code;
    },
    [query.data]
  );

  return {
    options: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    getOption,
    getLabel,
    getColor,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// Prefetch All Datalabels
// ============================================================================

/**
 * Prefetch all datalabels from server
 * Called at login to populate cache
 */
export async function prefetchAllDatalabels(): Promise<number> {
  try {
    const response = await apiClient.get('/api/v1/datalabel/all');
    const datalabelList = response.data?.data || [];
    const now = Date.now();

    for (const dl of datalabelList) {
      const key = dl.name;
      const options = dl.options || [];

      // Persist to Dexie datalabel table
      await db.datalabel.put({
        _id: key,
        key,
        options,
        syncedAt: now,
      });

      // Update sync cache
      setDatalabelSync(key, options);
    }

    console.log(
      `%c[Datalabel] Prefetched ${datalabelList.length} datalabels`,
      'color: #51cf66; font-weight: bold'
    );

    return datalabelList.length;
  } catch (error) {
    console.error('[Datalabel] Prefetch failed:', error);

    // Fallback: Load from Dexie cache
    const cached = await db.datalabel.toArray();

    for (const item of cached) {
      setDatalabelSync(item.key, item.options);
    }

    return cached.length;
  }
}

// ============================================================================
// All Datalabels Hook
// ============================================================================

export interface UseAllDatalabelsResult {
  /** Map of key -> options */
  datalabels: Record<string, DatalabelOption[]>;
  /** Loading state */
  isLoading: boolean;
  /** Get datalabel by key */
  getDatalabel: (key: string) => DatalabelOption[] | null;
  /** Manual refetch */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching all datalabels at once
 *
 * @example
 * const { getDatalabel, isLoading } = useAllDatalabels();
 * const stages = getDatalabel('project_stage');
 */
export function useAllDatalabels(): UseAllDatalabelsResult {
  const query = useQuery<Record<string, DatalabelOption[]>, Error>({
    queryKey: ['datalabel', 'all'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/datalabel/all');
      const datalabelList = response.data?.data || [];
      const now = Date.now();

      const result: Record<string, DatalabelOption[]> = {};

      for (const dl of datalabelList) {
        const key = dl.name;
        const options = dl.options || [];
        result[key] = options;

        // Persist to Dexie datalabel table
        await db.datalabel.put({
          _id: key,
          key,
          options,
          syncedAt: now,
        });

        // Update sync cache
        setDatalabelSync(key, options);
      }

      return result;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const getDatalabel = useCallback(
    (key: string): DatalabelOption[] | null => {
      const normalizedKey = createDatalabelKey(key);
      return query.data?.[normalizedKey] ?? null;
    },
    [query.data]
  );

  return {
    datalabels: query.data ?? {},
    isLoading: query.isLoading,
    getDatalabel,
    refetch: async () => {
      await query.refetch();
    },
  };
}
