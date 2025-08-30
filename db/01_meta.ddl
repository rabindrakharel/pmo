-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Meta configuration tables define foundational vocabulary and structural definitions 
-- for hierarchical levels, statuses, stages, and organizational patterns.
--
-- Key Components:
-- Every level go from 0-n, with 0 being the highest level (e.g., Corporation, Corp-Region, C-Level).
-- Each level has a name, description, sort order, and flags for leaf levels.
-- Statuses and stages have codes, names, descriptions, sort orders, and flags for initial/final states.
-- Tags and attributes are stored as JSONB for flexibility.
-- Timestamps track the validity period and lifecycle of each entry.
-- • Business hierarchy levels (Corporation → Division → Department) goes level_id 0,1,2
-- • Location hierarchy levels (Corp-Region → Country → Province → Region → City → Address) goes level_id 0,1,2,3,4,5
-- • HR hierarchy levels (C-Level → VP → Director → Manager → Team Lead → Senior → Associate → Engineer) goes level_id 0,1,2,3,4,5,6,7
-- • Project workflow states (DRAFT → PLANNING → APPROVED → ACTIVE → COMPLETED/CANCELLED) goes level 0 to 4
-- • Task workflow states (OPEN → IN_PROGRESS → BLOCKED → REVIEW → DONE → CLOSED) goes level 0 to 5
-- • Kanban stages (backlog → todo → in_progress → review → done → blocked) goes level 0 to 5

-- ============================================================================
-- DDL:
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
-- DATA CURATION:
-- ============================================================================

-- Business Hierarchy Levels (Corrected - Corporation starts at level 0)
INSERT INTO app.meta_biz_level (level_id, name, "descr", sort_order, is_leaf_level, tags, attr) VALUES
(0, 'Corporation', 'Top-level corporate entity with board governance', 0, false, '["enterprise", "root", "legal-entity"]', '{"max_children": 50, "requires_board": true, "governance": "board", "compliance": ["SOX", "securities"], "reporting": "public"}'),
(1, 'Division', 'Major business division with P&L responsibility', 1, false, '["division", "strategic", "profit-center"]', '{"max_children": 20, "has_p_and_l": true, "governance": "executive", "budget_authority": "high", "market_focus": true}'),
(2, 'Department', 'Functional department with operational focus', 2, false, '["department", "operational", "functional"]', '{"max_children": 15, "has_budget": true, "governance": "management", "specialization": "functional", "cross_functional": false}'),
(3, 'Team', 'Working team unit with specific deliverables', 3, false, '["team", "tactical", "delivery"]', '{"max_children": 8, "has_manager": true, "governance": "team-lead", "delivery_focus": true, "agile_enabled": true}'),
(4, 'Squad', 'Agile squad with cross-functional capabilities', 4, false, '["squad", "agile", "cross-functional"]', '{"max_children": 6, "has_lead": true, "governance": "servant-leader", "methodology": "scrum", "autonomy": "high"}'),
(5, 'Sub-team', 'Specialized sub-team for specific functions', 5, true, '["subteam", "specialized", "focused"]', '{"max_children": 0, "has_lead": true, "governance": "peer", "specialization": "technical", "temporary": false}');

-- Canadian Location Hierarchy Levels (Corrected - starts at level 0)
INSERT INTO app.meta_loc_level (level_id, name, "descr", country_code, sort_order, is_leaf_level, tags, attr) VALUES
(0, 'Corp-Region', 'Corporate regional division spanning multiple countries', 'CA', 0, false, '["corporate", "region", "international"]', '{"timezone_span": true, "multi_country": true, "currency_zones": ["CAD", "USD", "EUR"], "coordination_complexity": "high"}'),
(1, 'Country', 'National boundary with federal jurisdiction', 'CA', 1, false, '["country", "national", "sovereign"]', '{"has_federal_law": true, "currency": "CAD", "languages": ["en", "fr"], "tax_system": "federal_provincial"}'),
(2, 'Province', 'Provincial/territorial division with legislative authority', 'CA', 2, false, '["province", "territorial", "legislative"]', '{"has_provincial_law": true, "tax_jurisdiction": true, "healthcare_jurisdiction": true, "education_authority": true}'),
(3, 'Economic Region', 'Statistics Canada economic region for reporting', 'CA', 3, false, '["region", "economic", "statistical"]', '{"statscan_classification": true, "economic_reporting": true, "labour_market": true, "development_agency": true}'),
(4, 'Metropolitan Area', 'Census metropolitan area or agglomeration', 'CA', 4, false, '["metropolitan", "urban", "census"]', '{"population_threshold": 100000, "commuting_area": true, "urban_core": true, "statistical_unit": true}'),
(5, 'City', 'Municipal corporation with local government', 'CA', 5, false, '["city", "municipal", "incorporated"]', '{"has_municipal_law": true, "service_delivery": true, "property_tax": true, "local_governance": true}'),
(6, 'District', 'Municipal district or neighbourhood', 'CA', 6, false, '["district", "neighbourhood", "administrative"]', '{"service_area": true, "postal_sorting": true, "local_services": true, "community_identity": true}'),
(7, 'Address', 'Specific street address and postal code', 'CA', 7, true, '["address", "location", "physical"]', '{"geocodable": true, "service_point": true, "delivery_address": true, "precise_location": true}');

