# RBAC Backend Design

> Role-Based Access Control - Backend Architecture, Permission Resolution, Ownership Model, and Caching Strategy

**Version**: 2.2.0 | **Updated**: 2025-12-13 | **Status**: Production

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Ownership Model (v2.2.0)](#3-ownership-model-v220)
4. [Permission Resolution Flow](#4-permission-resolution-flow)
5. [API Routes](#5-api-routes)
6. [Caching Strategy](#6-caching-strategy)
7. [Performance Analysis](#7-performance-analysis)
8. [Data Gating Query Optimization](#8-data-gating-query-optimization-v210)

---

## 1. Architecture Overview

### 1.1 Core Principle

All permissions are granted to **roles**, never directly to people. People receive permissions through role membership.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROLE-ONLY RBAC MODEL                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌──────────────┐                                │
│                              │   app.role   │                                │
│                              │  (role def)  │                                │
│                              └──────┬───────┘                                │
│                                     │                                        │
│                     ┌───────────────┼───────────────┐                        │
│                     │               │               │                        │
│                     ▼               ▼               ▼                        │
│           ┌─────────────────┐  ┌─────────┐  ┌─────────────────┐              │
│           │ entity_instance │  │ entity  │  │   entity_rbac   │              │
│           │      _link      │  │ _rbac   │  │   (deny rules)  │              │
│           │ (role→person)   │  │ (perms) │  │   is_deny=true  │              │
│           └────────┬────────┘  └────┬────┘  └─────────────────┘              │
│                    │                │                                        │
│                    ▼                ▼                                        │
│           ┌─────────────┐    ┌─────────────┐                                 │
│           │ app.person  │    │ app.entity  │                                 │
│           │ (employees) │    │  (targets)  │                                 │
│           └─────────────┘    └─────────────┘                                 │
│                                                                              │
│  Flow: Person → Roles → Permissions → Entity Access                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Permission Levels (0-7)

| Level | Name | Implies | Use Case |
|-------|------|---------|----------|
| 0 | VIEW | - | Read-only access |
| 1 | COMMENT | VIEW | Add comments to records |
| 2 | CONTRIBUTE | COMMENT | Insert form data |
| 3 | EDIT | CONTRIBUTE | Modify existing records |
| 4 | SHARE | EDIT | Share with other users |
| 5 | DELETE | SHARE | Soft delete records |
| 6 | CREATE | DELETE | Create new instances (type-level) |
| 7 | OWNER | ALL | Full control |

**Permission Check**: `user.permission >= required_level` → ALLOWED

### 1.3 Type-Level vs Instance-Level

| Scope | entity_instance_id | Example |
|-------|-------------------|---------|
| Type-level | `11111111-1111-1111-1111-111111111111` (ALL_ENTITIES_ID) | "Can CREATE any project" |
| Instance-level | Specific UUID | "Can EDIT project X only" |

---

## 2. Database Schema

### 2.1 Table Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATABASE TABLE RELATIONSHIPS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐         ┌─────────────────────────┐                     │
│  │    app.role     │────────►│     app.entity_rbac     │                     │
│  │                 │  1:N    │                         │                     │
│  │  id (PK)        │         │  id (PK)                │                     │
│  │  code           │         │  role_id (FK)───────────┤                     │
│  │  name           │         │  entity_code            │                     │
│  │  active_flag    │         │  entity_instance_id     │                     │
│  └────────┬────────┘         │  permission (0-7)       │                     │
│           │                  │  inheritance_mode       │                     │
│           │                  │  child_permissions      │                     │
│           │                  │  is_deny                │                     │
│           │                  │  expires_ts             │                     │
│           │                  └─────────────────────────┘                     │
│           │                                                                  │
│           │ 1:N (via entity_instance_link)                                   │
│           ▼                                                                  │
│  ┌─────────────────────────────────────┐                                     │
│  │      app.entity_instance_link       │                                     │
│  │                                     │                                     │
│  │  entity_code = 'role'               │                                     │
│  │  entity_instance_id = role.id       │                                     │
│  │  child_entity_code = 'person'       │                                     │
│  │  child_entity_instance_id = person.id│                                    │
│  │  relationship_type = 'member'       │                                     │
│  └────────────────┬────────────────────┘                                     │
│                   │                                                          │
│                   ▼                                                          │
│  ┌─────────────────┐                                                         │
│  │   app.person    │                                                         │
│  │                 │                                                         │
│  │  id (PK)        │                                                         │
│  │  name           │                                                         │
│  │  email          │                                                         │
│  └─────────────────┘                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Table Purposes

| Table | Purpose | Delete Behavior |
|-------|---------|-----------------|
| `app.role` | Role definitions (Admin, Manager, Viewer) | Soft delete (`active_flag`) |
| `app.entity_rbac` | Permission grants: role → entity mapping | Hard delete |
| `app.entity_instance_link` | Role membership: role → person mapping | Hard delete |
| `app.person` | User records (employees, customers) | Soft delete (`active_flag`) |

### 2.3 Key Columns: entity_rbac

| Column | Type | Purpose |
|--------|------|---------|
| `role_id` | UUID | Which role has this permission |
| `entity_code` | VARCHAR | Target entity type ('project', 'task') |
| `entity_instance_id` | UUID | Specific instance or ALL_ENTITIES_ID |
| `permission` | INTEGER | Permission level (0-7) |
| `inheritance_mode` | VARCHAR | 'none', 'cascade', or 'mapped' |
| `child_permissions` | JSONB | Per-child-type levels for 'mapped' mode |
| `is_deny` | BOOLEAN | Explicit deny (blocks all access) |
| `expires_ts` | TIMESTAMP | Optional expiration |

### 2.4 Inheritance Modes

| Mode | Behavior | Example |
|------|----------|---------|
| `none` | Permission applies only to target entity | Project EDIT doesn't affect tasks |
| `cascade` | Same permission flows to all children | Project EDIT → Task EDIT |
| `mapped` | Different permission per child type | Project EDIT → Task VIEW, Document EDIT |

**Mapped Mode Example**:
```json
{
  "inheritance_mode": "mapped",
  "child_permissions": {
    "task": 3,
    "document": 0,
    "_default": 0
  }
}
```

---

## 3. Ownership Model (v2.2.0)

### 3.1 Overview

The ownership model introduces **traversal control** for permission inheritance through entity relationships. Two new flags control how permissions flow through the entity hierarchy:

| Flag | Location | Purpose |
|------|----------|---------|
| `root_level_entity_flag` | `app.entity` | Marks traversal boundaries (business, project, customer) |
| `ownership_flag` | `app.entity_instance_link` | Distinguishes owned vs lookup relationships |

### 3.2 Root Level Entity Flag

Entities marked with `root_level_entity_flag = true` are **traversal roots** - they define boundaries where permission inheritance behavior changes.

**Root Entities:**
- `business` - Organization boundary
- `project` - Project boundary
- `customer` - Customer boundary

**Behavior:**
- Permissions granted at a root entity don't automatically traverse UP to parent hierarchies
- Permissions traverse DOWN from root entities based on `ownership_flag`

```sql
-- app.entity table includes:
ALTER TABLE app.entity ADD COLUMN root_level_entity_flag BOOLEAN DEFAULT false;

-- Example root entities
UPDATE app.entity SET root_level_entity_flag = true WHERE code IN ('business', 'project', 'customer');
```

### 3.3 Ownership Flag

The `ownership_flag` on `entity_instance_link` determines how permissions cascade to child entities:

| Flag Value | Name | Permission Behavior | Use Case |
|------------|------|---------------------|----------|
| `true` | **Owned** | Full cascade - child inherits parent's permission level | Project owns its tasks |
| `false` | **Lookup** | Max COMMENT (level 1) - traversal stops | Person linked to project for reference |

```sql
-- app.entity_instance_link table includes:
ALTER TABLE app.entity_instance_link ADD COLUMN ownership_flag BOOLEAN DEFAULT true;
```

### 3.4 Child Entity Configuration

The `app.entity.child_entity_codes` JSONB column now stores objects with ownership metadata:

**New Format (v2.2.0):**
```json
{
  "child_entity_codes": [
    { "entity": "task", "ui_label": "Tasks", "ui_icon": "CheckSquare", "ownership_flag": true },
    { "entity": "artifact", "ui_label": "Artifacts", "ui_icon": "File", "ownership_flag": true },
    { "entity": "person", "ui_label": "Team", "ui_icon": "Users", "ownership_flag": false }
  ]
}
```

**Legacy Format (backward compatible):**
```json
{
  "child_entity_codes": ["task", "artifact", "person"]
}
```

When legacy string format is encountered, the system defaults `ownership_flag = true`.

### 3.5 Ownership Inheritance Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OWNERSHIP-BASED PERMISSION INHERITANCE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Example: Role has EDIT (3) on Project-ABC                                  │
│                                                                              │
│                         ┌─────────────────────┐                              │
│                         │   Project-ABC       │                              │
│                         │   EDIT permission   │                              │
│                         │   (root entity)     │                              │
│                         └─────────┬───────────┘                              │
│                                   │                                          │
│              ┌────────────────────┼────────────────────┐                     │
│              │                    │                    │                     │
│         ownership_flag=true   ownership_flag=true  ownership_flag=false     │
│              │                    │                    │                     │
│              ▼                    ▼                    ▼                     │
│     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐              │
│     │   Task-001     │  │  Artifact-001  │  │   Person-JM    │              │
│     │   → EDIT (3)   │  │   → EDIT (3)   │  │   → COMMENT(1) │◄── MAX!     │
│     │   (inherited)  │  │   (inherited)  │  │   (capped)     │              │
│     └────────────────┘  └────────────────┘  └────────────────┘              │
│                                                                              │
│  RULE: Lookup children (ownership_flag=false) get MAX COMMENT permission    │
│        regardless of parent's higher permission level.                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.6 Cascade Mode with Ownership

When `inheritance_mode = 'cascade'`, the ownership model modifies behavior:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CASCADE + OWNERSHIP INTERACTION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  entity_rbac record:                                                         │
│  {                                                                           │
│    role_id: 'role-admin',                                                    │
│    entity_code: 'project',                                                   │
│    entity_instance_id: 'project-abc',                                        │
│    permission: 5,              // DELETE                                     │
│    inheritance_mode: 'cascade' // Full cascade                               │
│  }                                                                           │
│                                                                              │
│  Resolution for child entities:                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Child: task (ownership_flag=true)                                           │
│    → getMaxPermissionLevel() returns 5 (DELETE)                              │
│    → Full cascade, no cap                                                    │
│                                                                              │
│  Child: artifact (ownership_flag=true)                                       │
│    → getMaxPermissionLevel() returns 5 (DELETE)                              │
│    → Full cascade, no cap                                                    │
│                                                                              │
│  Child: person (ownership_flag=false)                                        │
│    → getMaxPermissionLevel() returns 1 (COMMENT) ◄── CAPPED                 │
│    → Lookup relationship, max COMMENT                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.7 API Response Format

The hierarchical permissions API returns ownership metadata:

```typescript
GET /api/v1/entity_rbac/role/:roleId/hierarchical-permissions

{
  "role_id": "uuid",
  "role_name": "Project Manager",
  "entities": [
    {
      "entity_code": "project",
      "entity_label": "Projects",
      "entity_icon": "Folder",
      "root_level_entity_flag": true,  // ← Traversal root
      "child_entity_codes": [
        {
          "entity": "task",
          "ui_label": "Tasks",
          "ui_icon": "CheckSquare",
          "order": 0,
          "ownership_flag": true       // ← Owned child
        },
        {
          "entity": "person",
          "ui_label": "Team",
          "ui_icon": "Users",
          "order": 1,
          "ownership_flag": false      // ← Lookup child
        }
      ],
      "permissions": [...]
    }
  ]
}
```

### 3.8 Service Method Updates

The `set_entity_instance_link` method auto-populates `ownership_flag`:

```typescript
// entity-infrastructure.service.ts
async set_entity_instance_link(params: {
  parent_entity_code: string;
  parent_entity_id: string;
  child_entity_code: string;
  child_entity_id: string;
  relationship_type?: string;
  ownership_flag?: boolean;  // Optional - auto-detected if not provided
}): Promise<EntityLink>

// Auto-detection logic:
// 1. If ownership_flag provided → use it
// 2. Else → look up parent entity's child_entity_codes config
// 3. Find child_entity_code in config → use its ownership_flag
// 4. Default → true (owned)
```

---

## 4. Permission Resolution Flow

### 4.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│           check_entity_rbac(personId, entityCode, entityId, requiredLevel)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 1: Find Person's Roles                                             ││
│  │                                                                         ││
│  │ Query: entity_instance_link                                             ││
│  │        WHERE entity_code = 'role'                                       ││
│  │          AND child_entity_code = 'person'                               ││
│  │          AND child_entity_instance_id = {personId}                      ││
│  │                                                                         ││
│  │ Returns: [roleA, roleB, roleC]                                          ││
│  │                                                                         ││
│  │ If empty → DENIED (no roles = no access)                                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 2: Check Explicit Deny (HIGHEST PRIORITY)                          ││
│  │                                                                         ││
│  │ Query: entity_rbac                                                      ││
│  │        WHERE role_id IN (person's roles)                                ││
│  │          AND is_deny = true                                             ││
│  │          AND entity_code = {entityCode}                                 ││
│  │          AND entity_instance_id IN ({entityId}, ancestors, ALL_ENTITIES)││
│  │                                                                         ││
│  │ If ANY deny found → DENIED (stop immediately)                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 3: Check Direct Permissions                                        ││
│  │                                                                         ││
│  │ Query: entity_rbac                                                      ││
│  │        WHERE role_id IN (person's roles)                                ││
│  │          AND entity_code = {entityCode}                                 ││
│  │          AND entity_instance_id IN ({entityId}, ALL_ENTITIES_ID)        ││
│  │          AND is_deny = false                                            ││
│  │                                                                         ││
│  │ Collects: Direct instance + Type-level permissions                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 4: Check Inherited Permissions (Ancestor Walk)                     ││
│  │                                                                         ││
│  │ For each ancestor (via entity_instance_link):                           ││
│  │   Task → Project → Program → Portfolio → Business                       ││
│  │                                                                         ││
│  │ If ancestor.inheritance_mode = 'cascade':                               ││
│  │   → Use same permission level                                           ││
│  │                                                                         ││
│  │ If ancestor.inheritance_mode = 'mapped':                                ││
│  │   → Look up child_permissions[entityCode]                               ││
│  │   → Fall back to child_permissions['_default']                          ││
│  │                                                                         ││
│  │ If ancestor.inheritance_mode = 'none':                                  ││
│  │   → Skip (no inheritance)                                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 5: Return Final Result                                             ││
│  │                                                                         ││
│  │ MAX(all permissions found) >= requiredLevel → ALLOWED                   ││
│  │ Otherwise → DENIED                                                      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Priority Order

| Priority | Check | Effect |
|----------|-------|--------|
| 1st (highest) | Explicit Deny | Blocks all access, even if granted elsewhere |
| 2nd | Direct Instance Permission | Specific permission on target entity |
| 3rd | Type-Level Permission | "Can access ALL entities of this type" |
| 4th | Inherited from Parent | Flows down based on inheritance mode |

### 4.3 SQL Implementation (Single Recursive CTE)

The permission check executes as a **single SQL query** using PostgreSQL's recursive CTE:

```sql
WITH RECURSIVE
  -- Step 1: Find person's roles
  person_roles AS (
    SELECT eil.entity_instance_id AS role_id
    FROM app.entity_instance_link eil
    WHERE eil.entity_code = 'role'
      AND eil.child_entity_code = 'person'
      AND eil.child_entity_instance_id = {personId}::uuid
  ),

  -- Step 2: Check explicit deny
  explicit_deny AS (
    SELECT -999 AS permission
    FROM app.entity_rbac er
    WHERE er.role_id IN (SELECT role_id FROM person_roles)
      AND er.is_deny = true
      AND er.entity_code = {entityCode}
      AND (er.entity_instance_id = {entityId}::uuid
           OR er.entity_instance_id = '11111111-1111-1111-1111-111111111111')
    LIMIT 1
  ),

  -- Step 3: Direct permissions
  direct_perms AS (
    SELECT er.permission
    FROM app.entity_rbac er
    WHERE er.role_id IN (SELECT role_id FROM person_roles)
      AND er.entity_code = {entityCode}
      AND er.entity_instance_id IN ({entityId}::uuid, '11111111-1111-1111-1111-111111111111')
      AND er.is_deny = false
  ),

  -- Step 4: Ancestor chain (recursive)
  ancestor_chain AS (
    -- Base: direct parent
    SELECT eil.entity_code, eil.entity_instance_id, 1 AS depth
    FROM app.entity_instance_link eil
    WHERE eil.child_entity_code = {entityCode}
      AND eil.child_entity_instance_id = {entityId}::uuid

    UNION ALL

    -- Recursive: parent's parents
    SELECT eil.entity_code, eil.entity_instance_id, ac.depth + 1
    FROM app.entity_instance_link eil
    JOIN ancestor_chain ac ON eil.child_entity_code = ac.entity_code
      AND eil.child_entity_instance_id = ac.entity_instance_id
    WHERE ac.depth < 10  -- Max depth guard
  ),

  -- Step 4b: Inherited permissions
  inherited_perms AS (
    SELECT
      CASE
        WHEN er.inheritance_mode = 'cascade' THEN er.permission
        WHEN er.inheritance_mode = 'mapped' THEN
          COALESCE(
            (er.child_permissions->>'{entityCode}')::int,
            (er.child_permissions->>'_default')::int,
            -1
          )
        ELSE -1
      END AS permission
    FROM app.entity_rbac er
    JOIN ancestor_chain ac ON er.entity_code = ac.entity_code
      AND er.entity_instance_id = ac.entity_instance_id
    WHERE er.role_id IN (SELECT role_id FROM person_roles)
      AND er.is_deny = false
      AND er.inheritance_mode != 'none'
  ),

  -- Combine all permissions
  all_perms AS (
    SELECT permission FROM explicit_deny
    UNION ALL
    SELECT permission FROM direct_perms
    UNION ALL
    SELECT permission FROM inherited_perms
  )

SELECT COALESCE(MAX(permission), -1) AS max_permission
FROM all_perms;
```

**Result**: `max_permission >= requiredLevel` → ALLOWED

---

## 5. API Routes

### 5.1 Route File Location

**File**: `apps/api/src/modules/rbac/routes.ts`

### 5.2 Permission Management Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/v1/entity_rbac/role/:roleId/hierarchical-permissions` | Get role's permissions grouped by entity type |
| POST | `/api/v1/entity_rbac/grant-permission` | Grant/upsert permission to role |
| PUT | `/api/v1/entity_rbac/permission/:id` | Update permission (level, inheritance, etc.) |
| PATCH | `/api/v1/entity_rbac/permission/:id/child-permissions` | Update child permission mapping |
| DELETE | `/api/v1/entity_rbac/permission/:id` | Hard delete permission |

### 5.3 Request/Response Examples

**Grant Permission**:
```typescript
POST /api/v1/entity_rbac/grant-permission
{
  "role_id": "uuid-role",
  "entity_code": "project",
  "entity_instance_id": "11111111-1111-1111-1111-111111111111",  // ALL_ENTITIES
  "permission": 7,                    // OWNER
  "inheritance_mode": "mapped",
  "child_permissions": {
    "task": 3,                        // EDIT on tasks
    "document": 0,                    // VIEW on documents
    "_default": 0                     // VIEW on other children
  },
  "is_deny": false,
  "expires_ts": null
}
```

**Update Permission**:
```typescript
PUT /api/v1/entity_rbac/permission/:permissionId
{
  "permission": 5,                    // Change to DELETE
  "inheritance_mode": "cascade",      // Change to cascade
  "expires_ts": "2025-12-31T23:59:59Z"
}
```

### 5.4 Role Membership Routes

Role membership uses universal entity APIs:

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/v1/person?parent_entity_code=role&parent_entity_instance_id={roleId}` | List role members |
| POST | `/api/v1/entity_instance_link` | Add person to role |
| DELETE | `/api/v1/entity_instance_link/{linkId}` | Remove person from role |

---

## 6. Caching Strategy

### 6.1 Design Principle: Cache at Role Level

Since permissions are granted to **roles** (not persons), caching at the role level is more efficient:

| Approach | Cache Keys | Invalidation Impact |
|----------|------------|---------------------|
| Person-level | 100 persons × 50 entities = 5000 keys | Permission change → invalidate 100 keys |
| **Role-level** | 10 roles × 50 entities = 500 keys | Permission change → invalidate 1 key |

### 6.2 Cache Key Structure

```
rbac:person:{personId}:roles                     → SET of role_ids (only person-level key)

rbac:role:{roleId}:deny:{entityCode}             → SET of denied entity_ids
rbac:role:{roleId}:{entityCode}:type             → STRING permission level (0-7 or -1)
rbac:role:{roleId}:perm:{entityCode}:{entityId}  → STRING permission level (0-7 or -1)
```

### 6.3 Cached Permission Check Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHED PERMISSION CHECK FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  check_entity_rbac(personId, 'task', taskId, EDIT)                          │
│  │                                                                           │
│  │  ┌───────────────────────────────────────────────────────────────────┐   │
│  ├─►│ STEP 1: Get Person's Roles                                        │   │
│  │  │                                                                   │   │
│  │  │ Redis: GET rbac:person:{personId}:roles                           │   │
│  │  │        → [roleA, roleB, roleC]                                    │   │
│  │  │                                                                   │   │
│  │  │ MISS → Query DB, cache as SET, TTL 5 min                          │   │
│  │  └───────────────────────────────────────────────────────────────────┘   │
│  │                                                                           │
│  │  ┌───────────────────────────────────────────────────────────────────┐   │
│  ├─►│ STEP 2: Check Deny Across ALL Roles (parallel)                    │   │
│  │  │                                                                   │   │
│  │  │ Redis: SISMEMBER rbac:role:{roleA}:deny:task {taskId}             │   │
│  │  │ Redis: SISMEMBER rbac:role:{roleB}:deny:task {taskId}             │   │
│  │  │ Redis: SISMEMBER rbac:role:{roleC}:deny:task {taskId}             │   │
│  │  │                                                                   │   │
│  │  │ If taskId in ANY → DENIED (short-circuit)                         │   │
│  │  └───────────────────────────────────────────────────────────────────┘   │
│  │                                                                           │
│  │  ┌───────────────────────────────────────────────────────────────────┐   │
│  ├─►│ STEP 3: Get MAX Type-Level Permission Across Roles                │   │
│  │  │                                                                   │   │
│  │  │ Redis: MGET rbac:role:{roleA}:type:task                           │   │
│  │  │             rbac:role:{roleB}:type:task                           │   │
│  │  │             rbac:role:{roleC}:type:task                           │   │
│  │  │        → [3, 5, -1]                                               │   │
│  │  │                                                                   │   │
│  │  │ MAX(3, 5, -1) = 5 >= EDIT(3) → ALLOWED (short-circuit)            │   │
│  │  └───────────────────────────────────────────────────────────────────┘   │
│  │                                                                           │
│  │  ┌───────────────────────────────────────────────────────────────────┐   │
│  └─►│ STEP 4: Get MAX Instance-Level Permission (if type insufficient)  │   │
│     │                                                                   │   │
│     │ Redis: MGET rbac:role:{roleA}:perm:task:{taskId}                  │   │
│     │             rbac:role:{roleB}:perm:task:{taskId}                  │   │
│     │             rbac:role:{roleC}:perm:task:{taskId}                  │   │
│     │                                                                   │   │
│     │ MISS → Query DB (includes inherited), cache result                │   │
│     │                                                                   │   │
│     │ MAX across all roles >= requiredLevel → ALLOWED                   │   │
│     └───────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Cache Invalidation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CACHE INVALIDATION TRIGGERS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Event                              Invalidate Keys                          │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  1. Person added/removed            rbac:person:{personId}:roles             │
│     from role                       (Just ONE key)                           │
│                                                                              │
│  2. Permission granted/revoked      rbac:role:{roleId}:perm:{entityCode}:*   │
│     on role                         rbac:role:{roleId}:{entityCode}:type     │
│                                     (Just ONE role's keys)                   │
│                                                                              │
│  3. Deny added/removed              rbac:role:{roleId}:deny:{entityCode}     │
│     on role                         (Just ONE key)                           │
│                                                                              │
│  4. Entity hierarchy changed        rbac:role:*:perm:{entityCode}:*          │
│     (parent-child link modified)    (All roles - rare event)                 │
│                                                                              │
│  5. Role deleted                    rbac:role:{roleId}:*                     │
│                                     (All keys for that role)                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Cache Implementation

```typescript
// apps/api/src/services/rbac-cache.service.ts

const CACHE_TTL = 300; // 5 minutes

const keys = {
  personRoles: (personId: string) => `rbac:person:${personId}:roles`,
  roleDeny: (roleId: string, entityCode: string) => `rbac:role:${roleId}:deny:${entityCode}`,
  roleType: (roleId: string, entityCode: string) => `rbac:role:${roleId}:type:${entityCode}`,
  rolePerm: (roleId: string, entityCode: string, entityId: string) =>
    `rbac:role:${roleId}:perm:${entityCode}:${entityId}`,
};

// Invalidation methods
async invalidatePersonRoles(personId: string): Promise<void> {
  await redis.del(keys.personRoles(personId));
}

async invalidateRolePermission(roleId: string, entityCode: string): Promise<void> {
  await redis.del(keys.roleType(roleId, entityCode));
  await deleteByPattern(`rbac:role:${roleId}:perm:${entityCode}:*`);
}

async invalidateRoleDeny(roleId: string, entityCode: string): Promise<void> {
  await redis.del(keys.roleDeny(roleId, entityCode));
}

async invalidateRole(roleId: string): Promise<void> {
  await deleteByPattern(`rbac:role:${roleId}:*`);
}
```

### 6.6 Redis Commands Used

| Operation | Redis Command | Purpose |
|-----------|---------------|---------|
| Get person's roles | `SMEMBERS` | Returns all role IDs |
| Check deny | `SISMEMBER` | O(1) set membership check |
| Get type permission | `MGET` | Batch fetch multiple keys |
| Cache permission | `SETEX` | Set with TTL |
| Invalidate pattern | `SCAN` + `DEL` | Safe pattern deletion |

---

## 7. Performance Analysis

### 7.1 Query Costs (Without Cache)

| Step | Query Type | Cost |
|------|------------|------|
| Find roles | Single indexed lookup | O(1) |
| Check deny | Single indexed lookup | O(1) |
| Direct permissions | Single indexed lookup with IN | O(roles) |
| Ancestor walk | Recursive CTE | O(hierarchy depth) |
| **Total** | Single SQL query | O(depth) |

**Key Insight**: The recursive CTE runs as a **single query**, not N sequential queries.

### 7.2 Query Costs (With Cache)

| Step | Cache Hit | Cache Miss |
|------|-----------|------------|
| Get roles | O(1) Redis | O(1) DB + cache |
| Check deny | O(roles) parallel Redis | O(roles) DB + cache |
| Type permission | O(1) Redis MGET | O(roles) DB + cache |
| Instance permission | O(1) Redis MGET | O(1) CTE + cache |

**Best case**: 3 Redis round-trips, 0 DB queries
**Worst case**: 3 Redis round-trips + 3 DB queries (first access)

### 7.3 Potential Bottlenecks

| Bottleneck | Cause | Mitigation |
|------------|-------|------------|
| Deep hierarchies | 10+ level ancestor walk | Limit depth to 10 in CTE |
| Many roles per person | Large IN clause | Rarely >10 roles in practice |
| Large deny sets | Many denied entities | Rare use case |
| Cache stampede | Many misses at once | TTL jitter, warm-up |

### 7.4 Indexing Requirements

```sql
-- entity_instance_link: Role membership lookup
CREATE INDEX idx_eil_role_person
ON app.entity_instance_link(entity_code, child_entity_code, child_entity_instance_id);

-- entity_rbac: Permission lookup
CREATE INDEX idx_rbac_role_entity
ON app.entity_rbac(role_id, entity_code, entity_instance_id);

-- entity_rbac: Deny lookup
CREATE INDEX idx_rbac_deny
ON app.entity_rbac(role_id, is_deny) WHERE is_deny = true;
```

---

## 8. Data Gating Query Optimization (v2.1.0)

### 8.1 The Problem: Large `IN` Clauses

The `get_entity_rbac_where_condition()` method returns accessible entity IDs for filtering LIST queries. With large permission sets, this can generate slow queries:

```sql
-- SLOW: PostgreSQL struggles with large IN lists
SELECT * FROM app.project e
WHERE e.id IN ('uuid1', 'uuid2', ..., 'uuid100000')  -- 100K literals!
```

**Issues with large `IN` clauses:**
| Issue | Impact |
|-------|--------|
| Query parsing | ~500ms to parse 100K literals |
| Memory consumption | Large AST in planner |
| Poor plan quality | Optimizer gives up with too many OR conditions |
| Network overhead | Huge SQL strings sent to database |

### 8.2 Solution: `ANY(ARRAY[...])` Pattern (Implemented)

PostgreSQL handles arrays much more efficiently than IN lists:

```sql
-- FAST: PostgreSQL optimizes array containment
SELECT * FROM app.project e
WHERE e.id = ANY(ARRAY['uuid1', 'uuid2', ..., 'uuid100000']::uuid[])
```

**Implementation in `entity-infrastructure.service.ts`:**
```typescript
// OLD (slow)
return sql`${sql.raw(table_alias)}.id IN (${sql.join(accessibleIds.map(id => sql`${id}`), sql`, `)})`;

// NEW (fast) - v2.1.0
const uuidArrayLiteral = `ARRAY[${accessibleIds.map(id => `'${id}'`).join(',')}]::uuid[]`;
return sql.raw(`${table_alias}.id = ANY(${uuidArrayLiteral})`);
```

**Performance comparison:**
| Metric | `IN (...)` | `ANY(ARRAY[...])` | Improvement |
|--------|------------|-------------------|-------------|
| Parse time (100K IDs) | ~500ms | ~50ms | 10x faster |
| Planner memory | High | Low | Significant |
| Plan quality | Degrades | Stable | Better execution |

### 8.3 Additional Strategies for Extreme Cases

For even larger ID sets (>100K), consider:

| Strategy | When to Use | Trade-off |
|----------|-------------|-----------|
| **Temp table** | >100K IDs per query | More setup, better execution |
| **Materialized view** | Very frequent access, stale OK | Best performance, refresh lag |
| **Redis cache** | Same IDs requested repeatedly | Extra hop, but sub-ms lookup |

**Recommendation Matrix:**
| Scenario | Recommended Solution |
|----------|---------------------|
| <1K IDs | `ANY(ARRAY[...])` (default) |
| 1K-100K IDs | `ANY(ARRAY[...])` + Redis cache |
| 100K+ IDs | Temp table or materialized view |
| Real-time permissions critical | `ANY(ARRAY[...])` without cache |

See `docs/caching-backend/BACKEND_CACHE_SERVICE.md` Section 10 for detailed implementation of advanced strategies.

---

## Related Documentation

| Document | Path | Purpose |
|----------|------|---------|
| Role Access Control UI | `docs/role/ROLE_ACCESS_CONTROL.md` | Frontend components and UX |
| Entity Infrastructure Service | `docs/services/entity-infrastructure.service.md` | Service API reference |
| DDL Schema | `db/entity_configuration_settings/06_entity_rbac.ddl` | Database schema |
| Cache Service | `docs/caching-backend/BACKEND_CACHE_SERVICE.md` | Cache architecture and optimization |

---

**Version**: 2.2.0 | **Updated**: 2025-12-13

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-09 | Initial Role-Only RBAC model |
| 1.1.0 | 2025-12-10 | Data gating query optimization |
| 2.2.0 | 2025-12-13 | **Ownership Model**: Added `root_level_entity_flag` and `ownership_flag` for traversal control, lookup children capped at COMMENT permission |
