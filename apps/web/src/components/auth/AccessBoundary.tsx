import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth';
import { api, Permission } from '@/lib/api';

// Comprehensive scope-based access boundary interface
export interface AccessBoundaryProps {
  action: 'view' | 'create' | 'modify' | 'delete' | 'grant' | 'share';
  resource: 'project' | 'task' | 'tasklog' | 'form' | 'meta' | 'location' | 'business' | 'hr' | 'worksite' | 'employee' | 'client' | 'app' | 'route_page' | 'component';
  
  // Multi-dimensional scope context
  scope?: {
    type: 'business' | 'location' | 'worksite' | 'hr' | 'project' | 'global';
    id?: string;           // Specific scope ID
    reference_id?: string; // Reference to actual scope table record
    parent_id?: string;    // Parent scope for hierarchy
  };
  
  // Legacy support - specific resource ID for fine-grained permissions
  scopeId?: string;
  
  // Resource-specific context
  resourceId?: string;     // Specific resource instance ID
  resourceContext?: {      // Additional resource context
    projectId?: string;    // Project context
    locationId?: string;   // Location context  
    businessId?: string;   // Business context
    worksiteId?: string;   // Worksite context
    clientId?: string;     // Client context
  };
  
  // UI configuration
  fallback?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  
  // Debug and development
  debug?: boolean;        // Enable permission debugging
}

