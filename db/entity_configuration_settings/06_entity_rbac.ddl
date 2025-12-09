-- ============================================================================
-- ENTITY RBAC - ROLE-BASED PERMISSION CONTROL SYSTEM (v2.0.0)
-- ============================================================================
--
-- TABLE TYPE: TRANSACTIONAL - HARD DELETE
-- This table uses HARD DELETE semantics (no active_flag column).
-- When permissions are revoked, records are physically deleted.
-- Record existence = permission granted. No record = no permission.
--
-- SEMANTICS (v2.0.0 Role-Only Model):
-- Permissions are granted to ROLES only (no direct employee/person permissions).
-- Persons get permissions through role membership via entity_instance_link.
-- Uses INTEGER permission level (0-7) with automatic hierarchical inheritance.
--
-- KEY CHANGES FROM v1.x:
--   - REMOVED: person_code (no more 'employee', 'customer', 'vendor', etc.)
--   - REMOVED: person_id (direct person permissions no longer supported)
--   - ADDED:   role_id (FK to app.role - all permissions are role-based)
--   - ADDED:   inheritance_mode (none, cascade, mapped)
--   - ADDED:   child_permissions (JSONB for mapped inheritance)
--   - ADDED:   is_deny (explicit deny flag)
--   - CHANGED: granted_by__employee_id → granted_by_person_id
--
-- ============================================================================
-- PERMISSION RESOLUTION MODEL (v2.0.0)
-- ============================================================================
--
-- When checking permissions for person_id, the system resolves via:
--   1. Find roles: entity_instance_link WHERE entity_code='role' AND child_entity_code='person'
--   2. Check explicit deny: entity_rbac WHERE is_deny=true
--   3. Direct role perms: entity_rbac WHERE role_id IN (person_roles)
--   4. Inherited perms: traverse ancestors via entity_instance_link, apply inheritance_mode
--   Result: MAX(direct permissions, inherited permissions), blocked by deny
--
-- ============================================================================
-- INHERITANCE MODES
-- ============================================================================
--
--   none:    Permission applies ONLY to the specific entity (no children inherit)
--   cascade: Same permission level applies to ALL children (recursive)
--   mapped:  Different permission levels per child entity type (via child_permissions JSONB)
--
-- ============================================================================
-- PERMISSION LEVEL MODEL (Integer 0-7)
-- ============================================================================
--
--   permission = 0  --> View:        Read access to entity data
--   permission = 1  --> Comment:     Add comments on entities (INHERITS View)
--   permission = 2  --> Contribute:  Form submission, task updates, wiki edits (INHERITS Comment + View)
--   permission = 3  --> Edit:        Modify existing entity fields (INHERITS Contribute + Comment + View)
--   permission = 4  --> Share:       Share entity with others (INHERITS Edit + Contribute + Comment + View)
--   permission = 5  --> Delete:      Soft delete entity (INHERITS Share + Edit + Contribute + Comment + View)
--   permission = 6  --> Create:      Create new entities - type-level only (INHERITS all lower)
--   permission = 7  --> Owner:       Full control including permission management (INHERITS ALL)
--
-- PERMISSION HIERARCHY (Automatic Inheritance via >= operator):
--   Owner [7] >= Create [6] >= Delete [5] >= Share [4] >= Edit [3] >= Contribute [2] >= Comment [1] >= View [0]
--
-- ============================================================================
-- API INTEGRATION: HOW THE TABLE SERVES THE API
-- ============================================================================
--
-- The entity_rbac table is the authorization backbone for ALL entity API endpoints.
-- Every API call goes through RBAC checks before data access.
--
-- API ENDPOINT → PERMISSION MAPPING:
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ HTTP Method   │ Endpoint Pattern           │ Permission Required         │
-- ├──────────────────────────────────────────────────────────────────────────┤
-- │ GET           │ /api/v1/{entity}           │ VIEW (0) - filtered by RBAC │
-- │ GET           │ /api/v1/{entity}/{id}      │ VIEW (0) on specific ID     │
-- │ POST          │ /api/v1/{entity}           │ CREATE (6) type-level       │
-- │ PATCH/PUT     │ /api/v1/{entity}/{id}      │ EDIT (3) on specific ID     │
-- │ DELETE        │ /api/v1/{entity}/{id}      │ DELETE (5) on specific ID   │
-- │ POST          │ /api/v1/{entity}/{id}/link │ EDIT (3) on parent entity   │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- SPECIAL PERMISSION BEHAVIORS:
--
--   CREATE (6) - Type-Level Only:
--     • Uses entity_instance_id = '11111111-1111-1111-1111-111111111111' (ALL_ENTITIES_ID)
--     • Grants ability to create NEW instances of this entity type
--     • Example: Role "PM" with CREATE on "project" type can create any project
--     • When creating under a parent, EDIT permission on parent is also required
--
--   OWNER (7) - Full Control:
--     • Can manage permissions (grant/revoke) on the entity
--     • Auto-granted to creator of an entity via entity_infrastructure.create_entity()
--     • Can delegate lower permissions to other roles
--
--   VIEW (0) - List Filtering:
--     • GET list endpoints use get_entity_rbac_where_condition() to filter results
--     • User only sees entities they have VIEW permission on
--     • Combined with inheritance to traverse parent→child relationships
--
-- API SERVICE METHODS (entity-infrastructure.service.ts):
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ check_entity_rbac(personId, entityCode, entityId, requiredPermission)    │
-- │   → Returns boolean: true if person has >= required permission           │
-- │   → Used in: Route handlers before data operations                       │
-- │                                                                          │
-- │ get_entity_rbac_where_condition(personId, entityCode, permission, alias) │
-- │   → Returns SQL WHERE clause filtering entities user can access          │
-- │   → Used in: LIST endpoints to filter visible entities                   │
-- │                                                                          │
-- │ set_entity_rbac(roleId, entityCode, entityId, permission, options)       │
-- │   → Grants permission to role (INSERT or UPDATE via unique constraint)   │
-- │   → Used in: AccessControlPage grant permission wizard                   │
-- │                                                                          │
-- │ delete_entity_rbac(roleId, entityCode, entityId)                         │
-- │   → Revokes permission (HARD DELETE from table)                          │
-- │   → Used in: AccessControlPage revoke permission action                  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ============================================================================
-- DATA SEMANTICS: WHAT EACH ROW REPRESENTS
-- ============================================================================
--
-- Each row represents ONE permission grant: "Role X can do Y on entity Z"
--
-- EXAMPLE ROWS AND THEIR MEANING:
--
-- 1. Type-Level CREATE Permission (CEO can create any project):
--    ┌──────────────────────────────────────────────────────────────────────┐
--    │ role_id: 'ceo-uuid'                                                  │
--    │ entity_code: 'project'                                               │
--    │ entity_instance_id: '11111111-1111-1111-1111-111111111111'  ← ALL    │
--    │ permission: 6  ← CREATE                                              │
--    │ inheritance_mode: 'cascade'                                          │
--    │ child_permissions: {}                                                │
--    │ is_deny: false                                                       │
--    └──────────────────────────────────────────────────────────────────────┘
--    MEANING: CEO role can CREATE new projects and has CREATE permission
--             that cascades to all child entities of any project.
--
-- 2. Instance-Level EDIT Permission (PM can edit specific project):
--    ┌──────────────────────────────────────────────────────────────────────┐
--    │ role_id: 'pm-uuid'                                                   │
--    │ entity_code: 'project'                                               │
--    │ entity_instance_id: 'project-123-uuid'  ← Specific instance          │
--    │ permission: 3  ← EDIT                                                │
--    │ inheritance_mode: 'mapped'                                           │
--    │ child_permissions: {"task": 3, "wiki": 2, "_default": 0}             │
--    │ is_deny: false                                                       │
--    └──────────────────────────────────────────────────────────────────────┘
--    MEANING: PM role can EDIT project-123 specifically. Child inheritance:
--             - Tasks under project-123: EDIT (3) permission
--             - Wikis under project-123: CONTRIBUTE (2) permission
--             - Other child types: VIEW (0) permission
--
-- 3. Explicit DENY (Contractor blocked from Finance data):
--    ┌──────────────────────────────────────────────────────────────────────┐
--    │ role_id: 'contractor-uuid'                                           │
--    │ entity_code: 'business'                                              │
--    │ entity_instance_id: 'finance-dept-uuid'  ← Finance department        │
--    │ permission: 0  ← Irrelevant when is_deny=true                        │
--    │ inheritance_mode: 'cascade'                                          │
--    │ child_permissions: {}                                                │
--    │ is_deny: true  ← BLOCKS ACCESS                                       │
--    └──────────────────────────────────────────────────────────────────────┘
--    MEANING: Contractor role CANNOT access Finance department or ANY of
--             its children, even if granted access through another role.
--             Deny takes precedence over all grants.
--
-- 4. Temporary Permission (Auditor access expires):
--    ┌──────────────────────────────────────────────────────────────────────┐
--    │ role_id: 'auditor-uuid'                                              │
--    │ entity_code: 'project'                                               │
--    │ entity_instance_id: '11111111-1111-1111-1111-111111111111'            │
--    │ permission: 0  ← VIEW only                                           │
--    │ inheritance_mode: 'cascade'                                          │
--    │ child_permissions: {}                                                │
--    │ is_deny: false                                                       │
--    │ expires_ts: '2025-12-31 23:59:59'  ← Expires end of year             │
--    └──────────────────────────────────────────────────────────────────────┘
--    MEANING: Auditor can VIEW all projects until Dec 31, 2025. After that,
--             permission automatically becomes invalid (cleanup job removes).
--
-- ============================================================================
-- ENTITY-ROLE INTERACTION PATTERNS
-- ============================================================================
--
-- HOW DIFFERENT ENTITY TYPES USE PERMISSIONS:
--
-- 1. ORGANIZATIONAL HIERARCHY (office, business, department):
--    └─ Permissions typically granted with inheritance_mode='cascade'
--    └─ Example: Manager of Office A gets OWNER on office, cascades to all
--       projects, tasks, employees under that office
--    └─ API: GET /api/v1/project filters by office ancestry if user only
--       has office-level permission
--
-- 2. PROJECT-CENTRIC ENTITIES (project, task, milestone):
--    └─ Permissions often granted with inheritance_mode='mapped'
--    └─ Example: PM gets EDIT(3) on project, tasks get EDIT(3), but wikis
--       only get CONTRIBUTE(2) - different child types, different perms
--    └─ API: POST /api/v1/project/{id}/task requires EDIT on parent project
--
-- 3. HR ENTITIES (employee, role, person):
--    └─ Typically need type-level CREATE permission for HR managers
--    └─ Instance permissions for viewing own data (self-service)
--    └─ API: PATCH /api/v1/employee/{id} checks EDIT on that employee
--
-- 4. REFERENCE DATA (datalabel_*, settings):
--    └─ Usually type-level permissions only (no instance tracking)
--    └─ Admin roles get CREATE/EDIT on settings entities
--    └─ API: Settings pages check type-level permission
--
-- ROLE-TO-ENTITY PERMISSION MATRIX (Typical Configuration):
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ Role        │ Entity Type │ Permission │ Inheritance │ Notes            │
-- ├──────────────────────────────────────────────────────────────────────────┤
-- │ CEO         │ ALL types   │ OWNER (7)  │ cascade     │ Full system      │
-- │ Manager     │ office      │ OWNER (7)  │ cascade     │ Own office tree  │
-- │ PM          │ project     │ EDIT (3)   │ mapped      │ Own projects     │
-- │ Team Lead   │ task        │ EDIT (3)   │ none        │ Assigned tasks   │
-- │ Employee    │ project     │ VIEW (0)   │ cascade     │ Read-only        │
-- │ HR Admin    │ employee    │ CREATE (6) │ none        │ Manage employees │
-- │ Contractor  │ project     │ CONTRIBUTE │ none        │ Submit work only │
-- │ Auditor     │ ALL types   │ VIEW (0)   │ cascade     │ Read-only, temp  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ============================================================================
-- PERMISSION RESOLUTION EXAMPLES
-- ============================================================================
--
-- SCENARIO: Can user "James" (person_id) EDIT task-456?
--
-- Step 1: Find James's roles
--   SELECT entity_instance_id FROM entity_instance_link
--   WHERE entity_code = 'role'
--     AND child_entity_code = 'person'
--     AND child_entity_instance_id = 'james-uuid';
--   → Returns: ['pm-role-uuid', 'employee-role-uuid']
--
-- Step 2: Check explicit deny on task-456 or its ancestors
--   SELECT * FROM entity_rbac
--   WHERE role_id IN ('pm-role-uuid', 'employee-role-uuid')
--     AND entity_code = 'task'
--     AND entity_instance_id = 'task-456-uuid'
--     AND is_deny = true;
--   → If found: DENIED (stop here)
--
-- Step 3: Check direct permission on task-456
--   SELECT MAX(permission) FROM entity_rbac
--   WHERE role_id IN ('pm-role-uuid', 'employee-role-uuid')
--     AND entity_code = 'task'
--     AND (entity_instance_id = 'task-456-uuid'
--          OR entity_instance_id = '11111111-1111-1111-1111-111111111111');
--   → Returns: 3 (EDIT from PM role)
--
-- Step 4: Check inherited permission from parent (project-123 → task-456)
--   a) Find parent: entity_instance_link where child = task-456
--      → project-123-uuid
--   b) Check PM role permission on project-123:
--      → permission=3, inheritance_mode='mapped', child_permissions={"task":3}
--   c) Resolve mapped: child_permissions['task'] = 3 (EDIT)
--   → Inherited permission: 3
--
-- Step 5: Return MAX(direct=3, inherited=3) >= required(3) → ALLOWED
--
-- ============================================================================

