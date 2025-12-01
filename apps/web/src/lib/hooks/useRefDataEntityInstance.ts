/**
 * useRefDataEntityInstance Hook (v9.1.0)
 *
 * Unified React Query cache for ref_data_entityInstance lookups.
 * Used by both:
 * - View mode: Resolving UUIDs to display names
 * - Edit mode: Populating entity reference dropdowns
 *
 * Architecture:
 * - Single cache per entity type: ['ref_data_entityInstance', entityCode]
 * - Structure: { uuid: name } for O(1) lookups
 * - Populated from:
 *   1. API response ref_data_entityInstance (upsert on fetch)
 *   2. On-demand fetch for dropdown population
 *   3. Optional bulk prefetch (login-time)
 *
 * Cache Strategy:
 * - 5-minute stale time (dropdown data changes infrequently)
 * - 30-minute gc time
 * - Upsert from API responses extends cache coverage
 *
 * Naming Convention:
 * - API field: ref_data_entityInstance (snake_case prefix + camelCase)
 * - Type: RefData (PascalCase)
 * - Variable: refData (camelCase)
 * - Hooks: useRefDataEntityInstance* (camelCase)
 * - Cache key: ['ref_data_entityInstance', entityCode]
 *
 * @example
 * // Get dropdown options
 * const { options, isLoading } = useRefDataEntityInstanceOptions('employee');
 *
 * // Resolve UUID to name (from cache)
 * const { resolveName } = useRefDataEntityInstanceResolver();
 * const name = resolveName('employee', 'uuid-123');
 */

import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { RefData } from '@/db/tanstack-index';

// ============================================================================
// Types
// ============================================================================

export interface EntityInstanceLookup {
  [uuid: string]: string;  // uuid → name
}

export interface EntityInstanceOption {
  value: string;  // uuid
  label: string;  // name
}

// ============================================================================
// Query Keys - Uses ref_data_entityInstance naming
// ============================================================================

export const ref_data_entityInstanceKeys = {
  all: ['ref_data_entityInstance'] as const,
  byEntity: (entityCode: string) => ['ref_data_entityInstance', entityCode] as const,
};

// ============================================================================
// Cache Configuration
// ============================================================================

const REF_DATA_ENTITYINSTANCE_CONFIG = {
  STALE_TIME: 5 * 60 * 1000,   // 5 minutes - used by useQuery hook for background refetch timing
  GC_TIME: 30 * 60 * 1000,     // 30 minutes - keep for session navigation
} as const;

// ============================================================================
// Cache Utilities (for use outside React components)
// ============================================================================

/**
 * Upsert ref_data_entityInstance from API response into cache
 *
 * Call this inside queryFn after receiving API response with ref_data_entityInstance.
 * Merges new data with existing cache (doesn't replace).
 *
 * @example
 * // Inside useEntityInstanceData queryFn:
 * if (response.ref_data_entityInstance) {
 *   upsertRefDataEntityInstance(queryClient, response.ref_data_entityInstance);
 * }
 */
export function upsertRefDataEntityInstance(
  queryClient: QueryClient,
  refData: RefData
): void {
  if (!refData || typeof refData !== 'object') return;

  for (const [entityCode, lookups] of Object.entries(refData)) {
    if (!lookups || typeof lookups !== 'object') continue;

    const queryKey = ref_data_entityInstanceKeys.byEntity(entityCode);

    // Get current cache to log before/after
    const before = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
    const beforeCount = before ? Object.keys(before).length : 0;

    queryClient.setQueryData<EntityInstanceLookup>(queryKey, (old) => {
      // CRITICAL: Always merge with existing data, never replace
      const merged = { ...(old || {}), ...lookups };
      return merged;
    });

    // Get updated cache
    const after = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
    const afterCount = after ? Object.keys(after).length : 0;

    console.log(
      `%c[ref_data_entityInstance] 📥 Upserted ${Object.keys(lookups).length} entries for ${entityCode}`,
      'color: #be4bdb',
      { before: beforeCount, added: Object.keys(lookups).length, after: afterCount }
    );
  }
}

/**
 * Get cached ref_data_entityInstance lookup for an entity type
 *
 * @example
 * const employeeCache = getRefDataEntityInstance(queryClient, 'employee');
 * const name = employeeCache?.['uuid-123'];
 */
