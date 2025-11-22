# State Management Architecture

**Version:** 5.0.0 | **Location:** `apps/web/src/stores/`

---

## Overview

The PMO platform uses a **hybrid state management architecture** combining Zustand stores for client-side caching and React Query for server state synchronization.

**Core Principle:** Zustand caches metadata (long-lived), React Query manages entity data (short-lived with refetch).

---

## System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STATE MANAGEMENT ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    ZUSTAND STORES (9 Total)                          │    │
│  ├──────────────────┬──────────────────┬───────────────────────────────┤    │
│  │  SESSION-LEVEL   │   URL-BOUND      │         MEMORY                │    │
│  │  (30 min TTL)    │   (5 min TTL)    │     (No persist)              │    │
│  ├──────────────────┼──────────────────┼───────────────────────────────┤    │
│  │ globalSettings   │ entityList       │ editStateStore                │    │
│  │ datalabelMeta    │ entityInstance   │ uiStateStore                  │    │
│  │ entityCodeMeta   │ componentMeta    │                               │    │
│  └──────────────────┴──────────────────┴───────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    REACT QUERY                                       │    │
│  │  • Server state synchronization                                      │    │
│  │  • Automatic refetch on focus/reconnect                              │    │
│  │  • Optimistic updates with rollback                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Store Categories

### 1.1 Session-Level Stores (30 min TTL, persist across navigation)

| Store | Purpose | Populated From |
|-------|---------|----------------|
| `globalSettingsMetadataStore` | Currency, locale, timezone settings | `GET /api/v1/settings/global` |
| `datalabelMetadataStore` | Dropdown options for `dl__*` fields | `GET /api/v1/datalabel?name=<key>` |
| `entityCodeMetadataStore` | Entity type metadata (icons, labels, children) | `GET /api/v1/entity/types` |

**Characteristics:**
- Loaded once on login
- Rarely changes during session
- Shared across all entity views

### 1.2 URL-Bound Stores (5 min TTL, invalidate on URL change)

| Store | Purpose | Populated From |
|-------|---------|----------------|
| `EntityListOfInstancesDataStore` | Entity list data (paginated) | `GET /api/v1/{entity}?limit=&offset=` |
| `EntitySpecificInstanceDataStore` | Single entity instance | `GET /api/v1/{entity}/{id}` |
| `entityComponentMetadataStore` | Field metadata per component | Piggybacks on entity responses |

**Characteristics:**
- Keyed by URL/query hash
- Invalidated when navigating away
- Re-fetched when returning to same URL

### 1.3 Memory Stores (No persistence)

| Store | Purpose | Scope |
|-------|---------|-------|
| `editStateStore` | Tracks dirty fields during editing | Per-entity-instance |
| `uiStateStore` | Sidebar state, active tabs, modals | Global UI state |

---

## 2. Data Flow Architecture

### 2.1 Request Flow (User → Server → Cache)

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│   User      │─────>│  Component   │─────>│ React Query │─────>│   API        │
│  Action     │      │  useQuery()  │      │   Cache     │      │  Server      │
└─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
                            │                     │                     │
                            │                     │                     │
                            v                     v                     v
                     ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
                     │   Zustand    │<─────│  Response   │<─────│  Database    │
                     │   Store      │      │  + metadata │      │              │
                     └──────────────┘      └─────────────┘      └──────────────┘
```

### 2.2 API Response → Store Mapping

```typescript
// API Response Structure
{
  data: [...],              // → EntityListOfInstancesDataStore / EntitySpecificInstanceDataStore
  fields: [...],            // → (used internally by stores)
  metadata: {               // → entityComponentMetadataStore
    entityDataTable: {...},
    entityFormContainer: {...}
  },
  total, limit, offset      // → Pagination state
}

// Dedicated Endpoints (Session-level stores)
GET /api/v1/settings/global        → globalSettingsMetadataStore
GET /api/v1/datalabel?name=<key>   → datalabelMetadataStore
GET /api/v1/entity/types           → entityCodeMetadataStore
```

---

## 3. Cache Strategy

### 3.1 Cache Hierarchy

```
┌──────────────────────────────────────────────────────────────────┐
│                      CACHE HIERARCHY                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Level 1: React Query Cache (Automatic)                          │
│  ├── staleTime: 5 minutes                                        │
│  ├── cacheTime: 10 minutes                                       │
│  └── refetchOnWindowFocus: true                                  │
│                                                                   │
│  Level 2: Zustand Session Cache (Manual)                         │
│  ├── TTL: 30 minutes                                             │
│  ├── Persist: localStorage                                       │
│  └── Clear: On logout                                            │
│                                                                   │
│  Level 3: Zustand URL Cache (Manual)                             │
│  ├── TTL: 5 minutes                                              │
│  ├── Key: URL + query hash                                       │
│  └── Clear: On URL change                                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Cache Invalidation Rules

