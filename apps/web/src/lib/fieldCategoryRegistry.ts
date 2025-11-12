/**
 * ⚠️ DEPRECATED - LEGACY CODE (v3.x)
 *
 * This file is marked for removal in Entity System v4.0.
 *
 * **Why Deprecated:**
 * - Replaced by universalFieldDetector.ts which uses naming patterns instead of categories
 * - 12 pattern-based rules replace 100+ manual category assignments
 * - Auto-detection eliminates need for centralized registry
 *
 * **Migration Path:**
 * Instead of:
 *   getCategoryProperties('amount') // Manual category lookup
 *
 * Use:
 *   detectField('total_amt') // Auto-detects from naming pattern
 *
 * **See:**
 * - docs/entity_design_pattern/ENTITY_SYSTEM_V4.md
 * - apps/web/src/lib/universalFieldDetector.ts (Pattern-based detection)
 *
 * **Status:** Currently used by columnGenerator.ts (pending migration)
 *
 * ---
 *
 * Field Category Registry - Single Source of Truth
 *
 * This file defines ALL properties for each field category in ONE place:
 * - Width
 * - Alignment
 * - Sortable/Filterable/Searchable behavior
 * - Rendering logic
 * - Special features (dropdowns, badges, etc.)
 *
 * DRY Principle: Each category is defined ONCE, and all fields matching
 * that category automatically inherit ALL its properties.
 */

import React from 'react';

// ============================================================================
// Helper Render Functions (Inline to avoid circular imports)
// ============================================================================

/**
 * Format currency value
 */
function formatCurrency(amount?: number, currency: string = 'CAD'): string {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Render date as friendly format (e.g., "Mar 15, 2025")
 */
function renderDate(value?: string): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(value);
  }
}

/**
 * Render timestamp as relative time (e.g., "3 minutes ago")
 */
function renderTimestamp(value?: string): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return renderDate(value);
  } catch {
    return String(value);
  }
}

// ============================================================================
// Field Categories
// ============================================================================

export enum FieldCategory {
  // Standard entity fields (most common)
  NAME = 'NAME',           // name, title
  CODE = 'CODE',           // code
  DESCR = 'DESCR',         // descr, description

  // Business/financial fields
  AMOUNT = 'AMOUNT',       // *_amt, *_amount
  CURRENCY = 'CURRENCY',   // *_currency
  PERCENTAGE = 'PERCENTAGE', // *_pct, *_percent
  NUMBER = 'NUMBER',       // *_count, *_hours, *_quantity

  // Temporal fields
  DATE = 'DATE',           // *_date
  TIMESTAMP = 'TIMESTAMP', // *_ts, *_timestamp

  // Reference/relationship fields
  LABEL = 'LABEL',         // *_stage, *_status, *_priority, *_level (settings-driven)
  ENTITY_REF = 'ENTITY_REF', // *_employee_id, *_client_id, *_project_id

  // Complex/structured fields
  JSON = 'JSON',           // metadata, attr, *_json
  ARRAY = 'ARRAY',         // tags, *_ids, *_list
  LONG_TEXT = 'LONG_TEXT', // content, notes, body

  // Boolean/flag fields
  BOOLEAN = 'BOOLEAN',     // *_flag, is_*, has_*, can_*

  // Identity/key fields
  ID = 'ID',               // id, *_id (UUID)
  URL = 'URL',             // *_url, *_link
  EMAIL = 'EMAIL',         // *_email

  // Default
  UNKNOWN = 'UNKNOWN'
}

// ============================================================================
// Category Configuration - SINGLE SOURCE OF TRUTH
// ============================================================================

export interface FieldCategoryConfig {
  /** Fixed column width */
  width?: string;

  /** Column alignment */
  align?: 'left' | 'center' | 'right';

  /** Is column sortable? */
  sortable: boolean;

  /** Is column filterable? */
  filterable: boolean;

  /** Is column searchable? */
  searchable: boolean;

  /** Render function for this category */
  render?: (value: any, record: any) => React.ReactNode;

  /** Load options from settings tables? */
  loadOptionsFromSettings?: boolean;

