-- ============================================================================
-- RBAC SEED DATA - ROLE AND EMPLOYEE PERMISSIONS
-- ============================================================================
--
-- SEMANTICS:
-- Seed data for entity_rbac table with person-based permissions for:
--   - CEO role: Full owner (7) permissions on all entities
--   - Manager roles: Create (6) permissions on their department entities
--   - Supervisor roles: Edit/Share permissions on operational entities
--   - Technician roles: Limited field operation permissions
--   - James Miller (CEO employee): Direct owner permissions on all entities
--
-- PERMISSION LEVEL MODEL (0-7):
--   0 = View:       Read access to entity data
--   1 = Comment:    Add comments on entities
--   3 = Edit:       Modify existing entity (Contribute to forms, tasks, wikis)
--   4 = Share:      Share entity with others
--   5 = Delete:     Soft delete entity
--   6 = Create:     Create new entities (type-level only: entity_instance_id='11111111-1111-1111-1111-111111111111')
--   7 = Owner:      Full control including permission management
--
-- PERMISSION HIERARCHY (Automatic Inheritance):
--   Owner [7] >= Create [6] >= Delete [5] >= Share [4] >= Edit [3] >= Comment [1] >= View [0]
--
-- EXECUTION ORDER:
-- This file runs as #49 in the import sequence (db-import.sh).
-- It MUST run AFTER all entity tables are created and populated:
--   - entity_configuration_settings/06_entity_rbac.ddl - Creates RBAC table structure
--   - 05_employee.ddl - Creates employee data
--   - 09_role.ddl - Creates role data
--
-- ✅ Automatically executed by: ./tools/db-import.sh
-- ✅ Inserts: Role-based + employee-specific RBAC permissions
--
-- ============================================================================

-- ============================================================================
-- DATA CURATION: ROLE-BASED PERMISSIONS
-- ============================================================================

-- CEO Role - Full ownership (level 7) on ALL entities
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 7, now()  -- Level 7 = Owner
FROM app.role r
CROSS JOIN (VALUES
  ('artifact'), ('business'), ('business_hierarchy'), ('calendar'), ('cust'),
  ('employee'), ('event'), ('expense'), ('form'), ('interaction'),
  ('inventory'), ('invoice'), ('message'), ('message_schema'), ('office'),
  ('office_hierarchy'), ('order'), ('product'), ('product_hierarchy'), ('project'),
  ('quote'), ('revenue'), ('role'), ('service'),
  ('shipment'), ('task'), ('wiki'), ('workflow'), ('workflow_automation'),
  ('work_order'), ('worksite')
) AS entities(entity_type)
WHERE r.role_code = 'CEO';

-- ============================================================================
-- MANAGER ROLES - Department Leadership Permissions
-- ============================================================================
-- Department managers can create projects and tasks in their domain,
-- share resources, and edit operational entities

-- Managers - Create projects and tasks in their departments (level 6)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 6  -- Level 6 = Create
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('task'), ('work_order'), ('quote')
) AS entities(entity_type)
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Delete permissions on operational entities (level 5)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 5  -- Level 5 = Delete
FROM app.role r
CROSS JOIN (VALUES
  ('expense'), ('artifact'), ('wiki')
) AS entities(entity_type)
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Share resources and operational data (level 4)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 4  -- Level 4 = Share
FROM app.role r
CROSS JOIN (VALUES
  ('worksite'), ('cust'), ('form'), ('inventory'), ('service'), ('product')
) AS entities(entity_type)
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Edit employee records and schedules (level 3)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 3  -- Level 3 = Edit
FROM app.role r
CROSS JOIN (VALUES
  ('employee'), ('calendar'), ('event')
) AS entities(entity_type)
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - View financial data (level 0)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 0  -- Level 0 = View
FROM app.role r
CROSS JOIN (VALUES
  ('revenue'), ('invoice'), ('order')
) AS entities(entity_type)
WHERE r.role_code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- ============================================================================
-- SUPERVISOR ROLES - Field Operations Leadership
-- ============================================================================
-- Supervisors manage day-to-day field operations, can create tasks,
-- and coordinate work with customers and worksites

-- Supervisors - Create tasks and update work orders (level 6)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, 'task', '11111111-1111-1111-1111-111111111111', 6  -- Level 6 = Create
FROM app.role r
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Delete operational artifacts (level 5)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, 'artifact', '11111111-1111-1111-1111-111111111111', 5  -- Level 5 = Delete
FROM app.role r
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Share customer and worksite information (level 4)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 4  -- Level 4 = Share
FROM app.role r
CROSS JOIN (VALUES
  ('worksite'), ('cust'), ('interaction')
) AS entities(entity_type)
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Edit work orders and forms (level 3)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 3  -- Level 3 = Edit
FROM app.role r
CROSS JOIN (VALUES
  ('work_order'), ('form'), ('wiki'), ('event')
) AS entities(entity_type)
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Comment on projects (level 1)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, 'project', '11111111-1111-1111-1111-111111111111', 1  -- Level 1 = Comment
FROM app.role r
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - View inventory and products (level 0)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 0  -- Level 0 = View
FROM app.role r
CROSS JOIN (VALUES
  ('inventory'), ('product'), ('service')
) AS entities(entity_type)
WHERE r.role_code IN ('SUP-FIELD', 'TECH-SR');