| Event | Action |
|-------|--------|
| URL navigation | Invalidate URL-bound stores |
| Entity mutation (PATCH/DELETE) | Invalidate entity + list caches |
| Logout | Clear all stores |
| Settings change | Invalidate session stores |
| Window refocus | React Query auto-refetch |

---

## 4. Edit State Management

### 4.1 Field-Level Change Tracking

```typescript
// editStateStore structure
{
  entityCode: 'project',
  entityId: 'uuid-123',
  originalValues: { name: 'Old Name', budget_allocated_amt: 50000 },
  currentValues: { name: 'New Name', budget_allocated_amt: 50000 },
  dirtyFields: ['name'],  // Only changed fields
  isEditing: true
}
```

### 4.2 Edit Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Click Edit  │────>│ Store        │────>│ User Edits   │────>│ Track Dirty  │
│              │     │ Original     │     │ Fields       │     │ Fields Only  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      v
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Clear Edit  │<────│ Invalidate   │<────│ PATCH Only   │<────│  Click Save  │
│  State       │     │ Cache        │     │ Dirty Fields │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 4.3 Minimal PATCH Payload

```typescript
// Only send changed fields
const dirtyFields = editStateStore.getDirtyFields();
// dirtyFields = ['name']

const payload = {};
for (const field of dirtyFields) {
  payload[field] = currentValues[field];
}
// payload = { name: 'New Name' }

await api.patch(`/api/v1/project/${id}`, payload);
```

---

## 5. Optimistic Updates Pattern

### 5.1 Mutation Flow

```typescript
const mutation = useMutation({
  mutationFn: (data) => api.patch(`/api/v1/project/${id}`, data),

  onMutate: async (newData) => {
    // 1. Cancel outgoing refetches
    await queryClient.cancelQueries(['project', id]);

    // 2. Snapshot previous value
    const previousData = queryClient.getQueryData(['project', id]);

    // 3. Optimistically update cache
    queryClient.setQueryData(['project', id], (old) => ({
      ...old,
      ...newData
    }));

    return { previousData };
  },

  onError: (err, newData, context) => {
    // 4. Rollback on error
    queryClient.setQueryData(['project', id], context.previousData);
  },

  onSettled: () => {
    // 5. Refetch to ensure consistency
    queryClient.invalidateQueries(['project', id]);
  }
});
```

### 5.2 Optimistic Update Timeline

```
User Click     Optimistic      Server         Success/Error
    │          Update            │                 │
    │              │              │                 │
    ├──────────────┤              │                 │
    │   UI shows   │              │                 │
    │   new value  │              │                 │
    │              ├──────────────┤                 │
    │              │   API Call   │                 │
    │              │              ├─────────────────┤
    │              │              │  Confirm/       │
    │              │              │  Rollback       │
    │              │              │                 │
    v              v              v                 v
```

---

## 6. Store Implementation Patterns

### 6.1 Session Store Pattern

```typescript
// globalSettingsMetadataStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GlobalSettingsStore {
  settings: GlobalSettings | null;
  lastFetched: number | null;
  setSettings: (settings: GlobalSettings) => void;
  isStale: () => boolean;
  clear: () => void;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes

export const useGlobalSettingsStore = create<GlobalSettingsStore>()(
  persist(
    (set, get) => ({
      settings: null,
      lastFetched: null,

      setSettings: (settings) => set({
        settings,
        lastFetched: Date.now()
      }),

      isStale: () => {
        const { lastFetched } = get();
        if (!lastFetched) return true;
        return Date.now() - lastFetched > TTL_MS;
      },

      clear: () => set({ settings: null, lastFetched: null })
    }),
    { name: 'global-settings-store' }
  )
);
```

### 6.2 URL-Bound Store Pattern

```typescript
// entityListStore.ts
import { create } from 'zustand';

interface EntityListStore {
  cache: Map<string, { data: any[]; timestamp: number }>;
  getList: (cacheKey: string) => any[] | null;
  setList: (cacheKey: string, data: any[]) => void;
  invalidate: (cacheKey: string) => void;
  clearAll: () => void;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useEntityListStore = create<EntityListStore>((set, get) => ({
  cache: new Map(),

  getList: (cacheKey) => {
    const entry = get().cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL_MS) {
      get().invalidate(cacheKey);
      return null;
    }
    return entry.data;
  },

  setList: (cacheKey, data) => {
    const cache = new Map(get().cache);
    cache.set(cacheKey, { data, timestamp: Date.now() });
    set({ cache });
  },

  invalidate: (cacheKey) => {
    const cache = new Map(get().cache);
    cache.delete(cacheKey);
    set({ cache });
  },

  clearAll: () => set({ cache: new Map() })
}));
```

