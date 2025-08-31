
/**
 * UI Permission RBAC System
 * 
 * This module provides a comprehensive, employee-focused RBAC system for frontend 
 * component, page, and API gating. All functions use employee_id instead of user_id 
 * to align with the application's employee-centric data model.
 * 
 * Architecture Overview:
 * 1. Fine-grained App-level Functions (Component/Page/API gating)
 * 2. Resource-specific Permission Functions (Project/Task/HR/Business/etc.)
 * 3. Bulk Permission Retrieval Functions (All scopes for a type)
 * 
 * Scope Name vs Scope ID:
 * - scope_name: Human-readable identifiers like "/employees", "TaskBoard", "/api/v1/auth"
 * - scope_table_reference_id: UUID references to actual data records in reference tables
 */

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Permission levels as defined in rel_employee_scope_unified.resource_permission
 * 0: view, 1: modify, 2: share, 3: delete, 4: create
 */
export enum Permission {
  VIEW = 0,
  MODIFY = 1, 
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
}

/**
 * Standard scope action mappings for consistent permission checking
 */
export type ScopeAction = 'view' | 'modify' | 'share' | 'delete' | 'create';

/**
 * Result structure for employee scope queries
 */
export interface EmployeeScope {
  scopeId: string;
  scopeName: string;
  permissions: Permission[];
}

/**
 * 🔐 APP-LEVEL PERMISSION FUNCTIONS
 * These functions handle application-level gating (components, pages, APIs)
 * using scope_name for identification
 */

/**
 * FUNCTION 1A: hasPermissionOnComponent - Frontend Component Gating
 * 
 * 🎯 WHO CALLS: React/Vue components, UI libraries, conditional rendering logic
 * 🔍 PATTERN: Component-level show/hide, feature toggles, UI element gating
 * 📍 SCOPE: Always uses scope_type = 'app:component'
 * 
 * Use Cases:
 * - Show/hide buttons: hasPermissionOnComponent(empId, "app:component", "TaskBoard", "view")
 * - Conditional rendering: hasPermissionOnComponent(empId, "app:component", "datatable:DataTable", "modify")
 * - Feature flags: hasPermissionOnComponent(empId, "app:component", "AdminPanel", "create")
 * 
 * Scope Name Examples:
 * - "TaskBoard" (Main task management component)
 * - "datatable:DataTable" (Reusable data table component)
 * - "ProjectForm" (Project creation/editing form)
 * - "UserProfile" (User profile management component)
 * 
 * @param employeeId - The employee's unique identifier  
 * @param scopeType - Must be 'app:component' for component-level checks
 * @param scopeName - Component identifier from d_scope_app.scope_name
 * @param action - The action being attempted ('view', 'modify', 'share', 'delete', 'create')
 * @returns Promise<boolean> - True if employee can perform action on component
 */
export async function hasPermissionOnComponent(
  employeeId: string,
  scopeType: string,
  scopeName: string,
  action: ScopeAction
): Promise<boolean> {
  return await hasPermissionByName(employeeId, scopeType, scopeName, action);
}

/**
 * FUNCTION 1B: hasPermissionOnPage - Frontend Page Access Control
 * 
 * 🎯 WHO CALLS: Router guards, navigation middleware, page-level components
 * 🔍 PATTERN: Route protection, page access control, navigation menu filtering
 * 📍 SCOPE: Always uses scope_type = 'app:page'
 * 
 * Use Cases:
 * - Route guards: hasPermissionOnPage(empId, "app:page", "/employees", "view")
 * - Menu visibility: hasPermissionOnPage(empId, "app:page", "/projects", "view")
 * - Page redirection: hasPermissionOnPage(empId, "app:page", "/reports/analytics", "view")
 * 
 * Scope Name Examples:
 * - "/employees" (Employee management page)
 * - "/projects" (Project listing/management page)
 * - "/reports/analytics" (Analytics dashboard)
 * - "/settings/permissions" (Permission management page)
 * 
 * @param employeeId - The employee's unique identifier
 * @param scopeType - Must be 'app:page' for page-level checks
 * @param scopeName - Page route/path from d_scope_app.scope_name
 * @param action - The action being attempted ('view', 'modify', 'share', 'delete', 'create')
 * @returns Promise<boolean> - True if employee can access the page
 */
