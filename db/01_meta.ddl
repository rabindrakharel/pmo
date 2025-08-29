-- ============================================================================
-- META CONFIGURATION TABLES (System Level Definitions)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The meta configuration tables serve as the foundational vocabulary and structural 
-- definitions for the entire PMO system. These tables define the hierarchical levels,
-- statuses, stages, and organizational patterns that all operational entities reference.
--
-- ARCHITECTURAL PURPOSE:
-- Meta tables provide the controlled vocabulary and business rules that ensure:
--
-- • ORGANIZATIONAL CONSISTENCY: Standardized hierarchy levels across all scopes
-- • WORKFLOW MANAGEMENT: Defined states and transitions for projects and tasks  
-- • BUSINESS INTELLIGENCE: Common categorization for reporting and analytics
-- • DATA INTEGRITY: Referential constraints that prevent invalid state combinations
-- • SYSTEM SCALABILITY: Extensible vocabulary without core schema changes
--
-- HIERARCHY DESIGN PATTERNS:
-- Each scope type (business, location, hr) has corresponding meta_*_level tables that
-- define the organizational depth and structure:
--
-- • meta_biz_level: Corporation → Division → Department → Team → Sub-team
-- • meta_loc_level: Corp-Region → Country → Province → Region → City  
-- • meta_hr_level: C-Level → VP → Director → Manager → Team Lead → Senior → Associate → Engineer
--
-- WORKFLOW STATE MANAGEMENT:
-- Project and task entities reference meta tables for status and stage tracking:
--
-- • meta_project_status: DRAFT → PLANNING → APPROVED → ACTIVE → COMPLETED/CANCELLED
-- • meta_project_stage: Initiation → Planning → Execution → Monitoring → Closure
-- • meta_task_status: OPEN → IN_PROGRESS → BLOCKED → REVIEW → DONE → CLOSED
-- • meta_task_stage: backlog → todo → in_progress → review → done → blocked
--
-- CANADIAN ORGANIZATIONAL CONTEXT:
-- The location levels specifically support Canadian governmental and business structures:
-- - Corp-Region (North America)
-- - Country (Canada)  
-- - Province (Ontario, Quebec, etc.)
-- - Region (Southern Ontario, Northern Quebec, etc.)
-- - City (Toronto, Montreal, Vancouver, etc.)
--
-- EXTENSION AND CUSTOMIZATION:
-- Meta tables enable system customization without code changes:
-- - Adding new hierarchy levels for growing organizations
-- - Defining custom workflow states for different project types
-- - Creating organization-specific categorization schemes
-- - Supporting multi-tenant configurations with different vocabularies
--
-- INTEGRATION WITH OPERATIONAL TABLES:
-- All operational entities (projects, tasks, scopes) reference these meta definitions:
-- - d_scope_business.level_id → meta_biz_level.level_id
-- - d_scope_location.level_id → meta_loc_level.level_id  
-- - ops_project_records.status_id → meta_project_status.id
-- - ops_task_records.stage_id → meta_task_stage.id
--
-- REPORTING AND ANALYTICS FOUNDATION:
-- Meta tables provide the dimensional structure for business intelligence:
-- - Cross-organizational reporting by hierarchy levels
-- - Workflow analytics by status and stage transitions
-- - Performance metrics aligned with organizational structure
-- - Standardized KPIs across different business units and locations

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

-- Business Level Definitions
CREATE TABLE app.meta_biz_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  sort_order int NOT NULL DEFAULT 0,
  is_leaf_level boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Location Level Definitions (Canadian Structure)
CREATE TABLE app.meta_loc_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  country_code text DEFAULT 'CA',
  sort_order int NOT NULL DEFAULT 0,
  is_leaf_level boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- HR Level Definitions
