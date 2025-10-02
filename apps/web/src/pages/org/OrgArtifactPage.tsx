import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../../components/common/DynamicChildEntityTabs';
import { ActionBar } from '../../components/common/Button';
import { FilteredDataTable } from '../../components/FilteredDataTable';
import { orgApi } from '../../lib/api';

export function OrgArtifactPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useDynamicChildEntityTabs('org', orgId!);
  const [orgData, setOrgData] = React.useState<any>(null);
  const [orgLoading, setOrgLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchOrg = async () => {
      if (!orgId) return;

      try {
        setOrgLoading(true);
        const response = await orgApi.get(orgId);
        if (response) {
          console.log('Organization data received:', response);
          setOrgData(response);
        }
      } catch (error) {
        console.error('Error fetching office:', error);
      } finally {
        setOrgLoading(false);
      }
    };

    fetchOrg();
  }, [orgId]);

  if (loading || orgLoading) {
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
          title={orgData?.name || 'Office'}
          parentType="org"
          parentId={orgId!}
          parentName={orgData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/org')}
        />

        <ActionBar
          createButton={{
            entityType: 'artifact',
            parentEntity: 'org',
            parentEntityId: orgId!,
          }}
        />

        <FilteredDataTable
          entityType="artifact"
          parentEntity="org"
          parentEntityId={orgId!}
        />
      </div>
    </Layout>
  );
}