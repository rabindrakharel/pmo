# Permission Inheritance to Children - Implementation Design

> **Status**: Design Phase
> **Version**: 2.0.0
> **Date**: 2025-12-09

## Overview

Replace the current RBAC model with a simplified **role-only** permission system:

1. **Remove direct employee permissions** - No `person_code='employee'` in entity_rbac
2. **Role-based only** - All permissions granted to roles (from `app.role` table)
3. **Person-to-Role mapping** via `entity_instance_link` (role → person)
4. **Configurable child inheritance** - cascade, mapped, or none

---

## Architecture Change: Role-Only RBAC

### Current Model (TO BE REMOVED)

```
┌─────────────────────────────────────────────────────────────┐
│  CURRENT: Dual Permission Sources (REMOVE)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  entity_rbac                                                 │
│  ├── person_code = 'employee' + person_id = employee.id     │
│  │   └── Direct employee permissions (REMOVE)               │
│  │                                                           │
│  └── person_code = 'role' + person_id = role.id             │
│      └── Role-based permissions (KEEP & SIMPLIFY)           │
│                                                              │
│  Permission Resolution: MAX(direct_employee, role_based)    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### New Model (Role-Only)

```
┌─────────────────────────────────────────────────────────────┐
│  NEW: Role-Only Permissions                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  app.role (source of truth for roles)                       │
│  ├── id, code, name, descr                                  │
│  └── Defines organizational roles                           │
│                                                              │
│  app.person (source of truth for people)                    │
│  ├── id, code, name, email                                  │
│  └── Employees, customers, vendors, etc.                    │
│                                                              │
│  app.entity_instance_link (role ↔ person mapping)           │
│  ├── entity_code = 'role'                                   │
│  ├── entity_instance_id = role.id                           │
│  ├── child_entity_code = 'person'                           │
│  └── child_entity_instance_id = person.id                   │
│                                                              │
│  app.entity_rbac (role permissions only)                    │
│  ├── role_id → app.role.id (FK)                             │
│  ├── entity_code, entity_instance_id                        │
│  ├── permission (0-7)                                       │
│  ├── inheritance_mode, child_permissions, is_deny           │
│  └── NO person_code column anymore                          │
│                                                              │
│  Permission Resolution:                                      │
│  Person → Roles (via entity_instance_link) → Permissions    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Current State (TO BE REMOVED)

### Old Code Locations to Remove

| File | Lines | What to Remove |
|------|-------|----------------|
| `entity-infrastructure.service.ts` | :976-984 | `direct_emp` CTE (employee permissions) |
| `entity-infrastructure.service.ts` | :1004-1018 | `parent_entities` CTE |
| `entity-infrastructure.service.ts` | :1020-1050 | `parent_view` CTE (hardcoded VIEW=0) |
| `entity-infrastructure.service.ts` | :1052-1080 | `parent_create` CTE (hardcoded CREATE=4) |
| `entity-infrastructure.service.ts` | :1088 | UNION of `direct_emp` |
| `entity-infrastructure.service.ts` | :1092-1094 | UNION of `parent_view`, `parent_create` |
| `entity-infrastructure.service.ts` | :1236-1244 | `direct_emp` CTE in getAccessibleEntityIds |
| `entity-infrastructure.service.ts` | :1263-1288 | `parents_with_view` CTE |
| `entity-infrastructure.service.ts` | :1290-1300 | `children_from_view` CTE |
| `entity-infrastructure.service.ts` | :1302-1327 | `parents_with_create` CTE |
| `entity-infrastructure.service.ts` | :1329-1339 | `children_from_create` CTE |
| `entity-infrastructure.service.ts` | :1347 | UNION of `direct_emp` |
| `entity-infrastructure.service.ts` | :1351-1353 | UNION of `children_from_view`, `children_from_create` |

### Problems with Current Approach

1. **Dual permission sources**: Both employee-direct AND role-based (complex)
2. **Hardcoded inheritance**: Only VIEW(0) and CREATE(4) - no flexibility
3. **person_code column**: Polymorphic design adds complexity
4. **No FK constraints**: person_id not enforced

---

## New Design

### 1. Schema Changes

**File**: `db/entity_configuration_settings/06_entity_rbac.ddl`

