import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../../components/common/DynamicChildEntityTabs';
import { ActionBar } from '../../components/common/Button';
import { FilteredDataTable } from '../../components/FilteredDataTable';
import { orgApi } from '../../lib/api';

export function OrgEmployeePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useDynamicChildEntityTabs('org', orgId!);

  // Mock organization data - replace with actual API call
  const [orgData, setOrgData] = React.useState<any>(null);
  const [orgLoading, setOrgLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchOrganization = async () => {
      if (!orgId) return;

      try {
        setOrgLoading(true);
        const response = await orgApi.get(orgId);
        if (response) {
          setOrgData(response);
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
      } finally {
        setOrgLoading(false);
      }
    };

    fetchOrganization();
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
        <DynamicChildEntityTabs
          title={orgData?.name || 'Organization'}
          parentType="org"
          parentId={orgId!}
          parentName={orgData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/org')}
        />

        <ActionBar
          createButton={{
            entityType: 'employee',
            parentEntity: 'org',
            parentEntityId: orgId!,
          }}
        />

        <FilteredDataTable
          entityType="employee"
          parentEntity="org"
          parentEntityId={orgId!}
        />
      </div>
    </Layout>
  );
}