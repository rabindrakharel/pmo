import React, { useState, useEffect } from 'react';
import { LucideIcon, Lock } from 'lucide-react';

interface RBACPermission {
  entityType: string;
  entityId?: string;
  action: 'create' | 'view' | 'edit' | 'share' | 'delete';
  parentEntityType?: string;
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

// Hook to check RBAC permissions
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

        // For entity-specific permissions
        if (permission.entityId) {
          const response = await fetch(`/api/v1/rbac/check-permission`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              entity_type: permission.entityType,
              entity_id: permission.entityId,
              action: permission.action,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setHasPermission(data.hasPermission);
          } else {
            setHasPermission(false);
          }
        }
        // For creation permissions within parent scope
        else if (permission.parentEntityType && permission.parentEntityId) {
          const response = await fetch(`/api/v1/rbac/check-creation`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              parent_entity_type: permission.parentEntityType,
              parent_entity_id: permission.parentEntityId,
              action_entity_type: permission.entityType,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setHasPermission(data.canCreate);
          } else {
            setHasPermission(false);
          }
        }
        // For general entity type permissions
        else {
          // Check if user has any entities of this type they can perform the action on
          const response = await fetch(`/api/v1/${permission.entityType}?limit=1`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          setHasPermission(response.ok);
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
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  tooltip,
}: RBACButtonProps) {
  const { hasPermission, loading: permissionLoading } = useRBACPermission(permission);

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: hasPermission 
      ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
      : 'bg-gray-300 text-gray-500 cursor-not-allowed',
    secondary: hasPermission
      ? 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500'
      : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed',
    danger: hasPermission
      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
      : 'bg-gray-300 text-gray-500 cursor-not-allowed',
    ghost: hasPermission
      ? 'text-gray-700 hover:bg-gray-50 focus:ring-blue-500'
      : 'text-gray-400 cursor-not-allowed',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
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
        <Icon className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} ${
          children ? 'mr-2' : ''
        }`} />
      )}
      {!hasPermission && !permissionLoading && !loading && !Icon && (
        <Lock className={`${size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} ${
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
  parentEntityType?: string;
  parentEntityId?: string;
  onCreateClick?: () => void;
  createUrl?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RBACCreateButton({
  entityType,
  parentEntityType,
  parentEntityId,
  onCreateClick,
  createUrl,
  className,
  size = 'md',
}: RBACCreateButtonProps) {
  const permission: RBACPermission = parentEntityType && parentEntityId
    ? {
        entityType,
        action: 'create',
        parentEntityType,
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
      variant="primary"
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
    parentEntityType?: string;
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
    <div className={`flex items-center justify-between bg-white px-6 py-4 border-b border-gray-200 ${className}`}>
      <div className="flex items-center space-x-4">
        {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
        {scopeFilters}
      </div>
      <div className="flex items-center space-x-3">
        {additionalActions}
        {createButton && (
          <RBACCreateButton
            entityType={createButton.entityType}
            parentEntityType={createButton.parentEntityType}
            parentEntityId={createButton.parentEntityId}
            onCreateClick={createButton.onCreateClick}
            createUrl={createButton.createUrl}
          />
        )}
      </div>
    </div>
  );
}