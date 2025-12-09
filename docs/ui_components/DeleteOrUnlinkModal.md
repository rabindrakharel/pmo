# DeleteOrUnlinkModal Component

**Version:** 1.0.0 | **Location:** `apps/web/src/components/shared/modal/DeleteOrUnlinkModal.tsx` | **Status:** Design Spec

---

## Overview

DeleteOrUnlinkModal provides context-aware removal actions for entity records. When a record is displayed within a **child entity tab** (parent context exists), users can choose between **Unlink** (remove relationship only) or **Delete** (permanently remove record). Standalone data tables (no parent context) show standard delete confirmation.

**Core Principle:** Same `EntityListOfInstancesTable` component, different behavior based on `parentContext` prop.

---

## Behavior by Context

| Context | Location | Delete Icon Behavior | Modal? | Available Actions |
|---------|----------|----------------------|--------|-------------------|
| **Child Entity Tab** | `/project/abc-123/task` | Opens `DeleteOrUnlinkModal` | ✓ Yes | Unlink OR Delete |
| **Standalone Entity List** | `/task` (main task list) | `window.confirm()` then direct delete | ✗ No | Delete only |
| **Standalone Entity List** | `/project` (main project list) | `window.confirm()` then direct delete | ✗ No | Delete only |

**Key Distinction:**
- **Unlink option appears ONLY when `parentContext` is provided** (child entity tabs)
- **Standalone lists have no parent** → no relationship to remove → only delete makes sense

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DELETE VS UNLINK ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CONTEXT DETECTION (Same DataTable Component)                               │
│  ─────────────────────────────────────────────                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  EntitySpecificInstancePage (Parent: Project abc-123)               │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  DynamicChildEntityTabs                                      │   │   │
│  │  │  [Overview] [Tasks] [Team] [Docs]                           │   │   │
│  │  │              ↓                                               │   │   │
│  │  │  Child Tab Active: "Tasks"                                   │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                              │                                      │   │
│  │                              ▼                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  EntityListOfInstancesTable                                  │   │   │
│  │  │  parentContext={{ entityCode: 'project', entityId: 'abc' }} │   │   │
│  │  │                                                              │   │   │
│  │  │  [Task Row] [Task Row] [Task Row]  [🗑️ Delete Icon]         │   │   │
│  │  │                                     ↓                        │   │   │
│  │  │                          DeleteOrUnlinkModal                 │   │   │
│  │  │                          (Shows Unlink + Delete options)     │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  vs.                                                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  EntityListOfInstancesPage (Standalone Task List)                   │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  EntityListOfInstancesTable                                  │   │   │
│  │  │  parentContext={undefined}  ← No parent context              │   │   │
│  │  │                                                              │   │   │
│  │  │  [Task Row] [Task Row] [Task Row]  [🗑️ Delete Icon]         │   │   │
│  │  │                                     ↓                        │   │   │
│  │  │                          Standard Delete Confirm             │   │   │
│  │  │                          (window.confirm or simple modal)    │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Impact Comparison

### Operation: UNLINK

Removes **only the relationship** between parent and child. The child entity continues to exist in the system.

| Table | Action | Example |
|-------|--------|---------|
| `app.d_task` (primary) | **No change** | Task record untouched |
| `app.entity_instance` | **No change** | Task registry entry remains |
| `app.entity_instance_link` | **DELETE** | Link from project→task removed |
| `app.entity_rbac` | **No change** | Task permissions remain |

```sql
-- Unlink Task-001 from Project-ABC
-- ONLY this happens:
DELETE FROM app.entity_instance_link
WHERE entity_code = 'project'
  AND entity_instance_id = 'project-abc-uuid'
  AND child_entity_code = 'task'
  AND child_entity_instance_id = 'task-001-uuid';

-- Result: Task-001 still exists in system
-- Can be found in global task list: /task
-- Can be linked to other projects
-- All permissions intact
```

### Operation: DELETE

**Permanently removes** the child entity from the entire system.

| Table | Action | Example |
|-------|--------|---------|
| `app.d_task` (primary) | **DELETE** or soft-delete | Task record removed |
| `app.entity_instance` | **DELETE** | Task registry entry removed |
| `app.entity_instance_link` | **DELETE** | All links (as parent AND child) removed |
| `app.entity_rbac` | **DELETE** | All task permissions removed |

