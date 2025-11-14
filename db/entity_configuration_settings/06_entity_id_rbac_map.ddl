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

-- Function to check if employee has specific permission on entity instance
-- Resolves via UNION of role-based and direct employee permissions, takes MAX level
CREATE OR REPLACE FUNCTION app.has_permission_on_entity_id(
  p_employee_id uuid,
  p_entity_name varchar(50),
  p_entity_id text,
  p_permission_type varchar(10) -- 'view', 'edit', 'share', 'delete', 'create', 'owner'
)
RETURNS integer AS $$
DECLARE
  v_required_level integer;
  v_max_permission integer;
BEGIN
  -- Map permission type to required level
  v_required_level := CASE p_permission_type
    WHEN 'view' THEN 0
    WHEN 'edit' THEN 1
    WHEN 'share' THEN 2
    WHEN 'delete' THEN 3
    WHEN 'create' THEN 4
    WHEN 'owner' THEN 5
    ELSE -1
  END;

  IF v_required_level < 0 THEN
    RETURN 0; -- Invalid permission type
  END IF;

  -- Get maximum permission level from role-based and direct employee permissions
  SELECT COALESCE(MAX(permission), -1)
  INTO v_max_permission
  FROM (
    -- Source 1: Direct employee permissions
    SELECT permission
    FROM app.entity_id_rbac_map
    WHERE person_entity_name = 'employee'
      AND person_entity_id = p_employee_id
      AND entity_name = p_entity_name
      AND (entity_id = 'all' OR entity_id = p_entity_id)
      AND active_flag = true
      AND (expires_ts IS NULL OR expires_ts > now())

    UNION ALL

    -- Source 2: Role-based permissions (employee → roles → permissions)
    SELECT rbac.permission
    FROM app.entity_id_rbac_map rbac
    INNER JOIN app.d_entity_id_map eim
      ON eim.parent_entity_type = 'role'
      AND eim.parent_entity_id::text = rbac.person_entity_id::text
      AND eim.child_entity_type = 'employee'
      AND eim.child_entity_id::text = p_employee_id::text
      AND eim.active_flag = true
    WHERE rbac.person_entity_name = 'role'
      AND rbac.entity_name = p_entity_name
      AND (rbac.entity_id = 'all' OR rbac.entity_id = p_entity_id)
      AND rbac.active_flag = true
      AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
  ) AS combined;

  -- Check if max permission level meets requirement (hierarchical inheritance via >=)
  RETURN CASE WHEN v_max_permission >= v_required_level THEN 1 ELSE 0 END;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION app.has_permission_on_entity_id IS 'Check if employee has specific permission on entity instance. Returns 1 if permitted, 0 otherwise. Resolves via UNION of role-based (via d_entity_id_map) and direct employee permissions, taking MAX level. Uses hierarchical inheritance (permission >= required_level). Use for API gating before operations.';

-- Function to get all entity IDs that employee can access with specified permission
-- Returns array of entity_id UUIDs for filtering query results
CREATE OR REPLACE FUNCTION app.get_all_scope_by_entity_employee(
  p_employee_id uuid,
  p_entity_name varchar(50),
  p_permission_type varchar(10) -- 'view', 'edit', 'share', 'delete', 'create', 'owner'
)
RETURNS text[] AS $$
DECLARE
  v_required_level integer;
  v_entity_ids text[];
  v_has_all_access boolean;
BEGIN
  -- Map permission type to required level
  v_required_level := CASE p_permission_type
    WHEN 'view' THEN 0
    WHEN 'edit' THEN 1
    WHEN 'share' THEN 2
    WHEN 'delete' THEN 3
    WHEN 'create' THEN 4
    WHEN 'owner' THEN 5
    ELSE -1
  END;

  IF v_required_level < 0 THEN
    RETURN ARRAY[]::text[]; -- Invalid permission type
  END IF;

  -- Check if employee has 'all' access (type-level permission with sufficient level)
  SELECT EXISTS (
    SELECT 1 FROM (
      -- Direct employee 'all' permission
      SELECT permission
      FROM app.entity_id_rbac_map
      WHERE person_entity_name = 'employee'
        AND person_entity_id = p_employee_id
        AND entity_name = p_entity_name
        AND entity_id = 'all'
        AND permission >= v_required_level  -- Hierarchical check
        AND active_flag = true
        AND (expires_ts IS NULL OR expires_ts > now())

      UNION ALL

      -- Role-based 'all' permission
      SELECT rbac.permission
      FROM app.entity_id_rbac_map rbac
      INNER JOIN app.d_entity_id_map eim
        ON eim.parent_entity_type = 'role'
        AND eim.parent_entity_id::text = rbac.person_entity_id::text
        AND eim.child_entity_type = 'employee'
        AND eim.child_entity_id::text = p_employee_id::text
        AND eim.active_flag = true
      WHERE rbac.person_entity_name = 'role'
        AND rbac.entity_name = p_entity_name
        AND rbac.entity_id = 'all'
        AND rbac.permission >= v_required_level  -- Hierarchical check
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
    ) AS combined
  ) INTO v_has_all_access;

  IF v_has_all_access THEN
    -- Return special marker for 'all' access - caller should interpret this as no filtering needed
    RETURN ARRAY['all']::text[];
  END IF;

  -- Otherwise, collect specific entity IDs where permission level is sufficient
  SELECT array_agg(DISTINCT entity_id)
  INTO v_entity_ids
  FROM (
    -- Direct employee permissions on specific entities
    SELECT entity_id
    FROM app.entity_id_rbac_map
    WHERE person_entity_name = 'employee'
      AND person_entity_id = p_employee_id
      AND entity_name = p_entity_name
      AND entity_id != 'all'
      AND permission >= v_required_level  -- Hierarchical check
      AND active_flag = true
      AND (expires_ts IS NULL OR expires_ts > now())

    UNION

    -- Role-based permissions on specific entities
    SELECT rbac.entity_id
    FROM app.entity_id_rbac_map rbac
    INNER JOIN app.d_entity_id_map eim
      ON eim.parent_entity_type = 'role'
      AND eim.parent_entity_id::text = rbac.person_entity_id::text
      AND eim.child_entity_type = 'employee'
      AND eim.child_entity_id::text = p_employee_id::text
      AND eim.active_flag = true
    WHERE rbac.person_entity_name = 'role'
      AND rbac.entity_name = p_entity_name
      AND rbac.entity_id != 'all'
      AND rbac.permission >= v_required_level  -- Hierarchical check
      AND rbac.active_flag = true
      AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
  ) AS specific_permissions;

  RETURN COALESCE(v_entity_ids, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION app.get_all_scope_by_entity_employee IS 'Get all entity IDs that employee can access with specified permission. Returns array of entity_id UUIDs, or [''all''] if employee has type-level access. Uses hierarchical inheritance (permission >= required_level). Use for filtering query results: WHERE id = ANY(get_all_scope_by_entity_employee(...))';

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
