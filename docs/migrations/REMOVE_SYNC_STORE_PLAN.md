# Plan: Remove Sync Store, Use TanStack Query Directly (v11.0.0)

## Overview

**Goal**: Eliminate duplicate in-memory caches by removing all sync stores and using `queryClient.getQueryData()` for synchronous access.

**Current State**: Two redundant in-memory caches:
1. **Sync Store** (`Map` objects in `stores.ts`) - Custom implementation
2. **TanStack Query** (`queryClient` cache) - Already in memory, supports `getQueryData()`

**Target State**: Single in-memory cache (TanStack Query) with Dexie for persistence.

---

## Architecture Change

### Before (Redundant)
```
API Response → TanStack Query Cache (in-memory)
            → Sync Store (in-memory)        ← REDUNDANT
            → Dexie (IndexedDB)

Formatters → Sync Store → return name
```

### After (Simplified)
```
API Response → TanStack Query Cache (in-memory)
            → Dexie (IndexedDB)

Formatters → queryClient.getQueryData() → return name
```

---

## Affected Files Summary

| Category | Files to Modify | Changes |
|----------|-----------------|---------|
| **Store Definition** | 1 file | Remove store classes, keep utility functions |
| **Hooks** | 7 files | Remove `.merge()`, `.set()` calls |
| **Components** | 3 files | Use `queryClient.getQueryData()` |
| **Formatters** | 2 files | Use `queryClient.getQueryData()` |
| **Hydration** | 1 file | Remove sync store population |
| **Exports** | 4 files | Update re-exports |
| **Providers** | 2 files | Remove `clearAllSyncStores()` |

**Total: ~20 files**

---

## Detailed Changes by File

### Phase 1: Create New Sync Accessor Functions (queryClient-based)

#### 1.1. Update `apps/web/src/db/cache/stores.ts`

**Remove**:
- `class SyncStore<T>` (lines 28-46)
- `class MapStore<K, V>` (lines 51-89)
- `class EntityCodesStore` (lines 98-136)
- `class EntityInstanceNamesStore` (lines 139-183)
- `class EntityLinksStore` (lines 196-290)
- All store instances (lines 496-510):
  ```typescript
  export const globalSettingsStore = new SyncStore<GlobalSettings>();
  export const datalabelStore = new MapStore<string, DatalabelOption[]>();
  export const entityCodesStore = new EntityCodesStore();
  export const entityInstanceNamesStore = new EntityInstanceNamesStore();
  export const entityLinksStore = new EntityLinksStore();
  export const entityInstanceMetadataStore = new MapStore<string, EntityInstanceMetadata>();
  ```

**Keep/Modify**: Sync accessor functions - change implementation to use `queryClient.getQueryData()`:

```typescript
// NEW IMPLEMENTATION - uses TanStack Query directly
import { queryClient } from './client';
import { QUERY_KEYS } from './keys';

export function getDatalabelSync(key: string): DatalabelOption[] | null {
  const normalizedKey = key.startsWith('dl__') ? key.slice(4) : key;
  return queryClient.getQueryData<DatalabelOption[]>(QUERY_KEYS.datalabel(normalizedKey)) ?? null;
}

export function getEntityCodesSync(): EntityCode[] | null {
  return queryClient.getQueryData<EntityCode[]>(QUERY_KEYS.entityCodes()) ?? null;
}

export function getEntityCodeSync(code: string): EntityCode | null {
  const codes = getEntityCodesSync();
  return codes?.find(c => c.code === code) ?? null;
}

export function getChildEntityCodesSync(parentCode: string): string[] {
  const entity = getEntityCodeSync(parentCode);
  return entity?.child_entity_codes ?? [];
}

export function getEntityInstanceNameSync(entityCode: string, entityInstanceId: string): string | null {
  const names = queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  );
  return names?.[entityInstanceId] ?? null;
}

export function getEntityInstanceNamesForTypeSync(entityCode: string): Record<string, string> {
  return queryClient.getQueryData<Record<string, string>>(
    QUERY_KEYS.entityInstanceNames(entityCode)
  ) ?? {};
}

export function getChildIdsSync(
  parentCode: string,
  parentId: string,
  childCode: string
): string[] {
  const links = queryClient.getQueryData<LinkForwardIndex>(
    QUERY_KEYS.entityLinksByParent(parentCode, parentId)
  );
  return links?.[childCode]?.childIds ?? [];
}

export function getEntityInstanceMetadataSync(entityCode: string): EntityInstanceMetadata | null {
  return queryClient.getQueryData<EntityInstanceMetadata>(
    QUERY_KEYS.entityInstanceMetadata(entityCode)
  ) ?? null;
}

// Remove clearAllSyncStores - no longer needed (TanStack Query has its own clear)
// Remove getSyncStoreStats - no longer meaningful
```

