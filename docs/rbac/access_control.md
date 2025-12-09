# RBAC Access Control - Complete Technical Reference

> Role-Only RBAC Model v2.0.0 - Backend routes, business logic, data flow, and integration patterns

**Version**: 2.0.0 | **Updated**: 2025-12-09 | **Status**: Production

---

## 1. Architecture Overview

### 1.1 Role-Only Model Principle

All permissions are granted to **roles**, not directly to people. People receive permissions through role membership.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROLE-ONLY RBAC DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   app.role ──────────────► app.entity_rbac ◄──────────── app.entity          │
│   (who holds)               (permissions)                (what is protected) │
│        │                         │                                           │
│        │                         │ role_id FK                                │
│        ▼                         ▼                                           │
│   entity_instance_link      RBAC checks resolve                              │
│   (role → person)           person → roles → permissions                     │
│        │                                                                     │
│        ▼                                                                     │
│   app.person ──────────────────────────────────────────────────────────────► │
│   (employees, customers)                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Infrastructure Tables

| Table | Delete Behavior | Purpose |
|-------|-----------------|---------|
| `app.entity_rbac` | Hard delete | Role → Entity permission grants |
| `app.entity_instance_link` | Hard delete | Role → Person membership |
| `app.role` | Soft delete (`active_flag`) | Role definitions |
| `app.person` | Soft delete (`active_flag`) | People (employees, customers, vendors) |

---

## 2. Permission System

### 2.1 Permission Levels (0-7)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Level  Name        Implies              Use Case                           │
│  ─────  ────        ───────              ────────                           │
│    0    VIEW        -                    Read-only access                   │
│    1    COMMENT     VIEW                 Add comments to records            │
│    2    CONTRIBUTE  COMMENT              Insert form data                   │
│    3    EDIT        CONTRIBUTE           Modify existing records            │
│    4    SHARE       EDIT                 Share with other users             │
│    5    DELETE      SHARE                Soft delete records                │
│    6    CREATE      DELETE               Create new instances (type-level)  │
│    7    OWNER       ALL                  Full control                       │
└─────────────────────────────────────────────────────────────────────────────┘

Permission Check: user.level >= required_level → ALLOWED
```

### 2.2 Type-Level vs Instance-Level

| Scope | `entity_instance_id` | Example |
|-------|---------------------|---------|
| Type-level | `11111111-1111-1111-1111-111111111111` (ALL_ENTITIES_ID) | "Can CREATE any project" |
| Instance-level | Specific UUID | "Can EDIT project X only" |

### 2.3 Inheritance Modes

| Mode | Description | SQL Logic |
|------|-------------|-----------|
| `none` | Permission applies only to target | Direct lookup only |
| `cascade` | Same permission flows to all children | Recursive join via `entity_instance_link` |
| `mapped` | Different permission per child type | `child_permissions` JSONB lookup |

**Mapped Mode Example**:
```json
{
  "inheritance_mode": "mapped",
  "child_permissions": {
    "task": 3,
    "employee": 0,
    "_default": 0
  }
}
```

### 2.4 Explicit Deny

When `is_deny = true`, blocks permission even if granted elsewhere. Checked **first** in resolution flow.

---

## 3. Permission Resolution Flow

### 3.1 Algorithm

```
check_entity_rbac(personId, entityCode, entityId, requiredLevel)
│
├─► 1. Find Person's Roles
│      Query entity_instance_link WHERE entity_code='role' AND child_entity_code='person'
│      Result: Array of role_ids
│
├─► 2. Check Explicit Deny (highest priority)
│      Query entity_rbac WHERE role_id IN (roles) AND is_deny=true
│      If found → DENIED (stop)
│
├─► 3. Check Direct Permissions
│      Query entity_rbac WHERE role_id IN (roles)
│        AND entity_code = target AND entity_instance_id IN (targetId, ALL_ENTITIES_ID)
│
├─► 4. Check Inherited Permissions (if inheritance_mode != 'none')
│      Recursive ancestor walk via entity_instance_link
│      For cascade: same permission level
│      For mapped: lookup child_permissions[entityCode] or _default
│
└─► 5. Return MAX(all permissions found) >= requiredLevel
```

### 3.2 SQL Pattern (Simplified)

```sql
-- Step 1: Get person's roles
WITH person_roles AS (
  SELECT entity_instance_id AS role_id
  FROM app.entity_instance_link
  WHERE entity_code = 'role'
    AND child_entity_code = 'person'
    AND child_entity_instance_id = $person_id
),

