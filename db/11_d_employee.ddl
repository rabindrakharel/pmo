-- =====================================================
-- EMPLOYEE ENTITY (d_employee) - CORE PERSONNEL ENTITY
-- User accounts, authentication, RBAC foundation, and HR management
-- =====================================================
--
-- BUSINESS PURPOSE:
-- Central employee/user table managing authentication, RBAC identity, contact info,
-- organizational assignments, and compliance data. Every RBAC permission in
-- entity_id_rbac_map references an employee via empid field.
--
-- API SEMANTICS & LIFECYCLE:
--
-- 1. LOGIN / AUTHENTICATION
--    • Endpoint: POST /api/v1/auth/login
--    • Body: {email: "james.miller@huronhome.ca", password: "password123"}
--    • Database: SELECT id, email, password_hash, name FROM d_employee WHERE email=$1 AND active_flag=true
--    • Verification: bcrypt.compare($password, password_hash)
--    • Returns: {token: "JWT", user: {sub: id, email, name}}
--    • Business Rule: JWT token contains employee.id as 'sub' claim for RBAC lookups
--
-- 2. CREATE EMPLOYEE (HR Onboarding)
--    • Endpoint: POST /api/v1/employee
--    • Body: {name, email, employee_number, employee_type, title, manager_employee_id}
--    • Database: INSERT with version=1, active_flag=true, password_hash=bcrypt.hash(temp_password)
--    • RBAC: Requires permission 4 (create) on entity='employee', entity_id='all'
--    • Business Rule: Auto-sends welcome email with password reset link
--
-- 3. UPDATE EMPLOYEE (Profile, Org Changes, Compensation)
--    • Endpoint: PUT /api/v1/employee/{id}
--    • Body: {title, department, manager_employee_id, salary_band, remote_work_eligible}
--    • Database: UPDATE SET [fields], version=version+1, updated_ts=now() WHERE id=$1
--    • SCD Behavior: IN-PLACE UPDATE (title changes don't create history)
--    • RBAC: Requires permission 1 (edit) - may have field-level restrictions
--
-- 4. SOFT DELETE / TERMINATION
--    • Endpoint: DELETE /api/v1/employee/{id}
--    • Database: UPDATE SET active_flag=false, to_ts=now(), termination_date=now() WHERE id=$1
--    • Business Rule: Preserves authentication history; RBAC permissions remain but ineffective
--
-- 5. LIST EMPLOYEES (Directory View)
--    • Endpoint: GET /api/v1/employee?department=Operations&employee_type=full-time
--    • Database:
--      SELECT e.* FROM d_employee e
--      WHERE active_flag=true
--        AND EXISTS (SELECT 1 FROM entity_id_rbac_map WHERE empid=$user_id AND entity='employee' AND 0=ANY(permission))
--      ORDER BY name ASC
--    • RBAC: Filtered by view permission
--    • Frontend: Renders in EntityMainPage as searchable employee directory
--
-- 6. PASSWORD RESET
--    • Endpoint: POST /api/v1/auth/reset-password
--    • Body: {email}
--    • Database: UPDATE SET password_reset_token=$1, password_reset_expires=now()+interval '1 hour' WHERE email=$2
--    • Returns: Email sent with reset link
--
-- 7. ACCOUNT LOCKOUT (Security)
--    • Trigger: 5 failed login attempts
--    • Database: UPDATE SET failed_login_attempts=failed_login_attempts+1, account_locked_until=now()+interval '30 minutes'
--    • Business Rule: Auto-unlocks after 30 minutes or admin intervention
--
-- KEY SCD FIELDS:
-- • id: Stable UUID (RBAC identity, never changes)
-- • version: Increments on org/profile updates
-- • from_ts: Hire date (original record creation)
-- • to_ts: Termination date (soft delete timestamp)
-- • active_flag: Employment status (true=active, false=terminated)
-- • created_ts: Account creation
-- • updated_ts: Last profile modification
--
-- KEY BUSINESS FIELDS:
-- • email: Unique login identifier (username)
-- • password_hash: bcrypt hashed password (never returned by API)
-- • employee_number: HR system identifier
-- • employee_type: full-time, part-time, contract, temporary, intern
-- • manager_employee_id: Reporting structure (self-referencing FK)
-- • last_login_ts: Session tracking
-- • failed_login_attempts: Security lockout mechanism
--
-- AUTHENTICATION FLOW:
-- 1. User submits email/password → API checks d_employee.email
-- 2. bcrypt verifies password_hash
-- 3. JWT issued with {sub: employee.id, email, name}
-- 4. All subsequent requests include JWT → Middleware extracts employee.id
-- 5. entity_id_rbac_map queries use employee.id as empid for permission checks
--
-- RBAC INTEGRATION:
-- • Every permission in entity_id_rbac_map has empid = d_employee.id
-- • Employee's permissions queried as: SELECT * FROM entity_id_rbac_map WHERE empid={token.sub}
-- • Termination (active_flag=false) doesn't delete permissions but makes them ineffective
--
-- RELATIONSHIPS:
-- • manager_employee_id → d_employee (self-reference for org chart)
-- • empid ← entity_id_rbac_map (all RBAC permissions)
-- • assignee_employee_ids[] ← d_task (task assignments)
-- • manager_employee_id ← d_project (project management)
--
-- =====================================================

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