---

### Phase 2: Update Hooks to Remove Sync Store Updates

#### 2.1. `apps/web/src/db/cache/hooks/useEntityInstanceData.ts`

**Remove**:
- Line 13: `import { entityInstanceNamesStore } from '../stores';`
- Lines 175-178: Dexie cache hit sync store hydration
- Lines 247-250: API response sync store merge

**Keep**:
- `upsertRefDataEntityInstance()` call (updates TanStack Query cache)

#### 2.2. `apps/web/src/db/cache/hooks/useEntity.ts`

**Remove**:
- Line 12: `import { entityInstanceNamesStore } from '../stores';`
- Lines 105, 113, 210, 235: `entityInstanceNamesStore.set()` calls

**Replace with**: `queryClient.setQueryData()` using merge pattern:
```typescript
queryClient.setQueryData<Record<string, string>>(
  QUERY_KEYS.entityInstanceNames(entityCode),
  (old) => ({ ...(old || {}), [entityId]: name })
);
```

#### 2.3. `apps/web/src/db/cache/hooks/useOptimisticMutation.ts`

**Remove**:
- Line 34: `import { entityInstanceNamesStore } from '../stores';`
- Lines 368, 461: `entityInstanceNamesStore.set()` calls

**Replace with**: `queryClient.setQueryData()` using merge pattern

#### 2.4. `apps/web/src/db/cache/hooks/useEntityInstanceNames.ts`

**Remove**:
- Line 12: `import { entityInstanceNamesStore } from '../stores';`
- Lines 54, 63, 78, 112, 147, 151: All `entityInstanceNamesStore.*` calls

**Replace with**: `queryClient.setQueryData()`/`queryClient.getQueryData()` calls

#### 2.5. `apps/web/src/db/cache/hooks/useDatalabel.ts`

**Remove**:
- Line 13: `import { datalabelStore, setDatalabelSync } from '../stores';`
- Lines 71, 124, 163, 192, 196: All `datalabelStore.*` and `setDatalabelSync()` calls

**Replace with**: Let TanStack Query handle it (hooks already use `queryClient.setQueryData`)

#### 2.6. `apps/web/src/db/cache/hooks/useGlobalSettings.ts`

**Remove**:
- Line 13: `import { globalSettingsStore } from '../stores';`
- Lines 78, 118, 138: All `globalSettingsStore.*` calls

**Replace with**: TanStack Query already handles this via `setQueryData`

#### 2.7. `apps/web/src/db/cache/hooks/useEntityCodes.ts`

**Remove**:
- Line 13: `import { entityCodesStore } from '../stores';`
- Lines 76, 128: `entityCodesStore.set()` calls

**Replace with**: TanStack Query already handles this via `setQueryData`

#### 2.8. `apps/web/src/db/cache/hooks/useEntityLinks.ts`

**Remove**:
- Line 13: `import { entityLinksStore, entityCodesStore } from '../stores';`
- All `entityLinksStore.*` calls (lines 121, 139, 156, 170, 177, 257, 275, 305, 320, 325, 339, 340)

**Replace with**: `queryClient.setQueryData()`/`queryClient.getQueryData()` calls

---

### Phase 3: Update Components

#### 3.1. `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx`

**Remove**:
- Line 5: `import { entityInstanceNamesStore } from '@/db/cache/stores';`
- Line 70: `entityInstanceNamesStore.getName()` call

**Replace with**:
```typescript
import { queryClient } from '@/db/cache/client';
import { QUERY_KEYS } from '@/db/cache/keys';

const names = queryClient.getQueryData<Record<string, string>>(
  QUERY_KEYS.entityInstanceNames(entityCode)
);
const syncStoreName = value ? names?.[value] ?? null : null;
```

#### 3.2. `apps/web/src/components/shared/ui/EntityInstanceNameMultiSelect.tsx`

**Remove**:
- Line 15: `import { entityInstanceNamesStore } from '@/db/cache/stores';`
- Line 76: `entityInstanceNamesStore.getName()` call

**Replace with**: Same pattern as above

#### 3.3. `apps/web/src/lib/hooks/useRefDataEntityInstance.ts`

