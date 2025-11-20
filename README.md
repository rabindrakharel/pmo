# Huron Home Services - PMO Enterprise Platform 🏡

> **Complete Canadian Home Services Management System** - Production-ready PMO platform with comprehensive data model, unified RBAC, and industry-specific business intelligence

[![Version](https://img.shields.io/badge/version-3.4.0-blue.svg)](https://github.com/yourusername/pmo)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-Production-success.svg)](http://100.26.224.246:5173)
[![Architecture](https://img.shields.io/badge/architecture-100%25%20DRY-brightgreen.svg)](#)

---
AI Models must strictly look for specific .md file, and search for specific things in the directory .md file below. 
You must read .md to understand the existing design, dry princples and design pattern first. 
Data import, API test, log test must be done via tools. /home/rabin/projects/pmo/tools 
After each data model change, /home/rabin/projects/pmo/tools/db-import.sh must run again. 
API test must always be run using /home/rabin/projects/pmo/tools/test-api.sh

## 🎯 Platform Overview

The **PMO Platform** is an enterprise-grade project management and operations system built with a **DRY-first, config-driven architecture**. It features:

- **18 Entity Types** (Projects, Tasks, Employees, Clients, Forms, Wiki, etc.)
- **52 Database Tables** (13 core entities, 16 settings, 23 infrastructure)
- **31+ API Modules** with unified RBAC and JWT authentication
- **3 Universal Pages** handling all CRUD operations
- **Sequential State Visualization** for workflows and sales funnels
- **Database-Driven Metadata** for runtime configurability
- **AWS Deployment** with automated CI/CD pipeline

**Keywords:** PMO, Project Management, RBAC, Entity System, Fastify, React 19, PostgreSQL, TypeScript, AWS, Terraform, DRY Architecture, Home Services, Canadian Business

---

## 📚 Documentation Index

### 🏗️ Architecture & System Design

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[UI/UX Architecture](./docs/ui_ux_route_api.md)** | Complete system architecture from DB to frontend | Understanding the entire platform, data flows, routing | Database layer, API modules, Frontend components, Data flow examples, DRY principles |
| **[Infrastructure Design](./docs/INFRASTRUCTURE_DESIGN.md)** | AWS cloud infrastructure and deployment | Setting up AWS resources, deployment pipeline | Terraform, EC2, S3, Lambda, EventBridge, Deployment automation |
| **[Deployment Design](./docs/DEPLOYMENT_DESIGN.md)** | Deployment strategies and procedures | Deploying to production, CI/CD setup | Deployment flow, Environment configuration, Release management |

### 💾 Data Model & Database

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Data Model](./docs/datamodel/README.md)** | Complete database schema and relationships | Understanding entities, tables, relationships | 50+ DDL files, Entity relationships, RBAC model, Settings tables |
| **[Settings System](./docs/settings/settings.md)** | Settings/datalabel architecture | Managing dropdowns, workflows, hierarchies | 16 settings tables, Sequential states, Dropdown integration |

### ⚙️ Core Services & Libraries

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Entity Infrastructure Service](./docs/services/entity-infrastructure.service.md)** | **⭐ Single source of truth** for all infrastructure operations | Implementing entity CRUD, RBAC checks, registry operations | RBAC permissions, Entity registry, Parent-child linking, Delete cascades |
| **[Backend Formatter Service](./docs/services/backend-formatter.service.md)** | **⭐ Backend metadata generation** - Single source of truth for field rendering | Adding new entities, understanding field metadata generation | 35+ pattern rules, Column naming conventions, Metadata caching, Backend-driven UI |
| **[Frontend Formatter Service](./docs/services/frontEndFormatterService.md)** | **⭐ Pure metadata renderer** - Zero frontend logic, executes backend instructions | Building components that consume backend metadata | View/edit mode rendering, Metadata consumption, Component integration, Type guards |
| **[Services Catalog](./docs/services/README.md)** | Index of all backend services | Finding service documentation | 10+ services (email, calendar, S3, messaging, etc.) |

### 🔌 API & Services

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Entity Options API](./docs/ENTITY_OPTIONS_API.md)** | Universal dropdown/select options service | Building forms, filters, dropdowns | `/api/v1/entity/:entityCode/entity-instance-lookup`, Dynamic options loading |
| **[S3 Attachment Service](./docs/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md)** | File upload and attachment management | Implementing file uploads, document management | Presigned URLs, Attachment metadata, S3/MinIO integration |

### 🎨 Frontend Components & Features

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Entity Data Table](./docs/ui_components/EntityDataTable.md)** | Universal CRUD table component | Building entity lists, inline editing, bulk operations | Column configuration, Pagination, Sorting, Filtering |
| **[DAG Visualizer](./docs/ui_components/DAGVisualizer.md)** | Directed Acyclic Graph visualization | Workflow stages, project pipelines, sequential states | DAG rendering, Stage progression, Workflow visualization |
| **[Kanban Board](./docs/ui_components/KanbanBoard.md)** | Task board implementation | Building kanban views, task management | Drag-drop, Column configuration, State transitions |
| **[Dynamic Forms](./docs/form/form.md)** | JSONB-based form builder | Creating custom forms, form workflows | Form schema, Multi-step wizards, Validation, Submissions |
| **[Project & Task System](./docs/Project_Task.md)** | Project/task entity implementation | Managing projects, tasks, assignments | Entity structure, Parent-child relationships, Workflows |

