# DeleteOrUnlinkModal Component

**Version:** 1.2.0 | **Location:** `apps/web/src/components/shared/modal/DeleteOrUnlinkModal.tsx` | **Status:** Backend Complete, Frontend Design Spec

---

## Overview

DeleteOrUnlinkModal is a **unified modal component** for entity removal actions. It adapts its UI based on context:

- **With `parentContext`** (child entity tab): Shows **both Unlink and Delete** options
- **Without `parentContext`** (standalone list): Shows **Delete only** with confirmation

**Core Principle:** One modal component, two behaviors based on `parentContext` prop. Replaces `window.confirm()` with a proper modal UX in all cases.

---

## Behavior by Context

| Context | Location | Delete Icon Behavior | Modal? | Available Actions |
|---------|----------|----------------------|--------|-------------------|
| **Child Entity Tab** | `/project/abc-123/task` | Opens `DeleteOrUnlinkModal` | ✓ Yes | Unlink OR Delete (radio selection) |
| **Standalone Entity List** | `/task` (main task list) | Opens `DeleteOrUnlinkModal` | ✓ Yes | Delete only (confirmation mode) |
| **Standalone Entity List** | `/project` (main project list) | Opens `DeleteOrUnlinkModal` | ✓ Yes | Delete only (confirmation mode) |

**Key Distinction:**
- **Unlink option appears ONLY when `parentContext` is provided** (child entity tabs)
- **Standalone lists** → Modal shows delete confirmation without Unlink option
- **Same modal component** handles both scenarios - no `window.confirm()` needed

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED DELETE/UNLINK MODAL ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ONE MODAL COMPONENT - TWO MODES                                            │
│  ───────────────────────────────                                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  MODE 1: Child Entity Tab (/project/abc-123/task)                   │   │
│  │                                                                      │   │
│  │  EntityListOfInstancesTable                                         │   │
│  │  parentContext={{ entityCode: 'project', entityId: 'abc' }}        │   │
│  │                                                                      │   │
│  │  [Task Row] [🗑️ Delete Icon] → DeleteOrUnlinkModal                 │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  ⚠️ Remove "Task Name"?                                     │   │   │
│  │  │                                                              │   │   │
│  │  │  ○ Unlink from project     ← Visible when parentContext     │   │   │
│  │  │  ○ Delete permanently                                       │   │   │
│  │  │                                                              │   │   │
│  │  │                       [Cancel] [Confirm]                     │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  MODE 2: Standalone List (/task)                                    │   │
│  │                                                                      │   │
│  │  EntityListOfInstancesTable                                         │   │
│  │  parentContext={undefined}                                          │   │
│  │                                                                      │   │
│  │  [Task Row] [🗑️ Delete Icon] → DeleteOrUnlinkModal                 │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  ⚠️ Delete "Task Name"?                                     │   │   │
│  │  │                                                              │   │   │
│  │  │  This action cannot be undone.                              │   │   │
│  │  │  The task will be permanently removed.                      │   │   │
│  │  │                                                              │   │   │
│  │  │                       [Cancel] [Delete]                      │   │   │
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

  /** Entity type being deleted (e.g., 'task') */
  entityCode: string;

  /** Entity display label (e.g., 'Task') */
  entityLabel: string;

  /**
   * Parent context - OPTIONAL
   * When provided: Modal shows Unlink + Delete options (radio selection)
   * When undefined: Modal shows Delete confirmation only
   */
  parentContext?: {
    entityCode: string;
    entityId: string;
    entityName?: string;
    entityLabel?: string;  // e.g., 'Project'
  };

  /**
   * Unlink action handler
   * Only called when parentContext is provided and user selects Unlink
   */
  onUnlink?: () => Promise<void>;

  /** Delete action handler - always required */
  onDelete: () => Promise<void>;

  /** Loading state during async operation */
  isProcessing?: boolean;
}
```

**Key Design Decision:** `parentContext` is optional. The modal adapts its UI:
- `parentContext` provided → Radio selection: Unlink OR Delete
- `parentContext` undefined → Simple confirmation: Delete only

---

## Modal UI Design

### Mode 1: With Parent Context (Child Entity Tab)

URL: `/project/abc-123/task` - Shows Unlink + Delete options

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

### Mode 2: Without Parent Context (Standalone List)

URL: `/task` - Shows Delete confirmation only

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Delete "Kitchen Renovation Task"?                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Are you sure you want to delete this task?                 │
│                                                             │
│  This action cannot be undone. The task will be             │
│  permanently removed from the system.                       │
│                                                             │
│                              [Cancel]  [Delete]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Visual States

**Mode 1 (With Parent Context):**

| State | Radio Option | Confirm Button |
|-------|--------------|----------------|
| Unlink selected | Blue highlight | "Unlink from Project" (blue) |
| Delete selected | Red highlight | "Delete Permanently" (red) |
| Processing | Disabled radios | Spinner + "Processing..." |

**Mode 2 (Without Parent Context):**

| State | Confirm Button |
|-------|----------------|
| Default | "Delete" (red) |
| Processing | Spinner + "Deleting..." |

---

## Integration Points

### 1. EntityListOfInstancesPage (Standalone List)

**File:** `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

