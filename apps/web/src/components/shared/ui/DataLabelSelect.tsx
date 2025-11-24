import React, { useMemo } from 'react';
import { useDatalabels } from '@/lib/hooks/useEntityQuery';
import { Select } from './Select';
import { InlineSpinner } from './EllipsisBounce';

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
 * Uses the centralized useDatalabels hook which:
 * - Fetches via React Query with 30-min TTL
 * - Caches in Zustand datalabelMetadataStore
 * - Proper cache invalidation on mutations
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
  // Use centralized hook that syncs with Zustand store
  const { data: rawOptions = [], isLoading } = useDatalabels(datalabel);

  // Transform to SelectOption format
  const options = useMemo(() =>
    rawOptions.map((item: any) => ({
      value: item.name,
      label: item.name
    })),
    [rawOptions]
  );

  if (isLoading) {
    return <span className="text-dark-400 text-sm"><InlineSpinner /></span>;
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
