-- ============================================================================
-- ENTITY ID RBAC MAP - PERSON-BASED PERMISSION CONTROL SYSTEM
-- ============================================================================
--
-- SEMANTICS:
-- Row-level RBAC system supporting BOTH role-based and employee-specific permissions.
-- Permissions resolve via UNION of role permissions (via d_entity_id_map) and direct employee permissions.
-- Supports type-level ('all') and instance-level (specific UUID) permissions with temporal expiration.
--
-- PERMISSION RESOLUTION MODEL:
-- When checking permissions for employee_id, the system resolves via UNION:
--   1. Role-based permissions: employee → roles (via d_entity_id_map) → permissions
--   2. Direct employee permissions: employee → permissions
--   Result: UNION of both sources (employee gets permission if EITHER grants it)
--
-- PERMISSION ARRAY MODEL:
--   permission[0] = View:   Read access to entity data
--   permission[1] = Edit:   Modify existing entity (inherits View)
--   permission[2] = Share:  Share entity with others (inherits View + Edit)
--   permission[3] = Delete: Soft delete entity (inherits View + Edit + Share)
--   permission[4] = Create: Create new entities - requires entity_id='all' (inherits all lower permissions)
--   permission[5] = Owner:  Full control including permission management (inherits all permissions)
--
-- PERMISSION HIERARCHY:
--   Owner [5] implies → Delete [3] + Create [4]
--   Delete [3] implies → Share [2]
--   Share [2] implies → Edit [1]
--   Edit [1] implies → View [0]
--
-- ============================================================================
-- USAGE EXAMPLES:
-- ============================================================================
--
-- EXAMPLE 1: ROLE-BASED PERMISSION (Managers can create projects)
-- Step 1: Create role permission
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('role', '{manager_role_uuid}', 'project', 'all', ARRAY[0,1,2,3,4]);
-- Step 2: Assign employees to manager role (via d_entity_id_map)
INSERT INTO app.d_entity_id_map (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, relationship_type)
VALUES ('role', '{manager_role_uuid}', 'employee', '{james_employee_uuid}', 'assigned_to');
-- Result: James inherits project creation permission via his manager role
--
-- EXAMPLE 2: EMPLOYEE-SPECIFIC PERMISSION (John can edit specific project)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('employee', '{john_employee_uuid}', 'project', '{project_uuid}', ARRAY[0,1]);
-- Result: John can view/edit ONLY project {project_uuid}
--
-- EXAMPLE 3: PERMISSION RESOLUTION (Check if Sarah can edit project ABC)
-- Query resolves via UNION:
SELECT DISTINCT employee_id
FROM (
  -- Source 1: Direct employee permissions
  SELECT person_entity_id as employee_id
  FROM app.entity_id_rbac_map
  WHERE person_entity_name = 'employee'
    AND person_entity_id = '{sarah_uuid}'
    AND entity_name = 'project'
    AND (entity_id = 'all' OR entity_id = '{project_abc_uuid}')
    AND 1 = ANY(permission)  -- Check Edit permission
    AND active_flag = true
    AND (expires_ts IS NULL OR expires_ts > now())

  UNION

  -- Source 2: Role-based permissions (via d_entity_id_map)
  SELECT eim.child_entity_id as employee_id
  FROM app.entity_id_rbac_map rbac
  INNER JOIN app.d_entity_id_map eim
    ON eim.parent_entity_type = 'role'
    AND eim.parent_entity_id = rbac.person_entity_id
    AND eim.child_entity_type = 'employee'
    AND eim.child_entity_id = '{sarah_uuid}'
    AND eim.active_flag = true
  WHERE rbac.person_entity_name = 'role'
    AND rbac.entity_name = 'project'
    AND (rbac.entity_id = 'all' OR rbac.entity_id = '{project_abc_uuid}')
    AND 1 = ANY(rbac.permission)
    AND rbac.active_flag = true
    AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
) AS combined
WHERE employee_id = '{sarah_uuid}';
-- Result: Returns '{sarah_uuid}' if Sarah has edit permission from EITHER source
--
-- EXAMPLE 4: TYPE-LEVEL PERMISSION (All managers can view all tasks)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES ('role', '{manager_role_uuid}', 'task', 'all', ARRAY[0]);
-- Result: ALL employees assigned to manager role can view ALL tasks
--
-- EXAMPLE 5: TEMPORARY PERMISSION (Contractor access expires in 30 days)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, expires_ts)
VALUES ('employee', '{contractor_uuid}', 'project', '{project_uuid}', ARRAY[0,1], now() + interval '30 days');
-- Result: Contractor can edit project for 30 days, then permission expires automatically
--
-- ============================================================================
-- AUTHORIZATION PATTERNS:
-- ============================================================================
--
-- PATTERN 1: CREATE CHILD ENTITY
-- To create task under project, employee needs:
--   (a) Edit permission on parent project: entity_name='project', entity_id={project_uuid}, permission contains 1
--   (b) Create permission on child type: entity_name='task', entity_id='all', permission contains 4
-- Permissions do NOT cascade automatically - must be explicitly granted
--
-- PATTERN 2: TEAM COLLABORATION
-- Team lead grants project access to team members:
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_empid)
VALUES
  ('employee', '{member1_uuid}', 'project', '{project_uuid}', ARRAY[0,1], '{team_lead_uuid}'),
  ('employee', '{member2_uuid}', 'project', '{project_uuid}', ARRAY[0,1], '{team_lead_uuid}');
