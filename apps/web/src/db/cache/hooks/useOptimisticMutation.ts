// ============================================================================
// useOptimisticMutation Hook (v11.3.1)
// ============================================================================
// Industry-standard optimistic update pattern for TanStack Query + Dexie
//
// DESIGN PATTERN:
// 1. IMMEDIATE: Update ALL TanStack Query list caches for entity → UI updates instantly
// 2. IMMEDIATE: Update Dexie (IndexedDB) in parallel → Persists across page refresh
// 3. BACKGROUND: Send API request
//    - Success: Cache already correct, optionally refetch to sync server state
//    - Failure: Direct rollback using captured previous state (no network required)
//
// v11.3.1 CHANGES:
// - FIX: Skip refetch entirely for inline add row (existingTempId) to prevent race condition
// - Previously: 500ms delay still caused refetch that could return stale data
// - Now: No refetch at all - API response already has the data, it's in the cache
//
// v11.3.0 CHANGES:
// - Added `existingTempId` option to createEntity() for inline add row pattern
// - When existingTempId provided: skips temp row creation in onMutate (row already in cache)
// - On success: replaces existing temp row with real server data
// - On error: removes temp row from cache (rollback)
// - Enables single source of truth: cache is THE data store, no local state copying
//
// v11.2.0 CHANGES:
// - CRITICAL FIX: Direct rollback using previousListData instead of invalidateQueries()
// - Rollback now works even when API server is unavailable (offline-safe)
// - Dexie restored from previousListData on error instead of just clearing
// - All mutations (update/create/delete) now use direct rollback pattern
//
// v9.5.2 CHANGES:
// - Now updates BOTH TanStack Query AND Dexie optimistically (dual-cache write)
// - Dexie update runs in parallel with TanStack update for zero latency
// - On error, both caches are invalidated/cleared for consistency
//
// v9.5.1 CHANGES:
// - Now updates ALL matching list caches for an entity code (not just one specific query)
// - Simplified rollback: invalidate queries instead of tracking all previous states
// - Works regardless of which page (list or detail) initiates the mutation
//
// BENEFITS:
// - Instant UI feedback (no waiting for API)
// - Offline-resilient: Dexie persists optimistic state across page refresh
// - Graceful error handling with automatic rollback (no network required)
// - Works for both list views (DataTable) and detail views (EntitySpecificInstancePage)
// ============================================================================

import { useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '../keys';
import {
  setEntityInstance,
  clearEntityInstanceData,
  updateEntityInstanceDataItem,
  deleteEntityInstanceDataItem,
  addEntityInstanceDataItem,
  replaceEntityInstanceDataItem,
} from '../../persistence/operations';

// ============================================================================
// DEBUG LOGGING - Cache Layer Diagnostics
// ============================================================================
// Set to true to enable detailed cache debugging
const DEBUG_CACHE = false;  // v11.3.1: Toggle for inline add row debugging

const debugCache = (message: string, data?: Record<string, unknown>) => {
  if (DEBUG_CACHE) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(
      `%c[${timestamp}] [OPTIMISTIC] ${message}`,
      'color: #f59e0b; font-weight: bold',
      data || ''
    );
  }
};

// ============================================================================
// Types
// ============================================================================

/** Cache data structure for list queries */
interface ListCacheData<T> {
  data: T[];
  total: number;
  metadata?: unknown;
  refData?: Record<string, Record<string, string>>;
}

export interface OptimisticMutationContext<T = Record<string, unknown>> {
  /**
   * v11.2.0: Map of ALL previous list cache states for rollback
   * Key: JSON.stringify(queryKey), Value: previous cache data
   * This allows restoring each query to its own previous state
   */
  allPreviousListData?: Map<string, ListCacheData<T>>;
  /** Previous data for rollback (detail view) */
  previousEntityData?: T;
  /** Query params used for list query (for cache key) */
  queryParams?: Record<string, unknown>;
  /** Entity ID being mutated */
  entityId?: string;
  /** Mutation type */
  mutationType: 'create' | 'update' | 'delete';
  /** v11.3.0: Existing temp ID when row was pre-added to cache (inline add row pattern) */
  existingTempId?: string;
}

