# Entity Infrastructure Service - Problem Statement & Solution Architecture

**Version**: 1.0.0
**Date**: 2025-11-16
**Status**: Design Document
**Author**: System Architecture Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Current State Analysis](#current-state-analysis)
4. [Proposed Solution Architecture](#proposed-solution-architecture)
5. [Technical Design](#technical-design)
6. [Data Model](#data-model)
7. [API Reference](#api-reference)
8. [Migration Strategy](#migration-strategy)
9. [Performance Considerations](#performance-considerations)
10. [Security & RBAC Integration](#security--rbac-integration)
11. [Testing Strategy](#testing-strategy)
12. [Success Metrics](#success-metrics)

---

## Executive Summary

### The Vision

Create a **unified, centralized Entity Infrastructure Service** that acts as an **add-on helper** for entity routes, managing infrastructure tables (metadata, registry, relationships, permissions) while **routes retain full ownership** of their primary table queries (SELECT, UPDATE, INSERT, DELETE from d_project, d_task, etc.).

### The Problem

Currently, entity infrastructure operations are scattered across:
- 45+ entity route files (each 200-500 lines)
- 3+ separate service files (linkage, RBAC, data gate)
- Duplicate RBAC checks (13+ variations)
- Manual relationship management
- Inconsistent permission handling
- No unified delete operation

**Result**: 9,000+ lines of duplicate infrastructure code, inconsistent behavior, and high maintenance cost.

### The Solution

A **single, comprehensive service class** that provides **infrastructure-only operations as an add-on**:
- ✅ Infrastructure table management (d_entity, d_entity_instance_registry, d_entity_instance_link, d_entity_rbac)
- ✅ RBAC helper methods (checkPermission, grantPermission, getRbacWhereCondition)
- ✅ Relationship helpers (createLinkage, getChildEntityIds)
- ✅ Metadata helpers (getEntityTypeMetadata, validateInstanceExists)
- ❌ **DOES NOT** control route queries (SELECT/UPDATE remain in routes)
- ❌ **DOES NOT** dictate query structure (routes build their own SQL)

**Result**: 80% code reduction in infrastructure operations, 100% consistency, routes keep full control.

---

## Separation of Concerns

### 🎯 Crystal Clear Ownership

```
┌────────────────────────────────────────────────────────────────┐
│                    ENTITY ROUTES (FULL OWNERSHIP)              │
│                                                                 │
│  ✅ Routes OWN and CONTROL:                                    │
│     • Primary table queries (SELECT, UPDATE, INSERT, DELETE)   │
│     • d_project, d_task, d_business, etc.                      │
│     • Query structure and optimization                         │
│     • Column selection and JOINs                               │
│     • WHERE conditions and filters                             │
│     • Business logic and validation                            │
│     • Response formatting                                      │
│                                                                 │
│  Example - Route builds its own queries:                       │
│     const projects = await db.execute(sql`                     │
│       SELECT e.*, b.name as business_name                      │
│       FROM app.d_project e                                     │
│       LEFT JOIN app.d_business b ON e.business_id = b.id       │
│       WHERE e.active_flag = true                               │
│       AND e.budget_allocated_amt > 10000                       │
│       ORDER BY e.created_ts DESC                               │
│     `);                                                         │
│                                                                 │
└────────────────┬───────────────────────────────────────────────┘
                 │
                 │ Calls (as helper/add-on)
                 ▼
┌────────────────────────────────────────────────────────────────┐
│         ENTITY INFRASTRUCTURE SERVICE (ADD-ON HELPER)          │
│                                                                 │
│  ✅ Service ONLY manages infrastructure tables:                │
│     • d_entity (entity type metadata)                          │
│     • d_entity_instance_registry (instance registry)                 │
│     • d_entity_instance_link (relationships/linkages)                 │
│     • d_entity_rbac (permissions)                         │
│                                                                 │
│  ✅ Service provides helper methods:                           │
│     • set_entity_instance_registry() - Add to registry                     │
│     • set_entity_instance_link() - Create parent-child link               │
│     • check_entity_rbac() - RBAC check                           │
│     • set_entity_rbac_owner() - Grant OWNER permission                │
│     • get_entity_rbac_where_condition() - Generate WHERE fragment        │
│     • delete_all_entity_infrastructure() - Cleanup infrastructure on delete        │
│                                                                 │
│  ❌ Service DOES NOT:                                          │
│     • Build SELECT queries for primary tables                  │
│     • Control UPDATE queries for primary tables                │
│     • Dictate query structure or JOINs                         │
│     • Manage primary table schemas                             │
│     • Replace route business logic                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 📝 Example: Routes Own Their Queries

```typescript
// ✅ CORRECT: Route owns SELECT query, service provides RBAC helper

fastify.get('/', async (request, reply) => {
  const userId = request.user.sub;
  const { limit = 20, offset = 0 } = request.query;

  // ROUTE builds its own SELECT query
  // Service just provides RBAC WHERE condition as a helper
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, 'project', Permission.VIEW, 'e'
  );

  // ROUTE has FULL CONTROL over query structure
  const query = sql`
    SELECT
      e.*,
      b.name as business_name,
      COUNT(t.id) as task_count,
      SUM(t.budget_allocated_amt) as total_budget
    FROM app.d_project e
    LEFT JOIN app.d_business b ON e.business_id = b.id
    LEFT JOIN app.d_task t ON t.project_id = e.id
    WHERE ${rbacCondition}                    -- Helper from service
      AND e.active_flag = true                -- Route's condition
      AND e.budget_allocated_amt > 10000      -- Route's condition
    GROUP BY e.id, b.name
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const projects = await db.execute(query);
  return reply.send({ data: projects });
});

// ❌ WRONG: Service does NOT build queries for you
// Service is just an add-on helper, not a query builder
```

### 🔄 Service as Add-On Pattern

```typescript
// Routes use service as helper for infrastructure operations only

// CREATE endpoint
fastify.post('/', async (request, reply) => {
  // 1. Route owns INSERT into primary table
  const project = await db.insert(d_project)
    .values(request.body)
    .returning();

  // 2. Service adds infrastructure operations (add-on)
  await entityInfra.set_entity_instance_registry({...});      // Infrastructure helper
  await entityInfra.set_entity_rbac_owner(userId, ...);  // Infrastructure helper
  await entityInfra.set_entity_instance_link({...});         // Infrastructure helper

  return reply.send(project);
});

// UPDATE endpoint
fastify.patch('/:id', async (request, reply) => {
  // 1. Service helps with RBAC check (add-on)
  const canEdit = await entityInfra.check_entity_rbac(userId, 'project', id, Permission.EDIT);
  if (!canEdit) return reply.code(403).send({ error: 'Forbidden' });

  // 2. Route owns UPDATE query
  const updated = await db.update(d_project)
    .set({ ...request.body, updated_ts: new Date() })
    .where(eq(d_project.id, id))
    .returning();

  // 3. Service syncs infrastructure if name/code changed (add-on)
  if (request.body.name || request.body.code) {
    await entityInfra.update_entity_instance_registry(ENTITY_TYPE, id, {
      entity_name: request.body.name,
      entity_code: request.body.code
    });
  }

  return reply.send(updated);
});

// DELETE endpoint
fastify.delete('/:id', async (request, reply) => {
  // Service orchestrates infrastructure cleanup (add-on)
  // But route provides callback for primary table delete
  const result = await entityInfra.delete_all_entity_infrastructure(ENTITY_TYPE, id, {
    user_id: userId,
    primary_table_callback: async (db, entity_id) => {
      // ROUTE owns the actual DELETE query
      await db.delete(d_project).where(eq(d_project.id, entity_id));
    }
  });

  return reply.send(result);
});
```

### Key Takeaway

> **The Entity Infrastructure Service is a HELPER, not a controller.**
>
> Routes maintain **100% ownership** of their SELECT/UPDATE/INSERT/DELETE queries.
> Service provides **infrastructure add-on operations** for metadata, registry, linkages, and permissions.

---

## Problem Statement

### 1. Code Duplication Crisis

**Current State**:

```typescript
// ❌ Entity routes duplicate infrastructure operations 45+ times

// apps/api/src/modules/project/routes.ts (500 lines)
fastify.post('/', async (request, reply) => {
  // 1. RBAC check (15 lines)
  const userId = request.user.sub;
  const accessibleIds = await data_gate_EntityIdsByEntityType(userId, 'project', 4);
  if (accessibleIds.length === 0) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  // 2. Create entity (10 lines)
  const result = await db.insert(d_project).values(request.body).returning();
  const project = result[0];

  // 3. Register instance (10 lines)
  await db.execute(sql`
    INSERT INTO app.d_entity_instance_registry
    (entity_type, entity_id, entity_name, entity_code, active_flag)
    VALUES ('project', ${project.id}, ${project.name}, ${project.code}, true)
  `);

  // 4. Create linkage (15 lines)
  if (parent_type && parent_id) {
    await db.execute(sql`
      INSERT INTO app.d_entity_instance_link
      (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, active_flag)
      VALUES (${parent_type}, ${parent_id}, 'project', ${project.id}, true)
      ON CONFLICT DO UPDATE SET active_flag = true
    `);
  }

  // 5. Grant OWNER permission (10 lines)
  await db.execute(sql`
    INSERT INTO app.d_entity_rbac
    (person_entity_name, person_entity_id, entity_name, entity_id, permission, active_flag)
    VALUES ('employee', ${userId}, 'project', ${project.id}, 5, true)
  `);

  return reply.code(201).send(project);
});

// ❌ This exact pattern is duplicated in:
// - apps/api/src/modules/task/routes.ts
// - apps/api/src/modules/business/routes.ts
// - apps/api/src/modules/employee/routes.ts
// - ... 42 more files
```

**Impact**:
- **9,000+ lines** of duplicated infrastructure code
- **45 maintenance points** for a single bug fix
- **Inconsistent implementations** across entities
- **High risk** of introducing bugs

---

### 2. Scattered Infrastructure

**Current State**: Infrastructure operations spread across multiple files

```
apps/api/src/
├── lib/
│   ├── unified-data-gate.ts          (962 lines)
│   │   ├── RBAC permission checks
│   │   ├── Parent-child filtering
│   │   └── SQL WHERE condition generation
│   │
│   ├── child-entity-route-factory.ts (450 lines)
│   │   └── Factory-generated child endpoints
│   │
│   └── entity-delete-route-factory.ts (380 lines)
│       └── Delete endpoint generation
│
├── services/
│   └── linkage.service.ts            (119 lines)
│       └── Create/delete linkages only
│
└── modules/
    ├── project/routes.ts             (500 lines)
    ├── task/routes.ts                (480 lines)
    ├── business/routes.ts            (520 lines)
    └── ... (42 more entity routes)
```

**Problems**:
- No single source of truth
- Difficult to understand data flow
- Hard to maintain consistency
- No unified error handling
- Missing audit trail

---

### 3. Incomplete Operations

**Current State**: No unified delete operation

```typescript
// ❌ Routes manually implement delete logic (incomplete, inconsistent)

fastify.delete('/:id', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user.sub;

  // Some routes check permission, some don't
  const canDelete = await check_entity_rbac(userId, 'project', id, 3);
  if (!canDelete) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  // Some routes soft delete, some hard delete
  await db.update(d_project)
    .set({ active_flag: false })
    .where(eq(d_project.id, id));

  // Some routes deactivate linkages, some don't
  // Some routes remove RBAC entries, some don't
  // No cascade delete support
  // No unified cleanup

  return reply.code(204).send();
});
```

**Missing Features**:
- ❌ Unified delete operation
- ❌ Cascade delete support
- ❌ Automatic linkage cleanup
- ❌ Optional RBAC removal
- ❌ Transactional safety
- ❌ Audit logging

---

### 4. RBAC Complexity

**Current State**: RBAC checks duplicated everywhere

```typescript
// ❌ Every route manually implements RBAC checks

// Pattern 1: Manual permission check (project/routes.ts)
const accessibleIds = await data_gate_EntityIdsByEntityType(userId, 'project', 0);
if (!accessibleIds.includes(projectId)) {
  return reply.code(403).send({ error: 'Forbidden' });
}

// Pattern 2: Manual WHERE condition (task/routes.ts)
const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
  userId, 'task', Permission.VIEW, 'e'
);
const query = sql`SELECT * FROM d_task e WHERE ${rbacCondition}`;

// Pattern 3: Direct query (business/routes.ts)
const result = await db.execute(sql`
  SELECT e.* FROM d_business e
  WHERE e.id IN (
    SELECT entity_id FROM d_entity_rbac
    WHERE person_entity_id = ${userId} AND entity_name = 'business'
  )
`);

// ❌ 13+ different RBAC implementation patterns across routes
```

**Problems**:
- Inconsistent permission checks
- Risk of missing RBAC checks
- Hard to audit security
- Difficult to update permission logic

---

### 5. No Transaction Safety

**Current State**: Multi-step operations without transactions

```typescript
// ❌ Non-atomic operations (create entity + linkage + permission)

// Step 1: Create entity
const project = await db.insert(d_project).values(data).returning();

// ⚠️ If step 2 fails, we have orphaned entity with no linkage
// Step 2: Create linkage
await set_entity_instance_link(db, {
  parent_entity_type: 'business',
  parent_entity_id: businessId,
  child_entity_type: 'project',
  child_entity_id: project[0].id
});

// ⚠️ If step 3 fails, we have entity with linkage but no permissions
// Step 3: Grant permission
await db.execute(sql`
  INSERT INTO d_entity_rbac ...
`);

// ❌ No rollback on failure
// ❌ Inconsistent state possible
```

**Risks**:
- Orphaned entities
- Broken relationships
- Missing permissions
- Inconsistent database state

---

## Current State Analysis

### Infrastructure Tables

```sql
-- 1. Entity Type Metadata (d_entity)
CREATE TABLE app.d_entity (
  code VARCHAR(50) PRIMARY KEY,              -- Entity type identifier
  name VARCHAR(100) NOT NULL,                -- Display name
  ui_label VARCHAR(100),                     -- Frontend label
  ui_icon VARCHAR(50),                       -- Icon identifier
  child_entities JSONB,                      -- Child entity metadata
  display_order INTEGER,                     -- UI ordering
  active_flag BOOLEAN DEFAULT true,          -- Enable/disable entity type
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Entity Instance Registry (d_entity_instance_registry)
CREATE TABLE app.d_entity_instance_registry (
  entity_type VARCHAR(50) NOT NULL,          -- FK to d_entity.code
  entity_id UUID NOT NULL,                   -- Instance UUID
  order_id INTEGER DEFAULT 0,                -- Display ordering
  entity_name VARCHAR(500),                  -- Instance name (cached)
  entity_code VARCHAR(100),                  -- Instance code (cached)
  active_flag BOOLEAN DEFAULT true,          -- Soft delete flag
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id),
  UNIQUE (entity_type, entity_id)
);

-- 3. Entity Relationships (d_entity_instance_link)
CREATE TABLE app.d_entity_instance_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_entity_type VARCHAR(50) NOT NULL,   -- Parent entity type
  parent_entity_id UUID NOT NULL,            -- Parent instance UUID
  child_entity_type VARCHAR(50) NOT NULL,    -- Child entity type
  child_entity_id UUID NOT NULL,             -- Child instance UUID
  relationship_type VARCHAR(50) DEFAULT 'contains',
  active_flag BOOLEAN DEFAULT true,          -- Soft delete flag
  from_ts TIMESTAMPTZ DEFAULT NOW(),
  to_ts TIMESTAMPTZ,
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  UNIQUE (parent_entity_type, parent_entity_id, child_entity_type, child_entity_id)
);

-- 4. Entity Permissions (d_entity_rbac)
CREATE TABLE app.d_entity_rbac (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_entity_name VARCHAR(50),            -- 'employee' or 'role'
  person_entity_id UUID NOT NULL,            -- Employee/Role UUID
  entity_name VARCHAR(50) NOT NULL,          -- Entity type
  entity_id UUID NOT NULL,                   -- Instance UUID or ALL_ENTITIES_ID
  permission INTEGER NOT NULL,               -- 0-5 (VIEW to OWNER)
  active_flag BOOLEAN DEFAULT true,
  expires_ts TIMESTAMPTZ,
  created_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_ts TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_entity_name, person_entity_id, entity_name, entity_id)
);
```

### Current Services

```typescript
// 1. Linkage Service (linkage.service.ts) - 119 lines
export async function set_entity_instance_link(db, params): Promise<Linkage> {
  // Idempotent linkage creation
  // Reactivates if exists
  // Returns existing if active
}

export async function delete_entity_instance_link(db, linkageId): Promise<Linkage> {
  // Soft delete linkage
}

// 2. Unified Data Gate (unified-data-gate.ts) - 962 lines
export const unified_data_gate = {
  rbac_gate: {
    getFilteredIds(),      // Returns accessible entity IDs
    getWhereCondition(),   // Returns SQL WHERE fragment
    check_entity_rbac(),     // Boolean permission check
    gate: {
      create(),            // Throws 403 if denied
      update(),            // Throws 403 if denied
      delete()             // Throws 403 if denied
    }
  },
  parent_child_filtering_gate: {
    getJoinClause(),       // Returns SQL JOIN fragment
    getFilteredEntities()  // LEGACY: Full query builder
  }
};

// 3. Entity Delete Factory (entity-delete-route-factory.ts) - 380 lines
export function createEntityDeleteEndpoint(
  fastify,
  entityType,
  callback
) {
  // Factory-generated DELETE endpoint
  // Limited functionality
}
```

### Pain Points Summary

| Category | Current State | Pain Level | Impact |
|----------|--------------|------------|---------|
| **Code Duplication** | 9,000+ lines duplicated | 🔴 Critical | High maintenance cost |
| **Scattered Logic** | 4 files, 45+ routes | 🔴 Critical | Hard to maintain |
| **RBAC Consistency** | 13+ patterns | 🔴 Critical | Security risk |
| **Delete Operations** | Incomplete, inconsistent | 🟠 High | Data integrity risk |
| **Transaction Safety** | No transactions | 🟠 High | Inconsistent state |
| **Audit Trail** | No centralized logging | 🟡 Medium | Compliance risk |
| **Error Handling** | Inconsistent | 🟡 Medium | Poor UX |

---

## Proposed Solution Architecture

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     ENTITY ROUTES LAYER                         │
│   (45+ entity modules - project, task, business, etc.)         │
│                                                                 │
│   ✅ ROUTES OWN (100% Control):                                │
│      • SELECT queries (custom JOINs, filters, aggregations)    │
│      • UPDATE queries (custom logic, validations)              │
│      • INSERT queries (custom defaults, transformations)       │
│      • DELETE queries (soft/hard delete logic)                 │
│      • Primary tables (d_project, d_task, d_business, etc.)    │
│      • Business logic and validation                           │
│      • Response formatting                                     │
│                                                                 │
└────────────────┬───────────────────────────────────────────────┘
                 │
                 │ Calls (as helper/add-on only)
                 ▼
┌────────────────────────────────────────────────────────────────┐
│    ENTITY INFRASTRUCTURE SERVICE (ADD-ON HELPER - NEW)         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 1. Metadata Management (d_entity)                        │ │
│  │    • get_entity()                             │ │
│  │    • getAllEntityTypes()                                 │ │
│  │    • getActiveChildEntities()                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 2. Instance Registry (d_entity_instance_registry)              │ │
│  │    • set_entity_instance_registry()                                  │ │
│  │    • update_entity_instance_registry()                            │ │
│  │    • deactivate_entity_instance_registry()                                │ │
│  │    • validate_entity_instance_registry()                            │ │
│  │    • searchInstances()                                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 3. Relationship Management (d_entity_instance_link)             │ │
│  │    • set_entity_instance_link()                                     │ │
│  │    • delete_entity_instance_link()                                     │ │
│  │    • getEntityLinkages()                                 │ │
│  │    • get_entity_instance_link_children()                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 4. Permission Management (d_entity_rbac)            │ │
│  │    • check_entity_rbac()                                   │ │
│  │    • set_entity_rbac()                                   │ │
│  │    • set_entity_rbac_owner()                                    │ │
│  │    • delete_entity_rbac()                                  │ │
│  │    • getUserPermission()                                 │ │
│  │    • getEntityPermissions()                              │ │
│  │    • get_entity_rbac_where_condition()                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 5. Unified Delete Operation (ALL tables)                 │ │
│  │    • delete_all_entity_infrastructure() - Orchestrates:                      │ │
│  │      ├─► RBAC check                                      │ │
│  │      ├─► Cascade delete children (optional)              │ │
│  │      ├─► Deactivate registry                             │ │
│  │      ├─► Deactivate linkages                             │ │
│  │      ├─► Remove RBAC entries (optional)                  │ │
│  │      └─► Delete from primary table (callback)            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 6. Data Gate Integration (unified-data-gate.ts)          │ │
│  │    • Delegates to existing unified_data_gate             │ │
│  │    • Provides convenience wrappers                       │ │
│  │    • Maintains backward compatibility                    │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────┬───────────────────────────────────────────────┘
                 │
                 │ Operates on
                 ▼
┌────────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                               │
│                                                                 │
│  • app.d_entity (metadata)                                     │
│  • app.d_entity_instance_registry (registry)                         │
│  • app.d_entity_instance_link (relationships)                         │
│  • app.d_entity_rbac (permissions)                        │
│  • app.d_project, d_task, etc. (primary tables)               │
└────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Add-On Pattern**: Service is a HELPER, routes maintain 100% ownership of their queries
2. **Infrastructure Only**: Service manages 4 infrastructure tables, routes own primary tables
3. **No Query Building**: Service does NOT build SELECT/UPDATE queries for routes
4. **RBAC Helpers**: Service provides permission checks and WHERE conditions as helpers
5. **Backward Compatible**: Delegates to existing unified-data-gate for RBAC resolution
6. **Transaction Safe**: All multi-step operations wrapped in transactions
7. **DRY Architecture**: Zero duplication in infrastructure operations
8. **Composable**: Routes choose which helpers to use (optional, à la carte)

---

## Technical Design

### Service Class Structure

```typescript
/**
 * Entity Infrastructure Service
 *
 * Centralized management of entity metadata, registry, relationships,
 * and permissions across the PMO platform.
 *
 * @example
 * const entityInfra = getEntityInfrastructure(db);
 *
 * // Simple operations
 * await entityInfra.set_entity_instance_registry({...});
 * await entityInfra.set_entity_instance_link({...});
 *
 * // Complex operations
 * await entityInfra.delete_all_entity_infrastructure('project', projectId, {
 *   user_id: userId,
 *   cascade_delete_children: true
 * });
 */
export class EntityInfrastructureService {
  private db: DB;
  private metadataCache: Map<string, EntityTypeMetadata>;
  private unifiedDataGate: typeof unified_data_gate;

  constructor(db: DB) {
    this.db = db;
    this.metadataCache = new Map();
    this.unifiedDataGate = unified_data_gate; // Delegate to existing
  }

  // ========================================================================
  // SECTION 1: Entity Type Metadata (d_entity)
  // ========================================================================

  /**
   * Get entity type metadata
   * @returns Cached metadata with 5-minute TTL
   */
  async get_entity(
    entity_type: string,
    include_inactive = false
  ): Promise<EntityTypeMetadata | null>

  /**
   * Get all entity types
   * @param include_inactive Include disabled entities (for Settings page)
   */
  async getAllEntityTypes(
    include_inactive = false
  ): Promise<EntityTypeMetadata[]>

  /**
   * Get active child entities for parent type
   * Filters child_entities array by active_flag
   */
  async getActiveChildEntities(
    parent_entity_type: string
  ): Promise<Array<{ entity: string; label: string; icon?: string }>>

  // ========================================================================
  // SECTION 2: Instance Registry (d_entity_instance_registry)
  // ========================================================================

  /**
   * Register entity instance in global registry
   * Upserts if exists (updates metadata, reactivates)
   */
  async set_entity_instance_registry(params: {
    entity_type: string;
    entity_id: string;
    entity_name: string;
    entity_code?: string | null;
  }): Promise<EntityInstance>

  /**
   * Update instance metadata (name/code)
   * Called when entity fields change
   */
  async update_entity_instance_registry(
    entity_type: string,
    entity_id: string,
    updates: { entity_name?: string; entity_code?: string | null }
  ): Promise<EntityInstance>

  /**
   * Deactivate instance (soft delete from registry)
   */
  async deactivate_entity_instance_registry(
    entity_type: string,
    entity_id: string
  ): Promise<EntityInstance>

  /**
   * Validate instance exists in registry
   */
  async validate_entity_instance_registry(
    entity_type: string,
    entity_id: string,
    require_active = true
  ): Promise<boolean>

  /**
   * Get instance counts by entity type
   */
  async getInstanceCounts(
    entity_types?: string[]
  ): Promise<Array<{ entity_type: string; count: number }>>

  /**
   * Search instances across entity types
   * Full-text search on name and code
   */
  async searchInstances(
    searchQuery: string,
    options?: { entity_types?: string[]; limit?: number }
  ): Promise<EntityInstance[]>

  // ========================================================================
  // SECTION 3: Relationship Management (d_entity_instance_link)
  // ========================================================================

  /**
   * Create parent-child linkage (idempotent)
   * Validates both entities exist in registry
   * Reactivates if exists
   */
  async set_entity_instance_link(params: {
    parent_entity_type: string;
    parent_entity_id: string;
    child_entity_type: string;
    child_entity_id: string;
    relationship_type?: string;
  }): Promise<EntityRelationship>

  /**
   * Delete linkage (soft delete)
   */
  async delete_entity_instance_link(
    linkage_id: string
  ): Promise<EntityRelationship>

  /**
   * Get entity linkages
   * @param options.as_parent Get linkages where entity is parent
   * @param options.as_child Get linkages where entity is child
   */
  async getEntityLinkages(
    entity_type: string,
    entity_id: string,
    options?: {
      as_parent?: boolean;
      as_child?: boolean;
      include_inactive?: boolean;
    }
  ): Promise<EntityRelationship[]>

  /**
   * Get child entity IDs of specific type
   * Used for parent-child filtering
   */
  async get_entity_instance_link_children(
    parent_entity_type: string,
    parent_entity_id: string,
    child_entity_type: string
  ): Promise<string[]>

  // ========================================================================
  // SECTION 4: Permission Management (d_entity_rbac)
  // ========================================================================

  /**
   * Check if user has specific permission on entity
   * Delegates to unified-data-gate for full permission resolution
   */
  async check_entity_rbac(
    user_id: string,
    entity_type: string,
    entity_id: string,
    required_permission: Permission
  ): Promise<boolean>

  /**
   * Grant permission to user on entity
   * Uses GREATEST to preserve higher permissions
   */
  async set_entity_rbac(
    user_id: string,
    entity_type: string,
    entity_id: string,
    permission_level: Permission
  ): Promise<EntityPermission>

  /**
   * Grant OWNER permission (highest level)
   * Called automatically when creating entity
   */
  async set_entity_rbac_owner(
    user_id: string,
    entity_type: string,
    entity_id: string
  ): Promise<EntityPermission>

  /**
   * Revoke all permissions for user on entity
   */
  async delete_entity_rbac(
    user_id: string,
    entity_type: string,
    entity_id: string
  ): Promise<void>

  /**
   * Get user's permission level on entity
   * Returns highest permission from all sources
   */
  async getUserPermission(
    user_id: string,
    entity_type: string,
    entity_id: string
  ): Promise<Permission | null>

  /**
   * Get all permissions for an entity
   */
  async getEntityPermissions(
    entity_type: string,
    entity_id: string
  ): Promise<EntityPermission[]>

  /**
   * Get SQL WHERE condition for RBAC filtering
   * Delegates to unified-data-gate
   */
  async get_entity_rbac_where_condition(
    user_id: string,
    entity_type: string,
    required_permission: Permission,
    table_alias: string = 'e'
  ): Promise<string>

  // ========================================================================
  // SECTION 5: Unified Delete Operation
  // ========================================================================

  /**
   * Unified entity delete operation
   *
   * Orchestrates deletion across all infrastructure tables:
   * 1. Check DELETE permission
   * 2. Optionally cascade delete children
   * 3. Deactivate in d_entity_instance_registry
   * 4. Deactivate linkages in d_entity_instance_link
   * 5. Optionally remove RBAC entries
   * 6. Optionally delete from primary table
   *
   * @example
   * // Simple soft delete
   * await entityInfra.delete_all_entity_infrastructure('project', projectId, {
   *   user_id: userId
   * });
   *
   * // Hard delete with cascade
   * await entityInfra.delete_all_entity_infrastructure('project', projectId, {
   *   user_id: userId,
   *   hard_delete: true,
   *   cascade_delete_children: true,
   *   primary_table_callback: async (db, id) => {
   *     await db.delete(d_project).where(eq(d_project.id, id));
   *   }
   * });
   */
  async delete_all_entity_infrastructure(
    entity_type: string,
    entity_id: string,
    options: DeleteEntityOptions
  ): Promise<DeleteEntityResult>
}
```

### Type Definitions

```typescript
export interface EntityTypeMetadata {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  child_entities: Array<{ entity: string; label: string; icon?: string }>;
  display_order: number;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
}

export interface EntityInstance {
  entity_type: string;
  entity_id: string;
  order_id: number;
  entity_name: string;
  entity_code: string | null;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
}

export interface EntityRelationship {
  id: string;
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type: string;
  active_flag: boolean;
  created_ts: string;
  updated_ts: string;
}

export interface EntityPermission {
  id: string;
  person_entity_name: string;
  person_entity_id: string;
  entity_name: string;
  entity_id: string;
  permission: number;
  active_flag: boolean;
  expires_ts: string | null;
  created_ts: string;
  updated_ts: string;
}

export enum Permission {
  VIEW = 0,
  EDIT = 1,
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
  OWNER = 5
}

export interface DeleteEntityOptions {
  user_id: string;
  hard_delete?: boolean;              // true = DELETE, false = soft delete
  cascade_delete_children?: boolean;  // Delete child entities recursively
  remove_rbac_entries?: boolean;      // Remove permission entries
  skip_rbac_check?: boolean;          // Skip permission validation
  primary_table_callback?: (db: DB, entity_id: string) => Promise<void>;
}

export interface DeleteEntityResult {
  success: boolean;
  entity_type: string;
  entity_id: string;
  registry_deactivated: boolean;
  linkages_deactivated: number;
  rbac_entries_removed: number;
  primary_table_deleted: boolean;
  children_deleted?: number;
}

export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
```

---

## Data Model

### Table Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        d_entity                                  │
│                   (Entity Type Metadata)                         │
│  • code (PK) - Entity type identifier                           │
│  • child_entities JSONB - Child entity metadata                 │
│  • active_flag - Enable/disable entity type                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Referenced by
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  d_entity_instance_registry                            │
│                   (Instance Registry)                            │
│  • entity_type (FK to d_entity.code)                            │
│  • entity_id - Instance UUID                                    │
│  • entity_name - Cached for search                              │
│  • entity_code - Cached for search                              │
│  • active_flag - Soft delete                                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Referenced by
                 ├─────────────────────────────────┐
                 │                                  │
                 ▼                                  ▼
┌──────────────────────────────────┐  ┌──────────────────────────┐
│      d_entity_instance_link              │  │   d_entity_rbac     │
│     (Relationships)               │  │     (Permissions)        │
│  • parent_entity_type             │  │  • entity_name           │
│  • parent_entity_id               │  │  • entity_id             │
│  • child_entity_type              │  │  • person_entity_id      │
│  • child_entity_id                │  │  • permission (0-5)      │
│  • relationship_type              │  │  • active_flag           │
│  • active_flag                    │  │  • expires_ts            │
└──────────────────────────────────┘  └──────────────────────────┘
```

### Data Flow Diagram

```
CREATE Operation:
┌─────────────┐
│ Entity Route│
│  (POST)     │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│  EntityInfrastructureService.set_entity_instance_registry()        │
│  1. Insert into d_entity_instance_registry                   │
└──────┬─────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│  EntityInfrastructureService.set_entity_instance_link()           │
│  2. Insert into d_entity_instance_link                        │
└──────┬─────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│  EntityInfrastructureService.set_entity_rbac_owner()          │
│  3. Insert into d_entity_rbac                     │
└────────────────────────────────────────────────────────┘

DELETE Operation:
┌─────────────┐
│ Entity Route│
│  (DELETE)   │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│  EntityInfrastructureService.delete_all_entity_infrastructure()            │
│  Orchestrates:                                         │
│  1. check_entity_rbac() - RBAC check                     │
│  2. CASCADE: Recursive delete_all_entity_infrastructure() for children     │
│  3. UPDATE d_entity_instance_registry (soft delete)          │
│  4. UPDATE d_entity_instance_link (deactivate linkages)       │
│  5. DELETE FROM d_entity_rbac (optional)          │
│  6. primary_table_callback() (optional)                │
└────────────────────────────────────────────────────────┘
```

---

## API Reference

### Singleton Export

```typescript
// Singleton pattern for service instantiation
let serviceInstance: EntityInfrastructureService | null = null;

export function getEntityInfrastructure(db: DB): EntityInfrastructureService {
  if (!serviceInstance) {
    serviceInstance = new EntityInfrastructureService(db);
  }
  return serviceInstance;
}
```

### Usage in Entity Routes

#### Before (Manual Infrastructure)

```typescript
// ❌ BEFORE: 60+ lines of manual infrastructure code

import { db } from '@/db/index.js';
import { d_project } from '@/db/schema';
import { unified_data_gate, Permission } from '@/lib/unified-data-gate.js';
import { createLinkage } from '@/services/linkage.service.js';

fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;
  const { parent_type, parent_id } = request.query;

  // 1. RBAC check (10 lines)
  const canCreate = await unified_data_gate.rbac_gate.check_entity_rbac(
    db, userId, 'project', ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  // 2. Create entity (5 lines)
  const result = await db.insert(d_project)
    .values(request.body)
    .returning();
  const project = result[0];

  // 3. Register instance (15 lines)
  await db.execute(sql`
    INSERT INTO app.d_entity_instance_registry
    (entity_type, entity_id, entity_name, entity_code, active_flag)
    VALUES ('project', ${project.id}, ${project.name}, ${project.code}, true)
    ON CONFLICT (entity_type, entity_id)
    DO UPDATE SET
      entity_name = EXCLUDED.entity_name,
      entity_code = EXCLUDED.entity_code,
      active_flag = true,
      updated_ts = now()
  `);

  // 4. Create linkage (10 lines)
  if (parent_type && parent_id) {
    await set_entity_instance_link(db, {
      parent_entity_type: parent_type,
      parent_entity_id: parent_id,
      child_entity_type: 'project',
      child_entity_id: project.id
    });
  }

  // 5. Grant OWNER permission (15 lines)
  await db.execute(sql`
    INSERT INTO app.d_entity_rbac
    (person_entity_name, person_entity_id, entity_name, entity_id, permission, active_flag)
    VALUES ('employee', ${userId}, 'project', ${project.id}, 5, true)
    ON CONFLICT (person_entity_name, person_entity_id, entity_name, entity_id)
    DO UPDATE SET permission = GREATEST(d_entity_rbac.permission, 5)
  `);

  return reply.code(201).send({ data: project });
});
```

#### After (Service-Based)

```typescript
// ✅ AFTER: 15 lines using service

import { db } from '@/db/index.js';
import { d_project } from '@/db/schema';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

const ENTITY_TYPE = 'project';

fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;
  const { parent_type, parent_id } = request.query;
  const entityInfra = getEntityInfrastructure(db);

  // 1. RBAC check (1 call)
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_TYPE, entityInfra.ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  // 2. Create entity (routes own primary table)
  const result = await db.insert(d_project).values(request.body).returning();
  const project = result[0];

  // 3. Infrastructure operations (3 calls)
  await entityInfra.set_entity_instance_registry({
    entity_type: ENTITY_TYPE,
    entity_id: project.id,
    entity_name: project.name,
    entity_code: project.code
  });

  await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, project.id);

  if (parent_type && parent_id) {
    await entityInfra.set_entity_instance_link({
      parent_entity_type: parent_type,
      parent_entity_id: parent_id,
      child_entity_type: ENTITY_TYPE,
      child_entity_id: project.id
    });
  }

  return reply.code(201).send({ data: project });
});

// ✅ Result: 75% code reduction, 100% consistency
```

### Complete Route Example

```typescript
/**
 * apps/api/src/modules/project/routes.ts
 *
 * Entity routes OWN primary table, DELEGATE infrastructure
 */

import type { FastifyInstance } from 'fastify';
import { db } from '@/db/index.js';
import { d_project } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';
import { createChildEntityEndpointsFromMetadata } from '@/lib/child-entity-route-factory.js';
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';

const ENTITY_TYPE = 'project';
const TABLE_ALIAS = 'e';

export default async function projectRoutes(fastify: FastifyInstance) {
  const entityInfra = getEntityInfrastructure(db);

  // ==========================================================================
  // CREATE
  // ==========================================================================
  fastify.post('/', async (request, reply) => {
    const { parent_type, parent_id } = request.query;
    const userId = request.user.sub;

    // Service handles RBAC check
    const canCreate = await entityInfra.check_entity_rbac(
      userId, ENTITY_TYPE, entityInfra.ALL_ENTITIES_ID, Permission.CREATE
    );
    if (!canCreate) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Route owns primary table INSERT
    const result = await db.insert(d_project).values(request.body).returning();
    const project = result[0];

    // Service handles infrastructure
    await entityInfra.set_entity_instance_registry({
      entity_type: ENTITY_TYPE,
      entity_id: project.id,
      entity_name: project.name,
      entity_code: project.code
    });

    await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, project.id);

    if (parent_type && parent_id) {
      await entityInfra.set_entity_instance_link({
        parent_entity_type: parent_type,
        parent_entity_id: parent_id,
        child_entity_type: ENTITY_TYPE,
        child_entity_id: project.id
      });
    }

    return reply.code(201).send({ data: project });
  });

  // ==========================================================================
  // LIST - ✅ ROUTE OWNS THE ENTIRE SELECT QUERY
  // ==========================================================================
  fastify.get('/', async (request, reply) => {
    const { limit = 20, offset = 0, parent_type, parent_id, ...filters } = request.query;
    const userId = request.user.sub;

    // ✅ ROUTE builds its own query structure
    const joins = [];
    const conditions = [];

    // Service just provides RBAC WHERE condition as helper
    // Route is FREE to use it or build custom RBAC logic
    const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
      userId, ENTITY_TYPE, Permission.VIEW, TABLE_ALIAS
    );
    conditions.push(rbacCondition);

    // ✅ ROUTE decides how to handle parent filtering
    if (parent_type && parent_id) {
      joins.push(`
        INNER JOIN app.d_entity_instance_link eim
          ON eim.child_entity_id = ${TABLE_ALIAS}.id
          AND eim.parent_entity_type = '${parent_type}'
          AND eim.parent_entity_id = '${parent_id}'
          AND eim.child_entity_type = '${ENTITY_TYPE}'
          AND eim.active_flag = true
      `);
    }

    // ✅ ROUTE decides which filters to apply
    const autoFilters = buildAutoFilters(TABLE_ALIAS, filters);
    conditions.push(...autoFilters);

    // ✅ ROUTE decides which WHERE conditions to add
    conditions.push(`${TABLE_ALIAS}.active_flag = true`);

    // ✅ ROUTE builds the final query (full control)
    const joinClause = joins.length > 0 ? joins.join(' ') : '';
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ✅ ROUTE decides to run queries in parallel
    const [countResult, dataResult] = await Promise.all([
      // ✅ ROUTE owns COUNT query
      db.execute(`
        SELECT COUNT(DISTINCT ${TABLE_ALIAS}.id) as total
        FROM app.d_${ENTITY_TYPE} ${TABLE_ALIAS}
        ${joinClause}
        ${whereClause}
      `),
      // ✅ ROUTE owns SELECT query (could add JOINs, aggregations, etc.)
      db.execute(`
        SELECT DISTINCT ${TABLE_ALIAS}.*
        FROM app.d_${ENTITY_TYPE} ${TABLE_ALIAS}
        ${joinClause}
        ${whereClause}
        ORDER BY ${TABLE_ALIAS}.created_ts DESC
        LIMIT ${limit} OFFSET ${offset}
      `)
    ]);

    // ✅ ROUTE decides response format
    return reply.send({
      data: dataResult,
      pagination: {
        total: countResult[0].total,
        limit,
        offset
      }
    });
  });

  // ==========================================================================
  // GET SINGLE
  // ==========================================================================
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const userId = request.user.sub;

    // Service handles RBAC check
    const canView = await entityInfra.check_entity_rbac(
      userId, ENTITY_TYPE, id, Permission.VIEW
    );
    if (!canView) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Route owns query
    const result = await db.select().from(d_project).where(eq(d_project.id, id));
    if (!result.length) {
      return reply.code(404).send({ error: 'Not found' });
    }

    // Optional: Get user's permission level
    const userPermission = await entityInfra.getUserPermission(userId, ENTITY_TYPE, id);

    return reply.send({
      data: result[0],
      _permissions: {
        level: userPermission,
        can_edit: userPermission >= Permission.EDIT,
        can_delete: userPermission >= Permission.DELETE,
        can_share: userPermission >= Permission.SHARE
      }
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    const userId = request.user.sub;

    // Service handles RBAC check
    const canEdit = await entityInfra.check_entity_rbac(
      userId, ENTITY_TYPE, id, Permission.EDIT
    );
    if (!canEdit) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Route owns UPDATE
    const result = await db.update(d_project)
      .set({ ...updates, updated_ts: new Date() })
      .where(eq(d_project.id, id))
      .returning();

    // Service handles registry sync
    if (updates.name || updates.code) {
      await entityInfra.update_entity_instance_registry(ENTITY_TYPE, id, {
        entity_name: updates.name,
        entity_code: updates.code
      });
    }

    return reply.send({ data: result[0] });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;
    const { hard_delete = false, cascade = false } = request.query;
    const userId = request.user.sub;

    // Service orchestrates ENTIRE delete operation
    const result = await entityInfra.delete_all_entity_infrastructure(ENTITY_TYPE, id, {
      user_id: userId,
      hard_delete: hard_delete === 'true',
      cascade_delete_children: cascade === 'true',
      remove_rbac_entries: hard_delete === 'true',
      primary_table_callback: async (db, entity_id) => {
        // Route provides custom delete logic
        if (hard_delete) {
          await db.delete(d_project).where(eq(d_project.id, entity_id));
        } else {
          await db.update(d_project)
            .set({ active_flag: false, updated_ts: new Date() })
            .where(eq(d_project.id, entity_id));
        }
      }
    });

    return reply.code(200).send({
      message: 'Entity deleted successfully',
      details: result
    });
  });

  // ==========================================================================
  // FACTORY: Child Entity Endpoints
  // ==========================================================================
  await createChildEntityEndpointsFromMetadata(fastify, ENTITY_TYPE);
}
```

---

## Migration Strategy

### Phase 1: Service Implementation (Week 1-2)

**Deliverables**:
1. Create `apps/api/src/services/entity-infrastructure.service.ts`
2. Implement all 25+ methods
3. Add comprehensive JSDoc documentation
4. Write unit tests (>80% coverage)

**Tasks**:
- [ ] Create service file structure
- [ ] Implement Section 1: Metadata Management
- [ ] Implement Section 2: Instance Registry
- [ ] Implement Section 3: Relationship Management
- [ ] Implement Section 4: Permission Management
- [ ] Implement Section 5: Unified Delete Operation
- [ ] Write TypeScript types and interfaces
- [ ] Add singleton export pattern
- [ ] Write unit tests for each section
- [ ] Performance testing and optimization

### Phase 2: Route Migration (Week 3-4)

**Migration Order** (High-Impact First):

1. **project** (most complex, highest impact)
2. **task** (second most used)
3. **business** (parent entity)
4. **employee** (RBAC critical)
5. **role** (RBAC critical)
6. **client** (external facing)
7. ... remaining 39 entities

**Migration Template**:

```typescript
// For each entity route:

// 1. Import service
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

// 2. Get service instance
const entityInfra = getEntityInfrastructure(db);

// 3. Replace CREATE infrastructure
// BEFORE: 60 lines
// AFTER: 3 service calls

// 4. Replace DELETE infrastructure
// BEFORE: 30-40 lines
// AFTER: 1 service call

// 5. Replace RBAC checks
// BEFORE: 10-15 lines
// AFTER: 1 service call

// 6. Test thoroughly
```

### Phase 3: Deprecation & Cleanup (Week 5)

**Remove**:
- [ ] Old linkage service (keep for backward compat initially)
- [ ] Duplicate RBAC code from routes
- [ ] Manual registry operations
- [ ] Manual linkage operations

**Update**:
- [ ] Update documentation
- [ ] Update API reference docs
- [ ] Update developer guides
- [ ] Add migration guide

### Rollback Plan

If issues arise:

1. **Service-Level Rollback**: Revert service implementation
   - Service is optional, routes still work without it
   - No breaking changes

2. **Route-Level Rollback**: Revert individual routes
   - Migrate routes one at a time
   - Easy to roll back single route

3. **Feature Flags**: Use environment variable
   ```typescript
   const USE_INFRA_SERVICE = process.env.USE_ENTITY_INFRA_SERVICE === 'true';

   if (USE_INFRA_SERVICE) {
     await entityInfra.delete_all_entity_infrastructure(...);
   } else {
     // Legacy delete logic
   }
   ```

---

## Performance Considerations

### Caching Strategy

```typescript
export class EntityInfrastructureService {
  private metadataCache: Map<string, {
    data: EntityTypeMetadata;
    expiry: number;
  }> = new Map();

  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async get_entity(entity_type: string): Promise<EntityTypeMetadata | null> {
    // Check cache
    const cached = this.metadataCache.get(entity_type);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Fetch from database
    const result = await this.db.execute(/* ... */);

    // Cache result
    if (result.length > 0) {
      this.metadataCache.set(entity_type, {
        data: result[0],
        expiry: Date.now() + this.CACHE_TTL
      });
    }

    return result[0] || null;
  }
}
```

### Database Indexes

```sql
-- Required indexes for optimal performance

-- d_entity
CREATE INDEX idx_d_entity_active ON app.d_entity(active_flag) WHERE active_flag = true;

-- d_entity_instance_registry
CREATE INDEX idx_entity_instance_type ON app.d_entity_instance_registry(entity_type, active_flag);
CREATE INDEX idx_entity_instance_search ON app.d_entity_instance_registry
  USING gin(to_tsvector('english', entity_name || ' ' || COALESCE(entity_code, '')));

-- d_entity_instance_link
CREATE INDEX idx_eim_parent ON app.d_entity_instance_link(parent_entity_type, parent_entity_id, active_flag);
CREATE INDEX idx_eim_child ON app.d_entity_instance_link(child_entity_type, child_entity_id, active_flag);
CREATE INDEX idx_eim_relationship ON app.d_entity_instance_link(parent_entity_id, child_entity_id, active_flag);

-- d_entity_rbac
CREATE INDEX idx_rbac_person ON app.d_entity_rbac(person_entity_id, entity_name, active_flag);
CREATE INDEX idx_rbac_entity ON app.d_entity_rbac(entity_name, entity_id, active_flag);
```

### Query Optimization

```typescript
// Use parallel queries where possible
const [countResult, dataResult] = await Promise.all([
  this.db.execute(countQuery),
  this.db.execute(dataQuery)
]);

// Use Set for fast lookups
const activeChildCodes = new Set(activeChildren.map(row => row.code));
const filtered = childEntities.filter(c => activeChildCodes.has(c.entity));

// Use SQL IN clause instead of N+1 queries
const placeholders = codes.map((_, i) => `$${i + 1}`).join(', ');
const query = `SELECT * FROM d_entity WHERE code IN (${placeholders})`;
const results = await this.db.execute(query, codes);
```

### Performance Targets

| Operation | Target | Current | Improvement |
|-----------|--------|---------|-------------|
| **getEntityTypeMetadata** | <5ms | ~10ms | 2x faster (cache) |
| **registerInstance** | <10ms | ~15ms | 1.5x faster |
| **createLinkage** | <15ms | ~20ms | 1.3x faster |
| **checkPermission** | <20ms | ~50ms | 2.5x faster (delegate) |
| **deleteEntity (simple)** | <50ms | ~100ms | 2x faster |
| **deleteEntity (cascade)** | <200ms | N/A | New feature |

---

## Security & RBAC Integration

### Permission Hierarchy

```typescript
export enum Permission {
  VIEW = 0,    // Can read entity
  EDIT = 1,    // Can modify entity (implies VIEW)
  SHARE = 2,   // Can share with others (implies EDIT + VIEW)
  DELETE = 3,  // Can soft delete (implies SHARE + EDIT + VIEW)
  CREATE = 4,  // Can create new entities (type-level only)
  OWNER = 5    // Full control (implies all below)
}
```

### RBAC Delegation

```typescript
// Service delegates RBAC to unified-data-gate for full resolution
export class EntityInfrastructureService {
  async check_entity_rbac(
    user_id: string,
    entity_type: string,
    entity_id: string,
    required_permission: Permission
  ): Promise<boolean> {
    // Delegate to unified-data-gate for:
    // - Direct employee permissions
    // - Role-based permissions
    // - Parent-VIEW inheritance
    // - Parent-CREATE inheritance
    return await this.unifiedDataGate.rbac_gate.check_entity_rbac(
      this.db,
      user_id,
      entity_type,
      entity_id,
      required_permission
    );
  }
}
```

### Audit Logging (Future Enhancement)

```typescript
// All operations can be logged centrally
async set_entity_instance_registry(params: RegisterInstanceParams): Promise<EntityInstance> {
  const result = await this.db.execute(/* ... */);

  // Centralized audit logging
  await this.logAuditEvent({
    action: 'ENTITY_REGISTERED',
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    user_id: this.currentUserId, // From request context
    timestamp: new Date(),
    metadata: params
  });

  return result[0];
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('EntityInfrastructureService', () => {
  describe('registerInstance', () => {
    it('should register new instance', async () => {
      const entityInfra = getEntityInfrastructure(db);
      const result = await entityInfra.set_entity_instance_registry({
        entity_type: 'project',
        entity_id: 'test-uuid',
        entity_name: 'Test Project',
        entity_code: 'TEST-001'
      });

      expect(result.entity_type).toBe('project');
      expect(result.entity_id).toBe('test-uuid');
      expect(result.active_flag).toBe(true);
    });

    it('should update existing instance', async () => {
      // ... test upsert behavior
    });

    it('should reactivate deactivated instance', async () => {
      // ... test reactivation
    });
  });

  describe('deleteEntity', () => {
    it('should soft delete entity', async () => {
      // ... test soft delete
    });

    it('should hard delete entity', async () => {
      // ... test hard delete
    });

    it('should cascade delete children', async () => {
      // ... test cascade
    });

    it('should check RBAC permission', async () => {
      // ... test permission check
    });

    it('should remove RBAC entries on hard delete', async () => {
      // ... test RBAC cleanup
    });
  });

  describe('checkPermission', () => {
    it('should check direct employee permission', async () => {
      // ... test direct permission
    });

    it('should check role-based permission', async () => {
      // ... test role permission
    });

    it('should check parent inheritance', async () => {
      // ... test inheritance
    });
  });
});
```

### Integration Tests

```typescript
describe('Entity Routes with Infrastructure Service', () => {
  it('should create entity with automatic infrastructure', async () => {
    const response = await request(app)
      .post('/api/v1/project')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Project',
        code: 'TEST-001'
      });

    expect(response.status).toBe(201);

    // Verify registry
    const registry = await db.execute(`
      SELECT * FROM d_entity_instance_registry
      WHERE entity_type = 'project' AND entity_id = '${response.body.data.id}'
    `);
    expect(registry.length).toBe(1);

    // Verify RBAC
    const rbac = await db.execute(`
      SELECT * FROM d_entity_rbac
      WHERE entity_name = 'project' AND entity_id = '${response.body.data.id}'
    `);
    expect(rbac.length).toBe(1);
    expect(rbac[0].permission).toBe(5); // OWNER
  });
});
```

### Performance Tests

```typescript
describe('Performance', () => {
  it('should handle 1000 concurrent operations', async () => {
    const startTime = Date.now();

    const promises = Array.from({ length: 1000 }, (_, i) =>
      entityInfra.set_entity_instance_registry({
        entity_type: 'project',
        entity_id: `test-${i}`,
        entity_name: `Project ${i}`
      })
    );

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // <5 seconds
  });
});
```

---

## Success Metrics

### Code Quality Metrics

| Metric | Target | Baseline | Success Criteria |
|--------|--------|----------|------------------|
| **Code Duplication** | <5% | 45% | 90% reduction |
| **Lines of Code** | 2,000 | 10,000+ | 80% reduction |
| **Test Coverage** | >85% | ~40% | 2x increase |
| **Complexity (Cyclomatic)** | <10 per method | ~25 | 60% reduction |
| **Maintainability Index** | >70 | ~40 | 75% improvement |

### Performance Metrics

| Metric | Target | Baseline | Success Criteria |
|--------|--------|----------|------------------|
| **CREATE Operation** | <50ms | ~80ms | 37% faster |
| **DELETE Operation** | <50ms | ~100ms | 50% faster |
| **RBAC Check** | <20ms | ~50ms | 60% faster |
| **Metadata Lookup** | <5ms | ~10ms | 50% faster (cache) |
| **Memory Usage** | <10MB | ~15MB | 33% reduction |

### Developer Experience Metrics

| Metric | Target | Baseline | Success Criteria |
|--------|--------|----------|------------------|
| **Time to Add Entity** | 15 min | 2 hours | 87% faster |
| **Bug Fix Propagation** | 1 file | 45 files | 98% reduction |
| **Onboarding Time** | 2 days | 2 weeks | 85% faster |
| **Documentation Pages** | 5 | 25 | 80% simpler |

### Business Impact Metrics

| Metric | Target | Success Criteria |
|--------|--------|------------------|
| **Development Velocity** | 2x faster | Measured by story points |
| **Bug Rate** | 50% reduction | Measured by production bugs |
| **Feature Delivery** | 30% faster | Measured by sprint velocity |
| **Technical Debt** | 60% reduction | Measured by SonarQube |

---

## Conclusion

### Summary

The Entity Infrastructure Service centralizes all entity lifecycle operations into a single, comprehensive service, providing:

✅ **80% code reduction** - From 9,000+ to <2,000 lines
✅ **100% consistency** - Single implementation, zero duplication
✅ **10x easier maintenance** - Change in one place, applies everywhere
✅ **2x faster performance** - Optimized queries, caching, parallel execution
✅ **Zero-config integration** - Routes use service with 3-line changes
✅ **Complete feature set** - Metadata, registry, relationships, permissions, delete

### Next Steps

1. **Review & Approve** - Architecture team review
2. **Implement Service** - Create entity-infrastructure.service.ts
3. **Write Tests** - Achieve >85% coverage
4. **Migrate Routes** - Start with high-impact entities
5. **Monitor Performance** - Track metrics, optimize
6. **Document** - Update developer guides
7. **Deprecate Old Code** - Remove duplicate infrastructure

### Long-Term Vision

This service is the foundation for:
- Unified audit logging
- Event-driven architecture
- Real-time subscriptions
- GraphQL API generation
- Automated API documentation
- Admin dashboard generation

**The Entity Infrastructure Service is the single source of truth for all entity operations in the PMO platform.**

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-16
**Status**: ✅ Ready for Implementation
**Review Required**: Architecture Team
