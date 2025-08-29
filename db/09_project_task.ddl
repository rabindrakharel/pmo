-- ============================================================================
-- PROJECT AND TASK SCOPE HIERARCHY (Operational Execution and Management)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The project and task scope hierarchy represents the operational execution
-- framework that defines how work is organized, managed, and delivered within
-- the PMO. It provides the foundational structure for project lifecycle
-- management, task orchestration, and operational delivery across the organization.
--
-- ARCHITECTURAL PURPOSE:
-- The project and task tables serve as the operational execution backbone that enables:
--
-- • PROJECT LIFECYCLE MANAGEMENT: End-to-end project planning, execution, and delivery
-- • TASK ORCHESTRATION: Granular work breakdown and assignment management
-- • RESOURCE ALLOCATION: Human and material resource assignment to specific work items
-- • PROGRESS TRACKING: Real-time monitoring of project and task completion status
-- • STAKEHOLDER COORDINATION: Client engagement, approvals, and collaboration workflows
-- • OPERATIONAL GOVERNANCE: Project oversight, compliance, and quality management
--
-- PROJECT AND TASK HIERARCHY DESIGN:
-- The hierarchy follows simplified PMO operational patterns:
--
-- Level 1 (Project): Individual deliverable projects (Customer Portal V2)
-- Level 2 (Task): Major work items (Database Migration, API Development)
-- Level 3 (Subtask): Task components (Write unit tests, Configure OAuth)
-- Level 4 (Sub-subtask): Granular work items (Test specific edge cases)
--
-- MULTI-DIMENSIONAL INTEGRATION:
-- Projects and tasks integrate with all organizational dimensions:
--
-- • BUSINESS INTEGRATION: Projects owned by business units with budget responsibility
-- • LOCATION INTEGRATION: Projects executed across geographic locations
-- • HR INTEGRATION: Teams assigned through HR hierarchy and reporting structure
-- • WORKSITE INTEGRATION: Physical execution at specific operational facilities
-- • CLIENT INTEGRATION: External stakeholder engagement and service delivery
--
-- OPERATIONAL WORKFLOW PATTERNS:
-- Project and task execution supports complex operational workflows:
--
-- • PROJECT GOVERNANCE: Multi-level approval chains and oversight committees
-- • TASK ASSIGNMENT: Dynamic resource allocation based on skills and availability
-- • CLIENT COLLABORATION: External stakeholder integration and feedback loops
-- • CROSS-FUNCTIONAL TEAMS: Matrix organization support across business units
-- • MILESTONE TRACKING: Phase gates, deliverables, and quality checkpoints
--
-- REAL-WORLD PMO SCENARIOS:
--
-- 1. PLATFORM MODERNIZATION PROJECT:
--    - Project: "Core Platform Migration" (Analysis, Design, Build, Deploy)
--    - Tasks: Database migration, API development, security implementation
--    - Subtasks: Write migration scripts, unit tests, security reviews
--    - Teams: Backend, Frontend, DevOps, Security across Toronto and Montreal
--    - Clients: Internal stakeholders and external integration partners
--
-- 2. CLIENT SERVICE DELIVERY PROJECT:
--    - Project: "Ontario Government Portal" with restricted security requirements
--    - Tasks: Portal development, identity integration, accessibility compliance
--    - Subtasks: Bilingual content, WCAG testing, security clearance workflows
--    - Execution: Mixed on-site (Ottawa) and remote development teams
--    - Compliance: Government standards, accessibility, bilingual requirements
--
-- 3. INNOVATION RESEARCH PROJECT:
--    - Project: "AI-Powered Analytics Platform" research and development
--    - Tasks: Data modeling, algorithm development, prototype testing
--    - Subtasks: Model training, performance optimization, user interface design
--    - Teams: Montreal R&D Lab, Toronto ML engineers, Vancouver UX designers
--    - Resources: Specialized equipment, cloud computing, external consultants
--
-- PERMISSION AND ACCESS CONTROL INTEGRATION:
-- Projects and tasks integrate with the unified scope system to provide:
--
-- • PROJECT-LEVEL PERMISSIONS: Scope-based access to entire project resources
-- • TASK-LEVEL GRANULARITY: Fine-grained permissions for specific work items
-- • ROLE-BASED ACCESS: Different permission levels for project roles (PM, Developer, QA)
-- • CLIENT ACCESS: External stakeholder permissions for collaboration and review
-- • CROSS-SCOPE INHERITANCE: Business, location, and HR scope permissions flow to projects
--
-- OPERATIONAL EFFICIENCY AND SCALABILITY:
-- The design supports enterprise-scale operations:
-- - Dynamic project creation and resource allocation
-- - Flexible team structures for agile and waterfall methodologies
-- - Integration with external client systems and stakeholders
-- - Real-time progress tracking and reporting across all organizational dimensions
-- - Automated workflow triggers based on task completion and milestone achievement
--
-- DATA LINEAGE AND AUDIT TRAILS:
-- Complete operational traceability through:
-- - Project and task state changes with temporal tracking
-- - Resource assignment history and time-based allocation
-- - Client interaction logs and approval workflows
-- - Cross-scope permission inheritance and access patterns
-- - Performance metrics and delivery timeline analysis

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

