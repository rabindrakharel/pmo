import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';
import { FilteredDataTable } from '../../components/FilteredDataTable';

export function TaskArtifactPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { tabs, loading } = useHeaderTabs('task', taskId!);

  // Mock task data - replace with actual API call
  const [taskData, setTaskData] = React.useState<any>(null);
  const [taskLoading, setTaskLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTask = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/v1/task/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setTaskData(data);
        }
      } catch (error) {
        console.error('Error fetching task:', error);
      } finally {
        setTaskLoading(false);
      }
    };

    if (taskId) {
      fetchTask();
    }
  }, [taskId]);

  if (taskLoading || loading) {
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
          title={`${taskData?.name || 'Task'} - Artifacts`}
          parentType="task"
          parentId={taskId!}
          parentName={taskData?.name}
          tabs={tabs}
        />

        <ActionBar
          createButton={{
            entityType: 'artifact',
            parentEntityType: 'task',
            parentEntityId: taskId!,
          }}
        />

        <FilteredDataTable
          entityType="artifact"
          parentEntityType="task"
          parentEntityId={taskId!}
        />
      </div>
    </Layout>
  );
}