  /** Special features */
  features?: {
    /** Show colored badge */
    colorBadge?: boolean;
    /** Show dropdown in edit mode */
    dropdown?: boolean;
    /** Format as currency */
    currency?: boolean;
    /** Format as relative time */
    relativeTime?: boolean;
    /** Format as friendly date */
    friendlyDate?: boolean;
  };
}

/**
 * FIELD_CATEGORY_REGISTRY
 *
 * This is the SINGLE SOURCE OF TRUTH for all field category configurations.
 * When you want to change how a category behaves, change it HERE and it
 * applies to ALL fields of that category.
 */
export const FIELD_CATEGORY_REGISTRY: Record<FieldCategory, FieldCategoryConfig> = {
  // --------------------------------------------------------------------------
  // Standard Entity Fields
  // --------------------------------------------------------------------------

  [FieldCategory.NAME]: {
    width: '200px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: true,
    render: undefined // Plain text
  },

  [FieldCategory.CODE]: {
    width: '120px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: true,
    render: undefined // Plain text
  },

  [FieldCategory.DESCR]: {
    width: '250px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: true,
    render: undefined // Plain text
  },

  // --------------------------------------------------------------------------
  // Business/Financial Fields
  // --------------------------------------------------------------------------

  [FieldCategory.AMOUNT]: {
    width: '120px',
    align: 'right',
    sortable: true,
    filterable: true,
    searchable: false,
    render: (value: any, record: any) => {
      if (!value && value !== 0) return '-';
      // Try to find currency field in record
      const currencyField = Object.keys(record).find(k => k.includes('_currency'));
      const currency = currencyField ? record[currencyField] : 'CAD';
      return formatCurrency(value, currency);
    },
    features: {
      currency: true
    }
  },

  [FieldCategory.CURRENCY]: {
    width: '100px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: false,
    render: undefined // Plain text (e.g., "CAD", "USD")
  },

  [FieldCategory.PERCENTAGE]: {
    width: '100px',
    align: 'right',
    sortable: true,
    filterable: true,
    searchable: false,
    render: (value: any) => {
      if (!value && value !== 0) return '-';
      return `${value}%`;
    }
  },

  [FieldCategory.NUMBER]: {
    width: '100px',
    align: 'right',
    sortable: true,
    filterable: true,
    searchable: false,
    render: (value: any) => {
      if (!value && value !== 0) return '-';
      return value.toLocaleString();
    }
  },

  // --------------------------------------------------------------------------
  // Temporal Fields
  // --------------------------------------------------------------------------

  [FieldCategory.DATE]: {
    width: '120px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: false,
    render: renderDate,
    features: {
      friendlyDate: true
    }
  },

  [FieldCategory.TIMESTAMP]: {
    width: '150px',
    align: 'left',
    sortable: true,
    filterable: false,
    searchable: false,
    render: renderTimestamp,
    features: {
      relativeTime: true
    }
  },

  // --------------------------------------------------------------------------
  // Reference/Relationship Fields
  // --------------------------------------------------------------------------

  [FieldCategory.LABEL]: {
    width: '130px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: false,
    loadOptionsFromSettings: true,
    render: undefined, // Handled by ColoredDropdown component in DataTable
    features: {
      colorBadge: true,
      dropdown: true
    }
  },

  [FieldCategory.ENTITY_REF]: {
    width: '150px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: false,
    render: undefined // Plain text or custom renderer per entity
  },

  // --------------------------------------------------------------------------
  // Complex/Structured Fields
  // --------------------------------------------------------------------------

  [FieldCategory.JSON]: {
    width: undefined, // Dynamic width
    align: 'left',
    sortable: false,
    filterable: false,
    searchable: false,
    render: (value: any) => {
      if (!value) return '-';
      try {
        const json = typeof value === 'string' ? JSON.parse(value) : value;
        return React.createElement('pre',
          { className: 'text-xs overflow-auto max-h-20' },
          JSON.stringify(json, null, 2)
        );
      } catch {
        return String(value);
      }
    }
  },

  [FieldCategory.ARRAY]: {
    width: undefined, // Dynamic width
    align: 'left',
    sortable: false,
    filterable: false,
    searchable: false,
    render: (value: any) => {
      if (!value) return '-';
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      try {
        const arr = JSON.parse(value);
        return Array.isArray(arr) ? arr.join(', ') : String(value);
      } catch {
        return String(value);
      }
    }
  },

  [FieldCategory.LONG_TEXT]: {
    width: undefined, // Dynamic width
    align: 'left',
    sortable: true,
    filterable: false, // Too large to filter efficiently
    searchable: true,  // But can be searched
    render: (value: any) => {
      if (!value) return '-';
      const text = String(value);
      return text.length > 100 ? `${text.substring(0, 100)}...` : text;
    }
  },

  // --------------------------------------------------------------------------
  // Boolean/Flag Fields
  // --------------------------------------------------------------------------

  [FieldCategory.BOOLEAN]: {
    width: '80px',
    align: 'center',
    sortable: true,
    filterable: true,
    searchable: false,
    render: (value: any) => {
      if (value === null || value === undefined) return '-';
      return value
        ? React.createElement('span', { className: 'text-green-600' }, '✓')
        : React.createElement('span', { className: 'text-dark-600' }, '✗');
    }
  },

  // --------------------------------------------------------------------------
  // Identity/Key Fields
  // --------------------------------------------------------------------------

  [FieldCategory.ID]: {
    width: '300px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: true,
    render: (value: any) => {
      if (!value) return '-';
      const str = String(value);
      // Truncate UUIDs for display
      return str.length > 36 ? `${str.substring(0, 8)}...${str.substring(str.length - 8)}` : str;
    }
  },

  [FieldCategory.URL]: {
    width: '200px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: true,
    render: (value: any) => {
      if (!value) return '-';
      return React.createElement('a',
        {
          href: value,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-dark-700 hover:underline'
        },
        value
      );
    }
  },

  [FieldCategory.EMAIL]: {
    width: '200px',
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: true,
    render: (value: any) => {
      if (!value) return '-';
      return React.createElement('a',
        {
          href: `mailto:${value}`,
          className: 'text-dark-700 hover:underline'
        },
        value
      );
    }
  },

  // --------------------------------------------------------------------------
  // Unknown/Default
  // --------------------------------------------------------------------------

  [FieldCategory.UNKNOWN]: {
    width: undefined,
    align: 'left',
    sortable: true,
    filterable: true,
    searchable: true,
    render: undefined // Plain text
  }
};

