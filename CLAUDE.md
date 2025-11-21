# PMO Enterprise Platform - Technical Reference

> Production-ready Canadian home services management system with DRY architecture, unified RBAC, and config-driven entity system

## Platform Specifications

- **Architecture**: 3 universal pages handle 27+ entity types dynamically
- **Database**: PostgreSQL 14+ with 50 tables (46 DDL files)
- **Backend**: Fastify v5, TypeScript ESM, JWT, 45 API modules
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Infrastructure**: AWS EC2/S3/Lambda, Terraform, Docker
- **Version**: 3.1.0 (Entity System v4.0 ready)

## Critical Operations

```bash
# MANDATORY: Use tools in /tools/ directory
./tools/start-all.sh                  # Start platform (Docker + API + Web)
./tools/db-import.sh                  # Import/reset 50 tables (run after DDL changes)
./tools/test-api.sh GET /api/v1/project  # Test endpoints with auth
./tools/logs-api.sh -f               # Monitor logs
```

**Test Credentials**: `james.miller@huronhome.ca` / `password123`

## Core Architecture Patterns

### 1. Universal Entity System (Zero-Config v4.0)

```typescript
// Entity definition requires only:
db/[entity].ddl                    // Database table
apps/api/src/modules/[entity]/       // API module
apps/web/src/lib/entityConfig.ts     // Frontend config

// Universal pages handle everything:
EntityListOfInstancesPage.tsx                   // List/grid/kanban views
EntitySpecificInstancePage.tsx                  // Detail with child tabs
EntityFormPage.tsx                    // Create/edit forms

// Backend metadata generation (35+ patterns):
Backend detects 'total_amt' → renderType: 'currency', inputType: 'currency'
Backend detects 'dl__project_stage' → renderType: 'badge', loadFromDataLabels: true
Backend detects 'is_active' → renderType: 'boolean', inputType: 'checkbox'
Backend detects 'employee_id' → renderType: 'reference', loadFromEntity: 'employee'
```

### 2. Data Model Architecture

```sql
-- Core tables (d_ prefix)
d_project, d_task, d_employee, d_client, d_office, d_business

-- Settings tables (setting_datalabel_ prefix)
setting_datalabel_project_stage, setting_datalabel_task_priority

-- Infrastructure tables
entity                        -- Entity metadata (icons, labels, child_entity_codes)
entity_instance               -- Entity instance registry (entity_instance_name, code)
entity_instance_link          -- Parent-child relationships (NO foreign keys, hard delete only)
entity_rbac                   -- Person-based permissions (0-7: VIEW, COMMENT, EDIT, SHARE, DELETE, CREATE, OWNER)
```

### 3. Key Design Patterns

**Inline Create-Then-Link**: Child entities auto-link to parent via `entity_instance_link`
**Default-Editable**: All fields editable unless explicitly readonly
**Column Consistency**: Same columns regardless of navigation context
**Settings-Driven**: All dropdowns from `/api/v1/entity/:entityCode/entity-instance-lookup`
**Backend-Driven Metadata**: Backend generates field metadata, frontend renders exactly as instructed
**Zero Frontend Pattern Detection**: `frontEndFormatterService.tsx` is pure renderer with zero logic

### 4. Core Services & Libraries

**Purpose**: Eliminate boilerplate and enforce consistency across all entity routes

| Service | File | Documentation | Purpose |
|---------|------|---------------|---------|
| **Entity Infrastructure Service** | `services/entity-infrastructure.service.ts` | [entity-infrastructure.service.md](docs/services/entity-infrastructure.service.md) | Centralized management of all 4 infrastructure tables (entity, entity_instance, entity_instance_link, entity_rbac) |
| **Backend Formatter Service** | `services/backend-formatter.service.ts` | [backend-formatter.service.md](docs/services/backend-formatter.service.md) | **Single source of truth** for field metadata generation - Backend generates complete metadata from column names (35+ patterns) |
| **Frontend Formatter Service** | `lib/frontEndFormatterService.tsx` | [frontEndFormatterService.md](docs/services/frontEndFormatterService.md) | **Pure metadata renderer** - Consumes backend metadata and renders view/edit modes with zero pattern detection |
| **Universal Filter Builder** | `lib/universal-filter-builder.ts` | [UNIVERSAL_FILTER_BUILDER.md](docs/services/UNIVERSAL_FILTER_BUILDER.md) | Zero-config query filtering with auto-type detection from column naming conventions |

