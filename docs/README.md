# PMO Platform Documentation Index

> **Navigation guide for AI/LLM agents to quickly locate relevant documentation**

**Last Updated:** 2025-11-17
**Platform Version:** 3.3.0 (Production)

---

## Quick Navigation by Task Type

### 🔍 "I need to understand..."

| What You Need | Where to Look | Key File |
|---------------|---------------|----------|
| **Complete platform overview** | Root: `/CLAUDE.md` | Main index with all features |
| **Database schema & entities** | `datamodel/` | `README.md` (50+ tables, NO foreign keys) |
| **Entity infrastructure & services** | `services/` | `ENTITY_INFRASTRUCTURE_SERVICE.md`, `UNIVERSAL_FORMATTER_SERVICE.md` ⭐ |
| **All API endpoints** | `api/` | `entity_endpoint_design.md`, `API_DEVELOPER_GUIDE.md` |
| **How AI chat works** | `ai_chat/` | `AI_CHAT_SYSTEM.md` (text + voice) |
| **How MCP server works** | `mcp/` | `MCP_ARCHITECTURE.md` |

### 🏗️ "I need to build..."

| What You're Building | Where to Look | Key File |
|---------------------|---------------|----------|
| **New entity type** | `services/`, `api/` | `ENTITY_INFRASTRUCTURE_SERVICE.md`, `entity_endpoint_design.md` ⭐ |
| **New data table** | `ui_components/` | `datatable.md` (OOP composition) |
| **New form** | `form/` | `form.md` (JSONB-based forms) |
| **Calendar/scheduling feature** | `calendar/` | `CALENDAR_SYSTEM.md` (15-min slots) |
| **Service workflow** | `service_appointment_task_work_orders/` | `SERVICE_WORKFLOW_ARCHITECTURE.md` ⭐ |
| **Quote system** | `product_services_quotes/` | `TECHNICAL_REFERENCE.md` ⭐ |
| **DAG/workflow visualization** | `ui_components/` | `dag_vizualizer.md` |
| **AI-powered feature** | `ai_chat/`, `mcp/` | AI chat and MCP folders |

### 🐛 "I need to debug..."

| Problem Area | Where to Look | Key File |
|--------------|---------------|----------|
| **RBAC permissions** | `services/`, `datamodel/` | `ENTITY_INFRASTRUCTURE_SERVICE.md` (entity_rbac) |
| **Column consistency issues** | `services/` | `UNIVERSAL_FORMATTER_SERVICE.md` (field detection) |
| **API not working** | `docs/` | `tools.md` (test scripts & troubleshooting) |
| **Entity linkage broken** | `services/` | `ENTITY_INFRASTRUCTURE_SERVICE.md` (entity_instance_link patterns) |
| **Settings/dropdowns** | `settings/` | `settings.md` (20+ settings tables) |
| **File uploads** | `services/` | `s3-attachment-service.md` |
| **Styling issues** | `styling/` | `styling_patterns.md` |

### 📋 "I need to deploy..."

| Deployment Task | Where to Look | Key File |
|-----------------|---------------|----------|
| **AWS infrastructure** | `infra_docs/` | `INFRASTRUCTURE_DESIGN.md` |
| **Deployment process** | `infra_docs/` | `DEPLOYMENT_DESIGN.md` |
| **DNS/SSL setup** | `infra_docs/` | `DNS_CONFIGURATION_GUIDE.md`, `MULTI_DOMAIN_SSL_DEPLOYMENT_GUIDE.md` |
| **Version management** | `versioning/` | `versioning_design.md` |

---

## 📚 Documentation Index

### 🏗️ Architecture & System Design

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| [Infrastructure Design](infra_docs/INFRASTRUCTURE_DESIGN.md) | AWS cloud infrastructure and deployment | Setting up AWS resources, deployment pipeline | Terraform, EC2, S3, Lambda, EventBridge, Deployment automation |
| [Deployment Design](infra_docs/DEPLOYMENT_DESIGN.md) | Deployment strategies and procedures | Deploying to production, CI/CD setup | Deployment flow, Environment configuration, Release management |

