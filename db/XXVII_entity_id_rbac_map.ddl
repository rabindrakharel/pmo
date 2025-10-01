-- ============================================================================
-- XX. ENTITY ID RBAC MAP - SIMPLIFIED RBAC SYSTEM
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Simplified Role-Based Access Control (RBAC) system using permission arrays
--   to manage user access to specific entity instances. Provides granular
--   permission control at the individual entity level with support for
--   hierarchical permission inheritance and delegation.
--
-- Entity Type: entity_id_rbac_map
-- Entity Classification: Permission Control Table (RBAC system core)
--
-- Permission Model:
--   Array-based permissions for flexibility and performance
--   Each employee can have different permission levels for different entities
--   Supports temporal permissions with expiration dates
--   Enables delegation and permission granting workflows
--
-- Permission Levels:
--   0 → View: Read access to entity data and details
--   1 → Edit: Modify existing entity data and properties
--   2 → Share: Share entity with other users and grant view permissions
--   3 → Delete: Remove or deactivate entity (soft delete)
--   4 → Create: Create new entities of this type
--
-- Special Permission Behaviors:
--   - entity_id = 'all' grants permissions to all instances of that entity type
--   - Create permission (4) with entity_id = 'all' allows creating new entities
--   - Hierarchical permissions: parent entity permissions may cascade to children
--   - Expiration support: permissions can have time limits for temporary access
--
-- Key Permission Patterns:
--   Create Project:
--     - Requires: entity = 'project', entity_id = 'all', permission array contains 4
--
--   Assign Project to Business:
--     - Requires: entity = 'project', entity_id = 'all', permission array contains 4
--     - AND: entity = 'biz', entity_id = <specific_business_id>, permission array contains 1
--
--   Delete Specific Task:
--     - Requires: entity = 'task', entity_id = <specific_task_id>, permission array contains 3
--
-- Integration with Entity System:
--   - Links to all entity types via entity field (office, biz, project, task, etc.)
--   - Supports both specific entity instances and 'all' permissions
--   - Works with entity_id_hierarchy_mapping for relationship-based permissions
--   - Integrates with role-based assignments via rel_emp_role
--
-- Audit and Compliance:
--   - Complete audit trail with granted_by_empid tracking
--   - Temporal tracking with granted_ts and expires_ts
--   - Permission history preservation for compliance requirements
--   - Delegation chain tracking for authorization reviews
--
-- UI Integration:
--   - Controls visibility of UI elements and actions
--   - Enables dynamic menu generation based on permissions
--   - Supports context-sensitive action buttons
--   - Provides authorization for API endpoints

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.entity_id_rbac_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core permission mapping
  empid uuid NOT NULL, -- References app.d_employee (via entity_id_hierarchy_mapping)
  entity varchar(50) NOT NULL, -- Entity type: office, biz, project, task, worksite, client, role, position, etc.
  entity_id text NOT NULL, -- Specific entity UUID or 'all' for type-level permissions
  permission integer[] NOT NULL DEFAULT '{}', -- Array: [0=View, 1=Edit, 2=Share, 3=Delete, 4=Create]

  -- Permission lifecycle management
  granted_by_empid uuid, -- Who granted this permission (delegation tracking)
  granted_ts timestamptz NOT NULL DEFAULT now(),
  expires_ts timestamptz, -- Optional expiration for temporary permissions
  active_flag boolean NOT NULL DEFAULT true,

  -- Standard temporal fields
  created_ts timestamptz NOT NULL DEFAULT now(),
  updated_ts timestamptz NOT NULL DEFAULT now()

  -- Business rules managed by application layer
);

-- Indexes removed for simplified import

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Huron Home Services RBAC Permission System
-- Comprehensive permission assignments following organizational hierarchy and operational needs

-- ==================== EXECUTIVE LEVEL PERMISSIONS ====================
-- CEO (James Miller) - Ultimate authority with full permissions to all entities
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid, granted_ts)
SELECT
  e.id, entity_type, 'all', ARRAY[0,1,2,3,4]::integer[], e.id, now()
FROM app.d_employee e
CROSS JOIN (VALUES
  ('office'), ('biz'), ('business'), ('project'), ('task'), ('worksite'), ('client'),
  ('role'), ('position'), ('artifact'), ('wiki'), ('form'), ('report'), ('employee'),
  ('org'), ('hr')
) AS entities(entity_type)
WHERE e.email = 'james.miller@huronhome.ca';

-- C-Level Executives - Strategic oversight with create/edit permissions
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('biz', '{0,1,2,4}'),           -- Business units management
  ('project', '{0,1,2,4}'),       -- Project oversight
  ('task', '{0,1,2}'),            -- Task visibility
  ('worksite', '{0,1,2,4}'),      -- Worksite management
  ('client', '{0,1,2,4}'),        -- Client relationship management
  ('employee', '{0,1,2}'),        -- Employee information
  ('role', '{0,1,2,4}'),          -- Role management
  ('position', '{0,1,2,4}'),      -- Position structure
  ('artifact', '{0,1,2,4}'),      -- Document management
  ('wiki', '{0,1,2,4}'),          -- Knowledge management
  ('form', '{0,1,2}'),            -- Form access
  ('report', '{0,1,2,4}')         -- Report generation
) AS perms(entity_type, permissions)
WHERE e.email IN ('sarah.chen@huronhome.ca', 'david.kumar@huronhome.ca', 'maria.rodriguez@huronhome.ca');