-- Project Head Table (Project Definition and Scope)
CREATE TABLE app.ops_project_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  "descr" text,
  slug text UNIQUE,
  project_code text, -- Unique project identifier for operational systems
  project_type text DEFAULT 'development', -- 'development', 'infrastructure', 'research', 'service', 'maintenance'
  priority_level text DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical', 'emergency'
  
  -- Business and operational context
  client_id uuid, -- Primary client for external projects
  budget_allocated numeric(15,2), -- Project budget in CAD
  budget_currency text DEFAULT 'CAD',
  
  -- Scope relationships (integrated with d_scope_unified)
  business_scope_id uuid, -- Primary business unit ownership
  location_scope_id uuid, -- Primary execution location
  worksite_scope_id uuid, -- Primary worksite for execution
  
  -- Project team and stakeholders
  project_manager_id uuid, -- Project manager (references d_emp)
  project_sponsor_id uuid, -- Executive sponsor (references d_emp)
  technical_lead_id uuid, -- Technical leadership (references d_emp)
  
  -- Client and external stakeholder management
  client_contacts jsonb DEFAULT '[]'::jsonb, -- External client contact information
  stakeholders uuid[] DEFAULT '{}'::uuid[], -- Internal stakeholder IDs
  approvers uuid[] DEFAULT '{}'::uuid[], -- Approval chain for project decisions
  
  -- Project timeline and planning
  planned_start_date date,
  planned_end_date date,
  estimated_hours numeric(10,2),
  
  -- Compliance and governance
  security_classification text DEFAULT 'internal', -- 'public', 'internal', 'confidential', 'restricted', 'classified'
  compliance_requirements jsonb DEFAULT '[]'::jsonb, -- Regulatory and standards compliance
  risk_assessment jsonb DEFAULT '{}'::jsonb, -- Risk register and mitigation plans
  
  -- Standard audit and metadata
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
  
  -- Constraints
  CONSTRAINT chk_project_type CHECK (project_type IN ('development', 'infrastructure', 'research', 'service', 'maintenance')),
  CONSTRAINT chk_priority_level CHECK (priority_level IN ('low', 'medium', 'high', 'critical', 'emergency')),
  CONSTRAINT chk_security_classification CHECK (security_classification IN ('public', 'internal', 'confidential', 'restricted', 'classified')),
  CONSTRAINT chk_budget_positive CHECK (budget_allocated IS NULL OR budget_allocated >= 0),
  CONSTRAINT chk_estimated_hours_positive CHECK (estimated_hours IS NULL OR estimated_hours > 0)
  -- Project codes should be unique when specified (removed constraints for simplified import)
);

-- Enforce uniqueness for non-null project_code
CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_project_head_project_code
  ON app.ops_project_head(project_code)
  WHERE project_code IS NOT NULL;

-- Project Records Table (Project Status and Timeline Tracking)
CREATE TABLE app.ops_project_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_project_head(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  
  -- Project status and phase tracking
  status_id uuid NOT NULL REFERENCES app.meta_project_status(id),
  stage_id int REFERENCES app.meta_project_stage(level_id),
  phase_name text, -- Current phase description
  
  -- Progress and performance metrics
  completion_percentage numeric(5,2) DEFAULT 0.0,
  actual_start_date date,
  actual_end_date date,
  actual_hours numeric(10,2),
  budget_spent numeric(15,2),
  
  -- Timeline and milestone tracking
  milestones_achieved jsonb DEFAULT '[]'::jsonb,
  deliverables_completed jsonb DEFAULT '[]'::jsonb,
  next_milestone jsonb DEFAULT '{}'::jsonb,
  
  -- Quality and performance indicators
  quality_metrics jsonb DEFAULT '{}'::jsonb,
  performance_indicators jsonb DEFAULT '{}'::jsonb,
  client_satisfaction_score numeric(3,2), -- 1.0 to 5.0 rating
  
  -- Standard audit and metadata  
  dates jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
  );

-- Task Head Table (Task Definition and Assignment)
CREATE TABLE app.ops_task_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proj_head_id uuid NOT NULL REFERENCES app.ops_project_head(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES app.ops_task_head(id) ON DELETE SET NULL,
  
  -- Task identification and description
  title text NOT NULL,
  "descr" text,
  task_code text, -- Unique task identifier within project
  task_type text DEFAULT 'development', -- 'development', 'testing', 'deployment', 'analysis', 'design', 'review'
  priority text DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  
  -- Task assignment and ownership
  assignee_id uuid REFERENCES app.d_emp(id) ON DELETE SET NULL,
  reporter_id uuid REFERENCES app.d_emp(id) ON DELETE SET NULL,
  
  -- Collaboration and workflow
  reviewers uuid[] NOT NULL DEFAULT '{}'::uuid[], -- Task reviewers (refs d_emp.id)
  approvers uuid[] NOT NULL DEFAULT '{}'::uuid[], -- Task approvers (refs d_emp.id) 
  collaborators uuid[] NOT NULL DEFAULT '{}'::uuid[], -- Task collaborators (refs d_emp.id)
  watchers uuid[] NOT NULL DEFAULT '{}'::uuid[], -- Task watchers/observers (refs d_emp.id)
  
  -- Client and external stakeholder management
  client_group_id uuid REFERENCES app.d_client_grp(id) ON DELETE SET NULL,
  clients uuid[] NOT NULL DEFAULT '{}'::uuid[], -- External client contacts (refs d_client.id)
  
  -- Location and worksite context
  worksite_id uuid REFERENCES app.d_scope_worksite(id) ON DELETE SET NULL,
  location_context text, -- Location-specific task requirements
  
  -- Task planning and estimation
  estimated_hours numeric(8,2),
  story_points int, -- Agile story point estimation
  planned_start_date date,
  planned_end_date date,
  
  -- Dependencies and relationships
  depends_on_tasks uuid[] DEFAULT '{}'::uuid[], -- Prerequisite tasks
  blocks_tasks uuid[] DEFAULT '{}'::uuid[], -- Tasks blocked by this task
  related_tasks uuid[] DEFAULT '{}'::uuid[], -- Related/linked tasks
  
  -- Task metadata and attributes
  labels jsonb DEFAULT '[]'::jsonb, -- Task labels/tags for categorization
  custom_fields jsonb DEFAULT '{}'::jsonb, -- Project-specific custom fields
  
  -- Standard audit fields
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);



