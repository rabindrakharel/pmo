-- ============================================================================
-- UNIFIED SCOPE DIMENSION
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Central registry for all permission-based entities providing a single
--   interface for referencing any scope type across the enterprise.
--   Enables polymorphic relationships, consistent RBAC, and unified
--   permission management across organizational dimensions.
--
-- Scope Types:
--   - business: Organizational hierarchy scopes (d_scope_org)
--   - location: Geographic hierarchy scopes (d_scope_org)
--   - hr: HR position hierarchy scopes (d_scope_hr)
--   - worksite: Physical worksite scopes (d_scope_worksite)
--   - project: Project scopes (d_scope_project)
--   - task: Task scopes (ops_task_head)
--   - app:page: Application page scopes
--   - app:api: API endpoint scopes
--   - app:component: UI component scopes
--
-- Integration:
--   - Central permission hub for all scope-based access control
--   - Polymorphic reference system supporting multiple scope dimensions
--   - Hierarchical permission cascades and inheritance
--   - Multi-tenant data isolation and enterprise features

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_unified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (audit, metadata, SCD type 2) - ALWAYS FIRST
  scope_name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),

  -- Unified scope identification
  scope_type text NOT NULL,
  scope_reference_table text NOT NULL,
  scope_table_reference_id uuid NOT NULL,
  scope_level_id int,
  
  -- Hierarchy and relationships
  parent_scope_id uuid REFERENCES app.d_scope_unified(id) ON DELETE SET NULL,
  tenant_id uuid,
  
  -- Scope attributes
  is_system_scope boolean NOT NULL DEFAULT false,
  is_inherited boolean NOT NULL DEFAULT false,
  is_leaf_scope boolean DEFAULT false,
  
  -- Permission and access control
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[],
  permission_inheritance boolean DEFAULT true,
  access_control_enabled boolean DEFAULT true,
  
  -- Metadata and governance
  scope_path text,
  scope_weight int DEFAULT 0,
  audit_enabled boolean DEFAULT true
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services Unified Scope Registry

-- Business/Organizational Scopes
WITH org_scopes AS (
  SELECT 
    id, name, 
    CASE 
      WHEN level_name = 'Corporation' THEN 0
      WHEN level_name = 'Division' THEN 1
      WHEN level_name = 'Department' THEN 2
      WHEN level_name = 'Team' THEN 3
      WHEN level_name = 'Squad' THEN 4
      WHEN level_name = 'Sub-team' THEN 5
    END as scope_level
  FROM app.d_scope_org 
  WHERE active = true
)

INSERT INTO app.d_scope_unified (
  scope_name, "descr", scope_type, scope_reference_table, scope_table_reference_id,
  scope_level_id, is_system_scope, permission_inheritance, scope_path,
  resource_permission, tags, attr
)
SELECT 
  org_scopes.name,
  'Organizational scope: ' || org_scopes.name,
  'business',
  'd_scope_org',
  org_scopes.id,
  org_scopes.scope_level,
  false,
  true,
  '/business/' || LOWER(REPLACE(org_scopes.name, ' ', '_')),
  ARRAY[0,1,2,3,4]::smallint[],
  '["organizational", "business"]'::jsonb,
  '{"scope_domain": "organizational", "hierarchy_enabled": true}'::jsonb
FROM org_scopes;

-- Location/Geographic Scopes
WITH location_scopes AS (
  SELECT 
    id, name,
    CASE level_name
      WHEN 'Corp-Region' THEN 0
      WHEN 'Country' THEN 1
      WHEN 'Province' THEN 2
      WHEN 'Economic Region' THEN 3
      WHEN 'Metropolitan Area' THEN 4
      WHEN 'City' THEN 5
      WHEN 'District' THEN 6
      WHEN 'Address' THEN 7
    END as scope_level
  FROM app.d_scope_org 
  WHERE active = true
)

INSERT INTO app.d_scope_unified (
  scope_name, "descr", scope_type, scope_reference_table, scope_table_reference_id,
  scope_level_id, is_system_scope, permission_inheritance, scope_path,
  resource_permission, is_leaf_scope, tags, attr
)
SELECT 
  location_scopes.name,
  'Geographic scope: ' || location_scopes.name,
  'location',
  'd_scope_org',
  location_scopes.id,
  location_scopes.scope_level,
  false,
  true,
  '/location/' || LOWER(REPLACE(location_scopes.name, ' ', '_')),
  ARRAY[0,1,2]::smallint[],
  (location_scopes.scope_level = 7),  -- Address level is leaf
  '["geographic", "location"]'::jsonb,
  '{"scope_domain": "geographic", "jurisdiction_enabled": true}'::jsonb
FROM location_scopes;

