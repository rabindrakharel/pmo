# Entity Infrastructure Service

**Version:** 4.0.0 | **Location:** `apps/api/src/services/entity-infrastructure.service.ts`

---

## Semantics

The Entity Infrastructure Service provides centralized management of the 4 infrastructure tables that support all entities. It follows an **Add-On Helper Pattern** where routes maintain 100% ownership of their primary table queries while the service handles infrastructure operations.

**Core Principle:** Routes OWN their queries. Service provides infrastructure add-ons only.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTITY INFRASTRUCTURE SERVICE                         │
│                     (Add-On Helper Pattern)                              │
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
│  │                    Service Methods                               │    │
│  │  check_entity_rbac() │ set_entity_instance_registry()           │    │
│  │  set_entity_rbac_owner() │ set_entity_instance_link()           │    │
│  │  get_entity_rbac_where_condition() │ delete_all_infrastructure()│    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
└──────────────────────────────│──────────────────────────────────────────┘
                               │
                               v
┌─────────────────────────────────────────────────────────────────────────┐
│                         ROUTE HANDLERS                                   │
│              (Own Their Primary Table Queries)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Route builds custom queries: SELECT, INSERT, UPDATE, DELETE            │
│  Route adds RBAC filtering via service helper                           │
│  Route calls service for infrastructure operations                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
CREATE Operation Flow
─────────────────────

User Request ──> Route Handler ──> RBAC Check (CREATE permission)
                      │
                      v
              INSERT into d_{entity}  ← Route OWNS this query
                      │
                      v
              set_entity_instance_registry()  ← Service helper
                      │
                      v
              set_entity_rbac_owner()  ← Service helper
                      │
                      v
              set_entity_instance_link() (if parent)  ← Service helper
                      │
                      v
              Return created entity


LIST Operation Flow
───────────────────

User Request ──> Route Handler ──> get_entity_rbac_where_condition()
                      │
                      v
              SELECT with RBAC WHERE  ← Route OWNS this query
                      │
                      v
              Return filtered results
```

---

## Architecture Overview

### Infrastructure Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `entity` | Entity type metadata | code, name, icon, child_entity_codes |
| `entity_instance` | Instance registry | entity_code, entity_id, entity_instance_name |
| `entity_instance_link` | Parent-child relationships | parent_entity_type, parent_entity_id, child_entity_type, child_entity_id |
| `entity_rbac` | Permissions | employee_id, entity_type, entity_id, permission |

### Permission Levels

| Level | Name | Value | Inherits |
|-------|------|-------|----------|
| 0 | VIEW | Read-only access | - |
| 1 | EDIT | Modify entity | VIEW |
| 2 | SHARE | Share with others | EDIT, VIEW |
| 3 | DELETE | Soft delete | SHARE, EDIT, VIEW |
| 4 | CREATE | Create new (type-level) | - |
| 5 | OWNER | Full control | All |

### Service Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `check_entity_rbac()` | Check if user has permission | boolean |
| `set_entity_instance_registry()` | Register instance in global registry | void |
| `update_entity_instance_registry()` | Sync registry when name/code changes | void |
| `set_entity_rbac_owner()` | Grant OWNER permission to creator | void |
| `set_entity_instance_link()` | Create parent-child linkage (idempotent) | void |
| `get_entity_rbac_where_condition()` | Get SQL WHERE fragment for RBAC filtering | SQL fragment |
| `delete_all_entity_infrastructure()` | Orchestrate complete entity deletion | void |

---

## Tooling Overview

### Standard Import Block

```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

const ENTITY_CODE = 'project';
const entityInfra = getEntityInfrastructure(db);
```

### 6-Step CREATE Pattern

| Step | Action | Service Method |
|------|--------|----------------|
| 1 | RBAC Check - Can user CREATE? | `check_entity_rbac(userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE)` |
| 2 | RBAC Check - Can user EDIT parent? | `check_entity_rbac(userId, parent_code, parent_id, Permission.EDIT)` |
| 3 | INSERT into primary table | Route owns this query |
| 4 | Register in entity_instance | `set_entity_instance_registry()` |
| 5 | Grant OWNER to creator | `set_entity_rbac_owner()` |
| 6 | Link to parent | `set_entity_instance_link()` |

### 3-Step UPDATE Pattern

| Step | Action | Service Method |
|------|--------|----------------|
| 1 | RBAC Check - Can user EDIT? | `check_entity_rbac(userId, ENTITY_CODE, id, Permission.EDIT)` |
| 2 | UPDATE primary table | Route owns this query |
| 3 | Sync registry if name/code changed | `update_entity_instance_registry()` |

### LIST with RBAC Pattern

```typescript
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  userId, ENTITY_CODE, Permission.VIEW, 'e'
);

