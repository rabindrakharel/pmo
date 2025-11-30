# Entity Infrastructure Service

**Version:** 9.2.0 | **Location:** `apps/api/src/services/entity-infrastructure.service.ts`

> **Note:** The entity infrastructure service generates `ref_data_entityInstance` lookup tables that are cached in TanStack Query + Dexie (IndexedDB) on the frontend for offline entity reference resolution.

---

## Semantics

The Entity Infrastructure Service provides **transactional CRUD operations** and centralized management of the 4 infrastructure tables that support all entities. All multi-step operations are wrapped in database transactions to ensure atomicity.

**Core Principle:** All infrastructure operations (CREATE, UPDATE, DELETE) execute in a single transaction. If ANY step fails, ALL changes roll back.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTITY INFRASTRUCTURE SERVICE                         │
│                     (Transactional CRUD Pattern)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   4 Infrastructure Tables                        │    │
│  ├─────────────┬──────────────────┬──────────────────┬─────────────┤    │
│  │   entity    │ entity_instance  │ entity_instance  │ entity_rbac │    │
│  │  (types)    │    (registry)    │     _link        │ (permissions│    │
│  │             │                  │  (relationships) │             │    │
│  └─────────────┴──────────────────┴──────────────────┴─────────────┘    │
│         │                │                 │                │            │
│         v                v                 v                v            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │               Transactional Service Methods                      │    │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │    │
│  │  │ create_entity │ │ update_entity │ │ delete_entity │          │    │
│  │  │ (4 ops in 1)  │ │ (2 ops in 1)  │ │ (4 ops in 1)  │          │    │
│  │  └───────────────┘ └───────────────┘ └───────────────┘          │    │
│  │                                                                  │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │ build_ref_data_entityInstance() - Entity reference resolution (v8.3.0)   │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
└──────────────────────────────│──────────────────────────────────────────┘
                               │
                               v
┌─────────────────────────────────────────────────────────────────────────┐
│                         ROUTE HANDLERS                                   │
│              (Call Transactional Methods)                                │
├─────────────────────────────────────────────────────────────────────────┤
│  POST   → create_entity()   (INSERT + registry + RBAC + link)           │
│  PATCH  → update_entity()   (UPDATE + registry sync)                    │
│  DELETE → delete_entity()   (DELETE + registry + links + RBAC)          │
│  GET    → check_entity_rbac() + get_entity_rbac_where_condition()       │
│        → build_ref_data_entityInstance()   (Entity reference lookup table)             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Entity Reference Resolution (v8.3.0)

### build_ref_data_entityInstance()

Generates a lookup table for resolving entity reference UUIDs to display names. Used by API routes to include `ref_data_entityInstance` in responses for O(1) frontend lookups.

```typescript
/**
 * Build ref_data_entityInstance lookup table for entity references
 *
 * Scans rows for *_id/*_ids fields, batch resolves from entity_instance table.
 *
 * @param rows - Data rows to scan for entity reference UUIDs
 * @returns { [entityCode]: { [uuid]: name } }
 *
 * @example
 * const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(projects);
 * // Returns: {
 * //   employee: { "uuid-james": "James Miller" },
 * //   business: { "uuid-huron": "Huron Home Services" }
 * // }
 */
async build_ref_data_entityInstance(
  rows: Record<string, any>[]
): Promise<Record<string, Record<string, string>>>
```

### Usage in Routes

```typescript
import { getEntityInfrastructure } from '@/services/entity-infrastructure.service.js';

const entityInfra = getEntityInfrastructure(db);

fastify.get('/api/v1/project', async (request, reply) => {
  const projects = await db.execute(sql`SELECT * FROM app.project...`);

  // Build ref_data_entityInstance for entity reference fields
  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(projects);

  return reply.send({
    data: projects,
    ref_data_entityInstance,  // Include in response
    metadata: { ... }
  });
});
```

### ref_data_entityInstance Response Structure

```json
{
  "data": [
    {
      "id": "proj-1",
      "manager__employee_id": "uuid-james",
      "business_id": "uuid-huron"
    }
  ],
  "ref_data_entityInstance": {
    "employee": {
      "uuid-james": "James Miller"
    },
    "business": {
      "uuid-huron": "Huron Home Services"
    }
  }
}
```

---

## Data Flow Diagram

```
CREATE Operation Flow (Transactional)
─────────────────────────────────────

User Request ──> Route Handler ──> RBAC Check (CREATE permission)
                      │
                      v
              RBAC Check (EDIT parent if linking)
                      │
                      v
              ┌─────────────────────────────────────┐
              │     create_entity() TRANSACTION     │
              │  ┌─────────────────────────────┐   │
              │  │ 1. INSERT into primary table │   │
              │  │ 2. INSERT into entity_instance│   │
              │  │ 3. INSERT OWNER permission   │   │
              │  │ 4. INSERT link (if parent)   │   │
              │  └─────────────────────────────┘   │
              │  If ANY fails → ROLLBACK ALL       │
              └─────────────────────────────────────┘
                      │
                      v
              Return created entity


DELETE Operation Flow (Transactional)
─────────────────────────────────────

User Request ──> Route Handler ──> RBAC Check (DELETE permission)
                      │
                      v
              ┌─────────────────────────────────────┐
              │     delete_entity() TRANSACTION     │
              │  ┌─────────────────────────────┐   │
              │  │ 1. DELETE/deactivate primary │   │
              │  │ 2. DELETE from entity_instance│  │
              │  │ 3. DELETE from entity_links  │   │
              │  │ 4. DELETE from entity_rbac   │   │
              │  └─────────────────────────────┘   │
              │  If ANY fails → ROLLBACK ALL       │
              └─────────────────────────────────────┘
                      │
                      v
              Return success result
```

---

## Architecture Overview

### Infrastructure Tables

| Table | Purpose | Key Fields | Delete Semantics |
|-------|---------|------------|------------------|
| `entity` | Entity type metadata | code, name, icon, child_entity_codes | Soft delete (`active_flag`) |
| `entity_instance` | Instance registry | entity_code, entity_instance_id, entity_instance_name, code | **HARD DELETE** (no active_flag) |
| `entity_instance_link` | Parent-child relationships | entity_code (parent), entity_instance_id (parent), child_entity_code, child_entity_instance_id | **HARD DELETE** (no active_flag) |
| `entity_rbac` | Permissions | person_id, entity_code, entity_instance_id, permission | **HARD DELETE** (no active_flag) |

### Permission Levels

| Level | Name | Description | Inherits |
|-------|------|-------------|----------|
| 0 | VIEW | Read access to entity data | - |
| 1 | COMMENT | Add comments on entities | VIEW |
| 2 | CONTRIBUTE | Insert data in forms, collaborate on wiki | COMMENT, VIEW |
| 3 | EDIT | Modify entity fields, descriptions, details | CONTRIBUTE, COMMENT, VIEW |
| 4 | SHARE | Share entity with others | EDIT, CONTRIBUTE, COMMENT, VIEW |
| 5 | DELETE | Soft delete entity | SHARE, EDIT, CONTRIBUTE, COMMENT, VIEW |
| 6 | CREATE | Create new entities (type-level only) | All lower |
| 7 | OWNER | Full control including permission management | All |

### Transactional Methods (Primary API)

| Method | Purpose | Operations in Transaction |
|--------|---------|---------------------------|
| `create_entity()` | Create entity with all infrastructure | INSERT primary + registry + RBAC + link |
| `update_entity()` | Update entity with registry sync | UPDATE primary + registry sync |
| `delete_entity()` | Delete entity with cleanup | DELETE/deactivate + registry + links + RBAC |

### Reference Resolution Methods (v8.3.0)

| Method | Purpose | Use Case |
|--------|---------|----------|
| `build_ref_data_entityInstance()` | Build UUID→name lookup table | LIST/GET responses |

### Helper Methods (For Edge Cases)

| Method | Purpose | Use Case |
|--------|---------|----------|
| `check_entity_rbac()` | Check permission | All operations |
| `get_entity_rbac_where_condition()` | RBAC SQL fragment | LIST queries |
| `set_entity_instance_link()` | Manual linkage | Linkage API |
| `get_dynamic_child_entity_tabs()` | Get child tabs | Detail pages |

---

## Tooling Overview

### Standard Import Block

```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

const ENTITY_CODE = 'project';
const entityInfra = getEntityInfrastructure(db);
```

### CREATE Pattern (Transactional)

```typescript
fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;
  const { parent_entity_code, parent_entity_instance_id } = request.query;
  const data = request.body;

  // Step 1: RBAC Check - Can user CREATE?
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) return reply.status(403).send({ error: 'Forbidden' });

  // Step 2: RBAC Check - Can user EDIT parent? (if linking)
  if (parent_entity_code && parent_entity_instance_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT
    );
    if (!canEditParent) return reply.status(403).send({ error: 'Forbidden' });
  }

  // Step 3: Transactional CREATE (all 4 ops in ONE transaction)
  const result = await entityInfra.create_entity({
    entity_code: ENTITY_CODE,
    creator_id: userId,
    parent_entity_code: parent_entity_code,
    parent_entity_id: parent_entity_instance_id,  // API param → service param
    primary_table: 'app.project',
    primary_data: {
      code: data.code,
      name: data.name,
      descr: data.descr,
      budget_allocated_amt: data.budget_allocated_amt
    }
  });

  return reply.status(201).send(result.entity);
});
```

### UPDATE Pattern (Transactional)

```typescript
fastify.patch('/api/v1/project/:id', async (request, reply) => {
  const userId = request.user.sub;
  const { id } = request.params;
  const updates = request.body;

  // Step 1: RBAC Check - Can user EDIT?
  const canEdit = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, id, Permission.EDIT
  );
  if (!canEdit) return reply.status(403).send({ error: 'Forbidden' });

  // Step 2: Transactional UPDATE (UPDATE + registry sync in ONE transaction)
  const result = await entityInfra.update_entity({
    entity_code: ENTITY_CODE,
    entity_id: id,
    primary_table: 'app.project',
    primary_updates: updates
  });

  return reply.send(result.entity);
});
```

### DELETE Pattern (Transactional)

```typescript
// Using entity-delete-route-factory (recommended)
createEntityDeleteEndpoint(fastify, 'project');

// Or manual implementation:
fastify.delete('/api/v1/project/:id', async (request, reply) => {
  const userId = request.user.sub;
  const { id } = request.params;

  // Transactional DELETE (all 4 ops in ONE transaction)
  const result = await entityInfra.delete_entity({
    entity_code: ENTITY_CODE,
    entity_id: id,
    user_id: userId,
    primary_table: 'app.project',
    hard_delete: false  // Soft delete for PRIMARY TABLE only (active_flag = false)
  });
  // NOTE: entity_instance, entity_instance_link, entity_rbac are ALWAYS hard-deleted
  // The hard_delete param only affects the primary table (e.g., app.project)

  return reply.send(result);
});
```

### LIST with RBAC + ref_data_entityInstance Pattern (v8.3.0)

```typescript
fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;

  // Get RBAC WHERE condition
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, 'e'
  );

  // Route owns the query structure
  const projects = await db.execute(sql`
    SELECT e.*, b.name as business_name
    FROM app.project e
    LEFT JOIN app.business b ON e.business_id = b.id
    WHERE ${rbacCondition}
      AND e.active_flag = true
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // Build ref_data_entityInstance for entity reference fields (v8.3.0)
  const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(projects);

  return reply.send({
    data: projects,
    ref_data_entityInstance,  // Frontend uses for O(1) UUID→name resolution
    metadata: { ... }
  });
});
```

---

## Method Signatures

### create_entity()

```typescript
async create_entity<T>(params: {
  entity_code: string;           // Entity TYPE code, e.g., 'project', 'task'
  creator_id: string;            // User UUID
  parent_entity_code?: string;   // Parent entity TYPE code (if linking)
  parent_entity_id?: string;     // Parent entity UUID (if linking)
  relationship_type?: string;    // Default: 'contains'
  primary_table: string;         // e.g., 'app.project'
  primary_data: T;               // Data to insert
  name_field?: string;           // Default: 'name' - field for entity_instance_name
  code_field?: string;           // Default: 'code' - field for instance_code
}): Promise<{
  entity: T & { id: string };
  entity_instance: EntityInstance;
  rbac_granted: boolean;
  link_created: boolean;
  link?: EntityLink;
}>
```

### update_entity()

```typescript
async update_entity<T>(params: {
  entity_code: string;           // Entity TYPE code, e.g., 'project'
  entity_id: string;             // Entity instance UUID
  primary_table: string;         // e.g., 'app.project'
  primary_updates: Partial<T>;   // Fields to update
  name_field?: string;           // Default: 'name' - syncs entity_instance_name
  code_field?: string;           // Default: 'code' - syncs instance_code
}): Promise<{
  entity: T & { id: string };
  registry_synced: boolean;
}>
```

### delete_entity()

```typescript
async delete_entity(params: {
  entity_code: string;           // Entity TYPE code, e.g., 'project'
  entity_id: string;             // Entity instance UUID
  user_id: string;               // User UUID (for RBAC check)
  primary_table: string;         // e.g., 'app.project'
  hard_delete?: boolean;         // Default: false (soft delete PRIMARY TABLE only)
  skip_rbac_check?: boolean;     // Default: false
}): Promise<{
  success: boolean;
  entity_deleted: boolean;
  registry_deleted: boolean;      // Always hard delete
  linkages_deleted: number;       // Always hard delete
  rbac_entries_deleted: number;   // Always hard delete
}>
// NOTE: hard_delete param ONLY affects primary_table
// entity_instance, entity_instance_link, entity_rbac are ALWAYS hard-deleted
```

### build_ref_data_entityInstance() (v8.3.0)

```typescript
async build_ref_data_entityInstance(
  rows: Record<string, any>[]
): Promise<Record<string, Record<string, string>>>
```

### Helper Methods (for edge cases)

```typescript
// Register entity in global registry
async set_entity_instance_registry(params: {
  entity_code: string;           // Entity TYPE code, e.g., 'project'
  entity_id: string;             // Entity instance UUID
  entity_name: string;           // Display name for lookups
  instance_code?: string | null; // Record code, e.g., 'PROJ-001'
}): Promise<EntityInstance>

