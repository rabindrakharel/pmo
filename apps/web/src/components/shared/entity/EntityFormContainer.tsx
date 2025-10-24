import React, { useState, useEffect } from 'react';
import type { EntityConfig, FieldDef } from '../../../lib/entityConfig';
import {
  loadFieldOptions,
  type SettingOption
} from '../../../lib/settingsLoader';
import { SequentialStateVisualizer } from './SequentialStateVisualizer';
import { isSequentialStateField } from '../../../lib/sequentialStateConfig';
import { renderEmployeeNames } from '../../../lib/entityConfig';
import { entityOptionsApi } from '../../../lib/api';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';

/**
 * EntityFormContainer
 *
 * A reusable form container component that renders form fields based on entityConfig.
 * Used by both EntityDetailPage (edit mode) and EntityCreatePage (create mode).
 *
 * Features:
 * - Dynamically loads dropdown options from settings tables
 * - Supports all field types from entityConfig
 * - Consistent styling matching EntityDetailPage
 * - Handles field validation
 */

interface EntityFormContainerProps {
  config: EntityConfig;
  data: Record<string, any>;
  isEditing: boolean;
  onChange: (fieldKey: string, value: any) => void;
  mode?: 'create' | 'edit';
}

export function EntityFormContainer({
  config,
  data,
  isEditing,
  onChange,
  mode = 'edit'
}: EntityFormContainerProps) {
  const [settingOptions, setSettingOptions] = useState<Map<string, SettingOption[]>>(new Map());
  const [entityOptions, setEntityOptions] = useState<Map<string, SettingOption[]>>(new Map());

  // Load setting options on mount
  useEffect(() => {
    const loadAllOptions = async () => {
      if (!config) return;

      const settingsMap = new Map<string, SettingOption[]>();
      const entitiesMap = new Map<string, SettingOption[]>();

      // Find all fields that need dynamic settings
      const fieldsNeedingSettings = config.fields.filter(
        field => field.loadOptionsFromSettings && (field.type === 'select' || field.type === 'multiselect')
      );

      // Find all fields that need entity options
      const fieldsNeedingEntityOptions = config.fields.filter(
        field => field.loadOptionsFromEntity && (field.type === 'select' || field.type === 'multiselect')
      );

      // Load settings options
      await Promise.all(
        fieldsNeedingSettings.map(async (field) => {
          try {
            const options = await loadFieldOptions(field.key);
            if (options.length > 0) {
              settingsMap.set(field.key, options);
            }
          } catch (error) {
            console.error(`Failed to load settings options for ${field.key}:`, error);
          }
        })
      );

      // Load entity options
      await Promise.all(
        fieldsNeedingEntityOptions.map(async (field) => {
          try {
            const response = await entityOptionsApi.getOptions(field.loadOptionsFromEntity!, { limit: 500 });
            const options = response.data.map((item: any) => ({
              value: item.id,
              label: item.name
            }));
            if (options.length > 0) {
              entitiesMap.set(field.key, options);
            }
          } catch (error) {
            console.error(`Failed to load entity options for ${field.key}:`, error);
          }
        })
      );

      setSettingOptions(settingsMap);
      setEntityOptions(entitiesMap);
    };

    loadAllOptions();
  }, [config]);

  // Render field based on configuration
  const renderField = (field: FieldDef) => {
    const value = data[field.key];

    // Check if this is a sequential state field
    const hasSettingOptions = field.loadOptionsFromSettings && settingOptions.has(field.key);
    const hasEntityOptions = field.loadOptionsFromEntity && entityOptions.has(field.key);
    const options = hasEntityOptions
      ? entityOptions.get(field.key)!
      : hasSettingOptions
      ? settingOptions.get(field.key)!
      : field.options || [];
    const isSequentialField = field.type === 'select'
      && isSequentialStateField(field.key, hasSettingOptions)
      && options.length > 0;

    if (!isEditing) {
      // Display mode

      // Special handling for employee assignment fields
      if (field.key === 'assignee_employee_ids') {
        return renderEmployeeNames(value, data);
      }

      if (field.type === 'date' && value) {
        return new Date(value).toLocaleDateString();
      }
      if (field.type === 'select') {
        // Use sequential state visualizer for workflow stages/funnels
        if (isSequentialField) {
          return (
            <SequentialStateVisualizer
              states={options}
              currentState={value}
              editable={false}
            />
          );
        }

        const option = options.find((opt: any) => String(opt.value) === String(value));
        return option?.label || (value ?? '-');
      }
      if (field.type === 'textarea' || field.type === 'richtext') {
        return <div className="whitespace-pre-wrap">{value || '-'}</div>;
      }
      if (field.type === 'array' && Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-2">
            {value.map((item, idx) => (
              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-blue-100 text-blue-800">
                {item}
              </span>
            ))}
          </div>
        );
      }
      if (field.type === 'jsonb' && value) {
        return (
          <pre
            className="font-mono bg-gray-50 p-2 rounded overflow-auto max-h-40"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              color: '#333'
            }}
          >
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      }
      if (field.type === 'number' && field.prefix) {
        return `${field.prefix}${value || 0}`;
      }
      return value || '-';
    }

    // Edit mode
    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <input
            type={field.type}
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={`w-full border-0 focus:ring-0 focus:outline-none transition-all duration-200 bg-transparent px-0 py-0 ${
              field.readonly ? 'cursor-not-allowed text-gray-400' : 'text-gray-900'
            }`}
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
            placeholder={field.placeholder}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );
      case 'textarea':
      case 'richtext':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            rows={field.type === 'richtext' ? 6 : 4}
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-200 bg-transparent px-0 py-0 resize-none text-gray-900"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em',
              lineHeight: '1.6'
            }}
            placeholder={field.placeholder}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );
      case 'array':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : ''}
            onChange={(e) => onChange(field.key, e.target.value.split(',').map(v => v.trim()).filter(Boolean))}
            placeholder={field.placeholder || "Enter comma-separated values"}
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-200 bg-transparent px-0 py-0 text-gray-900"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
            disabled={field.disabled || field.readonly}
          />
        );
      case 'jsonb':
        return (
          <textarea
            value={value ? JSON.stringify(value, null, 2) : ''}
            onChange={(e) => {
              try {
                onChange(field.key, JSON.parse(e.target.value));
              } catch {
                // Invalid JSON, don't update
              }
            }}
            rows={6}
            className="w-full border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-0 focus:outline-none transition-colors bg-transparent px-0 py-0 font-mono resize-none"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              color: '#333'
            }}
            placeholder={field.placeholder}
            disabled={field.disabled || field.readonly}
          />
        );
      case 'select': {
        // Use sequential state visualizer for workflow stages/funnels in edit mode
        if (isSequentialField) {
          return (
            <SequentialStateVisualizer
              states={options}
              currentState={value}
              editable={true}
              onStateChange={(newValue) => onChange(field.key, newValue)}
            />
          );
        }

        // Regular dropdown for non-sequential fields
        return (
          <select
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => {
              let newValue: any = e.target.value;
              if (field.coerceBoolean) {
                newValue = e.target.value === 'true';
              }
              onChange(field.key, newValue === '' ? undefined : newValue);
            }}
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-200 bg-transparent px-0 py-0 text-gray-900 cursor-pointer"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          >
            <option value="">Select...</option>
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }
      case 'multiselect': {
        // Parse current value as array
        const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

        // Use SearchableMultiSelect component for better UX
        return (
          <SearchableMultiSelect
            options={options}
            value={selectedValues}
            onChange={(newValues) => onChange(field.key, newValues)}
            placeholder={field.placeholder || 'Select...'}
            disabled={field.disabled}
            readonly={field.readonly}
          />
        );
      }
      case 'date':
        return (
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-200 bg-transparent px-0 py-0 text-gray-900 cursor-pointer"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );
      default:
        return <span>{value || '-'}</span>;
    }
  };

  // Exclude name, code, slug, id from form (they're in the page header now)
  // But keep description/descr field
  const excludedFields = ['name', 'title', 'code', 'slug', 'id'];
  const visibleFields = config.fields.filter(f => !excludedFields.includes(f.key));

  return (
    <div className="bg-gradient-to-br from-white via-white to-gray-50/30 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="space-y-0">
          {visibleFields.map((field, index) => (
            <div key={field.key}>
              {index > 0 && (
                <div
                  className="h-px my-1.5"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, rgba(209, 213, 219, 0.15) 0px, rgba(209, 213, 219, 0.15) 4px, transparent 4px, transparent 8px)'
                  }}
                />
              )}
              <div className="group transition-all duration-200 ease-out py-1.5"
            >
              <div className="grid grid-cols-[160px_1fr] gap-4 items-start">
                <label
                  className="text-xs font-medium text-gray-500 pt-1 flex items-center gap-1.5"
                  style={{
                    fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                    letterSpacing: '-0.01em'
                  }}
                >
                  <span className="opacity-60 group-hover:opacity-100 transition-opacity">
                    {field.label}
                  </span>
                  {field.required && mode === 'create' && (
                    <span className="text-rose-400 text-xs">*</span>
                  )}
                </label>
                <div
                  className={`
                    relative break-words rounded-lg px-2.5 py-1 -ml-2.5
                    transition-all duration-200
                    ${isEditing
                      ? 'bg-white/80 border border-gray-200 hover:border-blue-300 hover:shadow-sm focus-within:border-blue-400 focus-within:shadow-md focus-within:bg-white'
                      : 'border border-transparent hover:bg-gray-50/50'
                    }
                  `}
                  style={{
                    fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                    fontSize: '13px',
                    color: '#1f2937',
                    letterSpacing: '-0.01em',
                    lineHeight: '1.4'
                  }}
                >
                  {renderField(field)}
                </div>
              </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
