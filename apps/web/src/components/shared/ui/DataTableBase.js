/**
 * ============================================================================
 * DATA TABLE BASE - Shared base component for all data table types
 * ============================================================================
 *
 * Common functionality for EntityListOfInstancesTable and SettingsDataTable:
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
import { EllipsisBounce } from './EllipsisBounce';
export function DataTableBase({ data, columns, renderCell, renderEditingActions, renderActions, sortField, sortDirection, editingRowId, isAddingRow, onSort, onRowClick, getRowKey, onStartEdit, onSaveEdit, onCancelEdit, allowAddRow = false, onStartAddRow, onSaveAddRow, onCancelAddRow, renderAddRowForm, onDelete, allowReordering = false, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, draggedIndex = null, dragOverIndex = null, className = '', loading = false, }) {
    const renderSortIcon = (field) => {
        if (sortField !== field)
            return null;
        return sortDirection === 'asc' ?
            React.createElement(ChevronUp, { className: "h-4 w-4" }) :
            React.createElement(ChevronDown, { className: "h-4 w-4" });
    };
    if (loading) {
        return (React.createElement("div", { className: "bg-dark-100 rounded-md shadow-sm border border-dark-300" },
            React.createElement("div", { className: "flex items-center justify-center py-12" },
                React.createElement(EllipsisBounce, { size: "md", text: "Loading data" }))));
    }
    return (React.createElement("div", { className: `border border-dark-300 rounded-md ${className}` },
        React.createElement("div", { className: "overflow-x-auto" },
            React.createElement("table", { className: "min-w-full divide-y divide-dark-400" },
                React.createElement("thead", { className: "bg-dark-100" },
                    React.createElement("tr", null, columns.map((col) => (React.createElement("th", { key: col.key, className: `px-6 py-3 text-left text-xs font-medium text-dark-700 uppercase tracking-wider ${col.sortable && !allowReordering ? 'cursor-pointer hover:bg-dark-100' : ''} transition-colors`, style: { width: col.width, textAlign: col.align || 'left' }, onClick: () => col.sortable && !allowReordering && onSort(col.key) },
                        React.createElement("div", { className: "flex items-center gap-2" },
                            React.createElement("span", null, col.title),
                            col.sortable && !allowReordering && renderSortIcon(col.key))))))),
                React.createElement("tbody", { className: "bg-dark-100 divide-y divide-dark-400" }, data.map((record, index) => {
                    const rowKey = getRowKey(record, index);
                    const isEditing = editingRowId === rowKey;
                    const isDragging = draggedIndex === index;
                    const isDragOver = dragOverIndex === index;
                    return (React.createElement(React.Fragment, { key: rowKey },
                        isDragOver && draggedIndex !== null && (React.createElement("tr", { className: "relative pointer-events-none" },
                            React.createElement("td", { colSpan: columns.length, className: "p-0 h-0" },
                                React.createElement("div", { className: "absolute left-0 right-0 h-1 bg-dark-1000 shadow-sm z-50", style: { top: '-2px' } })))),
                        React.createElement("tr", { className: `transition-all ${isDragging ? 'opacity-40 bg-dark-100' :
                                isEditing ? 'bg-dark-100' :
                                    'hover:bg-dark-100'} ${allowReordering && !isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`, draggable: allowReordering && !isEditing, onDragStart: (e) => onDragStart?.(e, index), onDragOver: (e) => onDragOver?.(e, index), onDragLeave: onDragLeave, onDrop: (e) => onDrop?.(e, index), onDragEnd: onDragEnd, onClick: () => !isEditing && onRowClick?.(record) }, columns.map((column) => {
                            // Special handling for actions column
                            if (column.key === '_actions') {
                                return (React.createElement("td", { key: column.key, className: "px-6 py-2.5 whitespace-nowrap", style: { textAlign: column.align || 'center' } }, isEditing ? (React.createElement("div", { className: "flex items-center justify-center gap-1" },
                                    React.createElement("button", { onClick: (e) => {
                                            e.stopPropagation();
                                            onSaveEdit?.(record);
                                        }, className: "p-1.5 text-dark-700 hover:text-dark-600 hover:bg-dark-100 rounded transition-colors", title: "Save" },
                                        React.createElement(Check, { className: "h-4 w-4" })),
                                    React.createElement("button", { onClick: (e) => {
                                            e.stopPropagation();
                                            onCancelEdit?.();
                                        }, className: "p-1.5 text-dark-700 hover:text-dark-600 hover:bg-dark-100 rounded transition-colors", title: "Cancel" },
                                        React.createElement(X, { className: "h-4 w-4" })),
                                    renderEditingActions?.(record))) : (renderActions?.(record, isEditing))));
                            }
                            // Regular columns
                            return (React.createElement("td", { key: column.key, className: "px-6 py-2.5 whitespace-nowrap", style: { textAlign: column.align || 'left' } }, renderCell(column, record, isEditing)));
                        }))));
                }))),
            data.length === 0 && !allowAddRow && (React.createElement("div", { className: "text-center py-12 text-dark-700" }, "No data available"))),
        allowAddRow && (React.createElement("div", { className: "border-t border-dark-300 bg-dark-100" }, !isAddingRow ? (React.createElement("button", { onClick: onStartAddRow, className: "w-full px-6 py-3.5 text-left text-sm font-medium text-dark-700 hover:bg-dark-100 hover:text-dark-700 transition-colors flex items-center gap-2 group" },
            React.createElement("div", { className: "flex items-center justify-center w-6 h-6 rounded-full bg-dark-100 group-hover:bg-dark-200 transition-colors" },
                React.createElement(Plus, { className: "h-4 w-4" })),
            React.createElement("span", null, "Add new row"))) : (React.createElement("div", { className: "p-4" },
            renderAddRowForm?.(),
            React.createElement("div", { className: "flex items-center gap-2 mt-4" },
                React.createElement("button", { onClick: onSaveAddRow, className: "flex items-center gap-2 px-4 py-2 border border-dark-400 text-dark-600 bg-dark-100 rounded-md hover:bg-dark-100 hover:border-dark-500 transition-colors text-sm shadow-sm" },
                    React.createElement(Check, { className: "h-4 w-4" }),
                    "Save"),
                React.createElement("button", { onClick: onCancelAddRow, className: "flex items-center gap-2 px-4 py-2 border border-dark-400 text-dark-700 bg-dark-100 rounded-md hover:bg-dark-100 hover:border-dark-500 transition-colors text-sm" },
                    React.createElement(X, { className: "h-4 w-4" }),
                    "Cancel"))))))));
}
export function ActionButtons({ record, onEdit, onDelete, allowEdit = true, allowDelete = false, }) {
    return (React.createElement("div", { className: "flex items-center justify-center gap-1" },
        allowEdit && onEdit && (React.createElement("button", { onClick: (e) => {
                e.stopPropagation();
                onEdit(record);
            }, className: "p-1.5 text-dark-700 hover:text-dark-600 hover:bg-dark-100 rounded transition-colors", title: "Edit" },
            React.createElement(Edit, { className: "h-4 w-4" }))),
        allowDelete && onDelete && (React.createElement("button", { onClick: (e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this row?')) {
                    onDelete(record);
                }
            }, className: "p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors", title: "Delete" },
            React.createElement(Trash2, { className: "h-4 w-4" })))));
}
