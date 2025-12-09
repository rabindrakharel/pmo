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
-- PERMISSION RESOLUTION MODEL (v2.0.0):
-- When checking permissions for person_id, the system resolves via:
--   1. Find roles: entity_instance_link WHERE entity_code='role' AND child_entity_code='person'
--   2. Check explicit deny: entity_rbac WHERE is_deny=true
--   3. Direct role perms: entity_rbac WHERE role_id IN (person_roles)
--   4. Inherited perms: traverse ancestors via entity_instance_link, apply inheritance_mode
--   Result: MAX(direct permissions, inherited permissions), blocked by deny
--
-- INHERITANCE MODES:
--   none:    Permission applies ONLY to the specific entity (no children inherit)
--   cascade: Same permission level applies to ALL children (recursive)
--   mapped:  Different permission levels per child entity type (via child_permissions JSONB)
--
-- PERMISSION LEVEL MODEL (Integer 0-7):
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
