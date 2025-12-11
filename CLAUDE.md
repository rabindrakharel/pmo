# PMO Enterprise Platform - LLM Technical Reference

> Production-ready Canadian home services management system with transactional CRUD, unified RBAC, config-driven entity system, and real-time WebSocket sync

## Platform Specifications

- **Architecture**: 3 universal pages handle 27+ entity types dynamically
- **Database**: PostgreSQL 14+ with 50 tables (46 DDL files)
- **Backend**: Fastify v5, TypeScript ESM, JWT, 45 API modules
- **PubSub Service**: WebSocket server for real-time sync (port 4001)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **State Management**: TanStack Query + Dexie (offline-first IndexedDB) - server state + persistence
- **Infrastructure**: AWS EC2/S3/Lambda, Terraform, Docker
- **Version**: 10.1.0 (Role-Only RBAC v2.1.0 + Permission Matrix + DB-Driven List Config + Dexie v4 Schema)

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
entity                   -- Entity type metadata (icons, labels, child_entity_codes, config_datatable) - HAS active_flag
entity_instance          -- Instance registry (entity_instance_name, code cache) - HARD DELETE, NO active_flag
entity_instance_link     -- Parent-child relationships - HARD DELETE, NO active_flag
entity_rbac              -- Permissions (0-7: VIEW, COMMENT, CONTRIBUTE, EDIT, SHARE, DELETE, CREATE, OWNER) - HARD DELETE, NO active_flag
```

**Entity Table Key Columns (v10.1.0)**:
- `config_datatable` JSONB: List view settings `{defaultSort, defaultSortOrder, itemsPerPage}` - DB-driven, cached in-memory

**Delete Semantics**:
- `entity` (type metadata): Soft delete with `active_flag`
- `entity_instance`, `entity_instance_link`, `entity_rbac`: **Hard delete** (transactional tables, no `active_flag`)

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
    hard_delete: false  // soft delete for PRIMARY table only
  });
  // NOTE: entity_instance, entity_instance_link, entity_rbac are ALWAYS hard-deleted
  // The hard_delete param only affects the primary table (e.g., app.project)
  return reply.send(result);
});
```

### UNLINK Pattern (Relationship Only)

Removes parent-child relationship without deleting the child entity. Used in child entity tabs.

| Operation | Primary Table | entity_instance | entity_instance_link | entity_rbac |
|-----------|---------------|-----------------|---------------------|-------------|
| **Unlink** | Untouched | Untouched | DELETE | Untouched |
| **Delete** | DELETE | DELETE | DELETE (all) | DELETE |

```typescript
// Unlink endpoint: DELETE /api/v1/{parent}/{parentId}/{child}/{childId}/link
fastify.delete('/api/v1/:parentEntity/:parentId/:childEntity/:childId/link', async (request, reply) => {
  const { parentEntity, parentId, childEntity, childId } = request.params;
  const userId = request.user.sub;

  // RBAC: Check EDIT on PARENT (unlinking modifies parent's child list)
  const canEditParent = await entityInfra.check_entity_rbac(
    userId, parentEntity, parentId, Permission.EDIT
  );
  if (!canEditParent) return reply.status(403).send({ error: 'Forbidden' });

  // Delete link only - child entity remains in system
  await entityInfra.delete_entity_instance_link({
    entity_code: parentEntity,
    entity_instance_id: parentId,
    child_entity_code: childEntity,
    child_entity_instance_id: childId
  });

  return reply.send({ success: true, action: 'unlinked' });
});
```

