# Person-Based RBAC System - Complete Documentation

> **Version**: 3.0 (Integer Permission Model)
> **Last Updated**: 2025-11-13
> **Status**: Production-Ready

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Permission Resolution Model](#permission-resolution-model)
4. [Database Schema](#database-schema)
5. [RBAC Functions](#rbac-functions)
6. [API Integration Patterns](#api-integration-patterns)
7. [Use Cases & Examples](#use-cases--examples)
8. [Security Best Practices](#security-best-practices)
9. [Performance Optimization](#performance-optimization)

---

## Overview

The Person-Based RBAC system provides fine-grained access control supporting BOTH **role-based** and **employee-specific** permissions. Permissions resolve via UNION of two sources, using a simple **integer permission level** (0-5) with hierarchical inheritance.

### Key Features

- ✅ **Dual Permission Sources**: Role-based + Direct employee permissions
- ✅ **Integer Permission Model**: Single integer (0-5) instead of arrays
- ✅ **Hierarchical Inheritance**: Higher permission levels inherit all lower permissions
- ✅ **Type-Level & Instance-Level**: Grant access to all entities or specific instances
- ✅ **Temporal Expiration**: Time-limited permissions for contractors/guests
- ✅ **Delegation Tracking**: Audit trail of who granted permissions
- ✅ **Zero Database Foreign Keys**: Permissions stored independently of entity tables
- ✅ **SQL Functions**: `has_permission_on_entity_id()` and `get_all_scope_by_entity_employee()`

---

## Core Concepts

### 1. Integer Permission Model

Permissions are stored as a **single integer** (0-5) with hierarchical levels. **Higher levels automatically inherit all lower permissions**.

```sql
permission = 0 | 1 | 2 | 3 | 4 | 5  (single integer value)

0 = View    → Read access to entity data
1 = Edit    → Modify existing entity (INHERITS View)
2 = Share   → Share entity with others (INHERITS Edit + View)
3 = Delete  → Soft delete entity (INHERITS Share + Edit + View)
4 = Create  → Create new entities - requires entity_id='all' (INHERITS Delete + Share + Edit + View)
5 = Owner   → Full control including permission management (INHERITS ALL permissions)
```

**Permission Hierarchy with Automatic Inheritance**:
```
Owner [5]
  └─→ INHERITS ALL: Create [4], Delete [3], Share [2], Edit [1], View [0]
       └─→ Create [4]
            └─→ INHERITS: Delete [3], Share [2], Edit [1], View [0]
                 └─→ Delete [3]
                      └─→ INHERITS: Share [2], Edit [1], View [0]
                           └─→ Share [2]
                                └─→ INHERITS: Edit [1], View [0]
                                     └─→ Edit [1]
                                          └─→ INHERITS: View [0]
                                               └─→ View [0]
```

**Permission Checks** (using >= comparison):
```sql
-- Check View permission
WHERE permission >= 0  -- Everyone with any permission can view

-- Check Edit permission
WHERE permission >= 1  -- Edit, Share, Delete, Create, or Owner

-- Check Share permission
WHERE permission >= 2  -- Share, Delete, Create, or Owner

-- Check Delete permission
WHERE permission >= 3  -- Delete, Create, or Owner

-- Check Create permission
WHERE permission >= 4  -- Create or Owner

-- Check Owner permission
WHERE permission >= 5  -- Only Owner
```

**Example Permission Assignments**:
- `permission = 0` → Can ONLY View
- `permission = 1` → Can Edit + View
- `permission = 2` → Can Share + Edit + View
- `permission = 3` → Can Delete + Share + Edit + View
- `permission = 4` → Can Create + Delete + Share + Edit + View (Manager)
- `permission = 5` → Owner (Full control including permission management)

### 2. Person-Based Permissions

Permissions can be granted to TWO types of "persons":

#### A. **Role-Based Permissions** (person_entity_name = 'role')

Permissions granted to a **role** are inherited by ALL employees assigned to that role via `d_entity_id_map`.

**Example**:
```sql
-- Step 1: Grant permission level 4 (Create) to Manager role
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('role', '{manager_role_uuid}', 'project', 'all', 4);

-- Step 2: Assign employees to Manager role
INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES
  ('role', '{manager_role_uuid}', 'employee', '{james_uuid}', 'assigned_to'),
  ('role', '{manager_role_uuid}', 'employee', '{sarah_uuid}', 'assigned_to');

-- Result: Both James and Sarah have permission level 4 on ALL projects
-- They can: Create + Delete + Share + Edit + View (all permissions <=4)
```

#### B. **Direct Employee Permissions** (person_entity_name = 'employee')

Permissions granted directly to a specific employee.

**Example**:
```sql
-- Grant John permission level 1 (Edit) on ONLY project ABC
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('employee', '{john_uuid}', 'project', '{project_abc_uuid}', 1);

-- Result: John has permission level 1 on project ABC
-- He can: Edit + View (permissions <=1)
```

### 3. Type-Level vs Instance-Level Permissions

#### Type-Level (entity_id = 'all')

Grants access to **ALL instances** of an entity type.

```sql
-- CEO has Owner permission (level 5) on ALL projects
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('employee', '{ceo_uuid}', 'project', 'all', 5);

-- Result: CEO can do ANYTHING with ANY project (permission level 5 >= all checks)
```

#### Instance-Level (entity_id = {specific_uuid})

Grants access to **SPECIFIC entity instance** only.

```sql
-- Contractor has Edit permission (level 1) on ONLY project XYZ
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('employee', '{contractor_uuid}', 'project', '{project_xyz_uuid}', 1);

-- Result: Contractor can Edit + View ONLY project XYZ (not other projects)
```

---

## Permission Resolution Model

When checking if an employee has permission, the system resolves via **UNION** of two sources and takes the **MAXIMUM** permission level:

```
Employee Permission = MAX(Role-Based Permission, Direct Employee Permission)
```

### Resolution Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Check: Does Sarah have 'edit' permission on Project ABC?   │
│ (edit requires permission >= 1)                            │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
        Source 1: Role-Based      Source 2: Direct Employee
        (Sarah → Roles)            (Sarah → Permissions)
                │                        │
        ┌───────▼────────┐       ┌──────▼──────┐
        │ permission = 2 │       │ permission=1│
        │  (from role)   │       │  (direct)   │
        └───────┬────────┘       └──────┬──────┘
                │                        │
                └────────┬───────────────┘
                         │
                    ┌────▼─────┐
                    │MAX(2, 1) │
                    │    = 2   │
                    └────┬─────┘
                         │
                 ┌───────▼────────┐
                 │ Check: 2 >= 1? │
                 │   YES → ALLOW  │
                 └────────────────┘
```

**Key Point**: If an employee has permission from MULTIPLE sources, the system uses the MAXIMUM (highest) permission level.

### SQL Implementation

```sql
-- Get maximum permission level for employee on entity
SELECT COALESCE(MAX(permission), -1) as max_permission
FROM (
  -- Source 1: Direct employee permissions
  SELECT permission
  FROM entity_id_rbac_map
  WHERE person_entity_name = 'employee'
    AND person_entity_id = '{sarah_uuid}'
    AND entity_name = 'project'
    AND (entity_id = 'all' OR entity_id = '{project_abc_uuid}')
    AND active_flag = true
    AND (expires_ts IS NULL OR expires_ts > now())

  UNION ALL

  -- Source 2: Role-based permissions
  SELECT rbac.permission
  FROM entity_id_rbac_map rbac
  INNER JOIN d_entity_id_map eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id::text = rbac.person_entity_id::text
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = '{sarah_uuid}'
    AND eim.active_flag = true
  WHERE rbac.person_entity_name = 'role'
    AND rbac.entity_name = 'project'
    AND (rbac.entity_id = 'all' OR rbac.entity_id = '{project_abc_uuid}')
    AND rbac.active_flag = true
    AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
) AS combined;

-- Then check if max_permission >= required_level
-- For edit: max_permission >= 1
```

**Result**: Sarah has permission if MAX permission from either source meets the requirement.

---

## Database Schema

### Table: `entity_id_rbac_map`

```sql
CREATE TABLE app.entity_id_rbac_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Person-based permission mapping
  person_entity_name varchar(20) NOT NULL CHECK (person_entity_name IN ('employee', 'role')),
  person_entity_id uuid NOT NULL, -- d_employee.id OR d_role.id

  -- Entity target
  entity_name varchar(50) NOT NULL, -- project, task, employee, office, etc.
  entity_id text NOT NULL, -- Specific UUID or 'all'

  -- Permission level (integer 0-5)
  permission integer NOT NULL DEFAULT 0 CHECK (permission >= 0 AND permission <= 5),

  -- Permission lifecycle
  granted_by_empid uuid, -- Delegation tracking
  granted_ts timestamptz NOT NULL DEFAULT now(),
  expires_ts timestamptz, -- Temporary permissions
  active_flag boolean NOT NULL DEFAULT true,

  -- Temporal fields
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rbac_person_entity ON entity_id_rbac_map(person_entity_name, person_entity_id, entity_name, entity_id) WHERE active_flag = true;
CREATE INDEX idx_rbac_role_entity ON entity_id_rbac_map(person_entity_name, person_entity_id, entity_name) WHERE person_entity_name = 'role' AND active_flag = true;
CREATE INDEX idx_rbac_expires ON entity_id_rbac_map(expires_ts) WHERE expires_ts IS NOT NULL AND active_flag = true;
```

**Permission Level Values**:
```sql
-- 0 = View only
-- 1 = Edit (+ View)
-- 2 = Share (+ Edit + View)
-- 3 = Delete (+ Share + Edit + View)
-- 4 = Create (+ Delete + Share + Edit + View)
-- 5 = Owner (+ all permissions)
```

### Table: `d_entity_id_map` (Role → Employee Mapping)

```sql
CREATE TABLE app.d_entity_id_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_entity_type varchar(20) NOT NULL, -- 'role'
  parent_entity_id text NOT NULL, -- role.id
  child_entity_type varchar(20) NOT NULL, -- 'employee'
  child_entity_id text NOT NULL, -- employee.id
  relationship_type varchar(50) DEFAULT 'assigned_to',
  active_flag boolean NOT NULL DEFAULT true,
  ...
);
```

**Key Point**: This table links employees to their roles. When checking role-based permissions, we JOIN `entity_id_rbac_map` with `d_entity_id_map` to resolve which employees inherit role permissions.

---

## RBAC Functions

### 1. `has_permission_on_entity_id()`

**Purpose**: Check if employee has specific permission on entity instance (gate API operations).

**Signature**:
```sql
app.has_permission_on_entity_id(
  p_employee_id uuid,
  p_entity_name varchar(50),
  p_entity_id text,
  p_permission_type varchar(10) -- 'view', 'edit', 'share', 'delete', 'create', 'owner'
) RETURNS integer -- 1 = permitted, 0 = denied
```

**Permission Type Mapping**:
```sql
'view'   → requires permission >= 0
'edit'   → requires permission >= 1
'share'  → requires permission >= 2
'delete' → requires permission >= 3
'create' → requires permission >= 4
'owner'  → requires permission >= 5
```

**Usage**:
```sql
-- Check if James can edit project ABC
SELECT has_permission_on_entity_id(
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',  -- James's employee_id
  'project',                                 -- entity type
  '93106ffb-402e-43a7-8b26-5287e37a1b0e',   -- project ABC UUID
  'edit'                                     -- permission type (requires level >= 1)
);
-- Returns: 1 (permitted) or 0 (denied)
```

**API Integration**:
```typescript
// API middleware example (Fastify)
async function checkPermission(request, reply) {
  const employeeId = request.user.sub; // From JWT
  const projectId = request.params.id;

  const hasPermission = await db.query(`
    SELECT has_permission_on_entity_id($1, 'project', $2, 'edit')
  `, [employeeId, projectId]);

  if (hasPermission.rows[0].has_permission_on_entity_id === 0) {
    return reply.code(403).send({ error: 'Permission denied' });
  }
  // Continue to business logic...
}
```

### 2. `get_all_scope_by_entity_employee()`

**Purpose**: Get all entity IDs that employee can access (filter query results).

**Signature**:
```sql
app.get_all_scope_by_entity_employee(
  p_employee_id uuid,
  p_entity_name varchar(50),
  p_permission_type varchar(10) -- 'view', 'edit', 'share', 'delete', 'create', 'owner'
) RETURNS text[] -- Array of entity_id UUIDs, or ['all'] for type-level access
```

**Usage**:
```sql
-- Get all projects John can view (requires permission >= 0)
SELECT get_all_scope_by_entity_employee(
  '{john_uuid}',
  'project',
  'view'
);
-- Returns: ['{project_a_uuid}', '{project_b_uuid}', ...] or ['all']
```

**API Integration**:
```typescript
// API list endpoint example
app.get('/api/v1/project', async (request, reply) => {
  const employeeId = request.user.sub; // From JWT

  // Get scope
  const scopeResult = await db.query(`
    SELECT get_all_scope_by_entity_employee($1, 'project', 'view') as scope
  `, [employeeId]);

  const scope = scopeResult.rows[0].scope;

  let query;
  if (scope.includes('all')) {
    // Employee has type-level access to ALL projects
    query = 'SELECT * FROM d_project WHERE active_flag = true';
  } else if (scope.length === 0) {
    // Employee has NO access
    return reply.send({ data: [], total: 0 });
  } else {
    // Employee has access to specific projects
    query = {
      text: 'SELECT * FROM d_project WHERE id = ANY($1) AND active_flag = true',
      values: [scope]
    };
  }

  const result = await db.query(query);
  return reply.send({ data: result.rows, total: result.rowCount });
});
```

---

## API Integration Patterns

### Pattern 1: Permission Gating (Write Operations)

**Use Case**: Prevent unauthorized writes (PUT, PATCH, DELETE).

```typescript
// PUT /api/v1/project/:id
app.put('/api/v1/project/:id', async (request, reply) => {
  const employeeId = request.user.sub; // From JWT
  const projectId = request.params.id;

  // STEP 1: Check permission (requires level >= 1 for edit)
  const hasPermission = await db.query(`
    SELECT has_permission_on_entity_id($1, 'project', $2, 'edit')
  `, [employeeId, projectId]);

  if (hasPermission.rows[0].has_permission_on_entity_id === 0) {
    return reply.code(403).send({
      error: 'Permission denied',
      message: 'You do not have edit permission on this project'
    });
  }

  // STEP 2: Execute business logic
  const { name, description, budget } = request.body;
  const result = await db.query(`
    UPDATE d_project
    SET name = $1, description = $2, budget_allocated_amt = $3, updated_ts = now()
    WHERE id = $4
    RETURNING *
  `, [name, description, budget, projectId]);

  return reply.send(result.rows[0]);
});
```

### Pattern 2: Scope Filtering (Read Operations)

**Use Case**: Filter list results to show only authorized records.

```typescript
// GET /api/v1/project
app.get('/api/v1/project', async (request, reply) => {
  const employeeId = request.user.sub; // From JWT

  // STEP 1: Get scope (requires level >= 0 for view)
  const scopeResult = await db.query(`
    SELECT get_all_scope_by_entity_employee($1, 'project', 'view') as scope
  `, [employeeId]);

  const scope = scopeResult.rows[0].scope;

  // STEP 2: Build filtered query
  let query;
  if (scope.includes('all')) {
    query = 'SELECT * FROM d_project WHERE active_flag = true ORDER BY created_ts DESC';
  } else if (scope.length === 0) {
    return reply.send({ data: [], total: 0 }); // No access
  } else {
    query = {
      text: `SELECT * FROM d_project
             WHERE id = ANY($1) AND active_flag = true
             ORDER BY created_ts DESC`,
      values: [scope]
    };
  }

  // STEP 3: Execute and return
  const result = await db.query(query);
  return reply.send({ data: result.rows, total: result.rowCount });
});
```

### Pattern 3: Create Child Entity

**Use Case**: Ensure parent edit permission (level >=1) + child create permission (level >=4).

```typescript
// POST /api/v1/project/:project_id/task
app.post('/api/v1/project/:project_id/task', async (request, reply) => {
  const employeeId = request.user.sub;
  const projectId = request.params.project_id;

  // STEP 1: Check parent edit permission (requires level >= 1)
  const hasParentEdit = await db.query(`
    SELECT has_permission_on_entity_id($1, 'project', $2, 'edit')
  `, [employeeId, projectId]);

  if (hasParentEdit.rows[0].has_permission_on_entity_id === 0) {
    return reply.code(403).send({
      error: 'Permission denied',
      message: 'You do not have edit permission on this project'
    });
  }

  // STEP 2: Check child create permission (requires level >= 4 on 'all')
  const hasTaskCreate = await db.query(`
    SELECT has_permission_on_entity_id($1, 'task', 'all', 'create')
  `, [employeeId]);

  if (hasTaskCreate.rows[0].has_permission_on_entity_id === 0) {
    return reply.code(403).send({
      error: 'Permission denied',
      message: 'You do not have create permission for tasks'
    });
  }

  // STEP 3: Create task
  const { name, description } = request.body;
  const taskResult = await db.query(`
    INSERT INTO d_task (name, description, created_by_empid)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [name, description, employeeId]);

  const taskId = taskResult.rows[0].id;

  // STEP 4: Link task to project
  await db.query(`
    INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
    VALUES ('project', $1, 'task', $2, 'contains')
  `, [projectId, taskId]);

  return reply.code(201).send(taskResult.rows[0]);
});
```

---

## Use Cases & Examples

### Use Case 1: Role-Based Department Management

**Scenario**: All employees with "Manager" role have Create permission (level 4) on projects.

```sql
-- Step 1: Grant permission level 4 (Create) to Manager role
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT 'role', id, 'project', 'all', 4
FROM d_role
WHERE role_code = 'DEPT-MGR';

-- Step 2: Assign employees to Manager role
INSERT INTO d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
SELECT
  'role', r.id, 'employee', e.id, 'assigned_to'
FROM d_role r
CROSS JOIN d_employee e
WHERE r.role_code = 'DEPT-MGR'
  AND e.department IN ('Landscaping', 'HVAC', 'Plumbing', 'Snow Removal');

-- Result: All department managers have permission level 4 on projects
-- They can: Create + Delete + Share + Edit + View (all permissions <= 4)
```

### Use Case 2: Project-Specific Team Access

**Scenario**: Grant specific team members Edit permission (level 1) on a single project.

```sql
-- Grant Sarah and John permission level 1 (Edit) on Project Alpha
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_empid)
SELECT
  'employee', e.id, 'project', '{project_alpha_uuid}', 1, '{team_lead_uuid}'
FROM d_employee e
WHERE e.email IN ('sarah@huronhome.ca', 'john@huronhome.ca');

-- Result: Sarah and John have permission level 1 on Project Alpha
-- They can: Edit + View (permissions <= 1)
-- They CANNOT: Share, Delete, or Create
```

### Use Case 3: Temporary Contractor Access

**Scenario**: Grant contractor Edit permission (level 1) for 30 days.

```sql
-- Grant contractor permission level 1 (Edit) on Project Beta for 30 days
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, expires_ts, granted_by_empid)
VALUES (
  'employee',
  '{contractor_uuid}',
  'project',
  '{project_beta_uuid}',
  1,  -- Edit permission
  now() + interval '30 days',
  '{manager_uuid}'
);

-- Result: Contractor has permission level 1 on Project Beta for 30 days
-- They can: Edit + View
-- Permission expires automatically after 30 days
```

### Use Case 4: Hierarchical Permissions

**Scenario**: CEO has Owner permission (level 5) on everything.

```sql
-- Grant CEO permission level 5 (Owner) on all entity types
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT 'employee', e.id, entity_type, 'all', 5
FROM d_employee e
CROSS JOIN (VALUES
  ('project'), ('task'), ('employee'), ('office'), ('business'),
  ('worksite'), ('customer'), ('service'), ('product'), ('order')
) AS entities(entity_type)
WHERE e.email = 'james.miller@huronhome.ca';

-- Result: CEO has permission level 5 on ALL entities
-- CEO can do ANYTHING: Owner + Create + Delete + Share + Edit + View
```

### Use Case 5: Permission Delegation

**Scenario**: Manager delegates Owner permission (level 5) to team lead on specific project.

```sql
-- Manager grants team lead permission level 5 (Owner) on specific project
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_empid)
VALUES (
  'employee',
  '{team_lead_uuid}',
  'project',
  '{project_gamma_uuid}',
  5,  -- Owner permission
  '{manager_uuid}'
);

-- Team lead can now grant permissions to team members (has Owner permission)
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_empid)
VALUES (
  'employee',
  '{team_member_uuid}',
  'project',
  '{project_gamma_uuid}',
  1,  -- Edit permission
  '{team_lead_uuid}' -- Delegated by team lead
);

-- Result: Audit trail shows manager → team lead → team member delegation chain
```

### Use Case 6: Read-Only Access

**Scenario**: Grant external auditor View-only permission (level 0).

```sql
-- Grant auditor permission level 0 (View only) on financial reports
INSERT INTO entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, expires_ts)
VALUES (
  'employee',
  '{auditor_uuid}',
  'reports',
  'all',
  0,  -- View only
  now() + interval '90 days'
);

-- Result: Auditor has permission level 0 on all reports
-- They can ONLY: View
-- They CANNOT: Edit, Share, Delete, or Create
```

---

## Security Best Practices

### 1. Always Extract employee_id from JWT

**✅ Correct**:
```typescript
const employeeId = request.user.sub; // From verified JWT token
```

**❌ Incorrect**:
```typescript
const employeeId = request.body.employee_id; // NEVER trust client input!
```

### 2. Check Permissions Before EVERY Write Operation

```typescript
// ALWAYS check before UPDATE/DELETE
const hasPermission = await db.query(`
  SELECT has_permission_on_entity_id($1, 'project', $2, 'edit')
`, [employeeId, projectId]);

if (!hasPermission.rows[0].has_permission_on_entity_id) {
  return reply.code(403).send({ error: 'Permission denied' });
}
```

### 3. Filter ALL List Queries by Scope

```typescript
// ALWAYS use get_all_scope_by_entity_employee() for list endpoints
const scope = await db.query(`
  SELECT get_all_scope_by_entity_employee($1, 'project', 'view') as scope
`, [employeeId]);

// Filter results
WHERE id = ANY($1) AND active_flag = true
```

### 4. Use Temporal Expiration for Contractors

```sql
-- Set expiration for temporary access
expires_ts = now() + interval '30 days'
```

### 5. Track Delegation with granted_by_empid

```sql
-- Always record who granted permission
granted_by_empid = '{manager_uuid}'
```

### 6. Respect Permission Hierarchy

```
Only users with Owner permission (level 5) can grant permissions to others.
DO NOT allow users to grant permissions higher than their own level.
```

---

## Performance Optimization

### 1. Indexes

```sql
-- Composite index for fast lookups
CREATE INDEX idx_rbac_person_entity ON entity_id_rbac_map(person_entity_name, person_entity_id, entity_name, entity_id)
WHERE active_flag = true;

-- Role permission resolution
CREATE INDEX idx_rbac_role_entity ON entity_id_rbac_map(person_entity_name, person_entity_id, entity_name)
WHERE person_entity_name = 'role' AND active_flag = true;

-- Expiration cleanup
CREATE INDEX idx_rbac_expires ON entity_id_rbac_map(expires_ts)
WHERE expires_ts IS NOT NULL AND active_flag = true;
```

### 2. Function Stability

Both RBAC functions are marked `STABLE` (not `VOLATILE`), allowing PostgreSQL to cache results within a single query.

```sql
CREATE OR REPLACE FUNCTION has_permission_on_entity_id(...)
RETURNS integer AS $$ ... $$ LANGUAGE plpgsql STABLE; -- Cacheable
```

### 3. Caching Strategy (Application Level)

Cache permission results for short periods (5-60 seconds):

```typescript
// Redis cache example
const cacheKey = `rbac:${employeeId}:${entityName}:${entityId}:${permission}`;
let hasPermission = await redis.get(cacheKey);

if (hasPermission === null) {
  // Query database
  const result = await db.query(`SELECT has_permission_on_entity_id($1, $2, $3, $4)`, [employeeId, entityName, entityId, permission]);
  hasPermission = result.rows[0].has_permission_on_entity_id;

  // Cache for 60 seconds
  await redis.setex(cacheKey, 60, hasPermission);
}

return hasPermission === 1;
```

### 4. Batch Permission Checks

When checking permissions for multiple entities, batch the queries:

```typescript
// Bad: N+1 queries
for (const project of projects) {
  const hasPermission = await checkPermission(employeeId, 'project', project.id, 'view');
  if (hasPermission) visibleProjects.push(project);
}

// Good: Single scope query
const scope = await db.query(`
  SELECT get_all_scope_by_entity_employee($1, 'project', 'view') as scope
`, [employeeId]);

const visibleProjects = scope.includes('all')
  ? projects
  : projects.filter(p => scope.includes(p.id));
```

---

## Permission Level Reference

### Quick Reference Table

| Level | Name   | Can Do | SQL Check | Typical Role |
|-------|--------|--------|-----------|--------------|
| 0     | View   | Read data | `permission >= 0` | Guest, Viewer |
| 1     | Edit   | Modify data + View | `permission >= 1` | Team Member |
| 2     | Share  | Share with others + Edit + View | `permission >= 2` | Team Lead |
| 3     | Delete | Remove data + Share + Edit + View | `permission >= 3` | Senior Lead |
| 4     | Create | Create new entities + Delete + Share + Edit + View | `permission >= 4` | Manager |
| 5     | Owner  | Manage permissions + ALL operations | `permission >= 5` | CEO, Project Owner |

### Permission Assignment Guidelines

```sql
-- View-only access (external auditors, contractors)
permission = 0

-- Team members who work on projects
permission = 1

-- Team leads who coordinate with others
permission = 2

-- Senior leads who manage project lifecycle
permission = 3

-- Department managers who create new projects
permission = 4

-- Executives and project owners
permission = 5
```

---

## Troubleshooting

### Issue 1: User has role but no permissions

**Symptom**: Employee assigned to Manager role but cannot access projects.

**Diagnosis**:
```sql
-- Check role assignment
SELECT * FROM d_entity_id_map
WHERE parent_entity_type = 'role'
  AND child_entity_type = 'employee'
  AND child_entity_id = '{employee_uuid}';

-- Check role permissions
SELECT * FROM entity_id_rbac_map
WHERE person_entity_name = 'role'
  AND person_entity_id = '{role_uuid}'
  AND entity_name = 'project';
```

**Solution**: Ensure role has permissions AND employee is linked to role via `d_entity_id_map`.

### Issue 2: Expired permissions still active

**Symptom**: Contractor can still access project after expiration.

**Diagnosis**:
```sql
SELECT * FROM entity_id_rbac_map
WHERE person_entity_id = '{contractor_uuid}'
  AND expires_ts < now()
  AND active_flag = true;
```

**Solution**: Application should filter expired permissions:
```sql
AND (expires_ts IS NULL OR expires_ts > now())
```

### Issue 3: Scope function returns empty array

**Symptom**: `get_all_scope_by_entity_employee()` returns `[]` but employee should have access.

**Diagnosis**:
```sql
-- Check permissions exist
SELECT * FROM entity_id_rbac_map
WHERE (person_entity_name = 'employee' AND person_entity_id = '{employee_uuid}')
   OR (person_entity_name = 'role' AND person_entity_id IN (
     SELECT parent_entity_id FROM d_entity_id_map
     WHERE child_entity_id = '{employee_uuid}' AND parent_entity_type = 'role'
   ))
AND entity_name = 'project'
AND active_flag = true;
```

**Solution**: Grant appropriate permissions or check `active_flag`/`expires_ts`.

---

## Appendix: Complete API Middleware Example

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from './database';

// Permission check middleware
export async function requirePermission(
  entityName: string,
  permission: 'view' | 'edit' | 'share' | 'delete' | 'create' | 'owner'
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const employeeId = request.user.sub; // From JWT
    const entityId = request.params.id || 'all';

    const result = await db.query(`
      SELECT has_permission_on_entity_id($1, $2, $3, $4) as has_permission
    `, [employeeId, entityName, entityId, permission]);

    if (result.rows[0].has_permission === 0) {
      return reply.code(403).send({
        error: 'Permission denied',
        message: `You do not have ${permission} permission on ${entityName}`,
        entityId
      });
    }
  };
}

// Scope filtering helper
export async function filterByScope(
  employeeId: string,
  entityName: string,
  permission: 'view' | 'edit' = 'view'
): Promise<string[] | 'all'> {
  const result = await db.query(`
    SELECT get_all_scope_by_entity_employee($1, $2, $3) as scope
  `, [employeeId, entityName, permission]);

  const scope = result.rows[0].scope;
  return scope.includes('all') ? 'all' : scope;
}

// Usage example
app.put('/api/v1/project/:id',
  requirePermission('project', 'edit'), // Middleware (requires level >= 1)
  async (request, reply) => {
    // Business logic here - permission already checked
    const { name, description } = request.body;
    const projectId = request.params.id;

    const result = await db.query(`
      UPDATE d_project
      SET name = $1, description = $2, updated_ts = now()
      WHERE id = $3
      RETURNING *
    `, [name, description, projectId]);

    return reply.send(result.rows[0]);
  }
);

app.get('/api/v1/project', async (request, reply) => {
  const employeeId = request.user.sub;
  const scope = await filterByScope(employeeId, 'project', 'view');

  let query;
  if (scope === 'all') {
    query = 'SELECT * FROM d_project WHERE active_flag = true';
  } else if (scope.length === 0) {
    return reply.send({ data: [], total: 0 });
  } else {
    query = {
      text: 'SELECT * FROM d_project WHERE id = ANY($1) AND active_flag = true',
      values: [scope]
    };
  }

  const result = await db.query(query);
  return reply.send({ data: result.rows, total: result.rowCount });
});
```

---

## Summary

The Person-Based RBAC system provides enterprise-grade access control with:

✅ **Simple Integer Permission Model**: 0-5 (instead of arrays)
✅ **Hierarchical Inheritance**: Higher levels automatically include all lower permissions
✅ **Flexible Permission Sources**: Role-based + Direct employee permissions
✅ **Performance Optimized**: Indexed queries, cacheable functions
✅ **Security First**: JWT validation, scope filtering, temporal expiration
✅ **Audit Trail**: Delegation tracking, timestamp logging
✅ **Zero Foreign Keys**: Independent permission storage

**Permission Hierarchy**:
```
5 (Owner) >= 4 (Create) >= 3 (Delete) >= 2 (Share) >= 1 (Edit) >= 0 (View)
```

**Next Steps**:
1. Integrate RBAC middleware in all API routes
2. Implement permission caching (Redis)
3. Create admin UI for permission management
4. Set up automated expiration cleanup (cron job)
5. Monitor permission check performance (query logs)

---

**Documentation Version**: 3.0 (Integer Permission Model)
**Last Updated**: 2025-11-13
**Contact**: Platform Team
