# PMO Enterprise Platform - LLM Technical Reference

> Production-ready Canadian home services management system with transactional CRUD, unified RBAC, and config-driven entity system

## Platform Specifications

- **Architecture**: 3 universal pages handle 27+ entity types dynamically
- **Database**: PostgreSQL 14+ with 50 tables (46 DDL files)
- **Backend**: Fastify v5, TypeScript ESM, JWT, 45 API modules
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **State Management**: Zustand stores + TanStack Query (format-at-read pattern)
- **Infrastructure**: AWS EC2/S3/Lambda, Terraform, Docker
- **Version**: 8.3.2 (ref_data_entityInstance Pattern + Metadata-Based Resolution + BadgeDropdownSelect)

## Critical Operations

```bash
# MANDATORY: Use tools in /tools/ directory
./tools/start-all.sh                  # Start platform (Docker + API + Web)
./tools/db-import.sh                  # Import/reset 50 tables (run after DDL changes)
./tools/test-api.sh GET /api/v1/project  # Test endpoints with auth
./tools/logs-api.sh -f               # Monitor logs
```

**Test Credentials**: `james.miller@huronhome.ca` / `password123`

---

## 1. Entity Infrastructure Service (Transactional CRUD)

**Location**: `apps/api/src/services/entity-infrastructure.service.ts`

**Purpose**: Centralized management of 4 infrastructure tables with **transactional CRUD operations**. All multi-step operations wrapped in database transactions for atomicity.

### 4 Infrastructure Tables

```sql
entity                   -- Entity type metadata (icons, labels, child_entity_codes)
entity_instance          -- Instance registry (entity_instance_name, code cache)
entity_instance_link     -- Parent-child relationships (hard delete only)
entity_rbac              -- Permissions (0=VIEW, 1=EDIT, 2=SHARE, 3=DELETE, 4=CREATE, 5=OWNER)
```

### Transactional Methods (Primary API)

| Method | Purpose | Operations in Transaction |
|--------|---------|---------------------------|
| `create_entity()` | Create entity with all infrastructure | INSERT primary + registry + RBAC + link |
| `update_entity()` | Update entity with registry sync | UPDATE primary + registry sync |
| `delete_entity()` | Delete entity with cleanup | DELETE/deactivate + registry + links + RBAC |

### CREATE Pattern (Transactional)

```typescript
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '@/services/entity-infrastructure.service.js';

const ENTITY_CODE = 'project';
const entityInfra = getEntityInfrastructure(db);

fastify.post('/api/v1/project', async (request, reply) => {
  const userId = request.user.sub;
  const { parent_code, parent_id } = request.query;
  const data = request.body;

  // Step 1: RBAC Check - Can user CREATE?
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) return reply.status(403).send({ error: 'Forbidden' });

  // Step 2: RBAC Check - Can user EDIT parent? (if linking)
  if (parent_code && parent_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parent_code, parent_id, Permission.EDIT
    );
    if (!canEditParent) return reply.status(403).send({ error: 'Forbidden' });
  }

  // Step 3: Transactional CREATE (all 4 ops in ONE transaction)
  const result = await entityInfra.create_entity({
    entity_code: ENTITY_CODE,
    creator_id: userId,
    parent_entity_code: parent_code,
    parent_entity_id: parent_id,
    primary_table: 'app.project',
    primary_data: {
      code: data.code,
      name: data.name,
      descr: data.descr,
      budget_allocated_amt: data.budget_allocated_amt
    }
  });

  return reply.status(201).send(result.entity);
});
```

### UPDATE Pattern (Transactional)

```typescript
fastify.patch('/api/v1/project/:id', async (request, reply) => {
  const userId = request.user.sub;
  const { id } = request.params;
  const updates = request.body;

  // Step 1: RBAC Check - Can user EDIT?
  const canEdit = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, id, Permission.EDIT
  );
  if (!canEdit) return reply.status(403).send({ error: 'Forbidden' });

  // Step 2: Transactional UPDATE (UPDATE + registry sync in ONE transaction)
  const result = await entityInfra.update_entity({
    entity_code: ENTITY_CODE,
    entity_id: id,
    primary_table: 'app.project',
    primary_updates: updates
  });

  return reply.send(result.entity);
});
```

