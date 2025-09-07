import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';

export function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { tabs, loading } = useHeaderTabs('org', orgId!);

  // Mock organization data - replace with actual API call
  const [orgData, setOrgData] = React.useState<any>(null);
  const [orgLoading, setOrgLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/v1/org/${orgId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setOrgData(data);
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
      } finally {
        setOrgLoading(false);
      }
    };

    if (orgId) {
      fetchOrganization();
    }
  }, [orgId]);

  if (orgLoading || loading) {
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
          title={orgData?.name || 'Organization Details'}
          parentType="org"
          parentId={orgId!}
          parentName={orgData?.name}
          tabs={tabs}
        />

        {/* Action Bar */}
        <ActionBar
          createButton={{
            entityType: 'worksite',
            parentEntityType: 'org',
            parentEntityId: orgId!,
          }}
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Edit Organization
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                View Territory Map
              </button>
            </div>
          }
        />

        {/* Organization Overview Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Organization Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {orgData?.worksite_count || 0}
                </div>
                <div className="text-sm text-gray-500">Worksites</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {orgData?.employee_count || 0}
                </div>
                <div className="text-sm text-gray-500">Employees</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {orgData?.territory_size || 0}
                </div>
                <div className="text-sm text-gray-500">Territory (km²)</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-gray-900">
                  {orgData?.active_projects || 0}
                </div>
                <div className="text-sm text-gray-500">Active Projects</div>
              </div>
            </div>

            {/* Organization Information */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Organization Information</h3>
              </div>
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Organization Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{orgData?.org_type || 'Not specified'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        orgData?.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {orgData?.active ? 'Active' : 'Inactive'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Location</dt>
                    <dd className="mt-1 text-sm text-gray-900">{orgData?.location || 'Not specified'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Parent Organization</dt>
                    <dd className="mt-1 text-sm text-gray-900">{orgData?.parent_org_name || 'Root organization'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Established</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {orgData?.established_date ? new Date(orgData.established_date).toLocaleDateString() : 'Not specified'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Contact</dt>
                    <dd className="mt-1 text-sm text-gray-900">{orgData?.contact_info || 'Not provided'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Organization Description */}
            {orgData?.description && (
              <div className="bg-white rounded-lg shadow mt-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Description</h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{orgData.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}