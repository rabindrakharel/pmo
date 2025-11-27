import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import { InlineSpinner } from './EllipsisBounce';

export interface EntityMultiSelectProps {
  entityCode: string;
  values: any[];           // Array of { entity_code, *__*_id, label }
  labelField: string;      // The label field name (e.g., "stakeholder")
  onAdd: (uuid: string, label: string) => void;
  onRemove: (uuid: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Domain component for entity array references
 * Used for all entity array fields (_IDS fields)
 *
 * Wraps SearchableMultiSelect with automatic data fetching from entity entity-instance API
 *
 * @example
 * <EntityMultiSelect
 *   entityCode="employee"
 *   values={[{ entity_code: "employee", stakeholder__employee_id: "uuid", stakeholder: "Name" }]}
 *   labelField="stakeholder"
 *   onAdd={(uuid, label) => handleAdd(uuid, label)}
 *   onRemove={(uuid) => handleRemove(uuid)}
 * />
 */
export function EntityMultiSelect({
  entityCode,
  values,
  labelField,
  onAdd,
  onRemove,
  disabled = false,
  placeholder = 'Select...'
}: EntityMultiSelectProps) {

  const { data: options = [], isLoading } = useQuery({
    queryKey: ['entity-lookup', entityCode],
    queryFn: async () => {
      const response = await apiClient.get(`/api/v1/entity/${entityCode}/entity-instance`, {
        params: { active_only: true, limit: 500 }
      });

      // Transform entity data to SearchableMultiSelect format
      return response.data.data.map((item: any) => ({
        value: item.id,
        label: item.name
      }));
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    enabled: !!entityCode
  });

  // Extract current UUIDs from values array
  const selectedUuids = values.map((value) => {
    const uuidField = Object.keys(value).find(k => k.endsWith('_id'));
    return uuidField ? value[uuidField] : null;
  }).filter(Boolean) as string[];

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
