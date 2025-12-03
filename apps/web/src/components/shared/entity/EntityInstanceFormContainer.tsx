// ============================================================================
// EntityInstanceFormContainer - v12.3.0 (Slow Click-and-Hold Inline Editing)
// ============================================================================
// A reusable form container component that renders form fields using the
// modular FieldRenderer system. Uses metadata-driven rendering with no
// hardcoded switch statements.
//
// v12.3.0: Added slow click-and-hold inline editing (Airtable-style):
// - Hold mouse down for 500ms to enter edit mode for that field
// - Click outside OR Enter key → optimistic update (TanStack + Dexie)
// - Escape → cancel without saving
// - Edit pencil icon fallback still works for full edit mode
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { EntityConfig, FieldDef } from '../../../lib/entityConfig';
import type { LabelMetadata } from '../../../lib/formatters/labelMetadataLoader';
// v12.2.0: Use modular FieldRenderer instead of hardcoded switch statements
import { FieldRenderer } from '../../../lib/fieldRenderer';
import { DateRangeVisualizer } from '../ui/DateRangeVisualizer';
import {
  type EntityMetadata,
  type DatalabelData
} from '../../../lib/frontEndFormatterService';
import { colorCodeToTailwindClass } from '../../../lib/formatters/valueFormatters';
import type { FormattedRow } from '../../../lib/formatters';
import { extractViewType, extractEditType } from '../../../lib/formatters';
// v11.0.0: Use TanStack Query cache for datalabel resolution
import { getDatalabelSync } from '../../../db/tanstack-index';

// ============================================================================
// Types
// ============================================================================

interface EntityInstanceFormContainerProps {
  config?: EntityConfig;
  data: Record<string, any>;
  isEditing: boolean;
  onChange: (fieldKey: string, value: any) => void;
  mode?: 'create' | 'edit';
  metadata?: EntityMetadata;
  datalabels?: DatalabelData[];
  formattedData?: FormattedRow<Record<string, any>>;
  // v12.3.0: Inline editing support
  /** Enable slow click-and-hold inline editing (like EntityListOfInstancesTable) */
  inlineEditable?: boolean;
  /** Called when a single field is saved via inline edit (optimistic update trigger) */
  onInlineSave?: (fieldKey: string, value: any) => void;
  /** Entity ID (required for inline editing) */
  entityId?: string;
}

// Stable default values
const EMPTY_DATALABELS: DatalabelData[] = [];

// ============================================================================
// Date Range Constants
// ============================================================================

const DATE_RANGE_PATTERNS: Record<string, { start: string; end: string }> = {
  start_date: { start: 'start_date', end: 'end_date' },
  end_date: { start: 'start_date', end: 'end_date' },
  planned_start_date: { start: 'planned_start_date', end: 'planned_end_date' },
  planned_end_date: { start: 'planned_start_date', end: 'planned_end_date' },
  actual_start_date: { start: 'actual_start_date', end: 'actual_end_date' },
  actual_end_date: { start: 'actual_start_date', end: 'actual_end_date' },
};

const isStartDateField = (key: string) =>
  ['start_date', 'planned_start_date', 'actual_start_date'].includes(key);

const isEndDateField = (key: string) =>
  ['end_date', 'planned_end_date', 'actual_end_date'].includes(key);

const getDateRangeLabel = (key: string): string | null => {
  const labels: Record<string, string> = {
    end_date: 'Date Range',
    planned_end_date: 'Planned Date Range',
    actual_end_date: 'Actual Date Range',
  };
  return labels[key] ?? null;
};

// ============================================================================
// Component
// ============================================================================

