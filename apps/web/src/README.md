# PMO Platform Web Frontend

A comprehensive React-based project management platform with advanced role-based access control (RBAC), dynamic UI components, and seamless API integration.

## 🏗️ Architecture Overview

### Technology Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: Zustand with persistence
- **API Layer**: TanStack Query (React Query) for server state
- **Routing**: React Router v6
- **Forms**: React Hook Form with Zod validation
- **Auth**: JWT-based authentication with role-based permissions
- **UI Components**: Custom component system with permission-aware rendering

---

## 🎯 UI Interaction Journey & Wireframing

### User Flow Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Login     │───▶│  Dashboard  │───▶│   Feature   │
│   (Public)  │    │  (Private)  │    │   Pages     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ JWT Token   │    │ Permission  │    │  Dynamic    │
│ Validation  │    │  Check      │    │  Actions    │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Page Hierarchy & Navigation

| Level | Page Type | Route Pattern | Access Control |
|-------|-----------|---------------|----------------|
| **L1** | Authentication | `/login` | Public |
| **L2** | Dashboard | `/`, `/dashboard` | Authenticated |
| **L3** | Core Features | `/projects`, `/tasks`, `/meta` | Role-based |
| **L4** | Detail Views | `/projects/:id`, `/tasks/:id` | Item-level permissions |
| **L5** | Admin Panel | `/admin/*` | Admin roles only |

---

## 📱 Pages & Components Mapping

### Core Pages Structure

| Page | Component File | Purpose | Key Features |
|------|----------------|---------|--------------|
| **Login** | `pages/auth/LoginPage.tsx` | Authentication | JWT token management, role detection |
| **Dashboard** | `pages/dashboard/DashboardPage.tsx` | Landing page | Analytics, quick actions, recent items |
| **Projects** | `pages/projects/ProjectsPage.tsx` | Project management | Table/grid views, filters, CRUD operations |
| **Project Detail** | `pages/projects/ProjectDetailPage.tsx` | Single project view | Full project lifecycle, team management |
| **Tasks** | `pages/tasks/TasksPage.tsx` | Task management | Kanban board, list view, status management |
| **Task Detail** | `pages/tasks/TaskDetailPage.tsx` | Single task view | Time tracking, comments, attachments |
| **Meta Config** | `pages/admin/MetaConfigPage.tsx` | System configuration | Task stages, workflows, system settings |

### Layout Components

```
apps/web/src/components/layout/
├── Layout.tsx              # Main layout wrapper
├── TopBar.tsx             # Navigation header with tabs
└── Sidebar.tsx            # Side navigation (if needed)
```

### UI Component System

| Component Category | Files | Props Interface | Functionality |
|-------------------|-------|-----------------|---------------|
| **Action Buttons** | `ui/action-buttons.tsx` | `ActionButtonsProps` | View/Edit/Share/Delete with unified permissions |
| **Data Tables** | `ui/data-table.tsx` | `DataTableProps` | Sortable, filterable, paginated tables |
| **Forms** | Multiple form components | Schema-driven | Auto-generated from database schema |
| **Auth Boundaries** | `auth/AccessBoundary.tsx` | `AccessBoundaryProps` | Enhanced permission-based rendering with scope context |

---

## 🔗 API Layer Integration

### API Client Architecture

```typescript
// Base Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Authentication Flow
JWT Token → Authorization Header → API Request → Response
```

### API Integration Mapping

| Frontend Component | API Endpoint | HTTP Method | Purpose |
|-------------------|--------------|-------------|---------|
| **ProjectsPage** | `/api/v1/projects` | GET | Fetch projects list with pagination |
| **ProjectDetailPage** | `/api/v1/projects/:id` | GET | Fetch single project details |
| **TasksPage** | `/api/v1/tasks` | GET | Fetch tasks with filtering |
| **MetaConfigPage** | `/api/v1/meta/task-stages` | GET/PUT | Manage system configuration |
| **ActionButtons** | Various CRUD endpoints | POST/PUT/DELETE | Perform actions based on unified permissions |
| **LoginPage** | `/api/v1/auth/login` | POST | JWT authentication with bundled permissions |
| **AccessBoundary** | `/api/v1/auth/permissions` | GET | Real-time permission validation |

