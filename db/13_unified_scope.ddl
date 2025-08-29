-- ============================================================================
-- UNIFIED SCOPE SYSTEM (Central Permission Registry)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================
--
-- The unified scope system serves as the central registry for all permission-based
-- entities in the PMO platform. It provides a single, consistent interface for
-- referencing any scope type (business, location, hr, app) while maintaining
-- referential integrity and enabling sophisticated permission inheritance patterns.
--
-- ARCHITECTURAL PURPOSE:
-- The d_scope table acts as a universal foreign key target that enables:
--
-- • UNIFIED PERMISSION MODEL: Single table to reference all permission scopes
-- • POLYMORPHIC RELATIONSHIPS: Dynamic references to different scope table types
-- • CONSISTENT RBAC INTERFACE: Standardized permission checking across all entities
-- • AUDIT TRAIL CONSOLIDATION: Central tracking of all scope-based access
-- • CROSS-SCOPE ANALYTICS: Unified reporting across all organizational dimensions
--
-- SCOPE REFERENCE PATTERN:
-- Instead of having separate foreign keys for each scope type, entities can reference
-- d_scope.id, which then provides the specific scope details through:
--
-- d_scope.scope_reference_table_name → exact table name ('d_scope_business', 'd_scope_app', etc.)
-- d_scope.scope_id → exact UUID of the record in the reference table
--
-- This pattern enables:
-- - Projects referencing business, location, or app scopes uniformly
-- - Tasks inheriting permissions from multiple scope types
-- - Users having permissions across heterogeneous scope collections
-- - Dynamic scope assignment without schema changes
--
-- PERMISSION INHERITANCE CASCADE:
-- The scope system supports hierarchical permission inheritance:
--
-- 1. DIRECT SCOPE PERMISSIONS: User has direct permission to specific scope
-- 2. PARENT SCOPE INHERITANCE: User has permission to parent scope, inherits child access
-- 3. CROSS-SCOPE BRIDGING: User permissions bridge between scope types (HR → Business → Location)
-- 4. CONTEXTUAL SCOPE RESOLUTION: Permission calculated based on operational context
--
-- SCOPE TYPE SEMANTICS:
-- Each scope_type serves specific organizational and operational purposes:
--
-- • 'business': Organizational hierarchy (Corporation → Division → Team)
-- • 'location': Geographic structure (Country → Province → City)  
-- • 'hr': Human resources hierarchy (C-Level → Manager → Engineer)
-- • 'app': Application components (Pages → APIs → UI Components)
-- • 'worksite': Physical facilities (HQ → Office → Meeting Room → Data Centers)
-- • 'project': Project execution hierarchy (Program → Project → Phase → Milestone)
-- • 'task': Work breakdown structure (Epic → Story → Task → Subtask)
-- • 'form': Document workflows (Form Type → Form Instance → Field → Approval)
--
-- MULTI-TENANT AND SCALABILITY:
-- The unified scope design supports enterprise scalability:
--
-- • TENANT ISOLATION: Scope-based data segregation for multi-tenant deployments
-- • ORGANIZATIONAL GROWTH: Dynamic scope hierarchy expansion without schema migration
-- • CROSS-FUNCTIONAL TEAMS: Users spanning multiple scope types and hierarchies
-- • FEDERATED PERMISSIONS: Integration with external identity providers and systems
--
-- REAL-WORLD PMO SCENARIOS WITH CONCRETE DATA SAMPLES:
--
-- 1. PROJECT MANAGER - Sarah Chen (emp_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890):
--    ┌─────────────────────────────────────────────────────────────────────────┐
--    │ Business Scope: 'Engineering Division' (scope_id: b2c3d4e5-f6g7-8901...)│
--    │ resource_permission: [0,1,2,3,4] -- Full CRUD access                   │
--    │ ├── Can view all engineering teams and projects                         │
--    │ ├── Can modify team assignments and project scopes                     │
--    │ ├── Can share project reports with stakeholders                        │
--    │ └── Can create/delete sub-projects within engineering                  │
--    │                                                                         │
--    │ Location Scope: 'Toronto Office' (scope_id: c3d4e5f6-g7h8-9012...)    │
--    │ resource_permission: [0,1,2] -- View, modify, share only               │
--    │ ├── Can view Toronto office employee roster                            │
--    │ ├── Can modify office space allocations for projects                   │
--    │ └── Can share office resource reports                                  │
--    │                                                                         │
--    │ App Scope: 'Project Management Pages' (scope_id: d4e5f6g7-h8i9-0123..)│
--    │ resource_permission: [0,2] -- View and share only                      │
--    │ ├── Can access /projects, /tasks, /dashboard pages                     │
--    │ └── Can share project dashboards with team members                     │
--    │                                                                         │
--    │ Project Scope: 'Platform Modernization 2024' (scope_id: e5f6g7h8-...) │
--    │ resource_permission: [0,1,2,3,4] -- Full project ownership             │
--    │ └── Complete control over assigned project lifecycle                   │
--    └─────────────────────────────────────────────────────────────────────────┘
--
-- 2. HR REPRESENTATIVE - Michael Rodriguez (emp_id: f6g7h8i9-j0k1-2345...):
--    ┌─────────────────────────────────────────────────────────────────────────┐
--    │ HR Scope: 'VP Engineering' (scope_id: g7h8i9j0-k1l2-3456...)          │
--    │ resource_permission: [0,1,2,3,4] -- Full HR management access          │
--    │ ├── Can view/edit all engineering employee records                     │
--    │ ├── Can create performance review cycles                               │
--    │ ├── Can delete terminated employee records                             │
--    │ └── Can share org charts and reporting structures                      │
--    │                                                                         │
--    │ Business Scope: 'All Engineering Teams' (scope_id: h8i9j0k1-l2m3...)  │
--    │ resource_permission: [0,2] -- View and share employee assignments      │
--    │ ├── Can see which employees work in which business units               │
--    │ └── Can share workforce distribution reports                           │
--    │                                                                         │
--    │ Location Scope: 'All Canadian Offices' (scope_id: i9j0k1l2-m3n4...)   │
--    │ resource_permission: [0,2] -- View workforce distribution              │
--    │ ├── Can see employee headcount by location                             │
--    │ └── Can generate location-based workforce reports                      │
--    │                                                                         │
--    │ App Scope: 'Employee Management UI' (scope_id: j0k1l2m3-n4o5...)      │
--    │ resource_permission: [0,1,2] -- Employee management interface          │
--    │ └── Can access /admin/employees, /admin/hr components                  │
--    └─────────────────────────────────────────────────────────────────────────┘
--
-- 3. EXECUTIVE - David Kim, VP Engineering (emp_id: k1l2m3n4-o5p6-7890...):
--    ┌─────────────────────────────────────────────────────────────────────────┐
--    │ Business Scope: 'TechCorp Inc.' (scope_id: l2m3n4o5-p6q7-8901...)     │
--    │ resource_permission: [0,1,2,3,4] -- Corporation-wide authority         │
--    │ ├── Can view entire organizational structure                           │
--    │ ├── Can modify department budgets and resource allocation              │
--    │ ├── Can create new business units or dissolve underperforming ones     │
--    │ └── Can share strategic business reports with board                    │
--    │                                                                         │
--    │ Location Scope: 'North America Region' (scope_id: m3n4o5p6-q7r8...)   │
--    │ resource_permission: [0,1,2,3,4] -- Regional operational control       │
--    │ ├── Can establish new office locations                                 │
--    │ ├── Can modify regional operational policies                           │
--    │ └── Can close or relocate offices based on business needs              │
--    │                                                                         │
--    │ HR Scope: 'VP Engineering Level' (scope_id: n4o5p6q7-r8s9...)         │
--    │ resource_permission: [0,1,2] -- Strategic HR oversight (limited)       │
--    │ ├── Can view engineering leadership pipeline                           │
--    │ ├── Can modify senior engineer role definitions                        │
--    │ └── Can share leadership succession plans                              │
--    │                                                                         │
--    │ App Scope: 'Executive Dashboard' (scope_id: o5p6q7r8-s9t0...)          │
--    │ resource_permission: [0,2] -- Strategic oversight interface            │
--    │ ├── Can access /dashboard with C-level KPI views                       │
--    │ └── Can share executive reports with stakeholders                      │
--    │                                                                         │
--    │ Project Scope: 'All Strategic Projects' (multiple scope_ids)           │
--    │ resource_permission: [0,2] -- Portfolio oversight only                 │
--    │ ├── Can view all project statuses and milestones                       │
--    │ └── Can share portfolio health reports with CEO/board                  │
--    └─────────────────────────────────────────────────────────────────────────┘
--
-- INTEGRATION WITH RBAC ENGINE & CONCRETE SQL EXAMPLES:
-- The scope system integrates with the RBAC tables (rel_user_scope_unified, rel_role_scope)
-- to provide dynamic permission resolution:
--
-- rel_user_scope_unified.scope_id → d_scope.id → scope_reference_table_name + scope_id → actual entity
--
-- EXAMPLE 1: Find all projects Sarah Chen can modify (permission 1):
-- SELECT p.name, p.id as project_id, ds.scope_name, ds.resource_permission
-- FROM app.rel_user_scope_unified rus
-- JOIN app.d_scope_unified ds ON rus.scope_id = ds.id
-- JOIN app.ops_project_head p ON ds.scope_id = p.id
-- WHERE rus.emp_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--   AND ds.scope_type = 'project'
--   AND 1 = ANY(ds.resource_permission)
--   AND rus.active = true;
--
-- EXAMPLE 2: Get all Toronto office employees Michael can manage (HR scope):
-- SELECT e.name, e.id, loc.name as office_location
-- FROM app.rel_user_scope_unified rus
-- JOIN app.d_scope_unified ds ON rus.scope_id = ds.id
-- JOIN app.d_scope_hr hr ON ds.scope_id = hr.id
-- JOIN app.d_emp e ON e.hr_id = hr.id
-- JOIN app.d_scope_location loc ON e.location_id = loc.id
-- WHERE rus.emp_id = 'f6g7h8i9-j0k1-2345-6789-012345678901'
--   AND ds.scope_type = 'hr'
--   AND 1 = ANY(ds.resource_permission)  -- can modify
--   AND loc.name = 'Toronto'
--   AND rus.active = true;
--
-- EXAMPLE 3: Check if David Kim can create new projects in Engineering Division:
-- SELECT CASE WHEN COUNT(*) > 0 THEN 'ALLOWED' ELSE 'DENIED' END as create_permission
-- FROM app.rel_user_scope_unified rus
-- JOIN app.d_scope_unified ds ON rus.scope_id = ds.id
-- JOIN app.d_scope_business biz ON ds.scope_id = biz.id
-- WHERE rus.emp_id = 'k1l2m3n4-o5p6-7890-1234-567890123456'
--   AND ds.scope_type = 'business'
--   AND biz.name = 'Engineering Division'
--   AND 4 = ANY(ds.resource_permission)  -- create permission
--   AND rus.active = true;
--
-- EXAMPLE 4: Multi-scope query - Find all app pages accessible to project managers:
-- SELECT DISTINCT app.scope_path, app.name, ds.resource_permission
-- FROM app.rel_user_scope_unified rus
-- JOIN app.d_scope_unified ds ON rus.scope_id = ds.id
-- JOIN app.d_scope_app app ON ds.scope_id = app.id
-- WHERE rus.emp_id IN (
--     SELECT DISTINCT rus2.emp_id
--     FROM app.rel_user_scope_unified rus2
--     JOIN app.d_scope_unified ds2 ON rus2.scope_id = ds2.id
--     JOIN app.ops_project_head p ON ds2.scope_id = p.id
--     WHERE ds2.scope_type = 'project'
--       AND 1 = ANY(ds2.resource_permission)  -- has modify on projects
-- )
-- AND ds.scope_type = 'app'
-- AND 0 = ANY(ds.resource_permission)  -- has view permission
-- AND rus.active = true;
--
-- EXAMPLE 5: Hierarchical permission check (parent-child scope inheritance):
-- WITH scope_hierarchy AS (
--     SELECT id, parent_scope_id, scope_name, resource_permission, 0 as level
--     FROM app.d_scope_unified
--     WHERE id IN (SELECT scope_id FROM app.rel_user_scope_unified WHERE emp_id = 'current_user_id')
--     UNION ALL
--     SELECT s.id, s.parent_scope_id, s.scope_name, s.resource_permission, sh.level + 1
--     FROM app.d_scope_unified s
--     JOIN scope_hierarchy sh ON s.parent_scope_id = sh.id
--     WHERE sh.level < 5  -- prevent infinite recursion
-- )
-- SELECT scope_name, resource_permission, level
-- FROM scope_hierarchy
-- WHERE 2 = ANY(resource_permission)  -- share permission
-- ORDER BY level;
--
-- SAMPLE DATA RECORDS (How actual d_scope entries would look):
--
-- ┌──────────────────────────────────────────────────────────────────────────────────────┐
-- │ id: b2c3d4e5-f6g7-8901-2345-678901234567                                            │
-- │ scope_type: 'business'                                                               │
-- │ scope_reference_table_name: 'd_scope_business'                                       │
-- │ scope_id: 12345678-1234-5678-9012-123456789012  -- actual d_scope_business.id     │
-- │ scope_name: 'Engineering Division Scope'                                            │
-- │ scope_descr: 'Full access to engineering division operations and projects'          │
-- │ scope_path: 'TechCorp/Engineering'                                                  │
-- │ scope_level_id: 2                                                                   │
-- │ parent_scope_id: a1b2c3d4-e5f6-7890-1234-567890123456  -- TechCorp root scope     │
-- │ tenant_id: 99887766-5544-3322-1100-998877665544                                    │
-- │ is_system_scope: false                                                              │
-- │ is_inherited: false                                                                 │
-- │ resource_permission: [0,1,2,3,4]  -- Full CRUD access                              │
-- │ tags: ["division", "technical", "engineering"]                                      │
-- │ attr: {"includes_all_tech_projects": true, "r_and_d_access": true}                  │
-- └──────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌──────────────────────────────────────────────────────────────────────────────────────┐
-- │ id: c3d4e5f6-g7h8-9012-3456-789012345678                                            │
-- │ scope_type: 'location'                                                              │
-- │ scope_reference_table_name: 'd_scope_location'                                      │
-- │ scope_id: 23456789-2345-6789-0123-234567890123  -- actual d_scope_location.id     │
-- │ scope_name: 'Toronto Office Scope'                                                  │
-- │ scope_descr: 'Toronto development center operations and resources'                  │
-- │ scope_path: 'North America/Canada/Ontario/Toronto'                                  │
-- │ scope_level_id: 5                                                                   │
-- │ parent_scope_id: d4e5f6g7-h8i9-0123-4567-890123456789  -- Ontario province scope  │
-- │ tenant_id: 99887766-5544-3322-1100-998877665544                                    │
-- │ is_system_scope: false                                                              │
-- │ is_inherited: true   -- inherits from Ontario province                             │
-- │ resource_permission: [0,1,2]  -- View, modify, share only                          │
-- │ tags: ["city", "tech-hub", "development-center"]                                    │
-- │ attr: {"development_center": true, "talent_pool": "high", "timezone": "EST"}        │
-- └──────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌──────────────────────────────────────────────────────────────────────────────────────┐
-- │ id: d4e5f6g7-h8i9-0123-4567-890123456789                                            │
-- │ scope_type: 'project'                                                               │
-- │ scope_reference_table_name: 'ops_project_head'                                      │
-- │ scope_id: 34567890-3456-7890-1234-345678901234  -- actual ops_project_head.id     │
-- │ scope_name: 'Platform Modernization 2024 Scope'                                    │
-- │ scope_descr: 'Critical infrastructure modernization project'                        │
-- │ scope_path: 'Projects/Platform-Modernization-2024'                                  │
-- │ scope_level_id: null  -- projects don't have levels                                │
-- │ parent_scope_id: null -- top-level project                                         │
-- │ tenant_id: 99887766-5544-3322-1100-998877665544                                    │
-- │ is_system_scope: false                                                              │
-- │ is_inherited: false                                                                 │
-- │ resource_permission: [0,1,2]  -- View, modify, share (no delete/create - critical) │
-- │ tags: ["project", "infrastructure", "critical", "2024"]                             │
-- │ attr: {"critical_system": true, "production_impact": true, "budget": 2500000}       │
-- └──────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌──────────────────────────────────────────────────────────────────────────────────────┐
-- │ id: e5f6g7h8-i9j0-1234-5678-901234567890                                            │
-- │ scope_type: 'app'                                                                   │
-- │ scope_reference_table_name: 'd_scope_app'                                           │
-- │ scope_id: 45678901-4567-8901-2345-456789012345  -- actual d_scope_app.id          │
-- │ scope_name: 'Project Management Dashboard Scope'                                    │
-- │ scope_descr: 'Access to project management UI and reporting tools'                  │
-- │ scope_path: 'App/Pages/Projects'                                                    │
-- │ scope_level_id: null  -- app components don't have levels                          │
-- │ parent_scope_id: f6g7h8i9-j0k1-2345-6789-012345678901  -- main dashboard scope    │
-- │ tenant_id: 99887766-5544-3322-1100-998877665544                                    │
-- │ is_system_scope: false                                                              │
-- │ is_inherited: true   -- inherits from parent dashboard                             │
-- │ resource_permission: [0,2]  -- View and share only (no modification of UI)         │
-- │ tags: ["app", "projects", "dashboard", "ui"]                                        │
-- │ attr: {"route": "/projects", "requires_auth": true, "role_based": true}             │
-- └──────────────────────────────────────────────────────────────────────────────────────┘

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

