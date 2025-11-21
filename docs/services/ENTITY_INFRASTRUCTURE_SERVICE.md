# Entity Infrastructure Service

> **Centralized management of entity infrastructure tables with zero external dependencies**

## Overview

The Entity Infrastructure Service is a **self-contained, singleton service** that manages the 4 core infrastructure tables powering the PMO platform's Universal Entity System. It provides helper methods for routes while maintaining the principle that **routes OWN their primary table queries**.

**Location**: `apps/api/src/services/entity-infrastructure.service.ts` (1160 lines)

### Design Pattern: Add-On Helper Service

- ✅ **Routes OWN** their SELECT/UPDATE/INSERT/DELETE queries completely
- ✅ **Service provides** infrastructure add-on helpers only
- ✅ **Routes build** custom queries with JOINs, filters, aggregations
- ❌ **Service does NOT** build queries for routes
- ❌ **Service does NOT** dictate query structure

## 4 Infrastructure Tables Managed

| Table | Purpose | Operations |
|-------|---------|------------|
| **entity** | Entity TYPE metadata (icons, labels, child_entity_codes) | get_entity(), get_all_entity(), get_parent_entity_types() |
| **entity_instance** | Instance registry (entity_instance_name, code cache) | set_entity_instance_registry(), update_entity_instance_registry(), delete_entity_instance_registry() |
| **entity_instance_link** | Parent-child relationships (hard delete only) | set_entity_instance_link(), get_entity_instance_link_children(), get_all_entity_instance_links() |
| **entity_rbac** | Permissions (0=VIEW, 1=COMMENT, 3=EDIT/CONTRIBUTE, 4=SHARE, 5=DELETE, 6=CREATE, 7=OWNER) | check_entity_rbac(), set_entity_rbac(), set_entity_rbac_owner(), get_entity_rbac_where_condition() |

## Usage in Routes

### Initialization

```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

const ENTITY_TYPE = 'project';
const entityInfra = getEntityInfrastructure(db);
```

### 6-Step CREATE Pattern

```typescript
fastify.post('/api/v1/project', async (request, reply) => {
  const { parent_type, parent_id } = request.query;
  const userId = request.user.sub;
  const data = request.body;

  // STEP 1: RBAC CHECK 1 - Can user CREATE this entity type?
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_TYPE, ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) return reply.status(403).send({ error: 'Forbidden' });

  // STEP 2: RBAC CHECK 2 - If linking to parent, can user EDIT parent?
  if (parent_type && parent_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parent_type, parent_id, Permission.EDIT
    );
    if (!canEditParent) return reply.status(403).send({ error: 'Forbidden' });
  }

  // STEP 3: ✅ ROUTE OWNS INSERT into primary table
  const result = await db.execute(sql`
    INSERT INTO app.d_project (code, name, descr, ...)
    VALUES (${data.code}, ${data.name}, ${data.descr}, ...)
    RETURNING *
  `);
  const project = result[0];

  // STEP 4: Register in entity_instance
  await entityInfra.set_entity_instance_registry({
    entity_type: ENTITY_TYPE,
    entity_id: project.id,
    entity_name: project.name,
    entity_code: project.code
  });

  // STEP 5: Grant OWNER permission to creator
  await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, project.id);

  // STEP 6: Link to parent (if provided)
  if (parent_type && parent_id) {
    await entityInfra.set_entity_instance_link({
      parent_entity_type: parent_type,
      parent_entity_id: parent_id,
      child_entity_type: ENTITY_TYPE,
      child_entity_id: project.id,
      relationship_type: 'contains'
    });
  }

  return reply.status(201).send(project);
});
```

### 3-Step UPDATE Pattern

```typescript
fastify.patch('/api/v1/project/:id', async (request, reply) => {
  const { id } = request.params;
  const updates = request.body;
  const userId = request.user.sub;

  // STEP 1: RBAC check - Can user EDIT this entity?
  const canEdit = await entityInfra.check_entity_rbac(
    userId, ENTITY_TYPE, id, Permission.EDIT
  );
  if (!canEdit) return reply.status(403).send({ error: 'Forbidden' });

  // STEP 2: ✅ ROUTE OWNS UPDATE query
  const updateFields: any[] = [];
  if (updates.name !== undefined) updateFields.push(sql`name = ${updates.name}`);
  if (updates.code !== undefined) updateFields.push(sql`code = ${updates.code}`);
  // ... more fields
  updateFields.push(sql`updated_ts = now()`);
  updateFields.push(sql`version = version + 1`);

  const result = await db.execute(sql`
    UPDATE app.d_project
    SET ${sql.join(updateFields, sql`, `)}
    WHERE id = ${id}
    RETURNING *
  `);

  // STEP 3: Sync registry if name/code changed
  if (updates.name !== undefined || updates.code !== undefined) {
    await entityInfra.update_entity_instance_registry(ENTITY_TYPE, id, {
      entity_name: updates.name,
      entity_code: updates.code
    });
  }

  return reply.send(result[0]);
});
```

