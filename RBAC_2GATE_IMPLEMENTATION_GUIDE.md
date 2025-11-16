# RBAC 2-Gate Pattern Implementation Guide

> **Status**: In Progress
> **Updated**: 2025-11-14
> **Version**: 1.0

## Overview

This guide documents the implementation of the simplified 2-gate RBAC pattern across all entity routes in the PMO platform.

## The 2-Gate Pattern

### Gate 1: Data Gate (for DataTables/Lists)
**Function**: `data_gate_EntityIdsByEntityType(userId, entityName, permissionLevel)`
**Returns**: `string[]` - Array of accessible entity IDs
**Used for**:
- `GET /api/v1/{entity}` (list endpoints)
- `GET /api/v1/{entity}/:id` (single entity endpoints)
- Any endpoint that retrieves entity data

**Implementation**:
```typescript
// DATA GATE: Get accessible entity IDs for SELECT
const accessibleEntityIds = await data_gate_EntityIdsByEntityType(userId, 'project', PermissionLevel.VIEW);

if (accessibleEntityIds.length === 0) {
  return reply.send({ data: [], total: 0, limit, offset });
}

// Build ID filter - gate at SQL level
const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
const idFilter = hasTypeAccess
  ? sql`TRUE`  // Type-level access - no filtering
  : sql`e.id::text = ANY(${accessibleEntityIds})`;  // Filter by accessible IDs

// Use in WHERE clause
const result = await db.execute(sql`
  SELECT * FROM app.d_project e
  WHERE e.active_flag = true
    AND ${idFilter}
  ORDER BY e.created_ts DESC
`);
```

### Gate 2: API Gates (for Update/Delete)
**Functions**:
- `api_gate_Update(userId, entityName, entityId)`
- `api_gate_Delete(userId, entityName, entityId)`

**Returns**: `void` (throws 403 error if permission denied)
**Used for**:
- `PUT/PATCH /api/v1/{entity}/:id` (update endpoints)
- `DELETE /api/v1/{entity}/:id` (delete endpoints)

**Implementation**:
```typescript
// API GATE: Check UPDATE permission
try {
  await api_gate_Update(userId, 'project', id);
} catch (err: any) {
  return reply.status(err.statusCode || 403).send({
    error: err.error || 'Forbidden',
    message: err.message
  });
}

// User has permission - proceed with update
const result = await db.execute(sql`
  UPDATE app.d_project
  SET name = ${data.name},
      updated_ts = NOW()
  WHERE id::text = ${id}
  RETURNING *
`);
```

### Create Operations (Inline Check)
**Function**: `api_gate_Create(userId, entityName)`
**Note**: Create operations check permissions but don't require a dedicated gate pattern since they operate at type-level only.

```typescript
// API GATE: Check CREATE permission
try {
  await api_gate_Create(userId, 'project');
} catch (err: any) {
  return reply.status(err.statusCode || 403).send({
    error: err.error || 'Forbidden',
    message: err.message
  });
}
```

## Implementation Status

### ✅ Completed Routes

#### 1. Project Routes (`apps/api/src/modules/project/routes.ts`)
- ✅ GET /api/v1/project (list) - Lines 109-122 - **Data gate**
- ✅ GET /api/v1/project/:id (single) - Lines 662-672 - **Data gate**
- ✅ GET /api/v1/project/:id/dynamic-child-entity-tabs - Lines 300-310 - **Data gate**
- ✅ POST /api/v1/project (create) - Line 719 - **api_gate_Create**
- ✅ PUT /api/v1/project/:id (update) - Line 838 - **api_gate_Update**
- ✅ DELETE /api/v1/project/:id (delete) - Line 939 - Uses `createEntityDeleteEndpoint` with **api_gate_Delete**

