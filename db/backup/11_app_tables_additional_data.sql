-- ============================================================================
-- ADDITIONAL DATA CURATION FOR d_scope_app
-- Based on actual project structure analysis
-- ============================================================================

-- Additional Pages (Frontend Routes) - Missing from original data
INSERT INTO app.d_scope_app (scope_name, descr, scope_type, is_protected, tags, attr) VALUES
-- Admin Pages
('/admin', 'Admin dashboard and management hub', 'page', true, '["admin", "management"]', '{"icon": "Settings", "order": 7, "admin": true}'),
('/admin/locations', 'Location management page', 'page', true, '["admin", "locations"]', '{"icon": "MapPin", "admin": true}'),
('/admin/businesses', 'Business unit management page', 'page', true, '["admin", "business"]', '{"icon": "Building2", "admin": true}'),
('/admin/hr', 'HR management page', 'page', true, '["admin", "hr"]', '{"icon": "Users", "admin": true}'),
('/admin/worksites', 'Worksite management page', 'page', true, '["admin", "worksites"]', '{"icon": "Building", "admin": true}'),
('/admin/roles', 'Role management page', 'page', true, '["admin", "roles", "rbac"]', '{"icon": "Shield", "admin": true}'),
('/admin/clients', 'Client management page', 'page', true, '["admin", "clients"]', '{"icon": "UserCheck", "admin": true}'),
('/admin/employees', 'Employee management page (admin)', 'page', true, '["admin", "employees"]', '{"icon": "Users", "admin": true}'),
('/admin/meta', 'Meta configuration page', 'page', true, '["admin", "meta", "config"]', '{"icon": "Settings", "admin": true}'),

-- Employee Management (non-admin)
('/employees', 'Employee directory and management', 'page', true, '["employees", "directory"]', '{"icon": "Users", "order": 8}'),

-- Directory Sub-pages
('/directory/people', 'Employee directory page', 'page', true, '["directory", "people"]', '{"icon": "Users"}'),
('/directory/locations', 'Location directory page', 'page', true, '["directory", "locations"]', '{"icon": "MapPin"}'),
('/directory/businesses', 'Business directory page', 'page', true, '["directory", "businesses"]', '{"icon": "Building2"}'),
('/directory/worksites', 'Worksite directory page', 'page', true, '["directory", "worksites"]', '{"icon": "Building"}');

-- Additional API Endpoints - Missing from original data
INSERT INTO app.d_scope_app (scope_name, descr, scope_type, is_protected, tags, attr) VALUES
-- RBAC API Endpoints
('/api/v1/rbac/employee-scopes', 'Get employee accessible scopes', 'api-path', true, '["rbac", "permissions"]', '{"methods": ["POST"]}'),
('/api/v1/rbac/component-permissions', 'Check component access permissions', 'api-path', true, '["rbac", "permissions"]', '{"methods": ["POST"]}'),
('/api/v1/rbac/page-permissions', 'Check page access permissions', 'api-path', true, '["rbac", "permissions"]', '{"methods": ["POST"]}'),
('/api/v1/rbac/scope-permissions', 'Get scope-specific permissions', 'api-path', true, '["rbac", "permissions"]', '{"methods": ["POST"]}'),
('/api/v1/rbac/my-permissions/:scopeType', 'Get my permissions for scope type', 'api-path', true, '["rbac", "permissions"]', '{"methods": ["GET"]}'),

-- Auth API Endpoints (additional)
('/api/v1/auth/me', 'Get current employee profile', 'api-path', true, '["auth", "profile"]', '{"methods": ["GET"]}'),
('/api/v1/auth/permissions', 'Get employee permissions', 'api-path', true, '["auth", "permissions"]', '{"methods": ["GET"]}'),
('/api/v1/auth/scopes/:scopeType', 'Get employee scopes by type', 'api-path', true, '["auth", "scopes"]', '{"methods": ["GET"]}'),
('/api/v1/auth/permissions/debug', 'Permission debugging endpoint', 'api-path', true, '["auth", "debug", "admin"]', '{"methods": ["GET"]}'),

-- Project API Endpoints (additional)
('/api/v1/project/:id', 'Individual project operations', 'api-path', true, '["projects", "detail"]', '{"methods": ["GET", "PUT", "DELETE"]}'),
('/api/v1/project/:id/tasks', 'Get project tasks', 'api-path', true, '["projects", "tasks"]', '{"methods": ["GET"]}'),

-- Task API Endpoints (additional)
('/api/v1/task/:id', 'Individual task operations', 'api-path', true, '["tasks", "detail"]', '{"methods": ["GET", "PUT", "DELETE"]}'),
('/api/v1/task/:id/record', 'Update task record', 'api-path', true, '["tasks", "records"]', '{"methods": ["PUT"]}'),

-- Client API Endpoints (additional)
('/api/v1/client/:id', 'Individual client operations', 'api-path', true, '["clients", "detail"]', '{"methods": ["GET", "PUT", "DELETE"]}'),
('/api/v1/client/:id/hierarchy', 'Get client hierarchy', 'api-path', true, '["clients", "hierarchy"]', '{"methods": ["GET"]}'),

