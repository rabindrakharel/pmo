# PMO Platform Documentation Index

> **Navigation guide for AI/LLM agents to quickly locate relevant documentation**

**Last Updated:** 2025-11-05
**Platform Version:** 3.1.1 (Production)

---

## Quick Navigation by Task Type

### 🔍 "I need to understand..."

| What You Need | Where to Look | Key File |
|---------------|---------------|----------|
| **Complete platform overview** | Root: `CLAUDE.md` | Main index with all features |
| **Database schema & entities** | `datamodel/` | `datamodel.md` (52 tables, NO foreign keys) |
| **Universal entity system (DRY)** | `entity_design_pattern/` | `universal_entity_system.md` ⭐ |
| **All API endpoints** | `entity_ui_ux_route_api.md` | Complete API reference (31+ modules) |
| **How AI chat works** | `ai_chat/` | `AI_CHAT_SYSTEM.md` (text + voice) |
| **How MCP server works** | `ai_mcp/` | `MCP_SERVER_OVERVIEW.md` (126 tools) |

### 🏗️ "I need to build..."

| What You're Building | Where to Look | Key File |
|---------------------|---------------|----------|
| **New entity type** | `entity_design_pattern/` | `universal_entity_system.md` (sections 5-6) |
| **New data table** | `datatable/` | `datatable.md` (OOP composition) |
| **New form** | `form/` | `form.md` (JSONB-based forms) |
| **Calendar/scheduling feature** | `calendar/` | `CALENDAR_SYSTEM.md` (15-min slots) |
| **Service workflow** | `service_appointment_task_work_orders/` | `SERVICE_WORKFLOW_ARCHITECTURE.md` ⭐ |
| **Quote system** | `product_services_quotes/` | `TECHNICAL_REFERENCE.md` ⭐ |
| **DAG/workflow visualization** | `dag_graph_vizualization/` | `dag_visualizer_two_use_cases.md` |
| **AI-powered feature** | `ai_chat/`, `ai_mcp/` | Both folders |

### 🐛 "I need to debug..."

| Problem Area | Where to Look | Key File |
|--------------|---------------|----------|
| **RBAC permissions** | `datamodel/` | `datamodel.md` (entity_id_rbac_map) |
| **Column consistency issues** | `entity_design_pattern/` | `COLUMN_CONSISTENCY_UPDATE.md` |
| **API not working** | Root: `tools.md` | Test scripts & troubleshooting |
| **Entity linkage broken** | Root: `UnifiedLinkageSystem.md` | d_entity_id_map patterns |
| **Settings/dropdowns** | `settings/` | `settings.md` (16 settings tables) |
| **File uploads** | `s3_service/` | `S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` |
| **Styling issues** | `styling/` | `styling_patterns.md` |

### 📋 "I need to deploy..."

| Deployment Task | Where to Look | Key File |
|-----------------|---------------|----------|
| **AWS infrastructure** | `infra_docs/` | `INFRASTRUCTURE_DESIGN.md` |
| **Deployment process** | `infra_docs/` | `DEPLOYMENT_DESIGN.md` |
| **DNS/SSL setup** | `infra_docs/` | `DNS_CONFIGURATION_GUIDE.md`, `MULTI_DOMAIN_SSL_DEPLOYMENT_GUIDE.md` |
| **Version management** | `versioning/` | `versioning_design.md` |

---

## Documentation Folders Reference

### 📁 Core Architecture & Patterns

#### `entity_design_pattern/` ⭐ **START HERE FOR ENTITY SYSTEM**
**When to use:** Understanding universal pages, inline editing, create-link-edit patterns, column consistency

**Files:**
- `universal_entity_system.md` - **Primary reference** for DRY entity architecture (3 universal pages, default-editable pattern, inline create-then-link)
- `COLUMN_CONSISTENCY_UPDATE.md` - v3.1.1 context-independent column pattern

**Keywords:** universal pages, entity config, DRY, inline editing, add row, create-link-edit, column consistency, FilteredDataTable

---

#### `datamodel/`
**When to use:** Understanding database schema, entity relationships, RBAC, table structure

**Files:**
- `datamodel.md` - Complete data model (52 tables, 13 core entities, NO foreign keys, d_entity_id_map linkage)

