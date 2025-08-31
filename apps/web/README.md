# PMO Web Frontend Documentation

## Overview

The PMO Web frontend is a modern React + Vite application that provides an intuitive interface for project management with sophisticated Role-Based Access Control (RBAC). The UI automatically adapts based on employee permissions, showing only accessible features and actions.

## 🗂️ Current Application Routes

### Main Routes
- **`/`** → Dashboard (DashboardPage)
- **`/dashboard`** → Dashboard (DashboardPage)
- **`/projects`** → Projects List (ProjectsPage)
- **`/projects/:id`** → Project Detail (ProjectDetailPage)
- **`/tasks`** → Tasks Board (TasksPage)  
- **`/tasks/:id`** → Task Detail (TaskDetailPage)
- **`/directory/*`** → Employee Directory (DirectoryPage)
- **`/forms`** → Forms/Reports (FormsPage)
- **`/meta`** → Meta Configuration (MetaConfigPage)
- **`/admin/*`** → Admin Panel (Protected Route)

### Admin Routes (under `/admin`)
- **`/admin`** → Admin Dashboard
- **`/admin/meta/*`** → Meta Configuration Management
- **`/admin/locations/*`** → Location Hierarchy Management
- **`/admin/businesses/*`** → Business Unit Management  
- **`/admin/hr/*`** → HR Organizational Management
- **`/admin/worksites/*`** → Worksite Management
- **`/admin/employees/*`** → Employee Management
- **`/admin/roles/*`** → Role Management
- **`/admin/clients/*`** → Client Management

### Authentication
- **`/login`** → Login Page (shown when not authenticated)

## 🎨 RBAC-Enabled UI Components

The frontend implements a comprehensive permission-based UI system that seamlessly integrates with the backend RBAC API.

### 🗂️ RBACDataTable Component

The core component for displaying data with permission-gated action buttons:

```tsx
import { RBACDataTable } from '@/components/ui/rbac-data-table'

<RBACDataTable
  columns={columns}
  data={projects}
  scopeType="project"
  getRowId={(row) => row.id}
  onAction={handleAction}
  enabledActions={['view', 'edit', 'share', 'delete']}
/>
```

#### ✨ Key Features

✅ **Elegant tiny action buttons** - Eye, pencil, share, trash icons  
✅ **Permission-based visibility** - Only shows allowed actions per row  
✅ **Dynamic permission fetching** - Uses `getEmployeeScopeIdsByScopeType()`  
✅ **Universal scope support** - Works with project, task, business, hr, location, etc.  
✅ **Full data table functionality** - Sortable, filterable, paginated  
✅ **Right-most action column** - Clean, consistent layout  

#### 🎯 Action Button System

| Icon | Action | Permission Level | Color | Usage |
|------|--------|------------------|-------|-------|
| 👁️ | View | `Permission.VIEW (0)` | Blue | View details, read-only access |
| ✏️ | Edit | `Permission.MODIFY (1)` | Green | Edit/update resource |
| 🔗 | Share | `Permission.SHARE (2)` | Purple | Share/collaborate |
| 🗑️ | Delete | `Permission.DELETE (3)` | Red | Delete resource |

### 🔧 RBAC React Hooks

#### useRBACPermissions Hook

Fetches employee permissions for a scope type:

```tsx
import { useRBACPermissions } from '@/hooks/useRBACPermissions'

function ProjectsPage() {
  const { permissions, scopes, isLoading } = useRBACPermissions('project')
  
  // permissions = { "project-uuid-1": [0,1,2], "project-uuid-2": [0] }
  // scopes = [{ scopeId: "uuid", scopeName: "Project Name", permissions: [0,1,2] }]
}
```

#### useHasPermission Hook

Checks specific permission on a resource:

```tsx
import { useHasPermission } from '@/hooks/useRBACPermissions'

function ProjectCard({ projectId }) {
  const canEdit = useHasPermission('project', projectId, Permission.MODIFY)
  
  return (
    <div>
      {canEdit && <EditButton />}
    </div>
  )
}
```

#### useHasComponentPermission Hook

Component-level permission checking:

```tsx
import { useHasComponentPermission } from '@/hooks/useRBACPermissions'

function TaskBoard() {
  const { hasPermission, isLoading } = useHasComponentPermission('TaskBoard', 'view')
  
  if (!hasPermission) return <AccessDenied />
  
  return <TaskBoardComponent />
}
```