-- HR Hierarchy Levels with Canadian Salary Bands (CAD) - Corrected starting at level 0
INSERT INTO app.meta_hr_level (level_id, name, "descr", salary_band_min, salary_band_max, sort_order, is_management, is_executive, tags, attr) VALUES
-- Executive Levels (C-Suite)
(0, 'CEO/President', 'Chief Executive Officer or President', 300000, 600000, 0, true, true, '["executive", "c-suite", "ceo"]', '{"board_reporting": true, "equity_eligible": true, "stock_options": true, "governance": "board", "public_facing": true}'),
(1, 'C-Level', 'Chief Officers (CTO, CFO, COO, etc.)', 250000, 450000, 1, true, true, '["executive", "c-suite", "chief"]', '{"board_reporting": true, "equity_eligible": true, "stock_options": true, "governance": "executive", "strategic_planning": true}'),
(2, 'SVP/EVP', 'Senior/Executive Vice President', 200000, 350000, 2, true, true, '["executive", "svp", "evp"]', '{"multi_division": true, "equity_eligible": true, "strategic_input": true, "cross_functional": true}'),

-- Vice President Levels
(3, 'VP', 'Vice President', 150000, 280000, 3, true, true, '["executive", "vp", "divisional"]', '{"direct_reports": 8, "budget_authority": 15000000, "p_and_l": true, "divisional_responsibility": true}'),
(4, 'AVP', 'Assistant Vice President', 130000, 220000, 4, true, false, '["management", "avp", "senior-management"]', '{"direct_reports": 6, "budget_authority": 8000000, "specialized_expertise": true}'),

-- Director Levels  
(5, 'Senior Director', 'Senior Director Level', 120000, 190000, 5, true, false, '["management", "senior-director", "strategic"]', '{"direct_reports": 12, "budget_authority": 5000000, "cross_departmental": true, "strategic_planning": true}'),
(6, 'Director', 'Director Level', 100000, 160000, 6, true, false, '["management", "director", "departmental"]', '{"direct_reports": 10, "budget_authority": 3000000, "departmental_oversight": true, "hiring_authority": true}'),
(7, 'Associate Director', 'Associate Director Level', 90000, 140000, 7, true, false, '["management", "associate-director", "program"]', '{"direct_reports": 8, "budget_authority": 1500000, "program_management": true}');

-- Project Status Lifecycle (Expanded)
INSERT INTO app.meta_project_status (code, name, "descr", sort_id, is_initial, is_final, is_active, color_hex, icon, tags, attr) VALUES
-- Initial States
('DRAFT', 'Draft', 'Project in draft state, being prepared', 1, true, false, false, '#6B7280', 'edit', '["initial", "editable", "preparation"]', '{"can_edit": true, "requires_approval": false, "auto_save": true, "collaboration": true}'),
('SUBMITTED', 'Submitted', 'Project submitted for review', 2, false, false, false, '#3B82F6', 'send', '["submitted", "review-pending"]', '{"can_edit": false, "awaiting_review": true, "notification_sent": true}'),

-- Planning States  
('UNDER_REVIEW', 'Under Review', 'Project being reviewed by governance', 3, false, false, false, '#8B5CF6', 'eye', '["review", "governance"]', '{"reviewer_assigned": true, "review_criteria": true, "feedback_enabled": true}'),
('PLANNING', 'Planning', 'Approved for detailed planning phase', 4, false, false, false, '#3B82F6', 'calendar', '["planning", "detailed-design"]', '{"resource_planning": true, "timeline_development": true, "risk_assessment": true}'),
('BUDGETING', 'Budgeting', 'Budget allocation and approval in progress', 5, false, false, false, '#F59E0B', 'dollar-sign', '["budgeting", "financial"]', '{"budget_estimation": true, "cost_analysis": true, "financial_approval": true}'),

