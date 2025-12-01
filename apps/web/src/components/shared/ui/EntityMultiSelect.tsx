import React from 'react';
import { useRefDataEntityInstanceOptions } from '@/lib/hooks/useRefDataEntityInstance';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import { InlineSpinner } from './EllipsisBounce';

export interface EntityMultiSelectProps {
  entityCode: string;
  uuidField: string;        // The UUID field name from metadata (e.g., "stakeholder__employee_id")
  values: any[];            // Array of { entity_code, [uuidField]: uuid, label }
  labelField: string;       // The label field name (e.g., "stakeholder")
  onAdd: (uuid: string, label: string) => void;
  onRemove: (uuid: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Domain component for entity array references (v9.1.1)
 * Used for all entity array fields (_IDS fields)
 *
 * Uses the unified ref_data_entityInstance cache which:
 * - Shares cache with view mode resolution (single source of truth)
 * - Auto-populated from API response ref_data_entityInstance
 * - On-demand fetch with 15-min TTL for dropdown population
 *
 * IMPORTANT: uuidField must be provided from backend metadata - no pattern detection
 *
 * @example
 * <EntityMultiSelect
 *   entityCode="employee"
 *   uuidField="stakeholder__employee_id"  // From metadata.lookupEntity
 *   values={[{ entity_code: "employee", stakeholder__employee_id: "uuid", stakeholder: "Name" }]}
 *   labelField="stakeholder"
 *   onAdd={(uuid, label) => handleAdd(uuid, label)}
 *   onRemove={(uuid) => handleRemove(uuid)}
 * />
 */
export function EntityMultiSelect({
  entityCode,
  uuidField,
  values,
  labelField,
  onAdd,
  onRemove,
  disabled = false,
  placeholder = 'Select...'
}: EntityMultiSelectProps) {
  // v8.3.2: Use unified ref_data_entityInstance cache
  // Options already in SelectOption format: [{ value: uuid, label: name }]
  const { options, isLoading } = useRefDataEntityInstanceOptions(entityCode);

  // Extract current UUIDs from values array using explicit field name from metadata
  const selectedUuids = values
    .map((value) => value[uuidField])
    .filter(Boolean) as string[];

  // Handle selection change
  const handleChange = (newUuids: string[]) => {
    // Find newly added UUIDs
    const addedUuids = newUuids.filter(uuid => !selectedUuids.includes(uuid));

    // Find removed UUIDs
    const removedUuids = selectedUuids.filter(uuid => !newUuids.includes(uuid));

    // Call onAdd for newly added items
    addedUuids.forEach(uuid => {
      const option = options.find(opt => opt.value === uuid);
      if (option) {
        onAdd(uuid, option.label);
      }
    });

    // Call onRemove for removed items
    removedUuids.forEach(uuid => {
      onRemove(uuid);
    });
  };

  if (isLoading) {
    return <span className="text-dark-400 text-sm"><InlineSpinner /></span>;
  }

  return (
    <SearchableMultiSelect
      options={options}
      value={selectedUuids}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      readonly={false}
    />
  );
}
