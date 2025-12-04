# Component Decomposition Guide

**Priority:** CRITICAL
**Estimated Effort:** 4-6 weeks
**Impact:** Maintainability, Performance, Testability

---

## The Problem

`EntityListOfInstancesTable.tsx` is approximately **29,000 lines**. This is 50-100x larger than industry-standard component sizes.

### Why This Matters

| Issue | Impact |
|-------|--------|
| Mental Load | Impossible for developers to understand |
| Debugging | Finding bugs is like finding a needle in a haystack |
| Testing | Cannot unit test - only integration tests possible |
| Tree-Shaking | Entire component included even if using 1% |
| Hot Reload | Changes trigger full recompile of 29K lines |
| Code Reviews | PRs touching this file are unreviewa |
| Re-renders | Any state change re-renders entire component |

---

## Target Architecture

### Directory Structure

```
apps/web/src/components/shared/ui/DataTable/
├── index.ts                          # Public API exports
├── DataTable.tsx                     # Main coordinator (100-150 lines)
├── DataTableContext.tsx              # Shared context provider
├── types.ts                          # All type definitions
│
├── hooks/
│   ├── index.ts                      # Hook exports
│   ├── useDataTableState.ts          # Core table state
│   ├── useColumns.ts                 # Column management
│   ├── useSorting.ts                 # Sort state & handlers
│   ├── useFiltering.ts               # Filter state & handlers
│   ├── usePagination.ts              # Pagination state
│   ├── useSelection.ts               # Row selection
│   ├── useVirtualization.ts          # Virtual scrolling
│   ├── useInlineCellEdit.ts          # Cell editing
│   ├── useInlineRowEdit.ts           # Row editing
│   ├── useInlineAddRow.ts            # Add new row (exists!)
│   ├── useUndoRedo.ts                # Undo/redo stack
│   ├── useKeyboardNavigation.ts      # Keyboard handlers
│   ├── useDragAndDrop.ts             # Row reordering
│   └── useScrollSync.ts              # Scrollbar sync
│
├── components/
│   ├── index.ts                      # Component exports
│   ├── Header/
│   │   ├── TableHeader.tsx           # Header container
│   │   ├── HeaderCell.tsx            # Single header cell
│   │   ├── SortIndicator.tsx         # Sort direction arrow
│   │   └── ResizeHandle.tsx          # Column resize
│   ├── Body/
│   │   ├── TableBody.tsx             # Body with virtualization
│   │   ├── VirtualRow.tsx            # Virtualized row
│   │   ├── TableRow.tsx              # Row container
│   │   └── TableCell.tsx             # Cell wrapper
│   ├── Cells/
│   │   ├── CellRenderer.tsx          # Cell type router
│   │   ├── TextCell.tsx              # Text display/edit
│   │   ├── CurrencyCell.tsx          # Currency display/edit
│   │   ├── BadgeCell.tsx             # Badge/datalabel
│   │   ├── DateCell.tsx              # Date display/edit
│   │   ├── ReferenceCell.tsx         # Entity reference
│   │   ├── BooleanCell.tsx           # Checkbox
│   │   └── EditableCell.tsx          # Edit mode wrapper
│   ├── Toolbar/
│   │   ├── TableToolbar.tsx          # Toolbar container
│   │   ├── SearchInput.tsx           # Search box
│   │   ├── FilterDropdown.tsx        # Filter panel
│   │   ├── ColumnSelector.tsx        # Column visibility
│   │   └── FilterChips.tsx           # Active filter chips
│   ├── Footer/
│   │   ├── TableFooter.tsx           # Footer container
│   │   ├── Pagination.tsx            # Page controls
│   │   ├── PageSizeSelector.tsx      # Items per page
│   │   └── RowCount.tsx              # Total count display
│   ├── AddRow/
│   │   ├── AddRowButton.tsx          # "+ Add row" trigger
│   │   ├── AddRowForm.tsx            # Inline form
│   │   └── AddRowCell.tsx            # Cell in add mode
│   ├── Actions/
│   │   ├── RowActions.tsx            # Action menu
│   │   ├── ActionButton.tsx          # Single action
│   │   └── BulkActions.tsx           # Multi-select actions
│   └── Loading/
│       ├── TableSkeleton.tsx         # Loading skeleton
│       ├── RowSkeleton.tsx           # Single row skeleton
│       └── CellSkeleton.tsx          # Cell placeholder
│
├── utils/
│   ├── sorting.ts                    # Sort utilities
│   ├── filtering.ts                  # Filter utilities
│   ├── formatting.ts                 # Format helpers
│   └── keyboard.ts                   # Keyboard helpers
│
└── __tests__/
    ├── DataTable.test.tsx
    ├── hooks/
    │   ├── useInlineCellEdit.test.ts
    │   └── useSorting.test.ts
    └── components/
        ├── EditableCell.test.tsx
        └── AddRowForm.test.tsx
```

