# Permission Inheritance to Children - Implementation Design

> **Status**: Design Phase
> **Version**: 1.0.0
> **Date**: 2025-12-09

## Overview

Replace hardcoded parent→child permission inheritance (VIEW/CREATE only) with a configurable, explicit inheritance model that supports:
- Different permissions per child entity type
- Cascade (same permission) vs Mapped (different permissions)
- Explicit deny overrides
- Recursive depth control

---

## Current State (TO BE REMOVED)

### Old Inheritance Logic Locations

| File | Lines | What to Remove |
|------|-------|----------------|
| `entity-infrastructure.service.ts` | :1004-1018 | `parent_entities` CTE |
| `entity-infrastructure.service.ts` | :1020-1050 | `parent_view` CTE (hardcoded VIEW=0) |
| `entity-infrastructure.service.ts` | :1052-1080 | `parent_create` CTE (hardcoded CREATE=4) |
| `entity-infrastructure.service.ts` | :1092-1094 | UNION of `parent_view`, `parent_create` |
| `entity-infrastructure.service.ts` | :1263-1288 | `parents_with_view` CTE |
| `entity-infrastructure.service.ts` | :1290-1300 | `children_from_view` CTE |
| `entity-infrastructure.service.ts` | :1302-1327 | `parents_with_create` CTE |
| `entity-infrastructure.service.ts` | :1329-1339 | `children_from_create` CTE |
| `entity-infrastructure.service.ts` | :1351-1353 | UNION of `children_from_view`, `children_from_create` |

### Problems with Current Approach

1. **Hardcoded levels**: Only VIEW(0) and CREATE(4) inherit - no EDIT, DELETE, etc.
2. **All-or-nothing**: Can't give EDIT to tasks but VIEW to wikis
3. **Implicit**: No visibility into what's inherited vs explicit
4. **Type-level only**: Inherits based on entity TYPE, not specific instances

---

## New Design

### 1. Schema Changes

**File**: `db/entity_configuration_settings/06_entity_rbac.ddl`

```sql
-- Add after line 60 (after permission column)

-- Inheritance configuration
inheritance_mode varchar(20) DEFAULT 'none',
-- 'none'    : Permission applies to this entity only (default, backward compatible)
-- 'cascade' : Same permission flows to ALL children recursively
-- 'mapped'  : Different permissions per child type (uses child_permissions)

child_permissions jsonb DEFAULT '{}',
-- Only used when inheritance_mode = 'mapped'
-- Format: { "_default": 0, "task": 3, "wiki": 1, "artifact": 0 }
-- _default = fallback for unlisted child types
-- Empty {} with 'cascade' mode = children get SAME permission as parent

is_deny boolean DEFAULT false,
-- Explicit deny - blocks permission even if granted elsewhere
-- Deny always wins over allow (industry standard)
```

**Add index:**
```sql
-- Efficient lookup for inheritance resolution
CREATE INDEX idx_entity_rbac_inheritance
ON app.entity_rbac(entity_code, entity_instance_id, inheritance_mode)
WHERE inheritance_mode != 'none';
```

**Add comment:**
```sql
COMMENT ON COLUMN app.entity_rbac.inheritance_mode IS
'Controls how permission cascades to children: none (this entity only), cascade (same permission to all children), mapped (different permissions per child type via child_permissions)';

COMMENT ON COLUMN app.entity_rbac.child_permissions IS
'JSONB map of child entity types to permission levels. Used when inheritance_mode=mapped. Format: {"task": 3, "wiki": 0, "_default": 0}. Empty {} with cascade mode means children inherit same permission.';

COMMENT ON COLUMN app.entity_rbac.is_deny IS
'When true, explicitly denies this permission. Deny always overrides allow grants. Used for exceptions in inherited permissions.';
```

---

### 2. Service Changes

**File**: `apps/api/src/services/entity-infrastructure.service.ts`

#### 2.1 Remove Old CTEs

**In `getMaxPermissionLevel()` (:965-1099):**

Remove these CTEs entirely:
- `parent_entities` (lines 1008-1018)
- `parent_view` (lines 1024-1050)
- `parent_create` (lines 1056-1080)

Remove from final UNION (lines 1092-1094):
```sql
-- REMOVE THESE LINES:
UNION ALL
SELECT * FROM parent_view
UNION ALL
SELECT * FROM parent_create
```

**In `getAccessibleEntityIds()` (:1198-1364):**

