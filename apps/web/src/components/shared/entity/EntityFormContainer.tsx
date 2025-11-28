import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { EntityConfig, FieldDef } from '../../../lib/entityConfig';
import type { LabelMetadata } from '../../../lib/formatters/labelMetadataLoader';
import { DAGVisualizer, type DAGNode } from '../../workflow/DAGVisualizer';
import { renderEmployeeNames } from '../../../lib/entityConfig';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import { DateRangeVisualizer } from '../ui/DateRangeVisualizer';
import { DebouncedInput, DebouncedTextarea } from '../ui/DebouncedInput';
import { BadgeDropdownSelect } from '../ui/BadgeDropdownSelect';
import { EntitySelect } from '../ui/EntitySelect';
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
import { colorCodeToTailwindClass } from '../../../lib/formatters/valueFormatters';
import type { FormattedRow } from '../../../lib/formatters';
import { extractViewType, extractEditType, isValidComponentMetadata } from '../../../lib/formatters';
// v8.6.0: Use RxDB sync cache for datalabel options
import { getDatalabelSync } from '../../../db/rxdb/hooks/useRxMetadata';
// v8.3.0: RefData for entity reference resolution
import { useRefData, type RefData } from '../../../lib/hooks/useRefData';

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

  /**
   * v7.0.0: Pre-formatted data from useEntityInstance hook
   * When provided, uses formattedData.display[key] for view mode rendering
   * Eliminates redundant formatting during render
   */
  formattedData?: FormattedRow<Record<string, any>>;

  /**
   * v8.3.0: Reference data lookup table for entity reference resolution
   * Used to resolve UUIDs to display names for *_id and *_ids fields
   * Structure: { entity_code: { uuid: name } }
   *
   * @example
   * <EntityFormContainer
   *   data={project}
   *   ref_data_entityInstance={{ employee: { "uuid-123": "James Miller" } }}
   *   isEditing={false}
   *   onChange={handleChange}
   * />
   */
  ref_data_entityInstance?: RefData;
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
  datalabels = EMPTY_DATALABELS,  // ✅ Stable default reference
  formattedData,                // v7.0.0: Pre-formatted data for instant rendering
  ref_data_entityInstance                      // v8.3.0: Entity reference lookup table
}: EntityFormContainerProps) {
  // v8.3.0: useRefData hook for entity reference resolution
  const { resolveFieldDisplay, isRefField, getEntityCode } = useRefData(ref_data_entityInstance);
  // ============================================================================
  // METADATA-DRIVEN FIELD GENERATION
  // ============================================================================
  // v8.2.0: Backend metadata is REQUIRED. Only { viewType, editType } structure supported.

  const fields = useMemo(() => {
    // v8.2.0: Backend MUST return: metadata.entityFormContainer = { viewType: {...}, editType: {...} }
    const componentMetadata = metadata?.entityFormContainer;

    // Explicit config fields override (for special cases)
    if (config?.fields && config.fields.length > 0) {
      return config.fields;
    }

    // Extract viewType and editType from component metadata
    const viewType = extractViewType(componentMetadata);
    const editType = extractEditType(componentMetadata);

    if (!viewType) {
      console.error('[EntityFormContainer] No viewType in metadata - backend must send { viewType, editType }');
      return [];
    }

    // Convert object format to array of FieldDef
    const result = Object.entries(viewType)
      .filter(([_, fieldMeta]) => {
        return fieldMeta.behavior?.visible !== false;
      })
      .map(([fieldKey, viewMeta]) => {
        const editMeta = editType?.[fieldKey];

        // v8.2.0: Backend always provides labels via generateLabel()
        const label = viewMeta.label;
        const inputType = editMeta?.inputType ?? 'text';
        const editable = editMeta?.behavior?.editable ?? false;
        const lookupSource = editMeta?.lookupSource;
        const lookupEntity = editMeta?.lookupEntity;
        const datalabelKey = editMeta?.datalabelKey;

        // v8.3.2: Backend metadata is single source of truth for viz containers
        // viewMeta.component for view mode, editMeta.component for edit mode
        const viewVizContainer = (viewMeta.renderType === 'component' && viewMeta.component)
          ? viewMeta.component
          : undefined;
        const editVizContainer = (editMeta?.inputType === 'component' && editMeta?.component)
          ? editMeta.component
          : undefined;

        return {
          key: fieldKey,
          label,
          type: inputType,
          editable,
          visible: true,
          lookupSource,
          lookupEntity,
          datalabelKey,
          EntityFormContainer_viz_container: {
            view: viewVizContainer,
            edit: editVizContainer
          },
          toApi: (value: any) => value,
          toDisplay: (value: any) => value
        } as FieldDef;
      });

    return result;
  }, [metadata, config]);

  // Simple onChange handler - debouncing is handled by DebouncedInput/DebouncedTextarea
  // This is the industry-standard pattern: input components manage their own debouncing
  const handleFieldChange = React.useCallback((fieldKey: string, value: any) => {
    onChange(fieldKey, value);
  }, [onChange]);

  // Helper to determine if a field should use DAG visualization
  // All dl__% fields that are stage or funnel fields use DAG visualization
  /**
   * Transform preloaded datalabel options to DAG nodes
   * Converts DatalabelOption[] → DAGNode[] format
   */
  const transformDatalabelToDAGNodes = (options: DatalabelOption[]): DAGNode[] => {
    return options.map(opt => ({
      id: opt.id,
      node_name: opt.name,
      // v8.2.0: REQUIRE parent_ids array format (no backward compat for parent_id)
      parent_ids: opt.parent_ids || []
    }));
  };

  // ============================================================================
  // DERIVED STATE: Compute labelsMetadata and dagNodes with useMemo
  // ============================================================================
  // No useState + useEffect for derived data to prevent render loops
  // Recomputed only when fields or datalabels actually change
  // ============================================================================

  const { labelsMetadata, dagNodes } = useMemo(() => {
    const metadataMap = new Map<string, LabelMetadata[]>();
    const dagNodesMap = new Map<string, DAGNode[]>();

    if (!fields || fields.length === 0) {
      return { labelsMetadata: metadataMap, dagNodes: dagNodesMap };
    }

    // Process all fields that need datalabel options from datalabelMetadataStore
    // v8.3.2: Backend metadata drives this via lookupSource or datalabelKey
    const fieldsNeedingSettings = fields.filter(
      field => field.lookupSource === 'datalabel' || field.datalabelKey
    );

    // v8.6.0: Use datalabels from RxDB sync cache (populated at login, NO API CALLS)
    fieldsNeedingSettings.forEach((field) => {
      // Fetch from RxDB sync cache
      // v8.3.2: Use datalabelKey from backend metadata as primary key, fallback to field.key
      const lookupKey = field.datalabelKey || field.key;
      const cachedOptions = getDatalabelSync(lookupKey);

      if (cachedOptions && cachedOptions.length > 0) {
        // Transform datalabel options to LabelMetadata format for select/multiselect
        const options: LabelMetadata[] = cachedOptions
          .filter(opt => opt.active_flag !== false)
          .map(opt => ({
            value: opt.name,  // Use name as value for datalabels
            label: opt.name,
            colorClass: colorCodeToTailwindClass(opt.color_code),  // ✅ Convert color_code to Tailwind classes
            metadata: {
              id: opt.id,
              descr: opt.descr,
              sort_order: opt.sort_order,
              active_flag: opt.active_flag
            }
          }));
        metadataMap.set(field.key, options);

        // Load DAG nodes for fields with DAG visualization (backend-driven)
        // v8.3.2: Check if either view or edit mode uses DAGVisualizer
        const vizContainer = field.EntityFormContainer_viz_container;
        if (vizContainer?.view === 'DAGVisualizer' || vizContainer?.edit === 'DAGVisualizer') {
          const nodes = transformDatalabelToDAGNodes(cachedOptions);
          dagNodesMap.set(field.key, nodes);
        }
      }
      // NO FALLBACK - If field not found in cache, no options available
    });

    return { labelsMetadata: metadataMap, dagNodes: dagNodesMap };
  }, [fields]);  // ✅ Stable dependencies - DAG detection now metadata-driven

  // Render field based on configuration
  const renderField = (field: FieldDef) => {
    const value = data[field.key];

    // Check if this field has datalabel options loaded
    const hasLabelsMetadata = labelsMetadata.has(field.key);
    const options = hasLabelsMetadata
      ? labelsMetadata.get(field.key)!
      : field.options || [];
    // v8.3.2: Check view or edit mode based on isEditing
    const vizContainer = field.EntityFormContainer_viz_container;
    const isSequentialField = field.type === 'select'
      && hasLabelsMetadata
      && (vizContainer?.view === 'DAGVisualizer' || vizContainer?.edit === 'DAGVisualizer')
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
      // v8.3.2: Backend-specified DAG component for VIEW mode (check BEFORE field.type)
      // When viewMeta.renderType === 'component' && viewMeta.component === 'DAGVisualizer',
      // field.type may be 'component' (from editMeta.inputType), not 'select'
      if (vizContainer?.view === 'DAGVisualizer' && dagNodes.has(field.key)) {
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
      if (field.type === 'select') {
        // ═══════════════════════════════════════════════════════════════
        // v8.2.0: REQUIRE pre-formatted value from formattedData
        // No fallback formatting - backend metadata is sole source of truth
        // ═══════════════════════════════════════════════════════════════
        const displayValue = formattedData?.display?.[field.key] ?? String(value ?? '-');
        const styleClass = formattedData?.styles?.[field.key];

        // Render badge if backend provided style class
        if (styleClass) {
          return (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styleClass}`}>
              {displayValue}
            </span>
          );
        }

        return (
          <span className="text-dark-600 text-base tracking-tight">
            {displayValue || '-'}
          </span>
        );
      }
      if (field.type === 'textarea' || field.type === 'richtext') {
        // Handle object values (e.g., metadata field typed as textarea but containing JSON)
        if (typeof value === 'object' && value !== null) {
          return (
            <pre className="font-mono bg-dark-100 p-2 rounded overflow-auto max-h-40 text-sm text-dark-700 whitespace-pre-wrap">
              {JSON.stringify(value, null, 2)}
            </pre>
          );
        }
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
      // v8.3.2: Backend-specified component for JSONB VIEW mode (check BEFORE field.type)
      // When viewMeta.renderType === 'component' && viewMeta.component === 'MetadataTable',
      // field.type may be 'component' (from editMeta.inputType), not 'jsonb'
      if (vizContainer?.view === 'MetadataTable') {
        return <MetadataTable value={value || {}} isEditing={false} />;
      }
      if (vizContainer?.view === 'QuoteItemsRenderer') {
        return <QuoteItemsRenderer value={value || []} isEditing={false} />;
      }
      if (field.type === 'jsonb') {
        // Fallback for JSONB fields without specific component
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
        // v8.2.0: Use pre-formatted value from formattedData
        // Backend metadata determines if this is currency via renderType
        const displayValue = formattedData?.display?.[field.key] ?? String(value ?? '-');
        return (
          <span className="text-dark-600 text-base tracking-tight">
            {displayValue}
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

      // v8.3.2: Entity reference fields - resolve UUID to name using ref_data
      if (field.type === 'entityInstanceId') {
        // Use pre-formatted value from formatDataset which uses ref_data_entityInstance
        const displayValue = formattedData?.display?.[field.key] ?? value;
        return (
          <span className="text-dark-600 text-base tracking-tight">
            {displayValue || '-'}
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
      // v8.3.2: Generic 'component' type for backend-specified components
      // When editMeta.inputType === 'component', check vizContainer.edit for component name
      case 'component':
        if (vizContainer?.edit === 'MetadataTable') {
          return (
            <MetadataTable
              value={value || {}}
              onChange={(newValue) => handleFieldChange(field.key, newValue)}
              isEditing={true}
            />
          );
        }
        if (vizContainer?.edit === 'QuoteItemsRenderer') {
          return (
            <QuoteItemsRenderer
              value={value || []}
              onChange={(newValue) => handleFieldChange(field.key, newValue)}
              isEditing={true}
            />
          );
        }
        // Fallback for unknown component type - render as JSON textarea
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
      case 'jsonb':
        // v8.3.2: Backend-specified component for EDIT mode
        if (vizContainer?.edit === 'MetadataTable') {
          return (
            <MetadataTable
              value={value || {}}
              onChange={(newValue) => handleFieldChange(field.key, newValue)}
              isEditing={true}
            />
          );
        }
        if (vizContainer?.edit === 'QuoteItemsRenderer') {
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
      // v8.3.2: BadgeDropdownSelect - datalabel dropdown with colored badges
      case 'BadgeDropdownSelect': {
        if (hasLabelsMetadata && options.length > 0) {
          const coloredOptions = options.map((opt: any) => ({
            value: opt.value,
            label: opt.label,
            metadata: {
              color_code: opt.colorClass || 'bg-gray-100 text-gray-600'
            }
          }));

          return (
            <div className="w-full">
              <BadgeDropdownSelect
                value={value !== undefined && value !== null ? String(value) : ''}
                options={coloredOptions}
                onChange={(newValue) => {
                  handleFieldChange(field.key, newValue === '' ? undefined : newValue);
                }}
                placeholder="Select..."
                disabled={field.disabled || field.readonly}
              />
            </div>
          );
        }
        // Fallback to plain text if no options
        return (
          <span className="text-dark-600 text-base tracking-tight">
            {value || '-'}
          </span>
        );
      }
      case 'select': {
        // v8.3.2: Backend-specified DAG component for EDIT mode
        if (vizContainer?.edit === 'DAGVisualizer' && dagNodes.has(field.key)) {
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
        // Check if this is a datalabel field - if so, use BadgeDropdownSelect
        if (hasLabelsMetadata && options.length > 0) {
          const coloredOptions = options.map((opt: any) => ({
            value: opt.value,
            label: opt.label,
            metadata: {
              color_code: opt.colorClass || 'bg-gray-100 text-gray-600'
            }
          }));

          return (
            <div className="w-full">
              <BadgeDropdownSelect
                value={value !== undefined && value !== null ? String(value) : ''}
                options={coloredOptions}
                onChange={(newValue) => {
                  if (field.coerceBoolean) {
                    handleFieldChange(field.key, newValue === 'true');
                  } else {
                    handleFieldChange(field.key, newValue === '' ? undefined : newValue);
                  }
                }}
                placeholder="Select..."
                disabled={field.disabled || field.readonly}
              />
            </div>
          );
        }

        // Fallback: plain select for non-datalabel fields
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
      // v8.3.2: Entity instance dropdown (foreign key reference fields)
      case 'entityInstanceId': {
        // Entity reference fields use EntitySelect with unified ref_data cache
        const entityCode = field.lookupEntity;

        if (!entityCode) {
          console.warn(`[EDIT] Missing lookupEntity for field ${field.key}`);
          // Fallback to showing current value with resolved name
          const resolvedName = resolveFieldDisplay(
            { lookupEntity: undefined } as any,
            value
          );
          return (
            <span className="text-dark-600 text-base tracking-tight">
              {resolvedName || value || '-'}
            </span>
          );
        }

        return (
          <EntitySelect
            entityCode={entityCode}
            value={value ?? ''}
            onChange={(uuid, _label) => handleFieldChange(field.key, uuid)}
            disabled={field.disabled || field.readonly}
            required={field.required}
            placeholder={field.placeholder || `Select ${entityCode}...`}
          />
        );
      }
      default:
        // ═══════════════════════════════════════════════════════════════
        // v8.2.0: REQUIRE pre-formatted value from formattedData
        // No fallback formatting - backend metadata is sole source of truth
        // ═══════════════════════════════════════════════════════════════
        const defaultDisplay = formattedData?.display?.[field.key] ?? String(value ?? '-');
        return <span className="text-dark-600 text-base tracking-tight">{defaultDisplay}</span>;
    }
  };

  // Exclude fields from form based on mode
  // In edit mode: name, code are in the page header, so exclude them
  // In create mode: include name and code so users can see auto-populated values and edit them
  // Always exclude: slug, id, tags, created_ts, updated_ts
  // v8.3.0: Field visibility determined by backend metadata (visible property), NOT frontend pattern detection
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

  // v8.3.0: If ref_data_entityInstance changes, must re-render (entity reference resolution)
  if (prevProps.ref_data_entityInstance !== nextProps.ref_data_entityInstance) return false;

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
