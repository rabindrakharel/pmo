// ============================================================================
// RxDB Draft Hooks
// ============================================================================
// Persists unsaved edits so they survive page refresh
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { type RxDocument } from 'rxdb';
import { getDatabase } from '../database';
import { createDraftId, type DraftDocType } from '../schemas/draft.schema';

// ============================================================================
// Types
// ============================================================================

export interface UseRxDraftResult {
  // Draft state
  hasDraft: boolean;
  originalData: Record<string, unknown> | null;
  currentData: Record<string, unknown> | null;
  dirtyFields: string[];
  hasChanges: boolean;

  // Actions
  startEdit: (data: Record<string, unknown>) => Promise<void>;
  updateField: (field: string, value: unknown) => Promise<void>;
  updateMultipleFields: (updates: Record<string, unknown>) => Promise<void>;
  discardDraft: () => Promise<void>;
  getChanges: () => Record<string, unknown>;

  // Undo/Redo
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;

  // Loading state
  isLoading: boolean;
}

// ============================================================================
// useRxDraft - Draft Persistence
// ============================================================================

/**
 * Hook for managing entity drafts with persistence
 * Drafts survive page refresh and browser restart
 */
export function useRxDraft(
  entityCode: string,
  entityId: string | undefined
): UseRxDraftResult {
  const [draft, setDraft] = useState<RxDocument<DraftDocType> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to draft document
  useEffect(() => {
    if (!entityId) {
      setIsLoading(false);
      return;
    }

    const draftId = createDraftId(entityCode, entityId);

    getDatabase().then(db => {
      const subscription = db.drafts
        .findOne(draftId)
        .$.subscribe(rxDoc => {
          setDraft(rxDoc && !rxDoc._deleted ? rxDoc : null);
          setIsLoading(false);
        });

      return () => subscription.unsubscribe();
    });
  }, [entityCode, entityId]);

  /**
   * Start editing an entity (creates draft)
   */
  const startEdit = useCallback(async (data: Record<string, unknown>) => {
    if (!entityId) return;

    const db = await getDatabase();
    const draftId = createDraftId(entityCode, entityId);
    const now = Date.now();

    await db.drafts.upsert({
      _id: draftId,
      entityCode,
      entityId,
      originalData: { ...data },
      currentData: { ...data },
      dirtyFields: [],
      undoStack: [],
      redoStack: [],
      createdAt: now,
      updatedAt: now,
      _deleted: false,
    });

    console.log(`[RxDraft] Started editing ${entityCode}/${entityId}`);
  }, [entityCode, entityId]);

  /**
   * Update a single field
   */
  const updateField = useCallback(async (field: string, value: unknown) => {
    if (!draft || !entityId) return;

    const previousValue = draft.currentData[field];
    const isChanged = draft.originalData[field] !== value;

    // Update dirty fields
    const dirtyFields = [...draft.dirtyFields];
    if (isChanged && !dirtyFields.includes(field)) {
      dirtyFields.push(field);
    } else if (!isChanged) {
      const idx = dirtyFields.indexOf(field);
      if (idx > -1) dirtyFields.splice(idx, 1);
    }

    // Add to undo stack
    const undoStack = [...draft.undoStack, { field, value: previousValue }];

    await draft.patch({
      currentData: { ...draft.currentData, [field]: value },
      dirtyFields,
      undoStack,
      redoStack: [], // Clear redo on new change
      updatedAt: Date.now(),
    });

    console.log(`[RxDraft] Field updated: ${field}`, { old: previousValue, new: value });
  }, [draft, entityId]);

  /**
   * Update multiple fields at once
   */
  const updateMultipleFields = useCallback(async (updates: Record<string, unknown>) => {
    if (!draft || !entityId) return;

    // Build undo entries
    const undoEntries = Object.keys(updates).map(field => ({
      field,
      value: draft.currentData[field],
    }));

    // Update dirty fields
    const dirtyFields = [...draft.dirtyFields];
    Object.keys(updates).forEach(field => {
      const isChanged = draft.originalData[field] !== updates[field];
      if (isChanged && !dirtyFields.includes(field)) {
        dirtyFields.push(field);
      } else if (!isChanged) {
        const idx = dirtyFields.indexOf(field);
        if (idx > -1) dirtyFields.splice(idx, 1);
      }
    });

    await draft.patch({
      currentData: { ...draft.currentData, ...updates },
      dirtyFields,
      undoStack: [...draft.undoStack, ...undoEntries],
      redoStack: [],
      updatedAt: Date.now(),
    });

    console.log(`[RxDraft] Multiple fields updated:`, Object.keys(updates));
  }, [draft, entityId]);

  /**
   * Discard draft (cancel editing)
   */
  const discardDraft = useCallback(async () => {
    if (!draft) return;

    await draft.remove();
    console.log(`[RxDraft] Draft discarded for ${entityCode}/${entityId}`);
  }, [draft, entityCode, entityId]);

  /**
   * Get changed fields (for PATCH)
   */
  const getChanges = useCallback((): Record<string, unknown> => {
    if (!draft) return {};

    const changes: Record<string, unknown> = {};
    for (const field of draft.dirtyFields) {
      changes[field] = draft.currentData[field];
    }
    return changes;
  }, [draft]);

  /**
   * Undo last change
   */
  const undo = useCallback(async () => {
    if (!draft || draft.undoStack.length === 0) return;

    const undoStack = [...draft.undoStack];
    const lastChange = undoStack.pop()!;

    // Store current value for redo
    const redoStack = [
      ...draft.redoStack,
      { field: lastChange.field, value: draft.currentData[lastChange.field] },
    ];

    // Apply undo
    const currentData = { ...draft.currentData, [lastChange.field]: lastChange.value };

    // Update dirty fields
    const dirtyFields = [...draft.dirtyFields];
    const isChanged = draft.originalData[lastChange.field] !== lastChange.value;
    if (isChanged && !dirtyFields.includes(lastChange.field)) {
      dirtyFields.push(lastChange.field);
    } else if (!isChanged) {
      const idx = dirtyFields.indexOf(lastChange.field);
      if (idx > -1) dirtyFields.splice(idx, 1);
    }

    await draft.patch({
      currentData,
      dirtyFields,
      undoStack,
      redoStack,
      updatedAt: Date.now(),
    });

    console.log(`[RxDraft] Undo: ${lastChange.field}`);
  }, [draft]);

  /**
   * Redo last undone change
   */
  const redo = useCallback(async () => {
    if (!draft || draft.redoStack.length === 0) return;

    const redoStack = [...draft.redoStack];
    const lastRedo = redoStack.pop()!;

    // Store current value for undo
    const undoStack = [
      ...draft.undoStack,
      { field: lastRedo.field, value: draft.currentData[lastRedo.field] },
    ];

    // Apply redo
    const currentData = { ...draft.currentData, [lastRedo.field]: lastRedo.value };

    // Update dirty fields
    const dirtyFields = [...draft.dirtyFields];
    const isChanged = draft.originalData[lastRedo.field] !== lastRedo.value;
    if (isChanged && !dirtyFields.includes(lastRedo.field)) {
      dirtyFields.push(lastRedo.field);
    } else if (!isChanged) {
      const idx = dirtyFields.indexOf(lastRedo.field);
      if (idx > -1) dirtyFields.splice(idx, 1);
    }

    await draft.patch({
      currentData,
      dirtyFields,
      undoStack,
      redoStack,
      updatedAt: Date.now(),
    });

    console.log(`[RxDraft] Redo: ${lastRedo.field}`);
  }, [draft]);

  return {
    hasDraft: !!draft,
    originalData: draft?.originalData ?? null,
    currentData: draft?.currentData ?? null,
    dirtyFields: draft?.dirtyFields ?? [],
    hasChanges: (draft?.dirtyFields.length ?? 0) > 0,

    startEdit,
    updateField,
    updateMultipleFields,
    discardDraft,
    getChanges,

    undo,
    redo,
    canUndo: (draft?.undoStack.length ?? 0) > 0,
    canRedo: (draft?.redoStack.length ?? 0) > 0,

    isLoading,
  };
}

// ============================================================================
// useRecoverDraft - Check for existing draft on mount
// ============================================================================

/**
 * Hook to check if there's an existing draft to recover
 */
export function useRecoverDraft(entityCode: string, entityId: string | undefined) {
  const [hasDraft, setHasDraft] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!entityId) {
      setIsChecking(false);
      return;
    }

    getDatabase().then(async db => {
      const draftId = createDraftId(entityCode, entityId);
      const draft = await db.drafts.findOne(draftId).exec();
      setHasDraft(!!draft && !draft._deleted && draft.dirtyFields.length > 0);
      setIsChecking(false);
    });
  }, [entityCode, entityId]);

  return { hasDraft, isChecking };
}
