# Huron Home Services - PMO Enterprise Platform 🏡

> **Complete Canadian Home Services Management System** - Production-ready PMO platform with comprehensive data model, unified RBAC, and industry-specific business intelligence

A fully-integrated Project Management Office (PMO) platform built for **Huron Home Services**, Ontario's premier home services company. Features **25+ employees**, **12+ diverse clients**, **10+ strategic projects**, **comprehensive worksites**, and **complete business operations** across landscaping, snow removal, HVAC, plumbing, and solar energy services.

## 🗺️ Schema Navigation & ER Relationships Guide

### 📊 5-Layer RBAC Architecture Overview

The PMO system implements a sophisticated **5-layer permission architecture** that provides comprehensive entity management and fine-grained access control:

```
🏗️ RBAC ARCHITECTURE FLOW
meta_entity_types (12 entity types) → Foundation Layer
    ↓ 
meta_entity_hierarchy (parent→child creation rules) → Rules Layer
    ↓ 
meta_entity_hierarchy_permission_mapping (permission matrix) → Permission Layer
    ↓
entity_id_hierarchy_mapping (actual instance relationships) → Instance Layer
    ↓
rel_employee_entity_action_rbac (specific user grants) → Access Control Layer
```

### 🎯 James Miller CEO - Comprehensive Access Matrix

**✅ Complete Implementation Status**: James Miller has been granted comprehensive access across **ALL entity types** and **ALL actions** as requested:

#### **Self-Permissions** (view/edit/share) on ALL entity types:
- ✅ **All business units** (biz → biz) - Full business hierarchy access
- ✅ **All projects** (project → project) - Complete project portfolio management
- ✅ **All employees** (employee → employee) - Full personnel management
- ✅ **All roles** (role → role) - Complete role administration
- ✅ **All clients** (client → client) - Full client relationship management
- ✅ **All content entities** - wikis, forms, tasks, artifacts with full management permissions

#### **Creation Permissions** from parent entities to child entities:
- ✅ **Business units** → wiki, form, task, project, artifact creation rights
- ✅ **Projects** → wiki, form, task, artifact creation within project scope
- ✅ **Clients** → project, task creation for client engagement
- ✅ **All hierarchical relationships** supported with proper parent-child validation

### 📋 Database Schema Navigation Index

| **Layer** | **DDL File** | **Table Name** | **Purpose** | **Key Relationships** |
|-----------|-------------|----------------|-------------|---------------------|
| **🏗️ Foundation** | `15___meta_entity_types.ddl` | `meta_entity_types` | 12 entity type definitions | → Validates all entity references |
| **📐 Rules** | `16___meta_entity_hierarchy.ddl` | `meta_entity_hierarchy` | Parent→child creation rules | ← Uses entity_types → Feeds permission mapping |
| **🔑 Permissions** | `18___meta_entity_hierarchy_permission_mapping.ddl` | `meta_entity_hierarchy_permission_mapping` | Permission matrix (create/view/edit/share) | ← Uses hierarchy rules → Validates RBAC grants |
| **🔗 Instances** | `17___entity_id_hierarchy_mapping.ddl` | `entity_id_hierarchy_mapping` | Actual entity instance relationships | ← Conforms to hierarchy → Provides RBAC scope |
| **👤 Access Control** | `19___rel_employee_entity_rbac.ddl` | `rel_employee_entity_action_rbac` | Individual user permissions | ← Validates against all layers |

### 🎯 Core Business Entity Tables

| **Category** | **DDL File** | **Table Name** | **Entity Type** | **Business Purpose** |
|-------------|-------------|----------------|----------------|-------------------|
| **👥 Personnel** | `12___d_employee.ddl` | `d_employee` | `employee` | 25+ employees from CEO to seasonal workers |
| **🏷️ Roles** | `13___d_role.ddl` | `d_role` | `role` | Executive to field worker role definitions |
| **🤝 Relationships** | `14___rel_emp_role.ddl` | `rel_emp_role` | - | Employee-role assignments with temporal tracking |
| **🏢 Organization** | `20___d_biz.ddl` | `d_biz` | `biz` | 3-level business hierarchy (Corp→Division→Dept) |
| **🎯 Projects** | `35___d_project.ddl` | `d_project` | `project` | 10+ strategic projects with full lifecycle management |
| **👥 Clients** | `14___d_client.ddl` | `d_client` | `client` | 12+ diverse client portfolio |

