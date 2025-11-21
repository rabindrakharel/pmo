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

import { useEffect, useCallback } from 'react';
import { useEntityEditStore } from '../../stores/useEntityEditStore';

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

  const editStore = useEntityEditStore();
  const {
    isEditing,
    undo,
    redo,
    canUndo,
    canRedo,
    saveChanges,
    cancelEdit,
    hasChanges,
  } = editStore;

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
        if (canUndo()) {
          event.preventDefault();
          undo();
          console.log('[Keyboard] Undo triggered');
        }
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      if (enableRedo && modifier && event.key === 'z' && event.shiftKey) {
        if (canRedo()) {
          event.preventDefault();
          redo();
          console.log('[Keyboard] Redo triggered');
        }
        return;
      }

      // Ctrl+Y / Cmd+Y: Redo (alternative)
      if (enableRedo && modifier && event.key === 'y') {
        if (canRedo()) {
          event.preventDefault();
          redo();
          console.log('[Keyboard] Redo triggered (Ctrl+Y)');
        }
        return;
      }

      // Ctrl+S / Cmd+S: Save
      if (enableSave && modifier && event.key === 's') {
        event.preventDefault();

        if (onSave) {
          onSave();
        } else if (hasChanges()) {
          saveChanges();
        }
        console.log('[Keyboard] Save triggered');
        return;
      }

      // Escape: Cancel
      if (enableEscape && event.key === 'Escape') {
        if (onCancel) {
          onCancel();
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
      onSave,
      onCancel,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return utility functions for manual triggering
  return {
    triggerUndo: undo,
    triggerRedo: redo,
    triggerSave: onSave || saveChanges,
    triggerCancel: onCancel || cancelEdit,
    canUndo: canUndo(),
    canRedo: canRedo(),
    hasChanges: hasChanges(),
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
