import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export function BusinessTasksPage() {
  const { bizId } = useParams<{ bizId: string }>();
  const { tabs, loading } = useHeaderTabs('biz', bizId!);

  // Mock business data - replace with actual API call
  const [businessData, setBusinessData] = React.useState<any>(null);
  const [businessLoading, setBusinessLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/v1/biz/${bizId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setBusinessData(data);
        }
      } catch (error) {
        console.error('Error fetching business:', error);
      } finally {
        setBusinessLoading(false);
      }
    };

    if (bizId) {
      fetchBusiness();
    }
  }, [bizId]);

  if (businessLoading || loading) {
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
          title={`${businessData?.name || 'Business Unit'} - Tasks`}
          parentType="biz"
          parentId={bizId!}
          parentName={businessData?.name}
          tabs={tabs}
        />

        <ActionBar
          createButton={{
            entityType: 'task',
            parentEntityType: 'biz',
            parentEntityId: bizId!,
          }}
        />

        <FilteredDataTable
          entityType="task"
          parentEntityType="biz"
          parentEntityId={bizId!}
        />
      </div>
    </Layout>
  );
}