### 🛠️ Tools & Operations

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Management Tools](./docs/tools.md)** | Platform operation scripts | Daily operations, debugging, testing | `start-all.sh`, `db-import.sh`, `test-api.sh`, Log viewing |

---

## 🤖 AI/Agent Usage Guide

### When to Read Each Document

**🔍 Understanding the Platform:**
```
Start with: ui_ux_route_api.md → Complete overview of all layers
Then read: datamodel.md → Understand entities and relationships
Finally: INFRASTRUCTURE_DESIGN.md → Deployment architecture
```

**🏗️ Adding New Features:**
```
Entity-based feature: ui_ux_route_api.md → Entity Configuration System
Form feature: form.md → Dynamic form schemas
File upload: S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md → Attachment workflow
Dropdown/select: ENTITY_OPTIONS_API.md → Universal options API
```

**🐛 Debugging Issues:**
```
Deployment issue: INFRASTRUCTURE_DESIGN.md + DEPLOYMENT_DESIGN.md
Database issue: datamodel.md + tools.md (db-import.sh)
API issue: ui_ux_route_api.md (API Layer section) + tools.md (test-api.sh)
Settings/dropdown: settings.md + ENTITY_OPTIONS_API.md
```

**📝 Implementation Tasks:**
```
New entity type: ui_ux_route_api.md (Entity Configuration) + datamodel.md (DDL)
New settings category: settings.md + datamodel.md (Settings tables)
Kanban view: component_Kanban_System.md
Project/task workflow: Project_Task.md
Form builder: form.md
```

### Document Search Keywords

| Keywords | Relevant Documents |
|----------|-------------------|
| **database, schema, DDL, tables, relationships** | `datamodel.md`, `ui_ux_route_api.md` |
| **API, endpoints, routes, modules** | `ui_ux_route_api.md`, `ENTITY_OPTIONS_API.md`, `S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` |
| **frontend, React, components, pages** | `ui_ux_route_api.md`, `component_Kanban_System.md`, `form.md` |
| **settings, dropdowns, workflows, stages** | `settings.md`, `ui_ux_route_api.md` |
| **deployment, AWS, infrastructure, Terraform** | `INFRASTRUCTURE_DESIGN.md`, `DEPLOYMENT_DESIGN.md` |
| **RBAC, permissions, authorization** | `datamodel.md`, `ui_ux_route_api.md` |
| **forms, JSONB, schema, validation** | `form.md` |
| **kanban, task board, drag-drop** | `component_Kanban_System.md` |
| **file upload, attachments, S3, presigned URLs** | `S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` |
| **tools, scripts, db-import, test-api** | `tools.md` |
| **entity configuration, DRY, universal pages** | `ui_ux_route_api.md` |
| **projects, tasks, assignments** | `Project_Task.md` |

---

## 🚀 Quick Start

### 1. Start the Platform

```bash
# Start all services (Docker + API + Web)
./tools/start-all.sh

# Access the platform
# Web App: http://localhost:5173
# API: http://localhost:4000
# API Docs: http://localhost:4000/docs
```

### 2. Login

**Test Account:**
- **Email:** `james.miller@huronhome.ca`
- **Password:** `password123`

### 3. Explore Documentation

**For AI/Agents:**
- Read `docs/ui_ux_route_api.md` first for complete system understanding
- Use the table above to find specific documentation
- Search by keywords when looking for specific functionality

**For Developers:**
- Start with `docs/ui_ux_route_api.md` for architecture overview
- Refer to `docs/tools.md` for daily operations
- Check `docs/datamodel.md` for database schema

---

## 📊 Platform Statistics

