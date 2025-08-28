-- ============================================================================
-- PMO Database Schema - Complete Unified Schema
-- Generated from all .ddl files in dependency order with curated data
-- Updated with table renames and permission structure changes
-- ============================================================================

-- ============================================================================
-- EXTENSIONS AND SCHEMA SETUP
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS app;

-- ============================================================================
-- META TABLES (Level Definitions) - First Order
-- ============================================================================

-- Business Level Definitions
CREATE TABLE app.meta_biz_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_biz_level (level_id, name, tags) VALUES
(1, 'Corporation', '[]'::jsonb),
(2, 'Division', '[]'::jsonb),
(3, 'Department', '[]'::jsonb),
(4, 'Team', '[]'::jsonb),
(5, 'Sub-team', '[]'::jsonb);

-- Location Level Definitions
CREATE TABLE app.meta_loc_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_loc_level (level_id, name, tags) VALUES
(1, 'Corp-Region', '[]'::jsonb),
(2, 'Country', '[]'::jsonb),
(3, 'Province', '[]'::jsonb),
(4, 'Region', '[]'::jsonb),
(5, 'City', '[]'::jsonb);

-- HR Level Definitions
CREATE TABLE app.meta_hr_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_hr_level (level_id, name, tags) VALUES
(1, 'C-Level', '[]'::jsonb),
(2, 'VP Level', '[]'::jsonb),
(3, 'Director', '[]'::jsonb),
(4, 'Manager', '[]'::jsonb),
(5, 'Team Lead', '[]'::jsonb),
(6, 'Senior Manager', '[]'::jsonb),
(7, 'Associate Manager', '[]'::jsonb),
(8, 'Engineer', '[]'::jsonb);

-- Project Status and Stages
CREATE TABLE app.meta_project_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_id int NOT NULL,
  is_final boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_project_status (code, name, sort_id, is_final, tags) VALUES
('DRAFT', 'Draft', 1, false, '[]'::jsonb),
('PLANNING', 'Planning', 2, false, '[]'::jsonb),
('APPROVED', 'Approved', 3, false, '[]'::jsonb),
('ACTIVE', 'Active', 4, false, '[]'::jsonb),
('ON_HOLD', 'On Hold', 5, false, '[]'::jsonb),
('COMPLETED', 'Completed', 6, true, '[]'::jsonb),
('CANCELLED', 'Cancelled', 7, true, '[]'::jsonb);

CREATE TABLE app.meta_project_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_project_stage (level_id, name, tags) VALUES
(1, 'Initiation', '[]'::jsonb),
(2, 'Planning', '[]'::jsonb),
(3, 'Execution', '[]'::jsonb),
(4, 'Monitoring', '[]'::jsonb),
(5, 'Closure', '[]'::jsonb);

-- Task Status and Stages
CREATE TABLE app.meta_task_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_id int NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_task_status (code, name, sort_id, tags) VALUES
('OPEN', 'Open', 1, '[]'::jsonb),
('IN_PROGRESS', 'In Progress', 2, '[]'::jsonb),
('BLOCKED', 'Blocked', 3, '[]'::jsonb),
('REVIEW', 'Under Review', 4, '[]'::jsonb),
('DONE', 'Done', 5, '[]'::jsonb),
('CLOSED', 'Closed', 6, '[]'::jsonb);

CREATE TABLE app.meta_task_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_id int NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_done boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  color text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_task_stage (code, name, sort_id, is_default, is_done, is_blocked, color, tags) VALUES
('backlog', 'Backlog', 1, true, false, false, '#6B7280', '[]'::jsonb),
('todo', 'To Do', 2, false, false, false, '#3B82F6', '[]'::jsonb),
('in_progress', 'In Progress', 3, false, false, false, '#F59E0B', '[]'::jsonb),
('review', 'Review', 4, false, false, false, '#8B5CF6', '[]'::jsonb),
('done', 'Done', 5, false, true, false, '#10B981', '[]'::jsonb),
('blocked', 'Blocked', 6, false, false, true, '#EF4444', '[]'::jsonb);

-- Tasklog States & Types
CREATE TABLE app.meta_tasklog_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_id int NOT NULL,
  terminal boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_tasklog_state (code, name, sort_id, terminal, tags) VALUES
('draft', 'Draft', 1, false, '[]'::jsonb),
('submitted', 'Submitted', 2, false, '[]'::jsonb),
('in_review', 'In Review', 3, false, '[]'::jsonb),
('approved', 'Approved', 4, true, '[]'::jsonb),
('rejected', 'Rejected', 5, true, '[]'::jsonb),
('archived', 'Archived', 6, true, '[]'::jsonb);