-- Step 2: Check explicit deny
explicit_deny AS (
  SELECT 1 FROM app.entity_rbac er
  JOIN person_roles pr ON er.role_id = pr.role_id
  WHERE er.entity_code = $entity_code
    AND er.entity_instance_id IN ($entity_id, '11111111-...')
    AND er.is_deny = true
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
),

-- Step 3: Get direct permissions
direct_perms AS (
  SELECT er.permission
  FROM app.entity_rbac er
  JOIN person_roles pr ON er.role_id = pr.role_id
  WHERE er.entity_code = $entity_code
    AND er.entity_instance_id IN ($entity_id, '11111111-...')
    AND er.is_deny = false
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
)

-- Step 4-5: Return max (if no deny)
SELECT CASE WHEN EXISTS (SELECT 1 FROM explicit_deny)
  THEN -999
  ELSE COALESCE(MAX(permission), -1)
END FROM direct_perms;
```

---

## 4. API Routes Reference

### 4.1 Route File

**Location**: `apps/api/src/modules/rbac/routes.ts`

### 4.2 Permission Check Endpoints

| Route | Method | Business Logic |
|-------|--------|----------------|
| `/api/v1/entity_rbac/get-permissions-by-entityCode` | POST | Get type-level permissions for entity (main page actions) |
| `/api/v1/entity_rbac/check-permission-of-entity` | POST | Get instance-level permissions (detail page inline edit) |
| `/api/v1/entity_rbac/get-permissions-by-parentEntity-actionEntity` | POST | Get child entity permissions within parent context |
| `/api/v1/entity_rbac/main-page-actions` | POST | Get canCreate/canShare/canDelete flags |

**Request Flow**:
```
Frontend component → POST /api/v1/entity_rbac/get-permissions-by-entityCode
                     { entityCode: 'project' }
                  → entityInfra.check_entity_rbac() for each level (0-7)
                  → { entityCode, permissions: [{ actionEntityId, actions: ['view','edit',...] }] }
