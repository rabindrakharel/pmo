-- ============================================================================
-- APPLICATION DATA - Route Pages and Components
-- ============================================================================

-- Route Pages with comprehensive application coverage
INSERT INTO app.app_scope_d_route_page (name, "descr", route_path, component_name, is_protected, tags) VALUES
-- Dashboard & Overview
('Dashboard', 'Main application dashboard with overview and quick actions', '/dashboard', 'DashboardPage', true, '["core", "overview"]'::jsonb),

-- Project Management
('Projects List', 'Browse and manage all projects', '/projects', 'ProjectsPage', true, '["projects", "list"]'::jsonb),
('Project Details', 'View detailed project information and manage project tasks', '/projects/:id', 'ProjectDetailPage', true, '["projects", "details"]'::jsonb),
('Project Create', 'Create new project', '/projects/new', 'ProjectCreatePage', true, '["projects", "create"]'::jsonb),

-- Task Management
('Tasks Board', 'Kanban-style task management board', '/tasks', 'TasksPage', true, '["tasks", "board"]'::jsonb),
('Task Details', 'View and edit detailed task information', '/tasks/:id', 'TaskDetailPage', true, '["tasks", "details"]'::jsonb),
('Task Create', 'Create new task', '/tasks/new', 'TaskCreatePage', true, '["tasks", "create"]'::jsonb),

-- Entity Management
('Employees', 'Employee directory and management', '/employees', 'EmployeeManagementPage', true, '["employees", "list"]'::jsonb),
('Clients', 'Client management and contact information', '/clients', 'ClientManagementPage', true, '["clients", "list"]'::jsonb),
('Worksites', 'Physical worksite locations and management', '/worksites', 'WorksiteManagementPage', true, '["worksites", "list"]'::jsonb),

-- Hierarchical Management
('Locations', 'Geographic location hierarchy management', '/admin/locations', 'LocationManagementPage', true, '["admin", "locations"]'::jsonb),
('Business Units', 'Business organizational hierarchy', '/admin/businesses', 'BusinessManagementPage', true, '["admin", "business"]'::jsonb),
('HR Departments', 'Human resources hierarchy and departments', '/admin/hr', 'HrManagementPage', true, '["admin", "hr"]'::jsonb),

-- Administration
('Admin Dashboard', 'System administration overview', '/admin', 'AdminPage', true, '["admin", "dashboard"]'::jsonb),
('Role Management', 'Manage user roles and permissions', '/admin/roles', 'RoleManagementPage', true, '["admin", "roles"]'::jsonb),
('Meta Configuration', 'System metadata and configuration', '/admin/meta', 'MetaConfigPage', true, '["admin", "meta"]'::jsonb),

-- User Management
('User Profile', 'Personal user profile and preferences', '/profile', 'ProfilePage', true, '["user", "profile"]'::jsonb),
('Settings', 'Application settings and preferences', '/settings', 'SettingsPage', true, '["user", "settings"]'::jsonb),

-- Reports & Analytics
('Reports', 'Reports and analytics dashboard', '/reports', 'ReportsPage', true, '["reports", "analytics"]'::jsonb),
('Project Reports', 'Project-specific reporting and analytics', '/reports/projects', 'ProjectReportsPage', true, '["reports", "projects"]'::jsonb),
('Task Reports', 'Task analytics and performance reports', '/reports/tasks', 'TaskReportsPage', true, '["reports", "tasks"]'::jsonb),

-- Authentication
('Login', 'User authentication and login', '/login', 'LoginPage', false, '["auth", "public"]'::jsonb),
('Logout', 'User logout and session termination', '/logout', 'LogoutPage', false, '["auth", "public"]'::jsonb);

-- Components with enhanced definitions
INSERT INTO app.app_scope_d_component (name, "descr", component_type, props_schema, dependencies, tags) VALUES
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
 '["@tanstack/react-query"]'::jsonb, '["security", "rbac"]'::jsonb),
('EntityManagementPage', 'Comprehensive entity management page template', 'page', 
 '{"config": {"type": "object", "required": true}}'::jsonb, 
 '["@tanstack/react-table", "@tanstack/react-query", "lucide-react"]'::jsonb, '["core", "management"]'::jsonb),
('Navigation', 'Main navigation component with role-based menu items', 'navigation',
 '{"user": {"type": "object", "required": true}, "permissions": {"type": "array"}}'::jsonb,
 '["react-router-dom", "lucide-react"]'::jsonb, '["core", "navigation"]'::jsonb),
('SearchBar', 'Global search component with filters', 'search',
 '{"placeholder": {"type": "string"}, "onSearch": {"type": "function", "required": true}}'::jsonb,
 '["lucide-react"]'::jsonb, '["core", "search"]'::jsonb);

-- Route-Component relationships
INSERT INTO app.rel_route_component (route_id, component_id, usage_type, props, tags) VALUES
-- Dashboard components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'widget', '{"showProject": true, "compact": true}'::jsonb, '[]'::jsonb),

-- Project components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'DataTable'),
 'main', '{"entityType": "project"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects/:id'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'ProjectHeader'),
 'header', '{"showActions": true}'::jsonb, '[]'::jsonb),

-- Task components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'main', '{"draggable": true}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks/:id'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityForm'),
 'main', '{"entityType": "task"}'::jsonb, '[]'::jsonb),

-- Entity management components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/employees'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "employee"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/clients'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "client"}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/worksites'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "worksite"}'::jsonb, '[]'::jsonb),

-- Admin components
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/locations'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "location", "hierarchical": true}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/businesses'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "business", "hierarchical": true}'::jsonb, '[]'::jsonb),
((SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/hr'),
 (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'main', '{"entityType": "hr", "hierarchical": true}'::jsonb, '[]'::jsonb);
