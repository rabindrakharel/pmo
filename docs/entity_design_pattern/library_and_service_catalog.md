# Library and Service Catalog

> **Comprehensive catalog of all factory patterns, universal libraries, and services in the PMO Platform**
>
> This document serves as a single source of truth for all reusable components across the API layer.

**Version**: 1.1.0 | **Last Updated**: 2025-11-15 | **Location**: `/apps/api/src/`

---

## Table of Contents

1. [Factory Patterns](#factory-patterns) (3 factories)
2. [Universal Libraries](#universal-libraries) (12 libraries)
3. [Services](#services) (1 service)
4. [Quick Reference Matrix](#quick-reference-matrix)

---

## Factory Patterns

Factory patterns auto-generate endpoints and routes with zero boilerplate.

### 1. Child Entity Route Factory

**File**: `apps/api/src/lib/child-entity-route-factory.ts`

**Purpose**: Auto-generate child entity list endpoints

**Key Functions**:
```typescript
createChildEntityEndpoint(fastify, parentType, childType)
createMinimalChildEntityEndpoint(fastify, parentType, childType)
createChildEntityEndpointsFromMetadata(fastify, entityType)
```

**Generated Endpoints**:
- `GET /api/v1/{parent}/:id/{child}` - List child entities with parent filter

**Auto-Handles**:
- ✅ RBAC filtering via unified_data_gate
- ✅ Parent-child JOIN via d_entity_instance_link
- ✅ Pagination (limit, offset)
- ✅ Search across name/code/descr
- ✅ Sorting (order_by, order_dir)

**Usage**:
```typescript
import { createChildEntityEndpoint } from '../../lib/child-entity-route-factory.js';

// Auto-generate: GET /api/v1/project/:id/task
createChildEntityEndpoint(fastify, 'project', 'task');
```

**Entity Table Map**: Maintains `ENTITY_TABLE_MAP` for entity type → table name mapping

---

### 2. Entity Delete Route Factory

**File**: `apps/api/src/lib/entity-delete-route-factory.ts`

**Purpose**: Soft delete with automatic cascading cleanup

**Key Functions**:
```typescript
createEntityDeleteEndpoint(fastify, entityType, options?)
universalEntityDelete(entityType, entityId, options?)
entityExists(entityType, entityId)
getEntityCount(entityType, activeOnly?)
```

**Generated Endpoint**:
- `DELETE /api/v1/{entity}/:id` - Soft delete with cascade

**Cascading Cleanup** (automatic):
1. Soft-delete from main entity table (`active_flag=false`, `to_ts=NOW()`)
2. Soft-delete from `d_entity_instance_registry` (entity registry)
3. Soft-delete from `d_entity_instance_link` (parent linkages)
4. Soft-delete from `d_entity_instance_link` (child linkages)
5. Optional custom cleanup hook

**Usage**:
```typescript
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';

// Auto-generate: DELETE /api/v1/project/:id
createEntityDeleteEndpoint(fastify, 'project');

// With custom cleanup
createEntityDeleteEndpoint(fastify, 'artifact', {
  customCleanup: async (id) => await deleteS3Files(id)
});
```

**Features**:
- ✅ Idempotent (safe to call multiple times)
- ✅ RBAC permission checks
- ✅ Preserves children (no cascade delete of child entities)
- ✅ Maintains audit trail

---

### 3. Schema-Driven Routes Factory

**File**: `apps/api/src/lib/schema-driven-routes.ts`

**Purpose**: Generate routes from database schema metadata

**Key Functions**:
```typescript
generateSchemaBasedRoutes(fastify, entityType, schemaMetadata)
```

**Features**:
- ✅ Auto-detects columns from database
- ✅ Generates TypeBox validation schemas
- ✅ Creates CRUD endpoints based on schema

---

## Universal Libraries

Shared libraries providing cross-cutting functionality.

### 1. Universal Filter Builder ⭐ NEW

**File**: `apps/api/src/lib/universal-filter-builder.ts`

**Purpose**: Zero-config query parameter filtering with auto-type detection

**Key Functions**:
```typescript
buildAutoFilters(tableAlias, queryParams, options?)
buildFilterCondition(tableAlias, columnName, value)
buildSearchCondition(tableAlias, searchTerm, fields?)
buildMetadataFilters(tableAlias, metadataFilters)
detectFilterType(columnName)
```

**Auto-Detection Rules**:
| Pattern | Type | Example | SQL |
|---------|------|---------|-----|
| `dl__*` | Settings | `?dl__project_stage=planning` | `WHERE dl__project_stage = 'planning'` |
| `*_id` | UUID | `?manager_employee_id=uuid` | `WHERE manager_employee_id::uuid = 'uuid'::uuid` |
| `*_amt` | Currency | `?budget_allocated_amt=50000` | `WHERE budget_allocated_amt = 50000` |
| `*_date`, `*_ts` | Date | `?start_date=2025-01-01` | `WHERE start_date = '2025-01-01'` |
| `*_flag` | Boolean | `?active_flag=true` | `WHERE active_flag = true` |
| `*_pct` | Percentage | `?completion_pct=75` | `WHERE completion_pct = 75` |
| `search` | Multi-field | `?search=kitchen` | `WHERE (name ILIKE '%kitchen%' OR ...)` |

**Usage**:
```typescript
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query, {
  overrides: {
    active: { column: 'active_flag', type: 'boolean' }
  }
});
conditions.push(...autoFilters);
```

**Benefits**:
- ✅ Zero configuration
- ✅ Type-safe SQL generation
- ✅ Convention-based
- ✅ Extensible with overrides

---

### 2. Unified Data Gate

**File**: `apps/api/src/lib/unified-data-gate.ts`

**Purpose**: Centralized RBAC and filtering service

**Key Exports**:
```typescript
export const unified_data_gate = {
  rbac_gate: {
    checkPermission(db, userId, entityType, entityId, permission)
    getWhereCondition(userId, entityType, permission, tableAlias)
  },
  parent_child_filtering_gate: {
    getFilterCondition(parentType, parentId, childType, childAlias)
  }
}

export enum Permission {
  VIEW = 0,
  EDIT = 1,
  SHARE = 2,
  DELETE = 3,
  CREATE = 4,
  OWNER = 5
}

export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111'
```

**RBAC Model** (`d_entity_rbac`):
- Person-based: `person_entity_name` ('employee' | 'role') + `person_entity_id`
- Single hierarchical permission: INTEGER (0-5)
- Resolution: UNION + MAX of role-based and direct permissions
- Checks: `permission >= required_level`

**Usage**:
```typescript
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';

// Check type-level CREATE permission
const canCreate = await unified_data_gate.rbac_gate.checkPermission(
  db, userId, 'project', ALL_ENTITIES_ID, Permission.CREATE
);

// Get RBAC WHERE clause for filtering
const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(
  userId, 'project', Permission.VIEW, 'e'
);
```

---

### 3. Universal Schema Metadata

**File**: `apps/api/src/lib/universal-schema-metadata.ts`

**Purpose**: Extract and manage database schema metadata

**Key Functions**:
```typescript
getUniversalColumnMetadata(entityType, tableName)
filterUniversalColumns(columns, filters)
createPaginatedResponse(data, total, limit, offset)
getColumnsByMetadata(entityType)
```

**Features**:
- ✅ Introspects database schema
- ✅ Caches column metadata
- ✅ Filters columns by criteria
- ✅ Standard pagination response format

**Usage**:
```typescript
import { getUniversalColumnMetadata } from '../../lib/universal-schema-metadata.js';

const columns = await getUniversalColumnMetadata('project', 'd_project');
```

---

### 4. RBAC Service

**File**: `apps/api/src/lib/rbac.service.ts`

**Purpose**: Minimal 2-gate RBAC pattern (data gate + API gate)

**Key Functions**:
```typescript
// Data Gate - Get accessible entity IDs for listing/filtering
data_gate_EntityIdsByEntityType(userId, entityName, permission)

// API Gates - Throw 403 if operation denied
api_gate_Create(userId, entityName)
api_gate_Update(userId, entityName, entityId)
api_gate_Delete(userId, entityName, entityId)
api_gate_View(userId, entityName, entityId)

// Permission Levels
enum PermissionLevel {
  VIEW = 0, EDIT = 1, SHARE = 2, DELETE = 3, CREATE = 4, OWNER = 5
}
```

**Permission Model**:
- Person-based: `person_entity_name` ('employee' | 'role') + `person_entity_id`
- Single hierarchical integer (0-5) with automatic inheritance
- Resolution: UNION + MAX of role-based and direct permissions
- Parent inheritance: Parent VIEW → child VIEW, Parent CREATE → child CREATE

**Usage**:
```typescript
import { data_gate_EntityIdsByEntityType, api_gate_Create, PermissionLevel } from '../../lib/rbac.service.js';

// Get accessible entity IDs for listing
const accessibleIds = await data_gate_EntityIdsByEntityType(userId, 'project', PermissionLevel.VIEW);

// Gate CREATE operation (throws 403 if denied)
await api_gate_Create(userId, 'project');
```

**Active In**: office, task, role, rbac, entity routes

---

### 5. S3 Attachments

**File**: `apps/api/src/lib/s3-attachments.ts`

**Purpose**: S3 file upload/download via presigned URLs

**Key Functions**:
```typescript
generatePresignedUploadUrl(bucket, key, contentType)
generatePresignedDownloadUrl(bucket, key, expiresIn)
deleteS3Object(bucket, key)
listS3Objects(bucket, prefix)
```

**Features**:
- ✅ Presigned URL generation (secure, no backend proxy)
- ✅ Direct client-to-S3 uploads
- ✅ Configurable expiration times
- ✅ Supports artifacts, attachments, images

**Usage**:
```typescript
import { generatePresignedUploadUrl } from '../../lib/s3-attachments.js';

const uploadUrl = await generatePresignedUploadUrl(
  'pmo-artifacts',
  `artifacts/${artifactId}/file.pdf`,
  'application/pdf'
);
```

---

### 6. Entity Query Builder

**File**: `apps/api/src/lib/entityQueryBuilder.ts`

**Purpose**: Build complex SQL queries for entities

**Key Functions**:
```typescript
buildEntityQuery(entityType, filters, options)
addJoins(query, joins)
addFilters(query, filters)
addPagination(query, limit, offset)
```

---

### 7. Data Transformers

**File**: `apps/api/src/lib/data-transformers.ts`

**Purpose**: Transform data between API and database formats

**Key Functions**:
```typescript
transformToAPI(data, entityType)
transformToDB(data, entityType)
sanitizeInput(data)
```

---

### 8. Pagination Utility

**File**: `apps/api/src/lib/pagination.ts`

**Purpose**: Standard pagination helpers

**Key Functions**:
```typescript
parsePaginationParams(query)
buildPaginationResponse(data, total, params)
```

**Default Pagination**:
- Limit: 20 (max: 100)
- Offset: 0

---

### 9. Logger

**File**: `apps/api/src/lib/logger.ts`

**Purpose**: Structured logging with Pino

**Features**:
- ✅ JSON structured logs
- ✅ Request/response logging
- ✅ Error tracking
- ✅ Performance metrics

---

### 10. Authorization (Authz)

**File**: `apps/api/src/lib/authz.ts`

**Purpose**: JWT authentication and authorization

**Key Functions**:
```typescript
verifyToken(token)
generateToken(payload)
extractUserId(request)
```

---

### 11. Entity Configuration

**File**: `apps/api/src/lib/entityConfig.ts`

**Purpose**: Backend entity metadata configuration

**Features**:
- ✅ Entity type definitions
- ✅ Field metadata
- ✅ Validation rules

---

### 12. Denormalized Fields Handler

**File**: `apps/api/src/lib/denormalized-fields.ts`

**Purpose**: Manage denormalized field updates

**Key Functions**:
```typescript
syncDenormalizedFields(entityType, entityId, changes)
```

---

## Services

Business logic services for specific domains.

### 1. Linkage Service

**File**: `apps/api/src/services/linkage.service.ts`

**Purpose**: Idempotent parent-child relationship management

**Key Functions**:
```typescript
createLinkage(db, {
  parent_entity_type,
  parent_entity_id,
  child_entity_type,
  child_entity_id,
  relationship_type?
})
```

**Relationship Types**:
- `'contains'` (default) - Standard parent-child containment
- `'owns'` - Ownership relationship
- `'hosts'` - Hosting relationship
- `'assigned_to'` - Assignment relationship
- Custom types as needed

**Features**:
- ✅ Idempotent (safe to call multiple times)
- ✅ Validates parent and child exist
- ✅ Creates record in `d_entity_instance_link`
- ✅ Supports many-to-many relationships
- ✅ Temporal tracking (from_ts, to_ts, active_flag)

**Usage**:
```typescript
import { createLinkage } from '../../services/linkage.service.js';

await createLinkage(db, {
  parent_entity_type: 'project',
  parent_entity_id: projectId,
  child_entity_type: 'task',
  child_entity_id: taskId,
  relationship_type: 'contains'
});
```

**Database Table**: `d_entity_instance_link`

---

## Quick Reference Matrix

### Factory Patterns Summary

| Factory | Endpoint Generated | Auto-Handles | Usage |
|---------|-------------------|--------------|-------|
| Child Entity Factory | `GET /api/v1/{parent}/:id/{child}` | RBAC, JOIN, pagination, search, sort | `createChildEntityEndpoint(fastify, 'project', 'task')` |
| Delete Factory | `DELETE /api/v1/{entity}/:id` | Soft delete, cascade cleanup, RBAC | `createEntityDeleteEndpoint(fastify, 'project')` |
| Schema-Driven Factory | Routes from DB schema | Schema introspection, validation | `generateSchemaBasedRoutes(fastify, entityType, schema)` |

---

### Universal Libraries Summary

| Library | Purpose | Key Function | Pattern |
|---------|---------|--------------|---------|
| Universal Filter Builder | Zero-config filtering | `buildAutoFilters()` | Convention-based auto-detection |
| Unified Data Gate | RBAC & filtering | `checkPermission()` | Person-based, hierarchical |
| Universal Schema Metadata | Database schema introspection | `getUniversalColumnMetadata()` | Cached metadata |
| RBAC Service | Permission business logic | `hasPermissionOnEntityId()` | TypeScript RBAC |
| S3 Attachments | File upload/download | `generatePresignedUploadUrl()` | Presigned URLs |
| Entity Query Builder | SQL query construction | `buildEntityQuery()` | Builder pattern |
| Pagination | Standard pagination | `parsePaginationParams()` | Consistent response |

---

### Services Summary

| Service | Purpose | Key Function | Database Table |
|---------|---------|--------------|----------------|
| Linkage Service | Parent-child relationships | `createLinkage()` | `d_entity_instance_link` |

---

## Import Patterns

### Factories
```typescript
import { createChildEntityEndpoint } from '../../lib/child-entity-route-factory.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { generateSchemaBasedRoutes } from '../../lib/schema-driven-routes.js';
```

### Core Libraries
```typescript
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';
import { getUniversalColumnMetadata } from '../../lib/universal-schema-metadata.js';
```

### Services
```typescript
import { createLinkage } from '../../services/linkage.service.js';
```

---

## Naming Conventions

### Factory Files
- `*-factory.ts` - Route/endpoint generators
- Pattern: `create{X}Endpoint()`

### Library Files
- `*.ts` in `/lib/` directory
- Utility functions, shared logic
- Pattern: Descriptive function names

### Service Files
- `*.service.ts` in `/services/` directory
- Business logic, domain operations
- Pattern: `{action}{Entity}()`

---

## Best Practices

### Using Factories
1. ✅ Always use factories over manual endpoint creation
2. ✅ Leverage auto-generated RBAC and filtering
3. ✅ Use `createChildEntityEndpointsFromMetadata()` for dynamic child routes
4. ✅ Add custom cleanup hooks to delete factory when needed

### Using Libraries
1. ✅ Import from `../../lib/` with `.js` extension
2. ✅ Use universal filter builder for all query filtering
3. ✅ Always check RBAC before data operations
4. ✅ Leverage schema metadata for dynamic behavior

### Using Services
1. ✅ Services contain business logic, not in routes
2. ✅ Keep services stateless and testable
3. ✅ Use services for cross-entity operations

---

## Migration Guide

### From Manual Filters → Universal Filter Builder
```typescript
// Before (manual - 25+ lines)
const filterableFields = {
  dl__project_stage: 'dl__project_stage',
  active: 'active_flag',
  business_id: 'business_id'
};
for (const [key, col] of Object.entries(filterableFields)) { ... }

// After (automatic - 2 lines)
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
conditions.push(...autoFilters);
```

### From Unified Data Gate → RBAC Service (2-Gate Pattern)
```typescript
// Old pattern (unified_data_gate)
const rbacCondition = await unified_data_gate.rbac_gate.getWhereCondition(userId, 'project', Permission.VIEW, 'e');

// New pattern (rbac.service - data gate)
const accessibleIds = await data_gate_EntityIdsByEntityType(userId, 'project', PermissionLevel.VIEW);
const whereClause = sql`WHERE e.id = ANY(ARRAY[${accessibleIds}])`;

// New pattern (rbac.service - API gate)
await api_gate_Create(userId, 'project');  // Throws 403 if denied
```

---

## Version History

- **v1.1.0** (2025-11-15): Removed unused `universal-crud-factory.ts`, updated RBAC service to show actual 2-gate pattern functions
- **v1.0.0** (2025-11-15): Initial catalog with all factories, libraries, and services

---

**Maintained By**: PMO Platform Team
**Related Docs**: `docs/api/entity_endpoint_design.md`
