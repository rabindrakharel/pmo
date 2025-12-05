# PMO MCP Implementation: Industry Analysis & Next-Generation Architecture

> **Strategic Technical Analysis: Exposing Entity-Based APIs to AI Agents via MCP**
>
> **Version:** 1.0.0
> **Date:** 2025-12-05
> **Author:** Architecture Team

---

## Executive Summary

This document analyzes industry trends for exposing enterprise APIs to Large Language Models (LLMs) via the Model Context Protocol (MCP), compares existing approaches with next-generation patterns, and provides a production-grade implementation roadmap for the PMO platform.

**Key Findings:**
1. **MCP is becoming the de facto standard** - Adopted by OpenAI, Google DeepMind, and Anthropic
2. **Dynamic tool generation from entity metadata** is the emerging pattern (Dynamics 365, ZenStack, ScaleMCP)
3. **Streamable HTTP (stateless)** replaces HTTP+SSE for production scaling
4. **Tool explosion is a critical problem** - 50+ tools consume 72K tokens (38.5% of context)
5. **Your entity-driven architecture is perfectly positioned** for next-gen MCP implementation

---

## Table of Contents

1. [Industry Landscape Analysis](#1-industry-landscape-analysis)
2. [Comparison: Current vs Future Approaches](#2-comparison-current-vs-future-approaches)
3. [Critical Problems to Solve](#3-critical-problems-to-solve)
4. [Next-Generation Architecture](#4-next-generation-architecture)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Production Considerations](#6-production-considerations)

---

## 1. Industry Landscape Analysis

### 1.1 MCP Protocol Evolution (2024-2025)

| Date | Milestone | Impact |
|------|-----------|--------|
| Nov 2024 | Anthropic launches MCP | Open standard for AI-tool integration |
| Jan 2025 | OpenAI adopts MCP | Cross-platform standardization |
| Mar 2025 | Streamable HTTP transport | Stateless servers for horizontal scaling |
| Jun 2025 | OAuth authorization + Tool annotations | Enterprise security + behavior metadata |
| Sep 2025 | MCP Registry launched | Discovery and cataloging of servers |

**Key Insight:** MCP has evolved from a simple tool-calling protocol to a full enterprise integration standard with authentication, authorization, and discoverability.

### 1.2 Industry Pioneers & Their Approaches

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
│                                                             │
│  Generated Tools:                                           │
│  • dynamics_create_account                                  │
│  • dynamics_read_contact                                    │
│  • dynamics_search_opportunity_by_name                      │
└─────────────────────────────────────────────────────────────┘
```

**Strengths:**
- Zero manual tool definition
- Always in sync with schema
- Consistent CRUD patterns

**Weaknesses:**
- Tool explosion (100+ entities = 600+ tools)
- No semantic grouping
- Generic descriptions

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

```
┌─────────────────────────────────────────────────────────────┐
│                     LLM Agent                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tool Memory (limited capacity)                       │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐                    │   │
│  │  │ Tool A │ │ Tool B │ │ Tool C │  (3-5 active tools)│   │
│  │  └────────┘ └────────┘ └────────┘                    │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│     ┌───────────────────▼───────────────────┐               │
│     │        MCP Tool Retriever              │               │
│     │  • Semantic search for relevant tools  │               │
│     │  • Auto-load/unload based on task      │               │
│     └───────────────────┬───────────────────┘               │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────────┐│
│  │           MCP Server (Single Source of Truth)            ││
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ... (100+ tools)│
│  │  │ T1  │ │ T2  │ │ T3  │ │ T4  │ │ T5  │               ││
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘               ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Innovation:** Agents manage their own tool set dynamically, loading only what's needed.

### 1.3 Production Deployment Patterns

| Pattern | Use Case | Pros | Cons |
|---------|----------|------|------|
| **Stdio (Local)** | Development, Claude Desktop | Simple, fast | No network, single user |
| **HTTP+SSE** | Early production | Streaming support | Persistent connections, scaling issues |
| **Streamable HTTP** | Enterprise production | Stateless, horizontal scaling | Newer, less tooling |
| **WebSocket** | Real-time bidirectional | Full duplex | Connection management, auth complexity |

**Industry Consensus (2025):** Streamable HTTP is the production standard for new deployments.

---

## 2. Comparison: Current vs Future Approaches

### 2.1 Current PMO MCP Approach (v4.0.0)

From your existing `MCP_API_SPECIFICATION.md`:

```
┌─────────────────────────────────────────────────────────────┐
│                  Current Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Static Tool Definitions (100+ manually defined)            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ customer_list, customer_get, customer_create...     │    │
│  │ task_list, task_get, task_create, task_kanban...    │    │
│  │ project_list, project_get, project_create...        │    │
│  │ (Manually maintained for each endpoint)             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           MCP Adapter (Manual Mapping)               │    │
│  │  • Hand-coded tool definitions                       │    │
│  │  • Static OpenAPI schemas                            │    │
│  │  • Manual enrichment rules                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Fastify REST API (45 modules)              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Current Issues:**
1. **Maintenance Burden:** 100+ tool definitions manually maintained
2. **Schema Drift:** OpenAPI specs can diverge from actual API behavior
3. **No Dynamic Discovery:** New entities require manual tool creation
4. **Context Bloat:** All tools loaded regardless of task
5. **No Permission-Aware Tools:** LLM sees tools it can't use

### 2.2 Next-Generation Approach (Proposed v5.0.0)

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

### 2.3 Feature Comparison Matrix

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

## 3. Critical Problems to Solve

### 3.1 The Tool Explosion Problem

**Problem:** With 27+ entities × 6 CRUD operations = 162+ base tools, plus child entity endpoints, you could have 200+ tools. Anthropic research shows 50+ tools consume 72K tokens (38.5% of context).

**Solutions:**

#### Option A: Semantic Tool Grouping (Recommended)
```typescript
// Instead of 6 individual tools per entity:
// project_list, project_get, project_create, project_update, project_delete, project_get_tasks

// Create 1 composite tool with action parameter:
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

#### Option B: Domain-Based Tool Sets
```typescript
// Load tools by domain based on conversation context
const DOMAIN_TOOLS = {
  customer_service: ['customer_*', 'task_*', 'calendar_*'],
  project_management: ['project_*', 'task_*', 'employee_*'],
  financial: ['cost_*', 'revenue_*', 'invoice_*'],
  settings: ['datalabel_*', 'entity_*']
};

// MCP server only exposes relevant domain tools
```

#### Option C: ScaleMCP-Style Dynamic Loading
```typescript
// Agent requests tool discovery
tools: [
  {
    name: "discover_tools",
    description: "Find tools relevant to current task",
    inputSchema: {
      query: { type: "string", description: "Describe what you need to do" }
    }
  },
  {
    name: "load_tool",
    description: "Load a specific tool into active memory",
    inputSchema: {
      tool_name: { type: "string" }
    }
  }
]
```

### 3.2 The OpenAPI Spec Maintenance Problem

**Problem:** Keeping 100+ OpenAPI definitions in sync with actual API behavior is error-prone.

**Solution:** Generate OpenAPI from Universal CRUD Factory at runtime:

```typescript
// apps/api/src/plugins/openapi-generator.ts
import { ENTITY_TABLE_MAP, getTableName } from '@/lib/universal-entity-crud-factory.js';

export async function generateOpenAPISpec(entityCodes: string[]): Promise<OpenAPISpec> {
  const paths: Record<string, PathItem> = {};

  for (const entityCode of entityCodes) {
    // Get entity metadata from database
    const entity = await getEntityMetadata(entityCode);
    const fields = await getEntityFields(entityCode);

    // Generate path definitions
    paths[`/api/v1/${entityCode}`] = {
      get: generateListOperation(entity, fields),
      post: generateCreateOperation(entity, fields)
    };

    paths[`/api/v1/${entityCode}/{id}`] = {
      get: generateGetOperation(entity),
      patch: generateUpdateOperation(entity, fields),
      delete: generateDeleteOperation(entity)
    };
  }

  return { openapi: '3.1.0', paths, ... };
}
```

### 3.3 The Permission Visibility Problem

**Problem:** LLM receives tools for operations the user can't perform, wasting context and causing failed calls.

**Solution:** RBAC-filtered tool list per user session:

```typescript
// MCP tool list handler with RBAC filtering
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  const userId = request.meta?.userId;
  const entityInfra = getEntityInfrastructure(db);

  const tools = [];

  for (const entity of ALL_ENTITIES) {
    // Check CREATE permission at type level
    const canCreate = await entityInfra.check_entity_rbac(
      userId, entity.code, ALL_ENTITIES_ID, Permission.CREATE
    );

    if (canCreate) {
      tools.push(generateCreateTool(entity));
    }

    // LIST/GET always available if user has any VIEW permission
    const canView = await entityInfra.check_entity_rbac(
      userId, entity.code, ALL_ENTITIES_ID, Permission.VIEW
    );

    if (canView) {
      tools.push(generateListTool(entity));
      tools.push(generateGetTool(entity));
    }
  }

  return { tools };
});
```

---

## 4. Next-Generation Architecture

### 4.1 Complete System Architecture

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
│          │  • Tool result caching               │                       │
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
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    OAuth 2.0 + RFC 8707                           │   │
│  │  • Authorization Server discovery                                 │   │
│  │  • Resource Indicators (audience scoping)                         │   │
│  │  • JWT token validation                                           │   │
│  │  • Refresh token handling                                         │   │
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

### 4.2 Dynamic Tool Generation from Entity Metadata

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
    const description = entity.descr as string || `${label} management`;

    // ═══════════════════════════════════════════════════════════════
    // CHECK RBAC - Only generate tools user can actually use
    // ═══════════════════════════════════════════════════════════════

    const canView = await entityInfra.check_entity_rbac(
      userId, entityCode, ALL_ENTITIES_ID, Permission.VIEW
    );

    const canCreate = await entityInfra.check_entity_rbac(
      userId, entityCode, ALL_ENTITIES_ID, Permission.CREATE
    );

    // Get entity fields for schema generation
    const fields = await getEntityFields(entityCode);

    // ═══════════════════════════════════════════════════════════════
    // LIST TOOL
    // ═══════════════════════════════════════════════════════════════
    if (canView) {
      tools.push({
        name: `${entityCode}_list`,
        description: `List ${label} records with optional filtering and pagination. Returns data with metadata for field rendering.`,
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max records to return', default: 20 },
            offset: { type: 'number', description: 'Records to skip', default: 0 },
            search: { type: 'string', description: 'Search in name, code, description' },
            ...generateFilterProperties(fields),
            parent_entity_code: { type: 'string', description: 'Filter by parent entity type' },
            parent_entity_instance_id: { type: 'string', description: 'Filter by parent ID' }
          }
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: true
        }
      });

      // GET TOOL
      tools.push({
        name: `${entityCode}_get`,
        description: `Get a single ${label} by ID with full details and metadata.`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: `${label} ID` }
          },
          required: ['id']
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // CREATE TOOL
    // ═══════════════════════════════════════════════════════════════
    if (canCreate) {
      tools.push({
        name: `${entityCode}_create`,
        description: `Create a new ${label}. ${description}`,
        inputSchema: {
          type: 'object',
          properties: {
            ...generateCreateProperties(fields),
            parent_entity_code: { type: 'string', description: 'Link to parent entity type' },
            parent_entity_instance_id: { type: 'string', description: 'Link to parent ID' }
          },
          required: getRequiredFields(fields)
        },
        annotations: {
          readOnlyHint: false,
          idempotentHint: false
        }
      });
    }

    // UPDATE and DELETE tools require instance-level permission checking
    // These are generated but permission is checked at call time
    if (canView) {
      tools.push({
        name: `${entityCode}_update`,
        description: `Update an existing ${label}. Only provided fields are changed.`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: `${label} ID` },
            ...generateUpdateProperties(fields)
          },
          required: ['id']
        },
        annotations: {
          readOnlyHint: false,
          idempotentHint: true
        }
      });

      tools.push({
        name: `${entityCode}_delete`,
        description: `Delete a ${label}. This is a soft delete (sets active_flag=false).`,
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: `${label} ID` }
          },
          required: ['id']
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true
        }
      });
    }
  }

  return tools;
}

