-- ============================================================================
-- PMO Database Schema - Page Permissions Update
-- Add new comprehensive pages and permissions for the modern UI system
-- ============================================================================

-- Clear existing page permissions (we'll recreate them)
DELETE FROM app.rel_user_scope WHERE scope_type = 'app' AND scope_name LIKE '%Access';
DELETE FROM app.rel_scope_permission WHERE scope_type = 'app' AND name LIKE '%Access';

-- Clear existing route pages
DELETE FROM app.rel_route_component;
DELETE FROM app.app_scope_d_route_page;

-- ============================================================================
-- COMPREHENSIVE ROUTE PAGES
-- ============================================================================

INSERT INTO app.app_scope_d_route_page (name, "descr", route_path, component_name, is_protected, required_permissions, tags) VALUES
-- Dashboard & Overview
('Dashboard', 'Main application dashboard with overview and quick actions', '/dashboard', 'DashboardPage', true, '["VIEW_DASHBOARD", "VIEW_PROJECTS"]'::jsonb, '["core", "overview"]'::jsonb),

-- Project Management
('Projects List', 'Browse and manage all projects', '/projects', 'ProjectsPage', true, '["VIEW_PROJECTS"]'::jsonb, '["projects", "list"]'::jsonb),
('Project Details', 'View detailed project information and manage project tasks', '/projects/:id', 'ProjectDetailPage', true, '["VIEW_PROJECTS"]'::jsonb, '["projects", "details"]'::jsonb),
('Project Create', 'Create new project', '/projects/new', 'ProjectCreatePage', true, '["CREATE_PROJECTS"]'::jsonb, '["projects", "create"]'::jsonb),

-- Task Management
('Tasks Board', 'Kanban-style task management board', '/tasks', 'TasksPage', true, '["VIEW_TASKS"]'::jsonb, '["tasks", "board"]'::jsonb),
('Task Details', 'View and edit detailed task information', '/tasks/:id', 'TaskDetailPage', true, '["VIEW_TASKS"]'::jsonb, '["tasks", "details"]'::jsonb),
('Task Create', 'Create new task', '/tasks/new', 'TaskCreatePage', true, '["CREATE_TASKS"]'::jsonb, '["tasks", "create"]'::jsonb),

-- Entity Management
('Employees', 'Employee directory and management', '/employees', 'EmployeeManagementPage', true, '["VIEW_EMPLOYEES"]'::jsonb, '["employees", "list"]'::jsonb),
('Clients', 'Client management and contact information', '/clients', 'ClientManagementPage', true, '["VIEW_CLIENTS"]'::jsonb, '["clients", "list"]'::jsonb),
('Worksites', 'Physical worksite locations and management', '/worksites', 'WorksiteManagementPage', true, '["VIEW_WORKSITES"]'::jsonb, '["worksites", "list"]'::jsonb),

-- Hierarchical Management
('Locations', 'Geographic location hierarchy management', '/admin/locations', 'LocationManagementPage', true, '["VIEW_LOCATIONS", "ADMIN_ACCESS"]'::jsonb, '["admin", "locations"]'::jsonb),
('Business Units', 'Business organizational hierarchy', '/admin/businesses', 'BusinessManagementPage', true, '["VIEW_BUSINESS", "ADMIN_ACCESS"]'::jsonb, '["admin", "business"]'::jsonb),
('HR Departments', 'Human resources hierarchy and departments', '/admin/hr', 'HrManagementPage', true, '["VIEW_HR", "ADMIN_ACCESS"]'::jsonb, '["admin", "hr"]'::jsonb),

-- Administration
('Admin Dashboard', 'System administration overview', '/admin', 'AdminPage', true, '["ADMIN_ACCESS"]'::jsonb, '["admin", "dashboard"]'::jsonb),
('Role Management', 'Manage user roles and permissions', '/admin/roles', 'RoleManagementPage', true, '["MANAGE_ROLES", "ADMIN_ACCESS"]'::jsonb, '["admin", "roles"]'::jsonb),
('Meta Configuration', 'System metadata and configuration', '/admin/meta', 'MetaConfigPage', true, '["SYSTEM_CONFIG", "ADMIN_ACCESS"]'::jsonb, '["admin", "meta"]'::jsonb),

-- User Management
('User Profile', 'Personal user profile and preferences', '/profile', 'ProfilePage', true, '["VIEW_PROFILE"]'::jsonb, '["user", "profile"]'::jsonb),
('Settings', 'Application settings and preferences', '/settings', 'SettingsPage', true, '["VIEW_SETTINGS"]'::jsonb, '["user", "settings"]'::jsonb),

-- Reports & Analytics
('Reports', 'Reports and analytics dashboard', '/reports', 'ReportsPage', true, '["VIEW_REPORTS"]'::jsonb, '["reports", "analytics"]'::jsonb),
('Project Reports', 'Project-specific reporting and analytics', '/reports/projects', 'ProjectReportsPage', true, '["VIEW_REPORTS", "VIEW_PROJECTS"]'::jsonb, '["reports", "projects"]'::jsonb),
('Task Reports', 'Task analytics and performance reports', '/reports/tasks', 'TaskReportsPage', true, '["VIEW_REPORTS", "VIEW_TASKS"]'::jsonb, '["reports", "tasks"]'::jsonb),

-- Authentication
('Login', 'User authentication and login', '/login', 'LoginPage', false, '[]'::jsonb, '["auth", "public"]'::jsonb),
('Logout', 'User logout and session termination', '/logout', 'LogoutPage', false, '[]'::jsonb, '["auth", "public"]'::jsonb);

-- ============================================================================
-- COMPREHENSIVE SCOPE PERMISSIONS
-- ============================================================================

INSERT INTO app.rel_scope_permission (scope_type, name, "descr", scope_id, tags) VALUES
-- Application-wide permissions
('app', 'Dashboard Access', 'Access to main dashboard and overview', NULL, '["VIEW_DASHBOARD", "VIEW_PROJECTS", "VIEW_TASKS"]'::jsonb),
('app', 'Projects Full Access', 'Complete project management access', NULL, '["VIEW_PROJECTS", "CREATE_PROJECTS", "MODIFY_PROJECTS", "DELETE_PROJECTS", "SHARE_PROJECTS"]'::jsonb),
('app', 'Projects Read Access', 'Read-only project access', NULL, '["VIEW_PROJECTS"]'::jsonb),
('app', 'Tasks Full Access', 'Complete task management access', NULL, '["VIEW_TASKS", "CREATE_TASKS", "MODIFY_TASKS", "DELETE_TASKS", "MOVE_TASKS"]'::jsonb),
('app', 'Tasks Worker Access', 'Standard task worker permissions', NULL, '["VIEW_TASKS", "MODIFY_TASKS", "CREATE_TASK_LOGS"]'::jsonb),
('app', 'Employees Access', 'Employee directory and management', NULL, '["VIEW_EMPLOYEES", "CREATE_EMPLOYEES", "MODIFY_EMPLOYEES"]'::jsonb),
('app', 'Clients Access', 'Client management permissions', NULL, '["VIEW_CLIENTS", "CREATE_CLIENTS", "MODIFY_CLIENTS"]'::jsonb),
('app', 'Worksites Access', 'Worksite management permissions', NULL, '["VIEW_WORKSITES", "CREATE_WORKSITES", "MODIFY_WORKSITES"]'::jsonb),
('app', 'Reports Access', 'Reporting and analytics access', NULL, '["VIEW_REPORTS", "GENERATE_REPORTS", "EXPORT_REPORTS"]'::jsonb),
('app', 'User Profile Access', 'Personal profile management', NULL, '["VIEW_PROFILE", "MODIFY_PROFILE"]'::jsonb),
('app', 'Settings Access', 'Application settings access', NULL, '["VIEW_SETTINGS", "MODIFY_SETTINGS"]'::jsonb),

-- Administrative permissions
('app', 'Admin Access', 'System administration access', NULL, '["ADMIN_ACCESS", "SYSTEM_CONFIG"]'::jsonb),
('app', 'Locations Admin', 'Location hierarchy administration', NULL, '["VIEW_LOCATIONS", "CREATE_LOCATIONS", "MODIFY_LOCATIONS", "DELETE_LOCATIONS", "ADMIN_ACCESS"]'::jsonb),
('app', 'Business Admin', 'Business unit administration', NULL, '["VIEW_BUSINESS", "CREATE_BUSINESS", "MODIFY_BUSINESS", "DELETE_BUSINESS", "ADMIN_ACCESS"]'::jsonb),
('app', 'HR Admin', 'Human resources administration', NULL, '["VIEW_HR", "CREATE_HR", "MODIFY_HR", "DELETE_HR", "ADMIN_ACCESS"]'::jsonb),
('app', 'Role Management', 'User role and permission management', NULL, '["MANAGE_ROLES", "MANAGE_PERMISSIONS", "VIEW_USERS", "ADMIN_ACCESS"]'::jsonb),
('app', 'System Configuration', 'Core system configuration access', NULL, '["SYSTEM_CONFIG", "META_CONFIG", "ADMIN_ACCESS"]'::jsonb);

-- ============================================================================
-- USER PERMISSIONS - COMPREHENSIVE ACCESS GRANTS
-- ============================================================================

-- Grant comprehensive access to all existing users
INSERT INTO app.rel_user_scope (emp_id, scope_type, scope_id, scope_name, scope_permission, tags) VALUES

-- John Smith (Project Manager) - Full project and admin access
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'Dashboard Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'Projects Full Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'Tasks Full Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'Employees Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'Clients Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'Reports Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'User Profile Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'app', NULL, 'Settings Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- Jane Doe (Senior Developer) - Development access
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'app', NULL, 'Dashboard Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'app', NULL, 'Projects Full Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'app', NULL, 'Tasks Full Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'app', NULL, 'Employees Access', ARRAY[0,1,2]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'app', NULL, 'Clients Access', ARRAY[0,1,2]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'app', NULL, 'Reports Access', ARRAY[0,1]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'app', NULL, 'User Profile Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- Bob Wilson (System Administrator) - Full system access
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Dashboard Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Projects Full Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Tasks Full Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Employees Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Clients Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Worksites Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Reports Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Admin Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Locations Admin', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Business Admin', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'HR Admin', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Role Management', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'System Configuration', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'User Profile Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'app', NULL, 'Settings Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- Alice Johnson (Designer) - Design and content access
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'app', NULL, 'Dashboard Access', ARRAY[0,1,2]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'app', NULL, 'Projects Read Access', ARRAY[0,1,2]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'app', NULL, 'Tasks Worker Access', ARRAY[0,1,2]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'app', NULL, 'Clients Access', ARRAY[0,1]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'app', NULL, 'Reports Access', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'app', NULL, 'User Profile Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- Mike Chen (Developer) - Development and task access
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'app', NULL, 'Dashboard Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'app', NULL, 'Projects Read Access', ARRAY[0,1]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'app', NULL, 'Tasks Worker Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'app', NULL, 'Clients Access', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'app', NULL, 'Reports Access', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'app', NULL, 'User Profile Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb),

-- Sarah Lee (QA Engineer) - QA and review access
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'app', NULL, 'Dashboard Access', ARRAY[0,1,2]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'app', NULL, 'Projects Read Access', ARRAY[0,1,2]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'app', NULL, 'Tasks Worker Access', ARRAY[0,1,2]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'app', NULL, 'Reports Access', ARRAY[0,1]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'app', NULL, 'User Profile Access', ARRAY[0,1,2,3,4]::smallint[], '[]'::jsonb);