-- HR Position Scopes
WITH hr_scopes AS (
  SELECT 
    id, name,
    CASE level_name
      WHEN 'CEO/President' THEN 0
      WHEN 'C-Level' THEN 1
      WHEN 'SVP/EVP' THEN 2
      WHEN 'VP' THEN 3
      WHEN 'AVP' THEN 4
      WHEN 'Senior Director' THEN 5
      WHEN 'Director' THEN 6
      WHEN 'Associate Director' THEN 7
    END as scope_level
  FROM app.d_scope_hr 
  WHERE active = true
)

INSERT INTO app.d_scope_unified (
  scope_name, "descr", scope_type, scope_reference_table, scope_table_reference_id,
  scope_level_id, is_system_scope, permission_inheritance, scope_path,
  resource_permission, is_leaf_scope, tags, attr
)
SELECT 
  hr_scopes.name,
  'HR position scope: ' || hr_scopes.name,
  'hr',
  'd_scope_hr',
  hr_scopes.id,
  hr_scopes.scope_level,
  false,
  true,
  '/hr/' || LOWER(REPLACE(hr_scopes.name, ' ', '_')),
  ARRAY[0,1,2,3,4]::smallint[],
  (hr_scopes.scope_level = 7),  -- Associate Director level is leaf
  '["hr", "position", "authority"]'::jsonb,
  '{"scope_domain": "human_resources", "authority_delegation": true}'::jsonb
FROM hr_scopes;

-- Worksite Scopes
WITH worksite_scopes AS (
  SELECT 
    id, name, worksite_type
  FROM app.d_scope_worksite 
  WHERE active = true
)

INSERT INTO app.d_scope_unified (
  scope_name, "descr", scope_type, scope_reference_table, scope_table_reference_id,
  scope_level_id, is_system_scope, permission_inheritance, scope_path,
  resource_permission, is_leaf_scope, tags, attr
)
SELECT 
  worksite_scopes.name,
  'Worksite scope: ' || worksite_scopes.name,
  'worksite',
  'd_scope_worksite',
  worksite_scopes.id,
  CASE worksite_scopes.worksite_type
    WHEN 'headquarters' THEN 0
    WHEN 'branch' THEN 1
    WHEN 'seasonal' THEN 2
    WHEN 'storage' THEN 3
    WHEN 'project' THEN 4
  END,
  false,
  false,  -- Worksite permissions typically don't inherit
  '/worksite/' || LOWER(REPLACE(worksite_scopes.name, ' ', '_')),
  ARRAY[0,1,2]::smallint[],
  true,   -- Worksites are leaf-level scopes
  '["worksite", "physical", "location"]'::jsonb,
  '{"scope_domain": "physical_location", "access_controlled": true}'::jsonb
FROM worksite_scopes;

-- Project Scopes
WITH project_scopes AS (
  SELECT 
    id, name, project_type
  FROM app.d_scope_project 
  WHERE active = true
)

INSERT INTO app.d_scope_unified (
  scope_name, "descr", scope_type, scope_reference_table, scope_table_reference_id,
  scope_level_id, is_system_scope, permission_inheritance, scope_path,
  resource_permission, is_leaf_scope, tags, attr
)
SELECT 
  project_scopes.name,
  'Project scope: ' || project_scopes.name,
  'project',
  'd_scope_project',
  project_scopes.id,
  CASE project_scopes.project_type
    WHEN 'strategic' THEN 0
    WHEN 'infrastructure' THEN 1
    WHEN 'service' THEN 2
  END,
  false,
  true,
  '/project/' || LOWER(REPLACE(project_scopes.name, ' ', '_')),
  ARRAY[0,1,2,3,4]::smallint[],
  false,  -- Projects can have task sub-scopes
  '["project", "work", "deliverable"]'::jsonb,
  '{"scope_domain": "project_management", "resource_allocation": true}'::jsonb
FROM project_scopes;

-- Task Scopes (sampling from ops_task_head)
WITH task_scopes AS (
  SELECT 
    id, name, task_type
  FROM app.ops_task_head 
  WHERE active = true
  LIMIT 20  -- Sample for demonstration
)

INSERT INTO app.d_scope_unified (
  scope_name, "descr", scope_type, scope_reference_table, scope_table_reference_id,
  scope_level_id, is_system_scope, permission_inheritance, scope_path,
  resource_permission, is_leaf_scope, tags, attr
)
SELECT 
  task_scopes.name,
  'Task scope: ' || task_scopes.name,
  'task',
  'ops_task_head',
  task_scopes.id,
  CASE task_scopes.task_type
    WHEN 'planning' THEN 0
    WHEN 'design' THEN 1
    WHEN 'installation' THEN 2
    WHEN 'maintenance' THEN 3
    WHEN 'emergency' THEN 4
    WHEN 'administrative' THEN 5
  END,
  false,
  false,  -- Task permissions are specific and don't inherit
  '/task/' || LOWER(REPLACE(task_scopes.name, ' ', '_')),
  ARRAY[0,1,2,3]::smallint[],
  true,   -- Tasks are leaf-level scopes
  '["task", "work-item", "assignment"]'::jsonb,
  '{"scope_domain": "task_management", "time_bounded": true}'::jsonb
