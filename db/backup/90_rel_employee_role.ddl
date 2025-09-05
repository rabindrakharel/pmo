-- ============================================================================
-- EMPLOYEE-ROLE RELATIONSHIP TABLE
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Many-to-many relationship between employees and roles, enabling flexible
--   role assignment and supporting complex organizational structures where
--   employees may hold multiple roles or roles may be assigned to multiple
--   employees across different contexts.
--
-- Integration:
--   - Links d_employee to d_role for role-based access control
--   - Supports temporal role assignments with effective dates
--   - Enables organizational flexibility and role evolution
--   - Facilitates permission inheritance and access management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_employee_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  employee_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  
  -- Temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  
  -- Assignment context
  assignment_type text DEFAULT 'primary',
  assignment_context text,
  effective_date date DEFAULT CURRENT_DATE,
  expiration_date date,
  
  -- Authority and scope
  authority_level text DEFAULT 'standard',
  scope_limitation text,
  approval_required boolean DEFAULT false,
  
  -- Unique constraint to prevent duplicate active assignments
  UNIQUE(employee_id, role_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Employee-Role Assignments for Huron Home Services

-- Executive Role Assignments
WITH employees AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-001') AS james_miller_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-002') AS sarah_chen_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-003') AS david_kumar_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-004') AS maria_rodriguez_id
),
roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'CEO') AS ceo_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'CFO') AS cfo_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'CTO') AS cto_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'COO') AS coo_role_id
)

INSERT INTO app.rel_employee_role (
  employee_id, role_id, assignment_type, assignment_context, effective_date,
  authority_level, approval_required
)
SELECT 
  employees.james_miller_id,
  roles.ceo_role_id,
  'primary',
  'executive_leadership',
  '2020-01-15'::date,
  'ultimate',
  false
FROM employees, roles

UNION ALL

SELECT 
  employees.sarah_chen_id,
  roles.cfo_role_id,
  'primary',
  'financial_leadership',
  '2020-02-01'::date,
  'executive',
  false
FROM employees, roles

UNION ALL

SELECT 
  employees.david_kumar_id,
  roles.cto_role_id,
  'primary',
  'technology_leadership',
  '2020-03-15'::date,
  'executive',
  false
FROM employees, roles

UNION ALL

SELECT 
  employees.maria_rodriguez_id,
  roles.coo_role_id,
  'primary',
  'operational_leadership',
  '2020-02-15'::date,
  'executive',
  false
FROM employees, roles;

-- Management Role Assignments
WITH management_employees AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-005') AS robert_thompson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-006') AS jennifer_walsh_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-007') AS michael_patterson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-008') AS lisa_chang_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-009') AS paul_martineau_id
),
management_roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'SVP') AS svp_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'VP') AS vp_role_id,
    (SELECT id FROM app.d_role WHERE role_code = 'PM') AS pm_role_id
)

INSERT INTO app.rel_employee_role (
  employee_id, role_id, assignment_type, assignment_context, effective_date,
  authority_level, approval_required
)
SELECT 
  management_employees.robert_thompson_id,
  management_roles.svp_role_id,
  'primary',
  'business_operations',
  '2020-04-01'::date,
  'senior_executive',
  false
FROM management_employees, management_roles

UNION ALL

SELECT 
  management_employees.jennifer_walsh_id,
  management_roles.vp_role_id,
  'primary',
  'landscaping_services',
  '2020-05-15'::date,
  'departmental',
  false
FROM management_employees, management_roles

UNION ALL

SELECT 
  management_employees.michael_patterson_id,
  management_roles.vp_role_id,
  'primary',
  'technical_services',
  '2020-06-01'::date,
  'departmental',
  false
FROM management_employees, management_roles

UNION ALL

SELECT 
  management_employees.lisa_chang_id,
  management_roles.pm_role_id,
  'secondary',
  'project_coordination',
  '2020-07-15'::date,
  'project',
  true
FROM management_employees, management_roles

UNION ALL

SELECT 
  management_employees.paul_martineau_id,
  management_roles.pm_role_id,
  'secondary',
  'municipal_contracts',
  '2020-08-01'::date,
  'project',
  true
FROM management_employees, management_roles;

-- Professional and Technical Role Assignments
WITH professional_employees AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-010') AS amanda_foster_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-011') AS tom_richardson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-012') AS kevin_obrien_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-013') AS sandra_mitchell_id
),
professional_roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'LARCH') AS landscape_architect_id,
    (SELECT id FROM app.d_role WHERE role_code = 'PM') AS project_manager_id,
    (SELECT id FROM app.d_role WHERE role_code = 'HVAC-TECH') AS hvac_tech_id,
    (SELECT id FROM app.d_role WHERE role_code = 'PLUMBER') AS plumber_id
)

