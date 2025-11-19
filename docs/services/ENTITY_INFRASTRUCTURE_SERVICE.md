# Entity Infrastructure Service

> **Central nervous system for all entity operations** - Unified management of entity metadata, instance registry, parent-child relationships, and person-based RBAC with automatic permission inheritance.

---

## 1. Semantics & Business Context

### Purpose
The Entity Infrastructure Service is the **single source of truth** for managing 4 critical infrastructure tables that power the PMO platform's universal entity system:

1. **`entity`** - Entity type metadata (icons, labels, child entity codes)
2. **`entity_instance`** - Global instance registry (name/code cache for all entities)
3. **`entity_instance_link`** - Parent-child relationships (hard delete only, no soft delete)
4. **`entity_rbac`** - Person-based permissions with automatic inheritance

### Design Philosophy: Add-On Helper Pattern

**✅ Routes OWN their primary table queries** (complete control over SELECT/UPDATE/INSERT/DELETE)

**✅ Service provides infrastructure helpers** (RBAC checks, registry sync, linkage management)

**❌ Service does NOT build queries for routes** (not a query builder or ORM)

**❌ Service does NOT dictate route structure** (routes decide JOINs, filters, aggregations)

### Key Benefits

- **80% code reduction** - Eliminates boilerplate across 45+ entity routes
- **100% consistency** - All entities follow identical RBAC and linkage patterns
- **Zero external dependencies** - Self-contained RBAC logic (no coupled systems)
- **Automatic inheritance** - Role permissions + parent-VIEW/CREATE inheritance
- **Unified deletion** - Orchestrates cascade deletes across all infrastructure tables

---

## 2. Tooling & Framework Architecture

### Stack
- **Language**: TypeScript (ESM modules)
- **Database**: PostgreSQL 14+ with Drizzle ORM
- **Caching**: Redis (5-minute TTL for entity metadata)
- **Pattern**: Singleton service with typed interfaces

### Service Location
```
apps/api/src/services/entity-infrastructure.service.ts (1,410 lines)
```

### Core Imports
```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';
```

---

## 3. Architecture & System Design

### 3.1 Infrastructure Tables (4 Core Tables)

```
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────────┐                    │
│  │   entity     │      │ entity_instance  │                    │
│  │ (metadata)   │◄─────┤   (registry)     │                    │
│  └──────────────┘      └──────────────────┘                    │
│         │                       │                                │
│         │                       │                                │
│         ▼                       ▼                                │
│  ┌──────────────────────────────────────┐                       │
│  │   entity_instance_link               │                       │
│  │   (parent-child relationships)       │                       │
│  └──────────────────────────────────────┘                       │
│                                                                   │
│  ┌──────────────────────────────────────┐                       │
│  │   entity_rbac                        │                       │
│  │   (permissions + inheritance logic)  │                       │
│  └──────────────────────────────────────┘                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │   PRIMARY ENTITY TABLES              │
        │   (d_project, d_task, d_employee)    │
        │   Routes OWN these queries           │
        └─────────────────────────────────────┘
```

### 3.2 Table Definitions

#### entity (Entity Type Metadata)
```sql
Columns:
  - code: string (PK) - Entity type identifier (e.g., 'project', 'task')
  - name: string - Technical name
  - ui_label: string - Display label
  - ui_icon: string - Icon identifier
  - child_entity_codes: JSONB - Array of child entity types
  - display_order: number - Sort order in UI
  - active_flag: boolean - Soft delete flag
  - created_ts, updated_ts: timestamp

Purpose: Single source of truth for entity metadata
Caching: Redis (5-minute TTL)
```

#### entity_instance (Global Instance Registry)
```sql
Columns:
  - entity_code: string (FK → entity.code)
  - entity_instance_id: UUID (PK) - Entity ID
  - order_id: number - Auto-increment for sorting
  - entity_instance_name: string - Cached display name
  - code: string | null - Cached entity code
  - created_ts, updated_ts: timestamp

Purpose: Fast name/code resolution without JOIN to primary tables
Storage: Hard delete only (no active_flag)
```

#### entity_instance_link (Parent-Child Relationships)
```sql
Columns:
  - id: UUID (PK)
  - entity_code: string - Parent entity type
  - entity_instance_id: UUID - Parent entity ID
  - child_entity_code: string - Child entity type
  - child_entity_instance_id: UUID - Child entity ID
  - relationship_type: string - Default 'contains'
  - created_ts, updated_ts: timestamp

Purpose: Many-to-many parent-child relationships
Storage: Hard delete only (no active_flag)
Note: Asymmetric naming - parent columns lack 'parent_' prefix
```