**URL:** `/task`, `/project`, etc.

No `parentContext` provided - modal shows Delete confirmation only:

```typescript
<EntityListOfInstancesTable
  data={displayData}
  metadata={metadata}
  entityCode={entityCode}
  // ... existing props ...

  // No parentContext = standalone mode
  // Modal will show Delete confirmation only
  onDelete={handleDelete}
/>
```

### 2. EntitySpecificInstancePage (Child Entity Tab)

**File:** `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

**URL:** `/project/abc-123/task`

Passes `parentContext` to child entity table - modal shows Unlink + Delete options:

```typescript
// Line ~1517-1536: Child entity table rendering
<EntityListOfInstancesTable
  data={childDisplayData}
  metadata={childMetadata}
  entityCode={childEntityCode}
  // ... existing props ...

  // v14.0.0: Add parent context for unlink/delete modal
  parentContext={{
    entityCode: entityCode,        // e.g., 'project'
    entityId: id,                  // e.g., 'abc-123'
    entityName: data?.name || data?.title,
    entityLabel: entityConfig[entityCode]?.label  // e.g., 'Project'
  }}

  // Handlers
  onDelete={handleChildDelete}
  onUnlink={handleChildUnlink}    // Called when user selects Unlink
/>
```

### 3. EntityListOfInstancesTable

**File:** `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

**Unified behavior** - always opens modal, modal adapts to context:

```typescript
// State for modal
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [deleteModalRecord, setDeleteModalRecord] = useState<any>(null);

// Row action generation
const defaultActions = useMemo(() => {
  const actions: RowAction[] = [];

  // ... edit, share actions ...

  // Delete action - ALWAYS opens modal
  if (onDelete) {
    actions.push({
      key: 'delete',
      label: parentContext ? 'Remove' : 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (record) => {
        setDeleteModalRecord(record);
        setShowDeleteModal(true);
      },
      variant: 'danger'
    });
  }

  return actions;
}, [onEdit, onShare, onDelete, parentContext]);

// Render modal (in component JSX)
<DeleteOrUnlinkModal
  isOpen={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  record={deleteModalRecord}
  entityCode={entityCode}
  entityLabel={entityLabel}
  parentContext={parentContext}  // undefined for standalone, object for child tab
  onUnlink={onUnlink}            // Only called if parentContext exists
  onDelete={onDelete}
/>
```

