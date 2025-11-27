import React from 'react';
import { useRefDataEntityInstanceOptions } from '@/lib/hooks';
import { Select } from './Select';
import { InlineSpinner } from './EllipsisBounce';

export interface EntitySelectProps {
  entityCode: string;    // e.g., "employee", "project", "client"
  value: string;         // Current UUID
  currentLabel?: string; // Current display label (for backwards compatibility)
  onChange: (uuid: string, label: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Domain component for entity reference dropdowns (v8.3.2)
 * Used for all entity foreign key fields (_ID fields)
 *
 * Uses the unified ref_data_entityInstance cache which:
 * - Shares cache with view mode resolution (single source of truth)
 * - Auto-populated from API response ref_data_entityInstance
 * - On-demand fetch with 15-min TTL for dropdown population
 *
 * @example
 * <EntitySelect
 *   entityCode="employee"
 *   value="uuid-123"
 *   onChange={(uuid, label) => handleChange(uuid, label)}
 * />
 */
export function EntitySelect({
  entityCode,
  value,
  currentLabel,
  onChange,
  disabled = false,
  required = false,
  placeholder,
  className = ''
}: EntitySelectProps) {
  // v8.3.2: Use unified ref_data_entityInstance cache
  // Options already in SelectOption format: [{ value: uuid, label: name }]
  const { options, isLoading } = useRefDataEntityInstanceOptions(entityCode);

  if (isLoading) {
    return <span className="text-dark-400 text-sm"><InlineSpinner /></span>;
  }

  return (
    <Select
      value={value}
      onChange={(newUuid) => {
        const selected = options.find(opt => opt.value === newUuid);
        onChange(newUuid, selected?.label || '');
      }}
      options={options}
      disabled={disabled}
      required={required}
      placeholder={placeholder || `Select ${entityCode}...`}
      className={className}
    />
  );
}
