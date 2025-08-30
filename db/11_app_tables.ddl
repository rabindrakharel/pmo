-- ============================================================================
-- APPLICATION SCOPE TABLE (Unified Components, Routes, and API Paths)
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
-- 
-- 🎯 **UNIFIED APP REGISTRY**
-- • Frontend pages (routes & screens)
-- • Backend APIs (endpoints & services)  
-- • UI components (reusable elements)
-- • Centralized permission control
--
-- 📱 **SCOPE TYPES**
-- • 'page': User-facing routes (/dashboard, /projects, /admin/*)
-- • 'api-path': Server endpoints (/api/v1/emp, /api/v1/project)
-- • 'component': UI elements (DataTable, Modal, Button, etc.)
--
-- 🔐 **PERMISSION INTEGRATION**
-- • Granular RBAC (page, API, component level)
-- • Dynamic UI generation (permission-based)
-- • Security enforcement (centralized access)
-- • Audit & compliance (complete traceability)
--
-- 🏗️ **HIERARCHICAL STRUCTURE**
-- • Parent-child relationships (Admin Dashboard → User Management → User Detail Modal)
-- • Permission inheritance (child inherits parent unless overridden)
-- • Nested navigation support
--
-- 🔄 **INTEGRATION PATTERNS**
-- User/Role → d_scope → d_scope_app → Actual Resource
--
-- 💼 **REAL-WORLD SCENARIOS**
-- • Project Managers: project pages/APIs only
-- • HR Staff: employee components only
-- • Contractors: task-related APIs only  
-- • Executives: dashboard components with aggregated data

-- ============================================================================
-- DDL:
-- ============================================================================

-- Unified App Scope Table for components, pages, and API paths
CREATE TABLE app.d_scope_app (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- App scope definition
  scope_type text NOT NULL,
  scope_path text NOT NULL,
  parent_id uuid REFERENCES app.d_scope_app(id) ON DELETE SET NULL,
  is_protected boolean NOT NULL DEFAULT false,
  
  -- Component/API properties
  props_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Standard fields (audit, metadata, SCD type 2)
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Insert Pages (Frontend Routes)
INSERT INTO app.d_scope_app (name, descr, scope_type, scope_path, is_protected, tags, attr) VALUES
-- Main Application Pages
('Dashboard', 'Main dashboard with project and task overview', 'page', '/', true, '["dashboard", "overview"]', '{"icon": "LayoutDashboard", "order": 1}'),
('Dashboard Alt', 'Alternative dashboard route', 'page', '/dashboard', true, '["dashboard", "overview"]', '{"icon": "LayoutDashboard", "order": 1}'),
('Login', 'User authentication page', 'page', '/login', false, '["auth", "public"]', '{"icon": "LogIn", "public": true}'),
('Test Page', 'Development testing page', 'page', '/test', true, '["development", "testing"]', '{"icon": "TestTube", "dev": true}'),

-- Project Management
('Projects List', 'Project listing and management page', 'page', '/projects', true, '["projects", "management"]', '{"icon": "FolderKanban", "order": 2}'),
('Project Detail', 'Individual project details and tasks', 'page', '/projects/:id', true, '["projects", "detail"]', '{"icon": "FolderOpen", "dynamic": true}'),

-- Task Management  
('Tasks Board', 'Task board with kanban view', 'page', '/tasks', true, '["tasks", "kanban"]', '{"icon": "CheckSquare", "order": 3}'),
('Task Detail', 'Individual task details and updates', 'page', '/tasks/:id', true, '["tasks", "detail"]', '{"icon": "CheckCircle", "dynamic": true}'),

-- Directory Pages
('Directory Dashboard', 'Directory overview with navigation', 'page', '/directory', true, '["directory", "overview"]', '{"icon": "Users", "order": 4}'),
('Directory People', 'Employee directory and management', 'page', '/directory/people', true, '["directory", "employees"]', '{"icon": "Users"}'),
('Directory Locations', 'Location hierarchy management', 'page', '/directory/locations', true, '["directory", "locations"]', '{"icon": "MapPin"}'),
('Directory Businesses', 'Business unit management', 'page', '/directory/businesses', true, '["directory", "business"]', '{"icon": "Building2"}'),
('Directory Worksites', 'Worksite management', 'page', '/directory/worksites', true, '["directory", "worksites"]', '{"icon": "Building"}'),

-- Forms and Reports
('Forms Page', 'Dynamic forms and reports', 'page', '/forms', true, '["forms", "reports"]', '{"icon": "FileText", "order": 5}'),

-- Meta Configuration
('Meta Configuration', 'System meta configuration', 'page', '/meta', true, '["admin", "meta", "config"]', '{"icon": "Settings", "admin": true}'),

-- Admin Pages
('Admin Dashboard', 'Administrative dashboard', 'page', '/admin', true, '["admin", "dashboard"]', '{"icon": "Settings", "order": 6, "admin": true}'),
('Admin Meta Config', 'Meta data configuration management', 'page', '/admin/meta', true, '["admin", "meta"]', '{"icon": "Tag", "admin": true}'),
('Admin Locations', 'Administrative location management', 'page', '/admin/locations', true, '["admin", "locations"]', '{"icon": "MapPin", "admin": true}'),
('Admin Businesses', 'Administrative business management', 'page', '/admin/businesses', true, '["admin", "business"]', '{"icon": "Building2", "admin": true}'),
('Admin HR', 'HR department management', 'page', '/admin/hr', true, '["admin", "hr"]', '{"icon": "BriefcaseIcon", "admin": true}'),
('Admin Worksites', 'Administrative worksite management', 'page', '/admin/worksites', true, '["admin", "worksites"]', '{"icon": "Building", "admin": true}'),
('Admin Employees', 'Administrative employee management', 'page', '/admin/employees', true, '["admin", "employees"]', '{"icon": "Users", "admin": true}'),
('Admin Roles', 'Role and permission management', 'page', '/admin/roles', true, '["admin", "roles", "rbac"]', '{"icon": "Shield", "admin": true}'),
('Admin Clients', 'Client management', 'page', '/admin/clients', true, '["admin", "clients"]', '{"icon": "UserCheck", "admin": true}'),
('Admin Webhooks', 'Webhook configuration', 'page', '/admin/webhooks', true, '["admin", "webhooks", "integration"]', '{"icon": "Webhook", "admin": true}');

-- Insert API Paths (Backend Endpoints)
INSERT INTO app.d_scope_app (name, descr, scope_type, scope_path, is_protected, tags, attr) VALUES
-- Health and Authentication
('Health Check', 'API health status endpoint', 'api-path', '/api/health', false, '["health", "monitoring"]', '{"method": "GET", "public": true}'),
('Auth Login', 'User authentication endpoint', 'api-path', '/api/v1/auth/login', false, '["auth", "login"]', '{"method": "POST", "public": true}'),
('Auth Logout', 'User logout endpoint', 'api-path', '/api/v1/auth/logout', true, '["auth", "logout"]', '{"method": "POST"}'),
('Auth Refresh', 'Token refresh endpoint', 'api-path', '/api/v1/auth/refresh', true, '["auth", "refresh"]', '{"method": "POST"}'),

-- Employee Management
('Employee List API', 'Employee listing with search and pagination', 'api-path', '/api/v1/emp', true, '["employees", "list"]', '{"methods": ["GET", "POST"]}'),
('Employee Detail API', 'Individual employee operations', 'api-path', '/api/v1/emp/:id', true, '["employees", "detail"]', '{"methods": ["GET", "PUT", "DELETE"]}'),
('Employee Scopes API', 'Employee scope assignments', 'api-path', '/api/v1/emp/:id/scopes', true, '["employees", "scopes"]', '{"methods": ["GET"]}'),

-- Location Management
('Location API', 'Location hierarchy management', 'api-path', '/api/v1/scope/location', true, '["locations", "scope"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Business Management
('Business API', 'Business unit management', 'api-path', '/api/v1/scope/business', true, '["business", "scope"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- HR Management
('HR API', 'HR department management', 'api-path', '/api/v1/scope/hr', true, '["hr", "scope"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Worksite Management
('Worksite API', 'Worksite management', 'api-path', '/api/v1/worksite', true, '["worksites", "management"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Client Management
('Client API', 'Client management', 'api-path', '/api/v1/client', true, '["clients", "management"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Role Management
('Role API', 'Role and permission management', 'api-path', '/api/v1/role', true, '["roles", "rbac"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Project Management
('Project API', 'Project lifecycle management', 'api-path', '/api/v1/project', true, '["projects", "management"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Task Management
('Task API', 'Task operations', 'api-path', '/api/v1/task', true, '["tasks", "management"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),
('Task Activity API', 'Task activity tracking', 'api-path', '/api/v1/task/activity', true, '["tasks", "activity"]', '{"methods": ["GET", "POST"]}'),

-- Meta Configuration
('Meta API', 'System meta configuration', 'api-path', '/api/v1/meta', true, '["meta", "configuration"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}');

-- Insert Components (UI Components)
INSERT INTO app.d_scope_app (name, descr, scope_type, scope_path, is_protected, tags, attr) VALUES
-- Layout Components
('Layout', 'Main application layout wrapper', 'component', 'Layout', false, '["layout", "wrapper"]', '{"type": "layout", "reusable": true}'),
('Sidebar', 'Application navigation sidebar', 'component', 'Sidebar', false, '["layout", "navigation"]', '{"type": "navigation", "position": "left"}'),
('TopBar', 'Application top navigation bar', 'component', 'TopBar', false, '["layout", "navigation"]', '{"type": "navigation", "position": "top"}'),

-- Auth Components
('ProtectedRoute', 'Route protection wrapper', 'component', 'ProtectedRoute', false, '["auth", "routing"]', '{"type": "wrapper", "security": true}'),
('AccessBoundary', 'Permission-based component wrapper', 'component', 'AccessBoundary', false, '["auth", "permissions"]', '{"type": "wrapper", "rbac": true}'),

-- UI Components (Data Display)
('DataTable', 'Reusable data table with pagination and filtering', 'component', 'datatable:DataTable', false, '["ui", "table", "data"]', '{"type": "datatable", "features": ["pagination", "filtering", "sorting"]}'),
('EntityManagementPage', 'Generic entity management interface', 'component', 'page:EntityManagementPage', false, '["ui", "management", "crud"]', '{"type": "page", "features": ["crud", "search", "filter"]}'),
('TaskBoard', 'Kanban-style task board', 'component', 'widget:TaskBoard', false, '["tasks", "kanban", "board"]', '{"type": "widget", "layout": "kanban"}'),

-- UI Components (Forms and Inputs)
('Button', 'Reusable button component', 'component', 'form:Button', false, '["ui", "form", "button"]', '{"type": "form", "variants": ["primary", "secondary", "destructive"]}'),
('Input', 'Text input component', 'component', 'form:Input', false, '["ui", "form", "input"]', '{"type": "form", "input": "text"}'),
('Select', 'Dropdown selection component', 'component', 'form:Select', false, '["ui", "form", "select"]', '{"type": "form", "input": "select"}'),
('Checkbox', 'Checkbox input component', 'component', 'form:Checkbox', false, '["ui", "form", "checkbox"]', '{"type": "form", "input": "checkbox"}'),
('Textarea', 'Multi-line text input', 'component', 'form:Textarea', false, '["ui", "form", "textarea"]', '{"type": "form", "input": "textarea"}'),
('Switch', 'Toggle switch component', 'component', 'form:Switch', false, '["ui", "form", "switch"]', '{"type": "form", "input": "switch"}'),

-- UI Components (Display)
('Card', 'Content card component', 'component', 'layout:Card', false, '["ui", "layout", "card"]', '{"type": "layout", "container": true}'),
('Badge', 'Status/label badge component', 'component', 'display:Badge', false, '["ui", "display", "badge"]', '{"type": "display", "variants": ["default", "secondary", "destructive"]}'),
('Table', 'Basic table component', 'component', 'table:Table', false, '["ui", "table", "basic"]', '{"type": "table", "features": ["basic"]}'),
('Tabs', 'Tab navigation component', 'component', 'navigation:Tabs', false, '["ui", "navigation", "tabs"]', '{"type": "navigation", "style": "tabs"}'),

-- UI Components (Modals and Overlays)
('Dialog', 'Modal dialog component', 'component', 'modal:Dialog', false, '["ui", "modal", "dialog"]', '{"type": "modal", "overlay": true}'),
('DropdownMenu', 'Dropdown menu component', 'component', 'menu:DropdownMenu', false, '["ui", "menu", "dropdown"]', '{"type": "menu", "trigger": "click"}'),

-- UI Components (Layout)
('Label', 'Form label component', 'component', 'form:Label', false, '["ui", "form", "label"]', '{"type": "form", "helper": true}'),
('Separator', 'Visual separator component', 'component', 'layout:Separator', false, '["ui", "layout", "separator"]', '{"type": "layout", "divider": true}');