**Remove**:
- Lines 42-43: Imports of `entityInstanceNamesStore` and `persistToEntityInstanceNames`
- Lines 123, 126, 232-233, 239: All `entityInstanceNamesStore.merge()` calls

**Keep**:
- `queryClient.setQueryData()` calls (these are the correct pattern)
- `persistToEntityInstanceNames()` for Dexie persistence

---

### Phase 4: Update Formatters

#### 4.1. `apps/web/src/lib/formatters/valueFormatters.ts`

**Change**:
- Line 15: Change import from:
  ```typescript
  import { getDatalabelSync, getEntityInstanceNameSync } from '../../db/tanstack-index';
  ```
  To (no change needed - function signature stays same, implementation changes in stores.ts)

#### 4.2. `apps/web/src/lib/frontEndFormatterService.tsx`

**No changes needed** - uses `getDatalabelSync()` which will be updated in stores.ts

---

### Phase 5: Update Hydration

#### 5.1. `apps/web/src/db/persistence/hydrate.ts`

**Remove**:
- Lines 11-16: Store imports
- Line 146: `globalSettingsStore.set()` call
- Line 162: `datalabelStore.set()` call
- Line 179: `entityCodesStore.set()` call
- Line 205: `entityInstanceNamesStore.set()` call
- Line 227: `entityInstanceMetadataStore.set()` call

**Keep**:
- All `queryClient.setQueryData()` calls - these populate TanStack Query cache

---

### Phase 6: Update Providers

#### 6.1. `apps/web/src/db/TanstackCacheProvider.tsx`

**Remove**:
- Line 21: `import { clearAllSyncStores } from './cache/stores';`
- Line 135: `clearAllSyncStores();` call

**Keep**:
- TanStack Query cache clearing (already handled by hook clear functions)

#### 6.2. `apps/web/src/db/Provider.tsx`

**Remove**:
- Line 19: `import { clearAllSyncStores } from './cache/stores';`
- Line 176: `clearAllSyncStores();` call

---

### Phase 7: Update Exports

#### 7.1. `apps/web/src/db/tanstack-index.ts`

**Remove**:
- Lines 16-25: Store instance exports
- Line 207: `entityCodesStore as getAllEntityCodesSync` export

**Keep**:
- Sync accessor function exports (getDatalabelSync, getEntityInstanceNameSync, etc.)

#### 7.2. `apps/web/src/db/cache/index.ts`

**Update exports** to remove store instances, keep utility functions

#### 7.3. `apps/web/src/db/index.ts`

**Update exports** to remove store instances, keep utility functions

#### 7.4. `apps/web/src/db/cache/hooks/index.ts`

**Update exports** - no store-related changes needed

---

### Phase 8: Update Realtime Manager

#### 8.1. `apps/web/src/db/realtime/manager.ts`

**Remove**:
- Line 11: `import { entityLinksStore } from '../cache/stores';`
- Lines 442, 450: `entityLinksStore.addLink()`, `entityLinksStore.removeLink()` calls

**Replace with**: `queryClient.setQueryData()` calls for link updates

---

## Implementation Order

1. **Phase 1**: Update `stores.ts` - change sync accessor implementations
2. **Phase 2**: Update all hooks to remove `.merge()`, `.set()` calls
3. **Phase 3**: Update components to use `queryClient.getQueryData()`
4. **Phase 4**: Formatters - no changes needed (use updated sync accessors)
5. **Phase 5**: Update hydration to only populate TanStack Query
6. **Phase 6**: Update providers to remove `clearAllSyncStores()`
7. **Phase 7**: Update exports
8. **Phase 8**: Update realtime manager

---

## Testing Checklist

- [ ] Login flow - entity names resolve correctly
- [ ] Project list - employee names show (not UUIDs)
- [ ] Edit mode - dropdowns work
- [ ] Optimistic updates - names persist after PATCH
- [ ] Page refresh - data hydrates from Dexie → TanStack Query
- [ ] Logout/login - caches clear and repopulate
- [ ] HMR - no cache issues during development

---

## Rollback Plan

If issues arise:
1. Revert all changes
2. The v10.0.1 fix (sync store + TanStack Query dual-write) will continue working

---

## Benefits

1. **Single source of truth**: One in-memory cache (TanStack Query)
2. **No duplicate data**: Removes ~50KB of redundant cached objects
3. **Simpler hydration**: Only populate TanStack Query from Dexie
4. **No race conditions**: No sync between two caches
5. **Better DevTools**: React Query DevTools shows all cached data
6. **HMR safe**: TanStack Query persists across HMR (module-level `queryClient`)