FROM task_scopes;

-- System and Application Scopes
INSERT INTO app.d_scope_unified (
  scope_name, "descr", scope_type, scope_reference_table, scope_table_reference_id,
  scope_level_id, is_system_scope, permission_inheritance, scope_path,
  resource_permission, is_leaf_scope, tags, attr
) VALUES
-- Application Page Scopes
('/dashboard', 'Dashboard page scope', 'app:page', 'system', gen_random_uuid(), 0, true, false, '/app/page/dashboard', ARRAY[0,1]::smallint[], true, '["app", "page", "dashboard"]', '{"scope_domain": "application", "ui_component": true}'),
('/projects', 'Projects page scope', 'app:page', 'system', gen_random_uuid(), 0, true, false, '/app/page/projects', ARRAY[0,1,2,3,4]::smallint[], true, '["app", "page", "projects"]', '{"scope_domain": "application", "data_intensive": true}'),
('/employees', 'Employees page scope', 'app:page', 'system', gen_random_uuid(), 0, true, false, '/app/page/employees', ARRAY[0,1,2,3]::smallint[], true, '["app", "page", "hr"]', '{"scope_domain": "application", "hr_sensitive": true}'),
('/clients', 'Clients page scope', 'app:page', 'system', gen_random_uuid(), 0, true, false, '/app/page/clients', ARRAY[0,1,2,3,4]::smallint[], true, '["app", "page", "clients"]', '{"scope_domain": "application", "client_data": true}'),

-- API Endpoint Scopes
('/api/v1/auth/login', 'Authentication login endpoint', 'app:api', 'system', gen_random_uuid(), 0, true, false, '/app/api/auth/login', ARRAY[4]::smallint[], true, '["api", "auth", "login"]', '{"scope_domain": "api", "security_critical": true}'),
('/api/v1/auth/logout', 'Authentication logout endpoint', 'app:api', 'system', gen_random_uuid(), 0, true, false, '/app/api/auth/logout', ARRAY[4]::smallint[], true, '["api", "auth", "logout"]', '{"scope_domain": "api", "session_management": true}'),
('/api/v1/projects', 'Projects API endpoint', 'app:api', 'system', gen_random_uuid(), 1, true, false, '/app/api/projects', ARRAY[0,1,2,3,4]::smallint[], true, '["api", "projects", "crud"]', '{"scope_domain": "api", "data_operations": true}'),
('/api/v1/employees', 'Employees API endpoint', 'app:api', 'system', gen_random_uuid(), 1, true, false, '/app/api/employees', ARRAY[0,1,2,3]::smallint[], true, '["api", "employees", "hr"]', '{"scope_domain": "api", "hr_data": true}'),
('/api/v1/tasks', 'Tasks API endpoint', 'app:api', 'system', gen_random_uuid(), 1, true, false, '/app/api/tasks', ARRAY[0,1,2,3,4]::smallint[], true, '["api", "tasks", "operations"]', '{"scope_domain": "api", "operational_data": true}'),

-- Component Scopes
('TaskBoard', 'Task board component scope', 'app:component', 'system', gen_random_uuid(), 0, true, false, '/app/component/taskboard', ARRAY[0,1,2,3]::smallint[], true, '["component", "taskboard", "kanban"]', '{"scope_domain": "component", "interactive": true}'),
('DataTable', 'Data table component scope', 'app:component', 'system', gen_random_uuid(), 0, true, false, '/app/component/datatable', ARRAY[0,1,2,3]::smallint[], true, '["component", "datatable", "grid"]', '{"scope_domain": "component", "data_display": true}'),
('FormBuilder', 'Form builder component scope', 'app:component', 'system', gen_random_uuid(), 0, true, false, '/app/component/formbuilder', ARRAY[0,1,2,3,4]::smallint[], true, '["component", "form", "builder"]', '{"scope_domain": "component", "form_generation": true}'),
('ReportViewer', 'Report viewer component scope', 'app:component', 'system', gen_random_uuid(), 0, true, false, '/app/component/reportviewer', ARRAY[0,1]::smallint[], true, '["component", "reports", "analytics"]', '{"scope_domain": "component", "analytics": true}');

-- Indexes removed for simplified import