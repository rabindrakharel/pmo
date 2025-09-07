import React from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../../components/common/HeaderTabNavigation';
import { ActionBar } from '../../components/common/RBACButton';

export function TaskArtifactsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { tabs, loading } = useHeaderTabs('task', taskId!);

  // Mock task data - replace with actual API call
  const [taskData, setTaskData] = React.useState<any>(null);
  const [taskLoading, setTaskLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTask = async () => {
      try {
        const token = localStorage.getItem('accessToken');
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

        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500">Task artifacts would go here...</p>
            <p className="text-sm text-gray-400 mt-2">
              This would show deliverables, outputs, files, and documentation produced by this task.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}