### 🔍 Entity Relationship Patterns

#### **Hierarchical Relationships**
```
Corporation (Level 0)
    ├── Business Operations Division (Level 1)
    │   ├── Landscaping Department (Level 2)
    │   ├── Snow Removal Department (Level 2)
    │   ├── HVAC Services Department (Level 2)
    │   ├── Plumbing Services Department (Level 2)
    │   └── Solar Energy Department (Level 2)
    └── Corporate Services Division (Level 1)
        ├── Human Resources Department (Level 2)
        ├── Finance & Accounting Department (Level 2)
        ├── Information Technology Department (Level 2)
        └── Legal & Compliance Department (Level 2)
```

#### **Permission Flow Example**
```
James Miller (CEO) →
    ✅ Self-Permission: biz(Huron Home Services) → view/edit/share
    ✅ Creation Permission: biz(Landscaping Dept) → create(wiki, form, task, project, artifact)
    ✅ Instance Mapping: entity_id_hierarchy_mapping validates relationships
    ✅ Permission Matrix: meta_entity_hierarchy_permission_mapping confirms allowed actions
    ✅ RBAC Grant: rel_employee_entity_action_rbac stores specific permissions
```

### 📊 Quick Reference - Key Tables by Use Case

#### **For User Management**
- `d_employee` + `d_role` + `rel_emp_role` = Complete personnel system
- `rel_employee_entity_action_rbac` = Individual user permissions

#### **For Organization Management**  
- `d_biz` + `entity_id_hierarchy_mapping` = Business hierarchy with relationships
- `meta_entity_hierarchy_permission_mapping` = What can be created where

#### **For Project Management**
- `d_project` + `d_client` + `entity_id_hierarchy_mapping` = Project-client relationships
- `rel_employee_entity_action_rbac` = Project access permissions

#### **For Permission Management**
- All 5 RBAC layers work together for comprehensive access control
- James Miller has **comprehensive access** across all entity types and actions

## 🎯 Current State (Latest: 2025-01-30)

**✅ Complete Business System Ready** - Comprehensive home services platform:
- **🏢 Complete Organization**: 9 departments across 2 divisions with full cost center tracking
- **👥 25+ Employee Profiles**: From C-suite executives to seasonal workers with multilingual support  
- **🏘️ 12+ Diverse Clients**: Residential estates, commercial complexes, municipal contracts, industrial facilities
- **📊 10+ Strategic Projects**: Seasonal campaigns, market expansion, digital transformation, safety compliance
- **🏭 Comprehensive Worksites**: Corporate HQ, regional centers, seasonal facilities, project sites
- **🔐 Advanced RBAC**: 113+ permissions across entity types with Canadian regulatory compliance
- **🛠️ Complete Technical Stack**: React 18 + Fastify + PostgreSQL with 27 DDL files

## 🏢 Business Data Overview

### Organizational Structure
**Huron Home Services** - Mississauga, ON headquarters serving GTA, Hamilton, London markets

#### Executive Leadership
- **James Miller** (CEO) - Strategic leadership, bilingual (EN/FR), MBA Queens University
- **Sarah Chen** (CFO) - Corporate finance expertise, bilingual (EN/ZH), CPA Ontario  
- **David Kumar** (CTO) - Technology leadership, bilingual (EN/HI), P.Eng license
- **Maria Rodriguez** (COO) - Operations excellence, trilingual (EN/ES/FR), Lean Six Sigma

#### Service Departments
- **🌿 Landscaping** - Design, installation, maintenance, seasonal cleanup (Manager: Carlos Martinez)
- **❄️ Snow Removal** - 24/7 winter operations, municipal contracts (Manager: David Kowalski) 
- **🔥 HVAC Services** - Installation, maintenance, emergency repairs (Manager: Amanda Foster)
- **🔧 Plumbing** - Full-service plumbing, emergency response (Manager: Tony Ricci)
- **☀️ Solar Energy** - Residential/commercial solar systems (Manager: Sarah Kim)