---

## Step-by-Step Extraction Guide

### Phase 1: Extract Types

```typescript
// types.ts - All type definitions in one place
export interface Column<T = any> {
  key: string;
  title: string;
  visible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  editType?: string;
  lookupSourceTable?: 'datalabel' | 'entityInstance';
  lookupEntity?: string;
  lookupField?: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, record: T) => React.ReactNode;
}

export interface EditingCell {
  rowId: string;
  columnKey: string;
}

export interface DataTableState<T> {
  data: T[];
  columns: Column<T>[];
  visibleColumns: Set<string>;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  filters: Record<string, string[]>;
  searchTerm: string;
  selectedRows: Set<string>;
  editingCell: EditingCell | null;
  editingRow: string | null;
  isAddingRow: boolean;
  focusedRowId: string | null;
}

export interface DataTableCallbacks<T> {
  onRowClick?: (record: T) => void;
  onCellSave?: (rowId: string, columnKey: string, value: any, record: T) => void;
  onRowSave?: (record: T) => void;
  onAddRow?: (newRecord: Partial<T>) => void;
  onDelete?: (record: T) => void;
  onSelectionChange?: (selectedRows: string[]) => void;
}
```

### Phase 2: Create Context

```typescript
// DataTableContext.tsx
import { createContext, useContext, useReducer, useMemo } from 'react';
import type { DataTableState, DataTableCallbacks, Column } from './types';

interface DataTableContextValue<T> extends DataTableState<T>, DataTableCallbacks<T> {
  // State setters
  setVisibleColumns: (columns: Set<string>) => void;
  setSortField: (field: string) => void;
  setSortDirection: (dir: 'asc' | 'desc') => void;
  setEditingCell: (cell: EditingCell | null) => void;
  setEditingRow: (rowId: string | null) => void;
  setIsAddingRow: (adding: boolean) => void;
  setFocusedRowId: (rowId: string | null) => void;

  // Derived values
  visibleColumnList: Column<T>[];
  sortedData: T[];
  filteredData: T[];

  // Metadata
  metadata: ComponentMetadata | null;
}

const DataTableContext = createContext<DataTableContextValue<any> | null>(null);

export function useDataTable<T = any>() {
  const context = useContext(DataTableContext);
  if (!context) {
    throw new Error('useDataTable must be used within DataTableProvider');
  }
  return context as DataTableContextValue<T>;
}

export function DataTableProvider<T>({
  children,
  data,
  columns,
  metadata,
  ...callbacks
}: {
  children: React.ReactNode;
  data: T[];
  columns: Column<T>[];
  metadata: ComponentMetadata | null;
} & DataTableCallbacks<T>) {
  // State reducer for complex state management
  const [state, dispatch] = useReducer(dataTableReducer, initialState);

  // Memoized derived values
  const visibleColumnList = useMemo(
    () => columns.filter(c => state.visibleColumns.has(c.key)),
    [columns, state.visibleColumns]
  );

  const value = useMemo(() => ({
    ...state,
    ...callbacks,
    data,
    columns,
    metadata,
    visibleColumnList,
    // ... setters that dispatch actions
  }), [state, data, columns, metadata, callbacks]);

  return (
    <DataTableContext.Provider value={value}>
      {children}
    </DataTableContext.Provider>
  );
}
```