CREATE TABLE app.meta_tasklog_type (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_id int NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.meta_tasklog_type (code, name, sort_id, tags) VALUES
('comment', 'Comment', 1, '[]'::jsonb),
('image', 'Image', 2, '[]'::jsonb),
('voice', 'Voice Note', 3, '[]'::jsonb),
('email', 'Email', 4, '[]'::jsonb),
('document', 'Document', 5, '[]'::jsonb),
('video', 'Video', 6, '[]'::jsonb);

-- ============================================================================
-- APP PERMISSION SYSTEM - Second Order
-- ============================================================================

CREATE TABLE app.d_app_permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  "descr" text,
  sort_id int NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_app_permission (name, code, "descr", sort_id, is_system, tags) VALUES
('View', 'VIEW', 'Permission to view entities', 1, true, '[]'::jsonb),
('Create', 'CREATE', 'Permission to create new entities', 2, true, '[]'::jsonb),
('Modify', 'MODIFY', 'Permission to modify existing entities', 3, true, '[]'::jsonb),
('Delete', 'DELETE', 'Permission to delete entities', 4, true, '[]'::jsonb),
('Grant', 'GRANT', 'Permission to grant permissions to others', 5, true, '[]'::jsonb),
('Share', 'SHARE', 'Permission to share entities with others', 6, true, '[]'::jsonb);

-- ============================================================================
-- SCOPE HIERARCHY TABLES - Third Order
-- ============================================================================

-- Location hierarchy with Canadian structure
CREATE TABLE app.d_scope_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  addr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_loc_level(level_id),
  parent_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  geom geometry(Geometry, 4326),
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_scope_location (name, "descr", addr, from_ts, level_id, parent_id, tags) VALUES
-- Corp Region Level
('North America', 'North American corporate region', NULL, now(), 1, NULL, '[]'::jsonb),

-- Country Level
('Canada', 'Dominion of Canada', NULL, now(), 2, (SELECT id FROM app.d_scope_location WHERE name = 'North America'), '[]'::jsonb),

-- Province Level
('Ontario', 'Province of Ontario', NULL, now(), 3, (SELECT id FROM app.d_scope_location WHERE name = 'Canada'), '[]'::jsonb),

-- Regional Level
('Southern Ontario', 'Southern Ontario region', NULL, now(), 4, (SELECT id FROM app.d_scope_location WHERE name = 'Ontario'), '[]'::jsonb),
('Northern Ontario', 'Northern Ontario region', NULL, now(), 4, (SELECT id FROM app.d_scope_location WHERE name = 'Ontario'), '[]'::jsonb),
('Eastern Ontario', 'Eastern Ontario region', NULL, now(), 4, (SELECT id FROM app.d_scope_location WHERE name = 'Ontario'), '[]'::jsonb),

-- City Level
('London', 'City of London, Ontario', '300 Dufferin Ave, London, ON N6A 4L9', now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Southern Ontario'), '[]'::jsonb),
('Sarnia', 'City of Sarnia, Ontario', '255 Christina St N, Sarnia, ON N7T 7N2', now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Southern Ontario'), '[]'::jsonb),
('Toronto', 'City of Toronto, Ontario', '100 Queen St W, Toronto, ON M5H 2N2', now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Eastern Ontario'), '[]'::jsonb),
('Mississauga', 'City of Mississauga, Ontario', '300 City Centre Dr, Mississauga, ON L5B 3C1', now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Eastern Ontario'), '[]'::jsonb),
('Thunder Bay', 'City of Thunder Bay, Ontario', '500 Donald St E, Thunder Bay, ON P7E 5V3', now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Northern Ontario'), '[]'::jsonb),
('Barrie', 'City of Barrie, Ontario', '70 Collier St, Barrie, ON L4M 4T5', now(), 5, (SELECT id FROM app.d_scope_location WHERE name = 'Northern Ontario'), '[]'::jsonb);

-- Business hierarchy
CREATE TABLE app.d_scope_business (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_biz_level(level_id),
  parent_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_scope_business (name, "descr", from_ts, level_id, parent_id, tags) VALUES
('TechCorp Inc.', 'Canadian technology corporation', now(), 1, NULL, '[]'::jsonb),
('Engineering Division', 'Software engineering and R&D', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'), '[]'::jsonb),
('Sales Division', 'Sales and marketing division', now(), 2, (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'), '[]'::jsonb),
('Platform Engineering', 'Infrastructure and platform services', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'), '[]'::jsonb),
('Product Development', 'Product development and innovation', now(), 3, (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'), '[]'::jsonb),
('Frontend Team', 'User interface and experience development', now(), 4, (SELECT id FROM app.d_scope_business WHERE name = 'Product Development'), '[]'::jsonb),
('Backend Team', 'Server-side and API development', now(), 4, (SELECT id FROM app.d_scope_business WHERE name = 'Platform Engineering'), '[]'::jsonb);

-- HR hierarchy
CREATE TABLE app.d_scope_hr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  level_id int NOT NULL REFERENCES app.meta_hr_level(level_id),
  parent_id uuid REFERENCES app.d_scope_hr(id) ON DELETE SET NULL,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_scope_hr (name, "descr", from_ts, level_id, parent_id, tags) VALUES
('CEO Office', 'Chief Executive Officer and executive team', now(), 1, NULL, '[]'::jsonb),
('VP Engineering', 'Vice President of Engineering', now(), 2, (SELECT id FROM app.d_scope_hr WHERE name = 'CEO Office'), '[]'::jsonb),
('VP Sales', 'Vice President of Sales', now(), 2, (SELECT id FROM app.d_scope_hr WHERE name = 'CEO Office'), '[]'::jsonb),
('Engineering Directors', 'Engineering department directors', now(), 3, (SELECT id FROM app.d_scope_hr WHERE name = 'VP Engineering'), '[]'::jsonb),
('Engineering Managers', 'Team and project managers', now(), 4, (SELECT id FROM app.d_scope_hr WHERE name = 'Engineering Directors'), '[]'::jsonb),
('Senior Engineers', 'Senior individual contributors', now(), 6, (SELECT id FROM app.d_scope_hr WHERE name = 'Engineering Managers'), '[]'::jsonb);

-- ============================================================================
-- WORKSITE TABLE - Fourth Order (depends on location and business)
-- ============================================================================

CREATE TABLE app.d_worksite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  loc_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  biz_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  geom geometry(Geometry, 4326),
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_worksite (name, "descr", loc_id, biz_id, from_ts, tags) VALUES
('London HQ', 'Main headquarters in London, ON', 
 (SELECT id FROM app.d_scope_location WHERE name = 'London'), 
 (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'), 
 now(), '[]'::jsonb),
('Toronto Tech Center', 'Development center in Toronto', 
 (SELECT id FROM app.d_scope_location WHERE name = 'Toronto'), 
 (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'), 
 now(), '[]'::jsonb),
('Mississauga Sales Office', 'Regional sales office', 
 (SELECT id FROM app.d_scope_location WHERE name = 'Mississauga'), 
 (SELECT id FROM app.d_scope_business WHERE name = 'Sales Division'), 
 now(), '[]'::jsonb);

-- ============================================================================
-- HR-BUSINESS-LOCATION RELATIONSHIPS - Fifth Order
-- ============================================================================

CREATE TABLE app.rel_hr_biz_loc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_id uuid NOT NULL REFERENCES app.d_scope_hr(id) ON DELETE CASCADE,
  biz_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  loc_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb
);

INSERT INTO app.rel_hr_biz_loc (hr_id, biz_id, loc_id, from_ts, tags) VALUES
((SELECT id FROM app.d_scope_hr WHERE name = 'CEO Office'), 
 (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'), 
 (SELECT id FROM app.d_scope_location WHERE name = 'London'), 
 now(), '[]'::jsonb),
((SELECT id FROM app.d_scope_hr WHERE name = 'VP Engineering'), 
 (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'), 
 (SELECT id FROM app.d_scope_location WHERE name = 'Toronto'), 
 now(), '[]'::jsonb);

-- ============================================================================
-- IDENTITY AND ACCESS MANAGEMENT - Sixth Order
-- ============================================================================

-- Employee table with address
CREATE TABLE app.d_emp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  addr text,
  email text UNIQUE,
  password_hash text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_emp (name, "descr", addr, email, password_hash, tags) VALUES
('John Smith', 'Senior Project Manager - Infrastructure', '123 Richmond St, London, ON N6A 3K7', 'john.smith@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),
('Jane Doe', 'Principal Frontend Developer', '456 King St W, Toronto, ON M5V 1M3', 'jane.doe@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),
('Bob Wilson', 'DevOps Engineer', '789 Dundas St, London, ON N6A 1H3', 'bob.wilson@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),
('Alice Johnson', 'UX Designer', '321 Bay St, Toronto, ON M5H 2R2', 'alice.johnson@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),
('Mike Chen', 'Backend Engineer', '654 Yonge St, Toronto, ON M4Y 2A6', 'mike.chen@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),
('Sarah Lee', 'QA Engineer', '987 Adelaide St W, Toronto, ON M6J 2S8', 'sarah.lee@techcorp.com', '$2b$10$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb);

-- Role table
CREATE TABLE app.d_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_role (name, "descr", tags) VALUES
('Project Manager', 'Can manage projects, tasks, and team assignments', '[]'::jsonb),
('Senior Developer', 'Senior development role with mentorship responsibilities', '[]'::jsonb),
('System Administrator', 'Full system administration and infrastructure access', '[]'::jsonb),
('Designer', 'UI/UX design and user research responsibilities', '[]'::jsonb),
('Developer', 'Standard development role with code contribution', '[]'::jsonb),
('QA Engineer', 'Quality assurance and testing responsibilities', '[]'::jsonb);

-- Employee-Role relationship table
CREATE TABLE app.rel_emp_role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(emp_id, role_id, active)
);

INSERT INTO app.rel_emp_role (emp_id, role_id, tags) VALUES
((SELECT id FROM app.d_emp WHERE name = 'John Smith'), 
 (SELECT id FROM app.d_role WHERE name = 'Project Manager'), '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'), 
 (SELECT id FROM app.d_role WHERE name = 'Senior Developer'), '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'), 
 (SELECT id FROM app.d_role WHERE name = 'System Administrator'), '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'), 
 (SELECT id FROM app.d_role WHERE name = 'Designer'), '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'), 
 (SELECT id FROM app.d_role WHERE name = 'Developer'), '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'), 
 (SELECT id FROM app.d_role WHERE name = 'QA Engineer'), '[]'::jsonb);

-- ============================================================================
-- CLIENT MANAGEMENT - Seventh Order
-- ============================================================================

CREATE TABLE app.d_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_client (name, contact, tags) VALUES
('Maple Industries', '{"email": "contact@maple.ca", "phone": "+1-519-555-0101", "website": "maple.ca"}'::jsonb, '[]'::jsonb),
('Northern Tech Solutions', '{"email": "hello@northerntech.ca", "phone": "+1-416-555-0202", "website": "northerntech.ca"}'::jsonb, '[]'::jsonb),
('Great Lakes Corp', '{"email": "partnerships@greatlakes.ca", "phone": "+1-905-555-0303", "website": "greatlakes.ca"}'::jsonb, '[]'::jsonb),
('Ontario Innovation Hub', '{"email": "info@innovationhub.on.ca", "phone": "+1-647-555-0404"}'::jsonb, '[]'::jsonb);

CREATE TABLE app.d_client_grp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  task_head_id uuid,
  clients uuid[] NOT NULL DEFAULT '{}'::uuid[],
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.d_client_grp (name, clients, tags) VALUES
('Enterprise Clients', 
 ARRAY[(SELECT id FROM app.d_client WHERE name = 'Maple Industries'), (SELECT id FROM app.d_client WHERE name = 'Great Lakes Corp')]::uuid[], 
 '[]'::jsonb),
('Tech Partners', 
 ARRAY[(SELECT id FROM app.d_client WHERE name = 'Northern Tech Solutions'), (SELECT id FROM app.d_client WHERE name = 'Ontario Innovation Hub')]::uuid[], 
 '[]'::jsonb);

-- ============================================================================
-- PROJECT MANAGEMENT - Eighth Order
-- ============================================================================

CREATE TABLE app.ops_project_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  slug text UNIQUE,
  active boolean NOT NULL DEFAULT true,  -- Add active column for API compatibility
  location_specific boolean NOT NULL DEFAULT false,
  location_id uuid REFERENCES app.d_scope_location(id) ON DELETE SET NULL,
  location_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_specific boolean NOT NULL DEFAULT false,
  biz_id uuid REFERENCES app.d_scope_business(id) ON DELETE SET NULL,
  business_permission jsonb NOT NULL DEFAULT '[]'::jsonb,
  worksite_specific boolean NOT NULL DEFAULT false,
  worksite_id uuid REFERENCES app.d_worksite(id),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.ops_project_head (tenant_id, name, slug, business_specific, biz_id, location_specific, location_id, worksite_specific, worksite_id, tags) VALUES
(gen_random_uuid(), 'Platform Modernization 2024', 'platform-modernization-2024', 
 true, (SELECT id FROM app.d_scope_business WHERE name = 'Platform Engineering'), 
 true, (SELECT id FROM app.d_scope_location WHERE name = 'Toronto'),
 true, (SELECT id FROM app.d_worksite WHERE name = 'Toronto Tech Center'), '[]'::jsonb),
(gen_random_uuid(), 'Mobile App V2', 'mobile-app-v2', 
 true, (SELECT id FROM app.d_scope_business WHERE name = 'Frontend Team'), 
 false, NULL, false, NULL, '[]'::jsonb),
(gen_random_uuid(), 'Ontario Client Portal', 'ontario-client-portal', 
 true, (SELECT id FROM app.d_scope_business WHERE name = 'Product Development'), 
 true, (SELECT id FROM app.d_scope_location WHERE name = 'London'),
 true, (SELECT id FROM app.d_worksite WHERE name = 'London HQ'), '[]'::jsonb);

CREATE TABLE app.ops_project_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_project_head(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  status_id uuid NOT NULL REFERENCES app.meta_project_status(id),
  stage_id int REFERENCES app.meta_project_stage(level_id),
  dates jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.ops_project_records (head_id, from_ts, status_id, stage_id, dates, tags) VALUES
((SELECT id FROM app.ops_project_head WHERE name = 'Platform Modernization 2024'), 
 now(), 
 (SELECT id FROM app.meta_project_status WHERE code = 'ACTIVE'), 
 3, 
 '{"start_date": "2024-01-15", "planned_end": "2024-09-15"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.ops_project_head WHERE name = 'Mobile App V2'), 
 now(), 
 (SELECT id FROM app.meta_project_status WHERE code = 'PLANNING'), 
 2, 
 '{"start_date": "2024-03-01", "planned_end": "2024-09-01"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.ops_project_head WHERE name = 'Ontario Client Portal'), 
 now(), 
 (SELECT id FROM app.meta_project_status WHERE code = 'ACTIVE'), 
 3, 
 '{"start_date": "2024-02-01", "planned_end": "2024-06-01"}'::jsonb, '[]'::jsonb);

-- ============================================================================
-- TASK MANAGEMENT - Ninth Order
-- ============================================================================

CREATE TABLE app.ops_task_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proj_head_id uuid NOT NULL REFERENCES app.ops_project_head(id) ON DELETE CASCADE,
  parent_head_id uuid REFERENCES app.ops_task_head(id) ON DELETE SET NULL,
  title text NOT NULL,  -- Add title column for API compatibility
  assignee uuid REFERENCES app.d_emp(id) ON DELETE SET NULL,
  client_group_id uuid REFERENCES app.d_client_grp(id) ON DELETE SET NULL,
  clients uuid[] NOT NULL DEFAULT '{}'::uuid[],
  reviewers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  approvers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  collaborators uuid[] NOT NULL DEFAULT '{}'::uuid[],
  worksite_id uuid REFERENCES app.d_worksite(id) ON DELETE SET NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.ops_task_head (proj_head_id, title, assignee, reviewers, approvers, collaborators, worksite_id, tags) VALUES
((SELECT id FROM app.ops_project_head WHERE name = 'Platform Modernization 2024'),
 'Infrastructure Setup and Configuration',
 (SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'John Smith')]::uuid[],
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'John Smith')]::uuid[],
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'Mike Chen')]::uuid[],
 (SELECT id FROM app.d_worksite WHERE name = 'Toronto Tech Center'), '[]'::jsonb),
((SELECT id FROM app.ops_project_head WHERE name = 'Mobile App V2'),
 'UI/UX Design and Implementation',
 (SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'Alice Johnson')]::uuid[],
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'John Smith')]::uuid[],
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'Sarah Lee')]::uuid[],
 NULL, '[]'::jsonb),
((SELECT id FROM app.ops_project_head WHERE name = 'Ontario Client Portal'),
 'Backend API Development',
 (SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'Jane Doe')]::uuid[],
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'John Smith')]::uuid[],
 ARRAY[(SELECT id FROM app.d_emp WHERE name = 'Alice Johnson')]::uuid[],
 (SELECT id FROM app.d_worksite WHERE name = 'London HQ'), '[]'::jsonb);

-- Add FK constraint now that task head exists
ALTER TABLE app.d_client_grp
  ADD CONSTRAINT d_client_grp_task_fk
  FOREIGN KEY (task_head_id) REFERENCES app.ops_task_head(id) ON DELETE CASCADE;

CREATE TABLE app.ops_task_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  title text NOT NULL,
  status_id uuid NOT NULL REFERENCES app.meta_task_status(id),
  stage_id uuid NOT NULL REFERENCES app.meta_task_stage(id),
  due_date date,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.ops_task_records (head_id, from_ts, title, status_id, stage_id, due_date, tags) VALUES
((SELECT id FROM app.ops_task_head WHERE assignee = (SELECT id FROM app.d_emp WHERE name = 'Bob Wilson')),
 now(), 
 'Migrate services to Kubernetes cluster',
 (SELECT id FROM app.meta_task_status WHERE code = 'IN_PROGRESS'),
 (SELECT id FROM app.meta_task_stage WHERE code = 'in_progress'),
 '2024-04-15', '[]'::jsonb),
((SELECT id FROM app.ops_task_head WHERE assignee = (SELECT id FROM app.d_emp WHERE name = 'Jane Doe')),
 now(), 
 'Design mobile app navigation flow',
 (SELECT id FROM app.meta_task_status WHERE code = 'REVIEW'),
 (SELECT id FROM app.meta_task_stage WHERE code = 'review'),
 '2024-03-30', '[]'::jsonb),
((SELECT id FROM app.ops_task_head WHERE assignee = (SELECT id FROM app.d_emp WHERE name = 'Mike Chen')),
 now(), 
 'Implement client portal API endpoints',
 (SELECT id FROM app.meta_task_status WHERE code = 'IN_PROGRESS'),
 (SELECT id FROM app.meta_task_stage WHERE code = 'in_progress'),
 '2024-04-30', '[]'::jsonb);

-- ============================================================================
-- APPLICATION UI/UX MANAGEMENT - Tenth Order
-- ============================================================================

CREATE TABLE app.app_scope_d_route_page (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "descr" text,
  route_path text NOT NULL UNIQUE,
  component_name text,
  parent_route_id uuid REFERENCES app.app_scope_d_route_page(id) ON DELETE SET NULL,
  is_protected boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Route Pages with comprehensive application coverage
INSERT INTO app.app_scope_d_route_page (name, "descr", route_path, component_name, is_protected, tags) VALUES
-- Dashboard & Overview
('Dashboard', 'Main application dashboard with overview and quick actions', '/dashboard', 'DashboardPage', true, '["core", "overview"]'::jsonb),

-- Project Management
('Projects List', 'Browse and manage all projects', '/projects', 'ProjectsPage', true, '["projects", "list"]'::jsonb),
('Project Details', 'View detailed project information and manage project tasks', '/projects/:id', 'ProjectDetailPage', true, '["projects", "details"]'::jsonb),
('Project Create', 'Create new project', '/projects/new', 'ProjectCreatePage', true, '["projects", "create"]'::jsonb),

-- Task Management
('Tasks Board', 'Kanban-style task management board', '/tasks', 'TasksPage', true, '["tasks", "board"]'::jsonb),
('Task Details', 'View and edit detailed task information', '/tasks/:id', 'TaskDetailPage', true, '["tasks", "details"]'::jsonb),
('Task Create', 'Create new task', '/tasks/new', 'TaskCreatePage', true, '["tasks", "create"]'::jsonb),

-- Entity Management
('Employees', 'Employee directory and management', '/employees', 'EmployeeManagementPage', true, '["employees", "list"]'::jsonb),
('Clients', 'Client management and contact information', '/clients', 'ClientManagementPage', true, '["clients", "list"]'::jsonb),
('Worksites', 'Physical worksite locations and management', '/worksites', 'WorksiteManagementPage', true, '["worksites", "list"]'::jsonb),

-- Hierarchical Management
('Locations', 'Geographic location hierarchy management', '/admin/locations', 'LocationManagementPage', true, '["admin", "locations"]'::jsonb),
('Business Units', 'Business organizational hierarchy', '/admin/businesses', 'BusinessManagementPage', true, '["admin", "business"]'::jsonb),
('HR Departments', 'Human resources hierarchy and departments', '/admin/hr', 'HrManagementPage', true, '["admin", "hr"]'::jsonb),

-- Administration
('Admin Dashboard', 'System administration overview', '/admin', 'AdminPage', true, '["admin", "dashboard"]'::jsonb),
('Role Management', 'Manage user roles and permissions', '/admin/roles', 'RoleManagementPage', true, '["admin", "roles"]'::jsonb),
('Meta Configuration', 'System metadata and configuration', '/admin/meta', 'MetaConfigPage', true, '["admin", "meta"]'::jsonb),

-- User Management
('User Profile', 'Personal user profile and preferences', '/profile', 'ProfilePage', true, '["user", "profile"]'::jsonb),
('Settings', 'Application settings and preferences', '/settings', 'SettingsPage', true, '["user", "settings"]'::jsonb),

-- Reports & Analytics
('Reports', 'Reports and analytics dashboard', '/reports', 'ReportsPage', true, '["reports", "analytics"]'::jsonb),
('Project Reports', 'Project-specific reporting and analytics', '/reports/projects', 'ProjectReportsPage', true, '["reports", "projects"]'::jsonb),
('Task Reports', 'Task analytics and performance reports', '/reports/tasks', 'TaskReportsPage', true, '["reports", "tasks"]'::jsonb),

-- Authentication
('Login', 'User authentication and login', '/login', 'LoginPage', false, '["auth", "public"]'::jsonb),
('Logout', 'User logout and session termination', '/logout', 'LogoutPage', false, '["auth", "public"]'::jsonb);

CREATE TABLE app.app_scope_d_component (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  "descr" text,
  component_type text NOT NULL,
  props_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Components with enhanced definitions
INSERT INTO app.app_scope_d_component (name, "descr", component_type, props_schema, dependencies, tags) VALUES
('DataTable', 'Advanced data table with filtering, sorting, and pagination', 'table', 
 '{"columns": {"type": "array", "required": true}, "data": {"type": "array", "required": true}}'::jsonb, 
 '["@tanstack/react-table", "lucide-react"]'::jsonb, '["core", "table"]'::jsonb),
('EntityForm', 'Generic entity creation and editing form', 'form', 
 '{"entity": {"type": "object"}, "onSubmit": {"type": "function", "required": true}}'::jsonb, 
 '["react-hook-form", "@hookform/resolvers"]'::jsonb, '["core", "form"]'::jsonb),
('TaskCard', 'Reusable task card component for kanban boards', 'card', 
 '{"task": {"type": "object", "required": true}, "onMove": {"type": "function"}}'::jsonb, 
 '["@dnd-kit/core", "@dnd-kit/sortable"]'::jsonb, '["tasks", "card"]'::jsonb),
('ProjectHeader', 'Project page header with actions and metadata', 'header', 
 '{"project": {"type": "object", "required": true}}'::jsonb, 
 '["lucide-react"]'::jsonb, '["projects", "header"]'::jsonb),
('PermissionGate', 'Role-based access control component', 'security', 
 '{"action": {"type": "string", "required": true}, "resource": {"type": "string", "required": true}}'::jsonb, 
 '["@tanstack/react-query"]'::jsonb, '["security", "rbac"]'::jsonb),
('EntityManagementPage', 'Comprehensive entity management page template', 'page', 
 '{"config": {"type": "object", "required": true}}'::jsonb, 
 '["@tanstack/react-table", "@tanstack/react-query", "lucide-react"]'::jsonb, '["core", "management"]'::jsonb),
('Navigation', 'Main navigation component with role-based menu items', 'navigation',
 '{"user": {"type": "object", "required": true}, "permissions": {"type": "array"}}'::jsonb,
 '["react-router-dom", "lucide-react"]'::jsonb, '["core", "navigation"]'::jsonb),
('SearchBar', 'Global search component with filters', 'search',
 '{"placeholder": {"type": "string"}, "onSearch": {"type": "function", "required": true}}'::jsonb,
 '["lucide-react"]'::jsonb, '["core", "search"]'::jsonb);

CREATE TABLE app.rel_route_component (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES app.app_scope_d_route_page(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES app.app_scope_d_component(id) ON DELETE CASCADE,
  usage_type text NOT NULL DEFAULT 'main',
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(route_id, component_id, usage_type, active)
);

-- Route-Component relationships
INSERT INTO app.rel_route_component (route_id, component_id, usage_type, props, tags) VALUES
-- Dashboard components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'widget', '{"showProject": true, "compact": true}'::jsonb, '[]'::jsonb),

-- Project components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'DataTable'),
 'main', '{"entityType": "project"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects/:id'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'ProjectHeader'),
 'header', '{"showActions": true}'::jsonb, '[]'::jsonb),

-- Task components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'main', '{"draggable": true}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks/:id'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityForm'),
 'main', '{"entityType": "task"}'::jsonb, '[]'::jsonb),

-- Entity management components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/employees'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "employee"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/clients'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "client"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/worksites'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "worksite"}'::jsonb, '[]'::jsonb),

-- Admin components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/locations'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "location", "hierarchical": true}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/businesses'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "business", "hierarchical": true}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/hr'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "hr", "hierarchical": true}'::jsonb, '[]'::jsonb);