-- Approved States
('APPROVED', 'Approved', 'Project approved and ready to start', 6, false, false, false, '#10B981', 'check-circle', '["approved", "ready", "go-live-ready"]', '{"can_start": true, "budget_allocated": true, "team_assigned": true, "charter_signed": true}'),
('SCHEDULED', 'Scheduled', 'Project scheduled with start date', 7, false, false, false, '#06B6D4', 'clock', '["scheduled", "planned-start"]', '{"start_date_set": true, "resource_booked": true, "dependencies_cleared": true}'),

-- Active States
('ACTIVE', 'Active', 'Project currently in progress', 8, false, false, true, '#10B981', 'play-circle', '["active", "executing", "in-progress"]', '{"in_progress": true, "resources_assigned": true, "deliverables_tracking": true, "status_reporting": true}'),
('AT_RISK', 'At Risk', 'Project active but facing significant risks', 9, false, false, true, '#F59E0B', 'alert-triangle', '["active", "risk", "attention-needed"]', '{"risk_mitigation": true, "escalation_required": true, "close_monitoring": true}'),
('CRITICAL', 'Critical', 'Project in critical state requiring immediate action', 10, false, false, true, '#DC2626', 'alert-octagon', '["active", "critical", "emergency"]', '{"immediate_action": true, "executive_attention": true, "recovery_plan": true}'),

-- Suspended States
('ON_HOLD', 'On Hold', 'Project temporarily suspended', 11, false, false, false, '#8B5CF6', 'pause-circle', '["suspended", "waiting", "temporary"]', '{"can_resume": true, "resources_reassignable": true, "hold_reason": true, "resume_criteria": true}'),
('BLOCKED', 'Blocked', 'Project blocked by external dependencies', 12, false, false, false, '#DC2626', 'octagon', '["blocked", "dependency", "external"]', '{"blocker_identified": true, "resolution_owner": true, "escalation_path": true}'),

-- Completion States
('COMPLETED', 'Completed', 'Project successfully completed', 13, false, true, false, '#059669', 'check-circle-2', '["completed", "success", "delivered"]', '{"deliverables_met": true, "lessons_learned": true, "client_acceptance": true, "post_implementation_review": true}'),
('DELIVERED', 'Delivered', 'Project delivered and in warranty period', 14, false, true, false, '#10B981', 'package-check', '["delivered", "warranty", "support"]', '{"warranty_period": true, "support_transition": true, "knowledge_transfer": true}'),

-- Terminated States
('CANCELLED', 'Cancelled', 'Project cancelled before completion', 15, false, true, false, '#DC2626', 'x-circle', '["cancelled", "terminated", "stopped"]', '{"resources_released": true, "cancellation_reason": true, "stakeholder_notification": true, "asset_disposition": true}'),
('SUSPENDED_INDEFINITELY', 'Suspended Indefinitely', 'Project suspended with no restart plan', 16, false, true, false, '#6B7280', 'pause', '["suspended", "indefinite", "terminated"]', '{"resources_released": true, "documentation_archived": true, "potential_restart": false}');

-- Project Management Stages (PMBOK Aligned)
INSERT INTO app.meta_project_stage (level_id, name, "descr", duration_weeks, is_milestone, deliverables, tags, attr) VALUES
(1, 'Initiation', 'Project charter and initial planning', 2, true, '["Project Charter", "Stakeholder Register", "Business Case", "Initial Scope Statement"]', '["start", "charter", "authorization"]', '{"approval_required": true, "budget_estimate": true, "stakeholder_identification": true, "business_justification": true}'),
(2, 'Planning', 'Comprehensive project planning and design', 4, true, '["Project Management Plan", "Work Breakdown Structure", "Schedule", "Budget", "Risk Register", "Quality Plan", "Communications Plan", "Procurement Plan"]', '["planning", "design", "comprehensive"]', '{"detailed_schedule": true, "resource_allocation": true, "risk_planning": true, "baseline_establishment": true}'),
(3, 'Execution', 'Active project implementation and delivery', 12, false, '["Deliverable Increments", "Quality Deliverables", "Team Performance Assessments", "Change Requests", "Issue Logs", "Status Reports"]', '["execution", "delivery", "production"]', '{"active_monitoring": true, "quality_gates": true, "team_development": true, "stakeholder_engagement": true}'),
(4, 'Monitoring & Controlling', 'Performance monitoring and integrated change control', 2, false, '["Performance Reports", "Variance Analysis", "Change Request Decisions", "Risk Updates", "Issue Resolution", "Quality Control Measurements"]', '["monitoring", "control", "oversight"]', '{"kpi_tracking": true, "change_management": true, "performance_analysis": true, "corrective_actions": true}'),
(5, 'Closure', 'Project closure and organizational learning', 1, true, '["Final Product/Service", "Project Closure Documents", "Lessons Learned", "Final Report", "Archived Project Documents", "Released Project Resources"]', '["closure", "retrospective", "transition"]', '{"final_approval": true, "knowledge_transfer": true, "resource_release": true, "organizational_learning": true}');