| Metric | Count |
|--------|-------|
| **Documentation Files** | 30+ comprehensive guides across all domains |
| **Database Tables** | 50+ DDL files (entities, settings, infrastructure) |
| **API Modules** | 45+ modules with 150+ endpoints |
| **Entity Types** | 30+ registered in entity table |
| **Frontend Pages** | 3 universal pages handling all entities dynamically |
| **Lines of Code** | ~32,500 (Database: 15k, API: 6k, Frontend: 11k) |
| **Architecture** | **100% Entity Infrastructure Service**, **100% DRY**, **Zero duplication** |
| **Technology Stack** | React 19, Fastify v5, PostgreSQL 14+, TypeScript ESM, AWS |

---

## 🏗️ Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, React Router v6, Lucide Icons |
| **Backend** | Fastify v5, TypeScript (ESM), PostgreSQL 14+, JWT, MinIO/S3 |
| **Infrastructure** | AWS EC2, S3, Lambda, EventBridge, Terraform |
| **Development** | pnpm, Docker, Git |

---

## 📁 Project Structure

```
pmo/
├── apps/
│   ├── api/                          # Backend (31+ modules)
│   └── web/                          # Frontend (React 19)
├── db/                               # 52 DDL files
├── docs/                             # 11 documentation files
│   ├── ui_ux_route_api.md           # ⭐ Complete architecture
│   ├── datamodel.md                 # Database schema
│   ├── INFRASTRUCTURE_DESIGN.md     # AWS infrastructure
│   ├── DEPLOYMENT_DESIGN.md         # Deployment guide
│   ├── ENTITY_OPTIONS_API.md        # Dropdown API
│   ├── S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md  # File uploads
│   ├── settings.md                  # Settings system
│   ├── component_Kanban_System.md   # Kanban boards
│   ├── form.md                      # Dynamic forms
│   ├── Project_Task.md              # Project/task entities
│   └── tools.md                     # Management tools
├── infra-tf/                         # Terraform (AWS)
└── tools/                            # Management scripts
```

---

## 🛠️ Essential Commands

```bash
# Platform Management
./tools/start-all.sh              # Start all services
./tools/db-import.sh              # Import/reset database (52 DDL files)

# Testing
./tools/test-api.sh GET /api/v1/project              # Test API endpoints
./tools/test-api.sh POST /api/v1/task '{"name":"New Task"}'

# Monitoring
./tools/logs-api.sh 100           # View API logs
./tools/logs-web.sh -f            # Follow web logs

# Deployment
./infra-tf/deploy-code.sh         # Deploy to production
```

---

## 🔗 Quick Links

**Production:**
- Web App: http://100.26.224.246:5173
- API: http://100.26.224.246:4000
- API Docs: http://100.26.224.246:4000/docs

**Local:**
- Web App: http://localhost:5173
- API: http://localhost:4000
- API Docs: http://localhost:4000/docs

---

## 🤝 Contributing

1. Read `docs/ui_ux_route_api.md` for architecture understanding
2. Check relevant documentation for your feature area
3. Use `docs/tools.md` for development workflows
4. Follow DRY principles and TypeScript best practices

---

## 📝 License

MIT License - see the [LICENSE](LICENSE) file for details.

---

**Last Updated:** 2025-11-18
**Version:** 3.4.0 (Production)
**Architecture:** 100% Entity Infrastructure Service, DRY-first, Database-driven, Zero duplication
**Deployment:** http://100.26.224.246:5173

**v3.4.0 Highlights:**
- ✅ **Purged 10 obsolete files** (~5,000 lines removed)
- ✅ **100% Entity Infrastructure Service** adherence (no competing systems)
- ✅ **Renamed ENTITY_TYPE → ENTITY_CODE** (matches data model)
- ✅ **Fixed all infrastructure table names** (entity, entity_instance_link, entity_rbac)
- ✅ **24 documentation files updated** to reflect current architecture

---

## 🎯 For AI/LLM Agents

**Primary Reference:** Always start with `docs/ui_ux_route_api.md` for system-wide understanding.

**Task-Specific References:**
- Database/Schema → `docs/datamodel.md`
- Settings/Dropdowns → `docs/settings.md`
- Infrastructure/AWS → `docs/INFRASTRUCTURE_DESIGN.md`
- Deployment → `docs/DEPLOYMENT_DESIGN.md`
- Forms → `docs/form.md`
- Kanban → `docs/component_Kanban_System.md`
- File Uploads → `docs/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md`
- API Options → `docs/ENTITY_OPTIONS_API.md`
- Projects/Tasks → `docs/Project_Task.md`
- Tools/Operations → `docs/tools.md`

**Search Strategy:**
1. Identify task category (architecture, database, API, frontend, infrastructure)
2. Use keyword table above to find relevant documents
3. Read `ui_ux_route_api.md` for cross-layer understanding
4. Dive into specific docs for implementation details
