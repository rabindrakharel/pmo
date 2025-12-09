import { useState, useMemo } from 'react';
import { API_CONFIG } from '../../lib/config/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react';

// RBAC Components (Role-Only Model v2.0.0)
import {
  PermissionRuleCard,
  PermissionRuleCardSkeleton,
  GrantPermissionModal,
  EffectiveAccessTable
} from './index';
import type { InheritanceMode } from './index';

/**
 * RoleAccessControlPanel
 *
 * Extracted from AccessControlPage for use in Role detail page tabs.
 * Shows permissions and effective access for a specific role.
 * Members are shown in the separate "People" tab (entity child tab).
 *
 * v9.5.0: Added as custom tab in EntitySpecificInstancePage for role entity
 */

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// Types
interface Permission {
  id: string;
  entity_code: string;
  entity_instance_id: string;
  permission: number;
  inheritance_mode: InheritanceMode;
  child_permissions: Record<string, number>;
  is_deny: boolean;
  granted_ts: string;
  expires_ts?: string | null;
  granted_by_name?: string;
  entity_name?: string;
  entity_ui_label?: string;
  entity_ui_icon?: string;
}

interface PersonAssignment {
  person_id: string;
  person_name: string;
}

interface EntityOption {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
}

// Tab types - Only permissions and effective access (Members shown in People tab)
type DetailTab = 'permissions' | 'effective';

interface RoleAccessControlPanelProps {
  roleId: string;
  roleName: string;
}