-- Task Records Table (Task Status, Progress Tracking, and Activity Logging)
CREATE TABLE app.ops_task_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  
  -- Task status and workflow state
  status_id uuid NOT NULL REFERENCES app.meta_task_status(id),
  stage_id uuid NOT NULL REFERENCES app.meta_task_stage(id),
  workflow_state text, -- Current workflow state (todo, in_progress, review, done)
  
  -- Progress tracking
  completion_percentage numeric(5,2) DEFAULT 0.0,
  actual_start_date date,
  actual_end_date date,
  actual_hours numeric(8,2),
  
  -- Quality and acceptance criteria
  acceptance_criteria jsonb DEFAULT '[]'::jsonb,
  acceptance_status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'requires_changes'
  quality_gate_status text DEFAULT 'not_started', -- 'not_started', 'in_progress', 'passed', 'failed'
  
  -- Work log and time tracking (consolidated from task log tables)
  work_log jsonb DEFAULT '[]'::jsonb, -- Time entries and work descriptions
  time_spent numeric(8,2) DEFAULT 0.0, -- Total time spent in hours
  
  -- Activity logging (merged from ops_tasklog_head and ops_task_log)
  log_schema jsonb DEFAULT '{}'::jsonb, -- Log entry schema definition
  log_version int DEFAULT 1, -- Log schema version
  log_type_id uuid, -- Type of log activity (future: REFERENCES app.meta_tasklog_type(id))
  log_state_id uuid, -- Current log state (future: REFERENCES app.meta_tasklog_state(id))
  log_data jsonb DEFAULT '{}'::jsonb, -- Detailed activity log data
  
  -- Time tracking for specific log entries
  start_ts timestamptz, -- Activity start timestamp
  end_ts timestamptz, -- Activity end timestamp
  
  -- Log ownership and workflow
  log_owner_id uuid REFERENCES app.d_emp(id) ON DELETE SET NULL, -- Log entry owner
  log_assignee_id uuid REFERENCES app.d_emp(id) ON DELETE SET NULL, -- Log assignee
  log_reviewers uuid[] DEFAULT '{}'::uuid[], -- Log reviewers
  log_approvers uuid[] DEFAULT '{}'::uuid[], -- Log approvers
  log_collaborators uuid[] DEFAULT '{}'::uuid[], -- Log collaborators
  
  -- Worksite and client context for logging
  log_worksite_id uuid REFERENCES app.d_scope_worksite(id) ON DELETE SET NULL,
  log_client_group_id uuid REFERENCES app.d_client_grp(id) ON DELETE SET NULL,
  log_clients uuid[] DEFAULT '{}'::uuid[], -- Client contacts for this log entry
  
  -- Deliverables and artifacts
  deliverables jsonb DEFAULT '[]'::jsonb, -- Task deliverables and artifacts
  test_results jsonb DEFAULT '{}'::jsonb, -- Testing results and metrics
  
  -- Standard audit and metadata
  title text NOT NULL, -- Task title at this point in time
  due_date date, -- Current due date
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);



-- Employee Group Table (Task Team Management)
CREATE TABLE app.d_emp_grp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  emp_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE CASCADE,
  role_in_task text DEFAULT 'contributor', -- 'lead', 'contributor', 'reviewer', 'approver', 'observer'
  allocation_percentage numeric(5,2) DEFAULT 100.0, -- Percentage of time allocated to this task
  from_ts timestamptz NOT NULL,
  to_ts timestamptz,
  
  -- Standard audit fields
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
-- ============================================================================

-- Insert Canadian Technology Corporation Projects and Tasks
-- Note: These reference existing employees, clients, and scope entities from other tables
INSERT INTO app.ops_project_head (name, "descr", slug, project_code, project_type, priority_level, budget_allocated, budget_currency, business_scope_id, location_scope_id, worksite_scope_id, planned_start_date, planned_end_date, estimated_hours, security_classification, compliance_requirements, risk_assessment, tenant_id, tags, attr) VALUES

-- Strategic Platform Modernization Project
('Platform Modernization 2024', 'Comprehensive infrastructure modernization project to migrate legacy systems to cloud-native architecture with enhanced security and scalability', 'platform-modernization-2024', 'PM-2024-001', 'infrastructure', 'critical', 2500000.00, 'CAD', 
 (SELECT id FROM app.d_scope_business WHERE name = 'Platform Engineering' LIMIT 1),
 (SELECT id FROM app.d_scope_location WHERE name = 'Toronto' LIMIT 1),
 (SELECT id FROM app.d_scope_worksite WHERE name = 'TechCorp Toronto HQ' LIMIT 1),
 '2024-01-15', '2024-12-15', 8000.0, 'confidential', 
 '["ISO 27001", "SOC 2 Type II", "PIPEDA", "Cloud Security Standards"]'::jsonb,
 '{"budget_risk": "medium", "timeline_risk": "high", "technical_complexity": "high", "stakeholder_impact": "critical"}'::jsonb,
 (SELECT gen_random_uuid()), 
 '["infrastructure", "cloud", "modernization", "strategic"]', 
 '{"methodology": "Agile", "delivery_model": "Phased", "team_size": 25, "external_vendors": ["AWS", "CloudFlare"], "compliance_audit": "Q3-2024"}'),