```sql
-- Delete Task-001 permanently
-- ALL of this happens in ONE transaction:

-- 1. Primary table (soft or hard delete based on entity config)
DELETE FROM app.d_task WHERE id = 'task-001-uuid';
-- OR: UPDATE app.d_task SET active_flag = false WHERE id = 'task-001-uuid';

-- 2. Entity registry
DELETE FROM app.entity_instance
WHERE entity_code = 'task' AND entity_id = 'task-001-uuid';

-- 3. All links (as parent AND as child)
DELETE FROM app.entity_instance_link
WHERE (entity_code = 'task' AND entity_instance_id = 'task-001-uuid')
   OR (child_entity_code = 'task' AND child_entity_instance_id = 'task-001-uuid');

-- 4. All permissions
DELETE FROM app.entity_rbac
WHERE entity_code = 'task' AND entity_id = 'task-001-uuid';

-- Result: Task-001 is GONE from entire system
-- Cannot be found anywhere
-- All relationships severed
-- All permissions removed
```

---

## Props Interface

### EntityListOfInstancesTable (Extended)

```typescript
interface EntityListOfInstancesTableProps<T = any> {
  // ... existing props ...

  /**
   * v14.0.0: Parent context for child entity tabs
   * When present, delete action shows Unlink/Delete modal
   * When absent, delete action shows standard confirmation
   */
  parentContext?: {
    entityCode: string;    // Parent entity type (e.g., 'project')
    entityId: string;      // Parent entity instance ID
    entityName?: string;   // Parent display name (for modal text)
  };

  /** Delete handler - called for hard delete */
  onDelete?: (record: T) => void;

  /**
   * v14.0.0: Unlink handler - called for soft unlink
   * Only relevant when parentContext is provided
   */
  onUnlink?: (record: T) => void;
}
```

### DeleteOrUnlinkModal

```typescript
interface DeleteOrUnlinkModalProps {
  /** Modal visibility */
  isOpen: boolean;

  /** Close handler */
  onClose: () => void;

  /** Record being removed */
  record: {
    id: string;
    name?: string;
    code?: string;
  };

  /** Child entity type (e.g., 'task') */
  childEntityCode: string;

  /** Child entity display label (e.g., 'Task') */
  childEntityLabel: string;

  /** Parent context - always present when modal is shown */
  parentContext: {
    entityCode: string;
    entityId: string;
    entityName?: string;
  };

  /** Parent entity display label (e.g., 'Project') */
  parentEntityLabel: string;

  /** Unlink action handler */
  onUnlink: () => Promise<void>;

  /** Delete action handler */
  onDelete: () => Promise<void>;

  /** Loading state during async operation */
  isProcessing?: boolean;
}
```

---

## Modal UI Design

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Remove "Kitchen Renovation Task"?                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Choose how to remove this task from "Main Project":        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ○ Unlink from project                              │   │
│  │     ─────────────────────────────────────────────   │   │
│  │     Remove from this project only.                  │   │
│  │     Task will remain in the system and can be       │   │
│  │     linked to other projects.                       │   │
│  │                                                     │   │
│  │     Affects: entity_instance_link only              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ○ Delete permanently                               │   │
│  │     ─────────────────────────────────────────────   │   │
│  │     Remove from entire system. This action          │   │
│  │     cannot be undone.                               │   │
│  │                                                     │   │
│  │     Affects: task, registry, all links, permissions │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [Cancel]  [Confirm Removal]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Visual States

| State | Radio Option | Confirm Button |
|-------|--------------|----------------|
| Unlink selected | Blue highlight | "Unlink from Project" |
| Delete selected | Red highlight | "Delete Permanently" (red) |
| Processing | Disabled radios | Spinner + "Processing..." |

---

## Integration Points

### 1. EntitySpecificInstancePage

**File:** `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

Passes `parentContext` to child entity table:

```typescript
// Line ~1517-1536: Child entity table rendering
<EntityListOfInstancesTable
  data={childDisplayData}
  metadata={childMetadata}
  // ... existing props ...

  // v14.0.0: Add parent context for unlink/delete modal
  parentContext={{
    entityCode: entityCode,        // e.g., 'project'
    entityId: id,                  // e.g., 'abc-123'
    entityName: data?.name || data?.title
  }}

  // Handlers
  onDelete={handleChildDelete}
  onUnlink={handleChildUnlink}    // NEW
