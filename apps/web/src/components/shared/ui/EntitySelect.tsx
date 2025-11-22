import React, { useMemo } from 'react';
import { useEntityLookup } from '@/lib/hooks/useEntityQuery';
import { Select } from './Select';

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
 * Domain component for entity reference dropdowns
 * Used for all entity foreign key fields (_ID fields)
 *
 * Uses the centralized useEntityLookup hook which:
 * - Fetches via React Query with 5-min TTL
 * - Proper cache invalidation via React Query
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
  // Use centralized hook for consistent caching
  const { options: rawOptions, isLoading } = useEntityLookup(entityCode);

  // Transform to SelectOption format
  const options = useMemo(() =>
    rawOptions.map((item: any) => ({
      value: item.id,
      label: item.name
    })),
    [rawOptions]
  );

  if (isLoading) {
    return <span className="text-gray-400 text-sm">Loading...</span>;
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