### Phase 3: Extract Hooks (One Per Concern)

```typescript
// hooks/useInlineCellEdit.ts
import { useState, useCallback, useRef } from 'react';

interface UseCellEditOptions {
  onSave?: (rowId: string, columnKey: string, value: any) => void;
  onCancel?: () => void;
}

export function useInlineCellEdit(options: UseCellEditOptions = {}) {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnKey: string;
  } | null>(null);
  const [cellValue, setCellValue] = useState<any>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  const startEdit = useCallback((rowId: string, columnKey: string, currentValue: any) => {
    setEditingCell({ rowId, columnKey });
    setCellValue(currentValue);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingCell && options.onSave) {
      options.onSave(editingCell.rowId, editingCell.columnKey, cellValue);
    }
    setEditingCell(null);
    setCellValue(null);
  }, [editingCell, cellValue, options.onSave]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setCellValue(null);
    options.onCancel?.();
  }, [options.onCancel]);

  const handleLongPress = useCallback((
    rowId: string,
    columnKey: string,
    currentValue: any
  ) => {
    longPressTimer.current = setTimeout(() => {
      startEdit(rowId, columnKey, currentValue);
    }, 500);
  }, [startEdit]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const isEditing = useCallback((rowId: string, columnKey: string) => {
    return editingCell?.rowId === rowId && editingCell?.columnKey === columnKey;
  }, [editingCell]);

  return {
    editingCell,
    cellValue,
    setCellValue,
    startEdit,
    saveEdit,
    cancelEdit,
    handleLongPress,
    cancelLongPress,
    isEditing,
  };
}
```

```typescript
// hooks/useVirtualization.ts
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface UseVirtualizationOptions {
  rowCount: number;
  rowHeight?: number;
  overscan?: number;
}

export function useVirtualization({
  rowCount,
  rowHeight = 40,
  overscan = 5,
}: UseVirtualizationOptions) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  return {
    parentRef,
    virtualizer,
    virtualRows: virtualizer.getVirtualItems(),
    totalHeight: virtualizer.getTotalSize(),
  };
}
```

### Phase 4: Extract Components

```typescript
// components/Cells/EditableCell.tsx
import { useDataTable } from '../../DataTableContext';
import { useRef, useEffect } from 'react';

interface EditableCellProps {
  rowId: string;
  columnKey: string;
  value: any;
  displayValue: string;
  column: Column;
}

export function EditableCell({
  rowId,
  columnKey,
  value,
  displayValue,
  column,
}: EditableCellProps) {
  const {
    editingCell,
    cellValue,
    setCellValue,
    saveEdit,
    cancelEdit,
    handleLongPress,
    cancelLongPress,
    isEditing,
  } = useDataTable();

  const inputRef = useRef<HTMLInputElement>(null);
  const isCurrentlyEditing = isEditing(rowId, columnKey);

  // Auto-focus on edit
  useEffect(() => {
    if (isCurrentlyEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isCurrentlyEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    } else if (e.key === 'Tab') {
      // Move to next editable cell
      saveEdit();
      // Context handles moving to next cell
    }
  };

  if (isCurrentlyEditing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type={column.editType === 'number' ? 'number' : 'text'}
          value={cellValue ?? ''}
          onChange={(e) => setCellValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={saveEdit}
          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2"
        />
      </div>
    );
  }

  return (
    <div
      className="px-2 py-1 cursor-pointer hover:bg-gray-50"
      onMouseDown={() => handleLongPress(rowId, columnKey, value)}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
    >
      {displayValue || '—'}
    </div>
  );
}
```