#### 2. Task Routes (`apps/api/src/modules/task/routes.ts`)
- ✅ GET /api/v1/task (list) - Lines 107-122 - **Data gate**
- ✅ GET /api/v1/task/:id (single) - Lines 281-291 - **Data gate**
- ✅ POST /api/v1/task (create) - Lines 375-382 - **api_gate_Create**
- ✅ PUT /api/v1/task/:id (update) - Lines 465-472 - **api_gate_Update**
- ✅ PATCH /api/v1/task/:id/status (update status) - Lines 586-593 - **api_gate_Update**
- ✅ DELETE /api/v1/task/:id (delete) - Line 552 - Uses `createEntityDeleteEndpoint` with **api_gate_Delete**

### 🔄 Pending Routes

The following routes need to be updated (46 total route files):

#### Core Entity Routes
- [ ] business/routes.ts
- [ ] employee/routes.ts
- [ ] role/routes.ts
- [ ] client/routes.ts (cust/routes.ts)
- [ ] worksite/routes.ts
- [ ] office/routes.ts
- [ ] form/routes.ts
- [ ] wiki/routes.ts
- [ ] artifact/routes.ts
- [ ] interaction/routes.ts
- [ ] event/routes.ts
- [ ] booking/routes.ts

#### Hierarchy Routes
- [ ] business-hierarchy/routes.ts
- [ ] office-hierarchy/routes.ts
- [ ] product-hierarchy/routes.ts

#### Financial Routes
- [ ] revenue/routes.ts
- [ ] expense/routes.ts
- [ ] invoice/routes.ts
- [ ] order/routes.ts
- [ ] quote/routes.ts

#### Operational Routes
- [ ] work_order/routes.ts
- [ ] service/routes.ts
- [ ] product/routes.ts
- [ ] inventory/routes.ts
- [ ] shipment/routes.ts

#### Reporting & Automation
- [ ] reports/routes.ts
- [ ] workflow/routes.ts
- [ ] workflow-automation/routes.ts

#### Infrastructure Routes
- [ ] entity/routes.ts
- [ ] linkage/routes.ts
- [ ] rbac/routes.ts
- [ ] setting/routes.ts
- [ ] meta/routes.ts

#### Specialized Routes
- [ ] chat/routes.ts
- [ ] collab/routes.ts
- [ ] email-template/routes.ts
- [ ] person-calendar/routes.ts
- [ ] event-person-calendar/routes.ts
- [ ] schema/routes.ts
- [ ] message-schema/routes.ts
- [ ] message-data/routes.ts
- [ ] task-data/routes.ts
- [ ] upload/routes.ts
- [ ] s3-backend/routes.ts
- [ ] shared/routes.ts
- [ ] entity-options/routes.ts
- [ ] auth/routes.ts

## Old RBAC Patterns to Replace

### Pattern 1: Old SQL-based RBAC Check (in lists)
**Before**:
```typescript
const baseConditions = [
  sql`EXISTS (
    SELECT 1 FROM app.d_entity_rbac rbac
    WHERE rbac.empid = ${userId}
      AND rbac.entity = 'task'
      AND (rbac.entity_id = t.id::text OR rbac.entity_id = 'all')
      AND rbac.active_flag = true
      AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
      AND 0 = ANY(rbac.permission)
  )`
];
```

**After**:
```typescript
const accessibleEntityIds = await data_gate_EntityIdsByEntityType(userId, 'task', PermissionLevel.VIEW);

if (accessibleEntityIds.length === 0) {
  return reply.send({ data: [], total: 0, limit, offset });
}

const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
const idFilter = hasTypeAccess
  ? sql`TRUE`
  : sql`t.id::text = ANY(${accessibleEntityIds})`;

const conditions = [idFilter];
```

### Pattern 2: Old SQL-based RBAC Check (for single entity)
**Before**:
```typescript
const taskAccess = await db.execute(sql`
  SELECT 1 FROM app.d_entity_rbac rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = 'task'
    AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
    AND rbac.active_flag = true
    AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
    AND 0 = ANY(rbac.permission)
`);

if (taskAccess.length === 0) {
  return reply.status(403).send({ error: 'Insufficient permissions' });
}
```

