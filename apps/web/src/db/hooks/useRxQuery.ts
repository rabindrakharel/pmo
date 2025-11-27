/**
 * useRxQuery - Subscribe to RxDB Collection Queries
 *
 * REPLACES: useQuery from React Query
 *
 * Key Differences:
 * - Reactive: Auto-updates when documents change (no manual refetch needed)
 * - Persistent: Data survives page refresh (IndexedDB)
 * - Offline: Works without network connection
 *
 * @example
 * // List all active projects
 * const { data, isLoading } = useRxQuery('project', {
 *   selector: { active_flag: true },
 *   sort: [{ updated_ts: 'desc' }],
 *   limit: 20
 * });
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import type { RxCollection, RxDocument, MangoQuery } from 'rxdb';
import { useDatabase } from './useDatabase';
import type { PMODatabaseCollections } from '../index';

// ============================================================================
// Types
// ============================================================================

export interface UseRxQueryOptions<T> {
  /** Skip query execution (for conditional queries) */
  enabled?: boolean;

  /** MongoDB-style selector */
  selector?: MangoQuery<T>['selector'];

  /** Sort order */
  sort?: MangoQuery<T>['sort'];

  /** Limit results */
  limit?: number;

  /** Skip results (pagination) */
  skip?: number;
}

export interface UseRxQueryResult<T> {
  /** Query results as plain objects */
  data: T[];

  /** True while initial query is loading */
  isLoading: boolean;

  /** Error if query failed */
  error: Error | null;

  /** Total count matching selector (ignoring limit) */
  count: number;

  /** Force refresh (not usually needed - queries are reactive) */
  refetch: () => void;

  /** True if query has run at least once */
  isFetched: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Subscribe to a reactive RxDB collection query
 *
 * @param collectionName - Name of the collection to query
 * @param options - Query options (selector, sort, limit, skip)
 * @returns Query result with reactive data
 *
 * @example
 * // Simple query
 * const { data } = useRxQuery('project');
 *
 * // With filtering and sorting
 * const { data, isLoading, count } = useRxQuery('task', {
 *   selector: { project_id: projectId, active_flag: true },
 *   sort: [{ due_date: 'asc' }],
 *   limit: 50
 * });
 *
 * // Conditional query
 * const { data } = useRxQuery('employee', {
 *   enabled: !!departmentId,
 *   selector: { department_id: departmentId }
 * });
 */
export function useRxQuery<
  CollectionName extends keyof PMODatabaseCollections,
  T = PMODatabaseCollections[CollectionName] extends RxCollection<infer D> ? D : never
>(
  collectionName: CollectionName,
  options: UseRxQueryOptions<T> = {}
): UseRxQueryResult<T> {
  const db = useDatabase();
  const [data, setData] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetched, setIsFetched] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    enabled = true,
    selector = {},
    sort,
    limit,
    skip
  } = options;

  // Serialize options for dependency tracking
  const selectorKey = JSON.stringify(selector);
  const sortKey = JSON.stringify(sort);

  // Build and memoize the query
  const query = useMemo(() => {
    if (!enabled) return null;

    const collection = db.collections[collectionName] as RxCollection<T>;
    if (!collection) {
      console.error(`[useRxQuery] Collection "${collectionName}" not found`);
      return null;
    }

    let q = collection.find({ selector });

    if (sort) {
      q = q.sort(sort);
    }
    if (skip !== undefined && skip > 0) {
      q = q.skip(skip);
    }
    if (limit !== undefined && limit > 0) {
      q = q.limit(limit);
    }

    return q;
  }, [db, collectionName, enabled, selectorKey, sortKey, limit, skip]);

  // Subscribe to query results
  useEffect(() => {
    if (!query) {
      setIsLoading(false);
      setData([]);
      setCount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    const subscription = query.$.subscribe({
      next: (results: RxDocument<T>[]) => {
        const docs = results.map(doc => doc.toJSON() as T);
        setData(docs);
        setIsLoading(false);
        setIsFetched(true);
      },
      error: (err: Error) => {
        console.error(`[useRxQuery] Query error for ${collectionName}:`, err);
        setError(err);
        setIsLoading(false);
        setIsFetched(true);
      }
    });

    // Get total count (without limit/skip)
    const collection = db.collections[collectionName] as RxCollection<T>;
    collection.count({ selector }).exec().then(setCount).catch(console.error);

    return () => subscription.unsubscribe();
  }, [query, db, collectionName, selectorKey]);

  // Refetch function (forces re-subscription)
  const refetch = useCallback(() => {
    if (!enabled) return;

    const collection = db.collections[collectionName] as RxCollection<T>;
    if (collection) {
      // Touch the query to trigger re-emission
      collection.find({ selector }).exec().catch(console.error);
    }
  }, [db, collectionName, enabled, selectorKey]);

  return {
    data,
    isLoading,
    error,
    count,
    refetch,
    isFetched
  };
}

/**
 * Query with automatic pagination
 *
 * @example
 * const {
 *   data,
 *   page,
 *   setPage,
 *   hasNextPage,
 *   hasPrevPage
 * } = useRxQueryPaginated('project', {
 *   pageSize: 20,
 *   selector: { active_flag: true }
 * });
 */
export function useRxQueryPaginated<
  CollectionName extends keyof PMODatabaseCollections,
  T = PMODatabaseCollections[CollectionName] extends RxCollection<infer D> ? D : never
>(
  collectionName: CollectionName,
  options: UseRxQueryOptions<T> & { pageSize?: number } = {}
) {
  const { pageSize = 20, ...queryOptions } = options;
  const [page, setPage] = useState(1);

  const skip = (page - 1) * pageSize;

  const result = useRxQuery<CollectionName, T>(collectionName, {
    ...queryOptions,
    limit: pageSize,
    skip
  });

  const totalPages = Math.ceil(result.count / pageSize);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) setPage(p => p + 1);
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) setPage(p => p - 1);
  }, [hasPrevPage]);

  return {
    ...result,
    page,
    setPage: goToPage,
    pageSize,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage
  };
}
