import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface EntitySelectDropdownProps {
  label: string;
  entityCode: string;
  value: string;           // Current UUID
  currentLabel: string;    // Current display label
  onChange: (uuid: string, label: string) => void;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  placeholder?: string;
}

/**
 * EntitySelectDropdown - Single select dropdown for _ID fields
 *
 * Loads options from /api/v1/entity/{entityCode}/entity-instance-lookup
 * Returns both UUID and label on change
 *
 * Usage:
 * <EntitySelectDropdown
 *   label="Manager"
 *   entityCode="employee"
 *   value="uuid-123"
 *   currentLabel="James Miller"
 *   onChange={(uuid, label) => handleChange(uuid, label)}
 * />
 */
export const EntitySelectDropdown: React.FC<EntitySelectDropdownProps> = ({
  label,
  entityCode,
  value,
  currentLabel,
  onChange,
  disabled = false,
  readonly = false,
  required = false,
  placeholder = 'Select...'
}) => {
  const [options, setOptions] = useState<Array<{ id: string; name: string }>>([]);
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
        setOptions(response.data.data || []);
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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUuid = e.target.value;
    if (!selectedUuid) {
      onChange('', '');
      return;
    }

    const selectedOption = options.find(opt => opt.id === selectedUuid);
    if (selectedOption) {
      onChange(selectedOption.id, selectedOption.name);
    }
  };

  if (loading) {
    return (
      <div className="w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
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
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || readonly}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
};
