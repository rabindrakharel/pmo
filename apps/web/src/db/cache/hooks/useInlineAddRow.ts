// ============================================================================
// useInlineAddRow Hook (v1.0.0)
// ============================================================================
// Reusable hook for TanStack Query inline add row pattern.
// Implements single source of truth: cache is the ONLY data store.
//
// USAGE:
// const {
//   editingRow,
//   editedData,
//   isAddingRow,
//   handleAddRow,
//   handleEditRow,
//   handleFieldChange,
//   handleSave,
//   handleCancel,
//   isRowEditing,
//   isTempRow,
// } = useInlineAddRow({
//   entityCode: 'project',
//   createEntity,
//   updateEntity,
//   transformForApi,
//   transformFromApi,
// });
//
// PATTERN:
// 1. handleAddRow: Adds temp row directly to TanStack Query cache
// 2. handleSave: Passes existingTempId to skip duplicate temp row in onMutate
// 3. handleCancel: Removes temp row from cache
// 4. No local state copying - cache is single source of truth
//
// See: docs/design_pattern/INLINE_ADD_ROW_PATTERN.md
// ============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import type { CreateEntityOptions } from './useOptimisticMutation';

// ============================================================================
// Types
// ============================================================================

export interface UseInlineAddRowOptions<T = Record<string, unknown>> {
  /** Entity code for cache key lookup */
  entityCode: string;

  /** Create entity function from useOptimisticMutation */
  createEntity: (data: Partial<T>, options?: CreateEntityOptions) => Promise<T>;

  /** Update entity function from useOptimisticMutation */
  updateEntity: (entityId: string, changes: Partial<T>) => Promise<T>;

  /** Transform data for API (e.g., convert display values to API format) */
  transformForApi?: (editedData: Partial<T>, originalRecord: T) => Partial<T>;

  /** Transform data from API (e.g., convert API format to display values) */
  transformFromApi?: (record: T) => Partial<T>;

  /** Callback when save succeeds */
  onSaveSuccess?: (data: T, isNewRow: boolean) => void;

  /** Callback when save fails */
  onSaveError?: (error: Error, isNewRow: boolean) => void;

  /** Callback when cancel is triggered */
  onCancel?: () => void;

  /** Enable debug logging */
  debug?: boolean;
}

export interface UseInlineAddRowResult<T = Record<string, unknown>> {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  /** Currently editing row ID (null if not editing) */
  editingRow: string | null;

  /** Current edited data (accumulated field changes) */
  editedData: Partial<T>;

  /** Whether currently adding a new row */
  isAddingRow: boolean;

  /** Whether a save operation is in progress */
  isSaving: boolean;

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add a new temp row to the cache and enter edit mode.
   * Called when user clicks "Add new row" button.
   *
   * @param newRow - The temp row object (must have id: `temp_${timestamp}`)
   */
  handleAddRow: (newRow: T) => void;

  /**
   * Enter edit mode for an existing row.
   * Called when user clicks Edit button on a row.
   *
   * @param record - The row to edit (can be FormattedRow or raw)
   */
  handleEditRow: (record: T | { raw: T }) => void;

  /**
   * Update a field value in editedData.
   * Called on every field change during editing.
   *
   * @param field - Field name
   * @param value - New value
   */
  handleFieldChange: (field: string, value: unknown) => void;

  /**
   * Save the current edit (create or update).
   * Called when user clicks Save/checkmark.
   *
   * @param record - The row being saved (for ID extraction)
   */
  handleSave: (record: T | { raw: T }) => Promise<void>;

  /**
   * Cancel the current edit.
   * For new rows: removes temp row from cache.
   * For existing rows: just clears edit state.
   */
  handleCancel: () => void;

  /**
   * Clear all edit state (for external use, e.g., entity code change)
   */
  resetEditState: () => void;

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a specific row is currently being edited.
   *
   * @param rowId - Row ID to check
   */
  isRowEditing: (rowId: string) => boolean;

  /**
   * Check if a row ID is a temp row (not yet saved to server).
   *
   * @param rowId - Row ID to check
   */
  isTempRow: (rowId: string) => boolean;

