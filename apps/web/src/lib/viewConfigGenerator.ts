/**
 * ============================================================================
 * VIEW CONFIG GENERATOR - Central Config for All Views
 * ============================================================================
 *
 * ONE source of truth (universalFieldDetector) → ALL views
 *
 * Generates configs for:
 * 1. DataTable (EntityDataTable, SettingsDataTable)
 * 2. EntityFormContainer (forms, detail pages)
 * 3. KanbanBoard (task boards, status columns)
 * 4. DAGVisualizer (workflow stages, funnels)
 *
 * ALL views share SAME detection logic, guaranteed consistency
 */

import { detectField, UniversalFieldMetadata } from './universalFieldDetector';
import type { ColumnDef as TanStackColumn } from '@tanstack/react-table';
import React from 'react';

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface ViewConfig {
  fields: UniversalFieldMetadata[];
  dataTable: DataTableConfig;
  form: FormConfig;
  kanban?: KanbanConfig;
  dag?: DAGConfig;
}

// ============================================================================
// DATA TABLE CONFIG
// ============================================================================

export interface DataTableColumn {
  key: string;
  title: string;
  visible: boolean;
  sortable: boolean;
  filterable: boolean;
  searchable: boolean;
  width: string;
  align: 'left' | 'center' | 'right';
  render: (value: any, record: any) => React.ReactNode;

  // Inline editing
  editable: boolean;
  editType?: 'text' | 'select' | 'checkbox' | 'currency' | 'tags' | 'jsonb';

  // Options
  loadFromSettings?: boolean;
  loadFromEntity?: string;
}

export interface DataTableConfig {
  columns: DataTableColumn[];
  visibleColumns: DataTableColumn[];      // Only visible=true columns
  hiddenColumns: string[];                // Column keys that are hidden
  editableColumns: DataTableColumn[];     // Only editable=true columns
  searchableFields: string[];             // Fields to include in search
}

/**
 * Generate DataTable configuration
 *
 * @example
 * const config = generateDataTableConfig(['name', 'budget_allocated_amt', 'dl__project_stage']);
 * <EntityDataTable columns={config.visibleColumns} />
 */
export function generateDataTableConfig(
  fieldKeys: string[],
  dataTypes?: Record<string, string>
): DataTableConfig {
  const allColumns: DataTableColumn[] = [];
  const visibleColumns: DataTableColumn[] = [];
  const hiddenColumns: string[] = [];
  const editableColumns: DataTableColumn[] = [];
  const searchableFields: string[] = [];

  fieldKeys.forEach(key => {
    const meta = detectField(key, dataTypes?.[key]);

    const column: DataTableColumn = {
      key,
      title: meta.fieldName,
      visible: meta.visible,
      sortable: meta.sortable,
      filterable: meta.filterable,
      searchable: meta.searchable,
      width: meta.width,
      align: meta.align,
      render: meta.format,
      editable: meta.editable,
      editType: meta.editType,
      loadFromSettings: meta.loadFromSettings,
      loadFromEntity: meta.loadFromEntity
    };

    allColumns.push(column);

    if (meta.visible) {
      visibleColumns.push(column);
    } else {
      hiddenColumns.push(key);
    }

    if (meta.editable) {
      editableColumns.push(column);
    }

    if (meta.searchable) {
      searchableFields.push(key);
    }
  });

  // Auto-generate *_name columns for hidden *_id foreign keys
  const additionalColumns: DataTableColumn[] = [];
  hiddenColumns.forEach(hiddenKey => {
    if (hiddenKey.endsWith('_id') && hiddenKey !== 'id') {
      const nameKey = hiddenKey.replace(/_id$/, '_name');
      // Only add if not already in field list
      if (!fieldKeys.includes(nameKey)) {
        const nameMeta = detectField(nameKey);
        const nameColumn: DataTableColumn = {
          key: nameKey,
          title: nameMeta.fieldName,
          visible: true,
          sortable: true,
          filterable: true,
          searchable: true,
          width: '200px',
          align: 'left',
          render: (v) => v || '-',
          editable: false, // Name columns are computed, not directly editable
          loadFromEntity: hiddenKey.replace(/_id$/, '')
        };
        additionalColumns.push(nameColumn);
        visibleColumns.push(nameColumn);
      }
    }
  });

  return {
    columns: [...allColumns, ...additionalColumns],
    visibleColumns,
    hiddenColumns,
    editableColumns,
    searchableFields
  };
}

