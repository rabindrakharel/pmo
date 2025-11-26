/**
 * EntityFormContainer with Zustand Store Integration
 *
 * Enhanced version that uses Zustand for state management:
 * - Field-level change tracking
 * - Only sends changed fields to API
 * - Optimistic updates
 * - Undo/redo capability
 * - Visual indicators for dirty fields
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import { useEntityEditStore } from '../../../stores/useEntityEditStore';
import { useShallow } from 'zustand/shallow';
import type { EntityConfig, FieldDef } from '../../../lib/entityConfig';
import type { LabelMetadata } from '../../../lib/formatters/labelMetadataLoader';
import { DAGVisualizer, type DAGNode } from '../../workflow/DAGVisualizer';
import { renderEmployeeNames } from '../../../lib/entityConfig';
import { SearchableMultiSelect } from '../ui/SearchableMultiSelect';
import { DateRangeVisualizer } from '../ui/DateRangeVisualizer';
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

// ============================================================================
// Types
// ============================================================================

interface EntityFormContainerProps {
  entityType: string;
  entityId: string;
  data: Record<string, any>;
  isEditing: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';

  // Backend-driven metadata (if available)
  metadata?: EntityMetadata;
  datalabels?: DatalabelData[];

  // Fallback: frontend config
  config?: EntityConfig;
  settings?: LabelMetadata[];
}

// ============================================================================
// Component
// ============================================================================

export const EntityFormContainerWithStore: React.FC<EntityFormContainerProps> = ({
  entityType,
  entityId,
  data: initialData,
  isEditing: externalIsEditing,
  onSave,
  onCancel,
  mode = 'edit',
  metadata,
  datalabels,
  config,
  settings
}) => {
  // ============================================================================
  // Zustand Store Integration
  // ✅ INDUSTRY STANDARD: Use useShallow selector to prevent unnecessary re-renders
  // Only subscribe to specific state slices needed by this component
  // ============================================================================

  const {
    currentData,
    dirtyFields,
    isEditing,
    isSaving,
    saveError,
    startEdit,
    updateField,
    saveChanges,
    cancelEdit,
    getChanges,
    isFieldDirty,
    undo,
    redo,
    reset
  } = useEntityEditStore(useShallow(state => ({
    currentData: state.currentData,
    dirtyFields: state.dirtyFields,
    isEditing: state.isEditing,
    isSaving: state.isSaving,
    saveError: state.saveError,
    startEdit: state.startEdit,
    updateField: state.updateField,
    saveChanges: state.saveChanges,
    cancelEdit: state.cancelEdit,
    getChanges: state.getChanges,
    isFieldDirty: state.isFieldDirty,
    undo: state.undo,
    redo: state.redo,
    reset: state.reset,
  })));

  // Derive boolean helpers from state (stable computation)
  const hasChanges = dirtyFields.size > 0;
  const canUndo = useEntityEditStore.getState().undoStack.length > 0;
  const canRedo = useEntityEditStore.getState().redoStack.length > 0;

  // Initialize edit session when component mounts or data changes
  useEffect(() => {
    if (externalIsEditing && initialData) {
      startEdit(entityType, entityId, initialData);
    } else if (!externalIsEditing && isEditing) {
      cancelEdit();
    }
  }, [externalIsEditing, entityType, entityId]);

  // Use currentData from store if editing, otherwise use initialData
  const displayData = isEditing && currentData ? currentData : initialData;

  // ============================================================================
  // Field Generation (same as original)
  // ============================================================================

  const fields = useMemo(() => {
    if (metadata?.fields) {
      return metadata.fields
        .filter(f => f.visible?.EntityFormContainer !== false)
        .map(fieldMeta => {
          // Convert viewType to viz_container (backend-driven visualization)
          let vizContainer = fieldMeta.EntityFormContainer_viz_container;
          if (!vizContainer && (fieldMeta as any).viewType === 'dag') {
            vizContainer = 'DAGVisualizer';
          } else if (!vizContainer && (fieldMeta as any).renderType === 'dag') {
            vizContainer = 'DAGVisualizer';
          } else if (!vizContainer && fieldMeta.key === 'metadata') {
            vizContainer = 'MetadataTable';
          }

          return {
            key: fieldMeta.key,
            label: fieldMeta.label || generateFieldLabel(fieldMeta.key),
            type: fieldMeta.inputType || 'text',
            lookupSource: fieldMeta.lookupSource,
            lookupEntity: fieldMeta.lookupEntity,
            datalabelKey: fieldMeta.datalabelKey || fieldMeta.key,
            EntityFormContainer_viz_container: vizContainer,
            placeholder: fieldMeta.placeholder,
            required: fieldMeta.required,
            readonly: fieldMeta.readonly,
            disabled: fieldMeta.disabled,
            coerceBoolean: fieldMeta.coerceBoolean
          };
        });
    }

    // v7.0.0: No auto-generation - all routes must provide metadata from backend
    return [];
  }, [metadata, config]);

  // ============================================================================
  // Settings and DAG nodes (same as original)
  // ============================================================================

  const { settingOptions, dagNodes } = useMemo(() => {
    const options = new Map<string, any[]>();
    const nodes = new Map<string, DAGNode[]>();

    // Process datalabels...
    // (same logic as original)

    return { settingOptions: options, dagNodes: nodes };
  }, [fields, datalabels, settings]);

  // ============================================================================
  // Enhanced Field Change Handler
  // ============================================================================

  const handleFieldChange = useCallback((fieldKey: string, value: any) => {
    if (!isEditing) return;

    // Update via Zustand store (tracks changes automatically)
    updateField(fieldKey, value);

    console.log(`Field updated: ${fieldKey}`, {
      newValue: value,
      isDirty: isFieldDirty(fieldKey),
      totalChanges: dirtyFields.size
    });
  }, [isEditing, updateField, isFieldDirty, dirtyFields.size]);

  // ============================================================================
  // Save Handler
  // ============================================================================

  const handleSave = useCallback(async () => {
    const changes = getChanges();

    if (Object.keys(changes).length === 0) {
      console.log('No changes to save');
      onSave?.();
      return;
    }

    console.log(`Saving ${Object.keys(changes).length} changed fields:`, changes);

    const success = await saveChanges();

    if (success) {
      console.log('Save successful');
      onSave?.();
    } else {
      console.error('Save failed:', saveError);
    }
  }, [saveChanges, getChanges, onSave, saveError]);

  // ============================================================================
  // Cancel Handler
  // ============================================================================

  const handleCancel = useCallback(() => {
    if (hasChanges()) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }

    cancelEdit();
    onCancel?.();
  }, [cancelEdit, hasChanges, onCancel]);

  // ============================================================================
  // Field Renderer (enhanced with dirty field indicator)
  // ============================================================================

  const renderField = (field: FieldDef, value: any) => {
    const isDirty = isFieldDirty(field.key);
    const fieldClass = isDirty ? 'field-dirty' : '';

    // Add visual indicator for dirty fields
    const fieldWrapper = (children: React.ReactNode) => (
      <div className={`field-wrapper ${fieldClass}`}>
        {children}
        {isDirty && (
          <span className="dirty-indicator" title="Field has unsaved changes">
            •
          </span>
        )}
      </div>
    );

    if (!isEditing) {
      // View mode rendering (same as original)
      return <div>{formatFieldValue(field, value)}</div>;
    }

    // Edit mode rendering
    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
      case 'number':
        return fieldWrapper(
          <input
            type={field.type}
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className={`form-input ${isDirty ? 'has-changes' : ''}`}
            placeholder={field.placeholder}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );

      case 'date':
        return fieldWrapper(
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value === '' ? null : e.target.value)}
            className={`form-input ${isDirty ? 'has-changes' : ''}`}
            disabled={field.disabled || field.readonly}
            required={field.required && mode === 'create'}
          />
        );

      case 'select':
        const options = settingOptions.get(field.key) || [];
        return fieldWrapper(
          <select
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value || null)}
            className={`form-select ${isDirty ? 'has-changes' : ''}`}
            disabled={field.disabled || field.readonly}
          >
            <option value="">Select...</option>
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      // Add more field types as needed...

      default:
        return fieldWrapper(
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className={`form-input ${isDirty ? 'has-changes' : ''}`}
          />
        );
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  // v8.3.0: Field visibility determined by backend metadata (visible property), NOT frontend pattern detection
  const excludedFields = mode === 'create'
    ? ['id', 'created_ts', 'updated_ts']
    : ['name', 'code', 'id', 'created_ts', 'updated_ts'];

  const visibleFields = fields.filter(f => !excludedFields.includes(f.key));

  return (
    <div className="entity-form-container">
      {/* Edit Mode Toolbar */}
      {isEditing && (
        <div className="edit-toolbar">
          <div className="toolbar-left">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="btn-undo"
              title="Undo last change (Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="btn-redo"
              title="Redo (Ctrl+Y)"
            >
              ↷ Redo
            </button>
            {dirtyFields.size > 0 && (
              <span className="changes-indicator">
                {dirtyFields.size} unsaved {dirtyFields.size === 1 ? 'change' : 'changes'}
              </span>
            )}
          </div>
          <div className="toolbar-right">
            <button
              onClick={handleCancel}
              className="btn-cancel"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-save"
              disabled={isSaving || !hasChanges()}
            >
              {isSaving ? 'Saving...' : `Save ${dirtyFields.size} Changes`}
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {saveError && (
        <div className="error-message">
          Failed to save: {saveError}
        </div>
      )}

      {/* Form Fields */}
      <div className="form-fields">
        {visibleFields.map((field) => {
          const value = displayData?.[field.key];

          return (
            <div key={field.key} className="form-field">
              <label className="field-label">
                {field.label}
                {field.required && <span className="required">*</span>}
              </label>
              <div className="field-value">
                {renderField(field, value)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Debug Panel (development only) */}
      {process.env.NODE_ENV === 'development' && isEditing && (
        <details className="debug-panel">
          <summary>Debug Info</summary>
          <div>
            <h4>Changed Fields:</h4>
            <pre>{JSON.stringify(getChanges(), null, 2)}</pre>
            <h4>Dirty Fields:</h4>
            <pre>{Array.from(dirtyFields).join(', ')}</pre>
          </div>
        </details>
      )}
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateFieldLabel(fieldKey: string): string {
  return fieldKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format field value based on backend metadata renderType
 * v8.3.0: Uses field.renderType from backend metadata, NOT pattern detection
 */
function formatFieldValue(field: FieldDef, value: any): string {
  if (value == null) return '-';

  // v8.3.0: Use renderType from backend metadata for formatting decisions
  const renderType = (field as any).renderType;

  switch (renderType) {
    case 'currency':
      return formatCurrency(value);
    case 'date':
      return formatFriendlyDate(value);
    case 'timestamp':
    case 'datetime':
      return formatRelativeTime(value);
    default:
      return String(value);
  }
}

// ============================================================================
// Styles (add to your CSS)
// ============================================================================

const styles = `
.entity-form-container {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
}

.edit-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 1.5rem;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.changes-indicator {
  padding: 0.25rem 0.75rem;
  background: #fff3cd;
  color: #856404;
  border-radius: 4px;
  font-size: 0.875rem;
}

.field-wrapper {
  position: relative;
}

.dirty-indicator {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  color: #ff9800;
  font-size: 1.5rem;
  font-weight: bold;
}

.form-input.has-changes,
.form-select.has-changes {
  border-color: #ff9800;
  box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.1);
}

.btn-undo,
.btn-redo {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-undo:hover:not(:disabled),
.btn-redo:hover:not(:disabled) {
  background: #f8f9fa;
}

.btn-undo:disabled,
.btn-redo:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-save {
  padding: 0.5rem 1.5rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-save:hover:not(:disabled) {
  background: #218838;
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 0.5rem 1.5rem;
  background: white;
  color: #6c757d;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #f8f9fa;
}

.error-message {
  padding: 1rem;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.debug-panel {
  margin-top: 2rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.875rem;
}

.debug-panel pre {
  background: white;
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
}
`;