```typescript
// components/Body/VirtualRow.tsx
import { memo } from 'react';
import { useDataTable } from '../../DataTableContext';
import { TableCell } from './TableCell';

interface VirtualRowProps {
  index: number;
  style: React.CSSProperties;
}

export const VirtualRow = memo(function VirtualRow({
  index,
  style,
}: VirtualRowProps) {
  const { data, visibleColumnList, onRowClick } = useDataTable();
  const row = data[index];

  if (!row) return null;

  return (
    <div
      style={style}
      className="flex border-b hover:bg-gray-50"
      onClick={() => onRowClick?.(row)}
    >
      {visibleColumnList.map((column) => (
        <TableCell
          key={column.key}
          row={row}
          column={column}
          rowId={row.id}
        />
      ))}
    </div>
  );
}, (prev, next) => {
  // Custom comparison for performance
  return prev.index === next.index;
});
```

### Phase 5: Compose in Main Component

```typescript
// DataTable.tsx - The coordinator (under 150 lines)
import { DataTableProvider } from './DataTableContext';
import { TableToolbar } from './components/Toolbar/TableToolbar';
import { TableHeader } from './components/Header/TableHeader';
import { TableBody } from './components/Body/TableBody';
import { TableFooter } from './components/Footer/TableFooter';
import { TableSkeleton } from './components/Loading/TableSkeleton';
import { AddRowForm } from './components/AddRow/AddRowForm';
import type { DataTableProps } from './types';

export function DataTable<T>({
  data,
  columns,
  metadata,
  loading,
  pagination,
  searchable = true,
  filterable = true,
  columnSelection = true,
  inlineEditable = false,
  allowAddRow = false,
  ...callbacks
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton rows={10} columns={columns.length} />;
  }

  return (
    <DataTableProvider
      data={data}
      columns={columns}
      metadata={metadata}
      {...callbacks}
    >
      <div className="flex flex-col h-full border rounded-lg overflow-hidden">
        {/* Toolbar */}
        {(searchable || filterable || columnSelection) && (
          <TableToolbar
            searchable={searchable}
            filterable={filterable}
            columnSelection={columnSelection}
          />
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          <TableHeader />
          <TableBody />
        </div>

        {/* Add Row */}
        {allowAddRow && <AddRowForm />}

        {/* Footer */}
        {pagination && (
          <TableFooter pagination={pagination} />
        )}
      </div>
    </DataTableProvider>
  );
}

// Named exports for compound pattern
DataTable.Toolbar = TableToolbar;
DataTable.Header = TableHeader;
DataTable.Body = TableBody;
DataTable.Footer = TableFooter;
```

---

## Migration Strategy

### Step 1: Create New Structure (No Changes to Existing)
- Create new directory structure
- Copy existing logic into appropriate files
- Add tests as you go

### Step 2: Feature Flag
```typescript
// Toggle between old and new implementation
const USE_NEW_TABLE = process.env.REACT_APP_NEW_TABLE === 'true';

export function EntityListOfInstancesTable(props) {
  if (USE_NEW_TABLE) {
    return <NewDataTable {...props} />;
  }
  return <LegacyTable {...props} />;
}
```

### Step 3: Gradual Rollout
1. Enable for developers only (local)
2. Enable for one entity type (e.g., 'project')
3. Enable for all entities
4. Remove old implementation

### Step 4: Delete Legacy Code
- Remove old `EntityListOfInstancesTable.tsx`
- Update imports
- Celebrate!

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Lines per component | 29,000 | < 200 |
| Time to understand | Hours | Minutes |
| Unit test coverage | 0% | > 80% |
| Bundle size (table) | ~500KB | < 100KB |
| Re-render on edit | Full table | Single cell |
| Hot reload time | ~5s | < 0.5s |

---

## FAQ

**Q: Won't this create too many files?**
A: More files = better separation. Modern bundlers handle this efficiently. Linear has 500+ component files.

**Q: How do I handle shared state?**
A: Use React Context (shown above). Each hook manages its own slice of state.

**Q: What about prop drilling?**
A: Context eliminates it. Components just call `useDataTable()` to access state.

**Q: Performance impact?**
A: **Better performance.** Smaller components = smaller re-render scope. Memoization works better with focused components.

---

*This guide should be executed in collaboration with the team over 4-6 weeks.*