-- Task Status Workflow (Comprehensive)
INSERT INTO app.meta_task_status (code, name, "descr", sort_id, is_initial, is_final, is_blocked, color_hex, icon, tags, attr) VALUES
-- Initial States
('OPEN', 'Open', 'Task created and ready to be worked on', 1, true, false, false, '#6B7280', 'circle', '["initial", "available", "unassigned"]', '{"can_assign": true, "effort_estimation": false, "prioritization_needed": true}'),
('ASSIGNED', 'Assigned', 'Task assigned to team member', 2, false, false, false, '#3B82F6', 'user-check', '["assigned", "ready", "planned"]', '{"assignee_set": true, "effort_estimated": true, "ready_to_start": true}'),

-- Active States
('IN_PROGRESS', 'In Progress', 'Task actively being worked on', 3, false, false, false, '#F59E0B', 'play-circle', '["active", "executing", "development"]', '{"time_tracking": true, "progress_updates": true, "daily_standup": true}'),
('RESEARCHING', 'Researching', 'Task in research or analysis phase', 4, false, false, false, '#06B6D4', 'search', '["active", "research", "analysis"]', '{"research_required": true, "findings_documented": true, "spike_work": true}'),
('DEVELOPING', 'Developing', 'Task in active development', 5, false, false, false, '#10B981', 'code', '["active", "development", "building"]', '{"code_development": true, "feature_building": true, "technical_work": true}'),

-- Review States  
('CODE_REVIEW', 'Code Review', 'Code completed, awaiting peer review', 6, false, false, false, '#8B5CF6', 'git-pull-request', '["review", "code", "peer-review"]', '{"pr_created": true, "reviewer_assigned": true, "code_complete": true}'),
('TESTING', 'Testing', 'Task in testing phase', 7, false, false, false, '#F59E0B', 'bug', '["review", "testing", "qa"]', '{"test_cases": true, "qa_assigned": true, "acceptance_criteria": true}'),
('REVIEW', 'Under Review', 'Task under stakeholder review', 8, false, false, false, '#8B5CF6', 'eye', '["review", "validation", "stakeholder"]', '{"requires_approval": true, "quality_check": true, "stakeholder_review": true}'),

-- Blocked States
('BLOCKED', 'Blocked', 'Task blocked by external dependency', 9, false, false, true, '#DC2626', 'octagon', '["blocked", "waiting", "dependency"]', '{"requires_unblocking": true, "dependency_tracking": true, "escalation_needed": true}'),
('ON_HOLD', 'On Hold', 'Task temporarily on hold', 10, false, false, false, '#6B7280', 'pause-circle', '["blocked", "hold", "waiting"]', '{"hold_reason": true, "resume_criteria": true, "temporary_suspension": true}'),

-- Completion States
('DONE', 'Done', 'Task completed and approved', 11, false, true, false, '#10B981', 'check-circle', '["completed", "approved", "delivered"]', '{"deliverable_accepted": true, "time_logged": true, "definition_of_done": true}'),
('DEPLOYED', 'Deployed', 'Task deployed to production', 12, false, true, false, '#059669', 'rocket', '["completed", "deployed", "live"]', '{"production_ready": true, "deployment_verified": true, "monitoring_enabled": true}'),
('VERIFIED', 'Verified', 'Task verified and functioning', 13, false, true, false, '#10B981', 'shield-check', '["completed", "verified", "quality-assured"]', '{"verification_complete": true, "acceptance_criteria_met": true, "stakeholder_signoff": true}'),

