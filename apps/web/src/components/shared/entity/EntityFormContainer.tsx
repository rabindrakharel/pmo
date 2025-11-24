import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { EntityConfig, FieldDef } from '../../../lib/entityConfig';
import type { SettingOption } from '../../../lib/settingsLoader';
import { DAGVisualizer, type DAGNode } from '../../workflow/DAGVisualizer';
import { renderEmployeeNames } from '../../../lib/entityConfig';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import { DateRangeVisualizer } from '../ui/DateRangeVisualizer';
import { DebouncedInput, DebouncedTextarea } from '../ui/DebouncedInput';
import {
  formatRelativeTime,
  formatFriendlyDate,
  formatCurrency,
  renderEditModeFromMetadata,
  type BackendFieldMetadata,
  type EntityMetadata,
  type DatalabelData,
  type DatalabelOption
} from '../../../lib/frontEndFormatterService';

import { MetadataTable } from './MetadataTable';
import { QuoteItemsRenderer } from './QuoteItemsRenderer';
import { getBadgeClass, textStyles } from '../../../lib/designSystem';

// ============================================================================
// v7.0.0: Legacy auto-generation removed - all routes must use backend metadata
// ============================================================================

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
 * Used by both EntitySpecificInstancePage (edit mode) and EntityCreatePage (create mode).
 *
 * Features:
 * - Dynamically loads dropdown options from settings tables
 * - Supports all field types from entityConfig
 * - Consistent styling matching EntitySpecificInstancePage
 * - Handles field validation
 */

// ============================================================================
// DEBUG: Render counter for tracking re-renders
// ============================================================================
let entityFormContainerRenderCount = 0;

interface EntityFormContainerProps {
  config?: EntityConfig;              // Now optional - can be auto-generated
  data: Record<string, any>;
  isEditing: boolean;
  onChange: (fieldKey: string, value: any) => void;
  mode?: 'create' | 'edit';

  // ============================================================================
  // PRIORITY 1: Backend Metadata (v4.0 Architecture)
  // ============================================================================
  /**
   * Backend-generated metadata (RECOMMENDED)
   * When provided, uses backend metadata for all rendering decisions
   * Zero frontend pattern detection
   *
   * @example
   * <EntityFormContainer data={project} metadata={metadata} isEditing onChange={handleChange} />
   */
  metadata?: EntityMetadata;

  /**
   * Preloaded datalabel data for DAG visualization
   * Eliminates N+1 API calls by providing datalabel options upfront
   *
   * @example
   * <EntityFormContainer data={project} datalabels={datalabels} isEditing onChange={handleChange} />
   */
  datalabels?: DatalabelData[];

}

// Stable default values to prevent new array references on every render
const EMPTY_DATALABELS: DatalabelData[] = [];