#### entity_rbac (Person-Based Permissions)
```sql
Columns:
  - person_code: string - 'employee' or 'role'
  - person_id: UUID - Employee/Role ID
  - entity_code: string - Entity type
  - entity_instance_id: UUID - Entity ID (or ALL_ENTITIES_ID)
  - permission: number - 0-7 (VIEW to OWNER)
  - expires_ts: timestamp | null - Optional expiration
  - created_ts, updated_ts: timestamp

Purpose: Row-level security with automatic inheritance
Special ID: '11111111-1111-1111-1111-111111111111' = type-level access
```

---

## 4. Data Flow Diagrams

### 4.1 CREATE Flow (6-Step Pattern)

```
USER REQUEST: POST /api/v1/project?parent_code=business&parent_id=123
│
├─ STEP 1: RBAC Check (Type-Level CREATE Permission)
│  └─ entityInfra.check_entity_rbac(userId, 'project', ALL_ENTITIES_ID, Permission.CREATE)
│
├─ STEP 2: RBAC Check (Parent EDIT Permission - if linking)
│  └─ entityInfra.check_entity_rbac(userId, 'business', '123', Permission.EDIT)
│
├─ STEP 3: Route OWNS INSERT (Primary Table)
│  └─ db.execute(sql`INSERT INTO app.d_project ...`)
│
├─ STEP 4: Register Instance (entity_instance)
│  └─ entityInfra.set_entity_instance_registry({
│       entity_type: 'project',
│       entity_id: projectId,
│       entity_name: 'Kitchen Renovation',
│       entity_code: 'PROJ-001'
│     })
│
├─ STEP 5: Grant OWNER Permission (entity_rbac)
│  └─ entityInfra.set_entity_rbac_owner(userId, 'project', projectId)
│
└─ STEP 6: Link to Parent (entity_instance_link - if provided)
   └─ entityInfra.set_entity_instance_link({
        parent_entity_type: 'business',
        parent_entity_id: '123',
        child_entity_type: 'project',
        child_entity_id: projectId
      })
```

### 4.2 UPDATE Flow (3-Step Pattern)

```
USER REQUEST: PATCH /api/v1/project/456
│
├─ STEP 1: RBAC Check (Instance-Level EDIT Permission)
│  └─ entityInfra.check_entity_rbac(userId, 'project', '456', Permission.EDIT)
│
├─ STEP 2: Route OWNS UPDATE (Primary Table)
│  └─ db.execute(sql`UPDATE app.d_project SET ... WHERE id = '456'`)
│
└─ STEP 3: Sync Registry (entity_instance - if name/code changed)
   └─ entityInfra.update_entity_instance_registry('project', '456', {
        entity_name: 'Updated Name',
        entity_code: 'PROJ-002'
      })
```

### 4.3 LIST Flow (RBAC Filtering)

```
USER REQUEST: GET /api/v1/project
│
├─ STEP 1: Get RBAC WHERE Condition
│  └─ rbacCondition = await entityInfra.get_entity_rbac_where_condition(
│       userId, 'project', Permission.VIEW, 'e'
│     )
│     Returns one of:
│     • 'TRUE' - Type-level access (see all)
│     • 'FALSE' - No access (see nothing)
│     • 'e.id IN (uuid1, uuid2, ...)' - Specific IDs only
│
└─ STEP 2: Route Builds Custom Query (Full Control)
   └─ db.execute(sql`
        SELECT e.*, b.name as business_name, COUNT(t.id) as task_count
        FROM app.d_project e
        LEFT JOIN app.d_business b ON e.business_id = b.id
        LEFT JOIN app.d_task t ON t.project_id = e.id
        WHERE ${rbacCondition}
          AND e.active_flag = true
          AND e.budget_allocated_amt > 10000
        GROUP BY e.id, b.name
        ORDER BY e.created_ts DESC
      `)
```

### 4.4 DELETE Flow (Unified Orchestration)

```
USER REQUEST: DELETE /api/v1/project/789
│
├─ STEP 1: RBAC Check (DELETE Permission)
│  └─ entityInfra.check_entity_rbac(userId, 'project', '789', Permission.DELETE)
│
├─ STEP 2: Cascade Delete Children (Optional)
│  └─ For each child in entity_instance_link:
│     └─ Recursively call delete_all_entity_infrastructure(child)
│
├─ STEP 3: Hard Delete from entity_instance
│  └─ DELETE FROM app.entity_instance WHERE ...
│
├─ STEP 4: Hard Delete from entity_instance_link
│  └─ DELETE FROM app.entity_instance_link WHERE ...
│
├─ STEP 5: Remove RBAC Entries (Optional)
│  └─ DELETE FROM app.entity_rbac WHERE ...
│
└─ STEP 6: Primary Table Callback (Optional)
   └─ primary_table_callback(db, '789')
      (Route decides: soft delete vs hard delete)
```

