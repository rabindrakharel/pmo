-- ============================================================================
-- ENTITY ID RBAC MAP - PERMISSION CONTROL SYSTEM
-- ============================================================================
--
-- SEMANTICS:
-- Row-level RBAC system controlling employee access to entity instances using permission arrays.
-- Supports type-level ('all') and instance-level (specific UUID) permissions with temporal expiration.
-- Foundation for API authorization: every request checks empid permissions against entity/entity_id.
--
-- PERMISSION ARRAY MODEL:
--   [0] = View:   Read access to entity data
--   [1] = Edit:   Modify existing entity
--   [2] = Share:  Share entity with others
--   [3] = Delete: Soft delete entity
--   [4] = Create: Create new entities (requires entity_id='all')
--
-- DATABASE BEHAVIOR:
-- • GRANT TYPE-LEVEL PERMISSION: entity_id='all' grants access to ALL instances
--   Example: INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
--            VALUES ('8260b1b0-...', 'project', 'all', ARRAY[0,1,2,3,4])
--            → James Miller can view/edit/share/delete/create ALL projects
--
-- • GRANT INSTANCE-LEVEL PERMISSION: entity_id={uuid} grants access to specific instance
--   Example: INSERT INTO entity_id_rbac_map (empid, entity, entity_id, permission)
--            VALUES ('john-uuid', 'project', '93106ffb-...', ARRAY[0,1])
--            → John can view/edit ONLY project 93106ffb-...
--
-- • CHECK PERMISSION: Query for empid + entity, matching 'all' OR specific entity_id
--   Example: SELECT * FROM entity_id_rbac_map
--            WHERE empid = '8260b1b0-...' AND entity = 'project'
--              AND (entity_id = 'all' OR entity_id = '93106ffb-...')
--              AND 0 = ANY(permission)  -- Check View permission
--
-- • REVOKE PERMISSION: Soft delete or UPDATE active_flag=false
--   Example: UPDATE entity_id_rbac_map SET active_flag = false
--            WHERE empid = 'john-uuid' AND entity_id = '93106ffb-...'
--
-- KEY FIELDS:
-- • id: uuid PRIMARY KEY
-- • empid: uuid NOT NULL (references d_employee.id - RBAC identity)
-- • entity: varchar(50) NOT NULL ('project', 'task', 'employee', 'biz', 'office', ...)
-- • entity_id: text NOT NULL ('all' for type-level OR specific UUID for instance-level)
-- • permission: integer[] NOT NULL (array: [0,1,2,3,4] or subset like [0,1])
-- • granted_by_empid: uuid (delegation tracking)
-- • expires_ts: timestamptz (optional expiration for temporary permissions)
-- • active_flag: boolean DEFAULT true
--
-- PERMISSION PATTERNS:
-- • Create Project: entity='project', entity_id='all', permission contains 4
-- • Edit Specific Task: entity='task', entity_id={task_uuid}, permission contains 1
-- • Assign Task to Project: entity='project', entity_id={project_uuid}, permission contains 1
--                            AND entity='task', entity_id='all', permission contains 4
--
-- AUTHORIZATION FLOW:
-- 1. User requests API operation (e.g., PUT /api/v1/project/{id})
-- 2. Middleware extracts empid from JWT (sub claim)
-- 3. API checks entity_id_rbac_map:
--    WHERE empid={JWT.sub} AND entity='project' AND (entity_id='all' OR entity_id={id})
-- 4. Verify required permission (1=Edit) exists in permission array
-- 5. Allow/deny based on result
--
-- PARENT-CHILD PERMISSION NOTES:
-- • Creating child requires: parent edit (1) + child create (4)
-- • Example: Create task under project needs:
--   - entity='project', entity_id={project_uuid}, permission contains 1
--   - entity='task', entity_id='all', permission contains 4
-- • Permissions do NOT cascade automatically
--
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
  ('office'), ('biz'), ('business'), ('project'), ('task'), ('worksite'), ('cust'),
  ('role'), ('position'), ('artifact'), ('wiki'), ('form'), ('report'), ('employee'),
  ('org'), ('hr'), ('linkage'), ('marketing'), ('cost'), ('revenue'),
  ('service'), ('product'), ('quote'), ('work_order')
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
  ('cust', '{0,1,2,4}'),          -- Customer relationship management
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
  ('cust', '{0,1,2}'),            -- Customer relationship oversight
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
  ('cust', '{0,1}'),              -- Customer interaction
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
  ('cust', '{0,1,2}'),            -- Customer service management
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
  ('cust', '{0,1}'),              -- Customer interaction and updates
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
  ('cust', '{0}'),                -- Customer information access
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
  ('cust', '{0,1}'),              -- Customer communication
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
  ('cust', '{0}'),                -- Customer financial information
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