### 💾 Data Model & Database

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| [Data Model](datamodel/README.md) | Complete database schema and relationships | Understanding entities, tables, relationships | 50+ tables (46 DDL files), Entity relationships, RBAC model, Settings tables |
| [Settings System](settings/settings.md) | Settings/datalabel architecture | Managing dropdowns, workflows, hierarchies | 20+ settings tables, Sequential states, Dropdown integration |

### ⚙️ Core Services & Libraries

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| [Entity Infrastructure Service](services/ENTITY_INFRASTRUCTURE_SERVICE.md) | Centralized RBAC and entity lifecycle management | Implementing entity CRUD, RBAC checks, registry operations | RBAC permissions, Entity registry, Parent-child linking, Infrastructure operations |
| [Universal Formatter Service](services/UNIVERSAL_FORMATTER_SERVICE.md) | Single source of truth for all formatting | Formatting display values, field rendering, API transforms | Currency/date formatting, Badge rendering, Field detection, Type conversion |
| [Services Catalog](services/README.md) | Index of all backend services | Finding service documentation | 28+ services (linkage, email, calendar, S3, AI chat, etc.) |

### 🔌 API Architecture

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| [Entity Endpoint Design](api/entity_endpoint_design.md) | Universal API patterns for all entity routes | Building/understanding entity endpoints, CRUD operations | Route patterns, RBAC implementation, Factory endpoints, Data flow |

### 🎨 Frontend Components & Features

| Document | Purpose | When to Use | Key Topics |
|----------|---------|-------------|------------|
| [Entity Data Table](ui_components/datatable.md) | Universal CRUD table component | Building entity lists, inline editing, bulk operations | Column configuration, Pagination, Sorting, Filtering |
| [DAG Visualizer](ui_components/dag_vizualizer.md) | Directed Acyclic Graph visualization | Workflow stages, project pipelines, sequential states | DAG rendering, Stage progression, Workflow visualization |
| [Kanban Board](ui_components/kanban.md) | Task board implementation | Building kanban views, task management | Drag-drop, Column configuration, State transitions |
| [Dynamic Forms](form/form.md) | JSONB-based form builder | Creating custom forms, form workflows | Form schema, Multi-step wizards, Validation, Submissions |

---

## Documentation Folders Reference (Legacy)

### 📁 Core Architecture & Patterns

#### `entity_design_pattern/` ⭐ **LEGACY - See Core Services section above**
**When to use:** Understanding universal pages, inline editing, create-link-edit patterns, column consistency

**Files:**
- `universal_entity_system.md` - **Primary reference** for DRY entity architecture (3 universal pages, default-editable pattern, inline create-then-link)
- `DRY_ARCHITECTURE.md` - Comprehensive DRY principles guide (95% code reuse, 30+ entity types)
- `COLUMN_CONSISTENCY_UPDATE.md` - v3.1.1 context-independent column pattern
- `COLUMN_VISIBILITY_SYSTEM.md` - Column selector and visibility management
- `ENTITY_METADATA_COHERENCE.md` - Entity metadata from entity table
- `ENTITY_COHERENCE_ANALYSIS.md` - Entity system coherence analysis
- `UnifiedLinkageSystem.md` - Entity linkage patterns (entity_instance_link)
- `navigation_context.md` - Navigation & breadcrumb system
- `core_algorithm_design_pattern.md` - Core algorithms & patterns
- `DYNAMIC_ENTITY_BUILDER.md` - Dynamic entity builder system
- `artifacts.md` - Artifact management system

**Keywords:** universal pages, entity config, DRY, inline editing, add row, create-link-edit, column consistency, FilteredDataTable, entity metadata, linkage

---

#### `datamodel/`
**When to use:** Understanding database schema, entity relationships, RBAC, table structure

**Files:**
- `README.md` - Complete data model (50+ tables, NO foreign keys, entity_instance_link linkage)
- `DDL_STANDARDIZATION_GUIDE.md` - DDL naming conventions and standards
- `DDL_ROMAN_NUMERAL_MAPPING.md` - Roman numeral prefix mapping for DDL files
- `NAMING_CONVENTION_MIGRATION_PLAN.md` - Database naming convention migration plan

**Keywords:** database, schema, DDL, tables, relationships, RBAC, entity_rbac, entity_instance_link, NO foreign keys, naming conventions

---

