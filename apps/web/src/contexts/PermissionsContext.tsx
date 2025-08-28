import { createContext, useContext, ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionsContextValue {
  hasPermission: (resource: string, action: string) => boolean;
  recordPermissionDenied: (resource: string, action: string) => void;
  recordPermissionGranted: (resource: string, action: string) => void;
  clearPermissions: () => void;
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const permissions = usePermissions();

  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissionsContext must be used within a PermissionsProvider');
  }
  return context;
}

/**
 * Component that conditionally renders children based on API-derived permissions
 * This replaces the incorrect AccessBoundary component
 */
export function ConditionalRender({ 
  resource, 
  action, 
  children, 
  fallback = null 
}: { 
  resource: string; 
  action: string; 
  children: ReactNode; 
  fallback?: ReactNode; 
}) {
  const { hasPermission } = usePermissionsContext();
  
  return hasPermission(resource, action) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Higher-order component to disable buttons/inputs when permission is denied
 */
export function withPermissionCheck(
  WrappedComponent: React.ComponentType<any>,
  resource: string,
  action: string
) {
  return function PermissionCheckedComponent(props: any) {
    const { hasPermission } = usePermissionsContext();
    const allowed = hasPermission(resource, action);
    
    return (
      <WrappedComponent 
        {...props} 
        disabled={props.disabled || !allowed}
        title={!allowed ? 'Insufficient permissions' : props.title}
      />
    );
  };
}