// ============================================================================
// FORM CONFIG
// ============================================================================

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'time' |
        'select' | 'multiselect' | 'checkbox' | 'textarea' | 'richtext' |
        'tags' | 'jsonb' | 'file' | 'dag-select' | 'readonly';
  component?: 'DAGVisualizer' | 'MetadataTable' | 'TagsInput' | 'DateRangeVisualizer' |
              'FileUpload' | 'RichTextEditor' | 'SearchableMultiSelect';

  required?: boolean;
  editable: boolean;
  visible: boolean;

  // Options
  loadFromSettings?: boolean;
  loadFromEntity?: string;

  // Transformers
  toApi: (value: any) => any;
  toDisplay: (value: any) => any;

  // Validation
  placeholder?: string;
  helpText?: string;
}

export interface FormConfig {
  fields: FormField[];
  editableFields: FormField[];     // Only editable fields
  visibleFields: FormField[];      // Only visible fields
  requiredFields: string[];        // Required field keys
  systemFields: string[];          // System fields (id, timestamps)
}

/**
 * Generate Form configuration
 *
 * @example
 * const config = generateFormConfig(['name', 'budget_allocated_amt', 'dl__project_stage']);
 * <EntityFormContainer fields={config.visibleFields} />
 */
export function generateFormConfig(
  fieldKeys: string[],
  dataTypes?: Record<string, string>,
  requiredFields?: string[]
): FormConfig {
  const fields: FormField[] = [];
  const editableFields: FormField[] = [];
  const visibleFields: FormField[] = [];
  const required: string[] = requiredFields || [];
  const systemFields: string[] = [];

  fieldKeys.forEach(key => {
    const meta = detectField(key, dataTypes?.[key]);

    const field: FormField = {
      key,
      label: meta.fieldName,
      type: meta.inputType,
      component: meta.component,
      required: required.includes(key),
      editable: meta.editable,
      visible: meta.pattern !== 'SYSTEM' || key === 'id', // Show id but not other system fields
      loadFromSettings: meta.loadFromSettings,
      loadFromEntity: meta.loadFromEntity,
      toApi: meta.toApi,
      toDisplay: meta.toDisplay
    };

    fields.push(field);

    if (meta.editable) {
      editableFields.push(field);
    }

    if (field.visible) {
      visibleFields.push(field);
    }

    if (meta.pattern === 'SYSTEM') {
      systemFields.push(key);
    }
  });

  return {
    fields,
    editableFields,
    visibleFields,
    requiredFields: required,
    systemFields
  };
}

// ============================================================================
// KANBAN CONFIG
// ============================================================================

export interface KanbanConfig {
  groupByField: string;              // Field to group by (e.g., 'dl__task_stage', 'status')
  groupByFieldLabel: string;         // Display name
  loadColumnsFrom?: 'settings' | 'entity'; // Where to load column options

  cardFields: FormField[];           // Fields to display on cards
  cardTitleField: string;            // Primary field for card title (usually 'name')

  allowDragDrop: boolean;            // Can drag cards between columns?
  allowAddCard: boolean;             // Show "Add Card" button?
}

/**
 * Generate Kanban board configuration
 *
 * Automatically detects:
 * - Group-by field (dl__*_stage, dl__*_status, status)
 * - Card fields (visible, non-system fields)
 * - Card title field (name, code, or first text field)
 *
 * @example
 * const config = generateKanbanConfig(['name', 'dl__task_stage', 'assignee_name', 'priority']);
 * <KanbanBoard config={config} />
 */
export function generateKanbanConfig(
  fieldKeys: string[],
  dataTypes?: Record<string, string>,
  explicitGroupBy?: string
): KanbanConfig | null {
  // Detect group-by field
  let groupByField = explicitGroupBy;

  if (!groupByField) {
    // Auto-detect: dl__*_stage > dl__*_status > status > *_status
    groupByField = fieldKeys.find(k =>
      k.startsWith('dl__') && (k.includes('stage') || k.includes('status'))
    ) || fieldKeys.find(k => k === 'status' || k.endsWith('_status'));
  }

  if (!groupByField) {
    return null; // No suitable group-by field found
  }

  const groupByMeta = detectField(groupByField);

  // Generate card fields (visible, non-system fields)
  const formConfig = generateFormConfig(fieldKeys, dataTypes);
  const cardFields = formConfig.visibleFields.filter(f =>
    f.key !== groupByField && // Don't show group-by field on card
    f.key !== 'id' &&
    !f.key.includes('created') &&
    !f.key.includes('updated')
  );

  // Detect card title field
  const cardTitleField = fieldKeys.find(k => k === 'name' || k === 'title') ||
                         fieldKeys.find(k => k === 'code') ||
                         cardFields[0]?.key || 'id';

  return {
    groupByField,
    groupByFieldLabel: groupByMeta.fieldName,
    loadColumnsFrom: groupByMeta.loadFromSettings ? 'settings' : undefined,
    cardFields,
    cardTitleField,
    allowDragDrop: groupByMeta.editable,
    allowAddCard: true
  };
}

