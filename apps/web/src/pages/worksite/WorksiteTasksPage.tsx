import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export function WorksiteTasksPage() {
  const { worksiteId } = useParams<{ worksiteId: string }>();
  const { tabs, loading } = useHeaderTabs('worksite', worksiteId!);

  // Mock worksite data - replace with actual API call
  const [worksiteData, setWorksiteData] = React.useState<any>(null);
  const [worksiteLoading, setWorksiteLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchWorksite = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/v1/worksite/${worksiteId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setWorksiteData(data);
        }
      } catch (error) {
        console.error('Error fetching worksite:', error);
      } finally {
        setWorksiteLoading(false);
      }
    };

    if (worksiteId) {
      fetchWorksite();
    }
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
          title={`${worksiteData?.name || 'Worksite'} - Tasks`}
          parentType="worksite"
          parentId={worksiteId!}
          parentName={worksiteData?.name}
          tabs={tabs}
        />

        <ActionBar
          createButton={{
            entityType: 'task',
            parentEntityType: 'worksite',
            parentEntityId: worksiteId!,
          }}
        />

        <FilteredDataTable
          entityType="task"
          parentEntityType="worksite"
          parentEntityId={worksiteId!}
        />
      </div>
    </Layout>
  );
}