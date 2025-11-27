/**
 * useEntityEditState - Entity Editing State with Undo/Redo
 *
 * REPLACES: useEntityEditStore.ts (Zustand)
 *
 * Migration Notes:
 * - Before: Zustand store (in-memory, no persistence)
 * - After: RxDB local document (persists across refresh)
 * - Benefit: Draft edits survive browser refresh!
 */
import { useCallback, useMemo } from 'react';
import { useRxState } from './useRxState';
import { useDatabase } from './useDatabase';
import {
  EditStateLocal,
  DEFAULT_EDIT_STATE,
  LocalDocKeys
} from '../schemas/localDocuments';
import type { PMODatabaseCollections } from '../index';
import type { RxCollection } from 'rxdb';

// ============================================================================
// Types
// ============================================================================

export interface UseEntityEditStateResult {
  // State
  isEditing: boolean;
  currentData: Record<string, unknown>;
  originalData: Record<string, unknown>;
  dirtyFields: string[];
  isLoading: boolean;

  // Actions
  startEdit: (data: Record<string, unknown>) => Promise<void>;
  updateField: (field: string, value: unknown) => Promise<void>;
  updateMultipleFields: (updates: Record<string, unknown>) => Promise<void>;
  saveChanges: () => Promise<boolean>;
  cancelEdit: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // Computed
  hasChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;

