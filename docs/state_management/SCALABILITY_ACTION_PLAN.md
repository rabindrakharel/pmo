# State Management Scalability Action Plan

**Version:** 1.0.0 | **Created:** 2025-11-23 | **Target:** 100k+ Records

---

## Executive Summary

This plan addresses 4 critical issues to achieve scalability from current ~1,000 records to 100,000+ records:

| Phase | Issue | Effort | Impact |
|-------|-------|--------|--------|
| 1 | Dual cache redundancy | 2-3 days | High - 50% memory reduction |
| 2 | No normalization | 3-5 days | High - Consistent data across views |
| 3 | Manual TTL | 1 day | Medium - Prevents memory leaks |
| 4 | getState() staleness | 0.5 day | Medium - Developer clarity |

**Total Estimated Effort:** 7-10 days

---

## Current Architecture (Before)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT: DUAL CACHE PROBLEM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API Response ─────────────────────────────────────────────────────────────│
│       │                                                                      │
│       ├──────────────────────────┐                                           │
│       │                          │                                           │
│       ▼                          ▼                                           │
│  ┌──────────────────┐    ┌──────────────────────┐                           │
│  │  React Query     │    │  Zustand Stores      │                           │
│  │  Cache           │    │                      │                           │
│  │                  │    │  entityInstanceList  │  ◄── DUPLICATE DATA       │
│  │  ['project', p]  │    │  entityInstanceData  │                           │
│  │  Same data here  │    │  Same data here too  │                           │
│  └──────────────────┘    └──────────────────────┘                           │
│                                                                              │
│  Problems:                                                                   │
│  • 2x memory usage for entity data                                           │
│  • Must invalidate BOTH on mutation                                          │
│  • Race conditions cause inconsistency                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Target Architecture (After)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TARGET: SINGLE SOURCE OF TRUTH                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API Response ─────────────────────────────────────────────────────────────│
│       │                                                                      │
│       ▼                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      React Query Cache                                │   │
│  │                   (SOLE DATA CACHE)                                   │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │               Normalized Entity Store                           │ │   │
│  │  │                                                                 │ │   │
│  │  │  entities: {                                                    │ │   │
│  │  │    project: { 'uuid-1': {...}, 'uuid-2': {...} }               │ │   │
│  │  │    task: { 'uuid-3': {...}, 'uuid-4': {...} }                  │ │   │
│  │  │  }                                                              │ │   │
│  │  │  queries: {                                                     │ │   │
│  │  │    'project-list-page1': ['uuid-1', 'uuid-2']                  │ │   │
│  │  │    'project-detail-uuid-1': 'uuid-1'                           │ │   │
│  │  │  }                                                              │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Zustand Stores (UI STATE ONLY)                     │   │
│  │                                                                       │   │
│  │  • entityEditStore - Dirty fields, undo/redo                         │   │
│  │  • uiPreferencesStore - View mode, column visibility                 │   │
│  │  • selectionStore - Selected rows, active tab                        │   │
│  │  • globalSettingsStore - Formatting (30 min TTL - still needed)      │   │
│  │  • datalabelStore - Dropdowns (30 min TTL - still needed)            │   │
│  │  • entityCodeStore - Entity types (30 min TTL - still needed)        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Eliminate Dual Cache Redundancy

**Goal:** Remove `entityInstanceDataStore` and `entityInstanceListDataStore`, use React Query as sole data cache.

**Effort:** 2-3 days

### Step 1.1: Audit Current Usage

**Files to audit:**

```bash
# Find all imports of the redundant stores
grep -r "entityInstanceDataStore\|entityInstanceListDataStore" apps/web/src/
```

**Expected files:**
- `stores/entityInstanceDataStore.ts` (DELETE)
- `stores/entityInstanceListDataStore.ts` (DELETE)
- `stores/index.ts` (MODIFY - remove exports)
- `lib/hooks/useEntityQuery.ts` (MODIFY - remove store writes)
- `pages/shared/EntitySpecificInstancePage.tsx` (MODIFY - if using store directly)

### Step 1.2: Remove Store Writes from useEntityQuery