-- Mobile Application Development Project  
('Mobile App V2', 'Next generation mobile application with enhanced user experience, offline capabilities, and real-time synchronization', 'mobile-app-v2', 'MA-2024-002', 'development', 'high', 850000.00, 'CAD',
 (SELECT id FROM app.d_scope_business WHERE name = 'Product Development' LIMIT 1),
 (SELECT id FROM app.d_scope_location WHERE name = 'Toronto' LIMIT 1),
 (SELECT id FROM app.d_scope_worksite WHERE name = 'TechCorp Toronto Dev Center' LIMIT 1),
 '2024-03-01', '2024-10-30', 3200.0, 'internal',
 '["App Store Guidelines", "Google Play Policies", "AODA Accessibility"]'::jsonb,
 '{"budget_risk": "low", "timeline_risk": "medium", "market_competition": "high", "user_adoption": "medium"}'::jsonb,
 (SELECT gen_random_uuid()),
 '["mobile", "development", "user-experience", "real-time"]',
 '{"platforms": ["iOS", "Android"], "framework": "React Native", "offline_support": true, "team_distribution": {"Toronto": 12, "Montreal": 3}}'),

-- Ontario Government Client Portal
('Ontario Client Portal', 'Secure government service portal with bilingual support, accessibility compliance, and integrated identity management', 'ontario-client-portal', 'OCP-2024-003', 'service', 'critical', 1200000.00, 'CAD',
 (SELECT id FROM app.d_scope_business WHERE name = 'Customer Success' LIMIT 1),
 (SELECT id FROM app.d_scope_location WHERE name = 'Ottawa' LIMIT 1),
 (SELECT id FROM app.d_scope_worksite WHERE name = 'TechCorp Ottawa Client Center' LIMIT 1),
 '2024-02-01', '2024-11-30', 4500.0, 'restricted',
 '["Government of Canada Security Standards", "AODA", "Official Languages Act", "PIPEDA"]'::jsonb,
 '{"security_risk": "high", "compliance_risk": "critical", "political_visibility": "high", "technical_complexity": "medium"}'::jsonb,
 (SELECT gen_random_uuid()),
 '["government", "portal", "bilingual", "accessibility", "security"]',
 '{"languages": ["English", "French"], "clearance_required": "Secret", "accessibility_level": "WCAG 2.1 AA", "identity_provider": "Government SSO"}'),

-- Research and Development Innovation Lab
('AI-Powered Analytics Platform', 'Research and development project to create next-generation analytics platform using machine learning and artificial intelligence', 'ai-analytics-platform', 'AI-2024-004', 'research', 'medium', 600000.00, 'CAD',
 (SELECT id FROM app.d_scope_business WHERE name = 'Strategic Initiatives' LIMIT 1),
 (SELECT id FROM app.d_scope_location WHERE name = 'Montreal' LIMIT 1),
 (SELECT id FROM app.d_scope_worksite WHERE name = 'TechCorp Montreal R&D Lab' LIMIT 1),
 '2024-04-01', '2025-03-31', 2800.0, 'confidential',
 '["University Research Agreements", "IP Protection Protocols", "Ethics in AI"]'::jsonb,
 '{"technology_risk": "high", "market_viability": "medium", "ip_protection": "high", "research_timeline": "uncertain"}'::jsonb,
 (SELECT gen_random_uuid()),
 '["research", "ai", "analytics", "innovation", "machine-learning"]',
 '{"research_partners": ["McGill University", "Concordia"], "patent_applications": 3, "prototype_phase": "Phase 2", "funding_sources": ["Internal R&D", "Government Grant"]}'),

-- Cross-Regional Infrastructure Project
('Multi-Site Network Upgrade', 'Comprehensive network infrastructure upgrade across all Canadian facilities with enhanced security and redundancy', 'network-upgrade-2024', 'NET-2024-005', 'infrastructure', 'high', 450000.00, 'CAD',
 (SELECT id FROM app.d_scope_business WHERE name = 'Platform Engineering' LIMIT 1),
 (SELECT id FROM app.d_scope_location WHERE name = 'Canada' LIMIT 1),
 (SELECT id FROM app.d_scope_worksite WHERE name = 'TechCorp Toronto HQ' LIMIT 1),
 '2024-05-15', '2024-09-30', 1600.0, 'restricted',
 '["ISO 27001", "Network Security Standards", "Business Continuity"]'::jsonb,
 '{"downtime_risk": "high", "budget_overrun": "medium", "vendor_dependency": "high", "rollback_complexity": "high"}'::jsonb,
 (SELECT gen_random_uuid()),
 '["infrastructure", "network", "security", "multi-site", "upgrade"]',
 '{"sites_affected": 7, "downtime_windows": "weekends_only", "redundancy_level": "N+1", "vendor": "Cisco", "rollback_plan": "detailed"}');

-- Insert Project Records (Current Status)
INSERT INTO app.ops_project_records (head_id, from_ts, to_ts, active, status_id, phase_name, completion_percentage, actual_start_date, actual_hours, budget_spent, milestones_achieved, next_milestone, quality_metrics, performance_indicators, client_satisfaction_score, dates, tags, attr) VALUES

-- Platform Modernization Status
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'), now() - interval '3 months', NULL, true,
 (SELECT id FROM app.meta_project_status WHERE name = 'Active' LIMIT 1),
 'Development Phase', 65.0, '2024-01-15', 5200.0, 1625000.00,
 '["Requirements Analysis Completed", "Architecture Design Approved", "Phase 1 Migration Completed"]'::jsonb,
 '{"name": "Phase 2 Migration", "due_date": "2024-08-30", "deliverables": ["Database Migration", "API Modernization"]}'::jsonb,
 '{"code_coverage": 85, "security_scan_score": 92, "performance_improvement": 40}'::jsonb,
 '{"velocity": "above_target", "team_satisfaction": 4.2, "stakeholder_engagement": "high"}'::jsonb,
 4.3, '{"last_milestone": "2024-06-15", "next_review": "2024-07-30"}'::jsonb,
 '["phase-2", "on-track", "critical-path"]',
 '{"phase": 2, "sprint": 18, "release_version": "2.1.0", "deployment_env": "staging"}'),