### API Response Structure

```typescript
interface ApiResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  metadata?: SchemaMetadata;
}
```

---

## 🛡️ Enhanced Authentication & Authorization Architecture

### JWT Token Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Login     │───▶│ JWT Token   │───▶│  API Call   │───▶│  Response   │
│ Credentials │    │ + User Info │    │ w/ Headers  │    │    Data     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Auth Store │    │ Local       │    │ Permission  │    │  UI         │
│  (Zustand)  │    │ Storage     │    │ Check       │    │ Render      │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Unified Permission System

| Permission Level | Numeric Value | Frontend Actions | Backend Validation |
|-----------------|---------------|------------------|-------------------|
| **VIEW** | 0 | Show read-only data | Database query permissions |
| **MODIFY** | 1 | Edit forms, update data | Update/modify API access |
| **SHARE** | 2 | Share buttons, export | Share functionality access |
| **DELETE** | 3 | Delete buttons, confirmations | Delete API permissions |
| **CREATE** | 4 | Add new items, forms | Create API permissions |

### RBAC Implementation

```typescript
interface User {
  id: string;
  sub: string;          // JWT subject
  email: string;
  name: string;
  permissions?: {       // Enhanced bundled permissions from login response
    app: number[];      // App-level permissions array
    scopes: Record<string, {
      scopeIds: string[];
      permissions: number[];
      scopeNames: string[];
    }>;
    isAdmin: boolean;
    totalPermissions: number; // Total permission count for debugging
  };
}

interface PermissionCheck {
  resource: 'project' | 'task' | 'meta' | 'component';
  action: 'view' | 'modify' | 'share' | 'delete' | 'create';
  scopeId?: string;     // Specific item ID for fine-grained control
}
```

---

## 🏭 Frontend-to-Backend Component Mapping

### Component → API → Database Flow

| UI Component | Frontend Props | API Endpoint | Database Table | Middleware |
|--------------|---------------|--------------|----------------|------------|
| **ActionButtons** | `{resource, itemId, onEdit, onDelete}` | `/api/v1/{resource}/:id` | Resource-specific table | Enhanced `scope-auth.ts` |
| **ProjectsPage** | `{data, loading, onRefresh}` | `/api/v1/project` | `ops_project_head` | Authentication + Unified RBAC |
| **TasksPage** | `{tasks, stages, onTaskClick}` | `/api/v1/task` | `ops_task_head` | Task permissions |
| **MetaConfigPage** | `{stages, onSave, onEdit}` | `/api/v1/meta` | Meta tables | Admin permissions |
| **AccessBoundary** | `{action, resource, scopeId}` | Permission validation | `rel_employee_scope_unified` | Enhanced permission middleware |

### API Request Flow

```
Frontend Component → API Client → HTTP Request → Backend Middleware → Database → Response
       ↓                ↓            ↓              ↓                  ↓         ↓
   Props/State   → API Function → Bearer Token → JWT Validation → SQL Query → JSON Data
```

---

## 🔐 Middleware & Security Architecture

### Authentication Middleware

```typescript
// Frontend API Client
const apiClient = {
  get: (url) => fetch(url, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  })
}
```

