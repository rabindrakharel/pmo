import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { 
  FolderKanban, 
  CheckSquare, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  Users
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuthStore();

  // Fetch recent projects
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'recent'],
    queryFn: () => api.getProjects({ limit: 5 }),
  });

  // Fetch recent tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', 'recent'],
    queryFn: () => api.getTasks({ limit: 10 }),
  });

  const projects = projectsData?.data || [];
  const tasks = tasksData?.data || [];

  // Calculate stats - use simple structure from our API
  const myTasks = tasks.filter(task => task.assignee === user?.sub);
  const overdueTasks = tasks.filter(task => 
    task.dueDate && new Date(task.dueDate) < new Date()
  );
  const inProgressTasks = tasks.filter(task => 
    task.stageCode === 'in_progress'
  );

  const stats = [
    {
      name: 'Active Projects',
      value: projects.length,
      icon: FolderKanban,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      name: 'My Tasks',
      value: myTasks.length,
      icon: CheckSquare,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      name: 'Overdue',
      value: overdueTasks.length,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-100',
    },
    {
      name: 'In Progress',
      value: inProgressTasks.length,
      icon: TrendingUp,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
  ];

  if (projectsLoading || tasksLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="ml-4 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
                    <div className="h-6 bg-gray-200 rounded w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-muted-foreground">
          Here's what's happening with your projects and tasks today.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FolderKanban className="mr-2 h-5 w-5" />
              Recent Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-muted-foreground">No projects found</p>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{project.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {project.status} • {project.slug}
                      </p>
                    </div>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckSquare className="mr-2 h-5 w-5" />
              My Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-muted-foreground">No tasks found</p>
            ) : (
              <div className="space-y-4">
                {tasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{task.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {task.dueDate && (
                          <>Due {new Date(task.dueDate).toLocaleDateString()}</>
                        )}
                        {task.tags && task.tags.length > 0 && (
                          <span className="ml-2">• {task.tags.join(', ')}</span>
                        )}
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 stage-${task.stageCode}`}
                    >
                      {task.stageCode}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="p-4 text-left border border-border rounded-lg hover:bg-accent transition-colors">
              <div className="flex items-center mb-2">
                <FolderKanban className="mr-2 h-5 w-5 text-blue-600" />
                <span className="font-medium">New Project</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Create a new project and start organizing tasks
              </p>
            </button>
            
            <button className="p-4 text-left border border-border rounded-lg hover:bg-accent transition-colors">
              <div className="flex items-center mb-2">
                <CheckSquare className="mr-2 h-5 w-5 text-green-600" />
                <span className="font-medium">Add Task</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Quickly add a new task to an existing project
              </p>
            </button>
            
            <button className="p-4 text-left border border-border rounded-lg hover:bg-accent transition-colors">
              <div className="flex items-center mb-2">
                <Users className="mr-2 h-5 w-5 text-purple-600" />
                <span className="font-medium">Invite Team</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Add team members to your workspace
              </p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}