import React, { useState, useEffect } from 'react';
import { FolderOpen, Calendar, Users, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { DataTable, Column } from '../components/ui/DataTable';
import { StatsGrid } from '../components/common/StatsGrid';
import { projectApi, taskApi, metaApi } from '../lib/api';

// ViewMode type removed - only using table view now

interface Project {
  id: string;
  name: string;
  descr?: string;
  project_code?: string;
  project_type?: string;
  priority_level?: string;
  budget_allocated?: number;
  budget_currency?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  project_stage?: string;
  project_status?: string;
  business_id?: string;
  project_managers?: string[];
  created?: string;
  updated?: string;
}

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
}

export function ProjectPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadProjects();
  }, [pagination.current, pagination.pageSize]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await projectApi.list({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setProjects(response.data || []);
      setPagination(prev => ({ ...prev, total: response.total || 0 }));
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // loadTasks removed - no longer needed for table-only view

  const handlePaginationChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  const formatCurrency = (amount?: number, currency?: string) => {
    if (!amount) return '-';
    const formatted = new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency || 'CAD',
    }).format(amount);
    return formatted;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-CA');
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusColors: Record<string, string> = {
      'Active': 'bg-green-100 text-green-800',
      'Planning': 'bg-blue-100 text-blue-800',
      'On Hold': 'bg-yellow-100 text-yellow-800',
      'Completed': 'bg-purple-100 text-purple-800',
      'Cancelled': 'bg-red-100 text-red-800',
    };
    
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    
    const priorityColors: Record<string, string> = {
      'High': 'bg-red-100 text-red-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-green-100 text-green-800',
    };
    
    const colorClass = priorityColors[priority] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {priority}
      </span>
    );
  };

  const tableColumns: Column<Project>[] = [
    {
      key: 'name',
      title: 'Project Name',
      sortable: true,
      filterable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          {record.project_code && (
            <div className="text-sm text-gray-500">{record.project_code}</div>
          )}
        </div>
      ),
    },
    {
      key: 'project_status',
      title: 'Status',
      sortable: true,
      filterable: true,
      render: (value) => getStatusBadge(value),
    },
    {
      key: 'priority_level',
      title: 'Priority',
      sortable: true,
      filterable: true,
      render: (value) => getPriorityBadge(value),
    },
    {
      key: 'project_type',
      title: 'Type',
      sortable: true,
      filterable: true,
    },
    {
      key: 'budget_allocated',
      title: 'Budget',
      sortable: true,
      align: 'right',
      render: (value, record) => formatCurrency(value, record.budget_currency),
    },
    {
      key: 'planned_start_date',
      title: 'Start Date',
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: 'planned_end_date',
      title: 'End Date',
      sortable: true,
      render: (value) => formatDate(value),
    },
    {
      key: 'estimated_hours',
      title: 'Est. Hours',
      sortable: true,
      align: 'right',
      render: (value) => value ? `${value}h` : '-',
    },
    {
      key: 'actual_hours',
      title: 'Actual Hours',
      sortable: true,
      align: 'right',
      filterable: true,
      render: (value) => value ? `${value}h` : '-',
    },
    {
      key: 'project_stage',
      title: 'Stage',
      sortable: true,
      filterable: true,
      render: (value) => value ? (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
          {value}
        </span>
      ) : '-',
    },
    {
      key: 'business_id',
      title: 'Business Unit',
      sortable: true,
      filterable: true,
      render: (value) => value || '-',
    },
  ];

  // Tree and Grid view logic removed - only using table view now

  // Simplified to only render table view
  const renderContent = () => (
    <DataTable
      data={projects}
      columns={tableColumns}
      loading={loading}
      pagination={{
        ...pagination,
        onChange: handlePaginationChange,
      }}
      rowKey="id"
      onRowClick={(project) => console.log('Navigate to project:', project.id)}
      onView={(project) => console.log('View project:', project.id)}
      onEdit={(project) => console.log('Edit project:', project.id)}
      onShare={(project) => console.log('Share project:', project.id)}
      onDelete={(project) => console.log('Delete project:', project.id)}
    />
  );

  return (
    <Layout createButton={{ label: "Create Project", href: "/project/new" }}>
      <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <FolderOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Projects</h1>
            <p className="mt-1 text-gray-600">Manage and track all your projects and their progress</p>
          </div>
        </div>

        <StatsGrid 
          stats={[
            {
              value: projects.length,
              label: "Total Projects",
              color: "blue",
              icon: FolderOpen
            },
            {
              value: projects.filter(p => p.project_status === 'Active').length,
              label: "Active Projects",
              color: "green",
              icon: TrendingUp
            },
            {
              value: Math.round(
                (projects.filter(p => p.project_status === 'Completed').length / (projects.length || 1)) * 100
              ),
              label: "Completion Rate",
              color: "purple",
              icon: DollarSign,
              format: "percentage"
            }
          ]}
        />

        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}