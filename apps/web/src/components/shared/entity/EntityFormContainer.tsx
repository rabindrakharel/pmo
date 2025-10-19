import React, { useState, useEffect } from 'react';
import type { EntityConfig, FieldDef } from '../../../lib/entityConfig';
import {
  loadFieldOptions,
  type SettingOption
} from '../../../lib/settingsLoader';
import { SequentialStateVisualizer } from './SequentialStateVisualizer';
import { isSequentialStateField } from '../../../lib/sequentialStateConfig';

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

  // Load setting options on mount
  useEffect(() => {
    const loadAllSettingOptions = async () => {
      if (!config) return;

      const optionsMap = new Map<string, SettingOption[]>();

      // Find all fields that need dynamic settings
      const fieldsNeedingSettings = config.fields.filter(
        field => field.loadOptionsFromSettings && field.type === 'select'
      );

      // Load options for each field
      await Promise.all(
        fieldsNeedingSettings.map(async (field) => {
          try {
            const options = await loadFieldOptions(field.key);
            if (options.length > 0) {
              optionsMap.set(field.key, options);
            }
          } catch (error) {
            console.error(`Failed to load options for ${field.key}:`, error);
          }
        })
      );

      setSettingOptions(optionsMap);
    };

    loadAllSettingOptions();
  }, [config]);

  // Render field based on configuration
  const renderField = (field: FieldDef) => {
    const value = data[field.key];

    // Check if this is a sequential state field
    const hasDynamicOptions = field.loadOptionsFromSettings && settingOptions.has(field.key);
    const options = hasDynamicOptions
      ? settingOptions.get(field.key)!
      : field.options || [];
    const isSequentialField = field.type === 'select'
      && isSequentialStateField(field.key, hasDynamicOptions)
      && options.length > 0;

    if (!isEditing) {
      // Display mode
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
            className="w-full border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-0 focus:outline-none transition-colors bg-transparent px-0 py-0"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              color: '#333'
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
            className="w-full border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-0 focus:outline-none transition-colors bg-transparent px-0 py-0 resize-none"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              color: '#333'
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
            className="w-full border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-0 focus:outline-none transition-colors bg-transparent px-0 py-0"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              color: '#333'
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
      case 'select':
      case 'multiselect': {
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
            className="w-full border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-0 focus:outline-none transition-colors bg-transparent px-0 py-0"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              color: '#333'
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
      case 'date':
        return (
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="w-full border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-0 focus:outline-none transition-colors bg-transparent px-0 py-0"
            style={{
              fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '13px',
              color: '#333'
            }}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );
      default:
        return <span>{value || '-'}</span>;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-8">
        <div className="space-y-1">
          {config.fields.map((field) => (
            <div
              key={field.key}
              className="group transition-colors rounded-md px-3 py-2 grid grid-cols-[160px_1fr] gap-2 items-start hover:bg-gray-50"
            >
              <label
                style={{
                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                  fontSize: '13px',
                  fontWeight: 400,
                  color: '#6b7280'
                }}
              >
                {field.label}
                {field.required && mode === 'create' && <span className="text-red-400 ml-1">*</span>}
              </label>
              <div
                className={`break-words rounded px-2 py-1 -mx-2 -my-1 ${isEditing ? 'bg-gray-100 hover:bg-gray-200' : ''}`}
                style={{
                  fontFamily: "'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                  fontSize: '13px',
                  color: '#333'
                }}
              >
                {renderField(field)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