### Permission Checking Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   UI Event  │───▶│ Permission  │───▶│   Action    │
│  (onClick)  │    │    Check    │    │  Execute    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ AccessBoundary│    │ Database    │    │ API Call /  │
│  Component  │    │ Permission  │    │ UI Render   │
└─────────────┘    └─────────────┘    └─────────────┘
```

---

## 📊 Detailed Component Props & Interfaces

### ActionButtons Component

```typescript
interface ActionButtonsProps {
  resource: 'project' | 'task' | 'meta' | 'component';
  itemId?: string;
  item?: any;
  onView?: (item?: any) => void;
  onEdit?: (item?: any) => void;
  onShare?: (item?: any) => void;
  onDelete?: (item?: any) => void;
  showAsDropdown?: boolean;
  variant?: 'default' | 'compact' | 'minimal';
}

// Usage Examples:
<TableActionButtons
  resource="project"
  itemId={project.id}
  onView={() => navigate(`/projects/${project.id}`)}
  onEdit={() => setEditModal(project)}
  onShare={() => shareProject(project)}
  onDelete={() => confirmDelete(project)}
/>
```

### Data Table Component

```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  searchKey?: string;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  pageSize?: number;
  currentPage?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  filters?: FilterConfig[];
  activeFilters?: Record<string, any>;
  onFiltersChange?: (filters: Record<string, any>) => void;
}
```

### Permission Boundary Component (Comprehensive Scope-Based)

```typescript
interface AccessBoundaryProps {
  action: 'view' | 'create' | 'modify' | 'delete' | 'grant' | 'share';
  resource: 'project' | 'task' | 'meta' | 'component' | 'location' | 'business' | 'worksite' | 'hr';
  
  // Multi-dimensional scope context
  scope?: {
    type: 'business' | 'location' | 'worksite' | 'hr' | 'project' | 'global';
    id?: string;           // Specific scope ID from d_scope_unified
    reference_id?: string; // Reference to actual scope table record
    parent_id?: string;    // Parent scope for hierarchy
  };
  
  // Resource-specific context
  resourceId?: string;     // Specific resource instance ID
  resourceContext?: {      // Additional resource context
    projectId?: string;    // Project context
    locationId?: string;   // Location context  
    businessId?: string;   // Business context
    worksiteId?: string;   // Worksite context
    clientId?: string;     // Client context
  };
  
  // Legacy support
  scopeId?: string;
  
  fallback?: React.ReactNode;
  children: React.ReactNode;
  debug?: boolean;        // Enable permission debugging
}

// Usage Examples:

// Basic resource permission (legacy compatible)
<AccessBoundary action="delete" resource="project" scopeId={project.id}>
  <DeleteButton onClick={() => deleteProject(project.id)} />
</AccessBoundary>

// Comprehensive scope-based permission
<AccessBoundary 
  action="modify" 
  resource="project" 
  resourceId={project.id}
  scope={{
    type: 'business',
    id: businessScope.id,
    reference_id: project.businessId
  }}
  resourceContext={{
    projectId: project.id,
    locationId: project.locationId,
    businessId: project.businessId
  }}
  debug={isDevelopment}
>
  <EditProjectButton project={project} />
</AccessBoundary>

// Multi-scope hierarchical permission
<AccessBoundary
  action="view"
  resource="task" 
  resourceId={task.id}
  scope={{
    type: 'project',
    id: projectScope.id,
    parent_id: businessScope.id
  }}
  resourceContext={{
    projectId: task.projectId,
    worksiteId: task.worksiteId,
    businessId: project.businessId
  }}
>
  <TaskDetailView task={task} />
</AccessBoundary>

// Global scope permission (system-wide)
<AccessBoundary 
  action="create" 
  resource="business"
  scope={{ type: 'global' }}
>
  <CreateBusinessButton />
