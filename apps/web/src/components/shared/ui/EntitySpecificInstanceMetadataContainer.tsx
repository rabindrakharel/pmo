/**
 * ============================================================================
 * ENTITY SPECIFIC INSTANCE METADATA CONTAINER (v12.3.0)
 * ============================================================================
 *
 * Provides consistent, compact metadata field rendering for entity detail page headers.
 * Includes copy-to-clipboard, inline editing support, and debounced input for performance.
 *
 * v12.3.0: Added slow click-and-hold inline editing (same as EntityInstanceFormContainer)
 * - Hold mouse down 500ms to enter edit mode for that field
 * - Click outside OR Enter key → trigger optimistic update via onInlineSave
 * - Escape → cancel without saving
 *
 * Components:
 * - EntityMetadataField: Individual field with label, value, copy, and edit support
 * - EntityMetadataRow: Flex container for grouping fields
 * - EntityMetadataSeparator: Visual dot separator between fields
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { DebouncedInput } from './DebouncedInput';

interface EntityMetadataFieldProps {
  label: string;
  value: string;
  isEditing?: boolean;
  canCopy?: boolean;
  copiedField?: string | null;
  fieldKey: string;
  onCopy?: (value: string, key: string) => void;
  onChange?: (key: string, value: string) => void;
  placeholder?: string;
  prefix?: string;
  className?: string;
  inputWidth?: string;
  badge?: React.ReactNode;
  // v12.3.0: Inline editing support (slow click-and-hold)
  /** Enable slow click-and-hold inline editing */
  inlineEditable?: boolean;
  /** Called when inline edit is saved (optimistic update trigger) */
  onInlineSave?: (fieldKey: string, value: string) => void;
  /** Whether this field is editable (from metadata) */
  editable?: boolean;
}

/**
 * EntityMetadataField Component
 *
 * Reusable component for displaying entity metadata with:
 * - Compact inline layout
 * - Copy to clipboard functionality
 * - Inline editing support with DEBOUNCED input (prevents re-renders on every keystroke)
 * - v12.3.0: Slow click-and-hold inline editing (same as EntityInstanceFormContainer)
 * - Consistent styling
 */
export function EntityMetadataField({
  label,
  value,
  isEditing = false,
  canCopy = true,
  copiedField,
  fieldKey,
  onCopy,
  onChange,
  placeholder,
  prefix,
  className = '',
  inputWidth = '10rem',
  badge,
  // v12.3.0: Inline editing props
  inlineEditable = false,
  onInlineSave,
  editable = true
}: EntityMetadataFieldProps) {
  const labelClass = 'text-gray-400 font-normal text-xs flex-shrink-0';
  const valueClass = `text-gray-600 font-normal text-sm ${className}`;

  // ============================================================================
  // v12.3.0: SLOW CLICK-AND-HOLD INLINE EDITING STATE
  // ============================================================================
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineEditValue, setInlineEditValue] = useState(value);
  const editingFieldRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const LONG_PRESS_DELAY = 500;

  // Sync inlineEditValue when value prop changes
  useEffect(() => {
    if (!isInlineEditing) {
      setInlineEditValue(value);
    }
  }, [value, isInlineEditing]);

  // Cancel long-press timer
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Enter inline edit mode
  const enterInlineEditMode = useCallback(() => {
    setInlineEditValue(value);
    setIsInlineEditing(true);
    // Focus input after render
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [value]);

  // Handle mouse down - start long-press timer
  const handleMouseDown = useCallback(() => {
    if (isEditing || !inlineEditable || !editable || isInlineEditing) return;

    cancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      enterInlineEditMode();
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY);
  }, [isEditing, inlineEditable, editable, isInlineEditing, cancelLongPress, enterInlineEditMode]);

  // Handle mouse up/leave - cancel long-press timer
  const handleMouseUp = useCallback(() => cancelLongPress(), [cancelLongPress]);
  const handleMouseLeave = useCallback(() => cancelLongPress(), [cancelLongPress]);

  // Save inline edit
  const handleInlineSave = useCallback(() => {
    if (inlineEditValue !== value) {
      onInlineSave?.(fieldKey, inlineEditValue);
    }
    setIsInlineEditing(false);
  }, [inlineEditValue, value, fieldKey, onInlineSave]);

  // Cancel inline edit
  const handleInlineCancel = useCallback(() => {
    setInlineEditValue(value);
    setIsInlineEditing(false);
  }, [value]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleInlineCancel();
    }
  }, [handleInlineSave, handleInlineCancel]);

  // Click outside to save
  useEffect(() => {
    if (!isInlineEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (editingFieldRef.current && !editingFieldRef.current.contains(event.target as Node)) {
        handleInlineSave();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInlineEditing, handleInlineSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelLongPress();
  }, [cancelLongPress]);

  // Determine effective editing state
  const effectiveIsEditing = isEditing || isInlineEditing;

  if (!value && !effectiveIsEditing) return null;

  return (
    <>
      <span className={labelClass}>{label}:</span>

      {badge ? (
        // Badge rendering (for version, status, etc.)
        badge
      ) : effectiveIsEditing ? (
        // Edit mode - DEBOUNCED input for performance (prevents re-renders on every keystroke)
        <div
          ref={isInlineEditing ? editingFieldRef : undefined}
          className="flex items-center"
        >
          {prefix && <span className="text-dark-700 text-xs mr-0.5">{prefix}</span>}
          {isInlineEditing ? (
            // v12.3.0: Direct input for inline editing (immediate feedback)
            <input
              ref={inputRef}
              type="text"
              value={inlineEditValue}
              onChange={(e) => setInlineEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`${valueClass} border-0 bg-dark-100/80 focus:bg-dark-100 focus:ring-1 focus:ring-dark-700 rounded px-2 py-0.5 transition-all duration-200`}
              style={{ width: inputWidth }}
            />
          ) : (
            // Full edit mode - debounced input
            <DebouncedInput
              type="text"
              value={value}
              onChange={(newValue) => onChange?.(fieldKey, newValue)}
              debounceMs={300}
              placeholder={placeholder}
              className={`${valueClass} border-0 bg-dark-100/80 focus:bg-dark-100 focus:ring-1 focus:ring-dark-700 rounded px-2 py-0.5 transition-all duration-200`}
              style={{
                width: inputWidth
              }}
            />
          )}
        </div>
      ) : (
        // View mode - text with copy button (v12.3.0: supports long-press to edit)
        <div
          className={`flex items-center gap-1 group ${inlineEditable && editable ? 'cursor-text' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <span className={valueClass}>
            {prefix}{value}
          </span>
          {canCopy && onCopy && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(value, fieldKey);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all duration-200"
              title={`Copy ${label.toLowerCase()}`}
            >
              {copiedField === fieldKey ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}

interface EntityMetadataRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * EntityMetadataRow Component
 *
 * Container for metadata fields with consistent, compact spacing
 */
export function EntityMetadataRow({ children, className = '' }: EntityMetadataRowProps) {
  return (
    <div className={`flex items-center gap-3 flex-wrap ${className}`}>
      {children}
    </div>
  );
}

interface EntityMetadataSeparatorProps {
  show?: boolean;
}

/**
 * EntityMetadataSeparator Component
 *
 * Visual separator between metadata fields
 */
export function EntityMetadataSeparator({ show = true }: EntityMetadataSeparatorProps) {
  if (!show) return null;
  return <span className="text-gray-200 flex-shrink-0 mx-2">·</span>;
}
