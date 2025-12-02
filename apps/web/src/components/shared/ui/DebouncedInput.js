import React, { useState, useEffect, useRef, useCallback } from 'react';
export function DebouncedInput({ value, onChange, debounceMs = 300, onBlurCommit = true, ...inputProps }) {
    // Local state for instant feedback
    const [localValue, setLocalValue] = useState(value ?? '');
    const timeoutRef = useRef(null);
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
    const handleChange = useCallback((e) => {
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
    return (React.createElement("input", { ...inputProps, value: localValue, onChange: handleChange, onBlur: handleBlur }));
}
export function DebouncedTextarea({ value, onChange, debounceMs = 300, onBlurCommit = true, ...textareaProps }) {
    const [localValue, setLocalValue] = useState(value ?? '');
    const timeoutRef = useRef(null);
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
    const handleChange = useCallback((e) => {
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
    return (React.createElement("textarea", { ...textareaProps, value: localValue, onChange: handleChange, onBlur: handleBlur }));
}
