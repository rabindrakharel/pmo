import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { DynamicChildEntityTabs, useDynamicChildEntityTabs } from '../../components/common/DynamicChildEntityTabs';
import { ActionBar } from '../../components/common/Button';
import { FilterChips } from '../../components/common/ScopeFilters';
import { FilteredDataTable } from '../../components/FilteredDataTable';
import { LayoutGrid, List, Kanban } from 'lucide-react';
import { projectApi } from '../../lib/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Kanban Component
function KanbanBoard({ projectId }: { projectId: string }) {
  const [kanbanData, setKanbanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchKanbanData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/v1/project/${projectId}/tasks/kanban`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setKanbanData(data);
        }
      } catch (error) {
        console.error('Error fetching kanban data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchKanbanData();
  }, [projectId]);

  const handleTaskStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/v1/task/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_status: newStatus,
          moved_by: 'current_user', // Replace with actual user ID
        }),
      });

      if (response.ok) {
        // Refresh kanban data
        // For now, just log success
        console.log('Task status updated successfully');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!kanbanData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No tasks found for this project.</p>
      </div>
    );
  }

  const columns = [
    { id: 'backlog', title: 'Backlog', tasks: kanbanData.columns.backlog },
    { id: 'in_progress', title: 'In Progress', tasks: kanbanData.columns.in_progress },
    { id: 'blocked', title: 'Blocked', tasks: kanbanData.columns.blocked },
    { id: 'done', title: 'Done', tasks: kanbanData.columns.done },
  ];

  return (
    <div className="grid grid-cols-4 gap-6 h-full">
      {columns.map((column) => (
        <div key={column.id} className="flex flex-col">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg border-b">
            <h3 className="font-medium text-gray-900">{column.title}</h3>
            <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">
              {column.tasks?.length || 0}
            </span>
          </div>
          <div className="flex-1 p-3 bg-white border border-t-0 rounded-b-lg overflow-y-auto">
            <div className="space-y-3">
              {column.tasks?.map((task: any) => (
                <div
                  key={task.id}
                  className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  draggable
                  onDragEnd={(e) => {
                    // Handle drag end - update task status
                    // This would need proper drag and drop implementation
                  }}
                >
                  <h4 className="font-medium text-gray-900 text-sm mb-2">{task.name}</h4>
                  {task.assigned_to_employee_name && (
                    <p className="text-xs text-gray-500 mb-1">
                      Assigned: {task.assigned_to_employee_name}
                    </p>
                  )}
                  {task.priority_level && (
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      task.priority_level === 'high' 
                        ? 'bg-red-100 text-red-800'
                        : task.priority_level === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {task.priority_level}
                    </span>
                  )}
                </div>
              ))}
              {(!column.tasks || column.tasks.length === 0) && (
                <p className="text-gray-400 text-sm text-center py-8">No tasks</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectTaskPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { tabs, loading } = useDynamicChildEntityTabs('project', projectId!);
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
  const [filterState, setFilterState] = useState({
    all: true,
    mine: false,
    overdue: false,
    completed: false,
  });

  // Mock project data - replace with actual API call
  const [projectData, setProjectData] = React.useState<any>(null);

  React.useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await projectApi.get(projectId);
        if (response) {
          console.log('Project data received:', response);
          setProjectData(response);
        }
      } catch (error) {
        console.error('Error fetching project:', error);
      }
    };

    fetchProject();
  }, [projectId]);

  const filterChips = [
    {
      id: 'all',
      label: 'All',
      active: filterState.all,
      onClick: () => setFilterState({ ...filterState, all: !filterState.all }),
    },
    {
      id: 'mine',
      label: 'My Tasks',
      active: filterState.mine,
      onClick: () => setFilterState({ ...filterState, mine: !filterState.mine }),
    },
    {
      id: 'overdue',
      label: 'Overdue',
      count: 3,
      active: filterState.overdue,
      onClick: () => setFilterState({ ...filterState, overdue: !filterState.overdue }),
    },
    {
      id: 'completed',
      label: 'Completed',
      active: filterState.completed,
      onClick: () => setFilterState({ ...filterState, completed: !filterState.completed }),
    },
  ];

  if (loading) {
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
        <DynamicChildEntityTabs
          title={projectData?.name || 'Digital Transformation Initiative'}
          parentType="project"
          parentId={projectId!}
          parentName={projectData?.name}
          tabs={tabs}
          showBackButton={true}
          onBackClick={() => navigate('/project')}
        />

        {/* Action Bar */}
        <ActionBar
          createButton={{
            entityType: 'task',
            parentEntity: 'project',
            parentEntityId: projectId!,
            onCreateClick: () => console.log('Create task in project'),
          }}
          scopeFilters={
            <div className="flex items-center space-x-4">
              <FilterChips filters={filterChips} />
            </div>
          }
          additionalActions={
            <div className="flex items-center space-x-2">
              <div className="flex bg-white border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${
                    viewMode === 'grid'
                      ? 'bg-blue-50 text-blue-600 border-r border-gray-300'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="Grid View"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-2 ${
                    viewMode === 'kanban'
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="Kanban View"
                >
                  <Kanban className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        />

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-hidden">
          {viewMode === 'kanban' ? (
            <KanbanBoard projectId={projectId!} />
          ) : (
            <div className="bg-white rounded-lg shadow h-full flex flex-col">
              <FilteredDataTable
                entityType="task"
                parentEntity="project"
                parentEntityId={projectId!}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}