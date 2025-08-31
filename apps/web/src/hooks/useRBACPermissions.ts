/**
 * RBAC Permissions Hook
 * 
 * This hook fetches employee permissions for a given scope type using the
 * new RBAC system. It calls getEmployeeScopeIdsByScopeType() to get all
 * accessible resources with their permissions.
 * 
 * Features:
 * - Fetches permissions on mount and when scope type changes
 * - Caches permissions by scope type
 * - Handles authentication state
 * - Provides loading states
 * - Optimizes for component rendering
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Permission levels from RBAC system
export const Permission = {
  VIEW: 0,
  MODIFY: 1,
  SHARE: 2,
  DELETE: 3,
  CREATE: 4,
} as const

export type PermissionLevel = typeof Permission[keyof typeof Permission]

// Employee scope with permissions
export interface EmployeeScope {
  scopeId: string
  scopeName: string
  permissions: PermissionLevel[]
}

// Hook return type
interface UseRBACPermissionsResult {
  permissions: Record<string, PermissionLevel[]> // scopeId -> permissions array
  scopes: EmployeeScope[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Cache for permissions by scope type
const permissionsCache = new Map<string, {
  permissions: Record<string, PermissionLevel[]>
  scopes: EmployeeScope[]
  timestamp: number
  employeeId: string
}>()

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Hook to fetch and manage RBAC permissions for a specific scope type
 * 
 * @param scopeType - The scope type to fetch permissions for ('project', 'task', etc.)
 * @param minPermission - Minimum permission level required (defaults to VIEW)
 * @returns Permissions data, loading state, and refetch function
 */
export function useRBACPermissions(
  scopeType: string,
  minPermission: PermissionLevel = Permission.VIEW
): UseRBACPermissionsResult {
  const { user, token } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel[]>>({})
  const [scopes, setScopes] = useState<EmployeeScope[]>([])

  const fetchPermissions = useCallback(async () => {
    if (!user?.sub || !token || !scopeType) {
      setIsLoading(false)
      return
    }

    const cacheKey = `${user.sub}-${scopeType}-${minPermission}`
    const cached = permissionsCache.get(cacheKey)
    
    // Check cache validity
    if (cached && 
        cached.employeeId === user.sub && 
        Date.now() - cached.timestamp < CACHE_TTL) {
      setPermissions(cached.permissions)
      setScopes(cached.scopes)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Call the RBAC API to get employee scopes with permissions
      const response = await fetch('/api/v1/rbac/employee-scopes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          employeeId: user.sub,
          scopeType,
          minPermission,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.statusText}`)
      }

      const data: { scopes: EmployeeScope[] } = await response.json()
      
      // Convert to permissions map for easier lookup
      const permissionsMap: Record<string, PermissionLevel[]> = {}
      data.scopes.forEach(scope => {
        permissionsMap[scope.scopeId] = scope.permissions
      })

      setPermissions(permissionsMap)
      setScopes(data.scopes)

      // Cache the results
      permissionsCache.set(cacheKey, {
        permissions: permissionsMap,
        scopes: data.scopes,
        timestamp: Date.now(),
        employeeId: user.sub,
      })

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch permissions'
      setError(errorMessage)
      console.error('RBAC permissions fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.sub, token, scopeType, minPermission])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  return {
    permissions,
    scopes,
    isLoading,
    error,
    refetch: fetchPermissions,
  }
}

/**
 * Hook to check if employee has a specific permission on a resource
 * 
 * @param scopeType - The scope type ('project', 'task', etc.)
 * @param scopeId - The specific resource ID
 * @param requiredPermission - The permission level required
 * @returns Boolean indicating if employee has permission
 */
export function useHasPermission(
  scopeType: string,
  scopeId: string,
  requiredPermission: PermissionLevel
): boolean {
  const { permissions } = useRBACPermissions(scopeType, requiredPermission)
  
  const resourcePermissions = permissions[scopeId] || []
  return resourcePermissions.includes(requiredPermission)
}

/**
 * Hook to check component-level permissions using hasPermissionOnComponent
 * 
 * @param componentName - The component name from d_scope_app.scope_name
 * @param action - The action being attempted
 * @returns Boolean indicating if employee can access the component
 */
export function useHasComponentPermission(
  componentName: string,
  action: 'view' | 'modify' | 'create' | 'delete' | 'share' = 'view'
): { hasPermission: boolean; isLoading: boolean } {
  const { user, token } = useAuth()
  const [hasPermission, setHasPermission] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user?.sub || !token || !componentName) {
      setIsLoading(false)
      return
    }

    const checkPermission = async () => {
      setIsLoading(true)
      
      try {
        const response = await fetch('/api/v1/rbac/component-permission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            employeeId: user.sub,
            scopeType: 'app:component',
            scopeName: componentName,
            action,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setHasPermission(data.hasPermission || false)
        } else {
          setHasPermission(false)
        }
      } catch (error) {
        console.error('Component permission check error:', error)
        setHasPermission(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkPermission()
  }, [user?.sub, token, componentName, action])

  return { hasPermission, isLoading }
}