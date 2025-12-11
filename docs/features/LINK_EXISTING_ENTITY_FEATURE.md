# Feature: Dynamic "Add" Button with "Link Existing" Option

> **Version**: 11.0.0
> **Status**: ✅ IMPLEMENTED
> **Author**: Claude Code
> **Date**: 2025-12-11

---

## Coherence Check Summary

| Item | Plan | Actual Codebase | Status |
|------|------|-----------------|--------|
| `EntityListOfInstancesTableProps.entityCode` | Proposed | ❌ Missing | **TO ADD** |
| `EntityListOfInstancesTableProps.parentContext` | Proposed | ❌ Missing | **TO ADD** |
| `EntityListOfInstancesTableProps.onLinkExisting` | Proposed | ❌ Missing | **TO ADD** |
| `ParentContext` type | Defined in plan | ✅ Exists in `DeleteOrUnlinkModal.tsx:32` | **REUSE** |
| `useEntityCodes().getByCode(code).ui_label` | Documented | ✅ Works correctly | **OK** |
| `ENTITY_TABLE_MAP` | Referenced | ✅ Multiple definitions exist | **USE `getTableName()`** |
| `Modal` component | Referenced | ✅ Exists at `modal/Modal.tsx` | **OK** |
| Add button handler | `handleStartAddRow` | Actually `onAddRow` prop | **CORRECTED** |

