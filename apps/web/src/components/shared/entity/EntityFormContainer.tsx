import React, { useState, useEffect, useMemo } from 'react';
import type { EntityConfig, FieldDef } from '../../../lib/entityConfig';
import {
  loadFieldOptions,
  type SettingOption
} from '../../../lib/settingsLoader';
import { DAGVisualizer, type DAGNode } from '../../workflow/DAGVisualizer';
import { renderEmployeeNames } from '../../../lib/entityConfig';
import { entityOptionsApi } from '../../../lib/api';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import { DateRangeVisualizer } from '../ui/DateRangeVisualizer';
import { formatRelativeTime, formatFriendlyDate, formatCurrency, isCurrencyField } from '../../../lib/universalFormatterService';
import { MetadataTable } from './MetadataTable';
import { QuoteItemsRenderer } from './QuoteItemsRenderer';
import { getBadgeClass, textStyles } from '../../../lib/designSystem';

// ============================================================================
// NEW: Universal Field Detector Integration
// ============================================================================
import { generateFormConfig, type FormField } from '../../../lib/viewConfigGenerator';
import { detectField } from '../../../lib/universalFieldDetector';

/**
 * Helper function to render badge with color based on field type and value
 * Now uses the centralized design system for consistency
 */
function renderFieldBadge(fieldKey: string, value: string): React.ReactNode {
  const badgeClass = getBadgeClass(fieldKey, value);
  return <span className={badgeClass}>{value}</span>;
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
  config?: EntityConfig;              // Now optional - can be auto-generated
  data: Record<string, any>;
  isEditing: boolean;
  onChange: (fieldKey: string, value: any) => void;
  mode?: 'create' | 'edit';

  // ============================================================================
  // NEW: Auto-Generation Support (Universal Field Detector Integration)
  // ============================================================================
  /**
   * Auto-generate form fields from data using universal field detector
   * When true and config is not provided, automatically detects field types
   * and generates appropriate field configurations
   *
   * @example
   * <EntityFormContainer data={project} autoGenerateFields isEditing onChange={handleChange} />
   * // Automatically detects: budget_allocated_amt → currency, dl__project_stage → DAG, etc.
   */
  autoGenerateFields?: boolean;

  /**
   * Optional data types for auto-generation (for JSONB/array detection)
   * @example
   * dataTypes={{ metadata: 'jsonb'}}
   */
  dataTypes?: Record<string, string>;

  /**
   * Required fields for auto-generated forms
   * @example
   * requiredFields={['name', 'code']}
   */
  requiredFields?: string[];
}

