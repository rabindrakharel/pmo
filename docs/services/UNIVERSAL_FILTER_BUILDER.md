# Universal Filter Builder

> **Zero-Config Query Filtering** - Automatically builds SQL filter conditions from query parameters based on field naming conventions

## Overview

The Universal Filter Builder eliminates the need for manual `filterableFields` mapping by automatically detecting filter types from column naming conventions. Just pass query parameters to `buildAutoFilters()` and get back type-safe SQL conditions.

**Location**: `apps/api/src/lib/universal-filter-builder.ts`

## Key Features

✅ **Zero Configuration** - No manual field mapping required
✅ **Convention Over Configuration** - Column names determine filter behavior
✅ **Type-Safe SQL** - Auto-casting for UUID, boolean, numeric fields
✅ **Multi-Field Search** - Automatic OR conditions across name/code/descr
✅ **JSONB Support** - Metadata field filtering with type detection

## Quick Start

```typescript
import { buildAutoFilters } from '@/lib/universal-filter-builder.ts';

// In your route handler
fastify.get('/api/v1/project', async (request, reply) => {
  const conditions: any[] = [sql`e.active_flag = true`];

  // Add auto-detected filters from query params
  const autoFilters = buildAutoFilters('e', request.query);
  conditions.push(...autoFilters);

  const query = sql`
    SELECT * FROM app.d_project e
    WHERE ${sql.join(conditions, sql` AND `)}
  `;

  const results = await db.execute(query);
  return reply.send({ data: results });
});
```

**Example Requests**:
```bash
# Auto-detects settings dropdown filter
GET /api/v1/project?dl__project_stage=planning

# Auto-detects UUID filter with casting
GET /api/v1/task?project_id=123e4567-e89b-12d3-a456-426614174000

# Auto-detects boolean filter
GET /api/v1/employee?remote_work_eligible_flag=true

# Auto-detects currency filter
GET /api/v1/project?budget_allocated_amt=50000

# Multi-field search (OR condition)
GET /api/v1/project?search=kitchen
```

## Auto-Detection Rules

The filter type is automatically determined from column naming conventions:

| Column Pattern | Filter Type | SQL Behavior | Example |
|---------------|-------------|--------------|---------|
| `dl__*` | Settings dropdown | Exact match | `dl__project_stage=planning` |
| `*_id` | UUID reference | Cast to UUID | `project_id=uuid` |
| `*_amt` | Currency | Numeric comparison | `budget_allocated_amt=50000` |
| `*_date`, `*_ts` | Date/timestamp | Date comparison | `start_date=2025-01-01` |
| `*_flag` | Boolean | Cast to boolean | `active_flag=true` |
| `*_pct` | Percentage | Numeric comparison | `completion_pct=75` |
| `metadata` | JSONB | ILIKE search | `metadata={"key":"value"}` |
| `count`, `total`, `quantity` | Numeric | Numeric comparison | `total=10` |
| `name`, `code`, `descr` | Text | Exact match | `name=Kitchen` |

## Core Functions

### 1. `buildAutoFilters()`

Primary function that builds all filter conditions from query parameters.

```typescript
function buildAutoFilters(
  tableAlias: string,
  queryParams: Record<string, any>,
  options?: {
    excludeParams?: string[];        // Additional params to exclude
    overrides?: Record<string, FilterConfig>; // Custom field overrides
    searchFields?: string[];         // Fields for multi-field search
  }
): any[]
```

**Parameters**:
- `tableAlias` - SQL table alias (e.g., `'e'`, `'p'`, `'t'`)
- `queryParams` - Request query parameters object
- `options.excludeParams` - Query params to exclude (default: `['limit', 'offset', 'page', 'pageSize', 'search', 'order_by', 'order_dir', 'parent_type', 'parent_id']`)
- `options.overrides` - Custom filter configurations for special cases
- `options.searchFields` - Fields to include in multi-field search (default: `['name', 'code', 'descr']`)

**Returns**: Array of SQL condition fragments ready to join with `AND`

**Example with Options**:
```typescript
const autoFilters = buildAutoFilters('e', request.query, {
  excludeParams: ['custom_param'],  // Exclude additional params
  searchFields: ['name', 'code', 'descr', 'address'], // Custom search fields
  overrides: {
    status: { column: 'dl__status', type: 'settings' } // Override detection
  }
});
```

