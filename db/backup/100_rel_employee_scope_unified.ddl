-- ============================================================================
-- EMPLOYEE-UNIFIED SCOPE RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between employees and unified scopes, providing
--   centralized permission management across all scope types (business,
--   location, HR, worksite, project, task, and application scopes).
--   Enables role-based access control with granular permissions.
--
-- Integration:
--   - Links d_employee to d_scope_unified for centralized permission management
--   - Supports polymorphic scope relationships across all dimensions
--   - Enables fine-grained permission control with CRUD+Execute matrix
--   - Facilitates enterprise-wide access control and audit trails

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_employee_scope_unified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  emp_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  scope_unified_id uuid NOT NULL REFERENCES app.d_scope_unified(id) ON DELETE CASCADE,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Scope context (for direct reference without joins)
  scope_type text NOT NULL,
  scope_reference_table text NOT NULL,
  scope_table_reference_id uuid NOT NULL,
  
  -- Permission matrix [0=Read, 1=Create, 2=Update, 3=Delete, 4=Execute]
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[],
  
  -- Additional context and governance
  resource_type text,
  resource_id uuid,
  tenant_id uuid,
  permission_source text DEFAULT 'direct',
  
  -- Assignment metadata
  assigned_by_employee_id uuid,
  assignment_reason text,
  expiry_date date,
  conditional_access boolean DEFAULT false,
  
  -- Performance and auditing
  usage_tracking boolean DEFAULT true,
  last_accessed_date date,
  access_count int DEFAULT 0,
  
  -- Unique constraint to prevent duplicate permissions
  UNIQUE(emp_id, scope_unified_id, resource_type, resource_id) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Employee-Scope Unified Relationships for Huron Home Services

-- Executive Level Access - Comprehensive scope access
WITH executives AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001') AS james_miller_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-002') AS sarah_chen_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-003') AS david_kumar_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004') AS maria_rodriguez_id
),
executive_scopes AS (
  SELECT id, scope_type, scope_name, scope_reference_table, scope_table_reference_id
  FROM app.d_scope_unified 
  WHERE scope_type IN ('business', 'location', 'hr', 'project') 
    AND (scope_name LIKE '%Huron Home Services%' OR scope_name LIKE '%CEO%' OR scope_name LIKE '%Greater Toronto Area%')
)

INSERT INTO app.rel_employee_scope_unified (
  emp_id, scope_unified_id, scope_type, scope_reference_table, scope_table_reference_id,
  resource_permission, permission_source, assigned_by_employee_id
)
-- CEO Access - Full enterprise access
SELECT 
  executives.james_miller_id,
  executive_scopes.id,
  executive_scopes.scope_type,
  executive_scopes.scope_reference_table,
  executive_scopes.scope_table_reference_id,
  ARRAY[0,1,2,3,4]::smallint[],
  'role_assignment',
  executives.james_miller_id
FROM executives, executive_scopes

UNION ALL

-- CFO Access - Financial and compliance focus
SELECT 
  executives.sarah_chen_id,
  executive_scopes.id,
  executive_scopes.scope_type,
  executive_scopes.scope_reference_table,
  executive_scopes.scope_table_reference_id,
  CASE executive_scopes.scope_type 
    WHEN 'business' THEN ARRAY[0,1,2,3]::smallint[]
    WHEN 'project' THEN ARRAY[0,1,2]::smallint[]
    ELSE ARRAY[0,1]::smallint[]
  END,
  'role_assignment',
  executives.james_miller_id
FROM executives, executive_scopes
WHERE executives.sarah_chen_id IS NOT NULL

UNION ALL

-- CTO Access - Technology and infrastructure focus
SELECT 
  executives.david_kumar_id,
  executive_scopes.id,
  executive_scopes.scope_type,
  executive_scopes.scope_reference_table,
  executive_scopes.scope_table_reference_id,
  CASE executive_scopes.scope_type 
    WHEN 'business' THEN ARRAY[0,1,2]::smallint[]
    WHEN 'project' THEN ARRAY[0,1,2,3,4]::smallint[]
    ELSE ARRAY[0,1,2]::smallint[]
  END,
  'role_assignment',
  executives.james_miller_id
FROM executives, executive_scopes
WHERE executives.david_kumar_id IS NOT NULL

UNION ALL

-- COO Access - Operational focus with broad scope access
SELECT 
  executives.maria_rodriguez_id,
  executive_scopes.id,
  executive_scopes.scope_type,
  executive_scopes.scope_reference_table,
  executive_scopes.scope_table_reference_id,
  CASE executive_scopes.scope_type 
    WHEN 'business' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'project' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'hr' THEN ARRAY[0,1,2]::smallint[]
    ELSE ARRAY[0,1,2,3]::smallint[]
  END,
  'role_assignment',
  executives.james_miller_id
FROM executives, executive_scopes
WHERE executives.maria_rodriguez_id IS NOT NULL;

