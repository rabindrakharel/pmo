/**
 * ============================================================================
 * ENTITY SPECIFIC INSTANCE METADATA CONTAINER (v13.0.0)
 * ============================================================================
 *
 * Modern, next-generation header metadata components for entity detail pages.
 * Implements 2025 SaaS design patterns with improved visual hierarchy.
 *
 * Design Principles (v13.0.0):
 * - Entity name as hero element (larger, bolder typography)
 * - Two-line layout: name on top, metadata chips below
 * - Pill/chip styling for secondary metadata (code, id, timestamps)
 * - Progressive disclosure: essential info prominent, technical details subtle
 * - Smooth hover states and micro-interactions
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
 * - EntityHeaderTitle: Hero title component for entity name (NEW in v13.0.0)
 * - EntityMetadataChip: Pill-styled metadata display (NEW in v13.0.0)
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
  // v13.0.0: Enhanced styling options
  /** Use hero styling for primary fields like name */
  variant?: 'default' | 'hero' | 'chip';
  /** Show icon before value */
  icon?: React.ReactNode;
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
  const labelClass = 'text-dark-400 font-normal text-xs flex-shrink-0';
  const valueClass = `text-dark-600 font-normal text-sm ${className}`;

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
            // Full edit mode - debounced input (commit-only pattern v13.0.0)
            <DebouncedInput
              type="text"
              value={value}
              onChange={(newValue) => onChange?.(fieldKey, newValue)}
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
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dark-100 rounded transition-all duration-200"
              title={`Copy ${label.toLowerCase()}`}
            >
              {copiedField === fieldKey ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3 text-dark-400 hover:text-dark-600" />
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
  return <span className="text-dark-200 flex-shrink-0 mx-2">·</span>;
}

// =============================================================================
// v13.0.0: MODERN HEADER COMPONENTS - Next-Generation Entity Detail Headers
// =============================================================================

interface EntityHeaderTitleProps {
  /** Entity name or title - displayed as hero element */
  value: string;
  /** Whether the field is in edit mode */
  isEditing?: boolean;
  /** Field key for form state */
  fieldKey?: string;
  /** Change handler for edit mode */
  onChange?: (key: string, value: string) => void;
  /** Placeholder text for edit mode */
  placeholder?: string;
  /** Enable inline editing via long-press */
  inlineEditable?: boolean;
  /** Called when inline edit is saved */
  onInlineSave?: (fieldKey: string, value: string) => void;
  /** Whether this field is editable */
  editable?: boolean;
  /** Optional subtitle (e.g., entity type label) */
  subtitle?: string;
}

/**
 * EntityHeaderTitle Component (v13.0.0)
 *
 * Hero title component for entity detail page headers.
 * Implements modern typography with large, bold name display.
 *
 * Features:
 * - Large, bold typography (text-2xl font-semibold)
 * - Smooth inline editing with long-press
 * - Optional subtitle for entity type context
 * - Proper text truncation for long names
 */
export function EntityHeaderTitle({
  value,
  isEditing = false,
  fieldKey = 'name',
  onChange,
  placeholder = 'Untitled',
  inlineEditable = false,
  onInlineSave,
  editable = true,
  subtitle,
}: EntityHeaderTitleProps) {
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineEditValue, setInlineEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  const effectiveIsEditing = isEditing || isInlineEditing;

  return (
    <div className="flex flex-col min-w-0">
      {subtitle && (
        <span className="text-xs font-medium text-dark-500 uppercase tracking-wider mb-0.5">
          {subtitle}
        </span>
      )}
      {effectiveIsEditing ? (
        <div ref={containerRef}>
          {isInlineEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={inlineEditValue}
              onChange={(e) => setInlineEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="text-2xl font-semibold text-dark-800 bg-dark-subtle border-0 border-b-2 border-dark-300 focus:border-dark-accent focus:ring-0 px-0 py-1 w-full transition-colors duration-200 outline-none"
            />
          ) : (
            <DebouncedInput
              type="text"
              value={value}
              onChange={(newValue) => onChange?.(fieldKey, newValue)}
              placeholder={placeholder}
              className="text-2xl font-semibold text-dark-800 bg-dark-subtle border-0 border-b-2 border-dark-300 focus:border-dark-accent focus:ring-0 px-0 py-1 w-full transition-colors duration-200"
            />
          )}
        </div>
      ) : (
        <h1
          className={`text-2xl font-semibold text-dark-800 truncate leading-tight ${inlineEditable && editable ? 'cursor-text hover:text-dark-600' : ''} transition-colors duration-150`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          title={value}
        >
          {value || placeholder}
        </h1>
      )}
    </div>
  );
}

interface EntityMetadataChipProps {
  /** Label text (e.g., "code", "id") */
  label: string;
  /** Value to display */
  value: string;
  /** Optional icon to show */
  icon?: React.ReactNode;
  /** Copy to clipboard handler */
  onCopy?: (value: string, key: string) => void;
  /** Field key for copy */
  fieldKey: string;
  /** Currently copied field (for feedback) */
  copiedField?: string | null;
  /** Chip style variant */
  variant?: 'default' | 'muted' | 'accent';
  /** Whether to show the label */
  showLabel?: boolean;
  /** Whether value is monospace (for codes, IDs) */
  monospace?: boolean;
}

/**
 * EntityMetadataChip Component (v13.0.0)
 *
 * Modern pill-styled metadata display for secondary information.
 * Used for code, id, timestamps, and other technical metadata.
 *
 * Features:
 * - Pill/chip styling with subtle background
 * - Copy-to-clipboard with hover reveal
 * - Multiple variants (default, muted, accent)
 * - Optional icons
 */
export function EntityMetadataChip({
  label,
  value,
  icon,
  onCopy,
  fieldKey,
  copiedField,
  variant = 'default',
  showLabel = true,
  monospace = false,
}: EntityMetadataChipProps) {
  if (!value) return null;

  const variantStyles = {
    default: 'bg-dark-100 text-dark-600 border-dark-200',
    muted: 'bg-dark-subtle text-dark-500 border-dark-100',
    accent: 'bg-dark-accent text-white border-dark-accent',
  };

  return (
    <div
      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${variantStyles[variant]} transition-all duration-150 hover:shadow-sm`}
    >
      {icon && <span className="opacity-60">{icon}</span>}
      {showLabel && <span className="opacity-60">{label}:</span>}
      <span className={monospace ? 'font-mono' : ''}>{value}</span>
      {onCopy && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy(value, fieldKey);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 -mr-1 hover:bg-dark-200/50 rounded transition-all duration-200"
          title={`Copy ${label}`}
        >
          {copiedField === fieldKey ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3 opacity-60 hover:opacity-100" />
          )}
        </button>
      )}
    </div>
  );
}

interface EntityHeaderContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * EntityHeaderContainer Component (v13.0.0)
 *
 * Container for the modern two-line header layout.
 * Provides proper spacing and structure for title + metadata chips.
 */
export function EntityHeaderContainer({ children, className = '' }: EntityHeaderContainerProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {children}
    </div>
  );
}

interface EntityMetadataChipRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * EntityMetadataChipRow Component (v13.0.0)
 *
 * Horizontal container for metadata chips with proper spacing.
 */
export function EntityMetadataChipRow({ children, className = '' }: EntityMetadataChipRowProps) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {children}
    </div>
  );
}
