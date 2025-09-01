# PMO API Documentation

## 🚀 Enterprise Project Management API

A comprehensive, high-performance REST API built with **Fastify** and **TypeScript** for the PMO Enterprise Task Management Platform. Features advanced Role-Based Access Control (RBAC), multi-dimensional scoping, and complete CRUD operations across 24 database tables.

---

## 📊 API Overview

### 🔧 Technical Stack
- **Runtime**: Node.js 20+ with TypeScript 5.0+
- **Framework**: Fastify 5.0+ (high-performance alternative to Express)
- **Database**: PostgreSQL 16+ with PostGIS extensions
- **ORM**: Drizzle ORM (type-safe database operations)
- **Authentication**: JWT with `@fastify/jwt` plugin
- **Validation**: Zod schemas for request/response validation
- **Documentation**: OpenAPI/Swagger integration
- **Cache**: Redis integration for session and permission caching

### 🌟 Key Features
- **✅ 11 API Modules** - Complete coverage of all business domains
- **✅ Advanced RBAC** - Multi-dimensional scope-based access control
- **✅ Real-time Permissions** - Dynamic permission checking with caching
- **✅ OpenAPI Documentation** - Interactive API docs at `/docs`
- **✅ JWT Authentication** - Secure token-based authentication
- **✅ Type-Safe Operations** - Full TypeScript integration with Drizzle ORM
- **✅ Health Monitoring** - Comprehensive health and readiness checks
- **✅ Production Ready** - Error handling, logging, and monitoring

---

## 🔐 Advanced RBAC System Architecture

### Permission Model
The API implements a sophisticated **unified permission system** using the `rel_employee_scope_unified` table, eliminating complex permission lookups and providing real-time access control.

#### Permission Levels
```typescript
export enum Permission {
  VIEW = 0,     // Read access - view data
  MODIFY = 1,   // Edit access - update existing data  
  SHARE = 2,    // Collaboration access - share resources
  DELETE = 3,   // Delete access - remove data
  CREATE = 4,   // Creation access - add new resources
}
```

#### Core RBAC Functions
```typescript
// 🎯 App-Level Permissions (scope_name based)
hasPermissionOnComponent(employeeId, 'app:component', 'TaskBoard', 'view')
hasPermissionOnPage(employeeId, 'app:page', '/employees', 'view')  
hasPermissionOnAPI(employeeId, 'app:api', '/api/v1/projects', 'create')

// 🎯 Resource-Specific Permissions (scope_table_reference_id based)
getPermissionByScopeId(employeeId, 'project', 'uuid-of-project')
hasPermissionOnScopeId(employeeId, 'task', 'uuid-of-task', 'modify')
getEmployeeScopeIdsByScopeType(employeeId, 'project')
```

### Multi-Dimensional Scope Types

| Scope Type | Reference Table | Description | Usage |
|------------|----------------|-------------|-------|
| `project` | `ops_project_head` | Project-level permissions | Project management operations |
| `task` | `ops_task_head` | Task-level permissions | Task assignment and tracking |
| `business` | `d_scope_business` | Business unit permissions | Organizational access control |
| `hr` | `d_scope_hr` | HR organizational permissions | Human resources management |
| `location` | `d_scope_location` | Geographic location permissions | Location-based operations |
| `worksite` | `d_scope_worksite` | Physical worksite permissions | Site-specific access |
| `app:page` | `d_scope_app` | Frontend page access | Route protection |
| `app:component` | `d_scope_app` | UI component access | Component-level gating |
| `app:api` | `d_scope_app` | API endpoint permissions | Endpoint authorization |

---

## 🛡️ RBAC API Endpoints

### Employee Scopes Management
```http
POST /api/v1/rbac/employee-scopes
Authorization: Bearer <jwt-token>
Content-Type: application/json

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
      "scopeName": "ERP Implementation Phase 1",
      "permissions": [0, 1, 2]
    },
    {
      "scopeId": "project-uuid-2",
      "scopeName": "Solar Panel Installation - Q1 2025", 
      "permissions": [0]
    }
  ]
}
```

