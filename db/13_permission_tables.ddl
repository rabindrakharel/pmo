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
-- 1. Unified Scope Table: Single scope reference table for all scope types
-- 2. Employee-Scope Permissions: Employee → Scope → Resource → Permission Array
-- 3. Role-based inheritance through rel_emp_role table
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

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

-- Unified scope reference table to consolidate all scope types
CREATE TABLE app.d_scope_unified (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope identification
  scope_type text NOT NULL, -- 'business', 'location', 'worksite', 'hr'
  scope_name text NOT NULL,
  scope_reference_id uuid NOT NULL, -- References the actual scope table record
  
  -- Hierarchy support
  parent_scope_id uuid REFERENCES app.d_scope_unified(id),
  
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
  
  UNIQUE(scope_type, scope_reference_id, active)
);

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

-- First, populate the unified scope table with references to existing scope tables
INSERT INTO app.d_scope_unified (scope_type, scope_name, scope_reference_id, name, descr, tags, attr)
SELECT 
  'business' as scope_type,
  name as scope_name,
  id as scope_reference_id,
  name,
  "descr",
  tags,
  attr
FROM app.d_scope_business
WHERE active = true

UNION ALL

SELECT 
  'location' as scope_type,
  name as scope_name,
  id as scope_reference_id,
  name,
  "descr",
  tags,
  attr
FROM app.d_scope_location
WHERE active = true

UNION ALL

SELECT 
  'worksite' as scope_type,
  name as scope_name,
  id as scope_reference_id,
  name,
  "descr",
  tags,
  attr
FROM app.d_scope_worksite
WHERE active = true

UNION ALL

SELECT 
  'hr' as scope_type,
  name as scope_name,
  id as scope_reference_id,
  name,
  "descr",
  tags,
  attr
FROM app.d_scope_hr
WHERE active = true;

-- Now insert synthetic permission data for James Miller and other key employees
-- James Miller (CEO) - Full organizational access
INSERT INTO app.rel_employee_scope_unified (emp_id, scope_id, resource_type, resource_id, resource_permission, name, descr, tags, attr) VALUES