/>
```

### 2. EntityListOfInstancesTable

**File:** `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

Conditional delete button behavior:

```typescript
// Row action generation (~line 950-963)
const defaultActions = useMemo(() => {
  const actions: RowAction[] = [];

  // ... edit, share actions ...

  // Delete action - context-aware
  if (onDelete || onUnlink) {
    actions.push({
      key: 'delete',
      label: 'Remove',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (record) => {
        if (parentContext) {
          // Show Unlink/Delete modal
          setDeleteModalRecord(record);
          setShowDeleteModal(true);
        } else {
          // Standard delete confirmation
          if (window.confirm('Are you sure you want to delete this record?')) {
            onDelete?.(record);
          }
        }
      },
      variant: 'danger'
    });
  }

  return actions;
}, [onEdit, onShare, onDelete, onUnlink, parentContext]);
```

### 3. DynamicChildEntityTabs (No Changes)

The tabs component already provides `parentType` and `parentId`. The parent page (`EntitySpecificInstancePage`) constructs `parentContext` from these values.

---

## RBAC Permission Requirements

### Permission Matrix

| Action | Permission Required | Target Entity | Rationale |
|--------|---------------------|---------------|-----------|
| **Unlink** | `EDIT` (level 3) | Parent entity | Modifying parent's children requires EDIT on parent |
| **Delete** | `DELETE` (level 5) | Child entity | Destroying entity requires DELETE on that entity |

### Permission Check Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RBAC PERMISSION CHECKS                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  UNLINK: "Remove Task-001 from Project-ABC"                                 │
│  ─────────────────────────────────────────────                              │
│                                                                              │
│  Question: Can user modify Project-ABC's child list?                        │
│                                                                              │
│  check_entity_rbac(                                                         │
│    userId,                                                                  │
│    'project',        ← Parent entity type                                   │
│    'project-abc',    ← Parent entity ID                                     │
│    Permission.EDIT   ← Level 3 (EDIT)                                       │
│  )                                                                          │
│                                                                              │
│  ✓ EDIT on parent → Can unlink children                                    │
│  ✗ No EDIT on parent → 403 Forbidden                                       │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  DELETE: "Permanently delete Task-001"                                      │
│  ─────────────────────────────────────────                                  │
│                                                                              │
│  Question: Can user destroy Task-001?                                       │
│                                                                              │
│  check_entity_rbac(                                                         │
│    userId,                                                                  │
│    'task',           ← Child entity type (being deleted)                    │
│    'task-001',       ← Child entity ID                                      │
│    Permission.DELETE ← Level 5 (DELETE)                                     │
│  )                                                                          │
│                                                                              │
│  ✓ DELETE on child → Can permanently delete                                │
│  ✗ No DELETE on child → 403 Forbidden                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Different Permissions?

| Action | Reasoning |
|--------|-----------|
| **Unlink = EDIT on Parent** | Unlinking is modifying the parent's relationship list. You're editing "which children belong to this parent." The child entity itself is unchanged. |
| **Delete = DELETE on Child** | Deleting destroys the child entity entirely. This requires permission on the entity being destroyed, not its parent. |

### Edge Cases

| Scenario | Unlink Allowed? | Delete Allowed? |
|----------|-----------------|-----------------|
| User has EDIT on parent, no permission on child | ✓ Yes | ✗ No |
| User has DELETE on child, no permission on parent | ✗ No | ✓ Yes |
| User has EDIT on parent AND DELETE on child | ✓ Yes | ✓ Yes |
| User has only VIEW on both | ✗ No | ✗ No |

---

## API Endpoints

### Unlink Endpoint (NEW)

```
DELETE /api/v1/{parentEntity}/{parentId}/{childEntity}/{childId}/link
```

**Purpose:** Remove relationship only, child entity remains.

**RBAC:** Requires `EDIT` permission on **parent** entity.

**Request:**
```http
DELETE /api/v1/project/abc-123/task/task-001/link
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "action": "unlinked",
  "message": "Task unlinked from project"
}
```

