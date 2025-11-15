# Person-Based RBAC System - Complete Documentation

> **Version**: 5.0 (Simplified 2-Gate Pattern)
> **Last Updated**: 2025-11-14
> **Status**: Production-Ready

## Quick Reference

```typescript
// ========================================
// GATE 1: Data Gate (for DataTables/Lists)
// ========================================
const accessibleIds = await data_gate_EntityIdsByEntityType(
  userId,
  'project',
  PermissionLevel.VIEW
);
// Use IDs in SQL WHERE clause to filter results

// ========================================
// GATE 2: API Gates (for Update/Delete)
// ========================================
await api_gate_Update(userId, 'project', projectId);  // throws 403 if denied
await api_gate_Delete(userId, 'project', projectId);  // throws 403 if denied
```

## Table of Contents

1. [Overview](#overview)
2. [Architecture: 2-Gate Pattern](#architecture-2-gate-pattern)
3. [Request Flow Diagrams](#request-flow-diagrams)
4. [Core Concepts](#core-concepts)
5. [Database Schema](#database-schema)
6. [API Integration Patterns](#api-integration-patterns)
7. [Use Cases & Examples](#use-cases--examples)
8. [Security Best Practices](#security-best-practices)

---

## Overview

The Person-Based RBAC system provides fine-grained access control using a **simplified 2-gate pattern**:

### Key Features

- ✅ **2-Gate Pattern**:
  - `data_gate_*` for DataTables/lists (returns entity IDs for SQL WHERE filtering)
  - `api_gate_*` for Update/Delete operations (throws 403 if denied)
- ✅ **Integer Permission Model**: Single integer (0-5) with hierarchical inheritance
- ✅ **Dual Permission Sources**: Role-based + Direct employee permissions
- ✅ **Type-Level & Instance-Level**: Grant access to all entities or specific instances
- ✅ **Zero Database Foreign Keys**: Permissions stored independently
- ✅ **TypeScript Service**: Centralized RBAC logic in `apps/api/src/lib/rbac.service.ts`

### Implementation Scope

**ONLY these two gate types are implemented:**

1. **Data Gates** (`data_gate_EntityIdsByEntityType`) - Used for:
   - EntityDataTable components
   - All list/table views
   - Returns entity IDs for SQL-level filtering

2. **API Gates** (`api_gate_Update` and `api_gate_Delete`) - Used for:
   - Update operations (PATCH/PUT endpoints)
   - Delete operations (DELETE endpoints)
   - Throws 403 error if permission denied

**What's NOT using gates:**
- ❌ Individual GET operations (e.g., GET /api/v1/project/:id) - no gate
- ❌ CREATE operations (POST endpoints) - inline permission check only
- ❌ UI-level button visibility - handled separately in frontend

**Why only 2 gates?**
- Data gates handle the most complex case: filtering lists at SQL level
- API gates prevent unauthorized updates/deletes
- Other operations use simpler inline permission checks
- Keeps implementation minimal and maintainable

---

## Architecture: 2-Gate Pattern

### The Two Gates

```
┌──────────────────────────────────────────────────────────────────┐
│                    RBAC SERVICE (2 Gates)                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. data_gate_EntityIdsByEntityType(userId, entityName, level)  │
│     → Returns: string[] of accessible entity IDs                │
│     → Used for: DataTable components and list views             │
│     → Implementation: Use returned IDs in SQL WHERE clause      │
│                      to gate at database level                  │
│                                                                  │
│  2. api_gate_Update/Delete(userId, entityName, entityId)        │
│     → Returns: void (throws 403 if denied)                      │
│     → Used for: UPDATE and DELETE operations only               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Gate Usage Rules

| Operation | HTTP Method | Gate Used | Purpose |
|-----------|-------------|-----------|---------|
| **List entities (tables)** | GET /api/v1/project | `data_gate_*` | Filter results by accessible IDs |
| **Update entity** | PUT/PATCH /api/v1/project/:id | `api_gate_Update` | Verify edit permission |
| **Delete entity** | DELETE /api/v1/project/:id | `api_gate_Delete` | Verify delete permission |

---

## Request Flow Diagrams

### Flow 1: List Projects (Data Gate - for DataTables/Lists)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND: EntityDataTable Component                                        │
│ User clicks: "Projects" tab                                                │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Frontend makes request                                             │
│ ────────────────────────────────────────────────────────────────────────────│
│ GET /api/v1/project?limit=20&offset=0                                      │
│ Headers:                                                                    │
│   Authorization: Bearer eyJhbGc...  (JWT token)                            │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: API Server - Authentication Middleware                             │
│ ────────────────────────────────────────────────────────────────────────────│
│ Location: Fastify preHandler                                               │
│ Action:                                                                     │
│   - Verify JWT token                                                       │
│   - Extract userId from token.sub                                          │
│   - userId = "8260b1b0-5efc-4611-ad33-ee76c0cf7f13" (James Miller)        │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Route Handler - Get Accessible IDs                                 │
│ ────────────────────────────────────────────────────────────────────────────│
│ Location: apps/api/src/lib/universal-crud-factory.ts (createListRoute)     │
│ Code:                                                                       │
│   const accessibleIds = await data_gate_EntityIdsByEntityType(             │
│     userId,           // "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"           │
│     'project',        // entity type                                       │
│     PermissionLevel.VIEW  // 0 (view permission)                           │
│   );                                                                        │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: data_gate_EntityIdsByEntityType - Permission Resolution            │
│ ────────────────────────────────────────────────────────────────────────────│
│ Location: apps/api/src/lib/rbac.service.ts                                 │
│                                                                             │
│ Sub-step 4a: Check type-level access                                       │
│   const typeLevel = await getMaxPermissionLevel(                           │
│     userId, 'project', '11111111-1111-1111-1111-111111111111'             │
│   );                                                                        │
│   → SQL Query:                                                              │
│     SELECT COALESCE(MAX(permission), -1) as max_permission                 │
│     FROM (                                                                  │
│       -- Direct employee permissions                                        │
│       SELECT permission FROM entity_id_rbac_map                             │
│       WHERE person_entity_name = 'employee'                                 │
│         AND person_entity_id = '{userId}'                                  │
│         AND entity_name = 'project'                                         │
│         AND entity_id = '11111111-1111-1111-1111-111111111111'             │
│         AND active_flag = true                                              │
│       UNION ALL                                                             │
│       -- Role-based permissions (via d_entity_id_map)                       │
│       SELECT rbac.permission FROM entity_id_rbac_map rbac                   │
│       INNER JOIN d_entity_id_map eim                                        │
│         ON eim.parent_entity_type = 'role'                                  │
│         AND eim.parent_entity_id::uuid = rbac.person_entity_id             │
│         AND eim.child_entity_id = '{userId}'                               │
│       WHERE rbac.person_entity_name = 'role'                                │
│         AND rbac.entity_name = 'project'                                    │
│         AND rbac.entity_id = '11111111-1111-1111-1111-111111111111'        │
│         AND rbac.active_flag = true                                         │
│     ) AS combined;                                                          │
│   → Result: typeLevel = 5 (Owner from CEO role)                            │
│                                                                             │
│ Sub-step 4b: Type-level check                                              │
│   if (typeLevel >= 0) {                                                    │
│     return ['11111111-1111-1111-1111-111111111111'];  // Special marker    │
│   }                                                                         │
│   → Returns: ['11111111-1111-1111-1111-111111111111']                      │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Route Handler - Build Query with ID Filter                         │
│ ────────────────────────────────────────────────────────────────────────────│
│ Location: apps/api/src/lib/universal-crud-factory.ts                       │
│ Code:                                                                       │
│   const hasTypeAccess = accessibleIds.includes(                            │
│     '11111111-1111-1111-1111-111111111111'                                 │
│   );  // true                                                               │
│                                                                             │
│   const idFilter = hasTypeAccess                                           │
│     ? sql`TRUE`  // No ID filtering - user can see ALL                     │
│     : sql`e.id::text = ANY(${accessibleIds})`;  // Filter by specific IDs  │
│                                                                             │
│   const result = await db.execute(sql`                                     │
│     SELECT e.*                                                              │
│     FROM app.d_project e                                                    │
│     WHERE e.active_flag = true                                              │
│       AND ${idFilter}    -- TRUE (no filtering)                            │
│     ORDER BY e.created_ts DESC                                              │
│     LIMIT ${limit} OFFSET ${offset}                                         │
│   `);                                                                       │
│   → Returns ALL active projects                                            │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Response to Frontend                                               │
│ ────────────────────────────────────────────────────────────────────────────│
│ HTTP 200 OK                                                                 │
│ {                                                                           │
│   "data": [                                                                 │
│     { "id": "proj-1", "name": "Kitchen Renovation", ... },                 │
│     { "id": "proj-2", "name": "HVAC Installation", ... },                  │
│     ...                                                                     │
│   ],                                                                        │
│   "total": 47,                                                              │
│   "limit": 20,                                                              │
│   "offset": 0                                                               │
│ }                                                                           │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND: EntityDataTable renders the data                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Takeaway**: For DataTable/list operations, `data_gate_*` returns accessible IDs, which are used in SQL WHERE clauses to filter results at the database level.

---

### Flow 2: Update Project (API Gate - for Update Operations)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND: User edits project name and clicks "Save"                        │
│ Request: PUT /api/v1/project/abc-123-def                                   │
│ Body: { "name": "Updated Name" }                                           │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Frontend makes request                                             │
│ PUT /api/v1/project/abc-123-def                                            │
│ Headers: Authorization: Bearer eyJhbGc...                                  │
│ Body: { "name": "Updated Name" }                                           │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Authentication (extract userId from JWT)                           │
│ userId = "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"                            │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Route Handler - Check Permission via api_gate                      │
│ ────────────────────────────────────────────────────────────────────────────│
│ Location: apps/api/src/lib/universal-crud-factory.ts (createUpdateRoute)   │
│ Code:                                                                       │
│   try {                                                                     │
│     await api_gate_Update(userId, 'project', 'abc-123-def');              │
│   } catch (err: any) {                                                     │
│     return reply.status(err.statusCode || 403).send({                      │
│       error: err.error || 'Forbidden',                                     │
│       message: err.message                                                 │
│     });                                                                     │
│   }                                                                         │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: api_gate_Update - Permission Check                                 │
│ ────────────────────────────────────────────────────────────────────────────│
│ Location: apps/api/src/lib/rbac.service.ts                                 │
│ Code:                                                                       │
│   const maxLevel = await getMaxPermissionLevel(                            │
│     userId, 'project', 'abc-123-def'                                       │
│   );                                                                        │
│   → SQL Query (UNION of employee + role permissions):                      │
│     Result: maxLevel = 5 (Owner)                                           │
│                                                                             │
│   if (maxLevel < PermissionLevel.EDIT) {  // 5 < 1? false                 │
│     throw { statusCode: 403, error: 'Forbidden', message: '...' };         │
│   }                                                                         │
│   // PASS - user has edit permission (level 5 >= 1)                        │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Execute UPDATE query                                               │
│ ────────────────────────────────────────────────────────────────────────────│
│   const result = await db.execute(sql`                                     │
│     UPDATE app.d_project                                                    │
│     SET name = 'Updated Name',                                              │
│         updated_ts = NOW(),                                                 │
│         version = version + 1                                               │
│     WHERE id::text = 'abc-123-def'                                          │
│       AND active_flag = true                                                │
│     RETURNING *                                                             │
│   `);                                                                       │
│   → Returns updated project                                                │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Response                                                            │
│ HTTP 200 OK                                                                 │
│ { "id": "abc-123-def", "name": "Updated Name", "version": 2, ... }         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Takeaway**: For UPDATE operations, use `api_gate_Update` which throws 403 if permission denied.

---

### Flow 3: Delete Project (API Gate - for Delete Operations)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND: User clicks "Delete" button                                      │
│ Request: DELETE /api/v1/project/abc-123-def                                │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1-2: Same as UPDATE (authentication)                                  │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Route Handler - Check Permission via api_gate                      │
│ ────────────────────────────────────────────────────────────────────────────│
│ Location: apps/api/src/lib/universal-crud-factory.ts (createDeleteRoute)   │
│ Code:                                                                       │
│   try {                                                                     │
│     await api_gate_Delete(userId, 'project', 'abc-123-def');              │
│   } catch (err: any) {                                                     │
│     return reply.status(err.statusCode || 403).send({ error: '...' });    │
│   }                                                                         │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: api_gate_Delete - Permission Check                                 │
│ ────────────────────────────────────────────────────────────────────────────│
│   const maxLevel = await getMaxPermissionLevel(...);                       │
│   // maxLevel = 5                                                           │
│                                                                             │
│   if (maxLevel < PermissionLevel.DELETE) {  // 5 < 3? false               │
│     throw { statusCode: 403, ... };                                         │
│   }                                                                         │
│   // PASS - user has delete permission (level 5 >= 3)                      │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Execute Soft DELETE (update active_flag)                           │
│ ────────────────────────────────────────────────────────────────────────────│
│   await db.execute(sql`                                                    │
│     UPDATE app.d_project                                                    │
│     SET active_flag = false, to_ts = NOW(), updated_ts = NOW()             │
│     WHERE id::text = 'abc-123-def'                                          │
│   `);                                                                       │
│   // Also soft delete from entity_instance_id and entity_id_map            │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Response                                                            │
│ HTTP 204 No Content                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Takeaway**: For DELETE operations, use `api_gate_Delete` which requires permission level >= 3.

---

## Core Concepts

### 1. Integer Permission Model

Permissions are stored as a **single integer** (0-5) with hierarchical levels:

```sql
permission = 0 | 1 | 2 | 3 | 4 | 5  (single integer value)

0 = View    → Read access to entity data
1 = Edit    → Modify existing entity (INHERITS View)
2 = Share   → Share entity with others (INHERITS Edit + View)
3 = Delete  → Soft delete entity (INHERITS Share + Edit + View)
4 = Create  → Create new entities (INHERITS Delete + Share + Edit + View)
5 = Owner   → Full control including permission management (INHERITS ALL)
```

**Permission Hierarchy**:
```
Owner [5] ≥ Create [4] ≥ Delete [3] ≥ Share [2] ≥ Edit [1] ≥ View [0]
```

**Permission Checks** (using >= comparison):
```sql
-- Check View permission
WHERE permission >= 0

-- Check Edit permission
WHERE permission >= 1

-- Check Delete permission
WHERE permission >= 3

-- Check Create permission (type-level)
WHERE permission >= 4 AND entity_id = '11111111-1111-1111-1111-111111111111'
```

### 2. Person-Based Permissions

Permissions can be granted to TWO types of "persons":

#### A. **Role-Based Permissions** (person_entity_name = 'role')

```sql
-- Grant permission to a role
INSERT INTO entity_id_rbac_map (
  person_entity_name, person_entity_id, entity_name, entity_id, permission
) VALUES (
  'role', '{manager_role_uuid}', 'project', '11111111-1111-1111-1111-111111111111', 4
);

-- Assign employee to role
INSERT INTO d_entity_id_map (
  parent_entity_type, parent_entity_id, child_entity_type, child_entity_id
) VALUES (
  'role', '{manager_role_uuid}', 'employee', '{employee_uuid}'
);
```

#### B. **Direct Employee Permissions** (person_entity_name = 'employee')

```sql
-- Grant permission directly to employee
INSERT INTO entity_id_rbac_map (
  person_entity_name, person_entity_id, entity_name, entity_id, permission
) VALUES (
  'employee', '{employee_uuid}', 'project', '{specific_project_uuid}', 1
);
```

### 3. Type-Level vs Instance-Level

#### Type-Level (entity_id = '11111111-1111-1111-1111-111111111111')
Grants access to **ALL instances** of an entity type.

#### Instance-Level (entity_id = {specific_uuid})
Grants access to **SPECIFIC entity instance** only.

---

## Database Schema

### Table: `entity_id_rbac_map`

```sql
CREATE TABLE app.entity_id_rbac_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Person-based permission mapping
  person_entity_name varchar(20) NOT NULL CHECK (person_entity_name IN ('employee', 'role')),
  person_entity_id uuid NOT NULL,

  -- Entity target
  entity_name varchar(50) NOT NULL,
  entity_id text NOT NULL,  -- UUID or '11111111-1111-1111-1111-111111111111'

  -- Permission level (0-5)
  permission integer NOT NULL DEFAULT 0 CHECK (permission >= 0 AND permission <= 5),

  -- Lifecycle
  granted_by_empid uuid,
  granted_ts timestamptz NOT NULL DEFAULT now(),
  expires_ts timestamptz,
  active_flag boolean NOT NULL DEFAULT true,

  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now()
);
```

---

## API Integration Patterns

**Only 2 patterns are implemented:**

### Pattern 1: DataTables/Lists (data_gate)

```typescript
// apps/api/src/lib/universal-crud-factory.ts - createListRoute()

fastify.get('/api/v1/project', async (request, reply) => {
  const userId = (request as any).user?.sub;

  // DATA GATE: Get accessible entity IDs
  const accessibleEntityIds = await data_gate_EntityIdsByEntityType(
    userId,
    'project',
    PermissionLevel.VIEW  // 0
  );

  if (accessibleEntityIds.length === 0) {
    return reply.send({ data: [], total: 0, limit, offset });
  }

  // Build ID filter - gate at SQL level
  const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
  const idFilter = hasTypeAccess
    ? sql`TRUE`  // Type-level access - no filtering
    : sql`e.id::text = ANY(${accessibleEntityIds})`;  // Filter by accessible IDs

  // Execute query with RBAC filtering in WHERE clause
  const result = await db.execute(sql`
    SELECT e.* FROM app.d_project e
    WHERE e.active_flag = true
      AND ${idFilter}
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return reply.send({ data: result, total: ... });
});
```

### Pattern 2: Update Entity (api_gate)

```typescript
// apps/api/src/lib/universal-crud-factory.ts - createUpdateRoute()

fastify.patch('/api/v1/project/:id', async (request, reply) => {
  const { id } = request.params;
  const userId = (request as any).user?.sub;

  // API GATE: Check UPDATE permission (throws 403 if denied)
  try {
    await api_gate_Update(userId, 'project', id);
  } catch (err: any) {
    return reply.status(err.statusCode || 403).send({
      error: err.error || 'Forbidden',
      message: err.message
    });
  }

  // User has permission - execute update
  const data = request.body;
  const result = await db.execute(sql`
    UPDATE app.d_project
    SET name = ${data.name},
        updated_ts = NOW(),
        version = version + 1
    WHERE id::text = ${id}
    RETURNING *
  `);

  return reply.send(result[0]);
});
```

### Pattern 3: Delete Entity (api_gate)

```typescript
// apps/api/src/lib/universal-crud-factory.ts - createDeleteRoute()

fastify.delete('/api/v1/project/:id', async (request, reply) => {
  const { id } = request.params;
  const userId = (request as any).user?.sub;

  // API GATE: Check DELETE permission (throws 403 if denied)
  try {
    await api_gate_Delete(userId, 'project', id);
  } catch (err: any) {
    return reply.status(err.statusCode || 403).send({
      error: err.error || 'Forbidden',
      message: err.message
    });
  }

  // User has permission - soft delete
  await db.execute(sql`
    UPDATE app.d_project
    SET active_flag = false, to_ts = NOW(), updated_ts = NOW()
    WHERE id::text = ${id}
  `);

  return reply.status(204).send();
});
```

---

## Use Cases & Examples

### Use Case 1: CEO with Full Access (DataTable Shows All)

```sql
-- Grant CEO permission level 5 (Owner) on ALL projects
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('employee', '{ceo_uuid}', 'project', '11111111-1111-1111-1111-111111111111', 5);
```

**Result for Data Gate (DataTables/Lists)**:
- `data_gate_EntityIdsByEntityType(ceo_uuid, 'project', 0)` → Returns `['11111111-1111-1111-1111-111111111111']`
- All DataTable queries return ALL projects (no ID filtering)

**Result for API Gates**:
- `api_gate_Update(ceo_uuid, 'project', any_id)` → PASS (level 5 >= 1)
- `api_gate_Delete(ceo_uuid, 'project', any_id)` → PASS (level 5 >= 3)

### Use Case 2: Team Member with Edit on Specific Project Only

```sql
-- Grant employee permission level 1 (Edit) on specific project
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('employee', '{employee_uuid}', 'project', '{project_abc_uuid}', 1);
```

**Result for Data Gate (DataTables/Lists)**:
- `data_gate_EntityIdsByEntityType(employee_uuid, 'project', 0)` → Returns `['{project_abc_uuid}']`
- DataTables show ONLY project ABC (SQL filtered by ID)

**Result for API Gates**:
- `api_gate_Update(employee_uuid, 'project', 'abc')` → PASS (level 1 >= 1)
- `api_gate_Delete(employee_uuid, 'project', 'abc')` → FAIL (level 1 < 3) → throws 403

### Use Case 3: Role-Based Permissions

```sql
-- Grant Manager role permission level 3 (Delete) on all projects
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT 'role', id, 'project', '11111111-1111-1111-1111-111111111111', 3
FROM d_role WHERE role_code = 'MANAGER';

-- Assign employee to Manager role
INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
VALUES ('role', '{manager_role_uuid}', 'employee', '{employee_uuid}');
```

**Result for Data Gate (DataTables/Lists)**:
- `data_gate_EntityIdsByEntityType(employee_uuid, 'project', 0)` → Returns `['11111111-1111-1111-1111-111111111111']`
- DataTables show ALL projects

**Result for API Gates**:
- `api_gate_Update(employee_uuid, 'project', any_id)` → PASS (level 3 >= 1)
- `api_gate_Delete(employee_uuid, 'project', any_id)` → PASS (level 3 >= 3)

---

## Security Best Practices

### 1. Always Use JWT for User Identity

```typescript
// ✅ CORRECT
const userId = (request as any).user?.sub;  // From JWT token

// ❌ WRONG - NEVER trust client input
const userId = request.body.userId;
```

### 2. Use data_gate for DataTable/List Operations (Gate at SQL Level)

```typescript
// ✅ CORRECT - Get accessible IDs and use in WHERE clause
const accessibleEntityIds = await data_gate_EntityIdsByEntityType(userId, 'project', PermissionLevel.VIEW);

if (accessibleEntityIds.length === 0) {
  return reply.status(403).send({ error: 'No access' });
}

const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
const idFilter = hasTypeAccess
  ? sql`TRUE`
  : sql`id::text = ANY(${accessibleEntityIds})`;

const result = await db.execute(sql`
  SELECT * FROM d_project
  WHERE active_flag = true
    AND ${idFilter}  -- Gate at SQL level
`);

// ❌ WRONG - No RBAC filtering
const result = await db.execute(sql`SELECT * FROM d_project`);
```

### 3. Use api_gate for Update/Delete Operations

```typescript
// ✅ CORRECT - Check permission before update
try {
  await api_gate_Update(userId, 'project', projectId);
} catch (err) {
  return reply.status(403).send({ error: 'Permission denied' });
}

// ❌ WRONG - No permission check
await db.execute(sql`UPDATE d_project SET ... WHERE id = ${projectId}`);
```

---

## Summary

The Simplified 2-Gate RBAC Pattern provides:

✅ **Clear Separation**:
  - `data_gate_*` for DataTables/lists
  - `api_gate_*` for Update/Delete only
✅ **Type-Safe**: TypeScript service with full type safety
✅ **Permission Inheritance**: Higher levels inherit all lower permissions
✅ **Dual Sources**: Role-based + Direct employee permissions (UNION)
✅ **Performance**: Single query resolves all permissions
✅ **Security**: JWT-based identity, SQL-level filtering

**The Two Gates (Implementation Scope):**

1. **`data_gate_EntityIdsByEntityType`**
   - Used for: EntityDataTable components and list views
   - Returns accessible entity IDs
   - IDs are used in SQL WHERE clauses to filter at database level

2. **`api_gate_Update` and `api_gate_Delete`**
   - Used for: Update and Delete operations only
   - Throws 403 error if permission denied
   - Checks permissions before executing UPDATE/DELETE queries

**Note:** Create operations check permissions inline but don't use a dedicated gate pattern.

---

**Documentation Version**: 5.0 (Simplified 2-Gate Pattern)
**Last Updated**: 2025-11-14
**Location**: `/apps/api/src/lib/rbac.service.ts`
