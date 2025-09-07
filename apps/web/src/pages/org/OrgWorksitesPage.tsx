import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';

export function OrgWorksitesPage() {
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
        <HeaderTabNavigation
          title={`${orgData?.name || 'Organization'} - Worksites`}
          parentType="org"
          parentId={orgId!}
          parentName={orgData?.name}
          tabs={tabs}
        />

        <ActionBar
          createButton={{
            entityType: 'worksite',
            parentEntityType: 'org',
            parentEntityId: orgId!,
          }}
        />

        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500">Organization worksites would go here...</p>
            <p className="text-sm text-gray-400 mt-2">
              This would show all worksites and facilities managed by this organization.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}