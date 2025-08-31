# PMO API Documentation

## Overview

This is the backend API for the PMO (Project Management Office) system. It provides a comprehensive set of endpoints for project management, employee management, and role-based access control (RBAC).

## 🔐 RBAC System Architecture

The API implements a sophisticated Role-Based Access Control system using employee-centric permissions. All authorization is handled through the `ui-api-permission-rbac-gate.ts` module.

### Core RBAC Functions

```typescript
// 🎯 App-Level Permission Functions (using scope_name)
hasPermissionOnComponent(employeeId, 'app:component', 'TaskBoard', 'view')
hasPermissionOnPage(employeeId, 'app:page', '/employees', 'view')  
hasPermissionOnAPI(employeeId, 'app:api', '/api/v1/projects', 'create')

// 🎯 Resource-Specific Permission Functions (using scope_table_reference_id)
getPermissionByScopeId(employeeId, 'project', 'uuid-of-project')
getEmployeeScopeIdsByScopeType(employeeId, 'project') 
hasPermissionOnScopeId(employeeId, 'task', 'uuid-of-task', 'modify')

// 🛡️ Utility Functions  
getEmployeeScopeIds(employeeId, 'project', Permission.VIEW)
```

### Permission Levels

```typescript
export enum Permission {
  VIEW = 0,     // Read access
  MODIFY = 1,   // Edit/Update access  
  SHARE = 2,    // Share/Collaborate access
  DELETE = 3,   // Delete access
  CREATE = 4,   // Create new resources
}
```

## 🛡️ RBAC API Endpoints

The API provides dedicated endpoints for frontend permission checks:

### Employee Scopes Endpoint
```http
POST /api/v1/rbac/employee-scopes
Authorization: Bearer <token>

{
  "employeeId": "employee-uuid",
  "scopeType": "project",
  "minPermission": 0
}
```

**Response:**
```json
{
  "scopes": [
    {
      "scopeId": "project-uuid-1",
      "scopeName": "ERP Implementation",
      "permissions": [0, 1, 2]
    },
    {
      "scopeId": "project-uuid-2", 
      "scopeName": "Solar Installation",
      "permissions": [0]
    }
  ]
}
```

**Usage:** Fetches all accessible resources of a given type with their permissions. Used by data tables to determine which action buttons to show per row.

### Component Permissions Check
```http
POST /api/v1/rbac/component-permissions
Authorization: Bearer <token>

{
  "employeeId": "employee-uuid",
  "scopeType": "app:component",
  "scopeName": "TaskBoard",
  "action": "view"
}
```

**Response:**
```json
{
  "hasPermission": true
}
```

**Usage:** Checks if an employee can access a specific UI component. Used for conditional component rendering.

### Page Permissions Check
```http
POST /api/v1/rbac/page-permissions
Authorization: Bearer <token>

{
  "employeeId": "employee-uuid",
  "scopeType": "app:page", 
  "scopeName": "/employees",
  "action": "view"
}
```

**Response:**
```json
{
  "hasPermission": false
}
```

**Usage:** Validates page access for route protection and navigation menu filtering.

### Scope-Specific Permissions
```http
POST /api/v1/rbac/scope-permissions
Authorization: Bearer <token>

{
  "employeeId": "employee-uuid",
  "scopeType": "project",
  "scopeId": "project-uuid"
}
```

**Response:**
```json
{
  "permissions": [0, 1, 2]
}
```

**Usage:** Gets detailed permissions for a specific resource. Used for granular authorization checks.


### My Permissions (Convenience)
```http
GET /api/v1/rbac/my-permissions/project?minPermission=0
Authorization: Bearer <token>
```

**Response:** Same as employee-scopes but for the authenticated user.

## 📊 Data Model & Scope Types

### Scope Type Mapping