**RBAC for Unlink vs Delete:**
- **Unlink**: Requires `EDIT` on **parent** entity (modifying parent's children)
- **Delete**: Requires `DELETE` on **child** entity (destroying the entity)

See: `docs/ui_components/DeleteOrUnlinkModal.md` for full UI/UX documentation.

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

## 2. RBAC Pattern (Role-Only Model v2.0.0)

### Architecture

All permissions are granted to **roles** (not directly to employees). People receive permissions through role membership via `entity_instance_link`.

```
app.role → entity_rbac (permissions) → entity (targets)
    ↓
entity_instance_link (role → person membership)
    ↓
app.person
```

### Permission Hierarchy

```typescript
export enum Permission {
  VIEW       = 0,  // Read-only access
  COMMENT    = 1,  // Add comments (implies VIEW)
  CONTRIBUTE = 2,  // Insert form data (implies COMMENT)
  EDIT       = 3,  // Modify entity (implies CONTRIBUTE)
  SHARE      = 4,  // Share with others (implies EDIT)
  DELETE     = 5,  // Soft delete (implies SHARE)
  CREATE     = 6,  // Create new (type-level only)
  OWNER      = 7   // Full control (implies ALL)
}

// Type-level permission constant
export const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';
```

### Inheritance Modes (v2.0.0)

| Mode | Description |
|------|-------------|
| `none` | Permission applies only to target entity |
| `cascade` | Same permission flows to all child entities |
| `mapped` | Different permissions per child type via `child_permissions` JSONB |

### Permission Resolution Flow

```
1. Find person's roles        → entity_instance_link WHERE entity_code='role'
2. Check explicit deny        → entity_rbac WHERE is_deny=true (blocks all)
3. Get direct role permissions → entity_rbac WHERE role_id IN (person_roles)
4. Get inherited permissions  → Ancestor permissions with cascade/mapped modes
5. Return MAX of all sources  → >= required level ? ALLOWED : DENIED
```

### RBAC Check Methods

```typescript
// Check specific permission
const canEdit = await entityInfra.check_entity_rbac(
  personId,         // Person UUID (from app.person)
  'project',        // Entity type code
  projectId,        // Entity instance ID (or ALL_ENTITIES_ID for type-level)
  Permission.EDIT   // Required permission
);

// Get SQL WHERE clause for filtering
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  personId,         // Person UUID
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

// Universal Entity CRUD Factory (consolidated)
import {
  createUniversalEntityRoutes,
  createEntityDeleteEndpoint,
  ENTITY_TABLE_MAP
} from '@/lib/universal-entity-crud-factory.js';
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

## 4. Entity Component Metadata Service (Metadata Generation)

**Location**: `apps/api/src/services/entity-component-metadata.service.ts`

**Purpose**: Generate complete field metadata from database column names using 35+ pattern rules. **Backend is single source of truth** for all field rendering.

### Redis Field Name Caching (v9.2.0)

Field names are cached in Redis to ensure metadata generation works even for empty result sets (e.g., child entity tabs with no data):

```
Cache Key: entity:fields:{entityCode}  (e.g., entity:fields:task)
TTL: 24 hours
Fallback: PostgreSQL result columns via postgres.js 'columns' property
```

| Tier | Source | When Used |
|------|--------|-----------|
| 1 | Redis Cache | Cache hit - fastest path |
| 2 | Data Row | Cache miss + data exists |
| 3 | PostgreSQL Columns | Cache miss + data empty |

### Pattern Detection Rules (YAML-Based v11.0.0+)

**Architecture**: Column name → YAML pattern-mapping.yaml → fieldBusinessType → YAML view/edit-type-mapping.yaml → Metadata

**100+ Patterns** defined in `apps/api/src/services/pattern-mapping.yaml`:

| Column Pattern | fieldBusinessType | VIEW renderType | EDIT inputType | Example Use |
|----------------|-------------------|-----------------|----------------|-------------|
| `*_amt`, `*_price`, `*_cost` | `currency` | `currency` | `number` | Budget field |
| `dl__*_stage`, `dl__*_state`, `dl__*_status` | `datalabel_dag` | `badge` | `component: BadgeDropdownSelect` | Workflow stages |
| `dl__*` | `datalabel` | `badge` | `component: DataLabelSelect` | Status dropdown |
| `*_date` | `date` | `date` | `date` | Date picker |
| `created_ts`, `updated_ts` | `systemInternal_ts` | `timestamp` | `readonly` | System timestamps |
| `*_ts`, `*_at` | `timestamp` | `timestamp` | `datetime-local` | DateTime picker |
| `is_*` | `boolean` | `boolean` | `checkbox` | Toggle |
| `active_flag` | `systemInternal_flag` | `boolean` | `readonly` | Active flag |
| `*_flag` | `boolean` | `boolean` | `checkbox` | Boolean flags |
| `*__*_id` (e.g., `manager__employee_id`) | `entityInstance_Id` | `component: EntityInstanceName` | `EntityInstanceNameSelect` | Entity reference |
| `*_id` | `entityInstance_Id` | `component: EntityInstanceName` | `EntityInstanceNameSelect` | Simple reference |
| `metadata` | `json` | `component: MetadataTable` | `component: MetadataTable` | JSON editor |
| `*_pct`, `*_percent` | `percentage` | `percentage` | `range` | Percentage |
| `tags` | `tags` | `tags` | `component: EditableTags` | Tag input |

**Full Pattern List**: See `docs/design_pattern/YAML_PATTERN_DETECTION_SYSTEM.md` for all 100+ patterns and 80+ fieldBusinessTypes.

**Key Changes from Legacy System**:
- ❌ **Removed**: ~900 lines of hardcoded TypeScript pattern rules
- ✅ **Added**: 3 YAML configuration files (pattern-mapping.yaml, view-type-mapping.yaml, edit-type-mapping.yaml)
- ✅ **Benefit**: Add new field types by editing YAML, no code changes required

### Usage in Routes (async - v9.2.0)

```typescript
import { generateEntityResponse } from '@/services/entity-component-metadata.service.js';
import { db, client } from '@/db/index.js';

fastify.get('/api/v1/project', async (request, reply) => {
  const projects = await db.execute(sql`SELECT * FROM app.project...`);

  // Get column metadata for empty data fallback
  let resultFields: Array<{ name: string }> = [];
  if (projects.length === 0) {
    const cols = await client.unsafe(`SELECT * FROM app.project WHERE 1=0`);
    resultFields = cols.columns?.map((c: any) => ({ name: c.name })) || [];
  }

  // Generate response with Redis-cached metadata (async)
  const response = await generateEntityResponse('project', Array.from(projects), {
    total: count,
    limit: 20,
    offset: 0,
    resultFields  // PostgreSQL columns fallback
  });

  return reply.send(response);
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
    "entityListOfInstancesTable": {
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
          "lookupSourceTable": "entityInstance"
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "lookupField": "dl__project_stage"
        }
      },
      "editType": {
        "manager__employee_id": {
          "inputType": "entityInstanceId",
          "lookupEntity": "employee",
          "lookupSourceTable": "entityInstance"
        },
        "dl__project_stage": {
          "inputType": "BadgeDropdownSelect",
          "lookupSourceTable": "datalabel",
          "lookupField": "dl__project_stage"
        }
      }
    }
  }
}
```

---

## 5. State Management (Frontend) - v9.1.0 TanStack Query + Dexie

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           State Architecture (v9.1.0 - TanStack + Dexie)     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TanStack Query (In-Memory)       Dexie (IndexedDB)         │
│  ─────────────────────────        ─────────────────         │
│  • Server state management        • Persistent storage      │
│  • Automatic background refetch   • Survives browser restart│
│  • Stale-while-revalidate         • Offline-first access    │
│  • Cache invalidation             • Multi-tab sync          │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  TanstackCacheProvider + WebSocketManager (:4001)       ││
│  │  • INVALIDATE → queryClient.invalidateQueries()         ││
│  │  • Auto-refetch → update Dexie → component re-renders   ││
│  │  • prefetchAllMetadata() at login populates sync cache  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Bundle Size: ~25KB (vs ~150KB RxDB)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘

DATA FLOW PATTERN:
──────────────────
1. App start → hydrateQueryCache() → Load Dexie into TanStack Query
2. Login → prefetchAllMetadata() → Dexie + sync cache populated
3. Component renders → useEntity/useDatalabel → TanStack Query
4. Non-hook access → getDatalabelSync()/getEntityCodesSync()
5. WebSocket INVALIDATE → invalidateQueries() → auto-refetch → Dexie updated

See: docs/state_management/STATE_MANAGEMENT.md for full architecture
```

