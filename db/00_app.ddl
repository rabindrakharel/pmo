-- ============================================================================
-- APP (Application foundational tables)
-- 
-- This file contains application-level tables that are referenced by other
-- domain tables. These should be loaded early in the installation process.
-- ============================================================================

-- App-specific permission levels
CREATE TABLE app.d_app_permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,  -- 'CREATE', 'DELETE', 'EDIT', 'GRANT', 'VIEW'
  "descr" text,
  sort_id int NOT NULL,
  is_system boolean NOT NULL DEFAULT false,  -- System permissions cannot be deleted
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now()
);

-- Insert default app permission levels
INSERT INTO app.d_app_permission (name, code, "descr", sort_id, is_system) VALUES
  ('Create', 'CREATE', 'Permission to create new entities', 1, true),
  ('Modify', 'MODIFY', 'Permission to modify existing entities', 2, true),
  ('Delete', 'DELETE', 'Permission to delete entities', 3, true),
  ('Grant', 'GRANT', 'Permission to grant permissions to others', 4, true);

-- ============================================================================
-- PERMISSION SYSTEM DOCUMENTATION
-- ============================================================================
/*
PERMISSION RESOLUTION LOGIC FOR DATA ACCESS AND OPERATIONS

This system handles complex permission scenarios through a hierarchical approach:

1. USER AUTHENTICATION & ROLE ASSIGNMENT
2. DATA ACCESS CONTROL (What data the user can see)
3. OPERATION PERMISSIONS (What actions the user can perform)
4. HIERARCHICAL INHERITANCE (How permissions flow down)

============================================================================
USER LOGIN & DATA ACCESS RESOLUTION
============================================================================

When a user logs in, the system determines their access through:

1. EMPLOYEE → ROLE ASSIGNMENT
   - User is linked to roles via rel_emp_role table
   - Multiple roles can be active simultaneously
   - Each role has specific scoping and permissions

2. ROLE SCOPING TYPES
   a) GLOBAL ROLES: No specific entity scoping (hr_specific = true)
   b) ENTITY-SPECIFIC ROLES: Scoped to specific projects, tasks, locations, etc.
   c) HYBRID ROLES: Combination of global and specific permissions

3. DATA VISIBILITY RULES
   - User sees data based on their role assignments
   - Entity-specific roles limit data to specific entities
   - Global roles provide broader access
   - Union of all active role permissions determines final access

============================================================================
PERMISSION RESOLUTION ALGORITHM
============================================================================

For any operation (CREATE, MODIFY, DELETE, GRANT), the system follows this logic:

1. IDENTIFY USER'S ROLES
   SELECT role_id FROM app.rel_emp_role 
   WHERE emp_id = ? AND active = true

2. FOR EACH ROLE, CHECK PERMISSIONS:
   
   A) APP-LEVEL PERMISSIONS (d_role.app_permissions)
      - Direct array of d_app_permission.id values
      - Example: ['CREATE', 'MODIFY'] means user can create and modify
   
   B) ENTITY-SPECIFIC PERMISSIONS
      - project_permission: JSONB with {'create': 1, 'modify': 1}
      - task_permission: JSONB with {'create': 1, 'modify': 1}
      - location_permission: JSONB with {'create': 1, 'modify': 1}
      - business_permission: JSONB with {'create': 1, 'modify': 1}
      - hr_permission: JSONB with {'create': 1, 'modify': 1}
      - worksite_permission: JSONB with {'create': 1, 'modify': 1}

3. PERMISSION PRECEDENCE:
   - Entity-specific permissions OVERRIDE global permissions for that entity
   - If user has both specific and global permissions, specific applies to that entity
   - Global permissions apply to all other entities

============================================================================
SPECIFIC SCENARIOS & RESOLUTION
============================================================================

SCENARIO 1: User wants to create a task within a project

1. CHECK PROJECT ACCESS:
   - Does user have a role with project_specific = true AND project_id = target_project?
   - If YES: Check project_permission JSONB for 'create': 1
   - If NO: Check if user has global CREATE permission via app_permissions

2. CHECK TASK CREATION PERMISSION:
   - Does user have a role with task_specific = true AND task_id = parent_task (if any)?
   - If YES: Check task_permission JSONB for 'create': 1
   - If NO: Check if user has global CREATE permission via app_permissions

3. RESOLUTION:
   - If ANY role grants CREATE permission (either specific or global), allow task creation
   - If NO roles grant CREATE permission, deny task creation

SCENARIO 2: User wants to create a project within a business

1. CHECK BUSINESS ACCESS:
   - Does user have a role with business_specific = true AND biz_id = target_business?
   - If YES: Check business_permission JSONB for 'create': 1
   - If NO: Check if user has global CREATE permission via app_permissions

2. CHECK LOCATION ACCESS (if project is location-specific):
   - Does user have a role with location_specific = true AND location_id = target_location?
   - If YES: Check location_permission JSONB for 'create': 1
   - If NO: Check if user has global CREATE permission via app_permissions

3. RESOLUTION:
   - If ANY role grants CREATE permission for the business/location, allow project creation
   - If NO roles grant CREATE permission, deny project creation

SCENARIO 3: User wants to modify data they can see

1. CHECK DATA VISIBILITY:
   - User can see data based on their role scoping
   - Entity-specific roles limit data to specific entities
   - Global roles provide broader data access

2. CHECK MODIFY PERMISSION:
   - Same logic as CREATE, but checking for 'modify': 1 in permissions
   - Entity-specific permissions take precedence over global permissions

3. RESOLUTION:
   - User can modify data they can see AND have modify permission for
   - Permission checking happens at the entity level (project, task, location, etc.)

============================================================================
IMPLEMENTATION EXAMPLES
============================================================================

EXAMPLE 1: Check if user can create a task in a project

```sql
-- Function to check task creation permission
CREATE OR REPLACE FUNCTION check_task_create_permission(
  p_user_id uuid,
  p_project_id uuid,
  p_parent_task_id uuid DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  has_permission boolean := false;
  role_record record;
BEGIN
  -- Check each active role for the user
  FOR role_record IN 
    SELECT r.*, rel.active as role_active
    FROM app.d_role r
    JOIN app.rel_emp_role rel ON r.id = rel.role_id
    WHERE rel.emp_id = p_user_id AND rel.active = true AND r.active = true
  LOOP
    -- Check app-level CREATE permission
    IF EXISTS (
      SELECT 1 FROM unnest(role_record.app_permissions) AS perm_id
      JOIN app.d_app_permission ap ON ap.id = perm_id
      WHERE ap.code = 'CREATE'
    ) THEN
      has_permission := true;
      EXIT;
    END IF;
    
    -- Check project-specific permission
    IF role_record.project_specific AND role_record.project_id = p_project_id THEN
      IF (role_record.project_permission->>'create')::int = 1 THEN
        has_permission := true;
        EXIT;
      END IF;
    END IF;
    
    -- Check parent task permission if applicable
    IF p_parent_task_id IS NOT NULL AND role_record.task_specific AND role_record.task_id = p_parent_task_id THEN
      IF (role_record.task_permission->>'create')::int = 1 THEN
        has_permission := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql;
```

EXAMPLE 2: Get user's accessible projects

```sql
-- Function to get user's accessible projects
CREATE OR REPLACE FUNCTION get_user_projects(p_user_id uuid) 
RETURNS TABLE(project_id uuid, project_name text, access_level text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    ph.id,
    ph.name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM app.d_role r
        JOIN app.rel_emp_role rel ON r.id = rel.role_id
        WHERE rel.emp_id = p_user_id 
          AND rel.active = true 
          AND r.active = true
          AND r.project_specific = true 
          AND r.project_id = ph.id
      ) THEN 'specific'
      WHEN EXISTS (
        SELECT 1 FROM app.d_role r
        JOIN app.rel_emp_role rel ON r.id = rel.role_id
        WHERE rel.emp_id = p_user_id 
          AND rel.active = true 
          AND r.active = true
          AND r.hr_specific = true
      ) THEN 'global'
      ELSE 'none'
    END as access_level
  FROM app.ops_project_head ph
  WHERE EXISTS (
    SELECT 1 FROM app.d_role r
    JOIN app.rel_emp_role rel ON r.id = rel.role_id
    WHERE rel.emp_id = p_user_id 
      AND rel.active = true 
      AND r.active = true
      AND (
        -- Project-specific role
        (r.project_specific = true AND r.project_id = ph.id)
        OR
        -- Global role via HR
        (r.hr_specific = true)
        OR
        -- Location-based role
        (r.location_specific = true AND r.location_id = ph.location_id)
        OR
        -- Business-based role
        (r.business_specific = true AND r.biz_id = ph.biz_id)
      )
  );
END;
$$ LANGUAGE plpgsql;
```

============================================================================
PERMISSION CACHING & PERFORMANCE
============================================================================

For performance, consider caching user permissions:

1. USER PERMISSION CACHE:
   - Cache resolved permissions in Redis/application memory
   - Invalidate cache when role assignments change
   - Cache includes: accessible entities, operation permissions

2. PERMISSION LOOKUP OPTIMIZATION:
   - Use database indexes on role scoping fields
   - Consider materialized views for complex permission queries
   - Batch permission checks where possible

============================================================================
SECURITY CONSIDERATIONS
============================================================================

1. PERMISSION VALIDATION:
   - Always validate permissions on both client and server side
   - Use parameterized queries to prevent SQL injection
   - Log all permission checks for audit purposes

2. ROLE ESCALATION PREVENTION:
   - Users cannot grant permissions they don't have
   - Role modifications require GRANT permission
   - System permissions cannot be modified by regular users

3. DATA LEAKAGE PREVENTION:
   - Filter data at the database level, not just application level
   - Use row-level security where appropriate
   - Validate entity ownership before allowing operations

============================================================================
TROUBLESHOOTING PERMISSION ISSUES
============================================================================

Common issues and solutions:

1. USER CAN'T SEE EXPECTED DATA:
   - Check if user has active role assignments
   - Verify role scoping (entity-specific vs global)
   - Check if role is active and not expired

2. USER CAN'T PERFORM EXPECTED OPERATIONS:
   - Verify app_permissions array contains required permission codes
   - Check entity-specific permissions for target entities
   - Ensure role is not expired or inactive

3. PERMISSION INHERITANCE NOT WORKING:
   - Verify global role permissions are properly set
   - Check role precedence (specific overrides global)
   - Ensure role assignments are active

4. PERFORMANCE ISSUES:
   - Check database indexes on permission fields
   - Consider caching frequently accessed permissions
   - Optimize permission checking queries
*/
