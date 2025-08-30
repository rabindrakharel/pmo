-- ============================================================================
-- UNIFIED SCOPE SYSTEM (Central Permission Registry)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- 🎯 **UNIVERSAL PERMISSION HUB**
-- • Central registry for all permission-based entities
-- • Single interface for referencing any scope type
-- • Polymorphic relationships across dimensions
-- • Consistent RBAC across organization
--
-- 🔄 **SCOPE REFERENCE PATTERN**
-- scope_reference_table → table name where scope data resides
-- scope_table_reference_id → UUID primary key in scope_reference_table
-- name → copied from the name field of the scope_reference_table (contains actual paths/values)
--
-- 📊 **SCOPE TYPE TO REFERENCE TABLE MAPPING**
--
-- BUSINESS SCOPE:
-- • scope_type: 'business'
-- • scope_reference_table: 'd_scope_business'
-- • scope_table_reference_id: maps to d_scope_business.id (uuid)
-- • name: copied from d_scope_business.name
--   - "Huron Home Services" (Corporate level)
--   - "Business Operations Division" (Division level)
--   - "Landscaping Department" (Department level)
--
-- LOCATION SCOPE:
-- • scope_type: 'location'
-- • scope_reference_table: 'd_scope_location'
-- • scope_table_reference_id: maps to d_scope_location.id (uuid)
-- • name: copied from d_scope_location.name
--   - "Canada" (Country level)
--   - "Ontario" (Province level)
--   - "Greater Toronto Area" (Region level)
--   - "Mississauga" (City level)
--
-- HR SCOPE:
-- • scope_type: 'hr'
-- • scope_reference_table: 'd_scope_hr'
-- • scope_table_reference_id: maps to d_scope_hr.id (uuid)
-- • name: copied from d_scope_hr.name
--   - "CEO Office" (Executive level)
--   - "Operations Management" (Director level)
--   - "Department Managers" (Manager level)
--
-- APPLICATION SCOPE (references existing data from db/11_app_tables.ddl):
-- • scope_type: 'app:page', 'app:component', 'app:api' (transformed from d_scope_app.scope_type)
-- • scope_reference_table: 'd_scope_app'
-- • scope_table_reference_id: maps to d_scope_app.id (uuid)
-- • scope_name: copied from d_scope_app.scope_name (contains actual API paths/routes/components)
--   - d_scope_app.scope_type: 'page' → unified scope_type: 'app:page', name: "/admin/users"
--   - d_scope_app.scope_type: 'component' → unified scope_type: 'app:component', name: "TaskBoard"
--   - d_scope_app.scope_type: 'api-path' → unified scope_type: 'app:api', name: "/api/v1/auth/logout"
--   - d_scope_app.scope_type: 'page' → unified scope_type: 'app:page', name: "/projects"
--   - d_scope_app.scope_type: 'component' → unified scope_type: 'app:component', name: "datatable:DataTable"
--   - d_scope_app.scope_type: 'api-path' → unified scope_type: 'app:api', name: "/api/v1/task"
--
-- WORKSITE SCOPE:
-- • scope_type: 'worksite'
-- • scope_reference_table: 'd_scope_worksite'
-- • scope_table_reference_id: maps to d_scope_worksite.id (uuid)
-- • name: copied from d_scope_worksite.name
--   - "Huron Home Services HQ" (Headquarters)
--   - "Solar Install - 1847 Sheridan Park Dr" (Project worksite)
--   - "Winter Ops - Equipment Staging" (Seasonal worksite)
--
-- PROJECT SCOPE:
-- • scope_type: 'project'
-- • scope_reference_table: 'ops_project_head'
-- • scope_table_reference_id: maps to ops_project_head.id (uuid)
-- • name: copied from ops_project_head.name
--   - "ERP Implementation Phase 1" (Major project)
--   - "Solar Panel Installation - Residential Q1" (Service project)
--   - "Winter Operations 2025" (Seasonal project)
--
-- TASK SCOPE:
-- • scope_type: 'task'
-- • scope_reference_table: 'ops_task_head'
-- • scope_table_reference_id: maps to ops_task_head.id (uuid)
-- • name: copied from ops_task_head.name
--   - "Complete HVAC system installation" (Individual task)
--   - "Customer satisfaction survey implementation" (Process task)
--
-- 🔗 **PERMISSION INHERITANCE**
-- 1. Direct scope permissions (highest priority)
-- 2. Parent scope inheritance (cascading)
-- 3. Cross-scope bridging (HR → Business → Location)
-- 4. Default permissions (fallback)
--
-- 🛡️ **ENTERPRISE FEATURES**
-- • Multi-tenant data isolation
-- • Hierarchical permission cascades
-- • Cross-functional team support
-- • Audit trail consolidation
-- • Dynamic scope assignment

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_unified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (audit, metadata, SCD type 2)
  scope_name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Unified scope-specific fields
  scope_type text NOT NULL,
  scope_reference_table text NOT NULL, -- e.g. 'd_scope_business', 'd_scope_location', etc.
  scope_table_reference_id uuid NOT NULL,
  scope_level_id int,
  parent_scope_id uuid REFERENCES app.d_scope_unified(id) ON DELETE SET NULL,
  tenant_id uuid,
  is_system_scope boolean NOT NULL DEFAULT false,
  is_inherited boolean NOT NULL DEFAULT false,
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[]
);

