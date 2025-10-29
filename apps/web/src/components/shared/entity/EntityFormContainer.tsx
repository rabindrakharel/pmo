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
import { DateRangeVisualizer } from '../ui/DateRangeVisualizer';
import { formatRelativeTime, formatFriendlyDate, formatCurrency, isCurrencyField } from '../../../lib/data_transform_render';
import { MetadataTable } from './MetadataTable';

/**
 * Helper function to render badge with color based on field type and value
 */
function renderFieldBadge(fieldKey: string, value: string): React.ReactNode {
  // Priority field colors
  if (fieldKey.toLowerCase().includes('priority')) {
    const colorMap: Record<string, string> = {
      'high': 'bg-red-100 text-red-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'low': 'bg-green-100 text-green-800',
      'critical': 'bg-red-200 text-red-900',
      'urgent': 'bg-orange-100 text-orange-800'
    };
    const colorClass = colorMap[value.toLowerCase()] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {value}
      </span>
    );
  }

  // Stage field colors
  if (fieldKey.toLowerCase().includes('stage')) {
    const colorMap: Record<string, string> = {
      'initiation': 'bg-blue-100 text-blue-800',
      'planning': 'bg-indigo-100 text-indigo-800',
      'execution': 'bg-purple-100 text-purple-800',
      'monitoring': 'bg-yellow-100 text-yellow-800',
      'closure': 'bg-green-100 text-green-800',
      'backlog': 'bg-gray-100 text-gray-800',
      'to do': 'bg-blue-100 text-blue-800',
      'in progress': 'bg-purple-100 text-purple-800',
      'in review': 'bg-yellow-100 text-yellow-800',
      'done': 'bg-green-100 text-green-800',
      'blocked': 'bg-red-100 text-red-800'
    };
    const colorClass = colorMap[value.toLowerCase()] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {value}
      </span>
    );
  }

  // Status field colors
  if (fieldKey.toLowerCase().includes('status')) {
    const colorMap: Record<string, string> = {
      'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-gray-100 text-gray-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'draft': 'bg-gray-100 text-gray-800',
      'published': 'bg-green-100 text-green-800',
      'archived': 'bg-gray-300 text-gray-700'
    };
    const colorClass = colorMap[value.toLowerCase()] || 'bg-gray-100 text-gray-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {value}
      </span>
    );
  }

  // Default: just return text
  return <span className="text-sm text-gray-700">{value}</span>;
}

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

      // Special handling for timestamp fields (created_at, updated_at, created_ts, updated_ts)
      if (field.type === 'timestamp' && value) {
        return (
          <span
            className="text-gray-600"
            title={formatFriendlyDate(value)}
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
          >
            {formatRelativeTime(value)}
          </span>
        );
      }

      // Special handling for date range fields (start_date + end_date, planned_start_date + planned_end_date, etc.)
      const isStartDateField = field.key === 'start_date' || field.key === 'planned_start_date' || field.key === 'actual_start_date';
      const isEndDateField = field.key === 'end_date' || field.key === 'planned_end_date' || field.key === 'actual_end_date';

      // Get corresponding start/end field keys
      let startFieldKey: string | null = null;
      let endFieldKey: string | null = null;

      if (field.key === 'start_date' || field.key === 'end_date') {
        startFieldKey = 'start_date';
        endFieldKey = 'end_date';
      } else if (field.key === 'planned_start_date' || field.key === 'planned_end_date') {
        startFieldKey = 'planned_start_date';
        endFieldKey = 'planned_end_date';
      } else if (field.key === 'actual_start_date' || field.key === 'actual_end_date') {
        startFieldKey = 'actual_start_date';
        endFieldKey = 'actual_end_date';
      }

      if (isStartDateField && endFieldKey && data[endFieldKey]) {
        // Skip rendering start_date individually if we have both dates
        // They will be rendered together in the end_date field
        return null;
      }

      if (isEndDateField && startFieldKey && data[startFieldKey]) {
        // Render date range visualizer for both start and end dates
        return <DateRangeVisualizer startDate={data[startFieldKey]} endDate={value} />;
      }

      // Regular date field rendering
      if (field.type === 'date' && value) {
        return (
          <span
            className="text-gray-700"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
          >
            {formatFriendlyDate(value)}
          </span>
        );
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
        const displayValue = option?.label || value;

        if (!displayValue) return (
          <span
            className="text-gray-400"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
          >
            -
          </span>
        );

        // Render badge for priority, stage, status fields
        if (field.key.toLowerCase().includes('priority') ||
            field.key.toLowerCase().includes('stage') ||
            field.key.toLowerCase().includes('status')) {
          return renderFieldBadge(field.key, displayValue);
        }

        return (
          <span
            className="text-gray-700"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
          >
            {displayValue}
          </span>
        );
      }
      if (field.type === 'textarea' || field.type === 'richtext') {
        return (
          <div
            className="whitespace-pre-wrap text-gray-700"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em',
              lineHeight: '1.6'
            }}
          >
            {value || '-'}
          </div>
        );
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
      if (field.type === 'jsonb') {
        // Use MetadataTable for metadata field, raw JSON for others
        if (field.key === 'metadata') {
          return <MetadataTable value={value || {}} isEditing={false} />;
        }
        // Other JSONB fields show as formatted JSON
        if (value) {
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
        return <span className="text-gray-400">No data</span>;
      }
      if (field.type === 'number') {
        // Auto-detect and format currency fields
        if (isCurrencyField(field.key)) {
          return (
            <span
              className="text-gray-700 font-medium"
              style={{
                fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                fontSize: '14px',
                letterSpacing: '-0.01em'
              }}
            >
              {formatCurrency(value)}
            </span>
          );
        }
        // Handle explicit prefix (deprecated, use isCurrencyField instead)
        if (field.prefix) {
          return (
            <span
              className="text-gray-700"
              style={{
                fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                fontSize: '14px',
                letterSpacing: '-0.01em'
              }}
            >
              {`${field.prefix}${value || 0}`}
            </span>
          );
        }
        // Regular number
        return (
          <span
            className="text-gray-700"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em'
            }}
          >
            {value || '-'}
          </span>
        );
      }
      return (
        <span
          className="text-gray-700"
          style={{
            fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
            fontSize: '14px',
            letterSpacing: '-0.01em'
          }}
        >
          {value || '-'}
        </span>
      );
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
            className={`w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 ${
              field.readonly ? 'cursor-not-allowed text-gray-400' : 'text-gray-900 placeholder:text-gray-400/60 hover:placeholder:text-gray-500/80'
            }`}
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em',
              fontWeight: '400'
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
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 resize-none text-gray-900 placeholder:text-gray-400/60 hover:placeholder:text-gray-500/80"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em',
              lineHeight: '1.6',
              fontWeight: '400'
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
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-gray-900 placeholder:text-gray-400/60 hover:placeholder:text-gray-500/80"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em',
              fontWeight: '400'
            }}
            disabled={field.disabled || field.readonly}
          />
        );
      case 'jsonb':
        // Use MetadataTable for metadata field in edit mode
        if (field.key === 'metadata') {
          return (
            <MetadataTable
              value={value || {}}
              onChange={(newValue) => onChange(field.key, newValue)}
              isEditing={true}
            />
          );
        }
        // Other JSONB fields use textarea with JSON
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
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-gray-900 cursor-pointer hover:text-blue-700"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em',
              fontWeight: '400'
            }}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          >
            <option value="" className="text-gray-400">Select...</option>
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
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-gray-900 cursor-pointer hover:text-blue-700"
            style={{
              fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
              fontSize: '14px',
              letterSpacing: '-0.01em',
              fontWeight: '400'
            }}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );
      case 'timestamp':
        // Timestamp fields are readonly and show relative time
        return (
          <span
            className="text-gray-600"
            title={value ? formatFriendlyDate(value) : undefined}
          >
            {value ? formatRelativeTime(value) : '-'}
          </span>
        );
      default:
        return <span>{value || '-'}</span>;
    }
  };

  // Exclude name, code, slug, id, tags, created_ts, updated_ts from form (they're in the page header now)
  // But keep description/descr field
  const excludedFields = ['name', 'title', 'code', 'slug', 'id', 'tags', 'created_ts', 'updated_ts'];
  const visibleFields = config.fields.filter(f => !excludedFields.includes(f.key));

  return (
    <div className="bg-gradient-to-br from-white via-white to-blue-50/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_-8px_rgba(0,0,0,0.04)] overflow-hidden backdrop-blur-sm border border-gray-100/50">
      <div className="p-6">
        <div className="space-y-0">
          {visibleFields.map((field, index) => {
            // Hide start_date fields if we have both start and end dates (they'll render together)
            const isStartDateField = field.key === 'start_date' || field.key === 'planned_start_date' || field.key === 'actual_start_date';
            const hasCorrespondingEndDate =
              (field.key === 'start_date' && data.end_date) ||
              (field.key === 'planned_start_date' && data.planned_end_date) ||
              (field.key === 'actual_start_date' && data.actual_end_date);

            if (isStartDateField && !isEditing && hasCorrespondingEndDate) {
              return null;
            }

            return (
            <div key={field.key}>
              {index > 0 && (
                <div
                  className="h-px my-1.5 opacity-60"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, transparent, rgba(209, 213, 219, 0.2) 50%, transparent)'
                  }}
                />
              )}
              <div className="group transition-all duration-300 ease-out py-1"
            >
              <div className="grid grid-cols-[160px_1fr] gap-4 items-start">
                <label
                  className="text-xs font-medium text-gray-500 pt-2 flex items-center gap-1.5"
                  style={{
                    fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                    letterSpacing: '0.01em',
                    textTransform: 'uppercase',
                    fontSize: '11px'
                  }}
                >
                  <span className="opacity-50 group-hover:opacity-100 transition-all duration-300 group-hover:text-blue-600">
                    {/* Show "Date Range" label when displaying both start and end dates together */}
                    {field.key === 'end_date' && data.start_date && !isEditing ? 'Date Range' :
                     field.key === 'planned_end_date' && data.planned_start_date && !isEditing ? 'Planned Date Range' :
                     field.key === 'actual_end_date' && data.actual_start_date && !isEditing ? 'Actual Date Range' :
                     field.label}
                  </span>
                  {field.required && mode === 'create' && (
                    <span className="text-rose-400 text-xs animate-pulse">*</span>
                  )}
                </label>
                <div
                  className={`
                    relative break-words rounded-md px-3 py-2 -ml-3
                    transition-all duration-300 ease-out
                    ${isEditing
                      ? 'bg-gradient-to-br from-gray-50/50 via-white/50 to-gray-50/30 hover:from-blue-50/30 hover:via-white/70 hover:to-blue-50/20 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1),0_2px_8px_-2px_rgba(59,130,246,0.08)] focus-within:from-white focus-within:via-white focus-within:to-blue-50/20 focus-within:shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_4px_16px_-4px_rgba(59,130,246,0.15),0_0_24px_-8px_rgba(96,165,250,0.2)] focus-within:scale-[1.002]'
                      : 'hover:bg-gradient-to-br hover:from-gray-50/40 hover:via-white/20 hover:to-gray-50/30'
                    }
                  `}
                  style={{
                    fontFamily: "'Inter', 'Open Sans', 'Helvetica Neue', helvetica, arial, sans-serif",
                    fontSize: '13px',
                    color: '#1f2937',
                    letterSpacing: '-0.01em',
                    lineHeight: '1.5'
                  }}
                >
                  {renderField(field)}
                </div>
              </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