-- Drop old table if exists (with CASCADE to handle dependencies)
DROP TABLE IF EXISTS app.entity_rbac CASCADE;

CREATE TABLE app.entity_rbac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Role-based permission (v2.0.0 - role only, no direct person permissions)
  role_id uuid NOT NULL REFERENCES app.role(id) ON DELETE CASCADE,

  -- Entity target
  entity_code varchar(50) NOT NULL, -- Entity type code (references entity.code)
  entity_instance_id uuid NOT NULL, -- Specific instance UUID or '11111111-1111-1111-1111-111111111111' for type-level

  -- Permission level (single integer 0-7 with hierarchical inheritance)
  permission integer NOT NULL DEFAULT 0,
  -- 0=View, 1=Comment, 2=Contribute, 3=Edit, 4=Share, 5=Delete, 6=Create, 7=Owner

  -- Inheritance configuration (v2.0.0)
  inheritance_mode varchar(20) NOT NULL DEFAULT 'none', -- 'none', 'cascade', 'mapped'
  child_permissions jsonb NOT NULL DEFAULT '{}', -- For 'mapped' mode: {"task": 3, "wiki": 0, "_default": 0}
  is_deny boolean NOT NULL DEFAULT false, -- Explicit deny (blocks permission even if granted elsewhere)

  -- Permission lifecycle management
  granted_by_person_id uuid REFERENCES app.person(id), -- Who granted this permission (audit trail)
  granted_ts timestamptz DEFAULT now(),
  expires_ts timestamptz, -- Optional expiration for temporary permissions

  -- Standard temporal fields
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now()
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE app.entity_rbac IS 'Role-based RBAC system (v2.0.0). Permissions granted to roles only. Persons get permissions via role membership. Supports inheritance modes: none, cascade, mapped. Explicit deny blocks inherited permissions.';
COMMENT ON COLUMN app.entity_rbac.role_id IS 'Role receiving this permission (FK to app.role). All permissions are role-based.';
COMMENT ON COLUMN app.entity_rbac.entity_code IS 'Target entity type code (references entity.code): project, task, employee, office, business, etc.';
COMMENT ON COLUMN app.entity_rbac.entity_instance_id IS 'Target entity instance UUID, or "11111111-1111-1111-1111-111111111111" for type-level permissions';
COMMENT ON COLUMN app.entity_rbac.permission IS 'Permission level 0-7: 0=View, 1=Comment, 2=Contribute, 3=Edit, 4=Share, 5=Delete, 6=Create, 7=Owner. Higher levels inherit lower via >= comparison.';
COMMENT ON COLUMN app.entity_rbac.inheritance_mode IS 'How permission propagates to children: none (explicit only), cascade (same level to all), mapped (per-child-type via child_permissions)';
COMMENT ON COLUMN app.entity_rbac.child_permissions IS 'JSONB mapping for "mapped" mode: {"task": 3, "wiki": 0, "_default": 0}. Keys are entity_code, values are permission levels.';
COMMENT ON COLUMN app.entity_rbac.is_deny IS 'Explicit deny flag. When true, blocks permission even if granted elsewhere. Deny takes precedence over grants.';
COMMENT ON COLUMN app.entity_rbac.granted_by_person_id IS 'Person who granted this permission - enables delegation tracking and audit trail';
COMMENT ON COLUMN app.entity_rbac.expires_ts IS 'Optional expiration timestamp for temporary permissions (contractor access, time-limited delegation)';

