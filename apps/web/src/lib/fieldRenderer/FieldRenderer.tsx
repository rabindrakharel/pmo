// ============================================================================
// FIELD RENDERER - Unified Component for Dynamic Field Rendering
// ============================================================================
// Version: 12.2.0
//
// Main entry point for field rendering. Automatically selects between
// view and edit mode based on isEditing prop, and resolves the appropriate
// component or inline renderer based on metadata.
//
// Usage:
// ```tsx
// <FieldRenderer
//   field={fieldDef}
//   value={data[field.key]}
//   isEditing={isEditing}
//   onChange={(v) => handleChange(field.key, v)}
//   options={datalabelOptions}
//   formattedData={formattedRow}
// />
// ```
// ============================================================================

import { type FC } from 'react';
import {
  resolveViewComponent,
  resolveEditComponent,
  type ComponentRendererProps,
} from './ComponentRegistry';
import { renderViewField } from './ViewFieldRenderer';
import { renderEditField } from './EditFieldRenderer';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the FieldRenderer component
 */
export interface FieldRendererProps {
  /** Field definition with metadata */
  field: {
    key: string;
    label: string;
    // renderType and inputType are optional - defaults to 'text' if not provided
    renderType?: string;
    inputType?: string;
    // Legacy type property (for backward compatibility)
    type?: string;
    lookupEntity?: string;
    lookupField?: string;
    lookupSourceTable?: 'datalabel' | 'entityInstance';
    style?: Record<string, any>;
    behavior?: Record<string, any>;
    validation?: Record<string, any>;
    vizContainer?: {
      view?: string;
      edit?: string;
    };
    required?: boolean;
    readonly?: boolean;
    disabled?: boolean;
  };
  /** Current field value */
  value: any;
  /** Whether in edit mode */
  isEditing: boolean;
  /** Change handler (edit mode) */
  onChange?: (value: any) => void;
  /** Datalabel options (if applicable) */
  options?: Array<{
    value: string | number;
    label: string;
    colorClass?: string;
    metadata?: Record<string, any>;
  }>;
  /** Pre-formatted display data (view mode) */
  formattedData?: {
    display: Record<string, string>;
    styles: Record<string, string>;
  };
  /** Entity instance lookup data */
  refData?: Record<string, Record<string, string>>;
  /** Additional className */
  className?: string;
}

// ============================================================================
// FieldRenderer Component
// ============================================================================

/**
 * Unified Field Renderer
 *
 * Automatically selects between view and edit mode, and resolves the
 * appropriate component based on renderType/inputType from metadata.
 *
 * Flow:
 * 1. Check isEditing mode
 * 2. For VIEW: Resolve component by renderType → render via ViewFieldRenderer
 * 3. For EDIT: Resolve component by inputType → render via EditFieldRenderer
 *
 * @example
 * // View mode - uses renderType
 * <FieldRenderer
 *   field={{ key: 'budget', renderType: 'currency', inputType: 'number', ... }}
 *   value={50000}
 *   isEditing={false}
 *   formattedData={{ display: { budget: '$50,000.00' }, styles: {} }}
 * />
 *
 * @example
 * // Edit mode - uses inputType
 * <FieldRenderer
 *   field={{ key: 'status', renderType: 'badge', inputType: 'component', ... }}
 *   value="active"
 *   isEditing={true}
 *   onChange={(v) => setStatus(v)}
 *   options={statusOptions}
 * />
 */
export const FieldRenderer: FC<FieldRendererProps> = ({
  field,
  value,
  isEditing,
  onChange,
  options,
  formattedData,
  refData,
  className,
}) => {
  // Default renderType and inputType (support legacy 'type' property)
  const renderType = field.renderType || field.type || 'text';
  const inputType = field.inputType || field.type || 'text';

  // Build normalized field for component renderers
  const normalizedField = {
    ...field,
    renderType,
    inputType,
  };

  // Build common props for component renderers
  const componentProps: ComponentRendererProps = {
    value,
    field: normalizedField,
    formattedData,
    options,
    refData,
    isEditing,
    onChange,
    disabled: field.disabled,
    readonly: field.readonly,
    className,
  };

  // ========================================================================
  // EDIT MODE
  // ========================================================================
  if (isEditing) {
    // Get component name from vizContainer.edit or field metadata
    const editComponentName = field.vizContainer?.edit;

    // Try to resolve a custom edit component
    const EditComponent = resolveEditComponent(inputType, editComponentName);

    if (EditComponent) {
      // Custom component found - render it
      return <EditComponent {...componentProps} />;
    }

    // No custom component - use inline edit renderer (HTML5 inputs)
    return renderEditField(componentProps);
  }

  // ========================================================================
  // VIEW MODE
  // ========================================================================

  // Get component name from vizContainer.view or field metadata
  const viewComponentName = field.vizContainer?.view;

  // Try to resolve a custom view component
  const ViewComponent = resolveViewComponent(renderType, viewComponentName);

  if (ViewComponent) {
    // Custom component found - render it
    return <ViewComponent {...componentProps} />;
  }

  // No custom component - use inline view renderer (formatDataset output)
  return renderViewField(componentProps);
};

export default FieldRenderer;
