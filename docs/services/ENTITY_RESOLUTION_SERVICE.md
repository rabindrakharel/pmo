# Entity Resolution Service

**Location**: `apps/api/src/services/entity-infrastructure.service.ts`
**Method**: `resolve_entity_references()`
**Endpoint**: `POST /api/v1/entity/entity_instance_id_lookup`

## Purpose

Resolve UUID fields to human-readable entity names based on the double-underscore naming convention. This enables the frontend to display meaningful labels instead of raw UUIDs.

## Naming Convention Patterns

The service automatically detects entity references based on field naming:

| Pattern | Example | Label Extracted | Entity Extracted |
|---------|---------|-----------------|------------------|
| `{label}__{entity}_id` | `manager__employee_id` | `manager` | `employee` |
| `{label}__{entity}_ids` | `stakeholder__employee_ids` | `stakeholder` | `employee` |
| `{entity}_id` | `project_id` | `project` | `project` |
| `{entity}_ids` | `attachment_ids` | `attachment` | `attachment` |

## API Usage

### Request

```http
POST /api/v1/entity/entity_instance_id_lookup
Authorization: Bearer <token>
Content-Type: application/json

{
  "sponsor__employee_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "stakeholder__employee_ids": [
    "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "dddddddd-dddd-dddd-dddd-dddddddddddd"
  ],
  "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e"
}
```

### Response

```json
{
  "sponsor__employee_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "sponsor": "Sarah Johnson",
  "stakeholder__employee_ids": [
    "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "dddddddd-dddd-dddd-dddd-dddddddddddd"
  ],
  "stakeholder": ["Michael Chen", "Emily Brown"],
  "project_id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
  "project": "Digital Transformation"
}
```

## Frontend Integration (EntityFormDataContainer)

### Step 1: Import Resolution Hook

```typescript
import { useEntityResolution } from '@/hooks/useEntityResolution';
```

### Step 2: Call Resolution Service

```typescript
const EntityFormDataContainer = ({ entityData }: Props) => {
  const [resolvedData, setResolvedData] = useState<Record<string, any>>({});

  useEffect(() => {
    const resolveFields = async () => {
      // Extract UUID fields from entity data
      const uuidFields = extractUUIDFields(entityData);

      // Call resolution endpoint
      const response = await fetch('/api/v1/entity/entity_instance_id_lookup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(uuidFields)
      });

      const resolved = await response.json();
      setResolvedData(resolved);
    };

    resolveFields();
  }, [entityData]);

  return (
    <div>
      {/* Display resolved labels instead of UUIDs */}
      <div>
        <label>Manager:</label>
        <span>{resolvedData.manager || 'Loading...'}</span>
      </div>

      <div>
        <label>Stakeholders:</label>
        <ul>
          {resolvedData.stakeholder?.map((name: string, i: number) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
```

### Helper Function: Extract UUID Fields

```typescript
function extractUUIDFields(data: Record<string, any>): Record<string, string | string[] | null> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const fieldPattern = /(^.+__[a-z_]+_ids?$|^[a-z_]+_ids?$)/;

  const uuidFields: Record<string, string | string[] | null> = {};

  for (const [key, value] of Object.entries(data)) {
    // Check if field name matches UUID field patterns
    if (!fieldPattern.test(key)) continue;

    if (typeof value === 'string' && uuidPattern.test(value)) {
      uuidFields[key] = value;
    } else if (Array.isArray(value) && value.every(v => typeof v === 'string' && uuidPattern.test(v))) {
      uuidFields[key] = value;
    } else if (value === null) {
      uuidFields[key] = null;
    }
  }

  return uuidFields;
}
```

## Service Implementation Details

### Performance Optimization

The service uses **bulk resolution** to minimize database queries:

1. Collects all UUIDs across all fields (grouped by entity type)
2. Executes **one query per entity type** (not one query per UUID)
3. Maps results back to original fields

Example: If resolving 3 employee UUIDs and 2 project UUIDs, the service executes:
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
- Entity creation triggers
- Manual registry sync in routes
- Backfill scripts (`entity_configuration_settings/04_entity_instance_backfill.ddl`)

## Error Handling

### Unknown UUIDs

If a UUID doesn't exist in `entity_instance`, the service returns:
- `"Unknown"` for the resolved name
- Original UUID is preserved in the response

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
// Input
{
  "custom_field": "some-value",
  "manager__employee_id": "uuid"
}

// Output
{
  "custom_field": "some-value",
  "manager__employee_id": "uuid",
  "manager": "James Miller"
}
```

## Benefits

1. **Zero Configuration**: Field names self-describe their entity type and label
2. **Bulk Resolution**: Efficient database queries (one per entity type)
3. **Type Safety**: TypeScript interfaces ensure correct usage
4. **Centralized Logic**: All resolution logic in one service method
5. **Frontend Simplicity**: One API call resolves all UUID fields

## Related Documentation

- [Entity Infrastructure Service](./ENTITY_INFRASTRUCTURE_SERVICE.md) - Complete service architecture
- [UUID Field Naming Convention Migration](../MIGRATION_UUID_FIELD_NAMING.md) - Naming convention details
- [Universal Formatter Service](./UNIVERSAL_FORMATTER_SERVICE.md) - Frontend formatting patterns

---

**Version**: 1.0.0
**Date**: 2025-01-18
**Status**: ✅ Complete and deployed