-- ============================================================================
-- EMPLOYEE-SCOPE RELATIONSHIP TABLE
-- ============================================================================

CREATE TABLE app.rel_employee_scope_unified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (audit, metadata, SCD type 2)
  scope_name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Employee-scope relationship fields
  emp_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  scope_type text NOT NULL, -- 'business', 'location', 'hr', 'app:page', 'app:api', 'app:component', 'worksite', 'project', 'task'
  scope_reference_table text NOT NULL, -- e.g. 'd_scope_business', 'd_scope_location', 'd_scope_app', etc.
  scope_table_reference_id uuid NOT NULL, -- UUID referencing the actual scope table
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[], -- [0,1,2,3,4] for CRUD + Execute permissions
  -- Optional fields for additional context
  resource_type text, -- Additional resource type specification
  resource_id uuid, -- Optional specific resource ID
  tenant_id uuid,
  -- Performance indexes
  UNIQUE(emp_id, scope_type, scope_reference_table, scope_table_reference_id, resource_type, resource_id)
);


-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- NOTE: d_scope_app data is already populated in db/11_app_tables.ddl
-- We will reference the existing data structure which uses scope_type and scope_name columns
-- The scope_name field contains the actual API paths/routes/components

-- Now populate the unified scope table with references to existing scope tables
INSERT INTO app.d_scope_unified (scope_type, scope_reference_table, scope_table_reference_id, scope_name, descr, tags, attr)
SELECT 
  'business' as scope_type,
  'd_scope_business' as scope_reference_table,
  id as scope_table_reference_id,
  name, -- name from d_scope_business
  "descr",
  tags,
  attr
FROM app.d_scope_business
WHERE active = true

UNION ALL

SELECT 
  'location' as scope_type,
  'd_scope_location' as scope_reference_table,
  id as scope_table_reference_id,
  name, -- name from d_scope_location
  "descr",
  tags,
  attr
FROM app.d_scope_location
WHERE active = true

UNION ALL

SELECT 
  'worksite' as scope_type,
  'd_scope_worksite' as scope_reference_table,
  id as scope_table_reference_id,
  name, -- name from d_scope_worksite
  "descr",
  tags,
  attr
FROM app.d_scope_worksite
WHERE active = true

UNION ALL

SELECT 
  'hr' as scope_type,
  'd_scope_hr' as scope_reference_table,
  id as scope_table_reference_id,
  name, -- name from d_scope_hr
  "descr",
  tags,
  attr
FROM app.d_scope_hr
WHERE active = true

UNION ALL