### Component Permission Validation
```http
POST /api/v1/rbac/component-permissions
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "employeeId": "employee-uuid",
  "scopeType": "app:component",
  "scopeName": "TaskBoard",
  "action": "view"
}
```

### Page Access Control
```http
POST /api/v1/rbac/page-permissions
Authorization: Bearer <jwt-token>

{
  "employeeId": "employee-uuid",
  "scopeType": "app:page",
  "scopeName": "/employees", 
  "action": "view"
}
```

### My Permissions (Convenience Endpoint)
```http
GET /api/v1/rbac/my-permissions/project?minPermission=0
Authorization: Bearer <jwt-token>
```

---

## 🌐 Complete API Reference

### 🔑 Authentication & User Management

#### Login & Authentication
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "james.miller@huronhome.ca",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "employee": {
    "id": "employee-uuid",
    "name": "James Miller",
    "email": "james.miller@huronhome.ca",
    "permissions": { /* bundled permissions */ }
  }
}
```

#### User Profile & Permissions
- **`GET /api/v1/auth/me`** - Current employee profile
- **`GET /api/v1/auth/permissions`** - Employee permissions summary
- **`GET /api/v1/auth/scopes/:scopeType`** - Scopes by type for current user
- **`GET /api/v1/auth/permissions/debug`** - Detailed permission debugging (admin only)

### 👥 Employee Management (`/api/v1/employee`)

#### Core Operations
- **`GET /api/v1/employee`** - List employees with RBAC filtering
- **`GET /api/v1/employee/:id`** - Get employee details
- **`POST /api/v1/employee`** - Create new employee
- **`PUT /api/v1/employee/:id`** - Update employee information
- **`DELETE /api/v1/employee/:id`** - Soft delete employee

**Features:**
- Automatic RBAC filtering based on user permissions
- PII masking for sensitive employee data
- Support for all employment types (full-time, contractor, co-op, intern)
- Skills, certifications, and education tracking

### 📊 Project Management (`/api/v1/project`)

#### Project Lifecycle Operations
- **`GET /api/v1/project`** - List projects with scope filtering
- **`GET /api/v1/project/:id`** - Get project with full details
- **`GET /api/v1/project/:id/tasks`** - Get all project tasks
- **`POST /api/v1/project`** - Create new project
- **`PUT /api/v1/project/:id`** - Update project
- **`DELETE /api/v1/project/:id`** - Soft delete project

**Features:**
- Multi-dimensional scoping (business, location, worksite)
- Budget tracking with currency support
- Timeline management (planned vs actual dates)
- Stakeholder management (managers, sponsors, approvers)
- Milestone and deliverable tracking
- Risk assessment and compliance requirements

### ✅ Task Management (`/api/v1/task`)

#### Task Operations with Head/Records Pattern
- **`GET /api/v1/task`** - List tasks (head + current records)
- **`GET /api/v1/task/:id`** - Get task with current record
- **`POST /api/v1/task`** - Create task (head + initial record)
- **`PUT /api/v1/task/:id/record`** - Update task (creates new record)
- **`DELETE /api/v1/task/:id`** - Soft delete task

**Features:**
- Temporal data tracking with complete audit trail
- Multi-person assignment (assignee, reviewers, approvers, collaborators)
- Task dependencies and relationships
- Status and stage workflow management
- Time tracking and work logging
- Story points and agile development support
- Quality gates and acceptance criteria

### 🏢 Scope Management

#### Business Units (`/api/v1/scope/business`)
- **Hierarchical Operations**: CRUD for 6-level business hierarchy
- **Cost Center Management**: Budget allocation and cost center tracking
- **Manager Assignment**: Employee assignment to business units

#### Geographic Locations (`/api/v1/scope/location`)  
- **Canadian Geography**: 8-level location hierarchy (Corp-Region → Address)
- **Timezone Support**: Time zone and currency management
- **Regulatory Context**: Tax jurisdiction and compliance tracking

#### HR Hierarchy (`/api/v1/scope/hr`)
- **Position Management**: 20-level HR hierarchy with salary bands
- **Approval Limits**: Position-based approval authority
- **Skills Tracking**: Job families and competency management

#### Worksite Management (`/api/v1/worksite`)
- **Physical Locations**: Site-specific operational management
- **Safety Protocols**: Access hours and emergency contacts
- **Geographic Integration**: PostGIS geospatial data support

### 👔 Client Management (`/api/v1/client`)

#### Client Relationship Operations
- **`GET /api/v1/client`** - List clients with filtering
- **`GET /api/v1/client/:id`** - Client details
- **`GET /api/v1/client/:id/hierarchy`** - Client organizational structure
- **`POST /api/v1/client`** - Create new client
- **`PUT /api/v1/client/:id`** - Update client
- **`DELETE /api/v1/client/:id`** - Soft delete client

**Features:**
- Self-referencing hierarchy for client organizations
- Contact management and communication tracking
- Service history and relationship management

### 🎛️ System Metadata (`/api/v1/meta`)

#### Configuration Management
- **`GET /api/v1/meta?category=project_status`** - Project status definitions
- **`GET /api/v1/meta?category=task_status`** - Task status workflow
- **`GET /api/v1/meta?category=task_stage`** - Kanban stage definitions  
- **`GET /api/v1/meta?category=biz_level`** - Business hierarchy levels
- **`GET /api/v1/meta?category=loc_level`** - Location hierarchy levels
- **`GET /api/v1/meta?category=hr_level`** - HR position levels

### 🔧 Entity Configuration API (`/api/v1/config`)

#### **NEW** - Frontend-Safe Configuration System
- **`GET /api/v1/config/entity/:entityType`** - Get entity page configuration
- **`GET /api/v1/config/entities`** - List all available entity types

**✅ Perfect Consistency Examples:**
```http
# Config API (camelCase entity names)
GET /api/v1/config/entity/projectStatus    # Frontend configuration
GET /api/v1/config/entity/taskStage        # UI table/form schema
GET /api/v1/config/entity/businessLevel    # Page layout config

