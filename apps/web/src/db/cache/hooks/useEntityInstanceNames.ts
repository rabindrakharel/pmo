// ============================================================================
// useEntityInstanceNames Hook
// ============================================================================
// Hook for accessing cached entity instance names
// Session-level store - populated from ref_data_entityInstance
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { QUERY_KEYS } from '../keys';
import { SESSION_STORE_CONFIG } from '../constants';
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
      // v11.0.0: TanStack Query cache is the source of truth
      // First check Dexie for persisted data
      const dexieNames = await getEntityInstanceNamesForType(entityCode);
      if (Object.keys(dexieNames).length > 0) {
        return dexieNames;
      }

      // Return empty - will be populated when entities are fetched
      return {};
    },
    staleTime: SESSION_STORE_CONFIG.staleTime,
    gcTime: SESSION_STORE_CONFIG.gcTime,
    placeholderData: {},
  });

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
    // v11.0.0: Only update TanStack Query cache and Dexie (no sync store)
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

  // v11.0.0: Only clear TanStack Query cache and Dexie (no sync store)
  if (entityCode) {
    queryClient.removeQueries({
      queryKey: QUERY_KEYS.entityInstanceNames(entityCode),
    });
    await clearDexie(entityCode);
  } else {
    queryClient.removeQueries({ queryKey: ['entityInstanceNames'] });
    await clearDexie();
  }
}