## 📊 Data Table Implementation Patterns

### Projects Table Example

```tsx
import { RBACDataTable } from '@/components/ui/rbac-data-table'
import { ColumnDef } from '@tanstack/react-table'

interface Project {
  id: string
  name: string
  status: string
  // ... other fields
}

function ProjectsTable({ projects }: { projects: Project[] }) {
  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: 'name',
      header: 'Project Name',
      cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge>{row.getValue('status')}</Badge>
    },
    // ... other columns
  ]

  const handleAction = (action: string, projectId: string, projectData: Project) => {
    switch (action) {
      case 'view':
        router.push(`/projects/${projectId}`)
        break
      case 'edit':
        router.push(`/projects/${projectId}/edit`)
        break
      case 'share':
        copyProjectLink(projectId)
        break
      case 'delete':
        deleteProject(projectId)
        break
    }
  }

  return (
    <RBACDataTable
      columns={columns}
      data={projects}
      scopeType="project"
      getRowId={(row) => row.id}
      onAction={handleAction}
      searchPlaceholder="Search projects..."
      enabledActions={['view', 'edit', 'share', 'delete']}
      pageSize={15}
    />
  )
}
```

### Tasks Table with Project Permissions

For tasks that inherit project permissions:

```tsx
<RBACDataTable
  columns={taskColumns}
  data={tasks}
  scopeType="project"           // Use project permissions
  getRowId={(row) => row.project_id}  // Use parent project ID
  onAction={handleTaskAction}
/>
```

### Business/HR/Location Tables

The same component works for all scope types:

```tsx
// Business units
<RBACDataTable scopeType="business" getRowId={(row) => row.id} />

// HR organizational units  
<RBACDataTable scopeType="hr" getRowId={(row) => row.id} />

// Geographic locations
<RBACDataTable scopeType="location" getRowId={(row) => row.id} />

// Worksites
<RBACDataTable scopeType="worksite" getRowId={(row) => row.id} />
```

## 🛡️ Permission Integration Patterns

### API Integration

The frontend seamlessly integrates with the RBAC backend through dedicated endpoints:

#### Employee Scopes API Call
```typescript
// Automatically called by useRBACPermissions hook
const response = await fetch('/api/v1/rbac/employee-scopes', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    employeeId: user.sub,
    scopeType: 'project',
    minPermission: 0
  })
})
```

#### Component Permissions Check
```typescript
// Called by useHasComponentPermission hook
const response = await fetch('/api/v1/rbac/component-permissions', {
  method: 'POST',
  body: JSON.stringify({
    employeeId: user.sub,
    scopeType: 'app:component',
    scopeName: 'TaskBoard',
    action: 'view'
  })
})
```

### Caching Strategy

The permission system includes intelligent caching:

```typescript
// 5-minute cache per employee/scope type combination
const CACHE_TTL = 5 * 60 * 1000
const permissionsCache = new Map<string, CachedPermissions>()
```

### Loading States

All permission checks include proper loading states:

```tsx
function DataTable() {
  const { permissions, isLoading } = useRBACPermissions('project')
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2"></div>
        <span className="ml-2">Loading permissions...</span>
      </div>
    )
  }
  
  return <RBACDataTable {...props} />
}
```

## 🎨 UI Component Patterns

### Permission-Based Rendering

```tsx
// Conditional component rendering
{hasPermission && <SensitiveComponent />}

// Conditional button visibility
{canEdit && <EditButton onClick={handleEdit} />}

// Permission-based navigation
{canAccessAdmin && <AdminMenuItem />}
```

### Route Protection

```tsx
// Page-level protection
function AdminPage() {
  const { hasPermission } = useHasComponentPermission('AdminPanel', 'view')
  
  if (!hasPermission) {
    return <Navigate to="/unauthorized" />
  }
  
  return <AdminPanelComponent />
}
```

### Menu/Navigation Filtering

```tsx
// Dynamic menu based on permissions
function Navigation() {
  const { hasPermission: canViewProjects } = useHasComponentPermission('ProjectList', 'view')
  const { hasPermission: canViewReports } = useHasComponentPermission('Reports', 'view')
  
  return (
    <nav>
      {canViewProjects && <NavItem href="/projects">Projects</NavItem>}
      {canViewReports && <NavItem href="/reports">Reports</NavItem>}
    </nav>
  )
}
```

