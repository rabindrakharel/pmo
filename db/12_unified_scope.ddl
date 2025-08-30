-- ============================================================================
-- UNIFIED SCOPE SYSTEM (Central Permission Registry)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- 🎯 **UNIVERSAL PERMISSION HUB**
-- • Central registry for all permission-based entities
-- • Single interface for referencing any scope type
-- • Polymorphic relationships across dimensions
-- • Consistent RBAC across organization
--
-- 🔄 **SCOPE REFERENCE PATTERN**
-- d_scope.scope_reference_table_name → table ('d_scope_business', 'd_scope_app')
-- d_scope.scope_id → UUID in referenced table
--
-- 📊 **SCOPE TYPES**
-- • 'business': Organizational hierarchy (Corp → Division → Team)
-- • 'location': Geographic structure (Country → Province → City)
-- • 'hr': Human resources hierarchy (C-Level → Manager → Engineer)
-- • 'app': Application components (Pages → APIs → Components)
-- • 'worksite': Physical facilities (HQ → Office → Room)
-- • 'project': Project execution (Program → Project → Phase)
-- • 'task': Work breakdown (Epic → Story → Task → Subtask)
-- • 'form': Document workflows (Type → Instance → Field)
--
-- 🔗 **PERMISSION INHERITANCE**
-- 1. Direct scope permissions (highest priority)
-- 2. Parent scope inheritance (cascading)
-- 3. Cross-scope bridging (HR → Business → Location)
-- 4. Default permissions (fallback)
--
-- 🛡️ **ENTERPRISE FEATURES**
-- • Multi-tenant data isolation
-- • Hierarchical permission cascades
-- • Cross-functional team support
-- • Audit trail consolidation
-- • Dynamic scope assignment

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.d_scope_unified (
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
  -- Unified scope-specific fields
  scope_type text NOT NULL,
  scope_reference_table_name text NOT NULL,
  scope_id uuid NOT NULL,
  scope_path text,
  scope_level_id int,
  parent_scope_id uuid REFERENCES app.d_scope_unified(id) ON DELETE SET NULL,
  tenant_id uuid,
  is_system_scope boolean NOT NULL DEFAULT false,
  is_inherited boolean NOT NULL DEFAULT false,
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[]
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Sample tenant for multi-tenant demonstration
INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, name, descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) VALUES

-- Business Hierarchy Scopes
('business', 'd_scope_business', gen_random_uuid(), 'TechCorp Inc. Scope', 'Corporate-level business scope with full organizational access', 'TechCorp', 1, gen_random_uuid(), true, ARRAY[0,1,2,3,4]::smallint[], '["corporation", "root"]', '{"permissions_inherit_to_all": true, "executive_access": true}'),

