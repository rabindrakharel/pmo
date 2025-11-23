# Caching Strategy - Industry Standards

**Version:** 1.0.0 | **Created:** 2025-11-23

---

## 1. Industry Standard Reference

### Major Library Defaults

| Library | staleTime | gcTime | Strategy |
|---------|-----------|--------|----------|
| **React Query** | 0 | 5 min | Stale-while-revalidate |
| **Apollo Client** | 0 | Normalized | Cache-first with network |
| **SWR** | 0 | Infinite | Revalidate on focus |
| **RTK Query** | 60s | 60s | Cache with refetch |
| **Relay** | 0 | Normalized | Network-first |

### Industry Data Classification

| Data Type | Volatility | Recommended TTL | Examples |
|-----------|------------|-----------------|----------|
| **Static Config** | Rarely changes | 24h - 7d | App settings, feature flags |
| **Reference Data** | Daily changes | 1h - 24h | Categories, statuses, dropdowns |
| **Metadata** | Hourly changes | 15min - 1h | Schema, field definitions |
| **Entity Lists** | Minute changes | 30s - 5min | Tables, search results |
| **Entity Details** | Second changes | 0 - 30s | Active records being edited |
| **Real-time Data** | Constant changes | 0 (no cache) | Live dashboards, notifications |

---

## 2. Recommended TTL Strategy for PMO

### Tier 1: Static Configuration (24 hours)

**Data that rarely changes, safe to cache long-term**

```typescript
const STATIC_CONFIG_TTL = 24 * 60 * 60 * 1000;  // 24 hours

// What belongs here:
// - Application settings (themes, locales)
// - Feature flags
// - Permission definitions (not assignments)
// - UI configuration
```

**Current PMO Usage:** Not currently used - could add for app-wide settings

---

### Tier 2: Reference Data (1 hour)

**Lookup data that changes infrequently**

```typescript
const REFERENCE_DATA_TTL = 60 * 60 * 1000;  // 1 hour

// What belongs here:
// - Entity type definitions (entityCodeMetadataStore)
// - Global formatting settings (globalSettingsMetadataStore)
// - Datalabel/dropdown options (datalabelMetadataStore)
```

**Current PMO:** Uses 30 min - **RECOMMEND: Increase to 1 hour**

```typescript
// BEFORE
export const CACHE_TTL = {
  ENTITY_TYPES: 30 * 60 * 1000,      // 30 min
  DATALABELS: 30 * 60 * 1000,        // 30 min
  GLOBAL_SETTINGS: 30 * 60 * 1000,   // 30 min
};

// AFTER (Industry Standard)
export const CACHE_TTL = {
  ENTITY_TYPES: 60 * 60 * 1000,      // 1 hour
  DATALABELS: 60 * 60 * 1000,        // 1 hour
  GLOBAL_SETTINGS: 60 * 60 * 1000,   // 1 hour
};
```

---

### Tier 3: Metadata (15 minutes)

**Schema and field definitions that may change with deployments**

```typescript
const METADATA_TTL = 15 * 60 * 1000;  // 15 minutes

// What belongs here:
// - Field metadata (entityComponentMetadataStore)
// - Column definitions
// - Form schemas
```

**Current PMO:** Uses 30 min - **RECOMMEND: Decrease to 15 min**

```typescript
// AFTER
export const CACHE_TTL = {
  ENTITY_METADATA: 15 * 60 * 1000,   // 15 minutes
};
```

---

### Tier 4: Entity Lists (Stale-While-Revalidate)

**Table data that users expect to be fresh**

```typescript
const LIST_STALE_TIME = 30 * 1000;   // 30 seconds - show cached, refetch in background
const LIST_CACHE_TIME = 5 * 60 * 1000;  // 5 minutes - keep for back navigation

// What belongs here:
// - Entity list views (/project, /task, etc.)
// - Search results
// - Filtered views
```

**Current PMO:** Uses 5 min staleTime - **RECOMMEND: Decrease to 30 seconds**