</AccessBoundary>
```

---

## 🌐 Comprehensive Scope-Based Permission Architecture

### Multi-Dimensional Scope System

The PMO Platform implements a sophisticated scope-based permission system that provides granular access control across multiple organizational dimensions:

| Scope Type | Description | Database Table | Hierarchy Support |
|------------|-------------|----------------|------------------|
| **Business** | Organizational units, departments, divisions | `d_scope_business` | ✅ Parent-child relationships |
| **Location** | Geographic locations, facilities, regions | `d_scope_location` | ✅ Regional hierarchies |
| **Worksite** | Physical work locations, job sites | `d_scope_worksite` | ✅ Location-based grouping |
| **HR** | Human resources, team structures | `d_scope_hr` | ✅ Organizational chart |
| **Project** | Project-specific scopes | `ops_project_head` | ✅ Project hierarchies |
| **Global** | System-wide permissions | System level | ❌ Top-level only |

### Unified Scope Reference Table

```sql
-- Unified scope reference table (d_scope_unified)
CREATE TABLE app.d_scope_unified (
  id uuid PRIMARY KEY,
  scope_type text NOT NULL, -- 'business', 'location', 'worksite', 'hr', 'project'
  scope_name text NOT NULL,
  scope_reference_id uuid NOT NULL, -- References actual scope table record
  parent_scope_id uuid REFERENCES app.d_scope_unified(id), -- Hierarchy support
  active boolean DEFAULT true
);
```

### Employee-Scope Permission Matrix

```sql
-- Employee permissions per scope and resource (rel_employee_scope_unified)
CREATE TABLE app.rel_employee_scope_unified (
  id uuid PRIMARY KEY,
  emp_id uuid REFERENCES app.d_employee(id),
  scope_id uuid REFERENCES app.d_scope_unified(id),
  resource_type text NOT NULL, -- 'project', 'task', 'component', etc.
  resource_id uuid, -- Specific resource instance (optional)
  resource_permission smallint[] NOT NULL DEFAULT '{}', -- [0,1,2,3,4] permission array
  active boolean DEFAULT true
);
```

### Permission Resolution Hierarchy

```
1. Direct User Permissions (highest priority)
   ↓
2. Role-based Permissions (inherited from roles)
   ↓
3. Scope Hierarchy Inheritance (parent → child scopes)
   ↓
4. Default Permissions (system fallback)
```

### Scope Context API

```typescript
interface ScopeContext {
  type: 'business' | 'location' | 'worksite' | 'hr' | 'project' | 'global';
  id?: string;           // Specific scope ID from d_scope_unified
  reference_id?: string; // Reference to actual scope table record
  parent_id?: string;    // Parent scope for hierarchy traversal
}

interface ResourceContext {
  projectId?: string;    // Project context
  locationId?: string;   // Location context  
  businessId?: string;   // Business context
  worksiteId?: string;   // Worksite context
  clientId?: string;     // Client context
  hrId?: string;         // HR context
  employeeId?: string;   // Employee context
}

interface PermissionCheckRequest {
  userId: string;
  action: 'view' | 'create' | 'modify' | 'delete' | 'grant' | 'share';
  resource: string;
  scope?: ScopeContext;
  resourceId?: string;
  resourceContext?: ResourceContext;
}
```

### Scope-Based Permission Examples

#### Example 1: Business Scope Permissions
```typescript
// James Miller (CEO) has full business access
<AccessBoundary 
  action="modify" 
  resource="project"
  scope={{
    type: 'business',
    reference_id: 'huron-home-services-id'
  }}
  resourceContext={{
    businessId: project.businessId,
    locationId: project.locationId
  }}
>
  <ProjectManagementTools />
</AccessBoundary>
```

#### Example 2: Location-Specific Permissions
```typescript
// Regional manager has location-specific access
<AccessBoundary 
  action="view" 
  resource="worksite"
  scope={{
    type: 'location',
    reference_id: 'greater-toronto-area-id',
    parent_id: 'ontario-region-id'
  }}
  resourceContext={{
    locationId: worksite.locationId,
    businessId: worksite.businessId
  }}
>
  <WorksiteDetails />
</AccessBoundary>
```

#### Example 3: Project Hierarchy Permissions
```typescript
// Project team member has project-specific task access
<AccessBoundary 
  action="modify" 
  resource="task"
  scope={{
    type: 'project',
    reference_id: project.id,
    parent_id: business_scope.id
  }}
  resourceContext={{
    projectId: task.projectId,
    worksiteId: task.worksiteId
  }}
