-- ============================================================================
-- RBAC SEED DATA - ROLE-BASED PERMISSIONS (v2.0.0)
-- ============================================================================
--
-- ARCHITECTURE (v2.0.0 Role-Only Model):
-- Permissions are granted to ROLES only (no direct employee/person permissions).
-- Persons get permissions through role membership via entity_instance_link.
--
-- ROLE-PERSON MAPPING:
-- Roles contain persons via entity_instance_link:
--   INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
--   VALUES ('role', role.id, 'person', person.id, 'member');
--
-- PERMISSION LEVEL MODEL (0-7):
--   0 = View:       Read access to entity data
--   1 = Comment:    Add comments on entities
--   2 = Contribute: Form submission, task updates, wiki edits
--   3 = Edit:       Modify existing entity fields
--   4 = Share:      Share entity with others
--   5 = Delete:     Soft delete entity
--   6 = Create:     Create new entities (type-level only)
--   7 = Owner:      Full control including permission management
--
-- INHERITANCE MODES:
--   none:    Permission applies ONLY to the specific entity (no children inherit)
--   cascade: Same permission level applies to ALL children (recursive)
--   mapped:  Different permission levels per child entity type (via child_permissions JSONB)
--
-- EXECUTION ORDER:
-- This file runs as #49 in the import sequence (db-import.sh).
-- It MUST run AFTER:
--   - entity_configuration_settings/06_entity_rbac.ddl - Creates RBAC table structure
--   - 09_role.ddl - Creates role data
--   - 04a_person.ddl - Creates person data
--
-- ============================================================================

-- Clear existing RBAC data for clean re-import
DELETE FROM app.entity_rbac;

-- ============================================================================
-- CEO ROLE - FULL OWNERSHIP (LEVEL 7) WITH CASCADE INHERITANCE
-- ============================================================================
-- CEO role gets Owner (7) permission on ALL entities with cascade inheritance
-- This means all child entities automatically inherit Owner permission

INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny, granted_ts)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  7,  -- Owner
  'cascade',  -- All children inherit same permission
  '{}'::jsonb,
  false,
  now()
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
WHERE r.code = 'CEO';

-- ============================================================================
-- MANAGER ROLES - DEPARTMENT LEADERSHIP PERMISSIONS
-- ============================================================================
-- Department managers can create projects and tasks, with cascade inheritance
-- Child entities inherit the same permission level

-- Managers - Create projects with cascade to child entities
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'cascade',  -- Children (tasks, artifacts) inherit Create permission
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('work_order'), ('quote')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Create tasks with mapped inheritance (tasks can contain subtasks, forms)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'task',
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'mapped',  -- Different permissions for different child types
  '{"task": 6, "form": 3, "artifact": 3, "_default": 0}'::jsonb,  -- subtasks: Create, forms/artifacts: Edit
  false
FROM app.role r
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Delete permissions on operational entities
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  5,  -- Delete
  'none',  -- Delete permission doesn't cascade automatically
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('expense'), ('artifact'), ('wiki')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Share resources and operational data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'cascade',  -- Can share child entities too
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('worksite'), ('customer'), ('form'), ('inventory'), ('service'), ('product')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - Edit employee records and schedules
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',  -- No inheritance for personnel records
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('employee'), ('calendar'), ('event')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- Managers - View financial data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('revenue'), ('invoice'), ('order')
) AS entities(entity_type)
WHERE r.code IN ('DEPT-MGR', 'MGR-LAND', 'MGR-SNOW', 'MGR-HVAC', 'MGR-PLUMB', 'MGR-SOLAR');

-- ============================================================================
-- SUPERVISOR ROLES - FIELD OPERATIONS LEADERSHIP
-- ============================================================================

-- Supervisors - Create tasks
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'task',
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Delete operational artifacts
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'artifact',
  '11111111-1111-1111-1111-111111111111'::uuid,
  5,  -- Delete
  'none',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Share customer and worksite information
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('worksite'), ('customer'), ('interaction')
) AS entities(entity_type)
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Edit work orders and forms
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('work_order'), ('form'), ('wiki'), ('event')
) AS entities(entity_type)
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - Comment on projects
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  'project',
  '11111111-1111-1111-1111-111111111111'::uuid,
  1,  -- Comment
  'none',
  '{}'::jsonb,
  false