-- Terminated States
('CANCELLED', 'Cancelled', 'Task cancelled and will not be completed', 14, false, true, false, '#DC2626', 'x-circle', '["cancelled", "terminated", "abandoned"]', '{"cancellation_reason": true, "work_stopped": true, "resources_released": true}'),
('DEFERRED', 'Deferred', 'Task deferred to future release', 15, false, true, false, '#6B7280', 'calendar-x', '["deferred", "future", "postponed"]', '{"future_release": true, "deferral_reason": true, "backlog_return": true}');

-- Kanban Task Stages (Enhanced Workflow)
INSERT INTO app.meta_task_stage (code, name, "descr", sort_id, is_default, is_done, is_blocked, wip_limit, color_hex, icon, tags, attr) VALUES
-- Backlog and Planning
('icebox', 'Icebox', 'Ideas and future tasks not yet prioritized', 1, false, false, false, NULL, '#9CA3AF', 'snowflake', '["icebox", "future", "ideas"]', '{"priority_scoring": false, "effort_estimation": false, "long_term_storage": true}'),
('backlog', 'Backlog', 'Tasks waiting to be prioritized and planned', 2, true, false, false, NULL, '#6B7280', 'inbox', '["backlog", "unassigned", "unprioritized"]', '{"auto_assign": false, "priority_required": false, "grooming_needed": true}'),
('ready', 'Ready', 'Tasks prioritized and ready for sprint planning', 3, false, false, false, 20, '#3B82F6', 'circle-dot', '["ready", "prioritized", "groomed"]', '{"priority_set": true, "effort_estimated": true, "acceptance_criteria": true}'),
('todo', 'To Do', 'Tasks planned for current sprint', 4, false, false, false, 10, '#06B6D4', 'calendar-check', '["todo", "sprint", "planned"]', '{"assignment_required": true, "sprint_committed": true, "ready_to_start": true}'),

-- Active Work
('in_progress', 'In Progress', 'Tasks actively being worked on', 5, false, false, false, 5, '#F59E0B', 'play-circle', '["active", "executing", "development"]', '{"time_tracking": true, "daily_updates": true, "progress_visible": true}'),
('code_review', 'Code Review', 'Code completed, awaiting peer review', 6, false, false, false, 3, '#8B5CF6', 'git-pull-request', '["review", "code", "peer"]', '{"pr_created": true, "reviewer_assigned": true, "merge_ready": false}'),
('testing', 'Testing', 'Tasks in testing and quality assurance', 7, false, false, false, 4, '#F59E0B', 'bug', '["testing", "qa", "validation"]', '{"test_cases_run": true, "qa_assigned": true, "defect_tracking": true}'),

-- Review and Validation  
('review', 'Review', 'Tasks awaiting stakeholder review and approval', 8, false, false, false, 3, '#8B5CF6', 'eye', '["review", "validation", "approval"]', '{"reviewer_assigned": true, "criteria_defined": true, "stakeholder_involved": true}'),
('uat', 'User Acceptance Testing', 'Tasks in user acceptance testing', 9, false, false, false, 2, '#A855F7', 'users', '["uat", "user-testing", "acceptance"]', '{"user_testing": true, "business_validation": true, "sign_off_required": true}'),

-- Deployment
('ready_for_deploy', 'Ready for Deploy', 'Tasks ready for production deployment', 10, false, false, false, 5, '#10B981', 'rocket', '["deployment", "ready", "production"]', '{"deployment_ready": true, "release_notes": true, "rollback_plan": true}'),
('deployed', 'Deployed', 'Tasks deployed to production', 11, false, false, false, NULL, '#059669', 'check-circle-2', '["deployed", "production", "live"]', '{"production_verified": true, "monitoring_enabled": true, "post_deploy_check": true}'),

-- Completion
('done', 'Done', 'Completed and fully accepted tasks', 12, false, true, false, NULL, '#10B981', 'check-circle', '["completed", "accepted", "closed"]', '{"acceptance_criteria_met": true, "stakeholder_approved": true, "documentation_complete": true}'),

-- Exception Handling
('blocked', 'Blocked', 'Tasks blocked by external dependencies', 13, false, false, true, NULL, '#DC2626', 'octagon', '["blocked", "external", "dependency"]', '{"blocker_identified": true, "escalation_path": true, "unblock_criteria": true}'),
('on_hold', 'On Hold', 'Tasks temporarily suspended', 14, false, false, false, NULL, '#6B7280', 'pause-circle', '["hold", "suspended", "waiting"]', '{"hold_reason": true, "resume_criteria": true, "resource_reallocation": true}');

-- Indexes removed for simplified import