### DELETE Pattern (Transactional)

```typescript
// Using factory (recommended)
createEntityDeleteEndpoint(fastify, 'project');

// Or manual:
fastify.delete('/api/v1/project/:id', async (request, reply) => {
  const result = await entityInfra.delete_entity({
    entity_code: ENTITY_CODE,
    entity_id: id,
    user_id: userId,
    primary_table: 'app.project',
    hard_delete: false  // soft delete
  });
  return reply.send(result);
});
```

### Helper Methods (for routes not using transactional pattern)

```typescript
// Register entity in registry
async set_entity_instance_registry(params: {
  entity_code: string;           // Entity TYPE code, e.g., 'project'
  entity_id: string;             // Entity instance UUID
  entity_name: string;           // Display name for lookups
  instance_code?: string | null; // Record code, e.g., 'PROJ-001'
}): Promise<EntityInstance>

// Update registry when name/code changes
async update_entity_instance_registry(
  entity_code: string,           // Entity TYPE code
  entity_id: string,             // Entity instance UUID
  updates: {
    entity_name?: string;        // New display name
    instance_code?: string | null; // New record code
  }
): Promise<EntityInstance | null>

// Create parent-child linkage
async set_entity_instance_link(params: {
  entity_code: string;              // Parent entity TYPE code
  entity_instance_id: string;       // Parent entity UUID
  child_entity_code: string;        // Child entity TYPE code
  child_entity_instance_id: string; // Child entity UUID
  relationship_type?: string;       // Default: 'contains'
}): Promise<EntityLink>
```

### Naming Convention (Critical)

| Parameter | Meaning | Example |
|-----------|---------|---------|
| `entity_code` | Entity TYPE code | `'project'`, `'task'`, `'employee'` |
| `entity_id` | Entity instance UUID | `'uuid-here'` |
| `instance_code` | Record/business code | `'PROJ-001'`, `'TASK-042'` |
| `entity_name` | Display name | `'Kitchen Renovation'` |

---

## 2. RBAC Pattern (Person-Based Permissions)

### Permission Hierarchy

```typescript
export enum Permission {
  VIEW   = 0,  // Read-only access
  EDIT   = 1,  // Modify entity (implies VIEW)
  SHARE  = 2,  // Share with others (implies EDIT, VIEW)
  DELETE = 3,  // Soft delete (implies SHARE, EDIT, VIEW)
  CREATE = 4,  // Create new (type-level only)
  OWNER  = 5   // Full control (implies ALL)
}

// Type-level permission constant
export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
```

### Permission Resolution (4 Sources)

```
1. Direct Employee Permissions    → entity_rbac WHERE person_code='employee'
2. Role-Based Permissions         → entity_rbac WHERE person_code='role'
3. Parent-VIEW Inheritance        → If parent has VIEW, child gains VIEW
4. Parent-CREATE Inheritance      → If parent has CREATE, child gains CREATE

Result: MAX permission level from all 4 sources
```

### RBAC Check Methods

```typescript
// Check specific permission
const canEdit = await entityInfra.check_entity_rbac(
  userId,           // Person UUID
  'project',        // Entity type code
  projectId,        // Entity instance ID (or ALL_ENTITIES_ID for type-level)
  Permission.EDIT   // Required permission
);

// Get SQL WHERE clause for filtering
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  userId,           // Person UUID
  'project',        // Entity type code
  Permission.VIEW,  // Required permission
  'e'               // Table alias
);

// Use in query
const projects = await db.execute(sql`
  SELECT e.* FROM app.project e
  WHERE ${rbacCondition} AND e.active_flag = true
`);
```

---

## 3. API Design Pattern

### Standard Endpoints

