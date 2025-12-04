import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SelectOption } from './Select';

export interface MultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Generic base MultiSelect component
 * Renders selected values as tags with remove buttons
 * Foundation for EntityMultiSelect and other multi-value selectors
 *
 * @example
 * <MultiSelect
 *   values={['1', '2']}
 *   onChange={handleChange}
 *   options={[{ value: '1', label: 'Tag 1' }]}
 * />
 */
export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    openUpward: false
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside (includes portal-rendered dropdown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position when it opens or on scroll/resize
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const maxDropdownHeight = 240;
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - rect.bottom - 20;
          const spaceAbove = rect.top - 20;

          const availableOptions = options.filter(opt => !values.includes(String(opt.value)));
          const estimatedItemHeight = 36;
          const estimatedContentHeight = Math.min(availableOptions.length * estimatedItemHeight, maxDropdownHeight);

          const shouldOpenUpward = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;

          let top: number;
          if (shouldOpenUpward) {
            const availableHeight = Math.min(estimatedContentHeight, spaceAbove);
            top = rect.top + window.scrollY - availableHeight - 4;
          } else {
            top = rect.bottom + window.scrollY + 4;
          }

          setDropdownPosition({
            top,
            left: rect.left + window.scrollX,
            width: 256, // w-64 = 256px
            openUpward: shouldOpenUpward,
          });
        }
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, options, values]);

  const handleAdd = (value: string) => {
    if (!values.includes(value)) {
      onChange([...values, value]);
    }
    setIsOpen(false);
  };

  const handleRemove = (value: string) => {
    onChange(values.filter(v => v !== value));
  };

  const getLabel = (value: string) => {
    return options.find(opt => String(opt.value) === value)?.label || value;
  };

  const availableOptions = options.filter(opt => !values.includes(String(opt.value)));

  return (
    <div className="relative">
      {/* Selected tags */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map(value => (
            <span
              key={value}
              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
            >
              {getLabel(value)}
              {!disabled && (
                <button
                  onClick={() => handleRemove(value)}
                  className="ml-1.5 text-blue-600 hover:text-blue-900 focus:outline-none"
                  type="button"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Add button */}
      {availableOptions.length > 0 && !disabled && (
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            type="button"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            + Add {placeholder}
          </button>

          {/* Dropdown - rendered via portal to avoid overflow clipping */}
          {isOpen && createPortal(
            <div
              ref={dropdownRef}
              data-dropdown-portal=""
              className="bg-white border border-gray-200 rounded-md overflow-auto"
              style={{
                position: 'absolute',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                maxHeight: '240px',
                zIndex: 9999,
                boxShadow: dropdownPosition.openUpward
                  ? '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
                  : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              }}
            >
              {availableOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleAdd(String(opt.value))}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm transition-colors focus:outline-none focus:bg-gray-100"
                >
                  {opt.label}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}