```

### 4.3 Role Permission Management

| Route | Method | Business Logic | SQL Pattern |
|-------|--------|----------------|-------------|
| `GET /api/v1/entity_rbac/role/:roleId/permissions` | GET | List role's permissions | SELECT * FROM entity_rbac WHERE role_id = ? |
| `POST /api/v1/entity_rbac/grant-permission` | POST | Grant/upsert permission | INSERT ... ON CONFLICT DO UPDATE |
| `PUT /api/v1/entity_rbac/permission/:id` | PUT | Update existing permission | UPDATE entity_rbac SET ... WHERE id = ? |
| `DELETE /api/v1/entity_rbac/permission/:id` | DELETE | Hard delete permission | DELETE FROM entity_rbac WHERE id = ? |

**Grant Permission Request**:
```typescript
POST /api/v1/entity_rbac/grant-permission
{
  role_id: "uuid",
  entity_code: "project",
  entity_instance_id: "11111111-1111-1111-1111-111111111111", // ALL_ENTITIES_ID
  permission: 7,
  inheritance_mode: "mapped",
  child_permissions: { "task": 3, "_default": 0 },
  is_deny: false,
  expires_ts: null
}
```

**Business Logic**:
1. Validate role exists and is active
2. Validate entity_instance_id format (UUID or ALL_ENTITIES_ID)
3. Call `entityInfra.set_entity_rbac()` which does UPSERT
4. Return created/updated permission with role_name

### 4.4 Role Membership Management

| Route | Method | Business Logic | SQL Pattern |
|-------|--------|----------------|-------------|
| `GET /api/v1/entity_rbac/role/:roleId/members` | GET | List role members | SELECT p.* FROM entity_instance_link eil JOIN person p... |
| `POST /api/v1/entity_rbac/role/:roleId/members` | POST | Add person to role | INSERT INTO entity_instance_link |
| `DELETE /api/v1/entity_rbac/role/:roleId/members/:personId` | DELETE | Remove person | DELETE FROM entity_instance_link |

**Add Member Request**:
```typescript
POST /api/v1/entity_rbac/role/:roleId/members
{ person_id: "uuid" }
```

**SQL for Add Member**:
```sql
INSERT INTO app.entity_instance_link
  (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
VALUES ('role', $roleId, 'person', $personId, 'member')
```

### 4.5 Effective Access & Reporting

| Route | Method | Business Logic |
|-------|--------|----------------|
| `GET /api/v1/entity_rbac/person/:personId/effective-access` | GET | Compute resolved permissions after inheritance |
| `GET /api/v1/entity_rbac/overview` | GET | Summary stats: total permissions, by role, by entity |

**Effective Access Query Pattern**:
```sql
SELECT DISTINCT ON (er.entity_code, er.entity_instance_id)
  er.entity_code, er.permission, er.is_deny,
  CASE WHEN er.inheritance_mode = 'none' THEN 'direct' ELSE 'inherited' END AS source
FROM app.entity_rbac er
JOIN app.role r ON er.role_id = r.id
JOIN app.entity_instance_link eil ON eil.entity_instance_id = r.id
WHERE eil.child_entity_code = 'person'
  AND eil.child_entity_instance_id = $personId
  AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
ORDER BY er.entity_code, er.entity_instance_id, er.permission DESC
```

---

## 5. Service Integration

### 5.1 Entity Infrastructure Service

**Location**: `apps/api/src/services/entity-infrastructure.service.ts`

| Method | Purpose | Used By |
|--------|---------|---------|
| `check_entity_rbac(personId, entityCode, entityId, level)` | Boolean permission check | All routes needing RBAC |
| `get_entity_rbac_where_condition(personId, entityCode, level, alias)` | SQL WHERE clause | Entity list routes |
| `set_entity_rbac(roleId, entityCode, entityId, permission, options)` | Grant/upsert permission | grant-permission route |
| `get_role_permissions(roleId)` | List role's permissions | role permissions route |

### 5.2 Route Integration Pattern

```typescript
// In any entity route (e.g., project/routes.ts)
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;
  const entityInfra = getEntityInfrastructure(db);

  // Get RBAC WHERE clause
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, 'project', Permission.VIEW, 'e'
  );

  // Query with RBAC filter
  const projects = await db.execute(sql`
    SELECT e.* FROM app.project e
    WHERE ${rbacCondition} AND e.active_flag = true
  `);
});

fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;

  // Check CREATE permission (type-level)
  const canCreate = await entityInfra.check_entity_rbac(
    userId, 'project', ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) return reply.status(403).send({ error: 'Forbidden' });

  // Create project...
});
```

---

## 6. Frontend Integration

### 6.1 TanStack Query Cache Keys

| Query Key | Endpoint | Purpose |
|-----------|----------|---------|
| `['access-control', 'roles']` | `GET /api/v1/role` | Role list |
| `['access-control', 'role', roleId, 'permissions']` | `GET /api/v1/entity_rbac/role/:roleId/permissions` | Role's permissions |
| `['access-control', 'role', roleId, 'members']` | `GET /api/v1/entity_rbac/role/:roleId/members` | Role's members |
| `['access-control', 'role', roleId, 'effective']` | `GET /api/v1/entity_rbac/person/:personId/effective-access` | Resolved permissions |

### 6.2 Cache Invalidation

```typescript
// After granting permission
queryClient.invalidateQueries(['access-control', 'role', roleId, 'permissions']);
queryClient.invalidateQueries(['access-control', 'role', roleId, 'effective']);