### Key Hooks

```typescript
// apps/web/src/db/tanstack-hooks/

// Entity data (TanStack Query + Dexie - offline-first)
const { data, isLoading } = useEntity<Project>('project', projectId);
const { data: projects, total } = useEntityList<Project>('project', { limit: 50 });
const { updateEntity, deleteEntity } = useEntityMutation('project');

// Metadata hooks
const { options, isLoading } = useDatalabel('project_stage');
const { entityCodes, getEntityByCode } = useEntityCodes();
const { settings } = useGlobalSettings();
const { fields, viewType, editType } = useEntityMetadata('project'); // Uses content=metadata API

// Non-hook access (sync cache - for formatters, utilities)
import { getDatalabelSync, getEntityCodesSync } from '@/db/tanstack-index';
const options = getDatalabelSync('project_stage');  // Returns cached data or null

// Draft persistence (survives page refresh - stored in Dexie)
const { currentData, updateField, undo, redo, hasChanges } = useDraft('project', projectId);

// Offline-only access (Dexie only, no network)
const { data, isStale } = useOfflineEntity<Project>('project', projectId);
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
      data: formatDataset(response.data, response.metadata?.entityListOfInstancesTable)
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

### Cache & Persistence

| Data Type | TanStack Query | Dexie (IndexedDB) | TTL |
|-----------|----------------|-------------------|-----|
| Entity instances | ✓ | ✓ | 5 min stale |
| Entity lists | ✓ | ✓ | 2 min stale |
| Datalabels | ✓ | ✓ | 10 min |
| Entity codes | ✓ | ✓ | 30 min |
| Drafts | - | ✓ | Until saved |

---

## 6. Component Architecture

### Universal Page Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    3 Universal Pages                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  EntityListOfInstancesPage.tsx                               │
│  ├── EntityListOfInstancesTable (list/grid view)                       │
│  ├── KanbanBoard (kanban view)                              │
│  └── CalendarView (calendar view)                           │
│                                                              │
│  EntitySpecificInstancePage.tsx                              │
│  ├── EntityDetailView (header + fields)                     │
│  └── DynamicChildEntityTabs (child entities)                │
│                                                              │
│  EntityFormPage.tsx                                          │
│  └── EntityInstanceFormContainer (auto-generated form)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Matrix

| Use Case | Component | Data Source |
|----------|-----------|-------------|
| Entity lists | `EntityListOfInstancesTable` | API + metadata |
| Entity details | `EntityDetailView` | API + metadata |
| Forms | `EntityInstanceFormContainer` | API + metadata |
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
// NOTE: listView config (defaultSort, defaultSortOrder, itemsPerPage) now in app.entity.config_datatable (DB-driven v10.1.0)
export const entityConfig: Record<string, EntityConfigEntry> = {
  project: {
    label: 'Project',
    labelPlural: 'Projects',
    icon: 'folder',
    columns: ['name', 'code', 'dl__project_stage', 'budget_allocated_amt'],
    // listView config now in app.entity.config_datatable (DB-driven)
  },
  // ... other entities
};
```