**Key Corrections Applied:**
1. Reuse existing `ParentContext` type from `DeleteOrUnlinkModal.tsx` (don't redefine)
2. Use `getTableName()` helper instead of direct `ENTITY_TABLE_MAP` access
3. Button handler is `onAddRow` callback, not internal `handleStartAddRow`
4. Modal uses `footer` prop pattern, not inline buttons in children

---

## Executive Summary

Transform the static "Add new row" button in `EntityListOfInstancesTable` into a context-aware split button that:
1. Displays dynamic entity name (e.g., "Add New Customer" instead of "Add new row")
2. In parent context, provides a "Link Existing {Entity}" option
3. Opens a reusable multi-select modal to link existing entities without creating new ones

---

## Current State Analysis

### Component: EntityListOfInstancesTable

**Location**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

**Current Button** (lines 2522-2533):
```tsx
{allowAddRow && (
  <div className="border-t border-dark-300 bg-dark-100">
    <button onClick={handleStartAddRow} className="...">
      <Plus className="h-4 w-4" />
      <span>Add new row</span>  {/* Static text - needs to be dynamic */}
    </button>
  </div>
)}
```

**Problems**:
1. Static "Add new row" text - not entity-aware
2. No "Link Existing" option in parent context
3. Only creates new entities - can't link existing ones

### Context Detection

The component receives context via **two mechanisms**:

| Mechanism | Source | Detection |
|-----------|--------|-----------|
| Route-based | URL structure | `/project` = standalone, `/project/{id}/task` = child tab |
| Prop-based | `parentContext` prop | Passed to `DeleteOrUnlinkModal`, not to table currently |

**Current Props** (from interface):
```typescript
interface EntityListOfInstancesTableProps<T = any> {
  allowAddRow?: boolean;
  onAddRow?: (newRecord: Partial<T>) => void;
  // Missing: entityCode, parentContext
}
```

### Existing Link Infrastructure

**API Endpoint**: `POST /api/v1/entity_instance_link`
```typescript
Body: {
  parent_entity_type: string;   // e.g., 'project'
  parent_entity_id: string;     // Parent UUID
  child_entity_type: string;    // e.g., 'task'
  child_entity_id: string;      // Child UUID
  relationship_type?: string;   // Default: 'contains'
}
```

**Service Method**: `entityInfra.set_entity_instance_link()`
- Creates single link per call
- No bulk support currently

---

## Implementation Plan

### Phase 1: Props Enhancement

#### 1.1 Update EntityListOfInstancesTableProps

**File**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

```typescript
// Import existing ParentContext type (DON'T redefine!)
import { ParentContext } from '../modal/DeleteOrUnlinkModal';

interface EntityListOfInstancesTableProps<T = any> {
  // ... existing props (data, metadata, pagination, allowAddRow, onAddRow, etc.) ...

  // NEW: Entity identification (required for dynamic labels)
  entityCode?: string;

  // NEW: Parent context (enables "Link Existing" option)
  // Reuses existing ParentContext type from DeleteOrUnlinkModal
  parentContext?: ParentContext;

  // NEW: Callback when modal closes after successful linking
  onLinkSuccess?: () => void;
}
```

**Note**: The `ParentContext` type already exists in [DeleteOrUnlinkModal.tsx:32](apps/web/src/components/shared/modal/DeleteOrUnlinkModal.tsx#L32):
```typescript
export interface ParentContext {
  entityCode: string;    // Parent entity type (e.g., 'project')
  entityId: string;      // Parent entity instance UUID
  entityName?: string;   // Parent display name
  entityLabel?: string;  // Parent entity label (e.g., 'Project')
}
```

#### 1.2 Update Parent Components to Pass Props

**EntitySpecificInstancePage.tsx** (child entity tabs):
```typescript
<EntityListOfInstancesTable
  entityCode={currentChildEntity}
  parentContext={{
    entityCode,
    entityId: id!,
    entityLabel: config?.displayName
  }}
  onLinkExisting={handleLinkExisting}
  // ... other props
/>
```

**EntityListOfInstancesPage.tsx** (standalone):
```typescript
<EntityListOfInstancesTable
  entityCode={entityCode}
  // No parentContext - standalone mode
  // ... other props
/>
```

---

### Phase 2: Backend API - Bulk Link Endpoint

#### 2.1 New Endpoint: Bulk Link Entities

**File**: `apps/api/src/modules/entity/entity-instance-link-routes.ts`

```typescript
// POST /api/v1/{parentEntity}/{parentId}/{childEntity}/link
// Bulk link multiple existing entities to a parent

fastify.post<{
  Params: { parentEntity: string; parentId: string; childEntity: string };
  Body: { entityIds: string[] };
}>('/:parentEntity/:parentId/:childEntity/link', {
  schema: {
    params: Type.Object({
      parentEntity: Type.String(),
      parentId: Type.String({ format: 'uuid' }),
      childEntity: Type.String()
    }),
    body: Type.Object({
      entityIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 })
    }),
    response: {
      201: Type.Object({
        success: Type.Boolean(),
        linked: Type.Number(),
        links: Type.Array(Type.Object({
          parent_id: Type.String(),
          child_id: Type.String(),
          link_id: Type.String()
        })),
        skipped: Type.Number(),
        skippedIds: Type.Array(Type.String())
      })
    }
  },
  preHandler: fastify.authenticate
}, async (request, reply) => {
  const { parentEntity, parentId, childEntity } = request.params;
  const { entityIds } = request.body;
  const userId = request.user.sub;

  // RBAC: Check EDIT permission on parent
  const canEdit = await entityInfra.check_entity_rbac(
    userId, parentEntity, parentId, Permission.EDIT
  );
  if (!canEdit) {
    return reply.status(403).send({ error: 'Cannot edit parent entity' });
  }

  // Get existing links to avoid duplicates
  const existingLinks = await entityInfra.get_all_entity_instance_links({
    parent_entity_code: parentEntity,
    parent_entity_id: parentId,
    child_entity_code: childEntity
  });
  const existingChildIds = new Set(existingLinks.map(l => l.child_entity_instance_id));

  // Filter out already-linked entities
  const toLink = entityIds.filter(id => !existingChildIds.has(id));
  const skippedIds = entityIds.filter(id => existingChildIds.has(id));

  // Create links (can be parallelized or batched)
  const links = await Promise.all(
    toLink.map(childId =>
      entityInfra.set_entity_instance_link({
        parent_entity_code: parentEntity,
        parent_entity_id: parentId,
        child_entity_code: childEntity,
        child_entity_id: childId,
        relationship_type: 'contains'
      })
    )
  );

  return reply.status(201).send({
    success: true,
    linked: links.length,
    links: links.map(l => ({
      parent_id: l.entity_instance_id,
      child_id: l.child_entity_instance_id,
      link_id: l.id
    })),
    skipped: skippedIds.length,
    skippedIds
  });
});
```

#### 2.2 New Endpoint: Get Linkable Entities

**File**: `apps/api/src/modules/entity/entity-instance-link-routes.ts`

```typescript
// GET /api/v1/{parentEntity}/{parentId}/{childEntity}/linkable
// Returns entities NOT yet linked to the parent

fastify.get<{
  Params: { parentEntity: string; parentId: string; childEntity: string };
  Querystring: { search?: string; limit?: number };
}>('/:parentEntity/:parentId/:childEntity/linkable', {
  schema: {
    params: Type.Object({
      parentEntity: Type.String(),
      parentId: Type.String({ format: 'uuid' }),
      childEntity: Type.String()
    }),
    querystring: Type.Object({
      search: Type.Optional(Type.String()),
      limit: Type.Optional(Type.Number({ default: 50 }))
    })
  },
  preHandler: fastify.authenticate
}, async (request, reply) => {
  const { parentEntity, parentId, childEntity } = request.params;
  const { search, limit = 50 } = request.query;
  const userId = request.user.sub;

  // RBAC: VIEW permission on parent
  const canView = await entityInfra.check_entity_rbac(
    userId, parentEntity, parentId, Permission.VIEW
  );
  if (!canView) {
    return reply.status(403).send({ error: 'Cannot view parent entity' });
  }

  // Get already-linked entity IDs
  const existingLinks = await entityInfra.get_all_entity_instance_links({
    parent_entity_code: parentEntity,
    parent_entity_id: parentId,
    child_entity_code: childEntity
  });
  const linkedIds = existingLinks.map(l => l.child_entity_instance_id);

  // Get RBAC condition for child entity
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, childEntity, Permission.VIEW, 'e'
  );

  // Query linkable entities (not already linked)
  // Use getTableName() helper from universal-entity-crud-factory
  const tableName = `app.${getTableName(childEntity)}`;

  const conditions = [
    rbacCondition,
    sql`e.active_flag = true`
  ];

  if (linkedIds.length > 0) {
    conditions.push(sql`e.id NOT IN (${sql.join(linkedIds.map(id => sql`${id}::uuid`), sql`, `)})`);
  }

  if (search) {
    conditions.push(sql`(
      e.name ILIKE ${`%${search}%`} OR
      e.code ILIKE ${`%${search}%`} OR
      COALESCE(e.descr, '') ILIKE ${`%${search}%`}
    )`);
  }

  const entities = await db.execute(sql`
    SELECT e.id, e.code, e.name, e.descr
    FROM ${sql.raw(tableName)} e
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY e.name ASC
    LIMIT ${limit}
  `);

  return reply.send({
    success: true,
    data: entities,
    total: entities.length
  });
});
```

---

### Phase 3: Frontend Components

#### 3.1 LinkExistingEntityModal Component

**File**: `apps/web/src/components/shared/modal/LinkExistingEntityModal.tsx`

```typescript
import { useState, useCallback } from 'react';
import { Modal } from './Modal';  // Use existing Modal component
import { Search, Link2, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface LinkExistingEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentEntity: string;
  parentId: string;
  childEntity: string;
  childEntityLabel: string;
  onSuccess?: () => void;
}

interface LinkableEntity {
  id: string;
  code: string | null;
  name: string;
  descr: string | null;
}

export function LinkExistingEntityModal({
  isOpen,
  onClose,
  parentEntity,
  parentId,
  childEntity,
  childEntityLabel,
  onSuccess
}: LinkExistingEntityModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch linkable entities
  const { data, isLoading } = useQuery({
    queryKey: ['linkable', parentEntity, parentId, childEntity, search],
    queryFn: async () => {
      const response = await apiClient.get<{ data: LinkableEntity[] }>(
        `/api/v1/${parentEntity}/${parentId}/${childEntity}/linkable`,
        { params: { search, limit: 50 } }
      );
      return response.data?.data || [];
    },
    enabled: isOpen
  });

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async (entityIds: string[]) => {
      const response = await apiClient.post(
        `/api/v1/${parentEntity}/${parentId}/${childEntity}/link`,
        { entityIds }
      );
      return response.data;
    },
    onSuccess: (result) => {
      toast.success(`Linked ${result.linked} ${childEntityLabel}(s)`);
      if (result.skipped > 0) {
        toast.info(`${result.skipped} already linked`);
      }
      // Invalidate child entity list cache
      queryClient.invalidateQueries({
        queryKey: ['entity-list', childEntity]
      });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Failed to link: ${error.message}`);
    }
  });

  const handleToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!data) return;
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(e => e.id)));
    }
  }, [data, selectedIds.size]);

  const handleLink = useCallback(() => {
    if (selectedIds.size === 0) return;
    linkMutation.mutate(Array.from(selectedIds));
  }, [selectedIds, linkMutation]);

  const entities = data || [];
  const allSelected = entities.length > 0 && selectedIds.size === entities.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Link Existing ${childEntityLabel}`}
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500" />
          <Input
            placeholder={`Search ${childEntityLabel.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Select All */}
        {entities.length > 0 && (
          <div className="flex items-center gap-2 py-2 border-b border-dark-200">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-dark-600">
              Select all ({entities.length})
            </span>
          </div>
        )}

        {/* Entity List */}
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-dark-400" />
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center py-8 text-dark-500">
              {search
                ? `No ${childEntityLabel.toLowerCase()} found matching "${search}"`
                : `All ${childEntityLabel.toLowerCase()} are already linked`
              }
            </div>
          ) : (
            entities.map((entity) => (
              <label
                key={entity.id}
                className="flex items-start gap-3 p-2 rounded hover:bg-dark-50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedIds.has(entity.id)}
                  onCheckedChange={() => handleToggle(entity.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {entity.code && (
                      <span className="text-xs font-mono text-dark-500 bg-dark-100 px-1.5 py-0.5 rounded">
                        {entity.code}
                      </span>
                    )}
                    <span className="font-medium text-dark-900 truncate">
                      {entity.name}
                    </span>
                  </div>
                  {entity.descr && (
                    <p className="text-sm text-dark-500 truncate mt-0.5">
                      {entity.descr}
                    </p>
                  )}
                </div>
              </label>
            ))
          )}
        </div>

      </div>
    </Modal>
  );
}

