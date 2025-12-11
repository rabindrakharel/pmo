import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { API_CONFIG } from '../../lib/config/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react';

// RBAC Components (Role-Only Model v2.3.0)
import {
  GrantPermissionModal,
  HierarchicalRbacMatrix
} from '../../components/rbac';

/**
 * Access Control Page
 *
 * Role-Only RBAC Model v2.3.0
 *
 * - Role selection (left panel)
 * - Permission Matrix showing hierarchical permissions (right panel)
 * - Simplified UI: removed Permissions and Members tabs
 * - Members are managed via the Role detail page's "People" tab
 */

// Types
interface Role {
  id: string;
  name: string;
  code: string;
  descr?: string;
  active_flag: boolean;
}

export function AccessControlPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGrantModal, setShowGrantModal] = useState(false);

  // Fetch all roles
  const { data: rolesData, isLoading: rolesLoading, error: rolesError } = useQuery({
    queryKey: ['access-control', 'roles'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/role?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch roles');
      return response.json();
    }
  });

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
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId] });
    }
  });

  // Get filtered roles
  const filteredRoles = useMemo(() => {
    const roles = rolesData?.data || [];
    if (!searchQuery.trim()) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter((role: Role) =>
      role.name.toLowerCase().includes(query) ||
      role.code.toLowerCase().includes(query)
    );
  }, [rolesData, searchQuery]);

  // Get selected role details
  const selectedRole = useMemo(() => {
    if (!selectedRoleId || !rolesData?.data) return null;
    return rolesData.data.find((r: Role) => r.id === selectedRoleId);
  }, [selectedRoleId, rolesData]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/settings')}
                className="p-2 rounded-lg text-dark-500 hover:text-dark-700 hover:bg-dark-100 transition-all"
                title="Back to Settings"
              >
                <LucideIcons.ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-slate-100 rounded-xl border border-dark-200 shadow-sm">
                  <LucideIcons.Shield className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-dark-800 tracking-tight">Access Control</h1>
                  <p className="text-sm text-dark-500 mt-0.5">Role-based permission management</p>
                </div>
              </div>
            </div>

            {/* Create Role Button */}
            <button
              onClick={() => navigate('/role/new')}
              className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2"
            >
              <LucideIcons.Plus className="h-4 w-4" />
              Create Role
            </button>
          </div>
        </div>

        {/* Main Content - Two Panel Layout */}
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Role List */}
          <div className="w-80 flex-shrink-0 bg-white border border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
            {/* Search Header */}
            <div className="p-4 border-b border-dark-200">
              <div className="relative">
                <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-dark-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 placeholder:text-dark-400"
                />
              </div>
            </div>

            {/* Role List */}
            <div className="flex-1 overflow-y-auto">
              {rolesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600" />
                </div>
              ) : rolesError ? (
                <div className="p-4 text-center text-red-600 text-sm">
                  Failed to load roles
                </div>
              ) : filteredRoles.length === 0 ? (
                <div className="p-4 text-center text-dark-500 text-sm">
                  No roles found
                </div>
              ) : (
                <div className="divide-y divide-dark-100">
                  {filteredRoles.map((role: Role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`w-full px-4 py-3.5 text-left transition-all ${
                        selectedRoleId === role.id
                          ? "bg-slate-50 border-l-3 border-l-slate-600"
                          : "hover:bg-dark-50 border-l-3 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          selectedRoleId === role.id ? "bg-slate-200" : "bg-dark-100"
                        }`}>
                          <LucideIcons.Users className="h-4 w-4 text-dark-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-dark-800 truncate">{role.name}</div>
                          <div className="text-xs text-dark-500 truncate">{role.code}</div>
                        </div>
                        {!role.active_flag && (
                          <span className="px-1.5 py-0.5 text-xs bg-dark-200 text-dark-600 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Stats */}
            <div className="p-3 border-t border-dark-200 bg-dark-50">
              <div className="text-xs text-dark-600">
                {filteredRoles.length} role{filteredRoles.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Right Panel - Permission Matrix */}
          <div className="flex-1 bg-white border border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
            {!selectedRoleId ? (
              <div className="flex-1 flex items-center justify-center text-dark-500">
                <div className="text-center">
                  <div className="p-4 bg-dark-100 rounded-2xl inline-block mb-3">
                    <LucideIcons.MousePointer className="h-8 w-8 text-dark-400" />
                  </div>
                  <p className="text-sm font-medium">Select a role to manage permissions</p>
                  <p className="text-xs text-dark-400 mt-1">Choose from the list on the left</p>
                </div>
              </div>
            ) : (
              <>
                {/* Role Header */}
                <div className="px-6 py-4 border-b border-dark-200 bg-dark-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-100 rounded-xl">
                        <LucideIcons.Users className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-dark-800">{selectedRole?.name}</h2>
                        <p className="text-sm text-dark-500">{selectedRole?.code}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/role/${selectedRoleId}`)}
                      className="px-3 py-1.5 text-sm text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <LucideIcons.ExternalLink className="h-4 w-4" />
                      View Role
                    </button>
                  </div>
                </div>

                {/* Permission Matrix Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <HierarchicalRbacMatrix
                    roleId={selectedRoleId}
                    roleName={selectedRole?.name || ''}
                    onRevoke={(permissionId) => {
                      if (confirm('Are you sure you want to revoke this permission?')) {
                        revokePermissionMutation.mutate(permissionId);
                      }
                    }}
                    onGrantPermission={() => setShowGrantModal(true)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grant Permission Modal */}
      {selectedRole && (
        <GrantPermissionModal
          isOpen={showGrantModal}
          onClose={() => setShowGrantModal(false)}
          roleId={selectedRoleId!}
          roleName={selectedRole.name}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId] });
          }}
        />
      )}
    </Layout>
  );
}
