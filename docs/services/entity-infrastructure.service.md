# Entity Infrastructure Service

> Complete reference for transactional CRUD, RBAC enforcement, entity reference resolution, and infrastructure table management. Central service for all entity operations.

**Version**: 5.0.0
**Location**: `apps/api/src/services/entity-infrastructure.service.ts`
**Last Updated**: 2025-11-30
**Status**: Production Ready

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [End-to-End Data Flow](#end-to-end-data-flow)
3. [Infrastructure Tables](#infrastructure-tables)
4. [Transactional CRUD](#transactional-crud)
5. [RBAC System](#rbac-system)
6. [Entity Reference Resolution](#entity-reference-resolution)
7. [Use Case Matrix](#use-case-matrix)
8. [API Reference](#api-reference)
9. [Integration Patterns](#integration-patterns)
10. [Error Handling](#error-handling)

---

## Architecture Overview

### System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTITY INFRASTRUCTURE SERVICE                             │
│                     (Transactional CRUD Pattern)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                   4 INFRASTRUCTURE TABLES                                ││
│  ├──────────────────┬───────────────────┬──────────────────┬───────────────┤│
│  │     entity       │  entity_instance  │ entity_instance  │  entity_rbac  ││
│  │   (type meta)    │    (registry)     │     _link        │ (permissions) ││
│  │                  │                   │  (relationships) │               ││
│  │  HAS active_flag │  NO active_flag   │  NO active_flag  │ NO active_flag││
│  │  (soft delete)   │  (HARD DELETE)    │  (HARD DELETE)   │ (HARD DELETE) ││
│  └──────────────────┴───────────────────┴──────────────────┴───────────────┘│
│                                     │                                        │
│                                     ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    TRANSACTIONAL SERVICE METHODS                         ││
│  ├─────────────────────────────────────────────────────────────────────────┤│
│  │                                                                          ││
│  │   create_entity()          update_entity()          delete_entity()      ││
│  │   ───────────────          ───────────────          ───────────────      ││
│  │   • INSERT primary         • UPDATE primary         • DELETE/deactivate  ││
│  │   • INSERT registry        • SYNC registry          • DELETE registry    ││
│  │   • INSERT OWNER RBAC      • (tx wrapper)           • DELETE all links   ││
│  │   • INSERT link (parent)                            • DELETE all RBAC    ││
│  │   • (ALL in 1 transaction)                          • (ALL in 1 tx)      ││
│  │                                                                          ││
│  │   ─────────────────────────────────────────────────────────────────────  ││
│  │                                                                          ││
│  │   build_ref_data_entityInstance()    check_entity_rbac()                 ││
│  │   ─────────────────────────────────  ────────────────────                ││
│  │   • Scan rows for *_id fields        • Check user permission             ││
│  │   • Batch resolve from registry      • 4-source resolution               ││
│  │   • Return {entity: {uuid: name}}    • Return boolean                    ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                     │                                        │
└─────────────────────────────────────│────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROUTE HANDLERS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  POST   /api/v1/{entity}    → create_entity()                               │
│  PATCH  /api/v1/{entity}/:id → update_entity()                              │
│  DELETE /api/v1/{entity}/:id → delete_entity()                              │
│  GET    /api/v1/{entity}     → get_entity_rbac_where_condition()            │
│                             → build_ref_data_entityInstance()                │
│  GET    /api/v1/{entity}/:id → check_entity_rbac()                          │
│                             → build_ref_data_entityInstance()                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

| Principle | Description |
|-----------|-------------|
| **Transactional Safety** | All multi-step operations execute in ONE transaction |
| **No Orphan Records** | If ANY step fails, ALL changes roll back |
| **Hard Delete Infrastructure** | `entity_instance`, `entity_instance_link`, `entity_rbac` always HARD delete |
| **Soft Delete Primary** | Primary entity tables use `active_flag` for soft delete |
| **No Foreign Keys** | All relationships via `entity_instance_link` (not FK constraints) |
| **ref_data_entityInstance Pattern** | Entity references resolved via batch lookup, not per-row |

---

## End-to-End Data Flow

### CREATE Operation Flow

```
┌──────────┐     ┌───────────────┐     ┌────────────────────┐     ┌──────────┐
│  Client  │     │ Route Handler │     │ Entity Infra Svc   │     │ Database │
└────┬─────┘     └───────┬───────┘     └──────────┬─────────┘     └────┬─────┘
     │                   │                        │                    │
     │ POST /api/v1/project                       │                    │
     │   { name, code, parent_id }                │                    │
     │──────────────────>│                        │                    │
     │                   │                        │                    │
     │                   │ check_entity_rbac(CREATE)                   │
     │                   │───────────────────────>│                    │
     │                   │                        │  Query entity_rbac │
     │                   │                        │───────────────────>│
     │                   │                        │    true/false      │
     │                   │<───────────────────────│<───────────────────│
     │                   │                        │                    │
     │                   │ (if parent) check_entity_rbac(EDIT parent)  │
     │                   │───────────────────────>│                    │
     │                   │<───────────────────────│                    │
     │                   │                        │                    │
     │                   │ create_entity({...})   │                    │
     │                   │───────────────────────>│                    │
     │                   │                        │                    │
     │                   │                        │  BEGIN TRANSACTION │
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ 1. INSERT project  │
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ 2. INSERT entity_instance
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ 3. INSERT entity_rbac (OWNER)
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ 4. INSERT entity_link (if parent)
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │  COMMIT            │
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │     { entity, rbac_granted, link_created }  │
     │                   │<───────────────────────│                    │
     │                   │                        │                    │
     │ 201 Created { id, name, code, ... }        │                    │
     │<──────────────────│                        │                    │
```

### DELETE Operation Flow

```
┌──────────┐     ┌───────────────┐     ┌────────────────────┐     ┌──────────┐
│  Client  │     │ Route Handler │     │ Entity Infra Svc   │     │ Database │
└────┬─────┘     └───────┬───────┘     └──────────┬─────────┘     └────┬─────┘
     │                   │                        │                    │
     │ DELETE /api/v1/project/:id                 │                    │
     │──────────────────>│                        │                    │
     │                   │                        │                    │
     │                   │ delete_entity({        │                    │
     │                   │   entity_code, id,     │                    │
     │                   │   user_id,             │                    │
     │                   │   hard_delete: false   │                    │
     │                   │ })                     │                    │
     │                   │───────────────────────>│                    │
     │                   │                        │                    │
     │                   │                        │ check_entity_rbac(DELETE)
     │                   │                        │───────────────────>│
     │                   │                        │<───────────────────│
     │                   │                        │                    │
     │                   │                        │  BEGIN TRANSACTION │
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ 1. UPDATE project SET active_flag=false
     │                   │                        │    (soft delete primary)
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ 2. DELETE FROM entity_instance
     │                   │                        │    (HARD delete)
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ 3. DELETE FROM entity_instance_link
     │                   │                        │    WHERE parent OR child
     │                   │                        │    (HARD delete all links)
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ 4. DELETE FROM entity_rbac
     │                   │                        │    (HARD delete all permissions)
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │  COMMIT            │
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │     { success: true, linkages_deleted: 3 }  │
     │                   │<───────────────────────│                    │
     │                   │                        │                    │
     │ 200 OK { success: true }                   │                    │
     │<──────────────────│                        │                    │
```

### LIST with RBAC + ref_data Flow

> **v9.7.0 Note:** This pattern is used for both main entity lists (`GET /api/v1/task`) and child entity tabs (`GET /api/v1/task?parent_entity_code=project&parent_entity_instance_id=:id`). The frontend's two-query architecture fetches data via this endpoint with parent filtering query params, while metadata is fetched separately via `content=metadata`.

```
┌──────────┐     ┌───────────────┐     ┌────────────────────┐     ┌──────────┐
│  Client  │     │ Route Handler │     │ Entity Infra Svc   │     │ Database │
└────┬─────┘     └───────┬───────┘     └──────────┬─────────┘     └────┬─────┘
     │                   │                        │                    │
     │ GET /api/v1/project                        │                    │
     │──────────────────>│                        │                    │
     │                   │                        │                    │
     │                   │ get_entity_rbac_where_condition(           │
     │                   │   userId, 'project', VIEW, 'e'              │
     │                   │ )                      │                    │
     │                   │───────────────────────>│                    │
     │                   │                        │ Build RBAC SQL     │
     │                   │                        │ (4 source join)    │
     │                   │     SQL<WHERE clause>  │                    │
     │                   │<───────────────────────│                    │
     │                   │                        │                    │
     │                   │ SELECT * FROM project WHERE {rbac} AND active_flag
     │                   │─────────────────────────────────────────────>
     │                   │                        │                    │
     │                   │                        │     [rows]         │
     │                   │<─────────────────────────────────────────────
     │                   │                        │                    │
     │                   │ build_ref_data_entityInstance(rows)         │
     │                   │───────────────────────>│                    │
     │                   │                        │ Extract *_id UUIDs │
     │                   │                        │ Batch query registry
     │                   │                        │───────────────────>│
     │                   │                        │                    │
     │                   │                        │ {employee:{...}}   │
     │                   │<───────────────────────│<───────────────────│
     │                   │                        │                    │
     │ { data: [...], ref_data_entityInstance: {...} }                 │
     │<──────────────────│                        │                    │
```

---

## Infrastructure Tables

### Table Schema Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE TABLES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  entity (type metadata)                                                      │
│  ──────────────────────                                                      │
│  ┌─────────────┬─────────────┬────────────────────────────────────────────┐ │
│  │ Column      │ Type        │ Description                                │ │
│  ├─────────────┼─────────────┼────────────────────────────────────────────┤ │
│  │ id          │ UUID        │ Primary key                                │ │
│  │ code        │ VARCHAR(50) │ Entity type code ('project', 'task')       │ │
│  │ name        │ VARCHAR(255)│ Display name                               │ │
│  │ icon        │ VARCHAR(50) │ UI icon name                               │ │
│  │ child_entity_codes │ JSONB│ Allowed child types ["task","artifact"]    │ │
│  │ active_flag │ BOOLEAN     │ Soft delete flag                           │ │
│  └─────────────┴─────────────┴────────────────────────────────────────────┘ │
│                                                                              │
│  entity_instance (registry)                           NO active_flag!       │
│  ──────────────────────────                                                  │
│  ┌─────────────────────────┬────────────┬────────────────────────────────┐  │
│  │ Column                  │ Type       │ Description                    │  │
│  ├─────────────────────────┼────────────┼────────────────────────────────┤  │
│  │ id                      │ UUID       │ Primary key                    │  │
│  │ entity_code             │ VARCHAR    │ Entity type code               │  │
│  │ entity_instance_id      │ UUID       │ References primary table row   │  │
│  │ entity_instance_name    │ VARCHAR    │ Cached display name            │  │
│  │ instance_code           │ VARCHAR    │ Cached business code           │  │
│  └─────────────────────────┴────────────┴────────────────────────────────┘  │
│                                                                              │
│  entity_instance_link (relationships)                 NO active_flag!       │
│  ────────────────────────────────────                                        │
│  ┌─────────────────────────────┬────────────┬────────────────────────────┐  │
│  │ Column                      │ Type       │ Description                │  │
│  ├─────────────────────────────┼────────────┼────────────────────────────┤  │
│  │ id                          │ UUID       │ Primary key                │  │
│  │ entity_code                 │ VARCHAR    │ Parent entity type         │  │
│  │ entity_instance_id          │ UUID       │ Parent entity UUID         │  │
│  │ child_entity_code           │ VARCHAR    │ Child entity type          │  │
│  │ child_entity_instance_id    │ UUID       │ Child entity UUID          │  │
│  │ relationship_type           │ VARCHAR    │ 'contains', 'references'   │  │
│  └─────────────────────────────┴────────────┴────────────────────────────┘  │
│                                                                              │
│  entity_rbac (permissions)                            NO active_flag!       │
│  ─────────────────────────                                                   │
│  ┌─────────────────────────┬────────────┬────────────────────────────────┐  │
│  │ Column                  │ Type       │ Description                    │  │
│  ├─────────────────────────┼────────────┼────────────────────────────────┤  │
│  │ id                      │ UUID       │ Primary key                    │  │
│  │ person_id               │ UUID       │ User or role UUID              │  │
│  │ person_code             │ VARCHAR    │ 'employee' or 'role'           │  │
│  │ entity_code             │ VARCHAR    │ Entity type code               │  │
│  │ entity_instance_id      │ UUID       │ Specific entity or ALL_ENTITIES_ID│
│  │ permission              │ INTEGER    │ 0-7 permission level           │  │
│  └─────────────────────────┴────────────┴────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Delete Semantics Matrix

| Table | Delete Type | Mechanism | Reason |
|-------|-------------|-----------|--------|
| `entity` | Soft delete | `active_flag = false` | Type metadata preserved for audit |
| `entity_instance` | **HARD DELETE** | `DELETE FROM` | Registry must stay in sync |
| `entity_instance_link` | **HARD DELETE** | `DELETE FROM` | Orphan links break queries |
| `entity_rbac` | **HARD DELETE** | `DELETE FROM` | Orphan permissions cause security issues |
| Primary tables (project, task, etc.) | Soft delete | `active_flag = false` | Business data preserved |

---

## Transactional CRUD

### Transaction Guarantees

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TRANSACTION ATOMICITY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  create_entity() Transaction:                                                │
│  ─────────────────────────────                                               │
│  BEGIN                                                                       │
│  ├── 1. INSERT INTO app.project (...) RETURNING *                           │
│  │       → Get new entity ID                                                 │
│  │                                                                           │
│  ├── 2. INSERT INTO app.entity_instance (...)                               │
│  │       → Register in global lookup                                         │
│  │                                                                           │
│  ├── 3. INSERT INTO app.entity_rbac (...) permission = OWNER                │
│  │       → Grant creator full control                                        │
│  │                                                                           │
│  └── 4. INSERT INTO app.entity_instance_link (...) IF parent provided       │
│          → Link to parent entity                                             │
│  COMMIT                                                                      │
│                                                                              │
│  If ANY step fails → ROLLBACK ALL → No partial state                        │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  delete_entity() Transaction:                                                │
│  ─────────────────────────────                                               │
│  BEGIN                                                                       │
│  ├── 1. UPDATE app.project SET active_flag = false (or DELETE if hard)      │
│  │       → Deactivate primary record                                         │
│  │                                                                           │
│  ├── 2. DELETE FROM app.entity_instance WHERE entity_instance_id = :id      │
│  │       → Remove from global lookup (HARD DELETE)                           │
│  │                                                                           │
│  ├── 3. DELETE FROM app.entity_instance_link                                │
│  │       WHERE (entity_instance_id = :id) OR (child_entity_instance_id = :id)
│  │       → Remove as parent AND as child (HARD DELETE)                       │
│  │                                                                           │
│  └── 4. DELETE FROM app.entity_rbac WHERE entity_instance_id = :id          │
│          → Remove all permissions (HARD DELETE)                              │
│  COMMIT                                                                      │
│                                                                              │
│  If ANY step fails → ROLLBACK ALL → Entity preserved                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Method Signatures

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// create_entity - Transactional CREATE
// ═══════════════════════════════════════════════════════════════════════════

async create_entity<T>(params: {
  entity_code: string;           // Entity TYPE code ('project', 'task')
  creator_id: string;            // User UUID
  parent_entity_code?: string;   // Parent entity TYPE code
  parent_entity_id?: string;     // Parent entity UUID
  relationship_type?: string;    // Default: 'contains'
  primary_table: string;         // e.g., 'app.project'
  primary_data: T;               // Data to insert
  name_field?: string;           // Default: 'name' - field for display name
  code_field?: string;           // Default: 'code' - field for business code
}): Promise<{
  entity: T & { id: string };
  entity_instance: EntityInstance;
  rbac_granted: boolean;
  link_created: boolean;
  link?: EntityLink;
}>

// ═══════════════════════════════════════════════════════════════════════════
// update_entity - Transactional UPDATE
// ═══════════════════════════════════════════════════════════════════════════

async update_entity<T>(params: {
  entity_code: string;           // Entity TYPE code
  entity_id: string;             // Entity instance UUID
  primary_table: string;         // e.g., 'app.project'
  primary_updates: Partial<T>;   // Fields to update
  name_field?: string;           // Default: 'name' - syncs to registry
  code_field?: string;           // Default: 'code' - syncs to registry
}): Promise<{
  entity: T & { id: string };
  registry_synced: boolean;
}>

// ═══════════════════════════════════════════════════════════════════════════
// delete_entity - Transactional DELETE
// ═══════════════════════════════════════════════════════════════════════════

async delete_entity(params: {
  entity_code: string;           // Entity TYPE code
  entity_id: string;             // Entity instance UUID
  user_id: string;               // User UUID for RBAC check
  primary_table: string;         // e.g., 'app.project'
  hard_delete?: boolean;         // Default: false (soft delete PRIMARY only)
  skip_rbac_check?: boolean;     // Default: false
}): Promise<{
  success: boolean;
  entity_deleted: boolean;
  registry_deleted: boolean;      // Always HARD DELETE
  linkages_deleted: number;       // Always HARD DELETE
  rbac_entries_deleted: number;   // Always HARD DELETE
}>
```

---

## RBAC System

### Permission Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION HIERARCHY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Level  Name        Description                 Implies                     │
│  ─────  ────        ───────────                 ───────                     │
│    0    VIEW        Read-only access            -                           │
│    1    COMMENT     Add comments                VIEW                        │
│    2    CONTRIBUTE  Insert form data            COMMENT, VIEW               │
│    3    EDIT        Modify entity               CONTRIBUTE, COMMENT, VIEW   │
│    4    SHARE       Share with others           EDIT + below                │
│    5    DELETE      Soft delete                 SHARE + below               │
│    6    CREATE      Create new (type-level)     DELETE + below              │
│    7    OWNER       Full control                ALL                         │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Permission Check: hasPermission(user, required) = user.level >= required   │
│                                                                              │
│  Example: User has EDIT (3)                                                 │
│    ✓ Can VIEW (0)                                                           │
│    ✓ Can COMMENT (1)                                                        │
│    ✓ Can CONTRIBUTE (2)                                                     │
│    ✓ Can EDIT (3)                                                           │
│    ✗ Cannot SHARE (4)                                                       │
│    ✗ Cannot DELETE (5)                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Permission Resolution (4 Sources)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERMISSION RESOLUTION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  check_entity_rbac(userId, 'project', projectId, Permission.EDIT)           │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               QUERY 4 PERMISSION SOURCES                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│     ┌────────────────────────────────┼────────────────────────────────┐     │
│     │                                │                                │     │
│     ▼                                ▼                                ▼     │
│  ┌─────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐   │
│  │ SOURCE 1:       │   │ SOURCE 2:           │   │ SOURCE 3:           │   │
│  │ Direct Employee │   │ Role-Based          │   │ Parent-VIEW         │   │
│  │ Permissions     │   │ Permissions         │   │ Inheritance         │   │
│  ├─────────────────┤   ├─────────────────────┤   ├─────────────────────┤   │
│  │ entity_rbac     │   │ entity_rbac         │   │ entity_instance_link│   │
│  │ WHERE           │   │ WHERE               │   │ → parent's RBAC     │   │
│  │ person_code =   │   │ person_code = 'role'│   │                     │   │
│  │   'employee'    │   │ AND person_id IN    │   │ If parent has VIEW  │   │
│  │ AND person_id   │   │   (user's roles)    │   │ → child has VIEW    │   │
│  │   = userId      │   │                     │   │                     │   │
│  └────────┬────────┘   └──────────┬──────────┘   └──────────┬──────────┘   │
│           │                       │                          │              │
│           └───────────────────────┼──────────────────────────┘              │
│                                   │                                         │
│                                   ▼                                         │
│                         ┌─────────────────────┐                             │
│                         │ SOURCE 4:           │                             │
│                         │ Parent-CREATE       │                             │
│                         │ Inheritance         │                             │
│                         ├─────────────────────┤                             │
│                         │ If parent has CREATE│                             │
│                         │ → child has CREATE  │                             │
│                         │ (type-level only)   │                             │
│                         └──────────┬──────────┘                             │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌─────────────────────┐                             │
│                         │ RESULT: MAX level   │                             │
│                         │ from all 4 sources  │                             │
│                         │ >= required level?  │                             │
│                         └─────────────────────┘                             │
│                                    │                                        │
│                          ┌─────────┴─────────┐                              │
│                          ▼                   ▼                              │
│                       true                false                             │
│                    (allowed)            (forbidden)                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### RBAC WHERE Condition

```typescript
// Generate SQL WHERE clause for list queries
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  userId,           // User UUID
  'project',        // Entity type code
  Permission.VIEW,  // Required permission level
  'e'               // Table alias
);

// Use in query
const projects = await db.execute(sql`
  SELECT e.* FROM app.project e
  WHERE ${rbacCondition}
    AND e.active_flag = true
  ORDER BY e.created_ts DESC
`);
```

### Special Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `ALL_ENTITIES_ID` | `'11111111-1111-1111-1111-111111111111'` | Type-level permissions (e.g., CREATE any project) |
| `Permission.VIEW` | 0 | Read-only access |
| `Permission.COMMENT` | 1 | Add comments |
| `Permission.CONTRIBUTE` | 2 | Insert form data |
| `Permission.EDIT` | 3 | Modify entity |
| `Permission.SHARE` | 4 | Share with others |
| `Permission.DELETE` | 5 | Soft delete |
| `Permission.CREATE` | 6 | Create new (type-level) |
| `Permission.OWNER` | 7 | Full control |

---

## Entity Reference Resolution

### build_ref_data_entityInstance()

Generates a lookup table for resolving entity reference UUIDs to display names. Used in API responses for O(1) frontend lookups.

```typescript
/**
 * Build ref_data_entityInstance lookup table for entity references
 *
 * Scans rows for *_id and *_ids fields, batch resolves from entity_instance.
 *
 * @param rows - Data rows to scan for entity reference UUIDs
 * @returns { [entityCode]: { [uuid]: displayName } }
 */
async build_ref_data_entityInstance(
  rows: Record<string, any>[]
): Promise<Record<string, Record<string, string>>>
```

### Resolution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    build_ref_data_entityInstance() FLOW                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input: [                                                                    │
│    { id: "p1", manager__employee_id: "uuid-james", business_id: "uuid-biz" }│
│    { id: "p2", manager__employee_id: "uuid-sarah", business_id: "uuid-biz" }│
│  ]                                                                           │
│                                                                              │
│  Step 1: Scan for *_id / *_ids fields                                       │
│  ─────────────────────────────────────                                       │
│  • manager__employee_id → entity: employee, UUIDs: [uuid-james, uuid-sarah] │
│  • business_id → entity: business, UUIDs: [uuid-biz]                        │
│                                                                              │
│  Step 2: Batch query entity_instance                                        │
│  ─────────────────────────────────────                                       │
│  SELECT entity_code, entity_instance_id, entity_instance_name               │
│  FROM app.entity_instance                                                    │
│  WHERE (entity_code, entity_instance_id) IN (                               │
│    ('employee', 'uuid-james'),                                              │
│    ('employee', 'uuid-sarah'),                                              │
│    ('business', 'uuid-biz')                                                 │
│  )                                                                           │
│                                                                              │
│  Step 3: Build lookup table                                                  │
│  ─────────────────────────────                                               │
│  Output: {                                                                   │
│    "employee": {                                                            │
│      "uuid-james": "James Miller",                                          │
│      "uuid-sarah": "Sarah Chen"                                             │
│    },                                                                        │
│    "business": {                                                            │
│      "uuid-biz": "Huron Home Services"                                      │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Response Structure

```json
{
  "data": [
    {
      "id": "proj-1",
      "name": "Kitchen Renovation",
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
  },
  "metadata": { ... }
}
```

### Frontend Usage

```typescript
// Frontend resolves UUID → display name in O(1)
const displayName = ref_data_entityInstance[metadata.lookupEntity]?.[uuid];
// "James Miller"
```

---

## Use Case Matrix

### Operation Matrix

| Operation | Method | RBAC Check | Transaction Steps |
|-----------|--------|------------|-------------------|
| Create entity | `create_entity()` | CREATE (type-level) + EDIT (parent) | INSERT primary, registry, RBAC, link |
| Update entity | `update_entity()` | EDIT (instance) | UPDATE primary, sync registry |
| Delete entity | `delete_entity()` | DELETE (instance) | Soft/hard primary, HARD registry/links/RBAC |
| List entities | `get_entity_rbac_where_condition()` | VIEW (filtered) | SQL WHERE clause |
| Get single | `check_entity_rbac()` | VIEW (instance) | Boolean check |
| Resolve refs | `build_ref_data_entityInstance()` | - | Batch lookup |

### Delete Type Matrix

| Scenario | Primary Table | entity_instance | entity_instance_link | entity_rbac |
|----------|---------------|-----------------|----------------------|-------------|
| `hard_delete: false` | `active_flag = false` | HARD DELETE | HARD DELETE | HARD DELETE |
| `hard_delete: true` | `DELETE FROM` | HARD DELETE | HARD DELETE | HARD DELETE |

### Permission Matrix

| Action | Required Permission | Check Type |
|--------|---------------------|------------|
| View entity list | VIEW (0) | WHERE condition |
| View single entity | VIEW (0) | Instance check |
| Add comment | COMMENT (1) | Instance check |
| Submit form data | CONTRIBUTE (2) | Instance check |
| Edit entity | EDIT (3) | Instance check |
| Share entity | SHARE (4) | Instance check |
| Delete entity | DELETE (5) | Instance check |
| Create entity | CREATE (6) | Type-level check |
| Manage permissions | OWNER (7) | Instance check |

---

## API Reference

### Core Methods

```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

const entityInfra = getEntityInfrastructure(db);

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTIONAL CRUD
// ═══════════════════════════════════════════════════════════════════════════

// Create with all infrastructure
const result = await entityInfra.create_entity({
  entity_code: 'project',
  creator_id: userId,
  parent_entity_code: 'business',
  parent_entity_id: businessId,
  primary_table: 'app.project',
  primary_data: { name: 'New Project', code: 'PROJ-001' }
});

// Update with registry sync
const result = await entityInfra.update_entity({
  entity_code: 'project',
  entity_id: projectId,
  primary_table: 'app.project',
  primary_updates: { name: 'Updated Name' }
});

// Delete with cleanup
const result = await entityInfra.delete_entity({
  entity_code: 'project',
  entity_id: projectId,
  user_id: userId,
  primary_table: 'app.project',
  hard_delete: false
});

// ═══════════════════════════════════════════════════════════════════════════
// RBAC CHECKS
// ═══════════════════════════════════════════════════════════════════════════

// Check specific permission
const canEdit = await entityInfra.check_entity_rbac(
  userId, 'project', projectId, Permission.EDIT
);

// Get SQL WHERE clause
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  userId, 'project', Permission.VIEW, 'e'
);

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY REFERENCE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

// Build lookup table for entity references
const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(rows);
```

### Helper Methods

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY OPERATIONS (for edge cases)
// ═══════════════════════════════════════════════════════════════════════════

// Register entity in global lookup
await entityInfra.set_entity_instance_registry({
  entity_code: 'project',
  entity_id: projectId,
  entity_name: 'Project Name',
  instance_code: 'PROJ-001'
});

// Update registry
await entityInfra.update_entity_instance_registry(
  'project', projectId, { entity_name: 'New Name' }
);

// ═══════════════════════════════════════════════════════════════════════════
// LINKAGE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

// Create parent-child link
await entityInfra.set_entity_instance_link({
  parent_entity_code: 'project',
  parent_entity_id: projectId,
  child_entity_code: 'task',
  child_entity_id: taskId,
  relationship_type: 'contains'
});

// Get child entity tabs
const tabs = await entityInfra.get_dynamic_child_entity_tabs('project', projectId);
```

---

## Integration Patterns

### Standard Route Pattern

```typescript
// apps/api/src/modules/{entity}/routes.ts

import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';
import { generateEntityResponse } from '@/services/backend-formatter.service.js';
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

const ENTITY_CODE = 'project';
const TABLE_ALIAS = 'e';
const entityInfra = getEntityInfrastructure(db);

export default async function projectRoutes(fastify: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════════
  // LIST - RBAC filtered
  // ═══════════════════════════════════════════════════════════════
  fastify.get('/api/v1/project', async (request, reply) => {
    const userId = request.user.sub;
    const { limit = 20, offset = 0 } = request.query;

    const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
      userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
    );

    const projects = await db.execute(sql`
      SELECT ${sql.raw(TABLE_ALIAS)}.* FROM app.project ${sql.raw(TABLE_ALIAS)}
      WHERE ${rbacCondition} AND ${sql.raw(TABLE_ALIAS)}.active_flag = true
      ORDER BY ${sql.raw(TABLE_ALIAS)}.created_ts DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const ref_data_entityInstance = await entityInfra.build_ref_data_entityInstance(
      Array.from(projects)
    );

    const response = await generateEntityResponse(ENTITY_CODE, Array.from(projects), {
      total: projects.length,
      limit,
      offset,
      ref_data_entityInstance
    });

    return reply.send(response);
  });

  // ═══════════════════════════════════════════════════════════════
  // CREATE - Transactional
  // ═══════════════════════════════════════════════════════════════
  fastify.post('/api/v1/project', async (request, reply) => {
    const userId = request.user.sub;
    const { parent_entity_code, parent_entity_instance_id } = request.query;
    const data = request.body;

    // RBAC: Can user CREATE?
    const canCreate = await entityInfra.check_entity_rbac(
      userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
    );
    if (!canCreate) return reply.status(403).send({ error: 'Forbidden' });

    // RBAC: Can user EDIT parent?
    if (parent_entity_code && parent_entity_instance_id) {
      const canEditParent = await entityInfra.check_entity_rbac(
        userId, parent_entity_code, parent_entity_instance_id, Permission.EDIT
      );
      if (!canEditParent) return reply.status(403).send({ error: 'Forbidden' });
    }

    // Transactional CREATE
    const result = await entityInfra.create_entity({
      entity_code: ENTITY_CODE,
      creator_id: userId,
      parent_entity_code,
      parent_entity_id: parent_entity_instance_id,
      primary_table: 'app.project',
      primary_data: data
    });

    return reply.status(201).send(result.entity);
  });

  // ═══════════════════════════════════════════════════════════════
  // UPDATE - Transactional
  // ═══════════════════════════════════════════════════════════════
  fastify.patch('/api/v1/project/:id', async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params;
    const updates = request.body;

    // RBAC: Can user EDIT?
    const canEdit = await entityInfra.check_entity_rbac(
      userId, ENTITY_CODE, id, Permission.EDIT
    );
    if (!canEdit) return reply.status(403).send({ error: 'Forbidden' });

    // Transactional UPDATE
    const result = await entityInfra.update_entity({
      entity_code: ENTITY_CODE,
      entity_id: id,
      primary_table: 'app.project',
      primary_updates: updates
    });

    return reply.send(result.entity);
  });

  // ═══════════════════════════════════════════════════════════════
  // DELETE - Factory-generated (recommended)
  // ═══════════════════════════════════════════════════════════════
  createEntityDeleteEndpoint(fastify, ENTITY_CODE);
}
```

---

## Error Handling

### Transaction Rollback

```typescript
// All transactional methods auto-rollback on error
try {
  const result = await entityInfra.create_entity({...});
} catch (error) {
  // Transaction already rolled back - no cleanup needed
  console.error('Create failed:', error);
  return reply.status(500).send({ error: 'Failed to create entity' });
}
```

### Common Error Scenarios

| Error | Cause | Result |
|-------|-------|--------|
| Primary INSERT fails | Constraint violation | All 4 ops rolled back |
| Registry INSERT fails | Duplicate key | All 4 ops rolled back |
| RBAC INSERT fails | Invalid user ID | All 4 ops rolled back |
| Link INSERT fails | Invalid parent | All 4 ops rolled back |
| RBAC check fails | No permission | 403 Forbidden (no DB changes) |

---

## Related Documentation

| Document | Path | Description |
|----------|------|-------------|
| Entity Metadata Caching | `docs/caching-backend/ENTITY_METADATA_CACHING.md` | Redis caching for metadata |
| Backend Formatter Service | `docs/services/backend-formatter.service.md` | Metadata generation |
| RBAC Infrastructure | `docs/rbac/RBAC_INFRASTRUCTURE.md` | Full RBAC details |
| Unified Cache Architecture | `docs/caching-frontend/NORMALIZED_CACHE_ARCHITECTURE.md` | TanStack Query + Dexie unified cache |
| State Management | `docs/state_management/STATE_MANAGEMENT.md` | Frontend state management overview |
| Entity Endpoint Design | `docs/api/entity_endpoint_design.md` | API endpoint patterns |

---

**Document Version**: 5.2.0
**Last Updated**: 2025-12-01
**Status**: Production Ready

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-20 | Initial infrastructure service |
| 2.0.0 | 2025-11-22 | Added transactional CRUD |
| 3.0.0 | 2025-11-26 | Added `build_ref_data_entityInstance()` |
| 4.0.0 | 2025-11-28 | Updated for TanStack Query + Dexie |
| 5.0.0 | 2025-11-30 | Complete rewrite with end-to-end architecture, sequence diagrams |
| 5.1.0 | 2025-12-01 | Updated related documentation references for unified cache |
| 5.2.0 | 2025-12-01 | **v9.7.0 Note**: Added clarification that LIST endpoints support parent filtering via `parent_entity_code`/`parent_entity_instance_id` query params, used by frontend's two-query architecture for child entity tabs |
