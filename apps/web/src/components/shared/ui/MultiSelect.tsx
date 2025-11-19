import React, { useState } from 'react';
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
            onClick={() => setIsOpen(!isOpen)}
            type="button"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            + Add {placeholder}
          </button>

          {/* Dropdown */}
          {isOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              />

              {/* Options list */}
              <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
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
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
