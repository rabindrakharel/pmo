# Entity Instance Link

**Version:** 4.0.0 | **Table:** `app.entity_instance_link`

---

## Semantics

The Entity Instance Link table manages all parent-child relationships between entities. It replaces traditional foreign keys with a polymorphic linkage system, enabling flexible many-to-many relationships across any entity types.

**Core Principle:** No foreign keys. All relationships via this table. Hard delete only.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTITY INSTANCE LINK                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐                              ┌──────────────┐         │
│  │   PARENT     │                              │    CHILD     │         │
│  │   d_project  │                              │   d_task     │         │
│  │   uuid-1     │                              │   uuid-2     │         │
│  └──────────────┘                              └──────────────┘         │
│         │                                             ▲                  │
│         │                                             │                  │
│         └─────────────────┬───────────────────────────┘                  │
│                           │                                              │
│                           v                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  entity_instance_link                            │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │ entity_code      │ entity_instance_id │ (parent)        │    │    │
│  │  │ 'project'        │ uuid-1             │                 │    │    │
│  │  ├──────────────────┼────────────────────┼─────────────────┤    │    │
│  │  │ child_entity_code│child_entity_inst_id│ (child)         │    │    │
│  │  │ 'task'           │ uuid-2             │                 │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    RELATIONSHIP TYPES                            │    │
│  │  • Project → Task (contains)                                     │    │
│  │  • Project → Artifact (contains)                                 │    │
│  │  • Office → Employee (contains)                                  │    │
│  │  • Role → Employee (membership)                                  │    │
│  │  • Client → Project (owns)                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
CREATE with Parent Flow
───────────────────────

Request                      Route Handler                 Database
───────                      ─────────────                 ────────

POST /api/v1/task       →    1. INSERT INTO d_task    →   d_task row
?parent_code=project         2. set_entity_instance_   →   entity_instance row
&parent_id=uuid-1               registry()
                             3. set_entity_instance_   →   entity_instance_link row
                                link({
                                  entity_code: 'project',
                                  entity_instance_id: uuid-1,
                                  child_entity_code: 'task',
                                  child_entity_instance_id: uuid-2
                                })


QUERY Children Flow
───────────────────

Request                      Route Handler                 Database
───────                      ─────────────                 ────────

GET /api/v1/project/    →    SELECT t.*               →   Returns tasks
    uuid-1/task              FROM d_task t                 linked to project
                             JOIN entity_instance_link
                             WHERE parent = project/uuid-1
                               AND child_type = 'task'


DELETE Cascade Flow
───────────────────

Request                      Service Method               Database
───────                      ──────────────               ────────

DELETE /api/v1/project  →    delete_all_entity_       →   1. Hard delete links
                                infrastructure()             (as parent)
                                                         2. Hard delete links
                                                            (as child)
                                                         3. Soft delete d_project
```

---

## Architecture Overview

### Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `entity_code` | varchar | Parent entity type |
| `entity_instance_id` | uuid | Parent entity ID |
| `child_entity_code` | varchar | Child entity type |
| `child_entity_instance_id` | uuid | Child entity ID |
| `relationship_type` | varchar | Optional: 'contains', 'owns', 'membership' |
| `created_ts` | timestamp | Link creation time |
| `updated_ts` | timestamp | Last update time |

### Column Naming Convention

| Column | Meaning |
|--------|---------|
| `entity_code` | Parent type (asymmetric - no "parent_" prefix) |
| `entity_instance_id` | Parent ID (asymmetric - no "parent_" prefix) |
| `child_entity_code` | Child type (keeps "child_" prefix for clarity) |
| `child_entity_instance_id` | Child ID (keeps "child_" prefix for clarity) |

### Service Methods

| Method | Purpose |
|--------|---------|
| `set_entity_instance_link()` | Create link (idempotent) |
| `delete_entity_instance_link()` | Remove specific link |
| `get_child_links()` | Get all children of parent |
| `get_parent_links()` | Get all parents of child |

---

## Tooling Overview

### Usage in Routes

```typescript
// On CREATE with parent - link to parent
if (parent_code && parent_id) {
  await entityInfra.set_entity_instance_link({
    entity_code: parent_code,              // Parent entity TYPE code
    entity_instance_id: parent_id,         // Parent entity UUID
    child_entity_code: ENTITY_CODE,        // Child entity TYPE code
    child_entity_instance_id: newEntity.id, // Child entity UUID
    relationship_type: 'contains'
  });
}

