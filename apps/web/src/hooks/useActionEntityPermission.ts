import React from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface ActionEntityPermissionHookResult {
  canEdit: boolean;
  permissionLoading: boolean;
}

export function useActionEntityPermission(
  entityType: string,
  entityId: string | undefined,
  action: string = 'edit'
): ActionEntityPermissionHookResult {
  const [canEdit, setCanEdit] = React.useState<boolean>(false);
  const [permissionLoading, setPermissionLoading] = React.useState(true);

  React.useEffect(() => {
    const checkActionEntityPermission = async () => {
      if (!entityId) return;

      try {
        setPermissionLoading(true);
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setCanEdit(false);
          return;
        }

        // Check if this entity is an action entity for any parent and user has edit permission
        console.log(`Checking action entity permission for ${entityType}:`, entityId);
        const response = await fetch(`${API_BASE_URL}/api/v1/rbac/check-action-entity-permission`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action_entity_type: entityType,
            action_entity_id: entityId,
            action: action
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Action entity permission response for ${entityType}:`, data);
          setCanEdit(data.hasPermission || false);
        } else {
          console.log(`Action entity permission API not available for ${entityType}, trying fallback`);
          console.log('Response status:', response.status, response.statusText);

          // Fallback: check direct entity edit permission
          const fallbackResponse = await fetch(`${API_BASE_URL}/api/v1/rbac/check-permission`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              entity_type: entityType,
              entity_id: entityId,
              action: action,
            }),
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log(`Fallback permission response for ${entityType}:`, fallbackData);
            setCanEdit(fallbackData.hasPermission || false);
          } else {
            console.log(`Fallback permission failed for ${entityType}:`, fallbackResponse.status, fallbackResponse.statusText);
            setCanEdit(false);
          }
        }
      } catch (error) {
        console.error(`Permission check error for ${entityType}:`, error);
        setCanEdit(false);
      } finally {
        setPermissionLoading(false);
      }
    };

    checkActionEntityPermission();
  }, [entityType, entityId, action]);

  // Log when permission state changes
  React.useEffect(() => {
    if (!permissionLoading) {
      console.log(`Final canEdit permission for ${entityType}`, entityId, ':', canEdit);
    }
  }, [permissionLoading, canEdit, entityType, entityId]);

  return { canEdit, permissionLoading };
}