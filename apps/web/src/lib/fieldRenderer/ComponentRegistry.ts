// ============================================================================
// COMPONENT REGISTRY - Dynamic Component Resolution for Field Rendering
// ============================================================================
// Version: 12.2.0
//
// This module provides a registry pattern for dynamically resolving React
// components based on renderType (view) and inputType (edit) from metadata.
//
// Architecture:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │                       COMPONENT REGISTRY PATTERN                        │
// ├─────────────────────────────────────────────────────────────────────────┤
// │                                                                          │
// │  ┌─────────────────────────┐    ┌─────────────────────────┐             │
// │  │  VIEW REGISTRY          │    │  EDIT REGISTRY          │             │
// │  │  ─────────────────────  │    │  ─────────────────────  │             │
// │  │  renderType → Component │    │  inputType → Component  │             │
// │  │                         │    │                         │             │
// │  │  'currency' → inline    │    │  'number' → HTML5       │             │
// │  │  'badge' → inline       │    │  'select' → component   │             │
// │  │  'component' → lookup   │    │  'component' → lookup   │             │
// │  └─────────────────────────┘    └─────────────────────────┘             │
// │                                                                          │
// └─────────────────────────────────────────────────────────────────────────┘
//
// YAML Alignment:
// - VIEW: Aligns with view-type-mapping.yaml (renderType)
// - EDIT: Aligns with edit-type-mapping.yaml (inputType)
// ============================================================================

import type { FC } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Props passed to custom component renderers
 *
 * @example
 * const DAGVisualizer: FC<ComponentRendererProps> = ({ value, field, onChange, isEditing }) => {
 *   // Render DAG visualization
 * }
 */
