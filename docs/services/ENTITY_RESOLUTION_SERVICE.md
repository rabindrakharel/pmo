# Entity Resolution Service

**Location**: `apps/api/src/services/entity-infrastructure.service.ts`
**Method**: `resolve_entity_references()`
**Usage**: Called automatically by entity endpoints that serve data to EntityFormDataContainer

## Purpose

Automatically resolve UUID fields to human-readable entity names based on the double-underscore naming convention. This enables the frontend to display meaningful labels instead of raw UUIDs without making additional API calls.

## Naming Convention Patterns

The service automatically detects entity references based on field naming:

| Pattern | Example | Label Extracted | Entity Extracted |
|---------|---------|-----------------|------------------|
| `{label}__{entity}_id` | `manager__employee_id` | `manager` | `employee` |
| `{label}__{entity}_ids` | `stakeholder__employee_ids` | `stakeholder` | `employee` |
| `{entity}_id` | `project_id` | `project` | `project` |
| `{entity}_ids` | `attachment_ids` | `attachment` | `attachment` |

## Output Format

### Single UUID Field

**Input**:
```json
{
  "sponsor__employee_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
}
```

**Output**:
```json
{
  "sponsor__employee_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "sponsor": "James Miller"
}
```

### UUID Array Field

**Input**:
```json
{
  "stakeholder__employee_ids": [
    "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "dddddddd-dddd-dddd-dddd-dddddddddddd"
  ]
}
```

**Output**:
```json
{
  "stakeholder": [
    {
      "stakeholder__employee_id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "stakeholder": "Sarah Johnson"
    },
    {
      "stakeholder__employee_id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
      "stakeholder": "Michael Chen"
    }
  ]
}
```

**Note**: The array is placed under the **label field name** (`stakeholder`), not the original field name (`stakeholder__employee_ids`).

## Backend Integration (Entity Routes)

Entity endpoints that serve data to EntityFormDataContainer should call the resolution service before returning data.

### Example: GET Single Entity

```typescript
// apps/api/src/modules/project/routes.ts

fastify.get('/api/v1/project/:id', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const { id } = request.params;
  const userId = request.user.sub;

  // STEP 1: Check RBAC permission
  const canView = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, id, Permission.VIEW
  );
  if (!canView) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  // STEP 2: Fetch entity data from primary table
  const result = await db.execute(sql`
    SELECT *
    FROM app.d_project
    WHERE id = ${id}
  `);

  if (result.length === 0) {
    return reply.status(404).send({ error: 'Project not found' });
  }

  const project = result[0];

  // STEP 3: Resolve UUID fields to human-readable names
  const enrichedProject = await entityInfra.resolve_entity_references(project);

  return reply.send(enrichedProject);
});
```

### Example: GET Entity List

```typescript
fastify.get('/api/v1/project', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const userId = request.user.sub;

  // STEP 1: Get RBAC WHERE condition
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, 'e'
  );

  // STEP 2: Fetch entity list from primary table
  const projects = await db.execute(sql`
    SELECT e.*
    FROM app.d_project e
    WHERE ${rbacCondition}
    ORDER BY e.created_ts DESC
    LIMIT 50
  `);

  // STEP 3: Resolve UUID fields for each project
  const enrichedProjects = await Promise.all(
    projects.map(project => entityInfra.resolve_entity_references(project))
  );

  return reply.send({ data: enrichedProjects });
});
```

## Frontend Usage (EntityFormDataContainer)

The frontend receives enriched data automatically - no additional API calls needed!

### Before Resolution Service

```typescript
// ❌ OLD: Frontend had to make separate lookups
const EntityFormDataContainer = ({ entityData }: Props) => {
  const [managerName, setManagerName] = useState('Loading...');

  useEffect(() => {
    // Had to fetch employee name separately
    fetchEmployeeName(entityData.manager_employee_id)
      .then(name => setManagerName(name));
  }, [entityData.manager_employee_id]);

  return <span>{managerName}</span>;
};
```

### After Resolution Service

```typescript
// ✅ NEW: Data arrives pre-enriched from backend
const EntityFormDataContainer = ({ entityData }: Props) => {
  return (
    <div>
      <label>Manager:</label>
      <span>{entityData.manager || 'Unknown'}</span>

      <label>Stakeholders:</label>
      <ul>
        {entityData.stakeholder?.map((item, i) => (
          <li key={i}>{item.stakeholder}</li>
        ))}
      </ul>
    </div>
  );
};
```

## Service Implementation Details

### Performance Optimization

The service uses **bulk resolution** to minimize database queries:

1. Collects all UUIDs across all fields (grouped by entity type)
2. Executes **one query per entity type** (not one query per UUID)
3. Maps results back to original fields

**Example**: If resolving 3 employee UUIDs and 2 project UUIDs, the service executes:
- 1 query for all 3 employees: `WHERE entity_code = 'employee' AND entity_instance_id = ANY([...])`
- 1 query for all 2 projects: `WHERE entity_code = 'project' AND entity_instance_id = ANY([...])`

**Total**: 2 queries instead of 5

### Data Source

All resolutions query the `app.entity_instance` table:

```sql
SELECT entity_instance_id, entity_instance_name
FROM app.entity_instance
WHERE entity_code = $1
  AND entity_instance_id = ANY($2::uuid[])
```

This table is automatically populated by:
- Entity creation operations (via `set_entity_instance_registry()`)
- Entity update operations (via `update_entity_instance_registry()`)
- Backfill scripts (`entity_configuration_settings/04_entity_instance_backfill.ddl`)

## Error Handling

### Unknown UUIDs

If a UUID doesn't exist in `entity_instance`, the service returns:
- `"Unknown"` for the resolved name
- Original UUID is preserved

Example:
```json
{
  "manager__employee_id": "invalid-uuid-12345",
  "manager": "Unknown"
}
```

### Invalid Field Names

Fields that don't match any of the 4 patterns are passed through unchanged:

```json
{
  "custom_field": "some-value",
  "manager__employee_id": "uuid",
  "manager": "James Miller"
}
```

## When to Use Resolution

✅ **Use resolution for**:
- Entity detail views (GET /api/v1/entity/:id)
- Entity form data (EntityFormDataContainer)
- Single entity retrieval with related references

❌ **Skip resolution for**:
- Large list endpoints (performance overhead)
- Data export operations (raw UUIDs may be needed)
- Internal API calls between services

## Benefits

1. **Zero Frontend Calls**: No additional API requests to resolve UUIDs
2. **Bulk Resolution**: Efficient database queries (one per entity type)
3. **Type Safety**: TypeScript interfaces ensure correct usage
4. **Centralized Logic**: All resolution logic in one service method
5. **Convention Over Configuration**: Field names self-describe entity type and label

## Related Documentation

- [Entity Infrastructure Service](./ENTITY_INFRASTRUCTURE_SERVICE.md) - Complete service architecture
- [UUID Field Naming Convention Migration](../MIGRATION_UUID_FIELD_NAMING.md) - Naming convention details
- [Universal Formatter Service](./UNIVERSAL_FORMATTER_SERVICE.md) - Frontend formatting patterns

---

**Version**: 2.0.0
**Date**: 2025-01-18
**Status**: ✅ Complete - Server-side resolution pattern