### 4. DynamicChildEntityTabs (No Changes)

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
│  USER ACTION FLOW (UNIFIED MODAL)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User clicks 🗑️ icon on entity row                                      │
│     │                                                                        │
│     ▼                                                                        │
│  2. EntityListOfInstancesTable ALWAYS opens DeleteOrUnlinkModal             │
│     │                                                                        │
│     ▼                                                                        │
│  3. Modal checks parentContext prop                                         │
│     │                                                                        │
│     ├── parentContext exists (Child Tab: /project/abc/task) ────────┐      │
│     │                                                                │      │
│     │   4a. Modal shows: "Remove Task from Project"                 │      │
│     │       [○ Unlink from project]                                 │      │
│     │       [○ Delete permanently]                                  │      │
│     │       │                                                        │      │
│     │       ├── User selects "Unlink" + Confirm                     │      │
│     │       │   │                                                    │      │
│     │       │   ▼                                                    │      │
│     │       │   5a. Call onUnlink(record)                           │      │
│     │       │       │                                                │      │
│     │       │       ▼                                                │      │
│     │       │   6a. DELETE /api/v1/project/abc/task/001/link        │      │
│     │       │       │                                                │      │
│     │       │       ▼                                                │      │
│     │       │   7a. entity_instance_link row deleted                │      │
│     │       │       Task remains in system (visible at /task)       │      │
│     │       │                                                        │      │
│     │       └── User selects "Delete" + Confirm                     │      │
│     │           │                                                    │      │
│     │           ▼                                                    │      │
│     │       5b. Call onDelete(record)                               │      │
│     │           │                                                    │      │
│     │           ▼                                                    │      │
│     │       6b. DELETE /api/v1/task/001                             │      │
│     │           │                                                    │      │
│     │           ▼                                                    │      │
│     │       7b. Transactional delete (task gone from system)        │      │
│     │                                                                │      │
│     └── parentContext undefined (Standalone: /task) ────────────────┘      │
│         │                                                                    │
│         ▼                                                                    │
│     4b. Modal shows: "Delete Task?"                                         │
│         [This action cannot be undone]                                      │
│         │                                                                    │
│         ├── User clicks [Delete]                                            │
│         │   │                                                                │
│         │   ▼                                                                │
│         │   5c. Call onDelete(record)                                       │
│         │       │                                                            │
│         │       ▼                                                            │
│         │   6c. DELETE /api/v1/task/001                                     │
│         │       │                                                            │
│         │       ▼                                                            │
│         │   7c. Transactional delete (task gone from system)                │
│         │                                                                    │
│         └── User clicks [Cancel] → Modal closes, no action                  │
│                                                                              │
│  8. Cache invalidation: invalidateEntityQueries(entity)                     │
│     │                                                                        │
│     ▼                                                                        │
│  9. TanStack Query refetch → UI updates                                     │
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
| [universal-entity-crud-factory.ts:1420](../../apps/api/src/lib/universal-entity-crud-factory.ts#L1420) | Add NEW unlink endpoint `DELETE /:parent/:parentId/:child/:childId/link` | HIGH | ✅ **Complete** |
| [entity-infrastructure.service.ts:817](../../apps/api/src/services/entity-infrastructure.service.ts#L817) | Add `delete_entity_instance_link_by_context()` method (find + delete) | MEDIUM | ✅ **Complete** |
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
| v1.1.0 | 2025-12-09 | Backend implementation complete - unlink endpoint and service method |
| v1.2.0 | 2025-12-09 | **Unified modal design** - Same component for both standalone delete and child entity unlink/delete. Modal adapts based on `parentContext` prop. Replaces `window.confirm()` with proper modal UX. |
| v1.3.0 | 2025-12-09 | **Stepper Progress Indicator** - Added visual step-by-step progress feedback during processing. Shows "Processing the request → Deleting/Unlinking → Completed" with animated status icons. |
| v1.4.0 | 2025-12-09 | **Styling Patterns Alignment** - Updated to adhere to `docs/design_pattern/styling_patterns.md` v13.1. Modal uses `bg-dark-100`, `border-dark-300`, `rounded-xl`. Buttons use `px-3 py-2 rounded-md` (minimalistic). Text uses `text-dark-700` (primary), `text-dark-600` (secondary). Unlink uses slate accent (`bg-slate-600`), Delete uses danger (`bg-red-600`). |

---

## Stepper Progress Indicator (v1.3.0)

The modal features a **stepper progress indicator** that provides visual feedback during delete/unlink operations. This pattern is used by industry leaders like Stripe, Vercel, and GitHub to reduce perceived wait time and maintain user trust.

### Visual States

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Delete "Kitchen Task"?                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✓ Processing the request                           │   │
│  │  ● Deleting...                                      │   │
│  │  ○ Completed                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                              [Cancel]  [Processing...]      │
└─────────────────────────────────────────────────────────────┘
```

### Step Status Icons

| Status | Icon | Background | Description |
|--------|------|------------|-------------|
| Pending | `○` Empty circle | Gray | Step not yet started |
| Processing | `🔄` Spinning loader | Blue | Currently executing |
| Completed | `✓` Green checkmark | Green | Step finished successfully |
| Error | `✗` Red X | Red | Step failed |

### Step Sequence

**Delete Operation:**
```
1. ● Processing the request...  (500ms simulated)
2. ● Deleting...                (actual API call)
3. ● Completed                  (400ms pause before close)
```

**Unlink Operation:**
```
1. ● Processing the request...  (500ms simulated)
2. ● Unlinking...               (actual API call)
3. ● Completed                  (400ms pause before close)
```

### Implementation Details

```typescript
// Step definitions
const getDeleteSteps = (): Step[] => [
  { id: 'processing', label: 'Processing the request', status: 'pending' },
  { id: 'delete', label: 'Deleting', status: 'pending' },
  { id: 'completed', label: 'Completed', status: 'pending' },
];

const getUnlinkSteps = (): Step[] => [
  { id: 'processing', label: 'Processing the request', status: 'pending' },
  { id: 'unlink', label: 'Unlinking', status: 'pending' },
  { id: 'completed', label: 'Completed', status: 'pending' },
];

// Timing configuration
const STEP_DELAYS = {
  processing: 500,  // Simulated delay for visual feedback
  unlink: 0,        // Actual API call happens here
  delete: 0,        // Actual API call happens here
  completed: 400,   // Pause to show completion before closing
};
```

### Error Handling

When an API call fails:
1. The current step shows a red X icon with red background
2. Error message displays below the stepper
3. Buttons re-enable so user can retry or cancel
4. Modal remains open for user action

```
┌─────────────────────────────────────────────────────────────┐
│  ✓ Processing the request                                   │
│  ✗ Deleting                                                 │
│  ○ Completed                                                │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Permission denied: DELETE access required               │
└─────────────────────────────────────────────────────────────┘
```

### UX Benefits

1. **Reduced perceived wait time** - Users see progress, not just a spinner
2. **Transparency** - Users understand what's happening behind the scenes
3. **Trust** - Clear feedback builds confidence in the system
4. **Error context** - Users know exactly which step failed

---

## Styling Patterns Alignment (v1.4.0)

The modal adheres to `docs/design_pattern/styling_patterns.md` v13.1 for consistent styling across the platform.

### Modal Container

```jsx
// Modal structure per styling_patterns.md section 3.7
<div className="bg-dark-100 rounded-xl shadow-2xl w-full max-w-md border border-dark-300">
  {/* Header */}
  <div className="flex items-center justify-between px-6 py-4 border-b border-dark-300">
    <h2 className="text-lg font-semibold text-dark-700">Modal Title</h2>
    <button className="p-1.5 hover:bg-dark-200 rounded-md">
      <X className="h-5 w-5 text-dark-500" />
    </button>
  </div>

  {/* Content */}
  <div className="px-6 py-4 space-y-4">
    {/* Modal content */}
  </div>

  {/* Footer */}
  <div className="px-6 py-4 border-t border-dark-300 bg-dark-50 rounded-b-xl flex justify-end gap-2">
    {/* Buttons */}
  </div>
</div>
```

### Button Styles

| Button Type | Classes | Usage |
|-------------|---------|-------|
| Cancel (Secondary) | `px-3 py-2 text-sm font-medium text-dark-600 bg-white border border-dark-300 rounded-md hover:border-dark-400` | Cancel/dismiss actions |
| Unlink (Primary) | `px-3 py-2 text-sm font-medium text-white bg-slate-600 rounded-md hover:bg-slate-700 shadow-sm` | Non-destructive primary action |
| Delete (Danger) | `px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 shadow-sm` | Destructive action |

### Text Colors

| Purpose | Class | Example |
|---------|-------|---------|
| Primary text | `text-dark-700` | Modal title, entity name |
| Secondary text | `text-dark-600` | Body text, descriptions |
| Muted text | `text-dark-500` | Helper text, disclaimers |

### Radio Option Cards

```jsx
// Unlink option - uses slate accent
<label className={`
  block p-4 rounded-md border-2 cursor-pointer transition-all
  ${selected ? 'border-slate-500 bg-slate-50' : 'border-dark-300 hover:border-dark-400 bg-white'}
`}>
  <Link2Off className="h-4 w-4 text-slate-600" />
</label>

// Delete option - uses red for danger
<label className={`
  block p-4 rounded-md border-2 cursor-pointer transition-all
  ${selected ? 'border-red-500 bg-red-50' : 'border-dark-300 hover:border-dark-400 bg-white'}
`}>
  <Trash2 className="h-4 w-4 text-red-600" />
</label>
```

### Focus States

```jsx
// Close button focus
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/30"

// Radio input focus
className="text-slate-600 focus:ring-slate-500"
```

### Key Styling Rules

1. **Minimalistic buttons**: `px-3 py-2` padding (not `px-4 py-2`)
2. **Border radius**: `rounded-md` for buttons, `rounded-xl` for modal container
3. **Borders**: `border-dark-300` throughout
4. **Background**: `bg-dark-100` for modal, `bg-dark-50` for footer
5. **Shadows**: `shadow-sm` for primary buttons, `shadow-2xl` for modal
6. **No blue accents**: Uses slate for primary actions, red for danger

---

## Bug Fix: Unlink Operation Returning 404 (v1.1.0)

### Issue
The unlink endpoint was returning `404 Link not found` even when the link existed in the database and was successfully deleted.

### Root Cause
The `delete_entity_instance_link_by_context()` method in `entity-infrastructure.service.ts` was using `(result as any).rowCount` to get the number of deleted rows. However, `postgres-js` (the PostgreSQL driver used by Drizzle ORM) does not set `rowCount` on the result array for DELETE operations.

**What was happening:**
1. The DELETE SQL was executing successfully (rows were being deleted from the database)
2. But `result.rowCount` returned `undefined`
3. The code `(result as any).rowCount || 0` evaluated to `0`
4. The API returned 404 "Link not found" even though the link was successfully deleted

### Fix
Changed the DELETE query to use `RETURNING id` clause, which makes `postgres-js` return an array of deleted rows. Then used `result.length` instead of `rowCount` to get the deletion count.

**Before:**
```typescript
const result = await this.db.execute(sql`
  DELETE FROM app.entity_instance_link
  WHERE entity_code = ${parent_entity_code}
    AND entity_instance_id = ${parent_entity_id}
    AND child_entity_code = ${child_entity_code}
    AND child_entity_instance_id = ${child_entity_id}
`);
return (result as any).rowCount || 0; // Always returns 0!
```

**After:**
```typescript
const result = await this.db.execute(sql`
  DELETE FROM app.entity_instance_link
  WHERE entity_code = ${parent_entity_code}
    AND entity_instance_id = ${parent_entity_id}::uuid
    AND child_entity_code = ${child_entity_code}
    AND child_entity_instance_id = ${child_entity_id}::uuid
  RETURNING id
`);
return result.length; // Returns actual count of deleted rows
```

### Files Modified
- `apps/api/src/services/entity-infrastructure.service.ts:817` - Fixed `delete_entity_instance_link_by_context` method

---

**Last Updated:** 2025-12-09 | **Status:** Complete (Backend + Frontend with Stepper UI)