**Key Benefits**:
- ✅ Zero boilerplate for standard CRUD operations
- ✅ Consistent RBAC enforcement across all entities (via Entity Infrastructure Service)
- ✅ **Backend-driven metadata** - Backend is single source of truth for all field rendering (via Backend Formatter Service)
- ✅ **Pure frontend rendering** - Frontend executes backend instructions exactly (via Frontend Formatter Service)
- ✅ Auto-detection of filter types from column naming (via Universal Filter Builder)
- ✅ Convention over configuration (column names determine everything)
- ✅ 80%+ code reduction across entity routes

### 5. Entity Infrastructure Service (Add-On Pattern)

**Purpose**: Centralized management of 4 infrastructure tables while routes maintain 100% ownership of their primary table queries

**Add-On Helper Pattern** - The service does NOT control route queries:
- ✅ Routes OWN their SELECT/UPDATE/INSERT/DELETE queries completely
- ✅ Service provides infrastructure add-on helpers only
- ✅ Routes build custom queries with JOINs, filters, aggregations
- ❌ Service does NOT build queries for routes
- ❌ Service does NOT dictate query structure

**4 Infrastructure Tables Managed**:
```sql
entity                        -- Entity type metadata (icons, labels, child_entity_codes)
entity_instance               -- Instance registry (entity_instance_name, code cache)
entity_instance_link          -- Parent-child relationships (hard delete only, no active_flag)
entity_rbac                   -- Permissions (0=VIEW, 1=COMMENT, 3=EDIT, 4=SHARE, 5=DELETE, 6=CREATE, 7=OWNER)
```

**Usage Pattern in Routes**:
```typescript
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

const ENTITY_CODE = 'project';
const entityInfra = getEntityInfrastructure(db);

// 6-STEP CREATE PATTERN
fastify.post('/api/v1/project', async (request, reply) => {
  const { parent_code, parent_id } = request.query;
  const userId = request.user.sub;

  // STEP 1: RBAC CHECK 1 - Can user CREATE this entity type?
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) return reply.status(403).send({ error: 'Forbidden' });

  // STEP 2: RBAC CHECK 2 - If linking to parent, can user EDIT parent?
  if (parent_code && parent_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parent_code, parent_id, Permission.EDIT
    );
    if (!canEditParent) return reply.status(403).send({ error: 'Forbidden' });
  }

  // STEP 3: ✅ ROUTE OWNS INSERT into primary table
  const result = await db.execute(sql`INSERT INTO app.d_project ...`);
  const project = result[0];

  // STEP 4: Register in entity_instance
  await entityInfra.set_entity_instance_registry({
    entity_type: ENTITY_CODE,
    entity_id: project.id,
    entity_name: project.name,
    entity_code: project.code
  });

  // STEP 5: Grant OWNER permission to creator
  await entityInfra.set_entity_rbac_owner(userId, ENTITY_CODE, project.id);

  // STEP 6: Link to parent (if provided)
  if (parent_code && parent_id) {
    await entityInfra.set_entity_instance_link({
      parent_entity_type: parent_code,
      parent_entity_id: parent_id,
      child_entity_type: ENTITY_CODE,
      child_entity_id: project.id,
      relationship_type: 'contains'
    });
  }

  return reply.status(201).send(project);
});

// 3-STEP UPDATE PATTERN
fastify.patch('/api/v1/project/:id', async (request, reply) => {
  const { id } = request.params;
  const data = request.body;
  const userId = request.user.sub;

  // STEP 1: RBAC check - Can user EDIT this entity?
  const canEdit = await entityInfra.check_entity_rbac(
    userId, ENTITY_CODE, id, Permission.EDIT
  );
  if (!canEdit) return reply.status(403).send({ error: 'Forbidden' });

  // STEP 2: ✅ ROUTE OWNS UPDATE query
  const result = await db.execute(sql`UPDATE app.d_project ...`);

  // STEP 3: Sync registry if name/code changed
  if (data.name !== undefined || data.code !== undefined) {
    await entityInfra.update_entity_instance_registry(ENTITY_CODE, id, {
      entity_name: data.name,
      entity_code: data.code
    });
  }

  return reply.send(result[0]);
});

// ✅ ROUTE STILL OWNS LIST queries completely
fastify.get('/api/v1/project', async (request, reply) => {
  // Service just provides RBAC WHERE condition helper
  const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
    userId, ENTITY_CODE, Permission.VIEW, 'e'
  );

  // ✅ ROUTE builds its own query structure (full control)
  const query = sql`
    SELECT
      e.*,
      b.name as business_name,
      COUNT(t.id) as task_count
    FROM app.d_project e
    LEFT JOIN app.d_business b ON e.business_id = b.id
    LEFT JOIN app.d_task t ON t.project_id = e.id
    WHERE ${rbacCondition}
      AND e.active_flag = true
      AND e.budget_allocated_amt > 10000
    GROUP BY e.id, b.name
    ORDER BY e.created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const projects = await db.execute(query);
  return reply.send({ data: projects });
});
```

**Key Service Methods**:
- `check_entity_rbac()` - Check if user has permission on entity
- `set_entity_instance_registry()` - Register instance in global registry
- `update_entity_instance_registry()` - Sync registry when name/code changes
- `set_entity_rbac_owner()` - Grant OWNER permission (automatic on create)
- `set_entity_instance_link()` - Create parent-child linkage (idempotent)
- `get_entity_rbac_where_condition()` - Get SQL WHERE fragment for RBAC filtering
- `delete_all_entity_infrastructure()` - Orchestrate complete entity deletion

**Reference**: See `docs/services/entity-infrastructure.service.md` for complete architecture

### 5a. Backend Formatter Service (Metadata Generation - Server Side)

**Purpose**: Backend generates complete field metadata from database column names using 35+ pattern rules

**Architecture**: **Backend is the single source of truth** for ALL field rendering decisions

```typescript
// Backend route handler
import { getEntityMetadata } from '@/services/backend-formatter.service.js';

