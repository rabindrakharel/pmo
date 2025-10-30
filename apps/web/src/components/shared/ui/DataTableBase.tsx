/**
 * ============================================================================
 * DATA TABLE BASE - Shared base component for all data table types
 * ============================================================================
 *
 * Common functionality for EntityDataTable and SettingsDataTable:
 * - Table structure (thead, tbody, pagination)
 * - Sorting UI
 * - Inline editing pattern (Edit → Check/Cancel)
 * - Add row pattern
 * - Common styling and theming
 *
 * Uses composition pattern (React's approach to OOP inheritance)
 */

import React from 'react';
import { ChevronDown, ChevronUp, Check, X, Edit, Trash2, Plus } from 'lucide-react';

export interface BaseColumn {
  key: string;
  title: string;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface BaseRowAction<T = any> {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: (record: T) => void;
  disabled?: (record: T) => boolean;
  className?: string;
  variant?: 'default' | 'primary' | 'danger';
}

export interface DataTableBaseProps<T = any> {
  // Data
  data: T[];
  columns: BaseColumn[];

  // Rendering
  renderCell: (column: BaseColumn, record: T, isEditing: boolean) => React.ReactNode;
  renderEditingActions?: (record: T) => React.ReactNode;
  renderActions?: (record: T, isEditing: boolean) => React.ReactNode;

  // State
  sortField: string;
  sortDirection: 'asc' | 'desc';
  editingRowId: string | number | null;
  isAddingRow: boolean;

  // Callbacks
  onSort: (field: string) => void;
  onRowClick?: (record: T) => void;
  getRowKey: (record: T, index: number) => string;

  // Inline editing
  onStartEdit?: (record: T) => void;
  onSaveEdit?: (record: T) => void;
  onCancelEdit?: () => void;

  // Add row
  allowAddRow?: boolean;
  onStartAddRow?: () => void;
  onSaveAddRow?: () => void;
  onCancelAddRow?: () => void;
  renderAddRowForm?: () => React.ReactNode;

  // Delete
  onDelete?: (record: T) => void;

  // Drag & drop
  allowReordering?: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  draggedIndex?: number | null;
  dragOverIndex?: number | null;

  // Styling
  className?: string;
  loading?: boolean;
}

export function DataTableBase<T = any>({
  data,
  columns,
  renderCell,
  renderEditingActions,
  renderActions,
  sortField,
  sortDirection,
  editingRowId,
  isAddingRow,
  onSort,
  onRowClick,
  getRowKey,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  allowAddRow = false,
  onStartAddRow,
  onSaveAddRow,
  onCancelAddRow,
  renderAddRowForm,
  onDelete,
  allowReordering = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  draggedIndex = null,
  dragOverIndex = null,
  className = '',
  loading = false,
}: DataTableBaseProps<T>) {

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ?
      <ChevronUp className="h-4 w-4" /> :
      <ChevronDown className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300"></div>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Table Header */}
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    col.sortable && !allowReordering ? 'cursor-pointer hover:bg-gray-100' : ''
                  } transition-colors`}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                  onClick={() => col.sortable && !allowReordering && onSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{col.title}</span>
                    {col.sortable && !allowReordering && renderSortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((record, index) => {
              const rowKey = getRowKey(record, index);
              const isEditing = editingRowId === rowKey;
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;

              return (
                <React.Fragment key={rowKey}>
                  {/* Drop indicator line */}
                  {isDragOver && draggedIndex !== null && (
                    <tr className="relative pointer-events-none">
                      <td colSpan={columns.length} className="p-0 h-0">
                        <div className="absolute left-0 right-0 h-1 bg-gray-500 shadow-lg z-50"
                             style={{ top: '-2px' }}
                        />
                      </td>
                    </tr>
                  )}

                  <tr
                    className={`transition-all ${
                      isDragging ? 'opacity-40 bg-gray-100' :
                      isEditing ? 'bg-gray-50' :
                      'hover:bg-gray-50'
                    } ${allowReordering && !isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    draggable={allowReordering && !isEditing}
                    onDragStart={(e) => onDragStart?.(e, index)}
                    onDragOver={(e) => onDragOver?.(e, index)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDrop?.(e, index)}
                    onDragEnd={onDragEnd}
                    onClick={() => !isEditing && onRowClick?.(record)}
                  >
                    {columns.map((column) => {
                      // Special handling for actions column
                      if (column.key === '_actions') {
                        return (
                          <td
                            key={column.key}
                            className="px-6 py-2.5 whitespace-nowrap"
                            style={{ textAlign: column.align || 'center' }}
                          >
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                {/* When editing: Show Check (Save) and X (Cancel) icons */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSaveEdit?.(record);
                                  }}
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="Save"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCancelEdit?.();
                                  }}
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                                {renderEditingActions?.(record)}
                              </div>
                            ) : (
                              renderActions?.(record, isEditing)
                            )}
                          </td>
                        );
                      }

                      // Regular columns
                      return (
                        <td
                          key={column.key}
                          className="px-6 py-2.5 whitespace-nowrap"
                          style={{ textAlign: column.align || 'left' }}
                        >
                          {renderCell(column, record, isEditing)}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {data.length === 0 && !allowAddRow && (
          <div className="text-center py-12 text-gray-500">
            No data available
          </div>
        )}
      </div>

      {/* Add Row Button/Form */}
      {allowAddRow && (
        <div className="border-t border-gray-200 bg-white">
          {!isAddingRow ? (
            <button
              onClick={onStartAddRow}
              className="w-full px-6 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add new row</span>
            </button>
          ) : (
            <div className="p-4">
              {renderAddRowForm?.()}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={onSaveAddRow}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm shadow-sm"
                >
                  <Check className="h-4 w-4" />
                  Save
                </button>
                <button
                  onClick={onCancelAddRow}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 bg-white rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Standard action buttons component
 */
interface ActionButtonsProps<T> {
  record: T;
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void;
  allowEdit?: boolean;
  allowDelete?: boolean;
}

export function ActionButtons<T>({
  record,
  onEdit,
  onDelete,
  allowEdit = true,
  allowDelete = false,
}: ActionButtonsProps<T>) {
  return (
    <div className="flex items-center justify-center gap-1">
      {allowEdit && onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(record);
          }}
          className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </button>
      )}
      {allowDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this row?')) {
              onDelete(record);
            }
          }}
          className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