| Scope Type | Reference Table | Description |
|------------|----------------|-------------|
| `project` | `ops_project_head` | Project-level permissions |
| `task` | `ops_task_head` | Task-level permissions |
| `business` | `d_scope_business` | Business unit permissions |
| `hr` | `d_scope_hr` | HR organizational permissions |
| `location` | `d_scope_location` | Geographic location permissions |
| `worksite` | `d_scope_worksite` | Physical worksite permissions |
| `app:page` | `d_scope_app` | Page access permissions |
| `app:component` | `d_scope_app` | Component access permissions |
| `app:api` | `d_scope_app` | API endpoint permissions |

### Unified Permission Table

All permissions are stored in `rel_employee_scope_unified`:

```sql
CREATE TABLE app.rel_employee_scope_unified (
  id UUID PRIMARY KEY,
  emp_id UUID NOT NULL,           -- Employee ID
  scope_type TEXT NOT NULL,       -- 'project', 'task', 'app:page', etc.
  scope_table_reference_id UUID,  -- UUID reference to actual resource
  scope_name TEXT,                -- Human-readable name/path
  resource_permission INTEGER[],  -- Array of permission levels [0,1,2,3,4]
  active BOOLEAN DEFAULT true,
  created TIMESTAMPTZ DEFAULT NOW(),
  updated TIMESTAMPTZ DEFAULT NOW()
);
```

## 🚀 API Route Implementation Patterns

### Standard Route Protection

All API routes use the new RBAC system:

```typescript
// Project routes example
fastify.get('/api/v1/projects', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const employeeId = (request as any).user?.sub;
  
  // Check API endpoint permission
  const hasAPIAccess = await hasPermissionOnAPI(employeeId, 'app:api', '/api/v1/projects', 'view');
  if (!hasAPIAccess) {
    return reply.status(403).send({ error: 'Insufficient permissions' });
  }
  
  // Get employee's accessible project IDs
  const allowedProjectIds = await getEmployeeScopeIds(employeeId, 'project');
  
  // Filter results based on permissions
  // ... rest of implementation
});
```

### Resource-Specific Operations

For operations on specific resources:

```typescript
// Update specific project
fastify.put('/api/v1/projects/:id', async (request, reply) => {
  const { id } = request.params;
  const employeeId = (request as any).user?.sub;
  
  // Check if employee can modify this specific project
  const hasModifyAccess = await hasPermissionOnScopeId(employeeId, 'project', id, 'modify');
  if (!hasModifyAccess) {
    return reply.status(403).send({ error: 'Insufficient permissions' });
  }
  
  // ... proceed with update
});
```

### Middleware Integration

Schema-driven routes automatically apply RBAC:

```typescript
// Automatically generated CRUD with RBAC
const hasViewAccess = await hasPermissionOnAPI(employeeId, 'app:api', request.url, 'view');
const hasModifyAccess = await hasPermissionOnScopeId(employeeId, scopeType, id, 'modify');
```

## 🔧 Development Patterns

### Adding New Scope Types

1. **Add scope type to unified table:**
```sql
INSERT INTO app.rel_employee_scope_unified 
(emp_id, scope_type, scope_table_reference_id, scope_name, resource_permission)
VALUES 
('employee-uuid', 'new-scope-type', 'resource-uuid', 'Resource Name', ARRAY[0,1,2]);
```

2. **Update RBAC functions to handle the new type**
3. **Add API routes with proper permission checks**

### Permission Testing

Test permissions using the RBAC endpoints:

```bash
# Check if employee can view projects
curl -X POST /api/v1/rbac/employee-scopes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "emp-uuid", "scopeType": "project"}'

# Check component access  
curl -X POST /api/v1/rbac/component-permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "emp-uuid", "scopeType": "app:component", "scopeName": "TaskBoard", "action": "view"}'
```

## 📝 API Endpoints Summary