export function getRefDataEntityInstance(
  queryClient: QueryClient,
  entityCode: string
): EntityInstanceLookup | undefined {
  return queryClient.getQueryData<EntityInstanceLookup>(
    ref_data_entityInstanceKeys.byEntity(entityCode)
  );
}

/**
 * Resolve a single UUID to name using ref_data_entityInstance cache
 *
 * @example
 * const name = resolveFromRefDataEntityInstance(queryClient, 'employee', 'uuid-123');
 */
export function resolveFromRefDataEntityInstance(
  queryClient: QueryClient,
  entityCode: string,
  uuid: string | null | undefined
): string | undefined {
  if (!uuid) return undefined;
  const cache = getRefDataEntityInstance(queryClient, entityCode);
  return cache?.[uuid];
}

/**
 * Prefetch ref_data_entityInstance for multiple entity types
 *
 * Use sparingly - prefer lazy loading. Good for:
 * - Entities frequently used in dropdowns (employee, project)
 * - After login when user will likely need these soon
 *
 * @example
 * // Prefetch common entities after login
 * await prefetchRefDataEntityInstances(queryClient, ['employee', 'project', 'client']);
 */
export async function prefetchRefDataEntityInstances(
  queryClient: QueryClient,
  entityCodes: string[],
  options: { limit?: number } = {}
): Promise<void> {
  const { limit = 500 } = options;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('auth_token');

  if (!token) {
    console.warn('[ref_data_entityInstance] No auth token, skipping prefetch');
    return;
  }

  console.log(
    `%c[ref_data_entityInstance] 🔄 Prefetching for: ${entityCodes.join(', ')}`,
    'color: #ff6b6b'
  );

  const promises = entityCodes.map(async (entityCode) => {
    try {
      const queryKey = ref_data_entityInstanceKeys.byEntity(entityCode);
      console.log(
        `%c[ref_data_entityInstance] 📡 Starting prefetch for: ${entityCode}`,
        'color: #74c0fc',
        { queryKey }
      );

      // Fetch directly and use setQueryData to ALWAYS set the complete data
      const url = `${apiUrl}/api/v1/entity/${entityCode}/entity-instance?active_only=true&limit=${limit}`;
      console.log(`%c[ref_data_entityInstance] 🌐 Fetching: ${url}`, 'color: #74c0fc');

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        console.error(`[ref_data_entityInstance] ❌ HTTP ${response.status} for ${entityCode}`);
        throw new Error(`Failed to fetch ${entityCode} instances: HTTP ${response.status}`);
      }

      const data = await response.json();
      const items = data.data || data || [];

      // Transform to lookup format: { uuid: name }
      const lookup: EntityInstanceLookup = {};
      for (const item of items) {
        if (item.id && item.name) {
          lookup[item.id] = item.name;
        }
      }

      console.log(
        `%c[ref_data_entityInstance] ✅ Prefetched ${Object.keys(lookup).length} ${entityCode} instances`,
        'color: #51cf66',
        { entityCode, count: Object.keys(lookup).length, sampleKeys: Object.keys(lookup).slice(0, 3) }
      );

      // Use setQueryData with MERGE to handle race conditions
      queryClient.setQueryData<EntityInstanceLookup>(queryKey, (old) => {
        const merged = { ...(old || {}), ...lookup };
        console.log(
          `%c[ref_data_entityInstance] 🔀 Merged prefetch data for ${entityCode}`,
          'color: #51cf66',
          { oldCount: old ? Object.keys(old).length : 0, prefetchCount: Object.keys(lookup).length, mergedCount: Object.keys(merged).length }
        );
        return merged;
      });

      // Verify cache was populated
      const cachedData = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
      console.log(
        `%c[ref_data_entityInstance] 🔍 Cache verification for ${entityCode}:`,
        cachedData ? 'color: #51cf66' : 'color: #ff6b6b',
        {
          entityCode,
          queryKey,
          isCached: !!cachedData,
          cacheSize: cachedData ? Object.keys(cachedData).length : 0,
        }
      );
    } catch (error) {
      console.error(`[ref_data_entityInstance] ❌ Failed to prefetch ${entityCode}:`, error);
    }
  });

  await Promise.all(promises);

  // Final summary log
  console.log(
    `%c[ref_data_entityInstance] 📊 Prefetch complete. Cache summary:`,
    'color: #be4bdb; font-weight: bold'
  );
  entityCodes.forEach((entityCode) => {
    const queryKey = ref_data_entityInstanceKeys.byEntity(entityCode);
    const cachedData = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
    console.log(
      `  ${cachedData ? '✅' : '❌'} ${entityCode}: ${cachedData ? Object.keys(cachedData).length : 0} items`
    );
  });
}

