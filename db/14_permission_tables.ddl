-- ============================================================================
-- PERMISSION RELATIONSHIP TABLES (Role-Based Access Control System)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The permission relationship tables form the core of the PMO system's Role-Based
-- Access Control (RBAC) implementation. These tables create the binding layer that
-- connects users (employees) and roles to specific scopes and resources with
-- granular permission levels, enabling sophisticated access control patterns.
--
-- ARCHITECTURAL PURPOSE:
-- The permission system serves as the security enforcement backbone that enables:
--
-- • ROLE-BASED ACCESS CONTROL: Assign permissions to roles, then roles to users
-- • DIRECT USER PERMISSIONS: Grant specific permissions directly to individual users
-- • SCOPE-BASED SECURITY: Control access at business, location, project, and application levels
-- • GRANULAR PERMISSIONS: Fine-grained control (view, modify, share, delete, create)
-- • HIERARCHICAL INHERITANCE: Permissions flow down organizational and scope hierarchies
-- • AUDIT AND COMPLIANCE: Complete traceability of who has access to what resources
--
-- PERMISSION MODEL DESIGN:
-- The system implements a hybrid RBAC model with three relationship patterns:
--
-- 1. ROLE-SCOPE PERMISSIONS (rel_role_scope):
--    Role → Scope → Resource → Permission Array
--    Example: "Project Manager" role → "Engineering Projects" scope → [0,1,2,3,4] (full access)
--
-- 2. USER-SCOPE PERMISSIONS (rel_user_scope_unified):
--    User → Scope → Resource → Permission Array  
--    Example: John Smith → "Platform Modernization Project" → [0,1,2] (view, modify, share)
--
-- 3. EMPLOYEE-SCOPE PERMISSIONS (rel_employee_scope):
--    Employee → Scope → Permission Array (simplified direct assignment)
--    Example: Sarah Chen → "QA Testing Scope" → [0,1] (view, modify)
--
-- PERMISSION SEMANTICS:
-- Each permission is represented as a smallint array with standardized meanings:
-- • 0 = VIEW: Read-only access to resource data and metadata
-- • 1 = MODIFY: Ability to edit, update, and change resource properties
-- • 2 = SHARE: Permission to share resources with other users or external parties
-- • 3 = DELETE: Authority to remove or deactivate resources
-- • 4 = CREATE: Capability to create new instances of the resource type
--
-- RESOURCE TYPE COVERAGE:
-- The system supports comprehensive resource type management:
-- • 'business': Business unit hierarchy and organizational structure
-- • 'location': Geographic locations and facility management
-- • 'hr': Human resources hierarchy and employee management
-- • 'worksite': Physical worksites and operational facilities
-- • 'app': Application pages, APIs, and UI components
-- • 'project': Project lifecycle and deliverable management
-- • 'task': Task execution and work breakdown structures
-- • 'form': Dynamic forms and document workflows
--
-- MULTI-LEVEL PERMISSION RESOLUTION:
-- The system resolves permissions through multiple layers:
--
-- 1. DIRECT USER PERMISSIONS: Explicit grants to individual users (highest priority)
-- 2. ROLE-BASED PERMISSIONS: Permissions inherited through role assignments
-- 3. SCOPE HIERARCHY INHERITANCE: Parent scope permissions flow to child scopes
-- 4. DEFAULT PERMISSIONS: System-wide default access levels (lowest priority)
--
-- REAL-WORLD PMO SCENARIOS:
--
-- 1. PROJECT MANAGER ACCESS PATTERN:
--    Sarah Chen (Project Manager) needs comprehensive project oversight:
--    
--    Role Assignment: "Project Manager" role with permissions:
--    - Business scope: Engineering Division [0,1,2] (view, modify, share)
--    - Project scope: All Engineering Projects [0,1,2,3,4] (full access)
--    - Task scope: All tasks in assigned projects [0,1,2,3,4] (full access)
--    - App scope: Project management pages [0,2] (view, share)
--    
--    Direct User Override: Platform Modernization Project [0,1,2,3] (no create)
--    - Reason: Critical project requires extra oversight, no new sub-projects
--
-- 2. HR REPRESENTATIVE ACCESS PATTERN:
--    Michael Rodriguez (HR) needs employee data access across locations:
--    
--    Role Assignment: "HR Manager" role with permissions:
--    - HR scope: VP Engineering level [0,1,2,3,4] (full HR management)
--    - Business scope: All Engineering teams [0,2] (view for reporting, share)
--    - Location scope: All Canadian offices [0,2] (view workforce, share reports)
--    - App scope: Employee management UI [0,1,2] (HR interface access)
--    
--    Employee-Scope Direct: Toronto Office [0,1,2,3] (delete for terminated employees)
--
-- 3. DEVELOPER ACCESS PATTERN:
--    James Taylor (Senior Developer) needs technical execution access:
--    
--    Role Assignment: "Senior Developer" role with permissions:
--    - Task scope: Backend development tasks [0,1,2,3,4] (full task management)
--    - Project scope: Technical projects [0,1,2] (view, modify, share only)
--    - App scope: Development tools and APIs [0,1] (view and modify)
--    
--    Direct User Grant: OAuth Implementation Task [0,1,2,3,4] (task ownership)
--    - Reason: Technical lead for specific security implementation
--
-- 4. EXTERNAL CLIENT ACCESS PATTERN:
--    Ontario Government Portal project with external stakeholder access:
--    
--    Role Assignment: "Client Stakeholder" role with permissions:
--    - Project scope: Ontario Client Portal [0,2] (view and share only)
--    - Task scope: Client-facing tasks [0] (view only for progress tracking)
--    - App scope: Client portal interface [0] (read-only access)
--    
--    No direct user permissions (role-based only for consistency)
--
-- PERMISSION INHERITANCE PATTERNS:
-- The system supports sophisticated inheritance through scope hierarchies:
--
-- 1. GEOGRAPHIC INHERITANCE:
--    Canada scope [0,1,2,3,4] → Ontario scope [0,1,2] → Toronto scope [0,1]
--    VP-level employees inherit full Canada access but Toronto is restricted
--
-- 2. BUSINESS INHERITANCE:
--    TechCorp [0,1,2,3,4] → Engineering Division [0,1,2,3] → Platform Team [0,1,2]
--    Executive access cascades down but operational control is more restricted
--
-- 3. PROJECT INHERITANCE:
--    Platform Modernization [0,1,2] → Database Migration Task [0,1,2,3,4]
--    Project-level restriction but full task execution authority for assignees
--
-- SECURITY AND AUDIT CONSIDERATIONS:
-- The permission system supports enterprise security requirements:
--
-- • PRINCIPLE OF LEAST PRIVILEGE: Default to minimal access, explicit grants required
-- • SEPARATION OF DUTIES: No single user has full control across all dimensions
-- • AUDIT TRAIL: Complete logging of permission changes with timestamps
-- • TEMPORAL PERMISSIONS: Time-bound access with from_ts and to_ts tracking
-- • ACTIVE STATE MANAGEMENT: Soft deletes and activation control for permissions
--
-- PERFORMANCE AND SCALABILITY:
-- The design supports enterprise-scale deployments:
-- - Indexed permission arrays for fast permission checking
-- - Efficient scope hierarchy traversal
-- - Cached permission resolution for frequently accessed resources
-- - Bulk permission assignment operations for organizational changes
--
-- INTEGRATION WITH APPLICATION SECURITY:
-- The permission tables integrate with application authentication:
-- - JWT token generation includes relevant scope and permission information
-- - Middleware permission checking against resolved user permissions
-- - Dynamic UI generation based on user's accessible resources
-- - API endpoint protection using scope-based authorization filters

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================


