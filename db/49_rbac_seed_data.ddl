-- ============================================================================
-- RBAC SEED DATA - ROLE AND EMPLOYEE PERMISSIONS
-- ============================================================================
--
-- SEMANTICS:
-- Seed data for entity_id_rbac_map table with default permissions for:
--   - CEO role: Full owner (5) permissions on all entities
--   - Manager roles: Create (4) permissions on projects/tasks
--   - Supervisor roles: Limited operational permissions
--   - James Miller (CEO employee): Direct owner permissions
--
-- EXECUTION ORDER:
-- This file runs as #49 in the import sequence (db-import.sh line 309).
-- It MUST run AFTER all entity tables are created and populated:
--   - 06_entity_id_rbac_map.ddl (line 234) - Creates RBAC table structure
--   - 05_employee.ddl (line 238) - Creates employee data
--   - 09_role.ddl (line 242) - Creates role data
--
-- ✅ Automatically executed by: ./tools/db-import.sh
-- ✅ Inserts: ~131 RBAC permission records (98 role-based + 33 employee-specific)
--
-- ============================================================================

-- ============================================================================
-- DATA CURATION: ROLE-BASED PERMISSIONS
-- ============================================================================

-- CEO Role - Full permissions (level 5 = Owner) on all entities
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_ts)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 5, now()  -- Level 5 = Owner
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
  'role', r.id, 'project', '11111111-1111-1111-1111-111111111111', 4  -- Level 4 = Create (+ Delete + Share + Edit + View)
FROM app.d_role r
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'task', '11111111-1111-1111-1111-111111111111', 4  -- Level 4 = Create
FROM app.d_role r
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 2  -- Level 2 = Share (+ Edit + View)
FROM app.d_role r
CROSS JOIN (VALUES
  ('worksite'), ('cust'), ('artifact'), ('wiki'), ('form'), ('reports')
) AS entities(entity_type)
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'employee', '11111111-1111-1111-1111-111111111111', 1  -- Level 1 = Edit (+ View)
FROM app.d_role r
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Supervisor Roles - Field operation permissions (level 2-4)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'task', '11111111-1111-1111-1111-111111111111', 4  -- Level 4 = Create
FROM app.d_role r
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 2  -- Level 2 = Share (+ Edit + View)
FROM app.d_role r
CROSS JOIN (VALUES
  ('worksite'), ('cust'), ('artifact'), ('form')
) AS entities(entity_type)
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'reports', '11111111-1111-1111-1111-111111111111', 1  -- Level 1 = Edit (+ View)
FROM app.d_role r
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- Technician Roles - Operational permissions (level 0-1)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 1  -- Level 1 = Edit (+ View)
FROM app.d_role r
CROSS JOIN (VALUES
  ('task'), ('worksite'), ('form'), ('reports')
) AS entities(entity_type)
WHERE r.role_code IN ('TECH-FIELD');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'cust', '11111111-1111-1111-1111-111111111111', 0  -- Level 0 = View only
FROM app.d_role r
WHERE r.role_code IN ('TECH-FIELD');

-- Admin Roles - Administrative permissions (level 1-4)
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, 'task', '11111111-1111-1111-1111-111111111111', 4  -- Level 4 = Create
FROM app.d_role r
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 2  -- Level 2 = Share (+ Edit + View)
FROM app.d_role r
CROSS JOIN (VALUES
  ('project'), ('cust'), ('artifact'), ('form'), ('reports')
) AS entities(entity_type)
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

-- ============================================================================
-- DATA CURATION: EMPLOYEE-SPECIFIC PERMISSIONS (EXAMPLES)
-- ============================================================================

-- CEO (James Miller) - Direct owner permissions (level 5) for ALL entities
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_ts)
SELECT
  'employee', e.id, entity_type, '11111111-1111-1111-1111-111111111111', 5, now()  -- Level 5 = Owner
FROM app.d_employee e
CROSS JOIN (VALUES
  ('artifact'), ('business'), ('business_hierarchy'), ('calendar'), ('cust'),
  ('employee'), ('event'), ('expense'), ('form'), ('interaction'),
  ('inventory'), ('invoice'), ('message'), ('message_schema'), ('office'),
  ('office_hierarchy'), ('order'), ('product'), ('product_hierarchy'), ('project'),
  ('quote'), ('rbac'), ('reports'), ('revenue'), ('role'),
  ('service'), ('shipment'), ('task'), ('wiki'), ('workflow'),
  ('workflow_automation'), ('work_order'), ('worksite')
) AS entities(entity_type)
WHERE e.email = 'james.miller@huronhome.ca';

-- ============================================================================
-- TASK-SPECIFIC PERMISSIONS: James Miller Full Ownership
-- ============================================================================
-- Grant all 5 permissions (0=View, 1=Edit, 2=Share, 3=Delete, 4=Create) on each task
-- This ensures James Miller has explicit task-level permissions beyond entity-type permissions

INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission, granted_by_employee_id, active_flag)
SELECT
  'employee',
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', -- James Miller
  'task',
  t.id,
  perm.permission,
  '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', -- Self-granted
  true
FROM app.d_task t
CROSS JOIN (
  SELECT 0 AS permission UNION ALL  -- View
  SELECT 1 UNION ALL                -- Edit
  SELECT 2 UNION ALL                -- Share
  SELECT 3 UNION ALL                -- Delete
  SELECT 4                          -- Create
) perm;

COMMENT ON TABLE app.entity_id_rbac_map IS 'Person-based RBAC system with integer permission levels: 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create, 5=Owner. Higher levels automatically inherit all lower permissions via >= comparison. Supports both role-based (via d_entity_id_map) and direct employee permissions. Permissions resolve via UNION, taking MAX level. SEED DATA LOADED from 48_rbac_seed_data.ddl';
