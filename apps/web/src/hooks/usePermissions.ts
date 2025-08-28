import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface Permission {
  resource: string;
  action: string;
  allowed: boolean;
}

interface PermissionState {
  permissions: Map<string, boolean>;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to manage permissions based on API responses
 * Instead of frontend RBAC checks, this hook tracks permissions
 * based on API 403 responses and successful operations
 */
export function usePermissions() {
  const [state, setState] = useState<PermissionState>({
    permissions: new Map(),
    loading: false,
    error: null,
  });

  /**
   * Test a permission by making a lightweight API call
   * This respects the API-first RBAC pattern
   */
  const testPermission = async (resource: string, action: string): Promise<boolean> => {
    const key = `${resource}:${action}`;
    
    try {
      // For now, assume permission exists until we get a 403
      // In a real implementation, you might have a dedicated permissions endpoint
      setState(prev => ({
        ...prev,
        permissions: new Map(prev.permissions.set(key, true))
      }));
      return true;
    } catch (error: any) {
      if (error.response?.status === 403) {
        setState(prev => ({
          ...prev,
          permissions: new Map(prev.permissions.set(key, false))
        }));
        return false;
      }
      throw error;
    }
  };

  /**
   * Check if user has a specific permission
   * Returns true by default (optimistic), false if we've seen a 403
   */
  const hasPermission = (resource: string, action: string): boolean => {
    const key = `${resource}:${action}`;
    return state.permissions.get(key) ?? true; // Optimistic default
  };

  /**
   * Record that a permission was denied (called from API error handlers)
   */
  const recordPermissionDenied = (resource: string, action: string) => {
    const key = `${resource}:${action}`;
    setState(prev => ({
      ...prev,
      permissions: new Map(prev.permissions.set(key, false))
    }));
  };

  /**
   * Record that a permission was granted (called from successful API operations)
   */
  const recordPermissionGranted = (resource: string, action: string) => {
    const key = `${resource}:${action}`;
    setState(prev => ({
      ...prev,
      permissions: new Map(prev.permissions.set(key, true))
    }));
  };

  /**
   * Clear all cached permissions (useful after login/logout)
   */
  const clearPermissions = () => {
    setState(prev => ({
      ...prev,
      permissions: new Map()
    }));
  };

  return {
    hasPermission,
    testPermission,
    recordPermissionDenied,
    recordPermissionGranted,
    clearPermissions,
    loading: state.loading,
    error: state.error,
  };
}

/**
 * API error handler that integrates with permissions system
 */
export function createApiErrorHandler(
  recordPermissionDenied: (resource: string, action: string) => void
) {
  return (error: any, resource?: string, action?: string) => {
    if (error.response?.status === 403 && resource && action) {
      recordPermissionDenied(resource, action);
    }
    
    // Re-throw for normal error handling
    throw error;
  };
}