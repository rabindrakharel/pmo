/**
 * useColumnVisibility Hook
 *
 * Manages column visibility state for entity data tables with localStorage persistence.
 * Follows DRY principles by providing reusable column management across all entities.
 *
 * Features:
 * - Discovers all available columns from data
 * - Persists user preferences in localStorage
 * - Defaults to showing all columns
 * - Supports column reordering
 * - Per-entity configuration storage
 *
 * Usage:
 * ```typescript
 * const {
 *   visibleColumns,
 *   allColumns,
 *   toggleColumn,
 *   showAllColumns,
 *   hideAllColumns,
 *   isColumnVisible
 * } = useColumnVisibility(entityType, configuredColumns, data);
 * ```
 */

import { useState, useEffect, useMemo } from 'react';
import type { Column } from '../../components/shared/ui/EntityDataTable';

const STORAGE_KEY_PREFIX = 'column_visibility_';

// System columns that should not be hidden
const SYSTEM_COLUMNS = ['id', 'created_ts', 'updated_ts', 'version', 'active_flag'];

interface ColumnVisibilityState {
  [columnKey: string]: boolean;
}

export interface UseColumnVisibilityReturn {
  visibleColumns: Column[];
  allColumns: Column[];
  toggleColumn: (columnKey: string) => void;
  showAllColumns: () => void;
  hideAllColumns: () => void;
  isColumnVisible: (columnKey: string) => boolean;
  resetToDefault: () => void;
}

/**
 * Discovers all available columns from data records
 * @param data - Array of data records
 * @returns Array of column keys found in data
 */
function discoverColumnsFromData(data: any[]): string[] {
  if (!data || data.length === 0) return [];

  // Merge keys from all records (in case some records have different fields)
  const allKeys = new Set<string>();
  data.forEach(record => {
    Object.keys(record).forEach(key => allKeys.add(key));
  });

  return Array.from(allKeys);
}

/**
 * Converts a column key to a user-friendly label
 * @param key - Column key
 * @returns Formatted label
 */
function generateColumnLabel(key: string): string {
  // Remove common prefixes
  let label = key.replace(/^(dl__|f_|d_)/, '');

  // Convert snake_case to Title Case
  label = label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return label;
}

/**
 * Merges configured columns with discovered columns
 * @param configuredColumns - Columns from entity config
 * @param discoveredKeys - Column keys found in data
 * @returns Complete list of Column objects
 */
function mergeColumns(configuredColumns: Column[], discoveredKeys: string[]): Column[] {
  const columnMap = new Map<string, Column>();

  // Add configured columns first (they have proper config)
  configuredColumns.forEach(col => {
    const key = typeof col === 'string' ? col : col.key;
    if (!columnMap.has(key)) {
      columnMap.set(key, typeof col === 'string' ? { key: col, title: generateColumnLabel(col) } : col);
    }
  });

  // Add discovered columns that aren't in config
  discoveredKeys.forEach(key => {
    if (!columnMap.has(key)) {
      columnMap.set(key, {
        key,
        title: generateColumnLabel(key),
        sortable: true,
        filterable: true
      });
    }
  });

  return Array.from(columnMap.values());
}

/**
 * Hook for managing column visibility with localStorage persistence
 *
 * @param entityType - The entity type (for storage key)
 * @param configuredColumns - Columns defined in entity config
 * @param data - Current data records (for column discovery)
 * @param defaultVisible - Default visibility state (true = show all by default)
 * @returns Column visibility management functions and state
 */
export function useColumnVisibility(
  entityType: string,
  configuredColumns: Column[] = [],
  data: any[] = [],
  defaultVisible: boolean = true
): UseColumnVisibilityReturn {
  const storageKey = `${STORAGE_KEY_PREFIX}${entityType}`;

  // Only use configured columns - don't discover from data
  // This respects the filtering done by the parent component
  const allColumns = useMemo(() => {
    // If columns are already configured, use them as-is
    // Don't merge with discovered columns as that would add back filtered columns
    return configuredColumns;
  }, [configuredColumns]);

  // Initialize visibility state from localStorage or defaults
  const [visibilityState, setVisibilityState] = useState<ColumnVisibilityState>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load column visibility from localStorage:', error);
    }

    // Default: respect column's visible property, or use defaultVisible
    const initial: ColumnVisibilityState = {};
    allColumns.forEach(col => {
      const key = typeof col === 'string' ? col : col.key;
      // Respect the column's own visible property if it exists
      const colVisible = typeof col === 'object' && col.visible !== undefined
        ? col.visible
        : defaultVisible;
      initial[key] = colVisible;
    });
    return initial;
  });

  // Update visibility state when columns change (new data loaded)
  useEffect(() => {
    setVisibilityState(prev => {
      const updated = { ...prev };
      allColumns.forEach(col => {
        const key = typeof col === 'string' ? col : col.key;
        if (!(key in updated)) {
          // Respect the column's own visible property if it exists
          const colVisible = typeof col === 'object' && col.visible !== undefined
            ? col.visible
            : defaultVisible;
          updated[key] = colVisible;
        }
      });
      return updated;
    });
  }, [allColumns, defaultVisible]);

  // Persist to localStorage whenever visibility changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibilityState));
    } catch (error) {
      console.warn('Failed to save column visibility to localStorage:', error);
    }
  }, [visibilityState, storageKey]);

  // Get visible columns
  const visibleColumns = useMemo(() => {
    return allColumns.filter(col => {
      const key = typeof col === 'string' ? col : col.key;
      return visibilityState[key] !== false;
    });
  }, [allColumns, visibilityState]);

  // Toggle column visibility
  const toggleColumn = (columnKey: string) => {
    setVisibilityState(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  // Show all columns
  const showAllColumns = () => {
    const updated: ColumnVisibilityState = {};
    allColumns.forEach(col => {
      const key = typeof col === 'string' ? col : col.key;
      updated[key] = true;
    });
    setVisibilityState(updated);
  };

  // Hide all columns (except system columns)
  const hideAllColumns = () => {
    const updated: ColumnVisibilityState = {};
    allColumns.forEach(col => {
      const key = typeof col === 'string' ? col : col.key;
      // Keep system columns visible
      updated[key] = SYSTEM_COLUMNS.includes(key);
    });
    setVisibilityState(updated);
  };

  // Check if column is visible
  const isColumnVisible = (columnKey: string): boolean => {
    return visibilityState[columnKey] !== false;
  };

  // Reset to default (respect column's visible property)
  const resetToDefault = () => {
    const updated: ColumnVisibilityState = {};
    allColumns.forEach(col => {
      const key = typeof col === 'string' ? col : col.key;
      // Respect the column's own visible property if it exists
      const colVisible = typeof col === 'object' && col.visible !== undefined
        ? col.visible
        : defaultVisible;
      updated[key] = colVisible;
    });
    setVisibilityState(updated);

    // Clear from localStorage to use defaults next time
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Failed to clear column visibility from localStorage:', error);
    }
  };

  return {
    visibleColumns,
    allColumns,
    toggleColumn,
    showAllColumns,
    hideAllColumns,
    isColumnVisible,
    resetToDefault
  };
}
