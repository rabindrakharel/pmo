# EntityListOfInstancesPage

**Version:** 17.0.0 | **Location:** `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` | **Updated:** 2025-12-06

---

## Overview

EntityListOfInstancesPage is a universal listing page that renders the main list view for ANY entity type in the system. It's one of the "3 Universal Pages" that power the entire application, dynamically supporting table, kanban, grid, calendar, DAG, and hierarchy views.

**Core Principles:**
- Single component renders 27+ entity types
- **Database-driven view configuration ONLY** via `entity.component_views` (v17.0.0 - no static fallback)
- Config-driven view switching from database
- Two-query architecture (metadata → data)
- Format-at-read pattern for display values

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTITYLISTOFINSTANCESPAGE ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /{entityCode}  (e.g., /project, /task, /employee)                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                          Layout Shell                                    ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header: Entity Icon + Name + ViewSwitcher + CreateButton           │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  View Component (based on selected view mode)                       │││
│  │  │                                                                     │││
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────┐  │││
│  │  │  │ TABLE   │ │ KANBAN  │ │  GRID   │ │ CALENDAR │ │ DAG/GRAPH   │  │││
│  │  │  │ Default │ │ Status  │ │ Cards   │ │ Events   │ │ Workflow    │  │││
│  │  │  └─────────┘ └─────────┘ └─────────┘ └──────────┘ └─────────────┘  │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface EntityListOfInstancesPageProps {
  /** Entity type code (e.g., 'project', 'task', 'employee') */
  entityCode: string;

  /** Default view mode override */
  defaultView?: ViewMode;
}

type ViewMode = 'table' | 'kanban' | 'grid' | 'calendar' | 'dag' | 'hierarchy';
```

---

## Two-Query Architecture (v9.4.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TWO-QUERY ARCHITECTURE                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  QUERY 1: METADATA (30-min cache)                                           │
│  ─────────────────────────────────                                          │
│  useEntityInstanceMetadata(entityCode, mappedView)                          │
│  → GET /api/v1/{entity}?content=metadata                                    │
│  → Returns: { viewType, editType, fields }                                  │
│  → Purpose: Render table columns FIRST (skeleton-ready)                     │
│                                                                              │
│  QUERY 2: DATA (5-min cache)                                                │
│  ──────────────────────────────                                             │
│  useEntityInstanceData(entityCode, params)                                  │
│  → GET /api/v1/{entity}?limit=20000                                        │
│  → Returns: { data, total }                                                 │
│  → Purpose: Populate rows AFTER metadata ready                              │
│                                                                              │
│  RENDER SEQUENCE:                                                           │
│  1. Metadata loading → Show skeleton with column headers                    │
│  2. Metadata ready → Render columns structure                               │
│  3. Data loading → Show row skeletons                                       │
│  4. Data ready → Populate formatted rows                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## View Components

| View | Component | When Used |
|------|-----------|-----------|
| `table` | `EntityListOfInstancesTable` | Default - full CRUD table |
| `kanban` | `KanbanView` | Status-based grouping |
| `grid` | `GridView` | Card-based layout |
| `calendar` | `CalendarView` | Date-based entities |
| `dag` | `DAGVisualizer` | Workflow stages |
| `hierarchy` | `HierarchyGraphView` | Parent-child trees |

---

## Key Features

### 1. Database-Driven View Configuration (v17.0.0)

View configuration is now fetched EXCLUSIVELY from the database via `/api/v1/entity/codes`:

```typescript
import { useComponentViews } from '@/lib/hooks/useComponentViews';

// v17.0.0: Database-driven ONLY - no static fallback
const viewConfig = useComponentViews(entityCode);