#### Support Functions
- **HR Department** - Talent management (VP: Lisa Wang, CHRP designation)
- **Finance & Accounting** - Financial planning and analysis (Director: Michael O'Connor, CPA)
- **Information Technology** - Enterprise systems and security (Director: Jennifer Park, PMP)
- **Legal & Compliance** - Regulatory compliance and risk management

### Client Portfolio (12+ Active Clients)

#### Premium Residential
- **Thompson Family Residence** (Oakville) - $85K lifetime value, premium garden specialty
- **The Chen Estate** (Mississauga) - $120K lifetime value, Japanese garden design with pool/tennis

#### Major Commercial Contracts  
- **Square One Shopping Centre** - $500K lifetime, 85-acre retail complex with high foot traffic
- **Sheridan College** (Brampton) - $450K lifetime, 125-acre campus with 23,000 students
- **Trillium Health Partners** - $520K lifetime, healing gardens and accessibility focus
- **Ontario Power Generation** - $650K lifetime, nuclear-grade environmental compliance

#### Municipal & Industrial
- **City of Mississauga** - $750K lifetime, 45 parks and 2,500 acres of public spaces
- **Magna International** - $890K industrial contract, 35 facilities with 15,000 employees

### Strategic Project Portfolio (10+ Active Projects)

#### Seasonal Operations
- **Fall 2025 Landscaping Campaign** - $450K budget, 1,800 hours, comprehensive fall services
- **Winter 2025 Snow Removal** - $520K budget, critical 24/7 operations across GTA

#### Service Expansion  
- **Residential Solar Expansion** - $285K investment, targeting 85 installations with 25-year warranties
- **HVAC Maintenance Contracts** - $240K program, developing 200+ annual/quarterly maintenance contracts

#### Strategic Initiatives
- **Digital Transformation** - $750K enterprise modernization (CRM, FSM, customer portals)
- **Hamilton Market Expansion** - $485K expansion into Hamilton-Burlington market
- **Safety Training Program** - $120K WSIB compliance and certification for 150+ staff

### Comprehensive Worksite Network

#### Corporate Facilities
- **Huron Home Services HQ** (Mississauga) - 25,000 sq ft indoor, 50,000 sq ft outdoor, 150 workers
- **Toronto Service Center** - Regional hub with equipment storage and crew coordination
- **Equipment Storage - Meadowvale** - Secure compound with maintenance facilities

#### Operational Sites
- **Winter Ops - Equipment Staging** (Hamilton) - Seasonal facility with 200-ton salt capacity
- **Project Sites** - Solar installations, landscaping projects at client locations

### 🏃‍♂️ Getting Started
- **[Tech Stack Overview](#-tech-stack)** - Technologies used
- **[Quick Start Guide](#-quick-start)** - Start the platform in 3 commands
- **[Platform Management](#-platform-management)** - Server control and monitoring

### 📚 Documentation Index

| Document | Purpose | Key Topics |
|----------|---------|------------|
| **[📖 User Guide](./userguide.md)** | Complete developer reference | Architecture, components, patterns, adding features |
| **[🗄️ Database Schema](./db/README.md)** | 24-table data model with RBAC | Canadian business context, DDL files, relationships |
| **[🔧 Management Tools](./tools/README.md)** | 16 platform operation tools | Start/stop, database import, API testing, RBAC debugging |
| **[🌐 API Reference](./apps/api/README.md)** | 11-module backend with advanced RBAC | JWT auth, permissions, unified scoping, OpenAPI docs |
| **[💻 Frontend Guide](./apps/web/README.md)** | React 18 app with API-driven config | Dynamic components, perfect consistency, multi-view tables |

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

### 🎯 Architecture Highlights
- **Monorepo**: React (Vite + TS) web app and Fastify (TS) API
- **API-Driven Configuration**: Backend-generated UI schemas with frontend-safe field mapping
- **Perfect Naming Consistency**: Unified camelCase across API, routes, components, and configs
- **Two-API Architecture**: Config API (🔧 UI schemas) + Data API (📊 business data)

### Backend
- **Runtime**: Node.js 20+ with TypeScript 5.0+
- **Framework**: Fastify 5.0+ (high-performance HTTP server)
- **Database**: PostgreSQL 16+ with PostGIS extensions
- **ORM**: Drizzle ORM (type-safe SQL operations)
- **Cache**: Redis for session and permission caching
- **Auth**: JWT with @fastify/jwt + unified RBAC system

### Frontend  
- **Framework**: React 18 with TypeScript 5.0+
- **Build**: Vite 5.0+ (fast development and building)
- **UI**: Tailwind CSS + shadcn/ui + custom component library
- **State**: Axios client with JWT interceptor + Context API
- **Forms**: Dynamic form generation from API configs
- **Routing**: React Router DOM with protected routes

### Infrastructure
- **Containers**: Docker + Docker Compose for local development
- **Orchestration**: Kubernetes + Helm charts for production
- **Storage**: MinIO/S3 compatible object storage

---

## 🛡️ Unified RBAC System

The PMO platform implements a sophisticated **unified permission system** using `rel_employee_scope_unified` table, eliminating complex permission lookups and providing real-time access control across **9 scope types**.

### 🎯 Core RBAC Features

✅ **Unified Permission Model** - Single `rel_employee_scope_unified` table with direct table references  
✅ **Multi-Dimensional Scoping** - Business, location, HR, worksite, project, task, and app-level permissions  
✅ **Real-Time Validation** - Dynamic permission checking with Redis caching  
✅ **Granular Control** - Component, page, and API endpoint-level access control  
✅ **Permission Bundling** - Login response includes complete permission structure  

### 🔐 Scope Types & Integration

| Scope Type | Reference Table | Permission Levels | Usage Example |
|------------|----------------|-------------------|---------------|
| `project` | `ops_project_head` | [0:view, 1:modify, 2:share, 3:delete, 4:create] | Project management operations |
| `task` | `ops_task_head` | [0:view, 1:modify, 2:share, 3:delete, 4:create] | Task assignment and tracking |
| `business` | `d_scope_biz` | [0:view, 1:modify, 2:share, 3:delete, 4:create] | Business unit access control |
| `app:page` | `d_scope_app` | [0:view] | Frontend route protection (`/employees`, `/projects`) |
| `app:api` | `d_scope_app` | [0:view, 4:create] | API endpoint authorization (`/api/v1/project`, `/api/v1/task`) |
| `app:component` | `d_scope_app` | [0:view, 1:modify] | UI component gating (`TaskBoard`, `DataTable`) |

### 🚀 Enhanced Authentication APIs

```typescript
// New authentication endpoints with permission bundling
POST /api/v1/auth/login           // JWT + bundled permissions
GET  /api/v1/auth/permissions     // User permission summary  
GET  /api/v1/auth/scopes/:type    // Accessible resources by scope type
GET  /api/v1/auth/permissions/debug // Admin-only permission debugging
```

### 📊 Permission-Aware Components

```tsx
// API-driven configuration with automatic permission checking
<MetaDataTable entityType="projectStatus" />  // Renders with user's permissions
<DataTable data={projects} onEdit={canEdit} onDelete={canDelete} />
```

**[📖 Complete RBAC Documentation →](./apps/api/README.md#-advanced-rbac-system-architecture)**

---

## 🏗️ Current Architecture (2025-09-04)

### 🎯 System Design Principles
- **API-Driven Configuration**: Backend-generated UI schemas with database schema protection
- **Two-API Architecture**: Config API (🔧 UI metadata) + Data API (📊 business records)  
- **Perfect Naming Consistency**: Unified camelCase across all layers (routing issues resolved)
- **Unified RBAC**: Single permission table with direct table references
- **Head/Records Pattern**: Temporal data tracking with complete audit trails

### 🏢 Business Domain Coverage

**Meta Data (7 entities)** - Configuration & reference data
- `projectStatus`, `projectStage` - Project lifecycle management
- `taskStatus`, `taskStage` - Task workflow and Kanban stages  
- `businessLevel`, `locationLevel`, `hrLevel` - Organizational hierarchies

**Core Operations (6 entities)** - Business functionality
- `Project` - Project lifecycle with multi-dimensional scoping
- `Task` - Task management with head/records temporal tracking
- `Employee` - Identity management with JWT authentication
- `Client` - Client relationship management
- `Forms` - Dynamic form builder with schema-driven generation
- `Wiki` - Knowledge management system

**Scope Hierarchy (4 entities)** - Multi-dimensional access control
- `Business` - 6-level organizational structure
- `Location` - 8-level Canadian geographic hierarchy
- `HR` - 20-level position hierarchy with salary bands
- `Worksite` - Physical locations with geospatial data

### 🔄 Configuration Flow Example

```
1. User clicks: "Project Status" (camelCase)
   ↓
2. Route: /meta/projectStatus (camelCase)
   ↓  
3. Component: ProjectStatusPage loads
   ↓
4. Config API: GET /api/v1/config/entity/projectStatus (🔧 UI schema)
   ↓
5. Data API: GET /api/v1/meta?category=project_status (📊 records)
   ↓
6. Result: Dynamic page with permissions-filtered data
```

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

### 🏗️ Database Architecture & Table Inter-Relationships

The PMO platform implements a sophisticated **5-layer data architecture** that provides comprehensive entity management, hierarchical permissions, and fine-grained access control across the entire application ecosystem.

#### **📊 System Architecture Flow**
```
meta_entity_types (12 entity types)
    ↓ Foundation Layer
meta_entity_hierarchy (parent→child creation rules)
    ↓ Rules Layer  
meta_entity_hierarchy_permission_mapping (permission matrix expansion)
    ↓ Permission Layer
entity_id_hierarchy_mapping (actual instance relationships)
    ↓ Instance Layer
rel_employee_entity_action_rbac (specific user grants)
    ↓ Access Control Layer
```

#### **🔄 Table Inter-Relationships**

**meta_entity_types (Foundation Layer)**
- **FOUNDATION**: Provides entity type validation for all other tables
- **HIERARCHY LAYER**: Feeds into meta_entity_hierarchy with entity_type_code values
- **PERMISSION LAYER**: Referenced by meta_entity_hierarchy_permission_mapping for parent_entity/action_entity validation
- **INSTANCE LAYER**: Used by entity_id_hierarchy_mapping to track actual entity instance relationships 
- **ACCESS CONTROL**: Referenced by rel_employee_entity_action_rbac for specific permission grants
- **UI INTEGRATION**: Controls 12-entity sidebar structure with dedicated management pages

**meta_entity_hierarchy (Rules Layer)**
- Uses entity_type_code values from meta_entity_types for validation
- Feeds into meta_entity_hierarchy_permission_mapping to define permission_action possibilities
- Works with entity_id_hierarchy_mapping for instance tracking and parent-child relationships
- Enables rel_employee_entity_action_rbac creation rights within parent scopes
- Determines "Create Child Entity" buttons in UI management pages

**entity_id_hierarchy_mapping (Instance Layer)**
- Uses entity types from meta_entity_types for action_entity_type/parent_entity_type validation
- Conforms to hierarchy rules from meta_entity_hierarchy (what can be created where)
- Referenced by rel_employee_entity_action_rbac to ensure permissions apply to valid entity instances
- Provides parent_entity_id/action_entity_id pairs that define permission boundaries
- Enables breadcrumb navigation, hierarchical filtering, and scope-based data access

**meta_entity_hierarchy_permission_mapping (Permission Layer)**
- Uses parent_entity/action_entity values from meta_entity_types for validation
- Expands hierarchy rules into granular permission_action possibilities (create/view/edit/share)
- Serves as validation layer for rel_employee_entity_action_rbac (ensures only valid permissions)
- Determines UI button visibility (Create/Edit/Share) and API authorization patterns
- TWO-LAYER DESIGN: Defines "what's possible", RBAC defines "who can do what on which entities"

**rel_employee_entity_action_rbac (Access Control Layer)**
- Final enforcement layer using all previous tables for validation
- Validates against meta_entity_hierarchy_permission_mapping for permission combinations
- Validates against entity_id_hierarchy_mapping for entity relationship compliance
- Provides specific user permissions on specific entity instances
- Enables real-time access control across UI components and API endpoints

#### **🎯 Entity Categories & UI Structure**

The system manages **12 entity types** across **4 categories**, each with dedicated sidebar entries and management pages:

- **Organizational (4)**: hr, biz, org, client - structural/hierarchical entities
- **Operational (3)**: project, task, worksite - execution/workflow entities  
- **Personnel (2)**: employee, role - human resources entities
- **Content (3)**: wiki, form, artifact - information/knowledge entities

This architecture ensures **consistent permissions**, **hierarchical data integrity**, and **scalable access control** across the entire platform while supporting dynamic UI generation and role-based functionality.

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