CREATE TABLE app.d_scope_unified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL, -- 'business', 'location', 'hr', 'worksite', 'project', 'task', 'form', 'app' (future: 'client')
  scope_reference_table_name text NOT NULL, -- exact table name: 'd_scope_business', 'd_scope_location', 'd_scope_hr', 'd_scope_app'
  scope_id uuid NOT NULL, -- exact id of the foreign table
  scope_name text NOT NULL,
  scope_descr text,
  scope_path text, -- hierarchical path for nested scopes (e.g., "TechCorp/Engineering/Backend")
  scope_level_id int, -- references various meta_*_level tables based on scope_type
  parent_scope_id uuid REFERENCES app.d_scope_unified(id) ON DELETE SET NULL, -- enables scope hierarchy within d_scope_unified
  tenant_id uuid, -- multi-tenant support
  is_system_scope boolean NOT NULL DEFAULT false, -- system-level scopes that can't be deleted
  is_inherited boolean NOT NULL DEFAULT false, -- whether permissions are inherited from parent
  resource_permission smallint[] NOT NULL DEFAULT ARRAY[]::smallint[], -- array of permissions: 0:view, 1:modify, 2:share, 3:delete, 4:create
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  scope_created timestamptz NOT NULL DEFAULT now(),
  scope_updated timestamptz NOT NULL DEFAULT now(),
  -- Constraints removed for simplified import
);



