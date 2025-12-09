import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { API_CONFIG } from '../../lib/config/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react';
import { cn } from '../../lib/utils';

// RBAC Components (Role-Only Model v2.0.0)
import {
  PermissionRuleCard,
  PermissionRuleCardSkeleton,
  GrantPermissionModal,
  EffectiveAccessTable,
  PermissionBadge,
  InheritanceModeBadge,
  InheritanceMode
} from '../../components/rbac';

/**
 * Access Control Page
 *
 * Role-Only RBAC Model v2.0.0
 *
 * - Role selection (left panel)
 * - Role detail with Permissions, Persons, Effective Access tabs (right panel)
 * - Visual inheritance indicators
 * - No direct employee permissions (all via roles)
 */

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// Types
interface Role {
  id: string;
  name: string;
  code: string;
  descr?: string;
  active_flag: boolean;
}

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
  person_code?: string;
  person_email?: string;
  assigned_ts: string;
  link_id: string;
}

interface EffectivePermission {
  entity_code: string;
  entity_name?: string;
  entity_icon?: string;
  permission: number;
  is_deny: boolean;
  source: 'direct' | 'inherited';
  inherited_from?: {
    entity_code: string;
    entity_name?: string;
  };
}

interface EntityOption {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
}

interface PersonOption {
  id: string;
  name: string;
  code?: string;
  email?: string;
}

// Tab types
type DetailTab = 'permissions' | 'persons' | 'effective';

