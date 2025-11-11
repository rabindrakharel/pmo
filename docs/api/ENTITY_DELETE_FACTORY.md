# Entity Delete Route Factory

**Location:** `/home/rabin/projects/pmo/apps/api/src/lib/entity-delete-route-factory.ts`

Companion factory to `child-entity-route-factory.ts` for standardized entity deletion.

---

## 📋 Complete Delete Flow

When `universalEntityDelete(entityType, entityId)` is called, it performs **3 cascading deletions**:

### ✅ Step 1: Delete from Base Entity Table

```typescript
// STEP 1: Soft-delete from main entity table
await db.execute(sql`
  UPDATE app.${tableIdentifier}
  SET active_flag = false,
      to_ts = NOW(),
      updated_ts = NOW()
  WHERE id = ${entityId}::uuid
`);
```

**Tables affected:**
- `app.d_task`
- `app.d_project`
- `app.d_wiki`
- `app.d_form_head`
- `app.d_artifact`
- `app.d_employee`
- `app.d_client`
- `app.d_office`
- `app.d_business`
- `app.d_role`
- `app.d_position`
- `app.d_worksite`
- `app.d_reports`

---

### ✅ Step 2: Delete from Entity Instance Registry

```typescript
// STEP 2: Soft-delete from entity instance registry
await db.execute(sql`
  UPDATE app.d_entity_instance_id
  SET active_flag = false,
      updated_ts = NOW()
  WHERE entity_type = ${entityType}
    AND entity_id = ${entityId}::uuid
`);
```

**Table affected:**
- `app.d_entity_instance_id` (central entity registry)

**Purpose:** Removes entity from global search, child-tabs API, and dashboard statistics.

---

### ✅ Step 3: Delete from Linkage Table (Both Directions)

```typescript
// STEP 3A: Soft-delete linkages where this entity is a CHILD
await db.execute(sql`
  UPDATE app.d_entity_id_map
  SET active_flag = false,
      updated_ts = NOW()
  WHERE child_entity_type = ${entityType}
    AND child_entity_id = ${entityId}::uuid
`);

// STEP 3B: Soft-delete linkages where this entity is a PARENT
await db.execute(sql`
  UPDATE app.d_entity_id_map
  SET active_flag = false,
      updated_ts = NOW()
  WHERE parent_entity_type = ${entityType}
    AND parent_entity_id = ${entityId}::uuid
`);
```

**Table affected:**
- `app.d_entity_id_map` (parent-child relationships)

**Examples:**
- **Task as child:** Deletes `project → task` linkage
- **Project as parent:** Deletes `project → task`, `project → wiki`, `project → form` linkages

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
}
```

**With Custom Cleanup:**
```typescript
// artifact/routes.ts
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

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
// Inside a custom route handler
import { universalEntityDelete } from '../../lib/entity-delete-route-factory.js';

fastify.delete('/api/v1/task/:id', async (request, reply) => {
  const { id } = request.params;

  // RBAC check...

  // Perform cascading delete
  await universalEntityDelete('task', id);

  return reply.status(204).send();
});
```

---

## 📊 Comparison with Child Entity Factory

| Feature | child-entity-route-factory.ts | entity-delete-route-factory.ts |
|---------|------------------------------|--------------------------------|
| **Location** | `apps/api/src/lib/` | `apps/api/src/lib/` ✅ |
| **Naming** | `create...Endpoint()` | `createEntityDeleteEndpoint()` ✅ |
| **Table mapping** | `ENTITY_TABLE_MAP` (exported) | Imports same mapping ✅ |
| **SQL pattern** | `sql.identifier()` + `app.${identifier}` | Same ✅ |
| **Logging** | `fastify.log.info/warn/error` | Same ✅ |
| **RBAC** | Checks permission array | Same ✅ |
| **First param** | `fastify: FastifyInstance` | Same ✅ |

---

## 🎯 Benefits

✅ **DRY Principle** - No code duplication across 13+ entity types
✅ **Consistency** - All entities use identical delete logic
✅ **Cascading Cleanup** - Automatically cleans up all 3 tables
✅ **Factory Pattern** - Matches existing codebase architecture
✅ **Single Source of Truth** - Reuses `ENTITY_TABLE_MAP`
✅ **Type Safety** - TypeScript enforces valid entity types
✅ **Extensible** - Supports custom cleanup logic

---

## 🔧 API Reference

### Functions

```typescript
// Route factory - creates DELETE endpoint
createEntityDeleteEndpoint(
  fastify: FastifyInstance,
  entityType: string,
  options?: { customCleanup?: (entityId: string) => Promise<void> }
): void

// Utility function - performs delete operation
universalEntityDelete(
  entityType: string,
  entityId: string,
  options?: {
    skipRegistry?: boolean,
    skipLinkages?: boolean,
    customCleanup?: () => Promise<void>
  }
): Promise<void>

// Helper - check if entity exists
entityExists(
  entityType: string,
  entityId: string
): Promise<boolean>

// Helper - get entity count
getEntityCount(
  entityType: string,
  activeOnly?: boolean
): Promise<number>

// Helper - get table name
getEntityTable(
  entityType: string
): string
```

---

## 📁 File Structure

```
apps/api/src/lib/
├── child-entity-route-factory.ts     # Creates child entity GET/POST endpoints
├── entity-delete-route-factory.ts    # Creates entity DELETE endpoints ← THIS FILE
└── ENTITY_DELETE_FACTORY_README.md   # This documentation
```

---

## ✅ Current Status

- ✅ **Implemented in:** `task` module (`apps/api/src/modules/task/routes.ts`)
- 🔄 **To be rolled out to:** `project`, `wiki`, `form`, `artifact`, `employee`, `client`, `office`, `business`, `role`, `position`, `worksite`, `reports`

---

## 🧪 Testing

```bash
# Test task delete with cascading cleanup
./tools/test-api.sh DELETE /api/v1/task/277d2f4f-9591-4aa3-8537-935324495a74

# Verify all 3 deletions occurred:
# 1. Check base table: SELECT * FROM app.d_task WHERE id = '...' AND active_flag = false
# 2. Check registry: SELECT * FROM app.d_entity_instance_id WHERE entity_id = '...' AND active_flag = false
# 3. Check linkages: SELECT * FROM app.d_entity_id_map WHERE child_entity_id = '...' AND active_flag = false
```

---

## 🔄 Migration Guide

**Before (manual delete in task/routes.ts):**
```typescript
fastify.delete('/api/v1/task/:id', async (request, reply) => {
  // RBAC...

  await db.execute(sql`UPDATE app.d_task SET active_flag = false...`);
  await db.execute(sql`UPDATE app.d_entity_instance_id...`);
  await db.execute(sql`UPDATE app.d_entity_id_map...`); // Child linkages
  await db.execute(sql`UPDATE app.d_entity_id_map...`); // Parent linkages

  return reply.status(204).send();
});
```

**After (using factory):**
```typescript
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

export async function taskRoutes(fastify: FastifyInstance) {
  createEntityDeleteEndpoint(fastify, 'task');
  // Done! 70+ lines of code replaced with 1 line
}
```
