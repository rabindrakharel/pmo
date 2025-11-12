# Entity Delete Route Factory

**Location:** `/home/rabin/projects/pmo/apps/api/src/lib/entity-delete-route-factory.ts`
**Status:** ✅ **Fully Implemented** (2025-11-12)
**Version:** 2.0.0

Companion factory to `child-entity-route-factory.ts` for standardized entity deletion.

---

## 📋 Complete Delete Flow

When `universalEntityDelete(entityType, entityId)` is called, it performs **3 cascading soft-deletes**:

### ✅ Step 1: Soft-Delete from Base Entity Table

```typescript
// STEP 1: Soft-delete from main entity table
await db.execute(sql`
  UPDATE app.${sql.identifier(tableIdentifier)}
  SET active_flag = false,
      to_ts = NOW(),
      updated_ts = NOW()
  WHERE id::text = ${entityId}
`);
```

**Tables affected (27+ entity tables):**
- `app.d_task`
- `app.d_project`
- `app.d_wiki`
- `app.d_form_head`
- `app.d_artifact`
- `app.d_employee`
- `app.d_cust` (customer)
- `app.d_office_hierarchy`
- `app.d_business_hierarchy`
- `app.d_product_hierarchy`
- `app.d_office` (flat)
- `app.d_business` (flat)
- `app.d_role`
- `app.d_position`
- `app.d_worksite`
- `app.d_reports`
- `app.d_event`
- `app.d_entity_person_calendar`
- `app.d_service`
- `app.d_product`
- `app.d_quote`
- `app.d_work_order`
- `app.d_order`
- `app.d_shipment`
- `app.d_invoice`
- `app.d_cost`
- `app.d_interaction`

---

### ✅ Step 2: Soft-Delete from Entity Instance Registry

```typescript
// STEP 2: Soft-delete from entity instance registry
await db.execute(sql`
  UPDATE app.d_entity_instance_id
  SET active_flag = false,
      updated_ts = NOW()
  WHERE entity_type = ${entityType}
    AND entity_id::text = ${entityId}
`);
```

**Table affected:**
- `app.d_entity_instance_id` (central entity registry)

**Purpose:** Removes entity from global search, child-tabs API, and dashboard statistics.

---

### ✅ Step 3: Soft-Delete from Linkage Table (Both Directions)

```typescript
// STEP 3: Soft-delete linkages where this entity appears (as parent OR child)
await db.execute(sql`
  UPDATE app.d_entity_id_map
  SET active_flag = false,
      updated_ts = NOW()
  WHERE (child_entity_type = ${entityType} AND child_entity_id::text = ${entityId})
     OR (parent_entity_type = ${entityType} AND parent_entity_id::text = ${entityId})
`);
```

**Table affected:**
- `app.d_entity_id_map` (parent-child relationships)

**Examples:**
- **Task as child:** Deletes `project → task` linkage
- **Project as parent:** Deletes `project → task`, `project → wiki`, `project → form` linkages
- **Bidirectional cleanup:** Handles both parent and child relationships in one operation

---

## 🚀 Usage

### Route Factory Pattern (Recommended)

**Single Entity:**
```typescript
// task/routes.ts
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

export async function taskRoutes(fastify: FastifyInstance) {
  // Creates: DELETE /api/v1/task/:id
  createEntityDeleteEndpoint(fastify, 'task');

  // Other routes...
}
```

**With Custom Cleanup:**
```typescript
// artifact/routes.ts
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { deleteS3Files } from './s3-cleanup.js';

export async function artifactRoutes(fastify: FastifyInstance) {
  createEntityDeleteEndpoint(fastify, 'artifact', {
    customCleanup: async (artifactId) => {
      // Delete S3 files before DB delete
      await deleteS3Files(artifactId);
    }
  });
}
```

---

### Utility Function Pattern (Direct Use)

```typescript
// Inside a custom route handler or service
import { universalEntityDelete } from '@/lib/entity-delete-route-factory.js';

// Delete with default cleanup (registry + linkages)
await universalEntityDelete('task', taskId);

// Delete with options
await universalEntityDelete('project', projectId, {
  skipRegistry: false,    // Default: includes registry cleanup
  skipLinkages: false,    // Default: includes linkage cleanup
  customCleanup: async () => {
    // Custom logic before delete
    await notifyStakeholders(projectId);
  }
});
```

---

## 📊 Current Implementation Status

### ✅ Fully Implemented (48 modules)

The delete factory is **available for use in all 48 API modules** via the universal `universalEntityDelete()` function and `createEntityDeleteEndpoint()` route factory.

**Core modules using delete factory:**
- ✅ task
- ✅ project
- ✅ employee
- ✅ wiki
- ✅ artifact
- ✅ form
- ✅ event
- ✅ person-calendar

**Available for adoption in:**
- All 48 modules can use `createEntityDeleteEndpoint(fastify, entityType)`
- Custom cleanup supported via options parameter

---

## 🎯 Benefits

✅ **DRY Principle** - No code duplication across 27+ entity types
✅ **Consistency** - All entities use identical delete logic
✅ **Cascading Cleanup** - Automatically cleans up all 3 tables
✅ **Factory Pattern** - Matches existing codebase architecture
✅ **Single Source of Truth** - Reuses `ENTITY_TABLE_MAP` from child-entity-route-factory
✅ **Type Safety** - TypeScript enforces valid entity types
✅ **Extensible** - Supports custom cleanup logic
✅ **Bidirectional** - Handles both parent and child linkages in one operation
✅ **Soft Delete** - SCD Type 2 compliance with `active_flag` + `to_ts`

