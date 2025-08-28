import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { 
  Plus, 
  Filter, 
  Search, 
  LayoutGrid, 
  List, 
  Calendar,
  Map
} from 'lucide-react';

type ViewMode = 'board' | 'list' | 'calendar' | 'map';

export function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [selectedProject, setSelectedProject] = useState<string>('');

  // Fetch task stages (meta data)
  const { data: stagesData } = useQuery({
    queryKey: ['meta', 'task-stages'],
    queryFn: () => api.getTaskStages(),
    retry: false, // Don't retry if this endpoint doesn't exist yet
  });

  // Fetch projects for filter
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.getProjects({ limit: 100 }),
  });

  // Fetch tasks
  const { data: tasksData, isLoading: tasksLoading, error } = useQuery({
    queryKey: ['tasks', { proj_head_id: selectedProject || undefined }],
    queryFn: () => api.getTasks({ 
      proj_head_id: selectedProject || undefined,
      limit: 100 
    }),
  });

  const stages = stagesData?.data || [];
  const projects = projectsData?.data || [];
  const tasks = tasksData?.data || [];

  if (tasksLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Tasks</h1>
          <div className="flex gap-2">
            <Button variant="outline" disabled>
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>
        <div className="flex gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="min-w-[320px] animate-pulse">
              <div className="h-8 bg-muted rounded mb-2"></div>
              <div className="space-y-2">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-24 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Failed to load tasks. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderViewControls = () => (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
      {[
        { mode: 'board' as ViewMode, icon: LayoutGrid, label: 'Board' },
        { mode: 'list' as ViewMode, icon: List, label: 'List' },
        { mode: 'calendar' as ViewMode, icon: Calendar, label: 'Calendar' },
        { mode: 'map' as ViewMode, icon: Map, label: 'Map' },
      ].map(({ mode, icon: Icon, label }) => (
        <Button
          key={mode}
          variant={viewMode === mode ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode(mode)}
          className="flex items-center gap-1"
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            <p className="text-muted-foreground">
              Manage and track task progress across projects
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {renderViewControls()}
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Project Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Project:</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-3 py-1 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Task Count */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {tasks.length} tasks
          </Badge>
          {selectedProject && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedProject('')}
              className="h-auto p-1"
            >
              Clear filter
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'board' && (
        <TaskBoard 
          tasks={tasks} 
          stages={stages} 
          projectId={selectedProject || undefined}
          onTaskClick={(task) => {
            // Navigate to task detail or show modal
            console.log('Task clicked:', task);
          }}
        />
      )}

      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No tasks found</p>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.title}</span>
                        {task.stageCode && (
                          <Badge variant="outline" className="text-xs">
                            {task.stageCode}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        {task.assignee && (
                          <span>Assigned to: {task.assignee}</span>
                        )}
                        {task.dueDate && (
                          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        )}
                        <span>ID: {task.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => console.log('Edit task:', task)}
                    >
                      View
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'calendar' && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Calendar view coming soon...</p>
          </CardContent>
        </Card>
      )}

      {viewMode === 'map' && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Map view coming soon...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}