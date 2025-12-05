# Progressive Loading & Data Table Future State Design

> **Version**: 1.0.0 → **1.1.0 (Implemented)**
> **Date**: 2025-12-05
> **Status**: ~~Proposal~~ **Implemented**
> **Author**: Architecture Team

## Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Cursor Pagination Utilities | ✅ Done | `apps/api/src/lib/cursor-pagination.ts` |
| Universal CRUD Factory Update | ✅ Done | `apps/api/src/lib/universal-entity-crud-factory.ts` |
| useProgressiveEntityList Hook | ✅ Done | `apps/web/src/db/cache/hooks/useProgressiveEntityList.ts` |
| ScrollVelocityPredictor | ✅ Done | `apps/web/src/lib/scroll-velocity-predictor.ts` |
| TableLoadingFooter Component | ✅ Done | `apps/web/src/components/shared/ui/TableLoadingFooter.tsx` |
| Database Indexes | ✅ Done | `db/indexes/cursor_pagination_indexes.ddl` |

---

## Executive Summary

This document proposes a production-grade evolution of PMO's data table loading architecture, moving from the current offset-based pagination with conditional virtualization to a **cursor-based progressive loading system** with **predictive prefetching** and **seamless infinite scroll**. This aligns with industry leaders (GitHub, Twitter/X, Slack, Linear) who have solved this at scale.

---

## 1. Current State Analysis

### What We Have Today

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE (v9.3.0)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ useEntity-   │───▶│   Dexie      │───▶│  TanStack    │       │
│  │ InstanceData │    │  (IndexedDB) │    │   Query      │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                        │               │
│         ▼                                        ▼               │
│  ┌──────────────┐                       ┌──────────────┐        │
│  │ OFFSET       │                       │ Conditional  │        │
│  │ Pagination   │                       │ Virtualization│       │
│  │ (LIMIT 20K)  │                       │ (>50 rows)   │        │
│  └──────────────┘                       └──────────────┘        │
│                                                                  │
│  LOADING PATTERN:                                                │
│  1. Initial: Full skeleton table                                │
│  2. Fetching: Spinner in table body                             │
│  3. Complete: All data rendered (virtualized if >50 rows)       │
│                                                                  │
│  PAGINATION:                                                     │
│  - useEntityInstanceData: limit/offset with Dexie caching       │
│  - useEntityInfiniteList: TanStack useInfiniteQuery             │
│  - PAGINATION_CONFIG: 20K default, entity-specific overrides    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Current Strengths ✓

| Feature | Implementation | Status |
|---------|----------------|--------|
| Row Virtualization | `@tanstack/react-virtual` with 50-row threshold | ✓ Production |
| Offline Persistence | Dexie IndexedDB with 30-min TTL | ✓ Production |
| WebSocket Sync | Real-time cache invalidation via PubSub | ✓ Production |
| Metadata Caching | Redis field cache + `content=metadata` API | ✓ Production |
| Infinite Query | `useEntityInfiniteList` hook available | ✓ Available |

### Current Limitations ✗

| Issue | Impact | Root Cause |
|-------|--------|------------|
| **Offset pagination at scale** | 17x slowdown at page 1000+ | `OFFSET N` scans N rows before returning |
| **No progressive hydration** | Users wait for all data | Monolithic fetch, no streaming |
| **Limited prefetch intelligence** | No scroll velocity prediction | Static threshold (500px from bottom) |
| **Full re-render on filter** | Jarring UX on large datasets | Entire query invalidated |
| **No skeleton streaming** | Loading state lacks context | Generic skeleton vs. data-shaped preview |

---

## 2. Industry Analysis: How Pioneers Solved This

### GitHub (Cursor Pagination + Fragment Streaming)

```
Strategy: Relay-style cursor pagination with GraphQL fragments
Result: Consistent O(1) performance at any depth

Key Innovation:
- Opaque cursors encode position (not offset)
- Fragments allow partial updates
- Optimistic UI for common actions (star, watch)
```

### Linear (Optimistic Everything + Local-First)

```
Strategy: Local-first with sync engine
Result: <50ms perceived latency for all operations

Key Innovation:
- All writes hit local DB first
- Background sync with conflict resolution
- UI never waits for network
```