-- Result: Team members can edit specific project, audit trail shows who granted permission
--
-- PATTERN 3: HIERARCHICAL PERMISSIONS
-- Department managers get all permissions for their department's entities:
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT 'role', r.id, entity_type, 'all', ARRAY[0,1,2,3,4]
FROM app.d_role r
CROSS JOIN (VALUES ('project'), ('task'), ('worksite')) AS entities(entity_type)
WHERE r.role_code = 'DEPT-MGR';
-- Result: All employees with DEPT-MGR role get full permissions on projects, tasks, worksites
--
-- PATTERN 4: PERMISSION DELEGATION
-- Managers delegate specific permissions to team leads:
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_empid)
VALUES ('employee', '{team_lead_uuid}', 'project', '{project_uuid}', ARRAY[0,1,2], '{manager_uuid}');
-- Result: Team lead can view/edit/share project, but cannot delete or create new ones
--
-- ============================================================================
-- API INTEGRATION FUNCTIONS:
-- ============================================================================
--
-- FUNCTION 1: has_permission_on_entity_id(employee_id, entity_name, entity_id, permission_type)
-- Returns: 1 if permission granted, 0 otherwise
-- Usage: Gate API operations before execution
-- Example: SELECT has_permission_on_entity_id('{jwt_employee_id}', 'project', '{project_id}', 'edit');
--
-- FUNCTION 2: get_all_scope_by_entity_employee(employee_id, entity_name, permission_type)
-- Returns: Array of entity_ids that employee can access with specified permission
-- Usage: Filter SQL query results to show only authorized records
-- Example: SELECT * FROM d_project WHERE id = ANY(get_all_scope_by_entity_employee('{jwt_employee_id}', 'project', 'view'));
--
-- ============================================================================
-- AUTHORIZATION FLOW (API MIDDLEWARE):
-- ============================================================================
--
-- 1. User makes API request (e.g., PUT /api/v1/project/{id})
-- 2. JWT middleware extracts employee_id from token (sub claim)
-- 3. Permission check:
--    a. Check has_permission_on_entity_id(jwt.employee_id, 'project', {id}, 'edit')
--    b. If returns 0 → HTTP 403 Forbidden
--    c. If returns 1 → Continue to business logic
-- 4. Query filtering (for list endpoints):
--    a. Get scope: entity_ids = get_all_scope_by_entity_employee(jwt.employee_id, 'project', 'view')
--    b. Filter results: WHERE id = ANY(entity_ids)
-- 5. Execute operation and return response
--
-- ============================================================================
-- REVOKE/EXPIRE PERMISSIONS:
-- ============================================================================
--
-- SOFT DELETE (recommended):
UPDATE app.entity_id_rbac_map
SET active_flag = false, updated_ts = now()
WHERE person_entity_id = '{employee_uuid}' AND entity_id = '{project_uuid}';
--
-- HARD DELETE (use with caution):
DELETE FROM app.entity_id_rbac_map
WHERE person_entity_id = '{employee_uuid}' AND entity_id = '{project_uuid}';
--
-- SET EXPIRATION:
UPDATE app.entity_id_rbac_map
SET expires_ts = now() + interval '7 days', updated_ts = now()
WHERE person_entity_id = '{employee_uuid}' AND entity_id = '{project_uuid}';
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

  -- Permission array
  permission integer[] NOT NULL DEFAULT '{}', -- Array: [0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner]

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

