/**
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
        : React.createElement('span', { className: 'text-gray-400' }, '✗');
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
          className: 'text-blue-600 hover:underline'
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
          className: 'text-blue-600 hover:underline'
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
 * This function categorizes API columns based on naming conventions:
 * - name, title → NAME
 * - code → CODE
 * - descr, description → DESCR
 * - *_amt, *_amount → AMOUNT
 * - *_date → DATE
 * - *_ts, *_timestamp → TIMESTAMP
 * - *_stage, *_status, *_priority, *_level → LABEL (settings-driven)
 * - *_flag, is_*, has_*, can_* → BOOLEAN
 * - etc.
 */
export function detectFieldCategory(fieldKey: string): FieldCategory {
  const key = fieldKey.toLowerCase();

  // Standard entity fields (highest priority)
  if (key === 'name' || key === 'title') return FieldCategory.NAME;
  if (key === 'code') return FieldCategory.CODE;
  if (key === 'descr' || key === 'description') return FieldCategory.DESCR;

  // Temporal fields
  if (key.endsWith('_ts') || key.endsWith('_timestamp')) return FieldCategory.TIMESTAMP;
  if (key.endsWith('_date')) return FieldCategory.DATE;

  // Business/financial fields
  if (key.endsWith('_amt') || key.endsWith('_amount')) return FieldCategory.AMOUNT;
  if (key.endsWith('_currency')) return FieldCategory.CURRENCY;
  if (key.endsWith('_pct') || key.endsWith('_percent') || key.endsWith('_percentage')) return FieldCategory.PERCENTAGE;
  if (key.endsWith('_count') || key.endsWith('_hours') || key.endsWith('_quantity') || key.endsWith('_number')) return FieldCategory.NUMBER;

  // Settings-driven labels (datalabel fields)
  // Matches: *_stage, *_status, *_priority, *_level, *_tier, *_sector, *_channel
  // Also matches: dl__* prefix pattern for explicit datalabel fields
  if (key.startsWith('dl__') ||
      key.endsWith('_stage') ||
      key.endsWith('_status') ||
      key.endsWith('_priority') ||
      key.endsWith('_level') ||
      key.endsWith('_tier') ||
      key.endsWith('_sector') ||
      key.endsWith('_channel')) {
    return FieldCategory.LABEL;
  }

  // Boolean/flag fields
  if (key.endsWith('_flag') || key.startsWith('is_') || key.startsWith('has_') || key.startsWith('can_')) return FieldCategory.BOOLEAN;

  // Complex/structured fields
  if (key === 'metadata' || key === 'attr' || key.endsWith('_json') || key.endsWith('_jsonb')) return FieldCategory.JSON;
  if (key === 'tags' || key.endsWith('_ids') || key.endsWith('_list') || key.endsWith('_array')) return FieldCategory.ARRAY;
  if (key === 'content' || key === 'notes' || key === 'body' || key.endsWith('_text')) return FieldCategory.LONG_TEXT;

  // Identity/key fields
  if (key === 'id') return FieldCategory.ID;
  if (key.endsWith('_url') || key.endsWith('_link')) return FieldCategory.URL;
  if (key.endsWith('_email')) return FieldCategory.EMAIL;

  // Entity reference (foreign key pattern)
  if (key.endsWith('_employee_id') || key.endsWith('_client_id') || key.endsWith('_project_id') || key.endsWith('_task_id')) return FieldCategory.ENTITY_REF;

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
