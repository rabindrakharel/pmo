import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { SearchableMultiSelect } from './SearchableMultiSelect';

interface EntityMultiSelectTagsProps {
  label: string;
  entityCode: string;
  values: any[];           // Array of { entity_code, *__*_id, label }
  labelField: string;      // The label field name (e.g., "stakeholder")
  onAdd: (uuid: string, label: string) => void;
  onRemove: (uuid: string) => void;
  disabled?: boolean;
  readonly?: boolean;
  placeholder?: string;
}

/**
 * EntityMultiSelectTags - Multi-select with tags for _IDS fields
 *
 * Uses existing SearchableMultiSelect component
 * Loads options from /api/v1/entity/{entityCode}/entity-instance-lookup
 * Returns both UUID and label on add
 *
 * Usage:
 * <EntityMultiSelectTags
 *   label="Stakeholder"
 *   entityCode="employee"
 *   values={[ { entity_code: "employee", stakeholder__employee_id: "uuid", stakeholder: "Mike" } ]}
 *   labelField="stakeholder"
 *   onAdd={(uuid, label) => handleAdd(uuid, label)}
 *   onRemove={(uuid) => handleRemove(uuid)}
 * />
 */
export const EntityMultiSelectTags: React.FC<EntityMultiSelectTagsProps> = ({
  label,
  entityCode,
  values,
  labelField,
  onAdd,
  onRemove,
  disabled = false,
  readonly = false,
  placeholder = 'Select...'
}) => {
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load options from /api/v1/entity/{entityCode}/entity-instance-lookup
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/api/v1/entity/${entityCode}/entity-instance-lookup`, {
          params: { active_only: true, limit: 500 }
        });

        // Convert to SearchableMultiSelect format
        const formattedOptions = (response.data.data || []).map((item: any) => ({
          value: item.id,
          label: item.name
        }));

        setOptions(formattedOptions);
      } catch (err) {
        console.error(`Error loading ${entityCode} instance lookup:`, err);
        setError(`Failed to load ${entityCode} options`);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    if (entityCode) {
      loadOptions();
    }
  }, [entityCode]);

  // Extract current UUIDs from values
  const selectedUuids = values.map((value) => {
    const uuidField = Object.keys(value).find(k => k.endsWith('_id'));
    return uuidField ? value[uuidField] : null;
  }).filter(Boolean);

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

  if (loading) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm">
          Loading options...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <SearchableMultiSelect
        options={options}
        value={selectedUuids}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        readonly={readonly}
      />
    </div>
  );
};
