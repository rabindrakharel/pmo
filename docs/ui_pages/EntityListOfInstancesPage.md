# EntityListOfInstancesPage

**Version:** 12.6.0 | **Location:** `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` | **Updated:** 2025-12-04

---

## Overview

EntityListOfInstancesPage is a universal listing page that renders the main list view for ANY entity type in the system. It's one of the "3 Universal Pages" that power the entire application, dynamically supporting table, kanban, grid, calendar, DAG, and hierarchy views.

**Core Principles:**
- Single component renders 27+ entity types
- Config-driven view switching
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

### 1. Dynamic Entity Configuration

```typescript
const config = getEntityConfig(entityCode);
// Returns: { label, labelPlural, icon, columns, defaultSort, searchFields }
```

### 2. View Mode Persistence

```typescript
const [view, setView] = useViewMode(entityCode, defaultView);
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
│  DATA FLOW                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Route Match: /project → entityCode="project"                            │
│                                                                              │
│  2. Config Lookup:                                                          │
│     getEntityConfig('project') → columns, defaultSort, searchFields         │
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
│  6. Render:                                                                 │
│     <EntityListOfInstancesTable data={formattedData} metadata={metadata} /> │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

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
| v12.6.0 | 2025-12-04 | Reactive formatting with cache subscription (fixes badge color bug) |
| v9.4.0 | 2025-12-03 | Two-query architecture (metadata → data separation) |
| v9.0.0 | 2025-11-28 | TanStack Query + Dexie migration |
| v8.0.0 | 2025-11-23 | Format-at-read pattern |

---

**Last Updated:** 2025-12-04 | **Status:** Production Ready