**List View Configuration (v10.1.0)**: Stored in `app.entity.config_datatable` JSONB column:
```json
{
  "defaultSort": "updated_ts",
  "defaultSortOrder": "desc",
  "itemsPerPage": 25
}
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
2. **Entity Metadata**: Add INSERT statement to `db/entity_configuration_settings/02_entity.ddl`
   - Set `code`, `name`, `ui_label`, `ui_icon` (Lucide icon name), `db_table`, `display_order`
   - Use `ON CONFLICT (code) DO UPDATE` for idempotency
   - Add to appropriate domain mapping UPDATE statement (e.g., `communication_interaction`, `event_calendar`)
3. **API Module**: Create `apps/api/src/modules/[entity]/routes.ts`
   - Use transactional `create_entity()`, `update_entity()`, `delete_entity()`
4. **Frontend**: Add to `apps/web/src/lib/entityConfig.ts`
5. **Import**: Run `./tools/db-import.sh`
6. **Test**: `./tools/test-api.sh GET /api/v1/[entity]`

**Note**: Sidebar navigation is auto-generated from `app.entity` table. Active entities with `active_flag=true` appear in sidebar sorted by `display_order`.

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
Request → RBAC Check (DELETE on child) → TRANSACTION {
  UPDATE/DELETE primary table
  DELETE entity_instance
  DELETE entity_instance_link (as parent & child)
  DELETE entity_rbac
} → Response

UNLINK Flow (Relationship Only)
───────────────────────────────
Request → RBAC Check (EDIT on parent) → DELETE entity_instance_link → Response
(Child entity remains in system, only relationship removed)
```

---

## 8. Documentation Index (LLM Reference)

### Core Documentation Files

