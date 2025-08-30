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
  parent_id uuid REFERENCES app.d_scope_app(id) ON DELETE SET NULL,
  is_protected boolean NOT NULL DEFAULT false,
  
  -- Component/API properties
  props_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Standard fields (audit, metadata, SCD type 2)
  scope_name text NOT NULL,
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
INSERT INTO app.d_scope_app (scope_name, descr, scope_type, is_protected, tags, attr) VALUES
-- Main Application Pages
('/', 'Main dashboard with project and task overview', 'page', true, '["dashboard", "overview"]', '{"icon": "LayoutDashboard", "order": 1}'),
('/dashboard', 'Alternative dashboard route', 'page', true, '["dashboard", "overview"]', '{"icon": "LayoutDashboard", "order": 1}'),
('/login', 'User authentication page', 'page', false, '["auth", "public"]', '{"icon": "LogIn", "public": true}'),
('/test', 'Development testing page', 'page', true, '["development", "testing"]', '{"icon": "TestTube", "dev": true}'),

-- Project Management
('/projects', 'Project listing and management page', 'page', true, '["projects", "management"]', '{"icon": "FolderKanban", "order": 2}'),
('/projects/:id', 'Individual project details and tasks', 'page', true, '["projects", "detail"]', '{"icon": "FolderOpen", "dynamic": true}'),

-- Task Management  
('/tasks', 'Task board with kanban view', 'page', true, '["tasks", "kanban"]', '{"icon": "CheckSquare", "order": 3}'),
('/tasks/:id', 'Individual task details and updates', 'page', true, '["tasks", "detail"]', '{"icon": "CheckCircle", "dynamic": true}'),

-- Directory Pages
('/directory', 'Directory overview with navigation', 'page', true, '["directory", "overview"]', '{"icon": "Users", "order": 4}'),
('/directory/people', 'Employee directory and management', 'page', true, '["directory", "employees"]', '{"icon": "Users"}'),
('/directory/locations', 'Location hierarchy management', 'page', true, '["directory", "locations"]', '{"icon": "MapPin"}'),
('/directory/businesses', 'Business unit management', 'page', true, '["directory", "business"]', '{"icon": "Building2"}'),
('/directory/worksites', 'Worksite management', 'page', true, '["directory", "worksites"]', '{"icon": "Building"}'),

-- Forms and Reports
('/forms', 'Dynamic forms and reports', 'page', true, '["forms", "reports"]', '{"icon": "FileText", "order": 5}'),

-- Meta Configuration
('/meta', 'System meta configuration', 'page', true, '["admin", "meta", "config"]', '{"icon": "Settings", "admin": true}'),

-- Admin Pages
('/admin', 'Administrative dashboard', 'page', true, '["admin", "dashboard"]', '{"icon": "Settings", "order": 6, "admin": true}'),
('/admin/meta', 'Meta data configuration management', 'page', true, '["admin", "meta"]', '{"icon": "Tag", "admin": true}'),
('/admin/locations', 'Administrative location management', 'page', true, '["admin", "locations"]', '{"icon": "MapPin", "admin": true}'),
('/admin/businesses', 'Administrative business management', 'page', true, '["admin", "business"]', '{"icon": "Building2", "admin": true}'),
('/admin/hr', 'HR department management', 'page', true, '["admin", "hr"]', '{"icon": "BriefcaseIcon", "admin": true}'),
('/admin/worksites', 'Administrative worksite management', 'page', true, '["admin", "worksites"]', '{"icon": "Building", "admin": true}'),
('/admin/employees', 'Administrative employee management', 'page', true, '["admin", "employees"]', '{"icon": "Users", "admin": true}'),
('/admin/roles', 'Role and permission management', 'page', true, '["admin", "roles", "rbac"]', '{"icon": "Shield", "admin": true}'),
('/admin/clients', 'Client management', 'page', true, '["admin", "clients"]', '{"icon": "UserCheck", "admin": true}'),
('/admin/webhooks', 'Webhook configuration', 'page', true, '["admin", "webhooks", "integration"]', '{"icon": "Webhook", "admin": true}');

-- Insert API Paths (Backend Endpoints)
INSERT INTO app.d_scope_app (scope_name, descr, scope_type, is_protected, tags, attr) VALUES
-- Health and Authentication
('/api/health', 'API health status endpoint', 'api-path', false, '["health", "monitoring"]', '{"method": "GET", "public": true}'),
('/api/v1/auth/login', 'User authentication endpoint', 'api-path', false, '["auth", "login"]', '{"method": "POST", "public": true}'),
('/api/v1/auth/logout', 'User logout endpoint', 'api-path', true, '["auth", "logout"]', '{"method": "POST"}'),
('/api/v1/auth/refresh', 'Token refresh endpoint', 'api-path', true, '["auth", "refresh"]', '{"method": "POST"}'),

-- Employee Management
('/api/v1/emp', 'Employee listing with search and pagination', 'api-path', true, '["employees", "list"]', '{"methods": ["GET", "POST"]}'),
('/api/v1/emp/:id', 'Individual employee operations', 'api-path', true, '["employees", "detail"]', '{"methods": ["GET", "PUT", "DELETE"]}'),
('/api/v1/emp/:id/scopes', 'Employee scope assignments', 'api-path', true, '["employees", "scopes"]', '{"methods": ["GET"]}'),