export async function hasPermissionOnPage(
  employeeId: string,
  scopeType: string,
  scopeName: string,
  action: ScopeAction
): Promise<boolean> {
  return await hasPermissionByName(employeeId, scopeType, scopeName, action);
}

/**
 * FUNCTION 1C: hasPermissionOnAPI - Backend API Endpoint Authorization
 * 
 * 🎯 WHO CALLS: API route handlers, middleware, authentication guards
 * 🔍 PATTERN: API endpoint protection, operation authorization, service access control
 * 📍 SCOPE: Always uses scope_type = 'app:api'
 * 
 * Use Cases:
 * - API middleware: hasPermissionOnAPI(empId, "app:api", "/api/v1/auth/logout", "create")
 * - Endpoint protection: hasPermissionOnAPI(empId, "app:api", "/api/v1/task", "view")
 * - Operation gating: hasPermissionOnAPI(empId, "app:api", "/api/v1/projects", "modify")
 * 
 * Scope Name Examples:
 * - "/api/v1/auth/logout" (Authentication logout endpoint)
 * - "/api/v1/task" (Task management API endpoints)
 * - "/api/v1/projects" (Project CRUD operations)
 * - "/api/v1/reports/generate" (Report generation endpoint)
 * 
 * @param employeeId - The employee's unique identifier
 * @param scopeType - Must be 'app:api' for API-level checks
 * @param scopeName - API endpoint path from d_scope_app.scope_name
 * @param action - The action being attempted ('view', 'modify', 'share', 'delete', 'create')
 * @returns Promise<boolean> - True if employee can access the API endpoint
 */
export async function hasPermissionOnAPI(
  employeeId: string,
  scopeType: string,
  scopeName: string,
  action: ScopeAction
): Promise<boolean> {
  return await hasPermissionByName(employeeId, scopeType, scopeName, action);
}

/**
 * CORE HELPER: hasPermissionByName - Internal function for scope_name-based checks
 * 
 * This is the underlying implementation used by all app-level permission functions.
 * It checks permissions using scope_name (human-readable identifiers) rather than UUIDs.
 * 
 * @param employeeId - The employee's unique identifier
 * @param scopeType - The scope type ('app:component', 'app:page', 'app:api')
 * @param scopeName - The human-readable scope identifier
 * @param action - The action being attempted
 * @returns Promise<boolean> - True if employee has the required permission
 */
