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
db/d_[entity].ddl                    // Database table
apps/api/src/modules/[entity]/       // API module
apps/web/src/lib/entityConfig.ts     // Frontend config

// Universal pages handle everything:
EntityMainPage.tsx                   // List/grid/kanban views
EntityDetailPage.tsx                  // Detail with child tabs
EntityFormPage.tsx                    // Create/edit forms

// Field detection (12 patterns):
detectField('total_amt') → currency
detectField('dl__project_stage') → DAG workflow
detectField('is_active') → toggle
detectField('employee_id') → entity reference
```

### 2. Data Model Architecture

```sql
-- Core tables (d_ prefix)
d_project, d_task, d_employee, d_client, d_office, d_business

-- Settings tables (setting_datalabel_ prefix)
setting_datalabel_project_stage, setting_datalabel_task_priority

-- Infrastructure tables
d_entity                      -- Entity metadata (icons, labels, child entities)
d_entity_instance_link              -- Parent-child relationships (NO foreign keys)
d_entity_rbac           -- Person-based permissions (single integer 0-5)
d_entity_instance_registry         -- Entity registry
```

### 3. Key Design Patterns

**Inline Create-Then-Link**: Child entities auto-link to parent via `d_entity_instance_link`
**Default-Editable**: All fields editable unless explicitly readonly
**Column Consistency**: Same columns regardless of navigation context
**Settings-Driven**: All dropdowns from `/api/v1/entity/:type/options`
**Factory Routes**: Use `createChildEntityEndpoint()` for parent-child APIs
**Centralized Formatting**: `universalFormatterService.ts` handles all field transforms

### 4. Centralized Services & Libraries

**Purpose**: Eliminate boilerplate and enforce consistency across all entity routes

| Service | File | Purpose |
|---------|------|---------|
| **Entity Infrastructure Service** | `services/entity-infrastructure.service.ts` | Centralized management of all 4 infrastructure tables (registry, links, RBAC, metadata) |
| **Universal Formatter Service** | `lib/universalFormatterService.ts` | Single source of truth for ALL formatting (currency, dates, badges, transforms) |
| **Universal Filter Builder** | `lib/universal-filter-builder.ts` | Zero-config query filtering with auto-type detection |
| **Unified Data Gate** | `lib/unified-data-gate.ts` | Centralized RBAC + parent-child filtering |
| **Delete Factory** | `lib/entity-delete-route-factory.ts` | Auto-generate DELETE endpoints with cascading cleanup |
| **Child Entity Factory** | `lib/child-entity-route-factory.ts` | Auto-generate `GET /{parent}/:id/{child}` endpoints |
| **Schema Metadata** | `lib/universal-schema-metadata.ts` | Database schema introspection and column detection |

**Key Benefits**:
- ✅ Zero boilerplate for standard CRUD operations
- ✅ Consistent RBAC enforcement across all entities
- ✅ Auto-detection of filter types from column naming
- ✅ Factory-generated endpoints reduce code by 80%+

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
d_entity                      -- Entity type metadata (icons, labels, child_entities)
d_entity_instance_registry    -- Instance registry (entity_name, entity_code cache)
d_entity_instance_link        -- Parent-child relationships (idempotent)
d_entity_rbac                 -- Permissions (0=VIEW, 1=EDIT, 2=SHARE, 3=DELETE, 4=CREATE, 5=OWNER)
```