### 2. `detectFilterType()`

Auto-detect filter type from column name.

```typescript
function detectFilterType(columnName: string): FilterType

type FilterType = 'text' | 'uuid' | 'currency' | 'date' | 'boolean' | 'settings' | 'jsonb' | 'numeric';
```

**Example**:
```typescript
detectFilterType('budget_allocated_amt'); // Returns: 'currency'
detectFilterType('dl__project_stage');    // Returns: 'settings'
detectFilterType('manager_employee_id');   // Returns: 'uuid'
detectFilterType('active_flag');           // Returns: 'boolean'
```

### 3. `buildFilterCondition()`

Build SQL condition for a single filter with type-aware casting.

```typescript
function buildFilterCondition(
  tableAlias: string,
  columnName: string,
  value: any
): any
```

**Example**:
```typescript
// UUID field - auto-cast
buildFilterCondition('e', 'project_id', 'uuid-value');
// Returns: e.project_id::uuid = 'uuid-value'::uuid

// Boolean field - auto-cast
buildFilterCondition('e', 'active_flag', 'true');
// Returns: e.active_flag = true

// Currency field - numeric comparison
buildFilterCondition('e', 'budget_allocated_amt', '50000');
// Returns: e.budget_allocated_amt = 50000
```

### 4. `buildSearchCondition()`

Build multi-field search condition (name, code, descr).

```typescript
function buildSearchCondition(
  tableAlias: string,
  searchTerm: string,
  searchFields?: string[]
): any
```

**Example**:
```typescript
buildSearchCondition('e', 'kitchen', ['name', 'code', 'descr']);
// Returns: (
//   COALESCE(e.name, '') ILIKE '%kitchen%' OR
//   COALESCE(e.code, '') ILIKE '%kitchen%' OR
//   COALESCE(e.descr, '') ILIKE '%kitchen%'
// )
```

### 5. `buildMetadataFilters()`

Build filter conditions for JSONB metadata fields.

```typescript
function buildMetadataFilters(
  tableAlias: string,
  metadataFilters: Record<string, any>
): any[]
```

**Example**:
```typescript
buildMetadataFilters('e', {
  project_id: 'uuid-value',
  task_type: 'maintenance'
});
// Returns: [
//   (e.metadata->>'project_id')::uuid = 'uuid-value'::uuid,
//   e.metadata->>'task_type' = 'maintenance'
// ]
```

## Common Use Cases

### Standard Entity List with Filters

```typescript
fastify.get('/api/v1/project', async (request, reply) => {
  const { limit = 20, offset = 0 } = request.query;
  const userId = request.user.sub;

  // Base conditions
  const conditions: any[] = [sql`e.active_flag = true`];

  // Add RBAC condition
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, 'project', Permission.VIEW, 'e'
  );
  conditions.push(sql.raw(rbacCondition));

  // Add auto-detected filters (zero config!)
  const autoFilters = buildAutoFilters('e', request.query);
  conditions.push(...autoFilters);

  // Execute query
  const query = sql`
    SELECT * FROM app.d_project e
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const results = await db.execute(query);
  return reply.send({ data: results });
});
```

### Parent-Child Filtering

```typescript
fastify.get('/api/v1/project/:id/task', async (request, reply) => {
  const { id: projectId } = request.params;

  const conditions: any[] = [
    sql`t.project_id = ${projectId}::uuid`,
    sql`t.active_flag = true`
  ];

  // Auto-detect additional filters from query params
  const autoFilters = buildAutoFilters('t', request.query);
  conditions.push(...autoFilters);

  const query = sql`
    SELECT * FROM app.d_task t
    WHERE ${sql.join(conditions, sql` AND `)}
  `;

  const results = await db.execute(query);
  return reply.send({ data: results });
});
```

### Custom Search Fields

```typescript
// Search across custom fields (beyond name/code/descr)
const autoFilters = buildAutoFilters('e', request.query, {
  searchFields: ['name', 'code', 'descr', 'address', 'email']
});
```

### Metadata Filtering

```typescript
// Filter by JSONB metadata fields
const metadataFilters = buildMetadataFilters('e', {
  project_type: 'commercial',
  client_tier: 'enterprise'
});

