/**
 * Entity Edit Store - Hybrid Zustand + React Query
 *
 * This store manages the editing state for entities, providing:
 * - Field-level change tracking (only send changed fields)
 * - Optimistic updates with React Query integration
 * - Local persistence during edits
 * - Undo/redo capability
 * - Automatic cleanup on navigation
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import { getChangedFields, preparePatchData } from '../lib/changeDetection';
import { apiClient } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

interface EditState {
  // Entity being edited
  entityType: string | null;
  entityId: string | null;

  // Original data (from server)
  originalData: Record<string, any> | null;

  // Current edited data
  currentData: Record<string, any> | null;

  // Fields that have been modified
  dirtyFields: Set<string>;

  // Edit mode flag
  isEditing: boolean;

  // Save state
  isSaving: boolean;
  saveError: string | null;

  // Undo/redo stacks
  undoStack: Array<{ field: string; value: any }>;
  redoStack: Array<{ field: string; value: any }>;
}

interface EditActions {
  // Initialize editing session
  startEdit: (entityType: string, entityId: string, data: Record<string, any>) => void;

  // Field updates
  updateField: (fieldKey: string, value: any) => void;
  updateMultipleFields: (updates: Record<string, any>) => void;

  // Save changes (returns true if successful)
  saveChanges: () => Promise<boolean>;

  // Cancel editing
  cancelEdit: () => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Utilities
  hasChanges: () => boolean;
  getChanges: () => Record<string, any>;
  getFieldValue: (fieldKey: string) => any;
  isFieldDirty: (fieldKey: string) => boolean;

  // Reset
  reset: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useEntityEditStore = create<EditState & EditActions>()(
  subscribeWithSelector(
    devtools(
      (set, get) => ({
        // ========================================================================
        // Initial State
        // ========================================================================
        entityType: null,
        entityId: null,
        originalData: null,
        currentData: null,
        dirtyFields: new Set(),
        isEditing: false,
        isSaving: false,
        saveError: null,
        undoStack: [],
        redoStack: [],

        // ========================================================================
        // Actions
        // ========================================================================

        /**
         * Start editing an entity
         */
        startEdit: (entityType: string, entityId: string, data: Record<string, any>) => {
          console.log(`[EntityEditStore] Starting edit for ${entityType}/${entityId}`);

          set({
            entityType,
            entityId,
            originalData: { ...data },
            currentData: { ...data },
            dirtyFields: new Set(),
            isEditing: true,
            isSaving: false,
            saveError: null,
            undoStack: [],
            redoStack: []
          });
        },

        /**
         * Update a single field
         */
        updateField: (fieldKey: string, value: any) => {
          const state = get();
          if (!state.currentData || !state.isEditing) {
            console.warn('[EntityEditStore] Cannot update field - not in edit mode');
            return;
          }

          // Store previous value for undo
          const previousValue = state.currentData[fieldKey];
          const undoStack = [...state.undoStack, { field: fieldKey, value: previousValue }];

          // Update current data
          const currentData = {
            ...state.currentData,
            [fieldKey]: value
          };

          // Track dirty field
          const dirtyFields = new Set(state.dirtyFields);
          const isChanged = state.originalData && state.originalData[fieldKey] !== value;

          if (isChanged) {
            dirtyFields.add(fieldKey);
          } else {
            dirtyFields.delete(fieldKey);
          }

          console.log(`[EntityEditStore] Field updated: ${fieldKey}`, {
            old: previousValue,
            new: value,
            isDirty: isChanged
          });

          set({
            currentData,
            dirtyFields,
            undoStack,
            redoStack: [] // Clear redo stack on new change
          });
        },

        /**
         * Update multiple fields at once
         */
        updateMultipleFields: (updates: Record<string, any>) => {
          const state = get();
          if (!state.currentData || !state.isEditing) {
            console.warn('[EntityEditStore] Cannot update fields - not in edit mode');
            return;
          }

          // Store all changes for undo
          const undoEntries = Object.keys(updates).map(field => ({
            field,
            value: state.currentData[field]
          }));

          // Update current data
          const currentData = {
            ...state.currentData,
            ...updates
          };

          // Update dirty fields
          const dirtyFields = new Set(state.dirtyFields);
          Object.keys(updates).forEach(field => {
            const isChanged = state.originalData && state.originalData[field] !== updates[field];
            if (isChanged) {
              dirtyFields.add(field);
            } else {
              dirtyFields.delete(field);
            }
          });

          console.log(`[EntityEditStore] Multiple fields updated:`, Object.keys(updates));

          set({
            currentData,
            dirtyFields,
            undoStack: [...state.undoStack, ...undoEntries],
            redoStack: []
          });
        },

        /**
         * Save changes (PATCH with only changed fields)
         */
        saveChanges: async () => {
          const state = get();

          if (!state.entityType || !state.entityId || !state.currentData || !state.originalData) {
            console.error('[EntityEditStore] Cannot save - missing required data');
            return false;
          }

          // Get only changed fields
          const changes = preparePatchData(state.originalData, state.currentData);

          if (Object.keys(changes).length === 0) {
            console.log('[EntityEditStore] No changes to save');
            set({ isEditing: false });
            return true;
          }

          set({ isSaving: true, saveError: null });

          try {
            console.log(`[EntityEditStore] Saving ${Object.keys(changes).length} changed fields:`, changes);

            // Send PATCH request with only changed fields
            const response = await apiClient.patch(
              `/api/v1/${state.entityType}/${state.entityId}`,
              changes
            );

            const updatedData = response.data || response;

            console.log('[EntityEditStore] Save successful');

            // Update state with server response
            set({
              originalData: { ...updatedData },
              currentData: { ...updatedData },
              dirtyFields: new Set(),
              isEditing: false,
              isSaving: false,
              saveError: null,
              undoStack: [],
              redoStack: []
            });

            return true;
          } catch (error: any) {
            console.error('[EntityEditStore] Save failed:', error);

            const errorMessage = error.response?.data?.error ||
                               error.message ||
                               'Failed to save changes';

            set({
              isSaving: false,
              saveError: errorMessage
            });

            return false;
          }
        },

        /**
         * Cancel editing
         */
        cancelEdit: () => {
          const state = get();
          console.log('[EntityEditStore] Canceling edit');

          set({
            currentData: state.originalData ? { ...state.originalData } : null,
            dirtyFields: new Set(),
            isEditing: false,
            saveError: null,
            undoStack: [],
            redoStack: []
          });
        },

        /**
         * Undo last change
         */
        undo: () => {
          const state = get();
          if (state.undoStack.length === 0) return;

          const lastChange = state.undoStack[state.undoStack.length - 1];
          const undoStack = state.undoStack.slice(0, -1);

          // Store current value for redo
          const redoStack = [
            ...state.redoStack,
            { field: lastChange.field, value: state.currentData![lastChange.field] }
          ];

          // Apply undo
          const currentData = {
            ...state.currentData!,
            [lastChange.field]: lastChange.value
          };

          // Update dirty fields
          const dirtyFields = new Set(state.dirtyFields);
          const isChanged = state.originalData![lastChange.field] !== lastChange.value;
          if (isChanged) {
            dirtyFields.add(lastChange.field);
          } else {
            dirtyFields.delete(lastChange.field);
          }

          set({ currentData, dirtyFields, undoStack, redoStack });
        },

        /**
         * Redo last undone change
         */
        redo: () => {
          const state = get();
          if (state.redoStack.length === 0) return;

          const lastRedo = state.redoStack[state.redoStack.length - 1];
          const redoStack = state.redoStack.slice(0, -1);

          // Store current value for undo
          const undoStack = [
            ...state.undoStack,
            { field: lastRedo.field, value: state.currentData![lastRedo.field] }
          ];

          // Apply redo
          const currentData = {
            ...state.currentData!,
            [lastRedo.field]: lastRedo.value
          };

          // Update dirty fields
          const dirtyFields = new Set(state.dirtyFields);
          const isChanged = state.originalData![lastRedo.field] !== lastRedo.value;
          if (isChanged) {
            dirtyFields.add(lastRedo.field);
          } else {
            dirtyFields.delete(lastRedo.field);
          }

          set({ currentData, dirtyFields, undoStack, redoStack });
        },

        canUndo: () => get().undoStack.length > 0,
        canRedo: () => get().redoStack.length > 0,

        /**
         * Check if there are unsaved changes
         */
        hasChanges: () => {
          const state = get();
          return state.dirtyFields.size > 0;
        },

        /**
         * Get current changes
         */
        getChanges: () => {
          const state = get();
          if (!state.originalData || !state.currentData) return {};
          return getChangedFields(state.originalData, state.currentData);
        },

        /**
         * Get current value of a field
         */
        getFieldValue: (fieldKey: string) => {
          const state = get();
          return state.currentData?.[fieldKey];
        },

        /**
         * Check if a field is dirty
         */
        isFieldDirty: (fieldKey: string) => {
          const state = get();
          return state.dirtyFields.has(fieldKey);
        },

        /**
         * Reset store to initial state
         */
        reset: () => {
          console.log('[EntityEditStore] Resetting store');

          set({
            entityType: null,
            entityId: null,
            originalData: null,
            currentData: null,
            dirtyFields: new Set(),
            isEditing: false,
            isSaving: false,
            saveError: null,
            undoStack: [],
            redoStack: []
          });
        }
      }),
      {
        name: 'entity-edit-store'
      }
    )
  )
);