### Authentication & User Management
- **Login:** `POST /api/v1/auth/login` - JWT-based authentication
- **Profile:** `GET /api/v1/auth/me` - Current employee profile
- **Permissions:** `GET /api/v1/auth/permissions` - Employee permissions
- **Scopes:** `GET /api/v1/auth/scopes/:scopeType` - Employee scopes by type
- **Debug:** `GET /api/v1/auth/permissions/debug` - Permission debugging (admin only)

### Employee Management
- **List:** `GET /api/v1/emp` - List employees with filtering
- **Details:** `GET /api/v1/emp/:id` - Get single employee
- **Create:** `POST /api/v1/emp` - Create new employee
- **Update:** `PUT /api/v1/emp/:id` - Update employee information
- **Delete:** `DELETE /api/v1/emp/:id` - Soft delete employee

### Project Management
- **List:** `GET /api/v1/project` - List projects with filtering
- **Details:** `GET /api/v1/project/:id` - Get single project
- **Tasks:** `GET /api/v1/project/:id/tasks` - Get project tasks
- **Create:** `POST /api/v1/project` - Create new project
- **Update:** `PUT /api/v1/project/:id` - Update project
- **Delete:** `DELETE /api/v1/project/:id` - Soft delete project

### Task Management
- **List:** `GET /api/v1/task` - List tasks (head + current records)
- **Details:** `GET /api/v1/task/:id` - Get single task with current record
- **Create:** `POST /api/v1/task` - Create new task (head + initial record)
- **Update:** `PUT /api/v1/task/:id/record` - Update task (creates new record)
- **Delete:** `DELETE /api/v1/task/:id` - Soft delete task

### Client Management
- **List:** `GET /api/v1/client` - List clients with filtering
- **Details:** `GET /api/v1/client/:id` - Get single client
- **Hierarchy:** `GET /api/v1/client/:id/hierarchy` - Get client hierarchy
- **Create:** `POST /api/v1/client` - Create new client
- **Update:** `PUT /api/v1/client/:id` - Update client
- **Delete:** `DELETE /api/v1/client/:id` - Soft delete client

### Scope Management
- **Business:** `/api/v1/scope/business` - Business unit hierarchy management
- **HR:** `/api/v1/scope/hr` - HR organizational unit management
- **Location:** `/api/v1/scope/location` - Geographic location management
- **Worksite:** `/api/v1/worksite` - Physical worksite management

### Meta Data Management
- **Meta:** `GET /api/v1/meta` - System metadata by category
- **Categories:** `task_status`, `task_stage`, `project_status`, `project_stage`, `biz_level`, `loc_level`, `hr_level`

### RBAC & Authorization
- **Employee Scopes:** `POST /api/v1/rbac/employee-scopes` - Get accessible resources
- **Component Permissions:** `POST /api/v1/rbac/component-permissions` - UI component access
- **Page Permissions:** `POST /api/v1/rbac/page-permissions` - Page access validation
- **Scope Permissions:** `POST /api/v1/rbac/scope-permissions` - Resource-specific permissions

### System Health
- **Health:** `GET /healthz` - Liveness check
- **Ready:** `GET /readyz` - Readiness check with database connectivity

## 🛠️ Development Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run with specific environment
DATABASE_URL="postgresql://app:app@localhost:5434/app" \
REDIS_URL="redis://localhost:6379" \
JWT_SECRET="your-secret-key" \
pnpm dev
```

## 🔑 Environment Variables

```env
DATABASE_URL=postgresql://app:app@localhost:5434/app
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
DEV_BYPASS_OIDC=true  # For development only
```

## 🧪 Testing RBAC

The system includes comprehensive RBAC testing utilities:

```typescript
// Test employee permissions
const scopes = await getEmployeeScopeIdsByScopeType('emp-uuid', 'project');
console.log('Accessible projects:', scopes);

// Test component access
const canAccess = await hasPermissionOnComponent('emp-uuid', 'app:component', 'TaskBoard', 'view');
console.log('Can access TaskBoard:', canAccess);
```

This RBAC system provides **secure, scalable, and maintainable** access control throughout the entire API surface.