| Document | Path | Purpose |
|----------|------|---------|
| **TANSTACK_DEXIE_SYNC_ARCHITECTURE.md** | `docs/caching/` | TanStack Query + Dexie + WebSocket sync |
| **ENTITY_METADATA_CACHING.md** | `docs/caching-backend/` | Redis field name caching + content=metadata API |
| **DEXIE_SCHEMA_REFACTORING.md** | `docs/migrations/` | Dexie v4 schema with unified TanStack naming |
| **RBAC_INFRASTRUCTURE.md** | `docs/rbac/` | RBAC tables, permissions, patterns |
| **entity-infrastructure.service.md** | `docs/services/` | Entity infrastructure service API + build_ref_data_entityInstance |
| **STATE_MANAGEMENT.md** | `docs/state_management/` | TanStack Query + Dexie state architecture |
| **PAGE_ARCHITECTURE.md** | `docs/pages/` | Page components and routing |
| **entity-component-metadata.service.md** | `docs/services/` | Backend metadata generation (BFF) + Redis field cache |
| **frontEndFormatterService.md** | `docs/services/` | Frontend rendering (pure renderer) |
| **RefData README.md** | `docs/refData/` | Entity reference resolution pattern |
| **DeleteOrUnlinkModal.md** | `docs/ui_components/` | Delete vs Unlink modal for child entity tabs |

### 0. TANSTACK_DEXIE_SYNC_ARCHITECTURE.md

TanStack Query + Dexie offline-first architecture with WebSocket real-time sync. Used when implementing caching, understanding invalidation flow, or troubleshooting sync issues.

**Keywords:** `TanStack Query`, `Dexie`, `IndexedDB`, `WebSocket`, `PubSub`, `WebSocketManager`, `INVALIDATE`, `SUBSCRIBE`, `LogWatcher`, `app.system_logging`, `app.system_cache_subscription`, `real-time sync`, `cache invalidation`, `queryClient.invalidateQueries`, `hydrateQueryCache`, `port 4001`

### 0.5. ENTITY_METADATA_CACHING.md (v2.0.0)

Redis caching strategy for entity field names + `content=metadata` API parameter. Solves the "empty child entity tabs show no columns" problem by caching field names with 24-hour TTL and providing metadata-only API responses.

**Keywords:** `Redis`, `field cache`, `entity:fields:`, `generateEntityResponse`, `resultFields`, `postgres.js columns`, `empty data`, `child entity tabs`, `metadata generation`, `getCachedFieldNames`, `cacheFieldNames`, `invalidateFieldCache`, `clearAllFieldCache`, `24-hour TTL`, `graceful degradation`, `content=metadata`, `metadataOnly`, `useEntityMetadata`

### 0.6. DEXIE_SCHEMA_REFACTORING.md (v4)

Dexie IndexedDB schema v4 with unified naming between TanStack Query cache keys and Dexie tables. 8 tables replacing previous 14-table schema with clearer separation of concerns.

**Keywords:** `Dexie`, `IndexedDB`, `schema v4`, `pmo-cache-v4`, `datalabel`, `entityCode`, `globalSetting`, `entityInstanceData`, `entityInstanceMetadata`, `entityInstance`, `entityLink`, `draft`, `unified naming`, `TanStack Query keys`, `createDatalabelKey`, `createEntityInstanceKey`, `createEntityInstanceDataKey`, `createEntityLinkKey`, `createDraftKey`

### 1. RBAC_INFRASTRUCTURE.md (v2.0.0 Role-Only Model)

Role-Only RBAC Model documentation covering permission system where all permissions are granted to roles (not directly to employees). Includes inheritance modes (none/cascade/mapped), explicit deny, and permission resolution flow.

**Keywords:** `RBAC`, `role-only`, `permissions`, `entity_rbac`, `role_id`, `inheritance_mode`, `none`, `cascade`, `mapped`, `child_permissions`, `is_deny`, `explicit deny`, `Permission enum`, `VIEW`, `COMMENT`, `CONTRIBUTE`, `EDIT`, `SHARE`, `DELETE`, `CREATE`, `OWNER`, `ALL_ENTITIES_ID`, `check_entity_rbac`, `get_entity_rbac_where_condition`, `entity_instance_link`, `role membership`

### 2. entity-infrastructure.service.md

Core service documentation for centralized entity infrastructure management. Used by all entity route handlers for registry operations, linkage, and RBAC enforcement.

