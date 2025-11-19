/**
 * ============================================================================
 * SETTINGS DATA TABLE - Specialized table for settings/datalabel management
 * ============================================================================
 *
 * Purpose: Dedicated table component for managing settings datalabels
 * Extends DataTableBase with settings-specific rendering and behavior
 * Optimized for the fixed schema: id, name, descr, parent_id, color_code
 *
 * Key Features (Settings-Specific):
 * ✓ Visual color swatches in dropdown (shows actual colors)
 * ✓ Inline editing for all fields
 * ✓ Drag-and-drop reordering (changes database array order)
 * ✓ Inline row addition with prominent "+" button below table
 * ✓ Badge rendering with colors from database
 * ✓ Scrollbar positioned at bottom of container
 * ✓ Simple sorting (no complex filters - settings are small datasets)
 *
 * Architecture:
 * - Extends DataTableBase (React composition pattern)
 * - Provides settings-specific cell rendering
 * - Fixed schema (5 columns: id, name, descr, parent_id, color_code)
 * - No dynamic column configuration needed
 *
 * Used by:
 * - FilteredDataTable when entityCode is a settings entity (e.g., "taskStage")
 * - Routes: /setting/taskStage, /setting/acquisitionChannel, etc.
 * - Entity configs using createSettingsEntityConfig()
 *
 * Different from EntityDataTable:
 * - EntityDataTable: Dynamic columns, filters, pagination, complex entities
 * - SettingsDataTable: Fixed columns, simple sorting, reordering, settings only
 */

import React, { useState } from 'react';
import { DataTableBase, ActionButtons, type BaseColumn } from './DataTableBase';
import { ColoredDropdown, type ColoredDropdownOption } from './ColoredDropdown';
import { renderColorBadge } from '../../../lib/settingsConfig';
import { COLOR_OPTIONS } from '../../../lib/settingsConfig';
import { inputStyles, actionButtonStyles } from '../../../lib/designSystem';

export interface SettingsRecord {
  id: string | number;
  name: string;
  descr?: string;
  parent_id?: number | null;
  color_code: string;
  position?: number;  // Array position from backend
}

