-- ============================================================================
-- JAMES MILLER COMPREHENSIVE RBAC ACCESS - FULL SYSTEM PERMISSIONS
-- ============================================================================
--
-- Purpose: Grant James Miller (CEO) comprehensive access to ALL entities in the PMO system
-- - Self-permissions (view, edit, share) on all entity types
-- - Creation permissions from all parent entities to all child entities
-- - Complete access to all existing entity instances
--
-- Based on Analysis:
-- - Employee: James Miller (EMP-001, james.miller@huronhome.ca)
-- - 12 Entity Types: hr, biz, org, client, project, task, worksite, employee, role, wiki, form, artifact
-- - 17 Creation Relationships: All parent->child permutations from meta_entity_hierarchy_permission_mapping
-- - Full RBAC coverage across all 5 layers of the system
--
-- ============================================================================

-- ============================================================================
-- STEP 1: SELF-PERMISSIONS (VIEW, EDIT, SHARE) ON ALL ENTITY TYPES
-- ============================================================================

-- Business entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'view',
  'biz',
  biz.id,
  'biz',
  biz.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - business unit self-permissions',
  now(),
  NULL,
  true
FROM app.d_biz biz WHERE biz.active = true;

INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'edit',
  'biz',
  biz.id,
  'biz',
  biz.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - business unit edit permissions',
  now(),
  NULL,
  true
FROM app.d_biz biz WHERE biz.active = true;

INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'share',
  'biz',
  biz.id,
  'biz',
  biz.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - business unit share permissions',
  now(),
  NULL,
  true
FROM app.d_biz biz WHERE biz.active = true;

-- Project entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'view',
  'project',
  proj.id,
  'project',
  proj.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - project self-permissions',
  now(),
  NULL,
  true
FROM app.d_project proj WHERE proj.active = true;

INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'edit',
  'project',
  proj.id,
  'project',
  proj.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - project edit permissions',
  now(),
  NULL,
  true
FROM app.d_project proj WHERE proj.active = true;

INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'share',
  'project',
  proj.id,
  'project',
  proj.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - project share permissions',
  now(),
  NULL,
  true
FROM app.d_project proj WHERE proj.active = true;

-- HR entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'hr',
  hr.id,
  'hr',
  hr.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - HR ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_hr hr
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE hr.active = true;

-- Organization entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'org',
  org.id,
  'org',
  org.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - organization ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_org org
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE org.active = true;

-- Client entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'client',
  client.id,
  'client',
  client.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - client ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_client client
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE client.active = true;

-- Worksite entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'worksite',
  worksite.id,
  'worksite',
  worksite.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - worksite ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_worksite worksite
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE worksite.active = true;

-- Employee entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'employee',
  emp.id,
  'employee',
  emp.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - employee ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_employee emp
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE emp.active = true;

-- Role entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'role',
  role.id,
  'role',
  role.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - role ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_role role
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE role.active = true;

-- Content entities self-permissions (wiki, form, artifact)
-- Note: These will get created with CREATE permissions below for content that doesn't exist yet

-- ============================================================================
-- STEP 2: CREATION PERMISSIONS - ALL PARENT → CHILD RELATIONSHIPS
-- ============================================================================

-- Business → (wiki, form, task, project, artifact) creation permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'biz',
  biz.id,
  child_entity.entity_type,
  gen_random_uuid(), -- Placeholder UUID for future entities to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - business unit can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_biz biz
CROSS JOIN (VALUES ('wiki'), ('form'), ('task'), ('project'), ('artifact')) AS child_entity(entity_type)
WHERE biz.active = true;

-- Business → Business (sub-business unit creation)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'biz',
  biz.id,
  'biz',
  gen_random_uuid(), -- Placeholder for sub-business units to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - business unit can create sub-business units',
  now(),
  NULL,
  true
FROM app.d_biz biz
WHERE biz.active = true;

-- Project → (wiki, form, task, artifact) creation permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'project',
  proj.id,
  child_entity.entity_type,
  gen_random_uuid(), -- Placeholder UUID for future entities to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - project can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_project proj
CROSS JOIN (VALUES ('wiki'), ('form'), ('task'), ('artifact')) AS child_entity(entity_type)
WHERE proj.active = true;

-- Project → Project (sub-project creation)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'project',
  proj.id,
  'project',
  gen_random_uuid(), -- Placeholder for sub-projects to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - project can create sub-projects',
  now(),
  NULL,
  true
