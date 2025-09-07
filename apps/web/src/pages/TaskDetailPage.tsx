import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { HeaderTabNavigation, useHeaderTabs } from '../components/common/HeaderTabNavigation';
import { ActionBar } from '../components/common/RBACButton';
import { FileText, MessageSquare, Activity, Users, Clock } from 'lucide-react';

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { tabs, loading: tabsLoading } = useHeaderTabs('task', taskId!);
  const [taskData, setTaskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTaskData = async () => {
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
        setLoading(false);
      }
    };

    if (taskId) {
      fetchTaskData();
    }
  }, [taskId]);

  if (loading || tabsLoading) {
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
        {/* Header Tab Navigation */}
        <HeaderTabNavigation
          title={taskData?.name || 'Task Details'}
          parentType="task"
          parentId={taskId!}
          parentName={taskData?.name}
          tabs={tabs}
        />

        {/* Action Bar */}
        <ActionBar
          additionalActions={
            <div className="flex items-center space-x-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Edit
              </button>
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Share
              </button>
            </div>
          }
        />

        {/* Task Details Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Task Status */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">{taskData?.name}</h2>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      taskData?.task_status === 'completed' 
                        ? 'bg-green-100 text-green-800'
                        : taskData?.task_status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : taskData?.task_status === 'blocked'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {taskData?.task_status || 'Open'}
                    </span>
                    {taskData?.priority_level && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        taskData.priority_level === 'high' 
                          ? 'bg-red-100 text-red-800'
                          : taskData.priority_level === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {taskData.priority_level} priority
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Assignment
                    </h3>
                    <p className="text-sm text-gray-900">
                      {taskData?.assigned_to_employee_name || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Due Date
                    </h3>
                    <p className="text-sm text-gray-900">
                      {taskData?.planned_end_date 
                        ? new Date(taskData.planned_end_date).toLocaleDateString()
                        : 'Not set'
                      }
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Progress</h3>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${taskData?.completion_percentage || 0}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">
                        {taskData?.completion_percentage || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Task Description */}
            {taskData?.descr && (
              <div className="bg-white rounded-lg shadow mb-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Description</h3>
                </div>
                <div className="px-6 py-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{taskData.descr}</p>
                </div>
              </div>
            )}

            {/* Task Details */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Task Details</h3>
              </div>
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Task Number</dt>
                    <dd className="mt-1 text-sm text-gray-900">{taskData?.task_number || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Task Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{taskData?.task_type || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Category</dt>
                    <dd className="mt-1 text-sm text-gray-900">{taskData?.task_category || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Project</dt>
                    <dd className="mt-1 text-sm text-gray-900">{taskData?.project_name || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Estimated Hours</dt>
                    <dd className="mt-1 text-sm text-gray-900">{taskData?.estimated_hours || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Actual Hours</dt>
                    <dd className="mt-1 text-sm text-gray-900">{taskData?.actual_hours || 'N/A'}</dd>
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