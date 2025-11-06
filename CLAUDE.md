# Huron Home Services - PMO Enterprise Platform 🏡

> **Complete Canadian Home Services Management System** - Production-ready PMO platform with comprehensive data model, unified RBAC, and industry-specific business intelligence

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/pmo)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-Production-success.svg)](http://100.26.224.246:5173)

---
AI Models must strictly look for specific .md file, and search for specific things. 
Data import, API test, log test must be done via tools. /home/rabin/projects/pmo/tools 
After each data model change, /home/rabin/projects/pmo/tools/db-import.sh must run again. 
API test must always be run using /home/rabin/projects/pmo/tools/test-api.sh

## 🎯 Platform Overview

The **PMO Platform** is an enterprise-grade project management and operations system built with a **DRY-first, config-driven architecture**. It features:

- **18 Entity Types** (Projects, Tasks, Employees, Clients, Forms, Wiki, etc.)
- **52 Database Tables** (13 core entities, 16 settings, 23 infrastructure)
- **31+ API Modules** with unified RBAC and JWT authentication
- **3 Universal Pages** handling all CRUD operations
- **Inline Create-Then-Link** - Automatic parent-child linkage in `d_entity_id_map` (v3.1)
- **Default-Editable Pattern** - All fields editable with smart input detection (v3.1)
- **Column Consistency** - Context-independent table columns (v3.1)
- **Sequential State Visualization** for workflows and sales funnels
- **Database-Driven Metadata** for runtime configurability
- **AWS Deployment** with automated CI/CD pipeline

**Keywords:** PMO, Project Management, RBAC, Entity System, Fastify, React 19, PostgreSQL, TypeScript, AWS, Terraform, DRY Architecture, Home Services, Canadian Business

---

## 📚 Documentation Index

> **🚀 NEW: Complete Documentation Navigation** → See [`docs/README.md`](./docs/README.md) for comprehensive folder-by-folder index with keyword search

### 🏗️ Architecture & System Design

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[📖 Documentation Index](./docs/README.md)** | **⭐ Complete navigation guide for all 40+ docs** | Finding any documentation quickly by task, keyword, or folder | Folder index, keyword search, reading order, quick reference |
| **[Universal Entity System](./docs/entity_design_pattern/universal_entity_system.md)** | **⭐ Complete DRY entity architecture guide** | Understanding universal pages, inline editing, create-then-link patterns | 3 universal pages, Default-editable pattern, Column consistency, Inline create-then-link, Entity configuration (v3.1) |
| **[UI/UX Architecture](./docs/entity_ui_ux_route_api.md)** | Complete system architecture from DB to frontend | Understanding the entire platform, data flows, routing | Database layer, API modules, Frontend components, Data flow examples, DRY principles |
| **[Infrastructure Design](./docs/infra_docs/INFRASTRUCTURE_DESIGN.md)** | AWS cloud infrastructure and deployment | Setting up AWS resources, deployment pipeline | Terraform, EC2, S3, Lambda, EventBridge, Deployment automation |
| **[Deployment Design](./docs/infra_docs/DEPLOYMENT_DESIGN.md)** | Deployment strategies and procedures | Deploying to production, CI/CD setup | Deployment flow, Environment configuration, Release management |

### 💾 Data Model & Database

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Data Model](./docs/datamodel/datamodel.md)** | Complete database schema and relationships | Understanding entities, tables, relationships | 52 DDL files, Entity relationships, RBAC model, Settings tables |
| **[Settings System](./docs/settings/settings.md)** | Settings/datalabel architecture | Managing dropdowns, workflows, hierarchies | 16 settings tables, Sequential states, Dropdown integration |

### 🔌 API & Services

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Entity Options API](./docs/ENTITY_OPTIONS_API.md)** | Universal dropdown/select options service | Building forms, filters, dropdowns | `/api/v1/entity/:type/options`, Dynamic options loading |
| **[S3 Attachment Service](./docs/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md)** | File upload and attachment management | Implementing file uploads, document management | Presigned URLs, Attachment metadata, S3/MinIO integration |

