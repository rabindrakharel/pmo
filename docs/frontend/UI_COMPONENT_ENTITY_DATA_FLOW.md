# UI Component & Entity Data Container - Complete Behavior Flow

**Version**: 1.0.0
**Date**: 2025-01-18
**Status**: ✅ Production Ready

## Overview

This document describes the complete data flow from database to UI components, focusing on how UUID reference fields are automatically resolved to human-readable names and displayed in tables and forms.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATABASE LAYER                              │
│  PostgreSQL 14+ with 50 tables                                      │
│                                                                      │
│  CREATE TABLE app.project (                                       │
│    id uuid PRIMARY KEY,                                             │
│    name text,                                                       │
│    manager__employee_id uuid,           ← Raw UUID                  │
│    sponsor__employee_id uuid,           ← Raw UUID                  │
│    stakeholder__employee_ids uuid[]     ← Raw UUID Array            │
│  );                                                                 │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ SQL Query
                         ↓
┌─────────────────────────────────────────────────────────────────────┐
│                          API ROUTE LAYER                             │
│  apps/api/src/modules/project/routes.ts                             │
│                                                                      │
│  fastify.get('/api/v1/project/:id', async (request, reply) => {    │
│    // STEP 1: Query database                                       │
│    const project = await db.execute(sql`SELECT * FROM app.project`)  │
│    // Result: { manager__employee_id: "uuid-123", ... }            │
│                                                                      │
│    // STEP 2: Resolve UUID references (CRITICAL!)                  │
│    const enriched = await entityInfra.resolve_entity_references(   │
│      project                                                        │
│    );                                                               │
│    // Result: {                                                     │
│    //   manager__employee_id: "uuid-123",                          │
│    //   manager: "James Miller",                                   │
│    //   stakeholder: [...]                                         │
│    // }                                                             │
│                                                                      │
│    // STEP 3: Return enriched data                                 │
│    return reply.send(enriched);                                     │
│  });                                                                │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ HTTP Response (JSON)
                         ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    ENTITY INFRASTRUCTURE SERVICE                     │
│  apps/api/src/services/entity-infrastructure.service.ts             │
│                                                                      │
│  resolve_entity_references() {                                      │
│    // Pattern 1: manager__employee_id → label="manager"            │
│    // Pattern 2: stakeholder__employee_ids → label="stakeholder"   │
│    // Pattern 3: project_id → label="project"                      │
│    // Pattern 4: attachment_ids → label="attachment"               │
│                                                                      │
│    // Bulk query entity_instance table                             │
│    SELECT entity_instance_name                                      │
│    FROM entity_instance                                             │
│    WHERE entity_code = 'employee'                                   │
│      AND entity_instance_id = ANY([...uuids])                       │
│                                                                      │
│    // Return enriched object with both UUIDs and names             │
│  }                                                                  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ Enriched JSON
                         ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                               │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  UNIVERSAL FORMATTER SERVICE                                   │ │
│  │  apps/web/src/lib/universalFormatterService.ts                │ │
│  │                                                                │ │
│  │  detectFieldFormat(fieldName, dataType) {                     │ │
│  │    // Pattern detection                                       │ │
│  │    if (/_ids?$/i.test(fieldName)) {                           │ │
│  │      return { visible: false };  // Hide UUID fields         │ │
│  │    }                                                           │ │
│  │  }                                                             │ │
│  └────────────────────────┬──────────────────────────────────────┘ │
│                           │                                         │
│                           ↓                                         │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ENTITY DATA TABLE                                            │ │
│  │  apps/web/src/components/shared/ui/EntityDataTable.tsx       │ │
│  │                                                                │ │
│  │  // Filter columns                                            │ │
│  │  columns.filter(col =>                                        │ │
│  │    col.key !== 'id' &&           // Hide primary ID          │ │
│  │    !col.key.endsWith('_id') &&   // Hide UUID singles        │ │
│  │    !col.key.endsWith('_ids')     // Hide UUID arrays         │ │
│  │  )                                                             │ │
│  │                                                                │ │
│  │  // Display columns:                                          │ │
│  │  // ✅ name                                                   │ │
│  │  // ✅ manager (resolved)                                     │ │
│  │  // ✅ stakeholder (resolved array)                           │ │
│  │  // ❌ id (hidden)                                            │ │
│  │  // ❌ manager__employee_id (hidden)                          │ │
│  │  // ❌ stakeholder__employee_ids (hidden)                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ENTITY FORM CONTAINER                                        │ │
│  │  apps/web/src/components/shared/entity/EntityFormContainer.tsx│ │
│  │                                                                │ │
│  │  // Filter form fields                                        │ │
│  │  const visibleFields = fields.filter(f =>                     │ │
│  │    !excludedFields.includes(f.key) &&                         │ │
│  │    !f.key.endsWith('_id') &&     // Hide UUID singles        │ │
│  │    !f.key.endsWith('_ids')       // Hide UUID arrays         │ │
│  │  );                                                            │ │
│  │                                                                │ │
│  │  // Display fields:                                           │ │
│  │  // ✅ name (in page header)                                 │ │
│  │  // ✅ manager (dropdown select)                             │ │
│  │  // ✅ stakeholder (multi-select)                            │ │
│  │  // ❌ id (in page header, not form)                         │ │
│  │  // ❌ manager__employee_id (hidden)                          │ │
│  │  // ❌ stakeholder__employee_ids (hidden)                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ENTITY DETAIL PAGE HEADER                                    │ │
│  │  apps/web/src/pages/entity/EntityDetailPage.tsx              │ │
│  │                                                                │ │
│  │  <div className="header">                                     │ │
│  │    <h1>{entity.name}</h1>                                     │ │
│  │    <span>ID: {entity.id}</span>  ← PRIMARY ID SHOWN HERE     │ │
│  │    <span>Manager: {entity.manager}</span>                     │ │
│  │  </div>                                                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Flow Example

