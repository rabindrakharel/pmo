// ============================================================================
// useEntity Hook
// ============================================================================
// Fetches a single entity with TanStack Query + Dexie persistence
// ============================================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS, DEXIE_KEYS } from '../keys';
import { ONDEMAND_STORE_CONFIG } from '../constants';
import { entityInstanceNamesStore } from '../stores';
import type { EntityInstanceMetadata } from '../types';
import {
  setEntityInstance,
  setEntityInstanceMetadata,
} from '../../persistence/operations';
import { wsManager } from '../../realtime/manager';

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
  metadata?: {
    entityListOfInstancesTable?: EntityInstanceMetadata;
  };
  ref_data_entityInstance?: Record<string, Record<string, string>>;
}

export interface UseEntityResult<T> {
  /** Entity data */
  data: T | undefined;
  /** Field metadata for rendering */
  metadata: EntityInstanceMetadata | undefined;
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
 * STORE: entity (single instance)
 * LAYER: On-demand (5 min staleTime)
 * PERSISTENCE: Dexie IndexedDB
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
  const { enabled = true, staleTime, refetchOnMount = true } = options;

  const query = useQuery<EntityResponse<T>, Error>({
    queryKey: QUERY_KEYS.entity(entityCode, entityId ?? ''),
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
        await setEntityInstance(entityCode, entityId, entityData.name, entityData.code);
        // Update sync store
        entityInstanceNamesStore.set(entityCode, entityId, entityData.name);
      }

      // Store entity instance names from ref_data_entityInstance
      if (apiData.ref_data_entityInstance) {
        for (const [refEntityCode, names] of Object.entries(apiData.ref_data_entityInstance)) {
          for (const [id, name] of Object.entries(names as Record<string, string>)) {
            await setEntityInstance(refEntityCode, id, name);
            entityInstanceNamesStore.set(refEntityCode, id, name);
          }
        }
      }

      // Store metadata ONCE per entity type
      if (apiData.metadata?.entityListOfInstancesTable) {
        const metadataTable = apiData.metadata.entityListOfInstancesTable;
        await setEntityInstanceMetadata(
          entityCode,
          Object.keys(metadataTable.viewType || {}),
          metadataTable.viewType || {},
          metadataTable.editType || {}
        );
      }

      return {
        data: apiData.data || apiData,
        metadata: apiData.metadata,
        ref_data_entityInstance: apiData.ref_data_entityInstance,
      };
    },
    enabled: enabled && !!entityId,
    staleTime: staleTime ?? ONDEMAND_STORE_CONFIG.staleTime,
    gcTime: ONDEMAND_STORE_CONFIG.gcTime,
    refetchOnMount,
    // Return previous data while refetching
    placeholderData: (previousData) => previousData,
  });

  // Auto-subscribe to WebSocket updates when query succeeds
  useEffect(() => {
    if (entityId && query.isSuccess) {
      wsManager.subscribe(entityCode, [entityId]);
    }
  }, [entityCode, entityId, query.isSuccess]);

  // Wrap refetch to return void
  const refetch = async (): Promise<void> => {
    await query.refetch();
  };

  return {
    data: query.data?.data,
    metadata: query.data?.metadata?.entityListOfInstancesTable,
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
      await setEntityInstance(entityCode, entityId, updatedData.name, updatedData.code);
      entityInstanceNamesStore.set(entityCode, entityId, updatedData.name);
    }

    // Update TanStack Query cache
    queryClient.setQueryData(QUERY_KEYS.entity(entityCode, entityId), (old: unknown) => ({
      ...(old as object),
      data: updatedData,
    }));

    // Invalidate list queries
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      refetchType: 'active',
    });

    return updatedData;
  };

  const createEntity = async (data: Record<string, unknown>): Promise<string> => {
    const response = await apiClient.post(`/api/v1/${entityCode}`, data);
    const newEntity = response.data?.data || response.data;

    // Cache the new entity instance name
    if (newEntity.name) {
      await setEntityInstance(entityCode, newEntity.id, newEntity.name, newEntity.code);
      entityInstanceNamesStore.set(entityCode, newEntity.id, newEntity.name);
    }

    // Invalidate list queries to include new entity
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      refetchType: 'active',
    });

    return newEntity.id;
  };

  const deleteEntity = async (entityId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/${entityCode}/${entityId}`);

    // Remove entity instance name from sync store
    entityInstanceNamesStore.delete(entityCode, entityId);

    // Remove from TanStack Query cache
    queryClient.removeQueries({
      queryKey: QUERY_KEYS.entity(entityCode, entityId),
    });

    // Invalidate list queries
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      refetchType: 'active',
    });
  };

  return {
    updateEntity,
    createEntity,
    deleteEntity,
    isLoading: false,
    error: null,
  };
}
