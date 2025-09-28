import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../../components/common/DynamicChildEntityTabs';
import { ActionBar } from '../../components/common/Button';
import { FilteredDataTable } from '../../components/FilteredDataTable';
import { businessApi } from '../../lib/api';

export function BusinessFormPage() {
  const { bizId } = useParams<{ bizId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useDynamicChildEntityTabs('biz', bizId!);

  // Mock business data - replace with actual API call
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
        <DynamicChildEntityTabs
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
            entityType: 'form',
            parentEntity: 'biz',
            parentEntityId: bizId!,
          }}
        />

        <FilteredDataTable
          entityType="form"
          parentEntity="biz"
          parentEntityId={bizId!}
        />
      </div>
    </Layout>
  );
}