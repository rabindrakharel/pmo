# RBAC Infrastructure Documentation

> **Version**: 2.0.0 (Role-Only Model)
> **Updated**: 2025-12-09
> **Status**: Production Ready

---

## Overview

The PMO platform uses a **Role-Only RBAC Model** where all permissions are granted to roles, and people receive permissions through role membership. This eliminates the complexity of dual permission sources (employee + role).

### Key Principles

| Principle | Description |
|-----------|-------------|
| **Role-Only** | All permissions granted to roles, not directly to employees |
| **Role Membership** | People belong to roles via `entity_instance_link` |
| **Configurable Inheritance** | Three modes: `none`, `cascade`, `mapped` |
| **Explicit Deny** | `is_deny=true` blocks permission even if granted elsewhere |
| **Permission Levels 0-7** | VIEW(0) through OWNER(7) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROLE-ONLY RBAC ARCHITECTURE (v2.0.0)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐                                                     │
│  │      app.role       │  Source of truth for organizational roles           │
│  │  ─────────────────  │  (CEO, Project Manager, Engineer, etc.)             │
│  │  id, code, name     │                                                     │
│  └──────────┬──────────┘                                                     │
│             │                                                                │
│             │  role_id FK                                                    │
│             ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         app.entity_rbac                                  ││
│  │  ─────────────────────────────────────────────────────────────────────  ││
│  │  Permissions granted TO ROLES (not persons)                              ││
│  │                                                                          ││
│  │  • role_id (FK → app.role)                                               ││
│  │  • entity_code + entity_instance_id (target)                             ││
│  │  • permission (0-7)                                                      ││
│  │  • inheritance_mode (none/cascade/mapped)                                ││
│  │  • child_permissions (JSONB for mapped mode)                             ││
│  │  • is_deny (explicit deny)                                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────┐                                                     │
│  │ entity_instance_link│  Role ↔ Person membership                           │
│  │  ─────────────────  │  entity_code='role', child_entity_code='person'    │
│  └──────────┬──────────┘                                                     │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────┐                                                     │
│  │     app.person      │  Source of truth for people                         │
│  │  ─────────────────  │  (employees, customers, vendors)                    │
│  │  id, code, name     │                                                     │
│  └─────────────────────┘                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Permission Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION HIERARCHY (0-7)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Level  Name        Description                 Implies                     │
│  ─────  ────        ───────────                 ───────                     │
│    0    VIEW        Read-only access            -                           │
│    1    COMMENT     Add comments                VIEW                        │
│    2    CONTRIBUTE  Insert form data            COMMENT, VIEW               │
│    3    EDIT        Modify entity               CONTRIBUTE, COMMENT, VIEW   │
│    4    SHARE       Share with others           EDIT + below                │
│    5    DELETE      Soft delete                 SHARE + below               │
│    6    CREATE      Create new (type-level)     DELETE + below              │
│    7    OWNER       Full control                ALL                         │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Permission Check: hasPermission(user, required) = user.level >= required   │
│                                                                              │
│  Example: User has EDIT (3)                                                 │
│    ✓ Can VIEW (0)                                                           │
│    ✓ Can COMMENT (1)                                                        │
│    ✓ Can CONTRIBUTE (2)                                                     │
│    ✓ Can EDIT (3)                                                           │
│    ✗ Cannot SHARE (4)                                                       │
│    ✗ Cannot DELETE (5)                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### TypeScript Enum

```typescript
export enum Permission {
  VIEW       = 0,  // Read-only access
  COMMENT    = 1,  // Add comments (implies VIEW)
  CONTRIBUTE = 2,  // Insert form data (implies COMMENT)
  EDIT       = 3,  // Modify entity (implies CONTRIBUTE)
  SHARE      = 4,  // Share with others (implies EDIT)
  DELETE     = 5,  // Soft delete (implies SHARE)
  CREATE     = 6,  // Create new (type-level only)
  OWNER      = 7   // Full control (implies ALL)
}

// Type-level permission constant
export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
```

---