-- James Miller CEO Permissions
-- Business scope - full access across all departments
((SELECT id FROM app.d_employee WHERE name = 'James Miller'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Huron Home Services'),
 'business', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'CEO Full Business Access', 'Complete organizational authority across all business operations', 
 '["ceo", "executive", "full-access"]'::jsonb, 
 '{"executive_authority": true, "budget_approval": 10000000, "strategic_oversight": true}'::jsonb),

-- Project scope - full project lifecycle management
((SELECT id FROM app.d_employee WHERE name = 'James Miller'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Huron Home Services'),
 'project', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'CEO Project Oversight Authority', 'Executive oversight for all company projects and strategic initiatives', 
 '["project-executive", "strategic-oversight"]'::jsonb, 
 '{"project_oversight": true, "portfolio_management": true, "executive_approval": true}'::jsonb),

-- HR scope - full human resources authority
((SELECT id FROM app.d_employee WHERE name = 'James Miller'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_hr sh ON su.scope_reference_id = sh.id WHERE sh.name = 'CEO Office'),
 'hr', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'CEO Human Resources Authority', 'Complete HR authority for hiring, performance, and organizational structure', 
 '["hr-executive", "organizational-authority"]'::jsonb, 
 '{"hr_authority": true, "hiring_approval": true, "compensation_authority": true}'::jsonb),

-- Location scope - access to all operational locations
((SELECT id FROM app.d_employee WHERE name = 'James Miller'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_location sl ON su.scope_reference_id = sl.id WHERE sl.name = 'Greater Toronto Area'),
 'location', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'CEO GTA Operations Authority', 'Executive authority over Greater Toronto Area operations and facilities', 
 '["location-executive", "operations"]'::jsonb, 
 '{"operational_authority": true, "facility_management": true, "regional_oversight": true}'::jsonb),

-- Worksite scope - oversight of all operational worksites
((SELECT id FROM app.d_employee WHERE name = 'James Miller'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_worksite sw ON su.scope_reference_id = sw.id WHERE sw.name = 'Huron Home Services HQ'),
 'worksite', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'CEO Headquarters Authority', 'Executive authority over headquarters operations and strategic coordination', 
 '["worksite-executive", "headquarters"]'::jsonb, 
 '{"headquarters_authority": true, "strategic_coordination": true}'::jsonb),

-- App scope - full system administration access
((SELECT id FROM app.d_employee WHERE name = 'James Miller'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Huron Home Services'),
 'app', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'CEO System Administration Access', 'Complete system access for executive oversight and administrative functions', 
 '["system-admin", "executive-access"]'::jsonb, 
 '{"system_admin": true, "executive_dashboard": true, "full_access": true}'::jsonb),

-- Sarah Chen (Operations Director) Permissions
-- Business operations management
((SELECT id FROM app.d_employee WHERE name = 'Sarah Chen'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Business Operations Division'),
 'business', NULL, ARRAY[0,1,2,3]::smallint[], 
 'Operations Director Business Authority', 'Business operations management across all service divisions', 
 '["operations-director", "management"]'::jsonb, 
 '{"operations_management": true, "team_leadership": true, "process_optimization": true}'::jsonb),

-- Project management authority
((SELECT id FROM app.d_employee WHERE name = 'Sarah Chen'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Business Operations Division'),
 'project', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'Operations Project Management', 'Project management authority for operational improvements and service delivery', 
 '["project-manager", "operations"]'::jsonb, 
 '{"project_management": true, "operational_projects": true, "team_coordination": true}'::jsonb),

-- Task management across departments
((SELECT id FROM app.d_employee WHERE name = 'Sarah Chen'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Business Operations Division'),
 'task', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'Operations Task Coordination', 'Task management and coordination across landscaping, plumbing, HVAC, and electrical departments', 
 '["task-coordinator", "operations"]'::jsonb, 
 '{"task_coordination": true, "department_oversight": true, "quality_control": true}'::jsonb),

-- Robert Thompson (Landscaping Manager) Permissions
-- Landscaping department management
((SELECT id FROM app.d_employee WHERE name = 'Robert Thompson'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Landscaping Department'),
 'business', NULL, ARRAY[0,1,2,3]::smallint[], 
 'Landscaping Department Management', 'Complete management authority for landscaping operations and team', 
 '["department-manager", "landscaping"]'::jsonb, 
 '{"department_management": true, "team_leadership": true, "seasonal_planning": true}'::jsonb),

-- Landscaping project authority
((SELECT id FROM app.d_employee WHERE name = 'Robert Thompson'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Landscaping Department'),
 'project', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'Landscaping Project Leadership', 'Project management for landscaping contracts and seasonal operations', 
 '["project-manager", "landscaping"]'::jsonb, 
 '{"landscaping_projects": true, "seasonal_operations": true, "contractor_coordination": true}'::jsonb),

-- HR management for landscaping team
((SELECT id FROM app.d_employee WHERE name = 'Robert Thompson'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Landscaping Department'),
 'hr', NULL, ARRAY[0,1,2]::smallint[], 
 'Landscaping Team HR Authority', 'HR management for landscaping department including seasonal staff coordination', 
 '["hr-manager", "landscaping"]'::jsonb, 
 '{"team_management": true, "seasonal_hiring": true, "performance_management": true}'::jsonb),

-- Michael O'Brien (Master Plumber Manager) Permissions
-- Plumbing department full management
((SELECT id FROM app.d_employee WHERE name = 'Michael O''Brien'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Plumbing Department'),
 'business', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'Master Plumber Department Authority', 'Complete plumbing department management including emergency services', 
 '["master-plumber", "department-manager"]'::jsonb, 
 '{"master_plumber_license": "MP-5547-ON", "emergency_authority": true, "code_compliance": true}'::jsonb),

-- Emergency response project management
((SELECT id FROM app.d_employee WHERE name = 'Michael O''Brien'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_worksite sw ON su.scope_reference_id = sw.id WHERE sw.name = 'Emergency Response - Mobile'),
 'project', NULL, ARRAY[0,1,2,3,4]::smallint[], 
 'Emergency Plumbing Project Authority', 'Emergency response project coordination and 24/7 service management', 
 '["emergency-manager", "mobile-services"]'::jsonb, 
 '{"emergency_response": true, "24_7_coordination": true, "mobile_operations": true}'::jsonb),

-- Emma Foster (Customer Service) Permissions
-- Customer service operations
((SELECT id FROM app.d_employee WHERE name = 'Emma Foster'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Customer Service Department'),
 'business', NULL, ARRAY[0,1,2]::smallint[], 
 'Customer Service Operations', 'Customer service operations including appointment scheduling and billing support', 
 '["customer-service", "operations"]'::jsonb, 
 '{"customer_service": true, "appointment_scheduling": true, "billing_support": true}'::jsonb),

-- App access for customer service functions
((SELECT id FROM app.d_employee WHERE name = 'Emma Foster'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Customer Service Department'),
 'app', NULL, ARRAY[0,1]::smallint[], 
 'Customer Service App Access', 'Application access for customer service functions and scheduling system', 
 '["app-user", "customer-service"]'::jsonb, 
 '{"scheduling_system": true, "customer_portal": true, "billing_system": true}'::jsonb),

-- Lisa Rodriguez (HVAC Technician) Permissions
-- HVAC technical operations
((SELECT id FROM app.d_employee WHERE name = 'Lisa Rodriguez'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Heating Department'),
 'business', NULL, ARRAY[0,1,2]::smallint[], 
 'HVAC Technical Operations', 'HVAC installation and maintenance operations authority', 
 '["hvac-technician", "technical"]'::jsonb, 
 '{"hvac_certified": true, "gas_license": "GT2-5523-ON", "energy_efficiency": true}'::jsonb),

-- HVAC task management
((SELECT id FROM app.d_employee WHERE name = 'Lisa Rodriguez'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Heating Department'),
 'task', NULL, ARRAY[0,1,2,3]::smallint[], 
 'HVAC Task Management', 'Task management for HVAC installations, maintenance, and energy efficiency projects', 
 '["task-manager", "hvac"]'::jsonb, 
 '{"task_management": true, "installation_projects": true, "maintenance_scheduling": true}'::jsonb),

-- John MacLeod (Licensed Electrician) Permissions
-- Electrical operations authority
((SELECT id FROM app.d_employee WHERE name = 'John MacLeod'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Electrical Department'),
 'business', NULL, ARRAY[0,1,2,3]::smallint[], 
 'Master Electrician Operations', 'Licensed electrical operations including panel upgrades and safety inspections', 
 '["master-electrician", "licensed"]'::jsonb, 
 '{"master_electrician": true, "esa_license": "ME-7845-ON", "safety_inspections": true}'::jsonb),

-- Electrical project management
((SELECT id FROM app.d_employee WHERE name = 'John MacLeod'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Electrical Department'),
 'project', NULL, ARRAY[0,1,2,3]::smallint[], 
 'Electrical Project Authority', 'Project management for electrical installations and code compliance work', 
 '["project-manager", "electrical"]'::jsonb, 
 '{"electrical_projects": true, "code_compliance": true, "safety_oversight": true}'::jsonb),

-- Ahmed Hassan (Solar Technician) Permissions
-- Solar installation operations
((SELECT id FROM app.d_employee WHERE name = 'Ahmed Hassan'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Solar Installation Department'),
 'business', NULL, ARRAY[0,1,2]::smallint[], 
 'Solar Installation Operations', 'Solar panel installation and maintenance operations authority', 
 '["solar-technician", "certified"]'::jsonb, 
 '{"solar_certified": true, "nabcep_certified": true, "installations_completed": 150}'::jsonb),

-- Solar worksite access
((SELECT id FROM app.d_employee WHERE name = 'Ahmed Hassan'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_worksite sw ON su.scope_reference_id = sw.id WHERE sw.name = 'Solar Install - 1847 Sheridan Park Dr'),
 'worksite', NULL, ARRAY[0,1,2,3]::smallint[], 
 'Solar Installation Worksite Authority', 'Worksite management for solar installation projects and system commissioning', 
 '["worksite-manager", "solar"]'::jsonb, 
 '{"solar_installations": true, "system_commissioning": true, "warranty_specialist": true}'::jsonb),

-- Frank Kowalski (Snow Removal) Permissions - Seasonal access
-- Snow removal operations (seasonal)
((SELECT id FROM app.d_employee WHERE name = 'Frank Kowalski'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Snow Removal Department'),
 'business', NULL, ARRAY[0,1,2]::smallint[], 
 'Seasonal Snow Removal Operations', 'Winter operations management for snow removal and ice control services', 
 '["snow-removal", "seasonal", "equipment-operator"]'::jsonb, 
 '{"seasonal_worker": true, "equipment_certified": ["plow_truck", "salt_spreader"], "winter_operations": true}'::jsonb),

-- Winter operations worksite
((SELECT id FROM app.d_employee WHERE name = 'Frank Kowalski'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_worksite sw ON su.scope_reference_id = sw.id WHERE sw.name = 'Winter Ops - Equipment Staging'),
 'worksite', NULL, ARRAY[0,1,2]::smallint[], 
 'Winter Operations Equipment Authority', 'Equipment staging and winter operations coordination authority', 
 '["equipment-operator", "winter-ops"]'::jsonb, 
 '{"equipment_authority": true, "staging_operations": true, "emergency_response": true}'::jsonb),

-- Jessica Park (Co-op Student) Permissions - Limited access
-- Environmental project support
((SELECT id FROM app.d_employee WHERE name = 'Jessica Park'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Business Operations Division'),
 'project', NULL, ARRAY[0,1]::smallint[], 
 'Co-op Environmental Project Support', 'Environmental engineering project support and sustainability research', 
 '["co-op-student", "environmental"]'::jsonb, 
 '{"co_op_student": true, "environmental_focus": true, "academic_program": "Environmental Engineering"}'::jsonb),

-- Limited app access for data collection
((SELECT id FROM app.d_employee WHERE name = 'Jessica Park'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Business Operations Division'),
 'app', NULL, ARRAY[0]::smallint[], 
 'Co-op Student App Access', 'Limited application access for data collection and reporting functions', 
 '["app-user", "co-op", "read-only"]'::jsonb, 
 '{"read_only_access": true, "data_collection": true, "reporting_tools": true}'::jsonb),

-- Ryan Kim (Marketing Intern) Permissions - Limited marketing access
-- Marketing support access
((SELECT id FROM app.d_employee WHERE name = 'Ryan Kim'),
 (SELECT su.id FROM app.d_scope_unified su JOIN app.d_scope_business sb ON su.scope_reference_id = sb.id WHERE sb.name = 'Customer Service Department'),
 'business', NULL, ARRAY[0,1]::smallint[], 
 'Marketing Intern Support Access', 'Marketing campaign support and customer engagement initiatives', 
 '["marketing-intern", "student"]'::jsonb, 
 '{"intern": true, "marketing_focus": true, "academic_program": "Business Marketing"}'::jsonb);