const conditions: any[] = [
  sql`e.active_flag = true`,
  ...metadataFilters
];
```

## Type Safety & Casting

The Universal Filter Builder automatically handles SQL type casting to prevent errors:

### UUID Casting
```typescript
// Query: GET /api/v1/task?project_id=uuid-value
// Generated SQL: t.project_id::uuid = 'uuid-value'::uuid
```

### Boolean Casting
```typescript
// Query: GET /api/v1/employee?remote_work_eligible_flag=true
// Generated SQL: e.remote_work_eligible_flag = true

// Handles string 'true'/'false', boolean true/false, and '1'/'0'
```

### Numeric Casting
```typescript
// Query: GET /api/v1/project?budget_allocated_amt=50000
// Generated SQL: e.budget_allocated_amt = 50000.0
```

## Excluded Query Parameters

By default, these parameters are excluded from filtering (used for pagination/sorting/RBAC):

- `limit` - Pagination limit
- `offset` - Pagination offset
- `page` - Page number (alternative pagination)
- `pageSize` - Page size (alternative pagination)
- `search` - Multi-field search term (handled separately)
- `order_by` - Sort column
- `order_dir` - Sort direction
- `parent_type` - Parent entity type (RBAC)
- `parent_id` - Parent entity ID (RBAC)

You can add additional exclusions via `options.excludeParams`.

## Performance Considerations

✅ **Set-based lookups** - O(1) parameter exclusion checks
✅ **Early exits** - Skip null/undefined/empty values immediately
✅ **Cached SQL fragments** - Reusable SQL objects
✅ **Type-aware casting** - No unnecessary type conversions

## Integration with Entity Infrastructure

The Universal Filter Builder works seamlessly with the Entity Infrastructure Service:

```typescript
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';
import { buildAutoFilters } from '@/lib/universal-filter-builder.ts';

const entityInfra = getEntityInfrastructure(db);

fastify.get('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;

  const conditions: any[] = [];

  // 1. RBAC filtering
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, 'project', Permission.VIEW, 'e'
  );
  conditions.push(sql.raw(rbacCondition));

  // 2. Auto-detected filters
  const autoFilters = buildAutoFilters('e', request.query);
  conditions.push(...autoFilters);

  // 3. Execute query
  const query = sql`SELECT * FROM app.d_project e WHERE ${sql.join(conditions, sql` AND `)}`;
  const results = await db.execute(query);

  return reply.send({ data: results });
});
```

## Error Handling

The Universal Filter Builder handles edge cases gracefully:

```typescript
// Empty/null/undefined values are skipped
buildFilterCondition('e', 'name', null);       // Returns: TRUE (no-op)
buildFilterCondition('e', 'name', undefined);  // Returns: TRUE (no-op)
buildFilterCondition('e', 'name', '');         // Returns: TRUE (no-op)

// Invalid UUIDs will cause SQL errors (caught by Drizzle/PostgreSQL)
// Invalid booleans default to false
// Invalid numbers default to NaN (handled by parseFloat)
```

## Testing

The Universal Filter Builder is tested with real route implementations across 45+ entity types. See:

- `apps/api/src/modules/project/routes.ts`
- `apps/api/src/modules/task/routes.ts`
- `apps/api/src/modules/employee/routes.ts`

## Benefits vs Manual Filtering

### Before (Manual Mapping)
```typescript
const filterableFields = [
  { name: 'name', type: 'text' },
  { name: 'dl__project_stage', type: 'settings' },
  { name: 'budget_allocated_amt', type: 'currency' },
  { name: 'manager_employee_id', type: 'uuid' },
  { name: 'active_flag', type: 'boolean' }
];

// Manual filter building logic...
for (const field of filterableFields) {
  if (request.query[field.name]) {
    // Build condition based on type...
  }
}
```

### After (Universal Filter Builder)
```typescript
const autoFilters = buildAutoFilters('e', request.query);
conditions.push(...autoFilters);
```

**Reduction**: ~30 lines → 2 lines (93% less code)

## See Also

- [Entity Infrastructure Service](./ENTITY_INFRASTRUCTURE_SERVICE.md) - RBAC and infrastructure management
- [Universal Formatter Service](./UNIVERSAL_FORMATTER_SERVICE.md) - Field detection and formatting
- [API Developer Guide](../api/entity_endpoint_design.md) - Complete API patterns

---

**Version**: 1.0.0
**Updated**: 2025-01-18
**Maintained by**: PMO Platform Team
