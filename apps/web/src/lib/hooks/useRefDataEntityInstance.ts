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
// v11.0.0: Dexie persistence only (no sync store)
import { persistToEntityInstanceNames } from '@/db/persistence/hydrate';

// ============================================================================
// DEBUG LOGGING - Set to true for ref_data_entityInstance cache diagnostics
// ============================================================================
const DEBUG_REF_DATA = false;

const debugRefData = (message: string, data?: Record<string, unknown>) => {
  if (DEBUG_REF_DATA) {
    console.log(`%c[ref_data_entityInstance] ${message}`, 'color: #be4bdb; font-weight: bold', data || '');
  }
};

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
// v11.0.0: Uses unified key ['entityInstanceNames', entityCode] for consistency
// with getEntityInstanceNameSync() in stores.ts
// ============================================================================

// NOTE: All functions now use inline key ['entityInstanceNames', entityCode]
// to match QUERY_KEYS.entityInstanceNames(entityCode) from keys.ts

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

    // v11.0.0: Use QUERY_KEYS.entityInstanceNames for consistency with getEntityInstanceNameSync
    // Both read and write paths now use the same key: ['entityInstanceNames', entityCode]
    const queryKey = ['entityInstanceNames', entityCode] as const;

    // Get current cache to log before/after
    const before = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
    const beforeCount = before ? Object.keys(before).length : 0;

    queryClient.setQueryData<EntityInstanceLookup>(queryKey, (old) => {
      // CRITICAL: Always merge with existing data, never replace
      const merged = { ...(old || {}), ...lookups };
      return merged;
    });

    // v11.0.0: Sync store removed - TanStack Query cache is the single source of truth

    // Get updated cache
    const after = queryClient.getQueryData<EntityInstanceLookup>(queryKey);
    const afterCount = after ? Object.keys(after).length : 0;

    debugRefData(`📥 Upserted ${Object.keys(lookups).length} entries for ${entityCode}`, {
      before: beforeCount,
      added: Object.keys(lookups).length,
      after: afterCount,
    });
  }
}

/**
 * Get cached ref_data_entityInstance lookup for an entity type
 *
 * v11.0.0: Uses unified key ['entityInstanceNames', entityCode] for consistency
 *
 * @example
 * const employeeCache = getRefDataEntityInstance(queryClient, 'employee');
 * const name = employeeCache?.['uuid-123'];
 */
export function getRefDataEntityInstance(
  queryClient: QueryClient,
  entityCode: string
): EntityInstanceLookup | undefined {
  // v11.0.0: Use unified key for consistency with getEntityInstanceNameSync
  return queryClient.getQueryData<EntityInstanceLookup>(
    ['entityInstanceNames', entityCode] as const
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
    debugRefData('⚠️ No auth token, skipping prefetch');
    return;
  }

  debugRefData(`🔄 Prefetching for: ${entityCodes.join(', ')}`);

  const promises = entityCodes.map(async (entityCode) => {
    try {
      // v11.0.0: Use unified key for consistency with getEntityInstanceNameSync
      const queryKey = ['entityInstanceNames', entityCode] as const;
      debugRefData(`📡 Starting prefetch for: ${entityCode}`, { queryKey });

      // Fetch directly and use setQueryData to ALWAYS set the complete data
      const url = `${apiUrl}/api/v1/entity/${entityCode}/entity-instance?active_only=true&limit=${limit}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
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

      debugRefData(`✅ Prefetched ${Object.keys(lookup).length} ${entityCode} instances`, {
        entityCode,
        count: Object.keys(lookup).length,
      });

      // Use setQueryData with MERGE to handle race conditions
      queryClient.setQueryData<EntityInstanceLookup>(queryKey, (old) => {
        const merged = { ...(old || {}), ...lookup };
        return merged;
      });

      // v11.0.0: Persist to Dexie (TanStack Query cache is the primary source)
      await persistToEntityInstanceNames(entityCode, lookup);
      debugRefData(`✅ TanStack Query + Dexie populated for ${entityCode}`, {
        entityCode,
        count: Object.keys(lookup).length,
      });
    } catch (error) {
      debugRefData(`❌ Failed to prefetch ${entityCode}`, { error: String(error) });
    }
  });

  await Promise.all(promises);

  debugRefData('📊 Prefetch complete');
}

/**
 * Debug utility - call from browser console to inspect cache state
 * Usage: window.__debugRefDataEntityInstance()
 */
if (typeof window !== 'undefined') {
  (window as any).__debugRefDataEntityInstance = () => {
    console.log('%c[ref_data_entityInstance DEBUG] Inspecting cache...', 'color: #be4bdb; font-weight: bold');
    const entityCodes = ['employee', 'project', 'business', 'office', 'role', 'customer', 'task', 'worksite'];
    entityCodes.forEach((entityCode) => {
      // v11.0.0: Use unified key for consistency
      const queryKey = ['entityInstanceNames', entityCode] as const;
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
 * Fetches and caches ref_data_entityInstance for use in EntityInstanceNameSelect dropdowns.
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

  // v11.0.0: Use unified key for consistency with getEntityInstanceNameSync
  const queryKey = ['entityInstanceNames', entityCode || ''] as const;

  const query = useQuery<EntityInstanceLookup>({
    queryKey,
    queryFn: async () => {
      if (!entityCode) return {};

      debugRefData(`⚠️ queryFn executing (cache miss or stale): ${entityCode}`);

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

      debugRefData(`✅ API returned ${Object.keys(lookup).length} ${entityCode} instances`);

      return lookup;
    },
    enabled: enabled && !!entityCode,
    staleTime: REF_DATA_ENTITYINSTANCE_CONFIG.STALE_TIME,
    gcTime: REF_DATA_ENTITYINSTANCE_CONFIG.GC_TIME,
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

