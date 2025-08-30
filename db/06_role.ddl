-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Role management system providing foundation for Role-Based Access Control (RBAC)
-- with reusable permission templates aligned to job functions and organizational hierarchy.
--
-- Key Features:
-- • Permission templating and scalable access control
-- • Employee-to-role assignments with temporal tracking
-- • Integration with business hierarchy and organizational alignment
-- • Auditable permission assignments and compliance management

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Role-specific fields
  role_type text DEFAULT 'functional',
  role_category text,
  authority_level text DEFAULT 'standard',
  approval_limit numeric(12,2),
  delegation_allowed boolean DEFAULT false
);

-- Employee-Role relationship table (many-to-many)
CREATE TABLE app.rel_emp_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION:
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
((SELECT id FROM app.d_employee WHERE name = 'James Miller'), (SELECT id FROM app.d_role WHERE name = 'Project Manager'), '["ceo", "executive"]'::jsonb),
((SELECT id FROM app.d_employee WHERE name = 'Sarah Chen'), (SELECT id FROM app.d_role WHERE name = 'System Administrator'), '["operations", "director"]'::jsonb),
((SELECT id FROM app.d_employee WHERE name = 'Robert Thompson'), (SELECT id FROM app.d_role WHERE name = 'Project Manager'), '["landscaping", "manager"]'::jsonb),
((SELECT id FROM app.d_employee WHERE name = 'Michael O''Brien'), (SELECT id FROM app.d_role WHERE name = 'Senior Developer'), '["plumbing", "manager"]'::jsonb),
((SELECT id FROM app.d_employee WHERE name = 'Lisa Rodriguez'), (SELECT id FROM app.d_role WHERE name = 'QA Engineer'), '["hvac", "technician"]'::jsonb),
((SELECT id FROM app.d_employee WHERE name = 'Emma Foster'), (SELECT id FROM app.d_role WHERE name = 'Product Manager'), '["customer_service", "representative"]'::jsonb);
