/**
 * ============================================================================
 * ENTITY ATTRIBUTE INLINE DATA TABLE - Generic table for JSON attributes
 * ============================================================================
 *
 * Purpose: Universal inline-editable table for JSONB/JSON attributes
 * Based on SettingsDataTable but generalized for any JSON structure
 *
 * ⚠️ IMPORTANT: This component is designed ONLY for JSON attributes, not full entities
 *
 * Use Cases:
 * ✓ metadata JSONB field (key-value pairs)
 * ✓ quote_items JSONB field (array of line items)
 * ✓ Any other JSONB array field that needs inline editing
 *
 * Key Features:
 * ✓ Configurable columns (via props)
 * ✓ Inline editing for all fields
 * ✓ Drag-and-drop reordering (optional)
 * ✓ Inline row addition with "+" button
 * ✓ Custom cell renderers (via renderCell prop)
 * ✓ Supports both simple types (text, number) and complex (select, multiselect)
 *
 * Architecture:
 * - Extends DataTableBase (React composition pattern)
 * - Accepts dynamic column configuration
 * - Configurable cell rendering via props
 * - No assumptions about data schema
 *
 * Used by:
 * - EntityDetailPage for metadata field
 * - EntityDetailPage for quote_items field
 * - Any other entity with JSONB array attributes
 *
 * Different from EntityDataTable and SettingsDataTable:
 * - EntityDataTable: Full entities with pagination, filters, API calls
 * - SettingsDataTable: Fixed schema for settings/datalabel management
 * - EntityAttributeInlineDataTable: Generic JSON attributes, configurable schema
 */

import React, { useState } from 'react';
import { DataTableBase, ActionButtons, type BaseColumn } from './DataTableBase';

export interface AttributeRecord {
  [key: string]: any;  // Generic record structure
}

export interface EntityAttributeInlineDataTableProps {
  data: AttributeRecord[];
  columns: BaseColumn[];
  onRowUpdate?: (index: number, updates: Partial<AttributeRecord>) => void;
  onAddRow?: (newRecord: Partial<AttributeRecord>) => void;
  onDeleteRow?: (index: number) => void;
  onReorder?: (reorderedData: AttributeRecord[]) => void;
  renderCell?: (column: BaseColumn, record: AttributeRecord, isEditing: boolean, onUpdate: (field: string, value: any) => void) => React.ReactNode;
  getDefaultNewRow?: () => Partial<AttributeRecord>;
  allowAddRow?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowReorder?: boolean;
  emptyMessage?: string;
}

/**
 * Main Entity Attribute Inline Data Table Component
 * Generic table for JSON attributes with configurable columns
 */
export function EntityAttributeInlineDataTable({
  data,
  columns,
  onRowUpdate,
  onAddRow,
  onDeleteRow,
  onReorder,
  renderCell: customRenderCell,
  getDefaultNewRow,
  allowAddRow = false,
  allowEdit = true,
  allowDelete = false,
  allowReorder = false,
  emptyMessage = 'No items'
}: EntityAttributeInlineDataTableProps) {
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<Partial<AttributeRecord>>({});

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Add action column if edit or delete is enabled
  const displayColumns: BaseColumn[] = [
    ...columns,
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
  const sortedData = allowReorder || !sortField ? [...data] : [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal == null) return 1;
    if (bVal == null) return -1;

    const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Handle edit row
  const handleStartEdit = (record: AttributeRecord, index: number) => {
    setEditingRowIndex(index);
    setEditingData({ ...record });
  };

  const handleSaveEdit = () => {
    if (editingRowIndex === null) return;

    // Send all updates in ONE call
    onRowUpdate?.(editingRowIndex, editingData);

    setEditingRowIndex(null);
    setEditingData({});
  };

  const handleCancelEdit = () => {
    setEditingRowIndex(null);
    setEditingData({});
  };

  const handleDeleteRow = (record: AttributeRecord, index: number) => {
    if (!confirm('Are you sure you want to delete this row?')) {
      return;
    }

    onDeleteRow?.(index);
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

  // Default cell renderer (fallback if no custom renderer provided)
  const defaultRenderCell = (column: BaseColumn, record: AttributeRecord, isEditing: boolean, onUpdate: (field: string, value: any) => void): React.ReactNode => {
    const value = record[column.key];
    const editValue = editingData[column.key] ?? value;

    if (column.key === '_actions') {
      return null;  // Actions handled separately
    }

    if (isEditing) {
      return (
        <input
          type="text"
          value={String(editValue || '')}
          onChange={(e) => onUpdate(column.key, e.target.value)}
          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-400/30 focus:border-blue-300 text-sm"
          placeholder={`Enter ${column.title.toLowerCase()}`}
        />
      );
    }

    return <span className="text-sm text-gray-700">{value ?? '-'}</span>;
  };

  // Cell renderer wrapper
  const renderCellWrapper = (column: BaseColumn, record: AttributeRecord, index: number): React.ReactNode => {
    const isEditing = editingRowIndex === index;
    const onUpdate = (field: string, value: any) => {
      setEditingData({ ...editingData, [field]: value });
    };

    if (customRenderCell) {
      return customRenderCell(column, record, isEditing, onUpdate);
    }

    return defaultRenderCell(column, record, isEditing, onUpdate);
  };

  // Render action buttons (Edit/Delete)
  const renderActions = (record: AttributeRecord, index: number): React.ReactNode => {
    const isEditing = editingRowIndex === index;

    if (isEditing) {
      return (
        <ActionButtons
          record={record}
          onEdit={allowEdit ? () => handleStartEdit(record, index) : undefined}
          onDelete={allowDelete ? () => handleDeleteRow(record, index) : undefined}
          allowEdit={allowEdit}
          allowDelete={allowDelete}
        />
      );
    }

    return (
      <ActionButtons
        record={record}
        onEdit={allowEdit ? () => handleStartEdit(record, index) : undefined}
        onDelete={allowDelete ? () => handleDeleteRow(record, index) : undefined}
        allowEdit={allowEdit}
        allowDelete={allowDelete}
      />
    );
  };

  // If no data and not in add mode, show empty message
  if (data.length === 0 && !allowAddRow) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <DataTableBase<AttributeRecord>
      data={sortedData}
      columns={displayColumns}
      renderCell={(column, record) => {
        const index = data.indexOf(record);
        return renderCellWrapper(column, record, index);
      }}
      renderActions={(record) => {
        const index = data.indexOf(record);
        return renderActions(record, index);
      }}
      sortField={sortField}
      sortDirection={sortDirection}
      editingRowId={editingRowIndex}
      isAddingRow={false}
      onSort={handleSort}
      getRowKey={(record, index) => String(index)}
      onStartEdit={(record) => {
        const index = data.indexOf(record);
        handleStartEdit(record, index);
      }}
      onSaveEdit={handleSaveEdit}
      onCancelEdit={handleCancelEdit}
      allowAddRow={allowAddRow}
      onStartAddRow={() => {
        const newRow = getDefaultNewRow ? getDefaultNewRow() : {};
        onAddRow?.(newRow);
        setEditingRowIndex(data.length);  // Edit the newly added row
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