const query = sql`
  SELECT e.* FROM app.d_project e
  WHERE ${rbacCondition}
    AND e.active_flag = true
  ORDER BY e.created_ts DESC
`;
```

---

## Database/API/UI Mapping

### Entity Table to Infrastructure Mapping

| Primary Table | entity_instance | entity_instance_link | entity_rbac |
|---------------|-----------------|----------------------|-------------|
| d_project | Registered on create | Links to office, business | Permissions per user |
| d_task | Registered on create | Links to project | Permissions per user |
| d_employee | Registered on create | Links to office, role | Permissions per user |
| d_artifact | Registered on create | Links to project, task | Permissions per user |

### API Endpoints Using Service

| Endpoint | Service Methods Used |
|----------|----------------------|
| `POST /api/v1/{entity}` | check_entity_rbac, set_entity_instance_registry, set_entity_rbac_owner, set_entity_instance_link |
| `PATCH /api/v1/{entity}/:id` | check_entity_rbac, update_entity_instance_registry |
| `DELETE /api/v1/{entity}/:id` | check_entity_rbac, delete_all_entity_infrastructure |
| `GET /api/v1/{entity}` | get_entity_rbac_where_condition |
| `GET /api/v1/{parent}/:id/{child}` | get_entity_rbac_where_condition (for both parent and child) |

---

## User Interaction Flow

```
CREATE Entity Flow
──────────────────

1. User clicks "Create Project" button
   │
2. Frontend sends POST /api/v1/project
   │
3. Route Handler:
   ├── Step 1: check_entity_rbac(userId, 'project', ALL_ENTITIES_ID, CREATE)
   │   └── If false → 403 Forbidden
   │
   ├── Step 2: If parent_code provided:
   │   └── check_entity_rbac(userId, parent_code, parent_id, EDIT)
   │       └── If false → 403 Forbidden
   │
   ├── Step 3: INSERT INTO app.d_project (route owns query)
   │
   ├── Step 4: set_entity_instance_registry()
   │   └── Registers in entity_instance table
   │
   ├── Step 5: set_entity_rbac_owner(userId, 'project', project.id)
   │   └── Creator gets OWNER permission
   │
   └── Step 6: If parent provided:
       └── set_entity_instance_link()
           └── Creates parent-child relationship
   │
4. Return 201 Created with project data


DELETE Entity Flow
──────────────────

1. User clicks "Delete" button
   │
2. Frontend sends DELETE /api/v1/project/:id
   │
3. Route Handler (via factory):
   ├── check_entity_rbac(userId, 'project', id, DELETE)
   │   └── If false → 403 Forbidden
   │
   └── delete_all_entity_infrastructure('project', id)
       ├── Soft delete d_project (active_flag = false)
       ├── Remove from entity_instance
       ├── Remove entity_instance_links (as parent and child)
       └── Remove entity_rbac entries
   │
4. Return 200 OK
```

---

## Critical Considerations

### Design Principles

1. **Add-On Pattern** - Service enhances routes, doesn't control them
2. **Route Ownership** - Routes own all primary table queries
3. **Idempotent Operations** - set_entity_instance_link is idempotent
4. **No Foreign Keys** - All relationships via entity_instance_link
5. **Hard Delete Links** - entity_instance_link uses hard delete (no active_flag)

### What Routes Own vs Service Provides

| Routes Own | Service Provides |
|------------|------------------|
| SELECT queries with JOINs, filters | RBAC WHERE conditions |
| INSERT with business columns | Instance registry operations |
| UPDATE with business logic | Linkage operations |
| Custom aggregations | Permission grants |
| Response formatting | Infrastructure cleanup |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Service builds route queries | Routes build their own queries |
| Service dictates query structure | Service provides helpers only |
| Foreign keys between entities | Use entity_instance_link |
| Direct entity_rbac manipulation | Use service methods |
| Skipping instance registry | Always register new entities |

### Special Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `ALL_ENTITIES_ID` | `'11111111-1111-1111-1111-111111111111'` | Type-level permissions |
| `Permission.VIEW` | 0 | Read access |
| `Permission.EDIT` | 1 | Modify access |
| `Permission.SHARE` | 2 | Share access |
| `Permission.DELETE` | 3 | Delete access |
| `Permission.CREATE` | 4 | Create access (type-level only) |
| `Permission.OWNER` | 5 | Full control |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
