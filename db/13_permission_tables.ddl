-- ============================================================================
-- PERMISSION RELATIONSHIP TABLES (Role-Based Access Control System)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- 🛡️ **RBAC ENGINE CORE**
-- • Role-based access control implementation
-- • Direct user permissions & role inheritance
-- • Scope-based security enforcement
-- • Granular permission levels (view, modify, share, delete, create)
--
-- 🔄 **PERMISSION MODEL**
-- 1. Role-Scope Permissions: Role → Scope → Resource → Permission Array
-- 2. User-Scope Permissions: User → Scope → Resource → Permission Array
-- 3. Employee-Scope Permissions: Employee → Scope → Permission (direct)
--
-- 📊 **PERMISSION LEVELS**
-- • 0 = VIEW: Read-only access to resource data
-- • 1 = MODIFY: Edit, update, change resource properties
-- • 2 = SHARE: Share resources with other users/external parties
-- • 3 = DELETE: Remove or deactivate resources
-- • 4 = CREATE: Create new instances of resource type
--
-- 🎯 **RESOURCE COVERAGE**
-- • 'business': Organizational hierarchy & structure
-- • 'location': Geographic locations & facilities
-- • 'hr': Human resources hierarchy & employee management
-- • 'worksite': Physical worksites & operational facilities
-- • 'app': Application pages, APIs, UI components
-- • 'project': Project lifecycle & deliverable management
-- • 'task': Task execution & work breakdown
-- • 'form': Dynamic forms & document workflows
--
-- 🔗 **PERMISSION RESOLUTION**
-- 1. Direct user permissions (highest priority)
-- 2. Role-based permissions (inherited)
-- 3. Scope hierarchy inheritance (parent → child)
-- 4. Default permissions (fallback)
--
-- 💼 **ENTERPRISE SCENARIOS**
-- • Project Managers: full project access, limited HR visibility
-- • HR Representatives: employee data across locations, no project modification
-- • Developers: technical execution access, task ownership
-- • Executives: cross-scope oversight, strategic visibility

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

-- Employee-Scope Permission relationship table (direct user permissions)
CREATE TABLE app.rel_employee_scope_unified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Permission binding
  emp_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  scope_id uuid NOT NULL REFERENCES app.d_scope_unified(id) ON DELETE CASCADE,
  
  -- Resource specification
  resource_type text NOT NULL,
  resource_id uuid,
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[],
  
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(emp_id, scope_id, resource_type, resource_id, active)
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- John Smith (Project Manager) - specific project assignments and overrides
INSERT INTO app.rel_employee_scope_unified (emp_id, scope_id, resource_type, resource_id, resource_permission, name, descr, tags, attr) VALUES

-- Project Management Assignments
(gen_random_uuid(), gen_random_uuid(), 'project', NULL, ARRAY[0,1,2,3,4]::smallint[], 'Platform Modernization Project Lead', 'Full project management authority for critical infrastructure modernization', '["project-manager", "infrastructure", "critical"]', '{"project_manager": true, "budget_responsibility": 2500000, "team_size": 25}'),

(gen_random_uuid(), gen_random_uuid(), 'location', NULL, ARRAY[0,1,2,3]::smallint[], 'Toronto Office Operations Manager', 'Toronto office coordination and resource management authority', '["location-manager", "office-operations"]', '{"office_coordination": true, "resource_booking": true, "space_management": true}'),

(gen_random_uuid(), gen_random_uuid(), 'app', NULL, ARRAY[0,2]::smallint[], 'Executive Dashboard Access', 'Access to project management executive dashboard and KPI views', '["executive-dashboard", "read-only"]', '{"executive_view": true, "kpi_access": true}'),

-- Jane Doe (Principal Frontend Developer) - technical leadership assignments
(gen_random_uuid(), gen_random_uuid(), 'business', NULL, ARRAY[0,1,2,3,4]::smallint[], 'Frontend Team Technical Lead', 'Technical leadership and architecture authority for frontend development team', '["technical-lead", "frontend", "architecture"]', '{"team_leadership": true, "architecture_authority": true, "mentorship_role": true}'),

(gen_random_uuid(), gen_random_uuid(), 'project', NULL, ARRAY[0,1,2,3]::smallint[], 'Mobile App Frontend Lead', 'Frontend development leadership for mobile application project', '["mobile-development", "frontend-lead"]', '{"ui_architecture": true, "user_experience": true, "technical_review": true}'),