export function AccessBoundary({ 
  action, 
  resource, 
  scope,
  scopeId, // Legacy support
  resourceId,
  resourceContext,
  fallback = null, 
  children, 
  className,
  debug = false
}: AccessBoundaryProps) {
  const { user } = useAuthStore();
  
  // Map action strings to permission numbers
  const actionToPermission = {
    'view': Permission.VIEW,
    'modify': Permission.MODIFY,
    'share': Permission.SHARE,
    'delete': Permission.DELETE,
    'create': Permission.CREATE,
    'grant': Permission.CREATE, // Grant permissions requires create level
  };

  // Build comprehensive query key for scope-based permissions
  const permissionQueryKey = [
    'user-permissions', 
    user?.sub, 
    resource, 
    scope?.type,
    scope?.id || scopeId, // Legacy support
    resourceId,
    resourceContext
  ];

  // Fetch user permissions with comprehensive scope support
  const { data: userPermissions } = useQuery({
    queryKey: permissionQueryKey,
    queryFn: async () => {
      if (!user?.sub) return null;
      
      if (debug) {
        console.log('AccessBoundary Debug:', {
          user: user.email,
          action,
          resource,
          scope,
          resourceId,
          resourceContext
        });
      }
      
      // For development mode, return admin permissions for system admins
      if (user.roles?.includes('admin') || user.roles?.includes('system_admin')) {
        return {
          hasPermission: true,
          isAdmin: true,
          permissions: [0, 1, 2, 3, 4], // All permissions
          scope_context: 'system_admin',
        };
      }

      try {
        // Use the existing /api/v1/auth/permissions endpoint
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/v1/auth/permissions`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const permissionData = await response.json();
        
        if (debug) {
          console.log('Permission data received:', permissionData);
        }

        // Return structured permission response
        return {
          hasPermission: true,
          isAdmin: permissionData.isAdmin || false,
          permissions: permissionData.permissions?.app || [0,1,2,3,4],
          scope_context: permissionData.isAdmin ? 'admin' : 'user',
          scopes: permissionData.permissions?.scopes || {}
        };
      } catch (error) {
        console.error('Permission check failed:', error);
        
        // Fallback to role-based permissions for compatibility
        return getRoleBasedPermissions(user, resource, debug);
      }
    },
    enabled: !!user?.sub,
    staleTime: 2 * 60 * 1000, // 2 minutes for scope-based permissions
  });

  // Fallback role-based permission function
  function getRoleBasedPermissions(user: any, resource: string, debug: boolean) {
    if (debug) {
      console.log('Using fallback role-based permissions for:', user.email);
    }

    // Role-based fallback permissions
    if (user.roles?.includes('owner') || user.roles?.includes('project_owner')) {
      return {
        hasPermission: true,
        permissions: [0, 1, 2, 3, 4], // Full permissions
        scope_context: 'owner',
      };
    }
    
    if (user.roles?.includes('collaborator') || user.roles?.includes('field_worker')) {
      return {
        hasPermission: true,
        permissions: [0, 1], // View and modify
        scope_context: 'collaborator',
      };
    }
    
    if (user.roles?.includes('reviewer') || user.roles?.includes('supervisor')) {
      return {
        hasPermission: true,
        permissions: [0, 1, 2], // View, modify, share
        scope_context: 'supervisor',
      };
    }
    
    if (user.roles?.includes('viewer') || user.roles?.includes('stakeholder')) {
      return {
        hasPermission: true,
        permissions: [0], // View only
        scope_context: 'viewer',
      };
    }

    return {
      hasPermission: false,
      permissions: [],
      scope_context: 'none',
    };
  }

  // Check if current user can perform the action on the resource
  const canPerformAction = (): boolean => {
    if (!user || !userPermissions) return false;

    // System admin can do everything
    if (userPermissions.isAdmin) {
      return true;
    }

    const requiredPermission = actionToPermission[action];
    return userPermissions.permissions.includes(requiredPermission);
  };

  if (canPerformAction()) {
    return <div className={className}>{children}</div>;
  }

  return <>{fallback}</>;
}

// Specialized permission components for common use cases
export function CanCreate({ resource, children, fallback }: Omit<AccessBoundaryProps, 'action'>) {
  return (
    <AccessBoundary action="create" resource={resource} fallback={fallback}>
      {children}
    </AccessBoundary>
  );
}

export function CanModify({ resource, children, fallback }: Omit<AccessBoundaryProps, 'action'>) {
  return (
    <AccessBoundary action="modify" resource={resource} fallback={fallback}>
      {children}
    </AccessBoundary>
  );
}

export function CanDelete({ resource, children, fallback }: Omit<AccessBoundaryProps, 'action'>) {
  return (
    <AccessBoundary action="delete" resource={resource} fallback={fallback}>
      {children}
    </AccessBoundary>
  );
}

export function CanView({ resource, children, fallback }: Omit<AccessBoundaryProps, 'action'>) {
  return (
    <AccessBoundary action="view" resource={resource} fallback={fallback}>
      {children}
    </AccessBoundary>
  );
}

// Hook for conditional logic in components
export function usePermissions() {
  const { user } = useAuthStore();

  const can = (
    action: AccessBoundaryProps['action'], 
    resource: AccessBoundaryProps['resource'], 
    scopeId?: string
  ): boolean => {
    if (!user) return false;

    // System admin can do everything
    if (user.roles?.includes('admin') || user.roles?.includes('system_admin')) {
      return true;
    }

    // For now, simulate permission checks based on roles
    // In production, this would query the database for actual permissions
    const actionToPermission = {
      'view': Permission.VIEW,
      'modify': Permission.MODIFY,
      'share': Permission.SHARE,
      'delete': Permission.DELETE,
      'create': Permission.CREATE,
      'grant': Permission.CREATE,
    };

    // Simulate different permission levels based on roles
    let userPermissions: number[] = [];
    
    if (user.roles?.includes('owner') || user.roles?.includes('project_owner')) {
      userPermissions = [0, 1, 2, 3, 4]; // Full permissions
    } else if (user.roles?.includes('collaborator') || user.roles?.includes('field_worker')) {
      userPermissions = [0, 1]; // View and modify
    } else if (user.roles?.includes('reviewer') || user.roles?.includes('supervisor')) {
      userPermissions = [0, 1, 2]; // View, modify, share
    } else if (user.roles?.includes('viewer') || user.roles?.includes('stakeholder')) {
      userPermissions = [0]; // View only
    }

    const requiredPermission = actionToPermission[action];
    return userPermissions.includes(requiredPermission);
  };

  return { can };
}