// LIST endpoint
fastify.get('/api/v1/office', async (request, reply) => {
  const offices = await db.execute(sql`SELECT * FROM app.office...`);

  // Generate metadata from first row (or empty object)
  const fieldMetadata = offices.length > 0
    ? getEntityMetadata('office', offices[0])
    : getEntityMetadata('office');

  return {
    data: offices,
    metadata: fieldMetadata,  // ← Backend sends complete rendering instructions
    total, limit, offset
  };
});
```

**Pattern Detection (35+ Rules)**:
| Pattern | Generated Metadata | Example |
|---------|-------------------|---------|
| `*_amt`, `*_price`, `*_cost` | `renderType: 'currency'`, `inputType: 'currency'` | `$50,000.00` input |
| `dl__*` | `renderType: 'badge'`, `loadFromDataLabels: true` | Badge with DAGVisualizer for stages |
| `*_date` | `renderType: 'date'`, `inputType: 'date'` | Date picker |
| `*_ts`, `*_at` | `renderType: 'timestamp'`, `inputType: 'datetime'` | DateTime picker |
| `is_*`, `*_flag` | `renderType: 'boolean'`, `inputType: 'checkbox'` | Toggle checkbox |
| `*__employee_id` | `renderType: 'reference'`, `loadFromEntity: 'employee'` | Dropdown with employees |
| `metadata` (field) | `renderType: 'json'`, `component: 'MetadataTable'` | JSON table view |

**Backend Response Structure** (with composite fields):
```json
{
  "data": [{
    "id": "uuid",
    "start_date": "2025-01-15",
    "end_date": "2025-03-30",
    "budget_allocated_amt": 50000
  }],
  "metadata": {
    "entity": "project",
    "fields": [
      {
        "key": "budget_allocated_amt",
        "label": "Budget Allocated",
        "renderType": "currency",
        "inputType": "currency",
        "format": { "symbol": "$", "decimals": 2 },
        "visible": {
          "EntityDataTable": true,
          "EntityDetailView": true,
          "EntityFormContainer": true,
          "KanbanView": true,
          "CalendarView": true
        },
        "editable": true,
        "align": "right",
        "width": "140px"
      },
      {
        "key": "start_date",
        "label": "Start Date",
        "renderType": "date",
        "inputType": "date",
        "visible": {
          "EntityDataTable": true,
          "EntityDetailView": false,        // Hidden (composite shows)
          "EntityFormContainer": true,      // Show for editing
          "KanbanView": true,
          "CalendarView": true
        },
        "editable": true
      },
      {
        "key": "start_date_end_date_composite",
        "label": "Project Progress",
        "type": "composite",
        "renderType": "progress-bar",
        "component": "ProgressBar",
        "composite": true,
        "compositeConfig": {
          "composedFrom": ["start_date", "end_date"],
          "compositeType": "progress-bar",
          "showPercentage": true,
          "showDates": true,
          "highlightOverdue": true
        },
        "visible": {
          "EntityDataTable": false,         // Too complex
          "EntityDetailView": true,          // ONLY here
          "EntityFormContainer": false,      // Not editable
          "KanbanView": false,
          "CalendarView": false
        },
        "editable": false
      }
    ]
  }
}
```

**Benefits**:
- ✅ **Zero frontend configuration** - Add column to DB, backend generates metadata automatically
- ✅ **Single source of truth** - Backend controls ALL rendering logic
- ✅ **Object-based visibility** - Explicit per-component control (EntityDataTable, EntityDetailView, etc.)
- ✅ **Composite field auto-detection** - Backend detects field pairs (start + end → progress bar)
- ✅ **Cached metadata** - In-memory cache per entity (100x performance boost)
- ✅ **35+ pattern rules** - Comprehensive coverage (financial, temporal, boolean, reference, structures, composites)

**Reference**: See `docs/services/backend-formatter.service.md` for complete documentation

### 5b. Frontend Formatter Service (Metadata Consumption - Client Side)

**Purpose**: Pure renderer that consumes backend metadata and renders React elements with ZERO pattern detection

**Architecture**: **Frontend executes backend instructions exactly** - No logic, no decisions

```typescript
// Frontend component
import {
  renderViewModeFromMetadata,    // View mode (reads metadata.renderType)
  renderEditModeFromMetadata,     // Edit mode (reads metadata.inputType)
  hasBackendMetadata              // Type guard
} from '@/lib/frontEndFormatterService';

