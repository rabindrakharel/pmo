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
| **d_entity** | Entity TYPE metadata (icons, labels, child_entities) | get_entity(), get_all_entity(), get_parent_entity_types() |
| **d_entity_instance_registry** | Instance registry (entity_name, entity_code cache) | set_entity_instance_registry(), update_entity_instance_registry(), deactivate_entity_instance_registry() |
| **d_entity_instance_link** | Parent-child relationships (idempotent) | set_entity_instance_link(), get_entity_instance_link_children(), get_all_entity_instance_links() |
| **d_entity_rbac** | Permissions (0=VIEW, 1=EDIT, 2=SHARE, 3=DELETE, 4=CREATE, 5=OWNER) | check_entity_rbac(), set_entity_rbac(), set_entity_rbac_owner(), get_entity_rbac_where_condition() |

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

  // STEP 4: Register in d_entity_instance_registry
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

### Permission Hierarchy (0-5)

```typescript
export enum Permission {
  VIEW = 0,    // Read-only access
  EDIT = 1,    // Modify entity (implies VIEW)
  SHARE = 2,   // Share with others (implies EDIT + VIEW)
  DELETE = 3,  // Soft delete (implies SHARE + EDIT + VIEW)
  CREATE = 4,  // Create new entities (type-level only, implies all below)
  OWNER = 5    // Full control (implies all permissions)
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

1. **Direct Employee Permissions** - `d_entity_rbac` where `person_entity_name='employee'`
2. **Role-Based Permissions** - `d_entity_rbac` where `person_entity_name='role'` (via `d_entity_instance_link`)
3. **Parent-VIEW Inheritance** - If parent has VIEW (0+), child gains VIEW
4. **Parent-CREATE Inheritance** - If parent has CREATE (4+), child gains CREATE

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
| `set_entity_instance_registry({entity_type, entity_id, entity_name, entity_code})` | Register instance (upsert) | `EntityInstance` |
| `update_entity_instance_registry(entityType, entityId, {entity_name, entity_code})` | Update name/code | `EntityInstance | null` |
| `deactivate_entity_instance_registry(entityType, entityId)` | Soft delete from registry | `EntityInstance | null` |
| `validate_entity_instance_registry(entityType, entityId, requireActive)` | Check if instance exists | `boolean` |

### Linkage Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `set_entity_instance_link({parent_entity_type, parent_entity_id, child_entity_type, child_entity_id})` | Create/reactivate linkage (idempotent) | `EntityLink` |
| `get_entity_instance_link_children(parentType, parentId, childType)` | Get child IDs of specific type | `string[]` (child IDs) |
| `get_all_entity_instance_links(filters)` | Query linkages with filters | `EntityLink[]` |
| `delete_entity_instance_link(linkageId)` | Soft delete linkage | `EntityLink | null` |
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
- `hard_delete` - true = DELETE, false = soft delete (default: false)
- `cascade_delete_children` - Recursively delete children (default: false)
- `remove_rbac_entries` - Remove permission entries (default: false)
- `skip_rbac_check` - Skip permission validation (default: false)
- `primary_table_callback` - Custom delete logic for primary table

## Benefits

### 80% Code Reduction

**Before** (Manual Infrastructure Code):
```typescript
// Register instance
await db.execute(sql`INSERT INTO app.d_entity_instance_registry ...`);

// Grant permission
await db.execute(sql`INSERT INTO app.d_entity_rbac ...`);

// Create linkage
await db.execute(sql`INSERT INTO app.d_entity_instance_link ...`);

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

## Related Documentation

- **DDL Files**:
  - `db/entity_configuration_settings/02_entity.ddl` - d_entity table
  - `db/entity_configuration_settings/03_d_entity_instance_registry.ddl` - Registry table
  - `db/entity_configuration_settings/05_d_entity_instance_link.ddl` - Linkage table
  - `db/entity_configuration_settings/06_d_entity_rbac.ddl` - RBAC table

- **Service Implementation**: `apps/api/src/services/entity-infrastructure.service.ts`

- **Route Examples**:
  - `apps/api/src/modules/business/routes.ts` - Complete implementation
  - `apps/api/src/modules/project/routes.ts` - Complete implementation
  - `apps/api/src/modules/task/routes.ts` - Complete implementation

## Anti-Patterns (Avoid)

❌ **Service builds queries for routes**:
```typescript
// WRONG - Service should NOT build queries
const projects = await entityInfra.getAll('project', filters);
```

❌ **Routes bypass service for infrastructure operations**:
```typescript
// WRONG - Use service instead
await db.execute(sql`INSERT INTO d_entity_rbac ...`);
```

❌ **Inconsistent patterns across routes**:
```typescript
// WRONG - All routes MUST follow same pattern
// Some routes use service, some don't → creates drift
```

## Migration from Legacy Patterns

If you find routes NOT using Entity Infrastructure Service:

1. **Add service initialization**: `const entityInfra = getEntityInfrastructure(db);`
2. **Replace RBAC queries** with `check_entity_rbac()`, `get_entity_rbac_where_condition()`
3. **Replace registry INSERT** with `set_entity_instance_registry()`
4. **Replace linkage INSERT** with `set_entity_instance_link()`
5. **Follow 6-step CREATE** and **3-step UPDATE** patterns

## Version History

- **v1.0.0** (2025-01-17) - Initial implementation (1160 lines)
- **Pattern**: Add-On Helper Service (routes own queries)
- **Coverage**: 100% of entity routes (business, project, task, and 42+ others)
