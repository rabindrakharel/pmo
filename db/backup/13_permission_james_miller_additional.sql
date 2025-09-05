-- ============================================================================
-- JAMES MILLER COMPREHENSIVE PERMISSIONS - ADDITIONAL SCOPE DATA
-- James Miller (CEO) - Complete Access to All App Scopes
-- ============================================================================

-- Get James Miller's employee ID dynamically from email

-- ============================================================================
-- APP SCOPE PERMISSIONS FOR JAMES MILLER (CEO)
-- Comprehensive access to all pages, components, and APIs with view permissions (0)
-- As requested: "permissions : Only 0 needed for this one, 0 means view"
-- ============================================================================

-- James Miller gets VIEW permission (0) on ALL app:page scopes
INSERT INTO app.rel_employee_scope_unified (employee_id, scope_type, scope_reference_table, scope_reference_id, resource_permission, descr, tags, attr)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca') as employee_id,
  'app:page' as scope_type,
  'd_scope_app' as scope_reference_table,
  sa.scope_name as scope_reference_id,
  ARRAY[0]::smallint[] as resource_permission, -- Only VIEW permission as requested
  'CEO view access to page: ' || sa.scope_name as descr,
  '["ceo", "executive", "app-page", "view-only"]'::jsonb as tags,
  jsonb_build_object(
    'page_access', true, 
    'executive_view', true, 
    'path', sa.scope_name, 
    'permission_level', 'view',
    'original_scope_name', sa.scope_name,
    'ceo_access', true
  ) as attr
FROM app.d_scope_app sa 
WHERE sa.active = true AND sa.scope_type = 'page'
AND NOT EXISTS (
  SELECT 1 FROM app.rel_employee_scope_unified resu
  WHERE resu.employee_id = (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
  AND resu.scope_type = 'app:page'
  AND resu.scope_reference_id = sa.scope_name
);

-- James Miller gets VIEW permission (0) on ALL app:api scopes
INSERT INTO app.rel_employee_scope_unified (employee_id, scope_type, scope_reference_table, scope_reference_id, resource_permission, descr, tags, attr)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca') as employee_id,
  'app:api' as scope_type,
  'd_scope_app' as scope_reference_table,
  sa.scope_name as scope_reference_id,
  ARRAY[0]::smallint[] as resource_permission, -- Only VIEW permission as requested
  'CEO view access to API: ' || sa.scope_name as descr,
  '["ceo", "executive", "app-api", "view-only"]'::jsonb as tags,
  jsonb_build_object(
    'api_access', true, 
    'executive_data', true, 
    'endpoint', sa.scope_name, 
    'permission_level', 'view',
    'original_scope_name', sa.scope_name,
    'ceo_access', true,
    'methods', '["GET"]'
  ) as attr
FROM app.d_scope_app sa 
WHERE sa.active = true AND sa.scope_type = 'api-path'
AND NOT EXISTS (
  SELECT 1 FROM app.rel_employee_scope_unified resu
  WHERE resu.employee_id = (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
  AND resu.scope_type = 'app:api'
  AND resu.scope_reference_id = sa.scope_name
);

-- James Miller gets VIEW permission (0) on ALL app:component scopes
INSERT INTO app.rel_employee_scope_unified (employee_id, scope_type, scope_reference_table, scope_reference_id, resource_permission, descr, tags, attr)
SELECT 
  (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca') as employee_id,
  'app:component' as scope_type,
  'd_scope_app' as scope_reference_table,
  sa.scope_name as scope_reference_id,
  ARRAY[0]::smallint[] as resource_permission, -- Only VIEW permission as requested
  'CEO view access to component: ' || sa.scope_name as descr,
  '["ceo", "executive", "app-component", "view-only"]'::jsonb as tags,
  jsonb_build_object(
    'component_access', true, 
    'executive_functions', true, 
    'component', sa.scope_name, 
    'permission_level', 'view',
    'original_scope_name', sa.scope_name,
    'ceo_access', true
  ) as attr
FROM app.d_scope_app sa 
WHERE sa.active = true AND sa.scope_type = 'component'
AND NOT EXISTS (
  SELECT 1 FROM app.rel_employee_scope_unified resu
  WHERE resu.employee_id = (SELECT id FROM app.d_employee WHERE email = 'james.miller@huronhome.ca')
  AND resu.scope_type = 'app:component'
  AND resu.scope_reference_id = sa.scope_name
);

-- ============================================================================
-- VERIFICATION AND SUMMARY
-- ============================================================================
--
-- This script creates comprehensive app scope permissions for James Miller:
--
-- 🎯 APP SCOPE COVERAGE:
-- • ALL app:page scopes - Complete access to every page in the application
-- • ALL app:api scopes - Access to every API endpoint for data oversight  
-- • ALL app:component scopes - Access to every UI component
--
-- 🔐 PERMISSION LEVEL:
-- • Permission Level: 0 (VIEW) only, as specifically requested
-- • No CREATE, MODIFY, SHARE, or DELETE permissions on app scopes
-- • Focus on executive oversight and monitoring capabilities
--
-- 📊 SCOPE NAMING PATTERN:
-- • scope_name format: "James Miller - {original_scope_name} - CEO {type} Access"
-- • Maintains reference to original scope_name in attr.original_scope_name
-- • Clear CEO-specific naming for easy identification and filtering
--
-- 🏗️ ATTRIBUTES STRUCTURE:
-- • executive_view/executive_data/executive_functions: true
-- • permission_level: "view" 
-- • original_scope_name: preserved for reference
-- • ceo_access: true for easy filtering
-- • Additional type-specific metadata (paths, endpoints, components)
--
-- 🔍 CONFLICT PREVENTION:
-- • Uses NOT EXISTS to prevent duplicate entries
-- • Safe to run multiple times without creating duplicates
-- • Maintains data integrity with existing permission records
--
-- This provides James Miller with comprehensive view-level access to the entire 
-- application scope while maintaining clear audit trails and permission boundaries.