// ============================================================================
// Field Category Detection
// ============================================================================

/**
 * Detect field category from field key using naming patterns
 *
 * CENTRAL SEMANTIC PATTERN DETECTION (DRY Principle)
 *
 * This function is the SINGLE SOURCE OF TRUTH for mapping database column names
 * to display formatting categories. It uses semantic patterns to automatically
 * determine how each field should be rendered, sorted, filtered, and edited.
 *
 * Semantic Patterns Covered:
 * - %name, %title → NAME (primary identifier text)
 * - %code → CODE (entity code/reference)
 * - %descr, %description → DESCR (long description text)
 * - dl__% → LABEL (datalabel/settings-driven dropdown)
 * - %_level, %_tier, %_rank, %_grade → LABEL (hierarchical classification)
 * - %_stage, %_status, %_priority → LABEL (workflow states)
 * - %_amt, %_amount, %_price, %_cost → AMOUNT (currency values)
 * - %_ts, %_timestamp, %_time → TIMESTAMP (datetime with relative time)
 * - %_date → DATE (date only, friendly format)
 * - %_flag, is_%, has_%, can_% → BOOLEAN (true/false toggles)
 * - metadata, attr, %_json, %_jsonb → JSON (structured data)
 * - tags, %_ids, %_list, %_array → ARRAY (collections)
 * - %_count, %_hours, %_qty, %_quantity, %_number → NUMBER (numeric values)
 * - %_pct, %_percent, %_percentage → PERCENTAGE (0-100 values)
 * - %_url, %_link → URL (clickable links)
 * - %_email → EMAIL (mailto links)
 * - %_id (entity references) → ENTITY_REF (foreign keys)
 *
 * This ensures ALL database columns automatically get proper formatting
 * without manual configuration in entity configs.
 */