### Slack (Virtualization + Message Anchoring)

```
Strategy: Bidirectional virtualization with anchor points
Result: Smooth scroll through millions of messages

Key Innovation:
- Scroll position preserved across re-renders
- Dynamic row heights without layout shift
- Time-based anchoring for "jump to date"
```

### Twitter/X (Cursor + Optimistic + Predictive)

```
Strategy: Cursor pagination + predictive prefetch + skeleton streaming
Result: Infinite timeline feels instant

Key Innovation:
- ML-based scroll velocity prediction
- Skeleton shapes match incoming content
- "Soft" loading states (blur transition)
```

---

## 3. Future State Architecture

### 3.1 Cursor-Based Pagination (Backend)

**Current** (Offset-based):
```sql
-- Page 1000 with 20 items: Scans 20,000 rows, returns 20
SELECT * FROM app.project
WHERE active_flag = true
ORDER BY created_ts DESC
LIMIT 20 OFFSET 19980;  -- ❌ O(n) - scans 20K rows
```

**Future** (Cursor-based):
```sql
-- Page 1000: Direct index seek, returns 20
SELECT * FROM app.project
WHERE active_flag = true
  AND (created_ts, id) < ($cursor_ts, $cursor_id)  -- ✓ O(1) - index seek
ORDER BY created_ts DESC, id DESC
LIMIT 20;
```

**API Evolution**:
```typescript
// CURRENT
GET /api/v1/project?limit=20&offset=100

// FUTURE (backward compatible)
GET /api/v1/project?limit=20&cursor=eyJjcmVhdGVkX3RzIjoiMjAyNS0wMS0wMSIsImlkIjoiYWJjMTIzIn0=
// cursor = base64({ created_ts: "2025-01-01", id: "abc123" })

// Response includes:
{
  "data": [...],
  "cursors": {
    "next": "eyJ...",      // Opaque cursor for next page
    "prev": "eyK...",      // Opaque cursor for previous page (optional)
    "hasMore": true
  },
  "total": 8231           // Total count (optional, can skip for performance)
}
```

### 3.2 Progressive Loading Hook Architecture

```typescript
// ============================================================================
// FUTURE: useProgressiveEntityList (Replaces useEntityInfiniteList)
// ============================================================================

interface ProgressiveLoadingConfig {
  // Cursor-based pagination
  pageSize: number;

  // Prefetch intelligence
  prefetchStrategy: 'none' | 'next' | 'predictive';
  prefetchThreshold: number;  // px from edge to trigger

  // Scroll behavior
  scrollRestoration: 'auto' | 'manual';
  anchorField?: string;  // Field to use for "jump to" (e.g., created_ts)

  // Loading UX
  skeletonMode: 'generic' | 'shaped' | 'blur';
  optimisticMutations: boolean;
}

interface UseProgressiveEntityListResult<T> {
  // Data
  data: T[];
  total: number | undefined;  // undefined = not yet known (skip COUNT query)

  // Cursors
  cursors: {
    current: string | null;
    next: string | null;
    prev: string | null;
    hasMore: boolean;
    hasPrev: boolean;
  };

  // Loading states (granular)
  status: {
    isInitialLoading: boolean;      // First page loading
    isLoadingMore: boolean;         // Fetching next page
    isLoadingPrev: boolean;         // Fetching previous page (bidirectional)
    isPrefetching: boolean;         // Background prefetch in progress
    isRefreshing: boolean;          // Background refresh (stale-while-revalidate)
  };

  // Actions
  loadMore: () => Promise<void>;
  loadPrev: () => Promise<void>;    // For bidirectional scroll
  jumpTo: (anchor: string) => void; // Jump to specific record
  refresh: () => Promise<void>;     // Full refresh

  // Scroll state
  scrollState: {
    velocity: number;               // px/s - for predictive prefetch
    direction: 'up' | 'down' | 'idle';
    nearTop: boolean;
    nearBottom: boolean;
  };

  // Optimistic mutations
  optimisticAdd: (item: Partial<T>) => string;  // Returns temp ID
  optimisticUpdate: (id: string, updates: Partial<T>) => void;
  optimisticRemove: (id: string) => void;
}
```

### 3.3 Predictive Prefetch Engine

