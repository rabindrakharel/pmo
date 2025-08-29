-- ============================================================================
-- ROLE MANAGEMENT SYSTEM (RBAC Foundation)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The role management system provides the foundation for Role-Based Access Control (RBAC)
-- within the PMO platform. It defines reusable permission templates that can be assigned
-- to employees, enabling consistent and scalable access control across the organization.
--
-- ARCHITECTURAL PURPOSE:
-- • PERMISSION TEMPLATING: Predefined permission sets aligned with job functions
-- • SCALABLE ACCESS CONTROL: Consistent permissions for employees with similar responsibilities
-- • ORGANIZATIONAL ALIGNMENT: Role definitions that match business hierarchy and functions
-- • COMPLIANCE MANAGEMENT: Auditable permission assignments with role-based justification

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The role management system (RBAC foundation) defines reusable permission templates
-- that can be consistently assigned to employees. Roles group permissions by job
-- function and authority, enabling scalable, auditable, and explainable access control.
--
-- ARCHITECTURAL PURPOSE:
-- • PERMISSION TEMPLATING: Predefined permission bundles aligned to functions
-- • SCALABLE ACCESS CONTROL: Consistent permissions for similar responsibilities
-- • ORGANIZATIONAL ALIGNMENT: Role categories reflect business structures
-- • COMPLIANCE & AUDIT: Time-bounded assignments with change history
--
-- INTEGRATION PATTERNS:
-- • rel_emp_role: Many-to-many mapping between employees and roles
-- • Permission Resolution: Roles later map to scopes/resources via permission tables
-- • Temporal Model: from_ts/to_ts support effective-dating of assignments
-- • Attributes & Tags: jsonb fields support flexible metadata and classification
--
-- REAL-WORLD SCENARIOS:
-- • Project staffing assigns PM, Dev, QA roles to employees
-- • Elevated roles (e.g., System Administrator) audited and time-limited
-- • Temporary roles for co-op/student placements with narrow permissions

CREATE TABLE app.d_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  role_type text DEFAULT 'functional',
  role_category text,
  authority_level text DEFAULT 'standard',
  approval_limit numeric(12,2),
  delegation_allowed boolean DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Employee-Role relationship table (many-to-many)
CREATE TABLE app.rel_emp_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
-- ============================================================================

-- Insert Role Definitions
INSERT INTO app.d_role (name, "descr", role_type, role_category, authority_level, approval_limit, delegation_allowed, tags) VALUES
('Project Manager', 'Project lifecycle management and team coordination', 'functional', 'Management', 'elevated', 100000.00, true, '["manager", "project"]'::jsonb),
('Senior Developer', 'Technical leadership and code review authority', 'functional', 'Technical', 'elevated', 50000.00, false, '["senior", "developer"]'::jsonb),
('System Administrator', 'Infrastructure and system configuration access', 'administrative', 'IT Operations', 'administrative', 500000.00, true, '["admin", "system"]'::jsonb),
('DevOps Engineer', 'Infrastructure automation and deployment', 'functional', 'Technical', 'elevated', 75000.00, false, '["devops", "infrastructure"]'::jsonb),
('QA Engineer', 'Quality assurance and testing responsibilities', 'functional', 'Quality Assurance', 'standard', 30000.00, false, '["qa", "testing"]'::jsonb),
('Backend Developer', 'Server-side development and API design', 'functional', 'Technical', 'standard', 25000.00, false, '["developer", "backend"]'::jsonb),
('Frontend Developer', 'Client-side development and UI/UX', 'functional', 'Technical', 'standard', 25000.00, false, '["developer", "frontend"]'::jsonb),
('Product Manager', 'Product strategy and roadmap management', 'functional', 'Product', 'elevated', 150000.00, false, '["manager", "product"]'::jsonb),
('Junior Developer', 'Entry-level development with mentorship', 'functional', 'Technical', 'basic', 5000.00, false, '["junior", "developer"]'::jsonb),
('Co-op Student', 'Student placement for experiential learning', 'temporary', 'Student', 'basic', 1000.00, false, '["co-op", "student"]'::jsonb);

-- Insert Employee-Role Assignments
INSERT INTO app.rel_emp_role (emp_id, role_id, tags) VALUES
((SELECT id FROM app.d_emp WHERE name = 'John Smith'), (SELECT id FROM app.d_role WHERE name = 'Project Manager'), '["primary"]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'), (SELECT id FROM app.d_role WHERE name = 'Senior Developer'), '["senior"]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'), (SELECT id FROM app.d_role WHERE name = 'System Administrator'), '["admin"]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'), (SELECT id FROM app.d_role WHERE name = 'Product Manager'), '["product"]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'), (SELECT id FROM app.d_role WHERE name = 'Backend Developer'), '["backend"]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'), (SELECT id FROM app.d_role WHERE name = 'QA Engineer'), '["qa"]'::jsonb);
