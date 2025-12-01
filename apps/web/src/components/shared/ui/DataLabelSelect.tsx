import { useMemo } from 'react';
import { useDatalabel } from '@/db/tanstack-index';
import { BadgeDropdownSelect, type BadgeDropdownSelectOption } from './BadgeDropdownSelect';
import { InlineSpinner } from './EllipsisBounce';
import { colorCodeToTailwindClass } from '@/lib/formatters/valueFormatters';

export interface DataLabelSelectProps {
  datalabel: string;  // e.g., "dl__project_stage", "dl__task_priority"
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Domain component for datalabel/settings dropdowns
 * Used for all dl__* fields (stages, priorities, statuses, etc.)
 *
 * Uses the canonical useDatalabel hook from @/db/tanstack-index which:
 * - TanStack Query for server state
 * - Dexie for IndexedDB persistence
 * - Proper cache invalidation via WebSocket
 *
 * v8.3.2: Now renders colored badges using BadgeDropdownSelect
 * - Includes color_code from datalabel metadata
 * - Consistent styling with EntityInstanceFormContainer edit mode
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
  disabled = false
}: DataLabelSelectProps) {
  // Use canonical hook from @/db/tanstack-index
  const { options: rawOptions, isLoading } = useDatalabel(datalabel);

  // Transform to BadgeDropdownSelectOption format with Tailwind color classes
  // Type assertion needed due to React Query's complex generic types
  const optionsArray = (rawOptions || []) as Array<{ name: string; color_code?: string }>;
  const options: BadgeDropdownSelectOption[] = useMemo(() =>
    optionsArray.map((item) => ({
      value: item.name,
      label: item.name,
      metadata: {
        // Convert color_code (e.g., "blue") to Tailwind classes (e.g., "bg-blue-100 text-blue-700")
        color_code: colorCodeToTailwindClass(item.color_code)
      }
    })),
    [optionsArray]
  );

  if (isLoading) {
    return <span className="text-dark-400 text-sm"><InlineSpinner /></span>;
  }

  return (
    <BadgeDropdownSelect
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      placeholder={`Select ${datalabel.replace('dl__', '').replace(/_/g, ' ')}...`}
    />
  );
}
