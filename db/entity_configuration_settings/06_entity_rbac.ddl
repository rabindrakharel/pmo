-- ============================================================================
-- ENTITY RBAC - ROLE-BASED PERMISSION CONTROL SYSTEM (v2.1.0)
-- ============================================================================
--
-- TABLE TYPE: TRANSACTIONAL - HARD DELETE
-- When permissions are revoked, records are physically deleted.
-- Record existence = permission granted. No record = no permission.
--
-- ============================================================================
-- CORE CONCEPT: "WHO CAN DO WHAT ON WHICH"
-- ============================================================================
--
-- Each row answers: "Role X has permission Y on entity Z"
--
--   role_id             = WHO (the role receiving permission)
--   permission          = WHAT (0-7: VIEW→OWNER)
--   entity_code         = WHICH TYPE (e.g., 'project', 'task')
--   entity_instance_id  = WHICH INSTANCE (specific UUID or ALL_ENTITIES_ID)
--
-- ============================================================================
-- PERMISSION LEVELS (0-7) - HIERARCHICAL INTEGER MODEL
-- ============================================================================
--
--   ┌─────────────────────────────────────────────────────────────────────────┐
--   │  Level │ Name       │ API Actions                 │ Inherits From      │
--   ├─────────────────────────────────────────────────────────────────────────┤
--   │   0    │ VIEW       │ GET (read)                  │ -                  │
--   │   1    │ COMMENT    │ POST comments               │ VIEW               │
--   │   2    │ CONTRIBUTE │ POST form data, updates     │ COMMENT            │
--   │   3    │ EDIT       │ PATCH/PUT (modify)          │ CONTRIBUTE         │
--   │   4    │ SHARE      │ Share with other users      │ EDIT               │
--   │   5    │ DELETE     │ DELETE (soft delete)        │ SHARE              │
--   │   6    │ CREATE     │ POST (create new)           │ DELETE             │
--   │   7    │ OWNER      │ Full control + permissions  │ CREATE             │
--   └─────────────────────────────────────────────────────────────────────────┘
--
--   HIERARCHY: permission >= required_level → ALLOWED
--   Example: permission=5 (DELETE) allows VIEW(0), COMMENT(1), EDIT(3), etc.
--
-- ============================================================================
-- ENTITY INSTANCE ID: TYPE-LEVEL vs INSTANCE-LEVEL
-- ============================================================================
--
--   ┌───────────────────────────────────────────────────────────────────────┐
--   │  entity_instance_id                        │ Meaning                  │
--   ├───────────────────────────────────────────────────────────────────────┤
--   │  '11111111-1111-1111-1111-111111111111'    │ ALL instances (type-level) │
--   │  'a1b2c3d4-...actual-uuid...'             │ ONE specific instance    │
--   └───────────────────────────────────────────────────────────────────────┘
--
--   TYPE-LEVEL: Permission on entity TYPE (e.g., "can CREATE any project")
--   INSTANCE-LEVEL: Permission on specific entity (e.g., "can EDIT project-123")
--
-- ============================================================================
-- INHERITANCE MODES: HOW PERMISSIONS FLOW TO CHILDREN
-- ============================================================================
--
--   When entity A has children (via entity_instance_link), inheritance_mode
--   controls what permission the children inherit:
--
--   ┌─────────────────────────────────────────────────────────────────────────┐
--   │  Mode    │ Behavior                        │ child_permissions JSONB   │
--   ├─────────────────────────────────────────────────────────────────────────┤
--   │  none    │ NO inheritance - children get   │ ignored                   │
--   │          │ NO permission from this record  │                           │
--   ├─────────────────────────────────────────────────────────────────────────┤
--   │  cascade │ ALL children get SAME level     │ ignored                   │
--   │          │ as parent (recursive)           │                           │
--   ├─────────────────────────────────────────────────────────────────────────┤
--   │  mapped  │ DIFFERENT levels per child type │ {"task": 3, "wiki": 0,    │
--   │          │ Uses child_permissions mapping  │  "_default": 0}           │
--   └─────────────────────────────────────────────────────────────────────────┘
--
-- ============================================================================
-- VISUAL: INHERITANCE MODE EXAMPLES
-- ============================================================================
--
--   SCENARIO: Role "PM" has EDIT(3) on "project-123"
--
--   MODE: none
--   ─────────────────────
--   project-123 [EDIT 3]
--       └── task-001 [NO PERMISSION - must be granted separately]
--       └── wiki-001 [NO PERMISSION - must be granted separately]
--
--   MODE: cascade
--   ─────────────────────
--   project-123 [EDIT 3]
--       └── task-001 [EDIT 3] ← same as parent
--       └── wiki-001 [EDIT 3] ← same as parent
--       └── artifact-001 [EDIT 3] ← same as parent
--
--   MODE: mapped with {"task": 5, "wiki": 1, "_default": 0}
--   ─────────────────────────────────────────────────────────
--   project-123 [EDIT 3]
--       └── task-001 [DELETE 5] ← from child_permissions["task"]
--       └── wiki-001 [COMMENT 1] ← from child_permissions["wiki"]
--       └── artifact-001 [VIEW 0] ← from child_permissions["_default"]
--       └── expense-001 [VIEW 0] ← from child_permissions["_default"]
--
-- ============================================================================
-- EXPLICIT DENY (is_deny = true)
-- ============================================================================
--
--   Deny BLOCKS permission even if granted elsewhere. Priority:
--     1. Check for is_deny=true on entity → BLOCKED (stop)
--     2. Check direct permission grants
--     3. Check inherited permissions
--     4. Return MAX of all grants
--
--   USE CASE: Block contractor from sensitive data
--   ┌──────────────────────────────────────────────────────────────────────┐
--   │ role_id: 'contractor-uuid'                                          │
--   │ entity_code: 'expense'                                              │
--   │ entity_instance_id: '11111111-1111-1111-1111-111111111111'           │
--   │ is_deny: true  ← Blocks ALL expense access regardless of other perms│
--   └──────────────────────────────────────────────────────────────────────┘
--
-- ============================================================================
-- COMPLETE EXAMPLES: ROW-BY-ROW MEANING
-- ============================================================================
--
-- EXAMPLE 1: CEO gets OWNER on ALL projects with cascade
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ role_id:            'ceo-role-uuid'                                     │
-- │ entity_code:        'project'                                           │
-- │ entity_instance_id: '11111111-1111-1111-1111-111111111111' (ALL)         │
-- │ permission:         7 (OWNER)                                           │
-- │ inheritance_mode:   'cascade'                                           │
-- │ child_permissions:  {}                                                  │
-- │ is_deny:            false                                               │
-- └──────────────────────────────────────────────────────────────────────────┘
-- MEANS: CEO role has OWNER(7) permission on ALL projects. Because cascade:
--        - Any task under any project → OWNER(7)
--        - Any wiki under any project → OWNER(7)
--        - Any artifact under any project → OWNER(7)
--
-- EXAMPLE 2: Project Manager gets CREATE on projects with mapped children
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ role_id:            'pm-role-uuid'                                      │
-- │ entity_code:        'project'                                           │
-- │ entity_instance_id: '11111111-1111-1111-1111-111111111111' (ALL)         │
-- │ permission:         6 (CREATE)                                          │
-- │ inheritance_mode:   'mapped'                                            │
-- │ child_permissions:  {"task": 6, "wiki": 3, "expense": 0, "_default": 2} │
-- │ is_deny:            false                                               │
-- └──────────────────────────────────────────────────────────────────────────┘
-- MEANS: PM role can CREATE new projects. For any project's children:
--        - task children → CREATE(6) - can create subtasks
--        - wiki children → EDIT(3) - can modify wikis
--        - expense children → VIEW(0) - read-only on expenses
--        - all other children → CONTRIBUTE(2) - from _default
--
-- EXAMPLE 3: Field Tech gets specific project access (instance-level)
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ role_id:            'field-tech-uuid'                                   │
-- │ entity_code:        'project'                                           │
-- │ entity_instance_id: 'kitchen-reno-proj-uuid' (SPECIFIC)                 │
-- │ permission:         2 (CONTRIBUTE)                                      │
-- │ inheritance_mode:   'mapped'                                            │
-- │ child_permissions:  {"task": 3, "form": 2, "_default": 0}               │
-- │ is_deny:            false                                               │
-- └──────────────────────────────────────────────────────────────────────────┘
-- MEANS: Field Tech can CONTRIBUTE to "Kitchen Renovation" project only.
--        - Tasks under this project → EDIT(3)
--        - Forms under this project → CONTRIBUTE(2)
--        - Everything else → VIEW(0)
--        Does NOT apply to other projects.
--
-- EXAMPLE 4: Temporary auditor access with expiration
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ role_id:            'auditor-uuid'                                      │
-- │ entity_code:        'expense'                                           │
-- │ entity_instance_id: '11111111-1111-1111-1111-111111111111' (ALL)         │
-- │ permission:         0 (VIEW)                                            │
-- │ inheritance_mode:   'cascade'                                           │
-- │ child_permissions:  {}                                                  │
-- │ is_deny:            false                                               │
-- │ expires_ts:         '2025-12-31 23:59:59'                                │
-- └──────────────────────────────────────────────────────────────────────────┘
-- MEANS: Auditor can VIEW all expenses until Dec 31, 2025. After that date,
--        this permission is ignored (cleanup job removes expired records).
--
-- ============================================================================
-- PERMISSION RESOLUTION ALGORITHM
-- ============================================================================
--
--   check_entity_rbac(person_id, entity_code, entity_id, required_permission):
--
--   ┌─────────────────────────────────────────────────────────────────────────┐
--   │ 1. FIND ROLES: Get person's role memberships                           │
--   │    SELECT entity_instance_id FROM entity_instance_link                 │
--   │    WHERE entity_code='role' AND child_entity_code='person'             │
--   │      AND child_entity_instance_id = person_id                          │
--   │    → ['pm-role-uuid', 'employee-role-uuid']                            │
--   ├─────────────────────────────────────────────────────────────────────────┤
--   │ 2. CHECK DENY: Look for explicit deny on target entity                 │
--   │    SELECT * FROM entity_rbac                                           │
--   │    WHERE role_id IN (person_roles) AND is_deny = true                  │
--   │      AND entity_code = target_entity_code                              │
--   │      AND entity_instance_id IN (target_id, ALL_ENTITIES_ID)            │
--   │    → If found: return DENIED                                           │
--   ├─────────────────────────────────────────────────────────────────────────┤
--   │ 3. DIRECT PERMISSION: Check permission on target entity                │
--   │    SELECT MAX(permission) FROM entity_rbac                             │
--   │    WHERE role_id IN (person_roles)                                     │
--   │      AND entity_code = target_entity_code                              │
--   │      AND entity_instance_id IN (target_id, ALL_ENTITIES_ID)            │
--   │      AND (expires_ts IS NULL OR expires_ts > NOW())                    │
--   │    → direct_permission = result                                        │
--   ├─────────────────────────────────────────────────────────────────────────┤
--   │ 4. INHERITED PERMISSION: Traverse ancestors via entity_instance_link   │
--   │    For each ancestor of target entity:                                 │
--   │      - Get ancestor's permission record                                │
--   │      - If inheritance_mode = 'none': skip                              │
--   │      - If inheritance_mode = 'cascade': inherited = ancestor.permission│
--   │      - If inheritance_mode = 'mapped':                                 │
--   │          inherited = child_permissions[target_entity_code]             │
--   │                   ?? child_permissions['_default']                     │
--   │                   ?? 0                                                 │
--   │    → inherited_permission = MAX of all ancestors                       │
--   ├─────────────────────────────────────────────────────────────────────────┤
--   │ 5. FINAL RESULT:                                                       │
--   │    effective = MAX(direct_permission, inherited_permission)            │
--   │    return effective >= required_permission                             │
--   └─────────────────────────────────────────────────────────────────────────┘
--
-- ============================================================================
-- API ENDPOINT TO PERMISSION MAPPING
-- ============================================================================
--
--   ┌──────────────────────────────────────────────────────────────────────────┐
--   │ HTTP Method │ Endpoint Pattern           │ Permission  │ Instance Level │
--   ├──────────────────────────────────────────────────────────────────────────┤
--   │ GET         │ /api/v1/{entity}           │ VIEW (0)    │ Filtered list  │
--   │ GET         │ /api/v1/{entity}/{id}      │ VIEW (0)    │ Instance       │
--   │ POST        │ /api/v1/{entity}           │ CREATE (6)  │ Type-level     │
--   │ PATCH       │ /api/v1/{entity}/{id}      │ EDIT (3)    │ Instance       │
--   │ DELETE      │ /api/v1/{entity}/{id}      │ DELETE (5)  │ Instance       │
--   │ POST        │ /api/v1/{p}/{pid}/{c}      │ EDIT (3)    │ On parent {p}  │
--   │ DELETE      │ /api/v1/{p}/{pid}/{c}/{cid}/link │ EDIT (3) │ On parent  │
--   └──────────────────────────────────────────────────────────────────────────┘
--
--   CREATE under parent: Requires CREATE on child type AND EDIT on parent
--   UNLINK child: Requires EDIT on parent (child remains, link removed)
--   DELETE child: Requires DELETE on child (child removed from system)
--
-- ============================================================================
-- SERVICE METHODS (entity-infrastructure.service.ts)
-- ============================================================================
--
--   check_entity_rbac(personId, entityCode, entityId, requiredPermission)
--     → Returns: boolean (true if person has >= required permission)
--     → Used by: Route handlers before data operations
--
--   get_entity_rbac_where_condition(personId, entityCode, permission, alias)
--     → Returns: SQL WHERE clause filtering accessible entities
--     → Used by: LIST endpoints to filter visible entities
--
--   set_entity_rbac(roleId, entityCode, entityId, permission, options)
--     → Grants permission to role (UPSERT via unique constraint)
--     → options: { inheritance_mode, child_permissions, is_deny, expires_ts }
--
--   delete_entity_rbac(roleId, entityCode, entityId)
--     → Revokes permission (HARD DELETE from table)
--
-- ============================================================================

