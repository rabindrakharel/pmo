import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * DebouncedInput - Cell-Isolated State Pattern (v13.0.0)
 *
 * This component manages its own local state for instant UI feedback.
 * Parent is ONLY notified on COMMIT (blur or Enter), never during typing.
 * This is the industry-standard pattern used by AG Grid, Airtable, Notion.
 *
 * Benefits:
 * - Zero re-renders of parent during typing
 * - Instant visual feedback
 * - Saves only on blur/Enter (commit-only pattern)
 * - Works seamlessly with inline editing tables
 */

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onKeyDown'> {
  value: string | number | undefined;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function DebouncedInput({
  value,
  onChange,
  onKeyDown,
  ...inputProps
}: DebouncedInputProps) {
  // Local state for instant feedback - NO parent updates during typing
  const [localValue, setLocalValue] = useState(value ?? '');
  const latestValueRef = useRef(localValue);

  // Sync local state when external value changes (e.g., after save, undo)
  useEffect(() => {
    const externalValue = value ?? '';
    if (externalValue !== latestValueRef.current) {
      setLocalValue(externalValue);
      latestValueRef.current = String(externalValue);
    }
  }, [value]);

  // Handle typing - ONLY updates local state, NO parent notification
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    latestValueRef.current = newValue;
    // v13.0.0: NO onChange call here - commit-only pattern
  }, []);

  // Handle blur - COMMIT to parent
  const handleBlur = useCallback(() => {
    // Only commit if value actually changed
    if (String(localValue) !== String(value)) {
      onChange(String(localValue));
    }
  }, [localValue, value, onChange]);

  // Handle Enter key - COMMIT to parent
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Commit on Enter
      if (String(localValue) !== String(value)) {
        onChange(String(localValue));
      }
    }
    // Pass through to parent's onKeyDown (for Tab, Escape handling)
    onKeyDown?.(e);
  }, [localValue, value, onChange, onKeyDown]);

  return (
    <input
      {...inputProps}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

/**
 * DebouncedTextarea - Cell-Isolated State Pattern (v13.0.0)
 * Same commit-only pattern for textarea elements
 */
interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onKeyDown'> {
  value: string | undefined;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function DebouncedTextarea({
  value,
  onChange,
  onKeyDown,
  ...textareaProps
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const latestValueRef = useRef(localValue);

  useEffect(() => {
    const externalValue = value ?? '';
    if (externalValue !== latestValueRef.current) {
      setLocalValue(externalValue);
      latestValueRef.current = externalValue;
    }
  }, [value]);

  // Handle typing - ONLY updates local state, NO parent notification
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    latestValueRef.current = newValue;
    // v13.0.0: NO onChange call here - commit-only pattern
  }, []);

  // Handle blur - COMMIT to parent
  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  // Handle keyboard - COMMIT on Ctrl+Enter (textarea allows regular Enter for newlines)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Commit on Ctrl+Enter (textarea needs regular Enter for newlines)
      if (localValue !== value) {
        onChange(localValue);
      }
    }
    // Pass through to parent's onKeyDown
    onKeyDown?.(e);
  }, [localValue, value, onChange, onKeyDown]);

  return (
    <textarea
      {...textareaProps}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
