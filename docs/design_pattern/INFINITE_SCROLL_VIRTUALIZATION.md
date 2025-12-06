# Infinite Scroll + Virtualization

> **Version**: 14.0.0
> **Date**: 2025-12-06
> **Status**: ✅ IMPLEMENTED
> **Complexity**: Simple - unified hook with `infiniteScroll` option

---

## Implementation Status

**Implemented in v14.0.0:**
- Unified `useEntityInstanceData` hook with `infiniteScroll: true` option
- `EntityListOfInstancesTable.tsx`: Scroll-based prefetch with 400px threshold
- DOM virtualization via `@tanstack/react-virtual`
- Loading indicator at table footer during page fetches
- Non-table views (kanban, grid, calendar) load all data at once

**Cleanup in v14.0.0:**
- Removed deprecated `useEntityInfiniteList` hook
- Removed unused `useProgressiveEntityList` hook
- Removed unused `TableLoadingFooter` component
- Removed unused `ScrollVelocityPredictor` utility
- Removed `TablePaginationState` type
- **Total: ~1,100 lines deleted**

**Key Files:**
- `apps/web/src/db/cache/hooks/useEntityInstanceData.ts` - Unified hook with infinite scroll
- `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx` - Table with scroll detection
- `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` - Page using dual-strategy fetching

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
│   Scroll event: distanceToBottom < 400px                    │
│        │                                                     │
│        ▼                                                     │
│   fetchNextPage() → GET /api/v1/{entity}?limit=50&offset=N  │
│        │                                                     │
│        ▼                                                     │
│   New page appended to TanStack Query cache                 │
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

## Usage

### Unified Hook API

```typescript
// Regular mode (loads all data)
const { data, total, isLoading } = useEntityInstanceData('project', { limit: 20000 });

// Infinite scroll mode (loads pages on scroll)
const {
  data,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage
} = useEntityInstanceData('project', { limit: 50 }, { infiniteScroll: true });
```

### Page Component Pattern

```typescript
// apps/web/src/pages/shared/EntityListOfInstancesPage.tsx

export function EntityListOfInstancesPage({ entityCode }) {
  const useInfiniteScroll = view === 'table';

  const queryParams = useMemo(() => ({
    limit: useInfiniteScroll ? 50 : 20000,
  }), [useInfiniteScroll]);

  const {
    data: rawData,
    total: totalRecords,
    isLoading: dataLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useEntityInstanceData(entityCode, queryParams, {
    enabled: !!config,
    infiniteScroll: useInfiniteScroll,
  });

  return (
    <EntityListOfInstancesTable
      data={formattedData}
      metadata={componentMetadata}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
    />
  );
}
```

### Table Component Scroll Detection

```typescript
// apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx

// Scroll-based infinite scroll trigger
useEffect(() => {
  if (!fetchNextPage) return;

  const container = tableContainerRef.current;
  if (!container) return;

  const handleScroll = () => {
    if (!hasNextPage || isFetchingNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const PREFETCH_THRESHOLD_PX = 400;

    if (distanceToBottom < PREFETCH_THRESHOLD_PX) {
      fetchNextPage();
    }
  };

  container.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Check immediately in case content is short

  return () => container.removeEventListener('scroll', handleScroll);
}, [hasNextPage, isFetchingNextPage, fetchNextPage]);
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

### Fetching More (Footer Spinner)
```
┌─────────────────────────────────┐
│  Row 45                         │
│  Row 46                         │
│  Row 47                         │
│  Row 48                         │
│  Row 49                         │
│  Row 50                         │
├─────────────────────────────────┤
│  ● Loading more...              │
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
│  150 records loaded (all loaded)│
└─────────────────────────────────┘
```

---

## Hook Return Type

```typescript
interface UseEntityInstanceDataResult<T> {
  // Standard fields
  data: T[];
  total: number;
  metadata: EntityInstanceMetadata | undefined;
  refData: Record<string, Record<string, string>> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isStale: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;

  // Infinite scroll fields (only active when infiniteScroll: true)
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: (() => Promise<void>) | undefined;
}
```

---

## View Mode Strategy

| View | Data Strategy | Reason |
|------|---------------|--------|
| **Table** | Infinite scroll (50/page) | Virtualization + scroll = efficient |
| **Kanban** | Load all | Need all cards for column layout |
| **Grid** | Load all | Card grid needs full data |
| **Calendar** | Load all | Events need full date range |
| **DAG** | Load all | Graph needs complete structure |

---

## Performance

| Metric | Value |
|--------|-------|
| Initial render | < 100ms |
| DOM nodes | ~25-30 (constant) |
| Memory per 1000 rows | ~5 MB |
| Fetch size | 50 rows/request |
| Prefetch threshold | 400px from bottom |

---

## Compatibility Matrix

| Pattern | Compatible | Notes |
|---------|------------|-------|
| Format-at-Read | ✅ | Works with FormattedRow structure |
| Two-Query Pattern | ✅ | Metadata cached separately |
| Optimistic Updates | ✅ | Works with cache mutations |
| Inline Editing | ✅ | Cell editing preserved |
| WebSocket Sync | ✅ | Cache invalidation works |

---

**Version**: 14.0.0 | **Updated**: 2025-12-06 | **Pattern**: Unified Infinite Scroll