/**
 * Generate filter properties from entity fields
 * Uses the same pattern detection as entity-component-metadata.service
 */
function generateFilterProperties(fields: EntityField[]): Record<string, object> {
  const properties: Record<string, object> = {};

  for (const field of fields) {
    // Skip system fields
    if (['id', 'created_ts', 'updated_ts', 'version'].includes(field.name)) continue;

    // Datalabel fields (dl__*)
    if (field.name.startsWith('dl__')) {
      properties[field.name] = {
        type: 'string',
        description: `Filter by ${field.label} (dropdown value)`
      };
    }
    // Entity reference fields (*_id)
    else if (field.name.endsWith('_id') && field.type === 'uuid') {
      properties[field.name] = {
        type: 'string',
        format: 'uuid',
        description: `Filter by ${field.label} ID`
      };
    }
    // Boolean fields
    else if (field.type === 'boolean') {
      properties[field.name] = {
        type: 'boolean',
        description: `Filter by ${field.label}`
      };
    }
    // Date fields
    else if (field.name.endsWith('_date')) {
      properties[`${field.name}_from`] = {
        type: 'string',
        format: 'date',
        description: `${field.label} from date`
      };
      properties[`${field.name}_to`] = {
        type: 'string',
        format: 'date',
        description: `${field.label} to date`
      };
    }
  }

  return properties;
}
```

### 4.3 Streamable HTTP Transport Implementation

```typescript
// apps/mcp/src/server.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamable-http.js';
import Fastify from 'fastify';
import { generateEntityTools } from './tool-factory.js';
import { executeEntityTool } from './tool-executor.js';

