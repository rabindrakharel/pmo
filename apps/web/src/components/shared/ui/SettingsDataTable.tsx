/**
 * ============================================================================
 * SETTINGS DATA TABLE - Simplified table for settings/datalabel pages
 * ============================================================================
 *
 * Purpose: Lightweight table component specifically for settings datalabel pages
 * Optimized for the fixed schema: id, name, descr, parent_id, color_code
 *
 * Key Features:
 * - Inline editing for color_code with colored dropdown
 * - Inline row addition with "+" button at bottom
 * - Badge rendering for name (with color) and color_code
 * - Simple sorting (no filters - settings are small)
 * - Optimized for settings schema only
 *
 * Used by: SettingDetailPage.tsx, datalabel pages
 * Different from: EntityDataTable (complex, full-featured for entities)
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Check, X, Edit, Trash2, GripVertical } from 'lucide-react';
import { renderColorBadge } from '../../../lib/settingsConfig';
import { COLOR_OPTIONS } from '../../../lib/settingsConfig';

interface SettingOption {
  value: string | number;
  label: string;
  metadata?: {
    color_code?: string;
  };
}

interface SettingsRecord {
  id: string | number;
  name: string;
  descr?: string;
  parent_id?: number | null;
  color_code: string;
  position?: number;  // Array position from backend
}

interface SettingsDataTableProps {
  data: SettingsRecord[];
  onInlineEdit?: (id: string | number, field: string, value: any) => void;
  onRowUpdate?: (id: string | number, updates: Partial<SettingsRecord>) => void;
  onAddRow?: (newRecord: Partial<SettingsRecord>) => void;
  onDeleteRow?: (id: string | number) => void;
  onReorder?: (reorderedData: SettingsRecord[]) => void;
  allowAddRow?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowReorder?: boolean;
}

/**
 * Colored Dropdown for inline editing color_code
 */
