import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';

export function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const { tabs, loading } = useHeaderTabs('role', roleId!);

  // Mock role data - replace with actual API call
  const [roleData, setRoleData] = React.useState<any>(null);
  const [roleLoading, setRoleLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchRole = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/v1/role/${roleId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setRoleData(data);
        }
      } catch (error) {
        console.error('Error fetching role:', error);
      } finally {
        setRoleLoading(false);
      }
    };

    if (roleId) {
      fetchRole();
    }
  }, [roleId]);

  if (roleLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header Tab Navigation */}
        <HeaderTabNavigation
          title={roleData?.name || 'Role Details'}
          parentType="role"
          parentId={roleId!}
          parentName={roleData?.name}
          tabs={tabs}
        />

        {/* Action Bar */}
        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Edit Role
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Manage Permissions
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Assign Employees
              </button>
            </div>
          }
        />

        {/* Role Overview Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Role Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {roleData?.employee_count || 0}
                </div>
                <div className="text-sm text-gray-500">Assigned Employees</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {roleData?.permission_count || 0}
                </div>
                <div className="text-sm text-gray-500">Permissions</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {roleData?.access_level || 'Standard'}
                </div>
                <div className="text-sm text-gray-500">Access Level</div>
              </div>
            </div>

            {/* Role Information */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Role Information</h3>
              </div>
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Role Name</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-medium">{roleData?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Role Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{roleData?.role_type || 'Standard'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        roleData?.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {roleData?.active ? 'Active' : 'Inactive'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Department</dt>
                    <dd className="mt-1 text-sm text-gray-900">{roleData?.department || 'All Departments'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Created Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {roleData?.created ? new Date(roleData.created).toLocaleDateString() : 'Unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Modified</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {roleData?.updated ? new Date(roleData.updated).toLocaleDateString() : 'Unknown'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Role Description */}
            {roleData?.description && (
              <div className="bg-white rounded-lg shadow mt-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Role Description</h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{roleData.description}</p>
                </div>
              </div>
            )}

            {/* Permissions Overview */}
            {roleData?.permissions && roleData.permissions.length > 0 && (
              <div className="bg-white rounded-lg shadow mt-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Key Permissions</h3>
                </div>
                <div className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {roleData.permissions.slice(0, 10).map((permission: string, index: number) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {permission}
                      </span>
                    ))}
                    {roleData.permissions.length > 10 && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        +{roleData.permissions.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}