### 1. **Database Layer** - Raw Data

```sql
-- db/11_project.ddl
SELECT
  id,
  name,
  manager__employee_id,
  sponsor__employee_id,
  stakeholder__employee_ids
FROM app.project
WHERE id = '93106ffb-402e-43a7-8b26-5287e37a1b0e';
```

**Result**:
```json
{
  "id": "93106ffb-402e-43a7-8b26-5287e37a1b0e",
  "name": "Kitchen Renovation",
  "manager__employee_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "sponsor__employee_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "stakeholder__employee_ids": [
    "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "dddddddd-dddd-dddd-dddd-dddddddddddd"
  ]
}
```

---

### 2. **API Route Layer** - Resolution Call

```typescript
// apps/api/src/modules/project/routes.ts

fastify.get('/api/v1/project/:id', {
  preHandler: [fastify.authenticate]
}, async (request, reply) => {
  const { id } = request.params;
  const userId = request.user.sub;

  // STEP 1: RBAC Check
  const canView = await entityInfra.check_entity_rbac(
    userId, 'project', id, Permission.VIEW
  );
  if (!canView) {
    return reply.status(403).send({ error: 'Forbidden' });
  }

  // STEP 2: Query database (raw data with UUIDs)
  const result = await db.execute(sql`
    SELECT *
    FROM app.project
    WHERE id = ${id}
  `);

  if (result.length === 0) {
    return reply.status(404).send({ error: 'Project not found' });
  }

  const project = result[0];

  // STEP 3: ⭐ CRITICAL - Resolve UUID references
  const enrichedProject = await entityInfra.resolve_entity_references(project);

  // STEP 4: Return enriched data to frontend
  return reply.send(enrichedProject);
});
```

---

### 3. **Entity Infrastructure Service** - Resolution Logic

```typescript
// apps/api/src/services/entity-infrastructure.service.ts

async resolve_entity_references(fields) {
  // INPUT:
  // {
  //   id: "93106ffb...",
  //   name: "Kitchen Renovation",
  //   manager__employee_id: "aaaaaaaa...",
  //   sponsor__employee_id: "bbbbbbbb...",
  //   stakeholder__employee_ids: ["cccccccc...", "dddddddd..."]
  // }

  // STEP 1: Pattern Detection
  // "manager__employee_id" matches Pattern 1: {label}__{entity}_id
  //   → label = "manager", entity = "employee"
  //
  // "sponsor__employee_id" matches Pattern 1: {label}__{entity}_id
  //   → label = "sponsor", entity = "employee"
  //
  // "stakeholder__employee_ids" matches Pattern 2: {label}__{entity}_ids
  //   → label = "stakeholder", entity = "employee"

  // STEP 2: Bulk Query (ONE query for all employees)
  const employeeUUIDs = [
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "cccccccc-cccc-cccc-cccc-cccccccccccc",
    "dddddddd-dddd-dddd-dddd-dddddddddddd"
  ];

  const result = await db.execute(sql`
    SELECT entity_instance_id, entity_instance_name
    FROM app.entity_instance
    WHERE entity_code = 'employee'
      AND entity_instance_id = ANY(${employeeUUIDs}::uuid[])
  `);

  // Result:
  // [
  //   { entity_instance_id: "aaaaaaaa...", entity_instance_name: "James Miller" },
  //   { entity_instance_id: "bbbbbbbb...", entity_instance_name: "Sarah Johnson" },
  //   { entity_instance_id: "cccccccc...", entity_instance_name: "Michael Chen" },
  //   { entity_instance_id: "dddddddd...", entity_instance_name: "Emily Brown" }
  // ]

  // STEP 3: Enrich data with resolved names
  // OUTPUT:
  return {
    id: "93106ffb-402e-43a7-8b26-5287e37a1b0e",
    name: "Kitchen Renovation",

    // Single UUID fields - add label field alongside original
    manager__employee_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    manager: "James Miller",                    // ← ADDED

    sponsor__employee_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    sponsor: "Sarah Johnson",                   // ← ADDED

    // Array UUID fields - create array of objects under label name
    stakeholder: [                              // ← ADDED (label name, not original field)
      {
        stakeholder__employee_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        stakeholder: "Michael Chen"
      },
      {
        stakeholder__employee_id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        stakeholder: "Emily Brown"
      }
    ]
  };
}
```