const fastify = Fastify({ logger: true });

// MCP Server instance
const mcpServer = new Server({
  name: 'pmo-mcp',
  version: '5.0.0'
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// ═══════════════════════════════════════════════════════════════
// TOOL LIST HANDLER - Dynamic generation with RBAC filtering
// ═══════════════════════════════════════════════════════════════
mcpServer.setRequestHandler(ListToolsRequestSchema, async (request) => {
  // Extract user from OAuth token (injected by transport layer)
  const userId = request.meta?.userId;

  if (!userId) {
    return { tools: [] }; // No tools for unauthenticated users
  }

  // Generate tools dynamically from entity metadata
  const tools = await generateEntityTools(userId);

  return { tools };
});

// ═══════════════════════════════════════════════════════════════
// TOOL CALL HANDLER - Route to existing REST API
// ═══════════════════════════════════════════════════════════════
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const userId = request.meta?.userId;
  const token = request.meta?.accessToken;

  try {
    const result = await executeEntityTool(name, args, token);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// ═══════════════════════════════════════════════════════════════
// STREAMABLE HTTP TRANSPORT
// ═══════════════════════════════════════════════════════════════
const transport = new StreamableHTTPServerTransport({
  endpoint: '/mcp',
  sessionIdGenerator: () => crypto.randomUUID(),
});

// Mount on Fastify
fastify.all('/mcp', async (request, reply) => {
  // OAuth token validation
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization' });
  }

  const token = authHeader.substring(7);
  const user = await validateToken(token);

  // Inject user context into request meta
  request.meta = { userId: user.sub, accessToken: token };

  // Handle MCP request
  return transport.handleRequest(request.raw, reply.raw);
});

await fastify.listen({ port: 4002, host: '0.0.0.0' });
console.log('PMO MCP Server running on http://localhost:4002/mcp');
```

### 4.4 Composite Tool Pattern (Token Reduction)

For maximum context efficiency, implement a single composite tool:

```typescript
// apps/mcp/src/composite-tool.ts

/**
 * Single composite tool that handles all entity operations
 *
 * Token impact: 162 individual tools (72K tokens) → 1 composite tool (~5K tokens)
 * Trade-off: Slightly more complex tool call syntax, but 93% token reduction
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
    - Create customer: { entity: "customer", operation: "create", data: { name: "John Doe" } }
    - Update project status: { entity: "project", operation: "update", id: "uuid", data: { dl__project_stage: "in_progress" } }
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
        enum: ['list', 'get', 'create', 'update', 'delete'],
        description: 'CRUD operation to perform'
      },
      id: {
        type: 'string',
        format: 'uuid',
        description: 'Entity ID (required for get, update, delete)'
      },
      data: {
        type: 'object',
        description: 'Entity data (required for create, update)',
        additionalProperties: true
      },
      filters: {
        type: 'object',
        description: 'Query filters (for list operation)',
        properties: {
          search: { type: 'string' },
          limit: { type: 'number', default: 20 },
          offset: { type: 'number', default: 0 },
          parent_entity_code: { type: 'string' },
          parent_entity_instance_id: { type: 'string' }
        },
        additionalProperties: true  // Allow any filter field
      }
    },
    required: ['entity', 'operation']
  },
  annotations: {
    openWorldHint: true  // Extendable to new entities
  }
};

/**
 * Execute composite tool call
 */
export async function executeCompositeTool(
  args: { entity: string; operation: string; id?: string; data?: object; filters?: object },
  accessToken: string
): Promise<any> {
  const { entity, operation, id, data, filters } = args;
  const baseUrl = 'http://localhost:4000/api/v1';

  let url: string;
  let method: string;
  let body: object | undefined;

  switch (operation) {
    case 'list':
      url = `${baseUrl}/${entity}?${new URLSearchParams(filters as any)}`;
      method = 'GET';
      break;
    case 'get':
      if (!id) throw new Error('ID required for get operation');
      url = `${baseUrl}/${entity}/${id}`;
      method = 'GET';
      break;
    case 'create':
      url = `${baseUrl}/${entity}`;
      method = 'POST';
      body = data;
      break;
    case 'update':
      if (!id) throw new Error('ID required for update operation');
      url = `${baseUrl}/${entity}/${id}`;
      method = 'PATCH';
      body = data;
      break;
    case 'delete':
      if (!id) throw new Error('ID required for delete operation');
      url = `${baseUrl}/${entity}/${id}`;
      method = 'DELETE';
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  return response.json();
}
```

---

## 5. Implementation Roadmap

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

## 6. Production Considerations

### 6.1 Horizontal Scaling

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
│                                          │                  │
│  Auto-scaling based on:                  │                  │
│  • Request rate                          │                  │
│  • CPU utilization                       │                  │
│  • Response latency                      │                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Security Checklist

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

### 6.3 Monitoring Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  MCP Server Metrics (Grafana Dashboard)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tool Call Metrics:                                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Total Calls: 15,234 | Success Rate: 98.7%             │  │
│  │ Avg Latency: 156ms  | P99 Latency: 423ms              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Top Tools by Usage:                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. task_list      (4,521 calls)  ████████████████     │  │
│  │ 2. customer_get   (2,341 calls)  ████████             │  │
│  │ 3. project_create (1,234 calls)  █████                │  │
│  │ 4. calendar_book  (987 calls)    ████                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Error Rate by Tool:                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ task_delete: 3.2% (RBAC failures)                     │  │
│  │ customer_create: 1.5% (validation errors)             │  │
│  │ calendar_book: 0.8% (slot conflicts)                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Conclusion

### Key Recommendations

1. **Adopt Dynamic Tool Generation** - Leverage your existing `app.entity` metadata and `universal-entity-crud-factory.ts` to generate MCP tools automatically. This eliminates the maintenance burden of 100+ static tool definitions.

2. **Implement Streamable HTTP** - Use the stateless transport for horizontal scaling. Your existing Fastify infrastructure makes this straightforward.

3. **RBAC-Filter Tool Lists** - Use `entity-infrastructure.service.ts` to filter tools per user session. This reduces context waste and prevents permission errors.

4. **Consider Composite Tool Pattern** - For token-sensitive applications, the single composite tool reduces context usage by 93% while maintaining full functionality.

5. **Reuse Existing Infrastructure** - Your `pattern-mapping.yaml`, Redis caching, and WebSocket PubSub are all directly applicable to MCP server implementation.

### Why PMO is Uniquely Positioned

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
- [Understanding MCP HTTP+SSE Changes](https://blog.christianposta.com/ai/understanding-mcp-recent-change-around-http-sse/)
- [OpenAPI-MCP-Swagger Converter](https://medium.com/@bad.vano/how-we-built-a-universal-swagger-mcp-server-converter-solving-the-ai-context-window-problem-for-0294063b1e0f)
- [LLM Function Calling & API Integration Guide](https://futureagi.com/blogs/llm-function-calling-2025)
- [2025 AI Agent Report: Production Failures](https://dev.to/composiodev/the-2025-ai-agent-report-why-ai-agents-fail-in-production-and-the-2026-integration-roadmap-3d6n)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-05
**Next Review:** After Phase 1 completion