// After adding/removing member
queryClient.invalidateQueries(['access-control', 'role', roleId, 'members']);
```

### 6.3 Response Format

All endpoints return TanStack Query-compatible format with `data` array:

```typescript
// GET /api/v1/entity_rbac/role/:roleId/permissions
{
  role_id: "uuid",
  role_name: "CEO",
  data: [
    {
      id: "perm-uuid",
      entity_code: "project",
      entity_instance_id: "11111111-1111-1111-1111-111111111111",
      entity_display: "ALL (Type-level)",
      permission: 7,
      permission_label: "Owner",
      inheritance_mode: "mapped",
      child_permissions: { "task": 3, "_default": 0 },
      is_deny: false,
      granted_ts: "2025-12-09T10:00:00Z"
    }
  ]
}
```

---

## 7. Database Schema

### 7.1 entity_rbac Table

```sql
CREATE TABLE app.entity_rbac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES app.role(id) ON DELETE CASCADE,
  entity_code varchar(50) NOT NULL,
  entity_instance_id uuid NOT NULL,  -- UUID or ALL_ENTITIES_ID
  permission integer NOT NULL DEFAULT 0,  -- 0-7
  inheritance_mode varchar(20) NOT NULL DEFAULT 'none',
  child_permissions jsonb NOT NULL DEFAULT '{}',
  is_deny boolean NOT NULL DEFAULT false,
  granted_by_person_id uuid REFERENCES app.person(id),
  granted_ts timestamptz DEFAULT now(),
  expires_ts timestamptz,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- Unique: one permission per role per entity instance
CREATE UNIQUE INDEX idx_entity_rbac_unique
ON app.entity_rbac (role_id, entity_code, entity_instance_id);

-- Fast inheritance lookups
CREATE INDEX idx_entity_rbac_inheritance
ON app.entity_rbac (entity_code, entity_instance_id, inheritance_mode)
WHERE inheritance_mode != 'none';
```

### 7.2 Role Membership (entity_instance_link)

```sql
-- Role → Person membership
INSERT INTO app.entity_instance_link (
  entity_code,           -- 'role'
  entity_instance_id,    -- role.id
  child_entity_code,     -- 'person'
  child_entity_instance_id,  -- person.id
  relationship_type      -- 'member'
) VALUES ('role', $roleId, 'person', $personId, 'member');
```

---

## 8. Business Rules

### 8.1 Permission Grant Rules

1. **Role must exist and be active** - Check `active_flag = true`
2. **Entity code must be valid** - Check against `app.entity` table
3. **UPSERT behavior** - Same role + entity_code + entity_instance_id → UPDATE
4. **Expiration optional** - `expires_ts IS NULL` means permanent
5. **Granted_by tracked** - Current user's person_id

### 8.2 Permission Check Rules

1. **Explicit deny wins** - `is_deny = true` blocks even if granted elsewhere
2. **Expired permissions ignored** - `expires_ts < NOW()` filtered out
3. **MAX wins** - Multiple permissions → highest level applies
4. **Inheritance checked recursively** - Walk ancestor chain via `entity_instance_link`
5. **Type-level checked** - Both specific ID and ALL_ENTITIES_ID checked

### 8.3 Membership Rules

1. **One link per person-role pair** - Duplicate check before INSERT
2. **Person must exist** - Validate against `app.person`
3. **Hard delete on removal** - No soft delete for membership links

---

## 9. Error Handling

| HTTP Code | Condition | Response |
|-----------|-----------|----------|
| 400 | Invalid role_id, person_id, or duplicate | `{ error: "Role not found" }` |
| 401 | Missing or invalid JWT | `{ error: "User not authenticated" }` |
| 403 | Permission denied | `{ error: "Forbidden" }` |
| 404 | Permission or member not found | `{ error: "Permission not found" }` |
| 500 | Database error | `{ error: "Internal server error" }` |

---

## 10. Related Documentation

| Document | Path | Purpose |
|----------|------|---------|
| AccessControlPage UI | `docs/ui_pages/AccessControlPage.md` | Frontend components and state |
| Entity Infrastructure | `docs/services/entity-infrastructure.service.md` | Service API |
| DDL Schema | `db/entity_configuration_settings/06_entity_rbac.ddl` | Database schema |

---

## 11. UI/UX Design Patterns

### 11.1 Component Architecture

| Component | Purpose | Location |
|-----------|---------|----------|
| `AccessControlPage` | Main RBAC management page | `pages/setting/` |
| `GrantPermissionModal` | 4-step wizard for granting permissions | `components/rbac/` |
| `PermissionLevelSelector` | Visual bar chart permission picker | `components/rbac/` |
| `InheritanceModeSelector` | None/Cascade/Mapped selector | `components/rbac/` |
| `ChildPermissionMapper` | Per-child-type permission table | `components/rbac/` |
| `PermissionRuleCard` | Display single permission with inheritance | `components/rbac/` |
| `EffectiveAccessTable` | Show resolved permissions with source | `components/rbac/` |
| `PermissionBadge` | Inline permission level badge | `components/rbac/` |

### 11.2 Permission Level Visual Selector

```
                                              ┌───────┐
                                              │ OWNER │
                                     ┌───────┐│   7   │
                                     │CREATE ││       │
                            ┌───────┐│   6   ││       │
                            │DELETE ││       ││       │
                   ┌───────┐│   5   ││       ││       │
                   │ SHARE ││       ││       ││       │
          ┌───────┐│   4   ││       ││       ││       │
          │ EDIT  ││       ││       ││       ││       │
 ┌───────┐│   3   ││       ││       ││       ││       │
 │COMMENT││       ││       ││       ││       ││       │
 │   1   ││       ││       ││       ││       ││       │