## 📱 Responsive Design Patterns

### Mobile-First Action Buttons

```tsx
// Action buttons adapt to screen size
<div className="flex items-center gap-1">
  {/* Desktop: Show all buttons with icons */}
  <div className="hidden md:flex gap-1">
    {availableActions.map(action => (
      <ActionButton key={action} {...action} />
    ))}
  </div>
  
  {/* Mobile: Dropdown menu */}
  <div className="md:hidden">
    <DropdownMenu>
      {availableActions.map(action => (
        <DropdownMenuItem key={action}>{action.label}</DropdownMenuItem>
      ))}
    </DropdownMenu>
  </div>
</div>
```

### Responsive Table Layout

```tsx
// Tables stack on mobile
<div className="overflow-x-auto">
  <Table className="min-w-[600px]">
    {/* Table content */}
  </Table>
</div>
```

## 🔧 Development Patterns

### Adding New Data Tables

1. **Define your data interface:**
```typescript
interface MyResource {
  id: string
  name: string
  // ... other fields
}
```

2. **Create column definitions:**
```typescript
const columns: ColumnDef<MyResource>[] = [
  { accessorKey: 'name', header: 'Name' },
  // ... other columns
]
```

3. **Implement the table:**
```tsx
<RBACDataTable
  columns={columns}
  data={resources}
  scopeType="my-scope-type"  // e.g., 'project', 'task', etc.
  getRowId={(row) => row.id}
  onAction={handleAction}
/>
```

### Custom Permission Logic

For complex permission scenarios:

```tsx
function CustomPermissionComponent({ resourceId }) {
  const { permissions } = useRBACPermissions('project')
  const resourcePermissions = permissions[resourceId] || []
  
  // Custom logic
  const canManage = resourcePermissions.includes(Permission.MODIFY) && 
                   resourcePermissions.includes(Permission.DELETE)
  
  return canManage ? <ManagementPanel /> : <ReadOnlyView />
}
```

### Error Handling

```tsx
function PermissionAwareComponent() {
  const { permissions, error } = useRBACPermissions('project')
  
  if (error) {
    return <ErrorBoundary error={error} />
  }
  
  // ... rest of component
}
```

## 🛠️ Development Setup

```bash
# Install dependencies
pnpm install

# Start development server  
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint
```

## 📦 Component Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── rbac-data-table.tsx    # Main RBAC data table
│   │   ├── table.tsx              # Base table components
│   │   ├── button.tsx             # Button components
│   │   └── tooltip.tsx            # Tooltip components
│   ├── tables/
│   │   ├── ProjectsTable.tsx      # Projects implementation
│   │   ├── TasksTable.tsx         # Tasks implementation
│   │   └── ...                    # Other table implementations
│   └── auth/
│       ├── ProtectedRoute.tsx     # Route protection
│       └── AccessBoundary.tsx     # Component access control
├── hooks/
│   ├── useRBACPermissions.ts      # RBAC permission hooks
│   └── use-toast.ts               # Toast notifications
└── lib/
    └── utils.ts                   # Utility functions
```

## 🎯 Best Practices

### Permission Check Optimization

```tsx
// ✅ Good: Cache permissions at parent level
function ParentComponent() {
  const { permissions } = useRBACPermissions('project')
  return (
    <div>
      {projects.map(project => (
        <ProjectCard 
          key={project.id}
          project={project}
          permissions={permissions[project.id]}  // Pass down
        />
      ))}
    </div>
  )
}

// ❌ Avoid: Multiple permission calls
function ProjectCard({ project }) {
  const { permissions } = useRBACPermissions('project') // Called for each card
  // ...
}
```

### Error Boundaries

```tsx
// Wrap permission-dependent components
<ErrorBoundary>
  <RBACDataTable {...props} />
</ErrorBoundary>
```

### Testing

```tsx
// Mock permissions for testing
const mockPermissions = {
  'project-1': [Permission.VIEW, Permission.MODIFY],
  'project-2': [Permission.VIEW]
}

// Test component with mocked permissions
render(
  <MockRBACProvider permissions={mockPermissions}>
    <ProjectsTable />
  </MockRBACProvider>
)
```

This system provides a **clean, scalable, and maintainable** permission-based UI that automatically adapts to employee access levels while providing an elegant user experience.