---

## 5. RBAC Permission Model

### 5.1 Permission Hierarchy (Automatic Inheritance)

```
OWNER [7] ─┬─ CREATE [6] ─┬─ DELETE [5] ─┬─ SHARE [4] ─┬─ EDIT [3] ─┬─ COMMENT [1] ─┬─ VIEW [0]
           │              │              │             │            │               │
           └─ Implies all lower permissions ────────────────────────────────────────┘
```

### 5.2 Permission Sources (4 Layers)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DIRECT EMPLOYEE PERMISSIONS (entity_rbac)                    │
│    • person_code = 'employee'                                    │
│    • person_id = user.id                                         │
│    • Highest priority                                            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ROLE-BASED PERMISSIONS (entity_rbac + entity_instance_link)  │
│    • employee → role → permissions                               │
│    • person_code = 'role'                                        │
│    • Linked via entity_instance_link                             │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PARENT-VIEW INHERITANCE (automatic)                          │
│    • If user has VIEW on parent → Gains VIEW on all children    │
│    • permission >= 0 on parent                                   │
│    • One-way: parent → child only                                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PARENT-CREATE INHERITANCE (automatic)                        │
│    • If user has CREATE on parent → Gains CREATE on children    │
│    • permission >= 6 on parent                                   │
│    • Enables inline create-link-edit pattern                    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Type-Level vs Instance-Level Permissions

```
TYPE-LEVEL ACCESS (applies to ALL entities of a type)
entity_instance_id = '11111111-1111-1111-1111-111111111111'
Example: User can VIEW all projects

INSTANCE-LEVEL ACCESS (specific entity only)
entity_instance_id = {actual UUID}
Example: User can EDIT project #456 only
```

---

## 6. API Reference (Service Methods)

### 6.1 Entity Metadata Methods

```typescript
// Get entity type metadata (cached in Redis)
async get_entity(entity_type: string, include_inactive?: boolean): Promise<Entity | null>

// Get all entity types
async get_all_entity(include_inactive?: boolean): Promise<Entity[]>

// Get parent entity types (inverse lookup of child_entity_codes)
async get_parent_entity_types(child_entity_type: string): Promise<string[]>

// Invalidate Redis cache after metadata changes
async invalidate_entity_cache(entity_type: string): Promise<void>

// Clear all entity metadata cache
async clear_all_entity_cache(): Promise<void>
```

### 6.2 Instance Registry Methods

```typescript
// Register entity instance (upsert pattern)
async set_entity_instance_registry(params: {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  entity_code?: string | null;
}): Promise<EntityInstance>

// Update instance name/code (sync after primary table update)
async update_entity_instance_registry(
  entity_type: string,
  entity_id: string,
  updates: { entity_name?: string; entity_code?: string | null }
): Promise<EntityInstance | null>

// Delete from registry (hard delete)
async delete_entity_instance_registry(entity_type: string, entity_id: string): Promise<void>

// Validate instance exists
async validate_entity_instance_registry(entity_type: string, entity_id: string): Promise<boolean>

// Resolve UUID fields to human-readable names
async resolve_entity_references(
  fields: Record<string, string | string[] | null>
): Promise<Record<string, any>>
```

### 6.3 Relationship Management Methods

```typescript
// Create parent-child linkage (idempotent)
async set_entity_instance_link(params: {
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  relationship_type?: string;
}): Promise<EntityLink>

// Get child entity IDs (for parent-child filtering)
async get_entity_instance_link_children(
  parent_entity_type: string,
  parent_entity_id: string,
  child_entity_type: string
): Promise<string[]>

// Get dynamic child entity tabs (for detail pages)
async get_dynamic_child_entity_tabs(
  entity_type: string
): Promise<Array<{ entity: string; label: string; icon?: string }>>

// Get all linkages with filters
async get_all_entity_instance_links(filters?: {
  parent_entity_type?: string;
  parent_entity_id?: string;
  child_entity_type?: string;
  child_entity_id?: string;
}): Promise<EntityLink[]>

// Update linkage relationship type
async update_entity_instance_link(linkage_id: string, relationship_type: string): Promise<EntityLink | null>

// Delete linkage (hard delete)
async delete_entity_instance_link(linkage_id: string): Promise<void>
```

