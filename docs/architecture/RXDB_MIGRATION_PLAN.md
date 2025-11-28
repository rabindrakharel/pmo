# RxDB Migration Plan: Unified State Management

**Version:** 8.6.0 (Planned) | **Created:** 2025-11-28

---

## Executive Summary

Migrate all frontend state management to RxDB (IndexedDB) as the **single source of truth**. Remove Zustand stores and React Query.

### Current State (v8.5.0)
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CURRENT ARCHITECTURE (v8.5.0)                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  RxDB (IndexedDB)        │ Entity instances + drafts                    │
│  ────────────────────────┼──────────────────────────────────────────────│
│  Zustand (localStorage)  │ datalabels, entity codes, component metadata │
│  Zustand (sessionStorage)│ entity codes, global settings                │
│  Zustand (memory)        │ edit state (isEditing, dirtyFields)          │
│  React Query             │ Provider wrapper + hooks (compatibility)     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Target State (v8.6.0)
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TARGET ARCHITECTURE (v8.6.0)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  RxDB (IndexedDB) - SINGLE SOURCE OF TRUTH                              │
│  ────────────────────────────────────────────────────────────────────── │
│  entities collection   │ Entity instances (project, task, employee...)  │
│  drafts collection     │ Unsaved edits with undo/redo                   │
│  metadata collection   │ Datalabels, entity codes, settings, component  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## What Needs to Change

### 1. Zustand Stores to Remove (5 files)

| Store File | Current Purpose | Migration Target |
|------------|-----------------|------------------|
| `datalabelMetadataStore.ts` | Dropdown options (dl__* fields) | `metadata` collection (type: 'datalabel') |
| `entityCodeMetadataStore.ts` | Entity type definitions | `metadata` collection (type: 'entity') |
| `entityComponentMetadataStore.ts` | viewType/editType per entity | `metadata` collection (type: 'component') |
| `globalSettingsMetadataStore.ts` | Currency/date format settings | `metadata` collection (type: 'settings') |
| `useEntityEditStore.ts` | Edit mode state | `drafts` collection (already exists!) |

### 2. Files Consuming Zustand (17 files to update)

| File | Zustand Usage | Action Required |
|------|---------------|-----------------|
| `useEntityQuery.ts` | All 4 metadata stores | Replace with RxDB metadata hooks |
| `EntitySpecificInstancePage.tsx` | `useDatalabelMetadataStore` | Use RxDB metadata hook |
| `EntityMetadataContext.tsx` | All metadata stores | Replace with RxDBProvider |
| `AuthContext.tsx` | `useDatalabelMetadataStore` | Use RxDB metadata hook |
| `garbageCollection.ts` | All metadata stores | Remove (RxDB has built-in cleanup) |
| `valueFormatters.ts` | `useDatalabelMetadataStore` | Use RxDB metadata hook |
| `frontEndFormatterService.tsx` | `useDatalabelMetadataStore` | Use RxDB metadata hook |
| `useKeyboardShortcuts.ts` | `useEntityEditStore` | Use `useRxDraft` |
| `DynamicChildEntityTabs.tsx` | `useEntityCodeMetadataStore` | Use RxDB metadata hook |
| `EntityFormContainer.tsx` | Multiple stores | Use RxDB metadata hooks |
| `EntityDataTable.tsx` | `useEntityComponentMetadataStore` | Use RxDB metadata hook |

### 3. React Query to Remove (7 files)

| File | React Query Usage | Action Required |
|------|-------------------|-----------------|
| `App.tsx` | `QueryClientProvider` wrapper | Remove wrapper |
| `useEntityQuery.ts` | `useQuery`, `useMutation`, `useQueryClient` | Replace with RxDB hooks |
| `useRefDataEntityInstanceCache.ts` | `useQuery`, `useQueryClient` | Replace with RxDB |
| `useEntityEditStore.ts` | `useQueryClient` for cache invalidation | Use RxDB reactive queries |
| `AuthContext.tsx` | `useQueryClient` | Remove |
| `db/sync/SyncProvider.tsx` | `useQueryClient` | Use RxDB directly |
| `lib/cache/normalizedCache.ts` | React Query cache utilities | Remove |

---

## New RxDB Hooks Required

### 1. useRxMetadata (new hook)

```typescript
// apps/web/src/db/rxdb/hooks/useRxMetadata.ts

/**
 * Hook for accessing metadata from RxDB metadata collection
 */
export function useRxMetadata<T>(
  type: 'datalabel' | 'entity' | 'settings' | 'component',
  key: string
): { data: T | null; isLoading: boolean; refetch: () => void }

/**
 * Hook for datalabel options
 */
export function useRxDatalabel(datalabelKey: string): {
  options: DatalabelOption[];
  isLoading: boolean;
}

/**
 * Hook for entity type definitions
 */
export function useRxEntityCodes(): {
  entityCodes: EntityCodeData[];
  getEntityByCode: (code: string) => EntityCodeData | null;
  isLoading: boolean;
}

/**
 * Hook for global settings
 */
export function useRxGlobalSettings(): {
  settings: GlobalSettings | null;
  isLoading: boolean;
}

/**
 * Hook for component metadata (viewType/editType)
 */
export function useRxComponentMetadata(
  entityCode: string,
  componentName: string
): {
  metadata: ComponentMetadata | null;
  isLoading: boolean;
}
```

### 2. Enhanced useRxDraft (already exists, may need updates)

```typescript
// Already in apps/web/src/db/rxdb/hooks/useRxDraft.ts
// Verify it covers all useEntityEditStore functionality:
// - undo/redo stacks
// - dirtyFields tracking
// - saveChanges with API call
// - optimistic updates
```

---

