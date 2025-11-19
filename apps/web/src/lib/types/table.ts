/**
 * ============================================================================
 * TABLE TYPES - Consolidated Column & Table Type Definitions
 * ============================================================================
 *
 * Single source of truth for all table-related types.
 * Consolidates duplicate Column interfaces from:
 * - EntityDataTable.tsx
 * - DataTableBase.tsx
 * - KanbanBoard.tsx
 * - schema.ts
 */

import type { ReactNode } from 'react';

// ============================================================================
// EDIT TYPES
// ============================================================================

/**
 * All supported edit types for inline editing
 */
export type EditType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'boolean'
  | 'textarea'
  | 'tags'
  | 'jsonb'
  | 'datatable'
  | 'file'
  | 'dag-select'
  | 'readonly';

/**
 * Alignment options
 */
export type Alignment = 'left' | 'center' | 'right';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

// ============================================================================
// FORMAT TYPES
// ============================================================================

/**
 * Format type for display rendering
 */
export type FormatType =
  | 'text'
  | 'currency'
  | 'number'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'relative-time'
  | 'badge'
  | 'tags'
  | 'reference'
  | 'boolean';

/**
 * Format specification for schema-driven rendering
 */
export interface FormatSpecification {
  type: FormatType;
  settingsDatalabel?: string;   // For badge type
  entityCode?: string;          // For reference type
  dateFormat?: string;          // For date type
}

// ============================================================================
// DATA SOURCE TYPES
// ============================================================================

/**
 * Data source configuration for dropdowns
 */
export interface DataSourceConfig {
  type: 'settings' | 'entity' | 'static';
  datalabel?: string;          // For settings type
  entityCode?: string;         // For entity type
  options?: Array<{ value: string; label: string }>; // For static type
}

// ============================================================================
// BASE COLUMN (Minimal Interface)
// ============================================================================

/**
 * Base column interface - minimal properties all columns must have
 */
export interface BaseColumn {
  key: string;
  title: string;
  width?: string | number;
  align?: Alignment;
  sortable?: boolean;
  filterable?: boolean;
  visible?: boolean;
}

// ============================================================================
// UI COLUMN (For EntityDataTable, SettingsDataTable)
// ============================================================================

/**
 * UI Column - extends BaseColumn with rendering and editing capabilities
 * Used by EntityDataTable and SettingsDataTable components
 */
export interface UIColumn extends BaseColumn {
  /**
   * Custom render function for display mode
   */
  render?: (value: any, record: any, data: any[]) => ReactNode;

  /**
   * Whether this column is editable
   */
  editable?: boolean;

  /**
   * Edit type for inline editing
   */
  editType?: EditType;

  /**
   * Load options from settings API
   */
  loadOptionsFromSettings?: boolean;

  /**
   * Searchable in global search
   */
  searchable?: boolean;

  /**
   * Inline editable (legacy, use editable instead)
   * @deprecated Use editable instead
   */
  inlineEditable?: boolean;

  /**
   * Static options for select/multiselect
   */
  options?: Array<{ value: string; label: string; colorCode?: string }>;
}

// ============================================================================
// SCHEMA COLUMN (From API Schema Builder)
// ============================================================================

/**
 * Schema Column - returned by API schema builder
 * Database-driven column definition
 */
export interface SchemaColumn extends BaseColumn {
  /**
   * Database data type
   */
  dataType: string;

  /**
   * Format specification for display
   */
  format: FormatSpecification;

  /**
   * Whether column is editable
   */
  editable: boolean;

  /**
   * Edit type for inline editing
   */
  editType: EditType;

  /**
   * Data source configuration
   */
  dataSource?: DataSourceConfig;
}

// ============================================================================
// ENTITY SCHEMA (Complete Schema Response)
// ============================================================================

/**
 * Complete entity schema response from API
 */
export interface EntitySchema {
  entityCode: string;
  tableName: string;
  columns: SchemaColumn[];
}

// ============================================================================
// ROW ACTION (Action Buttons)
// ============================================================================

/**
 * Row action configuration for action buttons
 */
export interface RowAction<T = any> {
  label: string;
  icon?: ReactNode;
  onClick: (record: T) => void;
  show?: (record: T) => boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

// ============================================================================
// TABLE STATE
// ============================================================================

/**
 * Table sort state
 */
export interface TableSortState {
  field: string;
  direction: SortDirection;
}

/**
 * Table filter state
 */
export interface TableFilterState {
  [columnKey: string]: any;
}

/**
 * Table pagination state
 */
export interface TablePaginationState {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if column is a SchemaColumn
 */
export function isSchemaColumn(column: any): column is SchemaColumn {
  return (
    column &&
    typeof column.key === 'string' &&
    typeof column.dataType === 'string' &&
    column.format &&
    typeof column.format.type === 'string'
  );
}

/**
 * Check if column is a UIColumn
 */
export function isUIColumn(column: any): column is UIColumn {
  return (
    column &&
    typeof column.key === 'string' &&
    typeof column.title === 'string' &&
    (column.render !== undefined || column.editable !== undefined)
  );
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract record type from column definition
 */
export type RecordType<T extends BaseColumn> = Record<T['key'], any>;

/**
 * Column configuration options
 */
export interface ColumnOptions {
  defaultSort?: TableSortState;
  defaultVisibility?: boolean;
  resizable?: boolean;
  reorderable?: boolean;
}
