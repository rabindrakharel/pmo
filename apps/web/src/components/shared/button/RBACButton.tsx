import React, { useState, useEffect, useMemo } from 'react';
import { LucideIcon, Lock } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface RBACPermission {
  entityType: string;
  entityId?: string;
  action: 'create' | 'view' | 'edit' | 'share' | 'delete';
  parentEntity?: string;
  parentEntityId?: string;
}

interface RBACButtonProps {
  children: React.ReactNode;
  permission: RBACPermission;
  onClick?: () => void;
  href?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  tooltip?: string;
}

// ===============================
// UNIFIED RBAC HOOK SOLUTION
// ===============================

// Cache for API responses to prevent duplicate calls
const rbacCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Unified hook that handles both TIER 1 and TIER 3 scenarios
export function useUnifiedRBACPermissions(
  entityType: string,
  records: any[],
  actions: string[],
  parentEntity?: string,
  parentEntityId?: string
) {
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Memoize the API call key to prevent unnecessary calls
  const apiCallKey = useMemo(() => {
    const isParentActionContext = !!(parentEntity && parentEntityId);
    if (isParentActionContext) {
      return `tier3:${parentEntity}:${parentEntityId}:${entityType}`;
    } else {
      return `tier1:${entityType}`;
    }
  }, [entityType, parentEntity, parentEntityId]);

  // Memoize stable values to prevent unnecessary effects
  const stableActions = useMemo(() => [...actions].sort(), [actions]);
  const recordIds = useMemo(() => records.map(r => r.id).sort(), [records]);

  // API call effect - only depends on the API call key, not records
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!stableActions.length || !entityType) {
        setLoading(false);
        return;
      }

      // Check cache first
      const cached = rbacCache.get(apiCallKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log('🎯 RBAC Cache HIT for:', apiCallKey);
        setApiData(cached.data);
        setLoading(false);
        return;
      }

      // Determine if this is TIER 1 (main page) or TIER 3 (parent-action context)
      const isParentActionContext = !!(parentEntity && parentEntityId);

      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setApiData(null);
          setLoading(false);
          return;
        }

        let response;
        if (isParentActionContext) {
          // TIER 3: Parent-action context
          response = await fetch(`${API_BASE_URL}/api/v1/rbac/get-permissions-by-parentEntity-actionEntity`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              parentEntity,
              parentEntityId,
              actionEntity: entityType,
            }),
          });
        } else {
          // TIER 1: Main page context
          response = await fetch(`${API_BASE_URL}/api/v1/rbac/get-permissions-by-entityType`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              entityType,
            }),
          });
        }

        if (response.ok) {
          const data = await response.json();

          // Cache the response
          console.log('🎯 RBAC API CALL for:', apiCallKey, '- caching response');
          rbacCache.set(apiCallKey, { data, timestamp: Date.now() });
          setApiData(data);
        } else {
          setApiData(null);
        }
      } catch (error) {
        console.error('Unified RBAC permission check error:', error);
        setApiData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [apiCallKey, entityType, stableActions.length]); // Stable dependencies only

  // Process permissions based on current records and actions
  const permissions = useMemo(() => {
    if (!apiData || !apiData.permissions) {
      // Return empty permissions for all records
      const noPermissions: Record<string, Record<string, boolean>> = {};
      records.forEach(record => {
        noPermissions[record.id] = {};
        stableActions.forEach(action => {
          noPermissions[record.id][action] = false;
        });
      });
      return noPermissions;
    }

    // Transform the permissions response into our expected format
    const newPermissions: Record<string, Record<string, boolean>> = {};

    // Initialize all records with no permissions
    records.forEach(record => {
      newPermissions[record.id] = {};
      stableActions.forEach(action => {
        newPermissions[record.id][action] = false;
      });
    });

    // Set actual permissions from API response
    apiData.permissions.forEach((perm: { actionEntityId: string; actions: string[] }) => {
      // Handle specific entity permissions
      if (perm.actionEntityId && newPermissions[perm.actionEntityId]) {
        perm.actions.forEach(apiAction => {
          stableActions.forEach(uiAction => {
            if (apiAction === uiAction) {
              newPermissions[perm.actionEntityId][uiAction] = true;
            }
          });
        });
      }

      // Handle global create permissions (empty actionEntityId)
      else if (!perm.actionEntityId && perm.actions.includes('create')) {
        records.forEach(record => {
          if (newPermissions[record.id] && stableActions.includes('create')) {
            newPermissions[record.id]['create'] = true;
          }
        });
      }
    });

    return newPermissions;
  }, [apiData, recordIds, stableActions, records]); // Process whenever data or records change

  return { permissions, loading };
}

// LEGACY: TIER 1 Hook (kept for backward compatibility) - uses unified hook internally
export function useBatchRBACPermissions(entityType: string, records: any[], actions: string[]) {
  return useUnifiedRBACPermissions(entityType, records, actions);
}

// TIER 3: Hook for action entity tabs (Case III)
// For: Action entity tabs (/project/{id}/task, /project/{id}/wiki, etc.)
// LEGACY: TIER 3 Hook (kept for backward compatibility) - uses unified hook internally
export function useBatchParentActionRBACPermissions(
  parentEntity: string,
  parentEntityId: string,
  actionEntity: string,
  records: any[],
  actions: string[]
) {
  return useUnifiedRBACPermissions(actionEntity, records, actions, parentEntity, parentEntityId);
}