COMMENT ON TABLE app.entity_id_rbac_map IS 'Person-based RBAC system with permission arrays: 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner. Supports both role-based (via d_entity_id_map) and direct employee permissions. Permissions resolve via UNION of both sources.';
COMMENT ON COLUMN app.entity_id_rbac_map.person_entity_name IS 'Type of person: employee (direct permission) or role (inherited by all employees assigned to that role via d_entity_id_map)';
COMMENT ON COLUMN app.entity_id_rbac_map.person_entity_id IS 'UUID of employee (if person_entity_name=employee) or role (if person_entity_name=role)';
COMMENT ON COLUMN app.entity_id_rbac_map.entity_name IS 'Target entity type: project, task, employee, office, business, worksite, customer, service, product, order, invoice, etc.';
COMMENT ON COLUMN app.entity_id_rbac_map.entity_id IS 'Target entity UUID for instance-level permissions, or "all" for type-level permissions granting access to ALL instances';
COMMENT ON COLUMN app.entity_id_rbac_map.permission IS 'Permission array with hierarchy: [0]=View, [1]=Edit (implies View), [2]=Share (implies Edit+View), [3]=Delete (implies Share+Edit+View), [4]=Create on type (implies all lower), [5]=Owner (implies all permissions)';
COMMENT ON COLUMN app.entity_id_rbac_map.granted_by_empid IS 'Employee who granted this permission - enables delegation tracking and audit trail';
COMMENT ON COLUMN app.entity_id_rbac_map.expires_ts IS 'Optional expiration timestamp for temporary permissions (contractor access, time-limited delegation)';

-- ============================================================================
-- RBAC PERMISSION FUNCTIONS
-- ============================================================================

-- Function to check if employee has specific permission on entity instance
-- Resolves via UNION of role-based and direct employee permissions
CREATE OR REPLACE FUNCTION app.has_permission_on_entity_id(
  p_employee_id uuid,
  p_entity_name varchar(50),
  p_entity_id text,
  p_permission_type varchar(10) -- 'view', 'edit', 'share', 'delete', 'create', 'owner'
)
RETURNS integer AS $$
DECLARE
  v_permission_level integer;
  v_has_permission boolean;
BEGIN
  -- Map permission type to array index
  v_permission_level := CASE p_permission_type
    WHEN 'view' THEN 0
    WHEN 'edit' THEN 1
    WHEN 'share' THEN 2
    WHEN 'delete' THEN 3
    WHEN 'create' THEN 4
    WHEN 'owner' THEN 5
    ELSE -1
  END;

  IF v_permission_level < 0 THEN
    RETURN 0; -- Invalid permission type
  END IF;

  -- Check if employee has permission via UNION of role-based and direct permissions
  SELECT EXISTS (
    SELECT 1 FROM (
      -- Source 1: Direct employee permissions
      SELECT person_entity_id
      FROM app.entity_id_rbac_map
      WHERE person_entity_name = 'employee'
        AND person_entity_id = p_employee_id
        AND entity_name = p_entity_name
        AND (entity_id = 'all' OR entity_id = p_entity_id)
        AND v_permission_level = ANY(permission)
        AND active_flag = true
        AND (expires_ts IS NULL OR expires_ts > now())

      UNION

      -- Source 2: Role-based permissions (employee → roles → permissions)
      SELECT eim.child_entity_id
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
        AND v_permission_level = ANY(rbac.permission)
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
    ) AS combined
  ) INTO v_has_permission;

  RETURN CASE WHEN v_has_permission THEN 1 ELSE 0 END;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION app.has_permission_on_entity_id IS 'Check if employee has specific permission on entity instance. Returns 1 if permitted, 0 otherwise. Resolves via UNION of role-based (via d_entity_id_map) and direct employee permissions. Use for API gating before operations.';

-- Function to get all entity IDs that employee can access with specified permission
-- Returns array of entity_id UUIDs for filtering query results
CREATE OR REPLACE FUNCTION app.get_all_scope_by_entity_employee(
  p_employee_id uuid,
  p_entity_name varchar(50),
  p_permission_type varchar(10) -- 'view', 'edit', 'share', 'delete', 'create', 'owner'
)
RETURNS text[] AS $$
DECLARE
  v_permission_level integer;
  v_entity_ids text[];
  v_has_all_access boolean;