```typescript
// ============================================================================
// Scroll Velocity Prediction (Industry Pattern)
// ============================================================================

class ScrollVelocityPredictor {
  private samples: Array<{ time: number; position: number }> = [];
  private readonly SAMPLE_WINDOW = 500; // ms
  private readonly MIN_SAMPLES = 3;

  // Add scroll sample
  addSample(position: number): void {
    const now = performance.now();
    this.samples.push({ time: now, position });

    // Trim old samples
    this.samples = this.samples.filter(s => now - s.time < this.SAMPLE_WINDOW);
  }

  // Calculate velocity (px/s) and direction
  getVelocity(): { velocity: number; direction: 'up' | 'down' | 'idle' } {
    if (this.samples.length < this.MIN_SAMPLES) {
      return { velocity: 0, direction: 'idle' };
    }

    const oldest = this.samples[0];
    const newest = this.samples[this.samples.length - 1];
    const deltaPosition = newest.position - oldest.position;
    const deltaTime = (newest.time - oldest.time) / 1000; // seconds

    const velocity = Math.abs(deltaPosition / deltaTime);
    const direction = deltaPosition > 10 ? 'down' : deltaPosition < -10 ? 'up' : 'idle';

    return { velocity, direction };
  }

  // Predict when user will reach threshold
  predictTimeToThreshold(currentDistance: number): number {
    const { velocity } = this.getVelocity();
    if (velocity === 0) return Infinity;
    return currentDistance / velocity; // seconds
  }

  // Should we prefetch based on scroll behavior?
  shouldPrefetch(distanceToBottom: number, networkLatency: number = 200): boolean {
    const timeToThreshold = this.predictTimeToThreshold(distanceToBottom);
    const fetchTime = networkLatency / 1000; // Convert to seconds

    // Prefetch if user will reach bottom before fetch completes
    // Add 100ms buffer for safety
    return timeToThreshold < fetchTime + 0.1;
  }
}
```

### 3.4 Skeleton Streaming Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              SKELETON STREAMING (Future State)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: SHAPED SKELETON (immediate)                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ││
│  │ ░░░░░░░░  ░░░░░░░░░░░░  ░░░░  ░░░░░░░░░░  ░░░░░░░░░░░░░░ ││
│  │ ░░░░░░░░  ░░░░░░░░░░░░  ░░░░  ░░░░░░░░░░  ░░░░░░░░░░░░░░ ││
│  │                                                            ││
│  │  Skeleton matches: column widths, header labels, row count ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Phase 2: PROGRESSIVE REVEAL (as data arrives)                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Code     Name              Stage    Budget      Actions     ││
│  │ PRJ-001  Kitchen Reno...   ████    $50,000     ░░░░░░░░░░ ││
│  │ PRJ-002  Bathroom Up...    ░░░░    ░░░░░░░     ░░░░░░░░░░ ││
│  │ ░░░░░░░  ░░░░░░░░░░░░░░░   ░░░░    ░░░░░░░     ░░░░░░░░░░ ││
│  │                                                            ││
│  │  First rows render, remaining animate to placeholder       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Phase 3: FULL DATA (complete)                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Code     Name              Stage       Budget    Actions    ││
│  │ PRJ-001  Kitchen Reno      Planning   $50,000   ✏️ 🗑️      ││
│  │ PRJ-002  Bathroom Update   Active     $25,000   ✏️ 🗑️      ││
│  │ PRJ-003  Office Fit-out    Complete   $75,000   ✏️ 🗑️      ││
│  │                                                            ││
│  │  All data visible, virtualization active                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Infinite Scroll with Position Memory