-- ============================================================================
-- COMPONENT DEFINITIONS
-- ============================================================================

INSERT INTO app.app_d_component (name, "descr", component_type, props_schema, dependencies, tags) VALUES
('DataTable', 'Advanced data table with filtering, sorting, and pagination', 'table', 
 '{"columns": {"type": "array", "required": true}, "data": {"type": "array", "required": true}}'::jsonb, 
 '["@tanstack/react-table", "lucide-react"]'::jsonb, '["core", "table"]'::jsonb),
('EntityForm', 'Generic entity creation and editing form', 'form', 
 '{"entity": {"type": "object"}, "onSubmit": {"type": "function", "required": true}}'::jsonb, 
 '["react-hook-form", "@hookform/resolvers"]'::jsonb, '["core", "form"]'::jsonb),
('TaskCard', 'Reusable task card component for kanban boards', 'card', 
 '{"task": {"type": "object", "required": true}, "onMove": {"type": "function"}}'::jsonb, 
 '["@dnd-kit/core", "@dnd-kit/sortable"]'::jsonb, '["tasks", "card"]'::jsonb),
('ProjectHeader', 'Project page header with actions and metadata', 'header', 
 '{"project": {"type": "object", "required": true}}'::jsonb, 
 '["lucide-react"]'::jsonb, '["projects", "header"]'::jsonb),