**Backend Implementation:**
```typescript
// In universal-entity-crud-factory.ts
fastify.delete(
  '/api/v1/:parentEntity/:parentId/:childEntity/:childId/link',
  async (request, reply) => {
    const { parentEntity, parentId, childEntity, childId } = request.params;
    const userId = request.user.sub;

    // RBAC: Check EDIT permission on PARENT entity
    // Rationale: Unlinking modifies the parent's child list
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parentEntity, parentId, Permission.EDIT
    );
    if (!canEditParent) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `EDIT permission required on ${parentEntity} to unlink children`
      });
    }

    // Delete link only
    await entityInfra.delete_entity_instance_link({
      entity_code: parentEntity,
      entity_instance_id: parentId,
      child_entity_code: childEntity,
      child_entity_instance_id: childId
    });

    return reply.send({
      success: true,
      action: 'unlinked',
      message: `${childEntity} unlinked from ${parentEntity}`
    });
  }
);
```

### Delete Endpoint (Existing)

```
DELETE /api/v1/{entity}/{id}
```

**Purpose:** Permanently remove entity from system.

**RBAC:** Requires `DELETE` permission on the **child** entity being deleted.

**Backend Implementation (existing pattern):**
```typescript
// In entity routes (e.g., task/routes.ts)
fastify.delete('/api/v1/task/:id', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user.sub;

  // RBAC: Check DELETE permission on the CHILD entity being deleted
  // Rationale: Destroying an entity requires permission on that entity
  const canDelete = await entityInfra.check_entity_rbac(
    userId, 'task', id, Permission.DELETE
  );
  if (!canDelete) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'DELETE permission required on task'
    });
  }

  // Transactional delete (primary + registry + links + rbac)
  const result = await entityInfra.delete_entity({
    entity_code: 'task',
    entity_id: id,
    user_id: userId,
    primary_table: 'app.d_task',
    hard_delete: false
  });

  return reply.send(result);
});
```

Uses existing `delete_entity()` transactional method from `entity-infrastructure.service.ts`.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER ACTION FLOW                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User clicks 🗑️ icon on child entity row                                │
│     │                                                                        │
│     ▼                                                                        │
│  2. EntityListOfInstancesTable checks parentContext                         │
│     │                                                                        │
│     ├── parentContext exists ─────────────────────────────────────┐        │
│     │                                                              │        │
│     │   3a. Open DeleteOrUnlinkModal                              │        │
│     │       │                                                      │        │
│     │       ├── User selects "Unlink"                             │        │
│     │       │   │                                                  │        │
│     │       │   ▼                                                  │        │
│     │       │   4a. Call onUnlink(record)                         │        │
│     │       │       │                                              │        │
│     │       │       ▼                                              │        │
│     │       │   5a. DELETE /api/v1/project/abc/task/001/link      │        │
│     │       │       │                                              │        │
│     │       │       ▼                                              │        │
│     │       │   6a. entity_instance_link row deleted              │        │
│     │       │       Task remains in system                         │        │
│     │       │                                                      │        │
│     │       └── User selects "Delete"                             │        │
│     │           │                                                  │        │
│     │           ▼                                                  │        │
│     │       4b. Call onDelete(record)                             │        │
│     │           │                                                  │        │
│     │           ▼                                                  │        │
│     │       5b. DELETE /api/v1/task/001                           │        │
│     │           │                                                  │        │
│     │           ▼                                                  │        │
│     │       6b. Transactional delete:                             │        │
│     │           - d_task row                                       │        │
│     │           - entity_instance row                              │        │
│     │           - entity_instance_link rows                        │        │
│     │           - entity_rbac rows                                 │        │
│     │                                                              │        │
│     └── parentContext undefined ──────────────────────────────────┘        │
│         │                                                                    │
│         ▼                                                                    │
│     3b. window.confirm('Delete this record?')                               │
│         │                                                                    │
│         ├── User confirms → onDelete(record) → DELETE /api/v1/task/001     │
│         │                                                                    │
│         └── User cancels → No action                                        │
│                                                                              │
│  7. Cache invalidation: invalidateEntityQueries(childEntity)                │
│     │                                                                        │
│     ▼                                                                        │
│  8. TanStack Query refetch → UI updates                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Coherence Issues & Conflicts

### Issue 1: Missing `entity_instance_link_id` in Child Data (HIGH)

**Problem:** Child entity API response doesn't include `entity_instance_link_id` from `entity_instance_link` table.