```typescript
// ============================================================================
// Scroll Position Restoration (Linear/Slack Pattern)
// ============================================================================

interface ScrollAnchor {
  itemId: string;           // Anchor item ID
  itemOffset: number;       // Offset within item (for partial visibility)
  viewportOffset: number;   // Offset from viewport top
  timestamp: number;        // When anchor was set
}

function useScrollRestoration(
  entityCode: string,
  params: Record<string, unknown>
) {
  const anchorRef = useRef<ScrollAnchor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save scroll position before unmount/navigation
  useEffect(() => {
    return () => {
      if (containerRef.current && anchorRef.current) {
        sessionStorage.setItem(
          `scroll:${entityCode}:${JSON.stringify(params)}`,
          JSON.stringify(anchorRef.current)
        );
      }
    };
  }, [entityCode, params]);

  // Restore scroll position on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(
      `scroll:${entityCode}:${JSON.stringify(params)}`
    );
    if (saved) {
      const anchor = JSON.parse(saved) as ScrollAnchor;
      // Find the anchor item and scroll to it
      const element = document.querySelector(`[data-id="${anchor.itemId}"]`);
      if (element) {
        element.scrollIntoView({ block: 'start' });
        containerRef.current?.scrollBy(0, -anchor.viewportOffset);
      }
    }
  }, []);

  // Update anchor on scroll (debounced)
  const updateAnchor = useDebouncedCallback((container: HTMLDivElement) => {
    const firstVisible = findFirstVisibleItem(container);
    if (firstVisible) {
      anchorRef.current = {
        itemId: firstVisible.dataset.id!,
        itemOffset: firstVisible.getBoundingClientRect().top,
        viewportOffset: container.getBoundingClientRect().top,
        timestamp: Date.now(),
      };
    }
  }, 100);

  return { containerRef, updateAnchor };
}
```

---

## 4. Loading State UX Patterns

### 4.1 State Machine for Loading

```
┌─────────────────────────────────────────────────────────────────┐
│                  LOADING STATE MACHINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    cache hit    ┌─────────────┐                    │
│  │  IDLE   │───────────────▶│    READY    │                    │
│  └────┬────┘                 └─────────────┘                    │
│       │                             ▲                            │
│       │ cache miss                  │ data received              │
│       ▼                             │                            │
│  ┌─────────────┐    fetch    ┌─────┴─────┐                      │
│  │  SKELETON   │───────────▶│  LOADING  │                      │
│  │  (shaped)   │             │  (spinner)│                      │
│  └─────────────┘             └───────────┘                      │
│                                    │                             │
│                                    │ scroll near bottom          │
│                                    ▼                             │
│                              ┌───────────┐                      │
│                              │ LOADING   │                      │
│                              │   MORE    │◀─────────┐           │
│                              └─────┬─────┘          │           │
│                                    │                │           │
│                                    │ more data      │ scroll    │
│                                    ▼                │           │
│                              ┌───────────┐          │           │
│                              │  READY    │──────────┘           │
│                              │ (partial) │                      │
│                              └───────────┘                      │
│                                    │                             │
│                                    │ no more data                │
│                                    ▼                             │
│                              ┌───────────┐                      │
│                              │   READY   │                      │
│                              │ (complete)│                      │
│                              └───────────┘                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Visual Indicators by State

| State | Visual Treatment | User Feedback |
|-------|------------------|---------------|
| **SKELETON** | Column-shaped placeholders with shimmer | "Loading [entity]..." |
| **LOADING** | Inline spinner in table body | Row count skeleton |
| **LOADING_MORE** | Small spinner in footer | "Loading more..." |
| **PREFETCHING** | No visible indicator | (Background, invisible) |
| **REFRESHING** | Subtle refresh icon (top-right) | "Updating..." |
| **READY** | Data visible | "Showing 1-20 of 8,231" |
| **END_OF_LIST** | Footer message | "You've reached the end" |
| **ERROR** | Inline error with retry | "Failed to load. Retry?" |

### 4.3 Component Implementation

```tsx
// ============================================================================
// TableLoadingFooter - Infinite scroll footer states
// ============================================================================

interface TableLoadingFooterProps {
  status: {
    isLoadingMore: boolean;
    hasMore: boolean;
    isError: boolean;
  };
  total?: number;
  loaded: number;
  onRetry: () => void;
  onLoadMore: () => void;
}

