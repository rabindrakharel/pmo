/**
 * Centralized Column Generation System
 *
 * Auto-generates column definitions for entity data tables using the
 * Field Category Registry - a SINGLE SOURCE OF TRUTH that defines:
 * - Width, alignment, sortable/filterable/searchable for each category
 * - Rendering logic (currency, dates, timestamps, badges, etc.)
 * - Special features (dropdowns, colored badges, etc.)
 *
 * DRY Principle: All properties for a field category are defined in ONE place.
 * Change the category config, and ALL fields of that category update automatically.
 *
 * Eliminates 150+ manual column definitions across 13+ entities.
 */

import React from 'react';
import {
  getCategoryProperties,
  generateFieldTitle
} from './fieldCategoryRegistry';
import { type ColumnDef } from './entityConfig';

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

  return fieldKeys.map(key => {
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
      render: categoryProps.render
    };

    // Add loadOptionsFromSettings if category requires it
    if (categoryProps.loadOptionsFromSettings) {
      column.loadOptionsFromSettings = true;
    }

    // Apply overrides (for special cases that need custom behavior)
    if (overrides[key]) {
      Object.assign(column, overrides[key]);
    }

    return column;
  });
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
