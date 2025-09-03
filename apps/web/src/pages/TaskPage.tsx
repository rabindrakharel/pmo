import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, TrendingUp } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatsGrid } from '../components/common/StatsGrid';
import { taskApi, projectApi } from '../lib/api';

interface Task {
  id: string;
  title: string;
  name: string;
  descr?: string;
  proj_head_id?: string;
  parent_task_id?: string;
  assignee_id?: string;
  estimated_hours?: number;
  story_points?: number;
  status_name?: string;
  stage_name?: string;
  completion_percentage?: number;
  project_name?: string;
  assignee_name?: string;
  created?: string;
  updated?: string;
}

export function TaskPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadTasks();
  }, [pagination.current, pagination.pageSize]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await taskApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setTasks(response.data || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusColors: Record<string, string> = {
      'To Do': 'bg-gray-100 text-gray-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'In Review': 'bg-yellow-100 text-yellow-800',
      'Done': 'bg-green-100 text-green-800',
      'Blocked': 'bg-red-100 text-red-800',
    };
    
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {status}
      </span>
    );
  };

  const getStageBadge = (stage?: string) => {
    if (!stage) return null;
    
    const stageColors: Record<string, string> = {
      'Planning': 'bg-purple-100 text-purple-800',
      'Development': 'bg-blue-100 text-blue-800',
      'Testing': 'bg-orange-100 text-orange-800',
      'Deployment': 'bg-green-100 text-green-800',
    };
    
    const colorClass = stageColors[stage] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {stage}
      </span>
    );
  };

  const getProgressBar = (percentage?: number) => {
    const progress = percentage || 0;
    return (
      <div className="flex items-center space-x-2">
        <div className="w-16 bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full" 
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
        <span className="text-xs text-gray-600">{progress}%</span>
      </div>
    );
  };

  const tableColumns: Column<Task>[] = [
    {
      key: 'name',
      title: 'Task Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value || record.title}</div>
          {record.project_name && (
            <div className="text-sm text-gray-500">{record.project_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status_name',
      title: 'Status',
      sortable: true,
      filterable: true,
      render: (value) => getStatusBadge(value),
    },
    {
      key: 'stage_name',
      title: 'Stage',
      sortable: true,
      filterable: true,
      render: (value) => getStageBadge(value),
    },
    {
      key: 'assignee_name',
      title: 'Assignee',
      sortable: true,
      filterable: true,
      render: (value) => value || 'Unassigned',
    },
    {
      key: 'completion_percentage',
      title: 'Progress',
      sortable: true,
      render: (value) => getProgressBar(value),
    },
    {
      key: 'estimated_hours',
      title: 'Est. Hours',
      sortable: true,
      align: 'right',
      render: (value) => value ? `${value}h` : '-',
    },
    {
      key: 'story_points',
      title: 'Story Points',
      sortable: true,
      align: 'right',
      render: (value) => value ? value.toString() : '-',
    },
    {
      key: 'created',
      title: 'Created',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString('en-CA') : '-',
    },
  ];

  return (
    <Layout createButton={{ label: "Create Task", href: "/task/new" }}>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <CheckSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
            <p className="mt-1 text-gray-600">Manage and track project tasks and deliverables</p>
          </div>
        </div>

        <StatsGrid 
          stats={[
            {
              value: tasks.length,
              label: "Total Tasks",
              color: "blue",
              icon: CheckSquare
            },
            {
              value: tasks.filter(t => t.status_name === 'In Progress').length,
              label: "In Progress",
              color: "yellow",
              icon: Clock
            },
            {
              value: tasks.filter(t => t.status_name === 'Done').length,
              label: "Completed",
              color: "green",
              icon: TrendingUp
            }
          ]}
        />

        <div className="flex-1 min-h-0">
          <DataTable
            data={tasks}
            columns={tableColumns}
            loading={loading}
            pagination={{
              ...pagination,
              onChange: handlePaginationChange,
            }}
            rowKey="id"
            filterable={true}
            columnSelection={true}
            onRowClick={(task) => console.log('Navigate to task:', task.id)}
            onView={(task) => console.log('View task:', task.id)}
            onEdit={(task) => console.log('Edit task:', task.id)}
            onShare={(task) => console.log('Share task:', task.id)}
            onDelete={(task) => console.log('Delete task:', task.id)}
          />
        </div>
      </div>
    </Layout>
  );
}