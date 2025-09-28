import React from 'react';

// Simple hook for entity data without permission checking
// Permissions are handled at the API level via RBAC joins
interface EntityDataHookResult {
  // No permission fields - permissions handled by API
  loading: boolean;
}

export function useEntityData(
  entityType: string,
  entityId: string | undefined
): EntityDataHookResult {
  const [loading, setLoading] = React.useState(false);

  // This hook no longer performs permission checks
  // All permissions are handled at the API level via RBAC joins
  // Frontend simply displays what the API returns

  React.useEffect(() => {
    // Any entity-specific data loading logic can go here
    // but no permission checking
    setLoading(false);
  }, [entityType, entityId]);

  return { loading };
}