```typescript
GET    /api/v1/{entity}              // List with pagination + RBAC
GET    /api/v1/{entity}/{id}         // Get single (VIEW check)
POST   /api/v1/{entity}              // Create (CREATE check + optional parent link)
PATCH  /api/v1/{entity}/{id}         // Update (EDIT check)
DELETE /api/v1/{entity}/{id}         // Soft delete (DELETE check)
GET    /api/v1/{parent}/{id}/{child} // Filtered children (factory-generated)
```

### Required Imports (Standard Block)

```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';
import { sql } from 'drizzle-orm';

// Entity Infrastructure Service
import {
  getEntityInfrastructure,
  Permission,
  ALL_ENTITIES_ID
} from '@/services/entity-infrastructure.service.js';

// Universal Auto-Filter Builder
import { buildAutoFilters } from '@/lib/universal-filter-builder.js';

// Factory Functions
import { createEntityDeleteEndpoint } from '@/lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '@/lib/child-entity-route-factory.js';
```

### Module Constants (DRY Principle)

```typescript
const ENTITY_CODE = 'project';  // Used in RBAC, queries, messages
const TABLE_ALIAS = 'e';        // Consistent SQL alias
```

### LIST Pattern with Auto-Filters

```typescript
fastify.get('/api/v1/project', async (request, reply) => {
  const { limit = 20, offset = 0 } = request.query;
  const userId = request.user.sub;

  const conditions: SQL[] = [];

  // RBAC filtering
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, TABLE_ALIAS
  );
  conditions.push(rbacCondition);

  // Active records only
  conditions.push(sql`${sql.raw(TABLE_ALIAS)}.active_flag = true`);

  // Auto-filters from query params
  const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query, {
    searchFields: ['name', 'descr', 'code']
  });
  conditions.push(...autoFilters);

  // Route owns query structure
  const projects = await db.execute(sql`
    SELECT e.*, b.name as business_name
    FROM app.project e
    LEFT JOIN app.business b ON e.business_id = b.id
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return reply.send({ data: projects, total, limit, offset });
});
```

### Auto-Filter Detection

| Query Param | Detection | SQL Generated |
|-------------|-----------|---------------|
| `?dl__project_stage=planning` | Settings dropdown | `e.dl__project_stage = 'planning'` |
| `?manager_employee_id=uuid` | UUID reference | `e.manager_employee_id = 'uuid'::uuid` |
| `?budget_allocated_amt=50000` | Currency | `e.budget_allocated_amt = 50000` |
| `?active_flag=true` | Boolean | `e.active_flag = true` |
| `?search=kitchen` | Multi-field | `(e.name ILIKE '%kitchen%' OR ...)` |

---

## 4. Backend Formatter Service (Metadata Generation)

**Location**: `apps/api/src/services/backend-formatter.service.ts`

**Purpose**: Generate complete field metadata from database column names using 35+ pattern rules. **Backend is single source of truth** for all field rendering.

### Pattern Detection Rules

| Pattern | renderType | inputType | Example |
|---------|------------|-----------|---------|
| `*_amt`, `*_price`, `*_cost` | `currency` | `currency` | Budget field |
| `dl__*` | `badge` | `select` | Status dropdown |
| `*_date` | `date` | `date` | Date picker |
| `*_ts`, `*_at` | `timestamp` | `datetime` | DateTime picker |
| `is_*`, `*_flag` | `boolean` | `checkbox` | Toggle |
| `*__employee_id` | `reference` | `select` | Entity dropdown |
| `metadata` | `json` | `json` | JSON editor |
| `*_pct` | `percentage` | `number` | Percentage |
| `tags` | `array` | `tags` | Tag input |

### Usage in Routes

```typescript
import { getEntityMetadata } from '@/services/backend-formatter.service.js';

