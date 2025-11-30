# RBAC Infrastructure

**Version:** 5.0.0 | **Location:** `apps/api/src/services/entity-infrastructure.service.ts`

---

## Overview

The PMO platform uses a **person-based RBAC system** with 4 infrastructure tables managed by the Entity Infrastructure Service. All relationships use linkage tables instead of foreign keys.

**Core Principle:** No foreign keys. Hard delete for infrastructure tables. Permissions inherit hierarchically.

---

## System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RBAC INFRASTRUCTURE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    4 INFRASTRUCTURE TABLES                             │  │
│  ├───────────────┬─────────────────┬─────────────────┬───────────────────┤  │
│  │    entity     │ entity_instance │ entity_instance │   entity_rbac     │  │
│  │   (types)     │   (registry)    │     _link       │  (permissions)    │  │
│  │               │                 │ (relationships) │                   │  │
│  └───────────────┴─────────────────┴─────────────────┴───────────────────┘  │
│                                                                              │
│  Permission Resolution Order:                                                │
│  1. Direct employee permissions (entity_rbac.person_code = 'employee')       │
│  2. Role-based permissions (employee → role → entity_rbac)                   │
│  3. Parent-VIEW inheritance (parent VIEW → child VIEW)                       │
│  4. Parent-CREATE inheritance (parent CREATE → child CREATE)                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Permission Levels

```typescript
enum Permission {
  VIEW       = 0,  // Read access to entity data
  COMMENT    = 1,  // Add comments on entities
  CONTRIBUTE = 2,  // Insert data in forms, collaborate on wiki
  EDIT       = 3,  // Modify entity fields, descriptions, details
  SHARE      = 4,  // Share entity with others
  DELETE     = 5,  // Soft delete entity
  CREATE     = 6,  // Create new entities (type-level only)
  OWNER      = 7   // Full control including permission management
}
```

**Inheritance Rule:** Higher permission level implies all lower levels.
- `OWNER (7)` can do everything
- `EDIT (3)` implies `CONTRIBUTE (2)`, `COMMENT (1)`, `VIEW (0)`
- `CREATE (6)` is type-level only (uses `ALL_ENTITIES_ID`)

**Special Constant:**
```typescript
ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111'  // Type-level permissions
```

---

## 2. Infrastructure Tables

### 2.1 entity (Type Metadata)

**Purpose:** Stores entity type definitions with UI metadata and child relationships.

| Column | Type | Description |
|--------|------|-------------|
| `code` | varchar | Primary key - entity type code (e.g., 'project', 'task') |
| `name` | varchar | Display name |
| `ui_label` | varchar | UI label for navigation |
| `ui_icon` | varchar | Lucide icon name |
| `child_entity_codes` | jsonb | Array of child entity codes |
| `display_order` | int | Navigation order |
| `active_flag` | boolean | Soft delete flag |

**Example:**
```json
{
  "code": "project",
  "name": "Project",
  "ui_label": "Projects",
  "ui_icon": "folder",
  "child_entity_codes": ["task", "artifact", "wiki"]
}
```

### 2.2 entity_instance (Registry)

**Purpose:** Global registry of all entity instances for lookups and reference resolution.

| Column | Type | Description |
|--------|------|-------------|
| `entity_code` | varchar | Entity type code |
| `entity_instance_id` | uuid | Entity instance UUID |
| `entity_instance_name` | varchar | Display name (cached for lookups) |
| `code` | varchar | Record code (e.g., 'PROJ-001') |
| `order_id` | serial | Auto-increment order |

**Key Points:**
- **Hard delete only** - No `active_flag` column
- Synced automatically when entity name/code changes
- Used by `build_ref_data_entityInstance()` for UUID → name lookups

### 2.3 entity_instance_link (Relationships)

**Purpose:** Polymorphic parent-child relationships. Replaces all foreign keys.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `entity_code` | varchar | **Parent** entity type |
| `entity_instance_id` | uuid | **Parent** entity ID |
| `child_entity_code` | varchar | Child entity type |
| `child_entity_instance_id` | uuid | Child entity ID |
| `relationship_type` | varchar | 'contains', 'owns', 'membership' |

**Column Naming Convention:**
- Parent columns: No prefix (`entity_code`, `entity_instance_id`)
- Child columns: With prefix (`child_entity_code`, `child_entity_instance_id`)

