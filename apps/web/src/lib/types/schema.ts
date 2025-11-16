/**
 * ============================================================================
 * SCHEMA TYPES - Frontend Type Definitions
 * ============================================================================
 *
 * Type definitions for database-driven entity schemas.
 * These types match the backend schema builder service output.
 */

export interface FormatSpecification {
  type: 'text' | 'currency' | 'number' | 'percentage'
      | 'date' | 'datetime' | 'relative-time'
      | 'badge' | 'tags' | 'reference' | 'boolean';

  // Optional config - only include what's needed
  settingsDatalabel?: string;   // For badge type
  entityType?: string;          // For reference type
  dateFormat?: string;          // For date type
}

export interface SchemaColumn {
  key: string;
  title: string;
  dataType: string;
  visible: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format: FormatSpecification;
  editable: boolean;
  editType: 'text' | 'number' | 'date' | 'select' | 'tags' | 'boolean' | 'readonly';
  sortable: boolean;
  filterable: boolean;

  // Data source configuration for dropdowns
  dataSource?: {
    type: 'settings';
    datalabel: string;
  };
}

export interface EntitySchema {
  entityType: string;
  tableName: string;
  columns: SchemaColumn[];
}