-- ==================== SENIOR MANAGEMENT PERMISSIONS ====================
-- SVP (Robert Thompson) - Multi-division operational authority
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('project', '{0,1,2,4}'),       -- Project management authority
  ('task', '{0,1,2,4}'),          -- Task management
  ('worksite', '{0,1,2}'),        -- Worksite oversight
  ('client', '{0,1,2}'),          -- Client relationship oversight
  ('employee', '{0,1}'),          -- Employee management
  ('artifact', '{0,1,2,4}'),      -- Document creation
  ('wiki', '{0,1,2,4}'),          -- Knowledge management
  ('form', '{0,1,2}'),            -- Form processing
  ('report', '{0,1,2}')           -- Report access
) AS perms(entity_type, permissions)
WHERE e.email = 'robert.thompson@huronhome.ca';

-- VP Human Resources (Lisa Wang) - HR-specific permissions
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('employee', '{0,1,2,4}'),      -- Full employee management
  ('role', '{0,1,2,4}'),          -- Role definition and assignment
  ('position', '{0,1,2,4}'),      -- Position structure management
  ('project', '{0}'),             -- Project visibility for HR oversight
  ('task', '{0}'),                -- Task visibility for workload analysis
  ('form', '{0,1,2,4}'),          -- HR forms management
  ('artifact', '{0,1,2,4}'),      -- HR documentation
  ('wiki', '{0,1,2,4}'),          -- HR knowledge base
  ('report', '{0,1,2,4}')         -- HR analytics and reporting
) AS perms(entity_type, permissions)
WHERE e.email = 'lisa.wang@huronhome.ca';

-- Directors - Departmental management permissions
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('project', '{0,1,2,4}'),       -- Project management within department
  ('task', '{0,1,2,4}'),          -- Task management
  ('employee', '{0,1}'),          -- Team member oversight
  ('client', '{0,1}'),            -- Client interaction
  ('artifact', '{0,1,2,4}'),      -- Department documentation
  ('wiki', '{0,1,2,4}'),          -- Knowledge management
  ('form', '{0,1,2}'),            -- Form processing
  ('report', '{0,1,2}')           -- Department reporting
) AS perms(entity_type, permissions)
WHERE e.email IN ('michael.oconnor@huronhome.ca', 'jennifer.park@huronhome.ca');

-- ==================== OPERATIONAL MANAGEMENT PERMISSIONS ====================
-- Department Managers - Service line management
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'robert.thompson@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('project', '{0,1,2,4}'),       -- Project management in their domain
  ('task', '{0,1,2,4}'),          -- Full task management
  ('worksite', '{0,1,2,4}'),      -- Worksite management for their projects
  ('client', '{0,1,2}'),          -- Client service management
  ('employee', '{0,1}'),          -- Team management
  ('artifact', '{0,1,2,4}'),      -- Project documentation
  ('wiki', '{0,1,2,4}'),          -- Technical knowledge base
  ('form', '{0,1,2}'),            -- Service forms
  ('report', '{0,1,2}')           -- Operational reporting
) AS perms(entity_type, permissions)
WHERE e.email IN (
  'carlos.martinez@huronhome.ca',  -- Landscaping Manager
  'david.kowalski@huronhome.ca',   -- Snow Removal Manager
  'amanda.foster@huronhome.ca',    -- HVAC Manager
  'tony.ricci@huronhome.ca',       -- Plumbing Manager
  'sarah.kim@huronhome.ca'         -- Solar Energy Manager
);

-- ==================== FIELD SUPERVISION PERMISSIONS ====================
-- Field Supervisors - Operational oversight and crew management
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'carlos.martinez@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('task', '{0,1,2,4}'),          -- Full task management for field operations
  ('worksite', '{0,1}'),          -- Worksite updates and status
  ('client', '{0,1}'),            -- Client interaction and updates
  ('artifact', '{0,1,2}'),        -- Field documentation
  ('form', '{0,1,2,4}'),          -- Service and safety forms
  ('report', '{0,1}')             -- Field reporting
) AS perms(entity_type, permissions)
WHERE e.email IN ('mark.thompson@huronhome.ca', 'rachel.green@huronhome.ca');

-- ==================== TECHNICAL STAFF PERMISSIONS ====================
-- Senior Technicians - Technical leadership and mentoring
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'mark.thompson@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('task', '{0,1,2}'),            -- Task execution and updates
  ('worksite', '{0,1}'),          -- Worksite status updates
  ('client', '{0,1}'),            -- Customer service interaction
  ('artifact', '{0,1,2}'),        -- Technical documentation
  ('wiki', '{0,1,2}'),            -- Technical knowledge sharing
  ('form', '{0,1,2}'),            -- Technical and safety forms
  ('report', '{0,1}')             -- Work completion reporting
) AS perms(entity_type, permissions)
WHERE e.email IN ('james.wilson@huronhome.ca', 'maria.santos@huronhome.ca', 'kevin.chang@huronhome.ca');