**File:** `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
// BEFORE (lines ~187-193)
const query = useQuery<EntityInstanceListResult<T>>({
  queryFn: async () => {
    // ... fetch logic ...

    // ❌ REMOVE: Redundant store write
    useEntityInstanceListDataStore.getState().setList(entityCode, queryHash, {
      data: result.data,
      total: result.total,
      // ...
    });

    return result;
  },
});

// AFTER
const query = useQuery<EntityInstanceListResult<T>>({
  queryFn: async () => {
    // ... fetch logic ...

    // React Query cache is sufficient - no Zustand write needed
    return result;
  },
});
```

**Similar change for `useEntityInstance`** (lines ~316):

```typescript
// ❌ REMOVE this line
useEntityInstanceDataStore.getState().setInstance(entityCode, id, data);
```

### Step 1.3: Update useEntityMutation Invalidation

**File:** `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
// BEFORE (lines ~466-477)
const invalidateAllCaches = useCallback((id?: string) => {
  // React Query invalidation
  queryClient.invalidateQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });

  // ❌ REMOVE: Zustand invalidation (no longer needed)
  useEntityInstanceDataStore.getState().invalidate(entityCode, id);
  useEntityInstanceListDataStore.getState().invalidate(entityCode);
}, [queryClient, entityCode]);

// AFTER
const invalidateAllCaches = useCallback((id?: string) => {
  // React Query invalidation only
  if (id) {
    queryClient.invalidateQueries({ queryKey: queryKeys.entityInstance(entityCode, id) });
  }
  queryClient.invalidateQueries({ queryKey: ['entity-instance-list', entityCode] });
}, [queryClient, entityCode]);
```

### Step 1.4: Delete Redundant Stores

```bash
# Delete the files
rm apps/web/src/stores/entityInstanceDataStore.ts
rm apps/web/src/stores/entityInstanceListDataStore.ts
```

**Update `stores/index.ts`:**

```typescript
// REMOVE these exports
// export * from './entityInstanceDataStore';
// export * from './entityInstanceListDataStore';
```

### Step 1.5: Update useCacheInvalidation

**File:** `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
// BEFORE (lines ~1035-1046)
const invalidateAll = useCallback(() => {
  queryClient.invalidateQueries();

  // ❌ REMOVE these lines
  useEntityInstanceDataStore.getState().clear();
  useEntityInstanceListDataStore.getState().clear();

  // ✅ KEEP these (still needed for metadata)
  useGlobalSettingsMetadataStore.getState().clear();
  useDatalabelMetadataStore.getState().clear();
  useEntityComponentMetadataStore.getState().clear();
  useEntityCodeMetadataStore.getState().clear();
}, [queryClient]);
```

### Step 1.6: Verification

```bash
# Ensure no remaining references
grep -r "entityInstanceDataStore\|entityInstanceListDataStore" apps/web/src/

# Run type check
cd apps/web && pnpm run build

# Test flows
# 1. List page loads correctly
# 2. Detail page loads correctly
# 3. Create entity → list refreshes
# 4. Update entity → detail + list refresh
# 5. Delete entity → list refreshes
```

---

## Phase 2: Implement Data Normalization

**Goal:** Store entities once, reference by ID to prevent stale data across views.

**Effort:** 3-5 days

### Step 2.1: Create Normalized Cache Structure

**New File:** `apps/web/src/lib/cache/normalizedCache.ts`