---

### 4. **Frontend Layer** - Component Rendering

#### 4A. **EntityDataTable** - List View

```typescript
// apps/web/src/components/shared/ui/EntityDataTable.tsx

// Data received from API:
const projects = [
  {
    id: "93106ffb...",
    name: "Kitchen Renovation",
    manager__employee_id: "aaaaaaaa...",  // Hidden by filter
    manager: "James Miller",              // ✅ Shown
    stakeholder: [...]                     // ✅ Shown
  }
];

// Column filtering (line 1239, 1280):
columns.filter(column => {
  if (column.key === 'id') return false;              // Hide primary ID
  if (column.key.endsWith('_id')) return false;       // Hide *_id
  if (column.key.endsWith('_ids')) return false;      // Hide *_ids
  if (column.key.includes('_metadata')) return false; // Hide metadata
  return true;
});

// Rendered columns:
// ┌──────────────────────┬─────────────────┬────────────────────┐
// │ Name                 │ Manager         │ Stakeholders       │
// ├──────────────────────┼─────────────────┼────────────────────┤
// │ Kitchen Renovation   │ James Miller    │ Michael Chen, ...  │
// └──────────────────────┴─────────────────┴────────────────────┘
//
// Hidden columns:
// - id (primary key)
// - manager__employee_id (UUID field)
// - stakeholder__employee_ids (UUID array field)
```

#### 4B. **EntityFormContainer** - Detail View

```typescript
// apps/web/src/components/shared/entity/EntityFormContainer.tsx

// Data received from API (same enriched data):
const projectData = {
  id: "93106ffb...",
  name: "Kitchen Renovation",
  manager__employee_id: "aaaaaaaa...",  // Hidden by filter
  manager: "James Miller",              // ✅ Shown
  stakeholder: [                         // ✅ Shown
    { stakeholder__employee_id: "ccc...", stakeholder: "Michael Chen" },
    { stakeholder__employee_id: "ddd...", stakeholder: "Emily Brown" }
  ]
};

// Field filtering (lines 666-670):
const visibleFields = fields.filter(f =>
  !excludedFields.includes(f.key) &&
  !f.key.endsWith('_id') &&   // Hide UUID reference fields
  !f.key.endsWith('_ids')     // Hide UUID array fields
);

// Rendered form fields:
// ┌─────────────────────────────────────────────────────┐
// │ Project Details                                      │
// ├─────────────────────────────────────────────────────┤
// │ Name: Kitchen Renovation                            │
// │                                                      │
// │ Manager: [Dropdown: James Miller          ▼]       │
// │                                                      │
// │ Stakeholders:                                        │
// │   ☑ Michael Chen                                    │
// │   ☑ Emily Brown                                     │
// │   ☐ John Smith                                      │
// └─────────────────────────────────────────────────────┘
//
// Hidden fields (not in form):
// - id (shown in page header instead)
// - manager__employee_id (UUID hidden)
// - stakeholder__employee_ids (UUID array hidden)
```

#### 4C. **Entity Detail Page Header**