// ============================================================================
// DAG CONFIG
// ============================================================================

export interface DAGConfig {
  stageField: string;                // Field containing stage/funnel value
  stageFieldLabel: string;           // Display name
  loadNodesFrom: 'settings';         // Always from settings for DAG fields
  datalabel: string;                 // Datalabel key (e.g., 'dl__project_stage')

  allowTransition: boolean;          // Can user change stage?
  showDropdown: boolean;             // Show dropdown below DAG?
}

/**
 * Generate DAG visualizer configuration
 *
 * Only applicable for dl__*_stage or dl__*_funnel fields
 *
 * @example
 * const config = generateDAGConfig(['name', 'dl__project_stage']);
 * if (config) <DAGVisualizer config={config} />
 */
export function generateDAGConfig(
  fieldKeys: string[],
  explicitStageField?: string
): DAGConfig | null {
  // Detect stage/funnel field
  let stageField = explicitStageField;

  if (!stageField) {
    stageField = fieldKeys.find(k =>
      k.startsWith('dl__') && (k.includes('stage') || k.includes('funnel'))
    );
  }

  if (!stageField) {
    return null; // No DAG field found
  }

  const stageMeta = detectField(stageField);

  return {
    stageField,
    stageFieldLabel: stageMeta.fieldName,
    loadNodesFrom: 'settings',
    datalabel: stageField, // dl__project_stage
    allowTransition: stageMeta.editable,
    showDropdown: true
  };
}

// ============================================================================
// UNIFIED VIEW CONFIG GENERATOR
// ============================================================================

/**
 * Generate ALL view configs from one set of field keys
 *
 * ONE call returns configs for:
 * - DataTable
 * - Form
 * - Kanban (if applicable)
 * - DAG (if applicable)
 *
 * @example
 * const config = generateViewConfig(['name', 'budget_allocated_amt', 'dl__task_stage']);
 *
 * // Use in different views:
 * <EntityDataTable columns={config.dataTable.visibleColumns} />
 * <EntityFormContainer fields={config.form.visibleFields} />
 * <KanbanBoard config={config.kanban} />
 * <DAGVisualizer config={config.dag} />
 */
export function generateViewConfig(
  fieldKeys: string[],
  options?: {
    dataTypes?: Record<string, string>;
    requiredFields?: string[];
    kanbanGroupBy?: string;
    dagStageField?: string;
  }
): ViewConfig {
  const opts = options || {};

  // Detect all field metadata
  const fields = fieldKeys.map(key => detectField(key, opts.dataTypes?.[key]));

  // Generate view-specific configs
  const dataTable = generateDataTableConfig(fieldKeys, opts.dataTypes);
  const form = generateFormConfig(fieldKeys, opts.dataTypes, opts.requiredFields);
  const kanban = generateKanbanConfig(fieldKeys, opts.dataTypes, opts.kanbanGroupBy);
  const dag = generateDAGConfig(fieldKeys, opts.dagStageField);

  return {
    fields,
    dataTable,
    form,
    kanban: kanban || undefined,
    dag: dag || undefined
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Generate config from entity config object
 *
 * Extracts field keys from entity config and generates all view configs
 */
export function generateViewConfigFromEntity(entityConfig: {
  fields: Array<{ key: string; type?: string; required?: boolean }>;
  kanbanGroupBy?: string;
  dagStageField?: string;
}): ViewConfig {
  const fieldKeys = entityConfig.fields.map(f => f.key);
  const dataTypes: Record<string, string> = {};
  const requiredFields: string[] = [];

  entityConfig.fields.forEach(f => {
    if (f.type) {
      dataTypes[f.key] = f.type;
    }
    if (f.required) {
      requiredFields.push(f.key);
    }
  });

  return generateViewConfig(fieldKeys, {
    dataTypes,
    requiredFields,
    kanbanGroupBy: entityConfig.kanbanGroupBy,
    dagStageField: entityConfig.dagStageField
  });
}

/**
 * Quick column generator for simple tables
 */
export function quickColumns(fieldKeys: string[]): DataTableColumn[] {
  return generateDataTableConfig(fieldKeys).visibleColumns;
}

/**
 * Quick form fields generator
 */
export function quickFormFields(fieldKeys: string[]): FormField[] {
  return generateFormConfig(fieldKeys).visibleFields;
}