### 6.3 Edit State Store Pattern

```typescript
// editStateStore.ts
import { create } from 'zustand';

interface EditStateStore {
  entityCode: string | null;
  entityId: string | null;
  originalValues: Record<string, any>;
  currentValues: Record<string, any>;
  dirtyFields: Set<string>;

  startEditing: (entityCode: string, entityId: string, values: Record<string, any>) => void;
  updateField: (field: string, value: any) => void;
  getDirtyFields: () => string[];
  getDirtyValues: () => Record<string, any>;
  cancelEditing: () => void;
  commitEditing: () => void;
}

export const useEditStateStore = create<EditStateStore>((set, get) => ({
  entityCode: null,
  entityId: null,
  originalValues: {},
  currentValues: {},
  dirtyFields: new Set(),

  startEditing: (entityCode, entityId, values) => set({
    entityCode,
    entityId,
    originalValues: { ...values },
    currentValues: { ...values },
    dirtyFields: new Set()
  }),

  updateField: (field, value) => {
    const { originalValues, currentValues, dirtyFields } = get();
    const newDirtyFields = new Set(dirtyFields);

    if (value === originalValues[field]) {
      newDirtyFields.delete(field);
    } else {
      newDirtyFields.add(field);
    }

    set({
      currentValues: { ...currentValues, [field]: value },
      dirtyFields: newDirtyFields
    });
  },

  getDirtyFields: () => Array.from(get().dirtyFields),

  getDirtyValues: () => {
    const { currentValues, dirtyFields } = get();
    const result: Record<string, any> = {};
    for (const field of dirtyFields) {
      result[field] = currentValues[field];
    }
    return result;
  },

  cancelEditing: () => set({
    entityCode: null,
    entityId: null,
    originalValues: {},
    currentValues: {},
    dirtyFields: new Set()
  }),

  commitEditing: () => set({
    originalValues: { ...get().currentValues },
    dirtyFields: new Set()
  })
}));
```

---

## 7. React Query Integration

### 7.1 Query Key Conventions

```typescript
// Entity list
['entity', entityCode, 'list', queryHash]
// Example: ['entity', 'project', 'list', 'limit=20&offset=0']

// Entity instance
['entity', entityCode, 'instance', entityId]
// Example: ['entity', 'project', 'instance', 'uuid-123']

// Child entities
['entity', parentCode, parentId, childCode, 'list']
// Example: ['entity', 'project', 'uuid-123', 'task', 'list']
```

### 7.2 Hook Patterns

```typescript
// useEntityList.ts
export function useEntityList(entityCode: string, params: ListParams) {
  const queryKey = ['entity', entityCode, 'list', hashParams(params)];

  return useQuery({
    queryKey,
    queryFn: () => api.get(`/api/v1/${entityCode}`, { params }),
    staleTime: 5 * 60 * 1000,
    onSuccess: (data) => {
      // Populate Zustand metadata store
      if (data.metadata) {
        entityComponentMetadataStore.setMetadata(entityCode, data.metadata);
      }
    }
  });
}

// useEntityInstance.ts
export function useEntityInstance(entityCode: string, entityId: string) {
  return useQuery({
    queryKey: ['entity', entityCode, 'instance', entityId],
    queryFn: () => api.get(`/api/v1/${entityCode}/${entityId}`),
    staleTime: 5 * 60 * 1000
  });
}
```

---

## 8. Design Patterns Summary

| Pattern | Implementation | Benefit |
|---------|----------------|---------|
| **Hybrid Caching** | Zustand (metadata) + React Query (data) | Optimal TTL per data type |
| **URL-Bound Invalidation** | Cache key includes URL hash | Fresh data on navigation |
| **Field-Level Tracking** | `dirtyFields` Set in editStateStore | Minimal PATCH payloads |
| **Optimistic Updates** | `onMutate` → update → rollback on error | Instant UI feedback |
| **Session Persistence** | `zustand/persist` middleware | Survive page refresh |
| **Metadata Piggybacking** | Extract from entity responses | No extra API calls |

---

## 9. Performance Metrics

| Metric | Target | Implementation |
|--------|--------|----------------|
| First Load | < 200ms | Session cache hit |
| Navigation | < 100ms | URL cache hit |
| Edit Save | < 50ms perceived | Optimistic update |
| Cache Hit Rate | > 90% | Appropriate TTLs |
| Payload Size | Minimal | Dirty field tracking |

---

**Last Updated:** 2025-11-22 | **Status:** Production Ready