FROM app.role r
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- Supervisors - View inventory and products
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('inventory'), ('product'), ('service')
) AS entities(entity_type)
WHERE r.code IN ('SUP-FIELD', 'TECH-SR');

-- ============================================================================
-- TECHNICIAN ROLES - FIELD OPERATIONS EXECUTION
-- ============================================================================

-- Technicians - Edit tasks, forms, and work orders
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('task'), ('form'), ('work_order'), ('interaction')
) AS entities(entity_type)
WHERE r.code IN ('TECH-FIELD');

-- Technicians - Comment on projects and artifacts
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  1,  -- Comment
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('artifact'), ('wiki')
) AS entities(entity_type)
WHERE r.code IN ('TECH-FIELD');

-- Technicians - View customers, worksites, and inventory
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('customer'), ('worksite'), ('inventory'), ('product'), ('service')
) AS entities(entity_type)
WHERE r.code IN ('TECH-FIELD');

-- ============================================================================
-- COORDINATOR ROLES - ADMINISTRATIVE SUPPORT
-- ============================================================================

-- Coordinators - Create tasks and events
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('task'), ('event'), ('interaction')
) AS entities(entity_type)
WHERE r.code IN ('COORD-PROJ', 'COORD-HR');

-- Coordinators - Delete forms and artifacts
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  5,  -- Delete
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('form'), ('artifact')
) AS entities(entity_type)
WHERE r.code IN ('COORD-PROJ', 'COORD-HR');

-- Coordinators - Share projects, customers, and wikis
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  4,  -- Share
  'cascade',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('customer'), ('wiki'), ('calendar')
) AS entities(entity_type)
WHERE r.code IN ('COORD-PROJ', 'COORD-HR');

-- Coordinators - Edit employees and work orders
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  3,  -- Edit
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('employee'), ('work_order')
) AS entities(entity_type)
WHERE r.code IN ('COORD-PROJ', 'COORD-HR');

-- Coordinators - View financial data
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('expense'), ('revenue'), ('invoice'), ('order')
) AS entities(entity_type)
WHERE r.code IN ('COORD-PROJ', 'COORD-HR');

-- ============================================================================
-- CUSTOMER ROLE - LIMITED PERMISSIONS
-- ============================================================================
-- Customers get limited permissions via a CUSTOMER role (if exists)

-- Create customer role permissions (View only for their entities)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  0,  -- View
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('project'), ('task'), ('quote'), ('invoice')
) AS entities(entity_type)
WHERE r.code = 'CUSTOMER';

-- Customers can create interactions (submit forms, send messages)
INSERT INTO app.entity_rbac (role_id, entity_code, entity_instance_id, permission, inheritance_mode, child_permissions, is_deny)
SELECT
  r.id,
  entity_type,
  '11111111-1111-1111-1111-111111111111'::uuid,
  6,  -- Create
  'none',
  '{}'::jsonb,
  false
FROM app.role r
CROSS JOIN (VALUES
  ('form'), ('interaction')
) AS entities(entity_type)
WHERE r.code = 'CUSTOMER';

-- ============================================================================
-- ROLE-PERSON MEMBERSHIP LINKS
-- ============================================================================
-- Link persons to roles via entity_instance_link
-- This establishes the role membership that RBAC resolution uses

-- CEO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'CEO'
  AND p.email = 'james.miller@huronhome.ca'
  AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- COO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'COO'
  AND p.email = 'sarah.johnson@huronhome.ca'
  AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- CTO Role membership
INSERT INTO app.entity_instance_link (entity_code, entity_instance_id, child_entity_code, child_entity_instance_id, relationship_type)
SELECT 'role', r.id, 'person', p.id, 'member'
FROM app.role r, app.person p
WHERE r.code = 'CTO'
  AND p.email = 'michael.chen@huronhome.ca'
  AND p.active_flag = true
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FINAL COMMENT UPDATE
-- ============================================================================

COMMENT ON TABLE app.entity_rbac IS 'Role-based RBAC system (v2.0.0). Permissions granted to roles only via role_id FK. Persons get permissions through role membership via entity_instance_link. Inheritance modes: none, cascade, mapped. SEED DATA LOADED from 49_rbac_seed_data.ddl';