#### `datatable/`
**When to use:** Building or modifying data tables, OOP composition patterns (LEGACY - Moved to ui_components/)

**Files:**
- Moved to `ui_components/datatable.md`

**Keywords:** datatable, OOP, composition, field-category, settings, auto-configuration, horizontal-scroll, scrollbar, pagination

---

#### `api/` ⭐ **API REFERENCE**
**When to use:** Understanding API endpoints, routes, modules, OpenAPI spec

**Files:**
- `entity_endpoint_design.md` - **Primary reference** for entity API patterns
- `API_DEVELOPER_GUIDE.md` - Complete API developer guide with all endpoints
- `openapi.yaml` - OpenAPI 3.0 specification for all API endpoints
- `ENTITY_OPTIONS_API.md` - Universal dropdown/select options service
- `ENTITY_DELETE_FACTORY.md` - Entity delete factory pattern
- `MODULES_README.md` - API modules overview
- `PAGINATION_MIGRATION.md` - Pagination migration guide

**Keywords:** API, endpoints, routes, modules, OpenAPI, REST, entity options, dropdowns, delete factory, pagination

---

### 📁 AI & Automation

#### `ai_chat/` ⭐ **AI CHAT SYSTEM**
**When to use:** AI-powered customer service, text chat, voice calling, booking automation

**Files:**
- `AI_CHAT_SYSTEM.md` - Complete AI chat architecture (text + voice, MCP integration, 50 tools, GPT-4/GPT-4o-realtime)
- `README.md` - AI chat system overview
- `QUICK_START.md` - Quick start guide for AI chat
- `AGENT_CONFIG_GUIDE.md` - Agent configuration guide
- `VOICE_INTEGRATION.md` - Voice chat integration
- `SESSION_MEMORY.md` - Session memory management
- `MONITORING.md` - Monitoring and observability
- `COST_OPTIMIZATION.md` - Cost optimization strategies
- `PROJECT_TASK_AGENT_CONFIG.md` - Project/task agent configuration
- `CHAT_TESTS.md` - Chat testing scripts and tools
- `CHAT_LOGS.md` - Chat logging and debugging
- `CHANGELOG_AI_CHAT_SERVICE_CATALOG_FIX.md` - Service catalog fix changelog

**Keywords:** AI chat, voice calling, MCP, function tools, booking automation, OpenAI, GPT-4, realtime API, chat widget, customer service, session memory, agent config

---

#### `mcp/`
**When to use:** Model Context Protocol server, API exposure to AI models, tool definitions

**Files:**
- `MCP_ARCHITECTURE.md` - MCP server architecture and design
- `MCP_SERVER_README.md` - MCP server implementation guide
- `GOAL_LEVEL_TOOL_BOUNDARY_APPROACH.md` - Goal-level tool boundary filtering
- `ENTITY_BOUNDARY_FILTERING_BRAINSTORM.md` - Entity boundary filtering strategies
- `DOCUMENTATION_UPDATE_SUMMARY.md` - MCP documentation updates
- `AGENTIC_FLOW_FIX_CUSTOMER_PROFILE.md` - Customer profile agentic flow fixes
- `MCP_AND_AGENT_CONFIG_SUMMARY.md` - MCP and agent configuration summary

**Keywords:** MCP, Model Context Protocol, AI tools, API manifest, Claude integration, tool calling, goal-level filtering, entity boundaries

---

### 📁 Feature-Specific Documentation

#### `calendar/`
**When to use:** Multi-person scheduling, availability tracking, booking management

**Files:**
- `CALENDAR_SYSTEM.md` - Calendar architecture (15-minute slots, multi-person view, 9 AM - 8 PM)
- `README.md` - Calendar setup guide

**Keywords:** calendar, scheduling, availability, booking, time slots, multi-person, person-calendar

---

#### `product_services_quotes/` ⭐ **QUOTE-TO-CASH WORKFLOW**
**When to use:** Product/service catalog, quote generation, work orders, JSONB quote items

**Files:**
- `INDEX.md` - Documentation navigation for quote system
- `TECHNICAL_REFERENCE.md` - **Primary reference** (all 4 entities: product, service, quote, work order)
- `README.md` - Detailed architecture
- `FIELD_GENERATOR_GUIDE.md` - DRY field generation patterns
- `JSONB_QUOTE_ITEMS.md` - JSONB architecture for quote line items
- `ENTITY_ATTRIBUTE_INLINE_DATATABLE.md` - Generic JSONB table component

