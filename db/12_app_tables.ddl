-- ============================================================================
-- APPLICATION SCOPE TABLE (Unified Components, Routes, and API Paths)
-- ============================================================================

-- ============================================================================
-- SEMANTIC DESCRIPTION:
-- ============================================================================ 
-- 
-- The d_scope_app table serves as the unified registry and foundation for the entire 
-- application's permission and access control system. It consolidates three critical 
-- application elements into a single, cohesive data structure:
--
-- 1. FRONTEND PAGES: All user-facing routes and screens (/dashboard, /projects, /admin/*)
-- 2. BACKEND APIs: All server endpoints and microservices (/api/v1/emp, /api/v1/project)  
-- 3. UI COMPONENTS: Reusable interface elements (DataTable, Modal, Button, etc.)
--
-- ARCHITECTURAL PURPOSE:
-- This table replaces the fragmented approach of separate app_scope_d_route_page and 
-- app_scope_d_component tables, providing a unified foundation for:
--
-- • GRANULAR RBAC: Enable permission control at page, API endpoint, and component levels
-- • DYNAMIC UI: Generate navigation, menus, and interfaces based on user permissions
-- • SECURITY ENFORCEMENT: Centralized access control for all application touchpoints
-- • AUDIT & COMPLIANCE: Complete traceability of user interactions across the system
-- • MICROSERVICE COORDINATION: Unified scope reference for distributed service authorization
--
-- PERMISSION INTEGRATION:
-- Each record in d_scope_app can be referenced by the d_scope table, which then connects
-- to the role-based permission system (rel_role_scope, rel_user_scope). This creates a
-- three-tier authorization model:
--
-- User/Role → d_scope → d_scope_app → Actual Resource (Page/API/Component)
--
-- SCOPE_TYPE SEMANTICS:
-- • 'page': Frontend routes that users navigate to. Protected pages require authentication
--           and specific permissions. Used for navigation generation and route protection.
-- • 'api-path': Backend endpoints that process business logic. Each API requires specific
--               permissions for CRUD operations. Used for request authorization.
-- • 'component': UI building blocks that may contain sensitive data or functionality.
--                Fine-grained component permissions enable hiding/showing interface elements.
--
-- SCOPE_PATH UNIFICATION:
-- The scope_path field serves different purposes based on scope_type:
-- • Pages: URL routes (/admin/users, /projects/:id)
-- • APIs: Endpoint paths (/api/v1/emp, /api/v1/project/:id)  
-- • Components: Component identifiers with optional type prefixes (datatable:UserList, modal:EditUser)
--
-- HIERARCHICAL RELATIONSHIPS:
-- parent_id enables nested permission inheritance:
-- • Admin Dashboard ← Admin User Management ← User Detail Modal ← User Edit Form
-- • Each child inherits parent permissions unless explicitly overridden
--
-- METADATA ENRICHMENT:
-- • tags: Categorization for filtering and grouping (["admin", "hr"], ["ui", "form"])
-- • attr: Extended properties (icons, HTTP methods, component variants, feature flags)
-- • is_protected: Security flag for authentication requirements
--
-- REAL-WORLD USAGE SCENARIOS:
--
-- 1. DYNAMIC NAVIGATION: Frontend queries d_scope_app for 'page' types, filtered by user
--    permissions, to build personalized navigation menus and breadcrumbs.
--
-- 2. API GATEWAY: Backend middleware checks d_scope_app for 'api-path' types to validate
--    whether the requesting user has permission to access specific endpoints.
--
-- 3. COMPONENT RENDERING: UI framework queries for 'component' types to determine which
--    interface elements to render based on user's granular permissions.
--
-- 4. AUDIT LOGGING: All user interactions reference d_scope_app entries, providing
--    complete audit trails of what users accessed, when, and with what permissions.
--
-- 5. ADMIN INTERFACES: Permission management screens use this table to present 
--    administrators with all available resources for permission assignment.
--
-- 6. FEATURE FLAGS: The attr column can store feature toggles, A/B test configurations,
--    and environment-specific settings for dynamic application behavior.
--
-- INTEGRATION WITH PMO WORKFLOW:
-- In the PMO context, this enables scenarios like:
-- • Project Managers see project pages/APIs but not HR management interfaces
-- • HR staff access employee components but not financial project data  
-- • Contractors view task-related APIs but cannot access admin configuration
-- • Executives see dashboard components with aggregated data across all scopes
--
-- This unified approach transforms traditional role-based access into a sophisticated,
-- fine-grained permission system that scales with organizational complexity while
-- maintaining security, auditability, and user experience optimization.

-- ============================================================================
-- DDL (Data Definition Language):
-- ============================================================================

-- Unified App Scope Table for components, pages, and API paths
CREATE TABLE app.d_scope_app (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL, -- 'component', 'page', 'api-path'
  scope_path text NOT NULL, -- unified: route path for pages/api-paths, component name for components, with optional type prefix for components (e.g., 'datatable:UserList', 'modal:EditUser', '/admin/users', '/api/users')
  name text NOT NULL,
  "descr" text,
  parent_id uuid REFERENCES app.d_scope_app(id) ON DELETE SET NULL,
  is_protected boolean NOT NULL DEFAULT false,
  props_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of component IDs this depends on
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT chk_scope_type CHECK (scope_type IN ('component', 'page', 'api-path')),
  UNIQUE(name, scope_type, active),
  UNIQUE(scope_path, scope_type, active)
);

-- ============================================================================
-- DATA CURATION (Synthetic Data Generation):
-- ============================================================================

-- Insert Pages (Frontend Routes)
INSERT INTO app.d_scope_app (name, "descr", scope_type, scope_path, is_protected, tags, attr) VALUES
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
INSERT INTO app.d_scope_app (name, "descr", scope_type, scope_path, is_protected, tags, attr) VALUES
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
INSERT INTO app.d_scope_app (name, "descr", scope_type, scope_path, is_protected, tags, attr) VALUES
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