-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
-- ============================================================================

-- Sample tenant for multi-tenant demonstration
DO $$
DECLARE 
    tenant_techcorp uuid := gen_random_uuid();
    
    -- Business scope IDs (assuming they exist from previous DDL)
    techcorp_id uuid;
    engineering_id uuid;
    sales_id uuid;
    platform_eng_id uuid;
    frontend_team_id uuid;
    backend_team_id uuid;
    
    -- Location scope IDs
    north_america_id uuid;
    canada_id uuid;
    ontario_id uuid;
    london_id uuid;
    toronto_id uuid;
    mississauga_id uuid;
    
    -- HR scope IDs
    ceo_office_id uuid;
    vp_engineering_id uuid;
    vp_sales_id uuid;
    eng_directors_id uuid;
    eng_managers_id uuid;
    senior_engineers_id uuid;
    
    -- Project IDs
    platform_modernization_id uuid;
    mobile_app_id uuid;
    ontario_portal_id uuid;
    ai_analytics_id uuid;
    network_upgrade_id uuid;
    
    -- App scope IDs (from d_scope_app table)
    dashboard_page_id uuid;
    projects_page_id uuid;
    admin_page_id uuid;
    datatable_comp_id uuid;
    
    -- Task scope IDs (from ops_task_head table)
    db_migration_task_id uuid;
    oauth_task_id uuid;
    unit_test_task_id uuid;
    