### LIST Pattern (Route Builds Query)

```typescript
fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;
  const { limit = 20, offset = 0 } = request.query;

  // Service just provides RBAC WHERE condition helper
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_TYPE, Permission.VIEW, 'e'
  );

  // ✅ ROUTE builds its own query structure (full control)
  const query = sql`
    SELECT
      e.*,
      b.name as business_name,
      COUNT(t.id) as task_count
    FROM app.d_project e
    LEFT JOIN app.d_business b ON e.business_id = b.id
    LEFT JOIN app.d_task t ON t.project_id = e.id
    WHERE ${rbacCondition}
      AND e.active_flag = true
    GROUP BY e.id, b.name
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const projects = await db.execute(query);
  return reply.send({ data: projects });
});
```

## RBAC Permission Model

### Permission Hierarchy (0-7)

```typescript
export enum Permission {
  VIEW = 0,        // Read-only access
  COMMENT = 1,     // Add comments on entities (implies VIEW)
  EDIT = 3,        // Modify entity (implies COMMENT + VIEW)
  CONTRIBUTE = 3,  // Alias for EDIT (submit data)
  SHARE = 4,       // Share with others (implies EDIT + COMMENT + VIEW)
  DELETE = 5,      // Soft delete (implies SHARE + EDIT + COMMENT + VIEW)
  CREATE = 6,      // Create new entities (type-level only, implies all below)
  OWNER = 7        // Full control including permission management (implies ALL)
}
```

### Type-Level Permissions

```typescript
// Special entity ID for type-level permissions (applies to ALL entities of type)
export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

// Example: Grant user permission to CREATE all projects
await entityInfra.set_entity_rbac(
  userId,
  'project',
  ALL_ENTITIES_ID,
  Permission.CREATE
);
```

### Permission Resolution (4 Sources)

The service automatically resolves permissions from 4 sources:

1. **Direct Employee Permissions** - `entity_rbac` where `person_code='employee'`
2. **Role-Based Permissions** - `entity_rbac` where `person_code='role'` (via `entity_instance_link`)
3. **Parent-VIEW Inheritance** - If parent has VIEW (0+), child gains VIEW (permission 0)
4. **Parent-CREATE Inheritance** - If parent has CREATE (6+), child gains SHARE (permission 4)

The service takes the **MAX permission level** from all sources.

## Key Service Methods

### RBAC Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `check_entity_rbac(userId, entityType, entityId, permission)` | Check if user has specific permission | `boolean` |
| `set_entity_rbac(userId, entityType, entityId, permission)` | Grant permission to user | Permission record |
| `set_entity_rbac_owner(userId, entityType, entityId)` | Grant OWNER permission | Permission record |
| `delete_entity_rbac(userId, entityType, entityId)` | Revoke all permissions | `void` |
| `get_entity_rbac_where_condition(userId, entityType, permission, tableAlias)` | Get SQL WHERE fragment for LIST queries | `string` (SQL condition) |

### Registry Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `set_entity_instance_registry({entity_type, entity_id, entity_name, entity_code})` | Register instance (insert only) | `EntityInstance` |
| `update_entity_instance_registry(entityType, entityId, {entity_name, entity_code})` | Update name/code | `EntityInstance | null` |
| `delete_entity_instance_registry(entityType, entityId)` | Hard delete from registry | `void` |
| `validate_entity_instance_registry(entityType, entityId)` | Check if instance exists | `boolean` |

### Linkage Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `set_entity_instance_link({parent_entity_type, parent_entity_id, child_entity_type, child_entity_id})` | Create linkage (insert only) | `EntityLink` |
| `get_entity_instance_link_children(parentType, parentId, childType)` | Get child IDs of specific type | `string[]` (child IDs) |
| `get_all_entity_instance_links(filters)` | Query linkages with filters | `EntityLink[]` |
| `delete_entity_instance_link(linkageId)` | Hard delete linkage | `void` |
| `update_entity_instance_link(linkageId, relationshipType)` | Update relationship_type | `EntityLink | null` |
| `get_entity_instance_link_by_id(linkageId)` | Get single linkage | `EntityLink | null` |
| `get_dynamic_child_entity_tabs(entityType)` | Get child entity metadata for tabs | `{entity, label, icon}[]` |

### Entity Metadata Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `get_entity(entityType, includeInactive)` | Get entity TYPE metadata | `Entity | null` |
| `get_all_entity(includeInactive)` | Get all entity types | `Entity[]` |
| `get_parent_entity_types(childEntityType)` | Find parent entity types | `string[]` |

### Unified Delete Method

| Method | Purpose | Returns |
|--------|---------|---------|
| `delete_all_entity_infrastructure(entityType, entityId, options)` | Orchestrate deletion across all 4 tables | `DeleteEntityResult` |

**Options**:
- `user_id` - User performing delete (required)
- `hard_delete` - Only affects primary_table_callback behavior (default: false)
  - **NOTE**: `entity_instance` and `entity_instance_link` are ALWAYS hard-deleted (no active_flag columns)
- `cascade_delete_children` - Recursively delete children (default: false)
- `remove_rbac_entries` - Remove permission entries from entity_rbac (default: false)
- `skip_rbac_check` - Skip permission validation (default: false)
- `primary_table_callback` - Custom delete logic for primary table

## Benefits

### 80% Code Reduction

**Before** (Manual Infrastructure Code):
```typescript
// Register instance
await db.execute(sql`INSERT INTO app.entity_instance ...`);

