# Plan: Entity Reference Searchable Dropdown Implementation

**Status**: READY FOR IMPLEMENTATION
**Last Updated**: 2025-11-26
**Version**: 3.1.0 (v8.3.0 Architecture)

---

## Why We're Solving This

### The Problem

When displaying entity data (e.g., a Project), the API returns entity reference fields as raw UUIDs:

```json
{
  "name": "Kitchen Renovation",
  "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13"  ← Not human-readable!
}
```

**Users see UUIDs instead of names** - a terrible UX.

### Current Workaround (Legacy - Being Replaced)

The current system uses `_ID` and `_IDS` objects embedded in each data row:
- Bloats response payload (repeated metadata per row)
- Complex structure (`data._ID.manager.manager` to get name)
- Not scalable (grows with each reference field)

### The Solution: `ref_data`

Move entity reference resolution to a **response-level lookup table**:

```json
{
  "data": [{ "manager__employee_id": "uuid-123" }],
  "ref_data": {
    "employee": { "uuid-123": "James Miller" }   ← O(1) lookup!
  }
}
```

**Benefits:**
1. **Cleaner data** - Raw UUIDs in `data`, names in `ref_data`
2. **Smaller payload** - Deduplicated across all rows
3. **Simple lookup** - `ref_data[entityCode][uuid]`
4. **Cacheable** - Frontend can cache `ref_data` independently

---

## Documents to Update After Implementation

| Document | Update Required |
|----------|-----------------|
| `docs/services/entity-infrastructure.service.md` | Add `build_ref_data()` method documentation |
| `docs/services/backend-formatter.service.md` | Document `ref_data` in response structure |
| `docs/state_management/STATE_MANAGEMENT.md` | Add ref_data caching to React Query section |
| `CLAUDE.md` | Update API response structure examples |
| `docs/pages/PAGE_ARCHITECTURE.md` | Update EntityFormContainer props to include `ref_data` |
| `docs/ui_components_layout/EntityDataTable.md` | Document ref_data usage for entity reference columns |

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION ORDER (Backend → Frontend)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  PHASE 1: BACKEND (Must complete before frontend)                            │
│  ════════════════════════════════════════════════                            │
│  1.1 Add build_ref_data() to entity-infrastructure.service.ts               │
│  1.2 Update ALL route files to return ref_data in response                  │
│  1.3 Remove _ID/_IDS generation from routes                                 │
│  1.4 Test: API responses include ref_data, exclude _ID/_IDS                 │
│                                                                               │
│  PHASE 2: FRONTEND (After backend is complete)                               │
│  ═════════════════════════════════════════════                               │
│  2.1 Add queryKeys.refData to useEntityQuery.ts                             │
│  2.2 Create useRefData hook (React Query only)                              │
│  2.3 Create refDataResolver.ts utility                                      │
│  2.4 Update EntityFormContainer to use ref_data                             │
│  2.5 Update EntityDataTable to use ref_data                                 │
│  2.6 Remove all _ID/_IDS references from components                         │
│                                                                               │
│  PHASE 3: CLEANUP                                                            │
│  ═══════════════                                                             │
│  3.1 Mark resolve_entity_references() as @deprecated                        │
│  3.2 Remove _ID/_IDS types from frontend                                    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Problem Statement

When hitting a project endpoint, the response contains entity references like `manager__employee_id` (UUID). The user wants:

1. **Display**: Show employee NAME (not UUID) in view mode
2. **Edit**: Searchable dropdown that fetches from React Query and shows employee names
3. **Save**: Only send UUID to backend (never the display name)

### CURRENT Structure (Legacy - TO BE REMOVED)
```json
{
  "data": [{
    "id": "project-abc-123",
    "name": "Kitchen Renovation",
    "manager__employee_id": "uuid-123",
    "_ID": {
      "manager": { "entity_code": "employee", "manager__employee_id": "uuid", "manager": "James Miller" }
    },
    "_IDS": {
      "stakeholder": [
        { "entity_code": "employee", "stakeholder__employee_id": "uuid", "stakeholder": "Mike" }
      ]
    }
  }]
}
```

### NEW Structure (ref_data grouped by entity_code)
```json
{
  "data": [{
    "id": "project-abc-123",
    "name": "Kitchen Renovation",
    "manager__employee_id": "uuid-123",
    "stakeholder__employee_ids": ["uuid-456", "uuid-789"],
    "business_id": "uuid-bus-001"
  }],
  "ref_data": {
    "employee": {
      "uuid-123": "James Miller",
      "uuid-456": "Sarah Johnson",
      "uuid-789": "Michael Chen"
    },
    "business": {
      "uuid-bus-001": "Huron Home Services"
    }
  },
  "metadata": { ... }
}
```

