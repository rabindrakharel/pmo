# PMO MCP Implementation Guide

> **Model Context Protocol (MCP) - Complete API Reference & Next-Generation Architecture**
>
> **Version:** 5.0.0
> **Last Updated:** 2025-12-05
> **Standards:** OpenAPI 3.1.0, MCP Protocol 2025-06
> **Base URL:** `http://localhost:4000/api/v1`

---

## Executive Summary

This document provides a comprehensive guide for the PMO Model Context Protocol (MCP) implementation, covering both the current REST API specification and the next-generation dynamic tool generation architecture.

**Key Findings:**
1. **MCP is the industry standard** - Adopted by OpenAI, Google DeepMind, and Anthropic
2. **Dynamic tool generation from entity metadata** is the emerging pattern (Dynamics 365, ZenStack, ScaleMCP)
3. **Streamable HTTP (stateless)** replaces HTTP+SSE for production scaling
4. **Your entity-driven architecture is perfectly positioned** for next-gen MCP implementation

---

## Table of Contents

### Part 1: Current API Reference
1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Authentication](#3-authentication)
4. [API Categories](#4-api-categories)
5. [Common Patterns](#5-common-patterns)
6. [Error Handling](#6-error-handling)
7. [Request/Response Examples](#7-requestresponse-examples)

### Part 2: Next-Generation Architecture
8. [Industry Landscape Analysis](#8-industry-landscape-analysis)
9. [Current vs Future Approaches](#9-current-vs-future-approaches)
10. [Critical Problems to Solve](#10-critical-problems-to-solve)
11. [Next-Gen Implementation](#11-next-gen-implementation)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Production Considerations](#13-production-considerations)

---

# Part 1: Current API Reference

## 1. Overview

### What is PMO MCP?

The PMO MCP system provides a **standardized API abstraction layer** that converts the PMO Platform's 100+ REST endpoints into AI-accessible tools. It enables LLMs to execute business operations through structured function calling.

### Key Features

- ✅ **Complete API Coverage** - All 100+ endpoints across 25+ categories
- ✅ **OpenAPI 3.1.0 Compliant** - Standard REST API documentation
- ✅ **Type Safety** - Full TypeScript/JSON Schema validation
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **RBAC Integration** - Permission-aware operations
- ✅ **Auto-Enrichment** - Context-aware parameter injection

### Business Capabilities

| Category | Operations | Examples |
|----------|-----------|----------|
| **Customer Management** | Create, search, update profiles | Customer onboarding, CRM integration |
| **Project Operations** | CRUD, task linkage, budgets | Project tracking, resource allocation |
| **Task Management** | Kanban, assignments, case notes | Workflow automation, team collaboration |
| **Scheduling** | Calendar booking, availability | Appointment scheduling, resource planning |
| **Financial** | Cost tracking, invoices, revenue | Budget management, billing |
| **Documentation** | Wiki, forms, artifacts | Knowledge base, compliance |

---

## 2. Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     AI APPLICATION LAYER                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Conversational│  │ Data Extract │  │ Worker MCP   │      │
│  │    Agent      │  │    Agent     │  │    Agent     │      │
│  └──────┬────────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼────────────────────┼─────────────────┼─────────────┘
          │                    │                 │
          │         ┌──────────▼──────────┐      │
          │         │  Session Memory     │      │
          │         │  (Context Store)    │      │
          │         └──────────┬──────────┘      │
          │                    │                 │
          └────────────────────┴─────────────────▼
                               │
                    ┌──────────▼──────────┐
                    │   MCP ADAPTER       │
                    │  ┌──────────────┐   │
                    │  │ API Manifest │   │
                    │  │   (100+ EPs) │   │
                    │  └──────┬───────┘   │
                    │  ┌──────▼───────┐   │
                    │  │ Tool Gen     │   │
                    │  │ (OpenAI fmt) │   │
                    │  └──────┬───────┘   │
                    │  ┌──────▼───────┐   │
                    │  │ Enrichment   │   │
                    │  │ Middleware   │   │
                    │  └──────┬───────┘   │
                    │  ┌──────▼───────┐   │
                    │  │ HTTP Executor│   │
                    │  └──────────────┘   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────▼─────┐    ┌─────▼─────┐   ┌─────▼─────┐
        │ Customer  │    │   Task    │   │ Calendar  │
        │    API    │    │    API    │   │    API    │
        └─────┬─────┘    └─────┬─────┘   └─────┬─────┘
              │                │                │
              └────────────────▼────────────────┘
                               │
                      ┌────────▼─────────┐
                      │   PostgreSQL     │
                      │   (50 tables)    │
                      └──────────────────┘
```

### Data Flow

```
1. AI Agent → Function Call Request
2. MCP Adapter → Validate & Enrich Parameters
3. Session Memory → Inject Context Data
4. HTTP Executor → Execute REST API Call
5. API Response → Parse & Transform
6. Session Memory → Store Results
7. AI Agent → Receive Structured Response
```

---

## 3. Authentication

### Authentication Flow

```
┌──────────────────────────────────────────────────────────┐
│  POST /api/v1/auth/login                                 │
│  Body: { email, password }                               │
└───────────────────────┬──────────────────────────────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │  JWT Token Generated │
             │  { token, expiresIn }│
             └──────────┬───────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │  Store in Session Memory      │
        │  context.auth.token = "..."   │
        └───────────────┬───────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  All Subsequent API Calls   │
          │  Headers:                   │
          │    Authorization: Bearer... │
          └─────────────────────────────┘
```

### Authentication Endpoints

#### POST /api/v1/auth/login

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "manager"
  }
}
```

#### GET /api/v1/auth/profile

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "employee_id": "emp-uuid",
  "roles": ["manager", "employee"],
  "permissions": {
    "project": ["view", "create", "edit"],
    "task": ["view", "create", "edit", "delete"]
  }
}
```

---

## 4. API Categories

### 4.1 Customer Management

| Method | Path | Description | MCP Tool Name |
|--------|------|-------------|---------------|
| GET | `/api/v1/cust` | List customers | `customer_list` |
| GET | `/api/v1/cust/:id` | Get customer by ID | `customer_get` |
| POST | `/api/v1/cust` | Create customer | `customer_create` |
| PUT | `/api/v1/cust/:id` | Update customer | `customer_update` |
| DELETE | `/api/v1/cust/:id` | Delete customer | `customer_delete` |

### 4.2 Task Management

| Method | Path | Description | MCP Tool Name |
|--------|------|-------------|---------------|
| GET | `/api/v1/task` | List tasks | `task_list` |
| GET | `/api/v1/task/:id` | Get task by ID | `task_get` |
| POST | `/api/v1/task` | Create task | `task_create` |
| PUT | `/api/v1/task/:id` | Update task | `task_update` |
| DELETE | `/api/v1/task/:id` | Delete task | `task_delete` |
| GET | `/api/v1/task/kanban` | Get Kanban view | `task_get_kanban` |
| PATCH | `/api/v1/task/:id/status` | Update task status | `task_update_status` |
| POST | `/api/v1/task/:id/case-note` | Add case note | `task_add_case_note` |
| GET | `/api/v1/task/:id/activity` | Get task activity | `task_get_activity` |

### 4.3 Calendar & Booking

| Method | Path | Description | MCP Tool Name |
|--------|------|-------------|---------------|
| POST | `/api/v1/person-calendar/book` | Book appointment | `person_calendar_book` |
| GET | `/api/v1/person-calendar/search` | Search availability | `person_calendar_search` |
| GET | `/api/v1/person-calendar/:id` | Get booking details | `person_calendar_get` |
| DELETE | `/api/v1/person-calendar/:id` | Cancel booking | `person_calendar_cancel` |

### 4.4 Project Management

| Method | Path | Description | MCP Tool Name |
|--------|------|-------------|---------------|
| GET | `/api/v1/project` | List projects | `project_list` |
| GET | `/api/v1/project/:id` | Get project | `project_get` |
| POST | `/api/v1/project` | Create project | `project_create` |
| PUT | `/api/v1/project/:id` | Update project | `project_update` |
| GET | `/api/v1/project/:id/tasks` | Get project tasks | `project_get_tasks` |

### 4.5 Financial Operations

| Method | Path | Description | MCP Tool Name |
|--------|------|-------------|---------------|
| GET | `/api/v1/cost` | List cost entries | `cost_list` |
| POST | `/api/v1/cost` | Create cost entry | `cost_create` |
| GET | `/api/v1/revenue` | List revenue entries | `revenue_list` |
| GET | `/api/v1/invoice` | List invoices | `invoice_list` |

### 4.6 Entity Linkage

| Method | Path | Description | MCP Tool Name |
|--------|------|-------------|---------------|
| GET | `/api/v1/entity-linkage` | List linkages | `linkage_list` |
| POST | `/api/v1/entity-linkage` | Create linkage | `linkage_create` |
| DELETE | `/api/v1/entity-linkage/:id` | Delete linkage | `linkage_delete` |

---

## 5. Common Patterns

### 5.1 Pagination

**Query Parameters:**
```
?page=1&limit=20&offset=0
```

**Response Format:**
```json
{
  "results": [...],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasMore": true
  }
}
```

### 5.2 Filtering

**Query Parameters:**
```
?search=keyword
?active_flag=true
?dl__task_stage=in_progress
?created_after=2025-01-01
```

### 5.3 Sorting

**Query Parameters:**
```
?sort=created_ts&order=desc
?sort=name&order=asc
```

### 5.4 Auto-Enrichment

MCP automatically enriches certain tool calls with session context:

| Tool | Enrichment | Source |
|------|-----------|--------|
| `task_create` | Customer data + conversation history | Session memory |
| `customer_create` | Fine-grained address mapping | Data extraction agent |
| `person_calendar_book` | Task reference + attendees | Session context |

---

## 6. Error Handling

### Standard Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "reason": "validation failure reason"
    }
  },
  "statusCode": 400,
  "timestamp": "2025-12-05T10:30:00Z"
}
```

### Common Error Codes

| HTTP Code | Error Code | Description |
|-----------|-----------|-------------|
| 400 | `BAD_REQUEST` | Invalid request parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 403 | `FORBIDDEN` | Insufficient permissions (RBAC) |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (duplicate) |
| 422 | `VALIDATION_ERROR` | Request validation failed |
| 500 | `INTERNAL_SERVER_ERROR` | Server error |

---

## 7. Request/Response Examples

### Complete Customer Service Flow

#### Step 1: Authenticate
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
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
```

#### Step 2: Create Customer
```http
POST /api/v1/cust
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "Mike Johnson",
  "primary_phone": "+1 555 123 4567",
  "primary_address": "789 Goodrich Road",
  "city": "Minneapolis",
  "province": "Minnesota"
}
```

**Response:**
```json
{
  "id": "cust-uuid-789",
  "name": "Mike Johnson",
  "primary_phone": "+1 555 123 4567",
  "created_ts": "2025-12-05T10:30:00Z"
}
```

#### Step 3: Create Task (Auto-Enriched)
```http
POST /api/v1/task
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "Backyard assistance - Mike Johnson",
  "dl__task_stage": "backlog",
  "dl__task_priority": "high"
}
```

**MCP Auto-Enrichment (injected automatically):**
```json
{
  "name": "Backyard assistance - Mike Johnson",
  "descr": "## Customer Information\n- Name: Mike Johnson\n- Phone: +1 555 123 4567\n- Address: 789 Goodrich Road, Minneapolis\n\n## Service Request\n- Request: Backyard assistance",
  "dl__task_stage": "backlog",
  "dl__task_priority": "high",
  "metadata": {
    "customer_id": "cust-uuid-789",
    "session_id": "session-uuid"
  }
}
```

---

# Part 2: Next-Generation Architecture

## 8. Industry Landscape Analysis

### 8.1 MCP Protocol Evolution (2024-2025)

| Date | Milestone | Impact |
|------|-----------|--------|
| Nov 2024 | Anthropic launches MCP | Open standard for AI-tool integration |
| Jan 2025 | OpenAI adopts MCP | Cross-platform standardization |
| Mar 2025 | Streamable HTTP transport | Stateless servers for horizontal scaling |
| Jun 2025 | OAuth authorization + Tool annotations | Enterprise security + behavior metadata |
| Sep 2025 | MCP Registry launched | Discovery and cataloging of servers |

### 8.2 Industry Pioneers & Their Approaches

#### Microsoft Dynamics 365 MCP Server
**Pattern:** Dynamic Tool Generation from Entity Schema

```
┌─────────────────────────────────────────────────────────────┐
│  Dynamics 365 API                                            │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │   Account   │   │   Contact   │   │ Opportunity │  ...   │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘       │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────▼──────┐                          │
│                    │  Schema     │ ← Real-time introspection│
│                    │ Discovery   │                          │
│                    └──────┬──────┘                          │
│                           │                                 │
│              ┌────────────┼────────────┐                    │
│              │            │            │                    │
│        ┌─────▼────┐ ┌─────▼────┐ ┌─────▼────┐              │
│        │ _create  │ │ _read    │ │ _list    │              │
│        │ _update  │ │ _delete  │ │ _search  │              │
│        └──────────┘ └──────────┘ └──────────┘              │
└─────────────────────────────────────────────────────────────┘
```

**Strengths:** Zero manual tool definition, always in sync with schema
**Weaknesses:** Tool explosion (100+ entities = 600+ tools), no semantic grouping

#### ZenStack (Database-to-MCP)
**Pattern:** Schema-Driven Tool Generation with Access Control

```typescript
// ZModel schema defines both structure AND permissions
model Project {
  id        String   @id
  name      String
  owner     User     @relation(fields: [ownerId])

  @@allow('read', owner == auth())
  @@allow('create', auth() != null)
  @@allow('update', owner == auth())
}
```

**Innovation:** Access control policies baked into tool definitions - LLM can't even see tools it can't use.

#### ScaleMCP (Auto-Synchronizing Tool Storage)
**Pattern:** Agent-Managed Tool Memory with CRUD Operations

**Innovation:** Agents manage their own tool set dynamically, loading only what's needed.

### 8.3 Production Deployment Patterns

| Pattern | Use Case | Pros | Cons |
|---------|----------|------|------|
| **Stdio (Local)** | Development, Claude Desktop | Simple, fast | No network, single user |
| **HTTP+SSE** | Early production | Streaming support | Persistent connections, scaling issues |
| **Streamable HTTP** | Enterprise production | Stateless, horizontal scaling | Newer, less tooling |
| **WebSocket** | Real-time bidirectional | Full duplex | Connection management complexity |

**Industry Consensus (2025):** Streamable HTTP is the production standard for new deployments.

---

## 9. Current vs Future Approaches

### 9.1 Current PMO MCP Approach (v4.0.0)

```
┌─────────────────────────────────────────────────────────────┐
│                  Current Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Static Tool Definitions (100+ manually defined)            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ customer_list, customer_get, customer_create...     │    │
│  │ task_list, task_get, task_create, task_kanban...    │    │
│  │ (Manually maintained for each endpoint)             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           MCP Adapter (Manual Mapping)               │    │
│  │  • Hand-coded tool definitions                       │    │
│  │  • Static OpenAPI schemas                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Issues:**
1. **Maintenance Burden:** 100+ tool definitions manually maintained
2. **Schema Drift:** OpenAPI specs can diverge from actual API behavior
3. **No Dynamic Discovery:** New entities require manual tool creation
4. **Context Bloat:** All tools loaded regardless of task
5. **No Permission-Aware Tools:** LLM sees tools it can't use

### 9.2 Next-Generation Approach (Proposed v5.0.0)

```
┌─────────────────────────────────────────────────────────────┐
│              Next-Generation Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Entity Metadata (app.entity table)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ code: 'project', db_table: 'project', ui_label: ... │    │
│  │ code: 'task', db_table: 'task', child_codes: [...]  │    │
│  │ (27+ entities, auto-discovered)                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│              ┌────────────┼────────────┐                    │
│              │            │            │                    │
│              ▼            ▼            ▼                    │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐  │
│  │ Schema Service │ │ RBAC Service   │ │ Pattern YAML   │  │
│  │ (field types)  │ │ (permissions)  │ │ (field meta)   │  │
│  └────────────────┘ └────────────────┘ └────────────────┘  │
│              │            │            │                    │
│              └────────────┼────────────┘                    │
│                           │                                  │
│              ┌────────────▼────────────┐                    │
│              │   Dynamic Tool Factory   │                    │
│              │  • Generates tools from  │                    │
│              │    entity metadata       │                    │
│              │  • RBAC-filtered tools   │                    │
│              │  • Rich descriptions     │                    │
│              └────────────┬────────────┘                    │
│                           │                                  │
│              ┌────────────▼────────────┐                    │
│              │    MCP Server Layer      │                    │
│              │  ┌─────────────────────┐ │                    │
│              │  │ Streamable HTTP     │ │ ← Stateless       │
│              │  │ Tool Annotations    │ │ ← Behavior hints  │
│              │  │ OAuth 2.0 + RFC8707 │ │ ← Enterprise auth │
│              │  └─────────────────────┘ │                    │
│              └────────────┬────────────┘                    │
│                           │                                  │
│              ┌────────────▼────────────┐                    │
│              │  Universal CRUD Factory  │ ← Your existing!  │
│              │  (already entity-driven) │                    │
│              └─────────────────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Feature Comparison Matrix

| Feature | Current (v4) | Next-Gen (v5) | Industry Leaders |
|---------|--------------|---------------|------------------|
| Tool Definition | Manual (100+) | Auto-generated | Dynamics 365, ZenStack |
| Schema Source | Static YAML | Entity metadata | ScaleMCP |
| RBAC Integration | Post-call check | Pre-filter tools | ZenStack |
| Field Metadata | Hardcoded | YAML pattern detection | PMO unique advantage |
| Transport | HTTP REST | Streamable HTTP | Anthropic standard |
| Tool Discovery | Static list | Dynamic + semantic | ScaleMCP |
| Context Efficiency | All tools (72K tokens) | Task-relevant (5-10K) | ScaleMCP |
| Stateless Scaling | No | Yes | Anthropic production |

---

## 10. Critical Problems to Solve

### 10.1 The Tool Explosion Problem

**Problem:** With 27+ entities × 6 CRUD operations = 162+ base tools, plus child entity endpoints, you could have 200+ tools. Anthropic research shows 50+ tools consume 72K tokens (38.5% of context).

**Solution: Semantic Tool Grouping**
```typescript
// Instead of 6 individual tools per entity, create 1 composite tool:
{
  name: "entity_operation",
  description: "Perform CRUD operations on any entity",
  inputSchema: {
    type: "object",
    properties: {
      entity_type: { enum: ["project", "task", "employee", ...] },
      operation: { enum: ["list", "get", "create", "update", "delete"] },
      id: { type: "string", description: "Required for get/update/delete" },
      data: { type: "object", description: "Required for create/update" },
      filters: { type: "object", description: "Optional for list" }
    }
  }
}
```

**Token Reduction:** 162 tools → 1 tool + entity enum = ~95% reduction

### 10.2 The Permission Visibility Problem

**Problem:** LLM receives tools for operations the user can't perform, wasting context and causing failed calls.

**Solution:** RBAC-filtered tool list per user session:

```typescript
// MCP tool list handler with RBAC filtering
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  const userId = request.meta?.userId;
  const entityInfra = getEntityInfrastructure(db);
  const tools = [];

  for (const entity of ALL_ENTITIES) {
    const canCreate = await entityInfra.check_entity_rbac(
      userId, entity.code, ALL_ENTITIES_ID, Permission.CREATE
    );
    if (canCreate) {
      tools.push(generateCreateTool(entity));
    }
    // ... similar for VIEW, EDIT, DELETE
  }

  return { tools };
});
```

---

## 11. Next-Gen Implementation

### 11.1 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI APPLICATION LAYER                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ Claude Agent  │  │ OpenAI Agent  │  │ Custom Agent  │               │
│  │ (Claude Code) │  │ (GPT-4)       │  │ (LangChain)   │               │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘               │
│          │                  │                  │                        │
│          └──────────────────┼──────────────────┘                        │
│                             │                                           │
│                             ▼                                           │
│          ┌──────────────────────────────────────┐                       │
│          │      MCP Client (Anthropic SDK)      │                       │
│          │  • Streamable HTTP transport         │                       │
│          │  • OAuth 2.0 token management        │                       │
│          └──────────────────┬───────────────────┘                       │
│                             │                                           │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │
                              │ HTTPS (Streamable HTTP)
                              │
┌─────────────────────────────▼───────────────────────────────────────────┐
│                     MCP SERVER LAYER                                     │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    PMO MCP Server (TypeScript)                    │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │  Transport: Streamable HTTP (Fastify plugin or standalone) │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  │                                                                   │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │   │
│  │  │ Tool Registry │  │ Resource      │  │ Prompt        │        │   │
│  │  │ (Dynamic)     │  │ Provider      │  │ Templates     │        │   │
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘        │   │
│  │          │                  │                  │                 │   │
│  │          ▼                  ▼                  ▼                 │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │              Entity Tool Factory                            │  │   │
│  │  │  • Reads app.entity table                                  │  │   │
│  │  │  • Generates CRUD tools dynamically                        │  │   │
│  │  │  • RBAC-filters per user session                           │  │   │
│  │  │  • Rich descriptions from YAML patterns                    │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  │                                                                   │   │
│  │  ┌────────────────────────────────────────────────────────────┐  │   │
│  │  │              Tool Annotations (MCP 2025-06)                 │  │   │
│  │  │  • readOnlyHint: true/false                                │  │   │
│  │  │  • destructiveHint: true/false (DELETE operations)         │  │   │
│  │  │  • idempotentHint: true/false                              │  │   │
│  │  │  • openWorldHint: true (entity-based, extendable)          │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       │ Internal HTTP (localhost:4000)
                                       │
┌──────────────────────────────────────▼──────────────────────────────────┐
│                     PMO API LAYER (Existing)                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                  Universal CRUD Factory                           │   │
│  │  createUniversalEntityRoutes(fastify, { entityCode: 'project' }) │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                  Entity Infrastructure Service                    │   │
│  │  • create_entity() - Transactional CRUD                          │   │
│  │  • check_entity_rbac() - Permission checking                     │   │
│  │  • build_ref_data_entityInstance() - Reference resolution        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │  PostgreSQL   │  │    Redis      │  │   WebSocket   │               │
│  │  (50 tables)  │  │ (Field cache) │  │  (PubSub)     │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Dynamic Tool Generation from Entity Metadata

```typescript
// apps/mcp/src/tool-factory.ts

import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/**
 * Generate MCP tools from entity metadata
 *
 * This is the core innovation: tools are generated from the same
 * entity metadata that drives the UI, ensuring perfect consistency.
 */
export async function generateEntityTools(userId: string): Promise<MCPTool[]> {
  const entityInfra = getEntityInfrastructure(db);

  // Fetch all active entities
  const entities = await db.execute(sql`
    SELECT code, name, ui_label, descr, db_table, child_entity_codes
    FROM app.entity
    WHERE active_flag = true
    ORDER BY display_order
  `);

  const tools: MCPTool[] = [];

  for (const entity of entities) {
    const entityCode = entity.code as string;
    const label = entity.ui_label as string || entity.name as string;

    // CHECK RBAC - Only generate tools user can actually use
    const canView = await entityInfra.check_entity_rbac(
      userId, entityCode, ALL_ENTITIES_ID, Permission.VIEW
    );

    const canCreate = await entityInfra.check_entity_rbac(
      userId, entityCode, ALL_ENTITIES_ID, Permission.CREATE
    );

    // LIST TOOL
    if (canView) {
      tools.push({
        name: `${entityCode}_list`,
        description: `List ${label} records with optional filtering and pagination.`,
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 20 },
            offset: { type: 'number', default: 0 },
            search: { type: 'string' }
          }
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true
        }
      });

      tools.push({
        name: `${entityCode}_get`,
        description: `Get a single ${label} by ID.`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' }
          },
          required: ['id']
        },
        annotations: { readOnlyHint: true }
      });
    }

    // CREATE TOOL
    if (canCreate) {
      tools.push({
        name: `${entityCode}_create`,
        description: `Create a new ${label}.`,
        inputSchema: {
          type: 'object',
          properties: {
            // Dynamic properties from entity fields
          }
        },
        annotations: { readOnlyHint: false }
      });
    }
  }

  return tools;
}
```

### 11.3 Composite Tool Pattern (Maximum Token Reduction)

```typescript
// apps/mcp/src/composite-tool.ts

