/**
 * ============================================================================
 * FORMAT-AT-FETCH TYPE DEFINITIONS
 * ============================================================================
 *
 * Types for the format-at-fetch optimization that moves formatting
 * from render time to fetch time for improved scroll performance.
 */

/**
 * Metadata for a single field (from backend)
 */
export interface FieldMetadata {
  renderType?: string;   // View mode: how to display the field
  inputType?: string;    // Edit mode: what input control to use
  datalabelKey?: string;
  lookupSource?: 'datalabel' | 'entityInstance';  // Backend lookup type
  lookupEntity?: string;                           // Entity code for entityInstance lookup
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
 * Component metadata from backend (keyed by field name)
 */
export interface ComponentMetadata {
  [fieldName: string]: FieldMetadata;
}

/**
 * Formatted value result
 */
export interface FormattedValue {
  display: string;      // Formatted display string
  style?: string;       // CSS classes (for badges)
}

/**
 * Single formatted row
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
  metadata: FieldMetadata | undefined
) => FormattedValue;
