/**
 * ============================================================================
 * FORMAT-AT-READ TYPE DEFINITIONS
 * ============================================================================
 *
 * Types for the format-at-read pattern that transforms raw cached data
 * into formatted display data via React Query's `select` option.
 *
 * v8.1.0: Fixed metadata coupling - ComponentMetadata now matches backend
 * structure with separate viewType and editType containers.
 */

// ============================================================================
// VIEW TYPE METADATA - For display/rendering (from viewType)
// ============================================================================

/**
 * ViewFieldMetadata - Display configuration from backend viewType
 * Contains all properties needed for read-only rendering
 */
export interface ViewFieldMetadata {
  dtype: string;                    // Data type: 'str', 'float', 'uuid', 'timestamp', etc.
  label: string;                    // Display label
  renderType: string;               // How to render: 'text', 'currency', 'badge', 'date', etc.
  behavior: {
    visible: boolean;               // Show in this component
    sortable: boolean;              // Can sort by this field
    filterable: boolean;            // Can filter by this field
    searchable: boolean;            // Include in search
    required?: boolean;             // Display required indicator (*)
  };
  style: {
    width?: string;                 // Column width
    align?: 'left' | 'right' | 'center';
    bold?: boolean;
    monospace?: boolean;
    symbol?: string;                // Currency symbol
    decimals?: number;              // Decimal places
    locale?: string;                // Locale for formatting
    format?: string;                // Date/time format
    emptyValue?: string;            // What to show when null
    helpText?: string;              // Tooltip on hover
    truncate?: number;              // Max characters before truncate
    colorFromData?: boolean;        // Use datalabel color
    linkToDetail?: boolean;         // Link to detail page
    linkToEntity?: boolean;         // Link to referenced entity
    displayField?: string;          // Field to display for references
    [key: string]: any;             // Additional style properties
  };
  component?: string;               // Special component to use
  // For datalabel fields
  settingsDatalabel?: string;       // Datalabel key for lookup
}

// ============================================================================
// EDIT TYPE METADATA - For input controls (from editType)
// ============================================================================

/**
 * EditFieldMetadata - Input configuration from backend editType
 * Contains all properties needed for edit mode/forms
 */
export interface EditFieldMetadata {
  dtype: string;                    // Data type
  label: string;                    // Input label
  inputType: string;                // Input control: 'text', 'number', 'select', 'date', etc.
  behavior: {
    editable: boolean;              // Can edit this field
  };
  style: {
    step?: number;                  // Number input step
    rows?: number;                  // Textarea rows
    placeholder?: string;           // Input placeholder
    helpText?: string;              // Help text/tooltip
    searchable?: boolean;           // Searchable select
    clearable?: boolean;            // Can clear selection
    displayField?: string;          // Display field for references
    [key: string]: any;             // Additional style properties
  };
  validation: {
    required?: boolean;             // Required field
    min?: number;                   // Min value
    max?: number;                   // Max value
    minLength?: number;             // Min string length
    maxLength?: number;             // Max string length
    pattern?: string;               // Regex pattern
  };
  component?: string;               // Special component: 'DAGVisualizer', 'EntitySelect', etc.
  lookupSource?: 'datalabel' | 'entityInstance';  // Where to load options
  lookupEntity?: string;            // Entity code for entityInstance lookup
  datalabelKey?: string;            // Datalabel key for datalabel lookup
}

// ============================================================================
// COMPONENT METADATA - Container for viewType and editType
// ============================================================================

/**
 * ComponentMetadata - The actual structure from backend API
 * Contains both view and edit configurations for a component
 *
 * Backend sends: metadata.entityDataTable = { viewType: {...}, editType: {...} }
 */
export interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

// ============================================================================
// LEGACY TYPES - For backwards compatibility during migration
// ============================================================================

/**
 * Legacy FieldMetadata - Flat structure (DEPRECATED)
 * Use ViewFieldMetadata or EditFieldMetadata instead
 *
 * @deprecated v8.1.0 - Use ViewFieldMetadata or EditFieldMetadata
 */
export interface FieldMetadata {
  renderType?: string;              // View mode: how to display
  inputType?: string;               // Edit mode: what input control
  datalabelKey?: string;
  lookupSource?: 'datalabel' | 'entityInstance';
  lookupEntity?: string;
  currencySymbol?: string;
  symbol?: string;
  decimals?: number;
  dateFormat?: string;
  locale?: string;
  label?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  visible?: boolean;
  editable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  color?: string;
  colorMap?: Record<string, string>;
}

/**
 * Legacy flat metadata structure (DEPRECATED)
 * @deprecated v8.1.0 - Use ComponentMetadata instead
 */
export type FlatComponentMetadata = Record<string, FieldMetadata>;

// ============================================================================
// FORMATTED VALUE TYPES
// ============================================================================

/**
 * Formatted value result from a formatter function
 */
export interface FormattedValue {
  display: string;      // Formatted display string
  style?: string;       // CSS classes (for badges)
}

/**
 * Single formatted row - contains raw data and formatted display values
 */
export interface FormattedRow<T = Record<string, any>> {
  raw: T;                              // Original values (for editing, mutations, sorting)
  display: Record<string, string>;     // Formatted display strings
  styles: Record<string, string>;      // CSS classes (badges only)
}

/**
 * Formatter function signature
 */
export type ValueFormatter = (
  value: any,
  key: string,
  metadata: ViewFieldMetadata | FieldMetadata | undefined
) => FormattedValue;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if metadata has the new nested structure (viewType/editType)
 */
export function isNestedComponentMetadata(
  metadata: ComponentMetadata | FlatComponentMetadata | null | undefined
): metadata is ComponentMetadata {
  if (!metadata) return false;
  return 'viewType' in metadata && typeof metadata.viewType === 'object';
}

/**
 * Extract viewType from component metadata (handles both new and legacy structures)
 */
export function extractViewType(
  metadata: ComponentMetadata | FlatComponentMetadata | null | undefined
): Record<string, ViewFieldMetadata | FieldMetadata> | null {
  if (!metadata) return null;

  // New nested structure: { viewType: {...}, editType: {...} }
  if (isNestedComponentMetadata(metadata)) {
    return metadata.viewType;
  }

  // Legacy flat structure: { fieldName: {...} }
  // Check if first key looks like a field name (not 'viewType' or 'editType')
  const keys = Object.keys(metadata);
  if (keys.length > 0 && !['viewType', 'editType'].includes(keys[0])) {
    console.warn('[formatters] Using legacy flat metadata structure - please migrate to viewType/editType');
    return metadata as Record<string, FieldMetadata>;
  }

  return null;
}

/**
 * Extract editType from component metadata (handles both new and legacy structures)
 */
export function extractEditType(
  metadata: ComponentMetadata | FlatComponentMetadata | null | undefined
): Record<string, EditFieldMetadata | FieldMetadata> | null {
  if (!metadata) return null;

  // New nested structure: { viewType: {...}, editType: {...} }
  if (isNestedComponentMetadata(metadata)) {
    return metadata.editType;
  }

  // Legacy flat structure doesn't have separate editType
  // Return the flat structure as-is for backwards compatibility
  const keys = Object.keys(metadata);
  if (keys.length > 0 && !['viewType', 'editType'].includes(keys[0])) {
    return metadata as Record<string, FieldMetadata>;
  }

  return null;
}