/**
 * Debug utility - call from browser console to inspect cache state
 * Usage: window.__debugRefDataEntityInstance()
 */
if (typeof window !== 'undefined') {
  (window as any).__debugRefDataEntityInstance = () => {
    console.log('%c[ref_data_entityInstance DEBUG] Inspecting cache...', 'color: #be4bdb; font-weight: bold');
    const entityCodes = ['employee', 'project', 'business', 'office', 'role', 'cust', 'task', 'worksite'];
    entityCodes.forEach((entityCode) => {
      const queryKey = ref_data_entityInstanceKeys.byEntity(entityCode);
      console.log(`  Query key for ${entityCode}:`, queryKey);
    });
    console.log('To check cache, use React Query DevTools or call this in a component with useQueryClient()');
  };
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to get entity instance options for dropdown population
 *
 * Fetches and caches ref_data_entityInstance for use in EntityInstanceNameLookup dropdowns.
 * Uses the unified ref_data_entityInstance cache.
 *
 * @param entityCode - Entity type code (e.g., 'employee', 'project')
 * @param options - Query options
 * @returns Options array for Select component + loading state
 *
 * @example
 * const { options, isLoading } = useRefDataEntityInstanceOptions('employee');
 * // options = [{ value: 'uuid-1', label: 'James Miller' }, ...]
 */
export function useRefDataEntityInstanceOptions(
  entityCode: string | null,
  options: { enabled?: boolean; limit?: number } = {}
) {
  const { enabled = true, limit = 500 } = options;
  const queryClient = useQueryClient();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const queryKey = ref_data_entityInstanceKeys.byEntity(entityCode || '');

  // Debug: Check cache state before useQuery
  const existingCache = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
  const cacheSize = existingCache ? Object.keys(existingCache).length : 0;

  console.log(
    `%c[ref_data_entityInstance] 🔍 Hook called for: ${entityCode}`,
    'color: #845ef7',
    { queryKey, cacheExists: !!existingCache, cacheSize, enabled }
  );

  const query = useQuery<EntityInstanceLookup>({
    queryKey,
    queryFn: async () => {
      if (!entityCode) return {};

      // This only runs on cache MISS (TanStack Query handles cache-first)
      console.log(
        `%c[ref_data_entityInstance] ⚠️ queryFn executing (cache miss or stale): ${entityCode}`,
        'color: #ff6b6b; font-weight: bold'
      );

      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No auth token');

      const response = await fetch(
        `${apiUrl}/api/v1/entity/${entityCode}/entity-instance?active_only=true&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${entityCode} entity instances`);
      }

      const data = await response.json();
      const items = data.data || data || [];

      const lookup: EntityInstanceLookup = {};
      for (const item of items) {
        if (item.id && item.name) {
          lookup[item.id] = item.name;
        }
      }

      console.log(
        `%c[ref_data_entityInstance] ✅ API returned ${Object.keys(lookup).length} ${entityCode} instances`,
        'color: #51cf66'
      );

      return lookup;
    },
    enabled: enabled && !!entityCode,
    staleTime: REF_DATA_ENTITYINSTANCE_CONFIG.STALE_TIME,
    gcTime: REF_DATA_ENTITYINSTANCE_CONFIG.GC_TIME,
    refetchOnWindowFocus: false,
  });

  // Debug: Log what useQuery returned
  console.log(
    `%c[ref_data_entityInstance] 📊 useQuery result for: ${entityCode}`,
    query.data ? 'color: #51cf66' : 'color: #868e96',
    {
      hasData: !!query.data,
      dataSize: query.data ? Object.keys(query.data).length : 0,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isStale: query.isStale,
      fetchStatus: query.fetchStatus,
    }
  );

  // Transform lookup to options array for Select component
  const selectOptions = useMemo((): EntityInstanceOption[] => {
    if (!query.data) return [];

    return Object.entries(query.data)
      .map(([uuid, name]) => ({ value: uuid, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [query.data]);

  return {
    /** Options array for Select component: [{ value: uuid, label: name }] */
    options: selectOptions,
    /** Raw lookup object: { uuid: name } */
    lookup: query.data || {},
    /** Loading state */
    isLoading: query.isLoading,
    /** Error state */
    error: query.error,
    /** Refetch function */
    refetch: query.refetch,
    /** Is data stale? */
    isStale: query.isStale,
  };
}

/**
 * Hook for resolving entity UUIDs to names using the unified ref_data_entityInstance cache
 *
 * Provides resolution utilities that use the ref_data_entityInstance cache.
 * For view mode display of entity references.
 *
 * @example
 * const { resolveName, resolveNames } = useRefDataEntityInstanceResolver();
 *
 * // Single resolution
 * const managerName = resolveName('employee', project.manager__employee_id);
 *
 * // Array resolution
 * const stakeholderNames = resolveNames('employee', project.stakeholder__employee_ids);
 */
export function useRefDataEntityInstanceResolver() {
  const queryClient = useQueryClient();

  /**
   * Resolve single UUID to name
   */
  const resolveName = useCallback(
    (entityCode: string, uuid: string | null | undefined): string | undefined => {
      return resolveFromRefDataEntityInstance(queryClient, entityCode, uuid);
    },
    [queryClient]
  );

  /**
   * Resolve array of UUIDs to names
   */
  const resolveNames = useCallback(
    (entityCode: string, uuids: string[] | null | undefined): string[] => {
      if (!uuids || !Array.isArray(uuids)) return [];
      return uuids
        .map((uuid) => resolveFromRefDataEntityInstance(queryClient, entityCode, uuid))
        .filter((name): name is string => !!name);
    },
    [queryClient]
  );

  /**
   * Resolve UUID to name with fallback
   */
  const resolveNameWithFallback = useCallback(
    (
      entityCode: string,
      uuid: string | null | undefined,
      fallback: 'uuid' | 'empty' | 'unknown' = 'uuid'
    ): string => {
      const name = resolveFromRefDataEntityInstance(queryClient, entityCode, uuid);
      if (name) return name;

      switch (fallback) {
        case 'uuid':
          return uuid || '';
        case 'empty':
          return '';
        case 'unknown':
          return 'Unknown';
        default:
          return uuid || '';
      }
    },
    [queryClient]
  );

  /**
   * Check if entity type has cached ref_data_entityInstance
   */
  const hasCachedData = useCallback(
    (entityCode: string): boolean => {
      const cache = getRefDataEntityInstance(queryClient, entityCode);
      return !!cache && Object.keys(cache).length > 0;
    },
    [queryClient]
  );

  /**
   * Get cache size for entity type
   */
  const getCacheSize = useCallback(
    (entityCode: string): number => {
      const cache = getRefDataEntityInstance(queryClient, entityCode);
      return cache ? Object.keys(cache).length : 0;
    },
    [queryClient]
  );

  return {
    resolveName,
    resolveNames,
    resolveNameWithFallback,
    hasCachedData,
    getCacheSize,
  };
}

/**
 * Hook to upsert ref_data_entityInstance from API responses
 *
 * Returns a function that can be called to merge new ref_data_entityInstance into the cache.
 * Use this in components that receive ref_data_entityInstance from API.
 *
 * @example
 * const upsertRefData = useRefDataEntityInstanceUpsert();
 *
 * // After receiving API response
 * useEffect(() => {
 *   if (queryResult?.ref_data_entityInstance) {
 *     upsertRefData(queryResult.ref_data_entityInstance);
 *   }
 * }, [queryResult?.ref_data_entityInstance, upsertRefData]);
 */
export function useRefDataEntityInstanceUpsert() {
  const queryClient = useQueryClient();

  return useCallback(
    (refData: RefData | undefined) => {
      if (refData) {
        upsertRefDataEntityInstance(queryClient, refData);
      }
    },
    [queryClient]
  );
}

