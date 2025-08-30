-- ============================================================================
-- PROJECT AND TASK SCOPE HIERARCHY (Operational Execution and Management)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
-- 
-- 🎯 **PROJECT EXECUTION BACKBONE**
-- • End-to-end project lifecycle management
-- • Granular task orchestration and assignment
-- • Real-time progress tracking and reporting
-- • Multi-dimensional stakeholder coordination
--
-- 🏗️ **HIERARCHY STRUCTURE**
-- Level 1: Project → Level 2: Task → Level 3: Subtask → Level 4: Sub-subtask
--
-- 🔗 **INTEGRATION POINTS**
-- • Business units (ownership & budget)
-- • Geographic locations (execution sites)
-- • HR hierarchy (team assignments) 
-- • Worksite facilities (physical execution)
-- • Client stakeholders (external collaboration)
--
-- 📊 **OPERATIONAL PATTERNS**
-- • Dynamic resource allocation
-- • Cross-functional team matrices
-- • Milestone & quality gates
-- • Client collaboration workflows
-- • Automated progress triggers
--
-- 🛡️ **PERMISSION INTEGRATION**
-- • Project-level scope access
-- • Task-granular permissions
-- • Role-based execution rights
-- • Client external access
-- • Cross-scope inheritance
--
-- 💼 **REAL-WORLD SCENARIOS**
-- • Platform modernization (25-person teams across Toronto/Montreal)
-- • Government portals (security clearance + bilingual compliance)
-- • AI research projects (IP protection + university partnerships)
-- • Multi-site infrastructure (coordinated downtime windows)

-- ============================================================================
-- DDL:
-- ============================================================================

