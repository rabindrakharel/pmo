# PMO Enterprise Task Management Platform 🚀

> **Navigation Hub** - This README serves as your central guide to all project documentation and resources.

A comprehensive, enterprise-grade Project Management Office (PMO) platform built with modern web technologies. Features role-based task management, workflow automation, and comprehensive project oversight capabilities.

## 📋 Use this Readme for Quick Navigation Purpose only
## This readme is index of several other readme, update this readme only when it's required to be updated.

### 🏃‍♂️ Getting Started
- **[Tech Stack Overview](#-tech-stack)** - Technologies used
- **[Quick Start Guide](#-quick-start)** - Start the platform in 3 commands
- **[Platform Management](#-platform-management)** - Server control and monitoring

### 📚 Documentation Index

| Document | Purpose | Key Topics |
|----------|---------|------------|
| **[⚙️ Tech Stack](./TECHSTACK.md)** | Complete technology overview | Frontend, backend, infrastructure, performance |
| **[🗄️ Database Schema](./db/README.md)** | Data model and database guide | Tables, relationships, RBAC, installation |
| **[🔧 Management Tools](./tools/README.md)** | Platform operation tools | Start/stop servers, database management, logs |
| **[🌐 API Reference](./apps/api/README.md)** | Backend API documentation | RBAC endpoints, authentication, patterns |
| **[💻 Frontend Guide](./apps/web/README.md)** | Web app development guide | RBAC components, data tables, permission hooks |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and pnpm 8+
- Docker and Docker Compose

### Start Everything (Recommended)
```bash
# 1. Clone and install
git clone <repository-url> && cd pmo && pnpm install

# 2. Start entire platform
./tools/start-all.sh

# 3. Access applications
# Web App: http://localhost:5173
# API Docs: http://localhost:4000/docs
```

### Alternative: Manual Steps
```bash
make up              # Start infrastructure
make seed            # Initialize database  
./tools/start-api.sh # Start API server
./tools/start-web.sh # Start web app
```

---

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Fastify (high-performance)
- **Database**: PostgreSQL 15+ with PostGIS
- **ORM**: Drizzle (type-safe)
- **Cache**: Redis
- **Auth**: JWT with RBAC

### Frontend  
- **Framework**: React 18 with TypeScript
- **Build**: Vite (fast development and building)
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod validation
- **DnD**: DnD Kit for drag-and-drop functionality

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Orchestration**: Kubernetes + Helm
- **Storage**: MinIO/S3 compatible

**[📖 Complete Tech Stack Details →](./TECHSTACK.md)**

---

## 🛡️ Enterprise RBAC System

The PMO platform features a comprehensive Role-Based Access Control system with sophisticated UI component gating and permission-based data tables.

### 🎯 Key Features

✅ **Advanced Data Management** - Comprehensive data tables with sticky headers, advanced filtering, and pagination  
✅ **Professional UI Components** - Modern gradient design with sophisticated component library  
✅ **RBAC Integration** - Permission-gated components with role-based access control  
✅ **Multi-View Support** - DataTable, GridView, and TreeView components for different data presentation needs  
✅ **Responsive Design** - Mobile-first design with elegant responsive layouts  

### 🔐 RBAC Integration Points

| Level | Integration | API Endpoints | Usage |
|-------|-------------|---------------|-------|
| **API** | Route protection | `/api/v1/auth/scopes/:scopeType` | Get accessible resources with permissions |
| **Page** | Route guards | `/api/v1/rbac/page-permission` | Validate page access |
| **Component** | UI gating | `/api/v1/rbac/component-permission` | Control component visibility |
| **Data Table** | Action buttons | `/api/v1/rbac/employee-scopes` | Show/hide row-level actions |

### 📊 Permission-Based Data Tables

```tsx
// Automatic permission-gated action buttons
<RBACDataTable
  scopeType="project"
  data={projects}
  getRowId={(row) => row.id}
  enabledActions={['view', 'edit', 'share', 'delete']}
/>
```

Each row displays only the actions the current employee has permission to perform on that specific resource.

**[📖 Complete RBAC Documentation →](./apps/api/README.md#-rbac-system-architecture)**

---

## 🏗️ Architecture Overview

> **Latest Update (2025-09-01)**: **🎯 Complete End-to-End Consistency Achieved** - All critical naming inconsistencies resolved. Perfect camelCase consistency across sidebar, routes, components, and API calls. Fixed base URL mismatches, auth token inconsistencies, and URL construction issues. MetaDataTable now properly integrates with both Config API (camelCase) and Data API (snake_case) with full authentication flow.

### System Design Principles
- **Domain-First**: UI mirrors database domains
- **RBAC + Scope-Aware**: Role-based access control
- **Policy-Gated Routes**: Unified permission enforcement
- **Head/Records Pattern**: Temporal data for audit trails
- **API-First Configuration**: Entity configs exposed via secure API
- **Perfect Naming Consistency**: Unified camelCase across all layers

### Data Domains
1. **META** - Reference vocabulary and configuration with 7 entity types
   - `projectStatus` - Project workflow states
   - `projectStage` - Project lifecycle stages
   - `taskStatus` - Task workflow states  
   - `taskStage` - Task workflow stages
   - `businessLevel` - Organizational hierarchy levels
   - `locationLevel` - Geographic hierarchy levels
   - `hrLevel` - HR hierarchy with salary bands
2. **LOC** - Hierarchical location management  
3. **WORKSITE** - Physical service sites with geospatial data
4. **BIZ** - Business organization hierarchy
5. **HR** - Human resources and departments
6. **EMP/ROLE** - Employee management with role assignments
7. **CLIENT** - Client relationship management
8. **PROJECT** - Project lifecycle tracking
9. **TASK** - Task management with workflow stages
10. **FORMS** - Dynamic form builder

**[📖 Complete Architecture Guide →](./architecture.md)**

---

## 🗄️ Database Schema

### Quick Access
- **DDL Files**: 13 dependency-optimized DDL files (00-13) in [`db/`](./db/) directory
- **Installation**: `./tools/db-import.sh` - Reset database to default state
- **Management**: Use `tools/db-*.sh` scripts for database operations

### Key Features
- **13 DDL Files** organized in dependency-optimized order (00-13)
- **24 Tables** across Meta, Scope, Domain, Operational, and Permission categories
- **Head/Records Pattern** for temporal data and audit trails
- **Unified RBAC** with `rel_employee_scope_unified` permissions
- **Canadian Business Context** with realistic organizational structure
- **PostGIS Integration** for geospatial queries

### Database Tools
```bash
./tools/db-import.sh      # Import schema and data (primary tool)
./tools/validate-schema.sh # Validate database integrity
```

**[📖 Complete Database Guide →](./db/README.md)**

---

## 🔧 Platform Management

### Essential Tools
| Tool | Purpose | Usage |
|------|---------|-------|
| `start-all.sh` | Start complete platform | `./tools/start-all.sh` |
| `stop-all.sh` | Stop all services | `./tools/stop-all.sh` |
| `status.sh` | Check service status | `./tools/status.sh` |
| `db-import.sh` | Reset database | `./tools/db-import.sh` |

### Individual Services
```bash
# API Server
./tools/start-api.sh      # Start backend
./tools/logs-api.sh       # View API logs
./tools/restart-api.sh    # Restart backend

# Web Application  
./tools/start-web.sh      # Start frontend
./tools/logs-web.sh       # View web logs
./tools/restart-web.sh    # Restart frontend

# API Testing & Debugging
./tools/test-api-endpoints.sh    # Test all endpoints
./tools/debug-rbac.sh           # Debug RBAC permissions
```

### Service URLs
- **Web App**: http://localhost:5173
- **API Docs**: http://localhost:4000/docs  
- **API Health**: http://localhost:4000/api/health
- **MinIO Console**: http://localhost:9001 (minio/minio123)
- **MailHog**: http://localhost:8025

**[📖 Complete Tools Guide →](./tools/README.md)**

---

## 🌐 API Reference

### API Status & Endpoints
- **✅ Fully Implemented**: All 11 API modules working with database integration
- **✅ Enhanced Authentication**: JWT login with bundled permissions + new auth endpoints (`/permissions`, `/scopes/:scopeType`, `/debug`)
- **✅ Advanced RBAC**: All endpoints using `rel_employee_scope_unified` with direct table reference resolution  
- **✅ Complete CRUD**: Create, Read, Update, Delete operations for all entities with scope-aware filtering
- **✅ Permission Debugging**: Admin-only endpoint for detailed permission analysis and troubleshooting
- **✅ Entity Configuration API**: Secure API endpoints for frontend configuration with database schema protection
- **🔗 Base URL**: `http://localhost:4000/api/v1/`

### Key Features
- **OpenAPI Documentation** at `/docs`
- **JWT Authentication** using `@fastify/jwt` plugin
- **Lightweight RBAC** with on-demand permission checking
- **Database Integration** with James Miller's 113+ permissions active
- **TypeScript Schemas** with comprehensive validation
- **Production Ready** authentication flow (DEV_BYPASS_OIDC=false)
- **API-First Configuration**: Entity configurations exposed via API with frontend-safe transformation

### Common Endpoints
```
GET    /api/v1/employee                    # List employees
GET    /api/v1/project                # List projects  
GET    /api/v1/task                   # List tasks
GET    /api/v1/client                 # List clients
GET    /api/v1/scope/hr               # List HR units
GET    /api/v1/scope/business         # List business units
GET    /api/v1/scope/location         # List locations
GET    /api/v1/worksite               # List worksites
GET    /api/v1/meta                   # System metadata
GET    /api/v1/config/entities        # Available entity types
GET    /api/v1/config/entity/:type    # Entity configuration (frontend-safe)
GET    /api/v1/config/schema/:type    # Full schema (backend-only)
```

#### Forms Endpoints
```
GET    /api/v1/form                   # List forms (limit/offset)
GET    /api/v1/form/:id               # Read a form definition (with schema)
GET    /api/v1/form/:id/records       # List form submissions
POST   /api/v1/form                   # Create a new form (schema-driven)
PUT    /api/v1/form/:id               # Update an existing form
DELETE /api/v1/form/:id               # Soft-delete a form (no submissions)
```

**[📖 Complete API Documentation →](./apps/api/README.md)**

---

## 💻 Frontend Reference

### Web Application Structure
```
apps/web/src/
├── components/          # React components
│   ├── ui/             # Advanced UI components (DataTable, GridView, TreeView)
│   ├── auth/           # Authentication components (LoginForm)
│   ├── layout/         # Layout with expandable Meta dropdown
│   └── MetaDataTable   # API-driven configuration table component
├── pages/              # Route pages
│   ├── meta/           # Meta data management pages
│   │   ├── project-status.tsx     # Project status management
│   │   ├── project-stage.tsx      # Project stage management  
│   │   ├── task-status.tsx        # Task status management
│   │   ├── task-stage.tsx         # Task stage management
│   │   ├── business-level.tsx     # Business hierarchy levels
│   │   ├── location-level.tsx     # Location hierarchy levels
│   │   └── hr-level.tsx          # HR hierarchy levels
│   ├── MetaPage        # System configuration management
│   ├── BusinessPage    # Business units management
│   ├── LocationPage    # Geographic hierarchy management
│   ├── ProjectPage     # Project lifecycle management
│   ├── TaskPage        # Task management (implemented, not routed)
│   ├── EmployeePage    # Employee directory (implemented, not routed)
│   ├── DashboardPage   # Analytics dashboard (implemented, not routed)
│   ├── ProfilePage     # User profile management
│   ├── SettingsPage    # Application preferences
│   ├── SecurityPage    # Security management
│   └── BillingPage     # Payment management
├── services/           # API service layer
│   └── configService   # Entity configuration API client with caching
├── types/              # TypeScript type definitions
│   └── config         # Frontend-safe configuration types
├── contexts/           # React contexts (AuthContext for authentication)
└── App.tsx            # Main application routing
```

### Key Features
- **Modern React 19 + TypeScript** architecture
- **API-Driven Configuration**: Entity configs loaded from secure backend API
- **Complete Naming Consistency**: Unified camelCase naming across all layers
- **Advanced Data Tables** with sticky headers, filtering, sorting, and pagination
- **Professional UI Components** with gradient-based design system
- **JWT Authentication** with secure token management
- **Responsive Design** with mobile-first approach
- **Multi-View Components** - DataTable, GridView, TreeView for versatile data presentation
- **Configuration Caching**: 5-minute cache for entity configurations with automatic refresh

### 🎯 Perfect Naming Consistency Flow

**Example 1: Task Status - ACTUAL vs EXPECTED**
```
❌ BROKEN - What Currently Happens:
1. User clicks sidebar: "taskStatus" 
   ↓
2. Browser navigates: "/meta/taskStatus" ❌ 404 Error!
   ↓
3. Route not found - shows error page

✅ WORKING - What Should Happen:
1. User clicks sidebar: "taskStatus"
   ↓  
2. Browser navigates: "/meta/task-status" (kebab-case route)
   ↓
3. React renders: TaskStatusPage.tsx
   ↓
4. Component calls: GET /api/v1/config/entity/taskStatus (🔧 Config API)
   ↓
5. Gets UI schema: field definitions, forms, table columns
   ↓
6. Component renders table using schema  
   ↓
7. Table calls: GET /api/v1/meta?category=task_status (📊 Data API)
   ↓
8. Gets actual task status records to display
```

**Example 2: Project Management Complete Flow**
```
1. Click: "Project" → 2. Navigate: "/project"
→ 3. Component loads: project.tsx
→ 4. Schema fetch: GET /api/v1/config/entity/project (🔧 Config)
→ 5. Data fetch: GET /api/v1/project (📊 Data)
→ 6. Component renders project management page
```

**Example 3: Two-API Architecture in Action**  
```
Config API (🔧): GET /api/v1/config/entity/employee
Returns: { fields: {...}, forms: {...}, validation: {...} }

Data API (📊): GET /api/v1/employee  
Returns: [{ id: 1, name: "John", email: "..." }, ...]

Result: Dynamic UI + Live Data = Complete Management Page
```

### 📊 Complete Entity Consistency Tables

> **Key Distinction**: Each entity has **TWO types of endpoints**:
> - **🔧 Configuration Endpoints**: Metadata for UI rendering (field definitions, forms, validation)
> - **📊 Data Endpoints**: Actual business data (CRUD operations on records)

#### **Meta Data Entities** ⚠️ **ACTUAL IMPLEMENTATION**
| **Entity** | **Sidebar** | **Route** | **Page Component** | **📊 Data API** | **🔧 Config API** | **Status** |
|------------|-------------|-----------|-------------------|-----------------|-------------------|-----------|
| Project Status | `projectStatus` | `/meta/projectStatus` | `ProjectStatusPage.tsx` | `/api/v1/meta?category=project_status` | `/api/v1/config/entity/projectStatus` | ✅ **Perfect** |
| Project Stage | `projectStage` | `/meta/projectStage` | `ProjectStagePage.tsx` | `/api/v1/meta?category=project_stage` | `/api/v1/config/entity/projectStage` | ✅ **Perfect** |
| Task Status | `taskStatus` | `/meta/taskStatus` | `TaskStatusPage.tsx` | `/api/v1/meta?category=task_status` | `/api/v1/config/entity/taskStatus` | ✅ **Perfect** |
| Task Stage | `taskStage` | `/meta/taskStage` | `TaskStagePage.tsx` | `/api/v1/meta?category=task_stage` | `/api/v1/config/entity/taskStage` | ✅ **Perfect** |
| Business Level | `businessLevel` | `/meta/businessLevel` | `BusinessLevelPage.tsx` | `/api/v1/meta?category=biz_level` | `/api/v1/config/entity/businessLevel` | ✅ **Perfect** |
| Location Level | `locationLevel` | `/meta/locationLevel` | `LocationLevelPage.tsx` | `/api/v1/meta?category=loc_level` | `/api/v1/config/entity/locationLevel` | ✅ **Perfect** |
| HR Level | `hrLevel` | `/meta/hrLevel` | `HrLevelPage.tsx` | `/api/v1/meta?category=hr_level` | `/api/v1/config/entity/hrLevel` | ✅ **Perfect** |

### ✅ **COMPLETE CONSISTENCY ACHIEVED** (Updated 2025-09-01)

#### **🎯 Perfect End-to-End Flow:**

All critical inconsistencies have been **RESOLVED**. The platform now features complete naming consistency across all layers:

**✅ Navigation Flow:**
1. **Sidebar Click**: User clicks `projectStatus` (camelCase)
2. **Route Navigation**: Routes to `/meta/projectStatus` (camelCase)  
3. **Component Loading**: Loads `ProjectStatusPage` with `entityType="projectStatus"`
4. **Config API**: `GET /api/v1/config/entity/projectStatus` (camelCase)
5. **Data API**: `GET /api/v1/meta?category=project_status` (snake_case)

**✅ Critical Infrastructure Fixes Applied:**
- **✅ Base URL Consistency**: All services unified to `http://localhost:4000`
- **✅ Auth Token Consistency**: All services use `auth_token` localStorage key
- **✅ URL Construction**: Proper HTTP method stripping and full URL building  
- **✅ File Naming**: All config files converted to camelCase (`taskStage.ts`)
- **✅ Import Paths**: Corrected TypeScript imports without `.js` extensions
- **✅ Route Mapping**: App.tsx routes updated to match sidebar camelCase format

**✅ Data API Integration:**
- MetaDataTable now properly constructs URLs with base URL
- HTTP method prefixes stripped from config endpoints  
- Consistent Bearer token authentication across all API calls

#### **Core Business Entities** ✅ **VALIDATED**
| **Entity** | **Sidebar** | **Route** | **Page Component** | **📊 Data API** | **🔧 Config API** | **Config File** |
|------------|-------------|-----------|-------------------|-----------------|-------------------|-----------------|
| Project | `Project` | `/project` | `project.tsx` | `/api/v1/project` | `/api/v1/config/entity/project` | `project.ts` |
| Task | `Task` | `/task` | `task.tsx` | `/api/v1/task` | `/api/v1/config/entity/task` | `task.ts` |
| Employee | `Employee` | `/employee` | `employee.tsx` | `/api/v1/employee` | `/api/v1/config/entity/employee` | `employee.ts` |
| Client | `Client` | `/client` | `client.tsx` | `/api/v1/client` | `/api/v1/config/entity/client` | `client.ts` |

#### **Scope & Hierarchy Entities**
| **Entity** | **Sidebar** | **Route** | **Page Component** | **📊 Data API** | **🔧 Config API** | **Config File** |
|------------|-------------|-----------|-------------------|-----------------|-------------------|-----------------|
| Business | `Business` | `/business` | `business.tsx` | `/api/v1/scope/business` | `/api/v1/config/entity/business` | `business.ts` |
| Location | `Location` | `/location` | `location.tsx` | `/api/v1/scope/location` | `/api/v1/config/entity/location` | `location.ts` |
| HR | `HR` | `/hr` | `hr.tsx` | `/api/v1/scope/hr` | `/api/v1/config/entity/hr` | `hr.ts` |
| Worksite | `Worksite` | `/worksite` | `worksite.tsx` | `/api/v1/worksite` | `/api/v1/config/entity/worksite` | `worksite.ts` |

#### **System & Admin Entities**
| **Entity** | **Sidebar** | **Route** | **Page Component** | **📊 Data API** | **🔧 Config API** | **Config File** |
|------------|-------------|-----------|-------------------|-----------------|-------------------|-----------------|
| Roles | `Roles` | `/roles` | `roles.tsx` | `/api/v1/role` | `/api/v1/config/entity/roles` | `roles.ts` |
| Forms | `Forms` | `/forms` | `forms.tsx` | `/api/v1/form` | `/api/v1/config/entity/forms` | `forms.ts` |
| Profile | `Profile` | `/profile` | `profile.tsx` | `/api/v1/auth/me` | `/api/v1/config/entity/profile` | `profile.ts` |
| Settings | `Settings` | `/settings` | `settings.tsx` | `/api/v1/settings` | `/api/v1/config/entity/settings` | `settings.ts` |

### 🔄 **Two-Endpoint Architecture Explained**

#### **📊 Data Endpoints** (Business Data Access)
- **Purpose**: CRUD operations on actual business records
- **Returns**: Raw database records (projects, tasks, employees, etc.)
- **RBAC**: Filtered by user permissions and scope access
- **Examples**: 
  - `GET /api/v1/project` → List of actual project records
  - `POST /api/v1/task` → Create a new task record
  - `GET /api/v1/meta?category=projectStatus` → List of project status records
  - `PUT /api/v1/employee/123` → Update employee record

#### **🔧 Configuration Endpoints** (Frontend Schema)
- **Purpose**: Pull UI configuration schema for each page
- **Returns**: Field definitions, forms, validation rules, table columns, UI behavior
- **Security**: DDL fields stripped, only frontend-safe field mappings
- **Usage**: Component calls config API to know how to render forms/tables
- **Examples**:
  - `GET /api/v1/config/entity/projectStatus` → Schema for project status page UI
  - `GET /api/v1/config/entity/task` → Schema for task management page UI
  - `GET /api/v1/config/entity/employee` → Schema for employee page UI

#### **🏗️ How They Work Together**
1. **Component loads** → Calls **🔧 Config API** to get UI schema
2. **Component renders** → Uses schema to build forms/tables/validation  
3. **User interacts** → Calls **📊 Data API** for CRUD operations
4. **Data updates** → Component re-renders using same config schema

**🔒 Security Benefits**
- **Database Schema Protection**: DDL field names never exposed to frontend
- **API Field Mapping**: Only safe `apiField` names sent to client
- **Configuration Caching**: Reduces API calls while maintaining security
- **Type Safety**: Complete TypeScript coverage prevents runtime errors

### Development Personas
- **Admin** - Full system access
- **Owner** - Project management
- **Collaborator** - Task execution  
- **Reviewer** - QA supervision
- **Viewer** - Read-only access
- **Auditor** - Audit trail access

**[📖 Complete Frontend Guide →](./apps/web/README.md)**

## 📝 Forms Module (UI + API)

- List View: Reuses `DataTable` to show `Form ID`, `Form Name`, `Creator`, `Created`, `Updated`.
- Routes:
  - `/forms` → Forms list
  - `/forms/new` → Create Form (builder)
  - `/forms/:id` → Form View (read-only schema preview)
  - `/forms/:id/edit` → Edit Form (builder, preloaded)
- Builder: Add fields (text, number, select, datetime), reorder, edit label/name/required, select options; optional Task attachment by Task ID.
- API Client: `formApi` in `apps/web/src/lib/api.ts` with `list`, `get`, `getRecords`, `create`, `update`, `delete`. Pagination maps `{page,pageSize}` → `{limit,offset}`.
- Backend: `apps/api/src/modules/form/routes.ts` with list/read/create/update/delete and records; supports optional scoping IDs (`projectId`, `taskId`, `locationId`, `businessId`, `hrId`, `worksiteId`).

This follows the existing sidebar → route → page pattern (see Projects) and keeps the DataTable component unchanged, using its built-in action props instead.

---

## 🔑 Role-Based Access Control

### User Roles
| Role | Capabilities | Scope Access |
|------|-------------|--------------|
| **System Admin** | Full platform configuration | All scopes |
| **Project Owner** | Project and task management | Assigned projects |
| **Field Worker** | Task execution and logging | Assigned tasks |
| **QA Supervisor** | Review and approval | Review scope |
| **Executive** | Dashboards and reporting | Read-only |
| **Auditor** | Audit trails and compliance | Audit scope |

### Unified RBAC Permission System
- **Enhanced Permission Model**: All permissions in `rel_employee_scope_unified` with direct table references
- **Granular Scope Types**: 8+ scope types including app:page, app:api, app:component for fine-grained control  
- **Permission Levels**: [0:view, 1:modify, 2:share, 3:delete, 4:create] enforced across all APIs
- **New Auth Endpoints**: `/permissions`, `/scopes/:scopeType`, `/permissions/debug` with comprehensive debugging
- **Direct Table Integration**: Scope references link directly to business tables without intermediate lookups
- **JWT + Permission Bundling**: Login response includes complete permission structure for frontend optimization
- **Scope-Aware Filtering**: Dynamic query filtering based on user's effective permissions per scope
- **Production-Ready RBAC**: Full permission checking with graceful error handling and admin overrides

---

## 🎯 Features Overview

### ✅ Implemented
- **Multi-domain Data Model** with Canadian business context (13 DDL files, 24 tables, 5 categories)
- **Complete Database Schema** - All tables implemented with proper relationships and constraints
- **Full API Suite** - 11 modules with comprehensive CRUD operations and RBAC
- **Enhanced JWT Authentication** - Login with bundled permissions, token validation, user ID extraction
- **Unified RBAC System** - Complete permission system using `rel_employee_scope_unified` table
- **Database Integration** - All API endpoints connecting to PostgreSQL with curated sample data
- **React + Vite Frontend** - Modern web app with shadcn/ui, drag-and-drop, and responsive design
- **API-First Configuration System** - Secure entity config API with frontend-safe transformation
- **Meta Data Management** - 7 entity types with expandable sidebar dropdown navigation
- **Perfect Naming Consistency** - Unified camelCase naming across all layers (API, UI, files, routes)
- **Configuration Security** - Database schema protection with API field mapping
- **Dynamic Component Loading** - API-driven configuration with 5-minute caching
- **Comprehensive Tooling** - 16 management tools for development, testing, and maintenance
- **Schema Validation** - Database integrity checking and automated validation
- **API Documentation** with OpenAPI/Swagger

### 🚧 Future Enhancements
- **Advanced Reporting** and analytics dashboards
- **Mobile PWA** for field workers
- **Workflow Automation** engine
- **Enhanced UI Components** with more drag-and-drop features
- **Real-time Collaboration** features

---

## 🛠️ Development

### Code Organization
```
pmo/
├── apps/
│   ├── api/           # Fastify backend
│   └── web/           # React frontend
├── db/                # Database schema
├── tools/             # Management scripts
├── infra/helm/        # Kubernetes configs
└── docs/              # Additional documentation
```

### Development Commands
```bash
pnpm dev              # Start dev servers
pnpm lint             # Run linters  
pnpm typecheck        # Type checking
pnpm build            # Build for production
```

### Adding Features
1. **Backend**: Add routes in `apps/api/src/modules/`
2. **Frontend**: Add components/pages in `apps/web/src/`
3. **Database**: Update schema in `db/schema.sql`

---

## 📞 Support & Contributing

### Getting Help
1. **Check Documentation** - Use navigation above
2. **Review Issues** - Search existing GitHub issues
3. **Check Service Status** - Run `./tools/status.sh`
4. **View Logs** - Use `./tools/logs-*.sh` for debugging

### Contributing
1. Fork repository and create feature branch
2. Follow existing TypeScript/React patterns  
3. Update relevant documentation
4. Submit pull request with clear description

### Common Issues
- **Port conflicts**: Use `./tools/status.sh` to check
- **Database issues**: Reset with `./tools/db-recreate.sh`
- **API errors**: Check logs with `./tools/logs-api.sh`

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**🔗 Quick Links**: [Tech Stack](./TECHSTACK.md) | [Architecture](./architecture.md) | [Database](./db/README.md) | [API](./apps/api/src/modules/README.md) | [Frontend](./apps/web/src/README.md) | [Tools](./tools/README.md)# pmo
