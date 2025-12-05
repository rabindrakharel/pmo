# Dead Code Analysis Report

**Generated**: 2025-12-05
**Status**: Complete
**Branch**: claude/cleanup-dead-code-018NQFvxzRKAAumn2UF7CjF1

---

## Summary

This document tracks identified dead code, unused imports, orphan files, and unnecessary fallback logic that can be safely removed to reduce project bloat.

**Total Issues Found**: 15+

---

## Analysis Progress

| Area | Status | Issues Found |
|------|--------|--------------|
| API Modules | ✅ Complete | 2 orphan modules |
| Web Services | ✅ Complete | 1 partially dead file |
| Web Components | ✅ Complete | 6 unused components |
| Lib/Utils | ✅ Complete | 4 unused functions |
| Hooks | ✅ Complete | 2 unused hooks |

---

## Findings

### 1. API Modules - Orphan/Unregistered Routes

#### 1.1 `apps/api/src/modules/email-template/routes.ts`

**Status**: NOT REGISTERED in `apps/api/src/modules/index.ts`

**Evidence**:
- Routes file exists (426 lines) with full CRUD endpoints
- Frontend has entityConfig entry expecting `/api/v1/email-template` endpoint
- `marketingApi` in `apps/web/src/lib/api.ts` calls these endpoints
- BUT `emailTemplateRoutes` is never imported or called in `index.ts`

**Impact**: Frontend calls will fail with 404

**Recommendation**: Either register the routes OR remove the file AND update frontend references

**Safe to Delete**: NO - Must fix frontend references first or register routes

---

#### 1.2 `apps/api/src/modules/message-schema/routes.ts`

**Status**: COMMENTED OUT in `apps/api/src/modules/index.ts`

**Evidence**:
- Comment on line 22: `// import { messageSchemaRoutes } from './message-schema/routes.js'; // REMOVED: message_schema is template storage, not user-facing entity`
- Comment on line 129: `// await messageSchemaRoutes(fastify); // REMOVED`

**Impact**: Backend routes exist but not registered

**Recommendation**: Delete the entire `apps/api/src/modules/message-schema/` directory

**Safe to Delete**: YES - Intentionally disabled

---

### 2. Web Services - Partially Dead Code

#### 2.1 `apps/web/src/lib/cache/normalizedCache.ts`

**Status**: 90% DEAD CODE (290 lines, only 1 function used)

**Evidence**:
- Only `clearNormalizedStore` is imported (by `AuthContext.tsx`)
- All other exports are NEVER used:
  - `getNormalizedStore` - NOT USED
  - `normalizeEntity` - NOT USED
  - `normalizeListResponse` - NOT USED
  - `denormalizeList` - NOT USED
  - `getNormalizedEntity` - NOT USED
  - `updateNormalizedEntity` - NOT USED
  - `removeNormalizedEntity` - NOT USED
  - `addNormalizedEntity` - NOT USED
  - `invalidateEntityQueries` - NOT USED
  - `getNormalizedStoreStats` - NOT USED

**Reason**: This appears to be a planned feature (normalized caching like Apollo GraphQL) that was never implemented

**Impact**: ~250 lines of dead code

**Recommendation**: Keep only `clearNormalizedStore()` and its dependencies, delete rest

**Safe to Delete**: YES (most of it) - Keep only the one used function

---

#### 2.2 `apps/web/src/lib/indexed-data-utils.ts`

**Status**: PARTIALLY DEAD CODE

**Evidence**:
- Only `normalizeApiResponse` and `hasMetadata` are imported
- Unused exports:
  - `objectToIndexedArray` - NOT USED
  - `objectsToIndexedArrays` - NOT USED
  - `indexedArrayToObject` - Only used internally by `indexedArraysToObjects`
  - `indexedArraysToObjects` - Only used internally by `normalizeApiResponse`

**Reason**: These were added for future "indexed format" optimization that was never implemented

**Impact**: ~50 lines of unused helper functions

**Recommendation**: Remove the unused exports

**Safe to Delete**: YES - `objectToIndexedArray` and `objectsToIndexedArrays`

---

### 3. Web Components - Unused

#### 3.1 `apps/web/src/components/shared/search/ScopeFilters.tsx`

**Status**: NEVER USED

**Evidence**:
- Exported in `apps/web/src/components/shared/index.ts`
- Never imported by any page or component with JSX tag `<ScopeFilters>`

**Reason**: Planned search scope filtering feature never implemented

**Recommendation**: Delete file and remove export from index.ts

**Safe to Delete**: YES

---

#### 3.2 `apps/web/src/components/shared/ui/EntityMultiSelect.tsx`

**Status**: NEVER USED

**Evidence**:
- No `<EntityMultiSelect>` usage found in any file
- Only import is from `EntityMultiSelectTags.tsx` (which is also unused)

**Recommendation**: Delete file

**Safe to Delete**: YES

---

#### 3.3 `apps/web/src/components/shared/ui/EntityMultiSelectTags.tsx`

**Status**: NEVER USED

**Evidence**:
- No `<EntityMultiSelectTags>` usage found
- Imports `EntityMultiSelect` (also unused)

