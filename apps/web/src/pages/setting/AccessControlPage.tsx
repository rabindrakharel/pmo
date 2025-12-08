import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/shared';
import { API_CONFIG } from '../../lib/config/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as LucideIcons from 'lucide-react';

/**
 * Access Control Page
 *
 * Dedicated page for managing RBAC:
 * - Role selection (left panel)
 * - Role detail with Permissions and Persons tabs (right panel)
 *
 * Uses entity_rbac for permissions and entity_instance_link for person assignments.
 */

// Permission level configuration
const PERMISSION_CONFIG: Record<number, { label: string; className: string }> = {
  0: { label: 'View', className: 'bg-slate-100 text-slate-700' },
  1: { label: 'Comment', className: 'bg-sky-100 text-sky-700' },
  3: { label: 'Edit', className: 'bg-blue-100 text-blue-700' },
  4: { label: 'Share', className: 'bg-violet-100 text-violet-700' },
  5: { label: 'Delete', className: 'bg-orange-100 text-orange-700' },
  6: { label: 'Create', className: 'bg-emerald-100 text-emerald-700' },
  7: { label: 'Owner', className: 'bg-red-100 text-red-700' },
};

// Person type configuration
const PERSON_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  employee: { label: 'Employee', className: 'bg-blue-100 text-blue-700' },
  cust: { label: 'Customer', className: 'bg-green-100 text-green-700' },
  vendor: { label: 'Vendor', className: 'bg-purple-100 text-purple-700' },
  supplier: { label: 'Supplier', className: 'bg-orange-100 text-orange-700' },
};

// ALL_ENTITIES_ID constant for type-level permissions
const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// Types
interface Role {
  id: string;
  name: string;
  code: string;
  descr?: string;
  active_flag: boolean;
}

interface RBACPermission {
  id: string;
  entity_code: string;
  entity_instance_id: string;
  permission: number;
  granted_by__employee_id?: string;
  granted_ts: string;
  expires_ts?: string | null;
  entity_name?: string;
  entity_ui_label?: string;
}

interface PersonAssignment {
  person_type: string;
  person_id: string;
  name: string;
  code: string;
  email?: string;
  assigned_ts: string;
  link_id: string;
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

// Tab type for role detail
type DetailTab = 'permissions' | 'persons';

export function AccessControlPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('permissions');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [showAddPermissionModal, setShowAddPermissionModal] = useState(false);
  const [showAssignPersonModal, setShowAssignPersonModal] = useState(false);

  // Add permission form state
  const [newPermission, setNewPermission] = useState({
    entity_code: '',
    entity_instance_id: '',
    permission: 0,
    expires_ts: '',
  });

