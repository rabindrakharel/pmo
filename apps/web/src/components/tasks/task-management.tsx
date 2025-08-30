/**
 * Task Management Component
 * 
 * Comprehensive task management interface with JIRA-like functionality
 * but modern UX like Notion/Asana. Features include:
 * - Task board with status/stage columns
 * - Case notes and activity logging
 * - Form submission for task data
 * - Rich text editing for descriptions
 * - File attachments and media support
 * - Time tracking and progress updates
 * - Comments and collaboration
 */

'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Separator,
  Label,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui';
import {
  Calendar,
  Clock,
  User,
  Users,
  MessageSquare,
  Paperclip,
  Plus,
  Edit,
  Trash2,
  Send,
  Save,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  StopCircle,
  FileText,
  Image,
  Video,
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Circle,
  ArrowRight,
  Timer,
  Target,
  Flag,
} from 'lucide-react';
import { UniversalPermissions } from '@/lib/universal-schema-components';

// Task data structures based on ops_task_head and ops_task_records
interface TaskHead {
  id: string;
  proj_head_id: string;
  parent_head_id?: string;
  assignee_id?: string;
  reporter_id?: string;
  reviewers: string[];
  approvers: string[];
  collaborators: string[];
  watchers: string[];
  client_group_id?: string;
  clients: string[];
  worksite_id?: string;
  location_context?: string;
  estimated_hours?: number;
  story_points?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  depends_on_tasks: string[];
  blocks_tasks: string[];
  related_tasks: string[];
  name: string;
  descr?: string;
  tags: string[];
  attr: any;
  created: string;
  updated: string;
}

interface TaskRecord {
  id: string;
  head_id: string;
  name: string;
  descr?: string;
  status_name?: string;
  stage_name?: string;
  completion_percentage: number;
  actual_start_date?: string;
  actual_end_date?: string;
  actual_hours?: number;
  work_log: any[];
  time_spent: number;
  start_ts?: string;
  end_ts?: string;
  log_owner_id?: string;
  log_type: string;
  log_content: any;
  attachments: any[];
  form_log_id?: string;
  acceptance_criteria: string[];
  acceptance_status: string;
  quality_gate_status: string;
  tags: string[];
  active: boolean;
  from_ts: string;
  to_ts?: string;
  created: string;
  updated: string;
}

interface Task {
  taskHead: TaskHead;
  currentRecord?: TaskRecord;
}

interface CaseNote {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  content: string;
  note_type: 'comment' | 'status_change' | 'assignment' | 'time_log' | 'attachment';
  metadata?: any;
  created: string;
  updated: string;
}

interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  description: string;
  billable: boolean;
  created: string;
}

// Status and stage configurations
const TASK_STATUSES = [
  { value: 'open', label: 'Open', color: 'bg-gray-100 text-gray-800', icon: Circle },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: Play },
  { value: 'review', label: 'Under Review', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  { value: 'done', label: 'Done', color: 'bg-green-100 text-green-800', icon: CheckCircle },
];