### 6.4 RBAC Permission Methods

```typescript
// Check if user has permission (with inheritance)
async check_entity_rbac(
  user_id: string,
  entity_type: string,
  entity_id: string,
  required_permission: Permission
): Promise<boolean>

// Get SQL WHERE condition for LIST queries
async get_entity_rbac_where_condition(
  user_id: string,
  entity_type: string,
  required_permission: Permission,
  table_alias?: string
): Promise<SQL>

// Grant permission to user
async set_entity_rbac(
  user_id: string,
  entity_type: string,
  entity_id: string,
  permission_level: Permission
): Promise<any>

// Grant OWNER permission (highest level)
async set_entity_rbac_owner(
  user_id: string,
  entity_type: string,
  entity_id: string
): Promise<any>

// Revoke all permissions
async delete_entity_rbac(
  user_id: string,
  entity_type: string,
  entity_id: string
): Promise<void>
```

### 6.5 Unified Delete Method

```typescript
// Orchestrate complete entity deletion
async delete_all_entity_infrastructure(
  entity_type: string,
  entity_id: string,
  options: {
    user_id: string;
    hard_delete?: boolean;              // Primary table soft vs hard delete
    cascade_delete_children?: boolean;  // Recursive child deletion
    remove_rbac_entries?: boolean;      // Clean up permissions
    skip_rbac_check?: boolean;          // Bypass permission check
    primary_table_callback?: (db: DB, entity_id: string) => Promise<void>;
  }
): Promise<DeleteEntityResult>
```

---

## 7. User Interaction Flow Examples

### 7.1 Creating a Project Under a Business

```
FRONTEND: User clicks "Add Project" in Business detail page
    │
    ▼
UI: Opens ProjectForm with parent_code=business, parent_id=123
    │
    ▼
API: POST /api/v1/project?parent_code=business&parent_id=123
    │
    ├─ Check: Can user CREATE projects? (type-level)
    │  ✅ entityInfra.check_entity_rbac(userId, 'project', ALL_ENTITIES_ID, Permission.CREATE)
    │
    ├─ Check: Can user EDIT parent business? (linkage permission)
    │  ✅ entityInfra.check_entity_rbac(userId, 'business', '123', Permission.EDIT)
    │
    ├─ Create: INSERT INTO app.d_project (route-controlled)
    │
    ├─ Register: entityInfra.set_entity_instance_registry(...)
    │
    ├─ Grant: entityInfra.set_entity_rbac_owner(userId, 'project', projectId)
    │
    └─ Link: entityInfra.set_entity_instance_link(business→project)
    │
    ▼
FRONTEND: Redirects to /project/{projectId}
```

### 7.2 Viewing Projects with RBAC Filtering

```
FRONTEND: User navigates to /project
    │
    ▼
API: GET /api/v1/project
    │
    ├─ Get accessible IDs via RBAC
    │  └─ rbacCondition = entityInfra.get_entity_rbac_where_condition(userId, 'project', Permission.VIEW, 'e')
    │
    ├─ Route builds custom query
    │  └─ SELECT e.*, b.name FROM d_project e
    │     LEFT JOIN d_business b ON ...
    │     WHERE ${rbacCondition}
    │
    └─ Returns only projects user can VIEW
    │
    ▼
FRONTEND: Displays filtered project list
```

### 7.3 Deleting a Project with Cascading

```
FRONTEND: User clicks "Delete" on project detail page
    │
    ▼
API: DELETE /api/v1/project/789
    │
    └─ entityInfra.delete_all_entity_infrastructure('project', '789', {
         user_id: userId,
         cascade_delete_children: true,
         remove_rbac_entries: true,
         primary_table_callback: async (db, id) => {
           await db.execute(sql`UPDATE app.d_project SET active_flag = false WHERE id = ${id}`)
         }
       })
    │
    ├─ Step 1: Check DELETE permission ✅
    ├─ Step 2: Cascade delete all tasks, wiki, artifacts (recursive)
    ├─ Step 3: Hard delete from entity_instance
    ├─ Step 4: Hard delete from entity_instance_link
    ├─ Step 5: Remove all RBAC entries
    └─ Step 6: Soft delete from d_project (via callback)
    │
    ▼
FRONTEND: Redirects to /project (entity no longer visible)
```

---

## 8. Critical Considerations for Developers

### 8.1 Route Ownership Rules