**Usage Pattern in Routes**:
```typescript
import { getEntityInfrastructure, Permission } from '@/services/entity-infrastructure.service.js';

const ENTITY_TYPE = 'project';
const entityInfra = getEntityInfrastructure(db);

// 6-STEP CREATE PATTERN
fastify.post('/api/v1/project', async (request, reply) => {
  const { parent_type, parent_id } = request.query;
  const userId = request.user.sub;

  // STEP 1: RBAC CHECK 1 - Can user CREATE this entity type?
  const canCreate = await entityInfra.check_entity_rbac(
    userId, ENTITY_TYPE, ALL_ENTITIES_ID, Permission.CREATE
  );
  if (!canCreate) return reply.status(403).send({ error: 'Forbidden' });

  // STEP 2: RBAC CHECK 2 - If linking to parent, can user EDIT parent?
  if (parent_type && parent_id) {
    const canEditParent = await entityInfra.check_entity_rbac(
      userId, parent_type, parent_id, Permission.EDIT
    );
    if (!canEditParent) return reply.status(403).send({ error: 'Forbidden' });
  }

  // STEP 3: ✅ ROUTE OWNS INSERT into primary table
  const result = await db.execute(sql`INSERT INTO app.d_project ...`);
  const project = result[0];

  // STEP 4: Register in d_entity_instance_registry
  await entityInfra.set_entity_instance_registry({
    entity_type: ENTITY_TYPE,
    entity_id: project.id,
    entity_name: project.name,
    entity_code: project.code
  });

  // STEP 5: Grant OWNER permission to creator
  await entityInfra.set_entity_rbac_owner(userId, ENTITY_TYPE, project.id);

  // STEP 6: Link to parent (if provided)
  if (parent_type && parent_id) {
    await entityInfra.set_entity_instance_link({
      parent_entity_type: parent_type,
      parent_entity_id: parent_id,
      child_entity_type: ENTITY_TYPE,
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
    userId, ENTITY_TYPE, id, Permission.EDIT
  );
  if (!canEdit) return reply.status(403).send({ error: 'Forbidden' });

  // STEP 2: ✅ ROUTE OWNS UPDATE query
  const result = await db.execute(sql`UPDATE app.d_project ...`);

  // STEP 3: Sync registry if name/code changed
  if (data.name !== undefined || data.code !== undefined) {
    await entityInfra.update_entity_instance_registry(ENTITY_TYPE, id, {
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
    userId, ENTITY_TYPE, Permission.VIEW, 'e'
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

**Reference**: See `docs/services/ENTITY_INFRASTRUCTURE_SERVICE_DESIGN.md` for complete architecture

### 5a. Universal Formatter Service (Convention Over Configuration)

**Purpose**: Single source of truth for ALL formatting across frontend and API transforms

**Convention Over Configuration**: Column name automatically determines format type
```typescript
import {
  detectFieldFormat,    // Column name → complete format spec
  formatFieldValue,     // Value → formatted string
  renderFieldDisplay,   // Value → React element
  transformForApi,      // Frontend → API format
  renderSettingBadge,   // Settings → colored badge
  getFieldCapability    // Determine editability
} from '@/lib/universalFormatterService';

// Auto-detect format from column name
const format = detectFieldFormat('budget_allocated_amt', 'numeric');
// Returns: { type: 'currency', label: 'Budget Allocated', editType: 'number', align: 'right', ... }

const formatted = formatFieldValue(50000, 'currency');
// Returns: "$50,000.00"

