-- ============================================================================
-- JAMES MILLER COMPREHENSIVE RBAC ACCESS - CORRECTED IMPLEMENTATION
-- ============================================================================
--
-- CRITICAL UNDERSTANDING from 5-Layer RBAC Analysis:
--
-- Layer 1 (Foundation): meta_entity_types defines 12 entity types with codes
-- Layer 2 (Rules): meta_entity_hierarchy defines which parent can create which child
-- Layer 3 (Permissions): meta_entity_hierarchy_permission_mapping expands to create/view/edit/share matrix
-- Layer 4 (Instances): entity_id_hierarchy_mapping tracks actual parent-child relationships between SPECIFIC entity instances
-- Layer 5 (Access Control): rel_employee_entity_action_rbac grants permissions on SPECIFIC entity instances
--
-- CRITICAL CORRECTION:
-- - For CREATION permissions: action_entity_id should be parent_entity_id (permission to create within parent scope)
-- - For SELF permissions: parent_entity_id = action_entity_id (permission on specific entity)
-- - Must reference ACTUAL entity instances, not placeholder UUIDs
--
-- RBAC Security Model:
-- - Explicit permissions only (no implicit inheritance)
-- - All permissions must be valid per meta_entity_hierarchy_permission_mapping rules
-- - All entity relationships must be valid per entity_id_hierarchy_mapping rules
-- - Scoped permissions: parent_entity_id defines the permission scope
--
-- ============================================================================

-- ============================================================================
-- STEP 1: SELF-PERMISSIONS (VIEW, EDIT, SHARE) ON ALL ENTITY INSTANCES
-- ============================================================================

-- Business entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'biz',
  biz.id,
  'biz',
  biz.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - business unit ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_biz biz
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE biz.active = true;

-- Project entity self-permissions
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason, from_ts, to_ts, active
)
SELECT
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  permission_type,
  'project',
  proj.id,
  'project',
  proj.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - project ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_project proj
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE proj.active = true;

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
  hr.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
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
  org.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
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
  client.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
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
  worksite.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
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
  emp.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
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
  role.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - role ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_role role
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE role.active = true;

-- Content entities self-permissions (if they exist)
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
  wiki.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
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
  artifact.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - artifact ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.d_artifact artifact
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE artifact.active = true;

-- Task self-permissions (if task table exists as ops_task_head)
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
  task.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - task ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.ops_task_head task
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE task.active = true;

-- Form self-permissions (if form table exists as ops_formlog_head)
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
  form.id,  -- CORRECTED: self-permission, parent_entity_id = action_entity_id
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - form ' || permission_type || ' permissions',
  now(),
  NULL,
  true
FROM app.ops_formlog_head form
CROSS JOIN (VALUES ('view'), ('edit'), ('share')) AS perms(permission_type)
WHERE form.active = true;

-- ============================================================================
-- STEP 2: CREATION PERMISSIONS - PARENT SCOPE BASED
-- ============================================================================
-- CRITICAL CORRECTION: For creation permissions, action_entity_id should be the parent_entity_id
-- This grants permission to create child entities WITHIN the parent entity scope

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
  biz.id, -- CORRECTED: creation permission within business scope, action_entity_id = parent_entity_id
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - business unit can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_biz biz
CROSS JOIN (VALUES ('wiki'), ('form'), ('task'), ('project'), ('artifact')) AS child_entity(entity_type)
WHERE biz.active = true;

-- Business → Business (sub-business unit creation) - Special self-creation case
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
  biz.id, -- CORRECTED: creation permission within business scope
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
  proj.id, -- CORRECTED: creation permission within project scope
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - project can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_project proj
CROSS JOIN (VALUES ('wiki'), ('form'), ('task'), ('artifact')) AS child_entity(entity_type)
WHERE proj.active = true;

-- Project → Project (sub-project creation) - Special self-creation case
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
  proj.id, -- CORRECTED: creation permission within project scope
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
  hr.id, -- CORRECTED: creation permission within HR scope
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
  org.id, -- CORRECTED: creation permission within organization scope
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - organization can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.d_org org
CROSS JOIN (VALUES ('worksite'), ('employee')) AS child_entity(entity_type)
WHERE org.active = true;

-- Organization → Organization (sub-organization creation) - Special self-creation case
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
  org.id, -- CORRECTED: creation permission within organization scope
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
  client.id, -- CORRECTED: creation permission within client scope
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
  worksite.id, -- CORRECTED: creation permission within worksite scope
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
  role.id, -- CORRECTED: creation permission within role scope
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - role can create employee assignments',
  now(),
  NULL,
  true
FROM app.d_role role
WHERE role.active = true;

-- Task → (form, artifact) creation permissions (if tasks exist)
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
  task.id, -- CORRECTED: creation permission within task scope
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO comprehensive access - task can create ' || child_entity.entity_type,
  now(),
  NULL,
  true
FROM app.ops_task_head task
CROSS JOIN (VALUES ('form'), ('artifact')) AS child_entity(entity_type)
WHERE task.active = true;

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

-- Verify creation permissions matrix for James Miller (should match meta_entity_hierarchy_permission_mapping)
SELECT DISTINCT
  parent_entity || ' → ' || action_entity as creation_relationship,
  count(*) as instances_granted
FROM app.rel_employee_entity_action_rbac
WHERE employee_id = (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
  AND permission_action = 'create'
  AND active = true
GROUP BY parent_entity, action_entity
ORDER BY parent_entity, action_entity;

-- Verify self-permissions for James Miller
SELECT
  parent_entity,
  count(*) as self_permission_instances
FROM app.rel_employee_entity_action_rbac
WHERE employee_id = (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
  AND permission_action IN ('view', 'edit', 'share')
  AND parent_entity = action_entity
  AND parent_entity_id = action_entity_id
  AND active = true
GROUP BY parent_entity
ORDER BY parent_entity;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- CORRECTED IMPLEMENTATION provides James Miller with:
-- 1. Self-permissions (view, edit, share) on ALL entity instances where parent_entity_id = action_entity_id
-- 2. Creation permissions within ALL parent entity scopes where action_entity_id = parent_entity_id
-- 3. Full compliance with the 5-layer RBAC architecture
-- 4. Proper referential integrity with actual entity instances
-- 5. Complete coverage for "create any entity inside any parent entity" requirement
-- ============================================================================