-- User-Scope Permission relationship table (direct user permissions)
CREATE TABLE app.rel_employee_scope_unified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_id uuid NOT NULL REFERENCES app.d_emp(id) ON DELETE CASCADE,
  scope_id uuid NOT NULL REFERENCES app.d_scope_unified(id) ON DELETE CASCADE,
  resource_type text NOT NULL,  -- 'location', 'business', 'hr', 'worksite', 'app', 'project', 'task', 'form'
  resource_id uuid, -- specific resource ID within the resource_type
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[], -- array of permissions: 0:view, 1:modify, 2:share, 3:delete, 4:create
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(emp_id, scope_id, resource_type, resource_id, active)
);

INSERT INTO app.rel_employee_scope_unified (emp_id, scope_id, resource_type, resource_id, resource_permission, tags, attr) VALUES

-- John Smith (Project Manager) - specific project assignments and overrides
((SELECT id FROM app.d_emp WHERE name = 'John Smith' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Platform Modernization 2024 Scope' LIMIT 1),
 'project', NULL, ARRAY[0,1,2,3,4]::smallint[], '["direct-assignment", "project-lead"]', '{"project_manager": true, "budget_responsibility": 2500000, "team_size": 25}'),

((SELECT id FROM app.d_emp WHERE name = 'John Smith' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Toronto Scope' LIMIT 1),
 'location', NULL, ARRAY[0,1,2,3]::smallint[], '["direct-assignment", "office-manager"]', '{"office_coordination": true, "resource_booking": true, "space_management": true}'),

((SELECT id FROM app.d_emp WHERE name = 'John Smith' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Dashboard Page Scope' LIMIT 1),
 'app', NULL, ARRAY[0,2]::smallint[], '["direct-assignment", "executive-dashboard"]', '{"executive_view": true, "kpi_access": true}'),

-- Jane Doe (Principal Frontend Developer) - technical leadership assignments
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Frontend Team Scope' LIMIT 1),
 'business', NULL, ARRAY[0,1,2,3,4]::smallint[], '["direct-assignment", "technical-lead"]', '{"team_leadership": true, "architecture_authority": true, "mentorship_role": true}'),

((SELECT id FROM app.d_emp WHERE name = 'Jane Doe' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Mobile App V2 Scope' LIMIT 1),
 'project', NULL, ARRAY[0,1,2,3]::smallint[], '["direct-assignment", "frontend-lead"]', '{"ui_architecture": true, "user_experience": true, "technical_review": true}'),

((SELECT id FROM app.d_emp WHERE name = 'Jane Doe' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'DataTable Component Scope' LIMIT 1),
 'app', NULL, ARRAY[0,1,2]::smallint[], '["direct-assignment", "component-owner"]', '{"component_architecture": true, "reusable_components": true}'),

-- Bob Wilson (DevOps Engineer) - infrastructure and system administration
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Platform Engineering Scope' LIMIT 1),
 'business', NULL, ARRAY[0,1,2,3,4]::smallint[], '["direct-assignment", "devops-lead"]', '{"infrastructure_lead": true, "deployment_authority": true, "monitoring_setup": true}'),

((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Network Upgrade Scope' LIMIT 1),
 'project', NULL, ARRAY[0,1,2,3,4]::smallint[], '["direct-assignment", "infrastructure-project"]', '{"network_architecture": true, "vendor_coordination": true, "downtime_management": true}'),

((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Canada Scope' LIMIT 1),
 'location', NULL, ARRAY[0,1,2,3]::smallint[], '["direct-assignment", "national-infrastructure"]', '{"multi_site_access": true, "infrastructure_coordination": true}'),

-- Alice Johnson (UX Designer) - design and user experience focus
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Mobile App V2 Scope' LIMIT 1),
 'project', NULL, ARRAY[0,1,2]::smallint[], '["direct-assignment", "ux-lead"]', '{"user_experience": true, "design_authority": true, "user_research": true}'),

((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Ontario Client Portal Scope' LIMIT 1),
 'project', NULL, ARRAY[0,1,2]::smallint[], '["direct-assignment", "accessibility-lead"]', '{"accessibility_compliance": true, "government_standards": true, "bilingual_design": true}'),

-- Mike Chen (Backend Engineer) - backend development assignments
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Backend Team Scope' LIMIT 1),
 'business', NULL, ARRAY[0,1,2,3]::smallint[], '["direct-assignment", "backend-developer"]', '{"api_development": true, "database_access": true, "microservices": true}'),

((SELECT id FROM app.d_emp WHERE name = 'Mike Chen' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'OAuth Implementation Task Scope' LIMIT 1),
 'task', NULL, ARRAY[0,1,2,3,4]::smallint[], '["direct-assignment", "security-implementation"]', '{"authentication_lead": true, "security_review": true, "jwt_implementation": true}'),

-- Sarah Lee (QA Engineer) - quality assurance and testing assignments
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Unit Testing Task Scope' LIMIT 1),
 'task', NULL, ARRAY[0,1,2,3,4]::smallint[], '["direct-assignment", "qa-lead"]', '{"test_automation": true, "quality_gates": true, "coverage_requirements": true}'),

((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Platform Modernization 2024 Scope' LIMIT 1),
 'project', NULL, ARRAY[0,1,2]::smallint[], '["direct-assignment", "qa-oversight"]', '{"quality_assurance": true, "testing_strategy": true, "release_approval": true}');

-- Additional direct assignments to cover HR and Task scopes for API usage
INSERT INTO app.rel_employee_scope_unified (emp_id, scope_id, resource_type, resource_id, resource_permission, tags, attr) VALUES

-- John Smith: HR scope access (leadership visibility)
((SELECT id FROM app.d_emp WHERE name = 'John Smith' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'VP Engineering Scope' LIMIT 1),
 'hr', NULL, ARRAY[0,1,2]::smallint[], '["direct-assignment", "leadership-hr"]', '{"leadership_visibility": true, "people_planning": true}'),

-- John Smith: Key task oversight for modernization program
((SELECT id FROM app.d_emp WHERE name = 'John Smith' LIMIT 1),
 (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Database Migration Task Scope' LIMIT 1),
 'task', NULL, ARRAY[0,1,2,3]::smallint[], '["direct-assignment", "program-oversight"]', '{"critical_path": true, "risk_management": true}');

-- Insert Employee-Scope Permission assignments (simplified direct assignments)
-- These provide a streamlined view of employee permissions for common queries

-- Note: This third insert block appears to be redundant with rel_employee_scope_unified above
-- Commenting out as it references fields that don't exist in the new unified table structure
-- INSERT INTO app.rel_employee_scope (emp_id, scope_id, scope_name, scope_type, resource_permission, tags, attr) VALUES

-- COMMENTED OUT: This insert block references table structure that doesn't exist in unified tables
-- The following data should be inserted into rel_employee_scope_unified instead if needed

-- John Smith - Project Manager consolidated permissions
-- ((SELECT id FROM app.d_emp WHERE name = 'John Smith' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Engineering Division Scope' LIMIT 1),
--  'Engineering Division Access', 'business', ARRAY[0,1,2,3,4]::smallint[], '["project-manager", "business-oversight"]', '{"divisional_authority": true, "budget_oversight": true}'),

-- ((SELECT id FROM app.d_emp WHERE name = 'John Smith' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Platform Modernization Scope' LIMIT 1),
--  'Platform Modernization Project Lead', 'project', ARRAY[0,1,2,3,4]::smallint[], '["project-manager", "project-lead"]', '{"project_ownership": true, "critical_system": true}'),

-- ((SELECT id FROM app.d_emp WHERE name = 'John Smith' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Toronto Scope' LIMIT 1),
--  'Toronto Office Operations', 'location', ARRAY[0,1,2,3]::smallint[], '["project-manager", "office-operations"]', '{"office_management": true, "resource_coordination": true}'),

-- Jane Doe - Principal Frontend Developer consolidated permissions
-- ((SELECT id FROM app.d_emp WHERE name = 'Jane Doe' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Frontend Team Scope' LIMIT 1),
--  'Frontend Team Leadership', 'business', ARRAY[0,1,2,3,4]::smallint[], '["senior-developer", "technical-lead"]', '{"team_leadership": true, "frontend_architecture": true}'),

-- ((SELECT id FROM app.d_emp WHERE name = 'Jane Doe' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Mobile App V2 Scope' LIMIT 1),
--  'Mobile App Frontend Lead', 'project', ARRAY[0,1,2,3]::smallint[], '["senior-developer", "mobile-lead"]', '{"mobile_expertise": true, "user_experience": true}'),

-- Bob Wilson - DevOps Engineer consolidated permissions
-- ((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Platform Engineering Scope' LIMIT 1),
--  'Platform Infrastructure Lead', 'business', ARRAY[0,1,2,3,4]::smallint[], '["devops", "infrastructure-lead"]', '{"infrastructure_authority": true, "deployment_oversight": true}'),

-- ((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Canada Scope' LIMIT 1),
--  'Canadian Infrastructure Access', 'location', ARRAY[0,1,2,3]::smallint[], '["devops", "national-infrastructure"]', '{"multi_site_infrastructure": true, "disaster_recovery": true}'),

-- Alice Johnson - UX Designer consolidated permissions
-- ((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Mobile App V2 Scope' LIMIT 1),
--  'Mobile App UX Design Lead', 'project', ARRAY[0,1,2]::smallint[], '["designer", "ux-lead"]', '{"user_experience_authority": true, "design_system_owner": true}'),

-- ((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Ontario Client Portal Scope' LIMIT 1),
--  'Government Portal Accessibility Lead', 'project', ARRAY[0,1,2]::smallint[], '["designer", "accessibility-specialist"]', '{"government_compliance": true, "accessibility_authority": true}'),

-- Mike Chen - Backend Engineer consolidated permissions
-- ((SELECT id FROM app.d_emp WHERE name = 'Mike Chen' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Backend Team Scope' LIMIT 1),
--  'Backend Development Access', 'business', ARRAY[0,1,2,3]::smallint[], '["backend-developer", "api-specialist"]', '{"api_development": true, "database_access": true}'),

-- ((SELECT id FROM app.d_emp WHERE name = 'Mike Chen' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'OAuth Implementation Task Scope' LIMIT 1),
--  'OAuth Security Implementation', 'task', ARRAY[0,1,2,3,4]::smallint[], '["backend-developer", "security-specialist"]', '{"authentication_authority": true, "security_implementation": true}'),

-- Sarah Lee - QA Engineer consolidated permissions
-- ((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Unit Testing Task Scope' LIMIT 1),
--  'Quality Assurance Testing Lead', 'task', ARRAY[0,1,2,3,4]::smallint[], '["qa-engineer", "testing-lead"]', '{"test_automation_authority": true, "quality_gates": true}'),

-- ((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee' LIMIT 1),
--  (SELECT id FROM app.d_scope_unified WHERE scope_name = 'Platform Modernization Scope' LIMIT 1),
--  'Platform QA Oversight', 'project', ARRAY[0,1,2]::smallint[], '["qa-engineer", "quality-oversight"]', '{"quality_assurance": true, "testing_strategy": true}');