function TableLoadingFooter({
  status,
  total,
  loaded,
  onRetry,
  onLoadMore,
}: TableLoadingFooterProps) {
  if (status.isError) {
    return (
      <div className="flex items-center justify-center py-4 text-red-500">
        <AlertCircle className="h-4 w-4 mr-2" />
        <span>Failed to load more</span>
        <button
          onClick={onRetry}
          className="ml-2 text-blue-500 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (status.isLoadingMore) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <InlineSpinner className="h-4 w-4 mr-2" />
        <span>Loading more...</span>
      </div>
    );
  }

  if (!status.hasMore) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
        <span>
          {total !== undefined
            ? `All ${total.toLocaleString()} items loaded`
            : "You've reached the end"
          }
        </span>
      </div>
    );
  }

  // Idle state with "Load more" button (fallback for failed auto-load)
  return (
    <div className="flex items-center justify-center py-4">
      <button
        onClick={onLoadMore}
        className="text-blue-500 hover:underline"
      >
        Load more ({loaded.toLocaleString()} loaded{total && ` of ${total.toLocaleString()}`})
      </button>
    </div>
  );
}
```

---

## 5. Migration Path

### Phase 1: Backend Cursor Support (Week 1-2)

```typescript
// apps/api/src/lib/cursor-pagination.ts

export interface CursorPaginationResult<T> {
  data: T[];
  cursors: {
    next: string | null;
    prev: string | null;
    hasMore: boolean;
  };
  // Optional total - only computed if requested (expensive for large tables)
  total?: number;
}

export function encodeCursor(record: { created_ts: string; id: string }): string {
  return Buffer.from(JSON.stringify({
    t: record.created_ts,
    i: record.id,
  })).toString('base64url');
}

export function decodeCursor(cursor: string): { created_ts: string; id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    return { created_ts: decoded.t, id: decoded.i };
  } catch {
    return null;
  }
}

// SQL builder for cursor-based queries
export function buildCursorQuery(
  baseQuery: SQL,
  cursor: string | null,
  sortField: string = 'created_ts',
  sortOrder: 'asc' | 'desc' = 'desc',
  limit: number = 20
): SQL {
  const conditions: SQL[] = [];

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      // Use tuple comparison for stable cursor
      if (sortOrder === 'desc') {
        conditions.push(sql`(${sql.raw(sortField)}, id) < (${decoded.created_ts}, ${decoded.id})`);
      } else {
        conditions.push(sql`(${sql.raw(sortField)}, id) > (${decoded.created_ts}, ${decoded.id})`);
      }
    }
  }

  return sql`
    ${baseQuery}
    ${conditions.length > 0 ? sql`AND ${sql.join(conditions, sql` AND `)}` : sql``}
    ORDER BY ${sql.raw(sortField)} ${sql.raw(sortOrder.toUpperCase())}, id ${sql.raw(sortOrder.toUpperCase())}
    LIMIT ${limit + 1}  -- Fetch one extra to detect hasMore
  `;
}
```

### Phase 2: Frontend Hook Migration (Week 3-4)

```typescript
// apps/web/src/db/cache/hooks/useProgressiveEntityList.ts

export function useProgressiveEntityList<T = Record<string, unknown>>(
  entityCode: string,
  params: Omit<EntityInstanceDataParams, 'offset'> = {},
  config: Partial<ProgressiveLoadingConfig> = {}
): UseProgressiveEntityListResult<T> {
  const {
    pageSize = 20,
    prefetchStrategy = 'predictive',
    prefetchThreshold = 500,
    skeletonMode = 'shaped',
  } = config;

  // Scroll velocity tracking
  const velocityPredictor = useRef(new ScrollVelocityPredictor());
  const containerRef = useRef<HTMLDivElement>(null);

  // TanStack infinite query with cursor
  const query = useInfiniteQuery({
    queryKey: ['progressive', entityCode, params],
    queryFn: async ({ pageParam }) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.set(key, String(value));
      });
      searchParams.set('limit', String(pageSize));
      if (pageParam) searchParams.set('cursor', pageParam);

      const response = await apiClient.get<CursorPaginatedResponse<T>>(
        `/api/v1/${entityCode}?${searchParams}`
      );
      return response.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursors.next,
  });

  // Scroll handler with velocity tracking
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    velocityPredictor.current.addSample(scrollTop);

    // Predictive prefetch based on scroll velocity
    if (
      prefetchStrategy === 'predictive' &&
      query.hasNextPage &&
      !query.isFetchingNextPage &&
      velocityPredictor.current.shouldPrefetch(distanceToBottom)
    ) {
      query.fetchNextPage();
    }

    // Fallback: threshold-based prefetch
    if (
      prefetchStrategy !== 'none' &&
      query.hasNextPage &&
      !query.isFetchingNextPage &&
      distanceToBottom < prefetchThreshold
    ) {
      query.fetchNextPage();
    }
  }, [query, prefetchStrategy, prefetchThreshold]);

  // ... rest of implementation
}
```

### Phase 3: Table Component Integration (Week 5-6)

```typescript
// Update EntityListOfInstancesTable to use progressive loading