INSERT INTO app.rel_employee_role (
  employee_id, role_id, assignment_type, assignment_context, effective_date,
  authority_level, approval_required
)
SELECT 
  professional_employees.amanda_foster_id,
  professional_roles.landscape_architect_id,
  'primary',
  'design_leadership',
  '2021-01-15'::date,
  'professional',
  false
FROM professional_employees, professional_roles

UNION ALL

SELECT 
  professional_employees.tom_richardson_id,
  professional_roles.project_manager_id,
  'primary',
  'implementation_management',
  '2021-02-01'::date,
  'project',
  false
FROM professional_employees, professional_roles

UNION ALL

SELECT 
  professional_employees.kevin_obrien_id,
  professional_roles.hvac_tech_id,
  'primary',
  'technical_services',
  '2021-03-15'::date,
  'technical',
  false
FROM professional_employees, professional_roles

UNION ALL

SELECT 
  professional_employees.sandra_mitchell_id,
  professional_roles.plumber_id,
  'primary',
  'plumbing_services',
  '2021-04-01'::date,
  'technical',
  false
FROM professional_employees, professional_roles;

-- Operational and Field Role Assignments
WITH field_employees AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-014') AS carlos_santos_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-015') AS patricia_lee_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-016') AS mike_wilson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-017') AS rachel_kim_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-018') AS john_macdonald_id
),
operational_roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'INSTALL-SPEC') AS installer_id,
    (SELECT id FROM app.d_role WHERE role_code = 'SNOW-OP') AS snow_operator_id,
    (SELECT id FROM app.d_role WHERE role_code = 'CSR') AS customer_service_id,
    (SELECT id FROM app.d_role WHERE role_code = 'EQUIP-TECH') AS equipment_tech_id,
    (SELECT id FROM app.d_role WHERE role_code = 'CREW-SUP') AS crew_supervisor_id
)

INSERT INTO app.rel_employee_role (
  employee_id, role_id, assignment_type, assignment_context, effective_date,
  authority_level, approval_required
)
SELECT 
  field_employees.carlos_santos_id,
  operational_roles.installer_id,
  'primary',
  'landscaping_installation',
  '2021-05-15'::date,
  'operational',
  false
FROM field_employees, operational_roles

UNION ALL

SELECT 
  field_employees.patricia_lee_id,
  operational_roles.installer_id,
  'secondary',
  'horticulture_specialist',
  '2021-06-01'::date,
  'specialized',
  false
FROM field_employees, operational_roles

UNION ALL

SELECT 
  field_employees.mike_wilson_id,
  operational_roles.snow_operator_id,
  'primary',
  'winter_operations',
  '2021-07-15'::date,
  'operational',
  false
FROM field_employees, operational_roles

UNION ALL

SELECT 
  field_employees.rachel_kim_id,
  operational_roles.customer_service_id,
  'primary',
  'client_support',
  '2022-01-10'::date,
  'support',
  false
FROM field_employees, operational_roles

UNION ALL

SELECT 
  field_employees.john_macdonald_id,
  operational_roles.equipment_tech_id,
  'primary',
  'fleet_maintenance',
  '2022-02-15'::date,
  'technical',
  false
FROM field_employees, operational_roles

UNION ALL

SELECT 
  field_employees.mike_wilson_id,
  operational_roles.crew_supervisor_id,
  'secondary',
  'winter_crew_leadership',
  '2022-11-01'::date,
  'supervisory',
  true
FROM field_employees, operational_roles;

-- Seasonal Role Assignments
WITH seasonal_employees AS (
  SELECT 
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-019') AS emma_johnson_id,
    (SELECT id FROM app.d_employee WHERE employee_number = 'EMP-020') AS alex_dubois_id
),
seasonal_roles AS (
  SELECT 
    (SELECT id FROM app.d_role WHERE role_code = 'INSTALL-SPEC') AS installer_id,
    (SELECT id FROM app.d_role WHERE role_code = 'SNOW-OP') AS snow_operator_id
)

INSERT INTO app.rel_employee_role (
  employee_id, role_id, assignment_type, assignment_context, effective_date,
  expiration_date, authority_level, approval_required
)
SELECT 
  seasonal_employees.emma_johnson_id,
  seasonal_roles.installer_id,
  'seasonal',
  'spring_summer_fall',
  '2022-04-01'::date,
  '2022-11-30'::date,
  'seasonal',
  false
FROM seasonal_employees, seasonal_roles

UNION ALL

SELECT 
  seasonal_employees.alex_dubois_id,
  seasonal_roles.snow_operator_id,
  'seasonal',
  'winter_operations',
  '2022-11-15'::date,
  '2023-03-31'::date,
  'seasonal',
  false
FROM seasonal_employees, seasonal_roles;

-- Indexes removed for simplified import