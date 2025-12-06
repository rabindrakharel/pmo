# Infinite Scroll + Virtualization

> **Version**: 2.0.0
> **Date**: 2025-12-06
> **Status**: ✅ IMPLEMENTED
> **Complexity**: Simple - ~50 lines of core logic

---

## Implementation Status

**Implemented in v14.0.0:**
- `EntityListOfInstancesTable.tsx`: Added `hasNextPage`, `isFetchingNextPage`, `fetchNextPage` props
- `EntityListOfInstancesPage.tsx`: Uses `useEntityInfiniteList` for table view (50 records per page)
- Virtualization already existed via `@tanstack/react-virtual`
- Loading indicator added at table footer during page fetches
- Non-table views (kanban, grid, calendar) continue to load all data

**Key Files:**
- `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx` - Table component with infinite scroll props
- `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` - Page using dual-strategy data fetching
- `apps/web/src/db/cache/hooks/useEntityInstanceData.ts` - Contains `useEntityInfiniteList` hook

---

## Overview

Standard infinite scroll pattern using TanStack Query's `useInfiniteQuery` + `@tanstack/react-virtual` for DOM virtualization. Loads 50 records at a time, renders ~25 DOM nodes regardless of total data.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INFINITE SCROLL FLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User scrolls down                                          │
│        │                                                     │
│        ▼                                                     │
│   Virtualizer detects last visible item near end             │
│        │                                                     │
│        ▼                                                     │
│   fetchNextPage() → GET /api/v1/{entity}?limit=50&offset=N  │
│        │                                                     │
│        ▼                                                     │
│   New page appended to cache                                 │
│        │                                                     │
│        ▼                                                     │
│   Virtualizer re-renders only visible rows (~25 DOM nodes)  │
│                                                              │
│   Memory: O(n) where n = total fetched rows                 │
│   DOM: O(1) constant ~25 nodes                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Install Dependencies

```bash
pnpm add @tanstack/react-virtual
```

### 2. Hook: useInfiniteEntityList

```typescript
// apps/web/src/lib/hooks/useInfiniteEntityList.ts

import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const PAGE_SIZE = 50;

export function useInfiniteEntityList<T>(
  entityCode: string,
  params: Record<string, unknown> = {}
) {
  return useInfiniteQuery({
    queryKey: ['entity-list-infinite', entityCode, params],
    queryFn: async ({ pageParam = 0 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', String(PAGE_SIZE));
      searchParams.set('offset', String(pageParam));

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });

      const response = await apiClient.get(
        `/api/v1/${entityCode}?${searchParams}`
      );
      return response.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      // If we got a full page, there's probably more
      if (lastPage.data?.length === PAGE_SIZE) {
        return allPages.length * PAGE_SIZE;
      }
      return undefined; // No more pages
    },
    initialPageParam: 0,
  });
}
```

### 3. Component: VirtualizedTable

```typescript
// apps/web/src/components/shared/VirtualizedTable.tsx

import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';

interface VirtualizedTableProps<T> {
  data: T[];
  columns: { key: string; title: string; render?: (row: T) => React.ReactNode }[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onRowClick?: (row: T) => void;
  rowHeight?: number;
  isLoading?: boolean;
}

export function VirtualizedTable<T extends { id: string }>({
  data,
  columns,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onRowClick,
  rowHeight = 48,
  isLoading = false,
}: VirtualizedTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 5, // Render 5 extra rows above/below viewport
  });

  // Fetch next page when scrolling near bottom
  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const lastItem = items[items.length - 1];

    if (
      lastItem &&
      lastItem.index >= data.length - 10 && // Within 10 rows of end
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), data.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Initial loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No records found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg">
      {/* Header */}
      <div className="flex border-b bg-muted/50 sticky top-0 z-10">
        {columns.map((col) => (
          <div
            key={col.key}
            className="flex-1 px-4 py-3 text-sm font-medium text-muted-foreground"
          >
            {col.title}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index];
            return (
              <div
                key={row.id}
                className="absolute w-full flex items-center border-b hover:bg-muted/50 cursor-pointer transition-colors"
                style={{
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <div key={col.key} className="flex-1 px-4 py-2 truncate">
                    {col.render ? col.render(row) : (row as any)[col.key]}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Loading more...</span>
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="px-4 py-2 border-t bg-muted/30 text-sm text-muted-foreground">
        {data.length} records loaded
        {hasNextPage && ' (scroll for more)'}
      </div>
    </div>
  );
}
```

### 4. Usage Example

```typescript
// apps/web/src/pages/shared/EntityListOfInstancesPage.tsx

import { useInfiniteEntityList } from '@/lib/hooks/useInfiniteEntityList';
import { VirtualizedTable } from '@/components/shared/VirtualizedTable';

export function EntityListOfInstancesPage() {
  const { entityCode } = useParams();
  const navigate = useNavigate();

  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
  } = useInfiniteEntityList(entityCode);

  // Flatten all pages into single array
  const allRows = data?.pages.flatMap((page) => page.data) ?? [];

  // Get columns from first page metadata
  const metadata = data?.pages[0]?.metadata?.entityListOfInstancesTable;
  const columns = metadata
    ? Object.entries(metadata.viewType).map(([key, meta]: [string, any]) => ({
        key,
        title: meta.label || key,
      }))
    : [];

  return (
    <div className="h-full p-4">
      <VirtualizedTable
        data={allRows}
        columns={columns}
        hasNextPage={hasNextPage ?? false}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/${entityCode}/${row.id}`)}
      />
    </div>
  );
}
```

---

## Loading States

### Initial Load
```
┌─────────────────────────────────┐
│                                 │
│         [Spinner]               │
│                                 │
└─────────────────────────────────┘
```

### Fetching More (Bottom Spinner)
```
┌─────────────────────────────────┐
│  Row 45                         │
│  Row 46                         │
│  Row 47                         │
│  Row 48                         │
│  Row 49                         │
│  Row 50                         │
├─────────────────────────────────┤
│  [Spinner] Loading more...      │
└─────────────────────────────────┘
```

### All Loaded
```
┌─────────────────────────────────┐
│  ...                            │
│  Row 148                        │
│  Row 149                        │
│  Row 150                        │
├─────────────────────────────────┤
│  150 records loaded             │
└─────────────────────────────────┘
```

---

## Performance

| Metric | Value |
|--------|-------|
| Initial render | < 100ms |
| DOM nodes | ~25-30 (constant) |
| Memory per 1000 rows | ~5 MB |
| Fetch size | 50 rows/request |
| Prefetch threshold | 10 rows from bottom |

---

## When This Is Enough

This pattern handles:
- Up to ~10,000 rows comfortably in browser memory
- Fast scrolling with virtualization
- Progressive loading with good UX

## When You'd Need More

If you ever need to handle 100K+ rows with bidirectional scrolling and memory eviction, that's a different problem requiring cursor-based pagination and sliding windows. But that's rare for a PMO app.

---

**Version**: 1.0.0 | **Updated**: 2025-12-05 | **Pattern**: Simple Infinite Scroll
