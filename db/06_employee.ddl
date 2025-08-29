-- ============================================================================
-- EMPLOYEE MANAGEMENT (Identity, Authentication, and People Data)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The employee table serves as the central identity and authentication repository
-- for all human resources within the PMO system. It consolidates personal identity,
-- authentication credentials, and basic demographic information into a unified
-- employee record that serves as the foundation for all HR and access control operations.
--
-- ARCHITECTURAL PURPOSE:
-- The d_emp table serves as the identity backbone that enables:
--
-- • IDENTITY MANAGEMENT: Centralized employee identity and unique identification
-- • AUTHENTICATION: Secure login credentials and password management
-- • PROFILE MANAGEMENT: Basic employee information and contact details
-- • RBAC FOUNDATION: Primary entity for all role-based access control assignments
-- • AUDIT TRAILS: User attribution for all system activities and transactions
-- • HR INTEGRATION: Foundation for HR processes and employee lifecycle management
--
-- AUTHENTICATION INTEGRATION:
-- Employee records support modern authentication patterns:
-- - JWT token-based authentication with secure password hashing (bcrypt)
-- - Email-based login for user-friendly authentication
-- - Password reset and credential management workflows
-- - Multi-factor authentication support through attr field
-- - Single sign-on (SSO) integration capabilities
--
-- CANADIAN CONTEXT:
-- Employee data management considers Canadian privacy and employment regulations:
-- - Personal Information Protection and Electronic Documents Act (PIPEDA) compliance
-- - Provincial privacy legislation compliance (Quebec PPPA, etc.)
-- - Employment equity and diversity reporting capabilities
-- - Bilingual contact and communication preferences
-- - Canadian address formats and postal code validation
--
-- PRIVACY AND SECURITY:
-- Employee data protection follows privacy-by-design principles:
-- - Minimal data collection with explicit purpose limitation
-- - Secure password storage using industry-standard hashing
-- - Audit logging for all access and modifications
-- - Data retention policies and right-to-be-forgotten support
-- - Role-based access to sensitive employee information
--
-- INTEGRATION PATTERNS:
-- Employee records integrate with all system components:
--
-- • HR HIERARCHY: Employees assigned to HR positions through rel_emp_role
-- • BUSINESS UNITS: Employee assignments to business units through projects and tasks
-- • LOCATION ASSIGNMENTS: Geographic assignments through worksite and project associations
-- • PROJECT ASSIGNMENTS: Task assignments and project team memberships
-- • PERMISSION SYSTEM: Direct permissions through rel_user_scope
-- • ROLE ASSIGNMENTS: Role-based permissions through rel_emp_role
--
-- REAL-WORLD PMO SCENARIOS:
--
-- 1. EMPLOYEE ONBOARDING:
--    - New employee record created with basic profile information
--    - Authentication credentials established with secure password
--    - Role assignments made based on job position and responsibilities
--    - Business unit and location assignments configured
--    - Project access granted based on role and business unit scope
--
-- 2. AUTHENTICATION AND ACCESS:
--    - Employee logs in using email and password
--    - JWT token generated with employee ID and basic profile information
--    - Permission system queries rel_user_scope for employee access rights
--    - Business context determined through role and business unit assignments
--
-- 3. EMPLOYEE LIFECYCLE:
--    - Profile updates tracked through updated timestamp
--    - Role changes reflected in permission assignments
--    - Location transfers updated through business and location associations
--    - Departure handled through active flag and data retention policies
--
-- SCALABILITY AND PERFORMANCE:
-- Employee table design supports enterprise-scale operations:
-- - Efficient indexing on email for authentication lookups
-- - Optimized queries for permission resolution
-- - Audit trail support without performance degradation
-- - Bulk operations support for HR processes

-- ============================================================================
-- DDL (Data Definition Language)
-- ============================================================================