fastify.get('/api/v1/project', async (request, reply) => {
  const projects = await db.execute(sql`SELECT * FROM app.project...`);

  // Generate metadata from first row
  const fieldMetadata = projects.length > 0
    ? getEntityMetadata('project', projects[0])
    : getEntityMetadata('project');

  return {
    data: projects,
    metadata: fieldMetadata,  // Frontend uses this to render
    total, limit, offset
  };
});
```

### Response Structure (v8.3.2)

```json
{
  "data": [
    {
      "id": "uuid",
      "budget_allocated_amt": 50000,
      "manager__employee_id": "uuid-james",
      "dl__project_stage": "planning"
    }
  ],
  "ref_data_entityInstance": {
    "employee": { "uuid-james": "James Miller" }
  },
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "style": { "symbol": "$", "decimals": 2 }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager",
          "renderType": "entityInstanceId",
          "lookupEntity": "employee",
          "lookupSource": "entityInstance"
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "datalabelKey": "project_stage"
        }
      },
      "editType": {
        "manager__employee_id": {
          "inputType": "entityInstanceId",
          "lookupEntity": "employee",
          "lookupSource": "entityInstance"
        },
        "dl__project_stage": {
          "inputType": "BadgeDropdownSelect",
          "lookupSource": "datalabel",
          "datalabelKey": "project_stage"
        }
      }
    }
  }
}
```

---

## 5. State Management (Frontend) - v8.3.2 Format-at-Read + ref_data_entityInstance

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                State Architecture (v8.3.2)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │  Zustand Stores │     │  TanStack Query │               │
│  │  (Client State) │     │  (Server State) │               │
│  └────────┬────────┘     └────────┬────────┘               │
│           │                       │                          │
│  • UI State (modals, tabs)       • RAW data + ref_data_entityInstance       │
│  • Form state                    • Format via `select`       │
│  • Selection state               • Optimistic updates        │
│  • Filters/pagination            • O(1) reference resolution │
│                                                              │
└─────────────────────────────────────────────────────────────┘

FORMAT-AT-READ + ref_data_entityInstance PATTERN:
───────────────────────────────────
API → Cache RAW + ref_data_entityInstance → select: formatDataset() → FormattedRow[]
                              │
                              ├── React Query memoizes
                              └── Entity refs resolved via ref_data_entityInstance[entityCode][uuid]
```

### Key Hooks

```typescript
// apps/web/src/lib/hooks/useEntityQuery.ts

// RAW data (for components that need raw)
const { data } = useEntityInstanceList(entityCode, params);
// Returns: { data: T[], ref_data_entityInstance: RefData, metadata }

// FORMATTED data via select (recommended)
const { data: formattedData } = useFormattedEntityList(entityCode, params);
// Returns: FormattedRow[] with display/styles

// Entity reference resolution (v8.3.0)
import { useRefData } from '@/lib/hooks';
const { resolveFieldDisplay, isRefField } = useRefData(data?.ref_data_entityInstance);

// Resolve using metadata (NOT field name pattern)
const fieldMeta = metadata.viewType.manager__employee_id;
resolveFieldDisplay(fieldMeta, uuid);  // → "James Miller"
```

### Format-at-Read Implementation

```typescript
// useFormattedEntityList - uses select for format-at-read
export function useFormattedEntityList(entityCode: string, params: Params) {
  return useQuery({
    queryKey: ['entity-list', entityCode, params],
    queryFn: () => api.get(`/api/v1/${entityCode}`, { params }),
    // select transforms raw → formatted ON READ (memoized)
    select: (response) => ({
      ...response,
      data: formatDataset(response.data, response.metadata?.entityDataTable)
    })
  });
}

// FormattedRow structure
interface FormattedRow<T> {
  raw: T;                           // Original values (for editing)
  display: Record<string, string>;  // Pre-formatted strings
  styles: Record<string, string>;   // CSS classes (badges)
}
```

### Benefits vs Format-at-Fetch

| Aspect | Format-at-Fetch (v7) | Format-at-Read (v8) |
|--------|---------------------|---------------------|
| Cache size | Larger (formatted strings) | Smaller (raw only) |
| Datalabel updates | Requires invalidation | Instant (re-format) |
| Multiple views | Separate caches | Same cache |
| React Query | N/A | Auto-memoized |

