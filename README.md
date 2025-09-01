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

> **Latest Update (2025-08-31)**: **RBAC UI Component System Complete** - Implemented comprehensive permission-gated data tables with elegant action buttons. Added React hooks for permission management and seamless API integration. All data tables now feature dynamic permission-based UI rendering.

### System Design Principles
- **Domain-First**: UI mirrors database domains
- **RBAC + Scope-Aware**: Role-based access control
- **Policy-Gated Routes**: Unified permission enforcement
- **Head/Records Pattern**: Temporal data for audit trails

### Data Domains
1. **META** - Reference vocabulary and configuration
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
- **🔗 Base URL**: `http://localhost:4000/api/v1/`

### Key Features
- **OpenAPI Documentation** at `/docs`
- **JWT Authentication** using `@fastify/jwt` plugin
- **Lightweight RBAC** with on-demand permission checking
- **Database Integration** with James Miller's 113+ permissions active
- **TypeScript Schemas** with comprehensive validation
- **Production Ready** authentication flow (DEV_BYPASS_OIDC=false)

### Common Endpoints
```
GET    /api/v1/emp                    # List employees
GET    /api/v1/project                # List projects  
GET    /api/v1/task                   # List tasks
GET    /api/v1/client                 # List clients
GET    /api/v1/scope/hr               # List HR units
GET    /api/v1/scope/business         # List business units
GET    /api/v1/scope/location         # List locations
GET    /api/v1/worksite               # List worksites
GET    /api/v1/meta                   # System metadata
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
│   └── layout/         # Layout components (Layout with collapsible sidebar)
├── pages/              # Route pages
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
├── contexts/           # React contexts (AuthContext for authentication)
├── lib/                # API client and utilities
├── types/              # TypeScript type definitions
└── App.tsx            # Main application routing
```

### Key Features
- **Modern React 19 + TypeScript** architecture
- **Advanced Data Tables** with sticky headers, filtering, sorting, and pagination
- **Professional UI Components** with gradient-based design system
- **JWT Authentication** with secure token management
- **Responsive Design** with mobile-first approach
- **Multi-View Components** - DataTable, GridView, TreeView for versatile data presentation

### Development Personas
- **Admin** - Full system access
- **Owner** - Project management
- **Collaborator** - Task execution  
- **Reviewer** - QA supervision
- **Viewer** - Read-only access
- **Auditor** - Audit trail access

**[📖 Complete Frontend Guide →](./apps/web/README.md)**

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