CREATE TABLE app.d_emp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  addr text,
  email text UNIQUE,
  password_hash text,
  phone text,
  mobile text,
  emergency_contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  lang text DEFAULT 'en',
  birth_date date,
  emp_code text,
  hire_date date,
  status text DEFAULT 'active',
  employment_type text DEFAULT 'full_time',
  work_mode text DEFAULT 'office',
  security_clearance text DEFAULT 'internal',
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  certifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION (Synthetic Data)
-- ============================================================================

INSERT INTO app.d_emp (
  name, "descr", addr, email, password_hash, phone, mobile, emergency_contact,
  lang, birth_date, emp_code, hire_date, status, employment_type, work_mode,
  security_clearance, skills, certifications, education, labels, attr
) VALUES
('John Smith', 'Senior Project Manager leading cross-functional delivery', '100 King St W, Toronto, ON', 'john.smith@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-0101', '+1-416-555-0102', '{"name":"Jane Smith","relationship":"spouse","phone":"+1-416-555-0103"}'::jsonb,
 'en', '1980-05-15', 'EMP001', '2015-02-01', 'active', 'full_time', 'hybrid', 'internal', '["leadership","project","governance"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '["manager","project"]'::jsonb, '{"portfolio":"platform"}'),
('Jane Doe', 'Senior Backend Developer specializing in Node.js and PostgreSQL', '200 Richmond St W, Toronto, ON', 'jane.doe@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-0201', '+1-416-555-0202', '{"name":"Michael Doe","relationship":"brother","phone":"+1-416-555-0203"}'::jsonb,
 'en', '1987-11-22', 'EMP002', '2018-07-15', 'active', 'full_time', 'hybrid', 'internal', '["node_js","postgresql","typescript","api_design"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '["developer","backend"]'::jsonb, '{"team":"api"}'),
('Bob Wilson', 'Systems Administrator responsible for infrastructure and security', '300 Bay St, Toronto, ON', 'bob.wilson@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-0301', '+1-416-555-0302', '{"name":"Anna Wilson","relationship":"spouse","phone":"+1-416-555-0303"}'::jsonb,
 'en', '1982-03-10', 'EMP003', '2016-10-01', 'active', 'full_time', 'office', 'internal', '["linux","docker","kubernetes","networking"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '["admin","systems"]'::jsonb, '{"on_call":true}'),
('Alice Johnson', 'Product Manager coordinating feature planning and stakeholder management', '400 Queen St W, Toronto, ON', 'alice.johnson@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-0401', '+1-416-555-0402', '{"name":"Robert Johnson","relationship":"spouse","phone":"+1-416-555-0403"}'::jsonb,
 'en', '1985-06-15', 'EMP004', '2019-04-01', 'active', 'full_time', 'hybrid', 'public', '["product_management","stakeholder_management","agile"]'::jsonb, '[]'::jsonb, '[]'::jsonb, '["product","management"]'::jsonb, '{"portfolio":"web"}'),
('Mike Chen', 'Senior Backend Engineer with expertise in Java, Spring framework, and distributed systems architecture', '654 Yonge St, Toronto, ON M4Y 2A6', 'mike.chen@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-0501', '+1-416-555-0502', '{"name": "Lisa Chen", "relationship": "sister", "phone": "+1-416-555-0503"}'::jsonb,
 'en', '1990-09-03', 'EMP005', '2021-05-01', 'active', 'full_time', 'remote', 'public', '["java", "spring", "microservices", "postgresql", "redis", "kafka", "rest_apis", "system_design"]'::jsonb, '["Oracle Java Certified Professional", "Spring Professional"]'::jsonb, '[{"degree": "B.Sc Computer Science", "institution": "University of Waterloo", "year": 2012}]'::jsonb, '["intermediate", "backend", "java"]'::jsonb, '{"code_review_mentor": true, "open_source_contributor": true}'),
('Sarah Lee', 'QA Engineer and Test Automation Specialist ensuring software quality and reliability', '987 Adelaide St W, Toronto, ON M6J 2S8', 'sarah.lee@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-0601', '+1-416-555-0602', '{"name": "Emergency Contact Service", "phone": "+1-416-555-0603"}'::jsonb,
 'en', '1988-12-18', 'EMP006', '2019-08-01', 'active', 'full_time', 'hybrid', 'public', '["test_automation", "selenium", "cypress", "junit", "performance_testing", "api_testing", "quality_assurance"]'::jsonb, '["ISTQB Foundation Level", "Selenium WebDriver", "Agile Testing"]'::jsonb, '[{"degree": "B.Sc Software Engineering", "institution": "McMaster University", "year": 2011}]'::jsonb, '["intermediate", "qa", "automation"]'::jsonb, '{"quality_champion": true, "automation_framework_lead": true}'),
('Daniel Brown', 'Junior Full Stack Developer learning modern web development technologies', '150 Bloor St W, Toronto, ON M5S 2X9', 'daniel.brown@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-0701', '+1-416-555-0702', '{"name": "Contact Service", "phone": "+1-416-555-0703"}'::jsonb,
 'en', '1995-04-25', 'EMP007', '2022-09-01', 'active', 'full_time', 'office', 'public', '["javascript", "react", "node_js", "python", "sql", "git", "learning"]'::jsonb, '["freeCodeCamp Full Stack"]'::jsonb, '[{"degree": "B.Sc Computer Science", "institution": "York University", "year": 2022}]'::jsonb, '["junior", "full-stack", "new-grad"]'::jsonb, '{"mentorship_program": true, "graduate_program_participant": true}'),
('Emma Wilson', 'Product Manager responsible for feature planning and stakeholder coordination', '275 University Ave, Toronto, ON M5H 2M5', 'emma.wilson@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-0801', '+1-416-555-0802', '{"name": "Robert Wilson", "relationship": "spouse", "phone": "+1-416-555-0803"}'::jsonb,
 'en', '1983-08-12', 'EMP008', '2020-11-01', 'active', 'full_time', 'hybrid', 'public', '["product_management", "stakeholder_management", "agile", "roadmap_planning", "user_stories", "market_research"]'::jsonb, '["Certified Product Manager", "Agile Product Owner"]'::jsonb, '[{"degree": "MBA", "institution": "Rotman School of Management", "year": 2015}, {"degree": "B.Comm", "institution": "Queens University", "year": 2005}]'::jsonb, '["intermediate", "product", "management"]'::jsonb, '{"cross_functional_leader": true, "customer_focus": true}'),
('Alex Kim', 'Co-op Software Engineering Student from University of Waterloo', '200 University Ave W, Waterloo, ON N2L 3G1', 'alex.kim@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-519-555-0901', '+1-519-555-0902', '{"name": "Student Services", "phone": "+1-519-888-4567"}'::jsonb,
 'en', '2001-02-14', 'COOP001', '2024-01-08', 'active', 'intern', 'remote', 'public', '["python", "java", "javascript", "react", "sql", "data_structures", "algorithms"]'::jsonb, '[]'::jsonb, '[{"degree": "B.ASc Software Engineering", "institution": "University of Waterloo", "year": "2025 (expected)", "gpa": 3.8}]'::jsonb, '["co-op", "student", "waterloo"]'::jsonb, '{"co_op_term": "Winter 2024", "academic_program": "Software Engineering", "expected_graduation": "2025-06-01"}'),
('Taylor Singh', 'Marketing Intern supporting digital marketing and content creation initiatives', '100 College St, Toronto, ON M5G 1L5', 'taylor.singh@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '+1-416-555-1001', '+1-416-555-1002', '{"name": "Campus Services", "phone": "+1-416-978-2011"}'::jsonb,
 'en', '2000-06-30', 'INTERN001', '2024-05-01', 'active', 'intern', 'hybrid', 'public', '["digital_marketing", "content_creation", "social_media", "analytics", "adobe_creative_suite"]'::jsonb, '["Google Analytics", "HubSpot Content Marketing"]'::jsonb, '[{"degree": "Bachelor of Commerce", "institution": "University of Toronto", "year": "2024 (expected)", "major": "Marketing"}]'::jsonb, '["intern", "marketing", "student"]'::jsonb, '{"internship_duration": "4 months", "academic_program": "Commerce - Marketing", "expected_graduation": "2024-06-01"}');