-- Drop old table if exists (with CASCADE to handle dependencies)
DROP TABLE IF EXISTS app.entity_rbac CASCADE;

CREATE TABLE app.entity_rbac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- WHO: The role receiving this permission
  -- ═══════════════════════════════════════════════════════════════════════════
  role_id uuid NOT NULL, -- References app.role.id (loosely coupled)

  -- ═══════════════════════════════════════════════════════════════════════════
  -- WHICH: Target entity (type + optional specific instance)
  -- ═══════════════════════════════════════════════════════════════════════════
  entity_code varchar(50) NOT NULL,        -- Entity type: 'project', 'task', etc.
  entity_instance_id uuid NOT NULL,        -- Instance UUID or ALL_ENTITIES_ID

  -- ═══════════════════════════════════════════════════════════════════════════
  -- WHAT: Permission level and inheritance behavior
  -- ═══════════════════════════════════════════════════════════════════════════
  permission integer NOT NULL DEFAULT 0,   -- 0-7 (VIEW→OWNER)
  inheritance_mode varchar(20) NOT NULL DEFAULT 'none', -- none|cascade|mapped
  child_permissions jsonb NOT NULL DEFAULT '{}', -- For mapped: {"task":3,"_default":0}
  is_deny boolean NOT NULL DEFAULT false,  -- Explicit deny (blocks all grants)

  -- ═══════════════════════════════════════════════════════════════════════════
  -- METADATA: Audit trail and lifecycle
  -- ═══════════════════════════════════════════════════════════════════════════
  granted_by_person_id uuid,               -- Who granted this permission
  granted_ts timestamptz DEFAULT now(),    -- When granted
  expires_ts timestamptz,                  -- Optional expiration (NULL = permanent)
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- ============================================================================
-- COLUMN COMMENTS
-- ============================================================================
COMMENT ON TABLE app.entity_rbac IS 'Role-based RBAC (v2.1.0). Each row = "role X has permission Y on entity Z". Permissions granted to roles only; persons get permissions via role membership. Supports inheritance: none, cascade, mapped.';