**Key Points:**
- **Hard delete only** - No `active_flag` column
- **Idempotent** - `set_entity_instance_link()` is safe to call multiple times
- Bidirectional query support (find parents or children)

**Common Relationships:**
| Parent | Child | Use Case |
|--------|-------|----------|
| project | task | Project tasks |
| project | artifact | Project documents |
| office | employee | Office staff |
| role | employee | Role membership (for RBAC) |
| business | project | Business projects |

### 2.4 entity_rbac (Permissions)

**Purpose:** Person-based permission grants on entities.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `person_code` | varchar | 'employee' or 'role' |
| `person_id` | uuid | Employee or Role UUID |
| `entity_code` | varchar | Entity type |
| `entity_instance_id` | uuid | Entity ID or `ALL_ENTITIES_ID` |
| `permission` | int | Permission level (0-7) |
| `expires_ts` | timestamp | Optional expiration |

**Key Points:**
- **Hard delete only** - No `active_flag` column
- Revoking permissions = DELETE record
- Expired permissions can be cleaned up with scheduled job

**Permission Grant Types:**
```sql
-- Type-level: Can VIEW all projects
INSERT INTO entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('employee', 'user-uuid', 'project', '11111111-1111-1111-1111-111111111111', 0);

-- Instance-level: OWNER of specific project
INSERT INTO entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('employee', 'user-uuid', 'project', 'project-uuid', 7);

-- Role-based: All members of role get EDIT on all tasks
INSERT INTO entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('role', 'role-uuid', 'task', '11111111-1111-1111-1111-111111111111', 3);
```

---

## 3. Service Methods

### Permission Checking

```typescript
const entityInfra = getEntityInfrastructure(db);

// Check single permission
const canEdit = await entityInfra.check_entity_rbac(
  userId, 'project', projectId, Permission.EDIT
);

// Get SQL WHERE for LIST queries
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  userId, 'project', Permission.VIEW, 'e'
);
// Returns: TRUE | FALSE | e.id IN ('uuid1', 'uuid2')
```

### Registry Operations

```typescript
// Register new entity
await entityInfra.set_entity_instance_registry({
  entity_code: 'project',
  entity_id: projectId,
  entity_name: 'Kitchen Renovation',
  instance_code: 'PROJ-001'
});

// Update when name/code changes
await entityInfra.update_entity_instance_registry('project', projectId, {
  entity_name: 'New Name',
  instance_code: 'PROJ-002'
});

// Delete (hard delete)
await entityInfra.delete_entity_instance_registry('project', projectId);
```

### Linkage Operations

```typescript
// Create parent-child link
await entityInfra.set_entity_instance_link({
  parent_entity_code: 'project',
  parent_entity_id: projectId,
  child_entity_code: 'task',
  child_entity_id: taskId,
  relationship_type: 'contains'
});

// Get child IDs
const taskIds = await entityInfra.get_entity_instance_link_children(
  'project', projectId, 'task'
);

// Delete link (hard delete)
await entityInfra.delete_entity_instance_link(linkageId);
```

### Permission Grants

```typescript
// Grant OWNER to creator
await entityInfra.set_entity_rbac_owner(userId, 'project', projectId);

// Grant specific permission
await entityInfra.set_entity_rbac(userId, 'project', projectId, Permission.EDIT);

// Revoke all permissions
await entityInfra.delete_entity_rbac(userId, 'project', projectId);
```

---

## 4. Transactional Methods

For atomic operations, use transactional methods that wrap multiple operations in a single transaction:

### create_entity()

```typescript
const result = await entityInfra.create_entity({
  entity_code: 'project',
  creator_id: userId,
  parent_entity_code: 'business',    // Optional
  parent_entity_id: businessId,      // Optional
  primary_table: 'app.project',
  primary_data: { name, code, descr, budget_allocated_amt }
});
// Returns: { entity, entity_instance, rbac_granted, link_created, link? }
```

**Operations in ONE transaction:**
1. INSERT into primary table
2. Register in entity_instance
3. Grant OWNER permission
4. Link to parent (if provided)

### update_entity()

```typescript
const result = await entityInfra.update_entity({
  entity_code: 'project',
  entity_id: projectId,
  primary_table: 'app.project',
  primary_updates: { name: 'New Name', budget_allocated_amt: 50000 }
});
// Returns: { entity, registry_synced }
```