const element = renderFieldDisplay(50000, { type: 'currency' });
// Returns: <span>$50,000.00</span>
```

**Naming Convention Rules** (Auto-Detection):
| Pattern | Format | Display Example |
|---------|--------|-----------------|
| `*_amt`, `*_price`, `*_cost` | `currency` | `$50,000.00` |
| `dl__*` | `badge` | 🟢 "In Progress" |
| `*_ts`, `*_at` + timestamp | `relative-time` | "2 hours ago" |
| `*_date` | `date` | "Jan 15, 2025" |
| `timestamp` type | `datetime` | "Jan 15, 2025, 2:30 PM" |
| `boolean` type | `boolean` | 🟢 "Active" |
| `*_pct`, `*_rate` | `percentage` | "75.0%" |
| `*_id` (uuid) | `reference` | Link to entity |
| `tags` or `ARRAY` | `tags` | `tag1` `tag2` |
| Default | `text` | Plain text |

**6 Functional Areas (All in ONE Service)**:
1. **Format Detection** - `detectFieldFormat()`, `generateFieldLabel()`, `getEditType()`
2. **Value Formatting** - `formatCurrency()`, `formatRelativeTime()`, `formatFriendlyDate()`
3. **React Rendering** - `renderFieldDisplay()`, `formatBooleanBadge()`, `formatTagsList()`
4. **Badge Rendering** - `renderSettingBadge()` with color mapping
5. **Data Transformation** - `transformForApi()`, `transformFromApi()`
6. **Field Capability** - `getFieldCapability()` (editable vs readonly)

**Benefits**:
- ✅ **ONE import** for all formatting needs
- ✅ **Zero configuration** - Add column to database, frontend auto-detects everything
- ✅ **DRY principle** - Change format once, applies everywhere
- ✅ **No API calls** for formatting (local service, except badge colors which are cached)
- ✅ **Type-safe** with TypeScript

**Reference**: See `docs/services/formatter/README.md` for complete documentation

### 6. Component Matrix

| Use Case | Component | Configuration |
|----------|-----------|---------------|
| Entity CRUD | `EntityDataTable` | `inlineEdit: true` |
| Settings | `SettingsDataTable` | Reorderable, badges |
| Forms | `EntityFormContainer` | Auto-detects 15+ field types |
| Workflows | `DAGVisualizer` | `dl__*_stage` fields |
| Child tabs | `DynamicChildEntityTabs` | From `d_entity` |
| Kanban | `KanbanBoard` | Status columns |
| Calendar | `CalendarView` | Event scheduling |

### 7. API Standards & Universal Patterns

**Reference**: `docs/api/entity_endpoint_design.md` - Complete API architecture guide

#### 5 Universal API Patterns (ALL entity routes follow these):

1. **UNIFIED DATA GATE** - Centralized RBAC + parent-child filtering
2. **CREATE-LINK-EDIT** - Simplified parent-child relationships
3. **FACTORY PATTERN** - Auto-generated child/delete endpoints
4. **MODULE CONSTANTS** - DRY principle (ENTITY_TYPE, TABLE_ALIAS)
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
GET    /api/v1/entity/types          // All entity metadata
GET    /api/v1/entity/{type}/options // Dropdown options
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
import { unified_data_gate, Permission, ALL_ENTITIES_ID } from '../../lib/unified-data-gate.js';

// Factory functions
import { createEntityDeleteEndpoint } from '../../lib/entity-delete-route-factory.js';
import { createChildEntityEndpointsFromMetadata } from '../../lib/child-entity-route-factory.js';

// Services
import { createLinkage } from '../../services/linkage.service.js';
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
unified_data_gate.rbac_gate.check_entity_rbac(db, userId, entityType, entityId, Permission.EDIT)
unified_data_gate.rbac_gate.getWhereCondition(userId, entityType, Permission.VIEW, tableAlias)
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

1. **Database**: Create `db/d_[entity].ddl` with standard fields (id, code, name, descr, metadata, active_flag, from_ts, to_ts)
2. **Metadata**: Add to `d_entity` table (entity_type, label, icon, child_entities)
3. **API Module**: Create `apps/api/src/modules/[entity]/routes.ts`
   - Use standard import block (see API Standards section above)
   - Define module constants: `ENTITY_TYPE`, `TABLE_ALIAS`
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

### Architecture
- `docs/entity_design_pattern/ENTITY_SYSTEM_V4.md` - Zero-config v4.0 system
- `docs/entity_design_pattern/UNIVERSAL_FIELD_DETECTOR_V2.md` - Pattern detection
- `docs/entity_ui_ux_route_api.md` - Complete architecture overview
- `docs/UI_UX_PAGE_Components_Modal.md` - Component selection guide

### Data Model
- `docs/datamodel/datamodel.md` - Database schema (50 tables)
- `docs/settings/settings.md` - Settings architecture

### Implementation
- `docs/api/entity_endpoint_design.md` - **API patterns & route implementation guide**
- `docs/entity_design_pattern/INTEGRATION_GUIDE.md` - 3-line integration
- `docs/tools.md` - Operation scripts
- `docs/ENTITY_OPTIONS_API.md` - Dropdown APIs
- `docs/S3_ATTACHMENT_SERVICE_COMPLETE_GUIDE.md` - File uploads

### Features
- `docs/PERSON_CALENDAR_SYSTEM.md` - Event booking system
- `docs/component_Kanban_System.md` - Kanban implementation
- `docs/form/form.md` - Dynamic forms
- `docs/ai_chat/AI_CHAT_SYSTEM.md` - AI chat v6.0

## Anti-Patterns (Avoid)

❌ Creating entity-specific pages/components
❌ Hardcoding dropdown options or entity metadata
❌ Adding foreign keys (use d_entity_instance_link)
❌ Manual field formatting (use centralized transforms)
❌ Direct S3 uploads (use presigned URLs)
❌ Skipping db-import.sh after DDL changes

## Quick Reference

### Entity Flow
```
User Action → Universal Page → EntityConfig → API Call → Service Layer → Database
                     ↓                            ↓
              Field Detection              RBAC Check
              (12 patterns)               (d_entity_rbac)
```

### Data Relationships
```
d_entity (metadata) → defines → Entity Types
                                      ↓
                              d_{entity} tables
                                      ↓
                              d_entity_instance_link (linkages)
                                      ↓
                              d_entity_rbac (permissions)
```

### Settings Integration
```
setting_datalabel_* tables → /api/v1/entity/:type/options → EntityFormContainer
                                                                    ↓
                                                            Auto-renders dropdowns
```

## Performance Optimizations

- Universal Field Detector: 83% faster than v3.x
- Cached entity metadata from d_entity
- Optimistic updates with refetch
- Lazy-loaded child entity tabs
- Virtualized long lists

## Deployment

**Local**: http://localhost:5173 (web), http://localhost:4000 (API)
**Production**: http://100.26.224.246:5173 (web), http://100.26.224.246:4000 (API)

---

**Version**: 3.2.0 | **Updated**: 2025-11-15 | **Entity System**: v4.0 ready

**Recent Updates**:
- v3.2.0 (2025-11-15): Added comprehensive API patterns, universal filter system, RBAC model details, centralized services
- v3.1.0 (2025-11-12): Entity System v4.0 preparation