-- Mobile App Status
((SELECT id FROM app.ops_project_head WHERE project_code = 'MA-2024-002'), now() - interval '2 months', NULL, true,
 (SELECT id FROM app.meta_project_status WHERE name = 'Active' LIMIT 1),
 'Testing Phase', 80.0, '2024-03-01', 2560.0, 680000.00,
 '["UI/UX Design Completed", "Core Features Developed", "Alpha Testing Completed"]'::jsonb,
 '{"name": "Beta Release", "due_date": "2024-08-15", "deliverables": ["App Store Submission", "Beta User Feedback"]}'::jsonb,
 '{"crash_rate": 0.1, "load_time": 2.3, "user_satisfaction": 4.5}'::jsonb,
 '{"development_velocity": "on_target", "defect_rate": "below_average", "team_morale": "high"}'::jsonb,
 4.6, '{"beta_launch": "2024-08-01", "production_release": "2024-10-15"}'::jsonb,
 '["beta", "testing", "user-feedback"]',
 '{"beta_users": 500, "platforms_ready": ["iOS", "Android"], "store_approval": "pending"}');

-- Insert Task Hierarchy for Platform Modernization Project
INSERT INTO app.ops_task_head (proj_head_id, parent_task_id, title, "descr", task_code, task_type, priority, assignee_id, reporter_id, reviewers, collaborators, estimated_hours, story_points, planned_start_date, planned_end_date, labels, custom_fields, tags, attr) VALUES

-- Main Task: Database Migration
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'), NULL,
 'Database Migration to PostgreSQL', 'Migrate legacy Oracle database to PostgreSQL with data validation and performance optimization', 'PM-DB-001', 'development', 'high',
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'david.kim@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'michael.rodriguez@techcorp.ca' LIMIT 1)],
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'alice.wong@techcorp.ca' LIMIT 1)],
 120.0, 21, '2024-06-01', '2024-08-15',
 '["database", "migration", "oracle", "postgresql"]'::jsonb,
 '{"database_size_gb": 2500, "migration_tool": "AWS DMS", "downtime_tolerance": "4 hours"}'::jsonb,
 '["critical-path", "infrastructure", "data"]',
 '{"complexity": "high", "risk_level": "medium", "dependencies": ["network_upgrade"], "rollback_plan": "detailed"}'),

-- Subtask: Schema Migration
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'), 
 (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-DB-001'),
 'Migrate Database Schema', 'Convert Oracle-specific schema elements to PostgreSQL equivalent structures', 'PM-DB-001-A', 'development', 'high',
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'david.kim@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'michael.rodriguez@techcorp.ca' LIMIT 1)],
 '{}'::uuid[],
 40.0, 8, '2024-06-01', '2024-06-20',
 '["schema", "conversion", "postgresql"]'::jsonb,
 '{"tables_count": 156, "views_count": 23, "procedures_count": 45}'::jsonb,
 '["subtask", "database", "schema"]',
 '{"oracle_features": ["packages", "sequences", "triggers"], "postgresql_equivalents": "documented"}'),

-- Sub-subtask: Convert Stored Procedures
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'),
 (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-DB-001-A'),
 'Convert Oracle Stored Procedures', 'Convert Oracle PL/SQL stored procedures to PostgreSQL functions', 'PM-DB-001-A-1', 'development', 'medium',
 (SELECT id FROM app.d_emp WHERE email = 'alice.wong@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'michael.rodriguez@techcorp.ca' LIMIT 1)],
 '{}'::uuid[],
 16.0, 3, '2024-06-05', '2024-06-15',
 '["procedures", "plsql", "conversion"]'::jsonb,
 '{"procedures_count": 45, "complexity": "medium", "test_data": "required"}'::jsonb,
 '["sub-subtask", "conversion", "plsql"]',
 '{"conversion_tool": "ora2pg", "testing_strategy": "unit_tests"}'),

-- Main Task: API Authentication Modernization
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'), NULL,
 'Implement OAuth 2.0 Authentication', 'Replace legacy authentication system with OAuth 2.0 and JWT tokens for enhanced security and scalability', 'PM-API-002', 'development', 'high',
 (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'security.lead@techcorp.ca' LIMIT 1)],
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'frontend.dev@techcorp.ca' LIMIT 1)],
 80.0, 13, '2024-07-01', '2024-08-15',
 '["authentication", "oauth", "security", "api"]'::jsonb,
 '{"security_standard": "OAuth 2.0", "token_type": "JWT", "session_timeout": 24}'::jsonb,
 '["security", "api", "backend"]',
 '{"security_review": "required", "penetration_test": "scheduled", "compliance_check": "ISO27001"}'),

-- Subtask: OAuth Server Setup
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'),
 (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-API-002'),
 'Configure OAuth 2.0 Authorization Server', 'Set up and configure the OAuth 2.0 authorization server with proper client registration', 'PM-API-002-A', 'development', 'high',
 (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'security.lead@techcorp.ca' LIMIT 1)],
 '{}'::uuid[],
 24.0, 5, '2024-07-01', '2024-07-10',
 '["oauth", "server", "configuration"]'::jsonb,
 '{"server_software": "Keycloak", "client_count": 8, "realm": "techcorp"}'::jsonb,
 '["subtask", "oauth", "server"]',
 '{"ssl_required": true, "backup_strategy": "documented", "monitoring": "enabled"}'),

-- Subtask: JWT Token Implementation
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'),
 (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-API-002'),
 'Implement JWT Token Handling', 'Develop JWT token generation, validation, and refresh mechanisms', 'PM-API-002-B', 'development', 'high',
 (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'security.lead@techcorp.ca' LIMIT 1)],
 '{}'::uuid[],
 32.0, 5, '2024-07-08', '2024-07-20',
 '["jwt", "tokens", "security"]'::jsonb,
 '{"token_expiry": 3600, "refresh_token": true, "signing_algorithm": "RS256"}'::jsonb,
 '["subtask", "jwt", "tokens"]',
 '{"key_rotation": "quarterly", "token_blacklist": "redis", "monitoring": "comprehensive"}'),

