import React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

/**
 * Generic base Select component
 * Foundation for all dropdown variants (EntityInstanceNameLookup, DataLabelSelect, etc.)
 *
 * @example
 * <Select
 *   value={selectedId}
 *   onChange={handleChange}
 *   options={[{ value: '1', label: 'Option 1' }]}
 * />
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  required = false
}: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className={`w-full border-0 focus:ring-0 focus:outline-none bg-transparent px-0 py-0.5 text-base tracking-tight cursor-pointer hover:text-dark-700 transition-colors ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
