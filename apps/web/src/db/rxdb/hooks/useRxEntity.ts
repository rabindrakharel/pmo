// ============================================================================
// RxDB Entity Hooks
// ============================================================================
// React hooks for entity data with offline-first, persistent storage
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { type RxDocument } from 'rxdb';
import { getDatabase, type PMODatabase } from '../database';
import { getReplicationManager } from '../replication';
import { createEntityId, type EntityDocType } from '../schemas/entity.schema';

// ============================================================================
// Types
// ============================================================================

export interface UseRxEntityResult<T = Record<string, unknown>> {
  data: T | null;
  refData: Record<string, Record<string, string>> | undefined;
  metadata: EntityDocType['metadata'] | undefined;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface UseRxEntityListResult<T = Record<string, unknown>> {
  data: T[];
  refData: Record<string, Record<string, string>> | undefined;
  metadata: EntityDocType['metadata'] | undefined;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  total: number;
  refetch: () => Promise<void>;
}

// Stale threshold: 30 seconds
const STALE_THRESHOLD = 30 * 1000;

// ============================================================================
// useRxEntity - Single Entity
// ============================================================================

/**
 * Hook for fetching and subscribing to a single entity
 * Data is persisted in IndexedDB and survives page refresh
 */
export function useRxEntity<T = Record<string, unknown>>(
  entityCode: string,
  entityId: string | undefined,
  options: { enabled?: boolean } = {}
): UseRxEntityResult<T> {
  const { enabled = true } = options;

  const [db, setDb] = useState<PMODatabase | null>(null);
  const [doc, setDoc] = useState<RxDocument<EntityDocType> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize database
  useEffect(() => {
    getDatabase().then(setDb);
  }, []);

  // Subscribe to document changes
  useEffect(() => {
    if (!db || !entityId || !enabled) {
      setIsLoading(false);
      return;
    }

    const docId = createEntityId(entityCode, entityId);

    // Subscribe to document changes (reactive)
    const subscription = db.entities
      .findOne(docId)
      .$.subscribe(async (rxDoc) => {
        if (rxDoc && !rxDoc._deleted) {
          setDoc(rxDoc);
          setIsLoading(false);
        } else {
          // Not in cache, fetch from server
          setIsLoading(true);
          try {
            const manager = getReplicationManager();
            await manager.fetchEntity(entityCode, entityId);
          } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
          } finally {
            setIsLoading(false);
          }
        }
      });

    return () => subscription.unsubscribe();
  }, [db, entityCode, entityId, enabled]);

  // Check if data is stale
  const isStale = useMemo(() => {
    if (!doc) return false;
    return Date.now() - doc._syncedAt > STALE_THRESHOLD;
  }, [doc]);

  // Refetch function
  const refetch = useCallback(async () => {
    if (!entityId) return;
    setIsLoading(true);
    try {
      const manager = getReplicationManager();
      await manager.fetchEntity(entityCode, entityId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [entityCode, entityId]);

  // Background refresh if stale
  useEffect(() => {
    if (isStale && entityId && enabled) {
      const manager = getReplicationManager();
      manager.fetchEntity(entityCode, entityId).catch(console.error);
    }
  }, [isStale, entityCode, entityId, enabled]);

  return {
    data: doc?.data as T | null,
    refData: doc?.refData,
    metadata: doc?.metadata,
    isLoading,
    isStale,
    error,
    refetch,
  };
}

// ============================================================================
// useRxEntityList - Entity List
// ============================================================================

/**
 * Hook for fetching and subscribing to an entity list
 * Data is persisted in IndexedDB and survives page refresh
 */
export function useRxEntityList<T = Record<string, unknown>>(
  entityCode: string,
  params: Record<string, unknown> = {},
  options: { enabled?: boolean } = {}
): UseRxEntityListResult<T> {
  const { enabled = true } = options;

  const [db, setDb] = useState<PMODatabase | null>(null);
  const [docs, setDocs] = useState<RxDocument<EntityDocType>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Initialize database
  useEffect(() => {
    getDatabase().then(setDb);
  }, []);

  // Subscribe to collection changes
  useEffect(() => {
    if (!db || !enabled) {
      setIsLoading(false);
      return;
    }

    // Subscribe to all entities of this type
    const subscription = db.entities
      .find({
        selector: {
          entityCode: { $eq: entityCode },
          _deleted: { $eq: false },
        },
      })
      .$.subscribe((rxDocs) => {
        setDocs(rxDocs);

        // If we have cached data, show it immediately
        if (rxDocs.length > 0) {
          setIsLoading(false);
        }

        // Fetch from server if not yet fetched
        if (!hasFetched) {
          setHasFetched(true);
          const manager = getReplicationManager();
          manager.fetchEntityList(entityCode, params)
            .catch(err => setError(err instanceof Error ? err : new Error(String(err))))
            .finally(() => setIsLoading(false));
        }
      });

    return () => subscription.unsubscribe();
  }, [db, entityCode, enabled, hasFetched, JSON.stringify(params)]);

  // Check if data is stale
  const isStale = useMemo(() => {
    if (docs.length === 0) return false;
    const oldest = Math.min(...docs.map(d => d._syncedAt));
    return Date.now() - oldest > STALE_THRESHOLD;
  }, [docs]);

  // Refetch function
  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const manager = getReplicationManager();
      await manager.fetchEntityList(entityCode, params);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [entityCode, JSON.stringify(params)]);

  // Get shared metadata and refData from first doc
  const metadata = docs[0]?.metadata;
  const refData = docs[0]?.refData;

  return {
    data: docs.map(d => d.data as T),
    refData,
    metadata,
    isLoading,
    isStale,
    error,
    total: docs.length,
    refetch,
  };
}

// ============================================================================
// useRxEntityMutation - Create/Update/Delete
// ============================================================================

export interface UseRxEntityMutationResult {
  updateEntity: (entityId: string, changes: Record<string, unknown>) => Promise<void>;
  createEntity: (data: Record<string, unknown>) => Promise<string>;
  deleteEntity: (entityId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for entity mutations with optimistic updates
 */
export function useRxEntityMutation(entityCode: string): UseRxEntityMutationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateEntity = useCallback(async (
    entityId: string,
    changes: Record<string, unknown>
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const manager = getReplicationManager();
      await manager.pushChanges(entityCode, entityId, changes);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [entityCode]);

  const createEntity = useCallback(async (
    data: Record<string, unknown>
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const { apiClient } = await import('../../../lib/api');
      const response = await apiClient.post(`/api/v1/${entityCode}`, data);
      const newEntity = response.data || response;

      // Fetch and cache the new entity
      const manager = getReplicationManager();
      await manager.fetchEntity(entityCode, newEntity.id);

      return newEntity.id;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [entityCode]);

  const deleteEntity = useCallback(async (entityId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { apiClient } = await import('../../../lib/api');
      await apiClient.delete(`/api/v1/${entityCode}/${entityId}`);

      // Mark as deleted in RxDB
      const db = await getDatabase();
      const docId = createEntityId(entityCode, entityId);
      const doc = await db.entities.findOne(docId).exec();
      if (doc) {
        await doc.patch({ _deleted: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [entityCode]);

  return {
    updateEntity,
    createEntity,
    deleteEntity,
    isLoading,
    error,
  };
}
