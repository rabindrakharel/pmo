import React from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface ActionEntityPermissionHookResult {
  permissions: string[];
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
  canView: boolean;
  permissionLoading: boolean;
}

// TIER 2: Get permissions for specific entity (for detail page inline edit and share)
// Case II: Detail page inline edit and share permissions - returns permissions JSON for specific entity
export function useActionEntityPermission(
  entityType: string,
  entityId: string | undefined
): ActionEntityPermissionHookResult {
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const [permissionLoading, setPermissionLoading] = React.useState(true);

  React.useEffect(() => {
    const checkActionEntityPermission = async () => {
      if (!entityId) {
        setPermissions([]);
        setPermissionLoading(false);
        return;
      }

      try {
        setPermissionLoading(true);
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setPermissions([]);
          setPermissionLoading(false);
          return;
        }

        // Use TIER 2 API - get permissions JSON for specific entity
        console.log(`Getting entity permissions for ${entityType}:${entityId}`);
        const response = await fetch(`${API_BASE_URL}/api/v1/rbac/check-permission-of-entity`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entityType: entityType,
            entityId: entityId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Entity permission response for ${entityType}:${entityId}:`, data);

          // Extract permissions from the consistent format: permissions[0].actions
          const permissions = data.permissions && data.permissions.length > 0
            ? data.permissions[0].actions || []
            : [];
          setPermissions(permissions);
        } else {
          console.log(`Entity permission check failed for ${entityType}:${entityId}:`, response.status, response.statusText);
          setPermissions([]);
        }
      } catch (error) {
        console.error(`Permission check error for ${entityType}:${entityId}:`, error);
        setPermissions([]);
      } finally {
        setPermissionLoading(false);
      }
    };

    checkActionEntityPermission();
  }, [entityType, entityId]);

  // Derive boolean helpers from permissions array
  const canEdit = permissions.includes('edit');
  const canShare = permissions.includes('share');
  const canDelete = permissions.includes('delete');
  const canView = permissions.includes('view');

  // Log when permission state changes
  React.useEffect(() => {
    if (!permissionLoading) {
      console.log(`Final permissions for ${entityType}:${entityId}:`, {
        permissions,
        canEdit,
        canShare,
        canDelete,
        canView,
      });
    }
  }, [permissionLoading, permissions, entityType, entityId, canEdit, canShare, canDelete, canView]);

  return { permissions, canEdit, canShare, canDelete, canView, permissionLoading };
}