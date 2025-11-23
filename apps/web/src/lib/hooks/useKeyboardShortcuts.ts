/**
 * Keyboard Shortcuts Hook
 *
 * Provides keyboard shortcut handling for entity editing:
 * - Ctrl+Z / Cmd+Z: Undo
 * - Ctrl+Shift+Z / Cmd+Shift+Z: Redo
 * - Ctrl+S / Cmd+S: Save
 * - Escape: Cancel edit
 *
 * Integrates with useEntityEditStore for state management.
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useEntityEditStore } from '../../stores/useEntityEditStore';
import { useShallow } from 'zustand/shallow';

interface KeyboardShortcutOptions {
  /** Enable undo shortcut (Ctrl+Z / Cmd+Z) */
  enableUndo?: boolean;
  /** Enable redo shortcut (Ctrl+Shift+Z / Cmd+Shift+Z) */
  enableRedo?: boolean;
  /** Enable save shortcut (Ctrl+S / Cmd+S) */
  enableSave?: boolean;
  /** Enable escape to cancel (Escape) */
  enableEscape?: boolean;
  /** Custom save handler (overrides default) */
  onSave?: () => Promise<void> | void;
  /** Custom cancel handler (overrides default) */
  onCancel?: () => void;
  /** Only active when editing */
  activeWhenEditing?: boolean;
}

/**
 * Hook for handling keyboard shortcuts in entity editing
 *
 * @example
 * // Basic usage with edit store
 * useKeyboardShortcuts();
 *
 * @example
 * // Custom save handler
 * useKeyboardShortcuts({
 *   onSave: async () => {
 *     await customSaveLogic();
 *   },
 *   activeWhenEditing: true,
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
    activeWhenEditing = true,
  } = options;

  // ✅ INDUSTRY STANDARD: Use refs to store callbacks to avoid dependency changes
  // This prevents re-renders when parent callback references change
  const onSaveRef = useRef(onSave);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onSaveRef.current = onSave;
    onCancelRef.current = onCancel;
  }, [onSave, onCancel]);

  // ✅ INDUSTRY STANDARD: Use useShallow selector to prevent unnecessary re-renders
  // Only subscribe to the specific state slices and actions needed
  const {
    isEditing,
    undoStackLength,
    redoStackLength,
    dirtyFieldsSize,
    undo,
    redo,
    saveChanges,
    cancelEdit,
  } = useEntityEditStore(useShallow(state => ({
    isEditing: state.isEditing,
    undoStackLength: state.undoStack.length,
    redoStackLength: state.redoStack.length,
    dirtyFieldsSize: state.dirtyFields.size,
    undo: state.undo,
    redo: state.redo,
    saveChanges: state.saveChanges,
    cancelEdit: state.cancelEdit,
  })));

  // Derive booleans from primitive values (stable computation)
  const canUndo = undoStackLength > 0;
  const canRedo = redoStackLength > 0;
  const hasChanges = dirtyFieldsSize > 0;

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
        if (canUndo) {
          event.preventDefault();
          undo();
          console.log('[Keyboard] Undo triggered');
        }
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      if (enableRedo && modifier && event.key === 'z' && event.shiftKey) {
        if (canRedo) {
          event.preventDefault();
          redo();
          console.log('[Keyboard] Redo triggered');
        }
        return;
      }

      // Ctrl+Y / Cmd+Y: Redo (alternative)
      if (enableRedo && modifier && event.key === 'y') {
        if (canRedo) {
          event.preventDefault();
          redo();
          console.log('[Keyboard] Redo triggered (Ctrl+Y)');
        }
        return;
      }

      // Ctrl+S / Cmd+S: Save
      if (enableSave && modifier && event.key === 's') {
        event.preventDefault();

        if (onSaveRef.current) {
          onSaveRef.current();
        } else if (hasChanges) {
          saveChanges();
        }
        console.log('[Keyboard] Save triggered');
        return;
      }

      // Escape: Cancel
      if (enableEscape && event.key === 'Escape') {
        if (onCancelRef.current) {
          onCancelRef.current();
        } else {
          cancelEdit();
        }
        console.log('[Keyboard] Cancel triggered');
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
      undo,
      redo,
      saveChanges,
      cancelEdit,
      hasChanges,
      // onSave and onCancel accessed via refs - no dependency needed
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return utility values and functions for manual triggering
  // ✅ Now using stable boolean values instead of function calls
  return {
    triggerUndo: undo,
    triggerRedo: redo,
    triggerSave: onSaveRef.current || saveChanges,
    triggerCancel: onCancelRef.current || cancelEdit,
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
