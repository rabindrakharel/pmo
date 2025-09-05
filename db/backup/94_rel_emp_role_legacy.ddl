-- ============================================================================
-- EMPLOYEE-ROLE RELATIONSHIP TABLE (LEGACY)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Legacy employee-role relationship table from original schema structure.
--   Simpler many-to-many relationship between employees and roles without
--   the temporal and contextual features of the enhanced relationship table.
--
-- Note:
--   This is the original rel_emp_role table extracted from 06_role.ddl
--   Consider consolidating with 90_rel_employee_role.ddl which has enhanced features
--
-- Integration:
--   - Links d_employee to d_role for basic role assignments
--   - Simpler structure than the enhanced rel_employee_role table
--   - May be deprecated in favor of enhanced relationship model

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.rel_emp_role_legacy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relationship fields
  emp_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  
  -- Basic temporal and audit fields
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  -- Simple unique constraint
  UNIQUE(emp_id, role_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Legacy Employee-Role Assignments
-- Note: This data references legacy role definitions and employee names
-- that may not exist in the current Huron Home Services schema

-- These assignments are commented out as they reference legacy roles and employees
-- that are not part of the current Huron Home Services business model
/*
INSERT INTO app.rel_emp_role_legacy (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_role WHERE name = 'Project Manager')),
((SELECT id FROM app.d_employee WHERE name = 'Sarah Chen'), (SELECT id FROM app.d_role WHERE name = 'System Administrator')),
((SELECT id FROM app.d_employee WHERE name = 'Robert Thompson'), (SELECT id FROM app.d_role WHERE name = 'Project Manager')),
((SELECT id FROM app.d_employee WHERE name = 'Michael O''Brien'), (SELECT id FROM app.d_role WHERE name = 'Senior Developer')),
((SELECT id FROM app.d_employee WHERE name = 'Lisa Rodriguez'), (SELECT id FROM app.d_role WHERE name = 'QA Engineer')),
((SELECT id FROM app.d_employee WHERE name = 'Emma Foster'), (SELECT id FROM app.d_role WHERE name = 'Product Manager'));
*/

-- For migration purposes, consider mapping legacy roles to new Huron Home Services roles:
-- Legacy 'Project Manager' -> Current 'Project Manager' (PM role_code)
-- Legacy 'System Administrator' -> Current 'System Administrator' (SYSADMIN role_code)
-- Legacy 'Senior Developer' -> Current 'API Integration Specialist' (API-SPEC role_code)
-- Legacy 'QA Engineer' -> Current 'Customer Service Representative' (CSR role_code)
-- Legacy 'Product Manager' -> Current 'Department Manager' (DEPT-MGR role_code)

-- Indexes removed for simplified import