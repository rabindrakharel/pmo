import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * DebouncedInput - Industry-standard pattern for form inputs
 *
 * This component manages its own local state for instant UI feedback,
 * then debounces updates to the parent. This is the React best practice
 * for handling text inputs in forms where parent state updates are expensive.
 *
 * Benefits:
 * - Zero re-renders of parent during typing
 * - Instant visual feedback
 * - Works seamlessly with Zustand/Redux/any state manager
 * - Configurable debounce delay
 */

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number | undefined;
  onChange: (value: string) => void;
  debounceMs?: number;
  onBlurCommit?: boolean; // Also commit on blur (default: true)
}

export function DebouncedInput({
  value,
  onChange,
  debounceMs = 300,
  onBlurCommit = true,
  ...inputProps
}: DebouncedInputProps) {
  // Local state for instant feedback
  const [localValue, setLocalValue] = useState(value ?? '');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestValueRef = useRef(localValue);

  // Sync local state when external value changes (e.g., after save, undo)
  useEffect(() => {
    // Only sync if the external value is different from what we last sent
    const externalValue = value ?? '';
    if (externalValue !== latestValueRef.current) {
      setLocalValue(externalValue);
      latestValueRef.current = String(externalValue);
    }
  }, [value]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Update local state immediately (instant feedback)
    setLocalValue(newValue);
    latestValueRef.current = newValue;

    // Clear pending debounce
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the parent update
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  const handleBlur = useCallback(() => {
    if (onBlurCommit) {
      // Clear any pending debounce and commit immediately
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      // Only commit if value actually changed
      if (String(localValue) !== String(value)) {
        onChange(String(localValue));
      }
    }
  }, [localValue, value, onChange, onBlurCommit]);

  return (
    <input
      {...inputProps}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

/**
 * DebouncedTextarea - Same pattern for textarea elements
 */
interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string | undefined;
  onChange: (value: string) => void;
  debounceMs?: number;
  onBlurCommit?: boolean;
}

export function DebouncedTextarea({
  value,
  onChange,
  debounceMs = 300,
  onBlurCommit = true,
  ...textareaProps
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestValueRef = useRef(localValue);

  useEffect(() => {
    const externalValue = value ?? '';
    if (externalValue !== latestValueRef.current) {
      setLocalValue(externalValue);
      latestValueRef.current = externalValue;
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    latestValueRef.current = newValue;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  const handleBlur = useCallback(() => {
    if (onBlurCommit) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (localValue !== value) {
        onChange(localValue);
      }
    }
  }, [localValue, value, onChange, onBlurCommit]);

  return (
    <textarea
      {...textareaProps}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