**Key Changes:**
1. `_ID` and `_IDS` **REMOVED** from each data row
2. `ref_data` added at **response level** (parallel to `metadata`)
3. Structure: **{ entity_code: { uuid: name } }** - nested object for O(1) lookup
4. **ONLY contains UUIDs found in the query result** - no empty buckets, no pre-populated entity types
5. Deduplication: Each UUID appears only once per entity_code
6. Frontend lookup: `ref_data[entityCode][uuid]` → display name

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTITY REFERENCE DROPDOWN ARCHITECTURE (v2.0)              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                         BACKEND (API Response)                        │     │
│  │                                                                       │     │
│  │  GET /api/v1/project returns:                                        │     │
│  │  {                                                                    │     │
│  │    data: [{                                                           │     │
│  │      id: "proj-123",                                                  │     │
│  │      manager__employee_id: "uuid-123",     ← Raw UUID (for PATCH)    │     │
│  │      stakeholder__employee_ids: ["uuid-456", "uuid-789"]              │     │
│  │    }],                                                                │     │
│  │    ref_data: {                              ← Grouped by entity_code  │     │
│  │      "employee": {                          ← entity_code as key      │     │
│  │        "uuid-123": "James Miller",          ← uuid: name mapping      │     │
│  │        "uuid-456": "Sarah",                                           │     │
│  │        "uuid-789": "Mike"                                             │     │
│  │      },                                                               │     │
│  │      "business": { "uuid-bus": "Huron Home" }                         │     │
│  │    },                                                                 │     │
│  │    metadata: { ... }                                                  │     │
│  │  }                                                                    │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                    REACT QUERY (Caching Layer)                        │     │
│  │                                                                       │     │
│  │  1. Entity Data Cache:                                                │     │
│  │     queryKey: ['entity-instance', 'project', id]                      │     │
│  │     data: { manager__employee_id, ref_data, metadata }                │     │
│  │                                                                       │     │
│  │  2. Entity Lookup Cache (useEntityLookup - for EDIT mode dropdowns): │     │
│  │     queryKey: ['entity-lookup', 'employee', { search: 'jam' }]        │     │
│  │     data: [{ id: "uuid-1", name: "James" }, ...]                      │     │
│  │     TTL: 15 minutes, server-side search                               │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                    FRONTEND COMPONENTS                                │     │
│  │                                                                       │     │
│  │  VIEW MODE:                                                           │     │
│  │  ┌──────────────────────────────────────────┐                        │     │
│  │  │ Manager: James Miller                     │                        │     │
│  │  └──────────────────────────────────────────┘                        │     │
│  │  Lookup: ref_data["employee"]["uuid-123"] // → "James Miller"        │
│  │                                                                       │     │
│  │  EDIT MODE:                                                           │     │
│  │  ┌──────────────────────────────────────────┐                        │     │
│  │  │ Manager: [James Miller ▼]                 │  ← EntitySelect       │     │
│  │  │          ┌──────────────────────────────┐│                        │     │
│  │  │          │ 🔍 Search employees...       ││                        │     │
│  │  │          │ ✓ James Miller               ││  ← useEntityLookup    │     │
│  │  │          │   Mike Johnson               ││    (server-side search)│     │
│  │  │          │   Sarah Wilson               ││                        │     │
│  │  │          └──────────────────────────────┘│                        │     │
│  │  └──────────────────────────────────────────┘                        │     │
│  │                                                                       │     │
│  │  SAVE: PATCH /api/v1/project/:id                                     │     │
│  │        { manager__employee_id: "new-uuid" }  ← Only UUID sent        │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW: LOAD → EDIT → SAVE (v2.0)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  LOAD PHASE                                                                   │
│  ─────────────                                                                │
│                                                                               │
│  1. API Request: GET /api/v1/project                                         │
│                       │                                                       │
│                       ▼                                                       │
│  2. Backend builds ref_data:                                                 │
│     - Scans all rows for *_id, *_ids fields                                  │
│     - Collects unique UUIDs per field                                        │
│     - Batch resolves names from entity_instance table                        │
│     - Returns ref_data at response level                                     │
│                       │                                                       │
│                       ▼                                                       │
│  3. React Query caches full response                                         │
│     queryKey: ['entity-instance', 'project', id]                             │
│     cache: { data, ref_data, metadata }                                      │
│                       │                                                       │
│                       ▼                                                       │
│  4. Frontend resolves display names:                                         │
│     - For field manager__employee_id with value "uuid-123"                   │
│     - Extract entity_code from field name: "employee"                        │
│     - Lookup: ref_data["employee"]["uuid-123"] → "James Miller"              │
│                                                                               │
│  ─────────────────────────────────────────────────────────────────────────   │
│                                                                               │
│  EDIT PHASE                                                                   │
│  ──────────                                                                   │
│                                                                               │
│  5. User clicks Edit button                                                  │
│                       │                                                       │
│                       ▼                                                       │
│  6. EntityFormContainer renders EntitySelect for manager__employee_id        │
│     - Reads metadata.editType.manager__employee_id.lookupEntity = "employee" │
│     - EntitySelect calls useEntityLookup("employee", { search: "" })         │
│                       │                                                       │
│                       ▼                                                       │
│  7. useEntityLookup fetches (server-side search):                            │
│     GET /api/v1/entity/employee/entity-instance-lookup?search=jam&limit=50   │
│     Returns: [{ id: "uuid", name: "James Miller" }, ...]                     │
│                       │                                                       │
│                       ▼                                                       │
│  8. User searches and selects new employee                                   │
│     EntitySelect.onChange(newUuid, newLabel)                                 │
│                       │                                                       │
│                       ▼                                                       │
│  9. EntityFormContainer updates LOCAL state:                                 │
│     - Sets manager__employee_id = newUuid                                    │
│     - (ref_data not updated locally - refetched after save)                  │
│                                                                               │
│  ─────────────────────────────────────────────────────────────────────────   │
│                                                                               │
│  SAVE PHASE                                                                   │
│  ──────────                                                                   │
│                                                                               │
│  10. User clicks Save button                                                 │
│                       │                                                       │
│                       ▼                                                       │
│  11. Prepare PATCH payload:                                                  │
│      - Extract only changed UUID fields from editedData                      │
│      - Payload: { manager__employee_id: "new-uuid" }                         │
│                       │                                                       │
│                       ▼                                                       │
│  12. PATCH /api/v1/project/:id                                               │
│      { manager__employee_id: "new-uuid" }                                    │
│                       │                                                       │
│                       ▼                                                       │
│  13. React Query invalidates:                                                │
│      - ['entity-instance', 'project', id]                                    │
│      - ['entity-instance-list', 'project']                                   │
│                       │                                                       │
│                       ▼                                                       │
│  14. Refetch returns fresh data with updated ref_data                        │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan (v2.0 - ref_data Restructure)

### Phase 1: Backend - Create new build_ref_data() method

**File**: [entity-infrastructure.service.ts](apps/api/src/services/entity-infrastructure.service.ts)

**TypeScript Types**:
```typescript
// Structure: { entity_code: { uuid: name } }
type RefData = Record<string, Record<string, string>>;

// Example:
// {
//   "employee": { "uuid-123": "James Miller", "uuid-456": "Sarah" },
//   "business": { "uuid-bus": "Huron Home Services" }
// }
```

**New Function**:
```typescript
/**
 * Build ref_data object for response-level entity reference resolution
 *
 * Structure: { entity_code: { uuid: name } }
 *
 * Scans all rows for *_id and *_ids fields, collects unique UUIDs,
 * batch resolves from entity_instance table, returns grouped object.
 *
 * @param rows - Array of data rows to scan for entity references
 * @returns ref_data object for response-level inclusion
 */
async build_ref_data(
  rows: Record<string, any>[]
): Promise<RefData> {
  // Structure: { entity_code: { uuid: name } }
  const ref_data: RefData = {};

  // Pattern matching regexes
  const labeledSinglePattern = /^(.+)__([a-z_]+)_id$/;
  const labeledArrayPattern = /^(.+)__([a-z_]+)_ids$/;
  const simpleSinglePattern = /^([a-z_]+)_id$/;
  const simpleArrayPattern = /^([a-z_]+)_ids$/;

  // Step 1: Collect all UUIDs grouped by entity_code (for batch query)
  const entityCodeToUuids: Record<string, Set<string>> = {};

  for (const row of rows) {
    for (const [fieldName, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue;
      if (fieldName === 'id') continue; // Skip primary key

      // Match patterns to get entity_code
      let entityCode: string | null = null;
      let isArray = false;

      // Pattern 1: {label}__{entity}_id (e.g., manager__employee_id)
      const labeledSingleMatch = fieldName.match(labeledSinglePattern);
      if (labeledSingleMatch) {
        entityCode = labeledSingleMatch[2];
        isArray = false;
      }

      // Pattern 2: {label}__{entity}_ids (e.g., stakeholder__employee_ids)
      if (!entityCode) {
        const labeledArrayMatch = fieldName.match(labeledArrayPattern);
        if (labeledArrayMatch) {
          entityCode = labeledArrayMatch[2];
          isArray = true;
        }
      }

      // Pattern 3: {entity}_id (e.g., business_id)
      if (!entityCode) {
        const simpleSingleMatch = fieldName.match(simpleSinglePattern);
        if (simpleSingleMatch) {
          entityCode = simpleSingleMatch[1];
          isArray = false;
        }
      }

      // Pattern 4: {entity}_ids (e.g., tag_ids)
      if (!entityCode) {
        const simpleArrayMatch = fieldName.match(simpleArrayPattern);
        if (simpleArrayMatch) {
          entityCode = simpleArrayMatch[1];
          isArray = true;
        }
      }

      if (!entityCode) continue;

      // Initialize Set for this entity_code if needed
      if (!entityCodeToUuids[entityCode]) {
        entityCodeToUuids[entityCode] = new Set();
      }

      // Collect UUIDs
      if (isArray && Array.isArray(value)) {
        value.forEach(uuid => {
          if (typeof uuid === 'string') entityCodeToUuids[entityCode!].add(uuid);
        });
      } else if (!isArray && typeof value === 'string') {
        entityCodeToUuids[entityCode].add(value);
      }
    }
  }

  // Step 2: Batch resolve all UUIDs (1 query per entity_code)
  // ONLY add to ref_data if UUIDs are found in entity_instance table
  for (const [entityCode, uuidSet] of Object.entries(entityCodeToUuids)) {
    const uuids = Array.from(uuidSet);
    if (uuids.length === 0) continue;

    const result = await this.db.execute(sql`
      SELECT entity_instance_id::text, entity_instance_name
      FROM app.entity_instance
      WHERE entity_code = ${entityCode}
        AND entity_instance_id IN (${sql.join(uuids.map(id => sql`${id}::uuid`), sql`, `)})
    `);

    // ONLY create bucket if we have results
    if (result.length > 0) {
      ref_data[entityCode] = {};

      // Add resolved entries: { uuid: name }
      for (const r of result) {
        const row = r as Record<string, any>;
        ref_data[entityCode][row.entity_instance_id as string] = row.entity_instance_name as string;
      }
    }
    // If no results found, DON'T add empty bucket - keeps ref_data clean
  }

  return ref_data;
}
```

