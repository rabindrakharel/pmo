import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth';
import { api, Permission } from '@/lib/api';

export interface AccessBoundaryProps {
  action: 'view' | 'create' | 'modify' | 'delete' | 'grant' | 'share';
  resource: 'project' | 'task' | 'tasklog' | 'form' | 'meta' | 'location' | 'business' | 'hr' | 'worksite' | 'employee' | 'client' | 'app' | 'route_page' | 'component';
  scopeId?: string; // Specific resource ID for fine-grained permissions
  fallback?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AccessBoundary({ 
  action, 
  resource, 
  scopeId,
  fallback = null, 
  children, 
  className 
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

  // Fetch user permissions for this resource type
  const { data: userPermissions } = useQuery({
    queryKey: ['user-permissions', user?.sub, resource, scopeId],
    queryFn: async () => {
      if (!user?.sub) return null;
      
      // For development mode, return admin permissions
      if (user.roles?.includes('admin') || user.roles?.includes('system_admin')) {
        return {
          hasPermission: true,
          isAdmin: true,
          permissions: [0, 1, 2, 3, 4], // All permissions
        };
      }

      // TODO: Replace with actual API call to check user permissions
      // This would call something like: api.getUserPermissions(user.sub, resource, scopeId)
      
      // For now, simulate different permission levels based on roles
      if (user.roles?.includes('owner') || user.roles?.includes('project_owner')) {
        return {
          hasPermission: true,
          permissions: [0, 1, 2, 3, 4], // Full permissions for owned resources
        };
      }
      
      if (user.roles?.includes('collaborator') || user.roles?.includes('field_worker')) {
        return {
          hasPermission: true,
          permissions: [0, 1], // View and modify
        };
      }
      
      if (user.roles?.includes('reviewer') || user.roles?.includes('supervisor')) {
        return {
          hasPermission: true,
          permissions: [0, 1, 2], // View, modify, share
        };
      }
      
      if (user.roles?.includes('viewer') || user.roles?.includes('stakeholder')) {
        return {
          hasPermission: true,
          permissions: [0], // View only
        };
      }

      return {
        hasPermission: false,
        permissions: [],
      };
    },
    enabled: !!user?.sub,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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