**Keywords:** database, schema, DDL, tables, relationships, RBAC, entity_id_rbac_map, d_entity_id_map, NO foreign keys

---

#### `datatable/`
**When to use:** Building or modifying data tables, OOP composition patterns

**Files:**
- `datatable.md` - OOP-based table system (EntityDataTable, SettingsDataTable, horizontal scrollbar with progress)

**Keywords:** datatable, OOP, composition, field-category, settings, auto-configuration, horizontal-scroll, scrollbar

---

### 📁 AI & Automation

#### `ai_chat/` ⭐ **AI CHAT SYSTEM**
**When to use:** AI-powered customer service, text chat, voice calling, booking automation

**Files:**
- `AI_CHAT_SYSTEM.md` - Complete AI chat architecture (text + voice, MCP integration, 50 tools, GPT-4/GPT-4o-realtime)

**Keywords:** AI chat, voice calling, MCP, function tools, booking automation, OpenAI, GPT-4, realtime API, chat widget, customer service

---

#### `ai_mcp/`
**When to use:** Model Context Protocol server, API exposure to AI models, tool definitions

**Files:**
- `MCP_SERVER_OVERVIEW.md` - MCP server architecture (126 API endpoints exposed as tools)
- `VOICE_AGENT_MCP_INTEGRATION.md` - Voice chat MCP integration

**Keywords:** MCP, Model Context Protocol, AI tools, API manifest, Claude integration, tool calling

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

**Keywords:** AWS, infrastructure, deployment, Terraform, DNS, SSL, EC2, S3, Lambda

---

#### `versioning/`
**When to use:** Entity versioning, history tracking, SCD Type 2, in-place versioning

**Files:**
- `versioning_design.md` - Versioning patterns (in-place vs SCD Type 2)

**Keywords:** versioning, history, audit trail, SCD Type 2, in-place versioning

---

### 📁 Feature Planning & Analysis

#### `featureadd/`
**When to use:** Architecture critique, feature suggestions, CRM extensions

**Files:**
- `ARCHITECTURE_CRITIQUE_AND_RECOMMENDATIONS.md` - Expert platform analysis (7.5/10 rating)
- `crm_featureadd.md` - CRM feature suggestions
- `suggest.md` - Feature improvement ideas

**Keywords:** architecture review, recommendations, feature planning, critique, improvements

---

### 📁 Root-Level Documents

#### Core System Documentation

| File | Purpose | When to Use |
|------|---------|-------------|
| **`entity_ui_ux_route_api.md`** | Complete API reference (31+ modules, 125+ endpoints) | Understanding API structure, routes, all layers |
| **`UnifiedLinkageSystem.md`** | Entity linkage patterns (d_entity_id_map) | Understanding parent-child relationships, linkage logic |
| **`ENTITY_OPTIONS_API.md`** | Universal dropdown/select API | Building forms, filters, dropdowns |
| **`tools.md`** | Management scripts | Daily operations (start-all.sh, db-import.sh, test-api.sh) |
| **`navigation_context.md`** | Navigation & breadcrumb system | Understanding navigation logic |
| **`core_algorithm_design_pattern.md`** | Core algorithms & patterns | Understanding platform design philosophy |
| **`component_Kanban_System.md`** | Kanban board implementation | Building kanban views, drag-drop, task boards |
| **`wiki.md`** | Collaborative wiki system | Wiki features, Quill editor, real-time editing |
| **`COLLABORATIVE_WIKI_EDITING.md`** | Real-time wiki collaboration | Multi-user wiki editing |
| **`artifacts.md`** | Artifact management system | Document/artifact versioning |
| **`instructionToLLM.md`** | Documentation guidelines | Writing new documentation |

---

## Search by Keywords

**Quick keyword lookup** - Find documentation by searching for these terms:

| Keywords | Location | Primary File |
|----------|----------|--------------|
| **universal pages, entity system, DRY** | `entity_design_pattern/` | `universal_entity_system.md` ⭐ |
| **inline editing, add row, create-link-edit** | `entity_design_pattern/` | `universal_entity_system.md` |
| **column consistency, context-independent** | `entity_design_pattern/` | `COLUMN_CONSISTENCY_UPDATE.md` ⭐ |
| **database, schema, DDL, NO foreign keys** | `datamodel/` | `datamodel.md` |
| **RBAC, permissions, entity_id_rbac_map** | `datamodel/` | `datamodel.md` |
| **linkage, parent-child, d_entity_id_map** | Root | `UnifiedLinkageSystem.md` |
| **API, endpoints, routes, modules** | Root | `entity_ui_ux_route_api.md` |
| **AI chat, voice calling, MCP, GPT-4** | `ai_chat/` | `AI_CHAT_SYSTEM.md` ⭐ |
| **MCP, Model Context Protocol, tools** | `ai_mcp/` | `MCP_SERVER_OVERVIEW.md` |
| **quote, product, service, work order** | `product_services_quotes/` | `TECHNICAL_REFERENCE.md` ⭐ |
| **service workflow, appointments, skills** | `service_appointment_task_work_orders/` | `SERVICE_WORKFLOW_ARCHITECTURE.md` ⭐ |
| **calendar, scheduling, availability** | `calendar/` | `CALENDAR_SYSTEM.md` |
| **forms, JSONB, schema, validation** | `form/` | `form.md` |
| **file upload, S3, attachments** | `s3_service/` | `S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` |
| **settings, dropdowns, workflows** | `settings/` | `settings.md` |
| **datatable, OOP, composition** | `datatable/` | `datatable.md` |
| **DAG, graph, visualization, workflow** | `dag_graph_vizualization/` | `dag_visualizer_two_use_cases.md` |
| **deployment, AWS, infrastructure** | `infra_docs/` | `INFRASTRUCTURE_DESIGN.md` |
| **versioning, history, audit trail** | `versioning/` | `versioning_design.md` |
| **kanban, task board, drag-drop** | Root | `component_Kanban_System.md` |
| **wiki, collaborative editing** | Root | `wiki.md`, `COLLABORATIVE_WIKI_EDITING.md` |
| **tools, scripts, db-import, test-api** | Root | `tools.md` |

---

## Documentation Reading Order

### For New Developers/Agents

**Complete Platform Understanding (3-4 hours):**
```
1. /CLAUDE.md                                    (15 min) - Platform overview
2. entity_design_pattern/universal_entity_system.md (45 min) - Core architecture ⭐
3. datamodel/datamodel.md                        (30 min) - Database schema
4. entity_ui_ux_route_api.md                     (60 min) - API reference
5. datatable/datatable.md                        (30 min) - Table system
6. settings/settings.md                          (20 min) - Settings system
7. ai_chat/AI_CHAT_SYSTEM.md                     (30 min) - AI features
```

### For Feature Development

**Building New Entity (2 hours):**
```
1. entity_design_pattern/universal_entity_system.md - Sections 5-6
2. datamodel/datamodel.md - DDL patterns
3. entity_ui_ux_route_api.md - API patterns
4. datatable/datatable.md - Table rendering
```

**Building Service Workflow (2 hours):**
```
1. service_appointment_task_work_orders/SERVICE_WORKFLOW_ARCHITECTURE.md ⭐
2. calendar/CALENDAR_SYSTEM.md
3. ai_chat/AI_CHAT_SYSTEM.md
4. ai_mcp/MCP_SERVER_OVERVIEW.md
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

✅ **Understand the platform** → `/CLAUDE.md` + `entity_design_pattern/universal_entity_system.md`

✅ **Add a new entity** → `entity_design_pattern/universal_entity_system.md` (Best Practices)

✅ **Work with database** → `datamodel/datamodel.md`

✅ **Build a service workflow** → `service_appointment_task_work_orders/SERVICE_WORKFLOW_ARCHITECTURE.md`

✅ **Implement quotes** → `product_services_quotes/TECHNICAL_REFERENCE.md`

✅ **Add AI features** → `ai_chat/AI_CHAT_SYSTEM.md` + `ai_mcp/MCP_SERVER_OVERVIEW.md`

✅ **Debug RBAC** → `datamodel/datamodel.md` (entity_id_rbac_map section)

✅ **Deploy to AWS** → `infra_docs/INFRASTRUCTURE_DESIGN.md`

✅ **Test/troubleshoot** → `tools.md`

---

**Last Updated:** 2025-11-05 | **Platform Version:** 3.1.1 | **Total Docs:** 40+ files
