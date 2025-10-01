import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Plus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FilteredDataTable } from '../components/FilteredDataTable';
import { KanbanBoard, KanbanColumn } from '../components/ui/KanbanBoard';
import { GridView } from '../components/ui/GridView';
import { ViewSwitcher } from '../components/common/ViewSwitcher';
import { useViewMode } from '../lib/hooks/useViewMode';
import { getEntityConfig } from '../lib/entityConfig';
import { taskApi } from '../lib/api';

export function TaskPage() {
  const navigate = useNavigate();
  const config = getEntityConfig('task');
  const [view, setView] = useViewMode('task');
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch tasks for Kanban and Grid views
  useEffect(() => {
    if (view !== 'table') {
      loadTasks();
    }
  }, [view]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await taskApi.list({ page: 1, pageSize: 100 });
      setTasks(response.data || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (task: any) => {
    navigate(`/task/${task.id}`);
  };

  const handleCreateClick = () => {
    navigate('/task/new');
  };

  const handleBulkShare = (selectedTasks: any[]) => {
    console.log('Bulk share tasks:', selectedTasks.map(t => t.id));
    alert(`Sharing ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}`);
  };

  const handleBulkDelete = async (selectedTasks: any[]) => {
    if (window.confirm(`Are you sure you want to delete ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}?`)) {
      console.log('Bulk delete tasks:', selectedTasks.map(t => t.id));
      alert(`Deleted ${selectedTasks.length} task${selectedTasks.length !== 1 ? 's' : ''}`);
      // Reload after delete
      if (view !== 'table') {
        loadTasks();
      }
    }
  };

  const handleCardMove = async (itemId: string, fromColumn: string, toColumn: string) => {
    console.log(`Moving task ${itemId} from ${fromColumn} to ${toColumn}`);
    // Optimistic update
    setTasks(prev => prev.map(task =>
      task.id === itemId ? { ...task, stage: toColumn } : task
    ));

    // TODO: Call API to update task stage
    // await taskApi.update(itemId, { stage: toColumn });
  };

  // Prepare Kanban columns
  const kanbanColumns: KanbanColumn[] = [
    {
      id: 'Backlog',
      title: 'Backlog',
      color: '#6B7280',
      items: tasks.filter(t => t.stage === 'Backlog')
    },
    {
      id: 'To Do',
      title: 'To Do',
      color: '#3B82F6',
      items: tasks.filter(t => t.stage === 'To Do')
    },
    {
      id: 'In Progress',
      title: 'In Progress',
      color: '#F59E0B',
      items: tasks.filter(t => t.stage === 'In Progress')
    },
    {
      id: 'In Review',
      title: 'In Review',
      color: '#8B5CF6',
      items: tasks.filter(t => t.stage === 'In Review')
    },
    {
      id: 'Done',
      title: 'Done',
      color: '#10B981',
      items: tasks.filter(t => t.stage === 'Done')
    },
    {
      id: 'Blocked',
      title: 'Blocked',
      color: '#EF4444',
      items: tasks.filter(t => t.stage === 'Blocked')
    }
  ];

  const renderContent = () => {
    if (view === 'table') {
      return (
        <FilteredDataTable
          entityType="task"
          showActionButtons={true}
          createLabel="Create Task"
          onCreateClick={handleCreateClick}
          onBulkShare={handleBulkShare}
          onBulkDelete={handleBulkDelete}
          onRowClick={handleRowClick}
        />
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    if (view === 'kanban') {
      return (
        <div className="bg-white rounded-lg shadow p-6 h-full overflow-x-auto">
          <KanbanBoard
            columns={kanbanColumns}
            onCardClick={handleRowClick}
            onCardMove={handleCardMove}
          />
        </div>
      );
    }

    if (view === 'grid') {
      return (
        <div className="bg-white rounded-lg shadow p-6">
          <GridView
            items={tasks}
            onItemClick={handleRowClick}
            columns={3}
            emptyMessage="No tasks found"
            titleField="name"
            descriptionField="descr"
            badgeFields={['stage', 'priority_level']}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <Layout>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
              <p className="mt-1 text-gray-600">Manage and track project tasks and deliverables</p>
            </div>
          </div>

          {/* View Switcher and Create Button */}
          <div className="flex items-center space-x-3">
            {config && (
              <ViewSwitcher
                currentView={view}
                supportedViews={config.supportedViews}
                onChange={setView}
              />
            )}
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}