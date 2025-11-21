# RBAC System

**Version:** 4.0.0 | **Location:** `apps/api/src/services/entity-infrastructure.service.ts`

---

## Semantics

The RBAC (Role-Based Access Control) system provides centralized permission management via the Entity Infrastructure Service. All RBAC logic is encapsulated in service methods - routes call service methods, not custom SQL.

**Core Principle:** Centralized RBAC in service. Routes call methods. Complex SQL hidden inside service.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RBAC ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ROUTE HANDLERS                                │    │
│  │  (Call service methods - NO custom SQL)                         │    │
│  │                                                                  │    │
│  │  check_entity_rbac()           → Point check (can user do X?)   │    │
│  │  get_entity_rbac_where_condition() → List filter (WHERE clause) │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                ENTITY INFRASTRUCTURE SERVICE                     │    │
│  │              (Centralized RBAC Logic)                            │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │              Permission Sources (UNION)                  │    │    │
│  │  │  ┌───────────┬───────────┬───────────┬───────────┐      │    │    │
│  │  │  │  Direct   │   Role    │  Parent   │  Parent   │      │    │    │
│  │  │  │ Employee  │   Based   │   VIEW    │  CREATE   │      │    │    │
│  │  │  └───────────┴───────────┴───────────┴───────────┘      │    │    │
│  │  │                      │                                   │    │    │
│  │  │                      v                                   │    │    │
│  │  │              MAX(permission)                             │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    entity_rbac TABLE                             │    │
│  │  person_code | person_id | entity_code | entity_instance_id |   │    │
│  │  permission  | expires_ts                                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Permission Check Flow (Point Check)
───────────────────────────────────

Route Handler                Service Method               Database
─────────────                ──────────────               ────────

check_entity_rbac(     →     getMaxPermissionLevel()  →   SELECT MAX(permission)
  userId,                    - Direct employee perms      FROM entity_rbac
  'project',                 - Role-based perms           UNION role lookups
  projectId,                 - Parent inheritance         UNION parent perms
  Permission.EDIT
)                       ←    Returns: 3 (EDIT)       ←   Returns max permission

Result: true (3 >= 3)


List Filter Flow (WHERE Condition)
──────────────────────────────────

Route Handler                Service Method               Database
─────────────                ──────────────               ────────

get_entity_rbac_        →    getAccessibleEntityIds() →   SELECT entity_instance_id
  where_condition(           - Check type-level first     FROM entity_rbac
  userId,                    - Get specific IDs           WHERE permission >= X
  'project',
  Permission.VIEW,
  'e'
)                       ←    Returns SQL fragment    ←   Returns ID list

Result: "e.id IN ('uuid-1', 'uuid-2', ...)"
   or:  "TRUE" (type-level access)
   or:  "FALSE" (no access)
```

---

## Architecture Overview

### Permission Levels

| Level | Name | Value | Inherits | Description |
|-------|------|-------|----------|-------------|
| 0 | VIEW | 0 | - | Read access to entity data |
| 1 | COMMENT | 1 | VIEW | Add comments on entities |
| 2 | - | 2 | - | *Reserved (unused)* |
| 3 | EDIT | 3 | COMMENT, VIEW | Modify entity data |
| 4 | SHARE | 4 | EDIT, COMMENT, VIEW | Share entity with others |
| 5 | DELETE | 5 | SHARE, EDIT, COMMENT, VIEW | Soft delete entity |
| 6 | CREATE | 6 | All lower | Create new entities (type-level only) |
| 7 | OWNER | 7 | All | Full control including permission management |

**Note:** Permission level 2 is intentionally unused to allow future expansion.

### Permission Sources

| Source | Description | SQL Pattern |
|--------|-------------|-------------|
| **Direct Employee** | Permissions granted directly to user | `person_code = 'employee' AND person_id = {userId}` |
| **Role-Based** | Permissions via role assignments | JOIN `entity_instance_link` (employee → role → permission) |
| **Parent-VIEW** | VIEW parent → VIEW children | Parent has VIEW on child's parent entity |
| **Parent-CREATE** | CREATE on parent → CREATE children | Parent has CREATE on child's parent entity |
| **Type-Level** | `ALL_ENTITIES_ID` grants access to all | `entity_instance_id = '11111111-...'` |

### Special Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `ALL_ENTITIES_ID` | `'11111111-1111-1111-1111-111111111111'` | Type-level permissions (all entities of type) |

---

## Tooling Overview

### Service Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `check_entity_rbac()` | Point check (can user do X?) | `boolean` |
| `get_entity_rbac_where_condition()` | List filter (WHERE clause) | `SQL` fragment |
| `set_entity_rbac()` | Grant permission | Permission record |
| `set_entity_rbac_owner()` | Grant OWNER permission | Permission record |
| `delete_entity_rbac()` | Revoke permission | `void` |
| `getMaxPermissionLevel()` | Get highest permission (internal) | `number` |
| `getAccessibleEntityIds()` | Get all accessible IDs (internal) | `string[]` |

### Usage in Routes

```typescript
// Import service
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