>
  <TaskEditor task={task} />
</AccessBoundary>
```

#### Example 4: Multi-Scope Component Permissions
```typescript
// UI component with multiple scope contexts
<AccessBoundary 
  action="delete" 
  resource="component"
  scope={{
    type: 'business',
    reference_id: user.businessId
  }}
  resourceContext={{
    projectId: currentProject?.id,
    locationId: currentLocation?.id,
    businessId: user.businessId
  }}
  debug={process.env.NODE_ENV === 'development'}
>
  <ActionButtons
    resource="project"
    itemId={project.id}
    onDelete={handleDelete}
  />
</AccessBoundary>
```

### API Integration for Scope Permissions

```typescript
// Comprehensive permission check API call
const permissionResponse = await api.checkUserPermissions({
  userId: user.sub,
  action: 'modify',
  resource: 'project',
  scope: {
    type: 'business',
    reference_id: project.businessId,
    parent_id: parentBusinessId
  },
  resourceId: project.id,
  resourceContext: {
    projectId: project.id,
    locationId: project.locationId,
    businessId: project.businessId,
    worksiteId: project.worksiteId
  }
});

// Response includes hierarchy and debug information
interface PermissionCheckResponse {
  hasPermission: boolean;
  permissions: number[]; // [0,1,2,3,4]
  scope_context?: string;
  scope_hierarchy?: ScopeContext[];
  effective_scope?: ScopeContext;
  debug_info?: {
    direct_permissions?: any[];
    inherited_permissions?: any[];
    role_permissions?: any[];
  };
}
```

### Scope Management APIs

```typescript
// Get unified scopes with hierarchy
const scopes = await api.getUnifiedScopes({
  scope_type: 'business',
  active: true,
  parent_scope_id: parentScopeId
});

// Get employee scope permissions
const employeePermissions = await api.getEmployeeScopePermissions(employeeId, {
  resource_type: 'project',
  scope_type: 'business',
  active: true
});

// Create new scope-based permission
const newPermission = await api.createEmployeeScopePermission({
  emp_id: employee.id,
  scope_id: businessScope.id,
  resource_type: 'project',
  resource_permission: [0, 1, 2], // VIEW, MODIFY, SHARE
  name: 'Project Team Member Access',
  active: true
});
```

This comprehensive scope-based architecture provides:
- **Granular Control**: Fine-grained permissions at multiple organizational levels
- **Hierarchy Support**: Automatic permission inheritance through organizational structures  
- **Multi-Dimensional**: Simultaneous business, location, project, and resource contexts
- **Scalable**: Supports complex enterprise organizational structures
- **Auditable**: Full permission tracking and debugging capabilities
- **Performance**: Cached permission resolution with intelligent invalidation

---

## 🔄 State Management Architecture

### Auth Store (Zustand)

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Persistence Configuration
persist(authStore, {
  name: 'auth-storage',
  partialize: (state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
  })
})
```

### API State (TanStack Query)

```typescript
// Query Configuration
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['projects', queryParams],
  queryFn: () => api.getProjects(queryParams),
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Mutation for Updates
const updateMutation = useMutation({
  mutationFn: ({ id, data }) => api.updateProject(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries(['projects']);
    toast.success('Project updated successfully');
  },
});
```

---

## 📁 File Structure & Organization

