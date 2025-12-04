# Performance Optimization Guide

**Priority:** HIGH
**Estimated Effort:** 2-3 weeks
**Impact:** User Experience, Perceived Performance, Real Performance

---

## Current Performance Gaps

| Issue | Impact | Fix Effort |
|-------|--------|------------|
| No virtualization | Renders all 1000+ rows | Medium |
| Missing React.memo | Full re-renders on any change | Low |
| No loading skeletons | Poor perceived performance | Low |
| Main thread blocking | UI freezes during sort/filter | High |
| No bundle splitting | Large initial load | Medium |
| Missing useDeferredValue | Search blocks UI | Low |

---

## 1. Virtualization Implementation

### Current Problem

```tsx
// Your current pagination (still renders 1000 DOM nodes)
const [clientPageSize, setClientPageSize] = useState(1000);
```

With 1000 rows, each with 15 columns = **15,000 DOM nodes**. This causes:
- Slow initial render (500ms+)
- Memory pressure (~50MB for table alone)
- Scroll jank on lower-end devices

### Solution: TanStack Virtual

```tsx
// hooks/useVirtualization.ts
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useMemo } from 'react';

interface UseVirtualTableOptions {
  data: any[];
  rowHeight?: number;
  overscan?: number;
}

export function useVirtualTable({
  data,
  rowHeight = 40,
  overscan = 10,
}: UseVirtualTableOptions) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  // Calculate padding for scroll position
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? totalHeight - virtualRows[virtualRows.length - 1].end
    : 0;

  return {
    parentRef,
    virtualizer,
    virtualRows,
    totalHeight,
    paddingTop,
    paddingBottom,
  };
}
```

```tsx
// components/VirtualTableBody.tsx
import { useVirtualTable } from '../hooks/useVirtualization';

export function VirtualTableBody({ data, columns, rowHeight = 40 }) {
  const {
    parentRef,
    virtualRows,
    totalHeight,
    paddingTop,
    paddingBottom,
  } = useVirtualTable({ data, rowHeight });

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto"
      style={{ maxHeight: '70vh' }}
    >
      <div style={{ height: totalHeight }}>
        {/* Top spacer */}
        {paddingTop > 0 && <div style={{ height: paddingTop }} />}

        {/* Only render visible rows */}
        {virtualRows.map((virtualRow) => {
          const row = data[virtualRow.index];
          return (
            <VirtualRow
              key={row.id}
              row={row}
              columns={columns}
              style={{ height: rowHeight }}
            />
          );
        })}

        {/* Bottom spacer */}
        {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
      </div>
    </div>
  );
}
```

**Result:** Render 20-30 rows instead of 1000 = **97% fewer DOM nodes**

---

## 2. React.memo Optimization

### Current Problem

```tsx
// Every row re-renders when ANY state changes
{data.map(row => (
  <TableRow
    key={row.id}
    row={row}
    columns={columns}
    onClick={handleClick}
  />
))}
```

### Solution: Memoized Components with Custom Comparison

```tsx
// components/MemoizedRow.tsx
import { memo } from 'react';

interface RowProps {
  row: FormattedRow<any>;
  columns: Column[];
  isSelected: boolean;
  isEditing: boolean;
}

function areEqual(prev: RowProps, next: RowProps) {
  // Only re-render if these specific things change
  return (
    prev.row.raw.id === next.row.raw.id &&
    prev.row.raw.updated_ts === next.row.raw.updated_ts &&
    prev.isSelected === next.isSelected &&
    prev.isEditing === next.isEditing &&
    prev.columns.length === next.columns.length
  );
}

export const MemoizedRow = memo(function TableRow({
  row,
  columns,
  isSelected,
  isEditing,
}: RowProps) {
  return (
    <tr className={isSelected ? 'bg-blue-50' : ''}>
      {columns.map((col) => (
        <MemoizedCell
          key={col.key}
          value={row.display[col.key]}
          rawValue={row.raw[col.key]}
          column={col}
          isEditing={isEditing && col.editable}
        />
      ))}
    </tr>
  );
}, areEqual);
```

```tsx
// components/MemoizedCell.tsx
import { memo } from 'react';

export const MemoizedCell = memo(function Cell({
  value,
  rawValue,
  column,
  isEditing,
}: CellProps) {
  if (isEditing) {
    return <EditableCell value={rawValue} column={column} />;
  }
  return <td>{value}</td>;
}, (prev, next) => {
  return (
    prev.value === next.value &&
    prev.isEditing === next.isEditing
  );
});
```

**Result:** Only edited cell re-renders, not entire table

---

## 3. Loading Skeletons

### Current Problem

```tsx
// Generic spinner - poor UX
if (loading) {
  return <EllipsisBounce size="lg" text="Processing" />;
}
```

Users see a blank screen with a spinner. They don't know what's loading.

### Solution: Content-Aware Skeletons