-- Management Level Access - Departmental and functional scope access
WITH management AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005') AS robert_thompson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006') AS jennifer_walsh_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007') AS michael_patterson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008') AS lisa_chang_id
),
department_scopes AS (
  SELECT id, scope_type, scope_name, scope_reference_table, scope_table_reference_id
  FROM app.d_scope_unified 
  WHERE scope_type IN ('business', 'worksite', 'project', 'task')
    AND (scope_name LIKE '%Department%' OR scope_name LIKE '%Team%' OR scope_name LIKE '%Service%')
)

INSERT INTO app.rel_employee_scope_unified (
  emp_id, scope_unified_id, scope_type, scope_reference_table, scope_table_reference_id,
  resource_permission, permission_source, assigned_by_employee_id
)
-- SVP Business Operations - Divisional scope access
SELECT 
  management.robert_thompson_id,
  department_scopes.id,
  department_scopes.scope_type,
  department_scopes.scope_reference_table,
  department_scopes.scope_table_reference_id,
  CASE department_scopes.scope_type 
    WHEN 'business' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'project' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'worksite' THEN ARRAY[0,1,2]::smallint[]
    WHEN 'task' THEN ARRAY[0,1,2,3]::smallint[]
  END,
  'management_assignment',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004')
FROM management, department_scopes
WHERE management.robert_thompson_id IS NOT NULL
  AND department_scopes.scope_name LIKE '%Operations%'

UNION ALL

-- VP Landscaping Services - Landscaping department focus
SELECT 
  management.jennifer_walsh_id,
  department_scopes.id,
  department_scopes.scope_type,
  department_scopes.scope_reference_table,
  department_scopes.scope_table_reference_id,
  CASE department_scopes.scope_type 
    WHEN 'business' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'project' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'worksite' THEN ARRAY[0,1,2,3]::smallint[]
    WHEN 'task' THEN ARRAY[0,1,2,3]::smallint[]
  END,
  'department_assignment',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005')
FROM management, department_scopes
WHERE management.jennifer_walsh_id IS NOT NULL
  AND (department_scopes.scope_name LIKE '%Landscaping%' OR department_scopes.scope_name LIKE '%Garden%')

UNION ALL

-- VP Technical Services - Technical department focus
SELECT 
  management.michael_patterson_id,
  department_scopes.id,
  department_scopes.scope_type,
  department_scopes.scope_reference_table,
  department_scopes.scope_table_reference_id,
  CASE department_scopes.scope_type 
    WHEN 'business' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'project' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'worksite' THEN ARRAY[0,1,2,3]::smallint[]
    WHEN 'task' THEN ARRAY[0,1,2,3,4]::smallint[]
  END,
  'department_assignment',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005')
FROM management, department_scopes
WHERE management.michael_patterson_id IS NOT NULL
  AND (department_scopes.scope_name LIKE '%HVAC%' OR department_scopes.scope_name LIKE '%Solar%' OR department_scopes.scope_name LIKE '%Technical%')

UNION ALL

-- AVP Residential Landscaping - Residential market focus
SELECT 
  management.lisa_chang_id,
  department_scopes.id,
  department_scopes.scope_type,
  department_scopes.scope_reference_table,
  department_scopes.scope_table_reference_id,
  CASE department_scopes.scope_type 
    WHEN 'business' THEN ARRAY[0,1,2,3]::smallint[]
    WHEN 'project' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'worksite' THEN ARRAY[0,1,2]::smallint[]
    WHEN 'task' THEN ARRAY[0,1,2,3]::smallint[]
  END,
  'market_assignment',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006')
FROM management, department_scopes
WHERE management.lisa_chang_id IS NOT NULL
  AND (department_scopes.scope_name LIKE '%Residential%' OR department_scopes.scope_name LIKE '%Garden%');

-- Professional and Technical Staff Access
WITH professionals AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010') AS amanda_foster_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011') AS tom_richardson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-013') AS sandra_mitchell_id
),
project_scopes AS (
  SELECT id, scope_type, scope_name, scope_reference_table, scope_table_reference_id
  FROM app.d_scope_unified 
  WHERE scope_type IN ('project', 'task', 'worksite')
)

INSERT INTO app.rel_employee_scope_unified (
  emp_id, scope_unified_id, scope_type, scope_reference_table, scope_table_reference_id,
  resource_permission, permission_source, assigned_by_employee_id, conditional_access
)
-- Senior Director Design & Planning - Design project access
SELECT 
  professionals.amanda_foster_id,
  project_scopes.id,
  project_scopes.scope_type,
  project_scopes.scope_reference_table,
  project_scopes.scope_table_reference_id,
  CASE project_scopes.scope_type 
    WHEN 'project' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'task' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'worksite' THEN ARRAY[0,1,2]::smallint[]
  END,
  'professional_assignment',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008'),
  false
