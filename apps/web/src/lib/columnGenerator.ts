/**
 * ⚠️ DEPRECATED - LEGACY CODE (v3.x)
 *
 * This file is marked for removal in Entity System v4.0.
 *
 * **Why Deprecated:**
 * - Manual column generation is replaced by auto-generation via universalFieldDetector.ts
 * - Components now use autoGenerateColumns prop instead of manual configs
 * - Pattern-based detection eliminates need for manual column definitions
 *
 * **Migration Path:**
 * Instead of:
 *   columns: generateStandardColumns(['name', 'code', 'status'])
 *
 * Use:
 *   <EntityDataTable data={data} autoGenerateColumns />
 *
 * **See:**
 * - docs/entity_design_pattern/ENTITY_SYSTEM_V4.md
 * - apps/web/src/lib/universalFieldDetector.ts
 * - apps/web/src/lib/viewConfigGenerator.ts
 *
 * **Status:** Currently used by FilteredDataTable (pending migration)
 *
 * ---
 *
 * Centralized Column Generation System
 *
 * Auto-generates column definitions for entity data tables using the
 * Field Category Registry - a SINGLE SOURCE OF TRUTH that defines:
 * - Width, alignment, sortable/filterable/searchable for each category
 * - Rendering logic (currency, dates, timestamps, badges, etc.)
 * - Visibility control (visible vs hidden columns)
 * - Foreign key detection and auto-generation of entity name columns
 * - Special features (dropdowns, colored badges, etc.)
 *
 * DRY Principle: All properties for a field category are defined in ONE place.
 * Change the category config, and ALL fields of that category update automatically.
 *
 * Key Features:
 * - System fields (id, timestamps) automatically hidden from UI
 * - FK columns (*_id) marked invisible, auto-generates *_name columns
 * - Example: project_id (hidden) + project_name (visible, shows d_project.name)
 */

import React from 'react';
import {
  getCategoryProperties,
  generateFieldTitle
} from './fieldCategoryRegistry';
import { type ColumnDef } from './entityConfig';

/**
 * System columns that should be hidden from data tables
 * These are audit/system fields that users should not see or edit
 */
const SYSTEM_COLUMNS = new Set([
  'id',           // Primary key - ui:invisible
  'from_ts',      // SCD Type 2 start timestamp - api:restrict
  'to_ts',        // SCD Type 2 end timestamp - api:restrict
  'active_flag',  // SCD Type 2 active flag - api:restrict
  'created_ts',   // Creation timestamp - api:restrict, audit
  'updated_ts',   // Update timestamp - api:restrict, audit
  'version'       // Optimistic locking version - api:system_field
]);

/**
 * Check if a column is a foreign key reference (*_id pattern)
 * Examples: project_id, task_id, employee_id, client_id
 * Note: 'id' alone is NOT a foreign key, it's the primary key
 */
function isForeignKeyColumn(columnKey: string): boolean {
  return columnKey !== 'id' && columnKey.endsWith('_id');
}

/**
 * Extract entity name from foreign key column
 * Examples:
 * - project_id → project
 * - manager_employee_id → employee
 * - assignee_employee_id → employee
 */
function getEntityNameFromForeignKey(columnKey: string): string {
  // Remove _id suffix
  const withoutId = columnKey.replace(/_id$/, '');

  // Handle cases like manager_employee_id → extract "employee"
  // Pattern: if it ends with _entityname, extract entityname
  const parts = withoutId.split('_');

  // Check if last part is a known entity type
  const knownEntities = [
    'employee', 'project', 'task', 'client', 'customer', 'cust',
    'office', 'business', 'biz', 'supplier', 'product', 'service',
    'artifact', 'wiki', 'form', 'event', 'calendar'
  ];

  const lastPart = parts[parts.length - 1];
  if (knownEntities.includes(lastPart)) {
    return lastPart;
  }

  // Otherwise, use the whole thing without _id
  return withoutId;
}

/**
 * Check if a column should be hidden from display (but still fetched)
 */
function isSystemColumn(columnKey: string): boolean {
  return SYSTEM_COLUMNS.has(columnKey);
}

/**
 * Check if a column should be visible in data table
 * - System columns: invisible (id, timestamps, version, etc.)
 * - Foreign keys: invisible (replaced by entity_name columns)
 * - Everything else: visible by default
 */
