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
 * - EntitySpecificInstancePage for metadata field
 * - EntitySpecificInstancePage for quote_items field
 * - Any other entity with JSONB array attributes
 *
 * Different from EntityListOfInstancesTable and SettingsDataTable:
 * - EntityListOfInstancesTable: Full entities with pagination, filters, API calls
 * - SettingsDataTable: Fixed schema for settings/datalabel management
 * - EntityAttributeInlineDataTable: Generic JSON attributes, configurable schema
 */
import React, { useState } from 'react';
import { DataTableBase, ActionButtons } from './DataTableBase';
/**
 * Main Entity Attribute Inline Data Table Component
 * Generic table for JSON attributes with configurable columns
 */
export function EntityAttributeInlineDataTable({ data, columns, onRowUpdate, onAddRow, onDeleteRow, onReorder, renderCell: customRenderCell, getDefaultNewRow, allowAddRow = false, allowEdit = true, allowDelete = false, allowReorder = false, emptyMessage = 'No items' }) {
    const [sortField, setSortField] = useState('');
    const [sortDirection, setSortDirection] = useState('asc');
    const [editingRowIndex, setEditingRowIndex] = useState(null);
    const [editingData, setEditingData] = useState({});
    // Drag and drop state
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    // Add action column if edit or delete is enabled
    const displayColumns = [
        ...columns,
        ...(allowEdit || allowDelete ? [{ key: '_actions', title: 'Actions', sortable: false, width: '100px', align: 'center' }] : []),
    ];
    // Handle sort
    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        }
        else {
            setSortField(field);
            setSortDirection('asc');
        }
    };
    // Sort data
    // IMPORTANT: When allowReorder is true, display in array position order (no sorting)
    const sortedData = allowReorder || !sortField ? [...data] : [...data].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal == null)
            return 1;
        if (bVal == null)
            return -1;
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
    });
    // Handle edit row
    const handleStartEdit = (record, index) => {
        setEditingRowIndex(index);
        setEditingData({ ...record });
    };
    const handleSaveEdit = () => {
        if (editingRowIndex === null)
            return;
        // Send all updates in ONE call
        onRowUpdate?.(editingRowIndex, editingData);
        setEditingRowIndex(null);
        setEditingData({});
    };
    const handleCancelEdit = () => {
        setEditingRowIndex(null);
        setEditingData({});
    };
    const handleDeleteRow = (record, index) => {
        if (!confirm('Are you sure you want to delete this row?')) {
            return;
        }
        onDeleteRow?.(index);
    };
    // Drag and drop handlers
    const handleDragStart = (e, index) => {
        if (!allowReorder)
            return;
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e, index) => {
        if (!allowReorder || draggedIndex === null)
            return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (index !== dragOverIndex) {
            setDragOverIndex(index);
        }
    };
    const handleDragLeave = () => {
        if (!allowReorder)
            return;
        setDragOverIndex(null);
    };
    const handleDrop = (e, dropIndex) => {
        if (!allowReorder || draggedIndex === null)
            return;
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
        if (!allowReorder)
            return;
        setDraggedIndex(null);
        setDragOverIndex(null);
    };
    // Default cell renderer (fallback if no custom renderer provided)
    const defaultRenderCell = (column, record, isEditing, onUpdate) => {
        const value = record[column.key];
        const editValue = editingData[column.key] ?? value;
        if (column.key === '_actions') {
            return null; // Actions handled separately
        }
        if (isEditing) {
            return (React.createElement("input", { type: "text", value: String(editValue || ''), onChange: (e) => onUpdate(column.key, e.target.value), className: "w-full px-2 py-1 border border-dark-400 rounded focus:ring-2 focus:ring-dark-700/30 focus:border-dark-500 text-sm", placeholder: `Enter ${column.title.toLowerCase()}` }));
        }
        return React.createElement("span", { className: "text-sm text-dark-600" }, value ?? '-');
    };
    // Cell renderer wrapper
    const renderCellWrapper = (column, record, index) => {
        const isEditing = editingRowIndex === index;
        const onUpdate = (field, value) => {
            setEditingData({ ...editingData, [field]: value });
        };
        if (customRenderCell) {
            return customRenderCell(column, record, isEditing, onUpdate);
        }
        return defaultRenderCell(column, record, isEditing, onUpdate);
    };
    // Render action buttons (Edit/Delete)
    const renderActions = (record, index) => {
        const isEditing = editingRowIndex === index;
        if (isEditing) {
            return (React.createElement(ActionButtons, { record: record, onEdit: allowEdit ? () => handleStartEdit(record, index) : undefined, onDelete: allowDelete ? () => handleDeleteRow(record, index) : undefined, allowEdit: allowEdit, allowDelete: allowDelete }));
        }
        return (React.createElement(ActionButtons, { record: record, onEdit: allowEdit ? () => handleStartEdit(record, index) : undefined, onDelete: allowDelete ? () => handleDeleteRow(record, index) : undefined, allowEdit: allowEdit, allowDelete: allowDelete }));
    };
    // If no data and not in add mode, show empty message
    if (data.length === 0 && !allowAddRow) {
        return (React.createElement("div", { className: "text-center py-8 text-dark-600 text-sm" }, emptyMessage));
    }
    return (React.createElement(DataTableBase, { data: sortedData, columns: displayColumns, renderCell: (column, record) => {
            const index = data.indexOf(record);
            return renderCellWrapper(column, record, index);
        }, renderActions: (record) => {
            const index = data.indexOf(record);
            return renderActions(record, index);
        }, sortField: sortField, sortDirection: sortDirection, editingRowId: editingRowIndex, isAddingRow: false, onSort: handleSort, getRowKey: (record, index) => String(index), onStartEdit: (record) => {
            const index = data.indexOf(record);
            handleStartEdit(record, index);
        }, onSaveEdit: handleSaveEdit, onCancelEdit: handleCancelEdit, allowAddRow: allowAddRow, onStartAddRow: () => {
            const newRow = getDefaultNewRow ? getDefaultNewRow() : {};
            onAddRow?.(newRow);
            setEditingRowIndex(data.length); // Edit the newly added row
            setEditingData(newRow);
        }, allowReordering: allowReorder, onDragStart: handleDragStart, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, onDragEnd: handleDragEnd, draggedIndex: draggedIndex, dragOverIndex: dragOverIndex }));
}
