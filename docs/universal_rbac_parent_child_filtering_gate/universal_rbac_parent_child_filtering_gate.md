# Universal RBAC & Parent-Child Filtering Gate - Deep Technical Architecture

> **Complete implementation-level documentation of the unified data gate system**
>
> This document explains HOW the system works internally, block by block.

**Version**: 1.0.0 | **Last Updated**: 2025-11-16 | **Source**: `apps/api/src/lib/unified-data-gate.ts`

---

## Table of Contents

1. [Architecture Foundation](#architecture-foundation)
2. [Data Model Foundation](#data-model-foundation)
3. [Permission Resolution Engine](#permission-resolution-engine)
4. [RBAC Gate: Deep Dive](#rbac-gate-deep-dive)
5. [Parent-Child Filtering Gate: Deep Dive](#parent-child-filtering-gate-deep-dive)
6. [SQL Generation Patterns](#sql-generation-patterns)
7. [Composability Pattern](#composability-pattern)
8. [Integration Patterns](#integration-patterns)
9. [Performance Optimization](#performance-optimization)
10. [Error Handling & Edge Cases](#error-handling--edge-cases)

---

## Architecture Foundation

### Core Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPOSABLE GATE PATTERN                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Routes OWN SQL queries → Gates AUGMENT with security/filtering │
│                                                                  │
│  ✅ Flexible: Route controls SQL structure                      │
│  ✅ Composable: Multiple gates can be combined                  │
│  ✅ Testable: Each gate independently verifiable                │
│  ✅ Efficient: Server-side filtering, no N+1 queries            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: ROUTE HANDLERS (project/routes.ts)                     │
│ • Owns SQL query structure                                      │
│ • Calls gates to augment query                                  │
│ • Composes final SQL from fragments                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: UNIFIED DATA GATE (unified-data-gate.ts)               │
│ • rbac_gate: Returns SQL WHERE conditions                       │
│ • parent_child_filtering_gate: Returns SQL JOIN clauses         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: PERMISSION RESOLUTION ENGINE                           │
│ • getMaxPermissionLevelOfEntityID() - Single entity check       │
│ • data_gate_EntityIdsByEntityType() - Bulk entity filtering     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: DATABASE TABLES                                        │
│ • d_entity_rbac - Permission storage                       │
│ • d_entity_instance_link - Parent-child relationships                  │
│ • d_entity - Entity metadata                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Model Foundation

### Table 1: `d_entity_rbac` - Permission Storage

**Purpose**: Store person-based permissions with hierarchical levels

```sql
CREATE TABLE app.d_entity_rbac (
  person_entity_name VARCHAR(50),  -- 'employee' or 'role'
  person_entity_id UUID,            -- Employee ID or Role ID
  entity_name VARCHAR(50),          -- 'project', 'task', etc.
  entity_id UUID,                   -- Instance ID or ALL_ENTITIES_ID
  permission INTEGER,               -- 0-5 (single level, hierarchical)
  active_flag BOOLEAN,
  expires_ts TIMESTAMPTZ
);
```

**Key Concepts**:

1. **Person-Based Model**: Permissions belong to `employee` or `role`, not entities
2. **Single Integer Permission**: 0-5 hierarchy (higher includes all lower)
3. **Type vs Instance Permissions**:
   - `entity_id = '11111111-1111-1111-1111-111111111111'` → Type-level (all entities)
   - `entity_id = <specific UUID>` → Instance-level (one entity)

**Permission Hierarchy**:

```
5 = OWNER   → Can do anything (implies all below)
4 = CREATE  → Can create new entities (type-level only)
3 = DELETE  → Can soft delete (implies Share/Edit/View)
2 = SHARE   → Can share with others (implies Edit/View)
1 = EDIT    → Can modify (implies View)
0 = VIEW    → Can read only
```

**Example Records**:

```sql
-- James Miller can CREATE all projects (type-level)
('employee', '8260b1b0-...', 'project', '11111111-1111-...', 4, true, NULL)

-- James Miller can DELETE specific project (instance-level)
('employee', '8260b1b0-...', 'project', 'abc123-...', 3, true, NULL)

-- "Project Manager" role has OWNER on all projects
('role', 'role-uuid-123', 'project', '11111111-1111-...', 5, true, NULL)
```

---

### Table 2: `d_entity_instance_link` - Parent-Child Relationships

**Purpose**: Flexible many-to-many entity relationships (replaces foreign keys)

```sql
CREATE TABLE app.d_entity_instance_link (
  id UUID PRIMARY KEY,
  parent_entity_type VARCHAR(50),   -- 'business', 'project', etc.
  parent_entity_id UUID,             -- Parent instance UUID
  child_entity_type VARCHAR(50),    -- 'project', 'task', etc.
  child_entity_id UUID,              -- Child instance UUID
  relationship_type VARCHAR(50),     -- 'contains', 'assigned_to', etc.
  active_flag BOOLEAN,
  created_ts TIMESTAMPTZ,
  updated_ts TIMESTAMPTZ
);
```

**Key Features**:

1. **No Foreign Keys**: Supports soft deletes, temporal versioning, cross-schema flexibility
2. **Many-to-Many**: Same child can have multiple parents
3. **Polymorphic**: Any entity type can relate to any other
4. **Soft Deletable**: `active_flag = false` instead of DELETE

**Example Records**:

```sql
-- Project belongs to Business
('business', 'biz-123', 'project', 'proj-456', 'contains', true)

-- Project belongs to Customer (multi-parent)
('cust', 'cust-789', 'project', 'proj-456', 'contains', true)

-- Task assigned to Employee
('task', 'task-abc', 'employee', 'emp-xyz', 'assigned_to', true)
```

**Benefits Over Foreign Keys**:

| Foreign Key | d_entity_instance_link |
|-------------|-----------------|
| Hard delete cascades | Soft delete preserves history |
| One parent only | Multiple parents supported |
| Schema-locked | Flexible, polymorphic |
| No temporal versioning | Supports `from_ts/to_ts` |

---

### Table 3: `d_entity` - Entity Type Metadata

**Purpose**: Single source of truth for entity type definitions

```sql
CREATE TABLE app.d_entity (
  code VARCHAR(50) PRIMARY KEY,      -- 'project', 'task', etc.
  name VARCHAR(100),                  -- 'Project', 'Task'
  ui_label VARCHAR(100),              -- 'Projects', 'Tasks'
  ui_icon VARCHAR(50),                -- 'FolderOpen', 'CheckSquare'
  child_entities JSONB,               -- Array of child entity metadata
  display_order INTEGER,
  active_flag BOOLEAN
);
```

**Child Entities Structure**:

```json
[
  {
    "entity": "task",
    "ui_icon": "CheckSquare",
    "ui_label": "Tasks",
    "order": 1
  },
  {
    "entity": "wiki",
    "ui_icon": "BookOpen",
    "ui_label": "Wiki",
    "order": 2
  }
]
```

**Usage**:

1. **Factory Endpoint Generation**: `createChildEntityEndpointsFromMetadata()` reads this table
2. **UI Tab Rendering**: Frontend displays tabs based on `child_entities`
3. **Permission Inheritance**: Determines parent-child relationships for RBAC

---

## Permission Resolution Engine

### Building Block 1: `getMaxPermissionLevelOfEntityID()`

**Purpose**: Get the highest permission level a user has on a specific entity

**Signature**:

```typescript
async function getMaxPermissionLevelOfEntityID(
  userId: string,
  entityName: string,
  entityId: string
): Promise<number>
```

**Internal Logic** (5 CTEs):

```sql
WITH

-- CTE 1: DIRECT EMPLOYEE PERMISSIONS
direct_emp AS (
  SELECT permission
  FROM app.d_entity_rbac
  WHERE person_entity_name = 'employee'
    AND person_entity_id = ${userId}::uuid
    AND entity_name = ${entityName}
    AND (entity_id = ALL_ENTITIES_ID OR entity_id = ${entityId}::uuid)
    AND active_flag = true
    AND (expires_ts IS NULL OR expires_ts > NOW())
),

-- CTE 2: ROLE-BASED PERMISSIONS
-- employee → role (via d_entity_instance_link) → permissions
role_based AS (
  SELECT rbac.permission
  FROM app.d_entity_rbac rbac
  INNER JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}::uuid
    AND eim.active_flag = true
  WHERE rbac.person_entity_name = 'role'
    AND rbac.entity_name = ${entityName}
    AND (rbac.entity_id = ALL_ENTITIES_ID OR rbac.entity_id = ${entityId}::uuid)
    AND rbac.active_flag = true
),

-- CTE 3: FIND PARENT ENTITY TYPES
parent_entities AS (
  SELECT d.code AS parent_entity_name
  FROM app.d_entity d
  WHERE ${entityName} = ANY(
    SELECT jsonb_array_elements_text(d.child_entities)
  )
),

-- CTE 4: PARENT-VIEW INHERITANCE
-- If parent has VIEW (0+) → child gains VIEW
parent_view AS (
  SELECT 0 AS permission
  FROM parent_entities pe
  LEFT JOIN app.d_entity_rbac emp
    ON emp.person_entity_name = 'employee'
    AND emp.person_entity_id = ${userId}
    AND emp.entity_name = pe.parent_entity_name
    AND emp.active_flag = true
  LEFT JOIN app.d_entity_rbac rbac
    ON rbac.person_entity_name = 'role'
    AND rbac.entity_name = pe.parent_entity_name
    AND rbac.active_flag = true
  LEFT JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}::uuid
    AND eim.active_flag = true
  WHERE COALESCE(emp.permission, -1) >= 0
     OR COALESCE(rbac.permission, -1) >= 0
),

-- CTE 5: PARENT-CREATE INHERITANCE
-- If parent has CREATE (4+) → child gains CREATE
parent_create AS (
  SELECT 4 AS permission
  FROM parent_entities pe
  LEFT JOIN app.d_entity_rbac emp
    ON emp.person_entity_name = 'employee'
    AND emp.person_entity_id = ${userId}
    AND emp.entity_name = pe.parent_entity_name
    AND emp.active_flag = true
  LEFT JOIN app.d_entity_rbac rbac
    ON rbac.person_entity_name = 'role'
    AND rbac.entity_name = pe.parent_entity_name
    AND rbac.active_flag = true
  LEFT JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}::uuid
    AND eim.active_flag = true
  WHERE COALESCE(emp.permission, -1) >= 4
     OR COALESCE(rbac.permission, -1) >= 4
)

-- FINAL: MAX of all sources
SELECT COALESCE(MAX(permission), -1) AS max_permission
FROM (
  SELECT * FROM direct_emp
  UNION ALL SELECT * FROM role_based
  UNION ALL SELECT * FROM parent_view
  UNION ALL SELECT * FROM parent_create
) AS all_perms
```

**CTE Breakdown**:

#### CTE 1: Direct Employee Permissions

```sql
direct_emp AS (
  SELECT permission
  FROM app.d_entity_rbac
  WHERE person_entity_name = 'employee'
    AND person_entity_id = ${userId}
    AND entity_name = ${entityName}
    AND (entity_id = ALL_ENTITIES_ID OR entity_id = ${entityId})
    AND active_flag = true
    AND (expires_ts IS NULL OR expires_ts > NOW())
)
```

**What it does**:
- Finds permissions assigned DIRECTLY to the employee
- Checks both type-level (`ALL_ENTITIES_ID`) and instance-level permissions
- Filters out inactive or expired permissions

**Example Output**:

| permission |
|------------|
| 4 | ← CREATE on all projects (type-level)
| 3 | ← DELETE on specific project (instance-level)

**Max**: 4 (CREATE implies VIEW/EDIT/SHARE/DELETE)

---

#### CTE 2: Role-Based Permissions

```sql
role_based AS (
  SELECT rbac.permission
  FROM app.d_entity_rbac rbac
  INNER JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}
    AND eim.active_flag = true
  WHERE rbac.person_entity_name = 'role'
    AND rbac.entity_name = ${entityName}
    AND (rbac.entity_id = ALL_ENTITIES_ID OR rbac.entity_id = ${entityId})
    AND rbac.active_flag = true
)
```

**What it does**:
1. Find all roles the employee belongs to (via `d_entity_instance_link`)
2. Get permissions assigned to those roles
3. Filter by entity type and ID

**Join Explanation**:

```
employee (userId)
    ↓ (via d_entity_instance_link)
role (role IDs)
    ↓ (via d_entity_rbac)
permissions
```

**Example Flow**:

```
1. Employee '8260b1b0-...' belongs to role 'manager-123'
   (d_entity_instance_link: parent='role/manager-123', child='employee/8260b1b0-...')

2. Role 'manager-123' has OWNER on all projects
   (d_entity_rbac: person='role/manager-123', entity='project/ALL', permission=5)

3. Result: Employee gains permission 5 (OWNER)
```

---

#### CTE 3: Find Parent Entity Types

```sql
parent_entities AS (
  SELECT d.code AS parent_entity_name
  FROM app.d_entity d
  WHERE ${entityName} = ANY(
    SELECT jsonb_array_elements_text(d.child_entities)
  )
)
```

**What it does**:
- Queries `d_entity.child_entities` JSONB array
- Finds which entity types declare `${entityName}` as a child

**Example**:

If checking permissions for `task` entity:

```sql
-- project.child_entities contains ["task", "wiki", "artifact", ...]
-- office.child_entities contains ["task", "artifact", ...]
-- Result: parent_entities = ['project', 'office']
```

**Purpose**: Prepares for parent inheritance checks

---

#### CTE 4: Parent-VIEW Inheritance

```sql
parent_view AS (
  SELECT 0 AS permission  -- VIEW level
  FROM parent_entities pe
  LEFT JOIN app.d_entity_rbac emp
    ON emp.person_entity_name = 'employee'
    AND emp.person_entity_id = ${userId}
    AND emp.entity_name = pe.parent_entity_name  -- Check parent type
    AND emp.active_flag = true
  LEFT JOIN app.d_entity_rbac rbac
    ON rbac.person_entity_name = 'role'
    AND rbac.entity_name = pe.parent_entity_name  -- Check parent type
    AND rbac.active_flag = true
  LEFT JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}
    AND eim.active_flag = true
  WHERE COALESCE(emp.permission, -1) >= 0  -- Has VIEW on parent
     OR COALESCE(rbac.permission, -1) >= 0
)
```

**Rule**: If employee/role has VIEW (0+) on ANY parent type → child gains VIEW

**Example Scenario**:

```
1. Employee has VIEW on 'business' entity type
2. Business is a parent of 'project' (per d_entity.child_entities)
3. Therefore: Employee gains VIEW on all projects under that business
```

**Why LEFT JOIN**:
- LEFT JOIN ensures we check both direct employee permissions AND role permissions
- COALESCE handles NULL from unmatched joins

**Output**: Returns `0` (VIEW permission) if any parent relationship grants access

---

#### CTE 5: Parent-CREATE Inheritance

```sql
parent_create AS (
  SELECT 4 AS permission  -- CREATE level
  FROM parent_entities pe
  LEFT JOIN app.d_entity_rbac emp
    ON emp.person_entity_name = 'employee'
    AND emp.person_entity_id = ${userId}
    AND emp.entity_name = pe.parent_entity_name
    AND emp.active_flag = true
  LEFT JOIN app.d_entity_rbac rbac
    ON rbac.person_entity_name = 'role'
    AND rbac.entity_name = pe.parent_entity_name
    AND rbac.active_flag = true
  LEFT JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}
    AND eim.active_flag = true
  WHERE COALESCE(emp.permission, -1) >= 4  -- Has CREATE on parent
     OR COALESCE(rbac.permission, -1) >= 4
)
```

**Rule**: If employee/role has CREATE (4+) on ANY parent type → child gains CREATE

**Example Scenario**:

```
1. Employee has CREATE on 'project' entity type
2. Project is a parent of 'task' (per d_entity.child_entities)
3. Therefore: Employee can CREATE tasks under projects
```

**Why Separate from VIEW**:
- CREATE is higher privilege (4 vs 0)
- Prevents accidental privilege escalation
- Explicit about what permission is inherited

---

#### Final UNION + MAX

```sql
SELECT COALESCE(MAX(permission), -1) AS max_permission
FROM (
  SELECT * FROM direct_emp       -- Direct employee permissions
  UNION ALL SELECT * FROM role_based    -- Role-based permissions
  UNION ALL SELECT * FROM parent_view   -- Parent VIEW inheritance
  UNION ALL SELECT * FROM parent_create -- Parent CREATE inheritance
) AS all_perms
```

**Resolution Logic**:

1. **UNION ALL**: Combine all permission sources (no de-duplication needed)
2. **MAX()**: Take highest permission level
3. **COALESCE(-1)**: Return -1 if no permissions found (no access)

**Example Result**:

| Source | Permission |
|--------|------------|
| direct_emp | 1 (EDIT) |
| role_based | 5 (OWNER) |
| parent_view | 0 (VIEW) |
| parent_create | NULL |
| **MAX** | **5** |

**Interpretation**: User has OWNER permission (highest of all sources)

---

### Building Block 2: `data_gate_EntityIdsByEntityType()`

**Purpose**: Get ALL entity IDs a user can access (for bulk filtering)

**Signature**:

```typescript
async function data_gate_EntityIdsByEntityType(
  userId: string,
  entityName: string,
  permission: number = 0
): Promise<string[]>
```

**High-Level Flow**:

```
1. Check type-level permission (ALL_ENTITIES_ID)
   ├─ If yes → return ['11111111-1111-...'] (special marker)
   └─ If no → continue to step 2

2. Collect instance-level permissions from 7 CTEs:
   ├─ Direct employee permissions
   ├─ Role-based permissions
   ├─ Parent entities with VIEW
   ├─ Children from parent-VIEW inheritance
   ├─ Parent entities with CREATE
   └─ Children from parent-CREATE inheritance

3. UNION all sources + DISTINCT
4. Return array of entity UUIDs
```

**Special Marker**: `'11111111-1111-1111-1111-111111111111'`

If returned, it means "user has type-level access to ALL entities of this type"

**SQL Structure** (7 CTEs):

```sql
WITH

-- CTE 1: PARENT ENTITY TYPES
parent_entities AS (
  SELECT d.code AS parent_entity_name
  FROM app.d_entity d
  WHERE ${entityName} = ANY(SELECT jsonb_array_elements_text(d.child_entities))
),

-- CTE 2: DIRECT EMPLOYEE PERMISSIONS (instance-level only)
direct_emp AS (
  SELECT entity_id, permission
  FROM app.d_entity_rbac
  WHERE person_entity_name = 'employee'
    AND person_entity_id = ${userId}
    AND entity_name = ${entityName}
    AND entity_id != ALL_ENTITIES_ID  -- Exclude type-level
    AND active_flag = true
),

-- CTE 3: ROLE-BASED PERMISSIONS (instance-level only)
role_based AS (
  SELECT rbac.entity_id, rbac.permission
  FROM app.d_entity_rbac rbac
  INNER JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}
    AND eim.active_flag = true
  WHERE rbac.person_entity_name = 'role'
    AND rbac.entity_name = ${entityName}
    AND rbac.entity_id != ALL_ENTITIES_ID  -- Exclude type-level
    AND rbac.active_flag = true
),

-- CTE 4: PARENT ENTITIES WITH VIEW PERMISSION
parents_with_view AS (
  SELECT DISTINCT emp.entity_id AS parent_id, pe.parent_entity_name
  FROM parent_entities pe
  INNER JOIN app.d_entity_rbac emp
    ON emp.entity_name = pe.parent_entity_name
    AND emp.permission >= 0
    AND emp.active_flag = true
  WHERE emp.person_entity_name = 'employee'
    AND emp.person_entity_id = ${userId}

  UNION

  SELECT DISTINCT rbac.entity_id AS parent_id, pe.parent_entity_name
  FROM parent_entities pe
  INNER JOIN app.d_entity_rbac rbac
    ON rbac.entity_name = pe.parent_entity_name
    AND rbac.permission >= 0
    AND rbac.active_flag = true
  INNER JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}
    AND eim.active_flag = true
  WHERE rbac.person_entity_name = 'role'
),

-- CTE 5: CHILDREN FROM PARENT-VIEW INHERITANCE
parent_view_children AS (
  SELECT DISTINCT eim.child_entity_id AS entity_id, 0 AS permission
  FROM parents_with_view pwv
  INNER JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = pwv.parent_entity_name
    AND eim.parent_entity_id = pwv.parent_id
    AND eim.child_entity_type = ${entityName}
    AND eim.active_flag = true
),

-- CTE 6: PARENT ENTITIES WITH CREATE PERMISSION
parents_with_create AS (
  -- Similar to CTE 4, but checks permission >= 4
),

-- CTE 7: CHILDREN FROM PARENT-CREATE INHERITANCE
parent_create_children AS (
  -- Similar to CTE 5, but grants permission 4
)

-- FINAL: UNION + DISTINCT
SELECT DISTINCT entity_id
FROM (
  SELECT entity_id, permission FROM direct_emp
  UNION ALL SELECT entity_id, permission FROM role_based
  UNION ALL SELECT entity_id, permission FROM parent_view_children
  UNION ALL SELECT entity_id, permission FROM parent_create_children
) AS all_permissions
WHERE permission >= ${requiredPermission}
```

**CTE Breakdown**:

#### CTE 4: Parents With VIEW Permission

```sql
parents_with_view AS (
  -- Check direct employee permissions on parent types
  SELECT DISTINCT emp.entity_id AS parent_id, pe.parent_entity_name
  FROM parent_entities pe
  INNER JOIN app.d_entity_rbac emp
    ON emp.entity_name = pe.parent_entity_name
    AND emp.permission >= 0  -- VIEW or higher
    AND emp.active_flag = true
  WHERE emp.person_entity_name = 'employee'
    AND emp.person_entity_id = ${userId}

  UNION

  -- Check role permissions on parent types
  SELECT DISTINCT rbac.entity_id AS parent_id, pe.parent_entity_name
  FROM parent_entities pe
  INNER JOIN app.d_entity_rbac rbac
    ON rbac.entity_name = pe.parent_entity_name
    AND rbac.permission >= 0
    AND rbac.active_flag = true
  INNER JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = ${userId}
    AND eim.active_flag = true
  WHERE rbac.person_entity_name = 'role'
)
```

**What it does**:
1. Finds parent entity types (from CTE 1)
2. Checks if employee/role has VIEW+ on those parent instances
3. Returns parent IDs that grant access

**Example Output**:

| parent_id | parent_entity_name |
|-----------|-------------------|
| business-uuid-1 | business |
| business-uuid-2 | business |
| project-uuid-3 | project |

**Purpose**: Prepares for CTE 5 to find children under these parents

---

#### CTE 5: Children From Parent-VIEW Inheritance

```sql
parent_view_children AS (
  SELECT DISTINCT eim.child_entity_id AS entity_id, 0 AS permission
  FROM parents_with_view pwv
  INNER JOIN app.d_entity_instance_link eim
    ON eim.parent_entity_type = pwv.parent_entity_name
    AND eim.parent_entity_id = pwv.parent_id
    AND eim.child_entity_type = ${entityName}
    AND eim.active_flag = true
)
```

**What it does**:
1. Takes parent IDs from CTE 4
2. Looks up children in `d_entity_instance_link`
3. Filters to only children of type `${entityName}`

**Example Flow**:

```
CTE 4 Output: business-uuid-1, business-uuid-2

CTE 5 Query:
- Find all children where parent = business-uuid-1 AND child_type = 'project'
- Find all children where parent = business-uuid-2 AND child_type = 'project'

Result: [project-uuid-a, project-uuid-b, project-uuid-c]
```

**Grant**: Permission 0 (VIEW) on all these children

---

**Return Value Examples**:

```typescript
// Type-level access
['11111111-1111-1111-1111-111111111111']

// Instance-level access (multiple entities)
['abc-123', 'def-456', 'ghi-789']

// No access
[]
```

---

## RBAC Gate: Deep Dive

### Public API: `unified_data_gate.rbac_gate`

**Namespace Structure**:

```typescript
unified_data_gate.rbac_gate = {
  getFilteredIds(),     // Returns string[]
  getWhereCondition(),  // Returns SQL fragment
  check_entity_rbac(),    // Returns boolean
  gate: {
    create(),           // Throws 403 if denied
    update(),           // Throws 403 if denied
    delete()            // Throws 403 if denied
  }
}
```

---

### Method 1: `getWhereCondition()`

**Purpose**: Generate SQL WHERE condition for RBAC filtering

**Signature**:

```typescript
getWhereCondition: async (
  userId: string,
  entityType: string,
  requiredPermission: number = Permission.VIEW,
  tableAlias: string = 'e'
): Promise<SQL>
```

**Internal Logic**:

```typescript
const accessibleIds = await data_gate_EntityIdsByEntityType(userId, entityType, requiredPermission);

// Case 1: No access at all
if (accessibleIds.length === 0) {
  return sql`FALSE`;  // SQL condition that always fails
}

// Case 2: Type-level access
const hasTypeLevelAccess = accessibleIds.includes('11111111-1111-...');
if (hasTypeLevelAccess) {
  return sql`TRUE`;  // SQL condition that always passes
}

// Case 3: Instance-level filtering
return sql`${sql.raw(tableAlias)}.id = ANY(${accessibleIds}::uuid[])`;
```

**Generated SQL Examples**:

```sql
-- No access
WHERE FALSE

-- Type-level access (no filtering needed)
WHERE TRUE

-- Instance-level access
WHERE e.id = ANY(ARRAY['abc-123', 'def-456', 'ghi-789']::uuid[])
```

**Usage in Route**:

```typescript
const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
  userId, 'project', Permission.VIEW, 'e'
);

const query = sql`
  SELECT e.* FROM app.d_project e
  WHERE ${rbacCondition}
`;
```

**Why SQL Fragments**:
- ✅ Server-side filtering (no N+1 queries)
- ✅ Composable with other conditions
- ✅ Database-optimized (uses indexes)
- ✅ No post-query filtering needed

---

### Method 2: `check_entity_rbac()`

**Purpose**: Boolean check for single entity (no SQL generation)

**Signature**:

```typescript
checkPermission: async (
  db: any,
  userId: string,
  entityType: string,
  entityId: string | 'all',
  requiredPermission: number
): Promise<boolean>
```

**Internal Logic**:

```typescript
const checkId = entityId === 'all'
  ? '11111111-1111-1111-1111-111111111111'
  : entityId;

const accessibleIds = await data_gate_EntityIdsByEntityType(userId, entityType, requiredPermission);

if (accessibleIds.length === 0) return false;

return accessibleIds.includes('11111111-1111-...') || accessibleIds.includes(checkId);
```

**Usage**:

```typescript
// Check if user can edit specific project
const canEdit = await unified_data_gate.rbac_gate.check_entity_rbac(
  db, userId, 'project', projectId, Permission.EDIT
);

if (canEdit) {
  // Proceed with update
}
```

---

### Method 3: `gate.create/update/delete()`

**Purpose**: Throw 403 if permission denied (middleware-style)

**Signature**:

```typescript
gate: {
  create: async (userId: string, entityName: string) => void,
  update: async (userId: string, entityName: string, entityId: string) => void,
  delete: async (userId: string, entityName: string, entityId: string) => void
}
```

**Implementation**:

```typescript
create: async (userId: string, entityName: string) => {
  const maxLevel = await getMaxPermissionLevelOfEntityID(
    userId, entityName, ALL_ENTITIES_ID
  );

  if (maxLevel < PermissionLevel.CREATE) {
    throw {
      statusCode: 403,
      error: 'Forbidden',
      message: `Insufficient permissions to create ${entityName}`
    };
  }
}
```

**Usage in Route**:

```typescript
// POST /api/v1/project
fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;

  // Throws 403 if user lacks CREATE permission
  await unified_data_gate.rbac_gate.gate.create(userId, 'project');

  // If reaches here, user can create projects
  const result = await createProject(...);
  return result;
});
```

---

## Parent-Child Filtering Gate: Deep Dive

### Public API: `unified_data_gate.parent_child_filtering_gate`

**Namespace Structure**:

```typescript
unified_data_gate.parent_child_filtering_gate = {
  getJoinClause(),        // Returns SQL JOIN fragment
  getFilteredEntities()   // LEGACY: Full query builder
}
```

---

### Method: `getJoinClause()`

**Purpose**: Generate SQL JOIN to filter children by parent

**Signature**:

```typescript
getJoinClause: (
  childEntityType: string,
  parentEntityType: string,
  parentEntityId: string,
  tableAlias: string = 'e'
): SQL
```

**Generated SQL**:

```sql
INNER JOIN app.d_entity_instance_link eim ON (
  eim.child_entity_id = ${tableAlias}.id
  AND eim.parent_entity_type = ${parentEntityType}
  AND eim.parent_entity_id = ${parentEntityId}::uuid
  AND eim.child_entity_type = ${childEntityType}
  AND eim.active_flag = true
)
```

**What it does**:
1. Joins entity table with `d_entity_instance_link`
2. Filters to children of specific parent
3. Ensures relationship is active

**Usage**:

```typescript
// GET /api/v1/business/:id/project
const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
  'project', 'business', businessId, 'e'
);

const query = sql`
  SELECT DISTINCT e.*
  FROM app.d_project e
  ${parentJoin}
  WHERE ${rbacCondition}
`;
```

**Expanded SQL Example**:

```sql
SELECT DISTINCT e.*
FROM app.d_project e
INNER JOIN app.d_entity_instance_link eim ON (
  eim.child_entity_id = e.id
  AND eim.parent_entity_type = 'business'
  AND eim.parent_entity_id = 'abc-123-business-uuid'::uuid
  AND eim.child_entity_type = 'project'
  AND eim.active_flag = true
)
WHERE e.id = ANY(...)  -- RBAC condition
```

**Why INNER JOIN**:
- Filters to ONLY children of specified parent
- Excludes orphaned entities
- Ensures active relationships only

---

## SQL Generation Patterns

### Pattern 1: Composable Conditions

**Anti-Pattern** (Hard to compose):

```typescript
// ❌ Middleware blocks request
preHandler: [requirePermission('project', 'view')]
```

**Correct Pattern** (Composable):

```typescript
// ✅ Route builds SQL, gates augment it
const conditions: SQL[] = [];

// Add RBAC
const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(...);
conditions.push(rbacCondition);

// Add parent filter
if (parent_type && parent_id) {
  const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(...);
  joins.push(parentJoin);
}

// Add auto-filters
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
conditions.push(...autoFilters);

// Compose final query
const query = sql`
  SELECT DISTINCT e.*
  FROM app.d_project e
  ${sql.join(joins, sql` `)}
  WHERE ${sql.join(conditions, sql` AND `)}
`;
```

**Benefits**:
- ✅ Flexible: Route controls structure
- ✅ Composable: Combine multiple gates
- ✅ Testable: Each gate tested independently
- ✅ Debuggable: SQL visible in logs

---

### Pattern 2: DISTINCT for Joins

**Problem**: Multiple JOINs can create duplicates

```sql
-- Without DISTINCT
SELECT e.*
FROM app.d_project e
INNER JOIN app.d_entity_instance_link eim1 ON (...)  -- Parent filter
INNER JOIN app.d_entity_instance_link eim2 ON (...)  -- RBAC inheritance

-- Result: Duplicate rows if project has multiple parent relationships
```

**Solution**: Always use DISTINCT

```sql
SELECT DISTINCT e.*
FROM app.d_project e
INNER JOIN app.d_entity_instance_link eim ON (...)
WHERE ${conditions}
```

**Performance**: PostgreSQL optimizes DISTINCT with indexes on primary keys

---

### Pattern 3: Table Alias Consistency

**DRY Principle**: Define table alias once

```typescript
const TABLE_ALIAS = 'e';  // Module constant

// Use everywhere
const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
  userId, ENTITY_TYPE, Permission.VIEW, TABLE_ALIAS
);

const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
  ENTITY_TYPE, parent_type, parent_id, TABLE_ALIAS
);

const query = sql`
  SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
  FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
  ${joins}
  WHERE ${conditions}
`;
```

---

### Pattern 4: Parallel Count + Data Queries

**Efficient Pagination**:

```typescript
const [countResult, dataResult] = await Promise.all([
  db.execute(sql`
    SELECT COUNT(DISTINCT e.id) as total
    FROM app.d_project e
    ${joins}
    ${whereClause}
  `),
  db.execute(sql`
    SELECT DISTINCT e.*
    FROM app.d_project e
    ${joins}
    ${whereClause}
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `)
]);
```

**Benefits**:
- ✅ Single database round-trip
- ✅ Consistent filtering (same WHERE clause)
- ✅ Fast pagination metadata

---

## Composability Pattern

### Integration Flow

```typescript
// STEP 1: Initialize SQL components
const joins: SQL[] = [];
const conditions: SQL[] = [];

// STEP 2: GATE 1 - RBAC (REQUIRED)
const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
  userId, ENTITY_TYPE, Permission.VIEW, TABLE_ALIAS
);
conditions.push(rbacCondition);

// STEP 3: GATE 2 - Parent-Child Filtering (OPTIONAL)
if (parent_type && parent_id) {
  const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
    ENTITY_TYPE, parent_type, parent_id, TABLE_ALIAS
  );
  joins.push(parentJoin);
}

// STEP 4: Auto-Filters (OPTIONAL)
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
conditions.push(...autoFilters);

// STEP 5: Custom Filters (OPTIONAL)
if (request.query.active === 'true') {
  conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
}

// STEP 6: Compose Final SQL
const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;
const whereClause = conditions.length > 0
  ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
  : sql``;

const query = sql`
  SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
  FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
  ${joinClause}
  ${whereClause}
  ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
  LIMIT ${limit} OFFSET ${offset}
`;
```

---

## Integration Patterns

### Pattern 1: Standard LIST Endpoint

```typescript
fastify.get('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: {
    querystring: Type.Object({
      parent_type: Type.Optional(Type.String()),
      parent_id: Type.Optional(Type.String({ format: 'uuid' })),
      page: Type.Optional(Type.Number({ minimum: 1 })),
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 }))
    })
  }
}, async (request, reply) => {
  const userId = request.user.sub;
  const { parent_type, parent_id, page = 1, limit = 20 } = request.query;

  const joins: SQL[] = [];
  const conditions: SQL[] = [];

  // RBAC Gate (mandatory)
  const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
    userId, ENTITY_TYPE, Permission.VIEW, TABLE_ALIAS
  );
  conditions.push(rbacCondition);

  // Parent-Child Gate (optional)
  if (parent_type && parent_id) {
    const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
      ENTITY_TYPE, parent_type, parent_id, TABLE_ALIAS
    );
    joins.push(parentJoin);
  }

  // Auto-Filters
  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
  conditions.push(...autoFilters);

  // Active flag filter
  conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);

  // Compose query
  const joinClause = joins.length > 0 ? sql.join(joins, sql` `) : sql``;
  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
  const offset = (page - 1) * limit;

  const [countResult, dataResult] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(DISTINCT ${sql.raw(TABLE_ALIAS)}.id) as total
      FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
      ${joinClause}
      ${whereClause}
    `),
    db.execute(sql`
      SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
      FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
      ${joinClause}
      ${whereClause}
      ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `)
  ]);

  return createPaginatedResponse(
    dataResult,
    Number(countResult[0].total),
    limit,
    offset
  );
});
```

---

### Pattern 2: Standard CREATE Endpoint

```typescript
fastify.post('/api/v1/project', {
  preHandler: [fastify.authenticate],
  schema: {
    querystring: Type.Object({
      parent_type: Type.Optional(Type.String()),
      parent_id: Type.Optional(Type.String({ format: 'uuid' }))
    }),
    body: Type.Object({
      name: Type.String(),
      descr: Type.Optional(Type.String()),
      // ... other fields
    })
  }
}, async (request, reply) => {
  const userId = request.user.sub;
  const { parent_type, parent_id } = request.query;

  // STEP 1: Check CREATE permission
  await unified_data_gate.rbac_gate.gate.create(userId, ENTITY_TYPE);

  // STEP 2: Create entity
  const result = await db.execute(sql`
    INSERT INTO app.d_${sql.raw(ENTITY_TYPE)} (name, descr, ...)
    VALUES (${request.body.name}, ${request.body.descr}, ...)
    RETURNING *
  `);

  const newEntity = result[0];

  // STEP 3: Create linkage (if parent provided)
  if (parent_type && parent_id) {
    await set_entity_instance_link(db, {
      parent_entity_type: parent_type,
      parent_entity_id: parent_id,
      child_entity_type: ENTITY_TYPE,
      child_entity_id: newEntity.id
    });
  }

  // STEP 4: Auto-grant OWNER permission to creator
  await db.execute(sql`
    INSERT INTO app.d_entity_rbac
    (person_entity_name, person_entity_id, entity_name, entity_id, permission, active_flag)
    VALUES ('employee', ${userId}, ${ENTITY_TYPE}, ${newEntity.id}, 5, true)
  `);

  return newEntity;
});
```

---

### Pattern 3: Factory Child Endpoints

```typescript
// Single line creates all child endpoints
await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);

// Expands to:
// GET /api/v1/project/:id/task
// GET /api/v1/project/:id/wiki
// GET /api/v1/project/:id/artifact
// GET /api/v1/project/:id/form
// GET /api/v1/project/:id/expense
// GET /api/v1/project/:id/revenue
```

**Internal Implementation**:

```typescript
export async function createChildEntityEndpointsFromMetadata(
  fastify: FastifyInstance,
  parentEntityType: string
) {
  // Query d_entity.child_entities
  const result = await db.execute(sql`
    SELECT child_entities FROM app.d_entity
    WHERE code = ${parentEntityType} AND active_flag = true
  `);

  const childEntities = result[0]?.child_entities || [];

  // Create endpoint for each child
  for (const childConfig of childEntities) {
    const childType = childConfig.entity;

    fastify.get(`/api/v1/${parentEntityType}/:id/${childType}`, {
      preHandler: [fastify.authenticate],
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        querystring: Type.Object({
          page: Type.Optional(Type.Number()),
          limit: Type.Optional(Type.Number())
        })
      }
    }, async (request, reply) => {
      const { id: parentId } = request.params;
      const { page = 1, limit = 20 } = request.query;
      const userId = request.user.sub;

      const joins: SQL[] = [];
      const conditions: SQL[] = [];

      // RBAC on child entity
      const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
        userId, childType, Permission.VIEW, 'c'
      );
      conditions.push(rbacCondition);

      // Parent-child filtering
      const parentJoin = unified_data_gate.parent_child_filtering_gate.getJoinClause(
        childType, parentEntityType, parentId, 'c'
      );
      joins.push(parentJoin);

      // Execute query
      const [countResult, dataResult] = await Promise.all([
        db.execute(sql`
          SELECT COUNT(DISTINCT c.id) as total
          FROM app.${sql.raw(getTableName(childType))} c
          ${sql.join(joins, sql` `)}
          WHERE ${sql.join(conditions, sql` AND `)} AND c.active_flag = true
        `),
        db.execute(sql`
          SELECT DISTINCT c.*
          FROM app.${sql.raw(getTableName(childType))} c
          ${sql.join(joins, sql` `)}
          WHERE ${sql.join(conditions, sql` AND `)} AND c.active_flag = true
          ORDER BY c.created_ts DESC
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `)
      ]);

      return createPaginatedResponse(
        dataResult,
        Number(countResult[0].total),
        limit,
        (page - 1) * limit
      );
    });
  }
}
```

---

## Performance Optimization

### 1. Database Indexes

**Critical Indexes**:

```sql
-- d_entity_rbac
CREATE INDEX idx_rbac_person ON app.d_entity_rbac(person_entity_id, entity_name, active_flag);
CREATE INDEX idx_rbac_entity ON app.d_entity_rbac(entity_name, entity_id, active_flag);

-- d_entity_instance_link
CREATE INDEX idx_eim_parent ON app.d_entity_instance_link(parent_entity_type, parent_entity_id, active_flag);
CREATE INDEX idx_eim_child ON app.d_entity_instance_link(child_entity_type, child_entity_id, active_flag);

-- Entity tables
CREATE INDEX idx_project_active ON app.d_project(active_flag) WHERE active_flag = true;
CREATE INDEX idx_project_created ON app.d_project(created_ts DESC);
```

---

### 2. CTE Optimization

**PostgreSQL CTE Fence**: CTEs are optimization fences

**Mitigation**: Use `INNER JOIN` instead of CTEs when possible

**Example**:

```sql
-- Slower (CTE fence)
WITH accessible_ids AS (
  SELECT id FROM ... WHERE rbac_check
)
SELECT e.* FROM app.d_project e
WHERE e.id IN (SELECT id FROM accessible_ids)

-- Faster (subquery inlined)
SELECT e.* FROM app.d_project e
WHERE e.id = ANY(${accessibleIds}::uuid[])
```

---

### 3. Parallel Queries

```typescript
// ❌ Sequential (slow)
const count = await getCount();
const data = await getData();

// ✅ Parallel (fast)
const [count, data] = await Promise.all([
  getCount(),
  getData()
]);
```

---

### 4. Type-Level Access Optimization

**Check Type-Level First**:

```typescript
// Check type-level before querying instance-level
const typeLevel = await getMaxPermissionLevelOfEntityID(
  userId, entityName, ALL_ENTITIES_ID
);

if (typeLevel >= permission) {
  // User has type-level access - no filtering needed
  return sql`TRUE`;
}

// Otherwise, query instance-level permissions
const accessibleIds = await data_gate_EntityIdsByEntityType(...);
```

**Benefit**: Skips expensive instance queries if user has type-level access

---

## Error Handling & Edge Cases

### Edge Case 1: No Permissions

**Scenario**: User has zero permissions on entity type

**Handling**:

```typescript
const accessibleIds = await data_gate_EntityIdsByEntityType(userId, entityType, permission);

if (accessibleIds.length === 0) {
  return sql`FALSE`;  // WHERE FALSE → returns empty result set
}
```

**SQL**:

```sql
SELECT * FROM app.d_project WHERE FALSE;
-- Returns 0 rows (not an error)
```

**Why Not Throw Error**:
- ✅ Graceful degradation (empty list)
- ✅ Consistent API response (200 with empty data)
- ✅ No special error handling needed

---

### Edge Case 2: Expired Permissions

**Scenario**: Permission exists but expired

**Handling**:

```sql
WHERE active_flag = true
  AND (expires_ts IS NULL OR expires_ts > NOW())
```

**Automatic Filtering**: Expired permissions excluded from all queries

---

### Edge Case 3: Circular Parent Relationships

**Scenario**: Entity A → Entity B → Entity A

**Prevention**: Application logic should prevent circular linkages

**Detection**:

```sql
-- Check for circular references
WITH RECURSIVE hierarchy AS (
  SELECT parent_entity_id, child_entity_id, 1 as depth
  FROM app.d_entity_instance_link
  WHERE child_entity_id = ${startId}

  UNION ALL

  SELECT m.parent_entity_id, m.child_entity_id, h.depth + 1
  FROM app.d_entity_instance_link m
  INNER JOIN hierarchy h ON m.child_entity_id = h.parent_entity_id
  WHERE h.depth < 10  -- Prevent infinite loops
)
SELECT * FROM hierarchy WHERE parent_entity_id = child_entity_id;
```

---

### Edge Case 4: NULL Entity IDs

**Scenario**: UUID field is NULL

**Handling**:

```sql
-- Casting ensures type safety
WHERE entity_id = ${entityId}::uuid

-- If entityId is NULL or invalid, PostgreSQL throws error
-- Caught by Fastify schema validation
```

**Prevention**: Use TypeBox schema validation

```typescript
schema: {
  params: Type.Object({
    id: Type.String({ format: 'uuid' })
  })
}
```

---

### Edge Case 5: Role Membership Changes

**Scenario**: Employee added to/removed from role

**Immediate Effect**: Permission changes apply instantly

**Why**: Queries always check current `d_entity_instance_link` state

```sql
-- Always fetches CURRENT role memberships
INNER JOIN app.d_entity_instance_link eim
  ON eim.parent_entity_type = 'role'
  AND eim.child_entity_type = 'employee'
  AND eim.child_entity_id = ${userId}
  AND eim.active_flag = true  -- Only active relationships
```

**No Caching**: Permissions NOT cached (always fresh)

---

### Edge Case 6: Multiple Permission Sources Conflict

**Scenario**: Direct permission = 1 (EDIT), Role permission = 5 (OWNER)

**Resolution**: MAX() wins

```sql
SELECT MAX(permission) FROM (
  SELECT 1 AS permission  -- Direct
  UNION ALL
  SELECT 5 AS permission  -- Role
) all_perms
-- Result: 5 (OWNER)
```

**Rule**: Highest permission always wins (no restrictions from lower sources)

---

## Summary: Key Principles

### 1. **Composability Over Middleware**
- Routes own SQL queries
- Gates augment with security/filtering
- Flexible, testable, debuggable

### 2. **Server-Side Filtering**
- All filtering in SQL
- No N+1 queries
- No post-query filtering
- Database indexes utilized

### 3. **Hierarchical Permissions**
- Single integer 0-5
- Higher implies all lower
- MAX() resolution from multiple sources

### 4. **Parent Inheritance**
- VIEW on parent → VIEW on children
- CREATE on parent → CREATE on children
- Automatic, no explicit grants needed

### 5. **Flexible Relationships**
- No foreign keys
- Many-to-many via d_entity_instance_link
- Soft deletable
- Polymorphic

### 6. **Database-Driven Metadata**
- d_entity table = single source of truth
- Factory endpoints from metadata
- Self-maintaining as data changes

---

## Reference Implementation

**Complete Example**: `apps/api/src/modules/project/routes.ts`

**Key Files**:
- `apps/api/src/lib/unified-data-gate.ts` - Core implementation
- `apps/api/src/lib/child-entity-route-factory.ts` - Factory pattern
- `apps/api/src/services/linkage.service.ts` - Relationship management
- `db/entity_configuration_settings/02_entity.ddl` - Metadata structure

---

**Version**: 1.0.0 | **Last Updated**: 2025-11-16 | **Status**: Production-Ready

**Changelog**:
- v1.0.0 (2025-11-16): Initial comprehensive technical documentation
