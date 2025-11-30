// ============================================================================
// useDraft Hook
// ============================================================================
// Persists form edits in Dexie with undo/redo support
// Survives page refresh for draft recovery
// ============================================================================

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useMemo } from 'react';
import { db, createDraftKey, type DraftRecord } from '../dexie/database';

// ============================================================================
// Types
// ============================================================================

interface UseDraftOptions {
  /** Maximum undo stack size */
  maxUndoStack?: number;
}

export interface UseDraftResult<T> {
  /** Whether a draft exists (in edit mode) */
  hasDraft: boolean;
  /** Current edited data */
  currentData: T;
  /** Set of fields that have been modified */
  dirtyFields: Set<string>;
  /** Has unsaved changes */
  hasChanges: boolean;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Start editing with original data */
  startEdit: (originalData: T) => Promise<void>;
  /** Update a single field */
  updateField: (field: string, value: unknown) => Promise<void>;
  /** Update multiple fields at once */
  updateMultipleFields: (updates: Partial<T>) => Promise<void>;
  /** Get only the changed fields */
  getChanges: () => Partial<T>;
  /** Undo last change */
  undo: () => Promise<void>;
  /** Redo last undone change */
  redo: () => Promise<void>;
  /** Reset to original data */
  reset: () => Promise<void>;
  /** Discard draft entirely */
  discardDraft: () => Promise<void>;
  /** Loading draft from IndexedDB */
  isLoading: boolean;
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
      return db.draft.get(draftId);
    },
    [draftId]
  );

  // Whether a draft exists (in edit mode)
  const hasDraft = !!draft;

  // Current data is draft data or original
  const currentData = useMemo(
    () => (draft?.currentData ?? originalData ?? {}) as T,
    [draft, originalData]
  );

  // Calculate dirty fields by comparing current with original
  const dirtyFields = useMemo(() => {
    const dirty = new Set<string>();
    if (!draft?.currentData || !draft?.originalData) return dirty;

    const original = draft.originalData as Record<string, unknown>;
    const current = draft.currentData as Record<string, unknown>;

    for (const key of Object.keys(current)) {
      if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
        dirty.add(key);
      }
    }
    return dirty;
  }, [draft]);

  // Check for changes by comparing with original
  const hasChanges = useMemo(() => {
    if (!draft) return false;
    return JSON.stringify(draft.currentData) !== JSON.stringify(draft.originalData);
  }, [draft]);

  // Get only the changed fields
  const getChanges = useCallback((): Partial<T> => {
    if (!draft?.currentData || !draft?.originalData) return {} as Partial<T>;

    const original = draft.originalData as Record<string, unknown>;
    const current = draft.currentData as Record<string, unknown>;
    const changes: Record<string, unknown> = {};

    for (const key of Object.keys(current)) {
      if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
        changes[key] = current[key];
      }
    }
    return changes as Partial<T>;
  }, [draft]);

  // Start editing with original data (creates a new draft)
  const startEdit = useCallback(
    async (data: T): Promise<void> => {
      if (!draftId) return;

      await db.draft.put({
        _id: draftId,
        entityCode,
        entityId: entityId!,
        originalData: data as Record<string, unknown>,
        currentData: data as Record<string, unknown>,
        undoStack: [],
        redoStack: [],
        updatedAt: Date.now(),
      });
    },
    [draftId, entityCode, entityId]
  );

  // Update a single field
  const updateField = useCallback(
    async (field: string, value: unknown): Promise<void> => {
      if (!draftId) return;

      const existing = await db.draft.get(draftId);
      if (!existing) {
        console.warn('[useDraft] No draft exists. Call startEdit first.');
        return;
      }

      const prevData = existing.currentData;
      const newData = { ...prevData, [field]: value };

      // Limit undo stack size
      const undoStack = [...existing.undoStack, prevData].slice(-maxUndoStack);

      await db.draft.put({
        ...existing,
        currentData: newData,
        undoStack,
        redoStack: [], // Clear redo on new change
        updatedAt: Date.now(),
      });
    },
    [draftId, maxUndoStack]
  );

  // Update multiple fields at once
  const updateMultipleFields = useCallback(
    async (updates: Partial<T>): Promise<void> => {
      if (!draftId) return;

      const existing = await db.draft.get(draftId);
      if (!existing) {
        console.warn('[useDraft] No draft exists. Call startEdit first.');
        return;
      }

      const prevData = existing.currentData;
      const newData = { ...prevData, ...updates };

      const undoStack = [...existing.undoStack, prevData].slice(-maxUndoStack);

      await db.draft.put({
        ...existing,
        currentData: newData,
        undoStack,
        redoStack: [],
        updatedAt: Date.now(),
      });
    },
    [draftId, maxUndoStack]
  );

  // Undo last change
  const undo = useCallback(async (): Promise<void> => {
    if (!draftId) return;

    const existing = await db.draft.get(draftId);
    if (!existing?.undoStack.length) return;

    const prevData = existing.undoStack[existing.undoStack.length - 1];

    await db.draft.put({
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

    const existing = await db.draft.get(draftId);
    if (!existing?.redoStack.length) return;

    const nextData = existing.redoStack[existing.redoStack.length - 1];

    await db.draft.put({
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

    const existing = await db.draft.get(draftId);
    if (!existing) return;

    await db.draft.put({
      ...existing,
      currentData: originalData as Record<string, unknown>,
      undoStack: [...existing.undoStack, existing.currentData],
      redoStack: [],
      updatedAt: Date.now(),
    });
  }, [draftId, originalData]);

  // Discard draft entirely (remove from IndexedDB)
  const discardDraft = useCallback(async (): Promise<void> => {
    if (draftId) {
      await db.draft.delete(draftId);
    }
  }, [draftId]);

  return {
    hasDraft,
    currentData,
    dirtyFields,
    hasChanges,
    canUndo: (draft?.undoStack.length ?? 0) > 0,
    canRedo: (draft?.redoStack.length ?? 0) > 0,
    startEdit,
    updateField,
    updateMultipleFields,
    getChanges,
    undo,
    redo,
    reset,
    discardDraft,
    isLoading: draft === undefined,
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
  getDraft: (entityCode: string, entityId: string) => Promise<DraftRecord | undefined>;
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
    () => db.draft.orderBy('updatedAt').reverse().toArray()
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
    async (entityCode: string, entityId: string): Promise<DraftRecord | undefined> => {
      return db.draft.get(createDraftKey(entityCode, entityId));
    },
    []
  );

  const discardDraft = useCallback(
    async (entityCode: string, entityId: string): Promise<void> => {
      await db.draft.delete(createDraftKey(entityCode, entityId));
    },
    []
  );

  const discardAllDrafts = useCallback(async (): Promise<void> => {
    await db.draft.clear();
  }, []);

  return {
    drafts,
    hasDrafts: drafts.length > 0,
    getDraft,
    discardDraft,
    discardAllDrafts,
  };
}