async function hasPermissionByName(
  employeeId: string,
  scopeType: string,
  scopeName: string,
  action: ScopeAction
): Promise<boolean> {
  
  if (!employeeId) {
    return false;
  }

  // Map action to permission level
  const actionToPermission: Record<ScopeAction, Permission> = {
    view: Permission.VIEW,
    modify: Permission.MODIFY,
    share: Permission.SHARE,
    delete: Permission.DELETE,
    create: Permission.CREATE,
  };

  const requiredPermission = actionToPermission[action];
  
  // For development mode with OIDC bypass, allow all access
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return true;
  }
  
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM app.rel_employee_scope_unified 
      WHERE emp_id = ${employeeId} 
        AND scope_type = ${scopeType} 
        AND scope_name = ${scopeName}
        AND active = true
        AND ${requiredPermission} = ANY(resource_permission)
    `);
    return Number(result[0]?.count || 0) > 0;
    
  } catch (error) {
    console.error('Error checking employee permission:', error);
    return false;
  }
}

/**
 * FUNCTION 2: getEmployeeScopes - Page-level Scope Access
 * 
 * Usage: Frontend pages use this to get all accessible scopes for data filtering
 * Example: getEmployeeScopes(employeeId, 'project', 'view') -> EmployeeScope[] gives the list of project ids that are 
 * viewable by this employee
 * 
 * Use cases:
 * - Populate dropdown lists with accessible scopes
 * - Filter data tables based on employee access
 * - Build dynamic navigation menus
 * - Implement scope-based data pagination
 * 
 * @param employeeId - The employee's unique identifier
 * @param scopeType - The resource scope type to query
 * @param minPermission - Minimum permission level required (defaults to VIEW)
 * @returns Promise<EmployeeScope[]> - Array of accessible scopes with their permissions
 */
export async function getEmployeeScopeIdsByScopeType(
  employeeId: string,
  scopeType: string,
  minPermission: Permission = Permission.VIEW
): Promise<EmployeeScope[]> {
  
  if (!employeeId) {
    return [];
  }

  // For development mode with OIDC bypass, return mock data
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return [
      {
        scopeId: 'mock-scope-id',
        scopeName: `Mock ${scopeType} Scope`,
        permissions: [Permission.VIEW, Permission.MODIFY, Permission.SHARE, Permission.DELETE, Permission.CREATE]
      }
    ];
  }
  
  try {
    const scopes = await db.execute(sql`
      SELECT 
        scope_table_reference_id, 
        resource_permission,
        scope_name
      FROM app.rel_employee_scope_unified
      WHERE emp_id = ${employeeId} 
        AND scope_type = ${scopeType} 
        AND active = true
        AND ${minPermission} = ANY(resource_permission)
      ORDER BY scope_name
    `);

    return scopes.map(scope => ({
      scopeId: (scope.scope_table_reference_id as string | null) || '',
      scopeName: (scope.scope_name as string) || 'Unknown',
      permissions: (Array.isArray(scope.resource_permission) ? scope.resource_permission : []) as Permission[],
    }));
    
  } catch (error) {
    console.error('Error getting employee scopes:', error);
    return [];
  }
}

/**
 * FUNCTION 3: hasPermissionOnScopeId - Quick Permission Check by Scope ID
 * 
 * 🎯 WHO CALLS: API middleware, quick authorization checks, component guards
 * 🔍 PATTERN: Fast boolean checks for specific resource access
 * 📍 SCOPE: Works with any scope_type using UUID reference IDs
 * 
 * Use cases:
 * - Quick API checks: hasPermissionOnScopeId(empId, 'project', 'uuid-of-project', 'modify') -> boolean
 * - Component guards: hasPermissionOnScopeId(empId, 'task', 'uuid-of-task', 'view') -> boolean
 * - Middleware validation: hasPermissionOnScopeId(empId, 'business', 'uuid-of-business', 'delete') -> boolean
 * 
 * @param employeeId - The employee's unique identifier
 * @param scopeType - The resource scope type being accessed
 * @param scopeId - The specific scope UUID (scope_table_reference_id)
 * @param action - The action being attempted
 * @returns Promise<boolean> - True if employee has the required permission on this specific scope
 */
export async function hasPermissionOnScopeId(
  employeeId: string,
  scopeType: string,
  scopeId: string,
  action: ScopeAction
): Promise<boolean> {
  
  if (!employeeId || !scopeId) {
    return false;
  }

  // Map action to permission level
  const actionToPermission: Record<ScopeAction, Permission> = {
    view: Permission.VIEW,
    modify: Permission.MODIFY,
    share: Permission.SHARE,
    delete: Permission.DELETE,
    create: Permission.CREATE,
  };

  const requiredPermission = actionToPermission[action];

  // For development mode with OIDC bypass, return true
  if (process.env.DEV_BYPASS_OIDC === 'true') {
    return true;
  }
  
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM app.rel_employee_scope_unified 
      WHERE emp_id = ${employeeId} 
        AND scope_type = ${scopeType} 
        AND scope_table_reference_id = ${scopeId}
        AND active = true
        AND ${requiredPermission} = ANY(resource_permission)
    `);
    
    return Number(result[0]?.count || 0) > 0;
    
  } catch (error) {
    console.error('Error checking permission on scope ID:', error);
    return false;
  }
}


/**
 * UTILITY: Get just scope IDs for database query filtering
 * 
 * Helper function that returns just the scope IDs for building 
 * database WHERE clauses and query filters.
 */
export async function getEmployeeScopeIds(
  employeeId: string,
  scopeType: string,
  minPermission: Permission = Permission.VIEW
): Promise<string[]> {
  
  const scopes = await getEmployeeScopeIdsByScopeType(employeeId, scopeType, minPermission);
  return scopes.map(scope => scope.scopeId).filter(Boolean);
}