```
✅ DO: Routes OWN primary table queries
   const result = await db.execute(sql`
     SELECT e.*, b.name, COUNT(t.id)
     FROM app.d_project e
     LEFT JOIN app.d_business b ON e.business_id = b.id
     LEFT JOIN app.d_task t ON t.project_id = e.id
     WHERE ${rbacCondition}  ← Service provides this only
     GROUP BY e.id, b.name
   `);

❌ DON'T: Expect service to build queries for you
   const result = await entityInfra.listProjects(filters);  ← This doesn't exist
```

### 8.2 RBAC Best Practices

```
✅ Always check CREATE permission at type level
   entityInfra.check_entity_rbac(userId, entityType, ALL_ENTITIES_ID, Permission.CREATE)

✅ Always check instance permission for EDIT/DELETE
   entityInfra.check_entity_rbac(userId, entityType, entityId, Permission.EDIT)

✅ Parent linkage requires EDIT on parent
   entityInfra.check_entity_rbac(userId, parentCode, parentId, Permission.EDIT)

❌ Don't assume type-level permission = instance permission
   CREATE permission doesn't grant EDIT on existing entities
```

### 8.3 Registry Sync Pattern

```
✅ Always sync registry after name/code changes
   await db.execute(sql`UPDATE app.d_project SET name = ${newName}`);
   await entityInfra.update_entity_instance_registry('project', id, {
     entity_name: newName
   });

❌ Don't forget registry sync - breaks name resolution
   await db.execute(sql`UPDATE app.d_project SET name = ${newName}`);
   // Missing registry sync → stale names in UI
```

### 8.4 Hard Delete vs Soft Delete

```
INFRASTRUCTURE TABLES (Always Hard Delete):
  • entity_instance - No active_flag column
  • entity_instance_link - No active_flag column
  • entity_rbac - No expiration = hard delete

PRIMARY TABLES (Route Decides):
  • d_project, d_task, etc. - Have active_flag for soft delete
  • Route controls via primary_table_callback parameter
```

### 8.5 Permission Inheritance Gotchas

```
✅ Parent VIEW → Child VIEW (automatic)
   User with VIEW on business → Gets VIEW on all projects under it

✅ Parent CREATE → Child CREATE (automatic)
   User with CREATE on business → Can CREATE projects under it

❌ Child VIEW ≠ Parent VIEW (one-way only)
   User with VIEW on project → Does NOT get VIEW on parent business

❌ EDIT does NOT cascade (intentional)
   User with EDIT on business → Must have explicit EDIT on project
```

### 8.6 Cache Invalidation

```
✅ Invalidate cache after modifying entity metadata
   await db.execute(sql`UPDATE app.entity SET child_entity_codes = ...`);
   await entityInfra.invalidate_entity_cache('project');

✅ Cache is shared across API instances (Redis)
   Cache invalidation propagates to all servers automatically

❌ Don't modify entity table without invalidation
   Child tabs will show stale data for 5 minutes
```

---

## 9. Action Required

### 9.1 Outdated Documentation

The following files reference obsolete systems and must be updated:

**DELETE REFERENCES TO:**
- `unified-data-gate.ts` (purged in v3.4.0)
- `unified_data_gate.rbac_gate` (replaced by `entityInfra.check_entity_rbac`)
- `d_entity` table name (correct: `entity`)
- `d_entity_instance_link` table name (correct: `entity_instance_link`)
- `ENTITY_TYPE` constant (correct: `ENTITY_CODE`)

**UPDATE THESE FILES:**
1. `docs/api/entity_endpoint_design.md` - Update all code examples to use Entity Infrastructure Service
2. `apps/api/src/modules/*/routes.ts` - Verify all 45+ modules follow patterns in this doc
3. `CLAUDE.md` - Update service architecture section with current patterns
4. `README.md` - Reference this document for entity infrastructure patterns

### 9.2 Implementation Checklist for New Routes

When creating a new entity route, follow this checklist:

```typescript
// 1. Define module constants
const ENTITY_CODE = 'your_entity';
const TABLE_ALIAS = 'e';

// 2. Import service
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';
const entityInfra = getEntityInfrastructure(db);

// 3. Implement CREATE with 6-step pattern
// 4. Implement UPDATE with 3-step pattern
// 5. Implement LIST with RBAC filtering
// 6. Add factory endpoints for delete and children
```

---

**Version**: 1.0.0
**Updated**: 2025-11-19
**Service File**: `apps/api/src/services/entity-infrastructure.service.ts` (1,410 lines)
**Architecture**: Add-On Helper Pattern (Routes own queries, Service provides infrastructure)