```sql
-- REPLACE entire table definition

CREATE TABLE app.entity_rbac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════
  -- ROLE REFERENCE (replaces person_code/person_id)
  -- ═══════════════════════════════════════════════════════════
  role_id uuid NOT NULL REFERENCES app.role(id) ON DELETE CASCADE,
  -- Always references app.role - no more polymorphic person_code

  -- ═══════════════════════════════════════════════════════════
  -- ENTITY TARGET
  -- ═══════════════════════════════════════════════════════════
  entity_code varchar(50) NOT NULL,
  -- Entity type code (references entity.code): project, task, etc.

  entity_instance_id uuid NOT NULL,
  -- Specific instance UUID or '11111111-1111-1111-1111-111111111111' for type-level

  -- ═══════════════════════════════════════════════════════════
  -- PERMISSION
  -- ═══════════════════════════════════════════════════════════
  permission integer NOT NULL DEFAULT 0,
  -- 0=View, 1=Comment, 2=Contribute, 3=Edit, 4=Share, 5=Delete, 6=Create, 7=Owner

  -- ═══════════════════════════════════════════════════════════
  -- INHERITANCE CONFIGURATION (NEW)
  -- ═══════════════════════════════════════════════════════════
  inheritance_mode varchar(20) NOT NULL DEFAULT 'none',
  -- 'none'    : This entity only (no cascade)
  -- 'cascade' : Same permission to all children recursively
  -- 'mapped'  : Different permissions per child type

  child_permissions jsonb NOT NULL DEFAULT '{}',
  -- Used when inheritance_mode = 'mapped'
  -- Format: { "_default": 0, "task": 3, "wiki": 1 }

  is_deny boolean NOT NULL DEFAULT false,
  -- Explicit deny - blocks permission even if granted elsewhere

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

-- Role lookup
CREATE INDEX idx_entity_rbac_role ON app.entity_rbac (role_id);

COMMENT ON TABLE app.entity_rbac IS 'Role-based permissions. People get permissions through role membership (via entity_instance_link). No direct person permissions.';
COMMENT ON COLUMN app.entity_rbac.role_id IS 'References app.role.id - the role that has this permission';
COMMENT ON COLUMN app.entity_rbac.inheritance_mode IS 'none=this entity only, cascade=same permission to children, mapped=different per child type';
COMMENT ON COLUMN app.entity_rbac.child_permissions IS 'JSONB map for mapped mode: {"task": 3, "wiki": 0, "_default": 0}';
COMMENT ON COLUMN app.entity_rbac.is_deny IS 'When true, explicitly denies. Deny always overrides allow.';
```

### 2. Role-to-Person Mapping

**File**: `db/entity_configuration_settings/05_entity_instance_link.ddl`

Role membership is stored in `entity_instance_link`:

```sql
-- Role → Person membership
-- entity_code = 'role', entity_instance_id = role.id
-- child_entity_code = 'person', child_entity_instance_id = person.id

INSERT INTO app.entity_instance_link
  (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
VALUES
  ('role', 'ceo-role-uuid', 'person', 'james-person-uuid', 'member'),
  ('role', 'pm-role-uuid', 'person', 'sarah-person-uuid', 'member');
```

---

### 3. Service Changes

**File**: `apps/api/src/services/entity-infrastructure.service.ts`

#### 3.1 Simplified Permission Resolution

Replace entire `getMaxPermissionLevel()` method:

```sql
WITH
-- ═══════════════════════════════════════════════════════════════
-- 1. FIND ROLES FOR THIS PERSON
--    Person → Roles via entity_instance_link
-- ═══════════════════════════════════════════════════════════════
person_roles AS (
  SELECT eil.entity_instance_id AS role_id
  FROM app.entity_instance_link eil
  WHERE eil.entity_code = 'role'
    AND eil.child_entity_code = 'person'
    AND eil.child_entity_instance_id = ${person_id}::uuid
),

-- ═══════════════════════════════════════════════════════════════
-- 2. CHECK FOR EXPLICIT DENY (highest priority)
-- ═══════════════════════════════════════════════════════════════
explicit_deny AS (
  SELECT -999 AS permission
  FROM app.entity_rbac er
  JOIN person_roles pr ON er.role_id = pr.role_id
  WHERE er.entity_code = ${entity_code}
    AND (er.entity_instance_id = '11111111-1111-1111-1111-111111111111'::uuid
         OR er.entity_instance_id = ${entity_id}::uuid)
    AND er.is_deny = true
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
),

-- ═══════════════════════════════════════════════════════════════
-- 3. DIRECT ROLE PERMISSIONS ON TARGET ENTITY
-- ═══════════════════════════════════════════════════════════════
direct_role_perms AS (
  SELECT er.permission
  FROM app.entity_rbac er
  JOIN person_roles pr ON er.role_id = pr.role_id
  WHERE er.entity_code = ${entity_code}
    AND (er.entity_instance_id = '11111111-1111-1111-1111-111111111111'::uuid
         OR er.entity_instance_id = ${entity_id}::uuid)
    AND er.is_deny = false
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
),

-- ═══════════════════════════════════════════════════════════════
-- 4. FIND ANCESTORS (for inheritance)
-- ═══════════════════════════════════════════════════════════════
RECURSIVE ancestor_chain AS (
  -- Base: direct parents
  SELECT
    eil.entity_code AS ancestor_code,
    eil.entity_instance_id AS ancestor_id,
    1 AS depth
  FROM app.entity_instance_link eil
  WHERE eil.child_entity_code = ${entity_code}
    AND eil.child_entity_instance_id = ${entity_id}::uuid

  UNION ALL

  -- Recursive: grandparents
  SELECT
    eil.entity_code,
    eil.entity_instance_id,
    ac.depth + 1
  FROM ancestor_chain ac
  JOIN app.entity_instance_link eil
    ON eil.child_entity_code = ac.ancestor_code
    AND eil.child_entity_instance_id = ac.ancestor_id
  WHERE ac.depth < 10
),

-- ═══════════════════════════════════════════════════════════════
-- 5. INHERITED PERMISSIONS FROM ANCESTORS
-- ═══════════════════════════════════════════════════════════════
inherited_perms AS (
  SELECT
    CASE
      WHEN er.inheritance_mode = 'cascade' THEN er.permission
      WHEN er.inheritance_mode = 'mapped' THEN
        CASE
          WHEN er.child_permissions ? ${entity_code}
            THEN (er.child_permissions->> ${entity_code})::int
          WHEN er.child_permissions ? '_default'
            THEN (er.child_permissions->>'_default')::int
          ELSE -1
        END
      ELSE -1
    END AS permission
  FROM app.entity_rbac er
  JOIN person_roles pr ON er.role_id = pr.role_id
  JOIN ancestor_chain ac
    ON er.entity_code = ac.ancestor_code
    AND er.entity_instance_id = ac.ancestor_id
  WHERE er.inheritance_mode IN ('cascade', 'mapped')
    AND er.is_deny = false
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
)

-- ═══════════════════════════════════════════════════════════════
-- FINAL: MAX of all permission sources
-- ═══════════════════════════════════════════════════════════════
SELECT COALESCE(MAX(permission), -1) AS max_permission
FROM (
  SELECT * FROM explicit_deny
  UNION ALL
  SELECT * FROM direct_role_perms
  UNION ALL
  SELECT * FROM inherited_perms
) AS all_perms
WHERE permission != -999
```

#### 3.2 Update Method Signature

```typescript
// OLD:
async check_entity_rbac(
  user_id: string,        // Was employee UUID
  entity_code: string,
  entity_id: string,
  required_permission: Permission
): Promise<boolean>

// NEW:
async check_entity_rbac(
  person_id: string,      // Now person UUID (from app.person)
  entity_code: string,
  entity_id: string,
  required_permission: Permission
): Promise<boolean>
```

#### 3.3 Remove These Methods/CTEs

| What | Location | Action |
|------|----------|--------|
| `direct_emp` CTE | `getMaxPermissionLevel()` | REMOVE |
| `role_based` CTE | `getMaxPermissionLevel()` | SIMPLIFY to `direct_role_perms` |
| `parent_entities` CTE | Both methods | REMOVE |
| `parent_view` CTE | Both methods | REMOVE |
| `parent_create` CTE | Both methods | REMOVE |
| `children_from_view` CTE | `getAccessibleEntityIds()` | REMOVE |
| `children_from_create` CTE | `getAccessibleEntityIds()` | REMOVE |