  // Add person form state
  const [newPerson, setNewPerson] = useState({
    person_type: 'employee' as 'employee' | 'cust' | 'vendor' | 'supplier',
    person_id: '',
  });

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
    },
  });

  // Fetch permissions for selected role
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ['access-control', 'role', selectedRoleId, 'permissions'],
    queryFn: async () => {
      if (!selectedRoleId) return null;
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/access-control/role/${selectedRoleId}/permissions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch permissions');
      return response.json();
    },
    enabled: !!selectedRoleId,
  });

  // Fetch persons for selected role
  const { data: personsData, isLoading: personsLoading } = useQuery({
    queryKey: ['access-control', 'role', selectedRoleId, 'persons'],
    queryFn: async () => {
      if (!selectedRoleId) return null;
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/access-control/role/${selectedRoleId}/persons`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch persons');
      return response.json();
    },
    enabled: !!selectedRoleId,
  });

  // Fetch entity options for dropdown
  const { data: entitiesData } = useQuery({
    queryKey: ['access-control', 'entities'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/access-control/entities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch entities');
      return response.json();
    },
  });

  // Fetch employees for dropdown
  const { data: employeesData } = useQuery({
    queryKey: ['access-control', 'employees'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/access-control/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch employees');
      return response.json();
    },
    enabled: showAssignPersonModal && newPerson.person_type === 'employee',
  });

  // Fetch customers for dropdown
  const { data: customersData } = useQuery({
    queryKey: ['access-control', 'customers'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/access-control/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json();
    },
    enabled: showAssignPersonModal && newPerson.person_type === 'cust',
  });

  // Grant permission mutation
  const grantPermissionMutation = useMutation({
    mutationFn: async (data: typeof newPermission) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/access-control/role/${selectedRoleId}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            entity_code: data.entity_code,
            entity_instance_id: data.entity_instance_id || ALL_ENTITIES_ID,
            permission: data.permission,
            expires_ts: data.expires_ts || null,
          })
        }
      );
      if (!response.ok) throw new Error('Failed to grant permission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'permissions'] });
      setShowAddPermissionModal(false);
      setNewPermission({ entity_code: '', entity_instance_id: '', permission: 0, expires_ts: '' });
    },
  });

  // Revoke permission mutation
  const revokePermissionMutation = useMutation({
    mutationFn: async (permissionId: string) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/revoke-permission/${permissionId}`,
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
    },
  });

  // Assign person mutation
  const assignPersonMutation = useMutation({
    mutationFn: async (data: typeof newPerson) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/access-control/role/${selectedRoleId}/persons`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign person');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'persons'] });
      setShowAssignPersonModal(false);
      setNewPerson({ person_type: 'employee', person_id: '' });
    },
  });

  // Remove person mutation
  const removePersonMutation = useMutation({
    mutationFn: async ({ personType, personId }: { personType: string; personId: string }) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/access-control/role/${selectedRoleId}/persons/${personType}/${personId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!response.ok) throw new Error('Failed to remove person');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-control', 'role', selectedRoleId, 'persons'] });
    },
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

  // Get person options based on type
  const personOptions = useMemo(() => {
    if (newPerson.person_type === 'employee') {
      return employeesData?.data || [];
    }
    if (newPerson.person_type === 'cust') {
      return customersData?.data || [];
    }
    return [];
  }, [newPerson.person_type, employeesData, customersData]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-md text-dark-500 hover:text-dark-700 hover:bg-dark-100 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-all"
              title="Back to Settings"
            >
              <LucideIcons.ArrowLeft className="h-5 w-5 stroke-[2]" />
            </button>
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-slate-100 rounded-xl border border-dark-200 shadow-sm">
                <LucideIcons.Shield className="h-6 w-6 text-slate-600 stroke-[1.5]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-dark-800 tracking-tight">Access Control</h1>
                <p className="text-sm text-dark-600 mt-0.5">Manage role permissions and person assignments</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Two Panel Layout */}
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Role List */}
          <div className="w-80 flex-shrink-0 bg-white border border-dark-200 rounded-lg shadow-sm flex flex-col">
            {/* Search Header */}
            <div className="p-4 border-b border-dark-200">
              <div className="relative">
                <LucideIcons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-dark-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400 transition-all placeholder:text-dark-400"
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
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        selectedRoleId === role.id
                          ? 'bg-slate-100 border-l-2 border-l-slate-600'
                          : 'hover:bg-dark-50 border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-md ${selectedRoleId === role.id ? 'bg-slate-200' : 'bg-dark-100'}`}>
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
          <div className="flex-1 bg-white border border-dark-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            {!selectedRoleId ? (
              <div className="flex-1 flex items-center justify-center text-dark-500">
                <div className="text-center">
                  <LucideIcons.MousePointer className="h-8 w-8 mx-auto mb-2 text-dark-400" />
                  <p className="text-sm">Select a role to view details</p>
                </div>
              </div>
            ) : (
              <>
                {/* Role Header */}
                <div className="px-6 py-4 border-b border-dark-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <LucideIcons.Users className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-dark-800">{selectedRole?.name}</h2>
                        <p className="text-sm text-dark-500">{selectedRole?.code}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/role/${selectedRoleId}`)}
                      className="px-3 py-1.5 text-sm text-dark-600 hover:text-dark-800 hover:bg-dark-100 rounded-md transition-colors"
                    >
                      View Role Details
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-dark-200">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveTab('permissions')}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'permissions'
                          ? 'border-slate-600 text-slate-700'
                          : 'border-transparent text-dark-600 hover:text-dark-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <LucideIcons.Shield className="h-4 w-4" />
                        Permissions
                        {permissionsData?.data && (
                          <span className="px-1.5 py-0.5 text-xs bg-dark-200 rounded-full">
                            {permissionsData.data.length}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('persons')}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'persons'
                          ? 'border-slate-600 text-slate-700'
                          : 'border-transparent text-dark-600 hover:text-dark-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <LucideIcons.UserPlus className="h-4 w-4" />
                        Persons
                        {personsData?.data && (
                          <span className="px-1.5 py-0.5 text-xs bg-dark-200 rounded-full">
                            {personsData.data.length}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Permissions Tab */}
                  {activeTab === 'permissions' && (
                    <div className="p-6">
                      {/* Add Permission Button */}
                      <div className="flex justify-end mb-4">
                        <button
                          onClick={() => setShowAddPermissionModal(true)}
                          className="px-3 py-1.5 text-sm font-medium bg-slate-600 text-white rounded-md hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:outline-none transition-colors shadow-sm flex items-center gap-2"
                        >
                          <LucideIcons.Plus className="h-4 w-4" />
                          Grant Permission
                        </button>
                      </div>

                      {/* Permissions Table */}
                      {permissionsLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600" />
                        </div>
                      ) : !permissionsData?.data || permissionsData.data.length === 0 ? (
                        <div className="text-center py-8 text-dark-500">
                          <LucideIcons.ShieldOff className="h-8 w-8 mx-auto mb-2 text-dark-400" />
                          <p className="text-sm">No permissions granted to this role</p>
                          <p className="text-xs text-dark-400 mt-1">Click "Grant Permission" to add one</p>
                        </div>
                      ) : (
                        <div className="border border-dark-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-dark-50">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Entity</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Scope</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Permission</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Granted</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Expires</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-100">
                              {permissionsData.data.map((perm: RBACPermission) => (
                                <tr key={perm.id} className="hover:bg-dark-50">
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-dark-700">
                                      {perm.entity_ui_label || perm.entity_code}
                                    </div>
                                    <div className="text-xs text-dark-500">{perm.entity_code}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    {perm.entity_instance_id === ALL_ENTITIES_ID ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                                        <LucideIcons.Globe className="h-3 w-3" />
                                        All Instances
                                      </span>
                                    ) : (
                                      <span className="text-xs text-dark-600 font-mono">
                                        {perm.entity_instance_id.slice(0, 8)}...
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                      PERMISSION_CONFIG[perm.permission]?.className || 'bg-dark-100 text-dark-700'
                                    }`}>
                                      {PERMISSION_CONFIG[perm.permission]?.label || `Level ${perm.permission}`}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-dark-600">
                                    {new Date(perm.granted_ts).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-dark-600">
                                    {perm.expires_ts ? new Date(perm.expires_ts).toLocaleDateString() : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => {
                                        if (confirm('Are you sure you want to revoke this permission?')) {
                                          revokePermissionMutation.mutate(perm.id);
                                        }
                                      }}
                                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                                      title="Revoke Permission"
                                    >
                                      <LucideIcons.Trash2 className="h-4 w-4" />
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

                  {/* Persons Tab */}
                  {activeTab === 'persons' && (
                    <div className="p-6">
                      {/* Assign Person Button */}
                      <div className="flex justify-end mb-4">
                        <button
                          onClick={() => setShowAssignPersonModal(true)}
                          className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none transition-colors shadow-sm flex items-center gap-2"
                        >
                          <LucideIcons.UserPlus className="h-4 w-4" />
                          Assign Person
                        </button>
                      </div>

                      {/* Persons Table */}
                      {personsLoading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                        </div>
                      ) : !personsData?.data || personsData.data.length === 0 ? (
                        <div className="text-center py-8 text-dark-500">
                          <LucideIcons.UserX className="h-8 w-8 mx-auto mb-2 text-dark-400" />
                          <p className="text-sm">No persons assigned to this role</p>
                          <p className="text-xs text-dark-400 mt-1">Click "Assign Person" to add one</p>
                        </div>
                      ) : (
                        <div className="border border-dark-200 rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-dark-50">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Code</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Email</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-dark-600 uppercase tracking-wider">Assigned</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-dark-600 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-100">
                              {personsData.data.map((person: PersonAssignment) => (
                                <tr key={person.link_id} className="hover:bg-dark-50">
                                  <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                      PERSON_TYPE_CONFIG[person.person_type]?.className || 'bg-dark-100 text-dark-700'
                                    }`}>
                                      {PERSON_TYPE_CONFIG[person.person_type]?.label || person.person_type}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-medium text-dark-700">{person.name}</td>
                                  <td className="px-4 py-3 text-dark-600">{person.code || '—'}</td>
                                  <td className="px-4 py-3 text-dark-600">{person.email || '—'}</td>
                                  <td className="px-4 py-3 text-xs text-dark-600">
                                    {new Date(person.assigned_ts).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => {
                                        if (confirm('Are you sure you want to remove this person from the role?')) {
                                          removePersonMutation.mutate({
                                            personType: person.person_type,
                                            personId: person.person_id
                                          });
                                        }
                                      }}
                                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
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
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Permission Modal */}
      {showAddPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 border border-dark-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <LucideIcons.Shield className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-dark-800">Grant Permission</h2>
                  <p className="text-sm text-dark-500 mt-0.5">to {selectedRole?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddPermissionModal(false)}
                className="p-2 rounded-md text-dark-400 hover:text-dark-600 hover:bg-dark-100 transition-colors"
              >
                <LucideIcons.X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Entity Select */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Entity Type *</label>
                <select
                  value={newPermission.entity_code}
                  onChange={(e) => setNewPermission({ ...newPermission, entity_code: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                >
                  <option value="">Select entity type...</option>
                  {entitiesData?.data?.map((entity: EntityOption) => (
                    <option key={entity.code} value={entity.code}>
                      {entity.ui_label} ({entity.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Permission Level */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Permission Level *</label>
                <select
                  value={newPermission.permission}
                  onChange={(e) => setNewPermission({ ...newPermission, permission: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                >
                  {Object.entries(PERMISSION_CONFIG).map(([level, config]) => (
                    <option key={level} value={level}>
                      {config.label} (Level {level})
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope (optional) */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Scope
                  <span className="text-xs text-dark-500 ml-1">(Leave empty for all instances)</span>
                </label>
                <input
                  type="text"
                  value={newPermission.entity_instance_id}
                  onChange={(e) => setNewPermission({ ...newPermission, entity_instance_id: e.target.value })}
                  placeholder="Specific instance UUID (optional)"
                  className="w-full px-3 py-2 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                />
              </div>

              {/* Expiration (optional) */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">
                  Expires
                  <span className="text-xs text-dark-500 ml-1">(Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={newPermission.expires_ts}
                  onChange={(e) => setNewPermission({ ...newPermission, expires_ts: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-200 bg-dark-50">
              <button
                onClick={() => setShowAddPermissionModal(false)}
                className="px-4 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => grantPermissionMutation.mutate(newPermission)}
                disabled={!newPermission.entity_code || grantPermissionMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-md hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/50 focus-visible:outline-none shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {grantPermissionMutation.isPending ? 'Granting...' : 'Grant Permission'}
              </button>
            </div>
          </div>
        </div>
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
                  <h2 className="text-lg font-semibold text-dark-800">Assign Person</h2>
                  <p className="text-sm text-dark-500 mt-0.5">to {selectedRole?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignPersonModal(false)}
                className="p-2 rounded-md text-dark-400 hover:text-dark-600 hover:bg-dark-100 transition-colors"
              >
                <LucideIcons.X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Person Type */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Person Type *</label>
                <select
                  value={newPerson.person_type}
                  onChange={(e) => setNewPerson({
                    person_type: e.target.value as 'employee' | 'cust' | 'vendor' | 'supplier',
                    person_id: ''
                  })}
                  className="w-full px-3 py-2 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                >
                  <option value="employee">Employee</option>
                  <option value="cust">Customer</option>
                  <option value="vendor">Vendor</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>

              {/* Person Select */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Select Person *</label>
                <select
                  value={newPerson.person_id}
                  onChange={(e) => setNewPerson({ ...newPerson, person_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-dark-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                >
                  <option value="">Select {PERSON_TYPE_CONFIG[newPerson.person_type]?.label?.toLowerCase() || 'person'}...</option>
                  {personOptions.map((person: PersonOption) => (
                    <option key={person.id} value={person.id}>
                      {person.name} {person.code ? `(${person.code})` : ''} {person.email ? `- ${person.email}` : ''}
                    </option>
                  ))}
                </select>
                {(newPerson.person_type === 'vendor' || newPerson.person_type === 'supplier') && (
                  <p className="text-xs text-amber-600 mt-1">
                    Note: Vendor and supplier assignment requires person records in the system.
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-200 bg-dark-50">
              <button
                onClick={() => setShowAssignPersonModal(false)}
                className="px-4 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => assignPersonMutation.mutate(newPerson)}
                disabled={!newPerson.person_id || assignPersonMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assignPersonMutation.isPending ? 'Assigning...' : 'Assign Person'}
              </button>
            </div>

            {/* Error Message */}
            {assignPersonMutation.isError && (
              <div className="px-6 py-3 bg-red-50 border-t border-red-200 text-sm text-red-700">
                {(assignPersonMutation.error as Error).message}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
