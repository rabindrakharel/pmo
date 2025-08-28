-- ============================================================================
-- ROUTE PAGE AND COMPONENT PERMISSIONS
-- For route pages and components, users only get permission level 0 (view)
-- ============================================================================

-- Route page permissions in rel_user_scope (scope_type = 'route_page', permission = [0])
INSERT INTO app.rel_user_scope (emp_id, scope_type, scope_id, scope_name, scope_permission, tags) VALUES

-- John Smith (Project Manager) - Route page access
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 'Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects'),
 'Projects List', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects/:id'),
 'Project Details', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks'),
 'Tasks Board', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/employees'),
 'Employees', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/clients'),
 'Clients', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/reports'),
 'Reports', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/profile'),
 'User Profile', ARRAY[0]::smallint[], '[]'::jsonb),

-- Jane Doe (Senior Developer) - Route page access
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 'Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects'),
 'Projects List', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks'),
 'Tasks Board', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/profile'),
 'User Profile', ARRAY[0]::smallint[], '[]'::jsonb),

-- Bob Wilson (System Administrator) - Full route access
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 'Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin'),
 'Admin Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/locations'),
 'Locations', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/businesses'),
 'Business Units', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/hr'),
 'HR Departments', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/roles'),
 'Role Management', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/admin/meta'),
 'Meta Configuration', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/settings'),
 'Settings', ARRAY[0]::smallint[], '[]'::jsonb),

-- Alice Johnson (Designer) - Route page access
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 'Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/projects'),
 'Projects List', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/profile'),
 'User Profile', ARRAY[0]::smallint[], '[]'::jsonb),

-- Mike Chen (Developer) - Route page access
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 'Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks'),
 'Tasks Board', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/profile'),
 'User Profile', ARRAY[0]::smallint[], '[]'::jsonb),

-- Sarah Lee (QA Engineer) - Route page access
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/dashboard'),
 'Dashboard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/tasks'),
 'Tasks Board', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'route_page', (SELECT id FROM app.app_scope_d_route_page WHERE route_path = '/profile'),
 'User Profile', ARRAY[0]::smallint[], '[]'::jsonb);

-- Component permissions in rel_user_scope (scope_type = 'component', permission = [0])
INSERT INTO app.rel_user_scope (emp_id, scope_type, scope_id, scope_name, scope_permission, tags) VALUES

-- John Smith - Component access (key components)
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'DataTable'),
 'DataTable', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityForm'),
 'EntityForm', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'TaskCard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'ProjectHeader'),
 'ProjectHeader', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'John Smith'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'EntityManagementPage', ARRAY[0]::smallint[], '[]'::jsonb),

-- Jane Doe - Component access 
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'TaskCard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Jane Doe'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityForm'),
 'EntityForm', ARRAY[0]::smallint[], '[]'::jsonb),

-- Bob Wilson - All component access (system admin)
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'DataTable'),
 'DataTable', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityManagementPage'),
 'EntityManagementPage', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'PermissionGate'),
 'PermissionGate', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Bob Wilson'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'Navigation'),
 'Navigation', ARRAY[0]::smallint[], '[]'::jsonb),

-- Alice Johnson - Design components
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'EntityForm'),
 'EntityForm', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Alice Johnson'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'Navigation'),
 'Navigation', ARRAY[0]::smallint[], '[]'::jsonb),

-- Mike Chen - Development components
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'TaskCard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Mike Chen'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'DataTable'),
 'DataTable', ARRAY[0]::smallint[], '[]'::jsonb),

-- Sarah Lee - QA components
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'TaskCard'),
 'TaskCard', ARRAY[0]::smallint[], '[]'::jsonb),
((SELECT id FROM app.d_emp WHERE name = 'Sarah Lee'),
 'component', (SELECT id FROM app.app_scope_d_component WHERE name = 'SearchBar'),
 'SearchBar', ARRAY[0]::smallint[], '[]'::jsonb);