---

### 4. API Route Changes

**File**: `apps/api/src/modules/rbac/routes.ts`

#### 4.1 Update Grant Permission Endpoint

```typescript
// OLD schema:
body: Type.Object({
  person_code: Type.Union([Type.Literal('role'), Type.Literal('employee')]),
  person_id: Type.String({ format: 'uuid' }),
  // ...
})

// NEW schema:
body: Type.Object({
  role_id: Type.String({ format: 'uuid' }),  // References app.role.id
  entity_code: Type.String(),
  entity_instance_id: Type.String(),
  permission: Type.Number({ minimum: 0, maximum: 7 }),
  inheritance_mode: Type.Optional(Type.Union([
    Type.Literal('none'),
    Type.Literal('cascade'),
    Type.Literal('mapped')
  ])),
  child_permissions: Type.Optional(Type.Record(Type.String(), Type.Number())),
  is_deny: Type.Optional(Type.Boolean()),
  expires_ts: Type.Optional(Type.String({ format: 'date-time' })),
})
```

#### 4.2 Update Overview Endpoint

```typescript
// Query joins app.role for role name
const rbacRecords = await db.execute(sql`
  SELECT
    er.id,
    er.role_id,
    r.code AS role_code,
    r.name AS role_name,
    er.entity_code,
    er.entity_instance_id,
    er.permission,
    er.inheritance_mode,
    er.child_permissions,
    er.is_deny,
    er.granted_ts,
    er.expires_ts
  FROM app.entity_rbac er
  JOIN app.role r ON er.role_id = r.id
  ORDER BY r.name, er.entity_code
`);
```

---

### 5. Frontend Changes

**File**: `apps/web/src/components/settings/PermissionManagementModal.tsx`

#### 5.1 Simplify to Role-Only

```typescript
// REMOVE:
const [personType, setPersonType] = useState<'role' | 'employee'>('role');

// KEEP (simplified):
const [selectedRole, setSelectedRole] = useState<string>('');  // role.id

// ADD:
const [inheritanceMode, setInheritanceMode] = useState<'none' | 'cascade' | 'mapped'>('none');
const [childPermissions, setChildPermissions] = useState<Record<string, number>>({});
const [isDeny, setIsDeny] = useState(false);
```

#### 5.2 UI Changes

Remove the "Employee/Role" toggle - only show Role selector:

```tsx
{/* Role Selector (simplified - no employee option) */}
<div>
  <label className="block text-sm font-medium">Role</label>
  <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
    <option value="">Select a role...</option>
    {roles.map(role => (
      <option key={role.id} value={role.id}>{role.name}</option>
    ))}
  </select>
</div>

{/* Inheritance Settings */}
<div className="space-y-3 border-t pt-4 mt-4">
  <label className="block text-sm font-medium">Permission Scope</label>
  {/* ... inheritance mode radio buttons ... */}
</div>
```

---

### 6. Data Migration

**File**: `db/migrations/migrate_to_role_only_rbac.sql`

```sql
-- Step 1: Create new table structure
-- (Run schema changes first)

-- Step 2: Migrate existing role-based permissions
INSERT INTO app.entity_rbac_new (role_id, entity_code, entity_instance_id, permission, ...)
SELECT person_id, entity_code, entity_instance_id, permission, ...
FROM app.entity_rbac_old
WHERE person_code = 'role';

-- Step 3: Convert employee permissions to role-based
-- For each employee with direct permissions:
--   1. Find or create an appropriate role
--   2. Add employee to that role via entity_instance_link
--   3. Migrate the permission to the role

-- Step 4: Drop old table, rename new
DROP TABLE app.entity_rbac_old;
ALTER TABLE app.entity_rbac_new RENAME TO entity_rbac;
```

---

### 7. Seed Data Updates

**File**: `db/49_rbac_seed_data.ddl`

