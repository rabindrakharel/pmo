import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Select } from './Select';

export interface DataLabelSelectProps {
  datalabel: string;  // e.g., "dl__project_stage", "dl__task_priority"
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Domain component for datalabel/settings dropdowns
 * Used for all dl__* fields (stages, priorities, statuses, etc.)
 *
 * Wraps base Select with automatic data fetching from settings API
 *
 * @example
 * <DataLabelSelect
 *   datalabel="dl__project_stage"
 *   value="planning"
 *   onChange={handleChange}
 * />
 */
export function DataLabelSelect({
  datalabel,
  value,
  onChange,
  disabled = false,
  required = false,
  className = ''
}: DataLabelSelectProps) {

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['datalabel', datalabel],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/datalabel', {
        params: { name: datalabel }
      });

      // Transform settings data to SelectOption format
      return response.data.data.map((item: any) => ({
        value: item.name,
        label: item.name
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: !!datalabel
  });

  if (isLoading) {
    return <span className="text-gray-400 text-sm">Loading...</span>;
  }

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      required={required}
      placeholder={`Select ${datalabel.replace('dl__', '').replace(/_/g, ' ')}...`}
      className={className}
    />
  );
}