function isVisibleColumn(columnKey: string): boolean {
  return !isSystemColumn(columnKey) && !isForeignKeyColumn(columnKey);
}

/**
 * Column generation options
 */
export interface ColumnGenerationOptions {
  /** Override specific columns */
  overrides?: Record<string, Partial<ColumnDef>>;
}

/**
 * Generate columns from field keys using Field Category Registry
 *
 * This function uses getCategoryProperties() to automatically apply ALL
 * category-based properties (width, alignment, sortable, filterable,
 * searchable, rendering) from the centralized registry.
 *
 * Example usage:
 * ```typescript
 * // Minimal - everything auto-configured
 * columns: generateColumns(['name', 'code', 'descr', 'project_stage', 'budget_allocated_amt', 'created_ts'])
 *
 * // With overrides for special cases
 * columns: generateColumns(
 *   ['name', 'code', 'descr', 'project_stage', 'budget_allocated_amt', 'created_ts'],
 *   {
 *     overrides: {
 *       budget_allocated_amt: {
 *         title: 'Budget', // Custom title
 *         render: (v, r) => formatCurrency(v, r.budget_currency) // Custom currency field lookup
 *       }
 *     }
 *   }
 * )
 * ```
 */
export function generateColumns(
  fieldKeys: string[],
  options: ColumnGenerationOptions = {}
): ColumnDef[] {
  const { overrides = {} } = options;

  const columns: ColumnDef[] = [];

  // Process each field key
  for (const key of fieldKeys) {
    // Skip system columns entirely - not even fetched from API
    if (isSystemColumn(key)) {
      continue;
    }

    // Get ALL properties from category registry
    const categoryProps = getCategoryProperties(key);

    // Base column definition - ALL properties come from category registry
    const column: ColumnDef = {
      key,
      title: generateFieldTitle(key),
      sortable: categoryProps.sortable,
      filterable: categoryProps.filterable,
      width: categoryProps.width,
      align: categoryProps.align,
      render: categoryProps.render,
      visible: isVisibleColumn(key) // Auto-set visibility based on column type
    };

    // Add loadOptionsFromSettings if category requires it
    if (categoryProps.loadOptionsFromSettings) {
      column.loadOptionsFromSettings = true;
    }

    // Apply overrides (for special cases that need custom behavior)
    if (overrides[key]) {
      Object.assign(column, overrides[key]);
    }

    columns.push(column);

    // If this is a foreign key column, auto-generate corresponding entity_name column
    if (isForeignKeyColumn(key)) {
      const entityName = getEntityNameFromForeignKey(key);
      const nameColumnKey = key.replace(/_id$/, '_name');

      // Check if user explicitly provided this name column
      if (!fieldKeys.includes(nameColumnKey)) {
        // Auto-generate entity name column
        const nameColumn: ColumnDef = {
          key: nameColumnKey,
          title: generateFieldTitle(nameColumnKey),
          sortable: true,
          filterable: true,
          width: '200px',
          align: 'left',
          visible: true, // Name columns are always visible
          render: (value: string) => value || '-' // Simple text renderer
        };

        // Add override for name column if specified
        if (overrides[nameColumnKey]) {
          Object.assign(nameColumn, overrides[nameColumnKey]);
        }

        columns.push(nameColumn);
      }
    }
  }

  return columns;
}

/**
 * Convenience function for generating columns with common patterns
 * Ensures standard fields (name, code, descr) are first if they exist
 */
export function generateStandardColumns(
  fieldKeys: string[],
  options: ColumnGenerationOptions = {}
): ColumnDef[] {
  // Ensure standard fields (name, code, descr) are always included if they exist
  const standardFields = ['name', 'code', 'descr'];
  const hasStandardFields = fieldKeys.some(k => standardFields.includes(k));

  if (hasStandardFields) {
    // Reorder to put standard fields first
    const orderedKeys = [
      ...fieldKeys.filter(k => standardFields.includes(k)).sort((a, b) =>
        standardFields.indexOf(a) - standardFields.indexOf(b)
      ),
      ...fieldKeys.filter(k => !standardFields.includes(k))
    ];
    return generateColumns(orderedKeys, options);
  }

  return generateColumns(fieldKeys, options);
}
