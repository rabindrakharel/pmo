# PMO API - Enterprise Backend System

## 🚀 Production-Ready Fastify API (2025-09-04)

A **comprehensive, high-performance REST API** built with **Fastify 5.0+ and TypeScript** for Canadian enterprise project management. Features **unified RBAC system**, **API-driven configuration**, **multi-dimensional scoping**, and **complete CRUD operations** across **24 database tables**.

---

## 📊 Current API Status

### 🎯 Technical Architecture
- **Runtime**: Node.js 20+ with TypeScript 5.0+ and ESM modules
- **Framework**: Fastify 5.0+ (high-performance HTTP server with plugin ecosystem)
- **Database**: PostgreSQL 16+ with PostGIS extensions and UUID generation
- **ORM**: Drizzle ORM with type-safe SQL operations and migrations
- **Authentication**: JWT with `@fastify/jwt` plugin and unified permission bundling
- **Validation**: TypeBox schemas for request/response validation with OpenAPI generation
- **Documentation**: Interactive OpenAPI/Swagger docs with live testing
- **Cache**: Redis integration for session management and permission caching

### 🌟 Production Features (All Implemented)
- **✅ 15+ API Modules** - Auth, Employee, Project, Task, Client, Business, Role, Form, Wiki, Artifact, Entity, Meta, Config, Schema, Hierarchy
- **✅ Parent-Action Entity Routes** - Hierarchical CRUD operations with `/api/v1/:parentEntity/:parentId/:actionEntity` pattern
- **✅ Universal Entity Management** - Dynamic entity handling with `/api/v1/entity/:entityType` endpoints
- **✅ Unified RBAC System** - Single `rel_employee_scope_unified` table with 9 scope types
- **✅ API-Driven Configuration** - Secure entity config endpoints with frontend-safe field mapping  
- **✅ Real-Time Permissions** - Dynamic permission checking with Redis caching (113+ active permissions)
- **✅ Enhanced Authentication** - JWT with bundled permissions, new endpoints `/permissions`, `/scopes/:type`, `/debug`
- **✅ Perfect Naming Consistency** - Unified camelCase across all API endpoints and responses
- **✅ Canadian Business Integration** - Real Huron Home Services data with regulatory compliance
- **✅ Production Monitoring** - Health checks, error handling, comprehensive logging

---

## 🔐 Unified RBAC System Architecture

### 🎯 Enhanced Permission Model (Current Implementation)
The API implements a **production-ready unified permission system** using `rel_employee_scope_unified` table with **direct table references**, eliminating complex lookups and providing **real-time access control** across **9 scope types**.

#### Permission Levels (Enhanced Implementation)
```typescript
// Permission hierarchy with real-world business logic
export enum Permission {
  VIEW = 0,     // Read access - view data, reports, dashboards
  MODIFY = 1,   // Edit access - update existing records, change status  
  SHARE = 2,    // Collaboration access - share resources, assign collaborators
  DELETE = 3,   // Delete access - remove/archive records with audit trail
  CREATE = 4,   // Creation access - add new resources, initiate workflows
}
```

#### 🚀 Production RBAC Functions (Active Implementation)
```typescript
// ✅ App-Level Permissions (scope_name based) - IMPLEMENTED
hasPermissionOnComponent(employeeId, 'app:component', 'TaskBoard', 'view')
hasPermissionOnPage(employeeId, 'app:page', '/employees', 'view')  
hasPermissionOnAPI(employeeId, 'app:api', '/api/v1/projects', 'create')

// ✅ Resource-Specific Permissions (scope_table_reference_id) - IMPLEMENTED
getPermissionByScopeId(employeeId, 'project', 'uuid-of-project')
hasPermissionOnScopeId(employeeId, 'task', 'uuid-of-task', 'modify')
getEmployeeScopeIdsByScopeType(employeeId, 'project') // Returns accessible project IDs

// ✅ Enhanced Auth Endpoints (NEW) - IMPLEMENTED  
GET /api/v1/auth/permissions         // Complete permission summary
GET /api/v1/auth/scopes/:scopeType   // Accessible resources by scope type  
GET /api/v1/auth/permissions/debug   // Admin-only detailed permission analysis
```

