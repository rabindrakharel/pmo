/**
 * Projects Table with RBAC Action Buttons
 * 
 * Example implementation of the RBACDataTable component for projects.
 * This demonstrates how to use the permission-gated action buttons
 * with proper column definitions and action handling.
 */

import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { RBACDataTable } from '@/components/ui/rbac-data-table'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/router'

// Project data type
interface Project {
  id: string
  name: string
  project_code?: string
  project_status?: string
  project_stage?: string
  priority_level: string
  budget_allocated?: number
  budget_currency: string
  planned_start_date?: string
  planned_end_date?: string
  project_managers: string[]
  created: string
  updated: string
}

interface ProjectsTableProps {
  projects: Project[]
  onRefresh?: () => void
}

export function ProjectsTable({ projects, onRefresh }: ProjectsTableProps) {
  const { toast } = useToast()
  const router = useRouter()

  // Define table columns
  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: 'project_code',
      header: 'Code',
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.getValue('project_code') || 'N/A'}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Project Name',
      cell: ({ row }) => (
        <div className="font-medium">
          {row.getValue('name')}
        </div>
      ),
    },
    {
      accessorKey: 'project_status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('project_status') as string
        return (
          <Badge 
            variant={
              status === 'active' ? 'default' : 
              status === 'completed' ? 'secondary' : 
              status === 'on-hold' ? 'destructive' : 'outline'
            }
          >
            {status || 'Unknown'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'project_stage',
      header: 'Stage',
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.getValue('project_stage') || 'Not Set'}
        </Badge>
      ),
    },
    {
      accessorKey: 'priority_level',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.getValue('priority_level') as string
        return (
          <Badge 
            variant={
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
      accessorKey: 'budget_allocated',
      header: 'Budget',
      cell: ({ row }) => {
        const budget = row.getValue('budget_allocated') as number
        const currency = row.original.budget_currency
        return (
          <div className="text-right font-mono">
            {budget ? `${currency} ${budget.toLocaleString()}` : 'N/A'}
          </div>
        )
      },
    },
    {
      accessorKey: 'planned_start_date',
      header: 'Start Date',
      cell: ({ row }) => {
        const date = row.getValue('planned_start_date') as string
        return (
          <div className="text-sm">
            {date ? new Date(date).toLocaleDateString() : 'Not Set'}
          </div>
        )
      },
    },
    {
      accessorKey: 'project_managers',
      header: 'Managers',
      cell: ({ row }) => {
        const managers = row.getValue('project_managers') as string[]
        return (
          <div className="text-sm">
            {managers?.length ? `${managers.length} manager(s)` : 'None'}
          </div>
        )
      },
    },
  ]

  // Handle action button clicks
  const handleAction = (action: string, projectId: string, projectData: Project) => {
    switch (action) {
      case 'view':
        router.push(`/projects/${projectId}`)
        break
        
      case 'edit':
        router.push(`/projects/${projectId}/edit`)
        break
        
      case 'share':
        // Open share dialog or copy link
        navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}`)
        toast({
          title: "Project Link Copied",
          description: "The project link has been copied to your clipboard.",
        })
        break
        
      case 'delete':
        // Show confirmation dialog and handle delete
        const confirmed = confirm(`Are you sure you want to delete project "${projectData.name}"?`)
        if (confirmed) {
          handleDeleteProject(projectId)
        }
        break
        
      default:
        console.log(`Unknown action: ${action}`)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (response.ok) {
        toast({
          title: "Project Deleted",
          description: "The project has been successfully deleted.",
        })
        onRefresh?.()
      } else {
        throw new Error('Failed to delete project')
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the project. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground">
            Manage your projects and their permissions
          </p>
        </div>
      </div>

      <RBACDataTable
        columns={columns}
        data={projects}
        scopeType="project"
        getRowId={(row) => row.id}
        onAction={handleAction}
        searchPlaceholder="Search projects..."
        enabledActions={['view', 'edit', 'share', 'delete']}
        pageSize={15}
        className="border rounded-lg"
      />
    </div>
  )
}

/**
 * Usage Instructions:
 * 
 * 1. Import and use this component in your pages:
 *    ```tsx
 *    import { ProjectsTable } from '@/components/tables/ProjectsTable'
 *    
 *    function ProjectsPage() {
 *      const [projects, setProjects] = useState([])
 *      
 *      return <ProjectsTable projects={projects} onRefresh={fetchProjects} />
 *    }
 *    ```
 * 
 * 2. The component will automatically:
 *    - Fetch employee permissions for 'project' scope type
 *    - Show only action buttons the employee has permission for
 *    - Handle view/edit/share/delete actions appropriately
 *    - Provide elegant icons and tooltips for each action
 * 
 * 3. Permissions are checked using:
 *    - View: Permission.VIEW (0) - Shows eye icon
 *    - Edit: Permission.MODIFY (1) - Shows pencil icon  
 *    - Share: Permission.SHARE (2) - Shows share icon
 *    - Delete: Permission.DELETE (3) - Shows trash icon
 * 
 * 4. Each row shows different actions based on the employee's
 *    specific permissions for that project ID.
 */