-- ============================================================================
-- UNIFIED SCOPE PERMISSION SYSTEM - Eleventh Order
-- ============================================================================

CREATE TABLE app.rel_scope_permission (
  scope_type text NOT NULL,
  name text NOT NULL,
  "descr" text,
  scope_id uuid,
  scope_level_id int,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope_type, name, scope_id, active)
);

-- Role-Scope Permission relationship table
CREATE TABLE app.rel_role_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES app.d_role(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_name text NOT NULL,
  scope_id uuid,
  scope_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[],
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, scope_type, scope_name, active)
);

-- User-Scope Permission relationship table
CREATE TABLE app.rel_user_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_id uuid,
  scope_name text NOT NULL,
  scope_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[],
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(emp_id, scope_type, scope_name, active)
);

-- ============================================================================
-- USER PERMISSIONS DATA - Comprehensive Permissions for John Smith
-- ============================================================================

-- Route page permissions (scope_type = 'route_page', permission = [0])
INSERT INTO app.rel_user_scope (emp_id, scope_type, scope_id, scope_name, scope_permission, tags) VALUES

-- ====================
-- JOHN SMITH - FULL SYSTEM ACCESS (Super Admin Permissions)
-- ====================

-- All Route Page Access (view-only as per system constraint)
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 'Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects'),
 'Projects List', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects/:id'),
 'Project Details', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects/new'),
 'Project Create', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks'),
 'Tasks Board', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks/:id'),
 'Task Details', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks/new'),
 'Task Create', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/employees'),
 'Employees', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/clients'),
 'Clients', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/worksites'),
 'Worksites', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin'),
 'Admin Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/locations'),
 'Locations', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/businesses'),
 'Business Units', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/hr'),
 'HR Departments', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/roles'),
 'Role Management', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/meta'),
 'Meta Configuration', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/profile'),
 'User Profile', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/settings'),
 'Settings', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/reports'),
 'Reports', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/reports/projects'),
 'Project Reports', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/reports/tasks'),
 'Task Reports', ARRAY[0]::smallint[], '[]'::jsonb),