```typescript
// BEFORE
const query = useQuery({
  staleTime: 5 * 60 * 1000,  // 5 minutes - TOO LONG
});

// AFTER (Industry Standard: Stale-While-Revalidate)
const query = useQuery({
  staleTime: 30 * 1000,      // 30 seconds - show cached quickly
  gcTime: 5 * 60 * 1000,     // 5 minutes - keep for navigation
  refetchOnWindowFocus: true, // Refresh when user returns
  refetchOnMount: 'always',   // Always check for updates
});
```

---

### Tier 5: Entity Details (Near Real-time)

**Individual records that may be edited by multiple users**

```typescript
const DETAIL_STALE_TIME = 10 * 1000;  // 10 seconds
const DETAIL_CACHE_TIME = 2 * 60 * 1000;  // 2 minutes

// What belongs here:
// - Entity detail pages (/project/123)
// - Edit forms
// - Single record views
```

**Current PMO:** Uses 5 min - **RECOMMEND: Decrease to 10 seconds**

```typescript
// AFTER
const query = useQuery({
  staleTime: 10 * 1000,      // 10 seconds
  gcTime: 2 * 60 * 1000,     // 2 minutes
  refetchOnWindowFocus: true,
  refetchInterval: false,     // Don't poll (use WebSocket for real-time)
});
```

---

## 3. Complete Recommended Configuration

### Updated CACHE_TTL Constants

```typescript
// apps/web/src/lib/hooks/useEntityQuery.ts

/**
 * Cache TTL Configuration - Industry Standard
 *
 * Based on data volatility and user expectations:
 * - Reference data: Users tolerate 1-hour staleness
 * - Metadata: Schema changes are deployment-time
 * - Entity data: Users expect near real-time
 */
export const CACHE_TTL = {
  // =========================================================================
  // TIER 1: Static Config (24 hours)
  // =========================================================================
  // Rarely changes, safe to cache long-term
  APP_CONFIG: 24 * 60 * 60 * 1000,

  // =========================================================================
  // TIER 2: Reference Data (1 hour)
  // =========================================================================
  // Lookup data that changes infrequently
  ENTITY_TYPES: 60 * 60 * 1000,
  DATALABELS: 60 * 60 * 1000,
  GLOBAL_SETTINGS: 60 * 60 * 1000,

  // =========================================================================
  // TIER 3: Metadata (15 minutes)
  // =========================================================================
  // Schema/field definitions, may change with deployments
  ENTITY_METADATA: 15 * 60 * 1000,

  // =========================================================================
  // TIER 4: Entity Lists (30 seconds stale, 5 min cache)
  // =========================================================================
  // Stale-while-revalidate: show cached, refetch in background
  ENTITY_LIST_STALE: 30 * 1000,
  ENTITY_LIST_CACHE: 5 * 60 * 1000,

  // =========================================================================
  // TIER 5: Entity Details (10 seconds stale, 2 min cache)
  // =========================================================================
  // Near real-time for actively edited records
  ENTITY_DETAIL_STALE: 10 * 1000,
  ENTITY_DETAIL_CACHE: 2 * 60 * 1000,
} as const;
```

### Updated React Query Configuration

```typescript
// apps/web/src/lib/queryClient.ts

import { QueryClient } from '@tanstack/react-query';
import { CACHE_TTL } from './hooks/useEntityQuery';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default: Stale-while-revalidate for lists
      staleTime: CACHE_TTL.ENTITY_LIST_STALE,
      gcTime: CACHE_TTL.ENTITY_LIST_CACHE,

      // Revalidation triggers
      refetchOnWindowFocus: true,   // ✅ Industry standard
      refetchOnReconnect: true,     // ✅ Industry standard
      refetchOnMount: true,         // ✅ Industry standard

      // Error handling
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Network mode
      networkMode: 'offlineFirst',  // Show cached data while offline
    },
    mutations: {
      // Optimistic updates
      networkMode: 'offlineFirst',
      retry: 1,
    },
  },
});
```

### Updated Hook Configurations