## Inheritance Modes

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    INHERITANCE MODES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │                 │  │        ●        │  │    ●   ●   ●    │  │
│  │        ●        │  │       /|\       │  │   /|\ /|\ /|\   │  │
│  │                 │  │      / | \      │  │  E=3 W=0 T=5    │  │
│  │                 │  │     ●  ●  ●     │  │  ●   ●   ●      │  │
│  │                 │  │    EDIT EDIT    │  │                 │  │
│  │                 │  │     EDIT        │  │                 │  │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤  │
│  │      NONE       │  │     CASCADE     │  │     MAPPED      │  │
│  │  This entity    │  │  Same to all    │  │  Different per  │  │
│  │  only           │  │  children       │  │  child type     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Mode Details

| Mode | Description | Use Case |
|------|-------------|----------|
| `none` | Permission applies only to the target entity | Specific instance access |
| `cascade` | Same permission level flows to all child entities | "EDIT project and all its tasks" |
| `mapped` | Different permission levels per child entity type | "OWNER office, DELETE business, EDIT projects" |

### Mapped Mode Example

```json
{
  "inheritance_mode": "mapped",
  "child_permissions": {
    "business": 5,
    "project": 3,
    "task": 3,
    "employee": 0,
    "_default": 0
  }
}
```

---

## Database Schema

### entity_rbac Table (v2.0.0)

```sql
CREATE TABLE app.entity_rbac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════
  -- ROLE REFERENCE (FK to app.role)
  -- ═══════════════════════════════════════════════════════════
  role_id uuid NOT NULL REFERENCES app.role(id) ON DELETE CASCADE,

  -- ═══════════════════════════════════════════════════════════
  -- ENTITY TARGET
  -- ═══════════════════════════════════════════════════════════
  entity_code varchar(50) NOT NULL,
  entity_instance_id uuid NOT NULL,  -- Specific UUID or ALL_ENTITIES_ID

  -- ═══════════════════════════════════════════════════════════
  -- PERMISSION
  -- ═══════════════════════════════════════════════════════════
  permission integer NOT NULL DEFAULT 0,  -- 0-7

  -- ═══════════════════════════════════════════════════════════
  -- INHERITANCE CONFIGURATION (v2.0.0)
  -- ═══════════════════════════════════════════════════════════
  inheritance_mode varchar(20) NOT NULL DEFAULT 'none',
  child_permissions jsonb NOT NULL DEFAULT '{}',
  is_deny boolean NOT NULL DEFAULT false,

  -- ═══════════════════════════════════════════════════════════
  -- AUDIT & LIFECYCLE
  -- ═══════════════════════════════════════════════════════════
  granted_by_person_id uuid REFERENCES app.person(id),
  granted_ts timestamptz DEFAULT now(),
  expires_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- Unique constraint: one permission per role per entity instance
CREATE UNIQUE INDEX idx_entity_rbac_unique
ON app.entity_rbac (role_id, entity_code, entity_instance_id);

-- Efficient lookup for inheritance resolution
CREATE INDEX idx_entity_rbac_inheritance
ON app.entity_rbac (entity_code, entity_instance_id, inheritance_mode)
WHERE inheritance_mode != 'none';
```

### Role-Person Membership

```sql
-- Stored in entity_instance_link:
-- entity_code = 'role', entity_instance_id = role.id
-- child_entity_code = 'person', child_entity_instance_id = person.id

INSERT INTO app.entity_instance_link
  (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
VALUES
  ('role', 'ceo-role-uuid', 'person', 'james-person-uuid', 'member');
```

### Infrastructure Tables Summary

| Table | Delete Behavior | Purpose |
|-------|-----------------|---------|
| `entity` | Soft delete (`active_flag`) | Entity type metadata |
| `entity_instance` | **Hard delete** | Global instance registry |
| `entity_instance_link` | **Hard delete** | Parent-child relationships, role membership |
| `entity_rbac` | **Hard delete** | Role-based permissions |

---

## Permission Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION RESOLUTION FLOW (v2.0.0)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  check_entity_rbac(personId, 'project', projectId, Permission.EDIT)         │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  1. FIND PERSON'S ROLES                                               │  │
│  │     entity_instance_link WHERE                                         │  │
│  │       entity_code = 'role' AND                                         │  │
│  │       child_entity_code = 'person' AND                                 │  │
│  │       child_entity_instance_id = personId                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  2. CHECK EXPLICIT DENY (highest priority)                            │  │
│  │     entity_rbac WHERE role_id IN (person_roles) AND is_deny = true    │  │
│  │     → If DENY found → DENIED (stop)                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  3. GET DIRECT ROLE PERMISSIONS                                       │  │
│  │     entity_rbac WHERE role_id IN (person_roles)                       │  │
│  │       AND entity_code = target_code                                    │  │
│  │       AND (entity_instance_id = target_id OR ALL_ENTITIES_ID)         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  4. GET INHERITED PERMISSIONS                                         │  │
│  │     Find ancestors via entity_instance_link (recursive)               │  │
│  │     For each ancestor with cascade/mapped mode:                       │  │
│  │       - cascade → same permission level                               │  │
│  │       - mapped → lookup in child_permissions                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  5. RETURN MAX(all permissions found)                                 │  │
│  │     user.level >= required_level ? ALLOWED : DENIED                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SQL Query (Simplified)