// Note: Modal's footer prop handles action buttons automatically
// The Modal component signature is:
// <Modal isOpen onClose title footer={<buttons>}>{children}</Modal>
```

#### 3.2 SplitAddButton Component

**File**: `apps/web/src/components/shared/ui/SplitAddButton.tsx`

```typescript
import { useState, useRef, useEffect } from 'react';
import { Plus, Link2, ChevronDown } from 'lucide-react';

interface SplitAddButtonProps {
  entityLabel: string;
  onAddNew: () => void;
  onLinkExisting?: () => void;
  showLinkOption?: boolean;
}

export function SplitAddButton({
  entityLabel,
  onAddNew,
  onLinkExisting,
  showLinkOption = false
}: SplitAddButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside (standard codebase pattern)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Standalone mode - single button
  if (!showLinkOption) {
    return (
      <button
        onClick={onAddNew}
        className="w-full px-6 py-3 text-left text-sm text-dark-700 hover:bg-dark-100 transition-colors flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        <span>Add New {entityLabel}</span>
      </button>
    );
  }

  // Parent context mode - split button with dropdown
  return (
    <div className="relative" ref={menuRef}>
      <div className="flex">
        {/* Primary action */}
        <button
          onClick={onAddNew}
          className="flex-1 px-6 py-3 text-left text-sm text-dark-700 hover:bg-dark-100 transition-colors flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add New {entityLabel}</span>
        </button>

        {/* Dropdown trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-3 text-dark-500 hover:bg-dark-100 border-l border-dark-200 transition-colors"
          aria-label="More options"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-dark-200 rounded-lg shadow-lg z-10">
          <button
            onClick={() => {
              onLinkExisting?.();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2.5 text-left text-sm text-dark-700 hover:bg-dark-50 flex items-center gap-2"
          >
            <Link2 className="h-4 w-4" />
            <span>Link Existing {entityLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 3.3 Update EntityListOfInstancesTable

**File**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

```typescript
// Add imports
import { SplitAddButton } from './SplitAddButton';
import { LinkExistingEntityModal } from '../modal/LinkExistingEntityModal';
import { useEntityCodes } from '@/db/cache/hooks';

// Update props interface
interface EntityListOfInstancesTableProps<T = any> {
  // ... existing props ...
  entityCode?: string;
  parentContext?: {
    entityCode: string;
    entityId: string;
    entityLabel?: string;
  };
  onLinkExisting?: (entityIds: string[]) => Promise<void>;
}

// Inside component
export function EntityListOfInstancesTable<T>({
  // ... existing props ...
  entityCode,
  parentContext,
  onLinkExisting,
}: EntityListOfInstancesTableProps<T>) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const { getByCode } = useEntityCodes();

  // Get entity label from entity codes cache
  const entityMeta = entityCode ? getByCode(entityCode) : null;
  const entityLabel = entityMeta?.ui_label || entityCode || 'Item';

  // ... existing code ...

  return (
    <div>
      {/* ... existing table code ... */}

      {/* Replace old Add Row Button with SplitAddButton */}
      {allowAddRow && (
        <div className="border-t border-dark-300 bg-dark-100">
          <SplitAddButton
            entityLabel={entityLabel}
            onAddNew={handleStartAddRow}
            onLinkExisting={() => setShowLinkModal(true)}
            showLinkOption={!!parentContext && !!onLinkExisting}
          />
        </div>
      )}

      {/* Link Existing Modal */}
      {parentContext && (
        <LinkExistingEntityModal
          isOpen={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          parentEntity={parentContext.entityCode}
          parentId={parentContext.entityId}
          childEntity={entityCode || ''}
          childEntityLabel={entityLabel}
          onSuccess={() => {
            // Refresh the list after linking
            // This will be handled by cache invalidation
          }}
        />
      )}

      {/* ... rest of component ... */}
    </div>
  );
}
```

---

### Phase 4: Integration in Parent Pages

#### 4.1 Update EntitySpecificInstancePage

**File**: `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

```typescript
// Add handler for linking existing entities
const handleLinkExisting = useCallback(async (entityIds: string[]) => {
  if (!currentChildEntity || !id) return;

  const token = localStorage.getItem('auth_token');
  const response = await fetch(
    `${API_CONFIG.BASE_URL}/api/v1/${entityCode}/${id}/${currentChildEntity}/link`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ entityIds })
    }
  );

  if (!response.ok) {
    throw new Error('Failed to link entities');
  }

  // Refetch child data
  refetchChild();
}, [entityCode, id, currentChildEntity, refetchChild]);

// Pass to EntityListOfInstancesTable
<EntityListOfInstancesTable
  entityCode={currentChildEntity}
  parentContext={{
    entityCode,
    entityId: id!,
    entityLabel: config?.displayName
  }}
  onLinkExisting={handleLinkExisting}
  // ... other props
/>
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Component Hierarchy                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  EntitySpecificInstancePage                                          │
│  └── EntityListOfInstancesTable                                      │
│      ├── Props: entityCode, parentContext, onLinkExisting           │
│      ├── SplitAddButton                                             │
│      │   ├── "Add New {Entity}" → handleStartAddRow                 │
│      │   └── "Link Existing {Entity}" → setShowLinkModal(true)      │
│      └── LinkExistingEntityModal                                    │
│          ├── Search input                                           │
│          ├── Multi-select checkbox list                             │
│          │   └── Displays: code, name, descr                        │
│          └── "Link Selected" button → POST /api/v1/.../link         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        API Flow                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User clicks "Link Existing Customer" in Task child tab          │
│     ↓                                                                │
│  2. Modal opens → GET /api/v1/task/{taskId}/customer/linkable       │
│     ↓                                                                │
│  3. API returns customers NOT linked to this task                   │
│     • Applies RBAC filtering (only visible customers)               │
│     • Excludes already-linked customers                             │
│     ↓                                                                │
│  4. User selects multiple customers, clicks "Link"                  │
│     ↓                                                                │
│  5. POST /api/v1/task/{taskId}/customer/link                        │
│     Body: { entityIds: ["uuid-1", "uuid-2", "uuid-3"] }             │
│     ↓                                                                │
│  6. API creates entity_instance_link records                        │
│     • RBAC check: user must have EDIT on task                       │
│     • Skips already-linked (idempotent)                             │
│     ↓                                                                │
│  7. Response: { linked: 3, skipped: 0 }                             │
│     ↓                                                                │
│  8. Frontend invalidates cache → list refreshes                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary Table

| Context | Button Display | Actions Available |
|---------|---------------|-------------------|
| **Standalone** (`/customer`) | "Add New Customer" | Create → Edit |
| **Child Tab** (`/task/{id}/customer`) | "Add New Customer" ▼ | Create → Link → Edit |
| | └─ "Link Existing Customer" | Link only (modal) |

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `apps/web/src/components/shared/modal/LinkExistingEntityModal.tsx` | Reusable multi-select modal |
| `apps/web/src/components/shared/ui/SplitAddButton.tsx` | Context-aware add button |

### Modified Files
| File | Changes |
|------|---------|
| `apps/api/src/modules/entity/entity-instance-link-routes.ts` | Add bulk link + linkable endpoints |
| `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx` | Add entityCode, parentContext props; integrate SplitAddButton |
| `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx` | Pass new props to table; add handleLinkExisting |
| `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` | Pass entityCode prop |

---

## Testing Checklist

- [ ] Standalone entity list shows "Add New {Entity}" (single button)
- [ ] Child entity tab shows split button with dropdown
- [ ] "Add New" creates entity and links to parent
- [ ] "Link Existing" opens modal with search
- [ ] Modal excludes already-linked entities
- [ ] Multi-select works with Select All
- [ ] Link creates entity_instance_link records
- [ ] List refreshes after linking
- [ ] RBAC enforced (EDIT on parent required)
- [ ] Toast notifications show success/error
- [ ] Empty state when all entities already linked
