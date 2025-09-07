-- ============================================================================
-- EMPLOYEE ENTITY ACTION ROLE-BASED ACCESS CONTROL (RBAC) TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Denormalized role-based access control table that grants specific employees
--   permissions on specific entity instances. This table is built on top of the
--   meta_entity_hierarchy_permission_mapping table which defines the generic permission possibilities.
--   While meta_entity_hierarchy_permission_mapping defines "what CAN be done", this table defines
--   "who CAN DO what on which specific entities".
--
-- DDL Structure:
--   - employee_id: References app.d_employee(id) for the user being granted permissions
--   - permission_action: The specific permission granted ('create', 'view', 'edit', 'share')
--   - parent_entity: Entity type that provides the scope (from meta_entity_types.entity_type_code)
--   - parent_entity_id: Specific instance UUID of the parent entity
--   - action_entity: Entity type that the permission applies to (from meta_entity_types.entity_type_code)
--   - action_entity_id: Specific instance UUID of the target entity
--   - Permission metadata: granted_by, grant_reason, expiry_date, emergency_revoked
--   - Temporal tracking: from_ts, to_ts, active for SCD Type 2 history
--
-- Table Relationships & Integration:
--   - FOUNDATION: Uses parent_entity/action_entity values from meta_entity_types for validation
--   - PERMISSION VALIDATION: Must reference valid permission combinations from meta_entity_hierarchy_permission_mapping
--   - INSTANCE VALIDATION: Must reference valid entity relationships from entity_id_hierarchy_mapping  
--   - HIERARCHY COMPLIANCE: Entity relationships must conform to rules defined in meta_entity_hierarchy
--   - SPECIFIC GRANTS: Provides the \"who\" and \"which specific entities\" on top of the \"what's possible\" rules
--   - ACCESS CONTROL: Final enforcement layer that determines actual user permissions on specific entity instances
--
-- Permission Types (from meta_entity_hierarchy_permission_mapping):
--   - create: Generate new entities within parent entity scope
--   - view: Read access to entity data within scope
--   - edit: Modify access to entity properties within scope
--   - share: Permission to grant access to other users within scope
--
-- Target Entity Types (from meta_entity_types):
--   - biz, hr, org, project, task, worksite, client, employee, artifact, wiki, form, role
--
-- Security Model:
--   - Explicit permissions only (no implicit inheritance)
--   - All permissions must be valid per meta_entity_hierarchy_permission_mapping rules
--   - All entity relationships must be valid per entity_id_hierarchy_mapping rules
--   - Scoped permissions: parent_entity_id defines the permission scope
--   - Temporal permission tracking for audit trails
--   - Support for emergency access revocation

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_employee_entity_action_rbac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Employee identification
  employee_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  
  -- Permission specification (must match meta_entity_hierarchy_permission_mapping)
  permission_action text NOT NULL,
  
  -- Parent entity scope (defines the permission boundary)
  parent_entity text NOT NULL,
  parent_entity_id uuid NOT NULL,
  
  -- Target/Action entity (what the permission applies to)
  action_entity text NOT NULL,
  action_entity_id uuid NOT NULL,
  
  -- Permission metadata
  granted_by_employee_id uuid REFERENCES app.d_employee(id),
  grant_reason text,
  expiry_date timestamptz,
  emergency_revoked boolean DEFAULT false,
  revoked_reason text,
  
  -- Temporal tracking (SCD Type 2)
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  -- Note: Complex validation constraints with subqueries removed due to PostgreSQL limitations
  -- These validations should be implemented in application logic or triggers:
  -- 1. Ensure permissions exist in meta_entity_hierarchy_permission_mapping
  -- 2. Ensure entity relationships exist in entity_id_hierarchy_mapping
  
  CONSTRAINT valid_parent_entity CHECK (parent_entity IN ('biz', 'project', 'hr', 'worksite', 'client', 'org', 'role', 'employee', 'wiki', 'form', 'task', 'artifact')),
  CONSTRAINT valid_action_entity CHECK (action_entity IN ('biz', 'project', 'hr', 'worksite', 'client', 'org', 'role', 'employee', 'wiki', 'form', 'task', 'artifact')),
  CONSTRAINT valid_permission_action CHECK (permission_action IN ('create', 'view', 'edit', 'share'))
);