// ✅ FIX: Wrap with React.memo to prevent re-renders when props haven't changed
function EntityFormContainerInner({
  config,
  data,
  isEditing,
  onChange,
  mode = 'edit',
  metadata,                     // PRIORITY 1: Backend metadata
  datalabels = EMPTY_DATALABELS  // ✅ Stable default reference
}: EntityFormContainerProps) {
  // DEBUG: Track renders
  entityFormContainerRenderCount++;
  const renderIdRef = React.useRef(entityFormContainerRenderCount);
  console.log(
    `%c[RENDER #${renderIdRef.current}] 🖼️ EntityFormContainer`,
    'color: #ffd43b; font-weight: bold',
    {
      isEditing,
      mode,
      hasMetadata: !!metadata,
      hasEntityFormContainerMetadata: !!metadata?.entityFormContainer,
      dataKeys: Object.keys(data || {}),
      datalabelsCount: datalabels?.length || 0,
      timestamp: new Date().toLocaleTimeString()
    }
  );

  // ============================================================================
  // METADATA-DRIVEN FIELD GENERATION
  // ============================================================================
  // v7.0.0: Backend metadata is source of truth. No auto-generation.

  const fields = useMemo(() => {
    // PRIORITY 1: Backend metadata (v4.0 architecture - component-aware format)
    // Backend returns: metadata.entityFormContainer = { field_name: { visible, editable, ... }, ... }
    const componentMetadata = metadata?.entityFormContainer;
    if (componentMetadata && typeof componentMetadata === 'object') {
      // Convert object format to array of FieldDef
      const result = Object.entries(componentMetadata)
        .filter(([_, fieldMeta]: [string, any]) => fieldMeta.visible !== false)
        .map(([fieldKey, fieldMeta]: [string, any]) => ({
          key: fieldKey,
          label: fieldMeta.label || generateFieldLabel(fieldKey),
          type: fieldMeta.editType || fieldMeta.inputType || 'text',
          editable: fieldMeta.editable !== false,
          visible: true,
          loadDataLabels: fieldMeta.datalabelKey ? true : false,
          loadFromEntity: fieldMeta.loadFromEntity,
          EntityFormContainer_viz_container: fieldMeta.EntityFormContainer_viz_container,
          toApi: (value: any) => value,
          toDisplay: (value: any) => value
        } as FieldDef));
      console.log(
        `%c[FIELDS] 📋 EntityFormContainer fields computed from BACKEND METADATA`,
        'color: #51cf66; font-weight: bold',
        { fieldCount: result.length, fieldKeys: result.map(f => f.key) }
      );
      return result;
    }

    // PRIORITY 2: Config fields (backward compatibility)
    if (config?.fields && config.fields.length > 0) {
      console.log(
        `%c[FIELDS] 📋 EntityFormContainer fields from CONFIG`,
        'color: #fcc419; font-weight: bold',
        { fieldCount: config.fields.length }
      );
      return config.fields;
    }

    // v7.0.0: No auto-generation - all routes must provide metadata from backend
    return [];
  }, [metadata, config]);

  // Simple onChange handler - debouncing is handled by DebouncedInput/DebouncedTextarea
  // This is the industry-standard pattern: input components manage their own debouncing
  const handleFieldChange = React.useCallback((fieldKey: string, value: any) => {
    console.log(
      `%c[FIELD CHANGE] ✍️ EntityFormContainer.handleFieldChange`,
      'color: #74c0fc',
      { fieldKey, valueType: typeof value, valuePreview: typeof value === 'string' ? value.substring(0, 50) : value }
    );
    onChange(fieldKey, value);
  }, [onChange]);

  // Helper to determine if a field should use DAG visualization
  // All dl__% fields that are stage or funnel fields use DAG visualization
  const isStageField = useCallback((fieldKey: string): boolean => {
    const lowerKey = fieldKey.toLowerCase();
    // Check if field starts with dl__ (datalabel prefix) and contains stage or funnel
    return lowerKey.startsWith('dl__') && (lowerKey.includes('stage') || lowerKey.includes('funnel'));
  }, []);

  /**
   * Transform preloaded datalabel options to DAG nodes
   * Converts DatalabelOption[] → DAGNode[] format
   */
  const transformDatalabelToDAGNodes = (options: DatalabelOption[]): DAGNode[] => {
    return options.map(opt => ({
      id: opt.id,
      node_name: opt.name,
      parent_ids: opt.parent_id !== null ? [opt.parent_id] : []
    }));
  };

  // ============================================================================
  // DERIVED STATE: Compute settingOptions and dagNodes with useMemo
  // ============================================================================
  // No useState + useEffect for derived data to prevent render loops
  // Recomputed only when fields or datalabels actually change
  // ============================================================================

  const { settingOptions, dagNodes } = useMemo(() => {
    const settingsMap = new Map<string, SettingOption[]>();
    const dagNodesMap = new Map<string, DAGNode[]>();

    if (!fields || fields.length === 0 || !datalabels) {
      return { settingOptions: settingsMap, dagNodes: dagNodesMap };
    }

    // Process all fields that need settings from preloaded datalabels
    const fieldsNeedingSettings = fields.filter(
      field => field.loadDataLabels && (field.type === 'select' || field.type === 'multiselect')
    );

    // Use preloaded datalabels from backend (NO API CALLS)
    fieldsNeedingSettings.forEach((field) => {
      // Find matching datalabel from preloaded data
      const datalabel = datalabels.find(dl => dl.name === field.key);

      if (datalabel && datalabel.options.length > 0) {
        // Transform datalabel options to SettingOption format for select/multiselect
        const options: SettingOption[] = datalabel.options.map(opt => ({
          value: opt.name,  // Use name as value for datalabels
          label: opt.name,
          colorClass: opt.color_code,
          metadata: {
            id: opt.id,
            descr: opt.descr,
            sort_order: opt.sort_order,
            active_flag: opt.active_flag
          }
        }));
        settingsMap.set(field.key, options);

        // Load DAG nodes for stage/funnel fields
        if (isStageField(field.key)) {
          const nodes = transformDatalabelToDAGNodes(datalabel.options);
          dagNodesMap.set(field.key, nodes);
        }
      }
      // NO FALLBACK - If field not found in datalabels, no options available
    });

    return { settingOptions: settingsMap, dagNodes: dagNodesMap };
  }, [fields, datalabels, isStageField]);  // ✅ Stable dependencies with memoized data

  // Render field based on configuration
  const renderField = (field: FieldDef) => {
    const value = data[field.key];

    // Check if this is a sequential state field
    const hasSettingOptions = field.loadDataLabels && settingOptions.has(field.key);
    const options = hasSettingOptions
      ? settingOptions.get(field.key)!
      : field.options || [];
    const isSequentialField = field.type === 'select'
      && hasSettingOptions
      && isStageField(field.key)
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
        // Backend-specified DAG component (explicit from backend)
        if (field.EntityFormContainer_viz_container === 'DAGVisualizer' && dagNodes.has(field.key)) {
          // TWO DATA SOURCES for DAG visualization:
          // 1. DAG structure (nodes, parent_ids, relationships) from datalabel table
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
              {/* DAG visualization overlay from datalabel */}
              <DAGVisualizer
                nodes={nodes}                      // DAG structure: {id, node_name, parent_ids}[]
                currentNodeId={currentNode?.id}    // Current node ID matched from stage name
              />
            </div>
          );
        }

        const option = options.find((opt: any) => String(opt.value) === String(value));
        const rawValue = option?.label || value;

        // Format value based on field type (v7.0.0: use field.type directly from metadata)
        let displayValue: string;
        const inputType = field.type;

        // Format using inline logic
        if (rawValue == null) {
          displayValue = '-';
        } else if (inputType === 'currency') {
          displayValue = formatCurrency(rawValue);
        } else if (inputType === 'date') {
          displayValue = formatFriendlyDate(rawValue);
        } else if (inputType === 'timestamp' || inputType === 'datetime') {
          displayValue = formatRelativeTime(rawValue);
        } else if (inputType === 'checkbox') {
          displayValue = rawValue ? 'Yes' : 'No';
        } else if (typeof rawValue === 'object') {
          if (Array.isArray(rawValue)) {
            displayValue = rawValue.join(', ');
          } else {
            displayValue = JSON.stringify(rawValue);
          }
        } else {
          displayValue = String(rawValue);
        }

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
        if (field.key.includes('_amt') || field.key.includes('_price') || field.key.includes('_cost')) {
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
      // Handle objects that aren't explicitly typed as 'json'
      if (typeof value === 'object' && value !== null) {
        // Check if it's an empty object
        if (Object.keys(value).length === 0) {
          return <span className="text-dark-600 text-base tracking-tight">-</span>;
        }
        // For non-empty objects, stringify them
        return (
          <pre className="font-mono bg-dark-100 p-2 rounded overflow-auto max-h-40 text-sm text-dark-700">
            {JSON.stringify(value, null, 2)}
          </pre>
        );
      }
      return (
        <span className="text-dark-600 text-base tracking-tight">
          {value || '-'}
        </span>
      );
    }

    // Edit mode
    // Using DebouncedInput/DebouncedTextarea for text inputs (industry-standard pattern)
    // Each input manages its own local state for instant feedback, then debounces parent updates
    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
        return (
          <DebouncedInput
            type={field.type}
            value={data[field.key] ?? ''}
            onChange={(value) => handleFieldChange(field.key, value)}
            debounceMs={300}
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
          <DebouncedTextarea
            value={data[field.key] ?? ''}
            onChange={(value) => handleFieldChange(field.key, value)}
            rows={field.type === 'richtext' ? 6 : 4}
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 resize-none text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80 text-base tracking-tight leading-relaxed"
            placeholder={field.placeholder}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );
      case 'array': {
        const arrayValue = data[field.key];
        return (
          <DebouncedInput
            type="text"
            value={Array.isArray(arrayValue) ? arrayValue.join(', ') : (arrayValue || '')}
            onChange={(value) => handleFieldChange(field.key, value.split(',').map(v => v.trim()).filter(Boolean))}
            debounceMs={300}
            placeholder={field.placeholder || "Enter comma-separated values"}
            className="w-full border-0 focus:ring-0 focus:outline-none transition-all duration-300 bg-transparent px-0 py-0.5 text-dark-600 placeholder:text-dark-600/60 hover:placeholder:text-dark-700/80 text-base tracking-tight"
            disabled={field.disabled || field.readonly}
          />
        );
      }
      case 'jsonb':
        // Backend-specified component (explicit from backend)
        if (field.EntityFormContainer_viz_container === 'MetadataTable') {
          return (
            <MetadataTable
              value={value || {}}
              onChange={(newValue) => handleFieldChange(field.key, newValue)}
              isEditing={true}
            />
          );
        }
        if (field.key === 'quote_items') {
          return (
            <QuoteItemsRenderer
              value={value || []}
              onChange={(newValue) => handleFieldChange(field.key, newValue)}
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
                handleFieldChange(field.key, JSON.parse(e.target.value));
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
        // Backend-specified DAG component (explicit from backend)
        if (field.EntityFormContainer_viz_container === 'DAGVisualizer' && dagNodes.has(field.key)) {
          // TWO DATA SOURCES for interactive DAG visualization:
          // 1. DAG structure (nodes, parent_ids, relationships) from datalabel table
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
              <div className="text-xs text-dark-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                <strong>Click a node below</strong> to change the stage
              </div>
              {/* Interactive DAG visualization overlay from datalabel */}
              <DAGVisualizer
                nodes={nodes}                      // DAG structure: {id, node_name, parent_ids}[]
                currentNodeId={currentNode?.id}    // Current node ID matched from stage name
                onNodeClick={(nodeId) => {
                  // Update entity table with new stage name
                  // Backend stores stage name (not ID) in entity.dl__xxx_stage
                  const selectedNode = nodes.find(n => n.id === nodeId);
                  if (selectedNode) {
                    handleFieldChange(field.key, selectedNode.node_name); // Saves stage name to entity table
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
              handleFieldChange(field.key, newValue === '' ? undefined : newValue);
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
            onChange={(newValues) => handleFieldChange(field.key, newValues)}
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
            onChange={(e) => handleFieldChange(field.key, e.target.value === '' ? null : e.target.value)}
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
        // Format value for display (v7.0.0: use field.type directly from metadata)
        let defaultDisplay: string;
        const defaultInputType = field.type;

        // Format using inline logic
        if (value == null) {
          defaultDisplay = '-';
        } else if (defaultInputType === 'currency') {
          defaultDisplay = formatCurrency(value);
        } else if (defaultInputType === 'date') {
          defaultDisplay = formatFriendlyDate(value);
        } else if (defaultInputType === 'timestamp' || defaultInputType === 'datetime') {
          defaultDisplay = formatRelativeTime(value);
        } else if (defaultInputType === 'checkbox') {
          defaultDisplay = value ? 'Yes' : 'No';
        } else if (typeof value === 'object') {
          if (Array.isArray(value)) {
            defaultDisplay = value.join(', ');
          } else {
            defaultDisplay = JSON.stringify(value);
          }
        } else {
          defaultDisplay = String(value);
        }
        return <span className="text-dark-600 text-base tracking-tight">{defaultDisplay}</span>;
    }
  };

  // Exclude fields from form based on mode
  // In edit mode: name, code are in the page header, so exclude them
  // In create mode: include name and code so users can see auto-populated values and edit them
  // Always exclude: slug, id, tags, created_ts, updated_ts
  // Also exclude: UUID reference fields (*_id, *_ids) - resolved labels shown instead
  const excludedFields = mode === 'create'
    ? ['title', 'id', 'created_ts', 'updated_ts']
    : ['name', 'title', 'code', 'id', 'created_ts', 'updated_ts'];
  const visibleFields = fields.filter(f =>
    !excludedFields.includes(f.key) &&
    !f.key.endsWith('_id') &&   // Hide UUID reference fields (e.g., manager__employee_id)
    !f.key.endsWith('_ids')     // Hide UUID array fields (e.g., stakeholder__employee_ids)
  );

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

// ✅ FIX: Custom comparison for React.memo
// Prevents re-renders when only `data` values change (not keys) during editing
// The component uses local state for text inputs, so data changes shouldn't trigger re-renders
function arePropsEqual(
  prevProps: EntityFormContainerProps,
  nextProps: EntityFormContainerProps
): boolean {
  // If editing state changes, must re-render
  if (prevProps.isEditing !== nextProps.isEditing) return false;
  if (prevProps.mode !== nextProps.mode) return false;

  // If metadata changes (structure), must re-render
  if (prevProps.metadata !== nextProps.metadata) return false;

  // If config changes, must re-render
  if (prevProps.config !== nextProps.config) return false;

  // If datalabels change, must re-render
  if (prevProps.datalabels !== nextProps.datalabels) return false;

  // For data: only re-render if KEYS change, not values
  // (values are handled by local state during editing)
  const prevKeys = Object.keys(prevProps.data || {}).sort().join(',');
  const nextKeys = Object.keys(nextProps.data || {}).sort().join(',');
  if (prevKeys !== nextKeys) return false;

  // If NOT editing, also check if values changed (need to show updated data)
  if (!nextProps.isEditing) {
    if (prevProps.data !== nextProps.data) return false;
  }

  // onChange function reference changes are OK (we capture it in useCallback)
  // Other props are primitives or stable references

  return true;
}

// Export memoized component with custom comparison
// This prevents re-renders during typing while maintaining proper updates
export const EntityFormContainer = React.memo(EntityFormContainerInner, arePropsEqual);
