/**
 * Keyboard Shortcuts Hook (v9.0.0)
 *
 * Provides keyboard shortcut handling for entity editing:
 * - Ctrl+Z / Cmd+Z: Undo
 * - Ctrl+Shift+Z / Cmd+Shift+Z: Redo
 * - Ctrl+S / Cmd+S: Save
 * - Escape: Cancel edit
 *
 * v9.0.0: Updated to work with RxDB edit state hooks
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';

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
  /** Custom undo handler */
  onUndo?: () => Promise<void> | void;
  /** Custom redo handler */
  onRedo?: () => Promise<void> | void;
  /** Only active when editing */
  activeWhenEditing?: boolean;
  /** Is currently editing */
  isEditing?: boolean;
  /** Has changes to save */
  hasChanges?: boolean;
}

/**
 * Hook for handling keyboard shortcuts in entity editing
 *
 * v9.0.0: Updated to work with RxDB. Pass edit state from useEntityEditState().
 *
 * @example
 * const { isEditing, hasChanges, undo, redo, saveChanges, cancelEdit } = useEntityEditState(entityType, entityId);
 *
 * useKeyboardShortcuts({
 *   isEditing,
 *   hasChanges,
 *   onUndo: undo,
 *   onRedo: redo,
 *   onSave: saveChanges,
 *   onCancel: cancelEdit,
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
    onUndo,
    onRedo,
    activeWhenEditing = true,
    isEditing = false,
    hasChanges = false,
  } = options;

  // Track if action is in progress to prevent double-triggers
  const actionInProgress = useRef(false);

  // Check if we're inside an input/textarea
  const isTextInput = useCallback((element: Element | null): boolean => {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      (element as HTMLElement).isContentEditable
    );
  }, []);

  const handleKeyDown = useCallback(async (event: KeyboardEvent) => {
    // Skip if action in progress
    if (actionInProgress.current) return;

    // Skip if activeWhenEditing is true but we're not editing
    if (activeWhenEditing && !isEditing) return;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    // Undo: Cmd+Z (Mac) or Ctrl+Z (Windows)
    if (enableUndo && cmdOrCtrl && event.key === 'z' && !event.shiftKey) {
      // Allow undo in text inputs as native browser behavior
      if (!isTextInput(document.activeElement) && onUndo) {
        event.preventDefault();
        actionInProgress.current = true;
        try {
          await onUndo();
        } finally {
          actionInProgress.current = false;
        }
      }
      return;
    }

    // Redo: Cmd+Shift+Z (Mac) or Ctrl+Shift+Z (Windows)
    if (enableRedo && cmdOrCtrl && event.key === 'z' && event.shiftKey) {
      if (!isTextInput(document.activeElement) && onRedo) {
        event.preventDefault();
        actionInProgress.current = true;
        try {
          await onRedo();
        } finally {
          actionInProgress.current = false;
        }
      }
      return;
    }

    // Save: Cmd+S (Mac) or Ctrl+S (Windows)
    if (enableSave && cmdOrCtrl && event.key === 's') {
      event.preventDefault(); // Always prevent browser save dialog
      if (hasChanges && onSave) {
        actionInProgress.current = true;
        try {
          await onSave();
        } finally {
          actionInProgress.current = false;
        }
      }
      return;
    }

    // Escape: Cancel edit
    if (enableEscape && event.key === 'Escape') {
      if (onCancel) {
        event.preventDefault();
        onCancel();
      }
      return;
    }
  }, [
    activeWhenEditing,
    isEditing,
    enableUndo,
    enableRedo,
    enableSave,
    enableEscape,
    onSave,
    onCancel,
    onUndo,
    onRedo,
    hasChanges,
    isTextInput
  ]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Return available shortcuts for UI hints
  return useMemo(() => ({
    shortcuts: {
      undo: enableUndo ? (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘Z' : 'Ctrl+Z') : null,
      redo: enableRedo ? (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘⇧Z' : 'Ctrl+Shift+Z') : null,
      save: enableSave ? (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘S' : 'Ctrl+S') : null,
      cancel: enableEscape ? 'Esc' : null,
    }
  }), [enableUndo, enableRedo, enableSave, enableEscape]);
}

/**
 * Hook for displaying shortcut hints in UI
 */
export function useShortcutHints() {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return useMemo(() => ({
    undo: isMac ? '⌘Z' : 'Ctrl+Z',
    redo: isMac ? '⌘⇧Z' : 'Ctrl+Shift+Z',
    save: isMac ? '⌘S' : 'Ctrl+S',
    cancel: 'Esc',
    modifier: isMac ? '⌘' : 'Ctrl',
  }), [isMac]);
}