('PermissionGate', 'Role-based access control component', 'security', 
 '{"action": {"type": "string", "required": true}, "resource": {"type": "string", "required": true}}'::jsonb, 
 '["@tanstack/react-query"]'::jsonb, '["security", "rbac"]'::jsonb);

-- ============================================================================
-- ROUTE-COMPONENT RELATIONSHIPS
-- ============================================================================

INSERT INTO app.rel_route_component (route_id, component_id, usage_type, props, tags) VALUES
-- Dashboard components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 (SELECT id FROM app.app_d_component WHERE name = 'TaskCard'),
 'widget', '{"showProject": true, "compact": true}'::jsonb, '[]'::jsonb),

-- Project components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects'),
 (SELECT id FROM app.app_d_component WHERE name = 'DataTable'),
 'main', '{"entityType": "project"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects/:id'),
 (SELECT id FROM app.app_d_component WHERE name = 'ProjectHeader'),
 'header', '{"showActions": true}'::jsonb, '[]'::jsonb),

-- Task components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks'),
 (SELECT id FROM app.app_d_component WHERE name = 'TaskCard'),
 'main', '{"draggable": true}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks/:id'),
 (SELECT id FROM app.app_d_component WHERE name = 'EntityForm'),
 'main', '{"entityType": "task"}'::jsonb, '[]'::jsonb),