```sql
WITH
-- 1. Find person's roles
person_roles AS (
  SELECT eil.entity_instance_id AS role_id
  FROM app.entity_instance_link eil
  WHERE eil.entity_code = 'role'
    AND eil.child_entity_code = 'person'
    AND eil.child_entity_instance_id = $person_id::uuid
),

-- 2. Check explicit deny
explicit_deny AS (
  SELECT -999 AS permission
  FROM app.entity_rbac er
  JOIN person_roles pr ON er.role_id = pr.role_id
  WHERE er.entity_code = $entity_code
    AND (er.entity_instance_id = '11111111-1111-1111-1111-111111111111'::uuid
         OR er.entity_instance_id = $entity_id::uuid)
    AND er.is_deny = true
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
),

-- 3. Direct role permissions
direct_role_perms AS (
  SELECT er.permission
  FROM app.entity_rbac er
  JOIN person_roles pr ON er.role_id = pr.role_id
  WHERE er.entity_code = $entity_code
    AND (er.entity_instance_id = '11111111-1111-1111-1111-111111111111'::uuid
         OR er.entity_instance_id = $entity_id::uuid)
    AND er.is_deny = false
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
),

-- 4. Inherited permissions (via recursive ancestor chain)
RECURSIVE ancestor_chain AS (
  SELECT eil.entity_code AS ancestor_code, eil.entity_instance_id AS ancestor_id, 1 AS depth
  FROM app.entity_instance_link eil
  WHERE eil.child_entity_code = $entity_code
    AND eil.child_entity_instance_id = $entity_id::uuid
  UNION ALL
  SELECT eil.entity_code, eil.entity_instance_id, ac.depth + 1
  FROM ancestor_chain ac
  JOIN app.entity_instance_link eil
    ON eil.child_entity_code = ac.ancestor_code
    AND eil.child_entity_instance_id = ac.ancestor_id
  WHERE ac.depth < 10
),

inherited_perms AS (
  SELECT
    CASE
      WHEN er.inheritance_mode = 'cascade' THEN er.permission
      WHEN er.inheritance_mode = 'mapped' THEN
        COALESCE(
          (er.child_permissions->>$entity_code)::int,
          (er.child_permissions->>'_default')::int,
          -1
        )
      ELSE -1
    END AS permission
  FROM app.entity_rbac er
  JOIN person_roles pr ON er.role_id = pr.role_id
  JOIN ancestor_chain ac ON er.entity_code = ac.ancestor_code
    AND er.entity_instance_id = ac.ancestor_id
  WHERE er.inheritance_mode IN ('cascade', 'mapped')
    AND er.is_deny = false
)

-- 5. Return MAX
SELECT COALESCE(MAX(permission), -1) AS max_permission
FROM (
  SELECT * FROM explicit_deny
  UNION ALL
  SELECT * FROM direct_role_perms
  UNION ALL
  SELECT * FROM inherited_perms
) AS all_perms
WHERE permission != -999;
```

---

## API Endpoints

### Role Permissions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/v1/entity_rbac/role/:roleId/permissions` | GET | List role's permissions |
| `POST /api/v1/entity_rbac/grant-permission` | POST | Grant permission to role |
| `DELETE /api/v1/entity_rbac/permission/:id` | DELETE | Revoke permission |

### Role Members

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/v1/entity_rbac/role/:roleId/members` | GET | List role members |
| `POST /api/v1/entity_rbac/role/:roleId/members` | POST | Add person to role |
| `DELETE /api/v1/entity_rbac/role/:roleId/members/:personId` | DELETE | Remove from role |

### Effective Access

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/v1/entity_rbac/person/:personId/effective-access` | GET | Get resolved permissions |
| `POST /api/v1/entity_rbac/get-permissions-by-entityCode` | POST | Check permission for entity |