// Grant permission
await db.execute(sql`INSERT INTO app.entity_rbac ...`);

// Create linkage
await db.execute(sql`INSERT INTO app.entity_instance_link ...`);

// Check permission with complex query
const result = await db.execute(sql`
  WITH direct_emp AS (...), role_based AS (...), parent_view AS (...)
  SELECT COALESCE(MAX(permission), -1) ...
`);
// 30+ lines of boilerplate PER ROUTE
```

**After** (Entity Infrastructure Service):
```typescript
await entityInfra.set_entity_instance_registry({...});
await entityInfra.set_entity_rbac_owner(userId, entityType, entityId);
await entityInfra.set_entity_instance_link({...});
const canEdit = await entityInfra.check_entity_rbac(userId, entityType, id, Permission.EDIT);
// 4 lines, consistent across ALL routes
```

### 100% Consistency

- ✅ Same RBAC logic across all 45+ entity routes
- ✅ Same registry pattern across all entities
- ✅ Same linkage pattern across all parent-child relationships
- ✅ Zero drift - single source of truth

### Self-Contained RBAC

- ✅ No external dependencies (no `unified-data-gate` coupling)
- ✅ Self-contained permission resolution
- ✅ Built-in parent inheritance (VIEW + CREATE)
- ✅ Role-based + employee-based permissions

## Implementation Examples

### business/routes.ts

```typescript:apps/api/src/modules/business/routes.ts
// Line 171: Initialize service
const entityInfra = getEntityInfrastructure(db);

// Line 356: RBAC check with service
const canView = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.VIEW);

// Line 365: Get child tabs metadata
const tabs = await entityInfra.get_dynamic_child_entity_tabs(ENTITY_TYPE);

// Line 564: Register instance
await entityInfra.set_entity_instance_registry({
  entity_type: ENTITY_TYPE,
  entity_id: bizId,
  entity_name: bizData.name,
  entity_code: bizData.code
});

// Line 574: Grant ownership
await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, bizId);

// Line 580: Create linkage
await entityInfra.set_entity_instance_link({
  parent_entity_type: parent_type,
  parent_entity_id: parent_id,
  child_entity_type: ENTITY_TYPE,
  child_entity_id: bizId,
  relationship_type: 'contains'
});
```

### project/routes.ts

```typescript:apps/api/src/modules/project/routes.ts
// Line 222: Initialize service
const entityInfra = getEntityInfrastructure(db);

// Line 474: RBAC check
const canView = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, id, Permission.VIEW);

// Line 538: Type-level CREATE check
const canCreate = await entityInfra.check_entity_rbac(userId, ENTITY_TYPE, ALL_ENTITIES_ID, Permission.CREATE);