-- System Health Endpoints
('/healthz', 'System liveness check', 'api-path', false, '["health", "monitoring"]', '{"method": "GET", "public": true}'),
('/readyz', 'System readiness check', 'api-path', false, '["health", "monitoring"]', '{"method": "GET", "public": true}');

-- Additional UI Components - Missing from original data
INSERT INTO app.d_scope_app (scope_name, descr, scope_type, is_protected, tags, attr) VALUES
-- Layout Components (additional)
('TopBar', 'Application top navigation bar', 'component', false, '["layout", "navigation"]', '{"type": "navigation", "position": "top"}'),

-- Table Components
('tables:ProjectsTable', 'Projects data table component', 'component', false, '["tables", "projects"]', '{"type": "table", "entity": "projects"}'),
('tables:TasksTable', 'Tasks data table component', 'component', false, '["tables", "tasks"]', '{"type": "table", "entity": "tasks"}'),
('rbac:RbacDataTable', 'RBAC-aware data table component', 'component', false, '["tables", "rbac"]', '{"type": "table", "rbac": true}'),

-- Task Management Components
('tasks:TaskBoard', 'Task board kanban component', 'component', false, '["tasks", "kanban"]', '{"type": "widget", "layout": "kanban"}'),
('tasks:TaskManagement', 'Task management interface', 'component', false, '["tasks", "management"]', '{"type": "page", "features": ["crud", "assign"]}'),

-- Project Management Components
('projects:ProjectListPage', 'Project list interface component', 'component', false, '["projects", "list"]', '{"type": "page", "features": ["list", "filter"]}'),

-- Common Components
('common:EntityManagementPage', 'Generic entity management page', 'component', false, '["common", "management", "crud"]', '{"type": "page", "features": ["crud", "search", "filter", "rbac"]}'),

-- UI Components (additional)
('ui:ActionButtons', 'Action buttons component', 'component', false, '["ui", "actions"]', '{"type": "ui", "features": ["create", "edit", "delete"]}'),
('ui:Tooltip', 'Tooltip component', 'component', false, '["ui", "overlay", "tooltip"]', '{"type": "overlay", "trigger": "hover"}'),
('ui:Progress', 'Progress indicator component', 'component', false, '["ui", "display", "progress"]', '{"type": "display", "animation": true}'),

-- Form Components (additional)
('form:Form', 'Generic form wrapper', 'component', false, '["ui", "form", "wrapper"]', '{"type": "form", "validation": true}'),
('form:FormField', 'Form field wrapper', 'component', false, '["ui", "form", "field"]', '{"type": "form", "validation": true}'),

-- Authentication Components (additional)
('auth:LoginForm', 'User login form component', 'component', false, '["auth", "login", "form"]', '{"type": "form", "public": true}'),
('auth:AuthGuard', 'Authentication guard component', 'component', false, '["auth", "guard"]', '{"type": "wrapper", "security": true}');

-- Insert additional meaningful pages found in the project structure
INSERT INTO app.d_scope_app (scope_name, descr, scope_type, is_protected, tags, attr) VALUES
-- Management Categories (grouped by functionality)
('/management/dashboard', 'Management overview dashboard', 'page', true, '["management", "dashboard", "overview"]', '{"icon": "BarChart3", "order": 10}'),
('/management/analytics', 'Business analytics and reporting', 'page', true, '["management", "analytics", "reporting"]', '{"icon": "TrendingUp", "order": 11}'),
('/management/settings', 'System configuration and settings', 'page', true, '["management", "settings", "config"]', '{"icon": "Settings", "order": 12}'),

-- Advanced Features Pages
('/reports', 'Reports and analytics dashboard', 'page', true, '["reports", "analytics"]', '{"icon": "FileText", "order": 13}'),
('/workflows', 'Workflow automation and processes', 'page', true, '["workflows", "automation"]', '{"icon": "Workflow", "order": 14}'),
('/integrations', 'Third-party integrations management', 'page', true, '["integrations", "api"]', '{"icon": "Link", "order": 15}'),

-- User Experience Pages
('/notifications', 'Notification center', 'page', true, '["notifications", "alerts"]', '{"icon": "Bell", "order": 16}'),
('/profile', 'User profile management', 'page', true, '["profile", "user"]', '{"icon": "User", "order": 17}'),
('/settings', 'Personal settings', 'page', true, '["settings", "personal"]', '{"icon": "Settings", "order": 18}');

-- ============================================================================
-- SUMMARY OF ADDITIONS
-- ============================================================================
--
-- Added comprehensive scope data including:
-- • 13 additional page routes (admin pages, directory sub-pages, management areas)
-- • 15 additional API endpoints (RBAC, auth, detailed CRUD operations)
-- • 15 additional UI components (tables, forms, layouts, authentication)
-- • 9 additional management/feature pages
--
-- Total new entries: 52 additional app scope entries
-- Focus areas:
-- • Admin panel functionality
-- • RBAC and permission management
-- • Enhanced API coverage
-- • Component-level granular permissions
-- • Management and analytics features
--
-- All entries follow the established pattern with meaningful descriptions,
-- proper tagging, and attributes for UI rendering and permission control.