---

## 6. Component Architecture

### Universal Page Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    3 Universal Pages                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  EntityListOfInstancesPage.tsx                               │
│  ├── EntityDataTable (list/grid view)                       │
│  ├── KanbanBoard (kanban view)                              │
│  └── CalendarView (calendar view)                           │
│                                                              │
│  EntitySpecificInstancePage.tsx                              │
│  ├── EntityDetailView (header + fields)                     │
│  └── DynamicChildEntityTabs (child entities)                │
│                                                              │
│  EntityFormPage.tsx                                          │
│  └── EntityFormContainer (auto-generated form)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Matrix

| Use Case | Component | Data Source |
|----------|-----------|-------------|
| Entity lists | `EntityDataTable` | API + metadata |
| Entity details | `EntityDetailView` | API + metadata |
| Forms | `EntityFormContainer` | API + metadata |
| Workflows | `DAGVisualizer` | `dl__*_stage` fields |
| Child tabs | `DynamicChildEntityTabs` | `entity.child_entity_codes` |
| Kanban | `KanbanBoard` | Status field grouping |
| Calendar | `CalendarView` | Date field events |
| Settings | `SettingsDataTable` | `datalabel_*` tables |

### Frontend Formatter Service (Pure Renderer)

**Location**: `apps/web/src/lib/frontEndFormatterService.tsx`

**Purpose**: Consume backend metadata and render React elements with **ZERO pattern detection**. Frontend is dumb, backend is smart.

```typescript
import {
  renderViewModeFromMetadata,
  renderEditModeFromMetadata,
} from '@/lib/frontEndFormatterService';

// View mode - backend says renderType: 'currency'
renderViewModeFromMetadata(50000, fieldMeta)
// Returns: <span className="font-mono">$50,000.00</span>

// Edit mode - backend says inputType: 'currency'
renderEditModeFromMetadata(50000, fieldMeta, onChange)
// Returns: <input type="number" step="0.01" />
```

### EntityConfig

```typescript
// apps/web/src/lib/entityConfig.ts
export const entityConfig: Record<string, EntityConfigEntry> = {
  project: {
    label: 'Project',
    labelPlural: 'Projects',
    icon: 'folder',
    columns: ['name', 'code', 'dl__project_stage', 'budget_allocated_amt'],
    defaultSort: { field: 'created_ts', order: 'desc' },
    searchFields: ['name', 'code', 'descr'],
  },
  // ... other entities
};
```

---

## 7. Data Model Architecture

### Table Prefixes

```sql
d_*           -- Core entity tables (d_project, d_task, d_employee)
datalabel_*   -- Settings/lookup tables (datalabel_project_stage)
entity*       -- Infrastructure tables (entity, entity_instance, entity_rbac)
```

### Field Naming Conventions

```
*_amt         → Currency field
*_date        → Date field
*_ts          → Timestamp field
dl__*         → Settings dropdown (links to datalabel_*)
is_*          → Boolean toggle
*_flag        → Boolean flag
*__entity_id  → Entity reference (e.g., manager__employee_id)
tags          → Array field
metadata      → JSON field
*_pct         → Percentage
```

### Standard Entity Fields

```sql
CREATE TABLE app.d_entity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE,           -- Business code (PROJ-001)
  name VARCHAR(255) NOT NULL,        -- Display name
  descr TEXT,                        -- Description
  metadata JSONB DEFAULT '{}',       -- Extensible JSON
  active_flag BOOLEAN DEFAULT true,  -- Soft delete
  from_ts TIMESTAMP DEFAULT now(),   -- Valid from
  to_ts TIMESTAMP,                   -- Valid until
  created_ts TIMESTAMP DEFAULT now(),
  updated_ts TIMESTAMP DEFAULT now(),
  version INTEGER DEFAULT 1
);
```

---