-- Add app scope entries using the existing structure from 11_app_tables.ddl
SELECT 
  CASE scope_type
    WHEN 'page' THEN 'app:page'
    WHEN 'api-path' THEN 'app:api'  
    WHEN 'component' THEN 'app:component'
    ELSE 'app:' || scope_type
  END as scope_type,
  'd_scope_app' as scope_reference_table,
  id as scope_table_reference_id,
  scope_name, -- use scope_name directly (contains actual API paths/routes/components)
  "descr",
  tags,
  attr
FROM app.d_scope_app
WHERE active = true;

-- ============================================================================
-- JAMES MILLER (CEO) PERMISSIONS - COMPREHENSIVE ACCESS
-- ============================================================================

-- Create meaningful permissions for James Miller using the new direct structure
INSERT INTO app.rel_employee_scope_unified (emp_id, scope_type, scope_reference_table, scope_table_reference_id, resource_permission, scope_name, descr, tags, attr)

-- Business permissions - Direct reference to business scopes
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca') as emp_id,
  'business' as scope_type,
  'd_scope_business' as scope_reference_table,
  sb.id as scope_table_reference_id,
  ARRAY[0,1,2,3,4]::smallint[] as resource_permission,
  'James Miller - ' || sb.name || ' - Executive Authority' as name,
  'CEO executive authority over ' || sb.descr as descr,
  '["ceo", "executive", "business"]'::jsonb as tags,
  '{"executive_authority": true, "budget_unlimited": true, "strategic_oversight": true}'::jsonb as attr
FROM app.d_scope_business sb 
WHERE sb.active = true

UNION ALL

-- Location permissions - Direct reference to location scopes
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'location',
  'd_scope_location',
  sl.id,
  ARRAY[0,1,2,3,4]::smallint[],
  'James Miller - ' || sl.name || ' - Geographic Authority',
  'CEO geographic authority over ' || sl.descr,
  '["ceo", "executive", "location"]'::jsonb,
  '{"geographic_authority": true, "operational_oversight": true, "expansion_authority": true}'::jsonb
FROM app.d_scope_location sl 
WHERE sl.active = true

UNION ALL

-- HR permissions - Direct reference to HR scopes
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'hr',
  'd_scope_hr',
  sh.id,
  ARRAY[0,1,2,3,4]::smallint[],
  'James Miller - ' || sh.name || ' - HR Executive Authority',
  'CEO human resources authority over ' || sh.descr,
  '["ceo", "executive", "hr"]'::jsonb,
  '{"hr_executive": true, "hiring_authority": true, "compensation_authority": true, "organizational_design": true}'::jsonb
FROM app.d_scope_hr sh 
WHERE sh.active = true

UNION ALL

-- Worksite permissions - Direct reference to worksite scopes
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'worksite',
  'd_scope_worksite',
  sw.id,
  ARRAY[0,1,2,3,4]::smallint[],
  'James Miller - ' || sw.name || ' - Facility Authority',
  'CEO facility authority over ' || sw.descr,
  '["ceo", "executive", "worksite"]'::jsonb,
  '{"facility_authority": true, "safety_oversight": true, "capital_investments": true}'::jsonb
FROM app.d_scope_worksite sw 
WHERE sw.active = true

UNION ALL

-- App Page permissions - Direct reference to app scopes (pages only) 
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'app:page',
  'd_scope_app',
  sa.id,
  ARRAY[0,1,2,3,4]::smallint[],
  'James Miller - ' || sa.scope_name || ' - Executive Dashboard Access',
  'CEO access to ' || sa.scope_name || ' for executive oversight',
  '["ceo", "executive", "app-page"]'::jsonb,
  jsonb_build_object('page_access', true, 'executive_view', true, 'path', sa.scope_name, 'name', sa.scope_name)
FROM app.d_scope_app sa 
WHERE sa.active = true AND sa.scope_type = 'page'

UNION ALL