**Keywords:** quote, product, service, work order, JSONB, line items, field generator, quote-to-cash

---

#### `service_appointment_task_work_orders/` ⭐ **SERVICE WORKFLOW**
**When to use:** Customer service requests, AI-driven task creation, employee assignment, skills-based matching

**Files:**
- `SERVICE_WORKFLOW_ARCHITECTURE.md` - **Primary reference** (phone-first identity, task-first creation, skills matching)
- `AI_AGENT_SERVICE_WORKFLOW.md` - AI agent integration patterns
- `IMPLEMENTATION_COOKBOOK.md` - Step-by-step implementation guide
- `README.md` - System overview

**Keywords:** service workflow, appointments, task creation, employee assignment, skills matching, phone-first, calendar availability

---

#### `form/`
**When to use:** Dynamic forms, JSONB form schemas, multi-step wizards, form validation

**Files:**
- `form.md` - JSONB-based form builder (schema, validation, submissions, multi-step)

**Keywords:** forms, JSONB, schema, validation, dynamic forms, form builder, multi-step wizard

---

#### `s3_service/`
**When to use:** File uploads, attachments, document management, S3/MinIO integration

**Files:**
- `S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` - File upload architecture (presigned URLs, attachment metadata)

**Keywords:** file upload, attachments, S3, MinIO, presigned URLs, document management

---

#### `settings/`
**When to use:** Dropdown options, workflows, stages, hierarchical settings

**Files:**
- `settings.md` - Settings system (16 settings tables, sequential states, dropdown integration)

**Keywords:** settings, dropdowns, workflows, stages, datalabel, setting_datalabel_*

---

### 📁 Visualization & UI Components

#### `ui_components/`
**When to use:** Building UI components, kanban boards, specialized widgets

**Files:**
- `component_Kanban_System.md` - Kanban board implementation (drag-drop, task management, state transitions)

**Keywords:** kanban, task board, drag-drop, UI components, widgets, state transitions

---

#### `dag_graph_vizualization/`
**When to use:** Workflow visualization, entity lifecycle stages, directed acyclic graphs

**Files:**
- `dag_visualizer_two_use_cases.md` - DAG visualizer (entity lifecycle + workflow sequences)

**Keywords:** DAG, graph, visualization, workflow, lifecycle, stages, React Flow

---

#### `styling/`
**When to use:** Styling patterns, CSS conventions, Tailwind usage, design system

**Files:**
- `styling_patterns.md` - Styling architecture and conventions

**Keywords:** styling, CSS, Tailwind, design system, theming

---

### 📁 Infrastructure & Operations

#### `infra_docs/`
**When to use:** AWS deployment, infrastructure setup, DNS/SSL configuration

**Files:**
- `INFRASTRUCTURE_DESIGN.md` - AWS architecture (EC2, S3, Lambda, Terraform)
- `DEPLOYMENT_DESIGN.md` - Deployment procedures
- `DNS_CONFIGURATION_GUIDE.md` - DNS setup
- `MULTI_DOMAIN_SSL_DEPLOYMENT_GUIDE.md` - SSL certificate management
- `SES_SNS_SETUP_GUIDE.md` - AWS SES and SNS email service setup
- `COST_BREAKDOWN.md` - AWS infrastructure cost analysis
- `INFRASTRUCTURE_IMPROVEMENTS.md` - Infrastructure improvement roadmap
- `AWS_SETUP.md` - AWS account and service setup guide
- `COMPLETE_IAM_SETUP.md` - Complete IAM setup instructions
- `DEPLOYMENT_QUICKSTART.md` - Quick deployment guide
- `DNS_QUICK_REFERENCE.md` - DNS configuration quick reference
- `MANUAL_IAM_UPDATE_INSTRUCTIONS.md` - Manual IAM update procedures

**Keywords:** AWS, infrastructure, deployment, Terraform, DNS, SSL, EC2, S3, Lambda, SES, SNS, IAM, cost optimization

---

#### `versioning/`
**When to use:** Entity versioning, history tracking, SCD Type 2, in-place versioning