-- Sub-subtask: Token Validation Logic
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'),
 (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-API-002-B'),
 'Implement Token Validation Middleware', 'Create middleware for JWT token validation across all API endpoints', 'PM-API-002-B-1', 'development', 'medium',
 (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'security.lead@techcorp.ca' LIMIT 1)],
 '{}'::uuid[],
 12.0, 2, '2024-07-12', '2024-07-18',
 '["middleware", "validation", "api"]'::jsonb,
 '{"framework": "Express.js", "cache_validation": true, "error_handling": "comprehensive"}'::jsonb,
 '["sub-subtask", "middleware", "validation"]',
 '{"performance_target": "< 5ms", "error_logging": "detailed", "rate_limiting": "enabled"}'),

-- Main Task: Testing and Quality Assurance
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'), NULL,
 'Quality Assurance and Testing', 'Comprehensive testing suite for all migration and authentication components', 'PM-TEST-003', 'testing', 'high',
 (SELECT id FROM app.d_emp WHERE email = 'qa.engineer@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'david.kim@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'test.lead@techcorp.ca' LIMIT 1)],
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1), (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1)],
 60.0, 8, '2024-07-15', '2024-08-10',
 '["testing", "quality", "automation"]'::jsonb,
 '{"coverage_target": 95, "test_frameworks": ["Jest", "Cypress", "PostgreSQL-Test"], "automation_level": "high"}'::jsonb,
 '["testing", "quality", "automation"]',
 '{"ci_cd_integration": true, "performance_testing": "included", "security_testing": "comprehensive"}'),