export function detectFieldCategory(fieldKey: string): FieldCategory {
  const key = fieldKey.toLowerCase();

  // =========================================================================
  // STANDARD ENTITY FIELDS (Highest Priority)
  // =========================================================================

  if (key === 'name' || key === 'title' || key.endsWith('_name') || key.endsWith('_title')) {
    return FieldCategory.NAME;
  }

  if (key === 'code' || key.endsWith('_code')) {
    return FieldCategory.CODE;
  }

  if (key === 'descr' || key === 'description' || key.endsWith('_descr') || key.endsWith('_description')) {
    return FieldCategory.DESCR;
  }

  // =========================================================================
  // TEMPORAL FIELDS (Date/Time)
  // =========================================================================

  // Timestamps: created_ts, updated_ts, scheduled_ts, etc.
  if (key.endsWith('_ts') || key.endsWith('_timestamp') || key.endsWith('_time')) {
    return FieldCategory.TIMESTAMP;
  }

  // Dates: start_date, end_date, birth_date, etc.
  if (key.endsWith('_date')) {
    return FieldCategory.DATE;
  }

  // =========================================================================
  // BUSINESS/FINANCIAL FIELDS (Money & Numbers)
  // =========================================================================

  // Currency amounts: budget_amt, price_amt, total_amount, cost, revenue, etc.
  if (key.endsWith('_amt') || key.endsWith('_amount') ||
      key.endsWith('_price') || key.endsWith('_cost') ||
      key.endsWith('_revenue') || key.endsWith('_fee') ||
      key.includes('budget_') || key.includes('salary_')) {
    return FieldCategory.AMOUNT;
  }

  // Currency codes: currency, budget_currency, etc.
  if (key === 'currency' || key.endsWith('_currency')) {
    return FieldCategory.CURRENCY;
  }

  // Percentages: completion_pct, tax_rate, discount_percent, etc.
  if (key.endsWith('_pct') || key.endsWith('_percent') ||
      key.endsWith('_percentage') || key.endsWith('_rate')) {
    return FieldCategory.PERCENTAGE;
  }

  // Numbers: count, hours, quantity, points, score, etc.
  if (key.endsWith('_count') || key.endsWith('_hours') ||
      key.endsWith('_quantity') || key.endsWith('_qty') ||
      key.endsWith('_number') || key.endsWith('_points') ||
      key.endsWith('_score') || key.endsWith('_size') ||
      key.endsWith('_bytes') || key.endsWith('_total')) {
    return FieldCategory.NUMBER;
  }

  // =========================================================================
  // SETTINGS-DRIVEN LABELS (Dropdowns with color badges)
  // =========================================================================

  // Explicit datalabel fields: dl__project_stage, dl__task_priority, etc.
  // Hierarchical: level, tier, rank, grade, category
  // Workflow: stage, status, priority, phase, step
  // Classification: type, class, sector, channel, segment
  if (key.startsWith('dl__') ||
      key.endsWith('_level') || key.endsWith('_tier') ||
      key.endsWith('_rank') || key.endsWith('_grade') ||
      key.endsWith('_stage') || key.endsWith('_status') ||
      key.endsWith('_priority') || key.endsWith('_phase') ||
      key.endsWith('_step') || key.endsWith('_type') ||
      key.endsWith('_class') || key.endsWith('_category') ||
      key.endsWith('_sector') || key.endsWith('_channel') ||
      key.endsWith('_segment') || key.endsWith('_classification')) {
    return FieldCategory.LABEL;
  }

  // =========================================================================
  // BOOLEAN/FLAG FIELDS (Toggles)
  // =========================================================================

  // Flags: active_flag, is_active, has_permission, can_edit, etc.
  if (key.endsWith('_flag') || key.endsWith('_enabled') ||
      key.endsWith('_disabled') || key.endsWith('_allowed') ||
      key.startsWith('is_') || key.startsWith('has_') ||
      key.startsWith('can_') || key.startsWith('should_') ||
      key.startsWith('enable_') || key.startsWith('require_')) {
    return FieldCategory.BOOLEAN;
  }

  // =========================================================================
  // COMPLEX/STRUCTURED FIELDS (JSON, Arrays, Text)
  // =========================================================================

  // JSON/JSONB: metadata, attr, config, settings, options, props, etc.
  if (key === 'metadata' || key === 'attr' || key === 'config' ||
      key === 'settings' || key === 'options' || key === 'props' ||
      key.endsWith('_json') || key.endsWith('_jsonb') ||
      key.endsWith('_config') || key.endsWith('_settings') ||
      key.endsWith('_options') || key.endsWith('_metadata')) {
    return FieldCategory.JSON;
  }

  // Arrays: tags, ids, list, array, values, items, etc.
  if (key === 'tags' || key.endsWith('_tags') ||
      key.endsWith('_ids') || key.endsWith('_list') ||
      key.endsWith('_array') || key.endsWith('_values') ||
      key.endsWith('_items')) {
    return FieldCategory.ARRAY;
  }

  // Long text: content, notes, body, comments, remarks, etc.
  if (key === 'content' || key === 'notes' || key === 'body' ||
      key === 'comments' || key === 'remarks' || key === 'summary' ||
      key.endsWith('_text') || key.endsWith('_content') ||
      key.endsWith('_notes') || key.endsWith('_comments')) {
    return FieldCategory.LONG_TEXT;
  }

  // =========================================================================
  // IDENTITY/KEY FIELDS (IDs, URLs, Emails)
  // =========================================================================

  // Primary/system IDs
  if (key === 'id') {
    return FieldCategory.ID;
  }

  // URLs: url, link, website, etc.
  if (key.endsWith('_url') || key.endsWith('_link') ||
      key === 'url' || key === 'link' || key === 'website') {
    return FieldCategory.URL;
  }

  // Emails: email, contact_email, etc.
  if (key.endsWith('_email') || key === 'email') {
    return FieldCategory.EMAIL;
  }

  // Entity references (foreign keys): project_id, employee_id, etc.
  // Matches any *_id pattern that references an entity
  if (key.endsWith('_employee_id') || key.endsWith('_client_id') ||
      key.endsWith('_project_id') || key.endsWith('_task_id') ||
      key.endsWith('_office_id') || key.endsWith('_business_id') ||
      key.endsWith('_role_id') || key.endsWith('_user_id') ||
      key.endsWith('_worksite_id') || key.endsWith('_form_id') ||
      key.endsWith('_artifact_id') || key.endsWith('_wiki_id')) {
    return FieldCategory.ENTITY_REF;
  }

  // =========================================================================
  // DEFAULT (Unknown pattern - treat as plain text)
  // =========================================================================

  return FieldCategory.UNKNOWN;
}