BEGIN
    -- Get existing scope IDs (these would exist from other DDL files)
    -- Only populate if records exist, otherwise skip the scope creation
    SELECT id INTO techcorp_id FROM app.d_scope_business WHERE name = 'TechCorp Inc.' AND active = true LIMIT 1;
    SELECT id INTO engineering_id FROM app.d_scope_business WHERE name = 'Engineering Division' AND active = true LIMIT 1;
    SELECT id INTO sales_id FROM app.d_scope_business WHERE name = 'Sales Division' AND active = true LIMIT 1;
    SELECT id INTO platform_eng_id FROM app.d_scope_business WHERE name = 'Platform Engineering' AND active = true LIMIT 1;
    SELECT id INTO frontend_team_id FROM app.d_scope_business WHERE name = 'Frontend Team' AND active = true LIMIT 1;
    SELECT id INTO backend_team_id FROM app.d_scope_business WHERE name = 'Backend Team' AND active = true LIMIT 1;
    
    SELECT id INTO north_america_id FROM app.d_scope_location WHERE name = 'North America' AND active = true LIMIT 1;
    SELECT id INTO canada_id FROM app.d_scope_location WHERE name = 'Canada' AND active = true LIMIT 1;
    SELECT id INTO ontario_id FROM app.d_scope_location WHERE name = 'Ontario' AND active = true LIMIT 1;
    SELECT id INTO london_id FROM app.d_scope_location WHERE name = 'London' AND active = true LIMIT 1;
    SELECT id INTO toronto_id FROM app.d_scope_location WHERE name = 'Toronto' AND active = true LIMIT 1;
    SELECT id INTO mississauga_id FROM app.d_scope_location WHERE name = 'Mississauga' AND active = true LIMIT 1;
    
    SELECT id INTO ceo_office_id FROM app.d_scope_hr WHERE name = 'CEO Office' AND active = true LIMIT 1;
    SELECT id INTO vp_engineering_id FROM app.d_scope_hr WHERE name = 'VP Engineering' AND active = true LIMIT 1;
    SELECT id INTO vp_sales_id FROM app.d_scope_hr WHERE name = 'VP Sales' AND active = true LIMIT 1;
    SELECT id INTO eng_directors_id FROM app.d_scope_hr WHERE name = 'Engineering Directors' AND active = true LIMIT 1;
    SELECT id INTO eng_managers_id FROM app.d_scope_hr WHERE name = 'Engineering Managers' AND active = true LIMIT 1;
    SELECT id INTO senior_engineers_id FROM app.d_scope_hr WHERE name = 'Senior Engineers' AND active = true LIMIT 1;
    
    SELECT id INTO platform_modernization_id FROM app.ops_project_head WHERE name = 'Platform Modernization 2024' AND active = true LIMIT 1;
    SELECT id INTO mobile_app_id FROM app.ops_project_head WHERE name = 'Mobile App V2' AND active = true LIMIT 1;
    SELECT id INTO ontario_portal_id FROM app.ops_project_head WHERE name = 'Ontario Client Portal' AND active = true LIMIT 1;
    
    SELECT id INTO dashboard_page_id FROM app.d_scope_app WHERE scope_path = '/' AND active = true LIMIT 1;
    SELECT id INTO projects_page_id FROM app.d_scope_app WHERE scope_path = '/projects' AND active = true LIMIT 1;
    SELECT id INTO admin_page_id FROM app.d_scope_app WHERE scope_path = '/admin' AND active = true LIMIT 1;
    SELECT id INTO datatable_comp_id FROM app.d_scope_app WHERE scope_path = 'datatable:DataTable' AND active = true LIMIT 1;

    -- Insert unified scopes for business hierarchy (only if the business entities exist)
    IF techcorp_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('business', 'd_scope_business', techcorp_id, 'TechCorp Inc. Scope', 'Corporate-level business scope with full organizational access', 'TechCorp', 1, tenant_techcorp, true, ARRAY[0,1,2,3,4]::smallint[], '["corporation", "root"]', '{"permissions_inherit_to_all": true, "executive_access": true}');
    END IF;
    
    IF engineering_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('business', 'd_scope_business', engineering_id, 'Engineering Division Scope', 'Engineering division with all development teams and projects', 'TechCorp/Engineering', 2, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["division", "technical"]', '{"includes_all_tech_projects": true, "r_and_d_access": true}');
    END IF;
    
    IF sales_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('business', 'd_scope_business', sales_id, 'Sales Division Scope', 'Sales and marketing operations division', 'TechCorp/Sales', 2, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["division", "commercial"]', '{"customer_data_access": true, "revenue_reporting": true}');
    END IF;
    
    IF platform_eng_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('business', 'd_scope_business', platform_eng_id, 'Platform Engineering Scope', 'Infrastructure and platform development department', 'TechCorp/Engineering/Platform', 3, tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["department", "infrastructure"]', '{"system_admin_required": true, "production_access": true}');
    END IF;
    
    IF frontend_team_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('business', 'd_scope_business', frontend_team_id, 'Frontend Team Scope', 'User interface and experience development team', 'TechCorp/Engineering/Product/Frontend', 4, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["team", "frontend"]', '{"ui_design_access": true, "user_testing_data": true}');
    END IF;
    
    IF backend_team_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('business', 'd_scope_business', backend_team_id, 'Backend Team Scope', 'Server-side and API development team', 'TechCorp/Engineering/Platform/Backend', 4, tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["team", "backend"]', '{"database_access": true, "api_keys": true}');
    END IF;

    -- Insert unified scopes for location hierarchy (only if the location entities exist)
    IF north_america_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('location', 'd_scope_location', north_america_id, 'North America Scope', 'Corporate regional scope covering North American operations', 'North America', 1, tenant_techcorp, true, ARRAY[0,1,2,3,4]::smallint[], '["region", "corporate"]', '{"timezone_coordination": true, "multi_country": true}');
    END IF;
    
    IF canada_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('location', 'd_scope_location', canada_id, 'Canada Scope', 'National scope for all Canadian operations and compliance', 'North America/Canada', 2, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["country", "national"]', '{"regulatory_compliance": "canadian", "currency": "CAD"}');
    END IF;
    
    IF ontario_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('location', 'd_scope_location', ontario_id, 'Ontario Scope', 'Provincial scope for Ontario operations', 'North America/Canada/Ontario', 3, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["province", "ontario"]', '{"provincial_tax": true, "labour_laws": "ontario"}');
    END IF;
    
    IF london_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('location', 'd_scope_location', london_id, 'London Scope', 'London operations and headquarters', 'North America/Canada/Ontario/London', 5, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["city", "headquarters"]', '{"main_office": true, "executive_presence": true}');
    END IF;
    
    IF toronto_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('location', 'd_scope_location', toronto_id, 'Toronto Scope', 'Toronto development center and operations', 'North America/Canada/Ontario/Toronto', 5, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["city", "tech-hub"]', '{"development_center": true, "talent_pool": "high"}');
    END IF;
    
    IF mississauga_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('location', 'd_scope_location', mississauga_id, 'Mississauga Scope', 'Mississauga sales office operations', 'North America/Canada/Ontario/Mississauga', 5, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["city", "sales"]', '{"sales_office": true, "customer_meetings": true}');
    END IF;

    -- Insert unified scopes for HR hierarchy (only if the HR entities exist)
    IF ceo_office_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('hr', 'd_scope_hr', ceo_office_id, 'CEO Office Scope', 'Executive leadership and corporate governance', 'Executive/CEO', 1, tenant_techcorp, true, ARRAY[0]::smallint[], '["executive", "c-suite"]', '{"board_access": true, "strategic_planning": true, "confidential_data": true}');
    END IF;
    
    IF vp_engineering_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('hr', 'd_scope_hr', vp_engineering_id, 'VP Engineering Scope', 'Engineering leadership and technical strategy', 'Executive/VP-Engineering', 2, tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["vp", "technical"]', '{"tech_strategy": true, "engineering_budget": true, "hiring_authority": true}');
    END IF;
    
    IF vp_sales_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('hr', 'd_scope_hr', vp_sales_id, 'VP Sales Scope', 'Sales leadership and commercial strategy', 'Executive/VP-Sales', 2, tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["vp", "commercial"]', '{"sales_strategy": true, "revenue_targets": true, "customer_relationships": true}');
    END IF;
    
    IF eng_directors_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('hr', 'd_scope_hr', eng_directors_id, 'Engineering Directors Scope', 'Engineering department leadership', 'Engineering/Directors', 3, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["director", "management"]', '{"team_management": true, "technical_oversight": true, "resource_allocation": true}');
    END IF;
    
    IF eng_managers_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('hr', 'd_scope_hr', eng_managers_id, 'Engineering Managers Scope', 'Engineering team and project management', 'Engineering/Managers', 4, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["manager", "team-lead"]', '{"project_management": true, "performance_reviews": true, "sprint_planning": true}');
    END IF;
    
    IF senior_engineers_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('hr', 'd_scope_hr', senior_engineers_id, 'Senior Engineers Scope', 'Senior technical contributors and mentors', 'Engineering/Senior', 6, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["senior", "technical"]', '{"code_review": true, "mentorship": true, "technical_decisions": true}');
    END IF;

    -- Insert unified scopes for project operations (only if the project entities exist)
    IF platform_modernization_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('project', 'ops_project_head', platform_modernization_id, 'Platform Modernization Scope', 'Infrastructure modernization project scope', 'Projects/Platform-Modernization-2024', tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["project", "infrastructure"]', '{"critical_system": true, "production_impact": true, "security_review": true}');
    END IF;
    
    IF mobile_app_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('project', 'ops_project_head', mobile_app_id, 'Mobile App V2 Scope', 'Mobile application development project scope', 'Projects/Mobile-App-V2', tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["project", "mobile"]', '{"customer_facing": true, "user_experience": true, "market_launch": true}');
    END IF;
    
    IF ontario_portal_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('project', 'ops_project_head', ontario_portal_id, 'Client Portal Scope', 'Client portal development project scope', 'Projects/Ontario-Client-Portal', tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["project", "client-facing"]', '{"customer_data": true, "ontario_specific": true, "regulatory_compliance": true}');
    END IF;

    -- Insert unified scopes for application components (only if the app entities exist)
    IF dashboard_page_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('app', 'd_scope_app', dashboard_page_id, 'Dashboard Page Scope', 'Main dashboard application scope', 'App/Pages/Dashboard', tenant_techcorp, true, ARRAY[0,2]::smallint[], '["app", "dashboard"]', '{"main_entry": true, "overview_data": true, "personalized": true}');
    END IF;
    
    IF projects_page_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('app', 'd_scope_app', projects_page_id, 'Projects Page Scope', 'Project management application scope', 'App/Pages/Projects', tenant_techcorp, false, ARRAY[0,2]::smallint[], '["app", "projects"]', '{"project_management": true, "kanban_view": true, "reporting": true}');
    END IF;
    
    IF admin_page_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('app', 'd_scope_app', admin_page_id, 'Admin Page Scope', 'Administrative application scope', 'App/Pages/Admin', tenant_techcorp, false, ARRAY[0]::smallint[], '["app", "admin"]', '{"system_admin": true, "configuration": true, "user_management": true}');
    END IF;

    IF datatable_comp_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('app', 'd_scope_app', datatable_comp_id, 'DataTable Component Scope', 'DataTable UI component access scope', 'App/Components/DataTable', tenant_techcorp, false, ARRAY[0,2]::smallint[], '["app", "component"]', '{"data_display": true, "filtering": true, "pagination": true}');
    END IF;

    -- Insert unified scopes for projects (only if the project entities exist)

    SELECT id INTO platform_modernization_id FROM app.ops_project_head WHERE project_code = 'PM-2024-001' AND active = true LIMIT 1;
    SELECT id INTO mobile_app_id FROM app.ops_project_head WHERE project_code = 'MA-2024-002' AND active = true LIMIT 1;
    SELECT id INTO ontario_portal_id FROM app.ops_project_head WHERE project_code = 'OCP-2024-003' AND active = true LIMIT 1;
    SELECT id INTO ai_analytics_id FROM app.ops_project_head WHERE project_code = 'AI-2024-004' AND active = true LIMIT 1;
    SELECT id INTO network_upgrade_id FROM app.ops_project_head WHERE project_code = 'NET-2024-005' AND active = true LIMIT 1;

    IF platform_modernization_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('project', 'ops_project_head', platform_modernization_id, 'Platform Modernization 2024 Scope', 'Critical infrastructure modernization project with full technical and administrative access', 'Projects/Infrastructure/Platform-Modernization-2024', 1, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["project", "infrastructure", "critical"]', '{"budget_access": true, "technical_admin": true, "security_clearance": "confidential", "external_vendors": true}');
    END IF;

    IF mobile_app_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('project', 'ops_project_head', mobile_app_id, 'Mobile App V2 Scope', 'Mobile application development project with development and testing access', 'Projects/Development/Mobile-App-V2', 1, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["project", "development", "mobile"]', '{"app_store_access": true, "testing_devices": true, "user_analytics": true, "feature_flags": true}');
    END IF;

    IF ontario_portal_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('project', 'ops_project_head', ontario_portal_id, 'Ontario Client Portal Scope', 'Government service portal project with restricted security requirements', 'Projects/Government/Ontario-Portal', 1, tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["project", "government", "restricted"]', '{"security_clearance": "secret", "government_compliance": true, "bilingual_required": true, "accessibility_audit": true}');
    END IF;

    IF ai_analytics_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('project', 'ops_project_head', ai_analytics_id, 'AI Analytics Platform Scope', 'Research and development project with limited access for intellectual property protection', 'Projects/Research/AI-Analytics', 1, tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["project", "research", "confidential"]', '{"ip_protection": true, "research_data": true, "university_partnerships": true, "patent_filing": true}');
    END IF;

    IF network_upgrade_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('project', 'ops_project_head', network_upgrade_id, 'Network Upgrade Scope', 'Multi-site network infrastructure upgrade project with administrative access', 'Projects/Infrastructure/Network-Upgrade', 1, tenant_techcorp, false, ARRAY[0,1,2,3]::smallint[], '["project", "infrastructure", "network"]', '{"network_admin": true, "multi_site": true, "downtime_windows": true, "vendor_coordination": true}');
    END IF;

    -- Insert unified scopes for tasks (only if the task entities exist)

    SELECT id INTO db_migration_task_id FROM app.ops_task_head WHERE task_code = 'PM-DB-001' LIMIT 1;
    SELECT id INTO oauth_task_id FROM app.ops_task_head WHERE task_code = 'PM-API-002' LIMIT 1;
    SELECT id INTO unit_test_task_id FROM app.ops_task_head WHERE task_code = 'PM-TEST-003' LIMIT 1;

    IF db_migration_task_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('task', 'ops_task_head', db_migration_task_id, 'Database Migration Task Scope', 'Critical database migration task with full database access', 'Projects/Platform-Modernization/Database-Migration', 2, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["task", "database", "critical"]', '{"database_admin": true, "production_access": true, "backup_authority": true, "downtime_management": true}');
    END IF;

    IF oauth_task_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('task', 'ops_task_head', oauth_task_id, 'OAuth Implementation Task Scope', 'Authentication system implementation with security review access', 'Projects/Platform-Modernization/OAuth-Implementation', 2, tenant_techcorp, false, ARRAY[0,1,2,3,4]::smallint[], '["task", "security", "authentication"]', '{"security_review": true, "authentication_config": true, "token_management": true, "ssl_certificates": true}');
    END IF;

    IF unit_test_task_id IS NOT NULL THEN
        INSERT INTO app.d_scope_unified (scope_type, scope_reference_table_name, scope_id, scope_name, scope_descr, scope_path, scope_level_id, tenant_id, is_system_scope, resource_permission, tags, attr) 
        VALUES ('task', 'ops_task_head', unit_test_task_id, 'Unit Testing Task Scope', 'Quality assurance and testing task with testing framework access', 'Projects/Platform-Modernization/Unit-Testing', 2, tenant_techcorp, false, ARRAY[0,1,2]::smallint[], '["task", "testing", "quality"]', '{"test_environments": true, "coverage_reports": true, "automated_testing": true, "mock_data": true}');
    END IF;

END $$;



-- Performance indexes for unified scope system

-- Composite indexes for common query patterns