### 🎨 Frontend Components & Features

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Universal Entity System](./docs/entity_design_pattern/universal_entity_system.md)** | Complete DRY entity architecture | Understanding entity pages, column consistency, inline editing | 3 universal pages, EntityConfig, Column consistency v3.1.1, Create-Link-Edit pattern |
| **[Column Consistency Update](./docs/entity_design_pattern/COLUMN_CONSISTENCY_UPDATE.md)** | v3.1.1 Column consistency implementation | Understanding child entity table behavior | Context-independent columns, API filtering, Verification tests |
| **[Kanban System](./docs/component_Kanban_System.md)** | Task board implementation | Building kanban views, task management | Drag-drop, Column configuration, State transitions |
| **[Dynamic Forms](./docs/form/form.md)** | JSONB-based form builder | Creating custom forms, form workflows | Form schema, Multi-step wizards, Validation, Submissions |
| **[AI Chat System](./docs/ai_chat/AI_CHAT_SYSTEM.md)** | Complete AI chat system with text & voice | Implementing AI-powered customer service | Text chat, Voice calling, MCP integration, Function tools, Booking automation |

### 🛠️ Tools & Operations

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| **[Management Tools](./docs/tools.md)** | Platform operation scripts | Daily operations, debugging, testing | `start-all.sh`, `db-import.sh`, `test-api.sh`, Log viewing |

---

## 🤖 AI/Agent Usage Guide

> **⚡ QUICK START:** See [`docs/README.md`](./docs/README.md) for complete navigation guide organized by task type, folder, and keywords

### When to Read Each Document

**🔍 Understanding the Platform:**
```
Start with: docs/README.md → Complete documentation index ⭐⭐⭐
Then read: entity_design_pattern/universal_entity_system.md → DRY entity architecture ⭐
Then read: entity_ui_ux_route_api.md → Complete overview of all layers
Then read: datamodel/datamodel.md → Understand entities and relationships
Finally: infra_docs/INFRASTRUCTURE_DESIGN.md → Deployment architecture
```

**🏗️ Adding New Features:**
```
New entity type: entity_design_pattern/universal_entity_system.md → Universal pages, config, patterns
Entity-based feature: entity_design_pattern/universal_entity_system.md → Inline editing, create-then-link
Parent-child relationships: entity_design_pattern/universal_entity_system.md → Linkage patterns
Form feature: form/form.md → Dynamic form schemas
File upload: s3_service/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md → Attachment workflow
Dropdown/select: ENTITY_OPTIONS_API.md → Universal options API
```

**🐛 Debugging Issues:**
```
Deployment issue: infra_docs/INFRASTRUCTURE_DESIGN.md + infra_docs/DEPLOYMENT_DESIGN.md
Database issue: datamodel/datamodel.md + tools.md (db-import.sh)
API issue: entity_ui_ux_route_api.md (API Layer section) + tools.md (test-api.sh)
Settings/dropdown: settings/settings.md + ENTITY_OPTIONS_API.md
Entity creation/linkage: entity_design_pattern/universal_entity_system.md → Inline create-then-link
Column consistency: entity_design_pattern/universal_entity_system.md → Column patterns
Inline editing: entity_design_pattern/universal_entity_system.md → Default-editable pattern
```

**📝 Implementation Tasks:**
```
New entity type: entity_design_pattern/universal_entity_system.md (Best Practices) + datamodel/datamodel.md (DDL)
New settings category: settings/settings.md + datamodel/datamodel.md (Settings tables)
Add Row functionality: entity_design_pattern/universal_entity_system.md → Inline create-then-link
Parent-child linkage: entity_design_pattern/universal_entity_system.md → Create-link-edit pattern
Kanban view: component_Kanban_System.md
Form builder: form/form.md
```

### Document Search Keywords