### Phase 2: Backend - Update Route Files

**Affected Routes** (~26 files in `apps/api/src/modules/*/routes.ts`):

**Before (legacy pattern)**:
```typescript
// In GET /api/v1/project/:id
const project = await db.execute(sql`SELECT * FROM app.project...`);
const { _ID, _IDS } = await entityInfra.resolve_entity_references(project);

return reply.send({
  ...project,
  _ID,
  _IDS
});
```

**After (new ref_data pattern)**:
```typescript
// In GET /api/v1/project (list)
const projects = await db.execute(sql`SELECT * FROM app.project...`);
const ref_data = await entityInfra.build_ref_data(projects);

return reply.send({
  data: projects,  // Raw UUIDs only
  ref_data,        // Response-level lookup table
  metadata,
  total, limit, offset
});

// In GET /api/v1/project/:id (single)
const project = await db.execute(sql`SELECT * FROM app.project...`);
const ref_data = await entityInfra.build_ref_data([project]);

return reply.send({
  data: project,   // Raw UUIDs only
  ref_data,        // Response-level lookup table
  metadata
});
```

### Phase 3: Frontend - Add ref_data Resolution Utility

**New File**: `apps/web/src/lib/refDataResolver.ts`

```typescript
// ============================================================================
// ref_data Structure: { entity_code: { uuid: name } }
// ============================================================================
// Example:
// {
//   "employee": { "uuid-123": "James Miller", "uuid-456": "Sarah" },
//   "business": { "uuid-bus": "Huron Home Services" }
// }

export type RefData = Record<string, Record<string, string>>;

/**
 * Extract entity_code from field name using pattern matching
 *
 * Patterns:
 * - manager__employee_id → "employee"
 * - stakeholder__employee_ids → "employee"
 * - business_id → "business"
 * - tag_ids → "tag"
 */
export function extractEntityCode(fieldName: string): string | null {
  // Pattern 1: {label}__{entity}_id or {label}__{entity}_ids
  const labeledPattern = /^.+__([a-z_]+)_ids?$/;
  const labeledMatch = fieldName.match(labeledPattern);
  if (labeledMatch) return labeledMatch[1];

  // Pattern 2: {entity}_id or {entity}_ids (but not just "id")
  const simplePattern = /^([a-z_]+)_ids?$/;
  const simpleMatch = fieldName.match(simplePattern);
  if (simpleMatch && simpleMatch[1] !== '') return simpleMatch[1];

  return null;
}

/**
 * Resolve entity reference display name from ref_data
 *
 * @param ref_data - Response-level ref_data object { entity_code: { uuid: name } }
 * @param fieldName - Field name (e.g., "manager__employee_id")
 * @param uuid - UUID value from the data row
 * @returns Display name or empty string
 */
export function resolveRefName(
  ref_data: RefData | undefined,
  fieldName: string,
  uuid: string | null | undefined
): string {
  if (!ref_data || !uuid) return '';

  const entityCode = extractEntityCode(fieldName);
  if (!entityCode) return '';

  return ref_data[entityCode]?.[uuid] || '';
}

/**
 * Resolve multiple entity references (for _ids fields)
 */
export function resolveRefNames(
  ref_data: RefData | undefined,
  fieldName: string,
  uuids: string[] | null | undefined
): string[] {
  if (!ref_data || !uuids || uuids.length === 0) return [];

  const entityCode = extractEntityCode(fieldName);
  if (!entityCode) return [];

  return uuids
    .map(uuid => ref_data[entityCode]?.[uuid] || '')
    .filter(name => name !== '');
}

/**
 * Direct lookup when entity_code is already known
 * More efficient than extracting from field name
 */
export function resolveRefNameDirect(
  ref_data: RefData | undefined,
  entityCode: string,
  uuid: string | null | undefined
): string {
  if (!ref_data || !uuid) return '';
  return ref_data[entityCode]?.[uuid] || '';
}

/**
 * Get all UUIDs and names for an entity_code
 * Useful for building dropdown options from current data
 */
export function getRefEntriesForEntity(
  ref_data: RefData | undefined,
  entityCode: string
): Array<{ id: string; name: string }> {
  if (!ref_data || !ref_data[entityCode]) return [];

  return Object.entries(ref_data[entityCode]).map(([uuid, name]) => ({
    id: uuid,
    name
  }));
}
```

**Usage Example**:
```typescript
// In component
const { data, ref_data, metadata } = useEntityInstance('project', id);

// Single reference - extract entity_code from field name
const managerName = resolveRefName(ref_data, 'manager__employee_id', data.manager__employee_id);
// → "James Miller"

// Array reference
const stakeholderNames = resolveRefNames(ref_data, 'stakeholder__employee_ids', data.stakeholder__employee_ids);
// → ["Sarah", "Mike"]

// Direct lookup when entity_code is known (from metadata)
const businessName = resolveRefNameDirect(ref_data, 'business', data.business_id);
// → "Huron Home Services"
```

### Phase 4: Frontend - Update EntityFormContainer

**File**: [EntityFormContainer.tsx](apps/web/src/components/shared/entity/EntityFormContainer.tsx)

**Changes**:

1. **Accept ref_data as prop**:
```typescript
import { RefData, resolveRefName, resolveRefNames, extractEntityCode } from '@/lib/refDataResolver';

interface EntityFormContainerProps {
  data: Record<string, any>;
  ref_data?: RefData;  // { entity_code: { uuid: name } }
  metadata?: EntityMetadata;
  // ...
}
```

2. **View mode - resolve names from ref_data**:
```typescript
// For _id fields (single reference)
if (fieldName.endsWith('_id') && fieldName !== 'id') {
  const uuid = data[fieldName];
  const displayName = resolveRefName(ref_data, fieldName, uuid);
  if (displayName) {
    return <span className="text-gray-900">{displayName}</span>;
  }
  return <span className="text-gray-400">Not set</span>;
}

// For _ids fields (array reference)
if (fieldName.endsWith('_ids')) {
  const uuids = data[fieldName] as string[] | null;
  const displayNames = resolveRefNames(ref_data, fieldName, uuids);
  if (displayNames.length > 0) {
    return <TagList items={displayNames} />;
  }
  return <span className="text-gray-400">None</span>;
}
```

3. **Edit mode - EntitySelect with server-side search**:
```typescript
// For _id fields in edit mode
const editMeta = metadata?.editType?.[fieldName];
if (editMeta?.lookupSource === 'entityInstance') {
  const currentUuid = data[fieldName];
  const currentName = resolveRefName(ref_data, fieldName, currentUuid);

  return (
    <EntitySelect
      entityCode={editMeta.lookupEntity}
      value={currentUuid}
      displayValue={currentName}
      onChange={(newUuid) => handleFieldChange(fieldName, newUuid)}
      searchEnabled={true}  // Server-side search with pagination
    />
  );
}

// For _ids fields in edit mode
if (editMeta?.lookupSource === 'entityInstance' && fieldName.endsWith('_ids')) {
  const currentUuids = data[fieldName] as string[] | null;
  const entityCode = extractEntityCode(fieldName);

  return (
    <EntityMultiSelect
      entityCode={editMeta.lookupEntity}
      values={currentUuids || []}
      ref_data={ref_data}  // Pass for displaying current selections
      onChange={(newUuids) => handleFieldChange(fieldName, newUuids)}
    />
  );
}
```