### Response Format

All endpoints return TanStack Query-compatible format:

```typescript
// GET /api/v1/entity_rbac/role/:roleId/permissions
{
  "data": [
    {
      "id": "permission-uuid",
      "entity_code": "project",
      "entity_instance_id": "11111111-1111-1111-1111-111111111111",
      "permission": 7,
      "inheritance_mode": "mapped",
      "child_permissions": { "task": 3, "_default": 0 },
      "is_deny": false,
      "granted_ts": "2025-12-09T10:00:00Z",
      "expires_ts": null
    }
  ]
}
```

---

## Service Methods

### Permission Checking

```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

const entityInfra = getEntityInfrastructure(db);

// Check specific permission
const canEdit = await entityInfra.check_entity_rbac(
  personId,           // Person UUID (from app.person)
  'project',          // Entity type code
  projectId,          // Entity instance ID
  Permission.EDIT     // Required permission
);

// Type-level check (e.g., can CREATE any project)
const canCreate = await entityInfra.check_entity_rbac(
  personId,
  'project',
  ALL_ENTITIES_ID,
  Permission.CREATE
);

// Get SQL WHERE clause for RBAC-filtered queries
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  personId,           // Person UUID
  'project',          // Entity type code
  Permission.VIEW,    // Required permission
  'e'                 // Table alias
);
```

### Transactional CRUD

```typescript
// CREATE (all operations in ONE transaction)
const result = await entityInfra.create_entity({
  entity_code: 'project',
  creator_id: personId,
  parent_entity_code: 'business',
  parent_entity_id: businessId,
  primary_table: 'app.project',
  primary_data: { name, code, descr }
});

// UPDATE (UPDATE + registry sync in ONE transaction)
const result = await entityInfra.update_entity({
  entity_code: 'project',
  entity_id: projectId,
  primary_table: 'app.project',
  primary_updates: { name: 'New Name' }
});

// DELETE (all cleanup in ONE transaction)
const result = await entityInfra.delete_entity({
  entity_code: 'project',
  entity_id: projectId,
  user_id: personId,
  primary_table: 'app.project',
  hard_delete: false
});
```

---

## Frontend Components

### UI Components (v2.0.0)

| Component | Location | Purpose |
|-----------|----------|---------|
| `AccessControlPage` | `apps/web/src/pages/setting/` | Main RBAC management |
| `PermissionLevelSelector` | `apps/web/src/components/rbac/` | Visual bar chart permission picker (0-7) |
| `InheritanceModeSelector` | `apps/web/src/components/rbac/` | Icon-based selector for none/cascade/mapped |
| `ChildPermissionMapper` | `apps/web/src/components/rbac/` | Configure per-child-type permissions |
| `PermissionRuleCard` | `apps/web/src/components/rbac/` | Permission display with inheritance visualization |
| `EffectiveAccessTable` | `apps/web/src/components/rbac/` | Show resolved permissions after inheritance |
| `GrantPermissionModal` | `apps/web/src/components/rbac/` | 4-step wizard for granting permissions |

### Grant Permission Wizard Steps

1. **Target Selection** - Select entity type and scope (all or specific instance)
2. **Permission Level** - Visual bar chart selector (0-7)
3. **Child Inheritance** - Choose none/cascade/mapped mode
4. **Special Options** - Explicit deny toggle, expiration date

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| UI/UX Page | `docs/ui_pages/RBACOverviewPage.md` | Frontend components and layout |
| Design Document | `docs/design_pattern/PERMISSION_INHERITANCE_IMPLEMENTATION.md` | Implementation design |
| Entity Infrastructure | `docs/services/entity-infrastructure.service.md` | Service API reference |
| DDL Schema | `db/entity_configuration_settings/06_entity_rbac.ddl` | Database schema |
| API Routes | `apps/api/src/modules/rbac/routes.ts` | API implementation |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-12-09 | **Role-Only Model**: Removed direct employee permissions (`person_code`/`person_id` columns), added `role_id` FK, inheritance modes (`none`/`cascade`/`mapped`), `child_permissions` JSONB, explicit deny (`is_deny`) |
| 1.0.0 | 2025-11-20 | Initial dual model (employee + role with `person_code`/`person_id`) |

---

**Last Updated**: 2025-12-09 | **Status**: Production Ready