```typescript
/**
 * Normalized Cache for React Query
 *
 * Stores entities by type and ID, queries reference IDs only.
 * Updates to an entity are reflected in ALL queries that reference it.
 */

import { QueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

interface NormalizedEntity {
  id: string;
  __typename: string;  // Entity type (project, task, etc.)
  [key: string]: any;
}

interface NormalizedStore {
  entities: Record<string, Record<string, NormalizedEntity>>;  // { project: { id1: {...}, id2: {...} } }
}

// ============================================================================
// Normalization Utilities
// ============================================================================

/**
 * Extract entity type from query key
 */
function getEntityType(queryKey: readonly unknown[]): string | null {
  if (queryKey[0] === 'entity-instance-list' || queryKey[0] === 'entity-instance') {
    return queryKey[1] as string;
  }
  return null;
}

/**
 * Normalize a single entity
 */
export function normalizeEntity(entity: any, entityType: string): NormalizedEntity {
  return {
    ...entity,
    __typename: entityType,
  };
}

/**
 * Normalize a list response
 */
export function normalizeListResponse(
  response: { data: any[]; metadata?: any; total?: number },
  entityType: string
): {
  normalizedEntities: Record<string, NormalizedEntity>;
  ids: string[];
  metadata: any;
  total: number;
} {
  const normalizedEntities: Record<string, NormalizedEntity> = {};
  const ids: string[] = [];

  response.data.forEach(entity => {
    const id = entity.id;
    normalizedEntities[id] = normalizeEntity(entity, entityType);
    ids.push(id);
  });

  return {
    normalizedEntities,
    ids,
    metadata: response.metadata,
    total: response.total || response.data.length,
  };
}

/**
 * Denormalize IDs back to full entities
 */
export function denormalizeList(
  ids: string[],
  entityType: string,
  store: NormalizedStore
): any[] {
  const entityStore = store.entities[entityType] || {};
  return ids.map(id => entityStore[id]).filter(Boolean);
}

// ============================================================================
// Query Client Configuration
// ============================================================================

/**
 * Create a query client with normalized caching
 */
export function createNormalizedQueryClient(): QueryClient {
  // Global normalized store
  const normalizedStore: NormalizedStore = {
    entities: {},
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,  // 5 minutes
        gcTime: 10 * 60 * 1000,    // 10 minutes
        refetchOnWindowFocus: false,
      },
    },
  });

  // Expose store for updates
  (queryClient as any).__normalizedStore = normalizedStore;

  return queryClient;
}

/**
 * Get the normalized store from query client
 */
export function getNormalizedStore(queryClient: QueryClient): NormalizedStore {
  return (queryClient as any).__normalizedStore;
}

/**
 * Update a single entity in the normalized store
 * This will be reflected in ALL queries that reference this entity
 */
export function updateNormalizedEntity(
  queryClient: QueryClient,
  entityType: string,
  entityId: string,
  updates: Partial<NormalizedEntity>
): void {
  const store = getNormalizedStore(queryClient);

  if (!store.entities[entityType]) {
    store.entities[entityType] = {};
  }

  const existing = store.entities[entityType][entityId] || { id: entityId, __typename: entityType };
  store.entities[entityType][entityId] = { ...existing, ...updates };

  // Trigger React Query to re-render components using this entity
  // By invalidating queries that might contain this entity
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return getEntityType(key) === entityType;
    },
  });
}

/**
 * Remove an entity from the normalized store
 */
export function removeNormalizedEntity(
  queryClient: QueryClient,
  entityType: string,
  entityId: string
): void {
  const store = getNormalizedStore(queryClient);

  if (store.entities[entityType]) {
    delete store.entities[entityType][entityId];
  }

  // Invalidate queries
  queryClient.invalidateQueries({
    predicate: (query) => getEntityType(query.queryKey) === entityType,
  });
}
```

### Step 2.2: Update useEntityInstanceList to Use Normalization

**File:** `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
import {
  normalizeListResponse,
  denormalizeList,
  getNormalizedStore,
  updateNormalizedEntity,
} from '../cache/normalizedCache';

export function useEntityInstanceList<T = any>(
  entityCode: string,
  params: EntityInstanceListParams = {},
  options?: Omit<UseQueryOptions<EntityInstanceListResult<T>>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient();

  const query = useQuery<EntityInstanceListResult<T>>({
    queryKey: queryKeys.entityInstanceList(entityCode, normalizedParams),
    queryFn: async () => {
      const api = APIFactory.getAPI(entityCode);
      const response = await api.list(normalizedParams);

      // Normalize the response
      const { normalizedEntities, ids, metadata, total } = normalizeListResponse(
        response,
        entityCode
      );

      // Store normalized entities
      const store = getNormalizedStore(queryClient);
      if (!store.entities[entityCode]) {
        store.entities[entityCode] = {};
      }
      Object.assign(store.entities[entityCode], normalizedEntities);

      // Return denormalized for component consumption
      // But internally, we're storing normalized
      return {
        data: response.data,  // Full data for now, will optimize later
        metadata: response.metadata,
        total,
        page: normalizedParams.page,
        pageSize: normalizedParams.pageSize,
        hasMore: (response.data?.length || 0) === normalizedParams.pageSize,
        // Store IDs for potential future optimization
        _ids: ids,
      };
    },
    // ...rest of options
  });

  return query;
}
```

