# Entity Endpoint Design - Universal Architecture & Building Blocks

> **Central documentation for universal patterns used across ALL entity routes**
>
> Individual route files reference this document and contain only entity-specific details.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview) ⭐ **Start Here**
2. [End-to-End Request Flow](#end-to-end-request-flow)
3. [Building Blocks](#building-blocks)
4. [Required Imports](#required-imports)
5. [Design Patterns](#design-patterns)
6. [Permission Model](#permission-model)
7. [Implementation Guide](#implementation-guide)
8. [Entity Matrix](#entity-matrix)

---

## Architecture Overview

### 🎯 **Core Philosophy**

```
Database-Driven → Zero-Config → Factory-Generated → Single Source of Truth
```

**Key Principles:**
- ✅ **Database is authority** - All relationships defined in `d_entity` DDL
- ✅ **Zero boilerplate** - Routes auto-generate from metadata
- ✅ **Composable gates** - Security and filtering augment SQL, don't block requests
- ✅ **Person-based RBAC** - Direct employee + role inheritance
- ✅ **No foreign keys** - Soft deletes, temporal versioning, cross-schema flexibility

---

## End-to-End Request Flow

### 📊 **Complete Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT REQUEST LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GET /api/v1/project?active=true&dl__project_stage=planning                │
│  POST /api/v1/project?parent_type=business&parent_id={uuid}                │
│  GET /api/v1/project/{id}                                                   │
│  GET /api/v1/project/{id}/task                                              │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FASTIFY ROUTE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  AUTHENTICATION MIDDLEWARE (JWT)                                 │       │
│  │  • Extract userId from JWT token                                 │       │
│  │  • Attach to request.user.sub                                    │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                               │                                              │
│                               ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  ROUTE HANDLER (project/routes.ts)                               │       │
│  │  • Module constants: ENTITY_TYPE = 'project', TABLE_ALIAS = 'e' │       │
│  │  • Route owns SQL query building                                 │       │
│  │  • Gates augment query with security & filters                   │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUERY BUILDING LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Step 1: Initialize SQL Components                                          │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │  const joins: SQL[] = [];                                      │         │
│  │  const conditions: SQL[] = [];                                 │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                               │                                              │
│                               ▼                                              │
│  Step 2: GATE 1 - RBAC Security Filtering                                   │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │  unified_data_gate.rbac_gate.getWhereCondition()              │         │
│  │  ├─ Query: d_entity_rbac (direct permissions)            │         │
│  │  ├─ Query: d_entity_instance_link (role assignments)                 │         │
│  │  ├─ Resolve: parent-VIEW inheritance                           │         │
│  │  ├─ Resolve: parent-CREATE inheritance                         │         │
│  │  └─ Returns: SQL WHERE fragment with accessible IDs            │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                               │                                              │
│                               ▼                                              │
│  Step 3: GATE 2 - Parent-Child Context Filtering (if applicable)            │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │  if (parent_type && parent_id):                                │         │
│  │    unified_data_gate.parent_child_filtering_gate.getJoinClause()│        │
│  │    └─ Returns: SQL JOIN with d_entity_instance_link                   │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                               │                                              │
│                               ▼                                              │
│  Step 4: Auto-Filter System (Zero-Config)                                   │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │  buildAutoFilters(TABLE_ALIAS, request.query)                 │         │
│  │  ├─ Detect: dl__* → settings dropdown                          │         │
│  │  ├─ Detect: *_id → UUID reference (cast to UUID)               │         │
│  │  ├─ Detect: *_amt → currency (numeric)                         │         │
│  │  ├─ Detect: *_flag → boolean (cast)                            │         │
│  │  ├─ Detect: *_date/*_ts → date/timestamp                       │         │
│  │  ├─ Detect: search → multi-field ILIKE                         │         │
│  │  └─ Returns: Array of SQL WHERE conditions                     │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                               │                                              │
│                               ▼                                              │
│  Step 5: Compose Final SQL                                                  │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │  SELECT DISTINCT e.*                                           │         │
│  │  FROM app.d_project e                                          │         │
│  │  ${joinClause}  ← from parent-child gate                       │         │
│  │  WHERE ${sql.join(conditions, sql` AND `)}                     │         │
│  │    ↑                                                            │         │
│  │    ├─ RBAC condition (accessible IDs)                          │         │
│  │    ├─ Auto-filters (query params)                              │         │
│  │    └─ Custom filters (entity-specific)                         │         │
│  │  ORDER BY e.created_ts DESC                                    │         │
│  │  LIMIT ${limit} OFFSET ${offset}                               │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PostgreSQL 14+ Execution                                                    │
│  ├─ Execute composed SQL query                                              │
│  ├─ Server-side filtering (RBAC + context + params)                         │
│  ├─ Return filtered result set                                              │
│  └─ No N+1 queries, no client-side filtering                                │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE LAYER                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  createPaginatedResponse(data, total, limit, offset)                        │
│  {                                                                           │
│    data: [...],                                                              │
│    total: 150,                                                               │
│    limit: 20,                                                                │
│    offset: 0                                                                 │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🔄 **Child Entity Endpoint Factory Flow**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   STARTUP / MODULE INITIALIZATION                            │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
         await createChildEntityEndpointsFromMetadata(fastify, 'project')
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Query d_entity Metadata                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SELECT child_entities FROM app.d_entity                                    │
│  WHERE code = 'project' AND active_flag = true                              │
│                                                                              │
│  Returns:                                                                    │
│  {                                                                           │
│    child_entities: [                                                         │
│      { entity: 'task', ui_icon: 'CheckSquare', ui_label: 'Tasks', ... },   │
│      { entity: 'wiki', ui_icon: 'BookOpen', ui_label: 'Wiki', ... },       │
│      { entity: 'form', ui_icon: 'FileText', ui_label: 'Forms', ... },      │
│      { entity: 'artifact', ui_icon: 'Paperclip', ui_label: 'Artifacts' },  │
│      { entity: 'expense', ui_icon: 'DollarSign', ui_label: 'Expenses' },   │
│      { entity: 'revenue', ui_icon: 'TrendingUp', ui_label: 'Revenue' }     │
│    ]                                                                         │
│  }                                                                           │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: FOR EACH Child Entity (Loop)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  childEntity = 'task'                                                        │
│  ├─ Resolve table name: getEntityTableName('task') → 'd_task'              │
│  └─ Create endpoint inline: fastify.get('/api/v1/project/:id/task', ...)   │
│                                                                              │
│  childEntity = 'wiki'                                                        │
│  ├─ Resolve table name: getEntityTableName('wiki') → 'd_wiki'              │
│  └─ Create endpoint inline: fastify.get('/api/v1/project/:id/wiki', ...)   │
│                                                                              │
│  childEntity = 'form'                                                        │
│  ├─ Resolve table name: getEntityTableName('form') → 'd_form_head'         │
│  └─ Create endpoint inline: fastify.get('/api/v1/project/:id/form', ...)   │
│                                                                              │
│  ... (repeat for all child entities)                                        │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Inline Endpoint Creation (per child)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  fastify.get('/api/v1/project/:id/task', {                                  │
│    preHandler: [fastify.authenticate],                                      │
│    schema: { params: { id: UUID }, querystring: { page, limit } }           │
│  }, async (request, reply) => {                                             │
│                                                                              │
│    // Extract params                                                        │
│    const { id: parentId } = request.params;                                 │
│    const { page = 1, limit = 20 } = request.query;                          │
│    const userId = request.user.sub;                                         │
│                                                                              │
│    // GATE 1: RBAC for child entity                                         │
│    const rbacCondition = await unified_data_gate.rbac_gate                  │
│      .getWhereCondition(userId, 'task', Permission.VIEW, 'c');              │
│                                                                              │
│    // GATE 2: Parent-child filtering                                        │
│    const parentJoin = unified_data_gate.parent_child_filtering_gate         │
│      .getJoinClause('task', 'project', parentId, 'c');                      │
│                                                                              │
│    // Execute query                                                         │
│    const data = await db.execute(sql`                                       │
│      SELECT c.* FROM app.d_task c                                           │
│      ${parentJoin}                                                           │
│      WHERE ${rbacCondition} AND c.active_flag = true                        │
│      ORDER BY c.created_ts DESC                                             │
│      LIMIT ${limit} OFFSET ${(page - 1) * limit}                            │
│    `);                                                                       │
│                                                                              │
│    return { data, total, page, limit };                                     │
│  });                                                                         │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RESULT: All Child Endpoints Created                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✓ GET /api/v1/project/:id/task       - List tasks for project             │
│  ✓ GET /api/v1/project/:id/wiki       - List wiki for project              │
│  ✓ GET /api/v1/project/:id/form       - List forms for project             │
│  ✓ GET /api/v1/project/:id/artifact   - List artifacts for project         │
│  ✓ GET /api/v1/project/:id/expense    - List expenses for project          │
│  ✓ GET /api/v1/project/:id/revenue    - List revenue for project           │
│                                                                              │
│  Benefits:                                                                   │
│  • Single source of truth: d_entity table                                   │
│  • Zero boilerplate: 1 line creates all endpoints                           │
│  • Self-maintaining: Add child to d_entity → routes auto-created            │
│  • Consistent RBAC: All use unified_data_gate                               │
│  • Consistent filtering: All use parent_child_filtering_gate                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🔐 **RBAC Permission Resolution Flow**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INPUT: userId, entityType, entityId, requiredPermission                    │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Direct Employee Permissions                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SELECT permission FROM app.d_entity_rbac                              │
│  WHERE person_entity_name = 'employee'                                      │
│    AND person_entity_id = ${userId}                                         │
│    AND entity_name = ${entityType}                                          │
│    AND (entity_id = ${entityId} OR entity_id = ALL_ENTITIES_ID)            │
│    AND active_flag = true                                                   │
│    AND (expires_ts IS NULL OR expires_ts > NOW())                           │
│                                                                              │
│  Example Results:                                                            │
│  ├─ { entity_id: 'project-uuid-123', permission: 3 }  (DELETE on instance) │
│  └─ { entity_id: ALL_ENTITIES_ID, permission: 0 }     (VIEW on all)        │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Role-Based Permissions                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  -- Find employee's roles via d_entity_instance_link                               │
│  SELECT role_id FROM app.d_entity_instance_link                                    │
│  WHERE parent_entity_type = 'role'                                          │
│    AND child_entity_type = 'employee'                                       │
│    AND child_entity_id = ${userId}                                          │
│    AND active_flag = true                                                   │
│                                                                              │
│  -- Get permissions for those roles                                         │
│  SELECT permission FROM app.d_entity_rbac                              │
│  WHERE person_entity_name = 'role'                                          │
│    AND person_entity_id IN (${roleIds})                                     │
│    AND entity_name = ${entityType}                                          │
│    AND (entity_id = ${entityId} OR entity_id = ALL_ENTITIES_ID)            │
│    AND active_flag = true                                                   │
│                                                                              │
│  Example Results:                                                            │
│  ├─ Role: 'Project Manager' → { permission: 5 }  (OWNER on all projects)   │
│  └─ Role: 'Developer' → { permission: 1 }        (EDIT on all projects)    │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Parent Inheritance (VIEW & CREATE)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Rule 1: Parent VIEW → Children VIEW                                        │
│  ├─ If user has VIEW on parent (e.g., business)                            │
│  └─ Auto-grant VIEW on all children (projects, tasks, etc.)                │
│                                                                              │
│  Rule 2: Parent CREATE → Children CREATE                                    │
│  ├─ If user has CREATE on parent type (e.g., 'business' entity type)       │
│  └─ Auto-grant CREATE on all child types (project, task, etc.)             │
│                                                                              │
│  Implementation:                                                             │
│  -- Find parents via d_entity_instance_link                                        │
│  SELECT parent_entity_id FROM app.d_entity_instance_link                           │
│  WHERE child_entity_type = ${entityType}                                    │
│    AND child_entity_id = ${entityId}                                        │
│                                                                              │
│  -- Check permissions on parents                                            │
│  SELECT permission FROM app.d_entity_rbac                              │
│  WHERE entity_id IN (${parentIds})                                          │
│    AND permission >= ${Permission.VIEW}  -- or CREATE                       │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Permission Resolution (MAX wins)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Combine all permissions:                                                    │
│  ├─ Direct employee permissions                                             │
│  ├─ Role-based permissions                                                  │
│  └─ Parent-inherited permissions                                            │
│                                                                              │
│  Resolution Logic:                                                           │
│  maxPermission = MAX(direct, roleBased, parentInherited)                    │
│                                                                              │
│  Permission Hierarchy (higher number = more access):                        │
│  5 = OWNER   (full control, implies all below)                              │
│  4 = CREATE  (create new entities, type-level only)                         │
│  3 = DELETE  (soft delete, implies Share/Edit/View)                         │
│  2 = SHARE   (share with others, implies Edit/View)                         │
│  1 = EDIT    (modify entity, implies View)                                  │
│  0 = VIEW    (read-only access)                                             │
│                                                                              │
│  Check: maxPermission >= requiredPermission                                 │
│  ├─ true  → Access granted                                                  │
│  └─ false → Access denied (403)                                             │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  OUTPUT: Boolean (access granted/denied) OR SQL WHERE clause                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  check_entity_rbac() → boolean                                                │
│  ├─ Used for: Single instance checks (GET, PATCH, DELETE)                  │
│  └─ Returns: true/false                                                     │
│                                                                              │
│  getWhereCondition() → SQL fragment                                         │
│  ├─ Used for: List queries (GET with filters)                              │
│  ├─ Returns: SQL WHERE clause                                               │
│  └─ Example: "e.id = ANY(ARRAY['uuid1', 'uuid2', ...])"                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Building Blocks

### 🧱 **Layer 1: Universal Libraries** (`/lib/`)

| Library | File | Purpose | When to Use |
|---------|------|---------|-------------|
| **Unified Data Gate** | `unified-data-gate.ts` | Centralized RBAC + parent-child filtering | Every endpoint (mandatory) |
| **Auto-Filter Builder** | `universal-filter-builder.ts` | Zero-config query filtering from params | Every LIST endpoint |
| **Schema Metadata** | `universal-schema-metadata.ts` | Database schema introspection | Dynamic UIs, column detection |
| **Delete Factory** | `entity-delete-route-factory.ts` | Auto-generate DELETE endpoints | Almost all entities |
| **Child Entity Factory** | `child-entity-route-factory.ts` | Database-driven child endpoints | Entities with children |

---

### 🔧 **Layer 2: Services** (`/services/`)

| Service | File | Purpose | When to Use |
|---------|------|---------|-------------|
| **Linkage Service** | `linkage.service.ts` | Idempotent parent-child linking | Creating entities with parent context |
| **RBAC Grant Service** | `rbac-grant.service.ts` | Centralized permission grant with proper UUID handling | All entity CREATE endpoints |

---

### 🚪 **Layer 3: Unified Data Gate Components**

```
unified_data_gate (Namespace)
├─ rbac_gate (RBAC Security)
│  ├─ check_entity_rbac(db, userId, entityType, entityId, permission)
│  │  └─ Returns: boolean (access granted/denied)
│  │
│  └─ getWhereCondition(userId, entityType, permission, tableAlias)
│     └─ Returns: SQL WHERE fragment (accessible entity IDs)
│
└─ parent_child_filtering_gate (Context Filtering)
   └─ getJoinClause(childType, parentType, parentId, tableAlias)
      └─ Returns: SQL JOIN with d_entity_instance_link
```

**Key Exports:**
- `Permission` enum: `VIEW=0, EDIT=1, SHARE=2, DELETE=3, CREATE=4, OWNER=5`
- `ALL_ENTITIES_ID`: `'11111111-1111-1111-1111-111111111111'` (type-level permissions)

---

### 📐 **Layer 4: Module Structure Pattern**

Every entity module (`apps/api/src/modules/{entity}/routes.ts`) follows this structure:

```typescript
// ========================================
// IMPORTS
// ========================================
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';

// Universal libraries
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
import { createPaginatedResponse } from '../../lib/universal-schema-metadata.js';

// Factory functions
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

// Services
import { createLinkage } from '../../services/linkage.service.js';
import { grantPermission } from '../../services/rbac-grant.service.js';

// ========================================
// MODULE CONSTANTS (DRY Principle)
// ========================================
const ENTITY_TYPE = 'project';  // Used everywhere
const TABLE_ALIAS = 'e';        // Consistent SQL alias

// ========================================
// ENDPOINT IMPLEMENTATIONS
// ========================================

export async function projectRoutes(fastify: FastifyInstance) {

  // GET /api/v1/project (LIST with RBAC + filters)
  fastify.get('/api/v1/project', { ... });

  // GET /api/v1/project/:id (DETAIL with RBAC check)
  fastify.get('/api/v1/project/:id', { ... });

  // POST /api/v1/project (CREATE with linkage + RBAC grant service)
  fastify.post('/api/v1/project', { ... });

  // PATCH /api/v1/project/:id (UPDATE with RBAC check)
  fastify.patch('/api/v1/project/:id', { ... });

  // ========================================
  // FACTORY ENDPOINTS
  // ========================================

  // DELETE /api/v1/project/:id (auto-generated)
  createEntityDeleteEndpoint(fastify, ENTITY_TYPE);

  // GET /api/v1/project/:id/{child} (all child endpoints auto-generated)
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}
```

---

## Required Imports

### 📦 **Standard Import Block Template**

Copy this for any new entity route:

```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql, SQL } from 'drizzle-orm';

// Universal libraries
import {
  createPaginatedResponse,
  filterUniversalColumns
} from '../../lib/universal-schema-metadata.js';
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';

// Factory functions
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

// Services
import { createLinkage } from '../../services/linkage.service.js';
import { grantPermission } from '../../services/rbac-grant.service.js';
```

### 🎯 **What Each Import Does**

**Core Libraries:**
- `unified_data_gate` - ⭐ **Most Important** - Handles ALL security and context filtering
- `buildAutoFilters` - Zero-config query filtering (eliminates 90% of filter code)
- `createPaginatedResponse` - Standard pagination format

**Factory Functions:**
- `createEntityDeleteEndpoint` - 1 line = complete DELETE endpoint with cascading cleanup
- `createChildEntityEndpointsFromMetadata` - 1 line = all child routes from database metadata

**Services:**
- `createLinkage` - Idempotent parent-child relationship creation
- `grantPermission` - Centralized RBAC permission grant with proper UUID handling

**Constants:**
- `Permission` - Permission level enum (VIEW=0 to OWNER=5)
- `ALL_ENTITIES_ID` - UUID for type-level permissions

---

## Design Patterns

### Pattern 1: 🛡️ **UNIFIED DATA GATE** - Composable Security

**Concept**: Routes own SQL queries; gates augment with security

**Before (Old Architecture):**
```typescript
// ❌ Rigid middleware blocked requests
preHandler: [requirePermission('project', 'view')]

// Problem: Can't compose with other filters
```

**After (Current Architecture):**
```typescript
// ✅ Route builds SQL, gate augments it
const conditions: SQL[] = [];

// Add RBAC security
const rbacCondition = await unified_data_gate.rbac_gate
  .getWhereCondition(userId, ENTITY_TYPE, Permission.VIEW, TABLE_ALIAS);
conditions.push(rbacCondition);

// Add parent-child filter
if (parent_type && parent_id) {
  const parentJoin = unified_data_gate.parent_child_filtering_gate
    .getJoinClause(ENTITY_TYPE, parent_type, parent_id, TABLE_ALIAS);
  joins.push(parentJoin);
}

// Add auto-filters
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
conditions.push(...autoFilters);

// Compose final query
const query = sql`
  SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
  FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
  ${sql.join(joins, sql` `)}
  WHERE ${sql.join(conditions, sql` AND `)}
`;
```

**Benefits:**
- ✅ Composable - Combine multiple gates
- ✅ Flexible - Route controls SQL generation
- ✅ Testable - Each gate independently tested
- ✅ Efficient - Server-side filtering, no N+1

---

### Pattern 2: 🔗 **CREATE-LINK-GRANT** - Simplified Relationships

**Flow:**
1. Create entity independently
2. Link to parent via `d_entity_instance_link` (if parent context provided)
3. Auto-grant OWNER permission to creator via centralized service

**Implementation:**
```typescript
// Step 1: Create entity
const [newEntity] = await db.execute(sql`
  INSERT INTO app.d_${sql.raw(ENTITY_TYPE)} (...)
  VALUES (...) RETURNING *
`);

// Step 2: Link to parent (if context provided)
if (parent_type && parent_id) {
  await set_entity_instance_link(db, {
    parentEntityType: parent_type,
    parentEntityId: parent_id,
    childEntityType: ENTITY_TYPE,
    childEntityId: newEntity.id
  });
}

// Step 3: Grant OWNER permission to creator
await set_entity_rbac(db, {
  personEntityName: 'employee',
  personEntityId: userId,
  entityName: ENTITY_TYPE,
  entityId: newEntity.id,
  permission: Permission.OWNER
});
```

**Benefits:**
- No orphans when parent deleted (soft deletes)
- Many-to-many relationships supported
- Simpler API (no nested creation endpoints)
- Centralized RBAC grant with proper UUID handling

---

### Pattern 3: 🏭 **DATABASE-DRIVEN FACTORY** - Zero Boilerplate

**Concept**: Single source of truth in `d_entity` table

**One Line Creates All Child Endpoints:**
```typescript
await createChildEntityEndpointsFromMetadata(fastify, 'project');
```

**What It Does:**
1. Queries `d_entity.child_entities` for 'project'
2. Loops through each child (task, wiki, form, artifact, etc.)
3. Creates endpoint: `GET /api/v1/project/:id/{child}`
4. Inlines RBAC, parent-child JOIN, pagination logic

**Result**: 6 endpoints from 1 line of code!

---

### Pattern 4: 🎯 **MODULE CONSTANTS** - DRY Principle

```typescript
const ENTITY_TYPE = 'project';
const TABLE_ALIAS = 'e';
```

**Used In:**
- All RBAC checks
- All SQL queries
- All linkage operations
- All error messages

**Benefit**: Change once, updates everywhere

---

### Pattern 5: 🔮 **AUTO-FILTER SYSTEM** - Convention over Configuration

**Zero Configuration:**
```typescript
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
conditions.push(...autoFilters);
```

**Auto-Detection Rules:**
| Query Param | Detected Type | Generated SQL |
|-------------|---------------|---------------|
| `?dl__project_stage=planning` | Settings | `WHERE dl__project_stage = 'planning'` |
| `?manager_employee_id={uuid}` | UUID ref | `WHERE manager_employee_id::uuid = 'uuid'::uuid` |
| `?budget_allocated_amt=50000` | Currency | `WHERE budget_allocated_amt = 50000` |
| `?active=true` | Boolean | `WHERE active_flag = true` |
| `?search=kitchen` | Multi-field | `WHERE (name ILIKE '%kitchen%' OR ...)` |

---

### Pattern 6: 🔐 **RBAC GRANT SERVICE** - Centralized Permission Management

**Problem**: Each CREATE endpoint was manually inserting RBAC permissions with:
- ❌ Incorrect UUID casting (`::text` instead of `::uuid`)
- ❌ Missing required columns (`person_entity_name`)
- ❌ Wrong column names (`entity` vs `entity_name`)
- ❌ Duplicate boilerplate code (~18 lines per entity)

**Solution**: Centralized service with proper schema validation

```typescript
// ✅ Single service call (7 lines) instead of manual insert (18 lines)
await set_entity_rbac(db, {
  personEntityName: 'employee',
  personEntityId: userId,
  entityName: ENTITY_TYPE,
  entityId: newEntity.id,
  permission: Permission.OWNER
});
```

**Service Features:**
- ✅ Proper UUID handling with `::uuid` casting
- ✅ All 7 required columns included
- ✅ Idempotent (updates if permission exists)
- ✅ TypeScript interface for type safety
- ✅ Consistent schema across all entities
- ✅ Optional expiration timestamp support

**Full Schema:**
```sql
INSERT INTO app.d_entity_rbac (
  person_entity_name,  -- 'employee' or 'role'
  person_entity_id,    -- UUID with proper ::uuid cast
  entity_name,         -- Entity type (e.g., 'project')
  entity_id,           -- Instance UUID with proper ::uuid cast
  permission,          -- Integer 0-5
  active_flag,         -- Boolean
  expires_ts           -- Optional TIMESTAMPTZ
) VALUES (...);
```

---

### Pattern 7: 📋 **TABLE_ALIAS CONSTANT** - Maintainable SQL

**Problem**: Hardcoded table aliases in SQL queries make refactoring difficult

**Solution**: Module-level constant used throughout all queries

```typescript
// ========================================
// MODULE CONSTANTS (DRY Principle)
// ========================================
const ENTITY_TYPE = 'project';
const TABLE_ALIAS = 'e';        // ← Used everywhere

// Example: Soft delete filter (standard pattern)
fastify.get('/api/v1/project', async (request, reply) => {
  const conditions: SQL[] = [];

  // RBAC filter
  const rbacCondition = await unified_data_gate.rbac_gate
    .getWhereCondition(userId, ENTITY_TYPE, Permission.VIEW, TABLE_ALIAS);
  conditions.push(rbacCondition);

  // Soft delete filter (default: hide deleted records)
  if (!('active' in (request.query as any))) {
    conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);
  }

  // Auto-filters
  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
  conditions.push(...autoFilters);

  // Final query
  const query = sql`
    SELECT DISTINCT ${sql.raw(TABLE_ALIAS)}.*
    FROM app.d_${sql.raw(ENTITY_TYPE)} ${sql.raw(TABLE_ALIAS)}
    WHERE ${sql.join(conditions, sql` AND `)}
  `;
});
```

**Benefits:**
- ✅ Change alias once, updates everywhere
- ✅ Consistent across RBAC, filters, and queries
- ✅ Easy to refactor
- ✅ No hardcoded `e.`, `t.`, `f.` scattered throughout code

---

## Permission Model

### 🔐 **RBAC Architecture**

**Table**: `d_entity_rbac`

```sql
CREATE TABLE app.d_entity_rbac (
  person_entity_name VARCHAR(50),  -- 'employee' or 'role'
  person_entity_id UUID,            -- Employee ID or Role ID
  entity_name VARCHAR(50),          -- 'project', 'task', etc.
  entity_id UUID,                   -- Instance ID or ALL_ENTITIES_ID
  permission INTEGER,               -- 0-5 (single level, hierarchical)
  active_flag BOOLEAN,
  expires_ts TIMESTAMPTZ
);
```

**Permission Hierarchy** (automatic inheritance):
```
5 = OWNER   → Full control (implies all below)
4 = CREATE  → Create new entities (type-level only)
3 = DELETE  → Soft delete (implies Share/Edit/View)
2 = SHARE   → Share with others (implies Edit/View)
1 = EDIT    → Modify entity (implies View)
0 = VIEW    → Read-only access
```

**Resolution**:
- Direct employee permissions
- + Role-based permissions (via `d_entity_instance_link`)
- + Parent-VIEW inheritance
- + Parent-CREATE inheritance
- = MAX(all sources) wins

---

## Implementation Guide

### ✅ **Adding a New Entity - Checklist**

**1. Database (DDL)**
- [ ] Create `db/d_{entity}.ddl` with standard fields
- [ ] Add to `d_entity` table (entity_type, label, icon, child_entities)
- [ ] Run `./tools/db-import.sh`

**2. API Module**
- [ ] Create `apps/api/src/modules/{entity}/routes.ts`
- [ ] Define `ENTITY_TYPE` and `TABLE_ALIAS` constants
- [ ] Implement LIST endpoint with RBAC + auto-filters + soft delete filter
- [ ] Implement GET endpoint with instance RBAC check
- [ ] Implement POST endpoint with CREATE check + linkage + `set_entity_rbac()` service
- [ ] Implement PATCH endpoint with EDIT check
- [ ] Add `createEntityDeleteEndpoint(fastify, ENTITY_TYPE)`
- [ ] Add `await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE)`

**3. Frontend**
- [ ] Update `apps/web/src/lib/entityConfig.ts`

**4. Test**
```bash
./tools/test-api.sh GET /api/v1/{entity}
./tools/test-api.sh POST /api/v1/{entity} '{"name":"Test"}'
```

**Reference**: `apps/api/src/modules/project/routes.ts` (complete example)

---

## Entity Matrix

| Entity | Table | Child Entities |
|--------|-------|----------------|
| **Office** | `d_office` | business, employee, worksite |
| **Business** | `d_business` | project, employee, client |
| **Project** | `d_project` | task, wiki, artifact, form, expense, revenue |
| **Task** | `d_task` | artifact, wiki, form |
| **Employee** | `d_employee` | task (assigned) |
| **Role** | `d_role` | employee (via d_entity_instance_link) |

---

## 📊 **Architecture Evolution Summary**

### **Phase 1: Purged Components** ✅

| Component | Status | Impact |
|-----------|--------|--------|
| `rbac.service.ts` | ✅ Deleted | All routes use `unified-data-gate.ts` |
| Manual RBAC SQL | ✅ Removed | 80% code reduction |
| Manual filter building | ✅ Removed | 90% code reduction |
| `createChildEntityEndpoint()` (old) | ✅ Deleted | Inlined into metadata function |

### **Current Architecture** ✅

| Component | Implementation | LOC Reduction |
|-----------|----------------|---------------|
| **RBAC** | `unified_data_gate.rbac_gate` | 80% fewer lines |
| **Filtering** | `buildAutoFilters()` | 90% fewer lines |
| **Child Endpoints** | `createChildEntityEndpointsFromMetadata()` | 75% fewer lines |
| **Relationships** | `set_entity_instance_link()` | 60% fewer lines |

### **Key Improvements**

| Old Pattern | New Pattern | Benefit |
|-------------|-------------|---------|
| Middleware RBAC | Composable gates | Flexible SQL augmentation |
| Manual filters | Auto-detection | Zero-config, type-safe |
| Manual child endpoints | Database-driven | Single source of truth |
| ID list filtering | SQL fragments | Database-side filtering |

---

**Version**: 3.1.0 | **Last Updated**: 2025-11-16 | **Maintained By**: PMO Platform Team

**Changelog**:
- v3.1.0 (2025-11-16): ✨ **NEW** - Centralized RBAC grant service + TABLE_ALIAS pattern
  - Added `rbac-grant.service.ts` - centralized permission grants with proper UUID handling
  - Added Pattern 6: RBAC Grant Service documentation
  - Added Pattern 7: TABLE_ALIAS constant pattern
  - Updated CREATE-LINK-EDIT pattern to CREATE-LINK-GRANT
  - Updated all implementation examples with soft delete filter pattern
  - Updated checklist to include `set_entity_rbac()` service
- v3.0.0 (2025-11-16): 🔥 **BREAKING** - Complete architecture refactor
  - Removed `rbac.service.ts` - replaced with `unified-data-gate.ts`
  - Removed `createChildEntityEndpoint()` - inlined into `createChildEntityEndpointsFromMetadata()`
  - Added comprehensive architecture flow diagrams
  - Added detailed building blocks documentation
  - Updated all examples to reflect current patterns
- v2.3.0: Added "Required Imports" section
- v2.2.0: Corrected RBAC model (person-based)
- v2.1.0: Added Universal Auto-Filter System
- v2.0.0: Reference-based documentation
- v1.0.0: Initial documentation

**⚠️ IMPORTANT - DDL-First Architecture**:
All entity structures, RBAC models, and relationships are defined in `/db/*.ddl` files.
This documentation reflects those DDL definitions. When in doubt, consult the DDL source of truth.

---

## Quick Reference Card

**Core Files**:
- `apps/api/src/lib/unified-data-gate.ts` - ⭐ RBAC + filtering
- `apps/api/src/lib/universal-filter-builder.ts` - Auto-filters
- `apps/api/src/lib/child-entity-route-factory.ts` - Database-driven endpoints
- `apps/api/src/lib/entity-delete-route-factory.ts` - Delete factory
- `apps/api/src/services/linkage.service.ts` - Parent-child linking
- `apps/api/src/services/rbac-grant.service.ts` - Centralized permission grants
- `apps/api/src/modules/project/routes.ts` - Reference implementation

**One-Liners**:
```typescript
// Auto-filter ALL query params
const filters = buildAutoFilters(TABLE_ALIAS, request.query);

// RBAC SQL WHERE clause
const rbac = await unified_data_gate.rbac_gate.getWhereCondition(userId, type, perm, alias);

// Grant OWNER permission to creator
await set_entity_rbac(db, { personEntityName: 'employee', personEntityId: userId, entityName: type, entityId: id, permission: Permission.OWNER });

// All child endpoints from database
await createChildEntityEndpointsFromMetadata(fastify, 'project');

// DELETE endpoint
createEntityDeleteEndpoint(fastify, 'project');
```

**Constants**:
- `ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111'`
- `Permission: VIEW=0, EDIT=1, SHARE=2, DELETE=3, CREATE=4, OWNER=5`
