import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';

export function WorksiteDetailPage() {
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
          title={worksiteData?.name || 'Worksite Details'}
          parentType="worksite"
          parentId={worksiteId!}
          parentName={worksiteData?.name}
          tabs={tabs}
        />

        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Edit Worksite
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                View Location
              </button>
            </div>
          }
        />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Worksite Information</h3>
              </div>
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Worksite Name</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-medium">{worksiteData?.name || 'Worksite'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        worksiteData?.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {worksiteData?.active ? 'Active' : 'Inactive'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Location</dt>
                    <dd className="mt-1 text-sm text-gray-900">{worksiteData?.location || 'Not specified'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{worksiteData?.worksite_type || 'Not specified'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}