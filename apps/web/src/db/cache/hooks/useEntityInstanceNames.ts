// ============================================================================
// useEntityInstanceNames Hook
// ============================================================================
// Hook for accessing cached entity instance names
// Session-level store - populated from ref_data_entityInstance
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { QUERY_KEYS } from '../keys';
import { SESSION_STORE_CONFIG } from '../constants';
import { entityInstanceNamesStore } from '../stores';
import {
  getEntityInstanceNamesForType,
  bulkSetEntityInstanceNames,
} from '../../persistence/operations';

// ============================================================================
// Types
// ============================================================================

export interface UseEntityInstanceNamesResult {
  /** Map of entityInstanceId → name */
  names: Record<string, string>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Get name for a specific instance */
  getName: (entityInstanceId: string) => string | undefined;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for accessing entity instance names
 *
 * STORE: entityInstanceNames
 * LAYER: Session-level (populated from API responses)
 * PERSISTENCE: Dexie IndexedDB
 *
 * This store is populated from ref_data_entityInstance in API responses.
 * It's not prefetched directly, but accumulated as entities are loaded.
 *
 * @param entityCode - The entity type to get names for
 */
export function useEntityInstanceNames(entityCode: string): UseEntityInstanceNamesResult {
  const query = useQuery({
    queryKey: QUERY_KEYS.entityInstanceNames(entityCode),
    queryFn: async () => {
      // First try sync store (populated from API responses)
      const syncNames = entityInstanceNamesStore.getNames(entityCode);
      if (Object.keys(syncNames).length > 0) {
        return syncNames;
      }

      // Then try Dexie
      const dexieNames = await getEntityInstanceNamesForType(entityCode);
      if (Object.keys(dexieNames).length > 0) {
        // Update sync store
        entityInstanceNamesStore.merge(entityCode, dexieNames);
        return dexieNames;
      }

      // Return empty - will be populated when entities are fetched
      return {};
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,
    gcTime: SESSION_STORE_CONFIG.gcTime,
    placeholderData: {},
  });

  // Update sync store when data changes
  useMemo(() => {
    if (query.data && Object.keys(query.data).length > 0) {
      entityInstanceNamesStore.merge(entityCode, query.data);
    }
  }, [entityCode, query.data]);

  const getName = useCallback(
    (entityInstanceId: string): string | undefined => {
      return query.data?.[entityInstanceId];
    },
    [query.data]
  );

  return {
    names: query.data ?? {},
    isLoading: query.isLoading,
    isError: query.isError,
    getName,
  };
}

// ============================================================================
// Merge Function (for API responses)
// ============================================================================

/**
 * Merge entity instance names from ref_data_entityInstance
 * Called when API responses include reference data
 */
export async function mergeEntityInstanceNames(
  data: Record<string, Record<string, string>>
): Promise<void> {
  const { queryClient } = await import('../client');

  for (const [entityCode, names] of Object.entries(data)) {
    // Update sync store
    entityInstanceNamesStore.merge(entityCode, names);

    // Persist to Dexie
    await bulkSetEntityInstanceNames(entityCode, names);

    // Update TanStack Query cache
    queryClient.setQueryData(
      QUERY_KEYS.entityInstanceNames(entityCode),
      (old: Record<string, string> | undefined) => ({
        ...(old ?? {}),
        ...names,
      })
    );
  }
}

// ============================================================================
// Clear Function
// ============================================================================

/**
 * Clear entity instance names cache
 */
export async function clearEntityInstanceNamesCache(
  entityCode?: string
): Promise<void> {
  const { queryClient } = await import('../client');
  const { clearEntityInstanceNames: clearDexie } = await import(
    '../../persistence/operations'
  );

  if (entityCode) {
    queryClient.removeQueries({
      queryKey: QUERY_KEYS.entityInstanceNames(entityCode),
    });
    entityInstanceNamesStore.clearByCode(entityCode);
    await clearDexie(entityCode);
  } else {
    queryClient.removeQueries({ queryKey: ['entityInstanceNames'] });
    entityInstanceNamesStore.clearAll();
    await clearDexie();
  }
}