export interface SettingsDataTableProps {
  data: SettingsRecord[];
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
 * Main Settings Data Table Component
 * Uses DataTableBase with settings-specific rendering
 */
export function SettingsDataTable({
  data,
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

  // Track new unsaved row IDs (Set of IDs that are new and not yet saved)
  const [newRowIds, setNewRowIds] = useState<Set<string | number>>(new Set());

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Column definitions (fixed for settings)
  const columns: BaseColumn[] = [
    { key: 'id', title: 'ID', sortable: true, width: '80px', align: 'center' },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'descr', title: 'Description', sortable: true },
    { key: 'parent_id', title: 'Parent ID', sortable: true, width: '100px', align: 'center' },
    { key: 'color_code', title: 'Color', sortable: true, width: '120px', align: 'center' },
    ...(allowEdit || allowDelete ? [{ key: '_actions', title: 'Actions', sortable: false, width: '100px', align: 'center' as const }] : []),
  ];

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

  const handleSaveEdit = (record: SettingsRecord) => {
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

    // Send all updates in ONE call
    // Include isNew flag so parent knows if this is a CREATE or UPDATE
    const isNew = newRowIds.has(editingRowId);
    onRowUpdate?.(editingRowId, { ...updates, _isNew: isNew } as any);

    // Remove from newRowIds after successful save
    if (isNew) {
      setNewRowIds(prev => {
        const next = new Set(prev);
        next.delete(editingRowId);
        return next;
      });
    }

    setEditingRowId(null);
    setEditingData({});
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditingData({});
  };

  const handleDeleteRow = (record: SettingsRecord) => {
    if (!confirm('Are you sure you want to delete this row?')) {
      return;
    }

    // Check if this is a new unsaved row
    const isNewRow = newRowIds.has(record.id);

    if (isNewRow) {
      // Just remove from newRowIds tracking - parent will handle data removal
      setNewRowIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }

    // Call parent handler for both new and existing rows
    onDeleteRow?.(record.id);
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

  // Cell renderer for settings-specific rendering
  const renderCell = (column: BaseColumn, record: SettingsRecord, isEditing: boolean): React.ReactNode => {
    const value = record[column.key as keyof SettingsRecord];
    const editValue = editingData[column.key as keyof SettingsRecord] ?? value;

    switch (column.key) {
      case 'id':
        return <span className="text-sm text-dark-600">{value}</span>;

      case 'name':
        return isEditing ? (
          <input
            type="text"
            value={String(editValue || '')}
            onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
            className={inputStyles.inline}
            placeholder="Enter name"
            autoFocus
          />
        ) : (
          renderColorBadge(record.color_code, String(value))
        );

      case 'descr':
        return isEditing ? (
          <input
            type="text"
            value={String(editValue || '')}
            onChange={(e) => setEditingData({ ...editingData, descr: e.target.value })}
            className={inputStyles.inline}
            placeholder="Enter description"
          />
        ) : (
          <span className="text-sm text-dark-700">{value || '-'}</span>
        );

      case 'parent_id':
        return isEditing ? (
          <input
            type="number"
            value={editValue ?? ''}
            onChange={(e) => setEditingData({ ...editingData, parent_id: e.target.value ? Number(e.target.value) : null })}
            className={`${inputStyles.inline} text-center`}
            placeholder="Parent ID"
          />
        ) : (
          <span className="text-sm text-dark-700 font-mono">{value ?? '-'}</span>
        );

      case 'color_code':
        return isEditing ? (
          <ColoredDropdown
            value={String(editValue)}
            options={COLOR_OPTIONS as ColoredDropdownOption[]}
            onChange={(newValue) => setEditingData({ ...editingData, color_code: newValue })}
            placeholder="Select color..."
          />
        ) : (
          renderColorBadge(String(value), String(value).charAt(0).toUpperCase() + String(value).slice(1))
        );

      default:
        return null;
    }
  };

  // Render action buttons (Edit/Delete)
  const renderActions = (record: SettingsRecord, isEditing: boolean): React.ReactNode => {
    return (
      <ActionButtons
        record={record}
        onEdit={allowEdit ? handleStartEdit : undefined}
        onDelete={allowDelete ? handleDeleteRow : undefined}
        allowEdit={allowEdit}
        allowDelete={allowDelete}
      />
    );
  };

  return (
    <DataTableBase<SettingsRecord>
      data={sortedData}
      columns={columns}
      renderCell={renderCell}
      renderActions={renderActions}
      sortField={sortField}
      sortDirection={sortDirection}
      editingRowId={editingRowId}
      isAddingRow={isAddingRow}
      onSort={handleSort}
      getRowKey={(record) => String(record.id)}
      onStartEdit={handleStartEdit}
      onSaveEdit={handleSaveEdit}
      onCancelEdit={handleCancelEdit}
      allowAddRow={allowAddRow}
      onStartAddRow={() => {
        // Generate next sequential ID based on current data length
        // This shows the actual ID number that will be assigned by backend
        const nextId = data.length;
        const nextIdStr = String(nextId);

        // Create empty row with default values
        const newRow: SettingsRecord = {
          id: nextIdStr,  // "0", "1", "2", etc. - actual ID numbers!
          name: '',
          descr: '',
          parent_id: null,
          color_code: 'blue'
        };

        // IMPORTANT: Track this as a new unsaved row
        setNewRowIds(prev => new Set([...prev, nextIdStr]));

        // Add to data and enter edit mode
        onAddRow?.(newRow);
        setEditingRowId(nextIdStr);
        setEditingData(newRow);
      }}
      allowReordering={allowReorder}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      draggedIndex={draggedIndex}
      dragOverIndex={dragOverIndex}
    />
  );
}