export interface UseOptimisticMutationOptions {
  /** Called on successful mutation */
  onSuccess?: (data: unknown, variables: unknown) => void | Promise<void>;
  /** Called on error (after rollback) */
  onError?: (error: Error, variables: unknown) => void;
  /** Whether to refetch after mutation (default: false - optimistic is sufficient) */
  refetchOnSuccess?: boolean;
  /** Query params for list cache invalidation */
  listQueryParams?: Record<string, unknown>;
}

/** v11.3.0: Options for createEntity */
export interface CreateEntityOptions {
  /**
   * v11.3.0: Existing temp ID when row was pre-added to cache
   * Used by inline add row pattern - skips onMutate temp row creation
   */
  existingTempId?: string;
}

export interface UseOptimisticMutationResult<T = Record<string, unknown>> {
  /** Optimistically update an existing entity */
  updateEntity: (entityId: string, changes: Partial<T>) => Promise<T>;
  /** Optimistically create a new entity (v11.3.0: supports existingTempId for inline add) */
  createEntity: (data: Partial<T>, options?: CreateEntityOptions) => Promise<T>;
  /** Optimistically delete an entity */
  deleteEntity: (entityId: string) => Promise<void>;
  /** Mutation in progress */
  isPending: boolean;
  /** Last error */
  error: Error | null;
  /** Reset error state */
  reset: () => void;
}

// ============================================================================
// Cache Update Utilities
// ============================================================================

/**
 * v11.2.0: Update entity in ALL matching list caches (TanStack Query)
 * Returns a Map of ALL previous states for complete rollback capability
 *
 * @returns Map<queryKeyString, previousData> for rollback
 */
function updateAllListCaches<T extends { id: string }>(
  queryClient: QueryClient,
  entityCode: string,
  updater: (data: T[]) => T[]
): Map<string, ListCacheData<T>> {
  // Get all cached queries matching this entity code
  const queryCache = queryClient.getQueryCache();
  const matchingQueries = queryCache.findAll({
    queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
  });

  debugCache(`🔍 TanStack Query: Found ${matchingQueries.length} cached queries for "${entityCode}"`, {
    entityCode,
    queriesFound: matchingQueries.length,
    queryKeys: matchingQueries.map(q => JSON.stringify(q.queryKey)),
  });

  // v11.2.0: Capture ALL previous states for complete rollback
  const allPreviousData = new Map<string, ListCacheData<T>>();

  // Update each matching list cache
  for (const query of matchingQueries) {
    const previousData = query.state.data as ListCacheData<T> | undefined;

    if (previousData?.data) {
      // v11.2.0: Save EACH query's previous state (not just the first one)
      allPreviousData.set(JSON.stringify(query.queryKey), { ...previousData });

      const updatedData = updater(previousData.data);
      queryClient.setQueryData(query.queryKey, {
        ...previousData,
        data: updatedData,
      });

      debugCache(`✅ TanStack Query: Updated cache`, {
        queryKey: JSON.stringify(query.queryKey),
        previousCount: previousData.data.length,
        updatedCount: updatedData.length,
        hasRefData: !!previousData.refData,
        refDataEntityCodes: previousData.refData ? Object.keys(previousData.refData) : [],
      });
    }
  }

  return allPreviousData;
}

/**
 * v11.2.0: Rollback ALL list caches to their previous states (no network required)
 * This is the TanStack Query official pattern for optimistic update rollback
 *
 * @param allPreviousData Map of queryKeyString -> previousData from onMutate context
 */
function rollbackAllListCaches<T>(
  queryClient: QueryClient,
  allPreviousData: Map<string, ListCacheData<T>>
): void {
  debugCache(`🔄 rollbackAllListCaches: Restoring ${allPreviousData.size} cached queries`);

  for (const [queryKeyString, previousData] of allPreviousData) {
    const queryKey = JSON.parse(queryKeyString);
    queryClient.setQueryData(queryKey, previousData);
    debugCache(`✅ Restored cache`, {
      queryKey: queryKeyString,
      dataCount: previousData.data.length,
    });
  }
}

/**
 * Update entity in detail cache (TanStack Query)
 */