### Phase 5: Frontend - Update React Query Hooks

**File**: [useEntityQuery.ts](apps/web/src/lib/hooks/useEntityQuery.ts)

**Update response type**:
```typescript
import { RefData } from '@/lib/refDataResolver';

// RefData = Record<string, Record<string, string>>
// { entity_code: { uuid: name } }

interface EntityListResponse<T> {
  data: T[];
  ref_data?: RefData;  // { entity_code: { uuid: name } }
  metadata?: EntityMetadata;
  total: number;
  limit: number;
  offset: number;
}

interface EntityInstanceResponse<T> {
  data: T;
  ref_data?: RefData;  // { entity_code: { uuid: name } }
  metadata?: EntityMetadata;
}
```

### Phase 6: Remove Legacy _ID/_IDS

**Backend** - Remove from routes:
1. Remove all calls to `resolve_entity_references()`
2. Replace with `build_ref_data()`
3. Remove `_ID` and `_IDS` spreading into data rows
4. Mark `resolve_entity_references()` as `@deprecated`

**Frontend** - Remove from components:
1. Remove all `_ID` and `_IDS` references
2. Use `ref_data` + `resolveRefName()` instead
3. Update EntityDataTable to use ref_data for rendering
4. Update EntityDetailView to use ref_data for rendering

---

## Summary: Final Response Structure

