/**
 * ColumnSelector Component
 *
 * Reusable dropdown UI for managing column visibility in data tables.
 * Provides checkboxes for each column with quick actions (show all, hide all, reset).
 *
 * Features:
 * - Checkbox list of all available columns
 * - Quick actions: Show All, Hide All, Reset to Default
 * - Displays count of visible/total columns
 * - Dropdown menu with smooth animation
 * - Follows DRY principles for reuse across all entity tables
 *
 * Usage:
 * ```tsx
 * <ColumnSelector
 *   allColumns={allColumns}
 *   isColumnVisible={isColumnVisible}
 *   toggleColumn={toggleColumn}
 *   showAllColumns={showAllColumns}
 *   hideAllColumns={hideAllColumns}
 *   resetToDefault={resetToDefault}
 * />
 * ```
 */

import React, { useState, useRef, useEffect } from 'react';
import { Settings, Check, Eye, EyeOff, RotateCcw } from 'lucide-react';
import type { Column } from './EntityListOfInstancesTable';

export interface ColumnSelectorProps {
  allColumns: Column[];
  isColumnVisible: (columnKey: string) => boolean;
  toggleColumn: (columnKey: string) => void;
  showAllColumns: () => void;
  hideAllColumns: () => void;
  resetToDefault: () => void;
}

export function ColumnSelector({
  allColumns,
  isColumnVisible,
  toggleColumn,
  showAllColumns,
  hideAllColumns,
  resetToDefault
}: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Count visible columns
  const visibleCount = allColumns.filter(col => {
    const key = typeof col === 'string' ? col : col.key;
    return isColumnVisible(key);
  }).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-3 py-2 border border-dark-200 text-sm font-medium rounded-md text-dark-700 bg-white hover:bg-dark-50 hover:border-dark-300 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors"
        title="Configure columns"
      >
        <Settings className="h-4 w-4 mr-2 stroke-[1.5]" />
        Columns
        <span className="ml-2 text-xs text-dark-500">
          ({visibleCount}/{allColumns.length})
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-dark-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-dark-300">
            <h3 className="text-sm font-medium text-dark-600">
              Column Visibility
            </h3>
            <p className="text-xs text-dark-700 mt-1">
              Select which columns to display in the table
            </p>
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 border-b border-dark-300 flex items-center justify-between bg-dark-100">
            <button
              onClick={() => {
                showAllColumns();
                setIsOpen(false);
              }}
              className="inline-flex items-center text-xs text-dark-600 hover:text-dark-600 hover:underline"
            >
              <Eye className="h-3 w-3 mr-1" />
              Show All
            </button>
            <button
              onClick={() => {
                hideAllColumns();
                setIsOpen(false);
              }}
              className="inline-flex items-center text-xs text-dark-600 hover:text-dark-600 hover:underline"
            >
              <EyeOff className="h-3 w-3 mr-1" />
              Hide All
            </button>
            <button
              onClick={() => {
                resetToDefault();
                setIsOpen(false);
              }}
              className="inline-flex items-center text-xs text-dark-600 hover:text-dark-600 hover:underline"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </button>
          </div>

          {/* Column List */}
          <div className="max-h-96 overflow-y-auto">
            {allColumns.map(col => {
              const key = typeof col === 'string' ? col : col.key;
              const title = typeof col === 'string' ? col : (col.title || key);
              const visible = isColumnVisible(key);

              return (
                <label
                  key={key}
                  className="flex items-center px-4 py-2 hover:bg-dark-100 cursor-pointer transition-colors"
                >
                  {/* Checkbox */}
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleColumn(key)}
                      className="h-4 w-4 text-dark-700 border-dark-400 rounded focus:ring-2 focus:ring-dark-700 focus:ring-offset-0"
                    />
                    {visible && (
                      <Check className="absolute inset-0 h-4 w-4 text-dark-700 pointer-events-none" strokeWidth={3} />
                    )}
                  </div>

                  {/* Column Name */}
                  <span className="ml-3 text-sm text-dark-600 select-none">
                    {title}
                  </span>

                  {/* Column Key (subtle) */}
                  <span className="ml-auto text-xs text-dark-700 font-mono">
                    {key}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-dark-300 bg-dark-100">
            <p className="text-xs text-dark-700 text-center">
              Showing {visibleCount} of {allColumns.length} columns
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
