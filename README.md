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
| **[🏗️ Architecture](./architecture.md)** | System design principles | Domain-first design, RBAC, scalability patterns |
| **[⚙️ Tech Stack](./TECHSTACK.md)** | Complete technology overview | Frontend, backend, infrastructure, performance |
| **[🗄️ Database Schema](./db/README.md)** | Data model and database guide | Tables, relationships, RBAC, installation |
| **[🔧 Management Tools](./tools/README.md)** | Platform operation tools | Start/stop servers, database management, logs |
| **[🌐 API Reference](./apps/api/src/modules/README.md)** | Backend API documentation | Endpoints, authentication, RBAC, examples |
| **[💻 Frontend Guide](./apps/web/src/README.md)** | Web app development guide | Components, pages, state management, patterns |

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
- **Build**: Vite (fast development)
- **UI**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query + Zustand
- **Forms**: React Hook Form + Zod

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Orchestration**: Kubernetes + Helm
- **Storage**: MinIO/S3 compatible

**[📖 Complete Tech Stack Details →](./TECHSTACK.md)**

---

## 🏗️ Architecture Overview

> **Latest Update (2025-08-27)**: **JWT Authentication & RBAC System Fully Operational** - Simplified authentication architecture using lightweight JWT-only approach with on-demand RBAC checking. All protected endpoints now working with John Smith's database permissions (61 total across 8 scope types).

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
- **Schema File**: [`db/schema.sql`](./db/schema.sql) - Complete database schema with sample data
- **Installation**: `./tools/db-recreate.sh` - Reset database to default state
- **Management**: Use `tools/db-*.sh` scripts for database operations

### Key Features
- **30 Tables** with comprehensive RBAC system (23 route pages, 8 UI components)
- **Head/Records Pattern** for temporal data and audit trails
- **Scope-based Permissions** with route page/component access control
- **Super Admin Access** - John Smith has full permissions (61 total) across all scopes
- **Canadian Geographic Structure** for location hierarchy
- **PostGIS Integration** for geospatial queries

### Database Tools
```bash
./tools/db-recreate.sh    # Reset database (most common)
./tools/db-import.sh      # Import schema and data
./tools/db-drop.sh        # Drop all tables
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
| `db-recreate.sh` | Reset database | `./tools/db-recreate.sh` |

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
- **✅ Fully Working**: Employee, Client, HR Scope, Worksite, Location, Business management
- **✅ Authentication**: JWT login/logout with John Smith credentials working
- **✅ RBAC**: All endpoints properly checking database permissions  
- **⚠️ Minor Issues**: Project/Task endpoints (500 errors - non-auth related)
- **🔗 Base URL**: `http://localhost:4000/api/v1/`

### Key Features
- **OpenAPI Documentation** at `/docs`
- **JWT Authentication** using `@fastify/jwt` plugin
- **Lightweight RBAC** with on-demand permission checking
- **Database Integration** with John Smith's 61 permissions active
- **TypeScript Schemas** with comprehensive validation
- **Production Ready** authentication flow (DEV_BYPASS_OIDC=false)

### Common Endpoints
```
GET    /api/v1/emp           # List employees
GET    /api/v1/project       # List projects  
GET    /api/v1/task          # List tasks
GET    /api/v1/client        # List clients
GET    /api/v1/scope/hr      # List HR units
```

**[📖 Complete API Documentation →](./apps/api/src/modules/README.md)**

---

## 💻 Frontend Reference

### Web Application Structure
```
apps/web/src/
├── components/     # Reusable UI components
│   ├── auth/      # Authentication components
│   ├── layout/    # Sidebar, TopBar, Layout
│   ├── ui/        # shadcn/ui base components
│   └── tasks/     # Task-specific components
├── pages/         # Route components
│   ├── admin/     # Admin management pages
│   ├── dashboard/ # Dashboard page
│   ├── projects/  # Project pages
│   └── tasks/     # Task pages
├── lib/           # Core utilities
│   ├── api.ts     # API client
│   └── utils.ts   # Utility functions
└── stores/        # Global state management
```

### Key Features
- **Role-based Authentication** with persona switching
- **Permission-aware UI** components
- **Comprehensive Admin Interface** for all entities
- **Kanban Task Board** with drag-and-drop
- **Advanced Data Tables** with filtering and sorting

### Development Personas
- **Admin** - Full system access
- **Owner** - Project management
- **Collaborator** - Task execution  
- **Reviewer** - QA supervision
- **Viewer** - Read-only access
- **Auditor** - Audit trail access

**[📖 Complete Frontend Guide →](./apps/web/src/README.md)**

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

### RBAC Permission System
- **Database-Driven Authorization**: All permissions stored in `rel_user_scope` table
- **Scope-based Access**: 8 scope types (app, location, business, hr, worksite, project, task, route_page, component)
- **Permission Arrays**: [0:view, 1:modify, 2:share, 3:delete, 4:create] enforced by API
- **John Smith Access**: Full permissions {0,1,2,3,4} across all business scopes (61 total permissions)
- **JWT Authentication**: Production-ready token validation and user ID extraction
- **API-Only Authorization**: No frontend role guards - all security enforced by backend
- **On-Demand RBAC**: Permissions checked per-request using `checkScopeAccess()`
- **Graceful Degradation**: Frontend shows 403 errors for unauthorized actions

---

## 🎯 Features Overview

### ✅ Implemented
- **Multi-domain Data Model** with Canadian geography
- **Working JWT Authentication** - Login, token generation, validation, user ID extraction
- **Operational RBAC System** - John Smith's 61 permissions working across all endpoints
- **Database Integration** - All API endpoints connecting to PostgreSQL with real data
- **Simplified Architecture** - Lightweight JWT-only auth without abilities plugin overhead
- **Production Security** - Proper boolean parsing, environment variable handling
- **Comprehensive Testing** - Debug tools for RBAC and endpoint validation
- **Route Page Management** with 23 application pages and component definitions
- **API Documentation** with OpenAPI/Swagger

### 🚧 In Development
- **Advanced Reporting** and analytics dashboards
- **Mobile PWA** for field workers
- **Workflow Automation** engine
- **SSO/OIDC Integration** for enterprise auth

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
