# Child Entity Management System

**Date**: 2025-11-18
**Status**: ✅ Production Ready

## Overview

The PMO platform uses a flexible parent-child entity relationship system where entities can dynamically manage their child entity types through the `child_entity_codes` JSONB array in the `entity` table.

---

## Architecture

### Database Schema

**Table**: `app.entity`

```sql
CREATE TABLE app.entity (
  code VARCHAR(255) PRIMARY KEY,
  entity_code VARCHAR(255),
  label VARCHAR(255),
  icon VARCHAR(255),
  child_entity_codes JSONB DEFAULT '[]'::jsonb,  -- Array of child entity codes
  ...
);
```

**Child Entity Codes Format**: Simple string array

```json
["task", "wiki", "artifact", "form", "expense", "revenue"]
```

### Redis Cache Layer

- **Cache Key**: `entity:metadata:{entity_code}`
- **TTL**: 300 seconds (5 minutes)
- **Invalidation**: Automatic on child entity updates

---

## API Endpoints

### Get Entity Metadata

```http
GET /api/v1/entity/type/:code
Authorization: Bearer {token}
```

**Response**:
```json
{
  "code": "project",
  "label": "Projects",
  "icon": "FolderKanban",
  "child_entity_codes": ["task", "wiki", "artifact", "form", "expense", "revenue"]
}
```

### Update Child Entities

```http
PUT /api/v1/entity/:code/children
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "child_entity_codes": ["task", "wiki", "artifact"],
  "mode": "append"  // or "replace"
}
```

**Two Modes**:

1. **Append Mode** (Default) - Adds new children without removing existing ones
   ```json
   { "child_entity_codes": ["employee"], "mode": "append" }
   ```
   - Merges with existing array
   - Deduplicates entries
   - Use for: Adding new child entity types

2. **Replace Mode** - Sets exact list (enables removals)
   ```json
   { "child_entity_codes": ["wiki", "artifact"], "mode": "replace" }
   ```
   - Replaces entire array with provided list
   - Use for: Removing child entity types

---

## Frontend Usage

### Managing Child Entities (Settings Page)

**File**: `apps/web/src/pages/setting/SettingsOverviewPage.tsx`

#### Add Child Entity

```typescript
const handleAddChild = async (parentCode: string, childCode: string) => {
  const parent = entities.find(e => e.code === parentCode);
  const updatedChildren = [...(parent.child_entity_codes || []), childCode];

  await handleUpdateChildEntities(
    parentCode,
    updatedChildren,
    'append'  // Use append mode
  );
};
```

#### Remove Child Entity

```typescript
const handleRemoveChild = async (parentCode: string, childEntity: string) => {
  const parent = entities.find(e => e.code === parentCode);
  const updatedChildren = (parent.child_entity_codes || []).filter(c => c !== childEntity);

  await handleUpdateChildEntities(
    parentCode,
    updatedChildren,
    'replace'  // Use replace mode
  );
};
```

#### Update Helper Function

```typescript
const handleUpdateChildEntities = async (
  code: string,
  childEntityCodes: string[],
  mode: 'append' | 'replace' = 'append'
) => {
  const response = await fetch(`http://localhost:4000/api/v1/entity/${code}/children`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ child_entity_codes: childEntityCodes, mode })
  });

  if (response.ok) {
    // Refresh entity list
    await loadEntities();
  }
};
```

---

## Backend Implementation

### API Route Handler

**File**: `apps/api/src/modules/entity/routes.ts:391-487`

```typescript
fastify.put('/api/v1/entity/:code/children', {
  schema: {
    params: Type.Object({
      code: Type.String()
    }),
    body: Type.Object({
      child_entity_codes: Type.Array(Type.String()),
      mode: Type.Optional(Type.Union([
        Type.Literal('append'),
        Type.Literal('replace')
      ]))
    })
  }
}, async (request, reply) => {
  const { code } = request.params;
  const { child_entity_codes: newCodes, mode = 'append' } = request.body;

  // Get current entity metadata from cache or DB
  const currentEntity = await entityInfra.get_entity(code);
  const currentCodes = currentEntity?.child_entity_codes || [];

  // Determine final child entity codes based on mode
  let finalCodes: string[];
  if (mode === 'replace') {
    // Replace mode: Use provided list as-is (for removals)
    finalCodes = newCodes;
  } else {
    // Append mode: Merge and deduplicate (for additions)
    finalCodes = [...new Set([...currentCodes, ...newCodes])];
  }

  // Update database with proper JSONB casting
  const jsonbArray = JSON.stringify(finalCodes);
  await client.unsafe(`
    UPDATE app.entity
    SET child_entity_codes = '${jsonbArray}'::jsonb
    WHERE code = $1
  `, [code]);

  // Invalidate cache to ensure fresh data on next GET
  await entityInfra.invalidate_entity_cache(code);

  return reply.send({
    success: true,
    data: { code, child_entity_codes: finalCodes }
  });
});
```

---

## Cache Invalidation Flow

```
User Action (Add/Remove Child)
        ↓