-- ============================================================================
-- HELPER VIEWS:
-- ============================================================================

-- Active permissions view (excludes expired and revoked)
CREATE VIEW app.v_active_employee_permissions AS
SELECT 
  rbac.*,
  emp.name AS employee_name,
  emp.email AS employee_email,
  granter.name AS granted_by_name,
  mehpm.name AS permission_rule_name,
  mehpm."descr" AS permission_rule_description
FROM app.rel_employee_entity_action_rbac rbac
JOIN app.d_employee emp ON rbac.employee_id = emp.id
LEFT JOIN app.d_employee granter ON rbac.granted_by_employee_id = granter.id
JOIN app.meta_entity_hierarchy_permission_mapping mehpm ON (
  mehpm.parent_entity = rbac.parent_entity 
  AND mehpm.action_entity = rbac.action_entity 
  AND mehpm.permission_action = rbac.permission_action
  AND mehpm.active = true
)
WHERE rbac.active = true
  AND rbac.emergency_revoked = false
  AND (rbac.expiry_date IS NULL OR rbac.expiry_date > now())
  AND (rbac.to_ts IS NULL OR rbac.to_ts > now())
  AND emp.active = true;

-- Permission summary by employee
CREATE VIEW app.v_employee_permission_summary AS
SELECT 
  employee_id,
  emp.name AS employee_name,
  emp.email AS employee_email,
  parent_entity,
  action_entity,
  array_agg(DISTINCT permission_action ORDER BY permission_action) AS permissions,
  count(*) AS permission_count
FROM app.v_active_employee_permissions rbac
JOIN app.d_employee emp ON rbac.employee_id = emp.id
GROUP BY employee_id, emp.name, emp.email, parent_entity, action_entity;

-- Permissions by entity scope view
CREATE VIEW app.v_entity_scoped_permissions AS
SELECT 
  rbac.parent_entity,
  rbac.parent_entity_id,
  rbac.action_entity,
  rbac.action_entity_id,
  rbac.permission_action,
  array_agg(DISTINCT emp.name ORDER BY emp.name) AS employees_with_access,
  count(DISTINCT rbac.employee_id) AS employee_count
FROM app.v_active_employee_permissions rbac
JOIN app.d_employee emp ON rbac.employee_id = emp.id
GROUP BY rbac.parent_entity, rbac.parent_entity_id, rbac.action_entity, rbac.action_entity_id, rbac.permission_action;

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- DEFERRED: Sample RBAC data insertion postponed due to missing entity tables
-- TODO: Enable comprehensive RBAC permissions after all entity tables (d_wiki, ops_formlog_head, ops_task_head) are created
-- The following would insert comprehensive permissions for CEO James Miller:
-- - Full self-permissions on all entity types (view, edit, share)
-- - Creation permissions from parent entities to child entities per meta_entity_hierarchy_permission_mapping

-- Sample data insertions commented out - enable after all dependent tables are created

-- CEO James Miller: Full access to all business units (self-permissions)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'biz', biz.id, 'biz', biz.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO - Full business unit self-permissions'
FROM app.d_biz biz
WHERE biz.active = true;

-- CEO James Miller: Creation permissions from all business units to all child entities
-- DEFERRED: References non-existent tables (d_wiki, ops_formlog_head, ops_task_head)
-- TODO: Enable after all entity tables are created
-- INSERT INTO app.rel_employee_entity_action_rbac (
--   employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
--   granted_by_employee_id, grant_reason
-- ) ... (complex query with multiple LEFT JOINs to non-existent tables)

-- CEO James Miller: Full access to all projects (self-permissions) 
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'project', proj.id, 'project', proj.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO - Full project self-permissions'
FROM app.d_project proj
WHERE proj.active = true;

