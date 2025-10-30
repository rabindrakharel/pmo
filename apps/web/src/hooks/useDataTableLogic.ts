/**
 * ============================================================================
 * useDataTableLogic - Shared state management for data tables
 * ============================================================================
 *
 * Common logic for EntityDataTable and SettingsDataTable:
 * - Sorting state
 * - Editing state
 * - Add row state
 * - Drag and drop state
 */

import { useState } from 'react';

export interface UseDataTableLogicOptions {
  initialSortField?: string;
  initialSortDirection?: 'asc' | 'desc';
  allowReordering?: boolean;
}

export function useDataTableLogic<T = any>(options: UseDataTableLogicOptions = {}) {
  const {
    initialSortField = '',
    initialSortDirection = 'asc',
    allowReordering = false,
  } = options;

  // Sorting state
  const [sortField, setSortField] = useState<string>(initialSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);

  // Editing state
  const [editingRowId, setEditingRowId] = useState<string | number | null>(null);
  const [editingData, setEditingData] = useState<Partial<T>>({});

  // Add row state
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Partial<T>>({});

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

  // Handle edit
  const handleStartEdit = (record: T, rowId: string | number) => {
    setEditingRowId(rowId);
    setEditingData({ ...record });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditingData({});
  };

  const handleFieldEdit = (field: keyof T, value: any) => {
    setEditingData({ ...editingData, [field]: value });
  };

  // Handle add row
  const handleStartAddRow = (defaultData: Partial<T> = {}) => {
    setIsAddingRow(true);
    setNewRowData(defaultData);
  };

  const handleCancelAddRow = () => {
    setIsAddingRow(false);
    setNewRowData({});
  };

  const handleAddRowFieldEdit = (field: keyof T, value: any) => {
    setNewRowData({ ...newRowData, [field]: value });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!allowReordering) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!allowReordering || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    if (!allowReordering) return;
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, data: T[], onReorder: (newData: T[]) => void) => {
    if (!allowReordering || draggedIndex === null) return;
    e.preventDefault();

    if (draggedIndex !== dropIndex) {
      const newData = [...data];
      const draggedItem = newData[draggedIndex];
      newData.splice(draggedIndex, 1);
      newData.splice(dropIndex, 0, draggedItem);
      onReorder(newData);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    if (!allowReordering) return;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Sort data utility
  const sortData = <T extends Record<string, any>>(data: T[]): T[] => {
    // When allowReorder is true, display in array position order (no sorting)
    if (allowReordering || !sortField) {
      return [...data];
    }

    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  return {
    // Sorting
    sortField,
    sortDirection,
    handleSort,
    sortData,

    // Editing
    editingRowId,
    editingData,
    handleStartEdit,
    handleCancelEdit,
    handleFieldEdit,
    setEditingRowId,
    setEditingData,

    // Add row
    isAddingRow,
    newRowData,
    handleStartAddRow,
    handleCancelAddRow,
    handleAddRowFieldEdit,
    setNewRowData,

    // Drag and drop
    draggedIndex,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
