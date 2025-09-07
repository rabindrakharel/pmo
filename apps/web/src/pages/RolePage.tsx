import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Shield, Users } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatsGrid } from '../components/common/StatsGrid';
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
  const navigate = useNavigate();
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
    <Layout createButton={{ label: "Create Role", href: "/roles/new" }}>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Roles</h1>
            <p className="mt-1 text-gray-600">Manage organizational roles and permission templates</p>
          </div>
        </div>

        <StatsGrid 
          stats={[
            {
              value: roles.length,
              label: "Total Roles",
              color: "blue",
              icon: UserCheck
            },
            {
              value: roles.filter(r => r.active !== false).length,
              label: "Active Roles",
              color: "green",
              icon: Users
            },
            {
              value: roles.filter(r => r.roleType === 'functional').length,
              label: "Functional Roles",
              color: "purple",
              icon: Shield
            }
          ]}
        />

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
            onRowClick={(role) => navigate(`/roles/${role.id}`)}
            onView={(role) => navigate(`/roles/${role.id}`)}
            onEdit={(role) => navigate(`/roles/${role.id}/edit`)}
            onShare={(role) => console.log('Share role:', role.id)}
            onDelete={async (role) => {
              if (window.confirm(`Are you sure you want to delete "${role.name}"?`)) {
                try {
                  await roleApi.delete(role.id);
                  loadRoles(); // Reload the list
                } catch (error) {
                  console.error('Failed to delete role:', error);
                  alert('Failed to delete role. Please try again.');
                }
              }
            }}
          />
        </div>
      </div>
    </Layout>
  );
}