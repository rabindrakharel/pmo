# Entity Instance Lookup Modal Consolidation Plan

**Version**: 1.0.0
**Status**: DRAFT
**Date**: 2025-12-11

---

## Executive Summary

Two modal components exist for entity instance selection/linking with overlapping functionality:

| Component | Location | Primary Use |
|-----------|----------|-------------|
| `Modal_LinkExistingEntityInstanceToDataTable` | `modal/Modal_LinkExistingEntityInstanceToDataTable.tsx` | Child entity tabs "Add Existing" via SplitAddButton |
| `UnifiedLinkageModal` | `modal/UnifiedLinkageModal.tsx` | Entity detail page parent/child relationship management |

**Recommendation**: Consolidate into a single `EntityInstanceLinkageModal` component with mode-based behavior.

---

## Current State Analysis

### 1. Modal_LinkExistingEntityInstanceToDataTable (v11.0.0)

**Used by**: `EntityListOfInstancesTable.tsx` (line 2576)

**Features**:
- Multi-select with checkboxes
- Search by code/name/descr
- Bulk link API (`POST /api/v1/{parent}/{parentId}/{child}/link`)
- Excludes already-linked entities via `/linkable` endpoint
- TanStack Query for data fetching + cache invalidation
- Select All functionality

**Props**:
```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  parentEntity: string;
  parentId: string;
  childEntity: string;
  childEntityLabel: string;
  onSuccess?: () => void;
}
```

### 2. UnifiedLinkageModal

**Used by**:
- `EntitySpecificInstancePage.tsx` (line 1597)
- `WikiEditorPage.tsx` (line 234)
- `FormEditPage.tsx` (line 190)

**Features**:
- Two modes: `assign-parent` and `manage-children`
- Single-select with link/unlink per row
- Dynamic entity type tabs (fetches valid types from API)
- Uses `useEntityInstancePicker` hook
- Manual fetch() calls (not TanStack Query)
- Link/unlink individual entities

**Props**:
```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: 'assign-parent' | 'manage-children';
  childEntityType?: string;
  childEntityId?: string;
  childEntityName?: string;
  parentEntityType?: string;
  parentEntityId?: string;
  parentEntityName?: string;
  allowedEntityTypes?: string[];
  onLinkageChange?: () => void;
}
```

---

## Key Differences

| Feature | Modal_LinkExisting... | UnifiedLinkageModal |
|---------|----------------------|---------------------|
| **Selection** | Multi-select (checkboxes) | Single-select (row actions) |
| **API Pattern** | TanStack Query | Raw fetch() |
| **Bulk Operations** | Yes (`/link` endpoint) | No (one at a time) |
| **Entity Type Selection** | Fixed (passed as prop) | Dynamic tabs |
| **Exclusion Logic** | Server-side (`/linkable`) | Client-side `isLinked()` |
| **Cache Invalidation** | TanStack `invalidateQueries` | Manual callback |
| **Link Direction** | Parent → Child only | Bidirectional |
| **Use Case** | "Add Existing" in child tabs | Relationship management page |

---

## Consolidation Strategy

### Recommended Approach: Unified Modal with Modes

Create a single `EntityInstanceLinkageModal` that supports multiple modes:

```typescript
type LinkageMode =
  | 'bulk-link-children'    // Multi-select children to link (current Modal_LinkExisting...)
  | 'assign-parent'         // Select parent for entity (current UnifiedLinkageModal mode)
  | 'manage-children';      // Link/unlink children with type tabs (current UnifiedLinkageModal mode)

interface EntityInstanceLinkageModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: LinkageMode;

  // Common props
  onSuccess?: () => void;

  // For 'bulk-link-children' mode
  parentEntity?: string;
  parentId?: string;
  childEntity?: string;
  childEntityLabel?: string;

  // For 'assign-parent' and 'manage-children' modes
  entityType?: string;
  entityId?: string;
  entityName?: string;
  allowedEntityTypes?: string[];
}
```

---

## Implementation Plan

### Phase 1: Preparation (No Breaking Changes)

1. **Create shared utilities**
   - Extract common search input component
   - Extract entity row display component
   - Create shared TanStack Query hooks for linkage operations

2. **Standardize API patterns**
   - Migrate `UnifiedLinkageModal` from fetch() to TanStack Query
   - Use `apiClient` instead of raw fetch()

### Phase 2: Build Unified Component

1. **Create `EntityInstanceLinkageModal.tsx`**
   ```
   apps/web/src/components/shared/modal/EntityInstanceLinkageModal.tsx
   ```

2. **Internal structure**:
   ```typescript
   function EntityInstanceLinkageModal(props) {
     switch (props.mode) {
       case 'bulk-link-children':
         return <BulkLinkChildrenView {...props} />;
       case 'assign-parent':
         return <AssignParentView {...props} />;
       case 'manage-children':
         return <ManageChildrenView {...props} />;
     }
   }
   ```

3. **Shared sub-components**:
   - `EntitySearchInput` - Search input with icon
   - `EntitySelectionList` - Scrollable list with checkbox/radio
   - `EntityTypeTabBar` - Entity type selection tabs
   - `LinkActionFooter` - Footer with action buttons

### Phase 3: Migration (Incremental)