-- All Component Access (view-only as per system constraint)
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'DataTable'),
 'DataTable', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityForm'),
 'EntityForm', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'TaskCard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'ProjectHeader'),
 'ProjectHeader', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'PermissionGate'),
 'PermissionGate', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'EntityManagementPage', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'Navigation'),
 'Navigation', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'SearchBar'),
 'SearchBar', ARRAY[0]::smallint[], '[]'::jsonb),

-- ====================
-- OTHER USERS - LIMITED ACCESS
-- ====================

-- Jane Doe - Route page access
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 'Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects'),
 'Projects List', ARRAY[0]::smallint[], '[]'::jsonb),

-- Bob Wilson - Admin route access
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin'),
 'Admin Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/locations'),
 'Locations', ARRAY[0]::smallint[], '[]'::jsonb),

-- Component permissions for other users
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'TaskCard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'EntityManagementPage', ARRAY[0]::smallint[], '[]'::jsonb);

-- ============================================================================
-- BUSINESS/LOCATION/PROJECT SCOPE PERMISSIONS
-- ============================================================================

INSERT INTO app.rel_user_scope (emp_id, scope_type, scope_id, scope_name, scope_permission, tags) VALUES

-- ====================
-- JOHN SMITH - COMPREHENSIVE SCOPE PERMISSIONS (SUPER ADMIN)
-- ====================