// EntityDataTable.tsx - Pure metadata-driven rendering
const columns = useMemo(() => {
  if (metadata?.fields) {
    return metadata.fields
      .filter(f => f.visible)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        title: fieldMeta.label,
        width: fieldMeta.width,
        align: fieldMeta.align,
        // Backend tells frontend how to render
        render: (value, record) => renderViewModeFromMetadata(value, fieldMeta, record)
      }));
  }
  return [];
}, [metadata]);
```

**View Mode Rendering**:
```typescript
// Backend says: renderType: 'currency'
renderViewModeFromMetadata(50000, fieldMeta)
// Returns: <span className="font-mono">$50,000.00</span>

// Backend says: renderType: 'badge', loadFromDataLabels: true
renderViewModeFromMetadata('planning', fieldMeta)
// Returns: <Badge color="blue">Planning</Badge>
```

**Edit Mode Rendering**:
```typescript
// Backend says: inputType: 'currency'
renderEditModeFromMetadata(50000, fieldMeta, onChange)
// Returns: <input type="number" step="0.01" />

// Backend says: inputType: 'select', loadFromDataLabels: true
renderEditModeFromMetadata('planning', fieldMeta, onChange)
// Returns: <select><option>Planning</option>...</select>
```

**Function Signatures**:
- `renderViewModeFromMetadata(value, metadata, record?)` - Renders view mode based on `metadata.renderType`
- `renderEditModeFromMetadata(value, metadata, onChange, options?)` - Renders edit mode based on `metadata.inputType`
- `hasBackendMetadata(response)` - Type guard to check if response contains metadata

**Benefits**:
- ✅ **Zero frontend logic** - No pattern detection, no field type decisions
- ✅ **Pure renderer** - Frontend is dumb, backend is smart
- ✅ **Type-safe** - Full TypeScript support with backend metadata types
- ✅ **11 render types**, **11 input types** - All driven by backend

**Reference**: See `docs/services/frontEndFormatterService.md` for complete documentation

### 6. Component Matrix

| Use Case | Component | Configuration |
|----------|-----------|---------------|
| Entity CRUD | `EntityDataTable` | `inlineEdit: true` |
| Settings | `SettingsDataTable` | Reorderable, badges |
| Forms | `EntityFormContainer` | Auto-detects 15+ field types |
| Workflows | `DAGVisualizer` | `dl__*_stage` fields |
| Child tabs | `DynamicChildEntityTabs` | From `entity` |
| Kanban | `KanbanBoard` | Status columns |
| Calendar | `CalendarView` | Event scheduling |

### 7. API Standards & Universal Patterns

**Reference**: `docs/api/entity_endpoint_design.md` - Complete API architecture guide

#### 5 Universal API Patterns (ALL entity routes follow these):

1. **ENTITY INFRASTRUCTURE SERVICE** - Centralized RBAC + parent-child filtering
2. **CREATE-LINK-EDIT** - Simplified parent-child relationships
3. **FACTORY PATTERN** - Auto-generated child/delete endpoints
4. **MODULE CONSTANTS** - DRY principle (ENTITY_CODE, TABLE_ALIAS)
5. **AUTO-FILTER SYSTEM** - Zero-config query filtering

#### Standard Endpoints

```typescript
// Entity endpoints
GET    /api/v1/{entity}              // List with pagination + RBAC
GET    /api/v1/{entity}/{id}         // Get single (instance VIEW check)
POST   /api/v1/{entity}              // Create (type-level CREATE check)
PATCH  /api/v1/{entity}/{id}         // Update (instance EDIT check)
DELETE /api/v1/{entity}/{id}         // Soft delete (factory-generated)