(gen_random_uuid(), gen_random_uuid(), 'app', NULL, ARRAY[0,1,2]::smallint[], 'Component Architecture Owner', 'UI component architecture and reusable component development authority', '["component-architecture", "ui-systems"]', '{"component_architecture": true, "reusable_components": true}'),

-- Bob Wilson (DevOps Engineer) - infrastructure and system administration
(gen_random_uuid(), gen_random_uuid(), 'business', NULL, ARRAY[0,1,2,3,4]::smallint[], 'Platform Infrastructure Lead', 'Infrastructure leadership and deployment authority for platform engineering', '["devops", "infrastructure", "deployment"]', '{"infrastructure_lead": true, "deployment_authority": true, "monitoring_setup": true}'),

(gen_random_uuid(), gen_random_uuid(), 'project', NULL, ARRAY[0,1,2,3,4]::smallint[], 'Network Infrastructure Project Lead', 'Network upgrade project leadership with vendor coordination authority', '["infrastructure-project", "network-upgrade"]', '{"network_architecture": true, "vendor_coordination": true, "downtime_management": true}'),

(gen_random_uuid(), gen_random_uuid(), 'location', NULL, ARRAY[0,1,2,3]::smallint[], 'National Infrastructure Coordinator', 'Multi-site infrastructure coordination across Canadian operations', '["national-infrastructure", "multi-site"]', '{"multi_site_access": true, "infrastructure_coordination": true}'),

-- Alice Johnson (UX Designer) - design and user experience focus
(gen_random_uuid(), gen_random_uuid(), 'project', NULL, ARRAY[0,1,2]::smallint[], 'Mobile App UX Lead', 'User experience leadership and design authority for mobile application', '["ux-design", "mobile-experience"]', '{"user_experience": true, "design_authority": true, "user_research": true}'),

(gen_random_uuid(), gen_random_uuid(), 'project', NULL, ARRAY[0,1,2]::smallint[], 'Government Portal Accessibility Lead', 'Accessibility compliance leadership for Ontario government portal project', '["accessibility", "government-compliance"]', '{"accessibility_compliance": true, "government_standards": true, "bilingual_design": true}'),

-- Mike Chen (Backend Engineer) - backend development assignments
(gen_random_uuid(), gen_random_uuid(), 'business', NULL, ARRAY[0,1,2,3]::smallint[], 'Backend Development Specialist', 'Backend development and API architecture for platform team', '["backend-developer", "api-specialist"]', '{"api_development": true, "database_access": true, "microservices": true}'),

(gen_random_uuid(), gen_random_uuid(), 'task', NULL, ARRAY[0,1,2,3,4]::smallint[], 'OAuth Security Implementation Lead', 'Authentication system implementation with security review authority', '["security-implementation", "authentication"]', '{"authentication_lead": true, "security_review": true, "jwt_implementation": true}'),

-- Sarah Lee (QA Engineer) - quality assurance and testing assignments
(gen_random_uuid(), gen_random_uuid(), 'task', NULL, ARRAY[0,1,2,3,4]::smallint[], 'Quality Assurance Testing Lead', 'Test automation and quality gate authority for platform modernization', '["qa-engineer", "testing-lead", "automation"]', '{"test_automation": true, "quality_gates": true, "coverage_requirements": true}'),

(gen_random_uuid(), gen_random_uuid(), 'project', NULL, ARRAY[0,1,2]::smallint[], 'Platform QA Oversight', 'Quality assurance oversight and testing strategy for critical infrastructure project', '["qa-oversight", "testing-strategy"]', '{"quality_assurance": true, "testing_strategy": true, "release_approval": true}'),

-- Leadership HR and Task Oversight Assignments
(gen_random_uuid(), gen_random_uuid(), 'hr', NULL, ARRAY[0,1,2]::smallint[], 'Engineering Leadership Visibility', 'HR visibility for engineering leadership and people planning', '["leadership-hr", "people-planning"]', '{"leadership_visibility": true, "people_planning": true}'),

(gen_random_uuid(), gen_random_uuid(), 'task', NULL, ARRAY[0,1,2,3]::smallint[], 'Critical Path Program Oversight', 'Program management oversight for critical database migration tasks', '["program-oversight", "critical-path"]', '{"critical_path": true, "risk_management": true}');