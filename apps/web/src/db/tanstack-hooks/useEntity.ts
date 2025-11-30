// ============================================================================
// useEntity Hook
// ============================================================================
// Fetches a single entity with TanStack Query + Dexie persistence
// ============================================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { db, createEntityInstanceKey } from '../dexie/database';
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
  /** Data is stale and being refreshed in background */
  isStale: boolean;
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

      const now = Date.now();

      // Persist entity instance name if available
      const entityData = apiData.data || apiData;
      if (entityData.name) {
        await db.entityInstance.put({
          _id: createEntityInstanceKey(entityCode, entityId),
          entityCode,
          entityInstanceId: entityId,
          entityInstanceName: entityData.name,
          instanceCode: entityData.code,
          syncedAt: now,
        });
      }

      // Store entity instance names from ref_data_entityInstance
      if (apiData.ref_data_entityInstance) {
        for (const [refEntityCode, names] of Object.entries(apiData.ref_data_entityInstance)) {
          for (const [id, name] of Object.entries(names as Record<string, string>)) {
            await db.entityInstance.put({
              _id: createEntityInstanceKey(refEntityCode, id),
              entityCode: refEntityCode,
              entityInstanceId: id,
              entityInstanceName: name,
              syncedAt: now,
            });
          }
        }
      }

      // Store metadata ONCE per entity type
      if (apiData.metadata?.entityListOfInstancesTable) {
        const metadataTable = apiData.metadata.entityListOfInstancesTable;
        await db.entityInstanceMetadata.put({
          _id: entityCode,
          entityCode,
          fields: Object.keys(metadataTable.viewType || {}),
          viewType: metadataTable.viewType || {},
          editType: metadataTable.editType || {},
          syncedAt: now,
        });
      }

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
    isStale: query.isStale,
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

    // Update entity instance name if name changed
    if (updatedData.name) {
      await db.entityInstance.put({
        _id: createEntityInstanceKey(entityCode, entityId),
        entityCode,
        entityInstanceId: entityId,
        entityInstanceName: updatedData.name,
        instanceCode: updatedData.code,
        syncedAt: Date.now(),
      });
    }

    // Update TanStack Query cache
    queryClient.setQueryData(['entity', entityCode, entityId], (old: unknown) => ({
      ...(old as object),
      data: updatedData,
    }));

    // Invalidate list queries
    queryClient.invalidateQueries({
      queryKey: ['entityInstanceData', entityCode],
      refetchType: 'active',
    });

    return updatedData;
  };

  const createEntity = async (data: Record<string, unknown>): Promise<string> => {
    const response = await apiClient.post(`/api/v1/${entityCode}`, data);
    const newEntity = response.data?.data || response.data;

    // Cache the new entity instance name
    if (newEntity.name) {
      await db.entityInstance.put({
        _id: createEntityInstanceKey(entityCode, newEntity.id),
        entityCode,
        entityInstanceId: newEntity.id,
        entityInstanceName: newEntity.name,
        instanceCode: newEntity.code,
        syncedAt: Date.now(),
      });
    }

    // Invalidate list queries to include new entity
    queryClient.invalidateQueries({
      queryKey: ['entityInstanceData', entityCode],
      refetchType: 'active',
    });

    return newEntity.id;
  };

  const deleteEntity = async (entityId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/${entityCode}/${entityId}`);

    // Remove entity instance name from Dexie
    await db.entityInstance.delete(createEntityInstanceKey(entityCode, entityId));

    // Remove from TanStack Query cache
    queryClient.removeQueries({
      queryKey: ['entity', entityCode, entityId],
    });

    // Invalidate list queries
    queryClient.invalidateQueries({
      queryKey: ['entityInstanceData', entityCode],
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