**After**:
```typescript
const accessibleEntityIds = await data_gate_EntityIdsByEntityType(userId, 'task', PermissionLevel.VIEW);

if (accessibleEntityIds.length === 0) {
  return reply.status(403).send({ error: 'No access to task' });
}

const hasTypeAccess = accessibleEntityIds.includes('11111111-1111-1111-1111-111111111111');
const idFilter = hasTypeAccess
  ? sql`TRUE`
  : sql`id::text = ANY(${accessibleEntityIds})`;
```

### Pattern 3: Old SQL-based Create Permission Check
**Before**:
```typescript
const taskCreateAccess = await db.execute(sql`
  SELECT 1 FROM app.d_entity_rbac rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = 'task'
    AND rbac.entity_id = 'all'
    AND rbac.active_flag = true
    AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
    AND 4 = ANY(rbac.permission)
`);

if (taskCreateAccess.length === 0) {
  return reply.status(403).send({ error: 'Insufficient permissions to create tasks' });
}
```

**After**:
```typescript
try {
  await api_gate_Create(userId, 'task');
} catch (err: any) {
  return reply.status(err.statusCode || 403).send({
    error: err.error || 'Forbidden',
    message: err.message
  });
}
```

### Pattern 4: Old SQL-based Update Permission Check
**Before**:
```typescript
const taskEditAccess = await db.execute(sql`
  SELECT 1 FROM app.d_entity_rbac rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = 'task'
    AND (rbac.entity_id = ${id} OR rbac.entity_id = 'all')
    AND rbac.active_flag = true
    AND (rbac.expires_ts IS NULL OR rbac.expires_ts > NOW())
    AND 1 = ANY(rbac.permission)
`);

if (taskEditAccess.length === 0) {
  return reply.status(403).send({ error: 'Insufficient permissions to modify this task' });
}
```

**After**:
```typescript
try {
  await api_gate_Update(userId, 'task', id);
} catch (err: any) {
  return reply.status(err.statusCode || 403).send({
    error: err.error || 'Forbidden',
    message: err.message
  });
}
```

## Required Imports

Add to each entity route file:
```typescript
import {
  data_gate_EntityIdsByEntityType,
  api_gate_Create,
  api_gate_Update,
  PermissionLevel
} from '../../lib/rbac.service.js';
```

**Note**: Delete endpoints using `createEntityDeleteEndpoint` already have `api_gate_Delete` built-in.

## Verification Checklist

For each entity route file:
- [ ] Imports added for RBAC service functions
- [ ] List endpoint (GET /api/v1/{entity}) uses `data_gate_EntityIdsByEntityType`
- [ ] Single entity endpoint (GET /api/v1/{entity}/:id) uses `data_gate_EntityIdsByEntityType`
- [ ] Create endpoint (POST /api/v1/{entity}) uses `api_gate_Create`
- [ ] Update endpoint (PUT/PATCH /api/v1/{entity}/:id) uses `api_gate_Update`
- [ ] Delete endpoint uses `createEntityDeleteEndpoint` or direct `api_gate_Delete`
- [ ] Old SQL RBAC queries removed
- [ ] SQL WHERE clauses include `${idFilter}` for data gating

## Benefits of 2-Gate Pattern

1. **Consistency**: All entity routes follow the same pattern
2. **Maintainability**: Centralized RBAC logic in `rbac.service.ts`
3. **Performance**: Single query resolves all permissions (UNION of role + employee permissions)
4. **Security**: SQL-level filtering prevents unauthorized data access
5. **Type Safety**: TypeScript service with full type safety
6. **Simplicity**: Only 2 gate types to understand and implement

## Next Steps

1. Create automated script to update remaining 44 route files
2. Test each updated route with different permission levels
3. Verify SQL-level filtering works correctly
4. Update documentation in `docs/entity_design_pattern/rbac.md`
5. Remove deprecated RBAC functions from codebase

## References

- RBAC Documentation: `/docs/entity_design_pattern/rbac.md`
- RBAC Service: `/apps/api/src/lib/rbac.service.ts`
- Universal CRUD Factory: `/apps/api/src/lib/universal-crud-factory.ts` (already implements 2-gate pattern)
- Delete Factory: `/apps/api/src/lib/entity-delete-route-factory.ts` (already has api_gate_Delete)