// Line 621: Register + grant + link (3-line pattern)
await entityInfra.set_entity_instance_registry({...});
await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, projectId);
await entityInfra.set_entity_instance_link({...});
```

### task/routes.ts

```typescript:apps/api/src/modules/task/routes.ts
// Same patterns as business and project
// Zero variation - 100% consistency
```

## Important: Hard Delete vs Soft Delete

The infrastructure tables have been simplified to use **hard deletes only**:

- ❌ **NO `active_flag`** in `entity_instance`
- ❌ **NO `active_flag`** in `entity_instance_link`

**Implications**:
1. `delete_entity_instance_registry()` - Always performs `DELETE FROM`
2. `delete_entity_instance_link()` - Always performs `DELETE FROM`
3. `delete_all_entity_infrastructure()` - Always hard-deletes infrastructure records
   - The `hard_delete` parameter **only affects** the `primary_table_callback` behavior
   - Infrastructure tables are ALWAYS hard-deleted regardless of this flag

**Primary tables** (like `d_project`, `d_task`) still have `active_flag` for soft deletion.

## Related Documentation

- **DDL Files**:
  - `db/entity_configuration_settings/02_entity.ddl` - entity table
  - `db/entity_configuration_settings/03_entity_instance.ddl` - Registry table
  - `db/entity_configuration_settings/05_entity_instance_link.ddl` - Linkage table
  - `db/entity_configuration_settings/06_entity_rbac.ddl` - RBAC table

- **Service Implementation**: `apps/api/src/services/entity-infrastructure.service.ts`

- **Route Migration Status**:
  - ⚠️ Routes currently use legacy `unified-data-gate.ts` (needs migration)
  - ⚠️ Routes reference old table names (`d_entity_rbac`, `d_entity_instance_link`)
  - ✅ Entity Infrastructure Service is ready with correct schema

## Anti-Patterns (Avoid)

❌ **Service builds queries for routes**:
```typescript
// WRONG - Service should NOT build queries
const projects = await entityInfra.getAll('project', filters);
```

❌ **Routes bypass service for infrastructure operations**:
```typescript
// WRONG - Use service instead
await db.execute(sql`INSERT INTO app.entity_rbac ...`);
```

❌ **Inconsistent patterns across routes**:
```typescript
// WRONG - All routes MUST follow same pattern
// Some routes use service, some don't → creates drift
```

## Migration from Legacy Patterns

**CURRENT STATE**: Routes still use legacy `unified-data-gate.ts` with OLD schema:
- OLD tables: `d_entity_rbac`, `d_entity_instance_link` (don't exist)
- OLD columns: `person_entity_name`, `parent_entity_type`, `active_flag`
- NEW tables: `entity_rbac`, `entity_instance_link` (actual schema)
- NEW columns: `person_code`, `entity_code`, no `active_flag`

**Files requiring migration** (30+ routes):
- `apps/api/src/lib/unified-data-gate.ts` - Legacy RBAC (TO BE DELETED)
- `apps/api/src/lib/child-entity-route-factory.ts` - Legacy factories (TO BE DELETED)
- `apps/api/src/lib/entity-delete-route-factory.ts` - Legacy delete (TO BE DELETED)
- All route modules that import from above

**Migration steps for each route**:

1. **Add service initialization**: `const entityInfra = getEntityInfrastructure(db);`
2. **Replace RBAC queries** with `check_entity_rbac()`, `get_entity_rbac_where_condition()`
3. **Replace registry INSERT** with `set_entity_instance_registry()`
4. **Replace linkage INSERT** with `set_entity_instance_link()`
5. **Follow 6-step CREATE** and **3-step UPDATE** patterns

## Version History

- **v2.0.0** (2025-01-18) - Documentation updated for new data model
  - Service uses NEW schema: `entity`, `entity_instance`, `entity_instance_link`, `entity_rbac`
  - Hard delete only for infrastructure tables (no `active_flag`)
  - Permission hierarchy: 0-7 (VIEW, COMMENT, EDIT, SHARE, DELETE, CREATE, OWNER)
  - **NOTE**: Routes NOT yet migrated - still use legacy `unified-data-gate.ts`
- **v1.0.0** (2025-01-17) - Initial service implementation (1108 lines)
  - Pattern: Add-On Helper Service (routes own queries)
  - Status: Service ready, route migration pending