```typescript
// useEntityInstanceList - Lists
export function useEntityInstanceList(entityCode, params, options) {
  return useQuery({
    queryKey: queryKeys.entityInstanceList(entityCode, params),
    queryFn: fetchList,

    // Stale-while-revalidate
    staleTime: CACHE_TTL.ENTITY_LIST_STALE,    // 30 seconds
    gcTime: CACHE_TTL.ENTITY_LIST_CACHE,       // 5 minutes

    // Aggressive revalidation for lists
    refetchOnWindowFocus: true,
    refetchOnMount: true,

    ...options,
  });
}

// useEntityInstance - Details
export function useEntityInstance(entityCode, id, options) {
  return useQuery({
    queryKey: queryKeys.entityInstance(entityCode, id),
    queryFn: fetchEntity,

    // Near real-time for details
    staleTime: CACHE_TTL.ENTITY_DETAIL_STALE,  // 10 seconds
    gcTime: CACHE_TTL.ENTITY_DETAIL_CACHE,     // 2 minutes

    // Aggressive revalidation for details
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',

    ...options,
  });
}

// useEntityCodes - Reference data
export function useEntityCodes(options) {
  return useQuery({
    queryKey: queryKeys.entityCodes(),
    queryFn: fetchEntityCodes,

    // Long-lived reference data
    staleTime: CACHE_TTL.ENTITY_TYPES,         // 1 hour
    gcTime: CACHE_TTL.ENTITY_TYPES * 2,        // 2 hours

    // Less aggressive revalidation
    refetchOnWindowFocus: false,
    refetchOnMount: false,

    ...options,
  });
}

// useDatalabels - Reference data
export function useDatalabels(fieldKey, options) {
  return useQuery({
    queryKey: queryKeys.datalabels(fieldKey),
    queryFn: fetchDatalabel,

    // Long-lived reference data
    staleTime: CACHE_TTL.DATALABELS,           // 1 hour
    gcTime: CACHE_TTL.DATALABELS * 2,          // 2 hours

    // Less aggressive revalidation
    refetchOnWindowFocus: false,
    refetchOnMount: false,

    ...options,
  });
}
```

---

## 4. Stale-While-Revalidate Pattern

### What It Means

```
User Request → Cache Check → Return Cached (if exists) → Background Refetch → Update Cache
                   ↓
            [staleTime expired?]
                   ↓
              Yes: Refetch in background
              No: Just return cached
```

### Visual Timeline

```
Time: 0s        30s         60s         5min
      │         │           │           │
      ▼         ▼           ▼           ▼
   [Fresh]   [Stale]     [Stale]    [Garbage Collected]
      │         │           │           │
      │    Background   Background      │
      │    refetch      refetch         │
      ▼         ▼           ▼           ▼
   Return    Return      Return      API Fetch
   cached    cached +    cached +    (no cache)
             refetch     refetch
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Fast UI** | Always show cached data immediately |
| **Fresh data** | Background refetch keeps data current |
| **Reduced API calls** | Only refetch when stale |
| **Offline support** | Works without network |

---

## 5. Comparison: Before vs After

### Current (Suboptimal)

| Data Type | staleTime | gcTime | Issues |
|-----------|-----------|--------|--------|
| Entity Types | 30 min | 60 min | Could be 1h |
| Datalabels | 30 min | 60 min | Could be 1h |
| Global Settings | 30 min | 60 min | Could be 1h |
| Entity Metadata | 30 min | 60 min | Should be 15min |
| Entity Lists | 5 min | 10 min | **Too stale** - user sees old data |
| Entity Details | 5 min | 10 min | **Too stale** - edit conflicts |

### Recommended (Industry Standard)

| Data Type | staleTime | gcTime | Rationale |
|-----------|-----------|--------|-----------|
| Entity Types | 1 hour | 2 hours | Rarely changes |
| Datalabels | 1 hour | 2 hours | Admin-controlled |
| Global Settings | 1 hour | 2 hours | Deployment-time changes |
| Entity Metadata | 15 min | 30 min | Schema changes with releases |
| Entity Lists | **30 sec** | 5 min | Stale-while-revalidate |
| Entity Details | **10 sec** | 2 min | Near real-time for edits |

---

## 6. Implementation Diff

```typescript
// apps/web/src/lib/hooks/useEntityQuery.ts