BEGIN
  -- Map permission type to array index
  v_permission_level := CASE p_permission_type
    WHEN 'view' THEN 0
    WHEN 'edit' THEN 1
    WHEN 'share' THEN 2
    WHEN 'delete' THEN 3
    WHEN 'create' THEN 4
    WHEN 'owner' THEN 5
    ELSE -1
  END;

  IF v_permission_level < 0 THEN
    RETURN ARRAY[]::text[]; -- Invalid permission type
  END IF;

  -- Check if employee has 'all' access (type-level permission)
  SELECT EXISTS (
    SELECT 1 FROM (
      -- Direct employee 'all' permission
      SELECT person_entity_id
      FROM app.entity_id_rbac_map
      WHERE person_entity_name = 'employee'
        AND person_entity_id = p_employee_id
        AND entity_name = p_entity_name
        AND entity_id = 'all'
        AND v_permission_level = ANY(permission)
        AND active_flag = true
        AND (expires_ts IS NULL OR expires_ts > now())

      UNION

      -- Role-based 'all' permission
      SELECT eim.child_entity_id
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
        AND v_permission_level = ANY(rbac.permission)
        AND rbac.active_flag = true
        AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
    ) AS combined
  ) INTO v_has_all_access;

  IF v_has_all_access THEN
    -- Return special marker for 'all' access - caller should interpret this as no filtering needed
    RETURN ARRAY['all']::text[];
  END IF;

  -- Otherwise, collect specific entity IDs
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
      AND v_permission_level = ANY(permission)
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
      AND v_permission_level = ANY(rbac.permission)
      AND rbac.active_flag = true
      AND (rbac.expires_ts IS NULL OR rbac.expires_ts > now())
  ) AS specific_permissions;

  RETURN COALESCE(v_entity_ids, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION app.get_all_scope_by_entity_employee IS 'Get all entity IDs that employee can access with specified permission. Returns array of entity_id UUIDs, or [''all''] if employee has type-level access. Use for filtering query results: WHERE id = ANY(get_all_scope_by_entity_employee(...))';

-- ============================================================================
-- DATA CURATION: ROLE-BASED PERMISSIONS
-- ============================================================================

-- CEO Role - Full permissions on all entities
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_ts)
SELECT
  'role', r.id, entity_type, 'all', ARRAY[0,1,2,3,4,5]::integer[], now()
FROM app.d_role r
CROSS JOIN (VALUES
  ('office'), ('business'), ('project'), ('task'), ('worksite'), ('cust'),
  ('role'), ('artifact'), ('wiki'), ('form'), ('reports'), ('employee'),
  ('expense'), ('revenue'), ('service'), ('product'), ('quote'), ('work_order'),
  ('order'), ('invoice'), ('shipment'), ('inventory'), ('interaction'), ('message_schema')
) AS entities(entity_type)
WHERE r.role_code = 'CEO';

-- Manager Roles - Department management permissions
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, 'all', permissions::integer[]
FROM app.d_role r
CROSS JOIN (VALUES
  ('project', '{0,1,2,4}'),       -- Project management
  ('task', '{0,1,2,4}'),          -- Task management
  ('worksite', '{0,1,2}'),        -- Worksite oversight
  ('cust', '{0,1,2}'),            -- Customer management
  ('employee', '{0,1}'),          -- Team management
  ('artifact', '{0,1,2,4}'),      -- Documentation
  ('wiki', '{0,1,2,4}'),          -- Knowledge management
  ('form', '{0,1,2}'),            -- Form processing
  ('reports', '{0,1,2}')          -- Reporting
) AS perms(entity_type, permissions)
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Supervisor Roles - Field operation permissions
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, 'all', permissions::integer[]
FROM app.d_role r
CROSS JOIN (VALUES
  ('task', '{0,1,2,4}'),          -- Task management
  ('worksite', '{0,1}'),          -- Worksite updates
  ('cust', '{0,1}'),              -- Customer interaction
  ('artifact', '{0,1,2}'),        -- Documentation
  ('form', '{0,1,2,4}'),          -- Forms
  ('reports', '{0,1}')            -- Reporting
) AS perms(entity_type, permissions)
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- Technician Roles - Operational permissions
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, 'all', permissions::integer[]
FROM app.d_role r
CROSS JOIN (VALUES
  ('task', '{0,1}'),              -- Task execution
  ('worksite', '{0,1}'),          -- Worksite status
  ('cust', '{0}'),                -- Customer info
  ('form', '{0,1,2}'),            -- Service forms
  ('reports', '{0,1}')            -- Work reporting
) AS perms(entity_type, permissions)
WHERE r.role_code IN ('TECH-FIELD');

-- Admin Roles - Administrative permissions
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, 'all', permissions::integer[]
FROM app.d_role r
CROSS JOIN (VALUES
  ('project', '{0,1,2}'),         -- Project coordination
  ('task', '{0,1,2,4}'),          -- Task management
  ('cust', '{0,1}'),              -- Customer communication
  ('artifact', '{0,1,2,4}'),      -- Documentation
  ('form', '{0,1,2}'),            -- Forms
  ('reports', '{0,1}')            -- Reporting
) AS perms(entity_type, permissions)
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

-- ============================================================================
-- DATA CURATION: EMPLOYEE-SPECIFIC PERMISSIONS (EXAMPLES)
-- ============================================================================

-- CEO (James Miller) - Direct owner permissions for critical entities
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_ts)
SELECT
  'employee', e.id, entity_type, 'all', ARRAY[0,1,2,3,4,5]::integer[], now()
FROM app.d_employee e
CROSS JOIN (VALUES
  ('office'), ('business'), ('employee'), ('role')
) AS entities(entity_type)
WHERE e.email = 'james.miller@huronhome.ca';