function updateDetailCache<T>(
  queryClient: QueryClient,
  entityCode: string,
  entityId: string,
  updater: (data: T | undefined) => T | undefined
): T | undefined {
  const queryKey = QUERY_KEYS.entityInstance(entityCode, entityId);
  const previousData = queryClient.getQueryData<{ data: T }>(queryKey);

  if (previousData) {
    const updatedData = updater(previousData.data);
    if (updatedData) {
      queryClient.setQueryData(queryKey, {
        ...previousData,
        data: updatedData,
      });
    }
  }

  return previousData?.data;
}

/**
 * Rollback detail cache to previous state
 */
function rollbackDetailCache<T>(
  queryClient: QueryClient,
  entityCode: string,
  entityId: string,
  previousData: T
): void {
  const queryKey = QUERY_KEYS.entityInstance(entityCode, entityId);
  queryClient.setQueryData(queryKey, (old: any) => ({
    ...old,
    data: previousData,
  }));
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for optimistic entity mutations (create, update, delete)
 *
 * Implements industry-standard optimistic update pattern:
 * - Immediate UI update via TanStack Query cache
 * - Immediate Dexie persistence
 * - Background API call with automatic rollback on error
 *
 * @example
 * // In EntityListOfInstancesPage
 * const { updateEntity, deleteEntity, isPending } = useOptimisticMutation('project', {
 *   listQueryParams: { limit: 20000, offset: 0 },
 *   onError: (err) => toast.error(err.message),
 * });
 *
 * // Optimistic update - UI updates immediately
 * await updateEntity(id, { budget_allocated_amt: 200002 });
 *
 * @example
 * // In EntitySpecificInstancePage
 * const { updateEntity } = useOptimisticMutation('project');
 * await updateEntity(id, { name: 'New Project Name' });
 */
export function useOptimisticMutation<T extends { id: string } = { id: string } & Record<string, unknown>>(
  entityCode: string,
  options: UseOptimisticMutationOptions = {}
): UseOptimisticMutationResult<T> {
  const queryClient = useQueryClient();
  const { onSuccess, onError, refetchOnSuccess = false, listQueryParams = {} } = options;

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE MUTATION
  // ──────────────────────────────────────────────────────────────────────────

  const updateMutation = useMutation<
    T,
    Error,
    { entityId: string; changes: Partial<T> },
    OptimisticMutationContext<T>
  >({
    mutationFn: async ({ entityId, changes }) => {
      debugCache(`📡 API: Sending PATCH request`, {
        entityCode,
        entityId,
        changes,
      });
      const response = await apiClient.patch(`/api/v1/${entityCode}/${entityId}`, changes);
      debugCache(`📡 API: PATCH response received`, {
        entityCode,
        entityId,
        responseData: response.data?.data || response.data,
      });
      return response.data?.data || response.data;
    },

    // STEP 1: Optimistic update BEFORE API call
    onMutate: async ({ entityId, changes }) => {
      debugCache(`🚀 onMutate: Starting optimistic update`, {
        entityCode,
        entityId,
        changes,
      });

      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.entityInstance(entityCode, entityId),
      });
      debugCache(`⏸️ onMutate: Cancelled outgoing queries`);

      // v11.2.0: Snapshot ALL previous list data for complete rollback capability
      debugCache(`📝 onMutate: Updating TanStack Query in-memory caches...`);
      const allPreviousListData = updateAllListCaches<T>(
        queryClient,
        entityCode,
        (data) => data.map((item) => (item.id === entityId ? { ...item, ...changes } : item))
      );
      debugCache(`📝 onMutate: Captured ${allPreviousListData.size} query states for rollback`);

      // Snapshot previous detail data for potential rollback
      const previousEntityData = updateDetailCache<T>(
        queryClient,
        entityCode,
        entityId,
        (data) => (data ? { ...data, ...changes } : undefined)
      );
      debugCache(`📝 onMutate: Detail cache updated`, {
        hadPreviousData: !!previousEntityData,
      });

      // v9.5.2: Update Dexie (IndexedDB) in parallel - keeps persistent cache in sync
      debugCache(`💾 onMutate: Updating Dexie (IndexedDB) cache for "${entityCode}"...`);
      updateEntityInstanceDataItem<T>(entityCode, entityId, (item) => ({ ...item, ...changes }))
        .then((count) => debugCache(`✅ onMutate: Dexie cache updated`, { entriesUpdated: count }))
        .catch((err) => {
          debugCache(`❌ onMutate: Failed to update Dexie cache - clearing instead`, { error: String(err) });
          // Fallback: clear cache if update fails (will repopulate on next fetch)
          clearEntityInstanceData(entityCode).catch(() => {});
        });

      debugCache(`✅ onMutate: Optimistic update complete - UI should update NOW`);

      // Return context for rollback (v11.2.0: includes ALL query states)
      return {
        allPreviousListData,
        previousEntityData,
        entityId,
        mutationType: 'update',
      };
    },

    // STEP 2: On error, rollback to previous state (v11.2.0: direct rollback, no network required)
    onError: (error, { entityId }, context) => {
      debugCache(`❌ onError: API call failed - triggering direct rollback`, {
        entityCode,
        entityId,
        error: error.message,
      });

      // v11.2.0: Direct rollback using captured previous states (NO network required)
      // This follows TanStack Query official pattern for optimistic updates
      if (context?.allPreviousListData && context.allPreviousListData.size > 0) {
        rollbackAllListCaches(queryClient, context.allPreviousListData);
        debugCache(`🔄 onError: Rolled back ${context.allPreviousListData.size} list caches to previous state`);
      }

      if (context?.previousEntityData) {
        rollbackDetailCache(queryClient, entityCode, entityId, context.previousEntityData);
        debugCache(`🔄 onError: Rolled back detail cache to previous state`);
      }

      // v11.2.0: Clear Dexie on error to ensure consistency
      // (Dexie will repopulate from TanStack Query cache or next API call)
      clearEntityInstanceData(entityCode)
        .then(() => debugCache(`🔄 onError: Cleared Dexie cache for consistency`))
        .catch(() => {});

      onError?.(error, { entityId });
    },

    // STEP 3: On success, optionally refetch
    onSettled: async (data, error, variables) => {
      if (!error && data) {
        debugCache(`🎉 onSettled: Mutation SUCCESS`, {
          entityCode,
          entityId: variables.entityId,
          serverData: data,
        });

        // Update entity instance name if name changed
        const typedData = data as T & { name?: string; code?: string };
        if (typedData.name) {
          debugCache(`📝 onSettled: Updating entity instance name in Dexie`, {
            entityCode,
            entityId: variables.entityId,
            name: typedData.name,
          });
          await setEntityInstance(entityCode, variables.entityId, typedData.name, typedData.code);
          // v11.0.0: Update TanStack Query cache directly
          queryClient.setQueryData<Record<string, string>>(
            QUERY_KEYS.entityInstanceNames(entityCode),
            (old) => ({ ...(old || {}), [variables.entityId]: typedData.name! })
          );
        }

        if (refetchOnSuccess) {
          debugCache(`🔄 onSettled: refetchOnSuccess=true - invalidating queries`);
          // Invalidate to trigger background refetch
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
          });
        }

        debugCache(`✅ onSettled: Complete - both TanStack and Dexie have optimistic data`);
        onSuccess?.(data, variables);
      } else if (error) {
        debugCache(`❌ onSettled: Mutation FAILED`, { error: error.message });
      }
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CREATE MUTATION (v11.3.0: supports existingTempId for inline add row)
  // ──────────────────────────────────────────────────────────────────────────

  const createMutation = useMutation<
    T,
    Error,
    { data: Partial<T>; existingTempId?: string },
    OptimisticMutationContext<T>
  >({
    mutationFn: async ({ data }) => {
      const response = await apiClient.post(`/api/v1/${entityCode}`, data);
      return response.data?.data || response.data;
    },

    // v11.3.0: Modified to support existingTempId (inline add row pattern)
    // When existingTempId is provided, row is already in cache - skip adding temp row
    onMutate: async ({ data: newData, existingTempId }) => {
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      let allPreviousListData: Map<string, ListCacheData<T>>;
      let entityId: string;

      if (existingTempId) {
        // v11.3.0: Row already exists in cache (added by handleAddRow)
        // Just capture previous state for rollback - DO NOT add another temp row
        debugCache(`🔄 onMutate (create): Using existingTempId - skipping temp row creation`, {
          existingTempId,
        });

        const queryCache = queryClient.getQueryCache();
        const matchingQueries = queryCache.findAll({
          queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
        });

        allPreviousListData = new Map();
        for (const query of matchingQueries) {
          const previousData = query.state.data as ListCacheData<T> | undefined;
          if (previousData?.data) {
            allPreviousListData.set(JSON.stringify(query.queryKey), { ...previousData });
          }
        }

        entityId = existingTempId;
      } else {
        // Original flow: create temp row in cache
        const tempId = `temp_${Date.now()}`;
        const tempEntity = { ...newData, id: tempId, _isOptimistic: true } as unknown as T;

        // v11.2.0: Capture ALL previous states for rollback
        allPreviousListData = updateAllListCaches<T>(
          queryClient,
          entityCode,
          (data) => [tempEntity, ...data]
        );

        // v9.5.2: Add temp entity to Dexie as well
        addEntityInstanceDataItem(entityCode, tempEntity, true)
          .then((count) => debugCache(`✅ onMutate (create): Dexie cache updated`, { entriesUpdated: count }))
          .catch((err) => {
            debugCache(`❌ onMutate (create): Failed to update Dexie cache`, { error: String(err) });
            clearEntityInstanceData(entityCode).catch(() => {});
          });

        entityId = tempId;
      }

      return {
        allPreviousListData,
        entityId,
        existingTempId,
        mutationType: 'create',
      };
    },

    // v11.3.0: Enhanced error handling for existingTempId case
    onError: (error, _variables, context) => {
      debugCache(`❌ onError (create): API call failed - triggering rollback`, {
        existingTempId: context?.existingTempId,
      });

      if (context?.existingTempId) {
        // v11.3.0: Remove the temp row that was added by handleAddRow
        // This is cleaner than full rollback - just remove the failed row
        updateAllListCaches<T>(queryClient, entityCode, (listData) =>
          listData.filter((item) => item.id !== context.existingTempId)
        );
        debugCache(`🔄 onError (create): Removed temp row from cache`, {
          existingTempId: context.existingTempId,
        });
      } else if (context?.allPreviousListData && context.allPreviousListData.size > 0) {
        // v11.2.0: Direct rollback using captured previous states
        rollbackAllListCaches(queryClient, context.allPreviousListData);
        debugCache(`🔄 onError (create): Rolled back ${context.allPreviousListData.size} list caches`);
      }

      // Clear Dexie for consistency
      clearEntityInstanceData(entityCode).catch(() => {});
      onError?.(error, {});
    },

    onSuccess: async (data, _variables, context) => {
      debugCache(`🎉 onSuccess (create): API returned new entity`, {
        newEntityId: (data as any)?.id,
        tempEntityId: context?.entityId,
        existingTempId: context?.existingTempId,
      });

      // Replace temp entity with real one in ALL list caches
      if (context?.entityId) {
        debugCache(`🔄 onSuccess (create): Replacing temp row with real data in cache`);
        updateAllListCaches<T>(queryClient, entityCode, (listData) =>
          listData.map((item) => (item.id === context.entityId ? data : item))
        );

        // v9.5.2: Replace temp entity with real one in Dexie
        replaceEntityInstanceDataItem(entityCode, context.entityId, data)
          .then((count) => debugCache(`✅ onSuccess (create): Replaced temp entity in Dexie`, { entriesUpdated: count }))
          .catch(() => clearEntityInstanceData(entityCode).catch(() => {}));
      }

      // Cache the new entity instance name
      const typedData = data as T & { name?: string; code?: string };
      if (typedData.name && typedData.id) {
        await setEntityInstance(entityCode, typedData.id, typedData.name, typedData.code);
        // v11.0.0: Update TanStack Query cache directly
        queryClient.setQueryData<Record<string, string>>(
          QUERY_KEYS.entityInstanceNames(entityCode),
          (old) => ({ ...(old || {}), [typedData.id!]: typedData.name! })
        );
      }

      if (refetchOnSuccess) {
        // v11.3.1: SKIP refetch for inline add row (existingTempId) - we already have the data!
        // The API response contains the full entity, which is already in the cache.
        // Refetching would cause a race condition and potential data loss.
        if (context?.existingTempId) {
          debugCache(`🔄 onSuccess (create): SKIPPING refetch for inline add row - data already in cache`);
        } else {
          debugCache(`🔄 onSuccess (create): Triggering refetch`);
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
          });
        }
      }

      onSuccess?.(data, {});
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE MUTATION
  // ──────────────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation<
    void,
    Error,
    string,
    OptimisticMutationContext<T>
  >({
    mutationFn: async (entityId) => {
      await apiClient.delete(`/api/v1/${entityCode}/${entityId}`);
    },

    onMutate: async (entityId) => {
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.entityInstance(entityCode, entityId),
      });

      // v11.2.0: Capture ALL previous states for rollback
      const allPreviousListData = updateAllListCaches<T>(
        queryClient,
        entityCode,
        (data) => data.filter((item) => item.id !== entityId)
      );

      // Capture detail cache before removing (for rollback)
      const previousEntityData = queryClient.getQueryData<{ data: T }>(
        QUERY_KEYS.entityInstance(entityCode, entityId)
      )?.data;

      // Remove from detail cache
      queryClient.removeQueries({
        queryKey: QUERY_KEYS.entityInstance(entityCode, entityId),
      });

      // v9.5.2: Delete from Dexie as well
      deleteEntityInstanceDataItem(entityCode, entityId)
        .then((count) => debugCache(`✅ onMutate (delete): Dexie cache updated`, { entriesUpdated: count }))
        .catch((err) => {
          debugCache(`❌ onMutate (delete): Failed to update Dexie cache`, { error: String(err) });
          clearEntityInstanceData(entityCode).catch(() => {});
        });

      return {
        allPreviousListData,
        previousEntityData,
        entityId,
        mutationType: 'delete',
      };
    },

    // v11.2.0: Direct rollback on error (no network required)
    onError: (error, entityId, context) => {
      debugCache(`❌ onError (delete): API call failed - triggering direct rollback`);

      // v11.2.0: Direct rollback using captured previous states
      if (context?.allPreviousListData && context.allPreviousListData.size > 0) {
        rollbackAllListCaches(queryClient, context.allPreviousListData);
        debugCache(`🔄 onError (delete): Rolled back ${context.allPreviousListData.size} list caches`);
      }

      // Restore detail cache if we had it
      if (context?.previousEntityData) {
        queryClient.setQueryData(
          QUERY_KEYS.entityInstance(entityCode, entityId),
          { data: context.previousEntityData }
        );
        debugCache(`🔄 onError (delete): Restored detail cache`);
      }

      // Clear Dexie for consistency
      clearEntityInstanceData(entityCode).catch(() => {});
      onError?.(error, { entityId });
    },

    onSuccess: async (_data, entityId) => {
      // v11.0.0: Remove entity instance name from TanStack Query cache
      queryClient.setQueryData<Record<string, string>>(
        QUERY_KEYS.entityInstanceNames(entityCode),
        (old) => {
          if (!old) return old;
          const { [entityId]: _removed, ...rest } = old;
          return rest;
        }
      );

      onSuccess?.({}, { entityId });
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  const updateEntity = useCallback(
    async (entityId: string, changes: Partial<T>): Promise<T> => {
      return updateMutation.mutateAsync({ entityId, changes });
    },
    [updateMutation]
  );

  const createEntity = useCallback(
    async (data: Partial<T>, options?: CreateEntityOptions): Promise<T> => {
      return createMutation.mutateAsync({ data, existingTempId: options?.existingTempId });
    },
    [createMutation]
  );

  const deleteEntity = useCallback(
    async (entityId: string): Promise<void> => {
      return deleteMutation.mutateAsync(entityId);
    },
    [deleteMutation]
  );

  const reset = useCallback(() => {
    updateMutation.reset();
    createMutation.reset();
    deleteMutation.reset();
  }, [updateMutation, createMutation, deleteMutation]);

  return {
    updateEntity,
    createEntity,
    deleteEntity,
    isPending:
      updateMutation.isPending || createMutation.isPending || deleteMutation.isPending,
    error: updateMutation.error || createMutation.error || deleteMutation.error,
    reset,
  };
}

// All types are exported inline above