// Query children via factory-generated endpoint
// GET /api/v1/project/:id/task
```

### Query Patterns

```sql
-- Get all tasks under a project
SELECT t.*
FROM app.d_task t
INNER JOIN app.entity_instance_link link
  ON link.child_entity_code = 'task'
  AND link.child_entity_instance_id = t.id
WHERE link.entity_code = 'project'
  AND link.entity_instance_id = '{project-uuid}'
  AND t.active_flag = true;

-- Get all parents of a task
SELECT link.entity_code, link.entity_instance_id
FROM app.entity_instance_link link
WHERE link.child_entity_code = 'task'
  AND link.child_entity_instance_id = '{task-uuid}';
```

---

## Database/API/UI Mapping

### Common Relationships

| Parent | Child | Use Case |
|--------|-------|----------|
| `project` | `task` | Project tasks |
| `project` | `artifact` | Project documents |
| `office` | `employee` | Office staff |
| `role` | `employee` | Role membership (for RBAC) |
| `client` | `project` | Client projects |
| `business` | `office` | Business offices |

### Factory-Generated Endpoints

```
GET /api/v1/{parent}/{parentId}/{child}

Examples:
GET /api/v1/project/uuid-1/task      → Tasks under project
GET /api/v1/office/uuid-2/employee   → Employees in office
GET /api/v1/client/uuid-3/project    → Projects for client
```

### RBAC Integration

Role-based permissions use entity_instance_link:

```sql
-- Employee's roles (for permission lookup)
SELECT role.entity_instance_id AS role_id
FROM app.entity_instance_link role
WHERE role.entity_code = 'role'
  AND role.child_entity_code = 'employee'
  AND role.child_entity_instance_id = '{employee-uuid}';
```

---

## User Interaction Flow

```
Create Child Entity Flow
────────────────────────

1. User views Project detail page
   │
2. User clicks "Add Task" in Tasks tab
   │
3. Frontend navigates to:
   /task/new?parent_code=project&parent_id=uuid-1
   │
4. User fills task form and saves
   │
5. POST /api/v1/task?parent_code=project&parent_id=uuid-1
   │
6. Route Handler:
   ├── INSERT INTO d_task
   ├── set_entity_instance_registry()
   ├── set_entity_rbac_owner()
   └── set_entity_instance_link()  ← Links to parent
   │
7. Task appears in Project's Tasks tab


View Children Flow
──────────────────

1. User views Project detail page
   │
2. User clicks "Tasks" tab
   │
3. Frontend fetches:
   GET /api/v1/project/uuid-1/task
   │
4. API queries via entity_instance_link:
   SELECT t.* FROM d_task t
   JOIN entity_instance_link ON ...
   WHERE parent = project/uuid-1
   │
5. Returns only tasks linked to this project
```

---

## Critical Considerations

### Design Principles

1. **No Foreign Keys** - Linkage table replaces all FKs
2. **Hard Delete Only** - No active_flag (links removed on delete)
3. **Idempotent** - `set_entity_instance_link()` is safe to call multiple times
4. **Polymorphic** - Any entity can link to any other entity
5. **Bidirectional Query** - Can query by parent or by child

### Link Lifecycle

| Event | Action |
|-------|--------|
| Child CREATE with parent | Create link |
| Child DELETE | Remove links (as child) |
| Parent DELETE | Remove links (as parent) |
| Unlink operation | Delete specific link |

### Why No Foreign Keys

| Reason | Benefit |
|--------|---------|
| **Polymorphic** | One task can have multiple parent types |
| **Flexible** | Add relationships without schema changes |
| **No cascade locks** | Better performance on deletes |
| **Schema evolution** | Easier to add new entity types |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Add FK columns to entities | Use entity_instance_link |
| Soft delete links | Hard delete (no active_flag) |
| Query without link table | Always JOIN via link |
| Forget to link on create | Always link if parent provided |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