### Step 2.3: Update useEntityMutation for Normalized Updates

```typescript
export function useEntityMutation(entityCode: string) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const api = APIFactory.getAPI(entityCode);
      return api.update(id, data);
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['entity-instance', entityCode] });
      await queryClient.cancelQueries({ queryKey: ['entity-instance-list', entityCode] });

      // Snapshot for rollback
      const store = getNormalizedStore(queryClient);
      const previousEntity = store.entities[entityCode]?.[id];

      // Optimistic update in normalized store
      updateNormalizedEntity(queryClient, entityCode, id, data);

      return { previousEntity };
    },
    onError: (_error, { id }, context) => {
      // Rollback
      if (context?.previousEntity) {
        updateNormalizedEntity(queryClient, entityCode, id, context.previousEntity);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['entity-instance', entityCode] });
      queryClient.invalidateQueries({ queryKey: ['entity-instance-list', entityCode] });
    },
  });

  // ... rest of mutations
}
```

### Step 2.4: Verification

```typescript
// Test scenario: Update entity in detail view, verify list view updates
// 1. Load /project (list shows "Project A")
// 2. Open /project/1 (detail shows "Project A")
// 3. Edit name to "Project B", save
// 4. Navigate back to /project
// 5. List should show "Project B" immediately (no refetch needed)
```

---

## Phase 3: Add Garbage Collection

**Goal:** Automatically clean up expired cache entries to prevent memory leaks.

**Effort:** 1 day

### Step 3.1: Add GC to Remaining Zustand Stores

**File:** `apps/web/src/stores/globalSettingsMetadataStore.ts` (and similar for others)

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const CACHE_TTL = 30 * 60 * 1000;  // 30 minutes
const GC_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface GlobalSettingsState {
  settings: GlobalSettings | null;
  timestamp: number | null;

  // Actions
  setGlobalSettings: (settings: GlobalSettings) => void;
  getGlobalSettings: () => GlobalSettings | null;
  isExpired: () => boolean;
  clear: () => void;
}

