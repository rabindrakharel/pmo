import React, { useState, useEffect } from 'react';
import { UserCheck, Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { roleApi } from '../lib/api';

interface Role {
  id: string;
  name: string;
  descr?: string;
  roleType?: string;
  roleCategory?: string;
  authorityLevel?: string;
  approvalLimit?: number;
  delegationAllowed?: boolean;
  active?: boolean;
  fromTs?: string;
  toTs?: string;
  created?: string;
  updated?: string;
  tags?: string[];
  attr?: any;
}

export function RolePage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadRoles();
  }, [pagination.current, pagination.pageSize]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const response = await roleApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setRoles(response.data || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      console.error('Failed to load roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const getStatusBadge = (active?: boolean) => {
    const isActive = active !== false;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  const getRoleTypeBadge = (type?: string) => {
    if (!type) return null;
    
    const typeColors: Record<string, string> = {
      'functional': 'bg-blue-100 text-blue-800',
      'administrative': 'bg-purple-100 text-purple-800',
      'temporary': 'bg-yellow-100 text-yellow-800',
    };
    
    const colorClass = typeColors[type] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {type}
      </span>
    );
  };

  const getAuthorityLevelBadge = (level?: string) => {
    if (!level) return null;
    
    const levelColors: Record<string, string> = {
      'basic': 'bg-gray-100 text-gray-800',
      'standard': 'bg-green-100 text-green-800',
      'elevated': 'bg-orange-100 text-orange-800',
      'administrative': 'bg-red-100 text-red-800',
    };
    
    const colorClass = levelColors[level] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {level}
      </span>
    );
  };

  const tableColumns: Column<Role>[] = [
    {
      key: 'name',
      title: 'Role Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {record.descr && (
            <div className="text-sm text-gray-500 truncate max-w-xs" title={record.descr}>
              {record.descr}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'roleType',
      title: 'Type',
      sortable: true,
      filterable: true,
      render: (value) => getRoleTypeBadge(value),
    },
    {
      key: 'roleCategory',
      title: 'Category',
      sortable: true,
      filterable: true,
      render: (value) => value ? (
        <div className="max-w-xs truncate" title={value}>
          {value}
        </div>
      ) : '-',
    },
    {
      key: 'authorityLevel',
      title: 'Authority Level',
      sortable: true,
      filterable: true,
      render: (value) => getAuthorityLevelBadge(value),
    },
    {
      key: 'approvalLimit',
      title: 'Approval Limit',
      sortable: true,
      align: 'right',
      render: (value) => value ? `$${value.toLocaleString()}` : '-',
    },
    {
      key: 'delegationAllowed',
      title: 'Delegation',
      sortable: true,
      align: 'center',
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value ? 'Allowed' : 'Not Allowed'}
        </span>
      ),
    },
    {
      key: 'active',
      title: 'Status',
      sortable: true,
      filterable: true,
      render: (value) => getStatusBadge(value),
    },
    {
      key: 'created',
      title: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-',
    },
  ];

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Roles</h1>
              <p className="mt-1 text-gray-600">Manage organizational roles and permission templates</p>
            </div>
          </div>
          
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200">
            <Plus className="h-4 w-4 mr-2" />
            New Role
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{roles.length}</div>
            <div className="text-sm text-gray-600">Total Roles</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600">
              {roles.filter(r => r.active !== false).length}
            </div>
            <div className="text-sm text-gray-600">Active Roles</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {roles.filter(r => r.roleType === 'functional').length}
            </div>
            <div className="text-sm text-gray-600">Functional Roles</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {roles.filter(r => r.delegationAllowed).length}
            </div>
            <div className="text-sm text-gray-600">Delegation Enabled</div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <DataTable
            data={roles}
            columns={tableColumns}
            loading={loading}
            pagination={{
              ...pagination,
              onChange: handlePaginationChange,
            }}
            rowKey="id"
            filterable={true}
            columnSelection={true}
            onRowClick={(role) => console.log('Navigate to role:', role.id)}
            onView={(role) => console.log('View role:', role.id)}
            onEdit={(role) => console.log('Edit role:', role.id)}
            onShare={(role) => console.log('Share role:', role.id)}
            onDelete={(role) => console.log('Delete role:', role.id)}
          />
        </div>
      </div>
    </Layout>
  );
}