  // Field helpers
  getFieldValue: (field: string) => unknown;
  isFieldDirty: (field: string) => boolean;
  getChanges: () => Record<string, unknown>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Manage entity edit state with undo/redo and persistence
 *
 * @param entityType - Entity type code (e.g., 'project')
 * @param entityId - Entity instance UUID
 * @returns Edit state and actions
 *
 * @example
 * const {
 *   isEditing,
 *   currentData,
 *   startEdit,
 *   updateField,
 *   saveChanges,
 *   cancelEdit,
 *   undo,
 *   redo,
 *   hasChanges
 * } = useEntityEditState('project', projectId);
 *
 * // Start editing
 * await startEdit(entityData);
 *
 * // Update a field
 * await updateField('name', 'New Name');
 *
 * // Undo
 * await undo();
 *
 * // Save
 * const success = await saveChanges();
 */
export function useEntityEditState(
  entityType: string,
  entityId: string
): UseEntityEditStateResult {
  const localKey = LocalDocKeys.editState(entityType, entityId);
  const db = useDatabase();

  const defaultValue: EditStateLocal = {
    ...DEFAULT_EDIT_STATE,
    entityType,
    entityId
  };

  const { state, setState, isLoading, clear } = useRxState<EditStateLocal>(
    localKey,
    defaultValue
  );

  // ========================================
  // Actions
  // ========================================

  const startEdit = useCallback(async (data: Record<string, unknown>) => {
    await setState({
      entityType,
      entityId,
      originalData: { ...data },
      currentData: { ...data },
      dirtyFields: [],
      isEditing: true,
      undoStack: [],
      redoStack: [],
      _updatedAt: Date.now()
    });
  }, [setState, entityType, entityId]);

  const updateField = useCallback(async (field: string, value: unknown) => {
    const { currentData, originalData, dirtyFields, undoStack } = state;

    if (!state.isEditing) {
      console.warn('[useEntityEditState] Cannot update field - not in edit mode');
      return;
    }

    // Add to undo stack
    const newUndoStack = [...undoStack, { field, value: currentData[field] }];

    // Update current data
    const newCurrentData = { ...currentData, [field]: value };

    // Update dirty fields
    const isChanged = originalData[field] !== value;
    const newDirtyFields = isChanged
      ? [...new Set([...dirtyFields, field])]
      : dirtyFields.filter(f => f !== field);

    await setState({
      currentData: newCurrentData,
      dirtyFields: newDirtyFields,
      undoStack: newUndoStack,
      redoStack: [],  // Clear redo on new change
      _updatedAt: Date.now()
    });
  }, [state, setState]);

  const updateMultipleFields = useCallback(async (updates: Record<string, unknown>) => {
    const { currentData, originalData, dirtyFields, undoStack } = state;

    if (!state.isEditing) {
      console.warn('[useEntityEditState] Cannot update fields - not in edit mode');
      return;
    }

    // Add all changes to undo stack
    const newUndoEntries = Object.keys(updates).map(field => ({
      field,
      value: currentData[field]
    }));

    const newCurrentData = { ...currentData, ...updates };

    // Update dirty fields
    const newDirtyFields = new Set(dirtyFields);
    Object.keys(updates).forEach(field => {
      const isChanged = originalData[field] !== updates[field];
      if (isChanged) {
        newDirtyFields.add(field);
      } else {
        newDirtyFields.delete(field);
      }
    });

    await setState({
      currentData: newCurrentData,
      dirtyFields: [...newDirtyFields],
      undoStack: [...undoStack, ...newUndoEntries],
      redoStack: [],
      _updatedAt: Date.now()
    });
  }, [state, setState]);

  const undo = useCallback(async () => {
    const { undoStack, redoStack, currentData, originalData, dirtyFields } = state;
    if (undoStack.length === 0) return;

    const lastChange = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const newRedoStack = [...redoStack, {
      field: lastChange.field,
      value: currentData[lastChange.field]
    }];

    const newCurrentData = { ...currentData, [lastChange.field]: lastChange.value };

    // Update dirty fields
    const isChanged = originalData[lastChange.field] !== lastChange.value;
    const newDirtyFields = isChanged
      ? [...new Set([...dirtyFields, lastChange.field])]
      : dirtyFields.filter(f => f !== lastChange.field);

    await setState({
      currentData: newCurrentData,
      dirtyFields: newDirtyFields,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      _updatedAt: Date.now()
    });
  }, [state, setState]);

  const redo = useCallback(async () => {
    const { undoStack, redoStack, currentData, originalData, dirtyFields } = state;
    if (redoStack.length === 0) return;

    const lastRedo = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const newUndoStack = [...undoStack, {
      field: lastRedo.field,
      value: currentData[lastRedo.field]
    }];

    const newCurrentData = { ...currentData, [lastRedo.field]: lastRedo.value };

    // Update dirty fields
    const isChanged = originalData[lastRedo.field] !== lastRedo.value;
    const newDirtyFields = isChanged
      ? [...new Set([...dirtyFields, lastRedo.field])]
      : dirtyFields.filter(f => f !== lastRedo.field);

    await setState({
      currentData: newCurrentData,
      dirtyFields: newDirtyFields,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      _updatedAt: Date.now()
    });
  }, [state, setState]);

  const saveChanges = useCallback(async (): Promise<boolean> => {
    const { currentData, dirtyFields } = state;

    if (dirtyFields.length === 0) {
      await clear();
      return true;
    }

    // Build patch with only changed fields
    const patch: Record<string, unknown> = {};
    dirtyFields.forEach(field => {
      patch[field] = currentData[field];
    });

    try {
      // Update local RxDB collection
      const collection = db.collections[entityType as keyof PMODatabaseCollections];
      if (collection) {
        const doc = await (collection as RxCollection<Record<string, unknown>>).findOne(entityId).exec();
        if (doc) {
          await doc.patch({
            ...patch,
            updated_ts: new Date().toISOString()
          });
        }
      }

      // Clear edit state
      await clear();

      console.log('[useEntityEditState] Save successful');
      return true;
    } catch (error) {
      console.error('[useEntityEditState] Save failed:', error);
      return false;
    }
  }, [state, db, entityType, entityId, clear]);

  const cancelEdit = useCallback(async () => {
    await clear();
  }, [clear]);

  // ========================================
  // Computed Values
  // ========================================

  const hasChanges = state.dirtyFields.length > 0;
  const canUndo = state.undoStack.length > 0;
  const canRedo = state.redoStack.length > 0;

  const getFieldValue = useCallback((field: string): unknown => {
    return state.currentData[field];
  }, [state.currentData]);

  const isFieldDirty = useCallback((field: string): boolean => {
    return state.dirtyFields.includes(field);
  }, [state.dirtyFields]);

  const getChanges = useCallback((): Record<string, unknown> => {
    const changes: Record<string, unknown> = {};
    state.dirtyFields.forEach(field => {
      changes[field] = state.currentData[field];
    });
    return changes;
  }, [state.dirtyFields, state.currentData]);

  return {
    // State
    isEditing: state.isEditing,
    currentData: state.currentData,
    originalData: state.originalData,
    dirtyFields: state.dirtyFields,
    isLoading,

    // Actions
    startEdit,
    updateField,
    updateMultipleFields,
    saveChanges,
    cancelEdit,
    undo,
    redo,

    // Computed
    hasChanges,
    canUndo,
    canRedo,

    // Helpers
    getFieldValue,
    isFieldDirty,
    getChanges
  };
}

/**
 * Selectors for specific state (avoids re-renders)
 */
export function useIsEditing(entityType: string, entityId: string): boolean {
  const { isEditing } = useEntityEditState(entityType, entityId);
  return isEditing;
}

export function useHasChanges(entityType: string, entityId: string): boolean {
  const { hasChanges } = useEntityEditState(entityType, entityId);
  return hasChanges;
}