-- System-Wide App Administration
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'System Administration', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- All Business Scope Permissions
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'TechCorp Inc.'),
 'TechCorp Inc. Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'Engineering Division'),
 'Engineering Division Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'Sales Division'),
 'Sales Division Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'Platform Engineering'),
 'Platform Engineering Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'Product Development'),
 'Product Development Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'Frontend Team'),
 'Frontend Team Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'Backend Team'),
 'Backend Team Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- All Location Scope Permissions
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'North America'),
 'North America Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Canada'),
 'Canada Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Ontario'),
 'Ontario Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Southern Ontario'),
 'Southern Ontario Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Northern Ontario'),
 'Northern Ontario Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Eastern Ontario'),
 'Eastern Ontario Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'London'),
 'London Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Toronto'),
 'Toronto Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Mississauga'),
 'Mississauga Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Sarnia'),
 'Sarnia Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Thunder Bay'),
 'Thunder Bay Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'location', (SELECT id FROM app.d_scope_location WHERE name = 'Barrie'),
 'Barrie Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- All HR Scope Permissions
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'hr', (SELECT id FROM app.d_scope_hr WHERE name = 'CEO Office'),
 'CEO Office Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'hr', (SELECT id FROM app.d_scope_hr WHERE name = 'VP Engineering'),
 'VP Engineering Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'hr', (SELECT id FROM app.d_scope_hr WHERE name = 'VP Sales'),
 'VP Sales Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'hr', (SELECT id FROM app.d_scope_hr WHERE name = 'Engineering Directors'),
 'Engineering Directors Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'hr', (SELECT id FROM app.d_scope_hr WHERE name = 'Engineering Managers'),
 'Engineering Managers Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'hr', (SELECT id FROM app.d_scope_hr WHERE name = 'Senior Engineers'),
 'Senior Engineers Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- All Worksite Permissions
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'worksite', (SELECT id FROM app.d_worksite WHERE name = 'London HQ'),
 'London HQ Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'worksite', (SELECT id FROM app.d_worksite WHERE name = 'Toronto Tech Center'),
 'Toronto Tech Center Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'worksite', (SELECT id FROM app.d_worksite WHERE name = 'Mississauga Sales Office'),
 'Mississauga Sales Office Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- All Project Permissions
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'project', (SELECT id FROM app.ops_project_head WHERE name = 'Platform Modernization 2024'),
 'Platform Modernization Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'project', (SELECT id FROM app.ops_project_head WHERE name = 'Mobile App V2'),
 'Mobile App V2 Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'project', (SELECT id FROM app.ops_project_head WHERE name = 'Ontario Client Portal'),
 'Ontario Client Portal Scope', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- ====================