PUT /api/v1/entity/:code/children
        ↓
Update Database (JSONB array)
        ↓
Invalidate Redis Cache
  DELETE entity:metadata:project
        ↓
Next GET Request
        ↓
Cache Miss → Query Database
        ↓
Populate Cache (300s TTL)
  SETEX entity:metadata:project 300 {...}
```

---

## Testing

### Test Script: `/tmp/test-child-remove.sh`

```bash
#!/bin/bash
API_URL="http://localhost:4000"
EMAIL="james.miller@huronhome.ca"
PASSWORD="password123"

TOKEN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r ".token")

echo "1️⃣ Reset database"
/home/rabin/projects/pmo/tools/db-import.sh >/dev/null 2>&1
sleep 2

echo "2️⃣ Initial state"
curl -s -X GET "$API_URL/api/v1/entity/type/project" \
  -H "Authorization: Bearer $TOKEN" | jq -c "{code, children: .child_entity_codes}"

echo "3️⃣ Add employee (mode: append)"
curl -s -X PUT "$API_URL/api/v1/entity/project/children" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"child_entity_codes": ["employee"], "mode": "append"}' \
  | jq -c "{success, children: .data.child_entity_codes}"

echo "4️⃣ Verify employee added"
curl -s -X GET "$API_URL/api/v1/entity/type/project" \
  -H "Authorization: Bearer $TOKEN" | jq -c "{code, children: .child_entity_codes}"

echo "5️⃣ Remove task (mode: replace with filtered list)"
curl -s -X PUT "$API_URL/api/v1/entity/project/children" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"child_entity_codes": ["wiki", "artifact", "form", "expense", "revenue", "employee"], "mode": "replace"}' \
  | jq -c "{success, children: .data.child_entity_codes}"

echo "6️⃣ Verify task removed"
curl -s -X GET "$API_URL/api/v1/entity/type/project" \
  -H "Authorization: Bearer $TOKEN" | jq -c "{code, children: .child_entity_codes}"
```

**Expected Results**:
```
✅ Append mode: Adds new children without removing existing
✅ Replace mode: Sets exact list (removes unwanted children)
```

---

## Common Use Cases

### 1. Adding a New Child Entity Type

**Scenario**: Add "employee" as a child entity type to "project"

```bash
curl -X PUT http://localhost:4000/api/v1/entity/project/children \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"child_entity_codes": ["employee"], "mode": "append"}'
```

**Result**: `["task", "wiki", "artifact", "form", "expense", "revenue", "employee"]`

### 2. Removing a Child Entity Type

**Scenario**: Remove "task" from "project" child entities

```bash
# First, get current list
CURRENT=$(curl -s http://localhost:4000/api/v1/entity/type/project \
  -H "Authorization: Bearer $TOKEN" | jq -c '.child_entity_codes')

