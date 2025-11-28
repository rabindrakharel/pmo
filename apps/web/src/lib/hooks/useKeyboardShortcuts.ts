/**
 * Keyboard Shortcuts Hook (v8.6.0 - RxDB Draft Integration)
 *
 * Provides keyboard shortcut handling for entity editing:
 * - Ctrl+Z / Cmd+Z: Undo
 * - Ctrl+Shift+Z / Cmd+Shift+Z: Redo
 * - Ctrl+S / Cmd+S: Save
 * - Escape: Cancel edit
 *
 * v8.6.0: Refactored to accept draft state via options (no store dependency)
 * Consumer passes state from useRxDraft hook.
 */

import { useEffect, useCallback, useRef } from 'react';

interface KeyboardShortcutOptions {
  /** Enable undo shortcut (Ctrl+Z / Cmd+Z) */
  enableUndo?: boolean;
  /** Enable redo shortcut (Ctrl+Shift+Z / Cmd+Shift+Z) */
  enableRedo?: boolean;
  /** Enable save shortcut (Ctrl+S / Cmd+S) */
  enableSave?: boolean;
  /** Enable escape to cancel (Escape) */
  enableEscape?: boolean;

  /** Custom save handler */
  onSave?: () => Promise<void> | void;
  /** Custom cancel handler */
  onCancel?: () => void;
  /** Undo handler (from useRxDraft) */
  onUndo?: () => void;
  /** Redo handler (from useRxDraft) */
  onRedo?: () => void;

  /** Is currently in edit mode */
  isEditing?: boolean;
  /** Can undo (from useRxDraft.canUndo) */
  canUndo?: boolean;
  /** Can redo (from useRxDraft.canRedo) */
  canRedo?: boolean;
  /** Has unsaved changes (from useRxDraft.hasChanges) */
  hasChanges?: boolean;

  /** Only active when editing (default: true) */
  activeWhenEditing?: boolean;
}

/**
 * Hook for handling keyboard shortcuts in entity editing
 *
 * @example
 * // With useRxDraft
 * const draft = useRxDraft(entityCode, entityId);
 * useKeyboardShortcuts({
 *   isEditing: draft.hasDraft,
 *   canUndo: draft.canUndo,
 *   canRedo: draft.canRedo,
 *   hasChanges: draft.hasChanges,
 *   onUndo: draft.undo,
 *   onRedo: draft.redo,
 *   onSave: handleSave,
 *   onCancel: () => draft.discardDraft(),
 * });
 */
export function useKeyboardShortcuts(options: KeyboardShortcutOptions = {}) {
  const {
    enableUndo = true,
    enableRedo = true,
    enableSave = true,
    enableEscape = true,
    onSave,
    onCancel,
    onUndo,
    onRedo,
    isEditing = false,
    canUndo = false,
    canRedo = false,
    hasChanges = false,
    activeWhenEditing = true,
  } = options;

  // Use refs to store callbacks to avoid dependency changes
  const onSaveRef = useRef(onSave);
  const onCancelRef = useRef(onCancel);
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);

  useEffect(() => {
    onSaveRef.current = onSave;
    onCancelRef.current = onCancel;
    onUndoRef.current = onUndo;
    onRedoRef.current = onRedo;
  }, [onSave, onCancel, onUndo, onRedo]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Only handle shortcuts when editing (if configured)
      if (activeWhenEditing && !isEditing) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl+Z / Cmd+Z: Undo
      if (enableUndo && modifier && event.key === 'z' && !event.shiftKey) {
        if (canUndo && onUndoRef.current) {
          event.preventDefault();
          onUndoRef.current();
          console.log('[Keyboard] Undo triggered');
        }
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      if (enableRedo && modifier && event.key === 'z' && event.shiftKey) {
        if (canRedo && onRedoRef.current) {
          event.preventDefault();
          onRedoRef.current();
          console.log('[Keyboard] Redo triggered');
        }
        return;
      }

      // Ctrl+Y / Cmd+Y: Redo (alternative)
      if (enableRedo && modifier && event.key === 'y') {
        if (canRedo && onRedoRef.current) {
          event.preventDefault();
          onRedoRef.current();
          console.log('[Keyboard] Redo triggered (Ctrl+Y)');
        }
        return;
      }

      // Ctrl+S / Cmd+S: Save
      if (enableSave && modifier && event.key === 's') {
        event.preventDefault();

        if (onSaveRef.current && hasChanges) {
          onSaveRef.current();
          console.log('[Keyboard] Save triggered');
        }
        return;
      }

      // Escape: Cancel
      if (enableEscape && event.key === 'Escape') {
        if (onCancelRef.current) {
          onCancelRef.current();
          console.log('[Keyboard] Cancel triggered');
        }
        return;
      }
    },
    [
      isEditing,
      activeWhenEditing,
      enableUndo,
      enableRedo,
      enableSave,
      enableEscape,
      canUndo,
      canRedo,
      hasChanges,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return utility values for manual triggering
  return {
    triggerUndo: onUndoRef.current,
    triggerRedo: onRedoRef.current,
    triggerSave: onSaveRef.current,
    triggerCancel: onCancelRef.current,
    canUndo,
    canRedo,
    hasChanges,
    isEditing,
  };
}

/**
 * Hook for displaying keyboard shortcut hints
 *
 * @example
 * const { shortcuts, formatShortcut } = useShortcutHints();
 * // Returns: "Cmd+Z" on Mac, "Ctrl+Z" on Windows
 */
export function useShortcutHints() {
  const isMac = typeof navigator !== 'undefined'
    ? navigator.platform.toUpperCase().indexOf('MAC') >= 0
    : false;

  const modifier = isMac ? 'Cmd' : 'Ctrl';

  const shortcuts = {
    undo: `${modifier}+Z`,
    redo: `${modifier}+Shift+Z`,
    save: `${modifier}+S`,
    cancel: 'Escape',
  };

  const formatShortcut = (action: keyof typeof shortcuts) => shortcuts[action];

  return { shortcuts, formatShortcut, isMac };
}