('business', 'd_scope_business', gen_random_uuid(), 'Engineering Division Scope', 'Engineering division with all development teams and projects', 'TechCorp/Engineering', 2, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["division", "technical"]', '{"includes_all_tech_projects": true, "r_and_d_access": true}'),

('business', 'd_scope_business', gen_random_uuid(), 'Sales Division Scope', 'Sales and marketing operations division', 'TechCorp/Sales', 2, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["division", "commercial"]', '{"customer_data_access": true, "revenue_reporting": true}'),

('business', 'd_scope_business', gen_random_uuid(), 'Platform Engineering Scope', 'Infrastructure and platform development department', 'TechCorp/Engineering/Platform', 3, gen_random_uuid(), false, ARRAY[0,1,2]::smallint[], '["department", "infrastructure"]', '{"system_admin_required": true, "production_access": true}'),

('business', 'd_scope_business', gen_random_uuid(), 'Frontend Team Scope', 'User interface and experience development team', 'TechCorp/Engineering/Product/Frontend', 4, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["team", "frontend"]', '{"ui_design_access": true, "user_testing_data": true}'),

('business', 'd_scope_business', gen_random_uuid(), 'Backend Team Scope', 'Server-side and API development team', 'TechCorp/Engineering/Platform/Backend', 4, gen_random_uuid(), false, ARRAY[0,1,2]::smallint[], '["team", "backend"]', '{"database_access": true, "api_keys": true}'),

-- Location Hierarchy Scopes  
('location', 'd_scope_location', gen_random_uuid(), 'North America Scope', 'Corporate regional scope covering North American operations', 'North America', 1, gen_random_uuid(), true, ARRAY[0,1,2,3,4]::smallint[], '["region", "corporate"]', '{"timezone_coordination": true, "multi_country": true}'),

('location', 'd_scope_location', gen_random_uuid(), 'Canada Scope', 'National scope for all Canadian operations and compliance', 'North America/Canada', 2, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["country", "national"]', '{"regulatory_compliance": "canadian", "currency": "CAD"}'),

('location', 'd_scope_location', gen_random_uuid(), 'Ontario Scope', 'Provincial scope for Ontario operations', 'North America/Canada/Ontario', 3, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["province", "ontario"]', '{"provincial_tax": true, "labour_laws": "ontario"}'),

('location', 'd_scope_location', gen_random_uuid(), 'Toronto Scope', 'Toronto development center and operations', 'North America/Canada/Ontario/Toronto', 5, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["city", "tech-hub"]', '{"development_center": true, "talent_pool": "high"}'),

('location', 'd_scope_location', gen_random_uuid(), 'Mississauga Scope', 'Mississauga sales office operations', 'North America/Canada/Ontario/Mississauga', 5, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["city", "sales"]', '{"sales_office": true, "customer_meetings": true}'),

-- HR Hierarchy Scopes
('hr', 'd_scope_hr', gen_random_uuid(), 'CEO Office Scope', 'Executive leadership and corporate governance', 'Executive/CEO', 1, gen_random_uuid(), true, ARRAY[0]::smallint[], '["executive", "c-suite"]', '{"board_access": true, "strategic_planning": true, "confidential_data": true}'),

('hr', 'd_scope_hr', gen_random_uuid(), 'VP Engineering Scope', 'Engineering leadership and technical strategy', 'Executive/VP-Engineering', 2, gen_random_uuid(), false, ARRAY[0,1,2]::smallint[], '["vp", "technical"]', '{"tech_strategy": true, "engineering_budget": true, "hiring_authority": true}'),

('hr', 'd_scope_hr', gen_random_uuid(), 'VP Sales Scope', 'Sales leadership and commercial strategy', 'Executive/VP-Sales', 2, gen_random_uuid(), false, ARRAY[0,1,2]::smallint[], '["vp", "commercial"]', '{"sales_strategy": true, "revenue_targets": true, "customer_relationships": true}'),

('hr', 'd_scope_hr', gen_random_uuid(), 'Engineering Directors Scope', 'Engineering department leadership', 'Engineering/Directors', 3, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["director", "management"]', '{"team_management": true, "technical_oversight": true, "resource_allocation": true}'),

('hr', 'd_scope_hr', gen_random_uuid(), 'Engineering Managers Scope', 'Engineering team and project management', 'Engineering/Managers', 4, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["manager", "team-lead"]', '{"project_management": true, "performance_reviews": true, "sprint_planning": true}'),

('hr', 'd_scope_hr', gen_random_uuid(), 'Senior Engineers Scope', 'Senior technical contributors and mentors', 'Engineering/Senior', 6, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["senior", "technical"]', '{"code_review": true, "mentorship": true, "technical_decisions": true}'),

-- Project Scopes
('project', 'ops_project_head', gen_random_uuid(), 'Platform Modernization 2024 Scope', 'Critical infrastructure modernization project with full technical and administrative access', 'Projects/Infrastructure/Platform-Modernization-2024', 1, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["project", "infrastructure", "critical"]', '{"budget_access": true, "technical_admin": true, "security_clearance": "confidential", "external_vendors": true}'),

('project', 'ops_project_head', gen_random_uuid(), 'Mobile App V2 Scope', 'Mobile application development project with development and testing access', 'Projects/Development/Mobile-App-V2', 1, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["project", "development", "mobile"]', '{"app_store_access": true, "testing_devices": true, "user_analytics": true, "feature_flags": true}'),

('project', 'ops_project_head', gen_random_uuid(), 'Ontario Client Portal Scope', 'Government service portal project with restricted security requirements', 'Projects/Government/Ontario-Portal', 1, gen_random_uuid(), false, ARRAY[0,1,2]::smallint[], '["project", "government", "restricted"]', '{"security_clearance": "secret", "government_compliance": true, "bilingual_required": true, "accessibility_audit": true}'),

('project', 'ops_project_head', gen_random_uuid(), 'AI Analytics Platform Scope', 'Research and development project with limited access for intellectual property protection', 'Projects/Research/AI-Analytics', 1, gen_random_uuid(), false, ARRAY[0,1,2]::smallint[], '["project", "research", "confidential"]', '{"ip_protection": true, "research_data": true, "university_partnerships": true, "patent_filing": true}'),

('project', 'ops_project_head', gen_random_uuid(), 'Network Upgrade Scope', 'Multi-site network infrastructure upgrade project with administrative access', 'Projects/Infrastructure/Network-Upgrade', 1, gen_random_uuid(), false, ARRAY[0,1,2,3]::smallint[], '["project", "infrastructure", "network"]', '{"network_admin": true, "multi_site": true, "downtime_windows": true, "vendor_coordination": true}'),

-- Task Scopes
('task', 'ops_task_head', gen_random_uuid(), 'Database Migration Task Scope', 'Critical database migration task with full database access', 'Projects/Platform-Modernization/Database-Migration', 2, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["task", "database", "critical"]', '{"database_admin": true, "production_access": true, "backup_authority": true, "downtime_management": true}'),

('task', 'ops_task_head', gen_random_uuid(), 'OAuth Implementation Task Scope', 'Authentication system implementation with security review access', 'Projects/Platform-Modernization/OAuth-Implementation', 2, gen_random_uuid(), false, ARRAY[0,1,2,3,4]::smallint[], '["task", "security", "authentication"]', '{"security_review": true, "authentication_config": true, "token_management": true, "ssl_certificates": true}'),

('task', 'ops_task_head', gen_random_uuid(), 'Unit Testing Task Scope', 'Quality assurance and testing task with testing framework access', 'Projects/Platform-Modernization/Unit-Testing', 2, gen_random_uuid(), false, ARRAY[0,1,2]::smallint[], '["task", "testing", "quality"]', '{"test_environments": true, "coverage_reports": true, "automated_testing": true, "mock_data": true}'),

-- Application Scopes
('app', 'd_scope_app', gen_random_uuid(), 'Dashboard Page Scope', 'Main dashboard application scope', 'App/Pages/Dashboard', gen_random_uuid(), true, ARRAY[0,2]::smallint[], '["app", "dashboard"]', '{"main_entry": true, "overview_data": true, "personalized": true}'),

('app', 'd_scope_app', gen_random_uuid(), 'Projects Page Scope', 'Project management application scope', 'App/Pages/Projects', gen_random_uuid(), false, ARRAY[0,2]::smallint[], '["app", "projects"]', '{"project_management": true, "kanban_view": true, "reporting": true}'),

('app', 'd_scope_app', gen_random_uuid(), 'Admin Page Scope', 'Administrative application scope', 'App/Pages/Admin', gen_random_uuid(), false, ARRAY[0]::smallint[], '["app", "admin"]', '{"system_admin": true, "configuration": true, "user_management": true}'),

('app', 'd_scope_app', gen_random_uuid(), 'DataTable Component Scope', 'DataTable UI component access scope', 'App/Components/DataTable', gen_random_uuid(), false, ARRAY[0,2]::smallint[], '["app", "component"]', '{"data_display": true, "filtering": true, "pagination": true}');