/**
 * useRxDocument - Subscribe to a Single RxDB Document
 *
 * REPLACES: useQuery with single entity queryFn
 *
 * Features:
 * - Reactive: Auto-updates when document changes
 * - Built-in update/remove methods
 * - Persistent across page refresh
 *
 * @example
 * const { data, isLoading, update } = useRxDocument('project', projectId);
 * if (data) {
 *   await update({ name: 'New Name' });
 * }
 */
import { useState, useEffect, useCallback } from 'react';
import type { RxDocument, RxCollection } from 'rxdb';
import { useDatabase } from './useDatabase';
import type { PMODatabaseCollections } from '../index';

// ============================================================================
// Types
// ============================================================================

export interface UseRxDocumentResult<T> {
  /** Document data as plain object (null if not found) */
  data: T | null;

  /** RxDocument instance (for direct RxDB operations) */
  document: RxDocument<T> | null;

  /** True while loading document */
  isLoading: boolean;

  /** Error if query failed */
  error: Error | null;

  /** True if document exists */
  exists: boolean;

  /** Update document fields */
  update: (patch: Partial<T>) => Promise<RxDocument<T>>;

  /** Soft delete (sets active_flag: false) */
  softDelete: () => Promise<RxDocument<T>>;

  /** Hard delete (removes document) */
  remove: () => Promise<boolean>;

  /** Refresh document */
  refetch: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Subscribe to a single RxDB document
 *
 * @param collectionName - Name of the collection
 * @param documentId - Primary key (usually UUID)
 * @returns Document result with update/remove methods
 *
 * @example
 * // Basic usage
 * const { data, isLoading } = useRxDocument('project', projectId);
 *
 * // With mutations
 * const { data, update, softDelete } = useRxDocument('task', taskId);
 * await update({ name: 'Updated Task' });
 * await softDelete();
 */
export function useRxDocument<
  CollectionName extends keyof PMODatabaseCollections,
  T = PMODatabaseCollections[CollectionName] extends RxCollection<infer D> ? D : never
>(
  collectionName: CollectionName,
  documentId: string | null | undefined
): UseRxDocumentResult<T> {
  const db = useDatabase();
  const [data, setData] = useState<T | null>(null);
  const [document, setDocument] = useState<RxDocument<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to document changes
  useEffect(() => {
    if (!documentId) {
      setData(null);
      setDocument(null);
      setIsLoading(false);
      return;
    }

    const collection = db.collections[collectionName] as RxCollection<T>;
    if (!collection) {
      setError(new Error(`Collection "${collectionName}" not found`));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Subscribe to document changes
    const subscription = collection
      .findOne(documentId)
      .$
      .subscribe({
        next: (doc: RxDocument<T> | null) => {
          if (doc) {
            setData(doc.toJSON() as T);
            setDocument(doc);
          } else {
            setData(null);
            setDocument(null);
          }
          setIsLoading(false);
        },
        error: (err: Error) => {
          console.error(`[useRxDocument] Error for ${collectionName}/${documentId}:`, err);
          setError(err);
          setIsLoading(false);
        }
      });

    return () => subscription.unsubscribe();
  }, [db, collectionName, documentId]);

  // Update document
  const update = useCallback(async (patch: Partial<T>): Promise<RxDocument<T>> => {
    if (!document) {
      throw new Error('Document not loaded');
    }

    // Add updated timestamp
    const updateData = {
      ...patch,
      updated_ts: new Date().toISOString()
    } as Partial<T>;

    await document.patch(updateData);
    return document;
  }, [document]);

  // Soft delete (set active_flag: false)
  const softDelete = useCallback(async (): Promise<RxDocument<T>> => {
    if (!document) {
      throw new Error('Document not loaded');
    }

    await document.patch({
      active_flag: false,
      updated_ts: new Date().toISOString()
    } as Partial<T>);

    return document;
  }, [document]);

  // Hard delete (remove document)
  const remove = useCallback(async (): Promise<boolean> => {
    if (!document) {
      throw new Error('Document not loaded');
    }

    await document.remove();
    return true;
  }, [document]);

  // Refetch document
  const refetch = useCallback(() => {
    if (!documentId) return;

    const collection = db.collections[collectionName] as RxCollection<T>;
    if (collection) {
      collection.findOne(documentId).exec().catch(console.error);
    }
  }, [db, collectionName, documentId]);

  return {
    data,
    document,
    isLoading,
    error,
    exists: data !== null,
    update,
    softDelete,
    remove,
    refetch
  };
}

/**
 * Find a document by a field other than primary key
 *
 * @example
 * const { data } = useRxDocumentByField('employee', 'email', 'john@example.com');
 */
export function useRxDocumentByField<
  CollectionName extends keyof PMODatabaseCollections,
  T = PMODatabaseCollections[CollectionName] extends RxCollection<infer D> ? D : never
>(
  collectionName: CollectionName,
  field: keyof T,
  value: unknown
): UseRxDocumentResult<T> {
  const db = useDatabase();
  const [data, setData] = useState<T | null>(null);
  const [document, setDocument] = useState<RxDocument<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (value === null || value === undefined) {
      setData(null);
      setDocument(null);
      setIsLoading(false);
      return;
    }

    const collection = db.collections[collectionName] as RxCollection<T>;
    if (!collection) {
      setError(new Error(`Collection "${collectionName}" not found`));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const subscription = collection
      .findOne({ selector: { [field]: value } as any })
      .$
      .subscribe({
        next: (doc: RxDocument<T> | null) => {
          if (doc) {
            setData(doc.toJSON() as T);
            setDocument(doc);
          } else {
            setData(null);
            setDocument(null);
          }
          setIsLoading(false);
        },
        error: (err: Error) => {
          console.error(`[useRxDocumentByField] Error:`, err);
          setError(err);
          setIsLoading(false);
        }
      });

    return () => subscription.unsubscribe();
  }, [db, collectionName, field, value]);

  const update = useCallback(async (patch: Partial<T>) => {
    if (!document) throw new Error('Document not loaded');
    await document.patch({ ...patch, updated_ts: new Date().toISOString() } as Partial<T>);
    return document;
  }, [document]);

  const softDelete = useCallback(async () => {
    if (!document) throw new Error('Document not loaded');
    await document.patch({ active_flag: false, updated_ts: new Date().toISOString() } as Partial<T>);
    return document;
  }, [document]);

  const remove = useCallback(async () => {
    if (!document) throw new Error('Document not loaded');
    await document.remove();
    return true;
  }, [document]);

  const refetch = useCallback(() => {
    const collection = db.collections[collectionName] as RxCollection<T>;
    if (collection) {
      collection.findOne({ selector: { [field]: value } as any }).exec().catch(console.error);
    }
  }, [db, collectionName, field, value]);

  return {
    data,
    document,
    isLoading,
    error,
    exists: data !== null,
    update,
    softDelete,
    remove,
    refetch
  };
}