```json
{
  "data": [
    {
      "id": "proj-123",
      "name": "Kitchen Renovation",
      "code": "PROJ-001",
      "manager__employee_id": "emp-uuid-123",
      "business_id": "bus-uuid-456",
      "stakeholder__employee_ids": ["emp-uuid-789", "emp-uuid-012"],
      "dl__project_stage": "planning",
      "budget_allocated_amt": 50000,
      "active_flag": true
    }
  ],
  "ref_data": {
    "employee": {
      "emp-uuid-123": "James Miller",
      "emp-uuid-789": "Sarah Johnson",
      "emp-uuid-012": "Michael Chen"
    },
    "business": {
      "bus-uuid-456": "Huron Home Services"
    }
  },
  "metadata": {
    "entity": "project",
    "fields": [ /* field metadata */ ]
  },
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

**Benefits of Grouped Object Structure**:
1. **O(1) Lookup** - Direct access: `ref_data[entityCode][uuid]`
2. **Organized** - Grouped by entity type for easy debugging
3. **Deduplicated** - Each UUID appears once per entity_code
4. **Simple Values** - Just `uuid: name` mapping, no wrapper object
5. **Minimal Payload** - No repeated `entity_code` per entry
6. **Only found data** - No empty buckets, only entity_codes with resolved UUIDs from the query result

---

## Component Interaction Diagram (v3.1.0 - ref_data Pattern)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPONENT HIERARCHY & DATA FLOW (ref_data)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  EntitySpecificInstancePage                                                   │
│  ├── useEntityInstance('project', id)                                        │
│  │   └── Returns: { data, ref_data, metadata }                               │
│  │       data: { manager__employee_id: "uuid-123", ... }  ← Raw UUIDs only   │
│  │       ref_data: { "employee": { "uuid-123": "James Miller" } }            │
│  │       metadata: { entityFormContainer: { viewType, editType } }           │
│  │                                                                            │
│  ├── [editedData, setEditedData] = useState(data)                            │
│  │                                                                            │
│  └── EntityFormContainer                                                     │
│      ├── Props: { data, ref_data, metadata, isEditing, onChange }            │
│      │                                                                        │
│      ├── FIELD GENERATION (from metadata.entityFormContainer.editType)       │
│      │   ├── Regular fields → DebouncedInput, select, etc.                   │
│      │   └── Entity ref fields (lookupSource: 'entityInstance') → EntitySelect│
│      │                                                                        │
│      ├── VIEW MODE                                                            │
│      │   ├── Regular fields: Show value from data[key]                       │
│      │   └── Entity refs: resolveRefName(ref_data, fieldName, uuid)          │
│      │       Example: ref_data["employee"]["uuid-123"] → "James Miller"      │
│      │                                                                        │
│      └── EDIT MODE                                                            │
│          ├── Regular fields: Input from editType                             │
│          └── Entity refs: EntitySelect with useEntityLookup                  │
│                  │                                                            │
│                  └── EntitySelect                                             │
│                      ├── useEntityLookup(entityCode)                         │
│                      │   └── React Query: GET /api/v1/entity/{code}/entity-instance-lookup│
│                      │       Cache: 1 hour TTL (Reference Data tier)         │
│                      │                                                        │
│                      └── onChange(newUuid)                                   │
│                          └── Parent updates: data[manager__employee_id] = newUuid│
│                              (ref_data refreshed on save via invalidation)   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

### Phase 1: Backend

| File | Changes | Priority |
|------|---------|----------|
| `entity-infrastructure.service.ts` | Add `build_ref_data()` method | High |
| `apps/api/src/modules/*/routes.ts` | Return `ref_data` in response, remove `_ID`/`_IDS` | High |

### Phase 2: Frontend

| File | Changes | Priority |
|------|---------|----------|
| `useEntityQuery.ts` | Add `queryKeys.refData`, `CACHE_TTL.REF_DATA_*` | High |
| `useRefData.ts` (new) | Create React Query hook for ref_data | High |
| `refDataResolver.ts` (new) | Utility functions for ref_data lookup | High |
| `EntityFormContainer.tsx` | Use `ref_data` for view mode, EntitySelect for edit | High |
| `EntityDataTable.tsx` | Use `ref_data` for displaying entity references | High |
| `EntitySpecificInstancePage.tsx` | Pass `ref_data` to children | Medium |

---

## Testing Checklist

- [ ] View mode: Entity reference shows resolved name (not UUID)
- [ ] View mode: UUID fields are hidden
- [ ] Edit mode: EntitySelect appears for single references (_ID)
- [ ] Edit mode: EntityMultiSelectTags appears for array references (_IDS)
- [ ] Edit mode: Search works in dropdown
- [ ] Edit mode: Options cached (no re-fetch on toggle edit)
- [ ] Save: Only UUID sent to backend (not names)
- [ ] Save: _ID/_IDS stripped from PATCH payload
- [ ] After save: Fresh data loaded with new resolved name

---

## Standards Compliance

| Standard | Compliance |
|----------|------------|
| STATE_MANAGEMENT.md | ✅ React Query for data, Zustand for UI state |
| backend-formatter.service.md | ✅ Uses editType.lookupSource/lookupEntity |
| EntityFormContainer.md | ✅ Uses extractViewType/extractEditType |
| EntityDataTable.md | ✅ FormattedRow pattern for display |

---

## Summary

This implementation:
1. **Leverages existing infrastructure** - EntitySelect, useEntityLookup already work correctly
2. **Follows format-at-read pattern** - Raw UUIDs cached, names resolved via _ID/_IDS
3. **Maintains single source of truth** - Backend resolves names, frontend just displays
4. **Clean separation** - UUID for storage, name for display
5. **Optimal caching** - Entity lookups cached 15 min via React Query

The key insight is that the backend already does the heavy lifting by returning `_ID` and `_IDS`. The frontend just needs to:
1. Display from `_ID` in view mode
2. Use `EntitySelect` with the existing `useEntityLookup` hook in edit mode
3. Only send UUID fields on save

---
---

# PART 2: Next-Generation Architecture Recommendations

**Industry Standards Research Date**: 2025-11-26

Based on research into modern patterns from [Apollo GraphQL](https://www.apollographql.com/blog/demystifying-cache-normalization), [Relay](https://relay.dev/docs/guided-tour/rendering/fragments/), [TanStack Query patterns](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query), and [TypeScript discriminated unions](https://dev.to/aarav_pradhan/building-type-safe-entity-management-with-typescript-discriminated-unions-3o6g), here are recommendations to make this implementation truly next-generation.

---

## Current vs Next-Gen Comparison

| Aspect | Current Plan | Next-Gen Recommendation |
|--------|-------------|------------------------|
| **Caching** | Query-centric (full response) | Normalized entity cache |
| **Type Safety** | Implicit _ID/_IDS structure | Discriminated unions with exhaustive checking |
| **Updates** | Invalidate & refetch | Optimistic UI with rollback |
| **Data Fetching** | Eager load all options | Virtual/infinite scroll with server-side search |
| **Architecture** | Component-driven queries | Fragment colocation (Relay-style) |
| **State** | Local component state | Derived state from normalized cache |

---

## 1. Normalized Entity Cache (Future Consideration - NOT for v8.3.0)

> **NOTE**: This section describes a FUTURE architecture pattern. For v8.3.0, we use React Query as the sole data cache. Zustand is used ONLY for metadata stores (datalabels, entity types, component metadata). DO NOT implement a Zustand-based normalized entity store.

### Why NOT Now?

| Concern | Decision |
|---------|----------|
| **Architecture Consistency** | v8.0.0+ established React Query as sole data cache |
| **Zustand Role** | Metadata stores only (STATE_MANAGEMENT.md v8.2.0) |
| **Complexity** | Normalized cache adds significant complexity |
| **React Query Built-in** | React Query already handles most cache staleness issues |

### When to Revisit

Consider normalized caching if:
- Entity name changes cause widespread UI staleness
- Performance profiling shows redundant fetches
- GraphQL migration is planned (Apollo has built-in normalization)

**Source**: [Demystifying Cache Normalization | Apollo GraphQL](https://www.apollographql.com/blog/demystifying-cache-normalization)

---

## 2. TypeScript Discriminated Unions for Type Safety

### Problem with Current Approach
```typescript
// Current: Loose typing
interface EntityData {
  _ID?: Record<string, any>;    // What's in here? Unknown at compile time
  _IDS?: Record<string, any[]>; // No autocompletion, easy to misspell
}
```

### Next-Gen: Discriminated Unions with Exhaustive Checking
```typescript
// types/entityReference.ts

// Single reference with discriminator
interface SingleEntityReference {
  type: 'single';
  entity_code: string;
  uuid_field: string;  // 'manager__employee_id'
  uuid: string;
  label_field: string; // 'manager'
  label: string;       // 'James Miller'
}

// Array reference with discriminator
interface ArrayEntityReference {
  type: 'array';
  entity_code: string;
  uuid_field: string;  // 'stakeholder__employee_ids'
  items: Array<{
    uuid: string;
    label: string;
  }>;
}

// Discriminated union
type EntityReference = SingleEntityReference | ArrayEntityReference;

// Type guard for exhaustive checking
function isSingleRef(ref: EntityReference): ref is SingleEntityReference {
  return ref.type === 'single';
}

// Usage with exhaustive switch
function renderReference(ref: EntityReference): React.ReactNode {
  switch (ref.type) {
    case 'single':
      return <span>{ref.label}</span>;
    case 'array':
      return <TagList items={ref.items.map(i => i.label)} />;
    default:
      // TypeScript error if new type added but not handled
      const _exhaustive: never = ref;
      return null;
  }
}

// Backend response with proper types
interface ProjectData {
  id: string;
  name: string;
  manager__employee_id: string;
  _refs: {
    manager: SingleEntityReference;
    stakeholders: ArrayEntityReference;
  };
}
```

**Benefits**:
- Compile-time errors if you access wrong fields
- Autocompletion for ref.label, ref.uuid
- Exhaustive checking catches missing cases
- Self-documenting code

**Source**: [Building Type-Safe Entity Management with TypeScript Discriminated Unions](https://dev.to/aarav_pradhan/building-type-safe-entity-management-with-typescript-discriminated-unions-3o6g)

---

## 3. Optimistic UI Updates with Rollback

### Problem with Current Approach
```
Current: Save → Wait for response → Invalidate → Refetch → Update UI
User perceives: 500-1500ms delay after clicking save
```

### Next-Gen: Optimistic Update Pattern
```typescript
// hooks/useOptimisticEntityUpdate.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOptimistic } from 'react'; // React 19

export function useOptimisticEntityUpdate<T extends { id: string }>(
  entityCode: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<T> & { id: string }) =>
      api.patch(`/api/v1/${entityCode}/${updates.id}`, updates),

    // OPTIMISTIC UPDATE: Immediately update cache
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['entity-instance', entityCode, newData.id]
      });

      // Snapshot current value for rollback
      const previousData = queryClient.getQueryData<T>(
        ['entity-instance', entityCode, newData.id]
      );

      // Optimistically update cache
      queryClient.setQueryData(
        ['entity-instance', entityCode, newData.id],
        (old: T | undefined) => old ? { ...old, ...newData } : old
      );

      // Return snapshot for rollback
      return { previousData };
    },

    // ROLLBACK: Restore on error
    onError: (err, newData, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          ['entity-instance', entityCode, newData.id],
          context.previousData
        );
      }
      toast.error('Failed to save. Changes reverted.');
    },

    // SETTLE: Sync with server on success or error
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['entity-instance', entityCode, variables.id]
      });
    }
  });
}

// Usage in component
function EntityForm({ data }: { data: ProjectData }) {
  const updateMutation = useOptimisticEntityUpdate<ProjectData>('project');

  const handleManagerChange = (newUuid: string, newLabel: string) => {
    // UI updates INSTANTLY, rollback on failure
    updateMutation.mutate({
      id: data.id,
      manager__employee_id: newUuid,
      // Update _refs for immediate display
      _refs: {
        ...data._refs,
        manager: { ...data._refs.manager, uuid: newUuid, label: newLabel }
      }
    });
  };
}
```

**Benefits**:
- Instant UI feedback (perceived 0ms)
- Automatic rollback on failure
- User trust ("save worked immediately")
- Concurrent updates handled correctly

**Source**: [Concurrent Optimistic Updates in React Query | TkDodo's Blog](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)

---

## 4. Virtual Scrolling & Server-Side Search

### Problem with Current Approach
```
Current: Load ALL 500 employees into dropdown at once
- 500 items × ~200 bytes = 100KB payload
- All 500 rendered in DOM (even if hidden)
- User must wait for full load before searching
```

### Next-Gen: Virtual + Server-Side Search
```typescript
// components/EntitySelectVirtual.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface Props {
  entityCode: string;
  value: string | null;
  onChange: (uuid: string, label: string) => void;
}

export function EntitySelectVirtual({ entityCode, value, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // Infinite query with server-side search
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['entity-lookup-infinite', entityCode, debouncedSearch],
    queryFn: ({ pageParam = 0 }) =>
      api.get(`/api/v1/entity/${entityCode}/entity-instance-lookup`, {
        params: {
          search: debouncedSearch,
          limit: 50,
          offset: pageParam * 50
        }
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.data.length === 50 ? pages.length : undefined,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const allItems = data?.pages.flatMap(p => p.data) ?? [];

  // Virtual scrolling - only renders visible items
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: hasNextPage ? allItems.length + 1 : allItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // 40px per row
    overscan: 5,
  });

  // Load more when scrolling near bottom
  useEffect(() => {
    const [lastItem] = [...virtualizer.getVirtualItems()].reverse();
    if (!lastItem) return;

    if (
      lastItem.index >= allItems.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), hasNextPage, fetchNextPage, allItems.length]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">{/* selected value */}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
          />
          <div ref={parentRef} className="h-[300px] overflow-auto">
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = allItems[virtualRow.index];
                if (!item) return <LoadingRow key="loading" />;

                return (
                  <CommandItem
                    key={item.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onSelect={() => onChange(item.id, item.name)}
                  >
                    {item.name}
                  </CommandItem>
                );
              })}
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Benefits**:
- Initial load: 50 items instead of 500 (10x faster)
- DOM: Only ~15 items rendered (20x fewer DOM nodes)
- Search: Server-side = faster + more accurate
- Infinite scroll: Load more only when needed
- Memory: Constant regardless of total items

