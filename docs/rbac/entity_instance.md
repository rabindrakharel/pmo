# Entity Instance Registry

**Version:** 4.0.0 | **Table:** `app.entity_instance`

---

## Semantics

The Entity Instance Registry maintains a global registry of all entity instances across the platform. It provides a denormalized lookup for entity names and codes, enabling fast cross-entity searches and reference resolution.

**Core Principle:** Every entity instance must be registered. Names/codes cached for fast lookups.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTITY INSTANCE REGISTRY                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    PRIMARY TABLES                                │    │
│  │  d_project, d_task, d_employee, d_office, d_business, etc.      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│         │                    │                    │                      │
│         │ On CREATE          │ On UPDATE          │ On DELETE            │
│         v                    v                    v                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    entity_instance                               │    │
│  │  ┌───────────────────────────────────────────────────────────┐  │    │
│  │  │ entity_code │ entity_instance_id │ entity_instance_name │  │  │    │
│  │  │ 'project'   │ uuid-1             │ 'Kitchen Renovation' │  │  │    │
│  │  │ 'task'      │ uuid-2             │ 'Design Phase'       │  │  │    │
│  │  │ 'employee'  │ uuid-3             │ 'John Smith'         │  │  │    │
│  │  └───────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    USE CASES                                     │    │
│  │  • Entity reference dropdowns (EntitySelect)                    │    │
│  │  • Global search across all entities                            │    │
│  │  • Cross-entity name resolution                                  │    │
│  │  • Linkage validation                                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
CREATE Flow
───────────

Route Handler                Service Method                  Database
─────────────                ──────────────                  ────────

POST /api/v1/project    →    set_entity_instance_registry()  →  INSERT INTO
{name: "Kitchen Reno"}       {                                   entity_instance
                               entity_type: 'project',
                               entity_id: uuid,
                               entity_name: 'Kitchen Reno',
                               entity_code: 'PROJ-001'
                             }


UPDATE Flow (name change)
─────────────────────────

Route Handler                Service Method                    Database
─────────────                ──────────────                    ────────

PATCH /api/v1/project/  →    update_entity_instance_registry() → UPDATE
{name: "Bath Reno"}          ('project', uuid, {                  entity_instance
                               entity_name: 'Bath Reno'           SET entity_instance_name
                             })


DELETE Flow
───────────

Route Handler                Service Method                    Database
─────────────                ──────────────                    ────────

DELETE /api/v1/project/ →    delete_entity_instance_registry() → DELETE FROM
                             ('project', uuid)                    entity_instance
```

---

## Architecture Overview

### Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `entity_code` | varchar | Entity type ('project', 'task', etc.) |
| `entity_instance_id` | uuid | Primary key of the entity |
| `order_id` | serial | Auto-increment for ordering |
| `entity_instance_name` | varchar | Display name (denormalized) |
| `code` | varchar | Business code (denormalized, nullable) |
| `created_ts` | timestamp | Registration time |
| `updated_ts` | timestamp | Last update time |

### Primary Key

```sql
PRIMARY KEY (entity_code, entity_instance_id)
```

### Service Methods

| Method | Purpose |
|--------|---------|
| `set_entity_instance_registry()` | Register new instance |
| `update_entity_instance_registry()` | Update name/code on change |
| `delete_entity_instance_registry()` | Remove on hard delete |
| `validate_instance_exists()` | Check if instance is registered |

---

## Tooling Overview

### Usage in Routes

```typescript
// On CREATE - register the instance
await entityInfra.set_entity_instance_registry({
  entity_type: ENTITY_CODE,
  entity_id: newProject.id,
  entity_name: newProject.name,
  entity_code: newProject.code
});

// On UPDATE - sync if name/code changed
if (data.name || data.code) {
  await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
    entity_name: data.name,
    entity_code: data.code
  });
}
```

### API Endpoint

```
GET /api/v1/entity/{entityCode}/entity-instance-lookup

Response:
{
  "data": [
    { "id": "uuid-1", "name": "Kitchen Renovation", "code": "PROJ-001" },
    { "id": "uuid-2", "name": "Bathroom Remodel", "code": "PROJ-002" }
  ]
}
```

---

## Database/API/UI Mapping

### Frontend Usage

| Component | Uses Registry For |
|-----------|-------------------|
| EntitySelect | Dropdown options |
| EntityMultiSelect | Multi-select options |
| Reference columns | Name resolution |
| Global search | Cross-entity search |

### Query Pattern

```sql
-- Entity instance lookup (for dropdowns)
SELECT entity_instance_id AS id,
       entity_instance_name AS name,
       code
FROM app.entity_instance
WHERE entity_code = 'employee'
ORDER BY entity_instance_name ASC;
```

---

## User Interaction Flow

```
EntitySelect Dropdown Flow
──────────────────────────

1. User opens EntitySelect for "manager__employee_id"
   │
2. Frontend fetches:
   GET /api/v1/entity/employee/entity-instance-lookup
   │
3. API queries entity_instance:
   SELECT entity_instance_id, entity_instance_name, code
   FROM app.entity_instance
   WHERE entity_code = 'employee'
   │
4. Returns options:
   [{ id: "uuid", name: "John Smith", code: "EMP-001" }]
   │
5. User sees dropdown with employee names
```

---

## Critical Considerations

### Design Principles

1. **Always Register** - Every CREATE must register in entity_instance
2. **Sync on Update** - Name/code changes must be synced
3. **Hard Delete** - No active_flag (removed when entity deleted)
4. **Denormalized** - Names cached for performance

### Registration Requirements

| Event | Action Required |
|-------|-----------------|
| Entity CREATE | `set_entity_instance_registry()` |
| Entity UPDATE (name/code) | `update_entity_instance_registry()` |
| Entity DELETE | `delete_entity_instance_registry()` |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Skip registration | Always register on CREATE |
| Query primary table for dropdowns | Use entity_instance lookup |
| Forget to sync on name change | Always update registry |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
