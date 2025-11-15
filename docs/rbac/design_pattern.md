# Entity Implementation Design Pattern Guide

> **Version:** 4.0 (Database-Driven Architecture)
> **Last Updated:** 2025-11-15
> **Audience:** Backend developers implementing new entities

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Core Design Patterns](#core-design-patterns)
4. [Step-by-Step Implementation Guide](#step-by-step-implementation-guide)
5. [RBAC & Permission Patterns](#rbac--permission-patterns)
6. [Child Entity Patterns](#child-entity-patterns)
7. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
8. [Testing & Validation](#testing--validation)

---

## Overview

This guide documents the **Universal Entity System v4.0** design patterns for implementing entities in the PMO platform. The architecture emphasizes:

- **Database-driven configuration** (d_entity as single source of truth)
- **Unified data gate pattern** (centralized RBAC + filtering)
- **Zero-repetition factories** (auto-generate endpoints from metadata)
- **Type-safe UUID handling** (proper PostgreSQL type casting)

### Key Changes from v3.x

| Pattern | v3.x (Old) | v4.0 (New) |
|---------|-----------|-----------|
| Child endpoints | Manual repetition | Auto-generated from `d_entity` |
| RBAC checks | Scattered SQL queries | Unified data gate |
| Table name resolution | Hardcoded | Dynamic with `ENTITY_TABLE_MAP` |
| Type casting | Mixed `::text` | Strict `::uuid` for IDs |
| Parent-child filtering | Manual joins | Factory pattern with inheritance |

---

## Architecture Principles

### 1. Single Source of Truth

**Rule:** Entity metadata lives in the database, not in code.

```sql
-- db/entity_configuration_settings/02_entity.ddl
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'project',
  'Project',
  'Projects',
  'FolderOpen',
  '["task", "wiki", "artifact", "form", "expense", "revenue"]'::jsonb,
  30
);
```

**Why:** Schema changes (adding/removing child entities) don't require code changes—only DDL updates and `db-import.sh`.

### 2. Unified Data Gate Pattern

**Rule:** All data access goes through `unified-data-gate.ts` for RBAC and filtering.

```typescript
// ✅ CORRECT: Centralized gate
import { unified_data_gate, Permission } from '@/lib/unified-data-gate.js';

const result = await unified_data_gate({
  entityType: 'project',
  operation: 'read',
  userId,
  permission: Permission.VIEW,
  parentEntityType: req.query.business_id ? 'business' : undefined,
  parentEntityId: req.query.business_id,
  pagination: { page, limit }
});

// ❌ INCORRECT: Manual SQL with scattered RBAC
const projects = await db.execute(sql`
  SELECT * FROM app.d_project WHERE id = ${id}
`);
```

**Benefits:**
- Role-based access control (employee permissions + role inheritance)
- Parent-VIEW inheritance (view parent → view children)
- Parent-CREATE inheritance (create in parent → link children)
- Automatic filtering by parent context

### 3. Database-Driven Child Endpoints

**Rule:** Never manually declare child entity endpoints—use metadata-driven factories.

```typescript
// ✅ CORRECT: Auto-generate from d_entity
import { createChildEntityEndpointsFromMetadata } from '@/lib/child-entity-route-factory.js';

await createChildEntityEndpointsFromMetadata(fastify, 'project');
// Auto-creates: /api/v1/project/:id/task, /api/v1/project/:id/wiki, etc.

// ❌ INCORRECT: Manual repetition
createChildEntityEndpoint(fastify, 'project', 'task', 'd_task');
createChildEntityEndpoint(fastify, 'project', 'wiki', 'd_wiki');
createChildEntityEndpoint(fastify, 'project', 'form', 'd_form_head');
createChildEntityEndpoint(fastify, 'project', 'artifact', 'd_artifact');
```

### 4. Type-Safe UUID Handling

**Rule:** PostgreSQL UUIDs must use `::uuid` casting, never `::text`.

```sql
-- ✅ CORRECT: UUID-to-UUID comparison
WHERE rbac.entity_id = ${parentId}::uuid
  OR rbac.entity_id = '11111111-1111-1111-1111-111111111111'::uuid

-- ❌ INCORRECT: UUID-to-TEXT comparison (causes "operator does not exist" error)
WHERE rbac.entity_id = ${parentId}::text

-- ✅ CORRECT: JOIN on UUID columns
INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = c.id

-- ❌ INCORRECT: Casting UUID to text in JOIN
INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = c.id::text
```

**Schema Reference:**
```
entity_id_rbac_map.entity_id         → UUID
entity_id_rbac_map.person_entity_id  → UUID
d_entity_id_map.parent_entity_id     → UUID
d_entity_id_map.child_entity_id      → UUID
```

---

## How Routes Are Implemented (v4.0 Architecture)

### Route Structure Overview

Every entity module follows a standardized 5-section structure that leverages database-driven configuration and centralized security:

```typescript
// apps/api/src/modules/{entity}/routes.ts

import { unified_data_gate, Permission } from '@/lib/unified-data-gate.js';
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '@/lib/child-entity-route-factory.js';

export default async function (fastify: FastifyInstance) {

  // ========================================
  // SECTION 1: LIST ENDPOINT
  // ========================================
  fastify.get('/api/v1/project', { ... }, async (request, reply) => {
    const { page = 1, limit = 20, ...filters } = request.query;

    return await unified_data_gate({
      entityType: 'project',
      operation: 'read',
      userId: request.user?.sub,
      permission: Permission.VIEW,
      pagination: { page, limit },
      filters
    });
  });

  // ========================================
  // SECTION 2: SINGLE ENTITY ENDPOINT
  // ========================================
  fastify.get('/api/v1/project/:id', { ... }, async (request, reply) => {
    const result = await unified_data_gate({
      entityType: 'project',
      operation: 'read',
      userId: request.user?.sub,
      permission: Permission.VIEW,
      entityId: request.params.id
    });

    return result.data[0];
  });

  // ========================================
  // SECTION 3: CREATE/UPDATE ENDPOINTS
  // ========================================
  fastify.post('/api/v1/project', { ... }, async (request, reply) => {
    const { parent_id, ...data } = request.body;

    return await unified_data_gate({
      entityType: 'project',
      operation: 'create',
      userId: request.user?.sub,
      permission: Permission.CREATE,
      data,
      parentEntityType: parent_id ? 'business' : undefined,
      parentEntityId: parent_id
    });
  });

  fastify.patch('/api/v1/project/:id', { ... }, async (request, reply) => {
    return await unified_data_gate({
      entityType: 'project',
      operation: 'update',
      userId: request.user?.sub,
      permission: Permission.EDIT,
      entityId: request.params.id,
      data: request.body
    });
  });

  // ========================================
  // SECTION 4: DELETE ENDPOINT (Factory)
  // ========================================
  createEntityDeleteEndpoint(fastify, 'project');

  // ========================================
  // SECTION 5: CHILD ENTITY ENDPOINTS (Auto-Generated)
  // ========================================
  await createChildEntityEndpointsFromMetadata(fastify, 'project');
}
```

### Section Breakdown

#### Section 1: LIST Endpoint - Filtered Collection

**Pattern:** `GET /api/v1/{entity}`

**What it does:**
- Returns paginated list of entities
- Applies RBAC filtering (user only sees what they have VIEW permission for)
- Supports parent filtering (e.g., `?business_id=xxx` filters projects by business)
- Applies custom filters (e.g., `?dl__project_stage=Execution`)

**Data Flow:**
```
Request → Authenticate → unified_data_gate
                              ↓
                    Check RBAC permissions
                              ↓
                    Query d_project table
                              ↓
                    Filter by parent (if provided)
                              ↓
                    Apply custom filters
                              ↓
                    Paginate results
                              ↓
                    Return { data, total, page, limit }
```

**Key features:**
- Automatically inherits parent-VIEW permissions
- Role-based filtering via `entity_id_rbac_map`
- No manual SQL - all handled by unified data gate

#### Section 2: SINGLE Entity Endpoint

**Pattern:** `GET /api/v1/{entity}/{id}`

**What it does:**
- Returns single entity by UUID
- Checks instance-level RBAC (user must have VIEW on this specific entity)
- Returns 404 if not found or no permission

**Data Flow:**
```
Request → Authenticate → unified_data_gate
                              ↓
                    Check RBAC for entity_id
                              ↓
                    Query d_project WHERE id = {id}
                              ↓
                    Return single record or 404
```

#### Section 3: CREATE/UPDATE Endpoints

**CREATE Pattern:** `POST /api/v1/{entity}`

**What it does:**
- Creates new entity instance
- Checks type-level CREATE permission (`entity_id = '11111111-1111-1111-1111-111111111111'`)
- If `parentEntityId` provided:
  - Verifies user has permission on parent
  - Creates entity
  - **Automatically creates linkage** in `d_entity_id_map`
- Registers entity in `d_entity_instance_id`

**UPDATE Pattern:** `PATCH /api/v1/{entity}/{id}`

**What it does:**
- Updates existing entity
- Checks instance-level EDIT permission
- Merges provided fields with existing data
- Updates `updated_ts` timestamp

**Data Flow (CREATE with Parent):**
```
Request → Authenticate → unified_data_gate
                              ↓
                    Check CREATE permission on entity type
                              ↓
                    Check VIEW permission on parent (if parent_id provided)
                              ↓
                    INSERT INTO d_project (...)
                              ↓
                    INSERT INTO d_entity_instance_id (register entity)
                              ↓
                    INSERT INTO d_entity_id_map (create parent-child link)
                              ↓
                    Return created entity
```

#### Section 4: DELETE Endpoint (Factory-Generated)

**Pattern:** `DELETE /api/v1/{entity}/{id}`

**Single line:** `createEntityDeleteEndpoint(fastify, 'project');`

**What it does (automatically):**
1. Checks DELETE permission on entity
2. Soft deletes entity (`active_flag = false`)
3. Removes from `d_entity_instance_id`
4. **Cascades deletion** to all linkages in `d_entity_id_map`:
   - Where entity is parent (deletes child relationships)
   - Where entity is child (deletes parent relationships)
5. Cleans up RBAC permissions in `entity_id_rbac_map`

**Why factory?** Same logic for all entities - no repetition needed.

#### Section 5: Child Entity Endpoints (Database-Driven)

**Single line:** `await createChildEntityEndpointsFromMetadata(fastify, 'project');`

**What it does:**
1. **Queries database** for entity metadata:
   ```sql
   SELECT child_entities FROM app.d_entity WHERE code = 'project'
   -- Returns: ["task", "wiki", "artifact", "form", "expense", "revenue"]
   ```

2. **For each child entity**, creates endpoint:
   - Pattern: `GET /api/v1/project/{id}/task`
   - Pattern: `GET /api/v1/project/{id}/wiki`
   - Pattern: `GET /api/v1/project/{id}/artifact`
   - etc.

3. **Endpoint behavior:**
   ```typescript
   GET /api/v1/project/{id}/task

   // Checks:
   // 1. User has VIEW permission on project {id}
   // 2. Queries tasks linked to this project:

   SELECT t.*
   FROM app.d_task t
   INNER JOIN app.d_entity_id_map eim ON eim.child_entity_id = t.id
   WHERE eim.parent_entity_id = {project_id}
     AND eim.parent_entity_type = 'project'
     AND eim.child_entity_type = 'task'
     AND eim.active_flag = true
     AND t.active_flag = true
   ORDER BY t.created_ts DESC
   ```

4. **Table name resolution:**
   - Uses `ENTITY_TABLE_MAP` for special cases
   - `task` → `d_task` (standard)
   - `form` → `d_form_head` (special case)
   - `expense` → `f_expense` (fact table)

**Benefits:**
- Add child entity in DDL → endpoints auto-created
- Remove child entity in DDL → endpoints auto-removed
- Zero code changes needed
- Single source of truth (database)

### Complete Endpoint Map

For entity "project" with children `["task", "wiki", "artifact", "form", "expense", "revenue"]`:

| Endpoint | Method | Source | Purpose |
|----------|--------|--------|---------|
| `/api/v1/project` | GET | Manual route | List all projects (RBAC filtered) |
| `/api/v1/project` | POST | Manual route | Create new project |
| `/api/v1/project/{id}` | GET | Manual route | Get single project |
| `/api/v1/project/{id}` | PATCH | Manual route | Update project |
| `/api/v1/project/{id}` | DELETE | **Factory** | Soft delete with cascade |
| `/api/v1/project/{id}/task` | GET | **Auto-generated** | Tasks for this project |
| `/api/v1/project/{id}/wiki` | GET | **Auto-generated** | Wiki pages for this project |
| `/api/v1/project/{id}/artifact` | GET | **Auto-generated** | Artifacts for this project |
| `/api/v1/project/{id}/form` | GET | **Auto-generated** | Forms for this project |
| `/api/v1/project/{id}/expense` | GET | **Auto-generated** | Expenses for this project |
| `/api/v1/project/{id}/revenue` | GET | **Auto-generated** | Revenue for this project |

**Total:** 11 endpoints with only **6 manual route definitions** + 2 factory calls.

### Route Registration Flow

```
apps/api/src/modules/index.ts
  ↓
registerRoutes(fastify)
  ↓
await fastify.register(projectRoutes)
  ↓
┌─────────────────────────────────────────┐
│ projectRoutes() executes                │
├─────────────────────────────────────────┤
│ 1. Register GET /api/v1/project         │ ← Manual
│ 2. Register POST /api/v1/project        │ ← Manual
│ 3. Register GET /api/v1/project/:id     │ ← Manual
│ 4. Register PATCH /api/v1/project/:id   │ ← Manual
│ 5. createEntityDeleteEndpoint()         │ ← Factory (1 line)
│    └─ Registers DELETE /project/:id     │
│ 6. createChildEntityEndpoints()         │ ← Database-driven (1 line)
│    ├─ Query d_entity.child_entities     │
│    ├─ Register GET /project/:id/task    │
│    ├─ Register GET /project/:id/wiki    │
│    ├─ Register GET /project/:id/artifact│
│    ├─ Register GET /project/:id/form    │
│    ├─ Register GET /project/:id/expense │
│    └─ Register GET /project/:id/revenue │
└─────────────────────────────────────────┘
  ↓
All 11 endpoints now active
```

### Security Layer (Unified Data Gate)

Every route goes through the same security pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│                    unified_data_gate()                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. RBAC CHECK (RBAC_GATE)                                  │
│     ├─ Check direct permissions (entity_id_rbac_map)        │
│     ├─ Check role inheritance (rel_emp_role)                │
│     ├─ Check parent-VIEW inheritance                        │
│     └─ Check parent-CREATE inheritance                      │
│                                                              │
│  2. PARENT-CHILD FILTERING (if parent context provided)     │
│     └─ Query d_entity_id_map for linkages                   │
│                                                              │
│  3. ENTITY OPERATION (based on operation type)              │
│     ├─ read   → SELECT from d_{entity}                      │
│     ├─ create → INSERT + register + link                    │
│     ├─ update → UPDATE d_{entity}                           │
│     └─ delete → Soft delete + cascade cleanup               │
│                                                              │
│  4. RETURN RESPONSE                                         │
│     └─ { data, total, page, limit } or error               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**No route has custom RBAC logic** - all security is centralized.

### Adding a New Entity (Minimal Code)

**Step 1:** Create DDL with entity metadata
```sql
-- db/XX_d_vehicle.ddl
INSERT INTO app.d_entity (code, child_entities)
VALUES ('vehicle', '["maintenance", "inspection"]'::jsonb);
```

**Step 2:** Create minimal route file (15 lines)
```typescript
// apps/api/src/modules/vehicle/routes.ts
import { unified_data_gate, Permission } from '@/lib/unified-data-gate.js';
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '@/lib/child-entity-route-factory.js';

export default async function (fastify: FastifyInstance) {
  // LIST
  fastify.get('/api/v1/vehicle', { ... }, async (req, reply) => {
    return await unified_data_gate({ entityType: 'vehicle', operation: 'read', ... });
  });

  // GET SINGLE
  fastify.get('/api/v1/vehicle/:id', { ... }, async (req, reply) => { ... });

  // CREATE
  fastify.post('/api/v1/vehicle', { ... }, async (req, reply) => { ... });

  // UPDATE
  fastify.patch('/api/v1/vehicle/:id', { ... }, async (req, reply) => { ... });

  // DELETE (factory)
  createEntityDeleteEndpoint(fastify, 'vehicle');

  // CHILD ENDPOINTS (auto-generated from d_entity)
  await createChildEntityEndpointsFromMetadata(fastify, 'vehicle');
  // ↑ This one line creates:
  //   GET /api/v1/vehicle/:id/maintenance
  //   GET /api/v1/vehicle/:id/inspection
}
```

**Step 3:** Register in `modules/index.ts`
```typescript
await fastify.register(vehicleRoutes);
```

**Result:** Full CRUD + 2 child entity endpoints with **zero SQL**, **zero RBAC logic**, **zero manual child declarations**.

---

## Core Design Patterns

### Pattern 1: Unified Data Gate (RBAC + Filtering)

**File:** `apps/api/src/lib/unified-data-gate.ts`

**Usage:**
```typescript
import { unified_data_gate, Permission } from '@/lib/unified-data-gate.js';

// READ operation with parent filtering
const { data, total } = await unified_data_gate({
  entityType: 'task',
  operation: 'read',
  userId: request.user?.sub,
  permission: Permission.VIEW,
  parentEntityType: 'project',
  parentEntityId: request.query.project_id,
  pagination: { page: 1, limit: 20 },
  filters: { dl__task_stage: 'In Progress' }
});

// CREATE operation with parent linkage
const newTask = await unified_data_gate({
  entityType: 'task',
  operation: 'create',
  userId: request.user?.sub,
  permission: Permission.CREATE,
  data: { name: 'New Task', descr: 'Task description' },
  parentEntityType: 'project',
  parentEntityId: projectId // Auto-creates linkage in d_entity_id_map
});

// UPDATE operation with instance-level RBAC
const updated = await unified_data_gate({
  entityType: 'task',
  operation: 'update',
  userId: request.user?.sub,
  permission: Permission.EDIT,
  entityId: taskId,
  data: { dl__task_stage: 'Completed' }
});

// DELETE operation (soft delete)
await unified_data_gate({
  entityType: 'task',
  operation: 'delete',
  userId: request.user?.sub,
  permission: Permission.DELETE,
  entityId: taskId
});
```

**Permission Levels:**
```typescript
enum Permission {
  VIEW = 0,    // Read entity data
  EDIT = 1,    // Update existing entity
  SHARE = 2,   // Share entity with others
  DELETE = 3,  // Soft delete entity
  CREATE = 4,  // Create new entities
  OWNER = 5    // Full control (all permissions + grant/revoke)
}
```

**Permission Hierarchy:**
- `OWNER (5)` includes all permissions below + ability to manage permissions
- `CREATE (4)` includes VIEW, EDIT, SHARE, DELETE + create new instances
- `DELETE (3)` includes VIEW, EDIT, SHARE + soft delete
- `SHARE (2)` includes VIEW, EDIT + share with others
- `EDIT (1)` includes VIEW + update
- `VIEW (0)` read-only access

**When to use OWNER vs CREATE:**
- **OWNER (5):** For entity creators who need to manage team access
  - Event creator can add/remove attendees
  - Project manager can assign team members
  - Use when: User should control who can access the entity
- **CREATE (4):** For general entity creation within a type
  - Employee can create tasks in any project they have access to
  - Manager can create vehicles for any office
  - Use when: User should create entities but not manage permissions

**RBAC Logic:**
1. **Direct permissions:** Check `entity_id_rbac_map` for user's direct access
2. **Role inheritance:** Check user's role permissions via `rel_emp_role`
3. **Parent-VIEW inheritance:** If user has VIEW on parent, grant VIEW on children
4. **Parent-CREATE inheritance:** If user has CREATE on parent, grant CREATE on children

### Pattern 2: Database-Driven Child Entity Endpoints

**File:** `apps/api/src/lib/child-entity-route-factory.ts`

**Function:** `createChildEntityEndpointsFromMetadata(fastify, parentEntity)`

**How it works:**
1. Queries `d_entity` for parent's `child_entities` array
2. For each child, resolves table name via `ENTITY_TABLE_MAP`
3. Creates endpoint: `GET /api/v1/{parent}/:id/{child}`
4. Applies universal RBAC + parent-child filtering

**Entity-to-Table Mapping:**
```typescript
// Most entities follow d_{entity} convention
task → d_task
project → d_project

// Special naming cases
cust → d_client
form → d_form_head
business → d_business

// Fact tables use f_ prefix
expense → f_expense
revenue → f_revenue
order → f_order
invoice → f_invoice
```

**Adding custom mappings:**
```typescript
// apps/api/src/lib/child-entity-route-factory.ts
export const ENTITY_TABLE_MAP: Record<string, string> = {
  // ... existing mappings
  my_entity: 'd_my_custom_table', // Add custom mapping
};
```

### Pattern 3: Universal CRUD Factory

**File:** `apps/api/src/lib/universal-crud-factory.ts`

**Usage:**
```typescript
import { createUniversalCRUDRoutes } from '@/lib/universal-crud-factory.js';

// Minimal entity routes (uses unified data gate internally)
export default async function (fastify: FastifyInstance) {
  // Creates: GET, POST, PATCH, DELETE endpoints
  createUniversalCRUDRoutes(fastify, {
    entityType: 'project',
    tableName: 'd_project',
    idField: 'id'
  });

  // Auto-create child entity endpoints
  await createChildEntityEndpointsFromMetadata(fastify, 'project');
}
```

### Pattern 4: Entity Delete with Cascading

**File:** `apps/api/src/lib/entity-delete-route-factory.ts`

**Usage:**
```typescript
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';

// Creates DELETE /api/v1/project/:id with cascading cleanup
createEntityDeleteEndpoint(fastify, 'project');
```

**What it deletes:**
1. Entity record in `d_{entity}` table (soft delete: `active_flag = false`)
2. Entity registry entry in `d_entity_instance_id`
3. Parent-child linkages in `d_entity_id_map` (both directions)
4. RBAC permissions in `entity_id_rbac_map`

---

## Step-by-Step Implementation Guide

### Example: Creating a New Entity "Vehicle" with Child "Maintenance"

#### Step 1: Create DDL File

**File:** `db/XX_d_vehicle.ddl`

```sql
-- =====================================================
-- VEHICLE ENTITY
-- =====================================================
-- SEMANTICS:
-- • Represents company vehicles (trucks, vans, equipment)
-- • Links to employees (driver), office (location), projects
-- • Has child entities: maintenance records
--
-- OPERATIONS:
-- • GET /api/v1/vehicle (list all vehicles with RBAC)
-- • GET /api/v1/vehicle/:id (get single vehicle)
-- • POST /api/v1/vehicle (create new vehicle)
-- • PATCH /api/v1/vehicle/:id (update vehicle)
-- • DELETE /api/v1/vehicle/:id (soft delete with cascade)
-- • GET /api/v1/vehicle/:id/maintenance (child endpoint - auto-generated)
-- =====================================================

CREATE TABLE app.d_vehicle (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name varchar(200) NOT NULL,
    descr text,

    -- Vehicle-specific fields
    dl__vehicle_type varchar(50), -- Lookup: Truck, Van, Equipment
    dl__vehicle_status varchar(50), -- Lookup: Active, Maintenance, Retired
    vin_number varchar(100),
    license_plate varchar(50),
    purchase_date date,
    purchase_amt numeric(15,2),

    -- Standard metadata
    metadata jsonb DEFAULT '{}'::jsonb,
    tags text[],
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version int4 DEFAULT 1
);

COMMENT ON TABLE app.d_vehicle IS 'Company vehicles with maintenance tracking';
COMMENT ON COLUMN app.d_vehicle.dl__vehicle_type IS 'Vehicle type (Truck, Van, Equipment, etc.)';
COMMENT ON COLUMN app.d_vehicle.dl__vehicle_status IS 'Current status (Active, Maintenance, Retired)';

-- Index for performance
CREATE INDEX idx_vehicle_status ON app.d_vehicle(dl__vehicle_status) WHERE active_flag = true;
CREATE INDEX idx_vehicle_code ON app.d_vehicle(code) WHERE active_flag = true;

-- =====================================================
-- SAMPLE DATA
-- =====================================================
INSERT INTO app.d_vehicle (code, name, descr, dl__vehicle_type, dl__vehicle_status, vin_number, license_plate, purchase_date, purchase_amt)
VALUES
  ('VEH-TRUCK-001', 'Ford F-150 2023', 'Main service truck', 'Truck', 'Active', '1FTFW1E50NFA12345', 'ABC-1234', '2023-01-15', 45000.00),
  ('VEH-VAN-001', 'Transit Connect 2022', 'Parts delivery van', 'Van', 'Active', '2FMDK3G98JBA67890', 'XYZ-5678', '2022-06-10', 32000.00);

-- =====================================================
-- RBAC SEED DATA
-- =====================================================
-- Grant fleet manager full access to all vehicles
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES
  ('employee', '8260b1b0-5efc-4611-ad33-ee76c0cf7f13', 'vehicle', '11111111-1111-1111-1111-111111111111', 4);
-- Permission 4 = CREATE (includes all lower permissions)
```

#### Step 2: Update d_entity Metadata

**File:** `db/entity_configuration_settings/02_entity.ddl`

```sql
-- Add entity type metadata
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order, domain_code)
VALUES (
  'vehicle',
  'Vehicle',
  'Vehicles',
  'Truck', -- Lucide icon name
  '["maintenance"]'::jsonb, -- Child entity types
  250, -- Display order in UI
  'operations'
) ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  ui_label = EXCLUDED.ui_label,
  ui_icon = EXCLUDED.ui_icon,
  child_entities = EXCLUDED.child_entities,
  display_order = EXCLUDED.display_order,
  updated_ts = now();

-- Auto-populate column metadata from schema
UPDATE app.d_entity e
SET column_metadata = (
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'orderid', c.ordinal_position,
      'name', c.column_name,
      'descr', col_description((table_schema || '.' || table_name)::regclass::oid, c.ordinal_position),
      'datatype',
        CASE
          WHEN c.data_type = 'ARRAY' THEN c.udt_name || '[]'
          WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
          ELSE c.data_type
        END,
      'is_nullable', c.is_nullable = 'YES',
      'default_value', c.column_default
    ) ORDER BY c.ordinal_position
  ), '[]'::jsonb)
  FROM information_schema.columns c
  WHERE c.table_schema = 'app' AND c.table_name = 'd_vehicle'
)
WHERE e.code = 'vehicle';
```

#### Step 3: Create Settings Tables (if needed)

**File:** `db/YY_setting_vehicle_type.ddl`

```sql
-- =====================================================
-- VEHICLE TYPE SETTINGS
-- =====================================================
CREATE TABLE app.setting_datalabel_vehicle_type (
    id serial4 PRIMARY KEY,
    label varchar(100) NOT NULL UNIQUE,
    descr text,
    icon varchar(50),
    metadata jsonb DEFAULT '{}'::jsonb,
    display_order int4 NOT NULL DEFAULT 999,
    active_flag boolean DEFAULT true
);

INSERT INTO app.setting_datalabel_vehicle_type (label, descr, icon, display_order)
VALUES
  ('Truck', 'Pickup trucks and cargo vehicles', 'Truck', 10),
  ('Van', 'Cargo vans and passenger vans', 'Bus', 20),
  ('Equipment', 'Heavy machinery and equipment', 'Construction', 30),
  ('Trailer', 'Trailers and towed equipment', 'Package', 40);

-- Similar table for vehicle_status
CREATE TABLE app.setting_datalabel_vehicle_status (
    id serial4 PRIMARY KEY,
    label varchar(100) NOT NULL UNIQUE,
    descr text,
    metadata jsonb DEFAULT '{}'::jsonb,
    display_order int4 NOT NULL DEFAULT 999,
    active_flag boolean DEFAULT true
);

INSERT INTO app.setting_datalabel_vehicle_status (label, descr, display_order)
VALUES
  ('Active', 'Vehicle in service', 10),
  ('Maintenance', 'Under repair or maintenance', 20),
  ('Reserved', 'Reserved for specific use', 30),
  ('Retired', 'No longer in service', 40);
```

#### Step 4: Create Maintenance Child Entity

**File:** `db/ZZ_d_maintenance.ddl`

```sql
CREATE TABLE app.d_maintenance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL UNIQUE,
    name varchar(200) NOT NULL,
    descr text,

    -- Maintenance fields
    dl__maintenance_type varchar(50), -- Oil Change, Tire Rotation, etc.
    scheduled_date date,
    completed_date date,
    cost_amt numeric(15,2),
    technician_id uuid, -- Links to d_employee

    -- Standard metadata
    metadata jsonb DEFAULT '{}'::jsonb,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now(),
    updated_ts timestamptz DEFAULT now(),
    version int4 DEFAULT 1
);

-- Add to d_entity
INSERT INTO app.d_entity (code, name, ui_label, ui_icon, child_entities, display_order)
VALUES (
  'maintenance',
  'Maintenance',
  'Maintenance Records',
  'Wrench',
  '[]'::jsonb, -- Leaf node - no children
  260
);
```

#### Step 5: Update db-import.sh

**File:** `tools/db-import.sh`

```bash
# Add to DDL_FILES array in correct order
DDL_FILES=(
  # ... existing files
  "XX_d_vehicle.ddl"
  "YY_setting_vehicle_type.ddl"
  "YY_setting_vehicle_status.ddl"
  "ZZ_d_maintenance.ddl"
  # ... rest of files
)
```

#### Step 6: Create API Module

**File:** `apps/api/src/modules/vehicle/routes.ts`

```typescript
/**
 * ============================================================================
 * VEHICLE ROUTES MODULE - Universal Entity Pattern with Unified Data Gate
 * ============================================================================
 *
 * SEMANTICS:
 * Company vehicle tracking with maintenance records, driver assignments,
 * and project linkages.
 *
 * DESIGN PATTERNS:
 * 1. Unified Data Gate - All operations go through unified-data-gate.ts
 * 2. Database-Driven Children - Auto-create child endpoints from d_entity
 * 3. Universal CRUD - Standard CREATE/READ/UPDATE/DELETE operations
 * 4. RBAC Inheritance - Parent-VIEW and Parent-CREATE permission inheritance
 *
 * ENDPOINTS:
 * • GET    /api/v1/vehicle           - List vehicles (RBAC filtered)
 * • GET    /api/v1/vehicle/:id       - Get single vehicle
 * • POST   /api/v1/vehicle           - Create new vehicle
 * • PATCH  /api/v1/vehicle/:id       - Update vehicle
 * • DELETE /api/v1/vehicle/:id       - Soft delete with cascade
 * • GET    /api/v1/vehicle/:id/maintenance - Child maintenance records (auto-generated)
 *
 * CHILD ENTITIES (auto-generated from d_entity):
 * • maintenance - Maintenance records for this vehicle
 * ============================================================================
 */

import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { unified_data_gate, Permission } from '../../lib/unified-data-gate.js';
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

const VehicleSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  dl__vehicle_type: Type.Optional(Type.String()),
  dl__vehicle_status: Type.Optional(Type.String()),
  vin_number: Type.Optional(Type.String()),
  license_plate: Type.Optional(Type.String()),
  purchase_date: Type.Optional(Type.String()),
  purchase_amt: Type.Optional(Type.Number()),
  metadata: Type.Optional(Type.Any()),
  tags: Type.Optional(Type.Array(Type.String())),
  active_flag: Type.Optional(Type.Boolean()),
  created_ts: Type.Optional(Type.String()),
  updated_ts: Type.Optional(Type.String())
});

export default async function (fastify: FastifyInstance) {

  // ========================================
  // LIST VEHICLES (with RBAC filtering)
  // ========================================
  fastify.get('/api/v1/vehicle', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        page: Type.Optional(Type.Integer({ minimum: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        dl__vehicle_status: Type.Optional(Type.String()),
        dl__vehicle_type: Type.Optional(Type.String()),
        office_id: Type.Optional(Type.String()), // Parent filtering
      }),
      response: {
        200: Type.Object({
          data: Type.Array(VehicleSchema),
          total: Type.Number(),
          page: Type.Number(),
          limit: Type.Number()
        })
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 20, office_id, ...filters } = request.query as any;
    const userId = request.user?.sub;

    // Use unified data gate for RBAC + filtering
    const result = await unified_data_gate({
      entityType: 'vehicle',
      operation: 'read',
      userId,
      permission: Permission.VIEW,
      parentEntityType: office_id ? 'office' : undefined,
      parentEntityId: office_id,
      pagination: { page, limit },
      filters
    });

    return result;
  });

  // ========================================
  // GET SINGLE VEHICLE
  // ========================================
  fastify.get('/api/v1/vehicle/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      response: {
        200: VehicleSchema,
        404: Type.Object({ error: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.sub;

    const result = await unified_data_gate({
      entityType: 'vehicle',
      operation: 'read',
      userId,
      permission: Permission.VIEW,
      entityId: id
    });

    if (!result.data || result.data.length === 0) {
      return reply.status(404).send({ error: 'Vehicle not found' });
    }

    return result.data[0];
  });

  // ========================================
  // CREATE VEHICLE
  // ========================================
  fastify.post('/api/v1/vehicle', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        name: Type.String(),
        code: Type.Optional(Type.String()),
        descr: Type.Optional(Type.String()),
        dl__vehicle_type: Type.Optional(Type.String()),
        dl__vehicle_status: Type.Optional(Type.String()),
        vin_number: Type.Optional(Type.String()),
        license_plate: Type.Optional(Type.String()),
        purchase_date: Type.Optional(Type.String()),
        purchase_amt: Type.Optional(Type.Number()),
        office_id: Type.Optional(Type.String()), // Parent linkage
      }),
      response: {
        201: VehicleSchema
      }
    }
  }, async (request, reply) => {
    const userId = request.user?.sub;
    const { office_id, ...vehicleData } = request.body as any;

    const result = await unified_data_gate({
      entityType: 'vehicle',
      operation: 'create',
      userId,
      permission: Permission.CREATE,
      data: vehicleData,
      parentEntityType: office_id ? 'office' : undefined,
      parentEntityId: office_id
    });

    return reply.status(201).send(result.data);
  });

  // ========================================
  // UPDATE VEHICLE
  // ========================================
  fastify.patch('/api/v1/vehicle/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' })
      }),
      body: Type.Partial(VehicleSchema),
      response: {
        200: VehicleSchema
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.sub;

    const result = await unified_data_gate({
      entityType: 'vehicle',
      operation: 'update',
      userId,
      permission: Permission.EDIT,
      entityId: id,
      data: request.body
    });

    return result.data;
  });

  // ========================================
  // DELETE VEHICLE (Soft Delete with Cascade)
  // ========================================
  // Uses universal delete factory - automatically handles:
  // 1. Soft delete in d_vehicle
  // 2. Remove from d_entity_instance_id
  // 3. Cascade delete linkages in d_entity_id_map
  // 4. Clean up RBAC permissions
  createEntityDeleteEndpoint(fastify, 'vehicle');

  // ========================================
  // CHILD ENTITY ENDPOINTS (Database-Driven)
  // ========================================
  // Auto-create all child entity endpoints from d_entity metadata
  // Reads vehicle's child_entities: ["maintenance"]
  // Creates: /api/v1/vehicle/:id/maintenance
  await createChildEntityEndpointsFromMetadata(fastify, 'vehicle');
}
```

#### Step 7: Register Module

**File:** `apps/api/src/modules/index.ts`

```typescript
import vehicleRoutes from './vehicle/routes.js';

export async function registerRoutes(fastify: FastifyInstance) {
  // ... existing route registrations

  await fastify.register(vehicleRoutes);
  fastify.log.info('✅ Vehicle routes registered');
}
```

#### Step 8: Update Entity Table Map (if needed)

**File:** `apps/api/src/lib/child-entity-route-factory.ts`

```typescript
export const ENTITY_TABLE_MAP: Record<string, string> = {
  // ... existing mappings

  vehicle: 'd_vehicle',
  maintenance: 'd_maintenance',
};
```

#### Step 9: Import Database Schema

```bash
# Import all DDL files (drops and recreates schema)
./tools/db-import.sh

# Expected output:
# ✅ Imported XX_d_vehicle.ddl
# ✅ Imported YY_setting_vehicle_type.ddl
# ✅ Imported YY_setting_vehicle_status.ddl
# ✅ Imported ZZ_d_maintenance.ddl
```

#### Step 10: Test Endpoints

```bash
# Test vehicle list
./tools/test-api.sh GET "/api/v1/vehicle"

# Test single vehicle
./tools/test-api.sh GET "/api/v1/vehicle/{id}"

# Test create vehicle
./tools/test-api.sh POST "/api/v1/vehicle" '{
  "name": "Chevrolet Silverado 2024",
  "code": "VEH-TRUCK-003",
  "dl__vehicle_type": "Truck",
  "dl__vehicle_status": "Active",
  "vin_number": "1GC4K0E70RF123456",
  "license_plate": "DEF-9012",
  "purchase_amt": 52000.00
}'

# Test child endpoint (auto-generated)
./tools/test-api.sh GET "/api/v1/vehicle/{id}/maintenance"
```

---

## RBAC & Permission Patterns

### Permission Inheritance Model

```
┌─────────────────────────────────────────────────────────────┐
│                    RBAC Permission Flow                      │
└─────────────────────────────────────────────────────────────┘

1. DIRECT PERMISSIONS
   ─────────────────
   entity_id_rbac_map
   ├─ person_entity_name = 'employee'
   ├─ person_entity_id = {user_id}
   ├─ entity_name = 'vehicle'
   ├─ entity_id = {specific_id} OR '11111111-1111-1111-1111-111111111111'
   └─ permission ∈ {0:VIEW, 1:EDIT, 2:SHARE, 3:DELETE, 4:CREATE, 5:OWNER}

2. ROLE INHERITANCE
   ────────────────
   rel_emp_role → entity_id_rbac_map
   ├─ User belongs to Role (e.g., "Fleet Manager")
   ├─ Role has permissions on 'vehicle' entity type
   └─ User inherits all role permissions

3. PARENT-VIEW INHERITANCE
   ──────────────────────
   If user has VIEW permission on parent → gains VIEW on children

   Example:
   ✓ User has VIEW on office 'Toronto Branch'
   → Auto-grants VIEW on vehicles linked to Toronto Branch
   → Query: /api/v1/vehicle?office_id={toronto_id}

4. PARENT-CREATE INHERITANCE
   ────────────────────────
   If user has CREATE permission on parent → can create + link children

   Example:
   ✓ User has CREATE on office 'Toronto Branch'
   → Can POST /api/v1/vehicle with office_id={toronto_id}
   → Auto-creates vehicle AND linkage in d_entity_id_map
```

### RBAC Seed Data Patterns

**Grant type-level CREATE (includes all lower permissions):**
```sql
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES
  ('employee', '{user_id}', 'vehicle', '11111111-1111-1111-1111-111111111111', 4);
-- Permission 4 = CREATE on ALL vehicles
```

**Grant instance-level EDIT:**
```sql
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES
  ('employee', '{user_id}', 'vehicle', '{specific_vehicle_id}', 1);
-- Permission 1 = EDIT on specific vehicle
```

**Grant role-based permissions:**
```sql
-- Step 1: Assign user to role
INSERT INTO app.rel_emp_role (emp_id, role_id) VALUES ('{user_id}', '{fleet_manager_role_id}');

-- Step 2: Grant permissions to role
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES
  ('role', '{fleet_manager_role_id}', 'vehicle', '11111111-1111-1111-1111-111111111111', 4);
```

**Grant OWNER permission (full control):**
```sql
INSERT INTO app.entity_id_rbac_map (person_entity_name, person_entity_id, entity_name, entity_id, permission)
VALUES
  ('employee', '{user_id}', 'vehicle', '{specific_vehicle_id}', 5);
-- Permission 5 = OWNER (all permissions + can grant/revoke access to others)

-- Use case: Event creator gets OWNER permission on their events
-- Use case: Project manager gets OWNER permission on their projects
-- OWNER can manage RBAC for the entity (add/remove team members)
```

---

## Child Entity Patterns

### Pattern: Auto-Generated Child Endpoints

**Database Schema:**
```sql
-- Parent entity metadata
INSERT INTO app.d_entity (code, child_entities)
VALUES ('vehicle', '["maintenance", "inspection"]'::jsonb);

-- Child entities must exist in d_entity
INSERT INTO app.d_entity (code, child_entities)
VALUES
  ('maintenance', '[]'::jsonb),
  ('inspection', '[]'::jsonb);
```

**API Implementation:**
```typescript
// One line creates ALL child endpoints
await createChildEntityEndpointsFromMetadata(fastify, 'vehicle');

// Auto-generates:
// GET /api/v1/vehicle/:id/maintenance
// GET /api/v1/vehicle/:id/inspection
```

**How it works:**
1. Queries `SELECT child_entities FROM d_entity WHERE code = 'vehicle'`
2. Gets array: `["maintenance", "inspection"]`
3. For each child:
   - Resolves table name: `maintenance` → `d_maintenance`
   - Creates endpoint with RBAC + parent filtering
   - Joins via `d_entity_id_map`:
     ```sql
     INNER JOIN d_entity_id_map eim ON eim.child_entity_id = c.id
     WHERE eim.parent_entity_id = {vehicle_id}
       AND eim.parent_entity_type = 'vehicle'
       AND eim.child_entity_type = 'maintenance'
     ```

### Pattern: Parent-Child Linkage

**Automatic linkage during CREATE:**
```typescript
// Frontend creates child and links to parent in ONE request
const newMaintenance = await unified_data_gate({
  entityType: 'maintenance',
  operation: 'create',
  userId,
  permission: Permission.CREATE,
  data: {
    name: 'Oil Change',
    dl__maintenance_type: 'Scheduled Maintenance',
    cost_amt: 89.99
  },
  parentEntityType: 'vehicle',  // Links to parent
  parentEntityId: vehicleId      // Creates row in d_entity_id_map
});
```

**Manual linkage via Linkage API:**
```bash
# Create child first
POST /api/v1/maintenance
{
  "name": "Tire Rotation",
  "cost_amt": 45.00
}
# Returns: { id: "{maintenance_id}" }

# Link to parent
POST /api/v1/linkage
{
  "parent_entity_type": "vehicle",
  "parent_entity_id": "{vehicle_id}",
  "child_entity_type": "maintenance",
  "child_entity_id": "{maintenance_id}",
  "relationship_type": "contains"
}
```

---

## Common Pitfalls & Solutions

### ❌ Pitfall 1: UUID vs TEXT Type Mismatch

**Error:** `operator does not exist: uuid = text`

**Wrong:**
```typescript
const data = await db.execute(sql`
  INNER JOIN d_entity_id_map eim ON eim.child_entity_id = c.id::text
  WHERE rbac.entity_id = ${parentId}::text
`);
```

**Correct:**
```typescript
const data = await db.execute(sql`
  INNER JOIN d_entity_id_map eim ON eim.child_entity_id = c.id
  WHERE rbac.entity_id = ${parentId}::uuid
`);
```

**Rule:** All `*_id` columns in `entity_id_rbac_map` and `d_entity_id_map` are UUID type.

### ❌ Pitfall 2: Manual Child Endpoint Repetition

**Wrong:**
```typescript
createChildEntityEndpoint(fastify, 'vehicle', 'maintenance', 'd_maintenance');
createChildEntityEndpoint(fastify, 'vehicle', 'inspection', 'd_inspection');
createChildEntityEndpoint(fastify, 'vehicle', 'repair', 'd_repair');
// What if you add a 4th child? Must update code!
```

**Correct:**
```typescript
await createChildEntityEndpointsFromMetadata(fastify, 'vehicle');
// Reads from d_entity - add child in DDL, no code changes needed
```

### ❌ Pitfall 3: Scattered RBAC Checks

**Wrong:**
```typescript
// Different RBAC logic in every endpoint
const hasAccess = await db.execute(sql`
  SELECT 1 FROM entity_id_rbac_map WHERE ...
`);

if (!hasAccess) return reply.status(403).send(...);

const vehicles = await db.execute(sql`
  SELECT * FROM d_vehicle WHERE active_flag = true
`);
```

**Correct:**
```typescript
// Centralized RBAC via unified data gate
const { data } = await unified_data_gate({
  entityType: 'vehicle',
  operation: 'read',
  userId,
  permission: Permission.VIEW
});
// RBAC + filtering handled automatically
```

### ❌ Pitfall 4: Missing Entity Registry

**Wrong:**
```typescript
// Create entity but don't register it
await db.execute(sql`
  INSERT INTO d_vehicle (name, code) VALUES (${name}, ${code})
`);
```

**Correct:**
```typescript
// Use unified data gate - auto-registers in d_entity_instance_id
await unified_data_gate({
  entityType: 'vehicle',
  operation: 'create',
  data: { name, code }
});
```

### ❌ Pitfall 5: Hardcoded Table Names

**Wrong:**
```typescript
// Won't work for 'cust' → 'd_client' or 'form' → 'd_form_head'
const tableName = `d_${entityType}`;
```

**Correct:**
```typescript
import { getEntityTableName } from '@/lib/child-entity-route-factory.js';

const tableName = getEntityTableName(entityType);
// Handles all special cases via ENTITY_TABLE_MAP
```

### ❌ Pitfall 6: Missing `sql.raw()` for Dynamic Tables

**Wrong:**
```typescript
const data = await db.execute(sql`
  SELECT * FROM app.${childTable}  // ❌ Won't interpolate
`);
```

**Correct:**
```typescript
const data = await db.execute(sql`
  SELECT * FROM app.${sql.raw(childTable)}  // ✅ Properly injects table name
`);
```

---

## Testing & Validation

### 1. Schema Validation

```bash
# Import schema and check for errors
./tools/db-import.sh --verbose

# Verify entity metadata
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c "
  SELECT code, name, child_entities, display_order
  FROM app.d_entity
  WHERE code = 'vehicle';
"

# Verify column metadata auto-populated
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c "
  SELECT jsonb_pretty(column_metadata)
  FROM app.d_entity
  WHERE code = 'vehicle';
"
```

### 2. Endpoint Testing

```bash
# Test LIST endpoint with RBAC
./tools/test-api.sh GET "/api/v1/vehicle"

# Test GET single
./tools/test-api.sh GET "/api/v1/vehicle/{id}"

# Test CREATE
./tools/test-api.sh POST "/api/v1/vehicle" '{
  "name": "Test Vehicle",
  "code": "VEH-TEST-001",
  "dl__vehicle_type": "Truck"
}'

# Test UPDATE
./tools/test-api.sh PATCH "/api/v1/vehicle/{id}" '{
  "dl__vehicle_status": "Maintenance"
}'

# Test DELETE
./tools/test-api.sh DELETE "/api/v1/vehicle/{id}"

# Test child endpoint (auto-generated)
./tools/test-api.sh GET "/api/v1/vehicle/{id}/maintenance"
```

### 3. RBAC Verification

```bash
# Check user permissions
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c "
  SELECT
    person_entity_name,
    person_entity_id,
    entity_name,
    entity_id,
    permission,
    CASE permission
      WHEN 0 THEN 'VIEW'
      WHEN 1 THEN 'EDIT'
      WHEN 2 THEN 'SHARE'
      WHEN 3 THEN 'DELETE'
      WHEN 4 THEN 'CREATE'
      WHEN 5 THEN 'OWNER'
    END as permission_name
  FROM app.entity_id_rbac_map
  WHERE entity_name = 'vehicle'
    AND active_flag = true;
"

# Test permission inheritance
# 1. Grant user VIEW on office
# 2. Create vehicle linked to office
# 3. Verify user can view vehicle via parent inheritance
```

### 4. Parent-Child Linkage Testing

```bash
# Verify linkage created
PGPASSWORD='app' psql -h localhost -p 5434 -U app -d app -c "
  SELECT
    parent_entity_type,
    parent_entity_id,
    child_entity_type,
    child_entity_id,
    relationship_type
  FROM app.d_entity_id_map
  WHERE parent_entity_type = 'vehicle'
    AND child_entity_type = 'maintenance'
    AND active_flag = true;
"

# Test child endpoint returns correct data
./tools/test-api.sh GET "/api/v1/vehicle/{vehicle_id}/maintenance"
```

### 5. API Logs Verification

```bash
# Check auto-created endpoints
./tools/logs-api.sh | grep "Creating child entity endpoint: /api/v1/vehicle"

# Should show:
# Creating child entity endpoint: /api/v1/vehicle/:id/maintenance (table: d_maintenance)

# Check summary message
./tools/logs-api.sh | grep "Auto-created.*vehicle"

# Should show:
# ✓ Auto-created 1 child entity endpoints for 'vehicle' from d_entity metadata
```

---

## Quick Reference Checklist

When implementing a new entity, ensure:

- [ ] **DDL File Created** (`db/XX_d_{entity}.ddl`)
  - [ ] Table schema with UUID `id` primary key
  - [ ] Standard columns: `code`, `name`, `descr`, `metadata`, `active_flag`, `created_ts`, `updated_ts`
  - [ ] Sample data with UUIDs
  - [ ] RBAC seed data for test user

- [ ] **Entity Metadata** (`db/entity_configuration_settings/02_entity.ddl`)
  - [ ] INSERT INTO `d_entity` with `child_entities` array
  - [ ] Auto-populate `column_metadata` from `information_schema`

- [ ] **Settings Tables** (if entity has `dl__*` fields)
  - [ ] CREATE `setting_datalabel_{field}` tables
  - [ ] Seed data with `display_order`

- [ ] **API Module** (`apps/api/src/modules/{entity}/routes.ts`)
  - [ ] Import `unified_data_gate`, `createChildEntityEndpointsFromMetadata`
  - [ ] Define TypeBox schema
  - [ ] Implement GET (list), GET (single), POST, PATCH endpoints
  - [ ] Use `createEntityDeleteEndpoint(fastify, '{entity}')`
  - [ ] Call `await createChildEntityEndpointsFromMetadata(fastify, '{entity}')`

- [ ] **Register Module** (`apps/api/src/modules/index.ts`)
  - [ ] Import and register routes
  - [ ] Add log message

- [ ] **Update Entity Map** (if custom table naming)
  - [ ] Add to `ENTITY_TABLE_MAP` in `child-entity-route-factory.ts`

- [ ] **Import Schema** (`./tools/db-import.sh`)
  - [ ] Add DDL files to `DDL_FILES` array
  - [ ] Run import script
  - [ ] Verify no errors

- [ ] **Test All Endpoints**
  - [ ] LIST with pagination
  - [ ] GET single (200 and 404)
  - [ ] CREATE (201)
  - [ ] UPDATE (200)
  - [ ] DELETE (204)
  - [ ] Child endpoints (auto-generated)

- [ ] **Verify RBAC**
  - [ ] Test with user having permissions
  - [ ] Test with user lacking permissions (expect 403)
  - [ ] Test parent-VIEW inheritance
  - [ ] Test parent-CREATE inheritance

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                     PMO ENTITY ARCHITECTURE v4.0                      │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Frontend   │────▶│   API Routes     │────▶│  Unified Data Gate │
│  (React)    │     │  /vehicle/:id    │     │  (RBAC + Filter)   │
└─────────────┘     └──────────────────┘     └────────────────────┘
                              │                         │
                              │                         ▼
                              │               ┌──────────────────────┐
                              │               │ Permission Check     │
                              │               │ • Direct (employee)  │
                              │               │ • Role inheritance   │
                              │               │ • Parent-VIEW inherit│
                              └──────────────▶│ • Parent-CREATE      │
                                              └──────────────────────┘
                                                        │
                                                        ▼
                                              ┌──────────────────────┐
                                              │  Database Tables     │
                                              ├──────────────────────┤
                                              │ d_vehicle            │
                                              │ d_entity_id_map      │
                                              │ entity_id_rbac_map   │
                                              │ d_entity_instance_id │
                                              └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    CHILD ENTITY AUTO-GENERATION                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│ d_entity table   │
│ code: 'vehicle'  │
│ child_entities:  │────┐
│ ["maintenance"]  │    │
└──────────────────┘    │
                        ▼
            ┌───────────────────────────┐
            │ createChildEntityEndpoints│
            │ FromMetadata()            │
            └───────────────────────────┘
                        │
                        ├─ Query d_entity for children
                        ├─ Resolve table names (ENTITY_TABLE_MAP)
                        ├─ Create GET /vehicle/:id/maintenance
                        └─ Apply RBAC + parent filtering

                        ▼
            ┌───────────────────────────┐
            │ Auto-generated endpoint:  │
            │ GET /vehicle/:id/maintenance│
            └───────────────────────────┘
```

---

## Additional Resources

- **Unified Data Gate:** `apps/api/src/lib/unified-data-gate.ts`
- **Child Entity Factory:** `apps/api/src/lib/child-entity-route-factory.ts`
- **Universal CRUD Factory:** `apps/api/src/lib/universal-crud-factory.ts`
- **Entity Delete Factory:** `apps/api/src/lib/entity-delete-route-factory.ts`
- **Entity Config (Frontend):** `apps/web/src/lib/entityConfig.ts`
- **Database Schema Docs:** `docs/datamodel/datamodel.md`
- **RBAC Documentation:** `docs/rbac/`
- **Tools Documentation:** `docs/tools.md`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 4.0 | 2025-11-15 | Database-driven child endpoints, unified data gate, UUID type safety |
| 3.1 | 2025-11-04 | Column consistency pattern, field detection v2 |
| 3.0 | 2025-10-20 | Universal entity system, RBAC migration to API |
| 2.0 | 2025-09-15 | Settings normalization, snake_case audit |
| 1.0 | 2025-08-01 | Initial entity system |

---

**End of Design Pattern Guide**