export function AccessControlPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('permissions');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showAssignPersonModal, setShowAssignPersonModal] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState('');

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

  // Fetch permissions for selected role
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ['access-control', 'role', selectedRoleId, 'permissions'],
    queryFn: async () => {
      if (!selectedRoleId) return null;
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/role/${selectedRoleId}/permissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch permissions');
      return response.json();
    },
    enabled: !!selectedRoleId
  });

  // Fetch persons (members) for selected role
  const { data: personsData, isLoading: personsLoading } = useQuery({
    queryKey: ['access-control', 'role', selectedRoleId, 'members'],
    queryFn: async () => {
      if (!selectedRoleId) return null;
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/role/${selectedRoleId}/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch members');
      return response.json();
    },
    enabled: !!selectedRoleId
  });

  // Fetch effective access for selected role
  const { data: effectiveData, isLoading: effectiveLoading } = useQuery({
    queryKey: ['access-control', 'role', selectedRoleId, 'effective'],
    queryFn: async () => {
      if (!selectedRoleId) return null;
      const token = localStorage.getItem('auth_token');
      // Get first person in role to check effective permissions
      const firstPerson = personsData?.data?.[0];
      if (!firstPerson) return { data: [] };

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/person/${firstPerson.person_id}/effective-access`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch effective access');
      return response.json();
    },
    enabled: !!selectedRoleId && activeTab === 'effective' && !!personsData?.data?.length
  });

  // Fetch persons for assignment
  const { data: availablePersonsData } = useQuery({
    queryKey: ['access-control', 'available-persons'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/person?limit=1000&active_flag=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch persons');
      return response.json();
    },
    enabled: showAssignPersonModal
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
    (entitiesData || []).forEach((e: EntityOption) => {
      labels[e.code] = e.ui_label || e.name;
    });
    return labels;
  }, [entitiesData]);

  const entityIcons = useMemo(() => {
    const icons: Record<string, string> = {};
    (entitiesData || []).forEach((e: EntityOption) => {
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
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'permissions'] });
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'effective'] });
    }
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (personId: string) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/role/${selectedRoleId}/members`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ person_id: personId })
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'members'] });
      setShowAssignPersonModal(false);
      setSelectedPersonId('');
    }
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (personId: string) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/role/${selectedRoleId}/members/${personId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to remove member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'members'] });
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
                      onClick={() => {
                        setSelectedRoleId(role.id);
                        setActiveTab('permissions');
                      }}
                      className={cn(
                        "w-full px-4 py-3.5 text-left transition-all",
                        selectedRoleId === role.id
                          ? "bg-slate-50 border-l-3 border-l-slate-600"
                          : "hover:bg-dark-50 border-l-3 border-l-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          selectedRoleId === role.id ? "bg-slate-200" : "bg-dark-100"
                        )}>
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

          {/* Right Panel - Role Detail */}
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

                {/* Tabs */}
                <div className="px-6 border-b border-dark-200">
                  <div className="flex gap-1">
                    {[
                      { id: 'permissions' as DetailTab, label: 'Permissions', icon: LucideIcons.Shield, count: permissionsData?.data?.length },
                      { id: 'persons' as DetailTab, label: 'Members', icon: LucideIcons.UserPlus, count: personsData?.data?.length },
                      { id: 'effective' as DetailTab, label: 'Effective Access', icon: LucideIcons.Eye, count: null }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                          activeTab === tab.id
                            ? "border-slate-600 text-slate-700"
                            : "border-transparent text-dark-500 hover:text-dark-700"
                        )}
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {tab.count !== null && tab.count !== undefined && (
                          <span className={cn(
                            "px-1.5 py-0.5 text-xs rounded-full",
                            activeTab === tab.id ? "bg-slate-200 text-slate-700" : "bg-dark-100 text-dark-600"
                          )}>
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

                  {/* Persons (Members) Tab */}
                  {activeTab === 'persons' && (
                    <div className="p-6">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-dark-700">Role Members</span>
                          <span className="px-2 py-0.5 text-xs bg-dark-100 rounded text-dark-600">
                            {personsData?.data?.length || 0} member{(personsData?.data?.length || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => setShowAssignPersonModal(true)}
                          className="px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                          <LucideIcons.UserPlus className="h-4 w-4" />
                          Add Member
                        </button>
                      </div>

                      {/* Info Banner */}
                      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-3">
                          <LucideIcons.Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="text-sm text-blue-700">
                            <p className="font-medium">Role-Based Access Control</p>
                            <p className="mt-1 text-blue-600">
                              People receive permissions through role membership. Add members to grant them all permissions assigned to this role.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Members List */}
                      {personsLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                        </div>
                      ) : !personsData?.data || personsData.data.length === 0 ? (
                        <div className="text-center py-12 text-dark-500">
                          <div className="p-4 bg-dark-100 rounded-2xl inline-block mb-3">
                            <LucideIcons.UserX className="h-10 w-10 text-dark-300" />
                          </div>
                          <p className="text-sm font-medium">No members assigned</p>
                          <p className="text-xs text-dark-400 mt-1">
                            Click "Add Member" to assign people to this role
                          </p>
                        </div>
                      ) : (
                        <div className="border border-dark-200 rounded-xl overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-dark-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">
                                  Person
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">
                                  Code
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">
                                  Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">
                                  Assigned
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-dark-600 uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-100">
                              {personsData.data.map((person: PersonAssignment) => (
                                <tr key={person.link_id} className="hover:bg-dark-50 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 bg-dark-100 rounded-lg">
                                        <LucideIcons.User className="h-4 w-4 text-dark-500" />
                                      </div>
                                      <span className="font-medium text-dark-800">{person.person_name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-dark-600">
                                    {person.person_code || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-dark-600">
                                    {person.person_email || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-dark-600">
                                    {new Date(person.assigned_ts).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => {
                                        if (confirm('Are you sure you want to remove this person from the role?')) {
                                          removeMemberMutation.mutate(person.person_id);
                                        }
                                      }}
                                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Remove from Role"
                                    >
                                      <LucideIcons.UserMinus className="h-4 w-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                            Add members to see their effective access
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
            queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'permissions'] });
            queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'effective'] });
          }}
        />
      )}

      {/* Assign Person Modal */}
      {showAssignPersonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 border border-dark-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <LucideIcons.UserPlus className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-dark-800">Add Member</h2>
                  <p className="text-sm text-dark-500 mt-0.5">to {selectedRole?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignPersonModal(false)}
                className="p-2 rounded-lg text-dark-400 hover:text-dark-600 hover:bg-dark-100 transition-colors"
              >
                <LucideIcons.X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6">
              <label className="block text-sm font-medium text-dark-700 mb-2">
                Select Person *
              </label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-dark-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
              >
                <option value="">Select a person...</option>
                {(availablePersonsData?.data || []).map((person: PersonOption) => (
                  <option key={person.id} value={person.id}>
                    {person.name} {person.code ? `(${person.code})` : ''} {person.email ? `- ${person.email}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-dark-500 mt-2">
                This person will receive all permissions assigned to the role.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-200 bg-dark-50">
              <button
                onClick={() => {
                  setShowAssignPersonModal(false);
                  setSelectedPersonId('');
                }}
                className="px-4 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => addMemberMutation.mutate(selectedPersonId)}
                disabled={!selectedPersonId || addMemberMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
              </button>
            </div>

            {/* Error Message */}
            {addMemberMutation.isError && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-200 text-sm text-red-700 flex items-center gap-2">
                <LucideIcons.AlertCircle className="h-4 w-4" />
                {(addMemberMutation.error as Error).message}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