-- Subtask: Unit Testing for OAuth
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'),
 (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-TEST-003'),
 'Write Unit Tests for OAuth Implementation', 'Comprehensive unit test suite for OAuth authentication flows including edge cases and error handling', 'PM-TEST-003-A', 'testing', 'medium',
 (SELECT id FROM app.d_emp WHERE email = 'qa.engineer@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'test.lead@techcorp.ca' LIMIT 1)],
 '{}'::uuid[],
 24.0, 3, '2024-07-15', '2024-07-25',
 '["unit-tests", "oauth", "quality"]'::jsonb,
 '{"coverage_target": 95, "test_framework": "Jest", "mock_strategy": "comprehensive"}'::jsonb,
 '["subtask", "testing", "oauth"]',
 '{"test_types": ["unit", "integration"], "automation": true, "mock_external_services": true}'),

-- Subtask: Database Migration Testing
((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'),
 (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-TEST-003'),
 'Database Migration Test Suite', 'Create comprehensive test suite for database migration validation and rollback procedures', 'PM-TEST-003-B', 'testing', 'high',
 (SELECT id FROM app.d_emp WHERE email = 'qa.engineer@techcorp.ca' LIMIT 1),
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'test.lead@techcorp.ca' LIMIT 1)],
 ARRAY[(SELECT id FROM app.d_emp WHERE email = 'michael.rodriguez@techcorp.ca' LIMIT 1)],
 32.0, 5, '2024-07-20', '2024-08-05',
 '["database", "migration", "testing"]'::jsonb,
 '{"data_validation": true, "performance_benchmarks": true, "rollback_testing": true}'::jsonb,
 '["subtask", "testing", "database"]',
 '{"test_data_size": "production_equivalent", "performance_targets": "documented", "rollback_time": "< 2 hours"}');

-- Insert Task Records (Current Status) for Sample Tasks
INSERT INTO app.ops_task_records (head_id, from_ts, to_ts, active, status_id, stage_id, workflow_state, completion_percentage, actual_start_date, actual_hours, acceptance_criteria, acceptance_status, quality_gate_status, work_log, time_spent, deliverables, title, due_date, log_schema, log_data, log_owner_id, start_ts, end_ts, tags, attr) VALUES

-- Main Database Migration Task Status
((SELECT id FROM app.ops_task_head WHERE task_code = 'PM-DB-001'), now() - interval '1 month', NULL, true,
 (SELECT id FROM app.meta_task_status WHERE name = 'In Progress' LIMIT 1),
 (SELECT id FROM app.meta_task_stage WHERE name = 'In Progress' LIMIT 1),
 'in_progress', 45.0, '2024-06-01', 54.0,
 '["Migration strategy documented", "Environment setup completed", "Initial schema analysis done", "Test database configured"]'::jsonb,
 'pending', 'in_progress',
 '[{"date": "2024-06-01", "hours": 8, "description": "Project kickoff and planning"}, {"date": "2024-06-05", "hours": 12, "description": "Oracle schema analysis"}, {"date": "2024-06-10", "hours": 16, "description": "PostgreSQL environment setup"}]'::jsonb,
 54.0,
 '["Migration Strategy Document", "Environment Setup Guide", "Schema Analysis Report"]'::jsonb,
 'Database Migration to PostgreSQL', '2024-08-15',
 '{"activity_type": "development", "phase": "analysis", "tools": ["ora2pg", "AWS DMS"]}'::jsonb,
 '{"current_activity": "schema_mapping", "progress_indicators": ["tables_analyzed", "procedures_inventoried"], "next_steps": ["data_migration_testing", "performance_benchmarking"]}'::jsonb,
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 '2024-06-01 09:00:00'::timestamptz, '2024-06-10 17:00:00'::timestamptz,
 '["active", "critical-path", "main-task"]',
 '{"current_phase": "analysis", "completion_estimate": "2024-08-10", "blockers": [], "subtasks_total": 3, "subtasks_completed": 0}'),

-- Schema Migration Subtask Status
((SELECT id FROM app.ops_task_head WHERE task_code = 'PM-DB-001-A'), now() - interval '3 weeks', NULL, true,
 (SELECT id FROM app.meta_task_status WHERE name = 'In Progress' LIMIT 1),
 (SELECT id FROM app.meta_task_stage WHERE name = 'In Progress' LIMIT 1),
 'in_progress', 60.0, '2024-06-01', 24.0,
 '["Schema conversion scripts created", "Table structures mapped", "Constraints documented", "Initial testing completed"]'::jsonb,
 'pending', 'in_progress',
 '[{"date": "2024-06-01", "hours": 8, "description": "Schema analysis and mapping"}, {"date": "2024-06-08", "hours": 10, "description": "Conversion script development"}, {"date": "2024-06-12", "hours": 6, "description": "Initial testing"}]'::jsonb,
 24.0,
 '["Schema Mapping Document", "Conversion Scripts", "Test Results"]'::jsonb,
 'Migrate Database Schema', '2024-06-20',
 '{"activity_type": "development", "phase": "conversion", "tools": ["ora2pg"]}'::jsonb,
 '{"conversion_progress": "60%", "tables_converted": 94, "tables_remaining": 62, "current_focus": "stored_procedures"}'::jsonb,
 (SELECT id FROM app.d_emp WHERE email = 'sarah.chen@techcorp.ca' LIMIT 1),
 '2024-06-01 08:00:00'::timestamptz, '2024-06-12 18:00:00'::timestamptz,
 '["active", "subtask", "schema"]',
 '{"parent_task": "PM-DB-001", "conversion_progress": "60%", "tables_converted": 94, "tables_remaining": 62}'),

-- OAuth Implementation Main Task Status
((SELECT id FROM app.ops_task_head WHERE task_code = 'PM-API-002'), now() - interval '2 weeks', NULL, true,
 (SELECT id FROM app.meta_task_status WHERE name = 'In Progress' LIMIT 1),
 (SELECT id FROM app.meta_task_stage WHERE name = 'In Progress' LIMIT 1),
 'in_progress', 70.0, '2024-07-01', 56.0,
 '["OAuth server configured", "JWT implementation started", "API endpoints design completed", "Security review scheduled"]'::jsonb,
 'pending', 'in_progress',
 '[{"date": "2024-07-01", "hours": 8, "description": "OAuth architecture design"}, {"date": "2024-07-03", "hours": 12, "description": "Server configuration"}, {"date": "2024-07-08", "hours": 16, "description": "JWT implementation"}, {"date": "2024-07-12", "hours": 20, "description": "API endpoint development"}]'::jsonb,
 56.0,
 '["OAuth Architecture Document", "Server Configuration", "JWT Implementation", "API Endpoints"]'::jsonb,
 'Implement OAuth 2.0 Authentication', '2024-08-15',
 '{"activity_type": "development", "phase": "implementation", "security_level": "high"}'::jsonb,
 '{"oauth_server": "keycloak", "jwt_algorithm": "RS256", "integration_status": "70%", "security_review": "scheduled"}'::jsonb,
 (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1),
 '2024-07-01 09:00:00'::timestamptz, '2024-07-12 17:30:00'::timestamptz,
 '["active", "main-task", "security"]',
 '{"current_phase": "development", "security_review": "scheduled", "subtasks_total": 2, "subtasks_completed": 1}'),

-- JWT Token Implementation Subtask Status
((SELECT id FROM app.ops_task_head WHERE task_code = 'PM-API-002-B'), now() - interval '1 week', NULL, true,
 (SELECT id FROM app.meta_task_status WHERE name = 'In Progress' LIMIT 1),
 (SELECT id FROM app.meta_task_stage WHERE name = 'In Progress' LIMIT 1),
 'in_progress', 80.0, '2024-07-08', 25.6,
 '["Token generation implemented", "Validation logic completed", "Refresh mechanism working", "Security tests passing"]'::jsonb,
 'pending', 'passed',
 '[{"date": "2024-07-08", "hours": 8, "description": "JWT library integration"}, {"date": "2024-07-10", "hours": 10, "description": "Token generation logic"}, {"date": "2024-07-15", "hours": 7.6, "description": "Validation and refresh mechanisms"}]'::jsonb,
 25.6,
 '["JWT Library Integration", "Token Generation Logic", "Validation Middleware", "Security Tests"]'::jsonb,
 'Implement JWT Token Handling', '2024-07-20',
 '{"activity_type": "development", "phase": "testing", "security_level": "high"}'::jsonb,
 '{"jwt_implementation": "complete", "validation_tests": "passing", "performance_metrics": "within_targets", "sub_subtasks_progress": "0/1"}'::jsonb,
 (SELECT id FROM app.d_emp WHERE email = 'james.taylor@techcorp.ca' LIMIT 1),
 '2024-07-08 10:00:00'::timestamptz, '2024-07-15 16:30:00'::timestamptz,
 '["nearly-complete", "subtask", "jwt"]',
 '{"parent_task": "PM-API-002", "token_tests": "passing", "performance": "within_targets", "sub_subtasks_total": 1, "sub_subtasks_completed": 0}'),

-- Quality Assurance Main Task Status
((SELECT id FROM app.ops_task_head WHERE task_code = 'PM-TEST-003'), now() - interval '5 days', NULL, true,
 (SELECT id FROM app.meta_task_status WHERE name = 'Open' LIMIT 1),
 (SELECT id FROM app.meta_task_stage WHERE name = 'To Do' LIMIT 1),
 'todo', 10.0, NULL, 6.0,
 '["Test strategy documented", "Test environments identified", "Test data preparation started", "Automation framework selected"]'::jsonb,
 'pending', 'not_started',
 '[{"date": "2024-07-15", "hours": 4, "description": "Test strategy planning"}, {"date": "2024-07-17", "hours": 2, "description": "Framework evaluation"}]'::jsonb,
 6.0,
 '["Test Strategy Document", "Framework Evaluation Report"]'::jsonb,
 'Quality Assurance and Testing', '2024-08-10',
 '{"activity_type": "testing", "phase": "planning", "automation_level": "high"}'::jsonb,
 '{"test_strategy": "documented", "frameworks_evaluated": ["Jest", "Cypress", "k6"], "dependencies": ["PM-DB-001", "PM-API-002"]}'::jsonb,
 (SELECT id FROM app.d_emp WHERE email = 'qa.engineer@techcorp.ca' LIMIT 1),
 '2024-07-15 09:00:00'::timestamptz, '2024-07-17 17:00:00'::timestamptz,
 '["planning", "main-task", "testing"]',
 '{"dependencies": ["PM-DB-001", "PM-API-002"], "test_environments": "staging_ready", "automation_level": "high", "subtasks_total": 2, "subtasks_completed": 0}}');

-- Performance Indexes for Project and Task Operations
CREATE INDEX idx_ops_project_head_tenant ON app.ops_project_head(tenant_id);
CREATE INDEX idx_ops_project_head_type ON app.ops_project_head(project_type);
CREATE INDEX idx_ops_project_head_priority ON app.ops_project_head(priority_level);
CREATE INDEX idx_ops_project_head_status ON app.ops_project_head(active);
CREATE INDEX idx_ops_project_head_timeline ON app.ops_project_head(planned_start_date, planned_end_date);
CREATE INDEX idx_ops_project_head_budget ON app.ops_project_head(budget_allocated) WHERE budget_allocated IS NOT NULL;
CREATE INDEX idx_ops_project_head_security ON app.ops_project_head(security_classification);
CREATE INDEX idx_ops_project_head_code ON app.ops_project_head(project_code) WHERE project_code IS NOT NULL;

CREATE INDEX idx_ops_project_records_head ON app.ops_project_records(head_id);
CREATE INDEX idx_ops_project_records_status ON app.ops_project_records(status_id);
CREATE INDEX idx_ops_project_records_stage ON app.ops_project_records(stage_id);
CREATE INDEX idx_ops_project_records_active ON app.ops_project_records(active) WHERE active = true;
CREATE INDEX idx_ops_project_records_completion ON app.ops_project_records(completion_percentage);
CREATE INDEX idx_ops_project_records_timeline ON app.ops_project_records(actual_start_date, actual_end_date);

CREATE INDEX idx_ops_task_head_project ON app.ops_task_head(proj_head_id);
CREATE INDEX idx_ops_task_head_parent ON app.ops_task_head(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX idx_ops_task_head_assignee ON app.ops_task_head(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_ops_task_head_type ON app.ops_task_head(task_type);
CREATE INDEX idx_ops_task_head_priority ON app.ops_task_head(priority);
CREATE INDEX idx_ops_task_head_worksite ON app.ops_task_head(worksite_id) WHERE worksite_id IS NOT NULL;
CREATE INDEX idx_ops_task_head_timeline ON app.ops_task_head(planned_start_date, planned_end_date);
CREATE INDEX idx_ops_task_head_code ON app.ops_task_head(proj_head_id, task_code) WHERE task_code IS NOT NULL;

CREATE INDEX idx_ops_task_records_head ON app.ops_task_records(head_id);
CREATE INDEX idx_ops_task_records_status ON app.ops_task_records(status_id);
CREATE INDEX idx_ops_task_records_stage ON app.ops_task_records(stage_id);
CREATE INDEX idx_ops_task_records_active ON app.ops_task_records(active) WHERE active = true;
CREATE INDEX idx_ops_task_records_completion ON app.ops_task_records(completion_percentage);
CREATE INDEX idx_ops_task_records_workflow ON app.ops_task_records(workflow_state);

-- Indexes for consolidated task logging fields
CREATE INDEX idx_ops_task_records_log_type ON app.ops_task_records(log_type_id) WHERE log_type_id IS NOT NULL;
CREATE INDEX idx_ops_task_records_log_state ON app.ops_task_records(log_state_id) WHERE log_state_id IS NOT NULL;
CREATE INDEX idx_ops_task_records_log_time ON app.ops_task_records(start_ts, end_ts) WHERE start_ts IS NOT NULL AND end_ts IS NOT NULL;
CREATE INDEX idx_ops_task_records_log_owner ON app.ops_task_records(log_owner_id) WHERE log_owner_id IS NOT NULL;
CREATE INDEX idx_ops_task_records_log_assignee ON app.ops_task_records(log_assignee_id) WHERE log_assignee_id IS NOT NULL;
CREATE INDEX idx_ops_task_records_log_worksite ON app.ops_task_records(log_worksite_id) WHERE log_worksite_id IS NOT NULL;

CREATE INDEX idx_d_emp_grp_task ON app.d_emp_grp(task_head_id);
CREATE INDEX idx_d_emp_grp_emp ON app.d_emp_grp(emp_id);
CREATE INDEX idx_d_emp_grp_role ON app.d_emp_grp(role_in_task);
CREATE INDEX idx_d_emp_grp_allocation ON app.d_emp_grp(allocation_percentage);

-- Composite indexes for common project and task queries
CREATE INDEX idx_project_business_location ON app.ops_project_head(business_scope_id, location_scope_id, active) WHERE active = true;
CREATE INDEX idx_project_type_priority ON app.ops_project_head(project_type, priority_level, active) WHERE active = true;
CREATE INDEX idx_task_project_assignee ON app.ops_task_head(proj_head_id, assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX idx_task_type_priority ON app.ops_task_head(task_type, priority, proj_head_id);
