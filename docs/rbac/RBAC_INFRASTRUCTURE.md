# RBAC Infrastructure

> **Authoritative documentation for the PMO platform's Role-Based Access Control system**

**Version:** 6.0.0 | **Location:** `apps/api/src/services/entity-infrastructure.service.ts`

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Permission Levels](#permission-levels)
4. [Infrastructure Tables](#infrastructure-tables)
5. [Permission Resolution Algorithm](#permission-resolution-algorithm)
6. [Request Flow Patterns](#request-flow-patterns)
7. [Service Methods](#service-methods)
8. [Route Integration Patterns](#route-integration-patterns)
9. [Caching Strategy](#caching-strategy)
10. [Query Patterns](#query-patterns)
11. [Design Principles](#design-principles)
12. [Related Documentation](#related-documentation)

---

## Overview

The PMO platform uses a **person-based RBAC system** with 4 infrastructure tables managed by the Entity Infrastructure Service. All relationships use linkage tables instead of foreign keys.

**Core Principles:**
- No foreign keys - use `entity_instance_link` for relationships
- Hard delete for infrastructure tables (no `active_flag`)
- Permissions inherit hierarchically (higher level implies lower)
- Permission resolution considers 4 sources (direct, role, parent-VIEW, parent-CREATE)

---

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              RBAC SYSTEM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │                        4 INFRASTRUCTURE TABLES                                   ││
│  ├───────────────┬─────────────────┬─────────────────┬─────────────────────────────┤│
│  │    entity     │ entity_instance │ entity_instance │       entity_rbac           ││
│  │   (types)     │   (registry)    │     _link       │     (permissions)           ││
│  │               │                 │ (relationships) │                             ││
│  │  HAS active_  │   HARD DELETE   │   HARD DELETE   │       HARD DELETE           ││
│  │     flag      │  (no active_)   │  (no active_)   │     (no active_)            ││
│  └───────────────┴─────────────────┴─────────────────┴─────────────────────────────┘│
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │                     ENTITY INFRASTRUCTURE SERVICE                                ││
│  │                                                                                  ││
│  │   Permission Methods          Registry Methods         Link Methods             ││
│  │   ──────────────────          ────────────────         ────────────             ││
│  │   check_entity_rbac()         set_entity_instance_     set_entity_instance_     ││
│  │   get_entity_rbac_where_        registry()               link()                 ││
│  │     condition()               update_entity_instance_  get_entity_instance_     ││
│  │   set_entity_rbac()             registry()               link_children()        ││
│  │   set_entity_rbac_owner()     delete_entity_instance_  delete_entity_instance_  ││
│  │   delete_entity_rbac()          registry()               link()                 ││
│  │                                                                                  ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │                     TRANSACTIONAL CRUD METHODS                                   ││
│  │                                                                                  ││
│  │   create_entity()    →  INSERT + registry + RBAC owner + link (ONE transaction) ││
│  │   update_entity()    →  UPDATE + registry sync (ONE transaction)                ││
│  │   delete_entity()    →  DELETE + cleanup all infrastructure (ONE transaction)   ││
│  │                                                                                  ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Permission Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION RESOLUTION ORDER                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  User requests access to entity                                                      │
│           │                                                                          │
│           ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  SOURCE 1: Direct Employee Permissions                                          ││
│  │  ─────────────────────────────────────                                          ││
│  │  SELECT permission FROM entity_rbac                                             ││
│  │  WHERE person_code = 'employee' AND person_id = {userId}                        ││
│  │  AND entity_code = {entityCode}                                                 ││
│  │  AND (entity_instance_id = ALL_ENTITIES_ID OR entity_instance_id = {entityId}) ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│           │                                                                          │
│           ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  SOURCE 2: Role-Based Permissions                                               ││
│  │  ────────────────────────────────                                               ││
│  │  SELECT rbac.permission FROM entity_rbac rbac                                   ││
│  │  INNER JOIN entity_instance_link eil                                            ││
│  │    ON eil.entity_code = 'role'                                                  ││
│  │    AND eil.entity_instance_id = rbac.person_id                                  ││
│  │    AND eil.child_entity_code = 'employee'                                       ││
│  │    AND eil.child_entity_instance_id = {userId}                                  ││
│  │  WHERE rbac.person_code = 'role'                                                ││
│  │  AND rbac.entity_code = {entityCode}                                            ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│           │                                                                          │
│           ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  SOURCE 3: Parent-VIEW Inheritance                                              ││
│  │  ─────────────────────────────────                                              ││
│  │  If user has VIEW (permission >= 0) on a PARENT entity type,                    ││
│  │  AND this entity is a child (defined in parent.child_entity_codes),             ││
│  │  THEN user inherits VIEW permission on this entity                              ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│           │                                                                          │
│           ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  SOURCE 4: Parent-CREATE Inheritance                                            ││
│  │  ────────────────────────────────────                                           ││
│  │  If user has CREATE (permission >= 6) on a PARENT entity type,                  ││
│  │  AND this entity is a child (defined in parent.child_entity_codes),             ││
│  │  THEN user inherits CREATE permission on this entity                            ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│           │                                                                          │
│           ▼                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐│
│  │  FINAL RESULT: MAX(all sources) >= required_permission ?                        ││
│  └─────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Permission Levels

```typescript
/**
 * Permission levels enum (0-7 numeric hierarchy)
 *
 * Inheritance Rule: Higher permission level implies ALL lower levels.
 * OWNER [7] >= CREATE [6] >= DELETE [5] >= SHARE [4] >= EDIT [3] >= CONTRIBUTE [2] >= COMMENT [1] >= VIEW [0]
 */
export enum Permission {
  VIEW       = 0,  // Read access to entity data
  COMMENT    = 1,  // Add comments on entities (implies VIEW)
  CONTRIBUTE = 2,  // Insert data in forms, collaborate on wiki (implies COMMENT, VIEW)
  EDIT       = 3,  // Modify entity fields (implies CONTRIBUTE, COMMENT, VIEW)
  SHARE      = 4,  // Share entity with others (implies EDIT and below)
  DELETE     = 5,  // Soft delete entity (implies SHARE and below)
  CREATE     = 6,  // Create new entities - TYPE-LEVEL ONLY (implies DELETE and below)
  OWNER      = 7   // Full control including permission management (implies ALL)
}

/**
 * Special entity ID for type-level permissions
 * Grants permission to ALL instances of an entity type
 */
export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
```

### Permission Use Cases

| Permission | Use Case | Example |
|------------|----------|---------|
| VIEW (0) | Read entity data | View project details |
| COMMENT (1) | Add discussion comments | Comment on task progress |
| CONTRIBUTE (2) | Submit form data | Fill out task data form |
| EDIT (3) | Modify entity fields | Update project budget |
| SHARE (4) | Grant access to others | Share project with team member |
| DELETE (5) | Soft delete records | Archive completed project |
| CREATE (6) | Create new instances | Create new project (type-level) |
| OWNER (7) | Full control | Manage all project permissions |

---

## Infrastructure Tables

### 1. entity (Type Metadata)

**Purpose:** Stores entity type definitions with UI metadata and child relationships.

| Column | Type | Description |
|--------|------|-------------|
| `code` | varchar | Primary key - entity type code (e.g., 'project', 'task') |
| `name` | varchar | Display name |
| `ui_label` | varchar | UI label for navigation |
| `ui_icon` | varchar | Lucide icon name |
| `child_entity_codes` | jsonb | Array of child entity codes |
| `display_order` | int | Navigation order |
| `active_flag` | boolean | **Soft delete flag** |
| `db_table` | varchar | Optional custom table name |

**Delete Behavior:** Soft delete (`active_flag = false`)

**Example:**
```json
{
  "code": "project",
  "name": "Project",
  "ui_label": "Projects",
  "ui_icon": "folder",
  "child_entity_codes": ["task", "artifact", "wiki"],
  "active_flag": true
}
```

### 2. entity_instance (Registry)

**Purpose:** Global registry of all entity instances for lookups and reference resolution.

| Column | Type | Description |
|--------|------|-------------|
| `entity_code` | varchar | Entity type code |
| `entity_instance_id` | uuid | Entity instance UUID |
| `entity_instance_name` | varchar | Display name (cached for lookups) |
| `code` | varchar | Record code (e.g., 'PROJ-001') |
| `order_id` | serial | Auto-increment order |
| `created_ts` | timestamp | Creation timestamp |
| `updated_ts` | timestamp | Last update timestamp |

**Delete Behavior:** **Hard delete** (no `active_flag` column)

**Key Points:**
- Synced automatically when entity name/code changes
- Used by `build_ref_data_entityInstance()` for UUID → name lookups
- Powers dropdown lookups and entity reference resolution

### 3. entity_instance_link (Relationships)

**Purpose:** Polymorphic parent-child relationships. Replaces all foreign keys.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `entity_code` | varchar | **Parent** entity type |
| `entity_instance_id` | uuid | **Parent** entity ID |
| `child_entity_code` | varchar | Child entity type |
| `child_entity_instance_id` | uuid | Child entity ID |
| `relationship_type` | varchar | 'contains', 'owns', 'membership' |
| `created_ts` | timestamp | Creation timestamp |
| `updated_ts` | timestamp | Last update timestamp |

**Delete Behavior:** **Hard delete** (no `active_flag` column)

**Column Naming Convention:**
- Parent columns: No prefix (`entity_code`, `entity_instance_id`)
- Child columns: With prefix (`child_entity_code`, `child_entity_instance_id`)

**Common Relationships:**

| Parent | Child | Relationship | Use Case |
|--------|-------|--------------|----------|
| project | task | contains | Project tasks |
| project | artifact | contains | Project documents |
| office | employee | contains | Office staff |
| role | employee | membership | Role membership (for RBAC) |
| business | project | contains | Business projects |

### 4. entity_rbac (Permissions)

**Purpose:** Person-based permission grants on entities.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `person_code` | varchar | `'employee'` or `'role'` |
| `person_id` | uuid | Employee or Role UUID |
| `entity_code` | varchar | Entity type |
| `entity_instance_id` | uuid | Entity ID or `ALL_ENTITIES_ID` |
| `permission` | int | Permission level (0-7) |
| `expires_ts` | timestamp | Optional expiration |
| `created_ts` | timestamp | Creation timestamp |
| `updated_ts` | timestamp | Last update timestamp |

**Delete Behavior:** **Hard delete** (no `active_flag` column)

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

## Permission Resolution Algorithm

### Logical Flow (getMaxPermissionLevel)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION RESOLUTION ALGORITHM                                    │
│                    getMaxPermissionLevel(userId, entityCode, entityId)               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  INPUT:                                                                              │
│    userId      = Employee UUID                                                       │
│    entityCode  = Entity type (e.g., 'project')                                       │
│    entityId    = Entity instance UUID (or ALL_ENTITIES_ID for type-level)            │
│                                                                                      │
│  ALGORITHM (Single SQL Query with CTEs):                                             │
│                                                                                      │
│  WITH                                                                                │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │  CTE 1: direct_emp                                                            │  │
│  │  ─────────────────                                                            │  │
│  │  SELECT permission FROM entity_rbac                                           │  │
│  │  WHERE person_code = 'employee'                                               │  │
│  │    AND person_id = {userId}                                                   │  │
│  │    AND entity_code = {entityCode}                                             │  │
│  │    AND (entity_instance_id = ALL_ENTITIES_ID OR entity_instance_id = {entityId})│  │
│  │    AND (expires_ts IS NULL OR expires_ts > NOW())                             │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │  CTE 2: role_based                                                            │  │
│  │  ─────────────────                                                            │  │
│  │  SELECT rbac.permission FROM entity_rbac rbac                                 │  │
│  │  INNER JOIN entity_instance_link eil ON                                       │  │
│  │    eil.entity_code = 'role' AND                                               │  │
│  │    eil.entity_instance_id = rbac.person_id AND                                │  │
│  │    eil.child_entity_code = 'employee' AND                                     │  │
│  │    eil.child_entity_instance_id = {userId}                                    │  │
│  │  WHERE rbac.person_code = 'role'                                              │  │
│  │    AND rbac.entity_code = {entityCode}                                        │  │
│  │    AND (rbac.entity_instance_id = ALL_ENTITIES_ID OR ...)                     │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │  CTE 3: parent_entities                                                       │  │
│  │  ──────────────────────                                                       │  │
│  │  SELECT code FROM entity                                                      │  │
│  │  WHERE child_entity_codes CONTAINS {entityCode}                               │  │
│  │  (Supports both string[] and {entity: string}[] formats in JSONB)             │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │  CTE 4: parent_view (permission >= 0 on parent → VIEW on child)               │  │
│  │  ─────────────────────────────────────────────────────────────                │  │
│  │  Returns 0 (VIEW) if user has VIEW+ on any parent entity type                 │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │  CTE 5: parent_create (permission >= 6 on parent → CREATE on child)           │  │
│  │  ─────────────────────────────────────────────────────────────────            │  │
│  │  Returns 6 (CREATE) if user has CREATE+ on any parent entity type             │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  FINAL:                                                                              │
│  ───────                                                                             │
│  SELECT COALESCE(MAX(permission), -1) AS max_permission                             │
│  FROM (                                                                              │
│    SELECT * FROM direct_emp UNION ALL                                                │
│    SELECT * FROM role_based UNION ALL                                                │
│    SELECT * FROM parent_view UNION ALL                                               │
│    SELECT * FROM parent_create                                                       │
│  ) AS all_perms                                                                      │
│                                                                                      │
│  OUTPUT:                                                                             │
│    -1 = No access                                                                    │
│    0-7 = Maximum permission level from all sources                                   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### check_entity_rbac() Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         check_entity_rbac() DECISION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  check_entity_rbac(userId, entityCode, entityId, requiredPermission)                 │
│                              │                                                       │
│                              ▼                                                       │
│                   ┌──────────────────────┐                                           │
│                   │ getMaxPermissionLevel│                                           │
│                   │ (userId, entityCode, │                                           │
│                   │  entityId)           │                                           │
│                   └──────────┬───────────┘                                           │
│                              │                                                       │
│                              ▼                                                       │
│                   ┌──────────────────────┐                                           │
│                   │ maxPermission >= -1? │                                           │
│                   └──────────┬───────────┘                                           │
│                              │                                                       │
│              ┌───────────────┴───────────────┐                                       │
│              │                               │                                       │
│              ▼                               ▼                                       │
│     maxPermission >= required       maxPermission < required                         │
│              │                               │                                       │
│              ▼                               ▼                                       │
│        ┌──────────┐                   ┌──────────┐                                   │
│        │  TRUE    │                   │  FALSE   │                                   │
│        │ (Access) │                   │ (Denied) │                                   │
│        └──────────┘                   └──────────┘                                   │
│                                                                                      │
│  EXAMPLE:                                                                            │
│  ─────────                                                                           │
│  User has EDIT (3) on project X                                                      │
│  Request: check_entity_rbac(user, 'project', X, Permission.VIEW)                     │
│  Result: 3 >= 0 → TRUE (allowed)                                                     │
│                                                                                      │
│  Request: check_entity_rbac(user, 'project', X, Permission.DELETE)                   │
│  Result: 3 >= 5 → FALSE (denied)                                                     │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Request Flow Patterns

### LIST Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         LIST REQUEST FLOW                                            │
│                         GET /api/v1/project                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Client                    Route Handler                 EntityInfraService          │
│    │                            │                              │                     │
│    │── GET /api/v1/project ────→│                              │                     │
│    │                            │                              │                     │
│    │                     [1] Extract userId from JWT           │                     │
│    │                            │                              │                     │
│    │                     [2] Get RBAC WHERE condition ─────────→                     │
│    │                            │       get_entity_rbac_where_condition(            │
│    │                            │         userId, 'project', VIEW, 'e'              │
│    │                            │       )                      │                     │
│    │                            │                              │                     │
│    │                            │←──── Returns one of: ────────│                     │
│    │                            │        • 'TRUE' (type-level access)               │
│    │                            │        • 'FALSE' (no access)                      │
│    │                            │        • 'e.id IN (uuid1, uuid2, ...)' (specific) │
│    │                            │                              │                     │
│    │                     [3] Build conditions array:           │                     │
│    │                            │   conditions = [                                   │
│    │                            │     rbacWhereClause,                               │
│    │                            │     'e.active_flag = true',                        │
│    │                            │     ...autoFilters                                 │
│    │                            │   ]                          │                     │
│    │                            │                              │                     │
│    │                     [4] Execute query:                    │                     │
│    │                            │   SELECT * FROM app.project e                      │
│    │                            │   WHERE {conditions}                               │
│    │                            │   ORDER BY created_ts DESC                         │
│    │                            │   LIMIT {limit} OFFSET {offset}                    │
│    │                            │                              │                     │
│    │                     [5] Build response with metadata ─────→                     │
│    │                            │       build_ref_data_entityInstance(rows)          │
│    │                            │                              │                     │
│    │←─── JSON Response ─────────│                              │                     │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### CREATE Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         CREATE REQUEST FLOW (6 Steps)                                │
│                         POST /api/v1/project                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Client                    Route Handler                 EntityInfraService          │
│    │                            │                              │                     │
│    │── POST /api/v1/project ───→│                              │                     │
│    │   {                        │                              │                     │
│    │     name: "Kitchen Reno",  │                              │                     │
│    │     parent_entity_code,    │                              │                     │
│    │     parent_entity_instance_id                             │                     │
│    │   }                        │                              │                     │
│    │                            │                              │                     │
│    │                     [STEP 1] RBAC - Can user CREATE? ─────→                     │
│    │                            │       check_entity_rbac(                           │
│    │                            │         userId, 'project',                         │
│    │                            │         ALL_ENTITIES_ID, CREATE                    │
│    │                            │       )                      │                     │
│    │                            │←──── TRUE/FALSE ─────────────│                     │
│    │                            │                              │                     │
│    │                     [STEP 2] RBAC - Can user EDIT parent? →                     │
│    │                            │       (if parent provided)   │                     │
│    │                            │       check_entity_rbac(                           │
│    │                            │         userId, parent_code,                       │
│    │                            │         parent_id, EDIT                            │
│    │                            │       )                      │                     │
│    │                            │←──── TRUE/FALSE ─────────────│                     │
│    │                            │                              │                     │
│    │                     ═══════════════════════════════════════                     │
│    │                     │  TRANSACTION START (create_entity)  │                     │
│    │                     ═══════════════════════════════════════                     │
│    │                            │                              │                     │
│    │                     [STEP 3] INSERT into primary table    │                     │
│    │                            │   INSERT INTO app.project    │                     │
│    │                            │   (...) VALUES (...) RETURNING *                   │
│    │                            │                              │                     │
│    │                     [STEP 4] Register in entity_instance ─→                     │
│    │                            │       set_entity_instance_registry({              │
│    │                            │         entity_code: 'project',                   │
│    │                            │         entity_id: newId,                         │
│    │                            │         entity_name: 'Kitchen Reno',              │
│    │                            │         instance_code: 'PROJ-001'                 │
│    │                            │       })                     │                     │
│    │                            │                              │                     │
│    │                     [STEP 5] Grant OWNER permission ──────→                     │
│    │                            │       set_entity_rbac_owner(                      │
│    │                            │         userId, 'project', newId                  │
│    │                            │       )                      │                     │
│    │                            │                              │                     │
│    │                     [STEP 6] Link to parent (if provided)─→                     │
│    │                            │       set_entity_instance_link({                  │
│    │                            │         parent_entity_code,                       │
│    │                            │         parent_entity_id,                         │
│    │                            │         child_entity_code: 'project',             │
│    │                            │         child_entity_id: newId                    │
│    │                            │       })                     │                     │
│    │                            │                              │                     │
│    │                     ═══════════════════════════════════════                     │
│    │                     │  TRANSACTION COMMIT                 │                     │
│    │                     ═══════════════════════════════════════                     │
│    │                            │                              │                     │
│    │←── 201 Created ────────────│                              │                     │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### DELETE Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         DELETE REQUEST FLOW                                          │
│                         DELETE /api/v1/project/:id                                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Client                    Route Handler                 EntityInfraService          │
│    │                            │                              │                     │
│    │── DELETE /api/v1/project/X─→                              │                     │
│    │                            │                              │                     │
│    │                     [1] RBAC - Can user DELETE? ──────────→                     │
│    │                            │       check_entity_rbac(                           │
│    │                            │         userId, 'project', X, DELETE               │
│    │                            │       )                      │                     │
│    │                            │←──── TRUE/FALSE ─────────────│                     │
│    │                            │                              │                     │
│    │                     ═══════════════════════════════════════                     │
│    │                     │  TRANSACTION START (delete_entity)  │                     │
│    │                     ═══════════════════════════════════════                     │
│    │                            │                              │                     │
│    │                     [2] Soft/Hard delete primary table    │                     │
│    │                            │   UPDATE app.project SET active_flag = false       │
│    │                            │   OR: DELETE FROM app.project WHERE id = X         │
│    │                            │                              │                     │
│    │                     [3] Hard delete from entity_instance  │                     │
│    │                            │   DELETE FROM entity_instance                      │
│    │                            │   WHERE entity_code = 'project'                    │
│    │                            │     AND entity_instance_id = X                     │
│    │                            │                              │                     │
│    │                     [4] Hard delete from entity_instance_link                   │
│    │                            │   DELETE FROM entity_instance_link                 │
│    │                            │   WHERE (entity_code = 'project' AND ..id = X)     │
│    │                            │      OR (child_entity_code = 'project' AND ...)    │
│    │                            │                              │                     │
│    │                     [5] Hard delete from entity_rbac      │                     │
│    │                            │   DELETE FROM entity_rbac                          │
│    │                            │   WHERE entity_code = 'project'                    │
│    │                            │     AND entity_instance_id = X                     │
│    │                            │                              │                     │
│    │                     ═══════════════════════════════════════                     │
│    │                     │  TRANSACTION COMMIT                 │                     │
│    │                     ═══════════════════════════════════════                     │
│    │                            │                              │                     │
│    │←── 200 OK { success: true }│                              │                     │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Methods

### Permission Checking

```typescript
const entityInfra = getEntityInfrastructure(db);

// Check single permission (returns boolean)
const canEdit = await entityInfra.check_entity_rbac(
  userId,             // Person UUID
  'project',          // Entity type code
  projectId,          // Entity instance ID
  Permission.EDIT     // Required permission level
);

// Get SQL WHERE for LIST queries (returns SQL fragment)
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  userId,             // Person UUID
  'project',          // Entity type code
  Permission.VIEW,    // Required permission
  'e'                 // Table alias
);
// Returns one of:
//   sql`TRUE`                        - User has type-level access
//   sql`FALSE`                       - User has no access
//   sql`e.id IN ('uuid1', 'uuid2')`  - User can see specific IDs
```

### Registry Operations

```typescript
// Register new entity
await entityInfra.set_entity_instance_registry({
  entity_code: 'project',           // Entity TYPE code
  entity_id: projectId,             // Entity instance UUID
  entity_name: 'Kitchen Renovation', // Display name
  instance_code: 'PROJ-001'          // Business code
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
// Create parent-child link (idempotent)
await entityInfra.set_entity_instance_link({
  parent_entity_code: 'business',
  parent_entity_id: businessId,
  child_entity_code: 'project',
  child_entity_id: projectId,
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
// Grant OWNER to creator (called automatically in create_entity)
await entityInfra.set_entity_rbac_owner(userId, 'project', projectId);

// Grant specific permission
await entityInfra.set_entity_rbac(userId, 'project', projectId, Permission.EDIT);

// Revoke all permissions (hard delete)
await entityInfra.delete_entity_rbac(userId, 'project', projectId);
```

### Transactional Methods

```typescript
// CREATE (all operations in ONE transaction)
const result = await entityInfra.create_entity({
  entity_code: 'project',
  creator_id: userId,
  parent_entity_code: 'business',    // Optional
  parent_entity_id: businessId,      // Optional
  primary_table: 'app.project',
  primary_data: { name, code, descr, budget_allocated_amt }
});
// Returns: { entity, entity_instance, rbac_granted, link_created, link? }

// UPDATE (UPDATE + registry sync in ONE transaction)
const result = await entityInfra.update_entity({
  entity_code: 'project',
  entity_id: projectId,
  primary_table: 'app.project',
  primary_updates: { name: 'New Name', budget_allocated_amt: 50000 }
});
// Returns: { entity, registry_synced }

// DELETE (all cleanup in ONE transaction)
const result = await entityInfra.delete_entity({
  entity_code: 'project',
  entity_id: projectId,
  user_id: userId,
  primary_table: 'app.project',
  hard_delete: false  // soft delete PRIMARY table only
});
// NOTE: entity_instance, entity_instance_link, entity_rbac are ALWAYS hard-deleted
// Returns: { success, entity_deleted, registry_deleted, linkages_deleted, rbac_entries_deleted }
```

---

## Route Integration Patterns

### Standard Route Imports

```typescript
import type { FastifyInstance } from 'fastify';
import { db, client, qualifyTable } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';

import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID
} from '@/services/entity-infrastructure.service.js';
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';
import { createEntityDeleteEndpoint } from '@/lib/universal-entity-crud-factory.js';

// Module constants (DRY)
const ENTITY_CODE = 'project';
const TABLE_ALIAS = 'e';
```

### LIST Pattern with RBAC

```typescript
fastify.get('/api/v1/project', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const userId = (request as any).user?.sub;
  const { limit = 20, offset = 0 } = request.query as any;

  const conditions: SQL[] = [];

  // GATE 1: RBAC filtering (MANDATORY)
  const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
  );
  conditions.push(rbacWhereClause);

  // GATE 2: Active flag (MANDATORY for soft-delete tables)
  conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);

  // GATE 3: Auto-filters from query params
  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query as any, {
    searchFields: ['name', 'code', 'descr']
  });
  conditions.push(...autoFilters);

  // Execute query
  const projects = await db.execute(sql`
    SELECT ${sql.raw(TABLE_ALIAS)}.*
    FROM ${sql.raw(qualifyTable(ENTITY_CODE))} ${sql.raw(TABLE_ALIAS)}
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return reply.send({ data: projects });
});
```

### CREATE Pattern (6 Steps)

```typescript
fastify.post('/api/v1/project', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const { parent_entity_code, parent_entity_instance_id } = request.query as any;
  const data = request.body as any;
  const userId = (request as any).user?.sub;

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

  // Steps 3-6: Transactional CREATE (all ops in ONE transaction)
  const result = await entityInfra.create_entity({
    entity_code: ENTITY_CODE,
    creator_id: userId,
    parent_entity_code,
    parent_entity_id: parent_entity_instance_id,
    primary_table: qualifyTable(ENTITY_CODE),
    primary_data: data
  });

  return reply.status(201).send(result.entity);
});
```

---

## Caching Strategy

### Redis Caching for Entity Metadata

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         RBAC-RELATED CACHING                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  CACHED DATA                           KEY PATTERN                    TTL            │
│  ──────────────────────────────────────────────────────────────────────────────────  │
│                                                                                      │
│  Entity type metadata                  entity:metadata:{entityCode}    5 min         │
│  (name, child_entity_codes, db_table)                                                │
│                                                                                      │
│  Entity field names                    entity:fields:{entityCode}      24 hours      │
│  (for metadata generation)                                                           │
│                                                                                      │
│  IMPORTANT: RBAC permission checks are NOT cached                                    │
│  (must be fresh for security reasons)                                                │
│                                                                                      │
│  INVALIDATION:                                                                       │
│  ─────────────                                                                       │
│  entityInfra.invalidate_entity_cache(entityCode)  // Single entity                   │
│  entityInfra.clear_all_entity_cache()             // All entities                    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Query Patterns

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

### Parent-Child Filtering in LIST

```sql
-- Get tasks for a specific project (using entity_instance_link)
SELECT DISTINCT e.*
FROM app.task e
INNER JOIN app.entity_instance_link eil
  ON eil.child_entity_code = 'task'
  AND eil.child_entity_instance_id = e.id
  AND eil.entity_code = 'project'
  AND eil.entity_instance_id = '{project-uuid}'
WHERE e.active_flag = true
ORDER BY e.created_ts DESC;
```

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No Foreign Keys** | All relationships via `entity_instance_link` |
| **Hard Delete (Infrastructure)** | `entity_instance`, `entity_instance_link`, `entity_rbac` use **hard delete** |
| **Soft Delete (Type Metadata)** | `entity` uses `active_flag` |
| **Soft Delete (Primary Tables)** | Entity tables (project, task) use `active_flag` |
| **Idempotent Link Operations** | `set_entity_instance_link()` safe to call multiple times |
| **Permission Inheritance** | Higher level implies all lower levels |
| **Type-Level Permissions** | `ALL_ENTITIES_ID` grants access to all instances |
| **Role-Based Access** | Permissions granted to roles, inherited by members |
| **Transactional Safety** | `create_entity()`, `update_entity()`, `delete_entity()` wrap ops in single transaction |
| **Parent Inheritance** | VIEW on parent → VIEW on child; CREATE on parent → CREATE on child |

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| **Entity Endpoint Design** | [`docs/api/entity_endpoint_design.md`](../api/entity_endpoint_design.md) | Factory patterns, request flow, caching |
| **Entity Infrastructure Service** | [`docs/services/entity-infrastructure.service.md`](../services/entity-infrastructure.service.md) | Full service API reference |
| **State Management** | [`docs/state_management/STATE_MANAGEMENT.md`](../state_management/STATE_MANAGEMENT.md) | TanStack Query + Dexie architecture |
| **Backend Formatter** | [`docs/services/backend-formatter.service.md`](../services/backend-formatter.service.md) | Metadata generation |
| **Main README** | [`docs/README.md`](../README.md) | Documentation index |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 6.0.0 | 2025-12-03 | **Complete rewrite**: Added request flow diagrams, logical flow algorithm, permission resolution sequence, caching strategy, route integration patterns |
| 5.0.0 | 2025-11-22 | Added transactional methods |
| 4.0.0 | 2025-11-21 | Entity Infrastructure Service standardization |
| 3.0.0 | 2025-11-15 | Added role-based and parent inheritance |
| 2.0.0 | 2025-11-10 | Hard delete for infrastructure tables |
| 1.0.0 | 2025-11-01 | Initial documentation |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