Remove these CTEs entirely:
- `parent_entities` (similar location)
- `parents_with_view` (lines 1266-1288)
- `children_from_view` (lines 1293-1300)
- `parents_with_create` (lines 1305-1327)
- `children_from_create` (lines 1332-1339)

Remove from final UNION (lines 1351-1353):
```sql
-- REMOVE THESE LINES:
UNION ALL
SELECT * FROM children_from_view
UNION ALL
SELECT * FROM children_from_create
```

#### 2.2 Add New Inheritance Logic

**In `getMaxPermissionLevel()`:**

Replace removed CTEs with:

```sql
-- ---------------------------------------------------------------------------
-- 3. FIND ANCESTORS WITH INHERITABLE PERMISSIONS
--    Traverse up the entity_instance_link hierarchy
-- ---------------------------------------------------------------------------
RECURSIVE ancestor_chain AS (
  -- Base: direct parents of target entity
  SELECT
    eil.entity_code AS ancestor_code,
    eil.entity_instance_id AS ancestor_id,
    1 AS depth
  FROM app.entity_instance_link eil
  WHERE eil.child_entity_code = ${entity_code}
    AND eil.child_entity_instance_id = ${entity_id}::uuid

  UNION ALL

  -- Recursive: grandparents and beyond
  SELECT
    eil.entity_code,
    eil.entity_instance_id,
    ac.depth + 1
  FROM ancestor_chain ac
  JOIN app.entity_instance_link eil
    ON eil.child_entity_code = ac.ancestor_code
    AND eil.child_entity_instance_id = ac.ancestor_id
  WHERE ac.depth < 10  -- Prevent infinite loops
),

-- ---------------------------------------------------------------------------
-- 4. CHECK FOR EXPLICIT DENY (highest priority)
-- ---------------------------------------------------------------------------
explicit_deny AS (
  SELECT -999 AS permission  -- Sentinel value for deny
  FROM app.entity_rbac
  WHERE person_code = 'employee'
    AND person_id = ${user_id}::uuid
    AND entity_code = ${entity_code}
    AND (entity_instance_id = '11111111-1111-1111-1111-111111111111'::uuid
         OR entity_instance_id = ${entity_id}::uuid)
    AND is_deny = true
    AND (expires_ts IS NULL OR expires_ts > NOW())
),

-- ---------------------------------------------------------------------------
-- 5. INHERITED PERMISSIONS FROM ANCESTORS
--    Only from ancestors with inheritance_mode != 'none'
-- ---------------------------------------------------------------------------
inherited_from_ancestors AS (
  SELECT
    CASE
      -- 'cascade' mode: inherit same permission
      WHEN er.inheritance_mode = 'cascade' THEN er.permission

      -- 'mapped' mode: lookup in child_permissions
      WHEN er.inheritance_mode = 'mapped' THEN
        CASE
          -- Specific mapping for target entity type
          WHEN er.child_permissions ? ${entity_code}
            THEN (er.child_permissions->> ${entity_code})::int
          -- Fallback to _default
          WHEN er.child_permissions ? '_default'
            THEN (er.child_permissions->>'_default')::int
          -- No mapping = no inheritance
          ELSE -1
        END

      ELSE -1
    END AS permission
  FROM app.entity_rbac er
  JOIN ancestor_chain ac
    ON er.entity_code = ac.ancestor_code
    AND er.entity_instance_id = ac.ancestor_id
  WHERE er.person_code = 'employee'
    AND er.person_id = ${user_id}::uuid
    AND er.inheritance_mode IN ('cascade', 'mapped')
    AND er.is_deny = false
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
),

-- ---------------------------------------------------------------------------
-- 6. ROLE-BASED INHERITED PERMISSIONS
--    Same logic but for roles user belongs to
-- ---------------------------------------------------------------------------
role_inherited_from_ancestors AS (
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
  JOIN ancestor_chain ac
    ON er.entity_code = ac.ancestor_code
    AND er.entity_instance_id = ac.ancestor_id
  JOIN app.entity_instance_link eim
    ON eim.entity_code = 'role'
    AND eim.entity_instance_id = er.person_id
    AND eim.child_entity_code = 'employee'
    AND eim.child_entity_instance_id = ${user_id}::uuid
  WHERE er.person_code = 'role'
    AND er.inheritance_mode IN ('cascade', 'mapped')
    AND er.is_deny = false
    AND (er.expires_ts IS NULL OR er.expires_ts > NOW())
)
```

**Update final UNION:**

