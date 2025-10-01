-- ============================================================================
-- XXVIII. EMPLOYEE ENTITIES
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Employee entities representing human resources within the organization.
--   Manages personnel data, authentication credentials, contact information,
--   organizational assignments, and compliance tracking for the PMO system.
--
-- Entity Type: employee
-- Entity Classification: Core Personnel Entity (foundation for RBAC and assignments)
--
-- Parent Entities:
--   - office (employees are assigned to office locations)
--   - biz (employees belong to business units)
--   - position (employees hold organizational positions)
--
-- Action Entities:
--   - project (employees are assigned to projects)
--   - task (employees are assigned tasks)
--   - role (employees are assigned roles via rel_emp_role)
--   - form (employees submit and approve forms)
--   - artifact (employees create and manage artifacts)
--   - wiki (employees contribute to knowledge base)
--
-- Employee Types and Classifications:
--   - Full-time: Regular full-time employees
--   - Part-time: Regular part-time employees
--   - Contract: Contract workers and consultants
--   - Temporary: Temporary workers
--   - Intern: Student interns and co-op students
--
-- New Design Integration:
--   - Maps to entity_id_hierarchy_mapping for parent-child relationships
--   - No direct foreign keys to other entities (follows new standard)
--   - Supports RBAC via entity_id_rbac_map table
--   - Uses common field structure across all entities
--   - Includes metadata jsonb field for extensibility
--   - Authentication handled via email/password with JWT tokens
--
-- Authentication and Security:
--   - Primary authentication via email and hashed password
--   - JWT token-based session management
--   - RBAC permissions via entity_id_rbac_map
--   - Support for password reset and account lockout
--   - Audit trail for security compliance
--
-- UI Navigation Model:
--   - Appears in sidebar menu as "Employee"
--   - Main page shows FilteredDataTable with searchable/filterable employees
--   - Row click navigates to Employee Detail Page
--   - Detail page shows Overview tab + child entity tabs (projects, tasks, etc.)
--   - Inline editing available on detail page with RBAC permission checks
--   - Employee directory and organizational chart views
--
-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Standard fields (common across all entities) - ALWAYS FIRST
  slug varchar(255),
  code varchar(100),
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active_flag boolean NOT NULL DEFAULT true,
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now(),
  version int DEFAULT 1,

  -- Employee-specific fields
  employee_number varchar(50) UNIQUE,
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255),
  first_name varchar(100),
  last_name varchar(100),

  -- Contact information
  phone varchar(20),
  mobile varchar(20),
  emergency_contact_name varchar(200),
  emergency_contact_phone varchar(20),

  -- Address information
  address_line1 varchar(200),
  address_line2 varchar(200),
  city varchar(100),
  province varchar(100),
  postal_code varchar(20),
  country varchar(100) DEFAULT 'Canada',

  -- Employment details
  employee_type varchar(50) DEFAULT 'full-time', -- full-time, part-time, contract, temporary, intern
  department varchar(100),
  title varchar(200),
  hire_date date,
  termination_date date,

  -- Compensation and HR
  salary_band varchar(50),
  pay_grade varchar(20),
  manager_employee_id uuid, -- Self-reference for reporting structure

  -- Authentication and security
  last_login_ts timestamptz,
  password_reset_token varchar(255),
  password_reset_expires timestamptz,
  failed_login_attempts integer DEFAULT 0,
  account_locked_until timestamptz,

  -- Compliance and tracking
  sin varchar(20), -- Social Insurance Number (Canada)
  birthdate date,
  citizenship varchar(100),
  security_clearance varchar(50),

  -- Work preferences and attributes
  remote_work_eligible boolean DEFAULT false,
  time_zone varchar(50) DEFAULT 'America/Toronto',
  preferred_language varchar(10) DEFAULT 'en',

  -- Metadata for extensibility
  metadata jsonb DEFAULT '{}'::jsonb
);



-- Insert sample employee data for James Miller CEO
INSERT INTO app.d_employee (
    id,
    slug,
    code,
    name,
    descr,
    tags,
    employee_number,
    email,
    password_hash,
    first_name,
    last_name,
    phone,
    mobile,
    address_line1,
    city,
    province,
    postal_code,
    country,
    employee_type,
    department,
    title,
    hire_date,
    salary_band,
    pay_grade,
    sin,
    citizenship,
    security_clearance,
    remote_work_eligible,
    time_zone,
    preferred_language,
    metadata
) VALUES (
    '8260b1b0-5efc-4611-ad33-ee76c0cf7f13',
    'james-miller-ceo',
    'EMP-001',
    'James Miller',
    'Chief Executive Officer and Founder of Huron Home Services. Responsible for overall strategic direction, business development, and organizational leadership.',
    '["CEO", "founder", "executive", "leadership", "strategy"]'::jsonb,
    'EMP-001',
    'james.miller@huronhome.ca',
    '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', -- hashed: password123
    'James',
    'Miller',
    '+1-519-555-0001',
    '+1-519-555-0101',
    '123 Executive Drive',
    'London',
    'Ontario',
    'N6A 1A1',
    'Canada',
    'full-time',
    'Executive',
    'Chief Executive Officer',
    '2020-01-01',
    'Executive',
    'C1',
    '123-456-789',
    'Canadian',
    'Enhanced',
    true,
    'America/Toronto',
    'en',
    '{
        "employee_preferences": {
            "notification_methods": ["email", "sms"],
            "work_hours": {"start": "08:00", "end": "18:00"},
            "signature": "James Miller, CEO\nHuron Home Services\n519-555-0001"
        },
        "authority_levels": {
            "approval_limit": 1000000,
            "budget_authority": "unlimited",
            "hiring_authority": "all_levels"
        }
    }'::jsonb
);

-- Additional sample employees for testing
INSERT INTO app.d_employee (
    slug,
    code,
    name,
    descr,
    employee_number,
    email,
    password_hash,
    first_name,
    last_name,
    phone,
    employee_type,
    department,
    title,
    hire_date,
    manager_employee_id
) VALUES
('sarah-johnson-coo', 'EMP-002', 'Sarah Johnson', 'Chief Operating Officer responsible for day-to-day operations', 'EMP-002', 'sarah.johnson@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', 'Sarah', 'Johnson', '+1-519-555-0002', 'full-time', 'Operations', 'Chief Operating Officer', '2020-02-01', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'),
('michael-chen-cto', 'EMP-003', 'Michael Chen', 'Chief Technology Officer overseeing IT infrastructure and development', 'EMP-003', 'michael.chen@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', 'Michael', 'Chen', '+1-519-555-0003', 'full-time', 'Technology', 'Chief Technology Officer', '2020-03-01', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'),
('lisa-rodriguez-vp-sales', 'EMP-004', 'Lisa Rodriguez', 'Vice President of Sales managing client relationships and revenue', 'EMP-004', 'lisa.rodriguez@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', 'Lisa', 'Rodriguez', '+1-519-555-0004', 'full-time', 'Sales', 'Vice President of Sales', '2020-04-01', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13'),
('david-thompson-pm', 'EMP-005', 'David Thompson', 'Senior Project Manager for landscaping and maintenance projects', 'EMP-005', 'david.thompson@huronhome.ca', '$2b$12$xaFJV661x3Rypk4Da27JduU/lZPphBowruE0iha9G3c8h9xwslEQq', 'David', 'Thompson', '+1-519-555-0005', 'full-time', 'Operations', 'Senior Project Manager', '2020-05-01', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13');

COMMENT ON TABLE app.d_employee IS 'Employee entities with authentication, contact info, and organizational assignments';