// ============================================================================
// useOptimisticMutation Hook (v9.5.2)
// ============================================================================
// Industry-standard optimistic update pattern for TanStack Query + Dexie
//
// DESIGN PATTERN:
// 1. IMMEDIATE: Update ALL TanStack Query list caches for entity → UI updates instantly
// 2. IMMEDIATE: Update Dexie (IndexedDB) in parallel → Persists across page refresh
// 3. BACKGROUND: Send API request
//    - Success: Cache already correct, optionally refetch to sync server state
//    - Failure: Invalidate queries to trigger refetch (rollback)
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
// - Graceful error handling with automatic rollback via invalidation
// - Works for both list views (DataTable) and detail views (EntitySpecificInstancePage)
// ============================================================================

import { useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '../keys';
import { entityInstanceNamesStore } from '../stores';
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
const DEBUG_CACHE = false;

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

export interface OptimisticMutationContext<T = Record<string, unknown>> {
  /** Previous data for rollback (list view) */
  previousListData?: {
    data: T[];
    total: number;
    metadata?: unknown;
    refData?: Record<string, Record<string, string>>;
  };
  /** Previous data for rollback (detail view) */
  previousEntityData?: T;
  /** Query params used for list query (for cache key) */
  queryParams?: Record<string, unknown>;
  /** Entity ID being mutated */
  entityId?: string;
  /** Mutation type */
  mutationType: 'create' | 'update' | 'delete';
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

export interface UseOptimisticMutationResult<T = Record<string, unknown>> {
  /** Optimistically update an existing entity */
  updateEntity: (entityId: string, changes: Partial<T>) => Promise<T>;
  /** Optimistically create a new entity */
  createEntity: (data: Partial<T>) => Promise<T>;
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
 * Update entity in ALL matching list caches (TanStack Query)
 * This finds all cached list queries for this entity code and updates them
 */
function updateAllListCaches<T extends { id: string }>(
  queryClient: QueryClient,
  entityCode: string,
  updater: (data: T[]) => T[]
): { data: T[]; total: number; metadata?: unknown; refData?: Record<string, Record<string, string>> } | undefined {
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

  let firstPreviousData: { data: T[]; total: number; metadata?: unknown; refData?: Record<string, Record<string, string>> } | undefined;

  // Update each matching list cache
  for (const query of matchingQueries) {
    const previousData = query.state.data as { data: T[]; total: number; metadata?: unknown; refData?: Record<string, Record<string, string>> } | undefined;

    if (previousData?.data) {
      // Save first previous data for rollback
      if (!firstPreviousData) {
        firstPreviousData = previousData;
      }

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

  return firstPreviousData;
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

      // Snapshot previous list data for potential rollback
      // v9.5.1: Update ALL matching list caches, not just one specific query
      debugCache(`📝 onMutate: Updating TanStack Query in-memory caches...`);
      const previousListData = updateAllListCaches<T>(
        queryClient,
        entityCode,
        (data) => data.map((item) => (item.id === entityId ? { ...item, ...changes } : item))
      );

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

      // Return context for rollback
      return {
        previousListData,
        previousEntityData,
        entityId,
        mutationType: 'update',
      };
    },

    // STEP 2: On error, rollback to previous state
    onError: (error, { entityId }, context) => {
      debugCache(`❌ onError: API call failed - triggering rollback`, {
        entityCode,
        entityId,
        error: error.message,
      });

      // Invalidate all list caches to trigger refetch (simpler than tracking all previous states)
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });
      debugCache(`🔄 onError: Invalidated TanStack Query caches - will refetch`);

      if (context?.previousEntityData) {
        rollbackDetailCache(queryClient, entityCode, entityId, context.previousEntityData);
        debugCache(`🔄 onError: Rolled back detail cache to previous state`);
      }

      // v9.5.2: Clear Dexie on error to ensure consistency (will repopulate on refetch)
      clearEntityInstanceData(entityCode)
        .then(() => debugCache(`🔄 onError: Cleared Dexie cache`))
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
          entityInstanceNamesStore.set(entityCode, variables.entityId, typedData.name);
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
  // CREATE MUTATION
  // ──────────────────────────────────────────────────────────────────────────

  const createMutation = useMutation<
    T,
    Error,
    Partial<T>,
    OptimisticMutationContext<T>
  >({
    mutationFn: async (data) => {
      const response = await apiClient.post(`/api/v1/${entityCode}`, data);
      return response.data?.data || response.data;
    },

    // For create, we can't do true optimistic update (no ID yet)
    // Instead, we add a temp placeholder and replace on success
    onMutate: async (newData) => {
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      const tempId = `temp_${Date.now()}`;
      const tempEntity = { ...newData, id: tempId, _isOptimistic: true } as T;

      // v9.5.1: Update ALL matching list caches
      const previousListData = updateAllListCaches<T>(
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

      return {
        previousListData,
        entityId: tempId,
        mutationType: 'create',
      };
    },

    onError: (error, _variables, context) => {
      // Invalidate all list caches to trigger refetch
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });
      // v9.5.2: Clear Dexie on error
      clearEntityInstanceData(entityCode).catch(() => {});
      onError?.(error, {});
    },

    onSuccess: async (data, _variables, context) => {
      // Replace temp entity with real one in ALL list caches
      if (context?.entityId) {
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
        entityInstanceNamesStore.set(entityCode, typedData.id, typedData.name);
      }

      if (refetchOnSuccess) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
        });
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

      // v9.5.1: Optimistically remove from ALL list caches
      const previousListData = updateAllListCaches<T>(
        queryClient,
        entityCode,
        (data) => data.filter((item) => item.id !== entityId)
      );

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
        previousListData,
        entityId,
        mutationType: 'delete',
      };
    },

    onError: (error, entityId, context) => {
      // Invalidate all list caches to trigger refetch
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });
      // v9.5.2: Clear Dexie on error
      clearEntityInstanceData(entityCode).catch(() => {});
      onError?.(error, { entityId });
    },

    onSuccess: async (_data, entityId) => {
      // Remove entity instance name from stores
      entityInstanceNamesStore.delete(entityCode, entityId);

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
    async (data: Partial<T>): Promise<T> => {
      return createMutation.mutateAsync(data);
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

// ============================================================================
// Exports
// ============================================================================

export type { OptimisticMutationContext };
