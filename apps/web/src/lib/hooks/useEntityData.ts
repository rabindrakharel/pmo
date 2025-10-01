import { useState, useEffect, useCallback } from 'react';

/**
 * Generic hook for fetching and managing entity data
 *
 * @param fetchFn - Function that returns a Promise with the data
 * @param dependencies - Dependencies array for refetching
 * @returns { data, loading, error, refetch }
 */
export function useEntityData<T>(
  fetchFn: () => Promise<{ data: T[]; total?: number }>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result.data || []);
      setTotal(result.total || result.data?.length || 0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    total,
    loading,
    error,
    refetch
  };
}

/**
 * Hook for managing pagination state
 */
export function usePagination(initialPage: number = 1, initialPageSize: number = 20) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const reset = useCallback(() => {
    setPage(initialPage);
  }, [initialPage]);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const changePageSize = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  }, []);

  return {
    page,
    pageSize,
    setPage: goToPage,
    setPageSize: changePageSize,
    reset
  };
}

/**
 * Hook for managing selection state (for bulk actions)
 */
export function useSelection<T extends { id: string }>() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleAll = useCallback((items: T[]) => {
    setSelectedIds(prev => {
      if (prev.size === items.length) {
        // Deselect all
        return new Set();
      } else {
        // Select all
        return new Set(items.map(item => item.id));
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const getSelectedItems = useCallback((items: T[]) => {
    return items.filter(item => selectedIds.has(item.id));
  }, [selectedIds]);

  return {
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    isSelected,
    getSelectedItems,
    selectedCount: selectedIds.size
  };
}