---

## Implementation Status

**Implemented: 2025-12-02 | Version: v11.0.0**

### Completed Changes

#### Phase 1: stores.ts ✅
- Removed all store classes (SyncStore, MapStore, EntityCodesStore, EntityInstanceNamesStore, EntityLinksStore)
- Replaced with sync accessor functions that read directly from `queryClient.getQueryData()`
- Added `getCacheStats()` for debugging

#### Phase 2: Hooks ✅
- `useEntityInstanceData.ts` - Removed `entityInstanceNamesStore.merge()` calls
- `useEntity.ts` - Replaced `entityInstanceNamesStore.set()` with `queryClient.setQueryData()`
- `useOptimisticMutation.ts` - Same changes as useEntity.ts
- `useEntityInstanceNames.ts` - Removed all sync store references
- `useDatalabel.ts` - Removed `datalabelStore` and `setDatalabelSync` references
- `useGlobalSettings.ts` - Removed `globalSettingsStore` calls
- `useEntityCodes.ts` - Removed `entityCodesStore` calls
- `useEntityLinks.ts` - Major rewrite to store link data in TanStack Query cache directly

#### Phase 3: Components ✅
- `EntityInstanceNameSelect.tsx` - Uses `getEntityInstanceNameSync()` from stores
- `EntityInstanceNameMultiSelect.tsx` - Uses `getEntityInstanceNameSync()` from stores

#### Phase 4: Formatters ✅
- No changes needed - uses updated sync accessors from stores.ts

#### Phase 5: Hydration ✅
- `hydrate.ts` - Removed sync store population, only sets data in TanStack Query cache
- Fixed type annotations to use direct types instead of inferring from old stores

#### Phase 6: Providers ✅
- `TanstackCacheProvider.tsx` - Removed `clearAllSyncStores()` import and usage
- `Provider.tsx` - Removed `clearAllSyncStores()` import and usage

#### Phase 7: Exports ✅
- `cache/index.ts` - Removed store instance exports, kept sync accessor functions
- `tanstack-index.ts` - Same approach
- `db/index.ts` - Removed store exports

#### Phase 8: Realtime Manager ✅
- `realtime/manager.ts` - Removed `entityLinksStore` usage, invalidates TanStack Query cache directly

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/db/cache/stores.ts` | Complete rewrite - removed classes, added queryClient-based accessors |
| `apps/web/src/db/cache/hooks/useEntityInstanceData.ts` | Removed sync store imports and calls |
| `apps/web/src/db/cache/hooks/useEntity.ts` | Replaced store calls with queryClient.setQueryData() |
| `apps/web/src/db/cache/hooks/useOptimisticMutation.ts` | Same as useEntity.ts |
| `apps/web/src/db/cache/hooks/useEntityInstanceNames.ts` | Removed sync store calls |
| `apps/web/src/db/cache/hooks/useDatalabel.ts` | Removed datalabelStore references |
| `apps/web/src/db/cache/hooks/useGlobalSettings.ts` | Removed globalSettingsStore references |
| `apps/web/src/db/cache/hooks/useEntityCodes.ts` | Removed entityCodesStore references |
| `apps/web/src/db/cache/hooks/useEntityLinks.ts` | Major rewrite - stores links in TanStack Query cache |
| `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx` | Updated import to use getEntityInstanceNameSync |
| `apps/web/src/components/shared/ui/EntityInstanceNameMultiSelect.tsx` | Updated import to use getEntityInstanceNameSync |
| `apps/web/src/db/persistence/hydrate.ts` | Removed sync store population, fixed type annotations |
| `apps/web/src/db/TanstackCacheProvider.tsx` | Removed clearAllSyncStores() |
| `apps/web/src/db/Provider.tsx` | Removed clearAllSyncStores() |
| `apps/web/src/db/cache/index.ts` | Updated exports |
| `apps/web/src/db/tanstack-index.ts` | Updated exports |
| `apps/web/src/db/index.ts` | Updated exports |
| `apps/web/src/db/realtime/manager.ts` | Removed entityLinksStore usage |

### Verification

- [x] TypeScript compilation passes (`tsc --noEmit`)
- [ ] Login flow - entity names resolve correctly
- [ ] Project list - employee names show (not UUIDs)
- [ ] Edit mode - dropdowns work
- [ ] Optimistic updates - names persist after PATCH
- [ ] Page refresh - data hydrates from Dexie → TanStack Query
- [ ] Logout/login - caches clear and repopulate