/**
 * Single composite tool that handles all entity operations
 *
 * Token impact: 162 individual tools (72K tokens) → 1 composite tool (~5K tokens)
 */
export const compositeEntityTool = {
  name: 'entity',
  description: `
    Universal entity management tool for all PMO data operations.

    Supported entity types: project, task, employee, customer, calendar, event,
    cost, revenue, invoice, wiki, form, artifact, role, office, business,
    worksite, interaction, booking, and more.

    Supported operations:
    - list: Get multiple records with filtering and pagination
    - get: Get a single record by ID
    - create: Create a new record
    - update: Update an existing record
    - delete: Soft delete a record

    Examples:
    - List active projects: { entity: "project", operation: "list", filters: { active: true } }
    - Get task by ID: { entity: "task", operation: "get", id: "uuid-here" }
    - Create customer: { entity: "customer", operation: "create", data: { name: "John" } }
  `,
  inputSchema: {
    type: 'object',
    properties: {
      entity: {
        type: 'string',
        description: 'Entity type code',
        enum: ['project', 'task', 'employee', 'customer', 'calendar', 'event',
               'cost', 'revenue', 'invoice', 'wiki', 'form', 'artifact',
               'role', 'office', 'business', 'worksite', 'interaction', 'booking']
      },
      operation: {
        type: 'string',
        enum: ['list', 'get', 'create', 'update', 'delete']
      },
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Entity ID (required for get, update, delete)'
      },
      data: {
        type: 'object',
        description: 'Entity data (required for create, update)'
      },
      filters: {
        type: 'object',
        description: 'Query filters (for list operation)'
      }
    },
    required: ['entity', 'operation']
  }
};
```

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: MCP Server Foundation                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Create apps/mcp/ directory structure                    │
│     ├── src/                                                │
│     │   ├── server.ts          # Fastify + MCP server       │
│     │   ├── tool-factory.ts    # Dynamic tool generation    │
│     │   ├── tool-executor.ts   # Route to REST API          │
│     │   ├── auth.ts            # OAuth/JWT validation       │
│     │   └── types.ts           # TypeScript definitions     │
│     ├── package.json                                        │
│     └── tsconfig.json                                       │
│                                                              │
│  2. Add to monorepo workspace                               │
│     pnpm-workspace.yaml: add "apps/mcp"                     │
│                                                              │
│  3. Basic Streamable HTTP transport                         │
│     - Stateless server                                      │
│     - Session ID management                                 │
│     - JWT token passthrough                                 │
│                                                              │
│  Deliverable: Working MCP server at localhost:4002/mcp      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Dynamic Tools (Week 3-4)

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Dynamic Tool Generation                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Entity metadata reader                                  │
│     - Query app.entity for active entities                  │
│     - Cache with Redis (24h TTL)                            │
│                                                              │
│  2. Field schema generator                                  │
│     - Use entity-component-metadata patterns                │
│     - Generate inputSchema from column types                │
│                                                              │
│  3. RBAC-filtered tool list                                 │
│     - Check permissions per user                            │
│     - Only show tools user can use                          │
│                                                              │
│  4. Tool executor                                           │
│     - Map tool calls to REST endpoints                      │
│     - Pass auth token through                               │
│                                                              │
│  Deliverable: Dynamic tools generated from entity metadata  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Production Hardening (Week 5-6)

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: Production Hardening                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. OAuth 2.0 + RFC 8707                                    │
│     - Authorization server discovery                        │
│     - Resource indicators                                   │
│     - Token refresh handling                                │
│                                                              │
│  2. Tool annotations                                        │
│     - readOnlyHint for list/get                             │
│     - destructiveHint for delete                            │
│     - idempotentHint for updates                            │
│                                                              │
│  3. Rate limiting and quotas                                │
│     - Per-user rate limits                                  │
│     - Token usage tracking                                  │
│                                                              │
│  4. Monitoring and logging                                  │
│     - Tool call metrics                                     │
│     - Error tracking                                        │
│     - Audit logging                                         │
│                                                              │
│  Deliverable: Production-ready MCP server                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 4: Advanced Features (Week 7-8)

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: Advanced Features                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Composite tool option                                   │
│     - Single "entity" tool for 93% token reduction          │
│     - Configurable via environment variable                 │
│                                                              │
│  2. MCP Resources                                           │
│     - entity://{code}/{id} URIs                             │
│     - datalabel://{field} for lookup tables                 │
│                                                              │
│  3. MCP Prompts                                             │
│     - Pre-defined task workflows                            │
│     - Customer service scripts                              │
│     - Project creation templates                            │
│                                                              │
│  4. Real-time updates via WebSocket                         │
│     - Integrate with existing PubSub (port 4001)            │
│     - Tool result subscriptions                             │
│                                                              │
│  Deliverable: Full-featured MCP server with resources       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. Production Considerations

### 13.1 Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────┐
│  Production Deployment Architecture                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Load Balancer (AWS ALB)                                    │
│         │                                                    │
│         ├────────────────────────────────┐                  │
│         │                                │                  │
│    ┌────▼────┐  ┌─────────┐  ┌─────────┐ │                  │
│    │ MCP 1   │  │ MCP 2   │  │ MCP 3   │ │ ← Stateless     │
│    │ :4002   │  │ :4002   │  │ :4002   │ │   (Streamable   │
│    └────┬────┘  └────┬────┘  └────┬────┘ │    HTTP)        │
│         │            │            │      │                  │
│         └────────────┼────────────┘      │                  │
│                      │                   │                  │
│              ┌───────▼───────┐           │                  │
│              │   Redis       │           │                  │
│              │ (Session/Cache)│          │                  │
│              └───────┬───────┘           │                  │
│                      │                   │                  │
│              ┌───────▼───────┐           │                  │
│              │   PMO API     │           │                  │
│              │   Cluster     │           │                  │
│              └───────────────┘           │                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 Security Checklist

| Requirement | Implementation |
|-------------|----------------|
| Authentication | OAuth 2.0 with JWT tokens |
| Authorization | RBAC via entity_infrastructure.service |
| Token Scoping | RFC 8707 Resource Indicators |
| Rate Limiting | Per-user limits (100 req/min) |
| Audit Logging | All tool calls logged to app.system_logging |
| Secret Management | Environment variables, not in code |
| Transport Security | HTTPS only in production |
| Input Validation | TypeBox schema validation |

### 13.3 Why PMO is Uniquely Positioned

Your platform has several architectural advantages for next-gen MCP:

| Feature | PMO Advantage |
|---------|---------------|
| Entity Metadata | `app.entity` table already defines all entities |
| Field Detection | YAML pattern system generates rich field metadata |
| RBAC System | `entity_rbac` provides fine-grained permissions |
| Universal CRUD | Factory generates consistent endpoints |
| Real-time Sync | WebSocket PubSub ready for tool notifications |
| Redis Caching | Field name caching pattern directly applicable |

---

## Appendix A: Complete Endpoint Reference

### Authentication (5 endpoints)
- `POST /auth/login` - `auth_login`
- `GET /auth/profile` - `auth_get_profile`
- `GET /auth/permissions` - `auth_get_permissions`
- `POST /auth/logout` - `auth_logout`
- `POST /auth/refresh` - `auth_refresh_token`

### Customer (6 endpoints)
- `GET /cust` - `customer_list`
- `GET /cust/:id` - `customer_get`
- `POST /cust` - `customer_create`
- `PUT /cust/:id` - `customer_update`
- `DELETE /cust/:id` - `customer_delete`
- `GET /cust/:id/interactions` - `customer_get_interactions`

### Task (15 endpoints)
- `GET /task` - `task_list`
- `GET /task/:id` - `task_get`
- `POST /task` - `task_create`
- `PUT /task/:id` - `task_update`
- `DELETE /task/:id` - `task_delete`
- `GET /task/kanban` - `task_get_kanban`
- `PATCH /task/:id/status` - `task_update_status`
- `POST /task/:id/case-note` - `task_add_case_note`
- `GET /task/:id/activity` - `task_get_activity`
- `GET /task/:id/attachments` - `task_get_attachments`

### Project (12 endpoints)
- `GET /project` - `project_list`
- `GET /project/:id` - `project_get`
- `POST /project` - `project_create`
- `PUT /project/:id` - `project_update`
- `GET /project/:id/tasks` - `project_get_tasks`
- `GET /project/:id/wiki` - `project_get_wiki`
- `GET /project/:id/artifacts` - `project_get_artifacts`
- `GET /project/:id/financials` - `project_get_financials`

### Calendar (5 endpoints)
- `POST /person-calendar/book` - `person_calendar_book`
- `GET /person-calendar/search` - `person_calendar_search`
- `GET /person-calendar/:id` - `person_calendar_get`
- `DELETE /person-calendar/:id` - `person_calendar_cancel`
- `GET /person-calendar/availability` - `person_calendar_availability`

### Employee (5 endpoints)
- `GET /employee` - `employee_list`
- `GET /employee/:id` - `employee_get`
- `POST /employee` - `employee_create`
- `PUT /employee/:id` - `employee_update`
- `GET /employee/:id/assignments` - `employee_get_assignments`

### Financial (8 endpoints)
- `GET /cost` - `cost_list`
- `POST /cost` - `cost_create`
- `GET /revenue` - `revenue_list`
- `POST /revenue` - `revenue_create`
- `GET /invoice` - `invoice_list`
- `POST /invoice` - `invoice_create`
- `GET /invoice/:id` - `invoice_get`
- `PUT /invoice/:id/status` - `invoice_update_status`

### Linkage (3 endpoints)
- `GET /entity-linkage` - `linkage_list`
- `POST /entity-linkage` - `linkage_create`
- `DELETE /entity-linkage/:id` - `linkage_delete`

---

## Sources

- [MCP Best Practices: Architecture & Implementation Guide](https://modelcontextprotocol.info/docs/best-practices/)
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18)
- [7 MCP Server Best Practices for Scalable AI Integrations](https://www.marktechpost.com/2025/07/23/7-mcp-server-best-practices-for-scalable-ai-integrations-in-2025/)
- [Model Context Protocol Spec Updates - Auth](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
- [Dynamics 365 MCP Server](https://lobehub.com/mcp/leon4s4-dynamics-mcp)
- [ZenStack - Database to MCP Server](https://dev.to/zenstack/turning-your-database-into-an-mcp-server-with-auth-32mp)
- [ScaleMCP: Dynamic and Auto-Synchronizing MCP Tools](https://arxiv.org/html/2505.06416v1)
- [Dynamic Tool Updates in Spring AI MCP](https://spring.io/blog/2025/05/04/spring-ai-dynamic-tool-updates-with-mcp/)
- [Anthropic Streamable HTTP Announcement](https://www.aibase.com/news/16375)

---

**Document Version:** 5.0.0
**Last Updated:** 2025-12-05
**Next Review:** After Phase 1 completion
