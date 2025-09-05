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

-- Huron Home Services Employee-Role Assignments
-- Comprehensive role assignments linking employees to their functional roles

-- Executive Leadership Roles
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, authority_level) VALUES
((SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'CEO'), 'primary', 'ultimate'),
((SELECT id FROM app.d_employee WHERE email = 'sarah.chen@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'CFO'), 'primary', 'executive'),
((SELECT id FROM app.d_employee WHERE email = 'david.kumar@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'CTO'), 'primary', 'executive'),
((SELECT id FROM app.d_employee WHERE email = 'maria.rodriguez@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'COO'), 'primary', 'executive');

-- Senior Management Roles
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, authority_level) VALUES
((SELECT id FROM app.d_employee WHERE email = 'robert.thompson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'SVP'), 'primary', 'senior'),
((SELECT id FROM app.d_employee WHERE email = 'jennifer.walsh@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'VP'), 'primary', 'departmental'),
((SELECT id FROM app.d_employee WHERE email = 'michael.patterson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'VP'), 'primary', 'departmental');

-- Professional and Technical Roles
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, authority_level) VALUES
((SELECT id FROM app.d_employee WHERE email = 'amanda.foster@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'LARCH'), 'primary', 'professional'),
((SELECT id FROM app.d_employee WHERE email = 'tom.richardson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'PM'), 'primary', 'standard'),
((SELECT id FROM app.d_employee WHERE email = 'kevin.obrien@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'HVAC-TECH'), 'primary', 'standard'),
((SELECT id FROM app.d_employee WHERE email = 'sandra.mitchell@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'PLUMBER'), 'primary', 'standard');

-- Operational and Field Roles
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, authority_level) VALUES
((SELECT id FROM app.d_employee WHERE email = 'carlos.santos@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'INSTALL-SPEC'), 'primary', 'standard'),
((SELECT id FROM app.d_employee WHERE email = 'mike.wilson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'SNOW-OP'), 'primary', 'standard'),
((SELECT id FROM app.d_employee WHERE email = 'john.macdonald@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'EQUIP-TECH'), 'primary', 'standard'),
((SELECT id FROM app.d_employee WHERE email = 'rachel.kim@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'CSR'), 'primary', 'standard');

-- Supervisory Roles (Secondary assignments for leadership)
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, authority_level) VALUES
((SELECT id FROM app.d_employee WHERE email = 'tom.richardson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'CREW-SUP'), 'secondary', 'supervisory'),
((SELECT id FROM app.d_employee WHERE email = 'lisa.chang@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'DEPT-MGR'), 'primary', 'departmental');

-- James Miller additional roles (CEO often has multiple functional roles)
INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, authority_level, assignment_context) VALUES
((SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'PM'), 'secondary', 'executive', 'Strategic project oversight'),
((SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'SYSADMIN'), 'temporary', 'administrative', 'System setup and configuration phase');
