import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export function OrgEmployeePage() {
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
          title={`${orgData?.name || 'Organization'} - Employees`}
          parentType="org"
          parentId={orgId!}
          parentName={orgData?.name}
          tabs={tabs}
        />

        <ActionBar
          createButton={{
            entityType: 'employee',
            parentEntityType: 'org',
            parentEntityId: orgId!,
          }}
        />

        <FilteredDataTable
          entityType="employee"
          parentEntityType="org"
          parentEntityId={orgId!}
        />
      </div>
    </Layout>
  );
}