// Add IntersectionObserver for auto-load trigger
const loadMoreRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!loadMoreRef.current || !hasMore) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !isLoadingMore) {
        loadMore();
      }
    },
    { rootMargin: '500px' } // Trigger 500px before visible
  );

  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, [hasMore, isLoadingMore, loadMore]);

// Render load-more sentinel at table bottom
<div ref={loadMoreRef} className="h-1" aria-hidden="true" />
<TableLoadingFooter status={status} ... />
```

---

## 6. Performance Benchmarks

### Expected Improvements

| Metric | Current | Future | Improvement |
|--------|---------|--------|-------------|
| Page 1 load | 200ms | 150ms | 25% faster |
| Page 100 load | 800ms | 160ms | **5x faster** |
| Page 1000 load | 3.4s | 165ms | **17x faster** |
| Time to first row | 200ms | 50ms | **4x faster** |
| Scroll jank (60fps) | 45fps avg | 60fps | Smooth |
| Memory (10K rows) | 80MB | 25MB | 70% reduction |

### Database Index Requirements

```sql
-- Required compound index for cursor pagination (critical for performance)
CREATE INDEX CONCURRENTLY idx_project_cursor
  ON app.project (created_ts DESC, id DESC)
  WHERE active_flag = true;

-- Same pattern for all paginated entities
CREATE INDEX CONCURRENTLY idx_task_cursor
  ON app.task (created_ts DESC, id DESC)
  WHERE active_flag = true;
```

---

## 7. Comparison Matrix

| Aspect | Current (Offset) | Future (Cursor) | Industry Leader |
|--------|------------------|-----------------|-----------------|
| **Pagination** | LIMIT/OFFSET | Cursor-based | ✓ GitHub, Twitter |
| **Deep page perf** | O(n) degradation | O(1) constant | ✓ All leaders |
| **Prefetch** | Static threshold | Velocity-based | ✓ Twitter, Slack |
| **Loading UX** | Full skeleton | Shaped streaming | ✓ Linear |
| **Scroll restore** | None | Anchor-based | ✓ Slack |
| **Optimistic UI** | Partial | Full with rollback | ✓ Linear |
| **Offline support** | Dexie cache | Dexie + sync queue | ✓ Linear |

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Breaking API changes** | Backward-compatible: both `offset` and `cursor` supported |
| **Index overhead** | Create indexes CONCURRENTLY, monitor disk usage |
| **Complex state machine** | Comprehensive unit tests, state diagram as source of truth |
| **Scroll restoration bugs** | Feature flag for gradual rollout |
| **Performance regression** | A/B test with metrics dashboard |

---

## 9. Conclusion

This future-state design addresses the fundamental scalability issues with offset-based pagination while providing a premium UX through predictive prefetching, shaped skeletons, and scroll position memory. The migration is backward-compatible and can be rolled out incrementally.

**Key Wins**:
1. **17x performance improvement** at scale (cursor vs offset)
2. **4x faster time-to-first-row** with shaped skeleton streaming
3. **Zero jank** with velocity-based prefetch
4. **Production-proven patterns** from GitHub, Linear, Slack, Twitter

---

## References

- [Cursor Pagination Performance Deep Dive](https://www.milanjovanovic.tech/blog/understanding-cursor-pagination-and-why-its-so-fast-deep-dive)
- [TanStack Virtual Documentation](https://tanstack.com/virtual/latest)
- [TanStack Query Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/examples/load-more-infinite-scroll)
- [React Suspense & Streaming SSR](https://react.dev/reference/react/Suspense)
- [Linear's Local-First Architecture](https://linear.app/method)
- [Slack's Message Virtualization](https://slack.engineering/)
- [Optimistic UI with Concurrency Control](https://medium.com/first-resonance-engineering/optimistic-updates-with-concurrency-control-6f1b07b8e98d)