-- OTHER USERS - LIMITED PERMISSIONS
-- ====================

-- Jane Doe - Development permissions
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'Frontend Team'),
 'Frontend Team Scope', ARRAY[0,1,2,4]::smallint[], '[]'::jsonb),

-- Bob Wilson - System admin permissions
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'System Administration', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- Mike Chen - Backend development
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'business', (SELECT id FROM app.d_scope_business WHERE name = 'Backend Team'),
 'Backend Team Scope', ARRAY[0,1,4]::smallint[], '[]'::jsonb);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Indexes for rel_user_scope
CREATE INDEX idx_rel_user_scope_emp ON app.rel_user_scope(emp_id);
CREATE INDEX idx_rel_user_scope_scope ON app.rel_user_scope(scope_type, scope_name);
CREATE INDEX idx_rel_user_scope_type ON app.rel_user_scope(scope_type);
CREATE INDEX idx_rel_user_scope_resource ON app.rel_user_scope(scope_id);
CREATE INDEX idx_rel_user_scope_active ON app.rel_user_scope(active) WHERE active = true;

-- Indexes for scope hierarchy tables
CREATE INDEX idx_d_scope_location_parent ON app.d_scope_location(parent_id);
CREATE INDEX idx_d_scope_location_level ON app.d_scope_location(level_id);
CREATE INDEX idx_d_scope_location_active ON app.d_scope_location(active) WHERE active = true;

CREATE INDEX idx_d_scope_business_parent ON app.d_scope_business(parent_id);
CREATE INDEX idx_d_scope_business_level ON app.d_scope_business(level_id);
CREATE INDEX idx_d_scope_business_active ON app.d_scope_business(active) WHERE active = true;

CREATE INDEX idx_d_scope_hr_parent ON app.d_scope_hr(parent_id);
CREATE INDEX idx_d_scope_hr_level ON app.d_scope_hr(level_id);
CREATE INDEX idx_d_scope_hr_active ON app.d_scope_hr(active) WHERE active = true;

-- Indexes for operations tables
CREATE INDEX idx_ops_project_records_head ON app.ops_project_records(head_id);
CREATE INDEX idx_ops_project_records_active ON app.ops_project_records(active) WHERE active = true;
CREATE INDEX idx_ops_task_records_head ON app.ops_task_records(head_id);
CREATE INDEX idx_ops_task_records_active ON app.ops_task_records(active) WHERE active = true;

-- ============================================================================
-- Schema Generation Complete
-- ============================================================================