COMMENT ON COLUMN app.entity_rbac.role_id IS 'WHO: Role receiving this permission. FK to app.role (loosely coupled). Persons get permissions through role→person links in entity_instance_link.';
COMMENT ON COLUMN app.entity_rbac.entity_code IS 'WHICH TYPE: Entity type code (project, task, customer, etc.). References app.entity.code.';
COMMENT ON COLUMN app.entity_rbac.entity_instance_id IS 'WHICH INSTANCE: Specific entity UUID, OR "11111111-1111-1111-1111-111111111111" (ALL_ENTITIES_ID) for type-level permissions that apply to all instances.';
COMMENT ON COLUMN app.entity_rbac.permission IS 'WHAT: Permission level 0-7. 0=VIEW, 1=COMMENT, 2=CONTRIBUTE, 3=EDIT, 4=SHARE, 5=DELETE, 6=CREATE, 7=OWNER. Higher levels include lower (permission >= required → allowed).';
COMMENT ON COLUMN app.entity_rbac.inheritance_mode IS 'HOW CHILDREN INHERIT: "none" = no inheritance, "cascade" = children get same level, "mapped" = children get levels from child_permissions JSONB.';
COMMENT ON COLUMN app.entity_rbac.child_permissions IS 'MAPPED INHERITANCE CONFIG: {"task": 3, "wiki": 0, "_default": 0}. Keys = child entity_code, values = permission level. "_default" = fallback for unlisted types.';
COMMENT ON COLUMN app.entity_rbac.is_deny IS 'EXPLICIT DENY: When true, BLOCKS permission even if granted elsewhere. Deny takes absolute precedence over all grants. Use sparingly.';
COMMENT ON COLUMN app.entity_rbac.expires_ts IS 'TEMPORARY PERMISSION: If set, permission is invalid after this timestamp. Used for contractor access, time-limited delegation. NULL = permanent.';
COMMENT ON COLUMN app.entity_rbac.granted_by_person_id IS 'AUDIT: Person who granted this permission. Enables delegation tracking.';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- UNIQUE: One permission per (role, entity type, instance) - enables UPSERT
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_rbac_unique_permission
ON app.entity_rbac (role_id, entity_code, entity_instance_id);

