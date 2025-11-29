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
  // v8.3.2: For entity reference fields - used with ref_data_entityInstance
  lookupEntity?: string;            // Entity code for name resolution
}

// Alias for backward compatibility
export type FieldMetadata = ViewFieldMetadata;

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
  component?: string;               // Special component: 'DAGVisualizer', 'EntityInstanceNameLookup', etc.
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
 * Backend sends: metadata.entityListOfInstancesTable = { viewType: {...}, editType: {...} }
 */
export interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}


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
  metadata: ViewFieldMetadata | undefined
) => FormattedValue;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if metadata has the required nested structure (viewType/editType)
 */
export function isValidComponentMetadata(
  metadata: ComponentMetadata | null | undefined
): metadata is ComponentMetadata {
  if (!metadata) return false;
  return 'viewType' in metadata && typeof metadata.viewType === 'object';
}

/**
 * Extract viewType from component metadata
 * v8.2.0: Only supports new nested structure - no legacy fallback
 */
export function extractViewType(
  metadata: ComponentMetadata | null | undefined
): Record<string, ViewFieldMetadata> | null {
  if (!metadata) return null;

  if (!isValidComponentMetadata(metadata)) {
    console.error('[formatters] Invalid metadata structure - expected { viewType, editType }');
    return null;
  }

  return metadata.viewType;
}

/**
 * Extract editType from component metadata
 * v8.2.0: Only supports new nested structure - no legacy fallback
 */
export function extractEditType(
  metadata: ComponentMetadata | null | undefined
): Record<string, EditFieldMetadata> | null {
  if (!metadata) return null;

  if (!isValidComponentMetadata(metadata)) {
    console.error('[formatters] Invalid metadata structure - expected { viewType, editType }');
    return null;
  }

  return metadata.editType;
}
