import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/Button';
import { FilteredDataTable } from '../../components/FilteredDataTable';
import { worksiteApi } from '../../lib/api';

export function WorksiteFormPage() {
  const { worksiteId } = useParams<{ worksiteId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useHeaderTabs('worksite', worksiteId!);

  // Mock worksite data - replace with actual API call
  const [worksiteData, setWorksiteData] = React.useState<any>(null);
  const [worksiteLoading, setWorksiteLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchWorksite = async () => {
      if (!worksiteId) return;

      try {
        setWorksiteLoading(true);
        const response = await worksiteApi.get(worksiteId);
        if (response) {
          setWorksiteData(response);
        }
      } catch (error) {
        console.error('Error fetching worksite:', error);
      } finally {
        setWorksiteLoading(false);
      }
    };

    fetchWorksite();
  }, [worksiteId]);

  if (worksiteLoading || loading) {
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
          title={worksiteData?.name || 'Worksite'}
          parentType="worksite"
          parentId={worksiteId!}
          parentName={worksiteData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/worksite')}
        />

        <ActionBar
          createButton={{
            entityType: 'form',
            parentEntity: 'worksite',
            parentEntityId: worksiteId!,
          }}
        />

        <FilteredDataTable
          entityType="form"
          parentEntity="worksite"
          parentEntityId={worksiteId!}
        />
      </div>
    </Layout>
  );
}