---

## 🔧 API Reference

### Functions

```typescript
/**
 * Route factory - creates DELETE /api/v1/{entity}/:id endpoint
 */
createEntityDeleteEndpoint(
  fastify: FastifyInstance,
  entityType: string,
  options?: { customCleanup?: (entityId: string) => Promise<void> }
): void

/**
 * Utility function - performs delete operation
 */
universalEntityDelete(
  entityType: string,
  entityId: string,
  options?: {
    skipRegistry?: boolean,
    skipLinkages?: boolean,
    customCleanup?: () => Promise<void>
  }
): Promise<void>

/**
 * Helper - check if entity exists
 */
entityExists(
  entityType: string,
  entityId: string
): Promise<boolean>

/**
 * Helper - get table name for entity type
 */
getEntityTable(
  entityType: string
): string
```

### ENTITY_TABLE_MAP

Shared mapping between entity types and database tables (imported from `child-entity-route-factory.ts`):

```typescript
export const ENTITY_TABLE_MAP: Record<string, string> = {
  task: 'd_task',
  project: 'd_project',
  wiki: 'd_wiki',
  form: 'd_form_head',
  artifact: 'd_artifact',
  employee: 'd_employee',
  cust: 'd_cust',
  office: 'd_office',
  business: 'd_business',
  'office-hierarchy': 'd_office_hierarchy',
  'business-hierarchy': 'd_business_hierarchy',
  'product-hierarchy': 'd_product_hierarchy',
  role: 'd_role',
  position: 'd_position',
  worksite: 'd_worksite',
  reports: 'd_reports',
  event: 'd_event',
  'person-calendar': 'd_entity_person_calendar',
  service: 'd_service',
  product: 'd_product',
  quote: 'd_quote',
  work_order: 'd_work_order',
  order: 'd_order',
  shipment: 'd_shipment',
  invoice: 'd_invoice',
  cost: 'd_cost',
  interaction: 'd_interaction'
  // Add new entities here
};
```

---

## 📁 File Structure

```
apps/api/src/lib/
├── child-entity-route-factory.ts     # Creates child entity GET endpoints
├── entity-delete-route-factory.ts    # Creates entity DELETE endpoints ← THIS FILE
└── ENTITY_TABLE_MAP (shared)         # Entity type → table name mapping
```

---

## 🧪 Testing

```bash
# Test delete with cascading cleanup
./tools/test-api.sh DELETE /api/v1/task/{task-id}

# Verify all 3 deletions occurred:

# 1. Check base table
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c \
  "SELECT id, active_flag, to_ts FROM app.d_task WHERE id = '{task-id}'"
# Expected: active_flag = false, to_ts = <timestamp>

# 2. Check registry
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c \
  "SELECT * FROM app.d_entity_instance_id WHERE entity_type = 'task' AND entity_id = '{task-id}'"
# Expected: active_flag = false

# 3. Check linkages
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c \
  "SELECT * FROM app.d_entity_id_map WHERE child_entity_type = 'task' AND child_entity_id = '{task-id}'"
# Expected: active_flag = false
```

---

## 🔄 Migration Guide

### Before (manual delete in routes.ts)

```typescript
fastify.delete('/api/v1/task/:id', async (request, reply) => {
  const { id } = request.params;
  const userId = request.user.sub;

  // RBAC check...

  // Manual 4-step delete (70+ lines)
  await db.execute(sql`UPDATE app.d_task SET active_flag = false, to_ts = NOW() WHERE id::text = ${id}`);
  await db.execute(sql`UPDATE app.d_entity_instance_id SET active_flag = false WHERE entity_type = 'task' AND entity_id::text = ${id}`);
  await db.execute(sql`UPDATE app.d_entity_id_map SET active_flag = false WHERE child_entity_type = 'task' AND child_entity_id::text = ${id}`);
  await db.execute(sql`UPDATE app.d_entity_id_map SET active_flag = false WHERE parent_entity_type = 'task' AND parent_entity_id::text = ${id}`);

  return reply.status(204).send();
});
```

### After (using factory)

```typescript
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

export async function taskRoutes(fastify: FastifyInstance) {
  createEntityDeleteEndpoint(fastify, 'task');
  // Done! 70+ lines of code replaced with 1 line
}
```

---

## 📈 Adoption Checklist

When adding delete functionality to a new entity module:

- [ ] Import `createEntityDeleteEndpoint` from factory
- [ ] Call `createEntityDeleteEndpoint(fastify, entityType)`
- [ ] Add entity to `ENTITY_TABLE_MAP` if not already present
- [ ] Test DELETE endpoint with `./tools/test-api.sh`
- [ ] Verify cascading cleanup in all 3 tables
- [ ] Add custom cleanup logic if needed (e.g., S3 files for artifacts)

---

## 🔗 Related Documentation

- **API Developer Guide:** `/docs/api/API_DEVELOPER_GUIDE.md`
- **Child Entity Factory:** `/apps/api/src/lib/child-entity-route-factory.ts`
- **Entity Options API:** `/docs/api/ENTITY_OPTIONS_API.md`
- **Data Model:** `/docs/datamodel/datamodel.md`

---

**Last Updated:** 2025-11-12
**Version:** 2.0.0
**Status:** ✅ Fully Implemented (Available in all 48 modules)
**Pattern:** Universal soft-delete with automatic cascading cleanup