```
apps/web/src/
├── components/
│   ├── auth/
│   │   ├── AccessBoundary.tsx      # Permission-based rendering
│   │   └── ProtectedRoute.tsx      # Route-level protection
│   ├── layout/
│   │   ├── Layout.tsx              # Main layout wrapper
│   │   └── TopBar.tsx              # Navigation with role-based tabs
│   ├── ui/
│   │   ├── action-buttons.tsx      # CRUD action buttons with permissions
│   │   ├── data-table.tsx          # Advanced data table component
│   │   └── [shadcn components]     # Base UI component library
│   ├── projects/
│   │   └── project-list-page.tsx   # Enhanced project management
│   └── tasks/
│       ├── TaskBoard.tsx           # Kanban-style task board
│       └── task-management.tsx     # JIRA-like task interface
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx           # Authentication interface
│   ├── projects/
│   │   ├── ProjectsPage.tsx        # Projects listing with filters
│   │   └── ProjectDetailPage.tsx   # Individual project details
│   ├── tasks/
│   │   ├── TasksPage.tsx           # Task management dashboard
│   │   └── TaskDetailPage.tsx      # Individual task details
│   └── admin/
│       ├── AdminPage.tsx           # Admin dashboard
│       └── MetaConfigPage.tsx      # System configuration
├── lib/
│   ├── api.ts                      # API client and type definitions
│   ├── utils.ts                    # Utility functions
│   ├── schema-driven-components.tsx # Dynamic component generation
│   ├── schema-inference.ts         # Database schema processing
│   └── universal-schema-components.tsx # Unified schema API
├── stores/
│   └── auth.ts                     # Authentication state management
└── contexts/
    └── PermissionsContext.tsx      # Permission state context
```

---

## 🚀 Development Workflow

### Environment Setup

```bash
# Environment Variables
VITE_API_URL=http://localhost:4000/api
VITE_APP_TITLE=PMO Platform
VITE_JWT_SECRET=your-jwt-secret
```

### Development Commands

```bash
# Start development server
pnpm dev

# Build for production  
pnpm build

# Run type checking
pnpm type-check

# Run linting
pnpm lint
```

### Component Development Pattern

1. **Create Interface** → Define TypeScript interfaces for props
2. **Add Permissions** → Integrate AccessBoundary for RBAC
3. **API Integration** → Connect to backend endpoints via TanStack Query
4. **State Management** → Use Zustand for client state, React Query for server state
5. **Testing** → Add unit tests for business logic and permissions

---

## 🎨 UI/UX Design System

### Color Coding & Visual Hierarchy

| Action Type | Color | Icon | Usage |
|-------------|-------|------|-------|
| **View** | Blue (`text-blue-600`) | Eye | Read-only data access |
| **Edit** | Amber (`text-amber-600`) | Edit2 | Modify existing records |
| **Share** | Green (`text-green-600`) | Share2 | Export or share functionality |
| **Delete** | Red (`text-red-600`) | Trash2 | Destructive actions |

### Responsive Design Breakpoints

| Device | Breakpoint | Layout Changes |
|--------|------------|----------------|
| **Mobile** | `< 640px` | Single column, collapsed navigation |
| **Tablet** | `640px - 1024px` | Two-column grid, compact tables |
| **Desktop** | `> 1024px` | Full multi-column layout |

### Accessibility Features

- ARIA labels for all interactive elements
- Keyboard navigation support
- High contrast color schemes
- Screen reader compatibility
- Focus management for modal dialogs

---

## 🔧 Advanced Features & Integrations

### Real-time Updates

```typescript
// WebSocket integration for live updates
useEffect(() => {
  const ws = new WebSocket('ws://localhost:4000/ws');
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    queryClient.invalidateQueries([update.resource]);
  };
}, []);
```

### Export Functionality

```typescript
const exportData = async (format: 'csv' | 'excel' | 'pdf') => {
  const response = await api.exportProjects({ format, filters });
  downloadFile(response.data, `projects.${format}`);
};
```

### Bulk Operations

```typescript
const bulkUpdate = async (selectedIds: string[], updates: Partial<Project>) => {
  await Promise.all(
    selectedIds.map(id => api.updateProject(id, updates))
  );
  refetch();
};
```

This architecture ensures a scalable, maintainable, and secure frontend application with comprehensive role-based access control and seamless API integration.