-- ============================================================================
-- UNIQUE INDEX FOR UPSERT PATTERN
-- ============================================================================
-- Required for ON CONFLICT clause in entity-infrastructure.service.ts
-- Ensures one permission record per (role, entity instance) combination
-- Enables idempotent permission grants via INSERT...ON CONFLICT DO UPDATE
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_rbac_unique_permission
ON app.entity_rbac (role_id, entity_code, entity_instance_id);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Primary lookup: role permissions on entity type
CREATE INDEX IF NOT EXISTS idx_entity_rbac_role_entity
ON app.entity_rbac (role_id, entity_code);

-- Lookup by entity (for permission overview)
CREATE INDEX IF NOT EXISTS idx_entity_rbac_entity_instance
ON app.entity_rbac (entity_code, entity_instance_id);

-- Filter inheritable permissions (cascade/mapped only)
CREATE INDEX IF NOT EXISTS idx_entity_rbac_inheritable
ON app.entity_rbac (role_id, inheritance_mode)
WHERE inheritance_mode IN ('cascade', 'mapped');

-- Filter explicit deny permissions
CREATE INDEX IF NOT EXISTS idx_entity_rbac_deny
ON app.entity_rbac (role_id, entity_code, entity_instance_id)
WHERE is_deny = true;

-- Expiration check index
CREATE INDEX IF NOT EXISTS idx_entity_rbac_expires
ON app.entity_rbac (expires_ts)
WHERE expires_ts IS NOT NULL;

-- ============================================================================
-- RBAC PERMISSION FUNCTIONS (DEPRECATED)
-- ============================================================================
--
-- All RBAC logic is now in the Entity Infrastructure Service:
--   Location: /apps/api/src/services/entity-infrastructure.service.ts
--
-- Key Methods:
--   - check_entity_rbac(person_id, entity_code, entity_id, required_permission)
--   - get_entity_rbac_where_condition(person_id, entity_code, permission, alias)
--   - set_entity_rbac(role_id, entity_code, entity_id, permission, options)
--   - delete_entity_rbac(role_id, entity_code, entity_id)
--
-- See documentation:
--   - /docs/design_pattern/PERMISSION_INHERITANCE_IMPLEMENTATION.md
--   - /docs/services/entity-infrastructure.service.md
--
-- ============================================================================
-- DATA CURATION
-- ============================================================================
--
-- SEED DATA: RBAC permission seed data located in:
--     db/48_rbac_seed_data.ddl
--
-- Reason: This file runs BEFORE d_role table is fully populated,
--         so INSERT statements referencing roles would fail.
--         Seed data file runs at the END of the import sequence.
--
-- ============================================================================
