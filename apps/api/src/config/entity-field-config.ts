/**
 * ============================================================================
 * ENTITY FIELD CONFIGURATION
 * ============================================================================
 *
 * PURPOSE:
 * Explicit field configuration that OVERRIDES pattern detection.
 * This prevents silent failures when column names deviate from conventions.
 *
 * USAGE:
 * The Entity Component Metadata Service checks this config FIRST before falling back
 * to pattern detection. If a field is defined here, its config takes precedence.
 *
 * WHEN TO USE THIS CONFIG:
 * 1. Non-standard column names (e.g., 'priceUSD' instead of 'price_amt')
 * 2. Fields that need special formatting not detectable by pattern
 * 3. Override default visibility or alignment
 * 4. Entity-specific field behavior
 *
 * FIELD CONFIG SCHEMA:
 * {
 *   renderType: 'currency' | 'date' | 'timestamp' | 'boolean' | 'badge' | 'reference' | 'json' | 'progress-bar' | 'text',
 *   inputType: 'currency' | 'date' | 'datetime' | 'checkbox' | 'select' | 'reference' | 'json' | 'text' | 'textarea',
 *   format?: { symbol?: string; decimals?: number; locale?: string }, // for currency
 *   loadFromEntity?: string,       // for reference types (datalabels detected by pattern-mapping.yaml)
 *   visible?: { EntityListOfInstancesTable?: boolean; EntityDetailView?: boolean; EntityInstanceFormContainer?: boolean; KanbanView?: boolean; CalendarView?: boolean },
 *   editable?: boolean,
 *   align?: 'left' | 'center' | 'right',
 *   width?: string,
 * }
 *
 * ============================================================================
 */

export interface FieldConfig {
  renderType?: 'currency' | 'date' | 'timestamp' | 'boolean' | 'badge' | 'reference' | 'json' | 'progress-bar' | 'text' | 'percentage' | 'number';
  inputType?: 'currency' | 'date' | 'datetime' | 'checkbox' | 'select' | 'reference' | 'json' | 'text' | 'textarea' | 'number' | 'percentage';
  format?: {
    symbol?: string;
    decimals?: number;
    locale?: string;
  };
  // v8.3.2: Datalabels detected by pattern-mapping.yaml (dl__* pattern), no explicit flag needed
  loadFromEntity?: string;
  visible?: {
    EntityListOfInstancesTable?: boolean;
    EntityDetailView?: boolean;
    EntityInstanceFormContainer?: boolean;
    KanbanView?: boolean;
    CalendarView?: boolean;
  };
  editable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  label?: string;  // Override auto-generated label
}

export type EntityFieldConfig = Record<string, FieldConfig>;
export type AllEntityFieldConfig = Record<string, EntityFieldConfig>;

/**
 * Explicit field configuration per entity
 *
 * Fields defined here take PRECEDENCE over pattern detection.
 * Only include fields that need explicit config - let pattern detection
 * handle standard naming conventions.
 */
export const ENTITY_FIELD_CONFIG: AllEntityFieldConfig = {
  // ============================================================================
  // PROJECT ENTITY
  // ============================================================================
  project: {
    // Example: Non-standard currency field name
    // 'total_value': {
    //   renderType: 'currency',
    //   inputType: 'currency',
    //   format: { symbol: '$', decimals: 2 },
    //   align: 'right',
    // },

    // Example: Override visibility for specific field
    // 'internal_notes': {
    //   visible: {
    //     EntityListOfInstancesTable: false,
    //     EntityDetailView: true,
    //     EntityInstanceFormContainer: true,
    //   },
    //   editable: true,
    // },
  },

  // ============================================================================
  // TASK ENTITY
  // ============================================================================
  task: {
    // Fields with explicit config here override pattern detection
  },

  // ============================================================================
  // EMPLOYEE ENTITY
  // ============================================================================
  employee: {
    // Example: Reference field with non-standard name
    // 'reports_to': {
    //   renderType: 'reference',
    //   inputType: 'reference',
    //   loadFromEntity: 'employee',
    // },
  },

  // ============================================================================
  // OFFICE ENTITY
  // ============================================================================
  office: {
    // Fields with explicit config here override pattern detection
  },

  // ============================================================================
  // BUSINESS ENTITY
  // ============================================================================
  business: {
    // Fields with explicit config here override pattern detection
  },

  // ============================================================================
  // REVENUE ENTITY
  // ============================================================================
  revenue: {
    // All _amt fields are auto-detected, but you can override here
  },

  // ============================================================================
  // EXPENSE ENTITY
  // ============================================================================
  expense: {
    // All _amt fields are auto-detected, but you can override here
  },
};

/**
 * Get field config for a specific entity and field
 *
 * @param entityCode Entity type code (e.g., 'project')
 * @param fieldName Column name (e.g., 'budget_allocated_amt')
 * @returns Field config if explicitly defined, undefined otherwise
 */
export function getFieldConfig(entityCode: string, fieldName: string): FieldConfig | undefined {
  const entityConfig = ENTITY_FIELD_CONFIG[entityCode];
  if (!entityConfig) return undefined;
  return entityConfig[fieldName];
}

/**
 * Check if a field has explicit config (before pattern detection)
 *
 * @param entityCode Entity type code
 * @param fieldName Column name
 * @returns true if field has explicit config
 */
export function hasExplicitConfig(entityCode: string, fieldName: string): boolean {
  return getFieldConfig(entityCode, fieldName) !== undefined;
}

/**
 * Get all explicitly configured fields for an entity
 *
 * @param entityCode Entity type code
 * @returns Record of field configs, or empty object
 */
export function getEntityFieldConfigs(entityCode: string): EntityFieldConfig {
  return ENTITY_FIELD_CONFIG[entityCode] || {};
}