**Libraries**: [@tanstack/react-virtual](https://tanstack.com/virtual/latest)

---

## 5. Fragment Colocation (Relay Pattern)

### Problem with Current Approach
```
Current: EntityFormContainer has implicit dependency on _ID/_IDS structure
- If backend changes _ID format, component breaks silently
- No explicit contract between component and data requirements
```

### Next-Gen: Fragment Colocation
```typescript
// Each component explicitly declares its data requirements
// Similar to Relay's fragment colocation pattern

// EntityReferenceField.fragment.ts
export const ENTITY_REFERENCE_FIELD_FRAGMENT = {
  // Declare exactly what this component needs
  fields: ['_refs'] as const,
  refs: {
    single: ['type', 'entity_code', 'uuid', 'label'] as const,
    array: ['type', 'entity_code', 'items'] as const,
  }
};

// Type generated from fragment
type EntityReferenceData = {
  _refs: Record<string, {
    type: 'single' | 'array';
    entity_code: string;
    uuid?: string;
    label?: string;
    items?: Array<{ uuid: string; label: string }>;
  }>;
};

// Component with explicit data dependency
interface EntityReferenceFieldProps {
  fieldKey: string;
  data: EntityReferenceData;  // Typed from fragment
  onChange: (uuid: string, label: string) => void;
}

export function EntityReferenceField({ fieldKey, data, onChange }: EntityReferenceFieldProps) {
  const ref = data._refs[fieldKey];
  // TypeScript knows exactly what's available
}

// Parent component composes fragments
function EntityFormContainer({ data }: { data: ProjectData }) {
  // TypeScript ensures data satisfies EntityReferenceField's fragment
  return (
    <EntityReferenceField
      fieldKey="manager"
      data={data}  // Must have _refs.manager
      onChange={handleChange}
    />
  );
}
```

**Benefits**:
- Explicit data contracts (no implicit dependencies)
- TypeScript catches missing data at compile time
- Self-documenting (fragment = documentation)
- Enables future GraphQL migration

**Source**: [Fragments | Relay](https://relay.dev/docs/guided-tour/rendering/fragments/)

---

## 6. Architecture Diagram: Next-Gen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NEXT-GEN ENTITY REFERENCE ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                         NORMALIZED CACHE LAYER                        │     │
│  │                                                                       │     │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │     │
│  │  │ Project:abc   │  │ Employee:emp1 │  │ Employee:emp2 │            │     │
│  │  │ manager: →────┼──┤ name: James   │  │ name: Mike    │            │     │
│  │  │ stakeholders: │  └───────────────┘  └───────────────┘            │     │
│  │  │   [→, →]──────┼────────────────────────────┘                     │     │
│  │  └───────────────┘                                                   │     │
│  │                                                                       │     │
│  │  Benefits:                                                            │     │
│  │  • Single source of truth (update once, propagates everywhere)       │     │
│  │  • Automatic consistency across views                                 │     │
│  │  • Smaller memory footprint (no duplication)                         │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                    TYPE-SAFE REFERENCE LAYER                          │     │
│  │                                                                       │     │
│  │  Discriminated Union:                                                 │     │
│  │  ┌─────────────────────────────────────────────────────────────────┐│     │
│  │  │ type EntityRef = SingleRef | ArrayRef                            ││     │
│  │  │                                                                   ││     │
│  │  │ SingleRef { type: 'single', uuid, label, entity_code }          ││     │
│  │  │ ArrayRef  { type: 'array', items: [{uuid, label}], entity_code }││     │
│  │  └─────────────────────────────────────────────────────────────────┘│     │
│  │                                                                       │     │
│  │  Benefits:                                                            │     │
│  │  • Compile-time type checking                                        │     │
│  │  • Exhaustive switch/case handling                                   │     │
│  │  • IDE autocompletion                                                │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                    OPTIMISTIC UPDATE LAYER                            │     │
│  │                                                                       │     │
│  │  User Action → Optimistic Cache Update → API Call → Settle/Rollback  │     │
│  │       │              │                       │              │         │     │
│  │       │              ▼                       │              │         │     │
│  │       │        UI Updates                    │              │         │     │
│  │       │        Instantly!                    │              │         │     │
│  │       │              │                       ▼              │         │     │
│  │       │              │                   Success?           │         │     │
│  │       │              │                    │    │            │         │     │
│  │       │              │                  Yes    No           │         │     │
│  │       │              │                    │    │            │         │     │
│  │       │              │              Refetch  Rollback       │         │     │
│  │       │              │                    │    │            │         │     │
│  │       │              └────────────────────┴────┘            │         │     │
│  │                                                                       │     │
│  │  Benefits:                                                            │     │
│  │  • 0ms perceived latency                                             │     │
│  │  • Automatic error recovery                                          │     │
│  │  • No loading spinners for simple updates                            │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                    VIRTUAL + SERVER-SIDE SEARCH                       │     │
│  │                                                                       │     │
│  │  ┌─────────────────────────────────────────────────────────────────┐│     │
│  │  │ Search: [Jam________________]                                    ││     │
│  │  │ ┌─────────────────────────────────────────────────────────────┐ ││     │
│  │  │ │ ✓ James Miller          ← Rendered (visible)                │ ││     │
│  │  │ │   James Wilson          ← Rendered (visible)                │ ││     │
│  │  │ │   James Brown           ← Rendered (buffer)                 │ ││     │
│  │  │ │   ░░░░░░░░░░░░          ← NOT rendered (virtualized)        │ ││     │
│  │  │ │   ░░░░░░░░░░░░          ← NOT rendered (not loaded yet)     │ ││     │
│  │  │ └─────────────────────────────────────────────────────────────┘ ││     │
│  │  └─────────────────────────────────────────────────────────────────┘│     │
│  │                                                                       │     │
│  │  Benefits:                                                            │     │
│  │  • Initial load: 50 items vs 500 (10x faster)                        │     │
│  │  • DOM nodes: ~15 vs 500 (33x fewer)                                 │     │
│  │  • Search: Server-side (handles 10,000+ records)                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Migration Path: Current → Next-Gen

### Phase 1: Type Safety (Low Risk, High Value)
```
Week 1-2:
- Define EntityReference discriminated union types
- Add type guards for _ID/_IDS
- Update EntityFormContainer with proper types
- Add exhaustive checking

Risk: Low (types only, no runtime changes)
Value: Immediate compile-time error catching
```

### Phase 2: Optimistic Updates (Medium Risk, High Value)
```
Week 3-4:
- Create useOptimisticEntityUpdate hook
- Update save handlers to use optimistic pattern
- Add rollback UI (toast notifications)
- Test failure scenarios

Risk: Medium (changes mutation flow)
Value: Major UX improvement (perceived instant saves)
```

### Phase 3: Virtual Scrolling (Medium Risk, Medium Value)
```
Week 5-6:
- Add @tanstack/react-virtual
- Create EntitySelectVirtual component
- Add server-side search endpoint
- Migrate large dropdowns (employee, customer, etc.)

Risk: Medium (new component, API changes)
Value: Performance for large datasets
```

### Phase 4: Normalized Cache (DEFERRED - Not for v8.3.0)
```
DEFERRED: This phase conflicts with v8.0.0+ architecture decisions.

React Query is the sole data cache. Zustand is for metadata only.
Revisit normalized caching only if:
- Entity name staleness becomes a significant UX issue
- GraphQL migration is planned (Apollo has built-in normalization)
```

---

## 8. Decision Matrix (Updated for v8.3.0)

| Enhancement | Effort | Risk | Value | Recommendation |
|-------------|--------|------|-------|----------------|
| TypeScript Discriminated Unions | Low | Low | High | **DO NOW** |
| Optimistic Updates | Medium | Medium | High | **DO NOW** |
| Virtual Scrolling | Medium | Medium | Medium | Do if >100 items |
| Server-Side Search | Medium | Low | Medium | Do if >500 items |
| Normalized Cache (Zustand) | High | High | Medium | **DEFERRED** - conflicts with v8.0.0 architecture |
| Fragment Colocation | Medium | Low | Medium | Do with GraphQL |

> **Architecture Note**: Zustand is for **metadata stores only** (datalabels, entity types, component metadata). Entity data caching uses React Query exclusively per STATE_MANAGEMENT.md v8.2.0.

---

## 9. Recommended Immediate Changes to Current Plan

Based on industry standards, add these to the current implementation:

### A. Add Type Safety (no extra effort, huge value)
```typescript
// types/entityReference.ts
export interface SingleEntityRef {
  type: 'single';
  entity_code: string;
  uuid_field: string;
  uuid: string;
  label_field: string;
  label: string;
}

export interface ArrayEntityRef {
  type: 'array';
  entity_code: string;
  uuid_field: string;
  items: Array<{ uuid: string; label: string }>;
}

export type EntityRef = SingleEntityRef | ArrayEntityRef;

// Backend should add `type` discriminator to _ID/_IDS entries
```

### B. Add Optimistic Update Hook (medium effort, huge UX improvement)
```typescript
// Use in save handlers
const { mutate, isPending, isError } = useOptimisticEntityUpdate('project');

// Save is now instant with automatic rollback
mutate({ id, manager__employee_id: newUuid });
```

### C. Add Virtualization to EntitySelect (if >100 employees)
```typescript
// Replace current eager-load with virtual + infinite scroll
<EntitySelectVirtual
  entityCode="employee"
  value={data.manager__employee_id}
  onChange={handleChange}
/>
```

---

## Sources

- [Demystifying Cache Normalization | Apollo GraphQL](https://www.apollographql.com/blog/demystifying-cache-normalization)
- [Fragments | Relay](https://relay.dev/docs/guided-tour/rendering/fragments/)
- [Concurrent Optimistic Updates in React Query | TkDodo's Blog](https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query)
- [useOptimistic | React Docs](https://react.dev/reference/react/useOptimistic)
- [Optimistic Updates | TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [Building Type-Safe Entity Management with TypeScript Discriminated Unions](https://dev.to/aarav_pradhan/building-type-safe-entity-management-with-typescript-discriminated-unions-3o6g)
- [Patterns for lists and their individual entities | TanStack Query](https://github.com/TanStack/query/discussions/3237)
- [GraphQL Fragments Best Practices | Hygraph](https://hygraph.com/learn/graphql/fragments)

---
---

# PART 3: ref_data React Query Caching Strategy

**Date**: 2025-11-26
**Version**: 8.3.0
**Pattern**: React Query Only (No Zustand for ref_data)

---

## Cache Population Strategy (SINGLE SOURCE)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CACHE POPULATION: SINGLE SOURCE OF TRUTH                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  PRIMARY SOURCE: API response includes ref_data                               │
│  ═══════════════════════════════════════════════                             │
│                                                                               │
│  GET /api/v1/project → { data, ref_data, metadata }                          │
│                              │                                                │
│                              ▼                                                │
│  React Query caches ref_data alongside entity data                           │
│  queryKey: ['entity-instance', 'project', id]                                │
│  data: { data: {...}, ref_data: {...}, metadata: {...} }                     │
│                                                                               │
│  ─────────────────────────────────────────────────────────────────────────   │
│                                                                               │
│  SECONDARY SOURCE: useRefData hook (for EDIT mode dropdowns)                 │
│  ════════════════════════════════════════════════════════════                │
│                                                                               │
│  EntitySelect needs FULL list of options (not just current selection)        │
│  useRefData('employee') → GET /entity-instance-lookup?limit=1000             │
│                                                                               │
│  queryKey: ['ref-data', 'employee']                                          │
│  data: { "uuid-1": "James", "uuid-2": "Sarah", ... }  ← ALL employees        │
│                                                                               │
│  ─────────────────────────────────────────────────────────────────────────   │
│                                                                               │
│  KEY INSIGHT: These are DIFFERENT caches with DIFFERENT purposes             │
│  ════════════════════════════════════════════════════════════════            │
│                                                                               │
│  1. Entity response ref_data → Resolve UUIDs in CURRENT data (view mode)     │
│     - Only contains UUIDs from the query result                              │
│     - Cached as part of entity response                                      │
│                                                                               │
│  2. useRefData cache → Populate DROPDOWN options (edit mode)                 │
│     - Contains ALL active entities of that type                              │
│     - Separate cache with 1 hour TTL                                         │
│                                                                               │
│  NO MERGING between caches - each serves its purpose independently           │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Overview

ref_data caching uses **Pure React Query** - no Zustand stores. Component asks React Query for data, React Query handles cache check and API fetch if needed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REF_DATA ARCHITECTURE (Component-First)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  COMPONENT USAGE (Simple!)                                                    │
│  ─────────────────────────                                                    │
│                                                                               │
│  // Component just asks for ref_data - like useDatalabelMetadata              │
│  const { data: employeeRefData } = useRefData('employee');                    │
│  const managerName = employeeRefData?.[uuid] || '';                           │
│                                                                               │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                               │
│  REACT QUERY CACHE (Sole Data Cache)                                          │
│  ─────────────────────────────────────                                        │
│                                                                               │
│  queryKey: ['ref-data', 'employee']                                           │
│  data: { "uuid-123": "James", "uuid-456": "Sarah", ... }                      │
│  TTL: 1 hour stale, 2 hour GC (Reference Data tier)                           │
│                                                                               │
│  queryKey: ['ref-data', 'business']                                           │
│  data: { "uuid-bus": "Huron Home", ... }                                      │
│                                                                               │
│  ═══════════════════════════════════════════════════════════════════════════ │
│                                                                               │
│  CACHE FLOW                                                                   │
│  ──────────                                                                   │
│                                                                               │
│  useRefData('employee')                                                       │
│       │                                                                       │
│       ├── Cache HIT (fresh) → Return immediately                              │
│       ├── Cache HIT (stale) → Return + refetch in background                  │
│       └── Cache MISS → Fetch /api/v1/entity/employee/entity-instance-lookup   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why This Pattern?

| Benefit | Description |
|---------|-------------|
| **Single Source of Truth** | React Query only - no Zustand sync issues |
| **Stale-While-Revalidate** | React Query handles TTL automatically |
| **Consistent** | Same pattern as useDatalabelMetadata |
| **DevTools** | All ref_data visible in React Query DevTools |
| **Auto GC** | Unused cache entries cleaned up automatically |

---

## Implementation Plan

### Step 1: Add Query Keys for ref_data

**File**: `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
// Add to existing queryKeys factory
export const queryKeys = {
  // ... existing keys
  entityCodes: () => ['entity-codes'] as const,
  entityMetadata: (entityCode: string) => ['entity-metadata', entityCode] as const,
  entityInstanceList: (entityCode: string, params?: Record<string, any>) =>
    ['entity-instance-list', entityCode, params] as const,
  entityInstance: (entityCode: string, id: string) =>
    ['entity-instance', entityCode, id] as const,

  // ✅ NEW: ref_data cache per entity_code
  refData: (entityCode: string) => ['ref-data', entityCode] as const,
};

// Add TTL for ref_data (Reference Data tier)
export const CACHE_TTL = {
  // ... existing TTLs
  REF_DATA_STALE: 60 * 60 * 1000,  // 1 hour stale time
  REF_DATA_CACHE: 2 * 60 * 60 * 1000,  // 2 hours cache time (GC)
};
```

---

### Step 2: Create useRefData Hook (Pure React Query - Simple Pattern)

**File**: `apps/web/src/lib/hooks/useRefData.ts`

```typescript
/**
 * useRefData - Simple React Query hook for ref_data access
 *
 * Works exactly like useDatalabelMetadata - component just asks for data,
 * React Query handles cache check and fetch if needed.
 *
 * @example
 * // Component usage (simple!)
 * const { data: employeeRefData, isLoading } = useRefData('employee');
 * const managerName = employeeRefData?.[uuid] || '';
 *
 * // Multiple lookups in same component
 * const { data: businessRefData } = useRefData('business');
 * const businessName = businessRefData?.[businessId] || '';
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { queryKeys, CACHE_TTL } from './useEntityQuery';

// Type for ref_data cache: { uuid: name }
export type RefDataCache = Record<string, string>;

// Type for API response ref_data: { entity_code: { uuid: name } }
export type RefData = Record<string, Record<string, string>>;

// ============================================================================
// MAIN HOOK: useRefData (like useDatalabelMetadata)
// ============================================================================

/**
 * Simple React Query hook for entity reference data
 *
 * Pattern: Component-first (like useDatalabelMetadata)
 * - Component calls useRefData('employee')
 * - React Query checks cache ['ref-data', 'employee']
 * - If cache miss: fetch from /api/v1/entity/employee/entity-instance-lookup
 * - Component does simple lookup: refData?.[uuid]
 *
 * @param entityCode - Entity type to fetch ref_data for (e.g., 'employee', 'business')
 * @returns { data: { uuid: name }, isLoading, error }
 */
export function useRefData(entityCode: string | null) {
  return useQuery({
    queryKey: queryKeys.refData(entityCode || ''),
    queryFn: async () => {
      // Fetch all entity instances for this entity_code
      const response = await apiClient.get(
        `/api/v1/entity/${entityCode}/entity-instance-lookup`,
        { params: { active_only: true, limit: 1000 } }
      );

      // Transform to { uuid: name } format
      const result: RefDataCache = {};
      (response.data.data || []).forEach((item: { id: string; name: string }) => {
        result[item.id] = item.name;
      });

      return result;
    },
    enabled: !!entityCode,
    staleTime: CACHE_TTL.REF_DATA_STALE,  // 1 hour
    gcTime: CACHE_TTL.REF_DATA_CACHE,     // 2 hours
  });
}

// ============================================================================
// NOTE: No upsert/merge between caches
// ============================================================================
//
// ref_data from API response is cached AS PART OF the entity response.
// useRefData fetches separately for dropdown population.
// These are SEPARATE caches - no merging needed.
//

// ============================================================================
// UTILITY: Extract entity_code from field name
// ============================================================================

/**
 * Extract entity_code from field name
 *
 * Patterns:
 * - manager__employee_id → "employee"
 * - stakeholder__employee_ids → "employee"
 * - business_id → "business"
 * - tag_ids → "tag"
 */
export function extractEntityCode(fieldName: string): string | null {
  // Pattern 1: {label}__{entity}_id or {label}__{entity}_ids
  const labeledPattern = /^.+__([a-z_]+)_ids?$/;
  const labeledMatch = fieldName.match(labeledPattern);
  if (labeledMatch) return labeledMatch[1];

  // Pattern 2: {entity}_id or {entity}_ids (but not just "id")
  const simplePattern = /^([a-z_]+)_ids?$/;
  const simpleMatch = fieldName.match(simplePattern);
  if (simpleMatch && simpleMatch[1] !== '') return simpleMatch[1];

  return null;
}
```

---

### Step 3: CRUD Cache Sync (Keep ref_data Fresh)

**File**: `apps/web/src/lib/hooks/useEntityQuery.ts`

```typescript
// CREATE: Add new entity to ref_data cache
onSuccess: (response) => {
  if (response?.id && response?.name) {
    queryClient.setQueryData(queryKeys.refData(entityCode), (old) => ({
      ...old,
      [response.id]: response.name,
    }));
  }
},

// UPDATE: Update name in ref_data cache
onSuccess: (response, { id, data }) => {
  if (data.name) {
    queryClient.setQueryData(queryKeys.refData(entityCode), (old) => ({
      ...old,
      [id]: data.name,
    }));
  }
},

// DELETE: Remove from ref_data cache
onSuccess: (_data, id) => {
  queryClient.setQueryData(queryKeys.refData(entityCode), (old) => {
    if (!old) return old;
    const { [id]: removed, ...rest } = old;
    return rest;
  });
},
```

---

### Step 4: Logout (No Changes Needed)

`queryClient.clear()` automatically clears all ref_data cache.

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REF_DATA CACHING SUMMARY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  COMPONENT USAGE                                                              │
│  ───────────────                                                              │
│  const { data: refData } = useRefData('employee');                            │
│  const name = refData?.[uuid] || '';                                          │
│                                                                               │
│  CACHE KEY                                                                    │
│  ─────────                                                                    │
│  ['ref-data', entityCode] → { uuid: name, ... }                               │
│                                                                               │
│  TTL                                                                          │
│  ───                                                                          │
│  Stale: 1 hour | GC: 2 hours                                                  │
│                                                                               │
│  CACHE POPULATION                                                             │
│  ────────────────                                                             │
│  1. Cache MISS → useRefData fetches /entity-instance-lookup                   │
│  2. API Response (optional) → upsertRefDataToCache()                          │
│  3. CRUD mutations → setQueryData()                                           │
│                                                                               │
│  INVALIDATION                                                                 │
│  ────────────                                                                 │
│  - CRUD: Auto-updated via setQueryData                                        │
│  - Manual: queryClient.invalidateQueries(['ref-data', entityCode])            │
│  - Logout: queryClient.clear()                                                │
│                                                                               │
│  FILES                                                                        │
│  ─────                                                                        │
│  lib/hooks/useRefData.ts → useRefData(), upsertRefDataToCache()               │
│  lib/hooks/useEntityQuery.ts → queryKeys.refData, CACHE_TTL                   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Standards Compliance

| Standard | Compliance |
|----------|------------|
| STATE_MANAGEMENT.md | ✅ React Query is sole data cache |
| Format-at-Read (v8.0.0) | ✅ Raw UUIDs in cache, names resolved on read |
| TTL Tiers | ✅ Reference data tier (1h stale, 2h GC) |
| Pattern | ✅ Component-first (like useDatalabelMetadata) |
