/**
 * Field Capabilities Detection System
 *
 * CENTRAL CONFIG-DRIVEN SYSTEM for determining field capabilities
 * based on metadata, following TRUE DRY principles and Convention over Configuration.
 *
 * This is the SINGLE SOURCE OF TRUTH that determines:
 * - Which fields can be inline edited
 * - What type of editor to use (text, select, file, etc.)
 * - How to transform data for that field
 *
 * NO manual flags needed in entityConfig - everything is auto-detected!
 */

import type { ColumnDef, FieldDef } from './entityConfig';

/**
 * Field capability metadata determined from configuration
 */
export interface FieldCapability {
  inlineEditable: boolean;
  editType: 'text' | 'select' | 'tags' | 'file' | 'number' | 'date' | 'readonly';
  loadOptionsFromSettings?: boolean;
  settingsCategory?: string;
  acceptedFileTypes?: string;
  isFileUpload: boolean;
}

/**
 * Field naming patterns that indicate specific types
 */
const FIELD_PATTERNS = {
  // Tags fields - always editable as comma-separated text
  tags: /^tags$|_tags$/i,

  // Standardized attachment fields - editable with drag-drop upload
  // Primary pattern: "attachment" field (main S3 URI)
  // Supporting fields: attachment_format, attachment_size_bytes, attachment_object_bucket, attachment_object_key
  file: /^attachment$|attachment_object_key$/i,

  // Settings/data label fields - identified by _name suffix and loadOptionsFromSettings
  settingsField: /_name$|_id$|_level$|_stage$|_status$|_tier$|_priority$|_type$/i,

  // Readonly fields - system fields that should never be edited inline
  readonly: /^(id|created_ts|updated_ts|created_by|updated_by|version|from_ts|to_ts)$/i,

  // Date fields
  date: /_(date|ts)$|^date_/i,

  // Number fields
  number: /_(amount|count|qty|quantity|price|cost|revenue|id|level_id|stage_id|sort_order)$/i
};

/**
 * CENTRAL FUNCTION: Determines if a field can be inline edited
 * This is the SINGLE SOURCE OF TRUTH - no manual flags needed!
 *
 * Convention over Configuration:
 * - Tags fields: Auto-editable as text
 * - Settings fields (loadOptionsFromSettings): Auto-editable as dropdown
 * - File fields: Auto-editable with drag-drop
 * - Readonly patterns: Never editable
 * - Everything else: Check explicit configuration
 */
export function getFieldCapability(column: ColumnDef | FieldDef): FieldCapability {
  const key = column.key;

  // Rule 1: Readonly fields are NEVER editable
  if (FIELD_PATTERNS.readonly.test(key)) {
    return {
      inlineEditable: false,
      editType: 'readonly',
      isFileUpload: false
    };
  }

  // Rule 2: Tags fields are ALWAYS editable as text (comma-separated)
  if (FIELD_PATTERNS.tags.test(key)) {
    return {
      inlineEditable: true,
      editType: 'tags',
      isFileUpload: false
    };
  }

  // Rule 3: File/attachment fields are ALWAYS editable with drag-drop
  if (FIELD_PATTERNS.file.test(key)) {
    return {
      inlineEditable: true,
      editType: 'file',
      isFileUpload: true,
      acceptedFileTypes: getAcceptedFileTypes(key)
    };
  }

  // Rule 4: Settings/data label fields with loadOptionsFromSettings are ALWAYS editable as dropdowns
  if (column.loadOptionsFromSettings) {
    return {
      inlineEditable: true,
      editType: 'select',
      loadOptionsFromSettings: true,
      settingsCategory: extractSettingsCategory(key),
      isFileUpload: false
    };
  }

  // Rule 5: Number fields are editable as number inputs
  if (FIELD_PATTERNS.number.test(key) && !FIELD_PATTERNS.readonly.test(key)) {
    return {
      inlineEditable: true,
      editType: 'number',
      isFileUpload: false
    };
  }

  // Rule 6: Date fields are editable as date inputs
  if (FIELD_PATTERNS.date.test(key) && !FIELD_PATTERNS.readonly.test(key)) {
    return {
      inlineEditable: true,
      editType: 'date',
      isFileUpload: false
    };
  }

  // Rule 7: Check for explicit inlineEditable flag (backward compatibility)
  if ('inlineEditable' in column && column.inlineEditable) {
    return {
      inlineEditable: true,
      editType: 'text',
      isFileUpload: false
    };
  }

  // Rule 8: Simple text fields (name, descr, etc.) are editable by default
  // UNLESS they're in a readonly entity or have specific patterns
  const isSimpleTextField = /^(name|descr|description|title|notes|comments?)$/i.test(key);
  if (isSimpleTextField) {
    return {
      inlineEditable: true,
      editType: 'text',
      isFileUpload: false
    };
  }

  // Default: Not editable
  return {
    inlineEditable: false,
    editType: 'readonly',
    isFileUpload: false
  };
}

/**
 * Extracts settings category from field name
 * Examples:
 * - opportunity_funnel_stage_name → opportunity_funnel_stage
 * - customer_tier_name → customer_tier
 * - project_stage → project_stage
 */
function extractSettingsCategory(fieldName: string): string {
  // Remove _name, _id, _level suffixes
  return fieldName
    .replace(/_name$/, '')
    .replace(/_id$/, '')
    .replace(/_level$/, '');
}

/**
 * Determines accepted file types based on field name
 */
function getAcceptedFileTypes(fieldName: string): string {
  if (/invoice/i.test(fieldName)) {
    return 'application/pdf,image/png,image/jpeg';
  }
  if (/receipt/i.test(fieldName)) {
    return 'application/pdf,image/png,image/jpeg';
  }
  if (/(image|photo|avatar)/i.test(fieldName)) {
    return 'image/*';
  }
  if (/document/i.test(fieldName)) {
    return 'application/pdf,.doc,.docx,.txt';
  }
  // Default: allow all common file types
  return '*';
}

/**
 * Batch capability detection for all columns
 * Used by DataTable to determine which columns are editable
 */
export function detectColumnCapabilities(columns: ColumnDef[]): Map<string, FieldCapability> {
  const capabilities = new Map<string, FieldCapability>();

  for (const column of columns) {
    capabilities.set(column.key, getFieldCapability(column));
  }

  return capabilities;
}

/**
 * Check if ANY column in the entity is inline editable
 * Used to determine if we should show edit icons
 */
export function hasAnyEditableColumns(columns: ColumnDef[]): boolean {
  return columns.some(col => getFieldCapability(col).inlineEditable);
}

/**
 * Get all editable column keys for an entity
 */
export function getEditableColumnKeys(columns: ColumnDef[]): string[] {
  return columns
    .filter(col => getFieldCapability(col).inlineEditable)
    .map(col => col.key);
}