## Migration Steps (Ordered by Dependency)

### Phase 1: Create New RxDB Hooks (0 breaking changes)

1. **Create `useRxMetadata.ts`** with hooks for:
   - `useRxDatalabel(key)` - replaces `useDatalabelMetadataStore`
   - `useRxEntityCodes()` - replaces `useEntityCodeMetadataStore`
   - `useRxGlobalSettings()` - replaces `useGlobalSettingsMetadataStore`
   - `useRxComponentMetadata(entityCode, component)` - replaces `useEntityComponentMetadataStore`

2. **Extend ReplicationManager** to fetch and cache metadata:
   - `fetchDatalabels()` - fetch all datalabels on login
   - `fetchEntityCodes()` - fetch entity types on login
   - `fetchGlobalSettings()` - fetch settings on login

3. **Add metadata fetching to RxDBProvider**:
   - After auth, fetch all metadata into RxDB
   - Set up TTL-based background refresh

### Phase 2: Migrate Consumers (Parallel Work)

| Priority | Files to Migrate | Effort |
|----------|------------------|--------|
| P0 | `useEntityQuery.ts` | High - core hook |
| P0 | `frontEndFormatterService.tsx` | Medium - formatting |
| P1 | `EntityDataTable.tsx` | Medium |
| P1 | `EntityFormContainer.tsx` | Medium |
| P1 | `DynamicChildEntityTabs.tsx` | Low |
| P2 | `EntityMetadataContext.tsx` | Low - may remove |
| P2 | `AuthContext.tsx` | Low |
| P2 | `valueFormatters.ts` | Low |
| P3 | `useKeyboardShortcuts.ts` | Low |
| P3 | `EntitySpecificInstancePage.tsx` | Low |

### Phase 3: Remove Zustand & React Query

1. **Remove Zustand stores**:
   ```bash
   rm apps/web/src/stores/datalabelMetadataStore.ts
   rm apps/web/src/stores/entityCodeMetadataStore.ts
   rm apps/web/src/stores/entityComponentMetadataStore.ts
   rm apps/web/src/stores/globalSettingsMetadataStore.ts
   rm apps/web/src/stores/useEntityEditStore.ts
   ```

2. **Remove React Query**:
   - Remove `QueryClientProvider` from `App.tsx`
   - Remove `@tanstack/react-query` from `package.json`
   - Remove `lib/cache/normalizedCache.ts`
   - Remove `lib/cache/garbageCollection.ts`

3. **Update imports** across all affected files

---

## Database Schema Updates

The RxDB metadata collection already supports this (see `metadata.schema.ts`):

```typescript
interface MetadataDocType {
  _id: string;              // "datalabel:project_stage", "entity:project"
  type: 'datalabel' | 'entity' | 'settings' | 'component';
  key: string;
  data: unknown;            // Actual metadata content
  cachedAt: number;
  ttl: number;
  version?: number;
  _deleted: boolean;
}
```

No schema changes required - just need to populate it.

---

## Benefits of Migration

| Benefit | Description |
|---------|-------------|
| **Offline-first** | All metadata available offline |
| **Persistence** | Survives browser restart |
| **Multi-tab sync** | LeaderElection shares data |
| **Simpler mental model** | One cache system, not three |
| **Less bundle size** | Remove Zustand + React Query |
| **Reactive everywhere** | RxJS observables auto-update UI |
| **Unified TTL** | Consistent cache expiry in one place |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Phase 1 adds without removing |
| Performance regression | RxDB is highly optimized for IndexedDB |
| Migration complexity | Parallel migration per file |
| Testing coverage | Add tests for new RxDB hooks |

---

## Files Summary

### Files to CREATE (3)

```
apps/web/src/db/rxdb/hooks/useRxMetadata.ts       # New metadata hooks
apps/web/src/db/rxdb/services/metadataSync.ts     # Metadata fetching/caching
docs/architecture/RXDB_MIGRATION_PLAN.md          # This document
```

### Files to MODIFY (17)

```
apps/web/src/db/rxdb/RxDBProvider.tsx             # Add metadata init
apps/web/src/db/rxdb/replication.ts               # Add metadata sync
apps/web/src/lib/hooks/useEntityQuery.ts          # Replace stores
apps/web/src/lib/frontEndFormatterService.tsx     # Replace stores
apps/web/src/components/shared/ui/EntityDataTable.tsx
apps/web/src/components/shared/entity/EntityFormContainer.tsx
apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx
apps/web/src/pages/shared/EntitySpecificInstancePage.tsx
apps/web/src/contexts/AuthContext.tsx
apps/web/src/contexts/EntityMetadataContext.tsx
apps/web/src/lib/formatters/valueFormatters.ts
apps/web/src/lib/hooks/useKeyboardShortcuts.ts
apps/web/src/App.tsx                              # Remove QueryClientProvider
```

### Files to DELETE (7)

```
apps/web/src/stores/datalabelMetadataStore.ts
apps/web/src/stores/entityCodeMetadataStore.ts
apps/web/src/stores/entityComponentMetadataStore.ts
apps/web/src/stores/globalSettingsMetadataStore.ts
apps/web/src/stores/useEntityEditStore.ts
apps/web/src/lib/cache/normalizedCache.ts
apps/web/src/lib/cache/garbageCollection.ts
```

---

## Package.json Changes

### Remove
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x.x",  // Remove
    "zustand": "^4.x.x"                  // Remove
  }
}
```

### Keep
```json
{
  "dependencies": {
    "rxdb": "^15.x.x",
    "rxjs": "^7.x.x"
  }
}
```

---

**Status:** Planning | **Estimated Effort:** 3-5 days | **Breaking Changes:** None in Phase 1