# Data API (snake_case categories) 
GET /api/v1/meta?category=project_status   # Actual data records
GET /api/v1/meta?category=task_stage       # Data for tables
GET /api/v1/meta?category=biz_level        # Meta data content
```

**Key Features:**
- **Database Schema Protection**: Config API exposes only frontend-safe fields
- **Consistent Caching**: 5-minute cache duration with automatic refresh
- **Type-Safe**: Full TypeScript integration with Zod validation
- **Authentication**: Bearer token required for all config endpoints

**Categories Available:**
- `project_status`, `project_stage` - Project lifecycle management
- `task_status`, `task_stage` - Task workflow and Kanban stages
- `biz_level`, `loc_level`, `hr_level` - Organizational hierarchies

---

## 🏗️ API Implementation Patterns

### Standard Route Protection
```typescript
// All routes use JWT authentication + RBAC validation
fastify.get('/api/v1/projects', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const employeeId = (request as any).user?.sub;
  
  // 1. Check API endpoint permission
  const hasAPIAccess = await hasPermissionOnAPI(
    employeeId, 'app:api', '/api/v1/projects', 'view'
  );
  if (!hasAPIAccess) {
    return reply.status(403).send({ error: 'Insufficient API permissions' });
  }
  
  // 2. Get employee's accessible project IDs
  const allowedProjectIds = await getEmployeeScopeIds(employeeId, 'project');
  
  // 3. Filter results based on permissions
  const projects = await db
    .select()
    .from(projectTable)
    .where(inArray(projectTable.id, allowedProjectIds));
    
  return projects;
});
```

### Resource-Specific Operations
```typescript
// Update specific project with granular permission check
fastify.put('/api/v1/projects/:id', async (request, reply) => {
  const { id } = request.params;
  const employeeId = (request as any).user?.sub;
  
  // Check specific resource modification permission
  const hasModifyAccess = await hasPermissionOnScopeId(
    employeeId, 'project', id, 'modify'
  );
  if (!hasModifyAccess) {
    return reply.status(403).send({ 
      error: 'Insufficient permissions to modify this project' 
    });
  }
  
  // Proceed with update
  const updatedProject = await db
    .update(projectTable)
    .set(request.body)
    .where(eq(projectTable.id, id))
    .returning();
    
  return updatedProject[0];
});
```

### Database Integration with Drizzle ORM
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, inArray, and, desc } from 'drizzle-orm';

// Type-safe database operations
const employees = await db
  .select({
    id: employeeTable.id,
    name: employeeTable.name,
    email: employeeTable.email,
    department: businessTable.name,
  })
  .from(employeeTable)
  .leftJoin(businessTable, eq(employeeTable.businessId, businessTable.id))
  .where(and(
    eq(employeeTable.active, true),
    inArray(employeeTable.id, allowedEmployeeIds)
  ))
  .orderBy(desc(employeeTable.created));
```

