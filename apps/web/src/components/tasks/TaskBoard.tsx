import React from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Task } from '@/lib/api';
import { 
  Plus, 
  Calendar, 
  User,
  AlertCircle,
  GripVertical,
} from 'lucide-react';

// Type definitions for enhanced board
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

interface TaskBoardProps {
  tasks: Task[];
  stages?: any[];
  columns?: BoardColumn[];
  projectId?: string;
  onTaskClick?: (task: TaskCard | Task) => void;
  onTaskMove?: (taskId: string, newStatusId: string) => void;
}

// Simple stages based on what the API might return
const DEFAULT_STAGES = [
  { id: 'todo', name: 'To Do' },
  { id: 'in_progress', name: 'In Progress' },
  { id: 'review', name: 'Review' },
  { id: 'done', name: 'Done' },
];

function TaskCardComponent({ 
  task, 
  onClick, 
  isDragging = false,
  onDragStart, 
  onDragEnd 
}: { 
  task: TaskCard | Task; 
  onClick?: () => void;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  const assignee = 'assignee' in task ? task.assignee : task.assigneeId;

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-blue-500';
      case 'low': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 relative ${
        getPriorityColor('priority' in task ? task.priority : 'medium')
      } ${isDragging ? 'opacity-50 rotate-2 scale-105' : ''}`}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {task.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Due date */}
          {task.dueDate && (
            <div className={`flex items-center text-xs ${
              isOverdue ? 'text-red-600' : 'text-muted-foreground'
            }`}>
              {isOverdue && <AlertCircle className="h-3 w-3 mr-1" />}
              <Calendar className="h-3 w-3 mr-1" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}

          {/* Assignee */}
          {assignee && (
            <div className="flex items-center text-xs text-muted-foreground">
              <User className="h-3 w-3 mr-1" />
              <span className="truncate">
                {typeof assignee === 'string' && assignee.includes('-') 
                  ? `${assignee.slice(0, 8)}...` 
                  : assignee
                }
              </span>
            </div>
          )}

          {/* Priority indicator */}
          {'priority' in task && task.priority && task.priority !== 'medium' && (
            <Badge 
              variant={task.priority === 'urgent' || task.priority === 'high' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {task.priority}
            </Badge>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.slice(0, 2).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{task.tags.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Task ID for reference */}
          <div className="text-xs text-muted-foreground">
            ID: {task.id.slice(0, 8)}...
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskColumnComponent({ 
  column, 
  onTaskClick, 
  onTaskMove, 
  onAddTask 
}: { 
  column: BoardColumn; 
  onTaskClick?: (task: TaskCard) => void;
  onTaskMove?: (taskId: string, newStatusId: string) => void;
  onAddTask?: (columnId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [draggingTask, setDraggingTask] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && taskId !== draggingTask && onTaskMove) {
      onTaskMove(taskId, column.id);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const isWipLimitExceeded = column.wipLimit && column.tasks.length >= column.wipLimit;

  return (
    <Card 
      className={`flex flex-col h-full transition-colors ${
        dragOver ? 'bg-blue-50 border-blue-300' : ''
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {column.name}
            {column.wipLimit && (
              <span className="text-sm font-normal text-muted-foreground">
                ({column.tasks.length}/{column.wipLimit})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isWipLimitExceeded ? 'destructive' : 'secondary'} 
              className="text-xs"
            >
              {column.tasks.length}
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => onAddTask?.(column.id)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 min-h-[200px]">
        {column.tasks.map((task) => (
          <TaskCardComponent
            key={task.id}
            task={task}
            onClick={() => onTaskClick?.(task)}
            isDragging={draggingTask === task.id}
            onDragStart={() => {
              setDraggingTask(task.id);
              // Need to access the event from the global context
              const currentEvent = window.event as DragEvent;
              if (currentEvent?.dataTransfer) {
                currentEvent.dataTransfer.setData('text/plain', task.id);
              }
            }}
            onDragEnd={() => setDraggingTask(null)}
          />
        ))}
        
        {column.tasks.length === 0 && !dragOver && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm">No tasks in {column.name.toLowerCase()}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2" 
              onClick={() => onAddTask?.(column.id)}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add task
            </Button>
          </div>
        )}
        
        {dragOver && (
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center text-blue-600">
            Drop task here
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TaskBoard({ 
  tasks, 
  stages, 
  columns,
  projectId, 
  onTaskClick, 
  onTaskMove 
}: TaskBoardProps) {
  // Use provided columns if available, otherwise create from stages/statuses
  let boardColumns: BoardColumn[] = [];
  
  if (columns && columns.length > 0) {
    boardColumns = columns;
  } else {
    // Fallback: create columns from stages or use defaults
    const availableStages = stages && stages.length > 0 ? stages.map(s => ({
      id: s.code || s.id,
      name: s.name
    })) : DEFAULT_STAGES;

    // Group tasks by stage
    const tasksByStage = availableStages.reduce((acc, stage) => {
      acc[stage.id] = tasks.filter(task => task.stageCode === stage.id);
      return acc;
    }, {} as Record<string, Task[]>);

    boardColumns = availableStages.map((stage, index) => ({
      id: stage.id,
      name: stage.name,
      order: index,
      tasks: tasksByStage[stage.id]?.map(task => ({
        id: task.id,
        title: task.title,
        statusId: task.statusId || stage.id,
        assigneeId: task.assigneeId,
        dueDate: task.dueDate,
        tags: task.tags,
        priority: 'medium' as const,
      })) || [],
    }));
  }

  const handleAddTask = (columnId: string) => {
    // TODO: Open task creation modal for this column
    console.log('Add task to column:', columnId);
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {boardColumns.map((column) => (
        <div key={column.id} className="min-w-[320px] flex-shrink-0">
          <TaskColumnComponent
            column={column}
            onTaskClick={onTaskClick as (task: TaskCard) => void}
            onTaskMove={onTaskMove}
            onAddTask={handleAddTask}
          />
        </div>
      ))}
    </div>
  );
}

export default TaskBoard;
