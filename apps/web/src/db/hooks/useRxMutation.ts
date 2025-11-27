/**
 * useRxMutation - RxDB Document Mutations
 *
 * REPLACES: useMutation from React Query
 *
 * Provides methods to:
 * - Insert new documents
 * - Update existing documents
 * - Delete documents (soft or hard)
 * - Bulk operations
 *
 * @example
 * const { insert, update, remove } = useRxMutation('project');
 * await insert({ name: 'New Project', ... });
 */
import { useCallback, useState } from 'react';
import type { RxDocument, RxCollection } from 'rxdb';
import { useDatabase } from './useDatabase';
import type { PMODatabaseCollections } from '../index';

// ============================================================================
// Types
// ============================================================================

export interface UseRxMutationResult<T> {
  /** Insert a new document */
  insert: (data: Partial<T>) => Promise<RxDocument<T>>;

  /** Insert multiple documents */
  insertBulk: (docs: Partial<T>[]) => Promise<RxDocument<T>[]>;

  /** Update a document by ID */
  update: (id: string, patch: Partial<T>) => Promise<RxDocument<T>>;

  /** Update multiple documents */
  updateBulk: (updates: Array<{ id: string; patch: Partial<T> }>) => Promise<RxDocument<T>[]>;

  /** Soft delete (set active_flag: false) */
  softDelete: (id: string) => Promise<RxDocument<T>>;

  /** Hard delete (remove document) */
  remove: (id: string) => Promise<boolean>;

  /** Remove multiple documents */
  removeBulk: (ids: string[]) => Promise<number>;

  /** Upsert document (insert or update) */
  upsert: (data: T) => Promise<RxDocument<T>>;

  /** True while any mutation is in progress */
  isLoading: boolean;

  /** Last error from mutation */
  error: Error | null;

  /** Reset error state */
  resetError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Get mutation methods for a collection
 *
 * @param collectionName - Name of the collection
 * @returns Mutation methods
 *
 * @example
 * const { insert, update, remove, isLoading, error } = useRxMutation('project');
 *
 * // Create
 * const newProject = await insert({
 *   id: crypto.randomUUID(),
 *   name: 'New Project',
 *   active_flag: true,
 *   _deleted: false
 * });
 *
 * // Update
 * await update(projectId, { name: 'Updated Name' });
 *
 * // Delete
 * await softDelete(projectId); // Sets active_flag: false
 * await remove(projectId);     // Hard delete
 */
export function useRxMutation<
  CollectionName extends keyof PMODatabaseCollections,
  T = PMODatabaseCollections[CollectionName] extends RxCollection<infer D> ? D : never
>(collectionName: CollectionName): UseRxMutationResult<T> {
  const db = useDatabase();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getCollection = useCallback((): RxCollection<T> => {
    const collection = db.collections[collectionName] as RxCollection<T>;
    if (!collection) {
      throw new Error(`Collection "${collectionName}" not found`);
    }
    return collection;
  }, [db, collectionName]);

  // Insert single document
  const insert = useCallback(async (data: Partial<T>): Promise<RxDocument<T>> => {
    setIsLoading(true);
    setError(null);

    try {
      const collection = getCollection();
      const now = new Date().toISOString();

      const docData = {
        id: crypto.randomUUID(),
        created_ts: now,
        updated_ts: now,
        version: 1,
        active_flag: true,
        _deleted: false,
        ...data
      } as T;

      const doc = await collection.insert(docData);
      return doc;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Insert failed');
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [getCollection]);

  // Insert bulk documents
  const insertBulk = useCallback(async (docs: Partial<T>[]): Promise<RxDocument<T>[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const collection = getCollection();
      const now = new Date().toISOString();

      const docsData = docs.map(data => ({
        id: crypto.randomUUID(),
        created_ts: now,
        updated_ts: now,
        version: 1,
        active_flag: true,
        _deleted: false,
        ...data
      })) as T[];

      const result = await collection.bulkInsert(docsData);
      return result.success;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Bulk insert failed');
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [getCollection]);

  // Update single document
  const update = useCallback(async (id: string, patch: Partial<T>): Promise<RxDocument<T>> => {
    setIsLoading(true);
    setError(null);

    try {
      const collection = getCollection();
      const doc = await collection.findOne(id).exec();

      if (!doc) {
        throw new Error(`Document ${id} not found`);
      }

      const updateData = {
        ...patch,
        updated_ts: new Date().toISOString()
      } as Partial<T>;

      await doc.patch(updateData);
      return doc;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Update failed');
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [getCollection]);

  // Update bulk documents
  const updateBulk = useCallback(async (
    updates: Array<{ id: string; patch: Partial<T> }>
  ): Promise<RxDocument<T>[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const collection = getCollection();
      const results: RxDocument<T>[] = [];
      const now = new Date().toISOString();

      for (const { id, patch } of updates) {
        const doc = await collection.findOne(id).exec();
        if (doc) {
          await doc.patch({ ...patch, updated_ts: now } as Partial<T>);
          results.push(doc);
        }
      }

      return results;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Bulk update failed');
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [getCollection]);

  // Soft delete
  const softDelete = useCallback(async (id: string): Promise<RxDocument<T>> => {
    return update(id, {
      active_flag: false,
      updated_ts: new Date().toISOString()
    } as Partial<T>);
  }, [update]);

  // Hard delete
  const remove = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const collection = getCollection();
      const doc = await collection.findOne(id).exec();

      if (!doc) {
        throw new Error(`Document ${id} not found`);
      }

      await doc.remove();
      return true;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Remove failed');
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [getCollection]);

  // Remove bulk
  const removeBulk = useCallback(async (ids: string[]): Promise<number> => {
    setIsLoading(true);
    setError(null);

    try {
      const collection = getCollection();
      let count = 0;

      for (const id of ids) {
        const doc = await collection.findOne(id).exec();
        if (doc) {
          await doc.remove();
          count++;
        }
      }

      return count;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Bulk remove failed');
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [getCollection]);

  // Upsert
  const upsert = useCallback(async (data: T): Promise<RxDocument<T>> => {
    setIsLoading(true);
    setError(null);

    try {
      const collection = getCollection();
      const doc = await collection.upsert({
        ...data,
        updated_ts: new Date().toISOString()
      } as T);
      return doc;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Upsert failed');
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [getCollection]);

  // Reset error
  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    insert,
    insertBulk,
    update,
    updateBulk,
    softDelete,
    remove,
    removeBulk,
    upsert,
    isLoading,
    error,
    resetError
  };
}