**Keywords:** `EntityInfrastructureService`, `set_entity_instance_registry`, `update_entity_instance_registry`, `delete_entity_instance_registry`, `set_entity_instance_link`, `get_entity_instance_link_children`, `delete_entity_instance_link`, `Permission levels 0-7`, `parent_entity_code`, `child_entity_code`, `idempotent`, `transactional methods`, `create_entity`, `update_entity`, `delete_entity`, `build_ref_data_entityInstance`, `ref_data_entityInstance`

### 3. STATE_MANAGEMENT.md

TanStack Query + Dexie state architecture (v9.1.0). TanStack Query for server state, Dexie for IndexedDB persistence. WebSocket sync via WebSocketManager.

**Keywords:** `TanStack Query`, `Dexie`, `IndexedDB`, `offline-first`, `useEntity`, `useEntityList`, `useDraft`, `useDatalabel`, `useEntityCodes`, `useGlobalSettings`, `getDatalabelSync`, `getEntityCodesSync`, `prefetchAllMetadata`, `sync cache`, `WebSocketManager`, `TanstackCacheProvider`, `hydrateQueryCache`

### 4. PAGE_ARCHITECTURE.md

Comprehensive page and component architecture documentation. Used by LLMs when implementing new pages, understanding navigation flow, or modifying existing components.

**Keywords:** `EntityListOfInstancesPage`, `EntitySpecificInstancePage`, `EntityCreatePage`, `EntityChildListPage`, `SettingsOverviewPage`, `SettingDetailPage`, `WikiViewPage`, `WikiEditorPage`, `FormBuilderPage`, `FilteredDataTable`, `EntityInstanceFormContainer`, `SettingsDataTable`, `WikiDesigner`, `DynamicChildEntityTabs`, `Layout`, `ViewSwitcher`, `KanbanView`, `GridView`, `CalendarView`, `FilePreview`, `DragDropFileUpload`, `InteractiveForm`, `entityConfig.ts`, `universal pages`, `config-driven`, `Create-Link-Redirect`, `parent context`, `child entity tabs`, `datalabel URL conversion`, `position-based IDs`, `block editor`, `Notion-style`

---

**Version**: 10.1.0 | **Updated**: 2025-12-11 | **Pattern**: TanStack Query + Dexie v4 (Offline-First) + Redis Field Cache + Role-Only RBAC v2.1.0

**Recent Updates**:
- v10.1.0 (2025-12-11): **DB-Driven List View Configuration**
  - Added `config_datatable` JSONB column to `app.entity` table
  - Stores `{defaultSort, defaultSortOrder, itemsPerPage}` per entity type
  - Removed hardcoded `listView` from `entityConfig.ts` (now deprecated)
  - API reads config via `getEntityDatatableConfig()` with in-memory caching
  - Priority chain: query param > route config > DB config > default
  - Default: `{defaultSort: 'updated_ts', defaultSortOrder: 'desc', itemsPerPage: 25}`
  - See: `docs/caching-backend/ENTITY_METADATA_CACHING.md` for full architecture
- v9.6.0 (2025-12-09): **Permission Matrix Component (RBAC v2.1.0)**
  - New `RolePermissionsMatrix` component for inline permission editing
  - 45° rotated column headers for 8 permission levels
  - Batch save functionality with pending change tracking
  - Visual indicators: amber highlighting for modified, green for inherited, blue for current level
  - Fixed `PUT /api/v1/entity_rbac/permission/:id` endpoint (sql.join fix)
  - Tab renamed: "Effective Access" → "Permission Matrix"
  - See: `docs/ui_components/RolePermissionsMatrix.md`, `docs/role/ROLE_ACCESS_CONTROL.md`
- v9.5.0 (2025-12-09): **Delete vs Unlink Pattern for Child Entity Tabs**
  - New `DeleteOrUnlinkModal` for context-aware removal in child entity tabs
  - **Unlink**: Removes `entity_instance_link` only, child entity remains (requires EDIT on parent)
  - **Delete**: Transactional delete of primary + entity_instance + links + rbac (requires DELETE on child)
  - Same `EntityListOfInstancesTable` component with `parentContext` prop for conditional behavior
  - New API endpoint: `DELETE /api/v1/{parent}/{parentId}/{child}/{childId}/link`
  - See: `docs/ui_components/DeleteOrUnlinkModal.md`
