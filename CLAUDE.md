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
d_entity_id_map              -- Parent-child relationships (NO foreign keys)
entity_id_rbac_map           -- Permissions array [view,edit,share,delete,create]
d_entity_instance_id         -- Entity registry
```

### 3. Key Design Patterns

**Inline Create-Then-Link**: Child entities auto-link to parent via `d_entity_id_map`
**Default-Editable**: All fields editable unless explicitly readonly
**Column Consistency**: Same columns regardless of navigation context
**Settings-Driven**: All dropdowns from `/api/v1/entity/:type/options`
**Factory Routes**: Use `createChildEntityEndpoint()` for parent-child APIs
**Centralized Formatting**: `data_transform_render.tsx` handles all field transforms

### 4. Component Matrix

| Use Case | Component | Configuration |
|----------|-----------|---------------|
| Entity CRUD | `EntityDataTable` | `inlineEdit: true` |
| Settings | `SettingsDataTable` | Reorderable, badges |
| Forms | `EntityFormContainer` | Auto-detects 15+ field types |
| Workflows | `DAGVisualizer` | `dl__*_stage` fields |
| Child tabs | `DynamicChildEntityTabs` | From `d_entity` |
| Kanban | `KanbanBoard` | Status columns |
| Calendar | `CalendarView` | Event scheduling |

### 5. API Standards

```typescript
// Entity endpoints
GET    /api/v1/{entity}              // List with pagination
GET    /api/v1/{entity}/{id}         // Get single
POST   /api/v1/{entity}              // Create
PATCH  /api/v1/{entity}/{id}         // Update
DELETE /api/v1/{entity}/{id}         // Soft delete

// Child entity filtering
GET    /api/v1/{parent}/{id}/{child} // Filtered children

// Options/metadata
GET    /api/v1/entity/types          // All entity metadata
GET    /api/v1/entity/{type}/options // Dropdown options
```

## Implementation Checklist

### Adding New Entity

1. Create DDL: `db/d_[entity].ddl`
2. Add to d_entity table (metadata)
3. Create API module: `apps/api/src/modules/[entity]/`
4. Update entityConfig.ts
5. Run `./tools/db-import.sh`
6. Test: `./tools/test-api.sh GET /api/v1/[entity]`

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
❌ Adding foreign keys (use d_entity_id_map)
❌ Manual field formatting (use centralized transforms)
❌ Direct S3 uploads (use presigned URLs)
❌ Skipping db-import.sh after DDL changes

## Quick Reference

### Entity Flow
```
User Action → Universal Page → EntityConfig → API Call → Service Layer → Database
                     ↓                            ↓
              Field Detection              RBAC Check
              (12 patterns)               (entity_id_rbac_map)
```

### Data Relationships
```
d_entity (metadata) → defines → Entity Types
                                      ↓
                              d_{entity} tables
                                      ↓
                              d_entity_id_map (linkages)
                                      ↓
                              entity_id_rbac_map (permissions)
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

**Version**: 3.1.0 | **Updated**: 2025-11-12 | **Entity System**: v4.0 ready