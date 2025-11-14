-- ============================================================================
-- ENTITY ID RBAC MAP - PERSON-BASED PERMISSION CONTROL SYSTEM
-- ============================================================================
--
-- SEMANTICS:
-- Row-level RBAC system supporting BOTH role-based and employee-specific permissions.
-- Uses simple INTEGER permission level (0-5) with automatic hierarchical inheritance.
-- Permissions resolve via UNION of role permissions (via d_entity_id_map) and direct employee permissions.
-- Higher permission levels automatically inherit all lower permissions (Owner [5] includes all permissions <=5).
--
-- PERMISSION RESOLUTION MODEL:
-- When checking permissions for employee_id, the system resolves via UNION and takes MAX:
--   1. Role-based permissions: employee → roles (via d_entity_id_map) → permissions
--   2. Direct employee permissions: employee → permissions
--   Result: MAX(role permissions, employee permissions) - highest level wins
--
-- PERMISSION LEVEL MODEL (Integer 0-5):
--   permission = 0  → View:   Read access to entity data
--   permission = 1  → Edit:   Modify existing entity (INHERITS View)
--   permission = 2  → Share:  Share entity with others (INHERITS Edit + View)
--   permission = 3  → Delete: Soft delete entity (INHERITS Share + Edit + View)
--   permission = 4  → Create: Create new entities - requires entity_id='all' (INHERITS all lower permissions)
--   permission = 5  → Owner:  Full control including permission management (INHERITS ALL permissions)
--
-- PERMISSION HIERARCHY (Automatic Inheritance):
--   Owner [5] >= Create [4] >= Delete [3] >= Share [2] >= Edit [1] >= View [0]
--   Higher levels automatically include all lower permissions via >= comparison
--
-- PERMISSION CHECKS (using >= operator):
--   View:   permission >= 0  (everyone with any permission)
--   Edit:   permission >= 1  (Edit, Share, Delete, Create, or Owner)
--   Share:  permission >= 2  (Share, Delete, Create, or Owner)
--   Delete: permission >= 3  (Delete, Create, or Owner)
--   Create: permission >= 4  (Create or Owner)
--   Owner:  permission >= 5  (Only Owner)
--
-- ============================================================================

CREATE TABLE app.entity_id_rbac_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Person-based permission mapping (supports both role and employee)
  person_entity_name varchar(20) NOT NULL CHECK (person_entity_name IN ('employee', 'role')), -- 'employee' for direct, 'role' for role-based
  person_entity_id uuid NOT NULL, -- References d_employee.id OR d_role.id (depending on person_entity_name)

  -- Entity target
  entity_name varchar(50) NOT NULL, -- Entity type: project, task, employee, office, business, worksite, customer, etc.
  entity_id text NOT NULL, -- Specific entity UUID or 'all' for type-level permissions

  -- Permission level (single integer 0-5 with hierarchical inheritance)
  permission integer NOT NULL DEFAULT 0 CHECK (permission >= 0 AND permission <= 5),
  -- 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner (higher levels inherit all lower permissions)

  -- Permission lifecycle management
  granted_by_empid uuid, -- References d_employee.id (who granted this permission - delegation tracking)
  granted_ts timestamptz NOT NULL DEFAULT now(),
  expires_ts timestamptz, -- Optional expiration for temporary permissions
  active_flag boolean NOT NULL DEFAULT true,

  -- Standard temporal fields
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now()
);

-- Composite index for fast permission lookups
CREATE INDEX idx_rbac_person_entity ON app.entity_id_rbac_map(person_entity_name, person_entity_id, entity_name, entity_id) WHERE active_flag = true;

-- Index for permission resolution via roles
CREATE INDEX idx_rbac_role_entity ON app.entity_id_rbac_map(person_entity_name, person_entity_id, entity_name) WHERE person_entity_name = 'role' AND active_flag = true;

-- Index for expiration cleanup
CREATE INDEX idx_rbac_expires ON app.entity_id_rbac_map(expires_ts) WHERE expires_ts IS NOT NULL AND active_flag = true;

COMMENT ON TABLE app.entity_id_rbac_map IS 'Person-based RBAC system with integer permission levels: 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner. Higher levels automatically inherit all lower permissions via >= comparison. Supports both role-based (via d_entity_id_map) and direct employee permissions. Permissions resolve via UNION, taking MAX level.';
COMMENT ON COLUMN app.entity_id_rbac_map.person_entity_name IS 'Type of person: employee (direct permission) or role (inherited by all employees assigned to that role via d_entity_id_map)';
COMMENT ON COLUMN app.entity_id_rbac_map.person_entity_id IS 'UUID of employee (if person_entity_name=employee) or role (if person_entity_name=role)';
COMMENT ON COLUMN app.entity_id_rbac_map.entity_name IS 'Target entity type: project, task, employee, office, business, worksite, customer, service, product, order, invoice, etc.';
COMMENT ON COLUMN app.entity_id_rbac_map.entity_id IS 'Target entity UUID for instance-level permissions, or "all" for type-level permissions granting access to ALL instances';
COMMENT ON COLUMN app.entity_id_rbac_map.permission IS 'Permission level with automatic inheritance: 0=View, 1=Edit (implies View), 2=Share (implies Edit+View), 3=Delete (implies Share+Edit+View), 4=Create (implies all lower), 5=Owner (implies all permissions). Check using: permission >= required_level';
COMMENT ON COLUMN app.entity_id_rbac_map.granted_by_empid IS 'Employee who granted this permission - enables delegation tracking and audit trail';
COMMENT ON COLUMN app.entity_id_rbac_map.expires_ts IS 'Optional expiration timestamp for temporary permissions (contractor access, time-limited delegation)';

