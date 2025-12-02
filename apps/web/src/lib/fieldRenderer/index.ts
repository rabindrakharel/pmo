// ============================================================================
// FIELD RENDERER - Modular Interface for Dynamic View/Edit Rendering
// ============================================================================
// Version: 12.2.0
//
// This module provides a unified, metadata-driven field rendering system that:
// 1. Dynamically resolves components based on renderType (view) and inputType (edit)
// 2. Supports the component registry pattern for extensibility
// 3. Handles both inline HTML5 types and custom React components
// 4. Aligns with YAML view-type-mapping.yaml and edit-type-mapping.yaml
//
// Architecture:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │                         FIELD RENDERER SYSTEM                            │
// ├─────────────────────────────────────────────────────────────────────────┤
// │                                                                          │
// │  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
// │  │   Metadata      │     │ Component       │     │   Rendered      │   │
// │  │   (viewType/    │ ──▶ │ Registry        │ ──▶ │   Component     │   │
// │  │    editType)    │     │ (VIEW/EDIT)     │     │                 │   │
// │  └─────────────────┘     └─────────────────┘     └─────────────────┘   │
// │                                                                          │
// │  Props Flow:                                                             │
// │  ┌─────────────────────────────────────────────────────────────────────┐│
// │  │  FieldRendererProps = {                                              ││
// │  │    field: FieldDef,           // Field definition with metadata     ││
// │  │    value: any,                // Current field value                ││
// │  │    isEditing: boolean,        // View or Edit mode                  ││
// │  │    onChange?: (v) => void,    // Edit mode callback                 ││
// │  │    options?: LabelMetadata[], // Datalabel options if applicable    ││
// │  │    formattedData?: FormattedRow, // Pre-formatted display data      ││
// │  │  }                                                                   ││
// │  └─────────────────────────────────────────────────────────────────────┘│
// └─────────────────────────────────────────────────────────────────────────┘
//
// Usage:
// ```tsx
// import { FieldRenderer, registerViewComponent, registerEditComponent } from '@/lib/fieldRenderer';
//
// // Register custom components (typically in app initialization)
// registerViewComponent('DAGVisualizer', DAGVisualizerComponent);
// registerEditComponent('BadgeDropdownSelect', BadgeDropdownSelectComponent);
//
// // Use in page components
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

// Main component
export { FieldRenderer, type FieldRendererProps } from './FieldRenderer';

// Component Registry
export {
  // Registries
  ViewComponentRegistry,
  EditComponentRegistry,
  // Registration functions
  registerViewComponent,
  registerEditComponent,
  // Resolution functions
  resolveViewComponent,
  resolveEditComponent,
  getViewComponent,
  getEditComponent,
  // Type checking
  isHTML5InputType,
  isInlineRenderType,
  HTML5_INPUT_TYPES,
  INLINE_RENDER_TYPES,
  // Types
  type ComponentRendererProps,
  type ComponentRenderer,
} from './ComponentRegistry';

// Inline renderers (for advanced use cases)
export { renderViewField } from './ViewFieldRenderer';
export { renderEditField } from './EditFieldRenderer';