// Child entity filtering (factory-generated)
GET    /api/v1/{parent}/{id}/{child} // Filtered children with RBAC

// Options/metadata
GET    /api/v1/entity/types                         // All entity metadata
GET    /api/v1/entity/{entityCode}/entity-instance-lookup // Entity instance lookup
```

#### Required Imports (Standard Block)

```typescript
import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db } from '@/db/index.js';

// Universal libraries
import {
  getUniversalColumnMetadata,
  filterUniversalColumns,
  createPaginatedResponse
} from '../../lib/universal-schema-metadata.js';
import { buildAutoFilters } from '../../lib/universal-filter-builder.js';

// Entity Infrastructure Service - Single source of truth for all infrastructure operations
import { getEntityInfrastructure, Permission, ALL_ENTITIES_ID } from '../../services/entity-infrastructure.service.js';

// Factory functions (thin wrappers around Entity Infrastructure Service)
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';
```

#### RBAC Permission Model (Person-Based)

```typescript
// Permission hierarchy (automatic inheritance)
Permission.OWNER  = 5  // Full control (implies all below)
Permission.CREATE = 4  // Create new entities (type-level only)
Permission.DELETE = 3  // Soft delete (implies Share/Edit/View)
Permission.SHARE  = 2  // Share with others (implies Edit/View)
Permission.EDIT   = 1  // Modify entity (implies View)
Permission.VIEW   = 0  // Read-only access

// Type-level permissions (applies to all entities of type)
ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111'

// Permission checks
entityInfra.check_entity_rbac(db, userId, entityType, entityId, Permission.EDIT)
entityInfra.get_entity_rbac_where_condition(userId, entityType, Permission.VIEW, tableAlias)
```

#### Universal Auto-Filter System

```typescript
// Zero-config filtering - auto-detects types from column names
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query);
conditions.push(...autoFilters);