---

## 🔧 Development & Configuration

### Environment Setup
```bash
# Install dependencies
pnpm install

# Environment variables
cp .env.example .env

# Required environment variables
DATABASE_URL="postgresql://app:app@localhost:5434/app"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
DEV_BYPASS_OIDC="true"  # Development only
```

### Development Commands
```bash
# Start development server with hot reload
pnpm dev

# Start with full environment
DATABASE_URL="postgresql://app:app@localhost:5434/app" \
REDIS_URL="redis://localhost:6379" \
JWT_SECRET="your-super-secret-jwt-key" \
DEV_BYPASS_OIDC=true \
pnpm dev

# Production build
pnpm build

# Type checking
pnpm typecheck
```

### API Testing
```bash
# Test all endpoints
./tools/test-api-endpoints.sh

# Debug RBAC permissions  
./tools/debug-rbac.sh

# Check API health
curl http://localhost:4000/api/health
```

---

## 📊 System Health & Monitoring

### Health Check Endpoints
- **`GET /healthz`** - Liveness probe (always returns 200)
- **`GET /readyz`** - Readiness probe (checks database connectivity)
- **`GET /api/health`** - Detailed health status with database ping

### OpenAPI Documentation
- **Interactive API Docs**: `http://localhost:4000/docs`
- **OpenAPI Spec**: `http://localhost:4000/docs/json`
- **Redoc Interface**: `http://localhost:4000/redoc`

---

## 🎯 Current Implementation Status

### ✅ Fully Implemented Features
- **Complete API Coverage**: All 11 modules with full CRUD operations
- **Advanced RBAC**: Multi-dimensional permissions with real-time checking
- **Database Integration**: 24 tables with comprehensive relationships
- **Authentication**: JWT with bundled permissions and secure token management
- **Type Safety**: Full TypeScript integration with Drizzle ORM
- **Error Handling**: Comprehensive error responses with logging
- **Performance**: Optimized queries with caching and connection pooling

### 🎯 Key Strengths
- **Production Ready**: Comprehensive error handling and monitoring
- **Scalable Architecture**: Designed for enterprise-scale operations
- **Security First**: Advanced RBAC with granular permission control
- **Type Safe**: Full TypeScript coverage from API to database
- **Well Documented**: Interactive OpenAPI documentation
- **Real-World Ready**: Handles complex Canadian business requirements

### 🚧 Future Enhancements
- **WebSocket Support**: Real-time updates and notifications
- **Advanced Caching**: Redis-based query result caching
- **Rate Limiting**: API throttling and abuse prevention
- **Audit Logging**: Comprehensive audit trail for all operations
- **API Versioning**: Support for multiple API versions

---

## 🛠️ Advanced Features

### Unified Permission System
- **Direct Table References**: Eliminates complex permission lookups
- **Cached Permissions**: Redis-based permission caching for performance
- **Granular Control**: Component, page, and API-level access control
- **Real-time Validation**: Dynamic permission checking during operations

### Enterprise Integration
- **Canadian Compliance**: Full support for Canadian business requirements
- **Multi-Currency**: Support for CAD and other currencies
- **Timezone Handling**: Full timezone support across geographic locations
- **Regulatory Tracking**: Professional licensing and certification management

This API represents a **production-ready, enterprise-grade backend** for Canadian project management operations, demonstrating sophisticated RBAC implementation, comprehensive business domain coverage, and real-world scalability considerations.