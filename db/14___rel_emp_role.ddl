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
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'CEO')),
((SELECT id FROM app.d_employee WHERE email = 'sarah.chen@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'CFO')),
((SELECT id FROM app.d_employee WHERE email = 'david.kumar@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'CTO')),
((SELECT id FROM app.d_employee WHERE email = 'maria.rodriguez@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'COO'));

-- Senior Management Roles
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE email = 'robert.thompson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'SVP'));

-- Vice Presidents and Directors
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE email = 'lisa.wang@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'VP-HR')),
((SELECT id FROM app.d_employee WHERE email = 'michael.oconnor@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'DIR-FIN')),
((SELECT id FROM app.d_employee WHERE email = 'jennifer.park@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'DIR-IT'));

-- Department Managers
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE email = 'carlos.martinez@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'MGR-LAND')),
((SELECT id FROM app.d_employee WHERE email = 'david.kowalski@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'MGR-SNOW')),
((SELECT id FROM app.d_employee WHERE email = 'amanda.foster@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'MGR-HVAC')),
((SELECT id FROM app.d_employee WHERE email = 'tony.ricci@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'MGR-PLUMB')),
((SELECT id FROM app.d_employee WHERE email = 'sarah.kim@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'MGR-SOLAR'));

-- Field Supervisors and Senior Technicians
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE email = 'mark.thompson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'SUP-FIELD')),
((SELECT id FROM app.d_employee WHERE email = 'rachel.green@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'SUP-FIELD')),
((SELECT id FROM app.d_employee WHERE email = 'james.wilson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'TECH-SR')),
((SELECT id FROM app.d_employee WHERE email = 'maria.santos@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'TECH-SR')),
((SELECT id FROM app.d_employee WHERE email = 'kevin.chang@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'TECH-SR'));

-- Field Technicians
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE email = 'james.wilson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'TECH-FIELD')),
((SELECT id FROM app.d_employee WHERE email = 'maria.santos@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'TECH-FIELD')),
((SELECT id FROM app.d_employee WHERE email = 'kevin.chang@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'TECH-FIELD'));

-- Administrative and Support Staff
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE email = 'catherine.brooks@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'COORD-PROJ')),
((SELECT id FROM app.d_employee WHERE email = 'daniel.lee@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'ANALYST-FIN')),
((SELECT id FROM app.d_employee WHERE email = 'sophie.dubois@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'COORD-HR')),
((SELECT id FROM app.d_employee WHERE email = 'alex.johnson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'ADMIN-IT'));

-- Seasonal and Part-time Workers
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES
((SELECT id FROM app.d_employee WHERE email = 'tyler.murphy@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'SEASONAL')),
((SELECT id FROM app.d_employee WHERE email = 'emma.wilson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'SEASONAL')),
((SELECT id FROM app.d_employee WHERE email = 'jake.patterson@huronhome.ca'), (SELECT id FROM app.d_role WHERE role_code = 'PT-SUPPORT'));