# Filter out "task" and send updated list with replace mode
curl -X PUT http://localhost:4000/api/v1/entity/project/children \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"child_entity_codes": ["wiki", "artifact", "form", "expense", "revenue"], "mode": "replace"}'
```

**Result**: `["wiki", "artifact", "form", "expense", "revenue"]`

### 3. Reordering Child Entity Types

**Scenario**: Change display order of child entities

```bash
curl -X PUT http://localhost:4000/api/v1/entity/project/children \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"child_entity_codes": ["wiki", "task", "artifact", "form"], "mode": "replace"}'
```

---

## Data Consistency

### JSONB Storage Format

**Correct** (Simple string array):
```json
["task", "wiki", "artifact"]
```

**Incorrect** (Object array - legacy format):
```json
[
  {"entity": "task", "ui_icon": "CheckSquare", "ui_label": "Tasks", "order": 1},
  {"entity": "wiki", "ui_icon": "BookOpen", "ui_label": "Wiki", "order": 2}
]
```

### Database Verification

```sql
-- Check data type (should return "array")
SELECT jsonb_typeof(child_entity_codes)
FROM app.entity
WHERE code = 'project';

-- Check array length
SELECT jsonb_array_length(child_entity_codes)
FROM app.entity
WHERE code = 'project';

-- Check specific element
SELECT child_entity_codes->0 as first_child
FROM app.entity
WHERE code = 'project';
```

---

## Troubleshooting

### Issue: Child entities not appearing in UI

**Diagnosis**:
```bash
# Check database
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app \
  -c "SELECT code, child_entity_codes FROM app.entity WHERE code = 'project';"

# Check Redis cache
docker exec pmo_redis redis-cli GET "entity:metadata:project"
```

**Solution**:
1. Verify JSONB array format in database
2. Clear Redis cache: `docker exec pmo_redis redis-cli DEL "entity:metadata:project"`
3. Reload page to trigger fresh GET request

### Issue: Removal not working

**Diagnosis**:
- Check if frontend is using `mode: 'replace'` parameter
- Verify API logs show correct mode being received

**Solution**:
```typescript
// Ensure replace mode is used for removals
await handleUpdateChildEntities(parentCode, updatedChildren, 'replace');
```

### Issue: Stale data after update

**Diagnosis**:
```bash
# Check cache TTL
docker exec pmo_redis redis-cli TTL "entity:metadata:project"

# Check if cache was invalidated
./tools/logs-api.sh | grep "Cache invalidated"
```

**Solution**:
- Cache should be automatically invalidated after PUT
- If not, manually clear: `docker exec pmo_redis redis-cli DEL "entity:metadata:project"`

---

## DDL Reference

**File**: `db/entity_configuration_settings/02_entity.ddl`

### Example Entity Configuration

```sql
INSERT INTO app.entity (
  code,
  entity_code,
  label,
  label_plural,
  icon,
  child_entity_codes,
  active_flag
) VALUES (
  'project',
  'project',
  'Project',
  'Projects',
  'FolderKanban',
  '["task", "wiki", "artifact", "form", "expense", "revenue"]'::jsonb,
  true
);
```

### Adding New Entity with Children

```sql
INSERT INTO app.entity (
  code,
  entity_code,
  label,
  label_plural,
  icon,
  child_entity_codes,
  active_flag
) VALUES (
  'department',
  'department',
  'Department',
  'Departments',
  'Building',
  '["employee", "team", "project"]'::jsonb,  -- Simple string array
  true
);
```

---

## Benefits

| Feature | Before | After |
|---------|--------|-------|
| **Add Children** | ✅ Works | ✅ Works (append mode) |
| **Remove Children** | ❌ Broken (always merged back) | ✅ Works (replace mode) |
| **Cache Invalidation** | ❌ Manual | ✅ Automatic |
| **Cache Persistence** | ❌ Lost on restart | ✅ Redis (survives restarts) |
| **JSONB Storage** | ⚠️ Sometimes string | ✅ Always array |
| **DDL Format** | ⚠️ Mixed (objects/strings) | ✅ Standardized (strings) |

---

## Related Documentation

- `docs/REDIS_CACHE_MIGRATION.md` - Redis caching architecture
- `docs/services/entity-infrastructure.service.md` - Entity metadata service
- `docs/api/entity_endpoint_design.md` - API patterns and design

---

**Status**: ✅ Production Ready
**Last Updated**: 2025-11-18
**Version**: 1.0.0
