# EntityListOfInstancesPage

**Version:** 9.4.0 | **Location:** `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` | **Updated:** 2025-12-03

---

## Overview

EntityListOfInstancesPage is the **primary universal listing page** that renders any entity type based on `entityCode`. It supports multiple view modes (table, kanban, grid, calendar, DAG, hierarchy) and uses a two-query architecture for optimal caching.

**Core Principles:**
- Single component for ALL entity listings
- Two-query architecture (metadata + data)
- Multiple view modes via ViewSwitcher
- Optimistic mutations for inline editing
- Config-driven via entityConfig.ts

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               ENTITYLISTOFINSTANCESPAGE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Route: /{entityCode} (e.g., /project, /task, /employee)                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Layout Shell                                                            ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  Header                                                             │││
│  │  │  [← Back] Projects (or entity label)                                │││
│  │  │  Entity description from config                                     │││
│  │  │  [ViewSwitcher: Table | Kanban | Grid | Calendar]     [+ Create]   │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  View Content (based on selected view)                              │││
│  │  │                                                                     │││
│  │  │  TABLE VIEW:                                                        │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐   │││
│  │  │  │ EntityListOfInstancesTable                                   │   │││
│  │  │  │ ┌─────┬──────────┬───────────┬─────────────┬───────────┐   │   │││
│  │  │  │ │ Name│ Code     │ Stage     │ Budget      │ Actions   │   │   │││
│  │  │  │ ├─────┼──────────┼───────────┼─────────────┼───────────┤   │   │││
│  │  │  │ │ ... │ ...      │ [Badge]   │ $50,000     │ [⋮]       │   │   │││
│  │  │  │ └─────┴──────────┴───────────┴─────────────┴───────────┘   │   │││
│  │  │  └─────────────────────────────────────────────────────────────┘   │││
│  │  │                                                                     │││
│  │  │  KANBAN VIEW:                                                       │││
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                  │││
│  │  │  │ Planning    │ │ In Progress │ │ Complete    │                  │││
│  │  │  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │                  │││
│  │  │  │ │ Card 1  │ │ │ │ Card 3  │ │ │ │ Card 5  │ │                  │││
│  │  │  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │                  │││
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘                  │││
│  │  │                                                                     │││
│  │  │  GRID VIEW:                                                         │││
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                  │││
│  │  │  │ Card 1  │ │ Card 2  │ │ Card 3  │ │ Card 4  │                  │││
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘                  │││
│  │  │                                                                     │││
│  │  │  CALENDAR VIEW:                                                     │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐   │││
│  │  │  │ < January 2025 >                                            │   │││
│  │  │  │ Mon  Tue  Wed  Thu  Fri  Sat  Sun                           │   │││
│  │  │  │ ...  ...  [1]  ...  ...  ...  ...                           │   │││
│  │  │  └─────────────────────────────────────────────────────────────┘   │││
│  │  └─────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Two-Query Architecture (v9.4.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TWO-QUERY ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  QUERY 1: METADATA (30-min cache)                                           │
│  ────────────────────────────────                                           │
│  useEntityInstanceMetadata(entityCode, componentName)                       │
│  → Returns: viewType, editType, fields                                      │
│  → Purpose: Render table columns before data arrives                        │
│                                                                              │
│  QUERY 2: DATA (5-min cache)                                                │
│  ──────────────────────────                                                 │
│  useEntityInstanceData(entityCode, params)                                  │
│  → Returns: data[], total, isLoading                                        │
│  → Purpose: Populate rows after columns rendered                            │
│                                                                              │
│  RENDER SEQUENCE:                                                           │
│  1. Metadata loading → skeleton columns                                     │
│  2. Metadata ready → render columns                                         │
│  3. Data loading → show loading indicator in rows                           │
│  4. Data ready → populate rows with formatted data                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Props Interface

```typescript
interface EntityListOfInstancesPageProps {
  entityCode: string;      // Entity type code (project, task, employee, etc.)
  defaultView?: ViewMode;  // Optional: Override default view mode
}
```

### 2. View Mode to Component Mapping

```typescript
const viewComponentMap: Record<string, string> = {
  table: 'entityListOfInstancesTable',
  kanban: 'kanbanView',
  grid: 'gridView',
  calendar: 'calendarView',
  dag: 'dagView',
  hierarchy: 'hierarchyGraphView',
};
```

### 3. Metadata Query (30-min cache)

```typescript
const {
  viewType,
  editType,
  fields: metadataFields,
  isLoading: metadataLoading,
} = useEntityInstanceMetadata(entityCode, mappedView);

// Combine into metadata structure
const metadata = useMemo((): ComponentMetadata | null => {
  if (!viewType || Object.keys(viewType).length === 0) return null;
  return { viewType, editType } as ComponentMetadata;
}, [viewType, editType]);
```

### 4. Data Query (5-min cache)

```typescript
const queryParams = useMemo(() => ({
  limit: 20000,
  offset: (currentPage - 1) * 20000,
}), [currentPage]);

const {
  data: rawData,
  total: totalRecords,
  isLoading: dataLoading,
  refetch,
} = useEntityInstanceData(entityCode, queryParams, {
  enabled: !!config,
});
```

### 5. Optimistic Mutations

```typescript
const { mutate: optimisticUpdate } = useOptimisticMutation(entityCode);

// Usage in row actions
optimisticUpdate({
  entityId: row.id,
  updates: { status: 'completed' }
});
```

---

## View Modes

| View | Component | Use Case |
|------|-----------|----------|
| `table` | EntityListOfInstancesTable | Standard listing with sorting/filtering |
| `kanban` | KanbanView | Status-based card columns |
| `grid` | GridView | Card grid layout |
| `calendar` | CalendarView | Date-based events |
| `dag` | DAGVisualizer | Workflow stages |
| `hierarchy` | HierarchyGraphView | Parent-child relationships |

---

## Entity Config Integration

```typescript
// From lib/entityConfig.ts
const config = getEntityConfig(entityCode);

// Returns:
interface EntityConfigEntry {
  label: string;           // Display name
  labelPlural: string;     // Plural display name
  icon: string;            // Icon name
  columns: string[];       // Visible columns
  defaultSort: { field: string; order: 'asc' | 'desc' };
  searchFields: string[];  // Searchable fields
  viewModes: ViewMode[];   // Available view modes
  apiEndpoint?: string;    // Custom API endpoint
}
```

---

## Row Actions

```typescript
const rowActions: RowAction[] = [
  {
    label: 'Edit',
    icon: Edit,
    onClick: (row) => navigate(`/${entityCode}/${row.id}`),
  },
  {
    label: 'Delete',
    icon: Trash2,
    onClick: (row) => handleDelete(row.id),
    variant: 'danger',
  },
];
```

---

## Related Components

| Component | Purpose |
|-----------|---------|
| [EntityListOfInstancesTable](../ui_components/EntityListOfInstancesTable.md) | Table view component |
| [KanbanView](../ui_components/KanbanView.md) | Kanban board |
| [GridView](../ui_components/GridView.md) | Card grid |
| [CalendarView](../ui_components/CalendarView.md) | Calendar |
| [DAGVisualizer](../ui_components/DAGVisualizer.md) | Workflow DAG |
| [ViewSwitcher](../ui_components/ViewSwitcher.md) | View mode toggle |

---

## Related Pages

| Page | Relationship |
|------|--------------|
| [EntitySpecificInstancePage](./EntitySpecificInstancePage.md) | Row click → detail |
| [EntityCreatePage](./EntityCreatePage.md) | Create button |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v9.4.0 | 2025-12-03 | Two-query architecture |
| v9.0.0 | 2025-11-28 | TanStack Query integration |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