1. **Update `EntityListOfInstancesTable.tsx`**
   ```diff
   - import { Modal_LinkExistingEntityInstanceToDataTable } from '../modal/Modal_LinkExistingEntityInstanceToDataTable';
   + import { EntityInstanceLinkageModal } from '../modal/EntityInstanceLinkageModal';

   - <Modal_LinkExistingEntityInstanceToDataTable
   + <EntityInstanceLinkageModal
   +   mode="bulk-link-children"
       parentEntity={parentContext.entityCode}
       parentId={parentContext.entityId}
       childEntity={entityCode}
       childEntityLabel={entityLabel}
   ```

2. **Update `EntitySpecificInstancePage.tsx`**
   ```diff
   - import { UnifiedLinkageModal } from '../../components/shared/modal/UnifiedLinkageModal';
   + import { EntityInstanceLinkageModal } from '../../components/shared/modal/EntityInstanceLinkageModal';

   - <UnifiedLinkageModal {...linkageModal.modalProps} />
   + <EntityInstanceLinkageModal {...linkageModal.modalProps} />
   ```

3. **Update remaining consumers** (WikiEditorPage, FormEditPage)

### Phase 4: Cleanup

1. Delete deprecated files:
   - `Modal_LinkExistingEntityInstanceToDataTable.tsx`
   - `UnifiedLinkageModal.tsx`

2. Update exports in `modal/index.ts`

3. Update documentation references

---

## File Changes Summary

| Action | File |
|--------|------|
| CREATE | `components/shared/modal/EntityInstanceLinkageModal.tsx` |
| CREATE | `components/shared/modal/linkage/BulkLinkChildrenView.tsx` |
| CREATE | `components/shared/modal/linkage/AssignParentView.tsx` |
| CREATE | `components/shared/modal/linkage/ManageChildrenView.tsx` |
| CREATE | `components/shared/modal/linkage/EntitySearchInput.tsx` |
| CREATE | `components/shared/modal/linkage/EntitySelectionList.tsx` |
| CREATE | `components/shared/modal/linkage/EntityTypeTabBar.tsx` |
| MODIFY | `components/shared/ui/EntityListOfInstancesTable.tsx` |
| MODIFY | `pages/shared/EntitySpecificInstancePage.tsx` |
| MODIFY | `pages/wiki/WikiEditorPage.tsx` |
| MODIFY | `pages/form/FormEditPage.tsx` |
| MODIFY | `hooks/useLinkageModal.ts` |
| MODIFY | `components/shared/modal/index.ts` |
| DELETE | `components/shared/modal/Modal_LinkExistingEntityInstanceToDataTable.tsx` |
| DELETE | `components/shared/modal/UnifiedLinkageModal.tsx` |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Incremental migration, test each consumer separately |
| Different API patterns | Abstract into shared hooks before consolidation |
| UI differences between modes | Keep mode-specific views internally, share only common pieces |
| Entity type config hardcoding in UnifiedLinkageModal | Move to database-driven approach using `app.entity` |

---

## Testing Checklist

### Bulk Link Children Mode (from child entity tabs)
- [ ] Search filters entities correctly
- [ ] Multi-select with checkboxes works
- [ ] Select All toggles all visible
- [ ] Bulk link API is called with correct payload
- [ ] Already-linked entities are excluded
- [ ] Cache is invalidated after success
- [ ] Modal closes after successful link

### Assign Parent Mode (from entity detail)
- [ ] Entity type tabs display valid parent types
- [ ] Search filters within selected type
- [ ] Link creates parent-child relationship
- [ ] Unlink removes relationship
- [ ] Existing linkages show "Linked" status

### Manage Children Mode (from entity detail)
- [ ] Entity type tabs display valid child types
- [ ] Search filters within selected type
- [ ] Link/unlink works correctly
- [ ] Count summary is accurate

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1: Preparation | 2-3 hours |
| Phase 2: Build Unified | 4-6 hours |
| Phase 3: Migration | 2-3 hours |
| Phase 4: Cleanup | 1 hour |
| **Total** | **9-13 hours** |

---

## Alternative Approaches Considered

### Option A: Keep Both (Not Recommended)
- Pros: No migration effort
- Cons: Duplicate code, inconsistent patterns, harder maintenance

### Option B: Extend Modal_LinkExisting... (Partial)
- Pros: Reuse TanStack Query patterns
- Cons: Would need to add entity type tabs, bidirectional support

### Option C: Unified Modal with Modes (Recommended)
- Pros: Single source of truth, consistent patterns, shared sub-components
- Cons: Initial development effort

---

## Appendix: Current Usage Map

```
EntityListOfInstancesTable.tsx
  └── SplitAddButton ("Add Existing" tab)
      └── Modal_LinkExistingEntityInstanceToDataTable
          └── API: GET /api/v1/{parent}/{parentId}/{child}/linkable
          └── API: POST /api/v1/{parent}/{parentId}/{child}/link

EntitySpecificInstancePage.tsx
  └── useLinkageModal hook
      └── UnifiedLinkageModal (mode: assign-parent | manage-children)
          └── API: GET /api/v1/entity_instance_link/parents/{type}
          └── API: GET /api/v1/entity_instance_link/children/{type}
          └── API: GET /api/v1/entity_instance_link?...
          └── API: POST /api/v1/entity_instance_link
          └── API: DELETE /api/v1/entity_instance_link/{id}

WikiEditorPage.tsx / FormEditPage.tsx
  └── useLinkageModal hook
      └── UnifiedLinkageModal (same as above)
```
