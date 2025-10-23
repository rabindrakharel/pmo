# Universal Entity Options API

**Status:** ✅ Implemented
**Date:** 2025-10-23

## Overview

Global API system for fetching entity dropdown options (id, name pairs) for any entity type. This eliminates the need for entity-specific dropdown endpoints and provides a unified interface for populating selection fields across the entire application.

## Architecture

### Backend API

**Module:** `apps/api/src/modules/entity-options/routes.ts`

#### Endpoints

**1. GET `/api/v1/entity/:entityType/options`**

Returns a list of {id, name} pairs for the specified entity type.

**Parameters:**
- `entityType` (path) - Entity type (employee, project, task, biz, office, client, etc.)
- `search` (query, optional) - Search filter for entity names
- `limit` (query, optional) - Max results (default: 100, max: 1000)
- `active_only` (query, optional) - Filter to active entities only (default: true)

**Response:**
```json
{
  "data": [
    {"id": "uuid", "name": "James Miller"},
    {"id": "uuid", "name": "John Doe"}
  ],
  "total": 505
}
```

**RBAC:** Respects user permissions - only returns entities the user can view (permission 0).

**2. POST `/api/v1/entity/:entityType/options/bulk`**

Bulk lookup - converts array of IDs to names.

**Body:**
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "data": [
    {"id": "uuid1", "name": "James Miller"},
    {"id": "uuid2", "name": "John Doe"}
  ]
}
```

### Frontend API

**Module:** `apps/web/src/lib/api.ts`

```typescript
import { entityOptionsApi } from './lib/api';

// Get options for dropdown
const response = await entityOptionsApi.getOptions('employee', {
  search: 'james',
  limit: 100,
  active_only: true
});

// Bulk lookup
const response = await entityOptionsApi.getBulkOptions('employee', [
  'uuid1', 'uuid2'
]);
```

### Entity Configuration

**Module:** `apps/web/src/lib/entityConfig.ts`

New field property: `loadOptionsFromEntity`

```typescript
{
  key: 'assignee_employee_ids',
  label: 'Assignees',
  type: 'multiselect',
  loadOptionsFromEntity: 'employee'  // ← Loads employee options
}
```

**Supported Entity Types:**
- `employee` → d_employee
- `project` → d_project
- `task` → d_task
- `biz` / `business` → d_business
- `office` / `org` → d_office
- `client` / `cust` → d_client
- `worksite` → d_worksite
- `role` → d_role
- `position` → d_position
- `artifact` → d_artifact
- `wiki` → d_wiki
- `form` → d_form_head

## Implementation Details

### 1. Task Assignee Selection

**Entity Config:** `entityConfig.task.fields`

```typescript
{
  key: 'assignee_employee_ids',
  label: 'Assignees',
  type: 'multiselect',
  loadOptionsFromEntity: 'employee'
}
```

**UI Behavior:**
- ✅ Displays checkbox list of all employees (RBAC-filtered)
- ✅ Shows employee names, not UUIDs
- ✅ Multi-selection supported
- ✅ Scrollable if many employees
- ✅ Edit mode only (view mode shows badges)

### 2. EntityFormContainer Integration

**Module:** `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Auto-loads options:**
- Detects `loadOptionsFromEntity` field property
- Calls `entityOptionsApi.getOptions(entityType)` on mount
- Caches options in component state
- Merges with settings options

**Rendering:**
```typescript
case 'multiselect': {
  const selectedValues = Array.isArray(value) ? value : [];

  return (
    <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded p-2">
      {options.map((opt) => (
        <label className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={selectedValues.includes(opt.value)}
            onChange={(e) => {
              const newValues = e.target.checked
                ? [...selectedValues, opt.value]
                : selectedValues.filter(v => v !== opt.value);
              onChange(field.key, newValues);
            }}
          />
          <span className="text-sm">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
```

### 3. RBAC Integration

**Backend Query:**
```sql
SELECT e.id::text as id, e.name
FROM app.d_employee e
WHERE EXISTS (
  SELECT 1 FROM app.entity_id_rbac_map rbac
  WHERE rbac.empid = ${userId}
    AND rbac.entity = 'employee'
    AND (rbac.entity_id = e.id::text OR rbac.entity_id = 'all')
    AND rbac.active_flag = true
    AND 0 = ANY(rbac.permission)  -- View permission
)
AND e.active_flag = true
ORDER BY e.name ASC
```

**Key Points:**
- Only shows employees user has permission to view
- Respects `entity_id='all'` for type-level access
- Checks individual entity permissions
- Filters by active status

## Usage Examples

### Example 1: Employee Assignment

