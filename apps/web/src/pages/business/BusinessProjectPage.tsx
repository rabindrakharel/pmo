import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { FilterChips } from '../../components/common/ScopeFilters';
import { FilteredDataTable } from '../../components/FilteredDataTable';
import { businessApi } from '../../lib/api';

export function BusinessProjectPage() {
  const { bizId } = useParams<{ bizId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useHeaderTabs('biz', bizId!);
  const [businessData, setBusinessData] = React.useState<any>(null);
  const [businessLoading, setBusinessLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchBusiness = async () => {
      if (!bizId) return;

      try {
        setBusinessLoading(true);
        const response = await businessApi.get(bizId);
        if (response) {
          setBusinessData(response);
        }
      } catch (error) {
        console.error('Error fetching business:', error);
      } finally {
        setBusinessLoading(false);
      }
    };

    fetchBusiness();
  }, [bizId]);

  if (loading || businessLoading) {
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
          title={businessData?.name || 'Business Unit'}
          parentType="biz"
          parentId={bizId!}
          parentName={businessData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/biz')}
        />

        <ActionBar
          createButton={{
            entityType: 'project',
            parentEntity: 'biz',
            parentEntityId: bizId!,
          }}
        />

        <FilteredDataTable
          entityType="project"
          parentEntity="biz"
          parentEntityId={bizId!}
        />
      </div>
    </Layout>
  );
}