/**
 * Get category configuration for a field
 */
export function getFieldCategoryConfig(fieldKey: string): FieldCategoryConfig {
  const category = detectFieldCategory(fieldKey);
  return FIELD_CATEGORY_REGISTRY[category];
}

/**
 * Get all properties for a field based on its category
 *
 * This is the main function that applies category-based configuration
 * to any field. It returns a complete configuration object ready to use
 * in column definitions.
 */
export function getCategoryProperties(fieldKey: string): {
  category: FieldCategory;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable: boolean;
  filterable: boolean;
  searchable: boolean;
  render?: (value: any, record: any) => React.ReactNode;
  loadOptionsFromSettings?: boolean;
} {
  const category = detectFieldCategory(fieldKey);
  const config = FIELD_CATEGORY_REGISTRY[category];

  return {
    category,
    width: config.width,
    align: config.align,
    sortable: config.sortable,
    filterable: config.filterable,
    searchable: config.searchable,
    render: config.render,
    loadOptionsFromSettings: config.loadOptionsFromSettings
  };
}

/**
 * Helper: Get human-readable title from field key
 * Converts snake_case to Title Case with smart suffix removal
 *
 * Examples:
 * - 'name' → 'Name'
 * - 'project_stage' → 'Project Stage'
 * - 'budget_allocated_amt' → 'Budget Allocated'
 * - 'created_ts' → 'Created'
 * - 'is_active' → 'Active'
 */
export function generateFieldTitle(fieldKey: string): string {
  // Remove common suffixes
  let title = fieldKey
    .replace(/_amt$/, '')
    .replace(/_ts$/, '')
    .replace(/_date$/, '')
    .replace(/_flag$/, '')
    .replace(/^is_/, '')
    .replace(/^has_/, '')
    .replace(/^can_/, '');

  // Convert snake_case to Title Case
  return title
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