```sql
SELECT COALESCE(MAX(permission), -1) AS max_permission
FROM (
  SELECT * FROM explicit_deny          -- Check deny first
  UNION ALL
  SELECT * FROM direct_emp             -- Direct employee permissions
  UNION ALL
  SELECT * FROM role_based             -- Role-based permissions
  UNION ALL
  SELECT * FROM inherited_from_ancestors      -- NEW: Inherited from ancestors
  UNION ALL
  SELECT * FROM role_inherited_from_ancestors -- NEW: Role-inherited from ancestors
) AS all_perms
WHERE permission != -999  -- Filter out non-deny results if deny exists
```

**Add deny check wrapper:**

```typescript
// After getting max_permission, check if deny exists
if (result.some(r => r.permission === -999)) {
  return -1;  // Explicitly denied
}
```

---

### 3. API Route Changes

**File**: `apps/api/src/modules/rbac/routes.ts`

#### 3.1 Update Grant Permission Endpoint (:342-477)

**Schema update (add to body):**
```typescript
inheritance_mode: Type.Optional(Type.Union([
  Type.Literal('none'),
  Type.Literal('cascade'),
  Type.Literal('mapped')
])),
child_permissions: Type.Optional(Type.Record(Type.String(), Type.Number())),
is_deny: Type.Optional(Type.Boolean()),
```

**INSERT/UPDATE update:**
```sql
INSERT INTO app.entity_rbac (
  person_code, person_id, entity_code, entity_instance_id, permission,
  inheritance_mode, child_permissions, is_deny,  -- NEW
  granted_by__employee_id, granted_ts, expires_ts
) VALUES (...)
```

#### 3.2 Update Overview Endpoint (:639-671)

**Add to SELECT:**
```sql
rbac.inheritance_mode,
rbac.child_permissions,
rbac.is_deny
```

**Update response schema and helper function:**
```typescript
const getInheritanceLabel = (mode: string): string => {
  switch (mode) {
    case 'cascade': return 'Cascades to all children';
    case 'mapped': return 'Different per child type';
    default: return 'This entity only';
  }
};
```

---

### 4. Frontend Changes

**File**: `apps/web/src/components/settings/PermissionManagementModal.tsx`

#### 4.1 Add State (:41-47)

```typescript
const [inheritanceMode, setInheritanceMode] = useState<'none' | 'cascade' | 'mapped'>('none');
const [childPermissions, setChildPermissions] = useState<Record<string, number>>({});
const [isDeny, setIsDeny] = useState(false);
```

#### 4.2 Add UI Section (after permission selector)

```tsx
{/* Inheritance Settings */}
<div className="space-y-3 border-t pt-4 mt-4">
  <label className="block text-sm font-medium">Permission Scope</label>

  <div className="space-y-2">
    <label className="flex items-center gap-2">
      <input type="radio" value="none" checked={inheritanceMode === 'none'}
             onChange={() => setInheritanceMode('none')} />
      <span>This entity only</span>
    </label>

    <label className="flex items-center gap-2">
      <input type="radio" value="cascade" checked={inheritanceMode === 'cascade'}
             onChange={() => setInheritanceMode('cascade')} />
      <span>Cascade to all children (same permission)</span>
    </label>

    <label className="flex items-center gap-2">
      <input type="radio" value="mapped" checked={inheritanceMode === 'mapped'}
             onChange={() => setInheritanceMode('mapped')} />
      <span>Different permissions per child type</span>
    </label>
  </div>

  {/* Child permissions mapper - show when 'mapped' selected */}
  {inheritanceMode === 'mapped' && (
    <ChildPermissionMapper
      entityCode={selectedEntity}
      value={childPermissions}
      onChange={setChildPermissions}
    />
  )}

  {/* Deny toggle */}
  <label className="flex items-center gap-2 mt-4">
    <input type="checkbox" checked={isDeny} onChange={(e) => setIsDeny(e.target.checked)} />
    <span className="text-red-600 font-medium">Explicit Deny (blocks this permission)</span>
  </label>
</div>
```

#### 4.3 New Component: ChildPermissionMapper