-- LOOKUP: Role permissions on entity type (permission checks)
CREATE INDEX IF NOT EXISTS idx_entity_rbac_role_entity
ON app.entity_rbac (role_id, entity_code);

-- LOOKUP: All permissions on an entity (admin views)
CREATE INDEX IF NOT EXISTS idx_entity_rbac_entity_instance
ON app.entity_rbac (entity_code, entity_instance_id);

-- FILTER: Inheritable permissions only (inheritance resolution)
CREATE INDEX IF NOT EXISTS idx_entity_rbac_inheritable
ON app.entity_rbac (role_id, inheritance_mode)
WHERE inheritance_mode IN ('cascade', 'mapped');

-- FILTER: Explicit deny records (deny checks - fast path)
CREATE INDEX IF NOT EXISTS idx_entity_rbac_deny
ON app.entity_rbac (role_id, entity_code, entity_instance_id)
WHERE is_deny = true;

-- FILTER: Expiring permissions (cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_entity_rbac_expires
ON app.entity_rbac (expires_ts)
WHERE expires_ts IS NOT NULL;

-- ============================================================================
-- SEED DATA LOCATION
-- ============================================================================
--
-- RBAC seed data is in db/big_data.sql (SECTION 3)
-- Run separately: psql -h localhost -p 5434 -U app -d app -f db/big_data.sql
--
-- ============================================================================