**Recommendation**: Delete file

**Safe to Delete**: YES

---

#### 3.4 `apps/web/src/components/shared/ui/EditableTags.tsx`

**Status**: DEPRECATED - Marked as removed

**Evidence**:
- Explicitly marked as removed in `apps/web/src/components/shared/index.ts`:
  ```typescript
  // EditableTags component removed - tags field no longer in use
  // export { EditableTags } from './ui/EditableTags';
  ```
- No `<EditableTags>` usage found anywhere

**Recommendation**: Delete file

**Safe to Delete**: YES

---

#### 3.5 `apps/web/src/components/shared/ui/TableSkeleton.tsx`

**Status**: NEVER USED

**Evidence**:
- No `<TableSkeleton>` usage found

**Reason**: Skeleton loading components replaced with `EllipsisBounce`

**Recommendation**: Delete file

**Safe to Delete**: YES

---

#### 3.6 `apps/web/src/components/entity/form/AdvancedFormBuilder.tsx`

**Status**: NEVER USED

**Evidence**:
- No `<AdvancedFormBuilder>` usage found
- `FormBuilder.tsx` is used instead

**Reason**: This appears to be an earlier version or alternative implementation that was superseded

**Recommendation**: Delete file

**Safe to Delete**: YES

---

### 4. Lib/Utils - Unused Functions

#### 4.1 `apps/web/src/lib/changeDetection.ts`

**Status**: USED - but has some unused exports

All 4 exports are used:
- `getChangedFields` - Used by useDraft.ts
- `preparePatchData` - Used by EntitySpecificInstancePage.tsx
- `hasChanges` - Used by LabelsDataTable.tsx
- `getChangeSummary` - Used by useKeyboardShortcuts.ts

**Safe to Delete**: NO - All used

---

### 5. Hooks - Unused

#### 5.1 `apps/web/src/lib/hooks/useColumnVisibility.ts`

**Status**: NEVER USED

**Evidence**:
- Exported in `apps/web/src/lib/hooks/index.ts`
- Never imported or used by any component

**Reason**: Column visibility feature was planned but never implemented (or replaced by metadata-driven approach)

**Recommendation**: Delete file and remove from index.ts

**Safe to Delete**: YES

---

#### 5.2 `apps/web/src/db/cache/hooks/useOfflineEntity.ts`

**Status**: NEVER USED (only re-exported)

**Evidence**:
- Re-exported in multiple index.ts files
- Never actually called with `useOfflineEntity()` in any component

**Reason**: Offline-first feature was planned but never used

**Recommendation**: Delete file and remove from index.ts files

**Safe to Delete**: YES

---

## Deletion Priority

### Priority 1: Safe to Delete Immediately

| File | Lines | Reason |
|------|-------|--------|
| `apps/api/src/modules/message-schema/` (entire directory) | ~500 | Intentionally disabled |
| `apps/web/src/components/shared/search/ScopeFilters.tsx` | ~100 | Never used |
| `apps/web/src/components/shared/ui/EntityMultiSelect.tsx` | ~150 | Never used |
| `apps/web/src/components/shared/ui/EntityMultiSelectTags.tsx` | ~100 | Never used |
| `apps/web/src/components/shared/ui/EditableTags.tsx` | ~150 | Marked deprecated |
| `apps/web/src/components/shared/ui/TableSkeleton.tsx` | ~50 | Never used |
| `apps/web/src/components/entity/form/AdvancedFormBuilder.tsx` | ~200 | Never used |
| `apps/web/src/lib/hooks/useColumnVisibility.ts` | ~50 | Never used |
| `apps/web/src/db/cache/hooks/useOfflineEntity.ts` | ~50 | Never used |

**Total Lines**: ~1,350 lines can be safely deleted

### Priority 2: Requires Cleanup

| File | Action |
|------|--------|
| `apps/web/src/lib/cache/normalizedCache.ts` | Remove unused functions, keep `clearNormalizedStore` |
| `apps/web/src/lib/indexed-data-utils.ts` | Remove `objectToIndexedArray`, `objectsToIndexedArrays` |
| `apps/web/src/components/shared/index.ts` | Update exports after deletions |
| `apps/web/src/lib/hooks/index.ts` | Update exports after deletions |
| `apps/web/src/db/cache/hooks/index.ts` | Update exports after deletions |

### Priority 3: Needs Decision

| File | Issue |
|------|-------|
| `apps/api/src/modules/email-template/routes.ts` | Frontend expects these routes - either register or remove frontend refs |

---

## Estimated Impact

- **Lines of Dead Code**: ~1,500-2,000 lines
- **Files to Delete**: 9-10 files
- **Files to Modify**: 5 index.ts files
- **Bundle Size Reduction**: Estimated 5-10KB (minified)
- **Maintenance Benefit**: Less code to maintain, clearer codebase

---

## Implementation Plan

1. Create a new branch from current
2. Delete Priority 1 files
3. Update all index.ts exports
4. Run `pnpm build` to verify no import errors
5. Run `pnpm type-check` to verify TypeScript is happy
6. Test critical paths in browser
7. Commit and push

---

*Report generated by automated code analysis*