export const useGlobalSettingsMetadataStore = create<GlobalSettingsState>()(
  persist(
    (set, get) => ({
      settings: null,
      timestamp: null,

      setGlobalSettings: (settings) => {
        set({ settings, timestamp: Date.now() });
      },

      getGlobalSettings: () => {
        const { settings, timestamp } = get();
        if (!settings || !timestamp) return null;
        if (Date.now() - timestamp > CACHE_TTL) {
          // Expired - clear and return null
          set({ settings: null, timestamp: null });
          return null;
        }
        return settings;
      },

      isExpired: () => {
        const { timestamp } = get();
        if (!timestamp) return true;
        return Date.now() - timestamp > CACHE_TTL;
      },

      clear: () => {
        set({ settings: null, timestamp: null });
      },
    }),
    {
      name: 'global-settings-store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

// ============================================================================
// GARBAGE COLLECTION
// ============================================================================

let gcInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start garbage collection for all metadata stores
 */
export function startMetadataGC(): void {
  if (gcInterval) return;  // Already running

  gcInterval = setInterval(() => {
    console.log('%c[GC] Running metadata garbage collection', 'color: #868e96');

    // Check each store and clear if expired
    if (useGlobalSettingsMetadataStore.getState().isExpired()) {
      useGlobalSettingsMetadataStore.getState().clear();
      console.log('%c[GC] Cleared expired globalSettings', 'color: #868e96');
    }

    // Add similar checks for other stores
    // useDatalabelMetadataStore, useEntityCodeMetadataStore, etc.
  }, GC_INTERVAL);

  console.log('%c[GC] Metadata garbage collection started', 'color: #51cf66');
}

/**
 * Stop garbage collection (call on logout)
 */
export function stopMetadataGC(): void {
  if (gcInterval) {
    clearInterval(gcInterval);
    gcInterval = null;
    console.log('%c[GC] Metadata garbage collection stopped', 'color: #ff6b6b');
  }
}
```

### Step 3.2: Initialize GC on App Start

**File:** `apps/web/src/App.tsx`

```typescript
import { useEffect } from 'react';
import { startMetadataGC, stopMetadataGC } from './stores/globalSettingsMetadataStore';

function App() {
  useEffect(() => {
    // Start garbage collection on mount
    startMetadataGC();

    return () => {
      // Stop on unmount (app close)
      stopMetadataGC();
    };
  }, []);

  // ... rest of App
}
```

### Step 3.3: Clear on Logout

**File:** `apps/web/src/contexts/AuthContext.tsx`

```typescript
import { stopMetadataGC } from '../stores/globalSettingsMetadataStore';

const logout = useCallback(() => {
  // Stop GC
  stopMetadataGC();

  // Clear all stores
  useGlobalSettingsMetadataStore.getState().clear();
  useDatalabelMetadataStore.getState().clear();
  useEntityCodeMetadataStore.getState().clear();
  useEntityComponentMetadataStore.getState().clear();

  // Clear React Query cache
  queryClient.clear();

  // Remove token
  localStorage.removeItem('auth_token');

  // Redirect
  navigate('/login');
}, [queryClient, navigate]);
```

---

## Phase 4: Document Subscription Patterns

**Goal:** Clear guidelines on when to use reactive vs. imperative store access.

**Effort:** 0.5 day

### Step 4.1: Add Pattern Guidelines to Documentation

**Update:** `docs/state_management/STATE_MANAGEMENT.md`

Add new section:

```markdown
## Store Access Patterns Decision Tree

### When to Use Reactive Subscription

Use `useStore(selector)` when:
- Component UI depends on store value
- Value changes should trigger re-render
- Reading in JSX/render output

```typescript
// ✅ Component displays editing status
function EditButton() {
  const isEditing = useEntityEditStore(state => state.isEditing);
  return <button>{isEditing ? 'Save' : 'Edit'}</button>;
}

// ✅ Component displays dirty field count
function SaveIndicator() {
  const dirtyCount = useEntityEditStore(state => state.dirtyFields.size);
  return dirtyCount > 0 ? <Badge>{dirtyCount} unsaved</Badge> : null;
}
```

### When to Use Imperative Access (getState())

Use `useStore.getState()` when:
- Inside useCallback/useMemo (to avoid dependency)
- Inside useEffect (one-time read)
- Inside event handlers
- Calling store actions
- Reading in async functions

```typescript
// ✅ Event handler - no need for re-render on store change
const handleSave = useCallback(() => {
  const changes = useEntityEditStore.getState().getChanges();
  api.save(changes);
}, []);

// ✅ Effect - one-time cache check
useEffect(() => {
  const cached = useEntityCodeMetadataStore.getState().getEntityCodes();
  if (!cached) fetchEntityCodes();
}, []);

// ✅ Calling actions (actions are stable)
const handleFieldChange = (key, value) => {
  useEntityEditStore.getState().updateField(key, value);
};
```

### Anti-Pattern: Mixing Both

```typescript
// ❌ WRONG: Creates subscription but uses in callback
function BadComponent() {
  const store = useEntityEditStore();  // Subscribed to ALL changes

  const handleSave = useCallback(() => {
    store.saveChanges();  // store in deps = re-renders
  }, [store]);
}

// ✅ CORRECT: No subscription for action-only usage
function GoodComponent() {
  const handleSave = useCallback(() => {
    useEntityEditStore.getState().saveChanges();
  }, []);
}
```

### Decision Matrix

| Scenario | Access Pattern | Reason |
|----------|---------------|--------|
| Display value in JSX | `useStore(selector)` | Need reactivity |
| Toggle based on state | `useStore(selector)` | Need reactivity |
| Call action in handler | `getState().action()` | Actions are stable |
| Read in useEffect | `getState().value` | Avoid subscription |
| Read in useCallback | `getState().value` | Avoid dependency |
| Conditional render | `useStore(selector)` | Need reactivity |
| Form validation | `getState().value` | One-time check |
| Save button disabled | `useStore(state => state.dirtyFields.size > 0)` | Need reactivity |
```

---

## Implementation Order

```
Week 1
├── Day 1-2: Phase 1 - Remove dual cache (Steps 1.1-1.4)
├── Day 3: Phase 1 - Verification (Step 1.5-1.6)
└── Day 4-5: Phase 2 - Normalization foundation (Steps 2.1-2.2)

Week 2
├── Day 1-2: Phase 2 - Mutation updates (Steps 2.3-2.4)
├── Day 3: Phase 3 - Garbage collection (Steps 3.1-3.3)
└── Day 4: Phase 4 - Documentation (Step 4.1)
```

---

## Verification Checklist

### Phase 1 Complete When:
- [ ] `entityInstanceDataStore.ts` deleted
- [ ] `entityInstanceListDataStore.ts` deleted
- [ ] `useEntityQuery.ts` has no store writes for data
- [ ] Build passes with no errors
- [ ] All CRUD operations work correctly

### Phase 2 Complete When:
- [ ] Normalized cache utility created
- [ ] Entity updates reflect in all views
- [ ] No stale data across list/detail views
- [ ] Optimistic updates work with normalization

### Phase 3 Complete When:
- [ ] GC runs every 5 minutes
- [ ] Expired entries are cleared
- [ ] Memory usage doesn't grow unbounded
- [ ] GC stops on logout

### Phase 4 Complete When:
- [ ] Documentation updated with decision tree
- [ ] Examples added for each pattern
- [ ] Team reviewed and approved

---

## Rollback Plan

If issues arise, each phase can be rolled back:

**Phase 1:** Restore deleted store files from git
```bash
git checkout HEAD~1 -- apps/web/src/stores/entityInstanceDataStore.ts
git checkout HEAD~1 -- apps/web/src/stores/entityInstanceListDataStore.ts
```

**Phase 2:** Remove normalization utility, revert useEntityQuery changes
```bash
git checkout HEAD~1 -- apps/web/src/lib/hooks/useEntityQuery.ts
rm apps/web/src/lib/cache/normalizedCache.ts
```

**Phase 3:** Remove GC interval calls
```bash
git checkout HEAD~1 -- apps/web/src/stores/globalSettingsMetadataStore.ts
```

---

## Success Metrics

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| Memory (10k records) | ~200MB | ~100MB | Chrome DevTools Memory tab |
| Cache consistency | Manual sync | Automatic | Update in detail, verify in list |
| Expired entry cleanup | Never | Every 5 min | Console log "[GC]" messages |
| Developer clarity | Unclear | Documented | No more getState() confusion in PRs |


CRITIC:
The user is asking me to critically evaluate the current state management architecture against industry standards and identify any drawbacks or areas that could be improved. Let me think through this 
  carefully.

  Looking at the architecture:

  1. Hybrid React Query + Zustand - This is a common pattern, but there are some potential issues:
    - Dual caching (React Query cache + Zustand store) can lead to cache inconsistency
    - Extra complexity in keeping both in sync
    - Memory overhead from storing data in two places
  2. Session storage persistence - The stores use sessionStorage which:
    - Can cause stale data issues if user keeps tab open
    - Limited storage size (5-10MB typically)
    - Can't share state across tabs
  3. Manual TTL management - Each store has its own TTL logic:
    - Not centralized, could diverge
    - No automatic cleanup/garbage collection
    - TTL checked on access, not proactively
  4. getState() pattern - While it avoids re-renders:
    - Loses reactivity - component won't update when store changes
    - Can lead to stale closures if not careful
    - Goes against React's declarative model
  5. Optimistic updates - Current implementation:
    - Updates both React Query cache AND Zustand store
    - Rollback logic is duplicated
    - Potential for race conditions
  6. No error boundaries for store failures
    - If sessionStorage is full, stores might fail silently
    - No centralized error handling
  7. No devtools/debugging for Zustand stores
    - While devtools middleware is used, it's not consistently applied
    - No time-travel debugging
  8. Coupling between stores - useEntityQuery.ts imports all 6 stores:
    - Hard to test in isolation
    - Changes to one store can affect others
  9. No normalized data - Entity data is stored denormalized:
    - Same entity can exist in multiple lists with different data
    - Updates need to invalidate multiple caches
---

**Document Version:** 1.0.0
**Author:** Claude
**Review Status:** Pending