─┴───────┴┴───────┴┴───────┴┴───────┴┴───────┴┴───────┴─
     ▲ Selected (click to change)
```

### 11.3 Inheritance Mode Visual Selector

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│        ●        │  │        ●        │  │    ●   ●   ●    │
│                 │  │       /|\       │  │   /|\ /|\ /|\   │
│                 │  │      / | \      │  │  E=3 W=0 T=5    │
│                 │  │     ●  ●  ●     │  │  ●   ●   ●      │
│                 │  │   (same level)  │  │ (different)     │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│      NONE       │  │     CASCADE     │  │     MAPPED      │
│  This entity    │  │  Same to all    │  │  Different per  │
│  only           │  │  children       │  │  child type     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 11.4 Permission Card Display

```
┌─────────────────────────────────────────────────────────────────┐
│  🏢 Office (All Instances)                           OWNER (7)  │
│                                                                  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│                                                                  │
│  Inheritance: Mapped                                             │
│  ├─ Business     DELETE (5)   ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░            │
│  ├─ Project      EDIT (3)     ▓▓▓▓▓▓░░░░░░░░░░░░░░░░            │
│  ├─ Task         EDIT (3)     ▓▓▓▓▓▓░░░░░░░░░░░░░░░░            │
│  └─ _default     VIEW (0)     ▓░░░░░░░░░░░░░░░░░░░░░            │
│                                                                  │
│  Granted: 2025-01-15                         [Edit] [Revoke]    │
└─────────────────────────────────────────────────────────────────┘
```

### 11.5 Effective Access Table

```
┌─────────────────────────────────────────────────────────────────┐
│  Effective Access for "CEO Role"                                 │
├─────────────────────────────────────────────────────────────────┤
│  Entity Type     Access Level   Source                          │
├─────────────────────────────────────────────────────────────────┤
│  Office          OWNER (7)      Direct                          │
│  Business        DELETE (5)     ← Inherited from Office         │
│  Project         EDIT (3)       ← Inherited from Office         │
│  Task            EDIT (3)       ← Inherited from Project        │
│  Wiki            ⛔ DENIED      Direct (Explicit Deny)          │
└─────────────────────────────────────────────────────────────────┘

Legend:
  Direct    = Permission granted directly to this role
  Inherited = Permission inherited from parent entity
  ⛔ DENIED = Explicit deny blocks all access
```

### 11.6 Conditional Class Pattern (Modern)

All RBAC components use **template literals** for conditional classes (no external dependencies):

```tsx
// Modern approach - zero dependencies
className={`base-class ${isActive ? "active-class" : "inactive-class"}`}
className={`base-class ${condition ? "conditional-class" : ""}`}
```

---

**Version History**:
- v2.1.0 (2025-12-09): Added UI/UX design patterns, template literal styling
- v2.0.0 (2025-12-09): Role-Only Model - removed dual person_code/person_id, added role_id FK, inheritance modes, explicit deny
- v1.0.0 (2025-11-20): Initial dual model (employee + role)