## Quick Reference

### Adding New Entity

1. **Database**: Create `db/[entity].ddl`
2. **Entity Metadata**: Add to `entity` table
3. **API Module**: Create `apps/api/src/modules/[entity]/routes.ts`
   - Use transactional `create_entity()`, `update_entity()`, `delete_entity()`
4. **Frontend**: Add to `apps/web/src/lib/entityConfig.ts`
5. **Import**: Run `./tools/db-import.sh`
6. **Test**: `./tools/test-api.sh GET /api/v1/[entity]`

### Anti-Patterns (Avoid)

- Creating entity-specific pages/components
- Hardcoding dropdown options
- Adding foreign keys (use entity_instance_link)
- Manual field formatting (use backend metadata)
- Non-transactional CREATE/UPDATE/DELETE
- Using `entity_code` for instance code (use `instance_code`)
- **Pattern detection in frontend** (use `metadata.lookupEntity` instead of `_id` suffix checks)
- **Per-row `_ID` embedded objects** (use `ref_data_entityInstance` lookup table)

### Flow Diagrams

```
CREATE Flow (Transactional)
───────────────────────────
Request → RBAC Check (CREATE) → RBAC Check (EDIT parent) → TRANSACTION {
  INSERT primary table
  INSERT entity_instance
  INSERT entity_rbac (OWNER)
  INSERT entity_instance_link (if parent)
} → Response

DELETE Flow (Transactional)
───────────────────────────
Request → RBAC Check (DELETE) → TRANSACTION {
  UPDATE/DELETE primary table
  DELETE entity_instance
  DELETE entity_instance_link (as parent & child)
  DELETE entity_rbac
} → Response
```

---

## 8. Documentation Index (LLM Reference)

### Core Documentation Files

| Document | Path | Purpose |
|----------|------|---------|
| **RBAC_INFRASTRUCTURE.md** | `docs/rbac/` | RBAC tables, permissions, patterns |
| **entity-infrastructure.service.md** | `docs/services/` | Entity infrastructure service API + build_ref_data_entityInstance |
| **STATE_MANAGEMENT.md** | `docs/state_management/` | Zustand + React Query architecture |
| **PAGE_ARCHITECTURE.md** | `docs/pages/` | Page components and routing |
| **backend-formatter.service.md** | `docs/services/` | Backend metadata generation (BFF) |
| **frontEndFormatterService.md** | `docs/services/` | Frontend rendering (pure renderer) |
| **RefData README.md** | `docs/refData/` | Entity reference resolution pattern |

### 1. RBAC_INFRASTRUCTURE.md

Unified RBAC documentation covering all 4 infrastructure tables (entity, entity_instance, entity_instance_link, entity_rbac). Used by API routes for permission checking and by LLMs when implementing RBAC features.

**Keywords:** `RBAC`, `permissions`, `entity_rbac`, `entity_instance_link`, `entity_instance`, `Permission enum`, `VIEW`, `COMMENT`, `CONTRIBUTE`, `EDIT`, `SHARE`, `DELETE`, `CREATE`, `OWNER`, `ALL_ENTITIES_ID`, `check_entity_rbac`, `set_entity_rbac_owner`, `get_entity_rbac_where_condition`, `hard delete`, `soft delete`, `person-based RBAC`, `role-based permissions`

### 2. entity-infrastructure.service.md

Core service documentation for centralized entity infrastructure management. Used by all entity route handlers for registry operations, linkage, and RBAC enforcement.

**Keywords:** `EntityInfrastructureService`, `set_entity_instance_registry`, `update_entity_instance_registry`, `delete_entity_instance_registry`, `set_entity_instance_link`, `get_entity_instance_link_children`, `delete_entity_instance_link`, `Permission levels 0-7`, `parent_entity_code`, `child_entity_code`, `idempotent`, `transactional methods`, `create_entity`, `update_entity`, `delete_entity`, `build_ref_data_entityInstance`, `ref_data_entityInstance`