```typescript
// CURRENT: Child data from useEntityInstanceData
{
  "id": "task-uuid",
  "name": "Task Name",
  "code": "TASK-001"
  // NO entity_instance_link_id!
}

// REQUIRED: Need entity_instance_link_id for unlink operation
{
  "id": "task-uuid",
  "name": "Task Name",
  "code": "TASK-001",
  "entity_instance_link_id": "link-uuid"  // ← NEEDED
}
```

**Root Cause:** `universal-entity-crud-factory.ts` line 711:
```sql
-- CURRENT (line 711)
SELECT DISTINCT e.*
FROM app.d_task e
INNER JOIN app.entity_instance_link eil ON ...
-- JOIN exists but eil.id is NOT selected!
```

**Solution:** Add `eil.id AS entity_instance_link_id` to SELECT when parent context is provided:
```sql
-- REQUIRED
SELECT DISTINCT e.*, eil.id AS entity_instance_link_id
FROM app.d_task e
INNER JOIN app.entity_instance_link eil ON ...
```

**Change Location:** `apps/api/src/lib/universal-entity-crud-factory.ts` lines 569-574, 710-718 (both metadata and data queries)

### Issue 1b: YAML Configuration for Hidden `entity_instance_link_id` (HIGH)

The `entity_instance_link_id` field should be **hidden from UI** but available in the data for programmatic use (unlink operation).

**Step 1: Add pattern to `pattern-mapping.yaml`:**
```yaml
# apps/api/src/services/pattern-mapping.yaml
# Add under SYSTEM INTERNAL FIELDS section

  - { pattern: "entity_instance_link_id", exact: true, fieldBusinessType: systemInternal_linkId }
```

**Step 2: Add view config to `view-type-mapping.yaml`:**
```yaml
# apps/api/src/services/view-type-mapping.yaml
# Add under SYSTEM INTERNAL FIELDS section

  systemInternal_linkId:
    dtype: uuid
    entityListOfInstancesTable:
      <<: *hidden
      renderType: text
    entityInstanceFormContainer:
      <<: *hidden
      renderType: text
    kanbanView:
      <<: *hidden
    gridView:
      <<: *hidden
    calendarView:
      <<: *hidden
    dagView:
      <<: *hidden
```

**Step 3: Add edit config to `edit-type-mapping.yaml`:**
```yaml
# apps/api/src/services/edit-type-mapping.yaml
# Add under SYSTEM INTERNAL FIELDS section

  systemInternal_linkId:
    dtype: uuid
    entityListOfInstancesTable:
      inputType: readonly
      behavior: { editable: false, filterable: false, sortable: false, visible: false }
    entityInstanceFormContainer:
      inputType: readonly
      behavior: { editable: false, visible: false }
    kanbanView:
      inputType: readonly
      behavior: { editable: false, visible: false }
    calendarView:
      inputType: readonly
      behavior: { editable: false, visible: false }
    dagView:
      inputType: readonly
      behavior: { editable: false, visible: false }
```

**Result:** The `entity_instance_link_id` field will be:
- Present in API response data (for unlink operation)
- Hidden from all UI views (`visible: false`)
- Not editable, filterable, or sortable
- Accessible programmatically via `row.entity_instance_link_id`

### Issue 2: RBAC Permission Model Conflict (HIGH)

**Current Implementation** (`entity-instance-link-routes.ts` lines 238-254):
```typescript
// Existing unlink endpoint requires DELETE on BOTH parent AND child
const hasParentPermission = await entityInfra.check_entity_rbac(
  employee_id, link.entity_code, link.entity_instance_id, Permission.DELETE
);
const hasChildPermission = await entityInfra.check_entity_rbac(
  employee_id, link.child_entity_code, link.child_entity_instance_id, Permission.DELETE
);
```

**Design Specification** (this document):
- Unlink: EDIT on parent only
- Delete: DELETE on child only

**Resolution Options:**
1. **Option A**: Create NEW endpoint `/api/v1/{parent}/{parentId}/{child}/{childId}/link` with EDIT-on-parent semantics
2. **Option B**: Modify existing endpoint to accept EDIT permission for unlink operations
3. **Option C**: Accept current behavior (DELETE on both) as more restrictive/secure

**Recommendation:** Option A - New endpoint keeps existing behavior intact, follows REST conventions.

### Issue 3: Existing Infrastructure (POSITIVE)

