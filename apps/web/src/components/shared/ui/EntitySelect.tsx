import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
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
 * Wraps base Select with automatic data fetching from entity instance-lookup API
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

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['entity-lookup', entityCode],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/entity/${entityCode}/instance-lookup`, {
        params: { active_only: true, limit: 500 }
      });

      // Transform entity data to SelectOption format
      return response.data.data.map((item: any) => ({
        value: item.id,
        label: item.name
      }));
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    enabled: !!entityCode
  });

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