| Keywords | Relevant Documents |
|----------|-------------------|
| **universal pages, entity system, DRY, create-link-edit** | `entity_design_pattern/universal_entity_system.md` ⭐ |
| **inline editing, add row, default-editable** | `entity_design_pattern/universal_entity_system.md` |
| **linkage, parent-child, d_entity_id_map, relationships** | `entity_design_pattern/universal_entity_system.md`, `datamodel/datamodel.md` |
| **column consistency, context-independent, child entity tables** | `entity_design_pattern/COLUMN_CONSISTENCY_UPDATE.md` ⭐, `entity_design_pattern/universal_entity_system.md` |
| **FilteredDataTable, main vs child views** | `entity_design_pattern/COLUMN_CONSISTENCY_UPDATE.md` |
| **database, schema, DDL, tables, relationships** | `datamodel/datamodel.md`, `entity_ui_ux_route_api.md` |
| **API, endpoints, routes, modules** | `entity_ui_ux_route_api.md`, `ENTITY_OPTIONS_API.md`, `s3_service/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` |
| **frontend, React, components, pages** | `entity_design_pattern/universal_entity_system.md`, `entity_ui_ux_route_api.md`, `component_Kanban_System.md`, `form/form.md` |
| **settings, dropdowns, workflows, stages** | `settings/settings.md`, `entity_ui_ux_route_api.md` |
| **deployment, AWS, infrastructure, Terraform** | `infra_docs/INFRASTRUCTURE_DESIGN.md`, `infra_docs/DEPLOYMENT_DESIGN.md` |
| **RBAC, permissions, authorization** | `datamodel/datamodel.md`, `entity_ui_ux_route_api.md` |
| **forms, JSONB, schema, validation** | `form/form.md` |
| **kanban, task board, drag-drop** | `component_Kanban_System.md` |
| **file upload, attachments, S3, presigned URLs** | `s3_service/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` |
| **tools, scripts, db-import, test-api** | `tools.md` |
| **entity configuration, DRY, entity config** | `entity_design_pattern/universal_entity_system.md`, `entity_ui_ux_route_api.md` |
| **AI chat, voice calling, MCP, function tools, booking automation** | `ai_chat/AI_CHAT_SYSTEM.md` ⭐ |
| **OpenAI, GPT-4, realtime API, chat widget, customer service** | `ai_chat/AI_CHAT_SYSTEM.md` |

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
| **Documentation Files** | 11 comprehensive guides |
| **Database Tables** | 52 DDL files (13 entities, 16 settings, 23 support) |
| **API Modules** | 31+ modules with 125+ endpoints |
| **Entity Types** | 18 (13 core + 5 product/operations) |
| **Frontend Pages** | 3 universal pages handling all entities |
| **Lines of Code** | ~37,500 (Database: 15k, API: 8k, Frontend: 12k) |
| **Technology Stack** | React 19, Fastify v5, PostgreSQL 14+, TypeScript, AWS |

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

**Last Updated:** 2025-11-04
**Version:** 3.1.0 (Production)
**Architecture:** DRY-first, Config-driven, Universal Components with Inline Create-Then-Link
**Deployment:** http://100.26.224.246:5173

---

## 🎯 For AI/LLM Agents

**Primary Reference:** ⭐ Always start with `docs/entity_design_pattern/universal_entity_system.md` for DRY entity architecture.

**Core Architecture References:**
- Universal Entity System → `docs/entity_design_pattern/universal_entity_system.md` ⭐ **START HERE**
- UI/UX Architecture → `docs/ui_ux_route_api.md`
- Database/Schema → `docs/datamodel.md`

**Task-Specific References:**
- **New Entity Type** → `docs/entity_design_pattern/universal_entity_system.md` (Best Practices section)
- **Add Row / Inline Creation** → `docs/entity_design_pattern/universal_entity_system.md` (Inline Create-Then-Link)
- **Parent-Child Linkage** → `docs/entity_design_pattern/universal_entity_system.md` (Create-Link-Edit Pattern)
- **Inline Editing** → `docs/entity_design_pattern/universal_entity_system.md` (Default-Editable Pattern)
- **Column Configuration** → `docs/entity_design_pattern/universal_entity_system.md` (Column Consistency)
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
1. Identify task category (entity operations, database, API, frontend, infrastructure)
2. **For entity-related tasks:** Start with `universal_entity_system.md` ⭐
3. Use keyword table above to find relevant documents
4. Read `ui_ux_route_api.md` for cross-layer understanding
5. Dive into specific docs for implementation details

**v3.1 Features (2025-11-04):**
- ✅ Inline Create-Then-Link Pattern - "Add Row" with automatic linkage to `d_entity_id_map`
- ✅ Default-Editable Pattern - All fields editable unless explicitly readonly
- ✅ Column Consistency Pattern - Same columns regardless of navigation context