// TIER 2: Hook for detail page inline edit (Case II)
// For: Detail page inline edit and share permissions
export function useRBACPermission(permission: RBACPermission) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setHasPermission(false);
          setLoading(false);
          return;
        }

        // For entity-specific permissions (TIER 2)
        if (permission.entityId) {
          const response = await fetch(`${API_BASE_URL}/api/v1/rbac/check-permission-of-entity`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              entityType: permission.entityType,
              entityId: permission.entityId,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            // Check if the first permission entry has the requested action
            const hasAction = data.permissions && data.permissions.length > 0
              ? data.permissions[0].actions.includes(permission.action)
              : false;
            setHasPermission(hasAction);
          } else {
            setHasPermission(false);
          }
        }
        // For global permissions, use TIER 1 API
        else {
          const response = await fetch(`${API_BASE_URL}/api/v1/rbac/get-permissions-by-entityType`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              entityType: permission.entityType,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.permissions && Array.isArray(data.permissions)) {
              // Check for global permissions (empty actionEntityId)
              const globalPerm = data.permissions.find((p: any) => p.actionEntityId === '' && p.actions.includes(permission.action));
              setHasPermission(!!globalPerm);
            } else {
              setHasPermission(false);
            }
          } else {
            setHasPermission(false);
          }
        }
      } catch (error) {
        console.error('Permission check error:', error);
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [permission]);

  return { hasPermission, loading };
}

export function RBACButton({
  children,
  permission,
  onClick,
  href,
  className = '',
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  tooltip,
}: RBACButtonProps) {
  const { hasPermission, loading: permissionLoading } = useRBACPermission(permission);

  // Standardized base classes matching the Button component
  const baseClasses = 'inline-flex items-center border text-sm font-normal rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';

  const variantClasses = {
    primary: hasPermission
      ? 'border-slate-600 text-white bg-slate-600 hover:bg-slate-700 hover:border-slate-700 shadow-sm focus:ring-slate-500/50'
      : 'border-dark-400 bg-dark-300 text-dark-700 cursor-not-allowed',
    secondary: hasPermission
      ? 'border-dark-300 text-dark-700 bg-white hover:border-dark-400 focus:ring-slate-500/30'
      : 'border-dark-300 bg-white text-dark-600 cursor-not-allowed',
    danger: hasPermission
      ? 'border-red-600 text-white bg-red-600 hover:bg-red-700 hover:border-red-700 focus:ring-red-500'
      : 'border-dark-400 bg-dark-300 text-dark-700 cursor-not-allowed',
    ghost: hasPermission
      ? 'border-transparent text-dark-700 hover:bg-dark-200 focus:ring-slate-500/30'
      : 'border-transparent text-dark-600 cursor-not-allowed',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-5 py-3 text-base',
  };

  const finalClassName = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  const isDisabled = disabled || !hasPermission || permissionLoading || loading;

  const tooltipText = !hasPermission && !permissionLoading
    ? tooltip || `You need ${permission.action} permission on ${permission.entityType}`
    : undefined;

  const handleClick = () => {
    if (isDisabled) return;
    if (href) {
      window.location.href = href;
    } else if (onClick) {
      onClick();
    }
  };

  const buttonContent = (
    <>
      {(loading || permissionLoading) && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
      )}
      {Icon && !loading && !permissionLoading && (
        <Icon className={`${size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'} stroke-[1.5] ${
          children ? 'mr-2' : ''
        }`} />
      )}
      {!hasPermission && !permissionLoading && !loading && !Icon && (
        <Lock className={`${size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'} stroke-[1.5] ${
          children ? 'mr-2' : ''
        }`} />
      )}
      {children}
    </>
  );

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={finalClassName}
      title={tooltipText}
    >
      {buttonContent}
    </button>
  );
}

// Specialized create button with parent context
interface RBACCreateButtonProps {
  entityType: string;
  parentEntity?: string;
  parentEntityId?: string;
  onCreateClick?: () => void;
  createUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RBACCreateButton({
  entityType,
  parentEntity,
  parentEntityId,
  onCreateClick,
  createUrl,
  className,
  size = 'md',
}: RBACCreateButtonProps) {
  const permission: RBACPermission = parentEntity && parentEntityId
    ? {
        entityType,
        action: 'create',
        parentEntity,
        parentEntityId,
      }
    : {
        entityType,
        action: 'create',
      };

  const handleClick = () => {
    if (createUrl) {
      window.location.href = createUrl;
    } else if (onCreateClick) {
      onCreateClick();
    }
  };

  return (
    <RBACButton
      permission={permission}
      onClick={handleClick}
      variant="secondary"
      size={size}
      className={className}
    >
      Create {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
    </RBACButton>
  );
}

// Action bar component with RBAC-gated actions
interface ActionBarProps {
  title?: string;
  createButton?: {
    entityType: string;
    parentEntity?: string;
    parentEntityId?: string;
    onCreateClick?: () => void;
    createUrl?: string;
  };
  scopeFilters?: React.ReactNode;
  additionalActions?: React.ReactNode;
  className?: string;
}

export function ActionBar({
  title,
  createButton,
  scopeFilters,
  additionalActions,
  className = '',
}: ActionBarProps) {
  return (
    <div className={`flex items-center justify-between bg-dark-100 px-6 py-4 border-b border-dark-300 ${className}`}>
      <div className="flex items-center space-x-4">
        {title && <h2 className="text-sm font-normal text-dark-600">{title}</h2>}
        {scopeFilters}
      </div>
      <div className="flex items-center space-x-3">
        {additionalActions}
        {createButton && (
          <RBACCreateButton
            entityType={createButton.entityType}
            parentEntity={createButton.parentEntity}
            parentEntityId={createButton.parentEntityId}
            onCreateClick={createButton.onCreateClick}
            createUrl={createButton.createUrl}
          />
        )}
      </div>
    </div>
  );
}