function ColoredDropdown({
  value,
  options,
  onChange
}: {
  value: string;
  options: SettingOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const selectedColor = selectedOption?.metadata?.color_code;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full px-2.5 py-1.5 pr-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400/30 focus:border-gray-300 bg-white shadow-sm hover:border-gray-300 transition-colors cursor-pointer text-left"
      >
        {selectedOption ? (
          renderColorBadge(selectedColor, String(selectedOption.label))
        ) : (
          <span className="text-gray-400">Select...</span>
        )}
      </button>
      <ChevronDown className="h-4 w-4 text-gray-500 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="py-1">
            {options.map(opt => {
              const optionColor = opt.metadata?.color_code;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value as string);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center"
                >
                  {renderColorBadge(optionColor, String(opt.label))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Settings Data Table Component
 */
export function SettingsDataTable({
  data,
  onInlineEdit,
  onRowUpdate,
  onAddRow,
  onDeleteRow,
  onReorder,
  allowAddRow = false,
  allowEdit = true,
  allowDelete = false,
  allowReorder = false
}: SettingsDataTableProps) {
  const [sortField, setSortField] = useState<string>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editingRowId, setEditingRowId] = useState<string | number | null>(null);
  const [editingData, setEditingData] = useState<Partial<SettingsRecord>>({});
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Partial<SettingsRecord>>({
    name: '',
    descr: '',
    parent_id: null,
    color_code: 'blue'
  });

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Handle sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort data
  // IMPORTANT: When allowReorder is true, display in array position order (no sorting)
  // This ensures drag & drop reflects actual database array order
  const sortedData = allowReorder ? [...data] : [...data].sort((a, b) => {
    const aVal = a[sortField as keyof SettingsRecord];
    const bVal = b[sortField as keyof SettingsRecord];

    if (aVal == null) return 1;
    if (bVal == null) return -1;

    const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Handle edit row
  const handleStartEdit = (record: SettingsRecord) => {
    setEditingRowId(record.id);
    setEditingData({ ...record });
  };

  const handleSaveEdit = () => {
    if (!editingRowId) return;

    // Collect all changed fields (excluding id)
    const updates: Partial<SettingsRecord> = {};
    let hasChanges = false;

    Object.keys(editingData).forEach(field => {
      if (field !== 'id') {
        updates[field as keyof SettingsRecord] = editingData[field as keyof SettingsRecord];
        hasChanges = true;
      }
    });

    // If no changes, just cancel
    if (!hasChanges) {
      handleCancelEdit();
      return;
    }

    // Use onRowUpdate if available (DRY approach - send all updates at once)
    // Otherwise fall back to onInlineEdit (legacy - one field at a time)
    if (onRowUpdate) {
      // DRY: Send all updates in ONE call - backend recomposes entire metadata
      onRowUpdate(editingRowId, updates);
    } else if (onInlineEdit) {
      // Legacy: Send each field separately
      Object.keys(updates).forEach(field => {
        if (field !== 'id') {
          onInlineEdit(editingRowId, field, updates[field as keyof SettingsRecord]);
        }
      });
    }

    setEditingRowId(null);
    setEditingData({});
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditingData({});
  };

  const handleDeleteRow = (id: string | number) => {
    if (confirm('Are you sure you want to delete this row?')) {
      onDeleteRow?.(id);
    }
  };

  // Handle add row - adds empty row inline and enters edit mode
  const handleStartAddRow = () => {
    // Generate temporary ID for the new row
    const tempId = `temp_${Date.now()}`;

    // Create empty row with default values
    const newRow: SettingsRecord = {
      id: tempId,
      name: '',
      descr: '',
      parent_id: null,
      color_code: 'blue'
    };

    // Add to data and enter edit mode
    onAddRow?.(newRow);

    // Note: Parent should add this to data array and trigger edit mode
  };

  const handleSaveNewRow = () => {
    // This is now handled by the regular save flow
    setIsAddingRow(false);
    setNewRowData({
      name: '',
      descr: '',
      parent_id: null,
      color_code: 'blue'
    });
  };

  const handleCancelAddRow = () => {
    setIsAddingRow(false);
    setNewRowData({
      name: '',
      descr: '',
      parent_id: null,
      color_code: 'blue'
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!allowReorder) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!allowReorder || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    if (!allowReorder) return;
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!allowReorder || draggedIndex === null) return;
    e.preventDefault();

    if (draggedIndex !== dropIndex) {
      const newData = [...sortedData];
      const draggedItem = newData[draggedIndex];
      newData.splice(draggedIndex, 1);
      newData.splice(dropIndex, 0, draggedItem);
      onReorder?.(newData);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    if (!allowReorder) return;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Column definitions
  const columns = [
    { key: 'id', title: 'ID', sortable: true, width: '80px', align: 'center' as const },
    { key: 'name', title: 'Name', sortable: true, editable: true },
    { key: 'descr', title: 'Description', sortable: true, editable: true },
    { key: 'parent_id', title: 'Parent ID', sortable: true, width: '100px', align: 'center' as const, editable: true },
    { key: 'color_code', title: 'Color', sortable: true, width: '120px', align: 'center' as const, editable: true },
    ...((allowEdit || allowDelete) ? [{ key: 'actions', title: 'Actions', sortable: false, width: '100px', align: 'center' as const }] : []),
  ];

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  col.sortable && !allowReorder ? 'cursor-pointer hover:bg-gray-100' : ''
                } transition-colors`}
                style={{ width: col.width, textAlign: col.align || 'left' }}
                onClick={() => col.sortable && !allowReorder && handleSort(col.key)}
              >
                <div className="flex items-center gap-2">
                  <span>{col.title}</span>
                  {col.sortable && !allowReorder && sortField === col.key && (
                    sortDirection === 'asc' ?
                      <ChevronUp className="h-4 w-4" /> :
                      <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedData.map((record, index) => {
            const isEditing = editingRowId === record.id;
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <React.Fragment key={record.id}>
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
                  } ${allowReorder && !isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  draggable={allowReorder && !isEditing}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  {columns.map((col) => {
                    const value = record[col.key as keyof SettingsRecord];
                    const editValue = editingData[col.key as keyof SettingsRecord] ?? value;

                    return (
                      <td
                        key={col.key}
                        className="px-6 py-2.5 whitespace-nowrap"
                        style={{ textAlign: col.align || 'left' }}
                      >
                        {/* ID Column */}
                        {col.key === 'id' && (
                          <span className="text-sm text-gray-900">{value}</span>
                        )}

                        {/* Name Column */}
                        {col.key === 'name' && (
                          <>
                            {isEditing ? (
                              <input
                                type="text"
                                value={String(editValue || '')}
                                onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 text-sm"
                                placeholder="Enter name"
                              />
                            ) : (
                              renderColorBadge(record.color_code, String(value))
                            )}
                          </>
                        )}

                        {/* Description Column */}
                        {col.key === 'descr' && (
                          <>
                            {isEditing ? (
                              <input
                                type="text"
                                value={String(editValue || '')}
                                onChange={(e) => setEditingData({ ...editingData, descr: e.target.value })}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 text-sm"
                                placeholder="Enter description"
                              />
                            ) : (
                              <span className="text-sm text-gray-700">{value || '-'}</span>
                            )}
                          </>
                        )}

                        {/* Parent ID Column */}
                        {col.key === 'parent_id' && (
                          <>
                            {isEditing ? (
                              <input
                                type="number"
                                value={editValue ?? ''}
                                onChange={(e) => setEditingData({ ...editingData, parent_id: e.target.value ? Number(e.target.value) : null })}
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 text-sm text-center"
                                placeholder="Parent ID"
                              />
                            ) : (
                              <span className="text-sm text-gray-900">{value ?? '-'}</span>
                            )}
                          </>
                        )}

                        {/* Color Code Column */}
                        {col.key === 'color_code' && (
                          <>
                            {isEditing ? (
                              <ColoredDropdown
                                value={String(editValue)}
                                options={COLOR_OPTIONS}
                                onChange={(newValue) => setEditingData({ ...editingData, color_code: newValue })}
                              />
                            ) : (
                              renderColorBadge(String(value), String(value).charAt(0).toUpperCase() + String(value).slice(1))
                            )}
                          </>
                        )}

                        {/* Actions Column */}
                        {col.key === 'actions' && (
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="Save"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                {allowEdit && (
                                  <button
                                    onClick={() => handleStartEdit(record)}
                                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                )}
                                {allowDelete && (
                                  <button
                                    onClick={() => handleDeleteRow(record.id)}
                                    className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
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
      {sortedData.length === 0 && !allowAddRow && (
        <div className="text-center py-12 text-gray-500">
          No data available
        </div>
      )}

      {/* Add Row Button - Adds inline editable row */}
      {allowAddRow && (
        <div className="border-t border-gray-200 bg-white">
          <button
            onClick={handleStartAddRow}
            className="w-full px-6 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add new row</span>
          </button>
        </div>
      )}
    </div>
  );
}
