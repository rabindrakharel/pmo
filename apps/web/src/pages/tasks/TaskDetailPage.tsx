import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Edit,
  Save,
  X,
  MessageSquare,
  Clock,
  User,
  Calendar,
  Tag,
  FileText,
  Activity,
  Plus,
  Send
} from 'lucide-react';
import { api, Task, Project } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

// Types for activity logs
type ActivityLogEntry = {
  id: string;
  type: 'comment' | 'status_change' | 'field_change' | 'worklog' | 'attachment';
  author: string;
  authorId: string;
  content: string;
  metadata?: {
    fieldName?: string;
    oldValue?: any;
    newValue?: any;
    timeSpent?: number;
    timeRemaining?: number;
    fileName?: string;
    fileSize?: number;
  };
  timestamp: string;
};

// Mock activity data - would come from API in real implementation
const mockActivities: ActivityLogEntry[] = [
  {
    id: '1',
    type: 'comment',
    author: 'John Doe',
    authorId: 'user-1',
    content: 'Starting work on this task. Will focus on the core functionality first.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'status_change',
    author: 'System',
    authorId: 'system',
    content: 'Status changed',
    metadata: {
      fieldName: 'status',
      oldValue: 'To Do',
      newValue: 'In Progress',
    },
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'worklog',
    author: 'John Doe',
    authorId: 'user-1',
    content: 'Logged 2 hours of work',
    metadata: {
      timeSpent: 120,
      timeRemaining: 360,
    },
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

function ActivityIcon({ type }: { type: ActivityLogEntry['type'] }) {
  switch (type) {
    case 'comment':
      return <MessageSquare className="h-4 w-4 text-blue-600" />;
    case 'status_change':
    case 'field_change':
      return <Activity className="h-4 w-4 text-green-600" />;
    case 'worklog':
      return <Clock className="h-4 w-4 text-orange-600" />;
    case 'attachment':
      return <FileText className="h-4 w-4 text-purple-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
}

function ActivityLogItem({ entry }: { entry: ActivityLogEntry }) {
  const formatActivityContent = () => {
    switch (entry.type) {
      case 'comment':
        return entry.content;
      case 'status_change':
      case 'field_change':
        return `${entry.metadata?.fieldName} changed from "${entry.metadata?.oldValue}" to "${entry.metadata?.newValue}"`;
      case 'worklog':
        const hours = Math.floor((entry.metadata?.timeSpent || 0) / 60);
        const minutes = (entry.metadata?.timeSpent || 0) % 60;
        return `${hours}h ${minutes}m logged${entry.metadata?.timeRemaining ? `. ${Math.floor(entry.metadata.timeRemaining / 60)}h remaining.` : ''}`;
      case 'attachment':
        return `Added attachment: ${entry.metadata?.fileName}`;
      default:
        return entry.content;
    }
  };

  return (
    <div className="flex gap-3 p-3 hover:bg-accent/50 rounded-lg">
      <div className="flex-shrink-0 mt-1">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border">
          <ActivityIcon type={entry.type} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{entry.author}</span>
          <Badge variant="secondary" className="text-xs">
            {entry.type.replace('_', ' ')}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatActivityContent()}
        </div>
      </div>
    </div>
  );
}

function CommentForm({ onSubmit }: { onSubmit: (comment: string) => void }) {
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim()) {
      onSubmit(comment.trim());
      setComment('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="Add a comment..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="min-h-[80px]"
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setComment('')}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!comment.trim()}>
          <Send className="mr-2 h-4 w-4" />
          Comment
        </Button>
      </div>
    </form>
  );
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});

  // Fetch task details
  const { data: taskData, isLoading: taskLoading, error: taskError } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.getTask(id!),
    enabled: !!id,
  });

  // Fetch project details for context
  const { data: projectData } = useQuery({
    queryKey: ['project', taskData?.data?.projHeadId || taskData?.projHeadId],
    queryFn: () => api.getProject(taskData?.data?.projHeadId || taskData?.projHeadId),
    enabled: !!(taskData?.data?.projHeadId || taskData?.projHeadId),
  });

  // Fetch task statuses and stages for dropdowns
  const { data: statusesData } = useQuery({
    queryKey: ['meta', 'task-statuses'],
    queryFn: () => api.getTaskStatuses(),
  });

  const { data: stagesData } = useQuery({
    queryKey: ['meta', 'task-stages'],
    queryFn: () => api.getTaskStages(),
  });

  const task = (taskData as any)?.taskHead || taskData?.data || taskData;
  const currentRecord = (taskData as any)?.currentRecord;
  const project = projectData?.data || projectData as Project;
  const statuses = statusesData?.data || [];
  const stages = stagesData?.data || [];

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: (updates: Partial<Task>) => {
      // This would create a new task record
      return fetch(`/api/v1/task/${id}/record`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to update task');
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditing(false);
      setEditedTask({});
    },
  });

  const handleSave = () => {
    if (Object.keys(editedTask).length > 0) {
      updateTaskMutation.mutate(editedTask);
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedTask({});
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedTask(prev => ({ ...prev, [field]: value }));
  };

  const handleAddComment = (comment: string) => {
    // TODO: Implement comment API call
    console.log('Adding comment:', comment);
    // For now, we'll just log it
  };

  const handleLogWork = () => {
    // TODO: Open work log modal
    console.log('Log work');
  };

  if (taskLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-muted rounded"></div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Task Not Found</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">
              {taskError ? 'Failed to load task details.' : 'Task not found.'}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const taskTitle = currentRecord?.title || task.title || 'Untitled Task';
  const taskStatus = statuses.find((s: any) => s.id === currentRecord?.statusId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              {isEditing ? (
                <Input
                  value={editedTask.title ?? taskTitle}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="text-2xl font-bold h-auto p-0 border-0 focus-visible:ring-0"
                  style={{ fontSize: '1.875rem', lineHeight: '2.25rem' }}
                />
              ) : (
                <h1 className="text-3xl font-bold">{taskTitle}</h1>
              )}
              {taskStatus && (
                <Badge variant={currentRecord?.active ? 'default' : 'secondary'}>
                  {taskStatus.name || taskStatus.code}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Task ID: {task.id.slice(0, 8)}...</span>
              {project && (
                <>
                  <span>•</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(`/projects/${project.id}/board`)}
                  >
                    {project.name}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={updateTaskMutation.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Add task description..."
                      value={editedTask.description || ''}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground">
                    {currentRecord?.description || task.description || 'No description provided.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity & Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="activity">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="activity">All Activity</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                </TabsList>
                
                <TabsContent value="activity" className="space-y-4 mt-4">
                  <div className="space-y-1">
                    {mockActivities.map((entry) => (
                      <ActivityLogItem key={entry.id} entry={entry} />
                    ))}
                  </div>
                  
                  <Separator />
                  
                  <CommentForm onSubmit={handleAddComment} />
                </TabsContent>
                
                <TabsContent value="comments" className="space-y-4 mt-4">
                  <div className="space-y-1">
                    {mockActivities
                      .filter(entry => entry.type === 'comment')
                      .map((entry) => (
                        <ActivityLogItem key={entry.id} entry={entry} />
                      ))}
                  </div>
                  
                  <Separator />
                  
                  <CommentForm onSubmit={handleAddComment} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Properties */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Status</Label>
                {isEditing ? (
                  <select
                    value={editedTask.statusId ?? currentRecord?.statusId ?? ''}
                    onChange={(e) => handleFieldChange('statusId', e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Select status...</option>
                    {statuses.map((status: any) => (
                      <option key={status.id} value={status.id}>
                        {status.name || status.code}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1">
                    {taskStatus ? (
                      <Badge variant="outline">{taskStatus.name || taskStatus.code}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">Assignee</Label>
                <div className="mt-1">
                  {task.assigneeId ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{task.assigneeId.slice(0, 8)}...</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Due Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editedTask.dueDate ?? currentRecord?.dueDate?.split('T')[0] ?? ''}
                    onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <div className="mt-1">
                    {currentRecord?.dueDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(currentRecord.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">Tags</Label>
                <div className="mt-1">
                  {currentRecord?.tags && currentRecord.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {currentRecord.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          <Tag className="mr-1 h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Tracking */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Tracking
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleLogWork}>
                  <Plus className="mr-2 h-4 w-4" />
                  Log Work
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Time Spent</Label>
                <p className="text-2xl font-bold mt-1">2h 30m</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Remaining</Label>
                <p className="text-lg font-semibold mt-1 text-muted-foreground">6h</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Original Estimate</Label>
                <p className="text-sm mt-1 text-muted-foreground">8h 30m</p>
              </div>
            </CardContent>
          </Card>

          {/* Task History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Created</span>
                    <span>{formatRelativeTime(task.created)}</span>
                  </div>
                </div>
                <div className="text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>Updated</span>
                    <span>{formatRelativeTime(currentRecord?.updated || task.updated)}</span>
                  </div>
                </div>
                {currentRecord && (
                  <div className="text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Current version</span>
                      <span>{formatRelativeTime(currentRecord.fromTs)}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}