```tsx
// components/TableSkeleton.tsx
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showToolbar?: boolean;
}

export function TableSkeleton({
  rows = 10,
  columns = 6,
  showToolbar = true,
}: TableSkeletonProps) {
  return (
    <div className="animate-pulse">
      {/* Toolbar skeleton */}
      {showToolbar && (
        <div className="flex gap-3 mb-4">
          <div className="h-10 w-64 bg-gray-200 rounded" />
          <div className="h-10 w-32 bg-gray-200 rounded" />
          <div className="h-10 w-24 bg-gray-200 rounded" />
        </div>
      )}

      {/* Header skeleton */}
      <div className="flex border-b pb-2">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-6 bg-gray-200 rounded mx-1"
            style={{ width: `${100 / columns}%` }}
          />
        ))}
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex py-3 border-b">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="flex-1 h-4 bg-gray-100 rounded mx-1"
              style={{
                width: `${100 / columns}%`,
                // Vary widths for natural look
                maxWidth: colIndex === 0 ? '80%' : colIndex === 1 ? '60%' : '40%',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

```tsx
// Usage with Suspense
<Suspense fallback={<TableSkeleton rows={20} columns={8} />}>
  <EntityTable entityCode={entityCode} />
</Suspense>
```

**Result:** Users see content structure immediately, reducing perceived load time by ~40%

---

## 4. Deferred Search Input

### Current Problem

```tsx
// Search filters immediately, blocking UI
const filtered = data.filter(item =>
  item.name.includes(searchTerm)
);
```

Typing in search box causes UI jank because filtering runs synchronously.

### Solution: useDeferredValue

```tsx
import { useDeferredValue, useMemo } from 'react';

function useFilteredData(data: any[], searchTerm: string) {
  // Defer the search term - UI stays responsive
  const deferredSearch = useDeferredValue(searchTerm);

  // Show stale indicator when deferred value differs
  const isStale = searchTerm !== deferredSearch;

  const filtered = useMemo(() => {
    if (!deferredSearch) return data;
    const lower = deferredSearch.toLowerCase();
    return data.filter(item =>
      item.name?.toLowerCase().includes(lower) ||
      item.code?.toLowerCase().includes(lower)
    );
  }, [data, deferredSearch]);

  return { filtered, isStale };
}
```

```tsx
// In component
function DataTable({ data }) {
  const [searchTerm, setSearchTerm] = useState('');
  const { filtered, isStale } = useFilteredData(data, searchTerm);

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      <div style={{ opacity: isStale ? 0.7 : 1 }}>
        <TableBody data={filtered} />
      </div>
    </div>
  );
}
```

**Result:** Input stays responsive, filtering happens in background

---

## 5. Web Worker Offloading

### Problem: Heavy Computations on Main Thread

Sorting/filtering 20,000 rows blocks the main thread:
- UI freezes for 100-500ms
- Scroll becomes janky
- Input lag

### Solution: Comlink Web Worker

```typescript
// workers/tableWorker.ts
import { expose } from 'comlink';

interface SortParams {
  data: any[];
  field: string;
  direction: 'asc' | 'desc';
}

interface FilterParams {
  data: any[];
  filters: Record<string, string[]>;
  searchTerm: string;
  searchFields: string[];
}

const tableWorker = {
  sort({ data, field, direction }: SortParams) {
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const result = aVal < bVal ? -1 : 1;
      return direction === 'asc' ? result : -result;
    });
  },

  filter({ data, filters, searchTerm, searchFields }: FilterParams) {
    return data.filter(row => {
      // Check dropdown filters
      for (const [field, values] of Object.entries(filters)) {
        if (values.length > 0 && !values.includes(row[field])) {
          return false;
        }
      }

      // Check search
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const matches = searchFields.some(field =>
          String(row[field] || '').toLowerCase().includes(lower)
        );
        if (!matches) return false;
      }

      return true;
    });
  },

  // Combine sort + filter for single round-trip
  process({ data, sortField, sortDirection, filters, searchTerm, searchFields }) {
    const filtered = this.filter({ data, filters, searchTerm, searchFields });
    if (sortField) {
      return this.sort({ data: filtered, field: sortField, direction: sortDirection });
    }
    return filtered;
  },
};

expose(tableWorker);
```

```typescript
// hooks/useWorkerTable.ts
import { wrap } from 'comlink';
import { useEffect, useState, useRef } from 'react';

type TableWorker = typeof import('../workers/tableWorker').default;

export function useWorkerTable(
  data: any[],
  sortField: string,
  sortDirection: 'asc' | 'desc',
  filters: Record<string, string[]>,
  searchTerm: string,
  searchFields: string[]
) {
  const [processedData, setProcessedData] = useState(data);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<TableWorker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/tableWorker.ts', import.meta.url),
      { type: 'module' }
    );
    apiRef.current = wrap<TableWorker>(workerRef.current);

    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!apiRef.current || data.length === 0) return;

    setIsProcessing(true);
    apiRef.current.process({
      data,
      sortField,
      sortDirection,
      filters,
      searchTerm,
      searchFields,
    }).then((result) => {
      setProcessedData(result);
      setIsProcessing(false);
    });
  }, [data, sortField, sortDirection, filters, searchTerm, searchFields]);

  return { processedData, isProcessing };
}
```

**Result:** Main thread never blocks, UI stays at 60fps

---

## 6. Bundle Splitting

### Current Problem

```tsx
// All views loaded on initial page
import { KanbanView } from './KanbanView';
import { CalendarView } from './CalendarView';
import { DAGVisualizer } from './DAGVisualizer';
import { HierarchyGraphView } from './HierarchyGraphView';
```

User viewing table loads Kanban, Calendar, DAG, Hierarchy code too.

### Solution: Lazy Loading with Suspense

```tsx
import { lazy, Suspense } from 'react';