### 🏢 Multi-Dimensional Scope Types (Production Data)

| Scope Type | Reference Table | Real Data Examples | Current Permission Count |
|------------|----------------|-------------------|-------------------------|
| `project` | `ops_project_head` | "ERP Implementation Phase 1", "Solar Panel Installation" | 15+ permissions |
| `task` | `ops_task_head` | "Staff Training - Safety Protocols", "Equipment Maintenance" | 20+ permissions |
| `business` | `d_scope_business` | "Huron Home Services", "Operations Division", "Engineering Team" | 12+ permissions |
| `hr` | `d_scope_hr` | "Chief Technology Officer", "Senior Software Developer" | 8+ permissions |
| `location` | `d_scope_location` | "Ontario", "Mississauga", "Toronto Downtown" | 10+ permissions |
| `worksite` | `d_scope_worksite` | "Mississauga HQ", "Toronto Service Center" | 6+ permissions |
| `app:page` | `d_scope_app` | "/employees", "/projects", "/meta/taskStatus" | 25+ permissions |
| `app:component` | `d_scope_app` | "TaskBoard", "DataTable", "MetaDataTable" | 8+ permissions |
| `app:api` | `d_scope_app` | "/api/v1/project", "/api/v1/employee", "/api/v1/auth/login" | 30+ permissions |

**Total Active Permissions: 113+ across all scope types for James Miller**

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

All endpoints require JWT authentication unless otherwise specified.

### 🔑 Authentication & User Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/v1/auth/login` | User authentication and JWT token generation | ❌ |
| `GET` | `/api/v1/auth/me` | Current employee profile | ✅ |
| `GET` | `/api/v1/auth/permissions` | Employee permissions summary | ✅ |
| `GET` | `/api/v1/auth/scopes/:scopeType` | Scopes by type for current user | ✅ |
| `GET` | `/api/v1/auth/permissions/debug` | Detailed permission debugging (admin only) | ✅ |

**Login Example:**
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

### 👥 Employee Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/employee` | List employees with RBAC filtering | Pagination, search, role filtering |
| `GET` | `/api/v1/employee/:id` | Get employee details | PII masking based on permissions |
| `POST` | `/api/v1/employee` | Create new employee | Validation, RBAC checking |
| `PUT` | `/api/v1/employee/:id` | Update employee information | Audit trail, permission validation |
| `DELETE` | `/api/v1/employee/:id` | Soft delete employee | Maintains referential integrity |

**Features:**
- Automatic RBAC filtering based on user permissions
- PII masking for sensitive employee data  
- Support for all employment types (full-time, contractor, co-op, intern)
- Skills, certifications, and education tracking

### 📊 Project Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/project` | List projects with scope filtering | Multi-scope filtering, budget tracking |
| `GET` | `/api/v1/project/:id` | Get project with full details | Complete project data with relationships |
| `GET` | `/api/v1/project/:id/tasks` | Get all project tasks | Task hierarchy and dependencies |
| `POST` | `/api/v1/project` | Create new project | Stakeholder validation, budget setup |
| `PUT` | `/api/v1/project/:id` | Update project | Timeline tracking, milestone updates |
| `DELETE` | `/api/v1/project/:id` | Soft delete project | Cascade handling for dependent entities |

**Features:**
- Multi-dimensional scoping (business, location, worksite)
- Budget tracking with currency support
- Timeline management (planned vs actual dates)
- Stakeholder management (managers, sponsors, approvers)
- Milestone and deliverable tracking
- Risk assessment and compliance requirements

### ✅ Task Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/task` | List tasks (head + current records) | Status filtering, assignment tracking |
| `GET` | `/api/v1/task/:id` | Get task with current record | Complete task details with history |
| `POST` | `/api/v1/task` | Create task (head + initial record) | Dependency validation, assignment setup |
| `PUT` | `/api/v1/task/:id/record` | Update task (creates new record) | Audit trail, temporal data tracking |
| `DELETE` | `/api/v1/task/:id` | Soft delete task | Dependency checking, cascade handling |