```sql
-- All permissions are now role-based only

-- CEO role: OWNER on offices with mapped inheritance
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions)
SELECT r.id, 'office', '11111111-1111-1111-1111-111111111111', 7, 'mapped',
       '{"business": 5, "project": 3, "task": 3, "_default": 0}'::jsonb
FROM app.role r WHERE r.code = 'ROLE-CEO';

-- Project Manager role: EDIT on projects with cascade
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions)
SELECT r.id, 'project', '11111111-1111-1111-1111-111111111111', 3, 'cascade', '{}'::jsonb
FROM app.role r WHERE r.code = 'ROLE-PM';

-- Viewer role: VIEW only, no inheritance
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode)
SELECT r.id, 'project', '11111111-1111-1111-1111-111111111111', 0, 'none'
FROM app.role r WHERE r.code = 'ROLE-VIEWER';

-- Role membership (person belongs to role)
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'ROLE-CEO' AND p.email = 'james.miller@huronhome.ca';
```

---

## Summary: What Changes

### Removed

| Item | Reason |
|------|--------|
| `person_code` column | No longer polymorphic - only roles |
| `person_id` column | Replaced by `role_id` |
| Direct employee permissions | All via roles now |
| `direct_emp` CTE | No direct employee lookups |
| `parent_view` CTE | Replaced by configurable inheritance |
| `parent_create` CTE | Replaced by configurable inheritance |
| Employee/Role toggle in UI | Only roles shown |

### Added

| Item | Purpose |
|------|---------|
| `role_id` column (FK) | Clean reference to `app.role` |
| `inheritance_mode` column | Configure cascade behavior |
| `child_permissions` column | Per-child-type permissions |
| `is_deny` column | Explicit deny override |
| `granted_by_person_id` (FK) | Audit trail to `app.person` |
| `person_roles` CTE | Find roles for a person |
| `inherited_perms` CTE | Resolve inherited permissions |

### Simplified

| Before | After |
|--------|-------|
| 2 permission sources (employee + role) | 1 source (role only) |
| Polymorphic `person_code` | Direct FK to `app.role` |
| Hardcoded VIEW/CREATE inheritance | Configurable inheritance_mode |
| Complex 7-CTE query | Simpler 5-CTE query |

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `db/entity_configuration_settings/06_entity_rbac.ddl` | REWRITE | New schema with role_id FK |
| `apps/api/src/services/entity-infrastructure.service.ts` | REWRITE | Simplified role-only queries |
| `apps/api/src/modules/rbac/routes.ts` | MODIFY | Update to role_id, add inheritance fields |
| `apps/web/src/components/settings/PermissionManagementModal.tsx` | SIMPLIFY | Remove employee option |
| `db/49_rbac_seed_data.ddl` | REWRITE | Role-based only |
| `db/migrations/migrate_to_role_only_rbac.sql` | NEW | Migration script |

---

## Permission Resolution Flow

```
┌─────────────────────────────────────────────────────────────┐
│  NEW PERMISSION RESOLUTION FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Input: person_id, entity_code, entity_id                │
│                                                              │
│  2. Find person's roles:                                     │
│     entity_instance_link WHERE                               │
│       entity_code = 'role' AND                               │
│       child_entity_code = 'person' AND                       │
│       child_entity_instance_id = person_id                   │
│                                                              │
│  3. Check explicit deny:                                     │
│     entity_rbac WHERE role_id IN (person_roles)              │
│       AND is_deny = true → DENIED                            │
│                                                              │
│  4. Get direct role permissions:                             │
│     entity_rbac WHERE role_id IN (person_roles)              │
│       AND entity matches target                              │
│                                                              │
│  5. Get inherited permissions:                               │
│     - Find ancestors via entity_instance_link                │
│     - Check ancestor permissions with inheritance_mode       │
│     - Apply child_permissions mapping if 'mapped'            │
│                                                              │
│  6. Return MAX(all permissions found)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Person with no roles → No permissions
- [ ] Person with role → Gets role's permissions
- [ ] Person with multiple roles → MAX of all roles
- [ ] Deny on one role → Blocks even if other role allows
- [ ] Cascade inheritance → Children get same permission
- [ ] Mapped inheritance → Children get mapped permission
- [ ] No inheritance (none) → Children don't inherit
- [ ] Recursive inheritance → Grandchildren inherit correctly
- [ ] FK constraints → Invalid role_id rejected
- [ ] Migration → Existing data preserved