// BEFORE
export const CACHE_TTL = {
  SESSION: 30 * 60 * 1000,
  ENTITY_TYPES: 30 * 60 * 1000,
  DATALABELS: 30 * 60 * 1000,
  GLOBAL_SETTINGS: 30 * 60 * 1000,
  ENTITY_METADATA: 30 * 60 * 1000,
  ENTITY_LIST: 5 * 60 * 1000,
  ENTITY_DETAIL: 5 * 60 * 1000,
};

// AFTER
export const CACHE_TTL = {
  // Reference Data (long-lived)
  ENTITY_TYPES: 60 * 60 * 1000,      // 1 hour (was 30 min)
  DATALABELS: 60 * 60 * 1000,        // 1 hour (was 30 min)
  GLOBAL_SETTINGS: 60 * 60 * 1000,   // 1 hour (was 30 min)

  // Metadata (medium-lived)
  ENTITY_METADATA: 15 * 60 * 1000,   // 15 min (was 30 min)

  // Entity Data (short-lived, stale-while-revalidate)
  ENTITY_LIST_STALE: 30 * 1000,      // 30 sec (was 5 min)
  ENTITY_LIST_CACHE: 5 * 60 * 1000,  // 5 min (unchanged)
  ENTITY_DETAIL_STALE: 10 * 1000,    // 10 sec (was 5 min)
  ENTITY_DETAIL_CACHE: 2 * 60 * 1000, // 2 min (was 5 min)
};
```

---

## 7. Advanced Patterns (Future)

### Pattern 1: Optimistic UI with Rollback

```typescript
const mutation = useMutation({
  mutationFn: updateEntity,
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey });

    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKey);

    // Optimistically update
    queryClient.setQueryData(queryKey, (old) => ({
      ...old,
      ...newData,
    }));

    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(queryKey, context.previous);
  },
  onSettled: () => {
    // Always refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey });
  },
});
```

### Pattern 2: Prefetching on Hover

```typescript
function EntityListItem({ entity }) {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    // Prefetch detail data on hover
    queryClient.prefetchQuery({
      queryKey: queryKeys.entityInstance('project', entity.id),
      queryFn: () => fetchEntity(entity.id),
      staleTime: CACHE_TTL.ENTITY_DETAIL_STALE,
    });
  };

  return (
    <div onMouseEnter={handleMouseEnter}>
      {entity.name}
    </div>
  );
}
```

### Pattern 3: Infinite Scroll with Cursor

```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['projects', 'infinite'],
  queryFn: ({ pageParam = null }) =>
    fetchProjects({ cursor: pageParam, limit: 50 }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  staleTime: CACHE_TTL.ENTITY_LIST_STALE,
});
```

### Pattern 4: Real-time Updates via WebSocket

```typescript
// For truly real-time data, use WebSocket subscription
useEffect(() => {
  const ws = new WebSocket('wss://api/ws');

  ws.onmessage = (event) => {
    const { type, entityCode, entityId, data } = JSON.parse(event.data);

    if (type === 'ENTITY_UPDATED') {
      // Update React Query cache directly
      queryClient.setQueryData(
        queryKeys.entityInstance(entityCode, entityId),
        (old) => ({ ...old, ...data })
      );
    }
  };

  return () => ws.close();
}, [queryClient]);
```

---

## 8. Summary

### Key Changes

| Setting | Before | After | Change |
|---------|--------|-------|--------|
| Reference data TTL | 30 min | 1 hour | +100% |
| Metadata TTL | 30 min | 15 min | -50% |
| List staleTime | 5 min | 30 sec | **-90%** |
| Detail staleTime | 5 min | 10 sec | **-97%** |
| refetchOnWindowFocus | false | true | Enabled |
| refetchOnMount | false | true | Enabled |

### Expected Improvements

| Metric | Before | After |
|--------|--------|-------|
| Data freshness (lists) | 5 min stale | 30 sec stale |
| Data freshness (details) | 5 min stale | 10 sec stale |
| API calls (reference data) | Every 30 min | Every 1 hour |
| User perception | "Data seems old" | "Data is current" |

---

**Document Version:** 1.0.0
**Status:** Ready for Implementation
