import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Settings, 
  Share, 
  Edit,
  MoreHorizontal,
  Plus,
  Calendar,
  Users,
  Building,
  MapPin,
  Activity
} from 'lucide-react';
import { api, Project, Task } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { TaskBoard } from '@/components/tasks/TaskBoard';

// Temporary type definitions
type TaskCard = {
  id: string;
  title: string;
  statusId: string;
  stageId?: string;
  assigneeId?: string;
  dueDate?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimatedHours?: number;
  actualHours?: number;
};

type BoardColumn = {
  id: string;
  name: string;
  wipLimit?: number;
  order: number;
  tasks: TaskCard[];
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('board');

  // Fetch project details
  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  // Fetch project status
  const { data: projectStatus } = useQuery({
    queryKey: ['project', id, 'status'], 
    queryFn: async () => {
      try {
        const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';
        const response = await fetch(`${API_BASE_URL}/v1/project/${id}/status`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) throw new Error('Failed to fetch project status');
        return response.json();
      } catch (error) {
        console.warn('Project status endpoint not available:', error);
        return null;
      }
    },
    enabled: !!id,
  });

  // Fetch tasks for this project using new project-task endpoint
  const { data: tasksData, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ['project', id, 'tasks'],
    queryFn: async () => {
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';
      const response = await fetch(`${API_BASE_URL}/v1/project/${id}/tasks?limit=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch project tasks');
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch task stages/statuses for board
  const { data: stagesData } = useQuery({
    queryKey: ['meta', 'task-stages'],
    queryFn: () => api.getTaskStages(),
  });

  const { data: statusesData } = useQuery({
    queryKey: ['meta', 'task-statuses'], 
    queryFn: () => api.getTaskStatuses(),
  });

  const projectData = project?.data || project as Project;
  const tasks = tasksData?.data || [];
  const stages = stagesData?.data || [];
  const statuses = statusesData?.data || [];

  // Transform tasks for board view
  const boardData = useMemo(() => {
    if (!tasks.length || !statuses.length) return [];
    
    // Create columns based on task statuses
    const columns: BoardColumn[] = statuses.map((status: any, index: number) => ({
      id: status.id,
      name: status.name || status.code,
      wipLimit: status.wipLimit,
      order: index,
      tasks: [],
    }));

    // Add tasks to appropriate columns
    tasks.forEach((taskWrapper: any) => {
      const taskHead = taskWrapper.taskHead || taskWrapper;
      const currentRecord = taskWrapper.currentRecord;
      
      if (currentRecord?.statusId) {
        const column = columns.find(col => col.id === currentRecord.statusId);
        if (column) {
          column.tasks.push({
            id: taskHead.id,
            title: currentRecord.title || 'Untitled Task',
            statusId: currentRecord.statusId,
            stageId: currentRecord.stageId,
            assigneeId: taskHead.assigneeId,
            dueDate: currentRecord.dueDate,
            tags: currentRecord.tags || taskHead.tags,
            priority: 'medium', // Default priority
          });
        }
      }
    });

    return columns;
  }, [tasks, statuses]);

  // Mutation for updating project
  const updateProjectMutation = useMutation({
    mutationFn: (data: Partial<Project>) => api.updateProject(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const handleTaskClick = (task: TaskCard) => {
    navigate(`/tasks/${task.id}`);
  };

  const handleTaskMove = async (taskId: string, newStatusId: string) => {
    try {
      // Update task status - this would need to create a new task record
      const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api';
      await fetch(`${API_BASE_URL}/v1/task/${taskId}/record`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ statusId: newStatusId }),
      });
      
      // Refetch tasks to update the board
      queryClient.invalidateQueries({ queryKey: ['tasks', { projHeadId: id }] });
    } catch (error) {
      console.error('Failed to move task:', error);
      // TODO: Show error toast
    }
  };

  const handleEdit = () => {
    // TODO: Open edit project modal
    console.log('Edit project:', projectData);
  };

  const handleShare = () => {
    // TODO: Open share modal
    console.log('Share project:', projectData);
  };

  const handleSettings = () => {
    // TODO: Navigate to project settings
    console.log('Project settings:', projectData);
  };

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                <div className="h-6 bg-muted rounded w-20"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (projectError || !projectData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Project Not Found</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">
              {projectError ? 'Failed to load project details.' : 'Project not found.'}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/projects')}>
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{projectData.name}</h1>
              <Badge 
                variant={projectData.active ? 'default' : 'secondary'}
              >
                {projectStatus?.currentStatus?.statusName || (projectData.active ? 'Active' : 'Inactive')}
              </Badge>
            </div>
            {projectData.slug && (
              <p className="text-muted-foreground">{projectData.slug}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share className="mr-2 h-4 w-4" />
            Share
          </Button>

          <Button variant="outline" size="sm" onClick={handleSettings}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Project Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Timeline</p>
                <p className="text-sm">
                  {projectData.planned_start_date ? 
                    `${new Date(projectData.planned_start_date).toLocaleDateString()} - ${new Date(projectData.planned_end_date).toLocaleDateString()}` :
                    'Not scheduled'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Tasks</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Building className="h-8 w-8 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Budget</p>
                <p className="text-sm">
                  {projectData.budget_allocated ? 
                    `$${projectData.budget_allocated.toLocaleString()} ${projectData.budget_currency}` :
                    'Not set'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-muted-foreground" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Progress</p>
                <p className="text-sm">
                  {projectData.estimated_hours ? 
                    `${projectData.actual_hours || 0}h / ${projectData.estimated_hours}h` :
                    `Stage: ${projectData.project_stage}`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-6">
          {tasksLoading ? (
            <div className="flex gap-6 overflow-x-auto">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="min-w-[320px] animate-pulse">
                  <div className="h-8 bg-muted rounded mb-4"></div>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-24 bg-muted rounded"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TaskBoard 
              tasks={tasks} 
              stages={stages}
              columns={boardData}
              projectId={id}
              onTaskClick={handleTaskClick}
              onTaskMove={handleTaskMove}
            />
          )}
        </TabsContent>

        <TabsContent value="list" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Task List</CardTitle>
                <Button size="sm" onClick={() => console.log('Create task')}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No tasks in this project yet</p>
                  <Button onClick={() => console.log('Create first task')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Task
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((taskWrapper: any) => {
                    const taskHead = taskWrapper.taskHead || taskWrapper;
                    const currentRecord = taskWrapper.currentRecord;
                    
                    return (
                      <div 
                        key={taskHead.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 cursor-pointer"
                        onClick={() => handleTaskClick({ id: taskHead.id } as TaskCard)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {currentRecord?.title || 'Untitled Task'}
                            </span>
                            {currentRecord?.statusId && (
                              <Badge variant="outline" className="text-xs">
                                {statuses.find((s: any) => s.id === currentRecord.statusId)?.name || 'Unknown'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {taskHead.assigneeId && (
                              <span>Assigned to: {taskHead.assigneeId.slice(0, 8)}...</span>
                            )}
                            {currentRecord?.dueDate && (
                              <span>Due: {new Date(currentRecord.dueDate).toLocaleDateString()}</span>
                            )}
                            <span>ID: {taskHead.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Timeline view coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Activity feed coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}