```tsx
function ChildPermissionMapper({ entityCode, value, onChange }) {
  const [childEntities, setChildEntities] = useState([]);

  // Fetch child entity types from entity.child_entity_codes
  useEffect(() => {
    // GET /api/v1/entity/type/{entityCode} -> child_entity_codes
  }, [entityCode]);

  return (
    <div className="space-y-2 pl-6">
      {/* Default fallback */}
      <div className="flex items-center gap-2">
        <span className="w-32 text-gray-500">Default:</span>
        <PermissionSelect value={value._default || 0} onChange={...} />
      </div>

      {/* Per-child-type selectors */}
      {childEntities.map(child => (
        <div key={child.code} className="flex items-center gap-2">
          <span className="w-32">{child.ui_label}:</span>
          <PermissionSelect value={value[child.code] ?? value._default ?? 0} onChange={...} />
        </div>
      ))}
    </div>
  );
}
```

---

### 5. Access Control Page Updates

**File**: `apps/web/src/pages/setting/AccessControlPage.tsx`

Add visual indicators for inheritance:

```tsx
{/* In permission row */}
{permission.inheritance_mode !== 'none' && (
  <span className={cn(
    "inline-flex items-center px-2 py-0.5 rounded text-xs",
    permission.inheritance_mode === 'cascade'
      ? "bg-blue-100 text-blue-700"
      : "bg-purple-100 text-purple-700"
  )}>
    {permission.inheritance_mode === 'cascade' ? '↓ Cascades' : '↓ Mapped'}
  </span>
)}

{permission.is_deny && (
  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
    DENY
  </span>
)}
```

---

### 6. Seed Data Updates

**File**: `db/49_rbac_seed_data.ddl`

Add demo inheritance permissions:

```sql
-- CEO role gets OWNER on all offices with cascade to children
INSERT INTO app.entity_rbac (
  person_code, person_id, entity_code, entity_instance_id, permission,
  inheritance_mode, child_permissions
)
SELECT 'role', r.id, 'office', '11111111-1111-1111-1111-111111111111', 7,
       'mapped', '{"business": 5, "project": 3, "task": 3, "_default": 0}'::jsonb
FROM app.role r WHERE r.code = 'ROLE-CEO';

-- Project Manager gets EDIT on projects with cascade to all children
INSERT INTO app.entity_rbac (
  person_code, person_id, entity_code, entity_instance_id, permission,
  inheritance_mode, child_permissions
)
SELECT 'role', r.id, 'project', '11111111-1111-1111-1111-111111111111', 3,
       'cascade', '{}'::jsonb  -- Same permission (EDIT) to all children
FROM app.role r WHERE r.code = 'ROLE-PM';
```

---

## Migration Strategy

### Phase 1: Schema Migration (Non-Breaking)
1. Add new columns with defaults
2. Existing rows get `inheritance_mode='none'` (backward compatible)
3. Run `./tools/db-import.sh`

### Phase 2: Service Update
1. Remove old inheritance CTEs
2. Add new recursive ancestor traversal
3. Test with existing permissions (should work identically)

### Phase 3: API Update
1. Add new fields to endpoints
2. Backward compatible - new fields are optional

### Phase 4: Frontend Update
1. Add UI for inheritance configuration
2. Display inheritance badges

### Phase 5: Seed Data
1. Add demo inheritance permissions
2. Document examples

---

## Testing Checklist

- [ ] Existing permissions work (no inheritance_mode = 'none')
- [ ] Cascade mode: parent EDIT → child gets EDIT
- [ ] Mapped mode: parent OWNER → task gets EDIT, wiki gets VIEW
- [ ] Deny overrides all allows
- [ ] Role-based inheritance works
- [ ] Recursive depth works (grandchildren)
- [ ] Performance acceptable with ancestor traversal

---

## File Change Summary

| File | Action | Lines Affected |
|------|--------|----------------|
| `db/entity_configuration_settings/06_entity_rbac.ddl` | ADD | +15 lines (3 columns, index, comments) |
| `apps/api/src/services/entity-infrastructure.service.ts` | REMOVE | -90 lines (old CTEs) |
| `apps/api/src/services/entity-infrastructure.service.ts` | ADD | +80 lines (new CTEs) |
| `apps/api/src/modules/rbac/routes.ts` | MODIFY | ~20 lines (schema + INSERT) |
| `apps/web/src/components/settings/PermissionManagementModal.tsx` | ADD | +60 lines (UI) |
| `apps/web/src/pages/setting/AccessControlPage.tsx` | ADD | +15 lines (badges) |
| `db/49_rbac_seed_data.ddl` | ADD | +20 lines (demo data) |
| `docs/rbac/RBAC_INFRASTRUCTURE.md` | UPDATE | Document new fields |
| `CLAUDE.md` | UPDATE | Add inheritance section |

**Net change**: ~+100 lines (removing ~90, adding ~190)
