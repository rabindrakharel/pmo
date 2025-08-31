/**
 * Tasks Table with RBAC Action Buttons
 * 
 * Example implementation showing how task-level permissions work.
 * Tasks inherit permissions from their parent projects, so the RBAC
 * system will check project-level permissions for task actions.
 */

import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { RBACDataTable } from '@/components/ui/rbac-data-table'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/router'

// Task data type
interface Task {
  id: string
  name: string
  description?: string
  task_status?: string
  priority_level: string
  assigned_to?: string[]
  due_date?: string
  estimated_hours?: number
  actual_hours?: number
  project_id: string
  project_name?: string
  created: string
  updated: string
}

interface TasksTableProps {
  tasks: Task[]
  onRefresh?: () => void
  showProject?: boolean // Whether to show project column
}

export function TasksTable({ tasks, onRefresh, showProject = true }: TasksTableProps) {
  const { toast } = useToast()
  const router = useRouter()

  // Define table columns
  const columns: ColumnDef<Task>[] = [
    {
      accessorKey: 'name',
      header: 'Task Name',
      cell: ({ row }) => (
        <div className="font-medium max-w-[200px] truncate">
          {row.getValue('name')}
        </div>
      ),
    },
    ...(showProject ? [{
      accessorKey: 'project_name',
      header: 'Project',
      cell: ({ row }: { row: any }) => (
        <div className="text-sm text-muted-foreground">
          {row.getValue('project_name') || 'Unknown Project'}
        </div>
      ),
    }] : []),
    {
      accessorKey: 'task_status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('task_status') as string
        return (
          <Badge 
            variant={
              status === 'completed' ? 'default' :
              status === 'in-progress' ? 'secondary' :
              status === 'blocked' ? 'destructive' :
              status === 'pending' ? 'outline' : 'outline'
            }
          >
            {status || 'Not Set'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'priority_level',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.getValue('priority_level') as string
        return (
          <Badge 
            variant={
              priority === 'urgent' ? 'destructive' :
              priority === 'high' ? 'destructive' : 
              priority === 'medium' ? 'default' : 'secondary'
            }
          >
            {priority}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'assigned_to',
      header: 'Assigned To',
      cell: ({ row }) => {
        const assignees = row.getValue('assigned_to') as string[]
        return (
          <div className="text-sm">
            {assignees?.length ? (
              assignees.length === 1 ? assignees[0] : `${assignees.length} people`
            ) : 'Unassigned'}
          </div>
        )
      },
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }) => {
        const date = row.getValue('due_date') as string
        if (!date) return <span className="text-muted-foreground">No due date</span>
        
        const dueDate = new Date(date)
        const now = new Date()
        const isOverdue = dueDate < now
        
        return (
          <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
            {dueDate.toLocaleDateString()}
            {isOverdue && <span className="ml-1">(Overdue)</span>}
          </div>
        )
      },
    },
    {
      accessorKey: 'estimated_hours',
      header: 'Est. Hours',
      cell: ({ row }) => {
        const estimated = row.getValue('estimated_hours') as number
        const actual = row.original.actual_hours
        
        return (
          <div className="text-sm font-mono">
            {estimated || 0}h
            {actual && (
              <div className="text-xs text-muted-foreground">
                Actual: {actual}h
              </div>
            )}
          </div>
        )
      },
    },
  ]

  // Handle action button clicks
  const handleAction = (action: string, taskId: string, taskData: Task) => {
    switch (action) {
      case 'view':
        router.push(`/tasks/${taskId}`)
        break
        
      case 'edit':
        router.push(`/tasks/${taskId}/edit`)
        break
        
      case 'share':
        // Open share dialog or copy link
        navigator.clipboard.writeText(`${window.location.origin}/tasks/${taskId}`)
        toast({
          title: "Task Link Copied",
          description: "The task link has been copied to your clipboard.",
        })
        break
        
      case 'delete':
        // Show confirmation dialog and handle delete
        const confirmed = confirm(`Are you sure you want to delete task "${taskData.name}"?`)
        if (confirmed) {
          handleDeleteTask(taskId)
        }
        break
        
      default:
        console.log(`Unknown action: ${action}`)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (response.ok) {
        toast({
          title: "Task Deleted",
          description: "The task has been successfully deleted.",
        })
        onRefresh?.()
      } else {
        throw new Error('Failed to delete task')
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the task. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground">
            Manage tasks with project-based permissions
          </p>
        </div>
      </div>

      <RBACDataTable
        columns={columns}
        data={tasks}
        scopeType="task"  // Uses task-level permissions
        getRowId={(row) => row.id}
        onAction={handleAction}
        searchPlaceholder="Search tasks..."
        enabledActions={['view', 'edit', 'share', 'delete']}
        pageSize={20}
        className="border rounded-lg"
      />
    </div>
  )
}

/**
 * Alternative: Project-based Task Permissions
 * 
 * If you want to use project permissions for tasks instead of task-specific
 * permissions, you can create a variant that uses the project_id:
 */

export function TasksTableWithProjectPermissions({ tasks, onRefresh }: TasksTableProps) {
  const { toast } = useToast()
  const router = useRouter()

  // Same columns as above...
  const columns: ColumnDef<Task>[] = [
    // ... (same column definitions)
  ]

  const handleAction = (action: string, taskId: string, taskData: Task) => {
    // Same action handling...
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tasks (Project Permissions)</h2>
          <p className="text-muted-foreground">
            Task actions based on parent project permissions
          </p>
        </div>
      </div>

      <RBACDataTable
        columns={columns}
        data={tasks}
        scopeType="project"  // Uses project permissions for tasks
        getRowId={(row) => row.project_id}  // Use project_id for permission lookup
        onAction={handleAction}
        searchPlaceholder="Search tasks..."
        enabledActions={['view', 'edit', 'share', 'delete']}
        pageSize={20}
        className="border rounded-lg"
      />
    </div>
  )
}

/**
 * Usage Examples:
 * 
 * 1. Standard task permissions:
 *    ```tsx
 *    <TasksTable tasks={tasks} onRefresh={fetchTasks} />
 *    ```
 * 
 * 2. Project-based task permissions:
 *    ```tsx
 *    <TasksTableWithProjectPermissions tasks={tasks} onRefresh={fetchTasks} />
 *    ```
 * 
 * 3. Hide project column for project-specific task lists:
 *    ```tsx
 *    <TasksTable tasks={projectTasks} showProject={false} />
 *    ```
 */