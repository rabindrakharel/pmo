import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CONFIG } from '../../lib/config/api';

// RBAC Components (Role-Only Model v2.3.0)
import { GrantPermissionModal, HierarchicalRbacMatrix } from './index';

/**
 * RoleAccessControlPanel
 *
 * Simplified permission management panel showing only the Permission Matrix.
 * Members are shown in the separate "People" tab (entity child tab).
 *
 * v2.3.0: Removed Permissions tab, now shows only Permission Matrix directly
 */

interface RoleAccessControlPanelProps {
  roleId: string;
  roleName: string;
}

export function RoleAccessControlPanel({
  roleId,
  roleName
}: RoleAccessControlPanelProps) {
  const queryClient = useQueryClient();
  const [showGrantModal, setShowGrantModal] = useState(false);

  // Revoke permission mutation
  const revokePermissionMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/permission/${permissionId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to revoke permission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId] });
    }
  });

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm border border-dark-200 overflow-hidden">
        {/* Permission Matrix Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <HierarchicalRbacMatrix
            roleId={roleId}
            roleName={roleName}
            onRevoke={(permissionId) => {
              if (confirm('Are you sure you want to revoke this permission?')) {
                revokePermissionMutation.mutate(permissionId);
              }
            }}
            onGrantPermission={() => setShowGrantModal(true)}
          />
        </div>
      </div>

      {/* Grant Permission Modal */}
      <GrantPermissionModal
        isOpen={showGrantModal}
        onClose={() => setShowGrantModal(false)}
        roleId={roleId}
        roleName={roleName}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId] });
        }}
      />
    </>
  );
}