-- Location Management
('/api/v1/scope/location', 'Location hierarchy management', 'api-path', true, '["locations", "scope"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Business Management
('/api/v1/scope/business', 'Business unit management', 'api-path', true, '["business", "scope"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- HR Management
('/api/v1/scope/hr', 'HR department management', 'api-path', true, '["hr", "scope"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Worksite Management
('/api/v1/worksite', 'Worksite management', 'api-path', true, '["worksites", "management"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Client Management
('/api/v1/client', 'Client management', 'api-path', true, '["clients", "management"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Role Management
('/api/v1/role', 'Role and permission management', 'api-path', true, '["roles", "rbac"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Project Management
('/api/v1/project', 'Project lifecycle management', 'api-path', true, '["projects", "management"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),

-- Task Management
('/api/v1/task', 'Task operations', 'api-path', true, '["tasks", "management"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}'),
('/api/v1/task/activity', 'Task activity tracking', 'api-path', true, '["tasks", "activity"]', '{"methods": ["GET", "POST"]}'),

-- Meta Configuration
('/api/v1/meta', 'System meta configuration', 'api-path', true, '["meta", "configuration"]', '{"methods": ["GET", "POST", "PUT", "DELETE"]}');

-- Insert Components (UI Components)
INSERT INTO app.d_scope_app (scope_name, descr, scope_type, is_protected, tags, attr) VALUES
-- Layout Components
('Layout', 'Main application layout wrapper', 'component', false, '["layout", "wrapper"]', '{"type": "layout", "reusable": true}'),
('Sidebar', 'Application navigation sidebar', 'component', false, '["layout", "navigation"]', '{"type": "navigation", "position": "left"}'),
('TopBar', 'Application top navigation bar', 'component', false, '["layout", "navigation"]', '{"type": "navigation", "position": "top"}'),

-- Auth Components
('ProtectedRoute', 'Route protection wrapper', 'component', false, '["auth", "routing"]', '{"type": "wrapper", "security": true}'),
('AccessBoundary', 'Permission-based component wrapper', 'component', false, '["auth", "permissions"]', '{"type": "wrapper", "rbac": true}'),

-- UI Components (Data Display)
('datatable:DataTable', 'Reusable data table with pagination and filtering', 'component', false, '["ui", "table", "data"]', '{"type": "datatable", "features": ["pagination", "filtering", "sorting"]}'),
('page:EntityManagementPage', 'Generic entity management interface', 'component', false, '["ui", "management", "crud"]', '{"type": "page", "features": ["crud", "search", "filter"]}'),
('widget:TaskBoard', 'Kanban-style task board', 'component', false, '["tasks", "kanban", "board"]', '{"type": "widget", "layout": "kanban"}'),

-- UI Components (Forms and Inputs)
('form:Button', 'Reusable button component', 'component', false, '["ui", "form", "button"]', '{"type": "form", "variants": ["primary", "secondary", "destructive"]}'),
('form:Input', 'Text input component', 'component', false, '["ui", "form", "input"]', '{"type": "form", "input": "text"}'),
('form:Select', 'Dropdown selection component', 'component', false, '["ui", "form", "select"]', '{"type": "form", "input": "select"}'),
('form:Checkbox', 'Checkbox input component', 'component', false, '["ui", "form", "checkbox"]', '{"type": "form", "input": "checkbox"}'),
('form:Textarea', 'Multi-line text input', 'component', false, '["ui", "form", "textarea"]', '{"type": "form", "input": "textarea"}'),
('form:Switch', 'Toggle switch component', 'component', false, '["ui", "form", "switch"]', '{"type": "form", "input": "switch"}'),

-- UI Components (Display)
('layout:Card', 'Content card component', 'component', false, '["ui", "layout", "card"]', '{"type": "layout", "container": true}'),
('display:Badge', 'Status/label badge component', 'component', false, '["ui", "display", "badge"]', '{"type": "display", "variants": ["default", "secondary", "destructive"]}'),
('table:Table', 'Basic table component', 'component', false, '["ui", "table", "basic"]', '{"type": "table", "features": ["basic"]}'),
('navigation:Tabs', 'Tab navigation component', 'component', false, '["ui", "navigation", "tabs"]', '{"type": "navigation", "style": "tabs"}'),

-- UI Components (Modals and Overlays)
('modal:Dialog', 'Modal dialog component', 'component', false, '["ui", "modal", "dialog"]', '{"type": "modal", "overlay": true}'),
('menu:DropdownMenu', 'Dropdown menu component', 'component', false, '["ui", "menu", "dropdown"]', '{"type": "menu", "trigger": "click"}'),

-- UI Components (Layout)
('form:Label', 'Form label component', 'component', false, '["ui", "form", "label"]', '{"type": "form", "helper": true}'),
('layout:Separator', 'Visual separator component', 'component', false, '["ui", "layout", "separator"]', '{"type": "layout", "divider": true}');