  /**
   * Get the current value of a field (from editedData or original).
   *
   * @param field - Field name
   * @param originalValue - Original value from record
   */
  getFieldValue: (field: string, originalValue: unknown) => unknown;
}

// ============================================================================
// Debug Logger
// ============================================================================

const createDebugger = (enabled: boolean, prefix: string) => {
  return (message: string, data?: Record<string, unknown>) => {
    if (enabled) {
      console.log(
        `%c[${prefix}] ${message}`,
        'color: #10b981; font-weight: bold',
        data || ''
      );
    }
  };
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useInlineAddRow<T extends { id: string } = Record<string, unknown> & { id: string }>(
  options: UseInlineAddRowOptions<T>
): UseInlineAddRowResult<T> {
  const {
    entityCode,
    createEntity,
    updateEntity,
    transformForApi = (data) => data,
    transformFromApi = (record) => ({ ...record }),
    onSaveSuccess,
    onSaveError,
    onCancel,
    debug = false,
  } = options;

  const queryClient = useQueryClient();
  // Memoize log to prevent useCallback deps from changing on every render
  const log = useMemo(() => createDebugger(debug, 'INLINE_ADD_ROW'), [debug]);

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<T>>({});
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Reset on entity change
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    log('Entity changed, resetting edit state', { entityCode });
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
    setIsSaving(false);
  }, [entityCode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────────────────────

  const isTempRow = useCallback((rowId: string): boolean => {
    return rowId?.toString().startsWith('temp_');
  }, []);

  const isRowEditing = useCallback(
    (rowId: string): boolean => {
      return editingRow === rowId;
    },
    [editingRow]
  );

  const getFieldValue = useCallback(
    (field: string, originalValue: unknown): unknown => {
      return field in editedData ? (editedData as Record<string, unknown>)[field] : originalValue;
    },
    [editedData]
  );

  const extractRawRecord = useCallback((record: T | { raw: T }): T => {
    return 'raw' in record ? record.raw : record;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Cache Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add a row to ALL matching TanStack Query caches for this entity.
   */
  const addRowToCache = useCallback(
    (newRow: T) => {
      const queryCache = queryClient.getQueryCache();
      const matchingQueries = queryCache.findAll({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      log('Adding row to cache', {
        rowId: newRow.id,
        matchingQueries: matchingQueries.length,
      });

      for (const query of matchingQueries) {
        queryClient.setQueryData(query.queryKey, (oldData: any) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: [...oldData.data, newRow],
            total: (oldData.total || 0) + 1,
          };
        });
      }
    },
    [queryClient, entityCode, log]
  );

  /**
   * Remove a row from ALL matching TanStack Query caches for this entity.
   */
  const removeRowFromCache = useCallback(
    (rowId: string) => {
      const queryCache = queryClient.getQueryCache();
      const matchingQueries = queryCache.findAll({
        queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
      });

      log('Removing row from cache', {
        rowId,
        matchingQueries: matchingQueries.length,
      });

      for (const query of matchingQueries) {
        queryClient.setQueryData(query.queryKey, (oldData: any) => {
          if (!oldData?.data) return oldData;
          return {
            ...oldData,
            data: oldData.data.filter((item: any) => item.id !== rowId),
            total: Math.max(0, (oldData.total || 1) - 1),
          };
        });
      }
    },
    [queryClient, entityCode, log]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddRow = useCallback(
    (newRow: T) => {
      log('handleAddRow', { newRowId: newRow.id });

      // Add temp row directly to cache (single source of truth)
      addRowToCache(newRow);

      // Enter edit mode
      setEditingRow(newRow.id);
      setEditedData(newRow as Partial<T>);
      setIsAddingRow(true);
    },
    [addRowToCache, log]
  );

  const handleEditRow = useCallback(
    (record: T | { raw: T }) => {
      const rawRecord = extractRawRecord(record);
      log('handleEditRow', { rowId: rawRecord.id });

      // Enter edit mode (no cache modification - row already exists)
      setEditingRow(rawRecord.id);
      setEditedData(transformFromApi(rawRecord));
      setIsAddingRow(false);
    },
    [extractRawRecord, transformFromApi, log]
  );

  const handleFieldChange = useCallback(
    (field: string, value: unknown) => {
      log('handleFieldChange', { field, value });
      setEditedData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [log]
  );

  const handleSave = useCallback(
    async (record: T | { raw: T }) => {
      const rawRecord = extractRawRecord(record);
      const recordId = rawRecord.id;
      const isNewRow = isAddingRow || isTempRow(recordId);

      log('handleSave', { recordId, isNewRow, isAddingRow });

      // Transform data for API
      const transformedData = transformForApi(editedData, rawRecord);

      // Remove temporary fields
      delete (transformedData as any)._isNew;
      delete (transformedData as any)._isOptimistic;
      if (isNewRow) {
        delete (transformedData as any).id;
      }

      setIsSaving(true);

      try {
        let result: T;

        if (isNewRow) {
          // v11.3.0: Pass existingTempId to skip duplicate temp row in onMutate
          log('Creating new entity with existingTempId', { existingTempId: recordId });
          result = await createEntity(transformedData, { existingTempId: recordId });
        } else {
          // Update existing entity
          log('Updating existing entity', { recordId });
          result = await updateEntity(recordId, transformedData);
        }

        log('Save succeeded', { resultId: result.id });

        // Clear edit state
        setEditingRow(null);
        setEditedData({});
        setIsAddingRow(false);

        onSaveSuccess?.(result, isNewRow);
      } catch (error) {
        log('Save failed', { error: String(error) });

        // Clear edit state (error handling done by useOptimisticMutation)
        setEditingRow(null);
        setEditedData({});
        setIsAddingRow(false);

        onSaveError?.(error as Error, isNewRow);
      } finally {
        setIsSaving(false);
      }
    },
    [
      extractRawRecord,
      isAddingRow,
      isTempRow,
      editedData,
      transformForApi,
      createEntity,
      updateEntity,
      onSaveSuccess,
      onSaveError,
      log,
    ]
  );

  const handleCancel = useCallback(() => {
    log('handleCancel', { editingRow, isAddingRow });

    if (isAddingRow && editingRow) {
      // Remove temp row from cache
      removeRowFromCache(editingRow);
    }

    // Clear edit state
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);

    onCancel?.();
  }, [isAddingRow, editingRow, removeRowFromCache, onCancel, log]);

  const resetEditState = useCallback(() => {
    log('resetEditState');
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
    setIsSaving(false);
  }, [log]);

  // ─────────────────────────────────────────────────────────────────────────
  // Return
  // ─────────────────────────────────────────────────────────────────────────

  return {
    // State
    editingRow,
    editedData,
    isAddingRow,
    isSaving,

    // Actions
    handleAddRow,
    handleEditRow,
    handleFieldChange,
    handleSave,
    handleCancel,
    resetEditState,

    // Utilities
    isRowEditing,
    isTempRow,
    getFieldValue,
  };
}

// ============================================================================
// Factory for creating temp rows
// ============================================================================

export interface TempRowOptions<T> {
  /** Default values for the new row */
  defaults?: Partial<T>;

  /** Function to generate display name */
  generateName?: () => string;
}

/**
 * Create a temp row with a unique ID.
 * Used by table components to create new rows.
 *
 * @example
 * const newRow = createTempRow<Project>({
 *   defaults: { dl__project_stage: 'planning' },
 *   generateName: () => 'Untitled Project',
 * });
 */
export function createTempRow<T extends { id: string }>(
  options: TempRowOptions<T> = {}
): T {
  const { defaults = {}, generateName = () => 'Untitled' } = options;

  return {
    id: `temp_${Date.now()}`,
    name: generateName(),
    _isNew: true,
    ...defaults,
  } as T;
}

// ============================================================================
// Utility: Check if navigation should be blocked
// ============================================================================

/**
 * Check if navigation should be blocked for a row.
 * Temp rows cannot be navigated to (they don't exist on server).
 *
 * @example
 * const handleRowClick = (row) => {
 *   if (shouldBlockNavigation(row.id)) return;
 *   navigate(`/${entityCode}/${row.id}`);
 * };
 */
export function shouldBlockNavigation(rowId: string | undefined | null): boolean {
  return rowId?.toString().startsWith('temp_') ?? false;
}