export function EntityFormContainer({
  config,
  data,
  isEditing,
  onChange,
  mode = 'edit',
  autoGenerateFields = false,
  dataTypes,
  requiredFields = []
}: EntityFormContainerProps) {
  // ============================================================================
  // AUTO-GENERATION: Universal Field Detector Integration
  // ============================================================================
  // Convert FormField to FieldDef format for backward compatibility
  const fields = useMemo(() => {
    // If config provided with fields, use them (backward compatibility)
    if (config?.fields && config.fields.length > 0) {
      return config.fields;
    }

    // Auto-generate if enabled and data exists
    if (autoGenerateFields && Object.keys(data).length > 0) {
      const fieldKeys = Object.keys(data);
      const generatedConfig = generateFormConfig(fieldKeys, {
        dataTypes,
        requiredFields
      });

      // Convert FormField to FieldDef format
      return generatedConfig.editableFields.map(field => ({
        key: field.key,
        label: field.label,
        type: field.type as any, // FormField.type matches FieldDef.type
        required: generatedConfig.requiredFields.includes(field.key),
        readonly: !field.editable,
        loadOptionsFromSettings: field.loadFromSettings,
        loadOptionsFromEntity: field.loadFromEntity} as FieldDef));
    }

    // Fallback: empty fields
    return [];
  }, [config, autoGenerateFields, data, dataTypes, requiredFields]);
  const [settingOptions, setSettingOptions] = useState<Map<string, SettingOption[]>>(new Map());
  const [entityOptions, setEntityOptions] = useState<Map<string, SettingOption[]>>(new Map());
  const [dagNodes, setDagNodes] = useState<Map<string, DAGNode[]>>(new Map());

  // Helper to determine if a field should use DAG visualization
  // All dl__% fields that are stage or funnel fields use DAG visualization
  const isStageField = (fieldKey: string): boolean => {
    const lowerKey = fieldKey.toLowerCase();
    // Check if field starts with dl__ (datalabel prefix) and contains stage or funnel
    const result = lowerKey.startsWith('dl__') && (lowerKey.includes('stage') || lowerKey.includes('funnel'));
    console.log(`[EntityFormContainer] isStageField(${fieldKey}):`, result);
    return result;
  };

  // Helper function to load DAG structure from setting_datalabel table
  // Note: This loads the DAG STRUCTURE ONLY (nodes, parent_ids, relationships)
  // The actual current value comes from the entity table (e.g., project.dl__project_stage)
  const loadDagNodes = async (fieldKey: string): Promise<DAGNode[]> => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Consistent structure: field keys already use dl__ prefix (e.g., dl__project_stage, dl__task_stage)
      // If field doesn't have dl__ prefix, add it (legacy support)
      const datalabel = fieldKey.startsWith('dl__') ? fieldKey : `dl__${fieldKey}`;

      // Fetch DAG structure from setting_datalabel table via settings API
      // raw=true returns full metadata array with parent_ids, entity_name, terminal_flag, etc.
      // Source: /home/rabin/projects/pmo/db/setting_datalabel.ddl
      const response = await fetch(`${API_BASE_URL}/api/v1/setting?datalabel=${datalabel}&raw=true`, { headers });
      if (!response.ok) return [];

      const result = await response.json();

      // Backend returns: {id, name, descr, parent_ids, entity_name, terminal_flag, color_code}
      // Transform to DAGNode format: {id, node_name, parent_ids} only
      // Note: API should return parent_ids as array already from settings table
      if (result.data && Array.isArray(result.data)) {
        return result.data.map((item: any) => {
          // Handle both parent_ids (array) and parent_id (singular) for backward compatibility
          let parentIds: number[] = [];
          if (Array.isArray(item.parent_ids)) {
            parentIds = item.parent_ids;
          } else if (item.parent_id !== null && item.parent_id !== undefined) {
            parentIds = [item.parent_id];
          }

          console.log(`[loadDagNodes] Transforming node ${item.id} (${item.name}):`, {
            raw_parent_ids: item.parent_ids,
            raw_parent_id: item.parent_id,
            transformed_parent_ids: parentIds
          });

          return {
            id: item.id,              // Stage ID (e.g., 0, 1, 2)
            node_name: item.name,     // Stage name (e.g., "Initiation", "Planning")
            parent_ids: parentIds     // Parent IDs array
          };
        }) as DAGNode[];
      }

      return [];
    } catch (error) {
      console.error(`Failed to load DAG nodes for ${fieldKey}:`, error);
      return [];
    }
  };

  // Load setting options on mount
  useEffect(() => {
    const loadAllOptions = async () => {
      if (!fields || fields.length === 0) return;

      const settingsMap = new Map<string, SettingOption[]>();
      const entitiesMap = new Map<string, SettingOption[]>();
      const dagNodesMap = new Map<string, DAGNode[]>();

      // Find all fields that need dynamic settings
      const fieldsNeedingSettings = fields.filter(
        field => field.loadOptionsFromSettings && (field.type === 'select' || field.type === 'multiselect')
      );

      // Find all fields that need entity options
      const fieldsNeedingEntityOptions = fields.filter(
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

            // Load DAG nodes for stage/funnel fields
            if (isStageField(field.key)) {
              const nodes = await loadDagNodes(field.key);
              console.log(`[EntityFormContainer] Loaded DAG nodes for ${field.key}:`, nodes);
              if (nodes.length > 0) {
                dagNodesMap.set(field.key, nodes);
              } else {
                console.warn(`[EntityFormContainer] No DAG nodes loaded for ${field.key}`);
              }
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
      setDagNodes(dagNodesMap);
    };

    loadAllOptions();
  }, [fields]);

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
      && hasSettingOptions
      && isStageField(field.key)
      && options.length > 0;

    // Debug logging for funnel fields
    if (field.key.includes('funnel')) {
      console.log(`[EntityFormContainer] Field ${field.key}:`, {
        type: field.type,
        hasSettingOptions,
        isStageField: isStageField(field.key),
        optionsLength: options.length,
        isSequentialField,
        hasDagNodes: dagNodes.has(field.key),
        dagNodesCount: dagNodes.get(field.key)?.length || 0
      });
    }

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
            className="text-dark-700 text-base tracking-tight"
            title={formatFriendlyDate(value)}
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
          <span className="text-dark-600 text-base tracking-tight">
            {formatFriendlyDate(value)}
          </span>
        );
      }
      if (field.type === 'select') {
        // Use DAG visualizer for workflow stages/funnels
        if (isSequentialField && dagNodes.has(field.key)) {
          // TWO DATA SOURCES for DAG visualization:
          // 1. DAG structure (nodes, parent_ids, relationships) from setting_datalabel table
          const nodes = dagNodes.get(field.key)!; // {id, node_name, parent_ids}[]

          // 2. Current value (actual stage name) from entity table (e.g., project.dl__project_stage = "Execution")
          // Find the matching node ID by stage name
          const currentNode = nodes.find(n => n.node_name === value);

          return (
            <div className="space-y-3">
              {/* Display actual stage value from entity table */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-dark-600">Current Stage:</span>
                {renderFieldBadge(field.key, value || 'Not Set')}
              </div>
              {/* DAG visualization overlay from setting_datalabel */}
              <DAGVisualizer
                nodes={nodes}                      // DAG structure: {id, node_name, parent_ids}[]
                currentNodeId={currentNode?.id}    // Current node ID matched from stage name
              />
            </div>
          );
        }

        const option = options.find((opt: any) => String(opt.value) === String(value));
        const displayValue = option?.label || value;

        if (!displayValue) return (
          <span className="text-dark-600 text-base tracking-tight">
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
          <span className="text-dark-600 text-base tracking-tight">
            {displayValue}
          </span>
        );
      }
      if (field.type === 'textarea' || field.type === 'richtext') {
        return (
          <div className="whitespace-pre-wrap text-dark-600 text-base tracking-tight leading-relaxed">
            {value || '-'}
          </div>
        );
      }
      if (field.type === 'array' && Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-2">
            {value.map((item, idx) => (
              <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal bg-dark-100 text-dark-600">
                {item}
              </span>
            ))}
          </div>
        );
      }
      if (field.type === 'jsonb') {
        // Special renderers for specific JSONB fields
        if (field.key === 'metadata') {
          return <MetadataTable value={value || {}} isEditing={false} />;
        }
        if (field.key === 'quote_items') {
          return <QuoteItemsRenderer value={value || []} isEditing={false} />;
        }
        // Other JSONB fields show as formatted JSON
        if (value) {
          return (
            <pre className="font-mono bg-dark-100 p-2 rounded overflow-auto max-h-40 text-sm text-dark-700">
              {JSON.stringify(value, null, 2)}
            </pre>
          );
        }
        return <span className="text-dark-600">No data</span>;
      }
      if (field.type === 'number') {
        // Auto-detect and format currency fields
        if (isCurrencyField(field.key)) {
          return (
            <span className="text-dark-600 font-medium text-base tracking-tight">
              {formatCurrency(value)}
            </span>
          );
        }
        // Handle explicit prefix (deprecated, use isCurrencyField instead)
        if (field.prefix) {
          return (
            <span className="text-dark-600 text-base tracking-tight">
              {`${field.prefix}${value || 0}`}
            </span>
          );
        }
        // Regular number
        return (
          <span className="text-dark-600 text-base tracking-tight">
            {value || '-'}
          </span>
        );
      }
      return (
        <span className="text-dark-600 text-base tracking-tight">
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
            className={`w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-base tracking-tight ${
              field.readonly ? 'cursor-not-allowed text-dark-600' : 'text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80'
            }`}
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
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 resize-none text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80 text-base tracking-tight leading-relaxed"
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
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80 text-base tracking-tight"
            disabled={field.disabled || field.readonly}
          />
        );
      case 'jsonb':
        // Special renderers for specific JSONB fields in edit mode
        if (field.key === 'metadata') {
          return (
            <MetadataTable
              value={value || {}}
              onChange={(newValue) => onChange(field.key, newValue)}
              isEditing={true}
            />
          );
        }
        if (field.key === 'quote_items') {
          return (
            <QuoteItemsRenderer
              value={value || []}
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
            className="w-full border-0 border-b border-transparent hover:border-dark-400 focus:border-dark-600 focus:ring-0 focus:outline-none transition-colors bg-transparent px-0 py-0 font-mono resize-none text-sm text-dark-700"
            placeholder={field.placeholder}
            disabled={field.disabled || field.readonly}
          />
        );
      case 'select': {
        // Use DAG visualizer for workflow stages/funnels in edit mode
        if (isSequentialField && dagNodes.has(field.key)) {
          // TWO DATA SOURCES for interactive DAG visualization:
          // 1. DAG structure (nodes, parent_ids, relationships) from setting_datalabel table
          const nodes = dagNodes.get(field.key)!; // {id, node_name, parent_ids}[]

          // 2. Current value (actual stage name) from entity table (e.g., project.dl__project_stage = "Execution")
          // Find the matching node ID by stage name
          const currentNode = nodes.find(n => n.node_name === value);

          return (
            <div className="space-y-3">
              {/* Display actual stage value from entity table */}
              <div className="flex items-center gap-3 p-3 bg-dark-100 border border-dark-300 rounded-md">
                <span className="text-sm font-semibold text-dark-600">Current Stage:</span>
                {renderFieldBadge(field.key, value || 'Not Set')}
              </div>
              <div className="text-xs text-dark-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                <strong>Click a node below</strong> to change the stage
              </div>
              {/* Interactive DAG visualization overlay from setting_datalabel */}
              <DAGVisualizer
                nodes={nodes}                      // DAG structure: {id, node_name, parent_ids}[]
                currentNodeId={currentNode?.id}    // Current node ID matched from stage name
                onNodeClick={(nodeId) => {
                  // Update entity table with new stage name
                  // Backend stores stage name (not ID) in entity.dl__xxx_stage
                  const selectedNode = nodes.find(n => n.id === nodeId);
                  if (selectedNode) {
                    onChange(field.key, selectedNode.node_name); // Saves stage name to entity table
                  }
                }}
              />
            </div>
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
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-dark-600 cursor-pointer hover:text-dark-700 text-base tracking-tight"
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          >
            <option value="" className="text-dark-600">Select...</option>
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
            onChange={(e) => onChange(field.key, e.target.value || null)}
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-dark-600 cursor-pointer hover:text-dark-700 text-base tracking-tight"
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );
      case 'timestamp':
        // Timestamp fields are readonly and show relative time
        return (
          <span
            className="text-dark-700"
            title={value ? formatFriendlyDate(value) : undefined}
          >
            {value ? formatRelativeTime(value) : '-'}
          </span>
        );
      default:
        return <span>{value || '-'}</span>;
    }
  };

  // Exclude fields from form based on mode
  // In edit mode: name, code are in the page header, so exclude them
  // In create mode: include name and code so users can see auto-populated values and edit them
  // Always exclude: slug, id, tags, created_ts, updated_ts
  const excludedFields = mode === 'create'
    ? ['title', 'id', 'created_ts', 'updated_ts']
    : ['name', 'title', 'code', 'id', 'created_ts', 'updated_ts'];
  const visibleFields = fields.filter(f => !excludedFields.includes(f.key));

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
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
                <label className="text-2xs font-medium text-dark-700 pt-2 flex items-center gap-1.5 uppercase tracking-wide">
                  <span className="opacity-50 group-hover:opacity-100 transition-all duration-300 group-hover:text-dark-700">
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
                      ? 'bg-gray-50 hover:bg-gray-100 hover:shadow-sm focus-within:bg-white focus-within:shadow-sm focus-within:border focus-within:border-blue-200'
                      : 'hover:bg-gray-50'
                    }
                    text-sm text-gray-700 tracking-tight leading-normal
                  `}
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