const entityInfra = getEntityInfrastructure(db);

// Point check - can user EDIT this specific entity?
const canEdit = await entityInfra.check_entity_rbac(
  userId, ENTITY_CODE, id, Permission.EDIT
);
if (!canEdit) return reply.status(403).send({ error: 'Forbidden' });

// List filter - get all entities user can VIEW
const rbacWhereClause = await entityInfra.get_entity_rbac_where_condition(
  userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
);
conditions.push(rbacWhereClause);

// Grant OWNER on create
await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, newEntityId);
```

---

## Database/API/UI Mapping

### entity_rbac Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `person_code` | varchar | 'employee' or 'role' |
| `person_id` | uuid | Employee or role ID |
| `entity_code` | varchar | Entity type ('project', 'task', etc.) |
| `entity_instance_id` | uuid | Entity ID or ALL_ENTITIES_ID |
| `permission` | int | Permission level (0-7) |
| `expires_ts` | timestamp | Optional expiration |

### Permission Grant Examples

```sql
-- Type-level: User can VIEW all projects
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('employee', '{user-uuid}', 'project', '11111111-1111-1111-1111-111111111111', 0);

-- Instance-level: User can EDIT specific project
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('employee', '{user-uuid}', 'project', '{project-uuid}', 3);

-- Role-based: Role can DELETE all tasks
INSERT INTO app.entity_rbac (person_code, person_id, entity_code, entity_instance_id, permission)
VALUES ('role', '{role-uuid}', 'task', '11111111-1111-1111-1111-111111111111', 5);
```

---

## User Interaction Flow

```
CREATE Entity Flow (with RBAC)
──────────────────────────────

1. User clicks "Create Project"
   │
2. POST /api/v1/project
   │
3. Route checks CREATE permission:
   │
   const canCreate = await entityInfra.check_entity_rbac(
     userId, 'project', ALL_ENTITIES_ID, Permission.CREATE
   );
   │
   ├── If false → 403 Forbidden
   └── If true → Continue
   │
4. INSERT into d_project
   │
5. Grant OWNER to creator:
   │
   await entityInfra.set_entity_rbac_owner(userId, 'project', newId);
   │
6. Return 201 Created


LIST Entities Flow (with RBAC Filtering)
────────────────────────────────────────

1. User requests GET /api/v1/project
   │
2. Route gets RBAC WHERE condition:
   │
   const rbacWhere = await entityInfra.get_entity_rbac_where_condition(
     userId, 'project', Permission.VIEW, 'e'
   );
   │
3. Service checks permissions:
   │
   ├── Type-level access? → Returns: TRUE
   ├── Specific IDs? → Returns: e.id IN (...)
   └── No access? → Returns: FALSE
   │
4. Route executes query with RBAC filter:
   │
   SELECT e.* FROM app.d_project e
   WHERE {rbacWhere}
     AND e.active_flag = true
   │
5. Return only accessible projects
```

---

## Critical Considerations

### Why Service-Based (Not RLS)

| Aspect | Service Approach | PostgreSQL RLS |
|--------|------------------|----------------|
| **Connection pooling** | Works perfectly | Requires session variables |
| **Debugging** | Explicit WHERE clauses | Invisible filtering |
| **Role inheritance** | Easy with JOINs | Complex RLS policies |
| **Multi-tenant** | Flexible | Hard to combine with RBAC |
| **Performance** | Single query per check | May need multiple policies |

### Permission Inheritance Rules

| Rule | Description |
|------|-------------|
| **Level hierarchy** | OWNER (7) > CREATE (6) > DELETE (5) > SHARE (4) > EDIT (3) > COMMENT (1) > VIEW (0) |
| **Type-level** | Permission on `ALL_ENTITIES_ID` applies to ALL entities of that type |
| **Parent-VIEW** | If user can VIEW parent, they can VIEW children linked to it |
| **Parent-CREATE** | If user can CREATE on parent type, they can CREATE children |
| **Role membership** | Permissions granted to role apply to all role members |

### Common Patterns

| Operation | Permission Check |
|-----------|------------------|
| List entities | `get_entity_rbac_where_condition(userId, type, VIEW, alias)` |
| View single | `check_entity_rbac(userId, type, id, VIEW)` |
| Create | `check_entity_rbac(userId, type, ALL_ENTITIES_ID, CREATE)` |
| Edit | `check_entity_rbac(userId, type, id, EDIT)` |
| Delete | `check_entity_rbac(userId, type, id, DELETE)` |
| Grant permissions | `check_entity_rbac(userId, type, id, OWNER)` |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Custom RBAC SQL in routes | Use service methods |
| Checking permission after query | Filter in WHERE clause |
| Hardcoded permission levels | Use `Permission` enum |
| Skipping RBAC on internal calls | Always check (use skip flag only for system) |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