-- App API permissions - Direct reference to app scopes (APIs only)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'app:api',
  'd_scope_app',
  sa.id,
  ARRAY[0,1,2,3,4]::smallint[],
  'James Miller - ' || sa.scope_name || ' - Full API Access',
  'CEO access to ' || sa.scope_name || ' API for data oversight and reporting',
  '["ceo", "executive", "app-api"]'::jsonb,
  jsonb_build_object('api_access', true, 'executive_data', true, 'endpoint', sa.scope_name, 'name', sa.scope_name, 'methods', '["GET", "POST", "PUT", "DELETE"]')
FROM app.d_scope_app sa 
WHERE sa.active = true AND sa.scope_type = 'api-path'

UNION ALL

-- App Component permissions - Direct reference to app scopes (components only)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'app:component',
  'd_scope_app',
  sa.id,
  ARRAY[0,1,2,3,4]::smallint[],
  'James Miller - ' || sa.scope_name || ' - Component Authority',
  'CEO access to ' || sa.scope_name || ' component for executive functions',
  '["ceo", "executive", "app-component"]'::jsonb,
  jsonb_build_object('component_access', true, 'executive_functions', true, 'component', sa.scope_name, 'name', sa.scope_name)
FROM app.d_scope_app sa 
WHERE sa.active = true AND sa.scope_type = 'component';

-- ============================================================================
-- PROJECT PERMISSIONS FOR JAMES MILLER
-- ============================================================================

-- James Miller gets executive oversight on all projects - Direct reference to project scopes
INSERT INTO app.rel_employee_scope_unified (emp_id, scope_type, scope_reference_table, scope_table_reference_id, resource_permission, scope_name, descr, tags, attr)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'),
  'project',
  'ops_project_head',
  p.id,
  ARRAY[0,1,2,3,4]::smallint[],
  'James Miller - ' || p.name || ' - Executive Project Oversight',
  'CEO executive oversight and strategic direction for ' || p.name,
  '["ceo", "executive", "project", "strategic"]'::jsonb,
  jsonb_build_object(
    'executive_oversight', true, 
    'budget_authority', true, 
    'strategic_direction', true,
    'project_name', p.name,
    'approval_required', false
  )
FROM app.ops_project_head p 
WHERE p.active = true;

-- ============================================================================
-- SUMMARY OF JAMES MILLER PERMISSIONS
-- ============================================================================
-- 
-- James Miller (james.miller@huronhome.ca) as CEO has been granted:
-- • Full access (permissions 0,1,2,3,4) to ALL business scopes
-- • Full access to ALL location scopes (geographic authority)
-- • Full access to ALL HR scopes (hiring, compensation, organizational design)
-- • Full access to ALL worksite scopes (facility authority, safety oversight)
-- • Full access to ALL app:page scopes (executive dashboard access)
-- • Full access to ALL app:api scopes (complete API access for data oversight)
-- • Full access to ALL app:component scopes (all system components)
-- • Executive oversight on ALL projects (budget authority, strategic direction)
--
-- This provides comprehensive system access appropriate for the CEO role
-- with proper name-based scope tracking for granular permission management.

-- ============================================================================
-- ADDITIONAL PROJECT SCOPE ENTRIES FROM EXISTING PROJECTS
-- ============================================================================

-- Create project scopes from existing project data using the new structure
INSERT INTO app.d_scope_unified (scope_type, scope_reference_table, scope_table_reference_id, parent_scope_id, scope_name, descr, active)
SELECT 
  'project' as scope_type,
  'ops_project_head' as scope_reference_table,
  p.id as scope_table_reference_id,
  (SELECT id FROM app.d_scope_unified WHERE scope_type = 'business' AND scope_name = 'Huron Home Services' LIMIT 1) as parent_scope_id,
  p.name, -- name from ops_project_head
  'Project scope for ' || p.name,
  true
FROM app.ops_project_head p 
WHERE p.active = true
AND NOT EXISTS (
  SELECT 1 FROM app.d_scope_unified su 
  WHERE su.scope_type = 'project' 
  AND su.scope_table_reference_id = p.id
);