**Features:**
- Temporal data tracking with complete audit trail
- Multi-person assignment (assignee, reviewers, approvers, collaborators)
- Task dependencies and relationships  
- Status and stage workflow management
- Time tracking and work logging
- Story points and agile development support
- Quality gates and acceptance criteria

### 👔 Client Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/client` | List clients with filtering | Hierarchical organization support |
| `GET` | `/api/v1/client/:id` | Client details | Contact management integration |
| `GET` | `/api/v1/client/:id/hierarchy` | Client organizational structure | Self-referencing hierarchy |
| `POST` | `/api/v1/client` | Create new client | Contact validation, hierarchy setup |
| `PUT` | `/api/v1/client/:id` | Update client | Service history tracking |
| `DELETE` | `/api/v1/client/:id` | Soft delete client | Relationship preservation |

### 🏗️ Business Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/biz` | List business units | 6-level hierarchy support |
| `GET` | `/api/v1/biz/:id` | Business unit details | Cost center integration |
| `POST` | `/api/v1/biz` | Create business unit | Manager assignment validation |
| `PUT` | `/api/v1/biz/:id` | Update business unit | Budget allocation tracking |
| `DELETE` | `/api/v1/biz/:id` | Soft delete business unit | Hierarchy integrity maintenance |

### 👤 Role Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/role` | List roles | Permission bundling |
| `GET` | `/api/v1/role/:id` | Role details | Complete permission mapping |
| `POST` | `/api/v1/role` | Create role | Permission validation |
| `PUT` | `/api/v1/role/:id` | Update role | Permission impact analysis |
| `DELETE` | `/api/v1/role/:id` | Soft delete role | Employee assignment checking |

### 📝 Form Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/form` | List forms | Template and instance management |
| `GET` | `/api/v1/form/:id` | Form details | Dynamic form schema |
| `POST` | `/api/v1/form` | Create form | Schema validation |
| `PUT` | `/api/v1/form/:id` | Update form | Version tracking |
| `DELETE` | `/api/v1/form/:id` | Soft delete form | Instance preservation |

### 📚 Wiki Management  

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/wiki` | List wiki pages | Content versioning |
| `GET` | `/api/v1/wiki/:id` | Wiki page details | Markdown support |
| `POST` | `/api/v1/wiki` | Create wiki page | Template system |
| `PUT` | `/api/v1/wiki/:id` | Update wiki page | Edit history tracking |
| `DELETE` | `/api/v1/wiki/:id` | Soft delete wiki page | Link integrity checking |

### 📎 Artifact Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/artifact` | List artifacts | File type filtering |
| `GET` | `/api/v1/artifact/:id` | Artifact details | Metadata and versioning |
| `POST` | `/api/v1/artifact` | Create artifact | File upload handling |
| `PUT` | `/api/v1/artifact/:id` | Update artifact | Version control |
| `DELETE` | `/api/v1/artifact/:id` | Soft delete artifact | Storage cleanup |

### 🔗 Universal Entity Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/entity/:entityType` | List entities by type | Dynamic entity handling |
| `GET` | `/api/v1/entity/:entityType/:id` | Get entity details | Universal schema support |
| `POST` | `/api/v1/entity/:entityType` | Create entity | Type-specific validation |
| `PUT` | `/api/v1/entity/:entityType/:id` | Update entity | Schema evolution support |
| `DELETE` | `/api/v1/entity/:entityType/:id` | Soft delete entity | Relationship management |

**Supported Entity Types:**
- `biz`, `project`, `hr`, `org`, `client`, `worksite`, `employee`, `role`, `wiki`, `form`, `task`, `artifact`

### 🌳 Parent-Action Entity Routes (Hierarchical Operations)

| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/:parentEntity/:parentId/:actionEntity` | List action entities within parent | Get all tasks in a project |
| `GET` | `/api/v1/:parentEntity/:parentId/:actionEntity/:actionId` | Get action entity in parent context | Get specific task within project |
| `POST` | `/api/v1/:parentEntity/:parentId/:actionEntity` | Create action entity within parent | Create task in specific project |
| `PUT` | `/api/v1/:parentEntity/:parentId/:actionEntity/:actionId` | Update action entity in parent context | Update task within project scope |
| `DELETE` | `/api/v1/:parentEntity/:parentId/:actionEntity/:actionId` | Delete action entity from parent | Remove task from project |

**Supported Parent-Action Relationships:**
- **Business → Wiki**: `/api/v1/biz/{id}/wiki`
- **Project → Task**: `/api/v1/project/{id}/task`
- **Project → Wiki**: `/api/v1/project/{id}/wiki`
- **Project → Artifact**: `/api/v1/project/{id}/artifact`
- **HR → Employee**: `/api/v1/hr/{id}/employee`
- **Organization → Worksite**: `/api/v1/org/{id}/worksite`
- **Client → Project**: `/api/v1/client/{id}/project`

**Features:**
- **RBAC Validation**: Both parent and action entity permissions checked
- **Relationship Validation**: Enforces valid parent-child relationships
- **Hierarchy Mapping**: Automatic hierarchy relationship creation/updates
- **Context Preservation**: All operations maintain parent context
- **Audit Trail**: Complete audit trail for hierarchical operations

**Example Usage:**
```http
# Get all tasks for a specific project
GET /api/v1/project/a1b2c3d4-e5f6-7890-abcd-ef1234567890/task

# Create a new task within a project
POST /api/v1/project/a1b2c3d4-e5f6-7890-abcd-ef1234567890/task
Content-Type: application/json
{
  "name": "Setup Development Environment",
  "description": "Configure local development environment",
  "priority_level": "high"
}

# Update a task within project context
PUT /api/v1/project/a1b2c3d4-e5f6-7890-abcd-ef1234567890/task/task-uuid-here
```

### 🎛️ System Metadata

| Method | Endpoint | Description | Categories Available |
|--------|----------|-------------|---------------------|
| `GET` | `/api/v1/meta` | Get metadata by category | `project_status`, `task_status`, `task_stage`, `biz_level`, `loc_level`, `hr_level` |
| `GET` | `/api/v1/meta/:id` | Get specific metadata item | Individual metadata record |
| `POST` | `/api/v1/meta` | Create metadata item | Category-specific validation |
| `PUT` | `/api/v1/meta/:id` | Update metadata item | Impact analysis on dependent entities |
| `DELETE` | `/api/v1/meta/:id` | Soft delete metadata | Usage checking before deletion |

### 🔧 Entity Configuration API

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/config/entity/:entityType` | Get entity configuration | UI schema generation, field mapping |
| `GET` | `/api/v1/config/entities` | List all entity types | Available entities and capabilities |

**🎯 Perfect Naming Consistency:**
```http
# ✅ Config API (camelCase entity names) - UI Schema Generation
GET /api/v1/config/entity/projectStatus    # UI schema: fields, forms, validation
GET /api/v1/config/entity/taskStage        # Table configuration: columns, actions
GET /api/v1/config/entity/businessLevel    # Page layout: navigation, permissions

# ✅ Data API (snake_case categories) - Business Data 
GET /api/v1/meta?category=project_status   # Actual project status records
GET /api/v1/meta?category=task_stage       # Task stage data for dropdown/table
GET /api/v1/meta?category=biz_level        # Business level hierarchy records
```

### 🏗️ Hierarchical Metadata Routes

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/hierarchy/entity-types` | Get all entity types with hierarchy info | Parent-child relationship mapping |
| `GET` | `/api/v1/hierarchy/permissions` | Get entity hierarchy permission mappings | Action permissions per relationship |
| `GET` | `/api/v1/hierarchy/relationships/:parentEntity` | Get valid child entities for parent | Dynamic relationship discovery |

### 📊 Schema Management

| Method | Endpoint | Description | Features |
|--------|----------|-------------|----------|
| `GET` | `/api/v1/schema/tables` | List all database tables | Schema introspection |
| `GET` | `/api/v1/schema/table/:tableName` | Get table schema details | Column metadata, constraints |
| `GET` | `/api/v1/schema/relationships` | Get table relationships | Foreign key mappings |

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