const TASK_STAGES = [
  { value: 'backlog', label: 'Backlog', order: 1 },
  { value: 'ready', label: 'Ready', order: 2 },
  { value: 'development', label: 'Development', order: 3 },
  { value: 'testing', label: 'Testing', order: 4 },
  { value: 'review', label: 'Review', order: 5 },
  { value: 'done', label: 'Done', order: 6 },
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

interface TaskManagementProps {
  // Current task data
  task?: Task;
  loading?: boolean;
  error?: string | null;
  
  // Related data
  caseNotes?: CaseNote[];
  timeEntries?: TimeEntry[];
  projectName?: string;
  
  // Permissions
  permissions?: UniversalPermissions;
  
  // Event handlers
  onTaskUpdate?: (taskId: string, updates: Partial<TaskRecord>) => void;
  onCaseNoteAdd?: (taskId: string, note: Omit<CaseNote, 'id' | 'created' | 'updated'>) => void;
  onTimeEntryAdd?: (taskId: string, entry: Omit<TimeEntry, 'id' | 'created'>) => void;
  onAttachmentUpload?: (taskId: string, files: FileList) => void;
  onFormSubmit?: (taskId: string, formData: any) => void;
  
  // UI configuration
  showTimeTracking?: boolean;
  showAttachments?: boolean;
  showCaseNotes?: boolean;
  enableRichText?: boolean;
  compactMode?: boolean;
}

export const TaskManagement: React.FC<TaskManagementProps> = ({
  task,
  loading = false,
  error = null,
  caseNotes = [],
  timeEntries = [],
  projectName,
  permissions,
  onTaskUpdate,
  onCaseNoteAdd,
  onTimeEntryAdd,
  onAttachmentUpload,
  onFormSubmit,
  showTimeTracking = true,
  showAttachments = true,
  showCaseNotes = true,
  enableRichText = true,
  compactMode = false,
}) => {
  // State management
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TaskRecord>>({});
  const [newNote, setNewNote] = useState('');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['details']));
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize edit form when task changes
  React.useEffect(() => {
    if (task?.currentRecord) {
      setEditForm({
        name: task.currentRecord.name,
        descr: task.currentRecord.descr,
        status_name: task.currentRecord.status_name,
        stage_name: task.currentRecord.stage_name,
        completion_percentage: task.currentRecord.completion_percentage,
        actual_start_date: task.currentRecord.actual_start_date,
        actual_end_date: task.currentRecord.actual_end_date,
        acceptance_criteria: task.currentRecord.acceptance_criteria,
      });
    }
  }, [task]);

  // Calculate time spent today
  const timeSpentToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return timeEntries
      .filter(entry => entry.start_time.startsWith(today))
      .reduce((total, entry) => total + (entry.duration || 0), 0);
  }, [timeEntries]);

  // Get current status info
  const currentStatus = useMemo(() => {
    return TASK_STATUSES.find(status => status.value === task?.currentRecord?.status_name) || TASK_STATUSES[0];
  }, [task?.currentRecord?.status_name]);

  // Handle task updates
  const handleTaskUpdate = useCallback(async (updates: Partial<TaskRecord>) => {
    if (!task) return;
    
    try {
      await onTaskUpdate?.(task.taskHead.id, updates);
      setIsEditing(false);
      
      // Add case note for significant changes
      if (updates.status_name || updates.stage_name) {
        await onCaseNoteAdd?.(task.taskHead.id, {
          task_id: task.taskHead.id,
          author_id: 'current-user', // This would come from auth context
          author_name: 'Current User',
          content: `Task ${updates.status_name ? 'status changed to ' + updates.status_name : 'stage updated'}`,
          note_type: 'status_change',
          metadata: updates,
        });
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }, [task, onTaskUpdate, onCaseNoteAdd]);

  // Handle case note submission
  const handleNoteSubmit = useCallback(async () => {
    if (!task || !newNote.trim()) return;
    
    try {
      await onCaseNoteAdd?.(task.taskHead.id, {
        task_id: task.taskHead.id,
        author_id: 'current-user',
        author_name: 'Current User',
        content: newNote,
        note_type: 'comment',
      });
      setNewNote('');
    } catch (error) {
      console.error('Failed to add case note:', error);
    }
  }, [task, newNote, onCaseNoteAdd]);

  // Handle timer controls
  const handleStartTimer = useCallback(() => {
    setIsTimerRunning(true);
    setTimerStart(new Date());
  }, []);

  const handleStopTimer = useCallback(async () => {
    if (!task || !timerStart) return;
    
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - timerStart.getTime()) / 1000 / 60); // minutes
    
    try {
      await onTimeEntryAdd?.(task.taskHead.id, {
        task_id: task.taskHead.id,
        user_id: 'current-user',
        user_name: 'Current User',
        start_time: timerStart.toISOString(),
        end_time: endTime.toISOString(),
        duration,
        description: `Work on ${task.currentRecord?.name || task.taskHead.name}`,
        billable: true,
      });
    } catch (error) {
      console.error('Failed to log time:', error);
    }
    
    setIsTimerRunning(false);
    setTimerStart(null);
  }, [task, timerStart, onTimeEntryAdd]);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !e.target.files) return;
    
    try {
      await onAttachmentUpload?.(task.taskHead.id, e.target.files);
      
      // Add case note for attachment
      await onCaseNoteAdd?.(task.taskHead.id, {
        task_id: task.taskHead.id,
        author_id: 'current-user',
        author_name: 'Current User',
        content: `Added ${e.target.files.length} attachment(s)`,
        note_type: 'attachment',
        metadata: { fileCount: e.target.files.length },
      });
    } catch (error) {
      console.error('Failed to upload attachments:', error);
    }
  }, [task, onAttachmentUpload, onCaseNoteAdd]);

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <Card className="h-96">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading task...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading task: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!task) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2" />
            <p>No task selected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Task Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <currentStatus.icon className={`h-5 w-5 ${
                    currentStatus.value === 'done' ? 'text-green-600' :
                    currentStatus.value === 'blocked' ? 'text-red-600' :
                    currentStatus.value === 'in_progress' ? 'text-blue-600' :
                    'text-gray-400'
                  }`} />
                  <Badge className={currentStatus.color}>
                    {currentStatus.label}
                  </Badge>
                  {task.currentRecord?.stage_name && (
                    <Badge variant="outline">
                      {TASK_STAGES.find(s => s.value === task.currentRecord?.stage_name)?.label || task.currentRecord.stage_name}
                    </Badge>
                  )}
                  {projectName && (
                    <Badge variant="secondary">
                      {projectName}
                    </Badge>
                  )}
                </div>
                
                <CardTitle className="text-xl mb-1">
                  {isEditing ? (
                    <Input
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="text-xl font-semibold"
                    />
                  ) : (
                    task.currentRecord?.name || task.taskHead.name
                  )}
                </CardTitle>
                
                {(task.currentRecord?.descr || task.taskHead.descr) && (
                  <p className="text-muted-foreground">
                    {isEditing ? (
                      <Textarea
                        value={editForm.descr || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, descr: e.target.value }))}
                        rows={2}
                      />
                    ) : (
                      task.currentRecord?.descr || task.taskHead.descr
                    )}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {showTimeTracking && (
                  <div className="flex items-center gap-2">
                    {isTimerRunning ? (
                      <Button variant="outline" size="sm" onClick={handleStopTimer}>
                        <StopCircle className="h-4 w-4 mr-2" />
                        Stop Timer
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={handleStartTimer}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Timer
                      </Button>
                    )}
                  </div>
                )}
                
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleTaskUpdate(editForm)}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {permissions?.canEdit && (
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(task.taskHead.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Task ID
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open in New Tab
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {permissions?.canDelete && (
                          <DropdownMenuItem 
                            onClick={() => setShowDeleteDialog(true)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Task
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            {showCaseNotes && (
              <TabsTrigger value="notes" className="relative">
                Case Notes
                {caseNotes.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                    {caseNotes.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {showTimeTracking && (
              <TabsTrigger value="time">
                Time Tracking
              </TabsTrigger>
            )}
            {showAttachments && (
              <TabsTrigger value="attachments">
                Attachments
              </TabsTrigger>
            )}
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Details */}
              <div className="lg:col-span-2 space-y-4">
                {/* Progress Section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Progress
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSection('progress')}
                      >
                        {expandedSections.has('progress') ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </Button>
                    </div>
                  </CardHeader>
                  {expandedSections.has('progress') && (
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Completion</span>
                          <span>{task.currentRecord?.completion_percentage || 0}%</span>
                        </div>
                        <Progress 
                          value={task.currentRecord?.completion_percentage || 0} 
                          className="h-2"
                        />
                      </div>
                      
                      {isEditing && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm">Completion Percentage</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={editForm.completion_percentage || 0}
                              onChange={(e) => setEditForm(prev => ({ 
                                ...prev, 
                                completion_percentage: Number(e.target.value) 
                              }))}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm">Status</Label>
                              <Select
                                value={editForm.status_name}
                                onValueChange={(value) => setEditForm(prev => ({ ...prev, status_name: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TASK_STATUSES.map(status => (
                                    <SelectItem key={status.value} value={status.value}>
                                      <div className="flex items-center gap-2">
                                        <status.icon className="h-4 w-4" />
                                        {status.label}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label className="text-sm">Stage</Label>
                              <Select
                                value={editForm.stage_name}
                                onValueChange={(value) => setEditForm(prev => ({ ...prev, stage_name: value }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TASK_STAGES.map(stage => (
                                    <SelectItem key={stage.value} value={stage.value}>
                                      {stage.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>

                {/* Acceptance Criteria */}
                {(task.currentRecord?.acceptance_criteria?.length > 0 || isEditing) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Acceptance Criteria
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSection('criteria')}
                        >
                          {expandedSections.has('criteria') ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />
                          }
                        </Button>
                      </div>
                    </CardHeader>
                    {expandedSections.has('criteria') && (
                      <CardContent className="space-y-3">
                        {isEditing ? (
                          <Textarea
                            placeholder="Enter acceptance criteria (one per line)"
                            value={editForm.acceptance_criteria?.join('\n') || ''}
                            onChange={(e) => setEditForm(prev => ({
                              ...prev,
                              acceptance_criteria: e.target.value.split('\n').filter(Boolean)
                            }))}
                            rows={4}
                          />
                        ) : (
                          <ul className="space-y-2">
                            {task.currentRecord?.acceptance_criteria?.map((criteria, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">{criteria}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        
                        {task.currentRecord?.acceptance_status && (
                          <div className="pt-2 border-t">
                            <Badge className={
                              task.currentRecord.acceptance_status === 'accepted' ? 'bg-green-100 text-green-800' :
                              task.currentRecord.acceptance_status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }>
                              {task.currentRecord.acceptance_status}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Key Information */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Task Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {task.taskHead.assignee_id && (
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Assignee</p>
                          <p className="text-sm">User {task.taskHead.assignee_id.slice(-4)}</p>
                        </div>
                      </div>
                    )}
                    
                    {task.taskHead.reporter_id && (
                      <div className="flex items-center gap-3">
                        <Flag className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Reporter</p>
                          <p className="text-sm">User {task.taskHead.reporter_id.slice(-4)}</p>
                        </div>
                      </div>
                    )}

                    {task.taskHead.planned_start_date && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Start Date</p>
                          <p className="text-sm">
                            {new Date(task.taskHead.planned_start_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.taskHead.planned_end_date && (
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Due Date</p>
                          <p className="text-sm">
                            {new Date(task.taskHead.planned_end_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {task.taskHead.estimated_hours && (
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Estimated</p>
                          <p className="text-sm">{task.taskHead.estimated_hours}h</p>
                        </div>
                      </div>
                    )}

                    {task.currentRecord?.actual_hours && (
                      <div className="flex items-center gap-3">
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Time Spent</p>
                          <p className="text-sm">{task.currentRecord.actual_hours}h</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Collaborators */}
                {(task.taskHead.collaborators.length > 0 || task.taskHead.reviewers.length > 0) && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Team</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {task.taskHead.reviewers.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Reviewers</p>
                          <div className="flex flex-wrap gap-2">
                            {task.taskHead.reviewers.map(reviewerId => (
                              <Badge key={reviewerId} variant="secondary" className="text-xs">
                                User {reviewerId.slice(-4)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {task.taskHead.collaborators.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Collaborators</p>
                          <div className="flex flex-wrap gap-2">
                            {task.taskHead.collaborators.map(collaboratorId => (
                              <Badge key={collaboratorId} variant="outline" className="text-xs">
                                User {collaboratorId.slice(-4)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Tags */}
                {task.taskHead.tags.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {task.taskHead.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Case Notes Tab */}
          {showCaseNotes && (
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Case Notes & Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add new note */}
                  <div className="space-y-3">
                    <Textarea
                      ref={noteInputRef}
                      placeholder="Add a case note or update..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          multiple
                          className="hidden"
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip className="h-4 w-4 mr-2" />
                          Attach
                        </Button>
                      </div>
                      <Button 
                        onClick={handleNoteSubmit}
                        disabled={!newNote.trim()}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Add Note
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Notes timeline */}
                  <ScrollArea className="h-96">
                    <div className="space-y-4">
                      {caseNotes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No case notes yet</p>
                        </div>
                      ) : (
                        caseNotes.map((note) => (
                          <div key={note.id} className="flex gap-3">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="text-xs">
                                {note.author_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{note.author_name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {note.note_type.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(note.created).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-sm bg-muted/50 rounded-lg p-3">
                                {note.content}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Time Tracking Tab */}
          {showTimeTracking && (
            <TabsContent value="time" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Time Entries
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64">
                        {timeEntries.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Timer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No time entries yet</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {timeEntries.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium">{entry.description}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(entry.start_time).toLocaleString()} - {' '}
                                    {entry.end_time && new Date(entry.end_time).toLocaleString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium">{entry.duration}m</p>
                                  {entry.billable && (
                                    <Badge variant="outline" className="text-xs">Billable</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  {/* Timer */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Time Tracker</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                      <div className="text-2xl font-mono">
                        {isTimerRunning && timerStart ? (
                          <span>{Math.floor((Date.now() - timerStart.getTime()) / 1000 / 60)}m</span>
                        ) : (
                          '00:00'
                        )}
                      </div>
                      
                      {isTimerRunning ? (
                        <Button onClick={handleStopTimer} variant="destructive" className="w-full">
                          <StopCircle className="h-4 w-4 mr-2" />
                          Stop Timer
                        </Button>
                      ) : (
                        <Button onClick={handleStartTimer} className="w-full">
                          <Play className="h-4 w-4 mr-2" />
                          Start Timer
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Time Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Time Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Today:</span>
                        <span className="text-sm font-medium">{timeSpentToday}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Total:</span>
                        <span className="text-sm font-medium">
                          {timeEntries.reduce((total, entry) => total + (entry.duration || 0), 0)}m
                        </span>
                      </div>
                      {task.taskHead.estimated_hours && (
                        <div className="flex justify-between">
                          <span className="text-sm">Estimated:</span>
                          <span className="text-sm font-medium">{task.taskHead.estimated_hours * 60}m</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          )}

          {/* Attachments Tab */}
          {showAttachments && (
            <TabsContent value="attachments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Attachments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Upload area */}
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      multiple
                      className="hidden"
                    />
                    <Paperclip className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag and drop files here, or click to browse
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose Files
                    </Button>
                  </div>

                  {/* Attachment list */}
                  {task.currentRecord?.attachments && task.currentRecord.attachments.length > 0 ? (
                    <div className="space-y-3">
                      {task.currentRecord.attachments.map((attachment: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              {attachment.type?.startsWith('image/') ? (
                                <Image className="h-4 w-4 text-blue-600" />
                              ) : attachment.type?.startsWith('video/') ? (
                                <Video className="h-4 w-4 text-blue-600" />
                              ) : (
                                <FileText className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{attachment.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {attachment.size && `${Math.round(attachment.size / 1024)}KB`}
                                {attachment.uploadedAt && ` • ${new Date(attachment.uploadedAt).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No attachments yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this task? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                Delete Task
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};

export default TaskManagement;