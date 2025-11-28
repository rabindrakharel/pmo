// ============================================================================
// useDraft Hook
// ============================================================================
// Persists form edits in Dexie with undo/redo support
// Survives page refresh for draft recovery
// ============================================================================

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db, createDraftKey, type CachedDraft } from '../dexie/database';

// ============================================================================
// Types
// ============================================================================

interface UseDraftOptions {
  /** Maximum undo stack size */
  maxUndoStack?: number;
}

export interface UseDraftResult<T> {
  /** Current edited data */
  currentData: T;
  /** Has unsaved changes */
  hasChanges: boolean;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Update a single field */
  updateField: (field: string, value: unknown) => Promise<void>;
  /** Update multiple fields at once */
  updateFields: (updates: Partial<T>) => Promise<void>;
  /** Undo last change */
  undo: () => Promise<void>;
  /** Redo last undone change */
  redo: () => Promise<void>;
  /** Reset to original data */
  reset: () => Promise<void>;
  /** Discard draft entirely */
  discard: () => Promise<void>;
  /** Loading draft from IndexedDB */
  isDraftLoading: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for persisting form edits with undo/redo
 *
 * Features:
 * - Persists edits to IndexedDB via Dexie
 * - Survives page refresh
 * - Undo/redo support with configurable stack size
 * - Reactive updates via useLiveQuery
 *
 * @param entityCode - Entity type code
 * @param entityId - Entity instance UUID
 * @param originalData - Original data before edits
 * @param options - Configuration options
 *
 * @example
 * const { currentData, updateField, hasChanges, undo, redo } = useDraft(
 *   'project',
 *   projectId,
 *   originalProjectData
 * );
 *
 * // Update a field
 * await updateField('name', 'New Project Name');
 *
 * // Undo last change
 * await undo();
 */
export function useDraft<T extends Record<string, unknown>>(
  entityCode: string,
  entityId: string | undefined,
  originalData?: T,
  options: UseDraftOptions = {}
): UseDraftResult<T> {
  const { maxUndoStack = 50 } = options;
  const draftId = entityId ? createDraftKey(entityCode, entityId) : undefined;

  // Reactive draft from Dexie - auto-updates when IndexedDB changes
  const draft = useLiveQuery(
    async () => {
      if (!draftId) return null;
      return db.drafts.get(draftId);
    },
    [draftId]
  );

  // Current data is draft data or original
  const currentData = useMemo(
    () => (draft?.currentData ?? originalData) as T,
    [draft, originalData]
  );

  // Check for changes by comparing with original
  const hasChanges = useMemo(() => {
    if (!draft || !originalData) return false;
    return JSON.stringify(draft.currentData) !== JSON.stringify(originalData);
  }, [draft, originalData]);

  // Update a single field
  const updateField = useCallback(
    async (field: string, value: unknown): Promise<void> => {
      if (!draftId || !originalData) return;

      const existing = await db.drafts.get(draftId);
      const prevData = existing?.currentData ?? originalData;
      const newData = { ...prevData, [field]: value };

      // Limit undo stack size
      const undoStack = [...(existing?.undoStack ?? []), prevData].slice(-maxUndoStack);

      await db.drafts.put({
        _id: draftId,
        entityCode,
        entityId: entityId!,
        originalData: originalData as Record<string, unknown>,
        currentData: newData,
        undoStack,
        redoStack: [], // Clear redo on new change
        updatedAt: Date.now(),
      });
    },
    [draftId, entityCode, entityId, originalData, maxUndoStack]
  );

  // Update multiple fields at once
  const updateFields = useCallback(
    async (updates: Partial<T>): Promise<void> => {
      if (!draftId || !originalData) return;

      const existing = await db.drafts.get(draftId);
      const prevData = existing?.currentData ?? originalData;
      const newData = { ...prevData, ...updates };

      const undoStack = [...(existing?.undoStack ?? []), prevData].slice(-maxUndoStack);

      await db.drafts.put({
        _id: draftId,
        entityCode,
        entityId: entityId!,
        originalData: originalData as Record<string, unknown>,
        currentData: newData,
        undoStack,
        redoStack: [],
        updatedAt: Date.now(),
      });
    },
    [draftId, entityCode, entityId, originalData, maxUndoStack]
  );

  // Undo last change
  const undo = useCallback(async (): Promise<void> => {
    if (!draftId) return;

    const existing = await db.drafts.get(draftId);
    if (!existing?.undoStack.length) return;

    const prevData = existing.undoStack[existing.undoStack.length - 1];

    await db.drafts.put({
      ...existing,
      currentData: prevData,
      undoStack: existing.undoStack.slice(0, -1),
      redoStack: [...existing.redoStack, existing.currentData],
      updatedAt: Date.now(),
    });
  }, [draftId]);

  // Redo last undone change
  const redo = useCallback(async (): Promise<void> => {
    if (!draftId) return;

    const existing = await db.drafts.get(draftId);
    if (!existing?.redoStack.length) return;

    const nextData = existing.redoStack[existing.redoStack.length - 1];

    await db.drafts.put({
      ...existing,
      currentData: nextData,
      undoStack: [...existing.undoStack, existing.currentData],
      redoStack: existing.redoStack.slice(0, -1),
      updatedAt: Date.now(),
    });
  }, [draftId]);

  // Reset to original data
  const reset = useCallback(async (): Promise<void> => {
    if (!draftId || !originalData) return;

    const existing = await db.drafts.get(draftId);
    if (!existing) return;

    await db.drafts.put({
      ...existing,
      currentData: originalData as Record<string, unknown>,
      undoStack: [...existing.undoStack, existing.currentData],
      redoStack: [],
      updatedAt: Date.now(),
    });
  }, [draftId, originalData]);

  // Discard draft entirely (remove from IndexedDB)
  const discard = useCallback(async (): Promise<void> => {
    if (draftId) {
      await db.drafts.delete(draftId);
    }
  }, [draftId]);

  return {
    currentData,
    hasChanges,
    canUndo: (draft?.undoStack.length ?? 0) > 0,
    canRedo: (draft?.redoStack.length ?? 0) > 0,
    updateField,
    updateFields,
    undo,
    redo,
    reset,
    discard,
    isDraftLoading: draft === undefined,
  };
}

// ============================================================================
// Recover Drafts Hook
// ============================================================================

export interface DraftInfo {
  id: string;
  entityCode: string;
  entityId: string;
  updatedAt: number;
  hasChanges: boolean;
}

export interface UseRecoverDraftsResult {
  /** List of saved drafts */
  drafts: DraftInfo[];
  /** Has any drafts */
  hasDrafts: boolean;
  /** Get a specific draft */
  getDraft: (entityCode: string, entityId: string) => Promise<CachedDraft | undefined>;
  /** Discard a specific draft */
  discardDraft: (entityCode: string, entityId: string) => Promise<void>;
  /** Discard all drafts */
  discardAllDrafts: () => Promise<void>;
}

/**
 * Hook for recovering unsaved drafts
 *
 * Use on page load to check for and recover unsaved edits
 *
 * @example
 * const { drafts, hasDrafts, getDraft } = useRecoverDrafts();
 *
 * if (hasDrafts) {
 *   // Show recovery UI
 *   for (const draft of drafts) {
 *     console.log(`Unsaved ${draft.entityCode} from ${new Date(draft.updatedAt)}`);
 *   }
 * }
 */
export function useRecoverDrafts(): UseRecoverDraftsResult {
  // Reactive list of all drafts
  const allDrafts = useLiveQuery(
    () => db.drafts.orderBy('updatedAt').reverse().toArray()
  );

  // Map to DraftInfo for simpler display
  const drafts: DraftInfo[] = useMemo(
    () =>
      (allDrafts ?? []).map((draft) => ({
        id: draft._id,
        entityCode: draft.entityCode,
        entityId: draft.entityId,
        updatedAt: draft.updatedAt,
        hasChanges:
          JSON.stringify(draft.currentData) !==
          JSON.stringify(draft.originalData),
      })),
    [allDrafts]
  );

  const getDraft = useCallback(
    async (entityCode: string, entityId: string): Promise<CachedDraft | undefined> => {
      return db.drafts.get(createDraftKey(entityCode, entityId));
    },
    []
  );

  const discardDraft = useCallback(
    async (entityCode: string, entityId: string): Promise<void> => {
      await db.drafts.delete(createDraftKey(entityCode, entityId));
    },
    []
  );

  const discardAllDrafts = useCallback(async (): Promise<void> => {
    await db.drafts.clear();
  }, []);

  return {
    drafts,
    hasDrafts: drafts.length > 0,
    getDraft,
    discardDraft,
    discardAllDrafts,
  };
}