FROM professionals, project_scopes
WHERE professionals.amanda_foster_id IS NOT NULL
  AND (project_scopes.scope_name LIKE '%Garden%' OR project_scopes.scope_name LIKE '%Design%' OR project_scopes.scope_name LIKE '%Landscaping%')

UNION ALL

-- Director Project Implementation - Implementation and execution focus
SELECT 
  professionals.tom_richardson_id,
  project_scopes.id,
  project_scopes.scope_type,
  project_scopes.scope_reference_table,
  project_scopes.scope_table_reference_id,
  CASE project_scopes.scope_type 
    WHEN 'project' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'task' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'worksite' THEN ARRAY[0,1,2,3,4]::smallint[]
  END,
  'professional_assignment',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010'),
  false
FROM professionals, project_scopes
WHERE professionals.tom_richardson_id IS NOT NULL

UNION ALL

-- HVAC/Solar Technician - Technical project access
SELECT 
  professionals.kevin_obrien_id,
  project_scopes.id,
  project_scopes.scope_type,
  project_scopes.scope_reference_table,
  project_scopes.scope_table_reference_id,
  CASE project_scopes.scope_type 
    WHEN 'project' THEN ARRAY[0,1,2]::smallint[]
    WHEN 'task' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'worksite' THEN ARRAY[0,1,2]::smallint[]
  END,
  'technical_assignment',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'),
  false
FROM professionals, project_scopes
WHERE professionals.kevin_obrien_id IS NOT NULL
  AND (project_scopes.scope_name LIKE '%HVAC%' OR project_scopes.scope_name LIKE '%Solar%' OR project_scopes.scope_name LIKE '%Technical%')

UNION ALL

-- Licensed Plumber - Plumbing project access
SELECT 
  professionals.sandra_mitchell_id,
  project_scopes.id,
  project_scopes.scope_type,
  project_scopes.scope_reference_table,
  project_scopes.scope_table_reference_id,
  CASE project_scopes.scope_type 
    WHEN 'project' THEN ARRAY[0,1,2]::smallint[]
    WHEN 'task' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN 'worksite' THEN ARRAY[0,1,2]::smallint[]
  END,
  'technical_assignment',
  (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007'),
  false
FROM professionals, project_scopes
WHERE professionals.sandra_mitchell_id IS NOT NULL
  AND (project_scopes.scope_name LIKE '%Water%' OR project_scopes.scope_name LIKE '%Plumbing%');

-- Application Scope Access - System and UI access
WITH app_users AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001') AS james_miller_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-017') AS rachel_kim_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008') AS lisa_chang_id
),
app_scopes AS (
  SELECT id, scope_type, scope_name, scope_reference_table, scope_table_reference_id
  FROM app.d_scope_unified 
  WHERE scope_type IN ('app:page', 'app:api', 'app:component')
)

INSERT INTO app.rel_employee_scope_unified (
  emp_id, scope_unified_id, scope_type, scope_reference_table, scope_table_reference_id,
  resource_permission, permission_source, usage_tracking
)
-- Executive level - Full application access
SELECT 
  app_users.james_miller_id,
  app_scopes.id,
  app_scopes.scope_type,
  app_scopes.scope_reference_table,
  app_scopes.scope_table_reference_id,
  ARRAY[0,1,2,3,4]::smallint[],
  'executive_access',
  true
FROM app_users, app_scopes
WHERE app_users.james_miller_id IS NOT NULL

UNION ALL

-- Customer service - Client-focused application access
SELECT 
  app_users.rachel_kim_id,
  app_scopes.id,
  app_scopes.scope_type,
  app_scopes.scope_reference_table,
  app_scopes.scope_table_reference_id,
  CASE 
    WHEN app_scopes.scope_name LIKE '%client%' THEN ARRAY[0,1,2,3]::smallint[]
    WHEN app_scopes.scope_name LIKE '%dashboard%' THEN ARRAY[0,1]::smallint[]
    WHEN app_scopes.scope_name LIKE '%auth%' THEN ARRAY[4]::smallint[]
    ELSE ARRAY[0,1]::smallint[]
  END,
  'role_based_access',
  true
FROM app_users, app_scopes
WHERE app_users.rachel_kim_id IS NOT NULL

UNION ALL

-- Management level - Business application access
SELECT 
  app_users.lisa_chang_id,
  app_scopes.id,
  app_scopes.scope_type,
  app_scopes.scope_reference_table,
  app_scopes.scope_table_reference_id,
  CASE 
    WHEN app_scopes.scope_name LIKE '%project%' THEN ARRAY[0,1,2,3,4]::smallint[]
    WHEN app_scopes.scope_name LIKE '%employee%' THEN ARRAY[0,1,2]::smallint[]
    WHEN app_scopes.scope_name LIKE '%dashboard%' THEN ARRAY[0,1,2]::smallint[]
    ELSE ARRAY[0,1]::smallint[]
  END,
  'management_access',
  true
FROM app_users, app_scopes
WHERE app_users.lisa_chang_id IS NOT NULL;

-- Indexes removed for simplified import