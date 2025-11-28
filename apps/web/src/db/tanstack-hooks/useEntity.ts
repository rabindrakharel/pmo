// ============================================================================
// useEntity Hook
// ============================================================================
// Fetches a single entity with TanStack Query + Dexie persistence
// ============================================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, createEntityKey } from '../dexie/database';
import { wsManager } from '../tanstack-sync/WebSocketManager';
import { apiClient } from '../../lib/api';

// ============================================================================
// Types
// ============================================================================

interface UseEntityOptions {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Override default stale time */
  staleTime?: number;
  /** Refetch on mount even if data is fresh */
  refetchOnMount?: boolean | 'always';
}

interface EntityResponse<T> {
  data: T;
  metadata?: Record<string, unknown>;
  ref_data_entityInstance?: Record<string, Record<string, string>>;
}

export interface UseEntityResult<T> {
  /** Entity data */
  data: T | undefined;
  /** Field metadata for rendering */
  metadata: Record<string, unknown> | undefined;
  /** Reference data for entity lookups */
  refData: Record<string, Record<string, string>> | undefined;
  /** Initial loading state */
  isLoading: boolean;
  /** Background refetch in progress */
  isFetching: boolean;
  /** Error occurred */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Manual refetch function */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching and subscribing to a single entity
 *
 * Features:
 * - Automatic caching via TanStack Query
 * - Persistence to IndexedDB via Dexie
 * - Real-time updates via WebSocket subscription
 * - Hydration from Dexie on page load
 *
 * @example
 * const { data, isLoading, metadata } = useEntity<Project>('project', projectId);
 */
export function useEntity<T = Record<string, unknown>>(
  entityCode: string,
  entityId: string | undefined,
  options: UseEntityOptions = {}
): UseEntityResult<T> {
  const queryClient = useQueryClient();
  const { enabled = true, staleTime, refetchOnMount = true } = options;

  const query = useQuery<EntityResponse<T>, Error>({
    queryKey: ['entity', entityCode, entityId],
    queryFn: async () => {
      if (!entityId) {
        throw new Error('Entity ID is required');
      }

      // Fetch from API
      const response = await apiClient.get(`/api/v1/${entityCode}/${entityId}`);
      const apiData = response.data;

      // Persist to Dexie for offline access
      await db.entities.put({
        _id: createEntityKey(entityCode, entityId),
        entityCode,
        entityId,
        data: apiData.data || apiData,
        metadata: apiData.metadata,
        refData: apiData.ref_data_entityInstance,
        version: apiData.data?.version || Date.now(),
        syncedAt: Date.now(),
        isDeleted: false,
      });

      return {
        data: apiData.data || apiData,
        metadata: apiData.metadata,
        ref_data_entityInstance: apiData.ref_data_entityInstance,
      };
    },
    enabled: enabled && !!entityId,
    staleTime,
    refetchOnMount,
    // Return previous data while refetching
    placeholderData: (previousData) => previousData,
  });

  // Auto-subscribe to WebSocket updates when query succeeds
  useEffect(() => {
    if (entityId && query.isSuccess) {
      wsManager.subscribe(entityCode, [entityId]);
    }

    // Unsubscribe on unmount is optional - keeping subscriptions
    // allows updates even when component unmounts temporarily
  }, [entityCode, entityId, query.isSuccess]);

  // Wrap refetch to return void
  const refetch = async (): Promise<void> => {
    await query.refetch();
  };

  return {
    data: query.data?.data,
    metadata: query.data?.metadata,
    refData: query.data?.ref_data_entityInstance,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}

// ============================================================================
// Mutation Hook (Create/Update/Delete)
// ============================================================================

export interface UseEntityMutationResult {
  /** Update an existing entity */
  updateEntity: (entityId: string, changes: Record<string, unknown>) => Promise<unknown>;
  /** Create a new entity */
  createEntity: (data: Record<string, unknown>) => Promise<string>;
  /** Delete an entity */
  deleteEntity: (entityId: string) => Promise<void>;
  /** Mutation in progress */
  isLoading: boolean;
  /** Last error */
  error: Error | null;
}

/**
 * Hook for entity mutations (create, update, delete)
 *
 * @example
 * const { updateEntity, createEntity, deleteEntity } = useEntityMutation('project');
 * await updateEntity(id, { name: 'New Name' });
 */
export function useEntityMutation(entityCode: string): UseEntityMutationResult {
  const queryClient = useQueryClient();

  const updateEntity = async (
    entityId: string,
    changes: Record<string, unknown>
  ): Promise<unknown> => {
    const response = await apiClient.patch(
      `/api/v1/${entityCode}/${entityId}`,
      changes
    );

    const updatedData = response.data?.data || response.data;

    // Update Dexie cache
    await db.entities.update(createEntityKey(entityCode, entityId), {
      data: updatedData,
      version: updatedData.version || Date.now(),
      syncedAt: Date.now(),
    });

    // Update TanStack Query cache
    queryClient.setQueryData(['entity', entityCode, entityId], (old: unknown) => ({
      ...(old as object),
      data: updatedData,
    }));

    // Invalidate list queries
    queryClient.invalidateQueries({
      queryKey: ['entity-list', entityCode],
      refetchType: 'active',
    });

    return updatedData;
  };

  const createEntity = async (data: Record<string, unknown>): Promise<string> => {
    const response = await apiClient.post(`/api/v1/${entityCode}`, data);
    const newEntity = response.data?.data || response.data;

    // Cache the new entity
    await db.entities.put({
      _id: createEntityKey(entityCode, newEntity.id),
      entityCode,
      entityId: newEntity.id,
      data: newEntity,
      version: newEntity.version || Date.now(),
      syncedAt: Date.now(),
      isDeleted: false,
    });

    // Invalidate list queries to include new entity
    queryClient.invalidateQueries({
      queryKey: ['entity-list', entityCode],
      refetchType: 'active',
    });

    return newEntity.id;
  };

  const deleteEntity = async (entityId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/${entityCode}/${entityId}`);

    // Mark as deleted in Dexie
    await db.entities.update(createEntityKey(entityCode, entityId), {
      isDeleted: true,
    });

    // Remove from TanStack Query cache
    queryClient.removeQueries({
      queryKey: ['entity', entityCode, entityId],
    });

    // Invalidate list queries
    queryClient.invalidateQueries({
      queryKey: ['entity-list', entityCode],
      refetchType: 'active',
    });
  };

  return {
    updateEntity,
    createEntity,
    deleteEntity,
    isLoading: false, // TODO: Track mutation state if needed
    error: null,
  };
}