function EntityInstanceFormContainerInner({
  config,
  data,
  isEditing,
  onChange,
  mode = 'edit',
  metadata,
  datalabels: _datalabels = EMPTY_DATALABELS,
  formattedData,
  // v12.3.0: Inline editing props
  inlineEditable = false,
  onInlineSave,
  entityId: _entityId // Used in arePropsEqual for memoization
}: EntityInstanceFormContainerProps) {
  // Local state for immediate UI feedback
  const [localData, setLocalData] = useState<Record<string, any>>(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  // ============================================================================
  // v12.3.0: SLOW CLICK-AND-HOLD INLINE EDITING STATE
  // ============================================================================
  // Matches EntityListOfInstancesTable behavior exactly:
  // - Hold mouse down 500ms → enter edit mode for THAT field only
  // - Click outside / Enter → save (optimistic update)
  // - Escape → cancel
  // ============================================================================

  // Currently editing field (null = not editing any field inline)
  const [inlineEditingField, setInlineEditingField] = useState<string | null>(null);
  // Local value being edited inline
  const [inlineEditValue, setInlineEditValue] = useState<any>(null);
  // Ref for the editing field container (click-outside detection)
  const editingFieldRef = useRef<HTMLDivElement | null>(null);
  // Long-press timer ref
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Long-press delay (same as EntityListOfInstancesTable)
  const LONG_PRESS_DELAY = 500;

  // Cancel any pending long-press timer
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Enter inline edit mode for a specific field
  const enterInlineEditMode = useCallback((fieldKey: string) => {
    const currentValue = localData[fieldKey];
    setInlineEditingField(fieldKey);
    setInlineEditValue(currentValue);
  }, [localData]);

  // Handle mouse down on a field - start long-press timer
  const handleFieldMouseDown = useCallback((
    e: React.MouseEvent,
    fieldKey: string,
    isFieldEditable: boolean
  ) => {
    // Skip if full edit mode is active, field not editable, or already inline editing this field
    if (isEditing || !inlineEditable || !isFieldEditable) return;
    if (inlineEditingField === fieldKey) return;

    // Cancel any existing timer
    cancelLongPress();

    // Start long-press timer
    longPressTimerRef.current = setTimeout(() => {
      enterInlineEditMode(fieldKey);
      longPressTimerRef.current = null;
    }, LONG_PRESS_DELAY);
  }, [isEditing, inlineEditable, inlineEditingField, cancelLongPress, enterInlineEditMode, LONG_PRESS_DELAY]);

  // Handle mouse up - cancel long-press timer
  const handleFieldMouseUp = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  // Handle mouse leave - cancel long-press timer
  const handleFieldMouseLeave = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  // Handle inline field value change
  const handleInlineValueChange = useCallback((value: any) => {
    setInlineEditValue(value);
  }, []);

  // Save inline edit (optimistic update)
  const handleInlineSave = useCallback(() => {
    if (!inlineEditingField) return;

    const originalValue = data[inlineEditingField];
    const newValue = inlineEditValue;

    // Only save if value actually changed
    if (newValue !== originalValue) {
      // Update local data immediately for UI feedback
      setLocalData(prev => ({ ...prev, [inlineEditingField]: newValue }));

      // Trigger optimistic update via callback
      if (onInlineSave) {
        onInlineSave(inlineEditingField, newValue);
      }
    }

    // Exit inline edit mode
    setInlineEditingField(null);
    setInlineEditValue(null);
  }, [inlineEditingField, inlineEditValue, data, onInlineSave]);

  // Cancel inline edit
  const handleInlineCancel = useCallback(() => {
    setInlineEditingField(null);
    setInlineEditValue(null);
  }, []);

  // Handle key down in inline edit mode
  const handleInlineKeyDown = useCallback((e: React.KeyboardEvent, inputType: string) => {
    // Enter to save (except for textarea where Enter adds newline)
    if (e.key === 'Enter' && inputType !== 'textarea') {
      e.preventDefault();
      handleInlineSave();
      return;
    }

    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      handleInlineCancel();
      return;
    }
  }, [handleInlineSave, handleInlineCancel]);

  // Click outside to save and close
  useEffect(() => {
    if (!inlineEditingField) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (editingFieldRef.current && !editingFieldRef.current.contains(event.target as Node)) {
        handleInlineSave();
      }
    };

    // Delay adding listener to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inlineEditingField, handleInlineSave]);

  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => {
      cancelLongPress();
    };
  }, [cancelLongPress]);

  // ============================================================================
  // METADATA-DRIVEN FIELD GENERATION
  // ============================================================================

  const fields = useMemo(() => {
    const componentMetadata = (metadata as any)?.viewType ? metadata
      : (metadata as any)?.entityInstanceFormContainer;

    if (config?.fields && config.fields.length > 0) {
      return config.fields;
    }

    const viewType = extractViewType(componentMetadata);
    const editType = extractEditType(componentMetadata);

    if (!viewType) {
      console.error('[EntityInstanceFormContainer] No viewType in metadata');
      return [];
    }

    return Object.entries(viewType)
      .filter(([_, fieldMeta]) => fieldMeta.behavior?.visible !== false)
      .map(([fieldKey, viewMeta]) => {
        const editMeta = editType?.[fieldKey];

        // v12.2.0: Extract both renderType and inputType
        const renderType = viewMeta.renderType ?? 'text';
        const inputType = editMeta?.inputType ?? 'text';

        // vizContainer for component-based rendering
        const viewVizContainer = (renderType === 'component' && viewMeta.component)
          ? viewMeta.component
          : undefined;
        const editVizContainer = (inputType === 'component' && editMeta?.component)
          ? editMeta.component
          : undefined;

        return {
          key: fieldKey,
          label: viewMeta.label,
          renderType,
          inputType,
          editable: editMeta?.behavior?.editable ?? false,
          lookupSourceTable: editMeta?.lookupSourceTable,
          lookupEntity: (viewMeta as any)?.lookupEntity || editMeta?.lookupEntity,
          lookupField: editMeta?.lookupField,
          style: viewMeta.style,
          vizContainer: {
            view: viewVizContainer,
            edit: editVizContainer
          }
        } as FieldDef;
      });
  }, [metadata, config]);

  // ============================================================================
  // DATALABEL OPTIONS
  // ============================================================================

  const labelsMetadata = useMemo(() => {
    const metadataMap = new Map<string, LabelMetadata[]>();

    if (!fields || fields.length === 0) {
      return metadataMap;
    }

    const fieldsNeedingSettings = fields.filter(
      field => field.lookupSourceTable === 'datalabel' || field.lookupField
    );

    fieldsNeedingSettings.forEach((field) => {
      const lookupKey = field.lookupField || field.key;
      const cachedOptions = getDatalabelSync(lookupKey);

      if (cachedOptions && cachedOptions.length > 0) {
        const options: LabelMetadata[] = cachedOptions
          .filter(opt => opt.active_flag !== false)
          .map(opt => ({
            value: opt.name,
            label: opt.name,
            colorClass: colorCodeToTailwindClass(opt.color_code),
            metadata: {
              id: opt.id,
              parent_ids: opt.parent_ids || [],
              descr: opt.descr,
              sort_order: opt.sort_order,
              active_flag: opt.active_flag
            }
          }));
        metadataMap.set(field.key, options);
      }
    });

    return metadataMap;
  }, [fields]);

  // ============================================================================
  // CHANGE HANDLER
  // ============================================================================

  const handleFieldChange = React.useCallback((fieldKey: string, value: any) => {
    setLocalData(prev => ({ ...prev, [fieldKey]: value }));
    onChange(fieldKey, value);
  }, [onChange]);

  // ============================================================================
  // FIELD VISIBILITY
  // ============================================================================

  const excludedFields = mode === 'create'
    ? ['title', 'id', 'created_ts', 'updated_ts']
    : ['name', 'title', 'code', 'id', 'created_ts', 'updated_ts'];

  const visibleFields = fields.filter(f => !excludedFields.includes(f.key));

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      <div className="p-6">
        <div className="space-y-0">
          {visibleFields.map((field, index) => {
            const effectiveData = isEditing ? localData : data;
            const value = effectiveData[field.key];

            // Date range handling
            const datePattern = DATE_RANGE_PATTERNS[field.key];
            const hasEndDate = datePattern && effectiveData[datePattern.end];

            // Skip start_date fields if we have both dates (rendered together with end_date)
            if (isStartDateField(field.key) && !isEditing && hasEndDate) {
              return null;
            }

            // Get options for this field
            const options = labelsMetadata.get(field.key) || field.options || [];

            // Build field props for FieldRenderer
            const fieldProps = {
              ...field,
              vizContainer: field.vizContainer,
            };

            // v12.3.0: Determine if this field is being inline edited
            const isInlineEditing = inlineEditingField === field.key;
            const isFieldEditable = field.editable !== false;

            // v12.3.0: Determine effective editing state (full edit mode OR inline editing this field)
            const effectiveIsEditing = isEditing || isInlineEditing;

            // v12.3.0: Get the value to display/edit
            // - Full edit mode: use localData
            // - Inline editing this field: use inlineEditValue
            // - View mode: use data
            const displayValue = isInlineEditing
              ? inlineEditValue
              : (isEditing ? localData[field.key] : value);

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
                <div className="group transition-all duration-300 ease-out py-1">
                  <div className="grid grid-cols-[160px_1fr] gap-4 items-start">
                    <label className="text-2xs font-medium text-dark-700 pt-2 flex items-center gap-1.5 uppercase tracking-wide">
                      <span className="opacity-50 group-hover:opacity-100 transition-all duration-300 group-hover:text-dark-700">
                        {/* Date Range label */}
                        {(() => {
                          const rangeLabel = getDateRangeLabel(field.key);
                          const hasStartDate = datePattern && effectiveData[datePattern.start];
                          return (rangeLabel && hasStartDate && !isEditing) ? rangeLabel : field.label;
                        })()}
                      </span>
                      {field.required && mode === 'create' && (
                        <span className="text-rose-400 text-xs animate-pulse">*</span>
                      )}
                    </label>
                    <div
                      ref={isInlineEditing ? editingFieldRef : undefined}
                      className={`
                        relative break-words rounded-md px-3 py-2 -ml-3
                        transition-all duration-300 ease-out
                        ${effectiveIsEditing
                          ? 'bg-gray-50 hover:bg-gray-100 hover:shadow-sm focus-within:bg-white focus-within:shadow-sm focus-within:border focus-within:border-blue-200'
                          : 'hover:bg-gray-50'
                        }
                        ${!isEditing && inlineEditable && isFieldEditable ? 'cursor-text' : ''}
                        text-sm text-gray-700 tracking-tight leading-normal
                      `}
                      // v12.3.0: Long-press handlers for inline editing
                      onMouseDown={(e) => handleFieldMouseDown(e, field.key, isFieldEditable)}
                      onMouseUp={handleFieldMouseUp}
                      onMouseLeave={handleFieldMouseLeave}
                      // v12.3.0: Keyboard handler for inline editing
                      onKeyDown={isInlineEditing ? (e) => handleInlineKeyDown(e, field.inputType || 'text') : undefined}
                    >
                      {/* Special: Date range visualizer for end_date fields */}
                      {isEndDateField(field.key) && datePattern && effectiveData[datePattern.start] && !effectiveIsEditing ? (
                        <DateRangeVisualizer
                          startDate={effectiveData[datePattern.start]}
                          endDate={value}
                        />
                      ) : (
                        <FieldRenderer
                          field={fieldProps}
                          value={displayValue}
                          isEditing={effectiveIsEditing}
                          onChange={(v) => {
                            if (isInlineEditing) {
                              // v12.3.0: Update inline edit value
                              handleInlineValueChange(v);
                            } else {
                              // Full edit mode: use original handler
                              handleFieldChange(field.key, v);
                            }
                          }}
                          options={options}
                          formattedData={formattedData ? {
                            display: formattedData.display,
                            styles: formattedData.styles
                          } : undefined}
                        />
                      )}
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

// ============================================================================
// MEMO COMPARISON
// ============================================================================

function arePropsEqual(
  prevProps: EntityInstanceFormContainerProps,
  nextProps: EntityInstanceFormContainerProps
): boolean {
  if (prevProps.isEditing !== nextProps.isEditing) return false;
  if (prevProps.mode !== nextProps.mode) return false;
  if (prevProps.metadata !== nextProps.metadata) return false;
  if (prevProps.config !== nextProps.config) return false;
  if (prevProps.datalabels !== nextProps.datalabels) return false;
  // v12.3.0: Check inline editing props
  if (prevProps.inlineEditable !== nextProps.inlineEditable) return false;
  if (prevProps.entityId !== nextProps.entityId) return false;

  const prevKeys = Object.keys(prevProps.data || {}).sort().join(',');
  const nextKeys = Object.keys(nextProps.data || {}).sort().join(',');
  if (prevKeys !== nextKeys) return false;

  if (!nextProps.isEditing) {
    if (prevProps.data !== nextProps.data) return false;
  }

  return true;
}

export const EntityInstanceFormContainer = React.memo(EntityInstanceFormContainerInner, arePropsEqual);
