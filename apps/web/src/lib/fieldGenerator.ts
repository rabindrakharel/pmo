/**
 * Centralized Field Generation System
 *
 * Auto-generates field definitions for entity forms using convention-based
 * patterns and the Field Category Registry.
 *
 * DRY Principle: Universal fields (metadata, created_ts, updated_ts) and
 * convention-based fields (*_amt, *_name, *_email, *_date, etc.) are
 * generated automatically from centralized definitions.
 *
 * Eliminates 100+ repetitive field definitions across 18+ entities.
 */

import type { FieldDef } from './entityConfig';

// ============================================================================
// Universal Fields (appear on ALL entities)
// ============================================================================

/**
 * Get universal fields that appear on all entities
 * These fields are always at the END of the field list
 */
export function getUniversalFields(): FieldDef[] {
  return [
    {
      key: 'metadata',
      label: 'Metadata',
      type: 'jsonb'
    },
    {
      key: 'created_ts',
      label: 'Created',
      type: 'timestamp',
      readonly: true
    },
    {
      key: 'updated_ts',
      label: 'Updated',
      type: 'timestamp',
      readonly: true
    }
  ];
}

// ============================================================================
// Field Generation from Category Patterns
// ============================================================================

/**
 * Generate field label from field key
 * Examples:
 *   budget_allocated_amt -> Budget Allocated
 *   customer_email -> Customer Email
 *   dl__project_stage -> Project Stage
 */
function generateFieldLabel(key: string): string {
  // Remove common suffixes for cleaner labels
  let label = key
    .replace(/_amt$/, '')
    .replace(/_flag$/, '')
    .replace(/_ts$/, '')
    .replace(/_date$/, '')
    .replace(/_email$/, '')
    .replace(/_phone$/, '')
    .replace(/_name$/, '')
    .replace(/^dl__/, '');

  // Convert snake_case to Title Case
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Detect field type from field key suffix
 */
function detectFieldType(key: string): FieldDef['type'] {
  if (key.endsWith('_amt') || key.endsWith('_amount')) return 'number';
  if (key.endsWith('_date')) return 'date';
  if (key.endsWith('_ts') || key.endsWith('_timestamp')) return 'timestamp';
  if (key.endsWith('_email')) return 'text';
  if (key.endsWith('_phone')) return 'text';
  if (key.endsWith('_flag')) return 'select';
  if (key.startsWith('dl__')) return 'select';
  if (key === 'descr' || key === 'description') return 'richtext';
  if (key === 'metadata' || key === 'attr' || key.endsWith('_json')) return 'jsonb';
  if (key.endsWith('_ids') || key === 'tags') return 'array';
  return 'text';
}

/**
 * Get special field properties based on conventions
 */
function getFieldProperties(key: string): Partial<FieldDef> {
  const properties: Partial<FieldDef> = {};

  // Boolean flags should have Yes/No options
  if (key.endsWith('_flag')) {
    properties.options = [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' }
    ];
    properties.coerceBoolean = true;
  }

  // Datalabel fields should load from settings
  if (key.startsWith('dl__')) {
    properties.loadOptionsFromSettings = true;
  }

  // Readonly fields
  if (key.endsWith('_ts') || key === 'created_ts' || key === 'updated_ts') {
    properties.readonly = true;
  }

  // Required fields (common conventions)
  if (key === 'name' || key === 'code') {
    properties.required = true;
  }

  return properties;
}

/**
 * Generate a single field definition from a field key
 * Uses conventions to automatically detect type, label, and special properties
 *
 * @param key - Field key (e.g., 'budget_allocated_amt', 'customer_email')
 * @param overrides - Override any auto-generated properties
 */
export function generateField(
  key: string,
  overrides: Partial<FieldDef> = {}
): FieldDef {
  const type = overrides.type || detectFieldType(key);
  const label = overrides.label || generateFieldLabel(key);
  const properties = getFieldProperties(key);

  return {
    key,
    label,
    type,
    ...properties,
    ...overrides
  } as FieldDef;
}

/**
 * Generate multiple field definitions from field keys
 *
 * @param fieldKeys - Array of field keys
 * @param overrides - Override properties for specific fields
 */
export function generateFields(
  fieldKeys: string[],
  overrides: Record<string, Partial<FieldDef>> = {}
): FieldDef[] {
  return fieldKeys.map(key => generateField(key, overrides[key]));
}

/**
 * Generate entity fields with universal fields automatically appended
 * This is the main function to use for entity configurations
 *
 * @param entityFields - Entity-specific field keys
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * fields: generateEntityFields(
 *   ['name', 'code', 'descr', 'budget_allocated_amt', 'customer_email'],
 *   {
 *     overrides: {
 *       budget_allocated_amt: { label: 'Budget', placeholder: '0.00' }
 *     }
 *   }
 * )
 * ```
 */
export function generateEntityFields(
  entityFields: string[],
  options: {
    /** Override properties for specific fields */
    overrides?: Record<string, Partial<FieldDef>>;
    /** Include universal fields (metadata, created_ts, updated_ts)? Default: true */
    includeUniversal?: boolean;
  } = {}
): FieldDef[] {
  const { overrides = {}, includeUniversal = true } = options;

  const fields = generateFields(entityFields, overrides);

  if (includeUniversal) {
    return [...fields, ...getUniversalFields()];
  }

  return fields;
}

// ============================================================================
// Common Field Patterns (Pre-built helpers)
// ============================================================================

/**
 * Generate common entity fields (name, code, descr)
 */
export function getStandardEntityFields(options: {
  nameRequired?: boolean;
  codeRequired?: boolean;
  descrType?: 'textarea' | 'richtext';
} = {}): FieldDef[] {
  const { nameRequired = true, codeRequired = true, descrType = 'richtext' } = options;

  return [
    { key: 'name', label: 'Name', type: 'text', required: nameRequired },
    { key: 'code', label: 'Code', type: 'text', required: codeRequired },
    { key: 'descr', label: 'Description', type: descrType }
  ];
}

/**
 * Generate boolean flag field (Yes/No select)
 */
export function getBooleanField(key: string, label?: string): FieldDef {
  return {
    key,
    label: label || generateFieldLabel(key),
    type: 'select',
    options: [
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' }
    ],
    coerceBoolean: true
  };
}

/**
 * Generate datalabel field (loads from settings)
 */
export function getDatalabelField(key: string, label?: string): FieldDef {
  return {
    key,
    label: label || generateFieldLabel(key),
    type: 'select',
    loadOptionsFromSettings: true
  };
}

/**
 * Generate amount field
 */
export function getAmountField(key: string, label?: string, placeholder: string = '0.00'): FieldDef {
  return {
    key,
    label: label || generateFieldLabel(key),
    type: 'number',
    placeholder
  };
}

/**
 * Generate email field
 */
export function getEmailField(key: string, label?: string): FieldDef {
  return {
    key,
    label: label || generateFieldLabel(key),
    type: 'text',
    placeholder: 'user@example.com'
  };
}

/**
 * Generate phone field
 */
export function getPhoneField(key: string, label?: string): FieldDef {
  return {
    key,
    label: label || generateFieldLabel(key),
    type: 'text',
    placeholder: '(123) 456-7890'
  };
}

/**
 * Generate date field
 */
export function getDateField(key: string, label?: string): FieldDef {
  return {
    key,
    label: label || generateFieldLabel(key),
    type: 'date'
  };
}