// ============================================================================
// React Query Integration Hook
// ============================================================================

/**
 * Hook that integrates Zustand edit store with React Query
 * Provides optimistic updates and cache invalidation
 */
export function useEntityEdit(entityType: string, entityId: string) {
  const queryClient = useQueryClient();
  const store = useEntityEditStore();

  const saveWithOptimisticUpdate = async () => {
    const changes = store.getChanges();

    if (Object.keys(changes).length === 0) {
      return true;
    }

    // Optimistically update React Query cache
    const queryKey = [entityType, entityId];
    await queryClient.cancelQueries({ queryKey });

    const previousData = queryClient.getQueryData(queryKey);

    queryClient.setQueryData(queryKey, (old: any) => ({
      ...old,
      data: { ...old?.data, ...changes }
    }));

    // Save changes via Zustand store
    const success = await store.saveChanges();

    if (!success) {
      // Rollback optimistic update on failure
      queryClient.setQueryData(queryKey, previousData);
    } else {
      // Invalidate queries to refetch from server
      queryClient.invalidateQueries({ queryKey });
    }

    return success;
  };

  return {
    ...store,
    saveWithOptimisticUpdate
  };
}

// ============================================================================
// Selectors for Performance
// ============================================================================

export const useIsEditing = () => useEntityEditStore(state => state.isEditing);
export const useIsSaving = () => useEntityEditStore(state => state.isSaving);
export const useHasChanges = () => useEntityEditStore(state => state.dirtyFields.size > 0);
export const useDirtyFields = () => useEntityEditStore(state => state.dirtyFields);
export const useEditError = () => useEntityEditStore(state => state.saveError);