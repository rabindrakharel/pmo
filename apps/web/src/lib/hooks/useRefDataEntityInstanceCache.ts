/**
 * useRefDataEntityInstanceCache Hook (v8.3.2)
 *
 * Unified React Query cache for entity instance lookups.
 * Used by both:
 * - View mode: Resolving UUIDs to display names
 * - Edit mode: Populating entity reference dropdowns
 *
 * Architecture:
 * - Single cache per entity type: ['ref-data-entity-instance', entityCode]
 * - Structure: { uuid: name } for O(1) lookups
 * - Populated from:
 *   1. API response ref_data_entityInstance (upsert on fetch)
 *   2. On-demand fetch for dropdown population
 *   3. Optional bulk prefetch (login-time)
 *
 * Cache Strategy:
 * - 15-minute stale time (dropdown data changes infrequently)
 * - 30-minute gc time
 * - Upsert from API responses extends cache coverage
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
import type { RefData } from './useEntityQuery';

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
// Query Keys
// ============================================================================

export const refDataEntityInstanceKeys = {
  all: ['ref-data-entity-instance'] as const,
  byEntity: (entityCode: string) => ['ref-data-entity-instance', entityCode] as const,
};

// ============================================================================
// Cache Configuration
// ============================================================================

const REF_DATA_CACHE_CONFIG = {
  STALE_TIME: 15 * 60 * 1000,  // 15 minutes - dropdown data changes infrequently
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
 * // Inside useEntityInstanceList queryFn:
 * if (response.ref_data_entityInstance) {
 *   upsertRefDataEntityInstanceCache(queryClient, response.ref_data_entityInstance);
 * }
 */
export function upsertRefDataEntityInstanceCache(
  queryClient: QueryClient,
  refData: RefData
): void {
  if (!refData || typeof refData !== 'object') return;

  for (const [entityCode, lookups] of Object.entries(refData)) {
    if (!lookups || typeof lookups !== 'object') continue;

    const queryKey = refDataEntityInstanceKeys.byEntity(entityCode);

    queryClient.setQueryData<EntityInstanceLookup>(queryKey, (old) => {
      const merged = { ...old, ...lookups };
      console.log(
        `%c[REF_DATA_CACHE] 📥 Upserted ${Object.keys(lookups).length} entries for ${entityCode}`,
        'color: #be4bdb',
        { total: Object.keys(merged).length }
      );
      return merged;
    });
  }
}

/**
 * Get cached entity instance lookup for an entity type
 *
 * @example
 * const employeeCache = getRefDataEntityInstanceCache(queryClient, 'employee');
 * const name = employeeCache?.['uuid-123'];
 */
export function getRefDataEntityInstanceCache(
  queryClient: QueryClient,
  entityCode: string
): EntityInstanceLookup | undefined {
  return queryClient.getQueryData<EntityInstanceLookup>(
    refDataEntityInstanceKeys.byEntity(entityCode)
  );
}

/**
 * Resolve a single UUID to name using cache
 *
 * @example
 * const name = resolveFromCache(queryClient, 'employee', 'uuid-123');
 */
export function resolveFromCache(
  queryClient: QueryClient,
  entityCode: string,
  uuid: string | null | undefined
): string | undefined {
  if (!uuid) return undefined;
  const cache = getRefDataEntityInstanceCache(queryClient, entityCode);
  return cache?.[uuid];
}

/**
 * Prefetch entity instances for multiple entity types
 *
 * Use sparingly - prefer lazy loading. Good for:
 * - Entities frequently used in dropdowns (employee, project)
 * - After login when user will likely need these soon
 *
 * @example
 * // Prefetch common entities after login
 * await prefetchEntityInstances(queryClient, ['employee', 'project', 'client']);
 */
export async function prefetchEntityInstances(
  queryClient: QueryClient,
  entityCodes: string[],
  options: { limit?: number } = {}
): Promise<void> {
  const { limit = 500 } = options;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const token = localStorage.getItem('auth_token');

  if (!token) {
    console.warn('[REF_DATA_CACHE] No auth token, skipping prefetch');
    return;
  }

  console.log(
    `%c[REF_DATA_CACHE] 🔄 Prefetching entity instances for: ${entityCodes.join(', ')}`,
    'color: #ff6b6b'
  );

  const promises = entityCodes.map(async (entityCode) => {
    try {
      await queryClient.prefetchQuery({
        queryKey: refDataEntityInstanceKeys.byEntity(entityCode),
        queryFn: async () => {
          const response = await fetch(
            `${apiUrl}/api/v1/entity/${entityCode}/entity-instance?active_only=true&limit=${limit}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch ${entityCode} instances`);
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
            `%c[REF_DATA_CACHE] ✅ Prefetched ${Object.keys(lookup).length} ${entityCode} instances`,
            'color: #51cf66'
          );

          return lookup;
        },
        staleTime: REF_DATA_CACHE_CONFIG.STALE_TIME,
      });
    } catch (error) {
      console.error(`[REF_DATA_CACHE] Failed to prefetch ${entityCode}:`, error);
    }
  });

  await Promise.all(promises);
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to get entity instance options for dropdown population
 *
 * Fetches and caches entity instances for use in EntitySelect dropdowns.
 * Uses the unified ref-data-entity-instance cache.
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
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const query = useQuery<EntityInstanceLookup>({
    queryKey: refDataEntityInstanceKeys.byEntity(entityCode || ''),
    queryFn: async () => {
      if (!entityCode) {
        return {};
      }

      console.log(
        `%c[REF_DATA_CACHE] 🔄 Fetching entity instances: ${entityCode}`,
        'color: #ff6b6b'
      );

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token');
      }

      const response = await fetch(
        `${apiUrl}/api/v1/entity/${entityCode}/entity-instance?active_only=true&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${entityCode} entity instances`);
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
        `%c[REF_DATA_CACHE] ✅ Cached ${Object.keys(lookup).length} ${entityCode} instances`,
        'color: #51cf66'
      );

      return lookup;
    },
    enabled: enabled && !!entityCode,
    staleTime: REF_DATA_CACHE_CONFIG.STALE_TIME,
    gcTime: REF_DATA_CACHE_CONFIG.GC_TIME,
    refetchOnWindowFocus: false,
  });

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
 * Hook for resolving entity UUIDs to names using the unified cache
 *
 * Provides resolution utilities that use the ref-data-entity-instance cache.
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
      return resolveFromCache(queryClient, entityCode, uuid);
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
        .map((uuid) => resolveFromCache(queryClient, entityCode, uuid))
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
      const name = resolveFromCache(queryClient, entityCode, uuid);
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
   * Check if entity type has cached data
   */
  const hasCachedData = useCallback(
    (entityCode: string): boolean => {
      const cache = getRefDataEntityInstanceCache(queryClient, entityCode);
      return !!cache && Object.keys(cache).length > 0;
    },
    [queryClient]
  );

  /**
   * Get cache size for entity type
   */
  const getCacheSize = useCallback(
    (entityCode: string): number => {
      const cache = getRefDataEntityInstanceCache(queryClient, entityCode);
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
 * Returns a function that can be called to merge new ref_data into the cache.
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
        upsertRefDataEntityInstanceCache(queryClient, refData);
      }
    },
    [queryClient]
  );
}