```typescript
// apps/web/src/pages/entity/EntityDetailPage.tsx

<div className="page-header">
  <div className="title-section">
    <h1>{projectData.name}</h1>
    <span className="id-badge">ID: {projectData.id}</span>  {/* ← PRIMARY ID SHOWN */}
  </div>

  <div className="metadata-section">
    <div>Manager: {projectData.manager}</div>
    <div>
      Stakeholders:
      {projectData.stakeholder?.map(s => s.stakeholder).join(', ')}
    </div>
  </div>
</div>

// Renders as:
// ┌────────────────────────────────────────────────────┐
// │ Kitchen Renovation                                  │
// │ ID: 93106ffb-402e-43a7-8b26-5287e37a1b0e           │
// │                                                     │
// │ Manager: James Miller                              │
// │ Stakeholders: Michael Chen, Emily Brown            │
// └────────────────────────────────────────────────────┘
```

---

## Field Visibility Rules

### Primary `id` Field

| Component | Visibility | Location | Purpose |
|-----------|-----------|----------|---------|
| EntityDataTable | ❌ Hidden | N/A | Redundant (used for row clicks) |
| EntityFormContainer | ❌ Hidden | N/A | Not editable |
| Entity Detail Page | ✅ **SHOWN** | Header | Identity reference |

### UUID Reference Fields (`*_id`, `*_ids`)

| Component | Field Type | Visibility | Replacement |
|-----------|-----------|-----------|-------------|
| EntityDataTable | `manager__employee_id` | ❌ Hidden | `manager` column |
| EntityDataTable | `stakeholder__employee_ids` | ❌ Hidden | `stakeholder` column |
| EntityFormContainer | `manager__employee_id` | ❌ Hidden | `manager` dropdown |
| EntityFormContainer | `stakeholder__employee_ids` | ❌ Hidden | `stakeholder` multi-select |

### Resolved Label Fields

| Component | Field | Data Type | Display |
|-----------|-------|-----------|---------|
| EntityDataTable | `manager` | String | `"James Miller"` |
| EntityDataTable | `stakeholder` | Array | `["Michael Chen", "Emily Brown"]` |
| EntityFormContainer | `manager` | String | Dropdown select |
| EntityFormContainer | `stakeholder` | Array | Multi-select checkboxes |

---

## Implementation Checklist for New Entities

When adding a new entity with UUID reference fields:

### Backend

- [ ] **1. Database Schema** (`db/{entity}.ddl`)
  ```sql
  CREATE TABLE app.d_{entity} (
    id uuid PRIMARY KEY,
    name text,
    manager__employee_id uuid,           -- Use double-underscore convention
    stakeholder__employee_ids uuid[]     -- Use _ids for arrays
  );
  ```

- [ ] **2. API Route** (`apps/api/src/modules/{entity}/routes.ts`)
  ```typescript
  fastify.get('/api/v1/{entity}/:id', async (request, reply) => {
    const entity = await db.execute(sql`SELECT * FROM d_{entity} WHERE id = ${id}`);

    // ⭐ CRITICAL: Call resolution service
    const enriched = await entityInfra.resolve_entity_references(entity[0]);

    return reply.send(enriched);
  });
  ```

- [ ] **3. Entity Instance Registry**
  - Ensure `entity_instance` table has all referenced entities
  - Run backfill if needed: `db/entity_configuration_settings/04_entity_instance_backfill.ddl`

### Frontend

- [ ] **4. Entity Config** (`apps/web/src/lib/entityConfig.ts`)
  ```typescript
  {
    columns: [
      { key: 'name', title: 'Name' },
      { key: 'manager', title: 'Manager' },          // Use label name, NOT manager__employee_id
      { key: 'stakeholder', title: 'Stakeholders' }  // Use label name, NOT stakeholder__employee_ids
    ]
  }
  ```

- [ ] **5. Verify Hiding Logic**
  - EntityDataTable: UUID fields automatically hidden by `endsWith('_id')` and `endsWith('_ids')`
  - EntityFormContainer: UUID fields automatically hidden by same logic
  - No manual configuration needed!

### Testing

- [ ] **6. Test Data Flow**
  ```bash
  # Test API returns enriched data
  curl http://localhost:4000/api/v1/{entity}/{id} -H "Authorization: Bearer $TOKEN"

  # Verify response has both:
  # - Original UUID fields (manager__employee_id)
  # - Resolved label fields (manager: "Name")
  ```

- [ ] **7. Test UI Rendering**
  - Open entity list page → Verify UUID fields hidden, labels shown
  - Open entity detail page → Verify UUID fields hidden, labels shown
  - Open entity form → Verify UUID fields hidden, dropdowns work
  - Verify primary `id` shown in detail page header

---

## Pattern Detection Reference

### 4 Supported Patterns