-- CEO James Miller: Creation permissions from all projects to all child entities
-- DEFERRED: Complex query with table dependencies - enable after all tables exist
/*
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'project', proj.id,
  mapping.action_entity,
  CASE 
    WHEN mapping.action_entity = 'wiki' THEN wiki.id
    WHEN mapping.action_entity = 'form' THEN form_head.id
    WHEN mapping.action_entity = 'task' THEN task.id
    WHEN mapping.action_entity = 'artifact' THEN artifact.id
    WHEN mapping.action_entity = 'project' AND sub_proj.id IS NOT NULL THEN sub_proj.id
  END,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO - Project creation permissions for ' || mapping.action_entity
FROM app.d_project proj
CROSS JOIN (
  SELECT DISTINCT parent_entity, action_entity
  FROM app.meta_entity_hierarchy_permission_mapping 
  WHERE parent_entity = 'project' AND permission_action = 'create' AND active = true
) mapping
LEFT JOIN app.d_wiki wiki ON mapping.action_entity = 'wiki' AND wiki.project_id = proj.id AND wiki.active = true
LEFT JOIN app.ops_formlog_head form_head ON mapping.action_entity = 'form' AND form_head.project_id = proj.id AND form_head.active = true
LEFT JOIN app.ops_task_head task ON mapping.action_entity = 'task' AND task.project_id = proj.id AND task.active = true
LEFT JOIN app.d_artifact artifact ON mapping.action_entity = 'artifact' AND artifact.project_id = proj.id AND artifact.active = true
LEFT JOIN app.d_project sub_proj ON mapping.action_entity = 'project' AND sub_proj.id != proj.id AND sub_proj.active = true
WHERE proj.active = true
  AND (wiki.id IS NOT NULL OR form_head.id IS NOT NULL OR task.id IS NOT NULL OR artifact.id IS NOT NULL OR sub_proj.id IS NOT NULL);
*/

-- CEO James Miller: Full access to all employees (self-permissions)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'employee', emp.id, 'employee', emp.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO - Full employee management permissions'
FROM app.d_employee emp
WHERE emp.active = true;

-- CEO James Miller: Full access to all roles (self-permissions)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'role', role.id, 'role', role.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO - Full role management permissions'
FROM app.d_role role
WHERE role.active = true;

-- CEO James Miller: Full access to all clients (self-permissions)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'client', client.id, 'client', client.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO - Full client management permissions'
FROM app.d_client client
WHERE client.active = true;

-- CEO James Miller: Creation permissions from clients to projects/tasks
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'create',
  'client', client.id,
  mapping.action_entity,
  proj.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO - Client creation permissions for ' || mapping.action_entity
FROM app.d_client client
CROSS JOIN (
  SELECT DISTINCT parent_entity, action_entity
  FROM app.meta_entity_hierarchy_permission_mapping 
  WHERE parent_entity = 'client' AND permission_action = 'create' AND active = true
) mapping
LEFT JOIN app.d_project proj ON mapping.action_entity = 'project' AND proj.clients ? client.id::text AND proj.active = true
WHERE client.active = true
  AND mapping.action_entity = 'project' AND proj.id IS NOT NULL;

-- Additional comprehensive permissions for James Miller on all content entities
-- TODO: Wiki permissions (self-permissions) - uncomment when d_wiki table is created
-- INSERT INTO app.rel_employee_entity_action_rbac (
--   employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
--   granted_by_employee_id, grant_reason
-- )
-- SELECT 
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
--   'wiki', wiki.id, 'wiki', wiki.id,
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   'CEO - Full wiki content management permissions'
-- FROM app.d_wiki wiki
-- WHERE wiki.active = true;

-- TODO: Form permissions (self-permissions) - uncomment when ops_formlog_head table is created
-- INSERT INTO app.rel_employee_entity_action_rbac (
--   employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
--   granted_by_employee_id, grant_reason
-- )
-- SELECT 
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
--   'form', form_head.id, 'form', form_head.id,
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   'CEO - Full form management permissions'
-- FROM app.ops_formlog_head form_head
-- WHERE form_head.active = true;

-- TODO: Task permissions (self-permissions) - uncomment when ops_task_head table is created
-- INSERT INTO app.rel_employee_entity_action_rbac (
--   employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
--   granted_by_employee_id, grant_reason
-- )
-- SELECT 
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
--   'task', task.id, 'task', task.id,
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   'CEO - Full task management permissions'
-- FROM app.ops_task_head task
-- WHERE task.active = true;

-- Artifact permissions (self-permissions)
INSERT INTO app.rel_employee_entity_action_rbac (
  employee_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
  granted_by_employee_id, grant_reason
)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
  'artifact', artifact.id, 'artifact', artifact.id,
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'CEO - Full artifact management permissions'
FROM app.d_artifact artifact
WHERE artifact.active = true;

-- End of deferred RBAC data insertions