-- ============================================================================
-- RBAC PERMISSION FUNCTIONS
-- ============================================================================
--
-- ✅ DEPRECATED: SQL functions removed - replaced by API-based RBAC service
-- ✅ Location: /apps/api/src/lib/rbac.service.ts
--
-- ✅ Migration: SQL functions → TypeScript API functions
--   OLD: SELECT app.has_permission_on_entity_id(...)
--   NEW: import { hasPermissionOnEntityId } from '@/lib/rbac.service.js'
--
--   OLD: SELECT app.get_all_scope_by_entity_employee(...)
--   NEW: import { getAllScopeByEntityEmployee } from '@/lib/rbac.service.js'
--
-- ✅ Benefits:
--   - Reusable across all API routes (no code duplication)
--   - Type-safe TypeScript functions
--   - Easy to unit test and mock
--   - Consistent permission resolution logic
--   - Middleware pattern for operation gating
--
-- ✅ See documentation:
--   - /docs/entity_design_pattern/RBAC_API_MIGRATION_GUIDE.md
--   - /docs/entity_design_pattern/rbac.md
--
-- ============================================================================
-- DATA CURATION: ROLE-BASED PERMISSIONS
-- ============================================================================

-- CEO Role - Full permissions (level 5 = Owner) on all entities
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_ts)
SELECT
  'role', r.id, entity_type, 'all', 5, now()  -- Level 5 = Owner
FROM app.d_role r
CROSS JOIN (VALUES
  ('office'), ('business'), ('project'), ('task'), ('worksite'), ('cust'),
  ('role'), ('artifact'), ('wiki'), ('form'), ('reports'), ('employee'),
  ('expense'), ('revenue'), ('service'), ('product'), ('quote'), ('work_order'),
  ('order'), ('invoice'), ('shipment'), ('inventory'), ('interaction'), ('message_schema')
) AS entities(entity_type)
WHERE r.role_code = 'CEO';

-- Manager Roles - Department management permissions (level 4 = Create)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'project', 'all', 4  -- Level 4 = Create (+ Delete + Share + Edit + View)
FROM app.d_role r
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'task', 'all', 4  -- Level 4 = Create
FROM app.d_role r
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, 'all', 2  -- Level 2 = Share (+ Edit + View)
FROM app.d_role r
CROSS JOIN (VALUES
  ('worksite'), ('cust'), ('artifact'), ('wiki'), ('form'), ('reports')
) AS entities(entity_type)
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'employee', 'all', 1  -- Level 1 = Edit (+ View)
FROM app.d_role r
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Supervisor Roles - Field operation permissions (level 2-4)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'task', 'all', 4  -- Level 4 = Create
FROM app.d_role r
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, 'all', 2  -- Level 2 = Share (+ Edit + View)
FROM app.d_role r
CROSS JOIN (VALUES
  ('worksite'), ('cust'), ('artifact'), ('form')
) AS entities(entity_type)
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'reports', 'all', 1  -- Level 1 = Edit (+ View)
FROM app.d_role r
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- Technician Roles - Operational permissions (level 0-1)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, 'all', 1  -- Level 1 = Edit (+ View)
FROM app.d_role r
CROSS JOIN (VALUES
  ('task'), ('worksite'), ('form'), ('reports')
) AS entities(entity_type)
WHERE r.role_code IN ('TECH-FIELD');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'cust', 'all', 0  -- Level 0 = View only
FROM app.d_role r
WHERE r.role_code IN ('TECH-FIELD');

-- Admin Roles - Administrative permissions (level 1-4)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'task', 'all', 4  -- Level 4 = Create
FROM app.d_role r
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, 'all', 2  -- Level 2 = Share (+ Edit + View)
FROM app.d_role r
CROSS JOIN (VALUES
  ('project'), ('cust'), ('artifact'), ('form'), ('reports')
) AS entities(entity_type)
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

-- ============================================================================
-- DATA CURATION: EMPLOYEE-SPECIFIC PERMISSIONS (EXAMPLES)
-- ============================================================================

-- CEO (James Miller) - Direct owner permissions (level 5) for critical entities
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_ts)
SELECT
  'employee', e.id, entity_type, 'all', 5, now()  -- Level 5 = Owner
FROM app.d_employee e
CROSS JOIN (VALUES
  ('office'), ('business'), ('employee'), ('role')
) AS entities(entity_type)
WHERE e.email = 'james.miller@huronhome.ca';