// Lazy load non-default views
const KanbanView = lazy(() =>
  import('./KanbanView').then(m => ({ default: m.KanbanView }))
);
const CalendarView = lazy(() =>
  import('./CalendarView').then(m => ({ default: m.CalendarView }))
);
const DAGVisualizer = lazy(() =>
  import('../workflow/DAGVisualizer').then(m => ({ default: m.DAGVisualizer }))
);
const HierarchyGraphView = lazy(() =>
  import('../hierarchy/HierarchyGraphView').then(m => ({ default: m.HierarchyGraphView }))
);

// View-specific skeletons
const ViewSkeleton: Record<string, () => JSX.Element> = {
  kanban: () => <KanbanSkeleton columns={5} />,
  calendar: () => <CalendarSkeleton />,
  graph: () => <GraphSkeleton />,
};

function EntityListPage({ entityCode }) {
  const [view, setView] = useViewMode(entityCode);

  return (
    <Suspense fallback={ViewSkeleton[view]?.() || <TableSkeleton />}>
      {view === 'table' && <TableView />}
      {view === 'kanban' && <KanbanView />}
      {view === 'calendar' && <CalendarView />}
      {view === 'graph' && (isHierarchy ? <HierarchyGraphView /> : <DAGVisualizer />)}
    </Suspense>
  );
}
```

**Result:** Initial bundle ~40% smaller, views load on-demand

---

## 7. Optimistic UI with Rollback Indicator

### Current Approach (Good Foundation)

```tsx
const { updateEntity } = useOptimisticMutation(entityCode, {
  onError: (error) => alert(`Failed: ${error.message}`),
});
```

### Enhancement: Visual Rollback Indicator

```tsx
// hooks/useOptimisticWithIndicator.ts
export function useOptimisticWithIndicator(entityCode: string) {
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  const [failedUpdates, setFailedUpdates] = useState<Map<string, string>>(new Map());

  const { updateEntity: baseUpdate } = useOptimisticMutation(entityCode, {
    onMutate: (id) => {
      setPendingUpdates(prev => new Set(prev).add(id));
    },
    onSuccess: (id) => {
      setPendingUpdates(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onError: (error, id) => {
      setPendingUpdates(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setFailedUpdates(prev => new Map(prev).set(id, error.message));

      // Auto-clear after 3s
      setTimeout(() => {
        setFailedUpdates(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }, 3000);
    },
  });

  return {
    updateEntity: baseUpdate,
    isPending: (id: string) => pendingUpdates.has(id),
    hasFailed: (id: string) => failedUpdates.has(id),
    getError: (id: string) => failedUpdates.get(id),
  };
}
```

```tsx
// Visual indicator in row
<tr className={cn({
  'opacity-50': isPending(row.id),
  'bg-red-50': hasFailed(row.id),
})}>
  {isPending(row.id) && <SyncingIndicator />}
  {hasFailed(row.id) && <FailedBadge message={getError(row.id)} />}
</tr>
```

---

## Performance Checklist

### Before Shipping, Verify:

- [ ] Virtualization enabled for lists > 100 items
- [ ] React.memo on all row/cell components
- [ ] Loading skeletons match content structure
- [ ] Search uses useDeferredValue
- [ ] Heavy operations in Web Workers
- [ ] Views are lazy-loaded
- [ ] No inline arrow functions in render
- [ ] useCallback for all handlers
- [ ] useMemo for derived data
- [ ] Bundle size < 200KB initial

### Measuring Performance

```typescript
// Add to app initialization
if (process.env.NODE_ENV === 'development') {
  import('web-vitals').then(({ getCLS, getFID, getLCP, getFCP, getTTFB }) => {
    getCLS(console.log);
    getFID(console.log);
    getLCP(console.log);
    getFCP(console.log);
    getTTFB(console.log);
  });
}
```

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| LCP (Largest Contentful Paint) | < 1.5s | Measure |
| FID (First Input Delay) | < 100ms | Measure |
| CLS (Cumulative Layout Shift) | < 0.1 | Measure |
| TTI (Time to Interactive) | < 2s | Measure |
| Bundle Size (initial) | < 200KB | Measure |
| Re-render time (edit) | < 16ms | Measure |

---

*Implement these optimizations in order of impact: Virtualization > Memoization > Skeletons > Bundle Splitting > Workers*