-- Entity management components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/employees'),
 (SELECT id FROM app.app_d_component WHERE name = 'DataTable'),
 'main', '{"entityType": "employee"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/clients'),
 (SELECT id FROM app.app_d_component WHERE name = 'DataTable'),
 'main', '{"entityType": "client"}'::jsonb, '[]'::jsonb);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show total counts
SELECT 
  'Pages' as entity_type, 
  COUNT(*) as total_count 
FROM app.app_scope_d_route_page
UNION ALL
SELECT 
  'Scope Permissions' as entity_type, 
  COUNT(*) as total_count 
FROM app.rel_scope_permission
UNION ALL
SELECT 
  'User Permissions' as entity_type, 
  COUNT(*) as total_count 
FROM app.rel_user_scope WHERE scope_type = 'app'
UNION ALL
SELECT 
  'Components' as entity_type, 
  COUNT(*) as total_count 
FROM app.app_d_component
UNION ALL
SELECT 
  'Route-Component Links' as entity_type, 
  COUNT(*) as total_count 
FROM app.rel_route_component;

-- Show user permission summary
SELECT 
  e.name as employee,
  COUNT(rus.id) as permission_count,
  ARRAY_AGG(DISTINCT rus.scope_name ORDER BY rus.scope_name) as permissions
FROM app.d_emp e
JOIN app.rel_user_scope rus ON e.id = rus.emp_id 
WHERE rus.scope_type = 'app' AND rus.active = true
GROUP BY e.id, e.name
ORDER BY e.name;