| Pattern | Regex | Example | Label | Entity | Array |
|---------|-------|---------|-------|--------|-------|
| **Pattern 1** | `/^(.+)__([a-z_]+)_id$/` | `manager__employee_id` | `manager` | `employee` | No |
| **Pattern 2** | `/^(.+)__([a-z_]+)_ids$/` | `stakeholder__employee_ids` | `stakeholder` | `employee` | Yes |
| **Pattern 3** | `/^([a-z_]+)_id$/` | `project_id` | `project` | `project` | No |
| **Pattern 4** | `/^([a-z_]+)_ids$/` | `attachment_ids` | `attachment` | `attachment` | Yes |

### Field Naming Best Practices

✅ **Good** - Auto-detected:
```typescript
manager__employee_id       // Pattern 1: Labeled single
stakeholder__employee_ids  // Pattern 2: Labeled array
project_id                 // Pattern 3: Simple single
attachment_ids             // Pattern 4: Simple array
```

❌ **Bad** - Not auto-detected:
```typescript
managerId                  // Missing underscores
manager_employeeId         // Single underscore
managerEmployeeId          // CamelCase not supported
employee_manager_id        // Ambiguous label/entity
```

---

## Performance Considerations

### Bulk Resolution Optimization

The entity infrastructure service uses **bulk queries** to minimize database round-trips:

```typescript
// ❌ BAD: N queries (one per UUID)
for (const uuid of uuids) {
  const name = await db.query('SELECT name FROM entity_instance WHERE id = $1', [uuid]);
}

// ✅ GOOD: 1 query per entity type
const result = await db.execute(sql`
  SELECT entity_instance_id, entity_instance_name
  FROM app.entity_instance
  WHERE entity_code = ${entityType}
    AND entity_instance_id = ANY(${uuids}::uuid[])
`);
```

**Example**: Resolving 100 projects with manager + 3 stakeholders each:
- Without bulk: 400 queries (1 per UUID)
- With bulk: 1 query (all 400 employees at once)

### When to Skip Resolution

Skip resolution for performance-critical endpoints:

```typescript
// ✅ Use resolution: Detail views, forms
fastify.get('/api/v1/project/:id', async () => {
  const enriched = await entityInfra.resolve_entity_references(project);
  return enriched;
});

// ❌ Skip resolution: Large exports, analytics
fastify.get('/api/v1/project/export', async () => {
  const projects = await db.execute(sql`SELECT * FROM app.project LIMIT 10000`);
  return projects;  // Raw UUIDs for export
});
```

---

## Troubleshooting

### UUID Fields Still Showing in Table

**Problem**: UUID fields appear in EntityDataTable columns

**Solution**: Check column filtering logic
```typescript
// apps/web/src/components/shared/ui/EntityDataTable.tsx:1239, 1280
if (column.key.endsWith('_id') || column.key.endsWith('_ids')) return false;
```

### Resolved Labels Not Appearing

**Problem**: Data shows UUIDs instead of names

**Solution**: Verify API route calls resolution service
```typescript
// apps/api/src/modules/{entity}/routes.ts
const enriched = await entityInfra.resolve_entity_references(data);
return reply.send(enriched);  // Must return enriched data!
```

### "Unknown" Shown Instead of Name

**Problem**: Resolved field shows "Unknown"

**Root Causes**:
1. UUID doesn't exist in `entity_instance` table
2. Wrong `entity_code` in pattern detection
3. Entity instance not registered during creation

**Solution**: Run backfill or check entity creation code
```sql
-- Verify entity exists in registry
SELECT * FROM app.entity_instance
WHERE entity_instance_id = 'your-uuid-here';

-- If missing, run backfill
-- See: db/entity_configuration_settings/04_entity_instance_backfill.ddl
```

---

## Related Documentation

- [Entity Infrastructure Service](../services/ENTITY_INFRASTRUCTURE_SERVICE.md) - Backend resolution architecture
- [Entity Resolution Service](../services/ENTITY_RESOLUTION_SERVICE.md) - Resolution service details
- [Universal Formatter Service](../services/UNIVERSAL_FORMATTER_SERVICE.md) - Frontend formatting patterns
- [Entity Endpoint Design](../api/entity_endpoint_design.md) - API route patterns
- [UUID Field Naming Convention Migration](../MIGRATION_UUID_FIELD_NAMING.md) - Migration guide

---

**Key Takeaway**: The system automatically resolves UUID references to human-readable names at the API layer, hides raw UUID fields in the UI, and displays only the resolved labels. This requires **zero frontend configuration** - just follow the naming convention!
