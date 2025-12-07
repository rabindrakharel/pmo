-- ============================================================================
-- RBAC SEED DATA - ROLE AND PERSON PERMISSIONS
-- ============================================================================
--
-- ARCHITECTURE (Person-Based RBAC):
-- Auth is centralized in app.person table. RBAC permissions reference:
--   - person.id for employee/customer permissions (via person_code='employee'/'customer')
--   - role.id for role permissions (via person_code='role')
--
-- PERMISSION RESOLUTION FLOW:
-- 1. JWT subject = person.id
-- 2. Check direct permissions: person_code IN ('employee','customer'), person_id=person.id
-- 3. Check role permissions: Find roles via entity_instance_link(role->employee.id)
-- 4. Take MAX permission level
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
--   - 04a_person.ddl - Creates person data (auth hub)
--   - 05_employee.ddl - Creates employee data with person_id link
--   - 09_role.ddl - Creates role data
--
-- ============================================================================

-- ============================================================================
-- DATA CURATION: ROLE-BASED PERMISSIONS
-- ============================================================================
-- Role permissions apply to all employees assigned to those roles
-- via entity_instance_link (entity_code='role', child_entity_code='employee')

-- CEO Role - Full ownership (level 7) on ALL entities
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'role', r.id, entity_type, '11111111-1111-1111-1111-111111111111', 7, now()  -- Level 7 = Owner
FROM app.role r
CROSS JOIN (VALUES
  ('artifact'), ('business'), ('business_hierarchy'), ('calendar'), ('customer'),
  ('employee'), ('event'), ('expense'), ('form'), ('interaction'),
  ('inventory'), ('invoice'), ('message'), ('message_schema'), ('office'),
  ('office_hierarchy'), ('order'), ('product'), ('product_hierarchy'), ('project'),
  ('quote'), ('revenue'), ('role'), ('service'),
  ('shipment'), ('task'), ('wiki'), ('workflow'), ('workflow_automation'),
  ('work_order'), ('worksite'), ('person')
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
  ('worksite'), ('customer'), ('form'), ('inventory'), ('service'), ('product')
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
  ('worksite'), ('customer'), ('interaction')
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
  ('customer'), ('worksite'), ('inventory'), ('product'), ('service')
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
  ('project'), ('customer'), ('wiki'), ('calendar')
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
-- DATA CURATION: PERSON-BASED (EMPLOYEE) DIRECT PERMISSIONS
-- ============================================================================
-- Direct permissions use person.id (the auth hub ID) for employee permissions.
-- This ensures JWT subject (person.id) aligns with RBAC lookups.

-- CEO (James Miller) - Direct owner permissions (level 7) for ALL entities
-- Uses person.id to align with JWT subject
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', p.id, entity_type, '11111111-1111-1111-1111-111111111111', 7, now()  -- Level 7 = Owner
FROM app.person p
CROSS JOIN (VALUES
  ('artifact'), ('business'), ('business_hierarchy'), ('calendar'), ('customer'),
  ('employee'), ('event'), ('expense'), ('form'), ('interaction'),
  ('inventory'), ('invoice'), ('message'), ('message_schema'), ('office'),
  ('office_hierarchy'), ('order'), ('product'), ('product_hierarchy'), ('project'),
  ('quote'), ('revenue'), ('role'), ('service'),
  ('shipment'), ('task'), ('wiki'), ('workflow'), ('workflow_automation'),
  ('work_order'), ('worksite'), ('person')
) AS entities(entity_type)
WHERE p.email = 'james.miller@huronhome.ca'
  AND p.active_flag = true;

-- C-Suite (COO, CTO) - Owner permissions on key operational/technical entities
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', p.id, entity_type, '11111111-1111-1111-1111-111111111111', 7, now()  -- Level 7 = Owner
FROM app.person p
CROSS JOIN (VALUES
  ('project'), ('task'), ('work_order'), ('employee'), ('calendar'),
  ('event'), ('form'), ('wiki'), ('artifact')
) AS entities(entity_type)
WHERE p.email IN ('sarah.johnson@huronhome.ca', 'michael.chen@huronhome.ca')
  AND p.active_flag = true;

-- VP Sales - Create and manage customer-related entities
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', p.id, entity_type, '11111111-1111-1111-1111-111111111111', 6, now()  -- Level 6 = Create
FROM app.person p
CROSS JOIN (VALUES
  ('customer'), ('quote'), ('interaction'), ('project')
) AS entities(entity_type)
WHERE p.email = 'lisa.rodriguez@huronhome.ca'
  AND p.active_flag = true;

-- Senior Project Manager - Create and manage projects
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'employee', p.id, entity_type, '11111111-1111-1111-1111-111111111111', 6, now()  -- Level 6 = Create
FROM app.person p
CROSS JOIN (VALUES
  ('project'), ('task'), ('work_order'), ('form')
) AS entities(entity_type)
WHERE p.email = 'david.thompson@huronhome.ca'
  AND p.active_flag = true;

-- ============================================================================
-- DATA CURATION: CUSTOMER PERMISSIONS
-- ============================================================================
-- Customers get limited permissions to view their own projects and submit forms

-- All customers - View projects, tasks, quotes linked to them
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'customer', p.id, entity_type, '11111111-1111-1111-1111-111111111111', 0, now()  -- Level 0 = View
FROM app.person p
CROSS JOIN (VALUES
  ('project'), ('task'), ('quote'), ('invoice')
) AS entities(entity_type)
WHERE p.entity_code = 'customer'
  AND p.active_flag = true;

-- All customers - Submit forms and create interactions
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission, granted_ts)
SELECT
  'customer', p.id, entity_type, '11111111-1111-1111-1111-111111111111', 6, now()  -- Level 6 = Create
FROM app.person p
CROSS JOIN (VALUES
  ('form'), ('interaction')
) AS entities(entity_type)
WHERE p.entity_code = 'customer'
  AND p.active_flag = true;

-- ============================================================================
-- FINAL COMMENT UPDATE
-- ============================================================================

COMMENT ON TABLE app.entity_rbac IS 'Person-based RBAC system with integer permission levels: 0=View, 1=Comment, 3=Edit/Contribute, 4=Share, 5=Delete, 6=Create (type-level only), 7=Owner. Higher levels automatically inherit all lower permissions via >= comparison. person_id references app.person.id for employees/customers, and app.role.id for role-based permissions. SEED DATA LOADED from 49_rbac_seed_data.ddl';