FROM app.d_project proj
WHERE proj.active = true;

-- HR → (employee, role) creation permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'hr',
  hr.id,
  child_entity.entity_type,
  gen_random_uuid(), -- Placeholder UUID for future entities to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - HR can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_hr hr
CROSS JOIN (VALUES ('employee'), ('role')) AS child_entity(entity_type)
WHERE hr.active = true;

-- Organization → (worksite, employee) creation permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'org',
  org.id,
  child_entity.entity_type,
  gen_random_uuid(), -- Placeholder UUID for future entities to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - organization can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_org org
CROSS JOIN (VALUES ('worksite'), ('employee')) AS child_entity(entity_type)
WHERE org.active = true;

-- Organization → Organization (sub-organization creation)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'org',
  org.id,
  'org',
  gen_random_uuid(), -- Placeholder for sub-organizations to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - organization can create sub-organizations',
  now(),
  NULL,
  true
FROM app.d_org org
WHERE org.active = true;

-- Client → (project, task) creation permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'client',
  client.id,
  child_entity.entity_type,
  gen_random_uuid(), -- Placeholder UUID for future entities to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - client can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_client client
CROSS JOIN (VALUES ('project'), ('task')) AS child_entity(entity_type)
WHERE client.active = true;

-- Worksite → (task, form) creation permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'worksite',
  worksite.id,
  child_entity.entity_type,
  gen_random_uuid(), -- Placeholder UUID for future entities to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - worksite can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_worksite worksite
CROSS JOIN (VALUES ('task'), ('form')) AS child_entity(entity_type)
WHERE worksite.active = true;

-- Role → employee creation permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'role',
  role.id,
  'employee',
  gen_random_uuid(), -- Placeholder UUID for future employee assignments
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - role can create employee assignments',
  now(),
  NULL,
  true
FROM app.d_role role
WHERE role.active = true;

-- ============================================================================
-- STEP 3: CONTENT ENTITIES ACCESS (for existing content)
-- ============================================================================

-- Wiki self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'wiki',
  wiki.id,
  'wiki',
  wiki.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - wiki ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_wiki wiki
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE wiki.active = true;

-- Artifact self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'artifact',
  artifact.id,
  'artifact',
  artifact.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - artifact ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_artifact artifact
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE artifact.active = true;

-- ============================================================================
-- STEP 4: TASK ENTITIES ACCESS (if task table exists)
-- ============================================================================

-- Task self-permissions (if task table exists - may be in ops_task_head)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'task',
  task.id,
  'task',
  task.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - task ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.ops_task_head task
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE task.active = true;

-- Task → (form, artifact) creation permissions (tasks as parent entities)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'task',
  task.id,
  child_entity.entity_type,
  gen_random_uuid(), -- Placeholder UUID for future entities to be created
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - task can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.ops_task_head task
CROSS JOIN (VALUES ('form'), ('artifact')) AS child_entity(entity_type)
WHERE task.active = true;

-- ============================================================================
-- STEP 5: FORM ENTITIES ACCESS (if form table exists)
-- ============================================================================

-- Form self-permissions (if form table exists - may be in ops_formlog_head)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'form',
  form.id,
  'form',
  form.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - form ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.ops_formlog_head form
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE form.active = true;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count total permissions granted to James Miller
SELECT
  permission_action,
  parent_entity,
  action_entity,
  count(*) as permission_count
FROM app.rel_employee_entity_action_rbac
WHERE employee_id = (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
  AND active = true
GROUP BY permission_action, parent_entity, action_entity
ORDER BY parent_entity, action_entity, permission_action;

-- Verify creation permissions matrix for James Miller
SELECT DISTINCT
  parent_entity || ' → ' || action_entity as creation_relationship,
  count(*) as instances_granted
FROM app.rel_employee_entity_action_rbac
WHERE employee_id = (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
  AND permission_action = 'create'
  AND active = true
GROUP BY parent_entity, action_entity
ORDER BY parent_entity, action_entity;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- James Miller now has:
-- 1. Self-permissions (view, edit, share) on ALL entity instances of ALL entity types
-- 2. Creation permissions from ALL parent entities to ALL possible child entities
-- 3. Complete coverage across all 12 entity types in the PMO system
-- 4. Full RBAC compliance with the 5-layer architecture
--
-- This provides comprehensive CEO-level access to create, view, edit, and share
-- any entity anywhere in the system, matching the request for "any entity inside
-- any parent entity" creation capabilities.
-- ============================================================================