// Auto-detection patterns:
// ?dl__project_stage=planning    → Settings dropdown
// ?manager_employee_id=uuid      → UUID reference (auto-cast)
// ?budget_allocated_amt=50000    → Currency (numeric)
// ?start_date=2025-01-01         → Date field
// ?active_flag=true              → Boolean (auto-cast)
// ?search=kitchen                → Multi-field search
```

## Implementation Checklist

### Adding New Entity

1. **Database**: Create `db/[entity].ddl` with standard fields (id, code, name, descr, metadata, active_flag, from_ts, to_ts)
2. **Metadata**: Add to `entity` table (entity_type, label, icon, child_entities)
3. **API Module**: Create `apps/api/src/modules/[entity]/routes.ts`
   - Use standard import block (see API Standards section above)
   - Define module constants: `ENTITY_CODE`, `TABLE_ALIAS`
   - Implement LIST (with RBAC filtering), GET, CREATE (with linkage), PATCH
   - Add factory calls: `createEntityDeleteEndpoint()`, `createChildEntityEndpointsFromMetadata()`
   - Use `buildAutoFilters()` for zero-config query filtering
4. **Frontend**: Update `apps/web/src/lib/entityConfig.ts` with columns and settings
5. **Import Schema**: Run `./tools/db-import.sh`
6. **Test**: `./tools/test-api.sh GET /api/v1/[entity]`

**Reference Template**: `apps/api/src/modules/project/routes.ts` (complete implementation example)

### Field Naming Conventions

```
*_amt         → Currency field
*_date/*_ts   → Date/timestamp
dl__*         → Settings dropdown
is_*          → Boolean toggle
*_id          → Entity reference
tags          → Array field
*_pct         → Percentage
*_json        → JSON field
```

## Documentation Map

### Core Services
- `docs/services/entity-infrastructure.service.md` - **Complete entity infrastructure service architecture**
- `docs/services/frontEndFormatterService.md` - **Complete formatter service documentation**

### Data Model
- `docs/datamodel/README.md` - **Database schema (50+ tables, all DDL files)**
- `docs/settings/settings.md` - Settings architecture

### API Implementation
- `docs/api/entity_endpoint_design.md` - **API patterns, route implementation guide, data flow**

### Operational
- `docs/tools.md` - Operation scripts
- `docs/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` - File uploads

### Features
- `docs/PERSON_CALENDAR_SYSTEM.md` - Event booking system
- `docs/component_Kanban_System.md` - Kanban implementation
- `docs/form/form.md` - Dynamic forms
- `docs/ai_chat/AI_CHAT_SYSTEM.md` - AI chat v6.0

## Anti-Patterns (Avoid)

❌ Creating entity-specific pages/components
❌ Hardcoding dropdown options or entity metadata
❌ Adding foreign keys (use entity_instance_link)
❌ Manual field formatting (use centralized transforms)
❌ Direct S3 uploads (use presigned URLs)
❌ Skipping db-import.sh after DDL changes

## Quick Reference

### Entity Flow
```
User Action → Universal Page → EntityConfig → API Call → Service Layer → Database
                     ↓                            ↓
              Field Detection              RBAC Check
              (12 patterns)               (entity_rbac)
```

### Data Relationships
```
entity (metadata) → defines → Entity Types
                                      ↓
                              d_{entity} tables
                                      ↓
                              entity_instance_link (linkages)
                                      ↓
                              entity_rbac (permissions)
```

### Settings Integration
```
setting_datalabel_* tables → /api/v1/entity/:entityCode/entity-instance-lookup → EntityFormContainer
                                                                                          ↓
                                                                                  Auto-renders dropdowns
```

## Performance Optimizations

- Universal Field Detector: 83% faster than v3.x
- Cached entity metadata from entity
- Optimistic updates with refetch
- Lazy-loaded child entity tabs
- Virtualized long lists

## Deployment

**Local**: http://localhost:5173 (web), http://localhost:4000 (API)
**Production**: http://100.26.224.246:5173 (web), http://100.26.224.246:4000 (API)

---

**Version**: 3.4.0 | **Updated**: 2025-11-18 | **Entity System**: v4.0 active

**Recent Updates**:
- v3.4.0 (2025-11-18): **Major Architecture Cleanup** - 100% Entity Infrastructure Service adherence
  - **PURGED**: `unified-data-gate.ts` (33,690 bytes) - Completely replaced by Entity Infrastructure Service
  - **PURGED**: 10 obsolete files (linkage.service.ts, schema-driven-routes.ts, configTransformer.ts, etc.)
  - **REFACTORED**: `entity-delete-route-factory.ts` - Now thin wrapper around Entity Infrastructure Service
  - **RENAMED**: `ENTITY_TYPE` → `ENTITY_CODE` across entire codebase (matches data model)
  - **FIXED**: All infrastructure table names (`d_entity` → `entity`, `d_entity_instance_link` → `entity_instance_link`)
  - **UPDATED**: 24 documentation files to reflect current architecture
  - **RESULT**: -4,965 lines removed, 100% standardization, zero competing systems
- v3.3.0 (2025-01-17): Complete documentation revamp based on actual implementation
  - Added `docs/services/entity-infrastructure.service.md` - Complete service documentation
  - Added `docs/services/frontEndFormatterService.md` - Complete formatter documentation
  - Revamped `docs/datamodel/README.md` - Database schema based on DDL files
  - Revamped `docs/api/entity_endpoint_design.md` - Actual patterns with architecture diagrams
- v3.2.0 (2025-11-15): Added comprehensive API patterns, universal filter system, RBAC model details
- 2