// viewConfig contains:
// - supportedViews: ['table', 'kanban', 'grid'] (from component_views)
// - defaultView: 'table' (from component_views.*.default = true)
// - kanban: { groupByField, cardFields } (from component_views.KanbanView)
// - grid: { cardFields, columns } (from component_views.GridView)
// - calendar: { dateField, titleField } (from component_views.CalendarView)
// - isLoading: boolean
```

### 2. View Mode Persistence

```typescript
// Uses database defaultView (no static fallback in v17.0.0)
const [view, setView] = useViewMode(entityCode, viewConfig.defaultView);
// Persists view selection per entity in localStorage
```

### 3. Reactive Formatting Pattern (v12.6.0)

```typescript
// v12.6.0: Uses useFormattedEntityData hook with cache subscription
// Automatically re-formats when datalabel cache updates (fixes badge color bug)
const { data: formattedData } = useFormattedEntityData(rawData, metadata, entityCode);

// Returns FormattedRow[] with:
// - raw: Original values (for editing)
// - display: Pre-formatted strings
// - styles: CSS classes (badges)
//
// Reactive to:
// 1. rawData changes (data refetch, WebSocket update)
// 2. metadata changes (view switch, entity change)
// 3. datalabel cache updates (badge colors, dropdown options)
//
// Pattern: TanStack Query Dependent Queries with Cache Subscription
// See: docs/BADGE_COLOR_SOLUTION_ARCHITECTURE.md
```

### 4. Sidebar Auto-Collapse

```typescript
useEffect(() => {
  collapseSidebar();  // Maximize content area on page load
}, []);
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATA FLOW (v16.0.0)                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Route Match: /project → entityCode="project"                            │
│                                                                              │
│  2. View Config Lookup (v17.0.0):                                           │
│     const viewConfig = useComponentViews('project');                        │
│     └── Fetches from /api/v1/entity/codes                                   │
│     └── Database-only - no static fallback                                  │
│     └── Returns: { supportedViews, defaultView, kanban, grid, calendar }    │
│                                                                              │
│  3. Metadata Query:                                                         │
│     useEntityInstanceMetadata('project', 'entityListOfInstancesTable')      │
│     → Returns viewType (renderType per field)                               │
│     → Returns editType (inputType per field)                                │
│                                                                              │
│  4. Data Query:                                                             │
│     useEntityInstanceData('project', { limit: 20000 })                      │
│     → Returns raw entity data                                               │
│                                                                              │
│  5. Format (via useMemo):                                                   │
│     formatDataset(rawData, metadata)                                        │
│     → Returns FormattedRow[] with display values                            │
│                                                                              │
│  6. Render (view-dependent):                                                │
│     if (view === 'table')                                                   │
│       <EntityListOfInstancesTable data={formattedData} ... />               │
│     else if (view === 'kanban' && viewConfig.kanban)                        │
│       <KanbanView kanban={viewConfig.kanban} data={formattedData} />        │
│     else if (view === 'grid' && viewConfig.grid)                            │
│       <GridView grid={viewConfig.grid} data={formattedData} />              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database-Driven View Configuration (v17.0.0)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  v17.0.0: DATABASE-DRIVEN COMPONENT VIEWS (No Static Fallback)              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DATABASE: app.entity.component_views JSONB                                  │
│  ─────────────────────────────────────────                                  │
│  {                                                                           │
│    "EntityListOfInstancesTable": { "enabled": true, "default": true },      │
│    "KanbanView": {                                                           │
│      "enabled": true,                                                        │
│      "groupByField": "dl__task_stage",                                       │
│      "cardFields": ["name", "dl__task_priority", "estimated_hours"]         │
│    },                                                                        │
│    "GridView": {                                                             │
│      "enabled": true,                                                        │
│      "cardFields": ["name", "descr"],                                       │
│      "columns": 3                                                            │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  API: GET /api/v1/entity/codes                                              │
│  ───────────────────────────────                                            │
│  Returns: { data: [..., { code, component_views, ... }], syncedAt }         │
│                                                                              │
│  FRONTEND HOOKS                                                              │
│  ─────────────────                                                          │
│  useEntityCodes()           → Caches entity metadata (30-min TTL)           │
│  useComponentViews(code)    → Extracts component_views for entity           │
│  (No useMergedEntityConfig in v17.0.0 - database-only)                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration Source (v17.0.0)

| Source | When Used |
|--------|-----------|
| Database `component_views` | ONLY source - all view config must be in database |
| Default (table only) | If component_views is null/empty |

### ViewSwitcher Integration

```typescript
// ViewSwitcher uses database-driven supportedViews
<ViewSwitcher
  currentView={view}
  supportedViews={viewConfig.supportedViews}  // e.g., ['table', 'kanban']
  onChange={setView}
/>
```

### Example: Adding Kanban to an Entity

**Before (code change required):**
```typescript
// entityConfig.ts
project: {
  supportedViews: ['table'],  // Add 'kanban' here
  kanban: { groupByField: 'dl__project_stage' }  // Add config
}
```

**After (v16.0.0 - DDL only):**
```sql
UPDATE app.entity SET
    component_views = jsonb_set(
      COALESCE(component_views, '{}'),
      '{KanbanView}',
      '{"enabled": true, "groupByField": "dl__project_stage"}'
    )
WHERE code = 'project';
```
Then run `./tools/db-import.sh` – no code deployment needed!

---

## Row Actions

```typescript
const rowActions: RowAction[] = [
  {
    label: 'Edit',
    icon: Edit,
    onClick: (row) => navigate(`/${entityCode}/${row.raw.id}/edit`),
    variant: 'default'
  },
  {
    label: 'Delete',
    icon: Trash2,
    onClick: handleDelete,
    variant: 'danger',
    requireConfirm: true
  }
];
```

---

## Routing Integration

```typescript
// App.tsx routing
<Route path="/:entityCode" element={<EntityListOfInstancesPage />} />

// Dynamic entity code from URL
const { entityCode } = useParams();

// Navigation examples:
// /project    → EntityListOfInstancesPage({ entityCode: 'project' })
// /task       → EntityListOfInstancesPage({ entityCode: 'task' })
// /employee   → EntityListOfInstancesPage({ entityCode: 'employee' })
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [Layout](./Layout.md) | Wraps page with sidebar/header |
| [EntityListOfInstancesTable](./EntityListOfInstancesTable.md) | Table view component |
| [KanbanBoard](./KanbanBoard.md) | Kanban view component |
| [ViewSwitcher](./ViewSwitcher.md) | View mode selector |
| [DAGVisualizer](./DAGVisualizer.md) | Workflow visualization |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v17.0.0 | 2025-12-06 | **Database-driven ONLY** - removed static entityConfig fallback |
| v16.0.0 | 2025-12-06 | Database-driven view configuration via `component_views` JSONB |
| v12.6.0 | 2025-12-04 | Reactive formatting with cache subscription (fixes badge color bug) |
| v9.4.0 | 2025-12-03 | Two-query architecture (metadata → data separation) |
| v9.0.0 | 2025-11-28 | TanStack Query + Dexie migration |
| v8.0.0 | 2025-11-23 | Format-at-read pattern |

---

**Last Updated:** 2025-12-06 | **Status:** Production Ready

**v17.0.0 Key Changes:**
- View configuration fetched EXCLUSIVELY from `/api/v1/entity/codes` endpoint
- Removed `useMergedEntityConfig` hook - use `useComponentViews` directly
- No static fallback - all view config must be in database `component_views` JSONB
- KanbanView now accepts `kanban` prop directly (not via EntityConfig)
- New KanbanView props: `displayName`, `pluralName` for error messages
- `component_views` JSONB column in `entity` table controls:
  - Which views are available per entity
  - Default view selection
  - Kanban groupByField and cardFields
  - Grid card layout configuration
  - Calendar date/title field mapping
- No code changes needed to add views – just DDL update + db-import