- v9.4.0 (2025-12-09): **RBAC v2.0.0 Role-Only Model**
  - All permissions granted to roles (not directly to employees)
  - Role membership via `entity_instance_link` (role → person)
  - Inheritance modes: `none`, `cascade`, `mapped`
  - Explicit deny with `is_deny=true`
  - Updated Permission enum: 0-7 (VIEW, COMMENT, CONTRIBUTE, EDIT, SHARE, DELETE, CREATE, OWNER)
  - New frontend: `AccessControlPage`, `GrantPermissionModal`, `PermissionLevelSelector`
  - See: `docs/rbac/RBAC_INFRASTRUCTURE.md`
- v9.3.0 (2025-11-30): **Dexie v4 Schema + content=metadata API**
  - Dexie schema v4: 8 unified tables with TanStack Query key alignment
  - Tables: `datalabel`, `entityCode`, `globalSetting`, `entityInstanceData`, `entityInstanceMetadata`, `entityInstance`, `entityLink`, `draft`
  - Added `content=metadata` API parameter for metadata-only requests (no data query)
  - `useEntityMetadata` hook uses `content=metadata` with 30-min TTL
  - Unified naming: TanStack Query keys match Dexie table names
  - See: `docs/migrations/DEXIE_SCHEMA_REFACTORING.md`
- v9.2.0 (2025-11-30): **Redis Entity Field Caching**
  - Added Redis caching for entity field names (24-hour TTL)
  - `generateEntityResponse()` is now async with `resultFields` fallback
  - Solves "empty child entity tabs show no columns" problem
  - Graceful degradation when Redis unavailable
  - See: `docs/caching-backend/ENTITY_METADATA_CACHING.md`
- v9.1.0 (2025-11-28): **RxDB Completely Removed**
  - Removed `rxdb` and `rxjs` dependencies from package.json
  - Updated vite.config.ts to optimize for TanStack Query + Dexie
  - Updated all comments from "RxDB" to "Dexie"
  - Bundle size reduced from ~150KB to ~25KB
  - See: `docs/caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md`
- v9.0.0 (2025-11-28): **TanStack Query + Dexie Migration**
  - Replaced RxDB with TanStack Query for server state management
  - Replaced RxDB IndexedDB with Dexie for persistence
  - TanStack Query: in-memory cache, auto-refetch, stale-while-revalidate
  - Dexie: IndexedDB persistence, offline-first, multi-tab sync
  - WebSocketManager replaces ReplicationManager for cache invalidation
  - New hooks: `useEntity`, `useEntityList`, `useDraft`, `useDatalabel`
  - Sync cache for non-hook access: `getDatalabelSync()`, `getEntityCodesSync()`
  - See: `docs/state_management/STATE_MANAGEMENT.md` for full architecture
- v8.4.0 (2025-11-27): **WebSocket Real-Time Sync**
  - Added PubSub service (port 4001) for WebSocket-based cache invalidation
  - Database tables: `app.system_logging` (triggers) + `app.system_cache_subscription` (subscriptions)
  - LogWatcher polls `app.system_logging` every 60s for pending changes
- v8.3.2 (2025-11-27): **Component-Driven Rendering + BadgeDropdownSelect**
  - Added `BadgeDropdownSelect` component for colored datalabel dropdowns
  - viewType controls WHICH component renders (`renderType: 'component'` + `component`)
  - editType controls WHERE data comes from (`lookupSourceTable: 'datalabel'` + `lookupField`)
- v8.3.0 (2025-11-26): **ref_data_entityInstance Pattern**
  - Added `ref_data_entityInstance` to API responses for O(1) entity reference resolution
  - Added `build_ref_data_entityInstance()` method to entity-infrastructure.service
- v8.0.0 (2025-11-23): **Format-at-Read Pattern**
  - Changed from format-at-fetch to format-at-read using TanStack Query's `select` option
  - Cache stores RAW data only (smaller, canonical)
- v5.0.0 (2025-11-22): **Transactional CRUD Pattern**
  - Added `create_entity()`, `update_entity()`, `delete_entity()` transactional methods
- v4.0.0 (2025-11-21): Entity Infrastructure Service standardization