### 3. STATE_MANAGEMENT.md

Zustand + React Query hybrid architecture for client-side state management and caching. Used by frontend components for data fetching, caching, and edit state tracking.

**Keywords:** `Zustand`, `React Query`, `9 stores`, `session-level cache`, `URL-bound cache`, `30 min TTL`, `5 min TTL`, `globalSettingsMetadataStore`, `datalabelMetadataStore`, `entityCodeMetadataStore`, `EntityListOfInstancesDataStore`, `EntitySpecificInstanceDataStore`, `entityComponentMetadataStore`, `editStateStore`, `dirtyFields`, `optimistic updates`, `cache invalidation`, `field-level tracking`, `minimal PATCH`, `prefetching`, `ref_data_entityInstance`, `useRefData`, `entity reference resolution`, `lookupEntity`, `metadata-based detection`

### 4. PAGE_ARCHITECTURE.md

Comprehensive page and component architecture documentation. Used by LLMs when implementing new pages, understanding navigation flow, or modifying existing components.

**Keywords:** `EntityListOfInstancesPage`, `EntitySpecificInstancePage`, `EntityCreatePage`, `EntityChildListPage`, `SettingsOverviewPage`, `SettingDetailPage`, `WikiViewPage`, `WikiEditorPage`, `FormBuilderPage`, `FilteredDataTable`, `EntityFormContainer`, `SettingsDataTable`, `WikiDesigner`, `DynamicChildEntityTabs`, `Layout`, `ViewSwitcher`, `KanbanView`, `GridView`, `CalendarView`, `FilePreview`, `DragDropFileUpload`, `InteractiveForm`, `entityConfig.ts`, `universal pages`, `config-driven`, `Create-Link-Redirect`, `parent context`, `child entity tabs`, `datalabel URL conversion`, `position-based IDs`, `block editor`, `Notion-style`

---

**Version**: 8.3.2 | **Updated**: 2025-11-27 | **Pattern**: Format-at-Read + ref_data_entityInstance

**Recent Updates**:
- v8.3.2 (2025-11-27): **Component-Driven Rendering + BadgeDropdownSelect**
  - Added `BadgeDropdownSelect` component for colored datalabel dropdowns
  - viewType controls WHICH component renders (`renderType: 'component'` + `component`)
  - editType controls WHERE data comes from (`lookupSource: 'datalabel'` + `datalabelKey`)
  - `vizContainer: { view?: string; edit?: string }` structure for custom components
  - DAG fields use `renderType: 'component'` + `component: 'DAGVisualizer'`
- v8.3.1 (2025-11-26): **Metadata-Based Reference Resolution**
  - Removed all pattern matching from `refDataResolver.ts`
  - Frontend uses `metadata.lookupEntity` (no `_id` suffix detection)
  - Added `isEntityReferenceField(fieldMeta)`, `getEntityCodeFromMetadata(fieldMeta)`
  - Backend metadata is single source of truth for field type detection
- v8.3.0 (2025-11-26): **ref_data_entityInstance Pattern**
  - Added `ref_data_entityInstance` to API responses for O(1) entity reference resolution
  - Added `build_ref_data_entityInstance()` method to entity-infrastructure.service
  - Added `useRefData` hook for reference resolution utilities
  - Deprecated per-row `_ID/_IDS` embedded object pattern
- v8.0.0 (2025-11-23): **Format-at-Read Pattern**
  - Changed from format-at-fetch to format-at-read using React Query's `select` option
  - Cache stores RAW data only (smaller, canonical)
  - Added `useFormattedEntityList()` hook for formatted data
  - `select` transforms raw → FormattedRow on read (memoized by React Query)
- v5.0.0 (2025-11-22): **Transactional CRUD Pattern**
  - Added `create_entity()`, `update_entity()`, `delete_entity()` transactional methods
  - Parameter naming: `entity_code` = TYPE, `instance_code` = record code
- v4.0.0 (2025-11-21): Entity Infrastructure Service standardization