**Task Form - Assignee Selection**

Navigate to: `/project/{id}/task/{taskId}` → Click Edit

**Before:**
```
Assignees: [Empty field or UUIDs]
```

**After:**
```
Assignees:
☐ Abigail Lewis
☐ Addison Clark
☑ James Miller      ← Selected
☐ John Doe
☐ Jane Smith
... (scrollable list)
```

### Example 2: Project Selection

```typescript
// In entity config
{
  key: 'project_id',
  label: 'Project',
  type: 'select',
  loadOptionsFromEntity: 'project'
}
```

Automatically loads all projects user can view.

### Example 3: Client Assignment

```typescript
{
  key: 'client_ids',
  label: 'Clients',
  type: 'multiselect',
  loadOptionsFromEntity: 'client'
}
```

Multi-select clients for task or project.

## Performance Considerations

### Query Performance
- **Index:** Uses primary key index on `d_employee.id`
- **RBAC Check:** EXISTS subquery optimized with indexes
- **Pagination:** Default limit 100, max 1000
- **Search:** ILIKE on name field (consider adding GIN index)

### Frontend Caching
- Options cached in component state
- Reloads only when component remounts
- No global cache (intentional for data freshness)
- Consider adding React Query for advanced caching

### Scalability
| Scenario | Performance |
|----------|-------------|
| 500 employees | ✅ Fast (< 100ms) |
| 5,000 employees | ⚠️ Consider pagination UI |
| 50,000 employees | 🔴 Requires search/autocomplete |

**Recommendation:** For > 1000 options, implement autocomplete instead of full list.

## Testing

### API Test

```bash
./tools/test-api.sh GET "/api/v1/entity/employee/options?limit=10"
```

**Result:**
```json
{
  "data": [
    {"id": "aab7c737-...", "name": "Abigail Lewis"},
    {"id": "30fce0bc-...", "name": "Abigail Martin"},
    ...
  ],
  "total": 505
}
```

### Frontend Test

1. Navigate to: `/project/{id}/task/create` or `/task/{taskId}` (edit mode)
2. Click "Edit" button
3. Scroll to "Assignees" field
4. Verify checkbox list of employees appears
5. Select/deselect employees
6. Click "Save"
7. Verify assignee names appear in view mode

### RBAC Test

1. Login as user with limited permissions
2. Navigate to task form
3. Verify only accessible employees appear in dropdown
4. Try selecting employee user doesn't have access to (should not appear)

## Future Enhancements

- [ ] Add autocomplete/typeahead for large datasets
- [ ] Add entity avatars/icons to dropdown options
- [ ] Cache options with React Query
- [ ] Support filtering by entity properties (e.g., department, role)
- [ ] Add "Recently Used" section
- [ ] Implement virtual scrolling for large lists
- [ ] Add keyboard navigation
- [ ] Support grouped options (e.g., by department)

## Benefits

| Feature | Before | After |
|---------|--------|-------|
| **API Calls** | Entity-specific endpoints | Universal `/entity/:type/options` |
| **Code Reuse** | Duplicate code per entity | Single implementation |
| **Maintenance** | Update multiple endpoints | Update one endpoint |
| **Consistency** | Inconsistent UX | Uniform UX |
| **RBAC** | Manual per endpoint | Automatic |
| **Frontend** | Custom dropdowns | Auto-loaded options |

## Migration Guide

### Adding Dropdown to New Entity

**Step 1:** Add field to entity config
```typescript
{
  key: 'related_entity_id',
  label: 'Related Entity',
  type: 'select',
  loadOptionsFromEntity: 'entityTypeName'
}
```

**Step 2:** That's it! No backend changes needed.

### Converting Existing Static Dropdown

**Before:**
```typescript
{
  key: 'employee_id',
  label: 'Employee',
  type: 'select',
  options: [
    { value: 'uuid1', label: 'James' },
    { value: 'uuid2', label: 'John' }
  ]
}
```

**After:**
```typescript
{
  key: 'employee_id',
  label: 'Employee',
  type: 'select',
  loadOptionsFromEntity: 'employee'  // ← Dynamic loading
}
```

## Related Files

**Backend:**
- `apps/api/src/modules/entity-options/routes.ts` - API endpoints
- `apps/api/src/modules/index.ts` - Route registration

**Frontend:**
- `apps/web/src/lib/api.ts` - API client
- `apps/web/src/lib/entityConfig.ts` - Entity configuration
- `apps/web/src/components/shared/entity/EntityFormContainer.tsx` - Form rendering

**Database:**
- All `d_*` tables with `id` and `name` columns
- `app.entity_id_rbac_map` - RBAC permissions