export interface ComponentRendererProps {
  /** Current field value */
  value: any;
  /** Field definition with metadata */
  field: {
    key: string;
    label: string;
    renderType: string;
    inputType: string;
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
  };
  /** Pre-formatted display data (for view mode) */
  formattedData?: {
    display: Record<string, string>;
    styles: Record<string, string>;
  };
  /** Datalabel options (if applicable) */
  options?: Array<{
    value: string | number;
    label: string;
    colorClass?: string;
    metadata?: Record<string, any>;
  }>;
  /** Entity instance lookup data */
  refData?: Record<string, Record<string, string>>;
  /** Whether in edit mode */
  isEditing: boolean;
  /** Change handler (edit mode only) */
  onChange?: (value: any) => void;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Whether field is readonly */
  readonly?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Component renderer function type
 */
export type ComponentRenderer = FC<ComponentRendererProps>;

// ============================================================================
// VIEW Component Registry
// ============================================================================

/**
 * Registry for VIEW mode components
 * Maps renderType or component name to React component
 *
 * @example
 * // Register a custom view component
 * ViewComponentRegistry.set('DAGVisualizer', DAGVisualizerComponent);
 *
 * // Retrieve a component
 * const Component = ViewComponentRegistry.get('DAGVisualizer');
 */
export const ViewComponentRegistry = new Map<string, ComponentRenderer>();

/**
 * Register a view component
 *
 * @param name - Component name (from renderType or component field in YAML)
 * @param component - React component to render
 *
 * @example
 * registerViewComponent('DAGVisualizer', DAGVisualizerComponent);
 * registerViewComponent('EntityInstanceName', EntityInstanceNameComponent);
 */
export function registerViewComponent(name: string, component: ComponentRenderer): void {
  ViewComponentRegistry.set(name, component);
}

/**
 * Get a registered view component
 *
 * @param name - Component name
 * @returns The registered component or undefined
 */
export function getViewComponent(name: string): ComponentRenderer | undefined {
  return ViewComponentRegistry.get(name);
}

// ============================================================================
// EDIT Component Registry
// ============================================================================

/**
 * Registry for EDIT mode components
 * Maps inputType or component name to React component
 *
 * @example
 * // Register a custom edit component
 * EditComponentRegistry.set('BadgeDropdownSelect', BadgeDropdownSelectComponent);
 *
 * // Retrieve a component
 * const Component = EditComponentRegistry.get('BadgeDropdownSelect');
 */
export const EditComponentRegistry = new Map<string, ComponentRenderer>();

/**
 * Register an edit component
 *
 * @param name - Component name (from inputType or component field in YAML)
 * @param component - React component to render
 *
 * @example
 * registerEditComponent('BadgeDropdownSelect', BadgeDropdownSelectComponent);
 * registerEditComponent('EntityInstanceNameSelect', EntityInstanceNameSelectComponent);
 */
export function registerEditComponent(name: string, component: ComponentRenderer): void {
  EditComponentRegistry.set(name, component);
}

/**
 * Get a registered edit component
 *
 * @param name - Component name
 * @returns The registered component or undefined
 */
export function getEditComponent(name: string): ComponentRenderer | undefined {
  return EditComponentRegistry.get(name);
}

// ============================================================================
// HTML5 Input Types (No custom component needed)
// ============================================================================

/**
 * HTML5 native input types that don't require custom components
 * These are rendered inline using standard HTML5 <input> elements
 *
 * From edit-type-mapping.yaml:
 * - text, textarea, email, tel, url, number, date, time, datetime-local
 * - checkbox, color, file, range, hidden, readonly
 */
export const HTML5_INPUT_TYPES = new Set([
  'text',
  'textarea',
  'email',
  'tel',
  'url',
  'number',
  'date',
  'time',
  'datetime-local',
  'checkbox',
  'color',
  'file',
  'range',
  'hidden',
  'readonly',
]);

/**
 * Check if inputType is an HTML5 native type
 *
 * @param inputType - The inputType from metadata
 * @returns true if HTML5 native, false if custom component needed
 */
export function isHTML5InputType(inputType: string): boolean {
  return HTML5_INPUT_TYPES.has(inputType);
}

// ============================================================================
// Inline Render Types (No custom component needed)
// ============================================================================

/**
 * View render types that are handled inline (no custom component)
 * These are formatted by formatDataset() and rendered as text/HTML
 *
 * From view-type-mapping.yaml:
 * - text, number, currency, percentage, date, timestamp, time
 * - duration, boolean, filesize, badge, entityLink, entityLinks
 * - tags, file, image, avatar, color, icon, json
 */
export const INLINE_RENDER_TYPES = new Set([
  'text',
  'number',
  'currency',
  'percentage',
  'date',
  'timestamp',
  'time',
  'duration',
  'boolean',
  'filesize',
  'badge',
  'entityLink',
  'entityLinks',
  'tags',
  'file',
  'image',
  'avatar',
  'color',
  'icon',
  'json',
]);

/**
 * Check if renderType is handled inline
 *
 * @param renderType - The renderType from metadata
 * @returns true if inline rendering, false if custom component needed
 */
export function isInlineRenderType(renderType: string): boolean {
  return INLINE_RENDER_TYPES.has(renderType);
}

// ============================================================================
// Component Resolution
// ============================================================================

/**
 * Resolve a view component from metadata
 *
 * Resolution order:
 * 1. If renderType is 'component', look up by component name (e.g., 'DAGVisualizer')
 * 2. Look up by renderType directly in registry (for registered inline types)
 * 3. Return null for unregistered inline types (handled by ViewFieldRenderer)
 *
 * @param renderType - The renderType from viewType metadata
 * @param componentName - Optional component name (when renderType is 'component')
 * @returns The component to render, or null for inline rendering
 */
export function resolveViewComponent(
  renderType: string,
  componentName?: string
): ComponentRenderer | null {
  // When renderType is 'component', use the component name
  if (renderType === 'component' && componentName) {
    return ViewComponentRegistry.get(componentName) || null;
  }

  // Try to find a registered component by renderType directly
  // This handles both custom components and registered inline types (badge, timestamp, etc.)
  const registered = ViewComponentRegistry.get(renderType);
  if (registered) {
    return registered;
  }

  // Not in registry - will be handled by ViewFieldRenderer inline
  return null;
}

/**
 * Resolve an edit component from metadata
 *
 * Resolution order:
 * 1. If inputType is 'component' or 'select', look up by component name
 * 2. Look up by inputType directly in registry (for registered types like 'text', 'number')
 * 3. Return null for unregistered types (handled by EditFieldRenderer)
 *
 * @param inputType - The inputType from editType metadata
 * @param componentName - Optional component name (when inputType is 'component' or 'select')
 * @returns The component to render, or null for HTML5 input
 */
export function resolveEditComponent(
  inputType: string,
  componentName?: string
): ComponentRenderer | null {
  // When inputType is 'component' or 'select', use the component name
  if ((inputType === 'component' || inputType === 'select') && componentName) {
    return EditComponentRegistry.get(componentName) || null;
  }

  // Try to find a registered component by inputType directly
  // This handles both custom components and registered types (text, number, textarea, etc.)
  const registered = EditComponentRegistry.get(inputType);
  if (registered) {
    return registered;
  }

  // Not in registry - will be handled by EditFieldRenderer inline
  return null;
}