CREATE TABLE app.meta_hr_level (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  salary_band_min int,
  salary_band_max int,
  sort_order int NOT NULL DEFAULT 0,
  is_management boolean NOT NULL DEFAULT false,
  is_executive boolean NOT NULL DEFAULT false,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Project Status Definitions
CREATE TABLE app.meta_project_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  sort_id int NOT NULL,
  is_initial boolean NOT NULL DEFAULT false,
  is_final boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  color_hex text DEFAULT '#6B7280',
  icon text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Project Stage Definitions  
CREATE TABLE app.meta_project_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id int NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  duration_weeks int,
  is_milestone boolean NOT NULL DEFAULT false,
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Task Status Definitions
CREATE TABLE app.meta_task_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  sort_id int NOT NULL,
  is_initial boolean NOT NULL DEFAULT false,
  is_final boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  color_hex text DEFAULT '#6B7280',
  icon text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Task Stage Definitions (Kanban States)
CREATE TABLE app.meta_task_stage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  "descr" text,
  sort_id int NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_done boolean NOT NULL DEFAULT false,
  is_blocked boolean NOT NULL DEFAULT false,
  wip_limit int,
  color_hex text DEFAULT '#6B7280',
  icon text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
-- ============================================================================

-- Business Hierarchy Levels
INSERT INTO app.meta_biz_level (level_id, name, "descr", sort_order, is_leaf_level, tags, attr) VALUES
(1, 'Corporation', 'Top-level corporate entity', 1, false, '["enterprise", "root"]', '{"max_children": 50, "requires_board": true}'),
(2, 'Division', 'Major business division', 2, false, '["division", "strategic"]', '{"max_children": 20, "has_p_and_l": true}'),
(3, 'Department', 'Functional department', 3, false, '["department", "operational"]', '{"max_children": 10, "has_budget": true}'),
(4, 'Team', 'Working team unit', 4, false, '["team", "tactical"]', '{"max_children": 5, "has_manager": true}'),
(5, 'Sub-team', 'Specialized sub-team', 5, true, '["subteam", "specialized"]', '{"max_children": 0, "has_lead": true}');

-- Canadian Location Hierarchy Levels
INSERT INTO app.meta_loc_level (level_id, name, "descr", country_code, sort_order, is_leaf_level, tags, attr) VALUES
(1, 'Corp-Region', 'Corporate regional division', 'CA', 1, false, '["corporate", "region"]', '{"timezone_span": true, "multi_country": true}'),
(2, 'Country', 'National boundary', 'CA', 2, false, '["country", "national"]', '{"has_federal_law": true, "currency": "CAD"}'),
(3, 'Province', 'Provincial/territorial division', 'CA', 3, false, '["province", "territorial"]', '{"has_provincial_law": true, "tax_jurisdiction": true}'),
(4, 'Region', 'Sub-provincial region', 'CA', 4, false, '["region", "subprovincial"]', '{"has_regional_services": true, "economic_zone": true}'),
(5, 'City', 'Municipal level', 'CA', 5, true, '["city", "municipal"]', '{"has_municipal_law": true, "service_delivery": true}');

-- HR Hierarchy Levels with Canadian Salary Bands (CAD)
INSERT INTO app.meta_hr_level (level_id, name, "descr", salary_band_min, salary_band_max, sort_order, is_management, is_executive, tags, attr) VALUES
(1, 'C-Level', 'Chief Executive Level', 250000, 500000, 1, true, true, '["executive", "c-suite"]', '{"board_reporting": true, "equity_eligible": true}'),
(2, 'VP Level', 'Vice President Level', 180000, 300000, 2, true, true, '["executive", "vp"]', '{"direct_reports": 5, "budget_authority": 10000000}'),
(3, 'Director', 'Director Level', 130000, 200000, 3, true, false, '["management", "director"]', '{"direct_reports": 8, "budget_authority": 5000000}'),
(4, 'Manager', 'Manager Level', 90000, 150000, 4, true, false, '["management", "manager"]', '{"direct_reports": 10, "budget_authority": 1000000}'),
(5, 'Team Lead', 'Team Leadership', 80000, 120000, 5, true, false, '["leadership", "team-lead"]', '{"direct_reports": 6, "technical_lead": true}'),
(6, 'Senior Manager', 'Senior Individual Contributor', 70000, 110000, 6, false, false, '["senior", "specialist"]', '{"mentorship_required": true, "senior_expertise": true}'),
(7, 'Associate Manager', 'Associate Level', 55000, 85000, 7, false, false, '["associate", "developing"]', '{"mentorship_eligible": true, "growth_track": true}'),
(8, 'Engineer', 'Entry Level Professional', 45000, 70000, 8, false, false, '["entry", "professional"]', '{"training_required": true, "supervision_required": true}');

-- Project Status Lifecycle
INSERT INTO app.meta_project_status (code, name, "descr", sort_id, is_initial, is_final, is_active, color_hex, icon, tags, attr) VALUES
('DRAFT', 'Draft', 'Project in draft state, not yet submitted', 1, true, false, false, '#6B7280', 'edit', '["initial", "editable"]', '{"can_edit": true, "requires_approval": false}'),
('PLANNING', 'Planning', 'Project submitted and in planning phase', 2, false, false, false, '#3B82F6', 'calendar', '["planning", "review"]', '{"can_edit": false, "requires_approval": true}'),
('APPROVED', 'Approved', 'Project approved and ready to start', 3, false, false, false, '#10B981', 'check-circle', '["approved", "ready"]', '{"can_start": true, "budget_allocated": true}'),
('ACTIVE', 'Active', 'Project currently in progress', 4, false, false, true, '#F59E0B', 'play-circle', '["active", "executing"]', '{"in_progress": true, "resources_assigned": true}'),
('ON_HOLD', 'On Hold', 'Project temporarily suspended', 5, false, false, false, '#8B5CF6', 'pause-circle', '["suspended", "waiting"]', '{"can_resume": true, "resources_reassignable": true}'),
('COMPLETED', 'Completed', 'Project successfully completed', 6, false, true, false, '#059669', 'check-circle-2', '["completed", "success"]', '{"deliverables_met": true, "lessons_learned": true}'),
('CANCELLED', 'Cancelled', 'Project cancelled before completion', 7, false, true, false, '#DC2626', 'x-circle', '["cancelled", "terminated"]', '{"resources_released": true, "cancellation_reason": true}');

-- Project Management Stages  
INSERT INTO app.meta_project_stage (level_id, name, "descr", duration_weeks, is_milestone, deliverables, tags, attr) VALUES
(1, 'Initiation', 'Project charter and initial planning', 2, true, '["Project Charter", "Stakeholder Analysis", "Initial Scope"]', '["start", "charter"]', '{"approval_required": true, "budget_estimate": true}'),
(2, 'Planning', 'Detailed project planning and design', 4, true, '["Work Breakdown Structure", "Timeline", "Resource Plan", "Risk Assessment"]', '["planning", "design"]', '{"detailed_schedule": true, "resource_allocation": true}'),
(3, 'Execution', 'Active project implementation', 12, false, '["Deliverable Increments", "Status Reports", "Quality Assurance"]', '["execution", "delivery"]', '{"active_monitoring": true, "quality_gates": true}'),
(4, 'Monitoring', 'Performance monitoring and control', 2, false, '["Performance Reports", "Change Requests", "Risk Updates"]', '["monitoring", "control"]', '{"kpi_tracking": true, "change_management": true}'),
(5, 'Closure', 'Project closure and lessons learned', 1, true, '["Final Deliverables", "Project Retrospective", "Documentation"]', '["closure", "retrospective"]', '{"final_approval": true, "knowledge_transfer": true}');

-- Task Status Workflow
INSERT INTO app.meta_task_status (code, name, "descr", sort_id, is_initial, is_final, is_blocked, color_hex, icon, tags, attr) VALUES
('OPEN', 'Open', 'Task created and ready to be worked on', 1, true, false, false, '#6B7280', 'circle', '["initial", "available"]', '{"can_assign": true, "effort_estimation": false}'),
('IN_PROGRESS', 'In Progress', 'Task actively being worked on', 2, false, false, false, '#F59E0B', 'play-circle', '["active", "executing"]', '{"time_tracking": true, "progress_updates": true}'),
('BLOCKED', 'Blocked', 'Task blocked by external dependency', 3, false, false, true, '#DC2626', 'octagon', '["blocked", "waiting"]', '{"requires_unblocking": true, "dependency_tracking": true}'),
('REVIEW', 'Under Review', 'Task completed and under review', 4, false, false, false, '#8B5CF6', 'eye', '["review", "validation"]', '{"requires_approval": true, "quality_check": true}'),
('DONE', 'Done', 'Task completed and approved', 5, false, true, false, '#10B981', 'check-circle', '["completed", "approved"]', '{"deliverable_accepted": true, "time_logged": true}'),
('CLOSED', 'Closed', 'Task closed and archived', 6, false, true, false, '#059669', 'check-circle-2', '["closed", "archived"]', '{"archived": true, "retrospective_complete": true}');

-- Kanban Task Stages
INSERT INTO app.meta_task_stage (code, name, "descr", sort_id, is_default, is_done, is_blocked, wip_limit, color_hex, icon, tags, attr) VALUES
('backlog', 'Backlog', 'Tasks waiting to be prioritized', 1, true, false, false, NULL, '#6B7280', 'inbox', '["backlog", "unassigned"]', '{"auto_assign": false, "priority_required": false}'),
('todo', 'To Do', 'Tasks ready to be started', 2, false, false, false, 10, '#3B82F6', 'circle-dot', '["ready", "prioritized"]', '{"assignment_required": true, "effort_estimated": true}'),
('in_progress', 'In Progress', 'Tasks actively being worked on', 3, false, false, false, 5, '#F59E0B', 'play-circle', '["active", "executing"]', '{"time_tracking": true, "daily_updates": true}'),
('review', 'Review', 'Tasks awaiting review or approval', 4, false, false, false, 3, '#8B5CF6', 'eye', '["review", "validation"]', '{"reviewer_assigned": true, "criteria_defined": true}'),
('done', 'Done', 'Completed and accepted tasks', 5, false, true, false, NULL, '#10B981', 'check-circle', '["completed", "accepted"]', '{"acceptance_criteria_met": true, "stakeholder_approved": true}'),
('blocked', 'Blocked', 'Tasks blocked by external factors', 6, false, false, true, NULL, '#DC2626', 'octagon', '["blocked", "external"]', '{"blocker_identified": true, "escalation_path": true}');

-- Indexes removed for simplified import
