-- ============================================================================
-- EMPLOYEE-ROLE RELATIONSHIPS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Employee-Role relationship table (many-to-many)
-- Manages the assignment of roles to employees with temporal tracking
-- and audit capabilities for compliance and security management.
--
-- Key Features:
-- • Many-to-many relationship between employees and roles
-- • Temporal tracking with from_ts/to_ts for role history
-- • Support for role transitions and assignments
-- • Audit trail for compliance and security reviews

-- ============================================================================
-- DDL:
-- ============================================================================

-- Employee-Role relationship table (many-to-many)
CREATE TABLE app.rel_emp_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert Employee-Role Assignments
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_role WHERE role_code = 'CEO')),
((SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'PM'));