**Files:**
- `versioning_design.md` - Versioning patterns (in-place vs SCD Type 2)

**Keywords:** versioning, history, audit trail, SCD Type 2, in-place versioning

---

#### `mobile/`
**When to use:** Mobile app development, React Native implementation

**Files:**
- `MOBILE_APP_DESIGN.md` - Mobile application design and architecture

**Keywords:** mobile, React Native, mobile app, mobile design, iOS, Android

---

#### `performance/`
**When to use:** Performance testing, load testing, benchmarking

**Files:**
- `PERFORMANCE_TESTING.md` - Performance testing guide and benchmarks

**Keywords:** performance, load testing, benchmarking, optimization, metrics

---

### 📁 Feature Planning & Analysis

#### `featureadd/`
**When to use:** Architecture critique, feature suggestions, CRM extensions

**Files:**
- `ARCHITECTURE_CRITIQUE_AND_RECOMMENDATIONS.md` - Expert platform analysis (7.5/10 rating, Nov 2025)
- `crm_featureadd.md` - CRM feature suggestions
- `FLOW_ANALYSIS.md` - System flow analysis

**Keywords:** architecture review, recommendations, feature planning, critique, improvements, flow analysis

---

### 📁 Root-Level Documents

#### Core System Documentation

| File | Purpose | When to Use |
|------|---------|-------------|
| **`tools.md`** | Management scripts | Daily operations (start-all.sh, db-import.sh, test-api.sh) |
| **`instructionToLLM.md`** | Documentation guidelines | Writing new documentation |
| **`README.md`** | Documentation index | Finding any documentation quickly (this file) |

**Note:** Most docs have been organized into subfolders. See sections above for:
- Entity system: `entity_design_pattern/` (includes UnifiedLinkageSystem, navigation_context, core_algorithm_design_pattern, artifacts)
- API docs: `api/` (includes ENTITY_OPTIONS_API, API_DEVELOPER_GUIDE)
- UI components: `ui_components/` (includes component_Kanban_System)
- Wiki: `wiki/` (includes wiki.md, COLLABORATIVE_WIKI_EDITING)

---

## Search by Keywords

**Quick keyword lookup** - Find documentation by searching for these terms:

| Keywords | Location | Primary File |
|----------|----------|--------------|
| **entity infrastructure, RBAC, registry** | `services/` | `ENTITY_INFRASTRUCTURE_SERVICE.md` ⭐ |
| **formatting, field detection, currency, dates** | `services/` | `UNIVERSAL_FORMATTER_SERVICE.md` ⭐ |
| **linkage, parent-child, entity_instance_link** | `services/` | `ENTITY_INFRASTRUCTURE_SERVICE.md` |
| **database, schema, DDL, NO foreign keys** | `datamodel/` | `README.md` |
| **RBAC, permissions, entity_rbac** | `services/` | `ENTITY_INFRASTRUCTURE_SERVICE.md` |
| **API, endpoints, routes, entity patterns** | `api/` | `entity_endpoint_design.md` ⭐ |
| **AI chat, voice calling, MCP, GPT-4** | `ai_chat/` | `AI_CHAT_SYSTEM.md` ⭐ |
| **MCP, Model Context Protocol, tools** | `mcp/` | `MCP_ARCHITECTURE.md` |
| **quote, product, service, work order** | `product_services_quotes/` | `TECHNICAL_REFERENCE.md` ⭐ |
| **service workflow, appointments, skills** | `service_appointment_task_work_orders/` | `SERVICE_WORKFLOW_ARCHITECTURE.md` ⭐ |
| **calendar, scheduling, availability** | `calendar/` | `CALENDAR_SYSTEM.md` |
| **forms, JSONB, schema, validation** | `form/` | `form.md` |
| **file upload, S3, attachments** | `services/` | `s3-attachment-service.md` |
| **settings, dropdowns, workflows** | `settings/` | `settings.md` |
| **datatable, OOP, composition** | `ui_components/` | `datatable.md` |
| **DAG, graph, visualization, workflow** | `ui_components/` | `dag_vizualizer.md` |
| **deployment, AWS, infrastructure** | `infra_docs/` | `INFRASTRUCTURE_DESIGN.md` |
| **versioning, history, audit trail** | `versioning/` | `versioning_design.md` |
| **kanban, task board, drag-drop** | `ui_components/` | `kanban.md` |
| **wiki, collaborative editing** | `wiki/` | `wiki.md`, `COLLABORATIVE_WIKI_EDITING.md` |
| **tools, scripts, db-import, test-api** | `docs/` | `tools.md` |
| **mobile, React Native, mobile app** | `mobile/` | `MOBILE_APP_DESIGN.md` |
| **performance, load testing, benchmarking** | `performance/` | `PERFORMANCE_TESTING.md` |