-- ============================================================================
-- TECHNICIAN ROLES - Field Operations Execution
-- ============================================================================
-- Technicians execute work orders, update tasks, and interact with customers

-- Technicians - Edit tasks, forms, and work orders (level 3)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 3  -- Level 3 = Edit
FROM app.role r
CROSS JOIN (VALUES
  ('task'), ('form'), ('work_order'), ('interaction')
) AS entities(entity_type)
WHERE r.role_code IN ('TECH-FIELD');

-- Technicians - Comment on projects and artifacts (level 1)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 1  -- Level 1 = Comment
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('artifact'), ('wiki')
) AS entities(entity_type)
WHERE r.role_code IN ('TECH-FIELD');

-- Technicians - View customers, worksites, and inventory (level 0)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 0  -- Level 0 = View
FROM app.role r
CROSS JOIN (VALUES
  ('cust'), ('worksite'), ('inventory'), ('product'), ('service')
) AS entities(entity_type)
WHERE r.role_code IN ('TECH-FIELD');

-- ============================================================================
-- COORDINATOR ROLES - Administrative Support
-- ============================================================================
-- Project and HR coordinators support management with scheduling,
-- documentation, and administrative tasks

-- Coordinators - Create tasks and events (level 6)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 6  -- Level 6 = Create
FROM app.role r
CROSS JOIN (VALUES
  ('task'), ('event'), ('interaction')
) AS entities(entity_type)
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

-- Coordinators - Delete forms and artifacts (level 5)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 5  -- Level 5 = Delete
FROM app.role r
CROSS JOIN (VALUES
  ('form'), ('artifact')
) AS entities(entity_type)
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

-- Coordinators - Share projects, customers, and wikis (level 4)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 4  -- Level 4 = Share
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('cust'), ('wiki'), ('calendar')
) AS entities(entity_type)
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

-- Coordinators - Edit employees and work orders (level 3)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 3  -- Level 3 = Edit
FROM app.role r
CROSS JOIN (VALUES
  ('employee'), ('work_order')
) AS entities(entity_type)
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

-- Coordinators - View financial data (level 0)
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 0  -- Level 0 = View
FROM app.role r
CROSS JOIN (VALUES
  ('expense'), ('revenue'), ('invoice'), ('order')
) AS entities(entity_type)
WHERE r.role_code IN ('COORD-PROJ', 'COORD-HR');

-- ============================================================================
-- DATA CURATION: EMPLOYEE-SPECIFIC PERMISSIONS
-- ============================================================================
-- Direct employee permissions override role-based permissions when higher

-- CEO (James Miller) - Direct owner permissions (level 7) for ALL entities
-- This ensures James has full control even if role permissions are modified
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', e.id, entity_type, '11111111-1111-1111-1111-111111111111', 7, now()  -- Level 7 = Owner
FROM app.employee e
CROSS JOIN (VALUES
  ('artifact'), ('business'), ('business_hierarchy'), ('calendar'), ('cust'),
  ('employee'), ('event'), ('expense'), ('form'), ('interaction'),
  ('inventory'), ('invoice'), ('message'), ('message_schema'), ('office'),
  ('office_hierarchy'), ('order'), ('product'), ('product_hierarchy'), ('project'),
  ('quote'), ('revenue'), ('role'), ('service'),
  ('shipment'), ('task'), ('wiki'), ('workflow'), ('workflow_automation'),
  ('work_order'), ('worksite')
) AS entities(entity_type)
WHERE e.email = 'james.miller@huronhome.ca';

-- ============================================================================
-- INSTANCE-SPECIFIC PERMISSIONS: Project Ownership Examples
-- ============================================================================
-- Grant instance-level owner permissions on specific projects
-- This demonstrates how project managers get full control over their projects

-- Grant owner permissions to project managers on their specific projects
-- (This will be auto-created when projects are created via API with proper linkage)
-- Example: Sarah Chen owns "Downtown Condo Renovation" project
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_by__employee_id)
SELECT
  'employee',
  e.id,
  'project',
  p.id,
  7,  -- Level 7 = Owner
  (SELECT id FROM app.employee WHERE email = 'james.miller@huronhome.ca')
FROM app.employee e
CROSS JOIN app.project p
WHERE e.email = 'sarah.chen@huronhome.ca'
  AND p.code = 'PROJ-001';

-- Grant edit permissions to department managers on related business projects
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_by__employee_id)
SELECT
  'employee',
  e.id,
  'project',
  p.id,
  3,  -- Level 3 = Edit
  (SELECT id FROM app.employee WHERE email = 'james.miller@huronhome.ca')
FROM app.employee e
CROSS JOIN app.project p
WHERE e.email = 'michael.thompson@huronhome.ca'
  AND p.code IN ('PROJ-002', 'PROJ-003');

-- ============================================================================
-- FINAL COMMENT UPDATE
-- ============================================================================

COMMENT ON TABLE app.entity_rbac IS 'Person-based RBAC system with integer permission levels: 0=View, 1=Comment, 3=Edit/Contribute, 4=Share, 5=Delete, 6=Create (type-level only), 7=Owner. Higher levels automatically inherit all lower permissions via >= comparison. Supports role-based (via entity_instance_link) and direct employee permissions. Permissions resolve via UNION, taking MAX level. SEED DATA LOADED from 49_rbac_seed_data.ddl';