export function RoleAccessControlPanel({
  roleId,
  roleName
}: RoleAccessControlPanelProps) {
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<DetailTab>('permissions');
  const [showGrantModal, setShowGrantModal] = useState(false);

  // Fetch permissions for role
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ['access-control', 'role', roleId, 'permissions'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/role/${roleId}/permissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch permissions');
      return response.json();
    },
    enabled: !!roleId
  });

  // Fetch persons (members) for role - needed for Effective Access tab
  const { data: personsData } = useQuery({
    queryKey: ['access-control', 'role', roleId, 'members'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/person?parent_entity_code=role&parent_entity_instance_id=${roleId}&limit=1000`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch members');
      const result = await response.json();
      return {
        data: result.data.map((person: any) => ({
          person_id: person.id,
          person_name: person.name
        }))
      };
    },
    enabled: !!roleId && activeTab === 'effective'
  });

  // Fetch effective access for role
  const { data: effectiveData, isLoading: effectiveLoading } = useQuery({
    queryKey: ['access-control', 'role', roleId, 'effective'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const firstPerson = personsData?.data?.[0];
      if (!firstPerson) return { data: [] };

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/person/${firstPerson.person_id}/effective-access`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch effective access');
      return response.json();
    },
    enabled: !!roleId && activeTab === 'effective' && !!personsData?.data?.length
  });

  // Fetch entity options for labels/icons
  const { data: entitiesData } = useQuery({
    queryKey: ['access-control', 'entities'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/entity/types`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch entities');
      return response.json();
    }
  });

  // Entity labels and icons map
  const entityLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    const entities = entitiesData?.data || [];
    entities.forEach((e: EntityOption) => {
      labels[e.code] = e.ui_label || e.name;
    });
    return labels;
  }, [entitiesData]);

  const entityIcons = useMemo(() => {
    const icons: Record<string, string> = {};
    const entities = entitiesData?.data || [];
    entities.forEach((e: EntityOption) => {
      if (e.ui_icon) icons[e.code] = e.ui_icon;
    });
    return icons;
  }, [entitiesData]);

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
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId, 'permissions'] });
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId, 'effective'] });
    }
  });

  // Calculate permission stats
  const permissionStats = useMemo(() => {
    const permissions = permissionsData?.data || [];
    return {
      total: permissions.length,
      typeLevel: permissions.filter((p: Permission) => p.entity_instance_id === ALL_ENTITIES_ID).length,
      instanceLevel: permissions.filter((p: Permission) => p.entity_instance_id !== ALL_ENTITIES_ID).length,
      withInheritance: permissions.filter((p: Permission) => p.inheritance_mode !== 'none').length,
      denied: permissions.filter((p: Permission) => p.is_deny).length
    };
  }, [permissionsData]);

  // Group permissions by entity type
  const groupedPermissions = useMemo(() => {
    const permissions = permissionsData?.data || [];
    const groups: Record<string, Permission[]> = {};

    permissions.forEach((p: Permission) => {
      if (!groups[p.entity_code]) {
        groups[p.entity_code] = [];
      }
      groups[p.entity_code].push(p);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [permissionsData]);

  return (
    <>
      <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl shadow-sm border border-dark-200 overflow-hidden">
        {/* Tabs */}
        <div className="px-6 border-b border-dark-200 flex-shrink-0">
          <div className="flex gap-1">
            {[
              { id: 'permissions' as DetailTab, label: 'Permissions', icon: LucideIcons.Shield, count: permissionsData?.data?.length },
              { id: 'effective' as DetailTab, label: 'Effective Access', icon: LucideIcons.Eye, count: null }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? "border-slate-600 text-slate-700"
                    : "border-transparent text-dark-500 hover:text-dark-700"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== null && tab.count !== undefined && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? "bg-slate-200 text-slate-700" : "bg-dark-100 text-dark-600"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="p-6">
              {/* Header with Stats & Add Button */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-dark-700">Permission Rules</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 bg-dark-100 rounded text-dark-600">
                      {permissionStats.total} total
                    </span>
                    {permissionStats.withInheritance > 0 && (
                      <span className="px-2 py-0.5 bg-violet-100 rounded text-violet-700">
                        {permissionStats.withInheritance} with inheritance
                      </span>
                    )}
                    {permissionStats.denied > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 rounded text-red-700">
                        {permissionStats.denied} denied
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowGrantModal(true)}
                  className="px-3 py-2 text-sm font-medium bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2"
                >
                  <LucideIcons.Plus className="h-4 w-4" />
                  Grant Permission
                </button>
              </div>

              {/* Permissions List */}
              {permissionsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <PermissionRuleCardSkeleton key={i} />
                  ))}
                </div>
              ) : !permissionsData?.data || permissionsData.data.length === 0 ? (
                <div className="text-center py-12 text-dark-500">
                  <div className="p-4 bg-dark-100 rounded-2xl inline-block mb-3">
                    <LucideIcons.ShieldOff className="h-10 w-10 text-dark-300" />
                  </div>
                  <p className="text-sm font-medium">No permissions granted</p>
                  <p className="text-xs text-dark-400 mt-1">
                    Click "Grant Permission" to add one
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedPermissions.map(([entityCode, permissions]) => (
                    <div key={entityCode}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-dark-500 uppercase tracking-wider">
                          {entityLabels[entityCode] || entityCode}
                        </span>
                        <div className="flex-1 h-px bg-dark-200" />
                        <span className="text-xs text-dark-400">
                          {permissions.length} rule{permissions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {permissions.map((perm: Permission) => (
                          <PermissionRuleCard
                            key={perm.id}
                            permission={perm}
                            entityName={perm.entity_ui_label || entityLabels[perm.entity_code] || perm.entity_code}
                            entityIcon={perm.entity_ui_icon || entityIcons[perm.entity_code]}
                            entityLabels={entityLabels}
                            isTypeLevel={perm.entity_instance_id === ALL_ENTITIES_ID}
                            onRevoke={() => {
                              if (confirm('Are you sure you want to revoke this permission?')) {
                                revokePermissionMutation.mutate(perm.id);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Effective Access Tab */}
          {activeTab === 'effective' && (
            <div className="p-6">
              {!personsData?.data?.length ? (
                <div className="text-center py-12 text-dark-500">
                  <div className="p-4 bg-dark-100 rounded-2xl inline-block mb-3">
                    <LucideIcons.UserX className="h-10 w-10 text-dark-300" />
                  </div>
                  <p className="text-sm font-medium">No members to check</p>
                  <p className="text-xs text-dark-400 mt-1">
                    Add members in the People tab to see their effective access
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <LucideIcons.Info className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-slate-700">
                        <p className="font-medium">Effective Access Preview</p>
                        <p className="mt-1 text-slate-600">
                          Showing resolved permissions for <strong>{personsData.data[0]?.person_name}</strong> after inheritance calculation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <EffectiveAccessTable
                    permissions={effectiveData?.data || []}
                    isLoading={effectiveLoading}
                    entityLabels={entityLabels}
                    entityIcons={entityIcons}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grant Permission Modal */}
      <GrantPermissionModal
        isOpen={showGrantModal}
        onClose={() => setShowGrantModal(false)}
        roleId={roleId}
        roleName={roleName}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId, 'permissions'] });
          queryClient.invalidateQueries({ queryKey: ['access-control', 'role', roleId, 'effective'] });
        }}
      />
    </>
  );
}