// Update registry when name/code changes
async update_entity_instance_registry(
  entity_code: string,           // Entity TYPE code
  entity_id: string,             // Entity instance UUID
  updates: {
    entity_name?: string;        // New display name
    instance_code?: string | null; // New record code
  }
): Promise<EntityInstance | null>

// Create parent-child linkage
async set_entity_instance_link(params: {
  parent_entity_code: string;       // Parent entity TYPE code
  parent_entity_id: string;         // Parent entity UUID
  child_entity_code: string;        // Child entity TYPE code
  child_entity_id: string;          // Child entity UUID
  relationship_type?: string;       // Default: 'contains'
}): Promise<EntityLink>
```

---

## Database/API/UI Mapping

### Entity Table to Infrastructure Mapping

| Primary Table | entity_instance | entity_instance_link | entity_rbac |
|---------------|-----------------|----------------------|-------------|
| project | Registered on create | Links to office, business | Permissions per user |
| task | Registered on create | Links to project | Permissions per user |
| employee | Registered on create | Links to office, role | Permissions per user |
| artifact | Registered on create | Links to project, task | Permissions per user |

### API Endpoints Using Service

| Endpoint | Service Method |
|----------|----------------|
| `POST /api/v1/{entity}` | `create_entity()` |
| `PATCH /api/v1/{entity}/:id` | `update_entity()` |
| `DELETE /api/v1/{entity}/:id` | `delete_entity()` |
| `GET /api/v1/{entity}` | `get_entity_rbac_where_condition()` + `build_ref_data_entityInstance()` |
| `GET /api/v1/{entity}/:id` | `check_entity_rbac()` + `build_ref_data_entityInstance()` |
| `GET /api/v1/{parent}/:id/{child}` | `get_entity_rbac_where_condition()` |

---

## Critical Considerations

### Design Principles

1. **Transactional Safety** - All multi-step operations in one transaction
2. **No Orphan Records** - If any step fails, all changes roll back
3. **Consistent Naming** - `entity_code` matches data model column names
4. **No Foreign Keys** - All relationships via entity_instance_link
5. **Hard Delete Infrastructure** - `entity_instance`, `entity_instance_link`, `entity_rbac` use **hard delete** (no active_flag)
6. **Soft Delete Primary** - Primary entity tables (project, task, etc.) use `active_flag`
7. **ref_data_entityInstance for References** - Use `build_ref_data_entityInstance()` instead of per-row embedded objects (v8.3.0)

### Naming Convention

| Parameter | Meaning | Example |
|-----------|---------|---------|
| `entity_code` | Entity TYPE code | 'project', 'task', 'employee' |
| `entity_id` | Entity instance UUID | 'uuid-here' |
| `parent_entity_code` | Parent entity TYPE | 'business', 'office' |
| `child_entity_code` | Child entity TYPE | 'task', 'artifact' |

### Special Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `ALL_ENTITIES_ID` | `'11111111-1111-1111-1111-111111111111'` | Type-level permissions |
| `Permission.VIEW` | 0 | Read access |
| `Permission.COMMENT` | 1 | Add comments |
| `Permission.CONTRIBUTE` | 2 | Insert data, collaborate |
| `Permission.EDIT` | 3 | Modify entity |
| `Permission.SHARE` | 4 | Share access |
| `Permission.DELETE` | 5 | Delete access |
| `Permission.CREATE` | 6 | Create access (type-level only) |
| `Permission.OWNER` | 7 | Full control |

### Migration from Old Pattern

| Old Pattern | New Pattern |
|-------------|-------------|
| Direct INSERT + set_entity_instance_registry() + set_entity_rbac_owner() + set_entity_instance_link() | `create_entity()` |
| Direct UPDATE + update_entity_instance_registry() | `update_entity()` |
| delete_all_entity_infrastructure() | `delete_entity()` |
| Per-row `_ID` embedded objects | `build_ref_data_entityInstance()` (v8.3.0) |

---

**Last Updated:** 2025-11-30 | **Version:** 9.2.0 | **Status:** Production Ready

**Recent Updates:**
- v9.2.0 (2025-11-30): Updated to reflect TanStack Query + Dexie frontend (RxDB removed)
- v8.3.0 (2025-11-26): Added `build_ref_data_entityInstance()` for entity reference resolution
- v5.0.0 (2025-11-22): Added transactional CRUD methods