### delete_entity()

```typescript
const result = await entityInfra.delete_entity({
  entity_code: 'project',
  entity_id: projectId,
  user_id: userId,
  primary_table: 'app.project',
  hard_delete: false  // soft delete for PRIMARY TABLE only (active_flag = false)
});
// Returns: { success, entity_deleted, registry_deleted, linkages_deleted, rbac_entries_deleted }

// NOTE: entity_instance, entity_instance_link, entity_rbac are ALWAYS hard-deleted
// The hard_delete parameter ONLY affects the primary table behavior
```

---

## 5. Route Patterns

### CREATE Pattern (6 Steps)

```typescript
fastify.post('/api/v1/project', async (request, reply) => {
  const { parent_entity_code, parent_entity_instance_id } = request.query;
  const data = request.body;
  const userId = request.user.sub;

  // Step 1: RBAC - Can user CREATE this entity type?
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) return reply.status(403).send({ error: 'Forbidden' });

  // Step 2: RBAC - If linking to parent, can user EDIT parent?
  if (parent_entity_code && parent_entity_instance_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT
    );
    if (!canEditParent) return reply.status(403).send({ error: 'Forbidden' });
  }

  // Step 3: INSERT into primary table
  const result = await db.execute(sql`INSERT INTO app.project ...`);
  const project = result[0];

  // Step 4: Register in entity_instance
  await entityInfra.set_entity_instance_registry({
    entity_code: ENTITY_CODE,
    entity_id: project.id,
    entity_name: project.name,
    instance_code: project.code
  });

  // Step 5: Grant OWNER permission
  await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, project.id);

  // Step 6: Link to parent (if provided)
  if (parent_entity_code && parent_entity_instance_id) {
    await entityInfra.set_entity_instance_link({
      parent_entity_code: parent_entity_code,
      parent_entity_id: parent_entity_instance_id,  // API param → service param
      child_entity_code: ENTITY_CODE,
      child_entity_id: project.id
    });
  }

  return reply.status(201).send(project);
});
```

### LIST Pattern with RBAC

```typescript
fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;

  // Get RBAC WHERE condition
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, 'e'
  );

  // Route owns the query structure
  const projects = await db.execute(sql`
    SELECT e.*, b.name as business_name
    FROM app.project e
    LEFT JOIN app.business b ON e.business_id = b.id
    WHERE ${rbacCondition}
      AND e.active_flag = true
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return reply.send({ data: projects });
});
```

---

## 6. Query Patterns

### Get Children via Link Table

```sql
-- Get all tasks under a project
SELECT t.*
FROM app.task t
INNER JOIN app.entity_instance_link link
  ON link.child_entity_code = 'task'
  AND link.child_entity_instance_id = t.id
WHERE link.entity_code = 'project'
  AND link.entity_instance_id = '{project-uuid}'
  AND t.active_flag = true;
```

### Get Parents via Link Table

```sql
-- Get all parents of a task
SELECT link.entity_code, link.entity_instance_id
FROM app.entity_instance_link link
WHERE link.child_entity_code = 'task'
  AND link.child_entity_instance_id = '{task-uuid}';
```

### Role-Based Permission Check

```sql
-- Get employee's roles for permission lookup
SELECT link.entity_instance_id AS role_id
FROM app.entity_instance_link link
WHERE link.entity_code = 'role'
  AND link.child_entity_code = 'employee'
  AND link.child_entity_instance_id = '{employee-uuid}';
```

---

## 7. Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No Foreign Keys** | All relationships via entity_instance_link |
| **Hard Delete (Infra)** | `entity_instance`, `entity_instance_link`, `entity_rbac` use **hard delete** (no active_flag) |
| **Soft Delete (Type)** | `entity` (type metadata) uses active_flag |
| **Soft Delete (Primary)** | Primary entity tables (project, task, etc.) use active_flag |
| **Idempotent** | Link operations safe to call multiple times |
| **Permission Inheritance** | Higher level implies all lower levels |
| **Type-Level Permissions** | ALL_ENTITIES_ID grants access to all instances |
| **Role-Based Access** | Permissions granted to roles, inherited by members |

---

**Last Updated:** 2025-11-22 | **Status:** Production Ready
