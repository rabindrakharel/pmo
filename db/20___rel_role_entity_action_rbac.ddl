-- ============================================================================
-- ROLE ENTITY ACTION ROLE-BASED ACCESS CONTROL (RBAC) TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Role-based access control table that grants specific roles permissions on 
--   specific entity instances. This table works alongside rel_employee_entity_action_rbac
--   to provide role-level permission templates that can be applied to employees.
--   While employee RBAC defines "who CAN DO what on which entities", this table defines
--   "what ROLES CAN DO what on which entities".
--
-- DDL Structure:
--   - role_id: References app.d_role(id) for the role being granted permissions
--   - permission_action: The specific permission granted ('create', 'view', 'edit', 'share')
--   - parent_entity: Entity type that provides the scope (from meta_entity_types.entity_type_code)
--   - parent_entity_id: Specific instance UUID of the parent entity
--   - action_entity: Entity type that the permission applies to (from meta_entity_types.entity_type_code)
--   - action_entity_id: Specific instance UUID of the target entity
--   - Permission metadata: granted_by, grant_reason, expiry_date, emergency_revoked
--   - Temporal tracking: from_ts, to_ts, active for SCD Type 2 history
--
-- Role-Based Permission Templates:
--   This table enables role-based permission management where roles define permission
--   templates that can be inherited by employees assigned to those roles. This provides
--   a more scalable approach to permission management than individual employee grants.
--
-- Table Relationships & Integration:
--   - FOUNDATION: Uses parent_entity/action_entity values from meta_entity_types for validation
--   - PERMISSION VALIDATION: Must reference valid permission combinations from meta_entity_hierarchy_permission_mapping
--   - INSTANCE VALIDATION: Must reference valid entity relationships from entity_id_hierarchy_mapping  
--   - HIERARCHY COMPLIANCE: Entity relationships must conform to rules defined in meta_entity_hierarchy
--   - ROLE REFERENCE: Links to d_role table for role-based permission templates
--   - EMPLOYEE INHERITANCE: Employees assigned to roles can inherit these permissions
--   - ACCESS CONTROL: Provides role-level enforcement layer for permissions on specific entity instances
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
--   - Role-based permission templates (not individual grants)
--   - All permissions must be valid per meta_entity_hierarchy_permission_mapping rules
--   - All entity relationships must be valid per entity_id_hierarchy_mapping rules
--   - Scoped permissions: parent_entity_id defines the permission scope
--   - Temporal permission tracking for audit trails
--   - Support for emergency access revocation
--   - Role inheritance through employee-role assignments

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_role_entity_action_rbac (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Role identification
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  
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

-- Active role permissions view (excludes expired and revoked)
CREATE VIEW app.v_active_role_permissions AS
SELECT 
  rbac.*,
  role.name AS role_name,
  role.descr AS role_description,
  granter.name AS granted_by_name,
  mehpm.name AS permission_rule_name,
  mehpm."descr" AS permission_rule_description
FROM app.rel_role_entity_action_rbac rbac
JOIN app.d_role role ON rbac.role_id = role.id
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
  AND role.active = true;

-- Permission summary by role
CREATE VIEW app.v_role_permission_summary AS
SELECT 
  role_id,
  role.name AS role_name,
  role.descr AS role_description,
  parent_entity,
  action_entity,
  array_agg(DISTINCT permission_action ORDER BY permission_action) AS permissions,
  count(*) AS permission_count
FROM app.v_active_role_permissions rbac
JOIN app.d_role role ON rbac.role_id = role.id
GROUP BY role_id, role.name, role.descr, parent_entity, action_entity;

-- Permissions by entity scope for roles
CREATE VIEW app.v_role_entity_scoped_permissions AS
SELECT 
  rbac.parent_entity,
  rbac.parent_entity_id,
  rbac.action_entity,
  rbac.action_entity_id,
  rbac.permission_action,
  array_agg(DISTINCT role.name ORDER BY role.name) AS roles_with_access,
  count(DISTINCT rbac.role_id) AS role_count
FROM app.v_active_role_permissions rbac
JOIN app.d_role role ON rbac.role_id = role.id
GROUP BY rbac.parent_entity, rbac.parent_entity_id, rbac.action_entity, rbac.action_entity_id, rbac.permission_action;

-- Combined employee and role permissions view
CREATE VIEW app.v_effective_permissions AS
SELECT 
  'employee' AS permission_source,
  emp.id AS subject_id,
  emp.name AS subject_name,
  emp.email AS subject_identifier,
  rbac.parent_entity,
  rbac.parent_entity_id,
  rbac.action_entity,
  rbac.action_entity_id,
  rbac.permission_action,
  rbac.active,
  rbac.emergency_revoked,
  rbac.expiry_date
FROM app.rel_employee_entity_action_rbac rbac
JOIN app.d_employee emp ON rbac.employee_id = emp.id
WHERE rbac.active = true
  AND rbac.emergency_revoked = false
  AND (rbac.expiry_date IS NULL OR rbac.expiry_date > now())

UNION ALL

SELECT 
  'role' AS permission_source,
  role.id AS subject_id,
  role.name AS subject_name,
  role.name AS subject_identifier,
  rbac.parent_entity,
  rbac.parent_entity_id,
  rbac.action_entity,
  rbac.action_entity_id,
  rbac.permission_action,
  rbac.active,
  rbac.emergency_revoked,
  rbac.expiry_date
FROM app.rel_role_entity_action_rbac rbac
JOIN app.d_role role ON rbac.role_id = role.id
WHERE rbac.active = true
  AND rbac.emergency_revoked = false
  AND (rbac.expiry_date IS NULL OR rbac.expiry_date > now());

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Sample role-based RBAC permissions for Huron Home Services
-- These would typically be populated by application logic or administrative processes

-- Example: Grant comprehensive business unit permissions to Business Manager role
-- INSERT INTO app.rel_role_entity_action_rbac (
--   role_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
--   granted_by_employee_id, grant_reason
-- )
-- SELECT 
--   (SELECT id FROM app.d_role WHERE name = 'Business Manager'),
--   unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
--   'biz', biz.id, 'biz', biz.id,
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   'Business Manager - Standard business unit self-permissions'
-- FROM app.d_biz biz
-- WHERE biz.active = true;

-- Example: Grant project creation permissions to Business Manager role
-- INSERT INTO app.rel_role_entity_action_rbac (
--   role_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
--   granted_by_employee_id, grant_reason
-- )
-- SELECT 
--   (SELECT id FROM app.d_role WHERE name = 'Business Manager'),
--   'create' AS permission_action,
--   'biz', biz.id, 'project', proj.id,
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   'Business Manager - Project creation within business unit'
-- FROM app.d_biz biz
-- CROSS JOIN app.d_project proj
-- WHERE biz.active = true AND proj.active = true;

-- Example: Grant project management permissions to Project Manager role
-- INSERT INTO app.rel_role_entity_action_rbac (
--   role_id, permission_action, parent_entity, parent_entity_id, action_entity, action_entity_id,
--   granted_by_employee_id, grant_reason
-- )
-- SELECT 
--   (SELECT id FROM app.d_role WHERE name = 'Project Manager'),
--   unnest(ARRAY['view', 'edit', 'share']) AS permission_action,
--   'project', proj.id, 'project', proj.id,
--   (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
--   'Project Manager - Standard project self-permissions'
-- FROM app.d_project proj
-- WHERE proj.active = true;

-- ============================================================================
-- INDEXES:
-- ============================================================================

CREATE INDEX idx_rel_role_entity_action_rbac_role_id ON app.rel_role_entity_action_rbac(role_id);
CREATE INDEX idx_rel_role_entity_action_rbac_parent_entity ON app.rel_role_entity_action_rbac(parent_entity, parent_entity_id);
CREATE INDEX idx_rel_role_entity_action_rbac_action_entity ON app.rel_role_entity_action_rbac(action_entity, action_entity_id);
CREATE INDEX idx_rel_role_entity_action_rbac_permission_action ON app.rel_role_entity_action_rbac(permission_action);
CREATE INDEX idx_rel_role_entity_action_rbac_active ON app.rel_role_entity_action_rbac(active) WHERE active = true;
CREATE INDEX idx_rel_role_entity_action_rbac_expiry ON app.rel_role_entity_action_rbac(expiry_date) WHERE expiry_date IS NOT NULL;