-- Project Head Table (Project Definition and Scope)
CREATE TABLE app.ops_project_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  
  -- Project identification and metadata
  project_code text UNIQUE,
  project_type text DEFAULT 'development',
  priority_level text DEFAULT 'medium',
  slug text UNIQUE,
  
  -- Business and operational context
  budget_allocated numeric(15,2),
  budget_currency text DEFAULT 'CAD',
  
  -- Scope relationships (integrated with d_scope_ tables)
  business_id uuid,
  locations uuid[],
  worksites uuid[],
  
  -- Project team and stakeholders
  project_managers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  project_sponsors uuid[] NOT NULL DEFAULT '{}'::uuid[],
  project_leads uuid[] NOT NULL DEFAULT '{}'::uuid[],
  clients jsonb DEFAULT '[]'::jsonb,
  approvers uuid[] DEFAULT '{}'::uuid[],
  
  -- Project timeline and planning
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  milestones jsonb DEFAULT '[]'::jsonb,
  deliverables jsonb DEFAULT '[]'::jsonb,
  estimated_hours numeric(10,2),
  actual_hours numeric(10,2),
  project_stage text,
  project_status text,
  
  -- Compliance and governance
  security_classification text DEFAULT 'internal',
  compliance_requirements jsonb DEFAULT '[]'::jsonb,
  risk_assessment jsonb DEFAULT '{}'::jsonb,
  
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Task Head Table (Task Definition and Assignment)
CREATE TABLE app.ops_task_head (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proj_head_id uuid NOT NULL REFERENCES app.ops_project_head(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES app.ops_task_head(id) ON DELETE SET NULL,
  
  -- Task identification and metadata
  title text NOT NULL,
  task_code text,
  task_type text DEFAULT 'development',
  priority text DEFAULT 'medium',
  
  -- Task assignment and ownership
  assignee_id uuid REFERENCES app.d_employee(id) ON DELETE SET NULL,
  reporter_id uuid REFERENCES app.d_employee(id) ON DELETE SET NULL,
  
  -- Collaboration and workflow
  reviewers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  approvers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  collaborators uuid[] NOT NULL DEFAULT '{}'::uuid[],
  watchers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  
  -- Client and external stakeholder management
  client_group_id uuid,
  clients uuid[] NOT NULL DEFAULT '{}'::uuid[],
  
  -- Location and worksite context
  worksite_id uuid,
  location_context text,
  
  -- Task planning and estimation
  estimated_hours numeric(8,2),
  story_points int,
  planned_start_date date,
  planned_end_date date,
  
  -- Dependencies and relationships
  depends_on_tasks uuid[] DEFAULT '{}'::uuid[],
  blocks_tasks uuid[] DEFAULT '{}'::uuid[],
  related_tasks uuid[] DEFAULT '{}'::uuid[],
  
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Task Records Table (Task Status, Progress Tracking, and Activity Logging)
CREATE TABLE app.ops_task_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  head_id uuid NOT NULL REFERENCES app.ops_task_head(id) ON DELETE CASCADE,
  
  -- Task status and workflow state
  status_name text,
  stage_name text,
  
  -- Progress tracking
  completion_percentage numeric(5,2) DEFAULT 0.0,
  actual_start_date date,
  actual_end_date date,
  actual_hours numeric(8,2),
  
  -- Work log and time tracking
  work_log jsonb DEFAULT '[]'::jsonb,
  time_spent numeric(8,2) DEFAULT 0.0,
  
  -- Time tracking for specific log entries
  start_ts timestamptz,
  end_ts timestamptz,
  
  -- Log ownership and workflow
  log_owner_id uuid REFERENCES app.d_employee(id) ON DELETE SET NULL,
  
  -- Log content 
  log_type text DEFAULT 'form_data:draft',
  log_content jsonb DEFAULT '{}'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  form_log_id uuid,
  
  -- Quality and acceptance criteria
  acceptance_criteria jsonb DEFAULT '[]'::jsonb,
  acceptance_status text DEFAULT 'pending',
  quality_gate_status text DEFAULT 'not_started',
  
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  descr text,
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

-- Insert Projects
INSERT INTO app.ops_project_head 
  (name, descr, slug, project_code, project_type, priority_level, budget_allocated, budget_currency, planned_start_date, planned_end_date, estimated_hours, security_classification, compliance_requirements, risk_assessment, tenant_id, tags, attr)
VALUES
  ('Platform Modernization 2024', 'Comprehensive infrastructure modernization project to migrate legacy systems to cloud-native architecture with enhanced security and scalability', 'platform-modernization-2024', 'PM-2024-001', 'infrastructure', 'critical', 2500000.00, 'CAD',
    '2024-01-15', '2024-12-15', 8000.0, 'confidential',
    '["ISO 27001", "SOC 2 Type II", "PIPEDA", "Cloud Security Standards"]'::jsonb,
    '{"budget_risk": "medium", "timeline_risk": "high", "technical_complexity": "high", "stakeholder_impact": "critical"}'::jsonb,
    gen_random_uuid(),
    '["infrastructure", "cloud", "modernization", "strategic"]',
    '{"methodology": "Agile", "delivery_model": "Phased", "team_size": 25, "external_vendors": ["AWS", "CloudFlare"], "compliance_audit": "Q3-2024"}'),
    
  ('Mobile App V2', 'Next generation mobile application with enhanced user experience, offline capabilities, and real-time synchronization', 'mobile-app-v2', 'MA-2024-002', 'development', 'high', 850000.00, 'CAD',
    '2024-03-01', '2024-10-30', 3200.0, 'internal',
    '["App Store Guidelines", "Google Play Policies", "AODA Accessibility"]'::jsonb,
    '{"budget_risk": "low", "timeline_risk": "medium", "market_competition": "high", "user_adoption": "medium"}'::jsonb,
    gen_random_uuid(),
    '["mobile", "development", "user-experience", "real-time"]',
    '{"platforms": ["iOS", "Android"], "framework": "React Native", "offline_support": true, "team_distribution": {"Toronto": 12, "Montreal": 3}}'),
    
  ('Ontario Client Portal', 'Secure government service portal with bilingual support, accessibility compliance, and integrated identity management', 'ontario-client-portal', 'OCP-2024-003', 'service', 'critical', 1200000.00, 'CAD',
    '2024-02-01', '2024-11-30', 4500.0, 'restricted',
    '["Government of Canada Security Standards", "AODA", "Official Languages Act", "PIPEDA"]'::jsonb,
    '{"security_risk": "high", "compliance_risk": "critical", "political_visibility": "high", "technical_complexity": "medium"}'::jsonb,
    gen_random_uuid(),
    '["government", "portal", "bilingual", "accessibility", "security"]',
    '{"languages": ["English", "French"], "clearance_required": "Secret", "accessibility_level": "WCAG 2.1 AA", "identity_provider": "Government SSO"}'),
    
  ('AI-Powered Analytics Platform', 'Research and development project to create next-generation analytics platform using machine learning and artificial intelligence', 'ai-analytics-platform', 'AI-2024-004', 'research', 'medium', 600000.00, 'CAD',
    '2024-04-01', '2025-03-31', 2800.0, 'confidential',
    '["University Research Agreements", "IP Protection Protocols", "Ethics in AI"]'::jsonb,
    '{"technology_risk": "high", "market_viability": "medium", "ip_protection": "high", "research_timeline": "uncertain"}'::jsonb,
    gen_random_uuid(),
    '["research", "ai", "analytics", "innovation", "machine-learning"]',
    '{"research_partners": ["McGill University", "Concordia"], "patent_applications": 3, "prototype_phase": "Phase 2", "funding_sources": ["Internal R&D", "Government Grant"]}'),
    
  ('Multi-Site Network Upgrade', 'Comprehensive network infrastructure upgrade across all Canadian facilities with enhanced security and redundancy', 'network-upgrade-2024', 'NET-2024-005', 'infrastructure', 'high', 450000.00, 'CAD',
    '2024-05-15', '2024-09-30', 1600.0, 'restricted',
    '["ISO 27001", "Network Security Standards", "Business Continuity"]'::jsonb,
    '{"downtime_risk": "high", "budget_overrun": "medium", "vendor_dependency": "high", "rollback_complexity": "high"}'::jsonb,
    gen_random_uuid(),
    '["infrastructure", "network", "security", "multi-site", "upgrade"]',
    '{"sites_affected": 7, "downtime_windows": "weekends_only", "redundancy_level": "N+1", "vendor": "Cisco", "rollback_plan": "detailed"}');

-- Insert Task Hierarchy for Platform Modernization Project
INSERT INTO app.ops_task_head 
  (proj_head_id, parent_task_id, name, descr, task_code, task_type, priority, estimated_hours, story_points, planned_start_date, planned_end_date, tags, attr)
VALUES
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'), NULL,
    'Database Migration to PostgreSQL', 'Migrate legacy Oracle database to PostgreSQL with data validation and performance optimization', 'PM-DB-001', 'development', 'high',
    120.0, 21, '2024-06-01', '2024-08-15',
    '["database", "migration", "oracle", "postgresql"]',
    '{"database_size_gb": 2500, "migration_tool": "AWS DMS", "downtime_tolerance": "4 hours"}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'),
    (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-DB-001'),
    'Migrate Database Schema', 'Convert Oracle-specific schema elements to PostgreSQL equivalent structures', 'PM-DB-001-A', 'development', 'high',
    40.0, 8, '2024-06-01', '2024-06-20',
    '["schema", "conversion", "postgresql"]',
    '{"tables_count": 156, "views_count": 23, "procedures_count": 45}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'),
    (SELECT id FROM app.ops_task_head WHERE task_code = 'PM-DB-001-A'),
    'Convert Oracle Stored Procedures', 'Convert Oracle PL/SQL stored procedures to PostgreSQL functions', 'PM-DB-001-A-1', 'development', 'medium',
    16.0, 3, '2024-06-05', '2024-06-15',
    '["procedures", "plsql", "conversion"]',
    '{"procedures_count": 45, "complexity": "medium", "test_data": "required"}'),
    
  ((SELECT id FROM app.ops_project_head WHERE project_code = 'PM-2024-001'), NULL,
    'Implement OAuth 2.0 Authentication', 'Replace legacy authentication system with OAuth 2.0 and JWT tokens for enhanced security and scalability', 'PM-API-002', 'development', 'high',
    80.0, 13, '2024-07-01', '2024-08-15',
    '["authentication", "oauth", "security", "api"]',
    '{"security_standard": "OAuth 2.0", "token_type": "JWT", "session_timeout": 24}');