---

## Documentation Reading Order

### For New Developers/Agents

**Complete Platform Understanding (3-4 hours):**
```
1. /CLAUDE.md                                    (15 min) - Platform overview
2. services/ENTITY_INFRASTRUCTURE_SERVICE.md     (45 min) - Core infrastructure ⭐
3. services/UNIVERSAL_FORMATTER_SERVICE.md       (30 min) - Formatting & field detection ⭐
4. datamodel/README.md                           (30 min) - Database schema
5. api/entity_endpoint_design.md                 (60 min) - API patterns
6. ui_components/datatable.md                    (30 min) - Table system
7. settings/settings.md                          (20 min) - Settings system
8. ai_chat/AI_CHAT_SYSTEM.md                     (30 min) - AI features
```

### For Feature Development

**Building New Entity (2 hours):**
```
1. services/ENTITY_INFRASTRUCTURE_SERVICE.md - Infrastructure operations
2. datamodel/README.md - DDL patterns
3. api/entity_endpoint_design.md - API route patterns
4. ui_components/datatable.md - Table rendering
```

**Building Service Workflow (2 hours):**
```
1. service_appointment_task_work_orders/SERVICE_WORKFLOW_ARCHITECTURE.md ⭐
2. calendar/CALENDAR_SYSTEM.md
3. ai_chat/AI_CHAT_SYSTEM.md
4. mcp/MCP_ARCHITECTURE.md
```

**Building Quote System (2 hours):**
```
1. product_services_quotes/TECHNICAL_REFERENCE.md ⭐
2. product_services_quotes/FIELD_GENERATOR_GUIDE.md
3. product_services_quotes/JSONB_QUOTE_ITEMS.md
```

---

## Document Authorship Guidelines

**When creating new documentation**, follow patterns in:
- `instructionToLLM.md` - Documentation structure template
- `ai_chat/AI_CHAT_SYSTEM.md` - Example of crisp, structured documentation
- `service_appointment_task_work_orders/SERVICE_WORKFLOW_ARCHITECTURE.md` - Example of comprehensive technical documentation

**Required sections:**
1. Semantics & Business Context
2. Architecture & DRY Design Patterns
3. Database, API & UI/UX Mapping
4. Entity Relationships (if DDL changes)
5. Central Configuration & Middleware (if config/auth changes)
6. User Interaction Flow Examples
7. Critical Considerations When Building

---

## Quick Reference Card

**I need to...**

✅ **Understand the platform** → `/CLAUDE.md` + `services/ENTITY_INFRASTRUCTURE_SERVICE.md`

✅ **Add a new entity** → `services/ENTITY_INFRASTRUCTURE_SERVICE.md` + `api/entity_endpoint_design.md`

✅ **Work with database** → `datamodel/README.md`

✅ **Format fields/values** → `services/UNIVERSAL_FORMATTER_SERVICE.md`

✅ **Build a service workflow** → `service_appointment_task_work_orders/SERVICE_WORKFLOW_ARCHITECTURE.md`

✅ **Implement quotes** → `product_services_quotes/TECHNICAL_REFERENCE.md`

✅ **Add AI features** → `ai_chat/AI_CHAT_SYSTEM.md` + `mcp/MCP_ARCHITECTURE.md`

✅ **Debug RBAC** → `services/ENTITY_INFRASTRUCTURE_SERVICE.md` (RBAC section)

✅ **Deploy to AWS** → `infra_docs/INFRASTRUCTURE_DESIGN.md`

✅ **Test/troubleshoot** → `tools.md`

---

**Last Updated:** 2025-11-17 | **Platform Version:** 3.3.0 | **Total Docs:** 50+ files