**Already Exists:**
- `DELETE /api/v1/entity_instance_link/:linkageId` - works but has different RBAC
- `delete_entity_instance_link()` method in entity-infrastructure.service
- `UnifiedLinkageModal` component handles unlink with modal UX

**Can Reuse:**
- Modal pattern from `UnifiedLinkageModal`
- Service method `delete_entity_instance_link()`
- TanStack Query invalidation patterns

### Issue 4: Two Unlink Patterns in Codebase

| Pattern | Location | Use Case |
|---------|----------|----------|
| By `linkage_id` | `UnifiedLinkageModal`, task assignees | When you have the link record ID |
| By parent+child | **NEW** (this feature) | When you only have parent/child context |

**Resolution:** New endpoint accepts parent/child context, internally finds and deletes the link.

---

## Implementation Checklist

### Backend

| File | Change | Priority | Status |
|------|--------|----------|--------|
| [universal-entity-crud-factory.ts:711](../../apps/api/src/lib/universal-entity-crud-factory.ts#L711) | Add `eil.id AS entity_instance_link_id` to SELECT when parent context provided | HIGH | Pending |
| [pattern-mapping.yaml](../../apps/api/src/services/pattern-mapping.yaml) | Add `entity_instance_link_id` → `systemInternal_linkId` pattern | HIGH | Pending |
| [view-type-mapping.yaml](../../apps/api/src/services/view-type-mapping.yaml) | Add `systemInternal_linkId` with `visible: false` for all views | HIGH | Pending |
| [edit-type-mapping.yaml](../../apps/api/src/services/edit-type-mapping.yaml) | Add `systemInternal_linkId` with `visible: false`, `editable: false` | HIGH | Pending |
| [universal-entity-crud-factory.ts](../../apps/api/src/lib/universal-entity-crud-factory.ts) | Add NEW unlink endpoint `DELETE /:parent/:parentId/:child/:childId/link` | HIGH | Pending |
| [entity-infrastructure.service.ts](../../apps/api/src/services/entity-infrastructure.service.ts) | Add `delete_entity_instance_link_by_context()` method (find + delete) | MEDIUM | Pending |
| [entity-infrastructure.service.ts](../../apps/api/src/services/entity-infrastructure.service.ts) | Verify `delete_entity_instance_link` exists | - | Exists |

### Frontend

| File | Change | Priority | Status |
|------|--------|----------|--------|
| `DeleteOrUnlinkModal.tsx` | **NEW** - Modal component with radio selection | HIGH | Pending |
| [EntityListOfInstancesTable.tsx](../../apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx) | Add `parentContext`, `onUnlink` props; conditional modal | MEDIUM | Pending |
| [EntitySpecificInstancePage.tsx](../../apps/web/src/pages/shared/EntitySpecificInstancePage.tsx) | Pass `parentContext`, add `handleChildUnlink` | MEDIUM | Pending |

---

## Usage Example

```tsx
// In EntitySpecificInstancePage.tsx

// Handler for unlink action
const handleChildUnlink = useCallback(async (record: any) => {
  if (!childConfig || !currentChildEntity || !id) return;

  const rawRecord = record.raw || record;

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/api/v1/${entityCode}/${id}/${currentChildEntity}/${rawRecord.id}/link`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.ok) {
      await refetchChild();  // Refresh child list
    } else {
      alert(`Failed to unlink ${currentChildEntity}`);
    }
  } catch (error) {
    console.error('Error unlinking child record:', error);
    alert('An error occurred while unlinking.');
  }
}, [childConfig, currentChildEntity, entityCode, id, refetchChild]);

// Pass to table
<EntityListOfInstancesTable
  // ... existing props ...
  parentContext={{
    entityCode: entityCode,
    entityId: id,
    entityName: data?.name
  }}
  onDelete={handleChildDelete}
  onUnlink={handleChildUnlink}
/>
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [EntityListOfInstancesTable](./EntityListOfInstancesTable.md) | Hosts delete button, shows modal |
| [DynamicChildEntityTabs](./DynamicChildEntityTabs.md) | Provides parent context |
| [EntitySpecificInstancePage](../pages/PAGE_ARCHITECTURE.md) | Orchestrates child entity display |
| [Modal](./Modal.md) | Base modal component |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2025-12-09 | Initial design specification |

---

**Last Updated:** 2025-12-09 | **Status:** Design Spec (Implementation Pending)