-- Field Technicians - Service delivery and customer interaction
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'mark.thompson@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('task', '{0,1}'),              -- Assigned task execution
  ('worksite', '{0,1}'),          -- Worksite status updates
  ('client', '{0}'),              -- Customer information access
  ('form', '{0,1,2}'),            -- Service completion forms
  ('report', '{0,1}')             -- Work reporting
) AS perms(entity_type, permissions)
WHERE e.email IN ('james.wilson@huronhome.ca', 'maria.santos@huronhome.ca', 'kevin.chang@huronhome.ca');

-- ==================== ADMINISTRATIVE STAFF PERMISSIONS ====================
-- Project Coordinator - Project support and coordination
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'robert.thompson@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('project', '{0,1,2}'),         -- Project coordination and updates
  ('task', '{0,1,2,4}'),          -- Task scheduling and management
  ('client', '{0,1}'),            -- Client communication
  ('artifact', '{0,1,2,4}'),      -- Project documentation
  ('form', '{0,1,2}'),            -- Administrative forms
  ('report', '{0,1}')             -- Project reporting
) AS perms(entity_type, permissions)
WHERE e.email = 'catherine.brooks@huronhome.ca';

-- Financial Analyst - Financial data and reporting access
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'michael.oconnor@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('project', '{0}'),             -- Project financial visibility
  ('client', '{0}'),              -- Client financial information
  ('biz', '{0}'),                 -- Business unit financial data
  ('artifact', '{0,1,2,4}'),      -- Financial documentation
  ('report', '{0,1,2,4}'),        -- Financial reporting
  ('form', '{0,1}')               -- Financial forms
) AS perms(entity_type, permissions)
WHERE e.email = 'daniel.lee@huronhome.ca';

-- HR Coordinator - HR administration and support
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'lisa.wang@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('employee', '{0,1,2}'),        -- Employee data management
  ('role', '{0,1}'),              -- Role assignment support
  ('position', '{0,1}'),          -- Position management support
  ('artifact', '{0,1,2,4}'),      -- HR documentation
  ('form', '{0,1,2,4}'),          -- HR forms processing
  ('report', '{0,1}')             -- HR reporting support
) AS perms(entity_type, permissions)
WHERE e.email = 'sophie.dubois@huronhome.ca';

-- IT Administrator - System administration and support
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'jennifer.park@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('employee', '{0}'),            -- User account information
  ('artifact', '{0,1,2,4}'),      -- Technical documentation
  ('wiki', '{0,1,2,4}'),          -- IT knowledge base
  ('form', '{0,1}'),              -- IT support forms
  ('report', '{0,1,2}')           -- System reporting
) AS perms(entity_type, permissions)
WHERE e.email = 'alex.johnson@huronhome.ca';

-- ==================== SEASONAL AND PART-TIME PERMISSIONS ====================
-- Seasonal Workers - Limited operational access
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'mark.thompson@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('task', '{0,1}'),              -- Assigned task access
  ('worksite', '{0}'),            -- Worksite information
  ('form', '{0,1}'),              -- Basic service forms
  ('wiki', '{0}')                 -- Safety and procedure information
) AS perms(entity_type, permissions)
WHERE e.email IN ('tyler.murphy@huronhome.ca', 'emma.wilson@huronhome.ca');

-- Part-time Support - Basic administrative access
INSERT INTO app.entity_id_rbac_map (empid, entity, entity_id, permission, granted_by_empid)
SELECT
  e.id, entity_type, 'all', permissions::integer[],
  (SELECT id FROM app.d_employee WHERE email = 'catherine.brooks@huronhome.ca')
FROM app.d_employee e
CROSS JOIN (VALUES
  ('form', '{0,1}'),              -- Basic form processing
  ('wiki', '{0}'),                -- General information access
  ('report', '{0}')               -- Basic reporting access
) AS perms(entity_type, permissions)
WHERE e.email = 'jake.patterson@huronhome.ca';

-- ==================== ENTITY-SPECIFIC PERMISSIONS ====================
-- Grant specific project permissions to project managers (when projects have specific managers assigned)
-- This would be populated by application logic when projects are assigned to specific managers

-- Grant specific worksite permissions to site managers
-- This would be populated when worksites are assigned to specific site managers

-- Grant specific client permissions to account managers
-- This would be populated when clients are assigned to specific account managers

-- These entity-specific permissions would typically be managed through the application
-- rather than static DDL, as they change frequently based on business assignments

COMMENT ON TABLE app.entity_id_rbac_map IS 'Simplified RBAC system with permission arrays: 0=View, 1=Edit, 2=Share, 3=Delete, 4=Create. Supports entity_id="all" for type-level permissions and specific UUIDs for instance-level permissions.';