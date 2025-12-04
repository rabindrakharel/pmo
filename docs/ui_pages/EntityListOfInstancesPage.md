# EntityListOfInstancesPage

**Version:** 11.3.1 | **Location:** `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` | **Updated:** 2025-12-03

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
const {
  updateEntity,
  createEntity,
  deleteEntity,
} = useOptimisticMutation(entityCode, {
  listQueryParams: queryParams,
  refetchOnSuccess: true,
});
```

---

## Inline Edit State Management (v11.3.1)

### Industry Standard Pattern

**Used by:** Notion, Linear, Airtable, Figma, Google Sheets

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SINGLE SOURCE OF TRUTH: TanStack Query Cache                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Add Row Click                                                          ││
│  │       │                                                                 ││
│  │       ▼                                                                 ││
│  │  queryClient.setQueryData(queryKey, old => ({                          ││
│  │    ...old,                                                              ││
│  │    data: [...old.data, { id: temp_id, _isNew: true }]                  ││
│  │  }))                                                                    ││
│  │       │                                                                 ││
│  │       ▼                                                                 ││
│  │  UI re-renders instantly (row appears in table)                         ││
│  │       │                                                                 ││
│  │       ▼                                                                 ││
│  │  User edits → editedData state (local form values only)                 ││
│  │       │                                                                 ││
│  │       ▼                                                                 ││
│  │  Save → createEntity({ existingTempId }) → skip onMutate temp row      ││
│  │       │                                                                 ││
│  │       ▼                                                                 ││
│  │  Cancel → queryClient.setQueryData() removes temp row                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  KEY PRINCIPLE: NO separate local state for data rows                       │
│                 Local state ONLY for form input values                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reusable Hook: useInlineAddRow (v11.3.1)

The `useInlineAddRow` hook encapsulates the entire inline add row pattern for reuse:

```typescript
import {
  useInlineAddRow,
  createTempRow,
  shouldBlockNavigation,
} from '@/db/cache/hooks';
import { useOptimisticMutation } from '@/db/tanstack-index';

function EntityListOfInstancesPage({ entityCode }: Props) {
  const { createEntity, updateEntity } = useOptimisticMutation(entityCode);

  const {
    // State
    editingRow,
    editedData,
    isAddingRow,
    isSaving,

    // Actions
    handleAddRow,
    handleEditRow,
    handleFieldChange,
    handleSave,
    handleCancel,

    // Utilities
    isRowEditing,
    isTempRow,
    getFieldValue,
  } = useInlineAddRow({
    entityCode,
    createEntity,
    updateEntity,
    transformForApi,
    transformFromApi,
    onSaveSuccess: (data, isNew) => toast.success(isNew ? 'Created' : 'Updated'),
    onSaveError: (error) => toast.error(error.message),
  });

  // Create a temp row on "Add" button click
  const handleStartAddRow = useCallback(() => {
    const newRow = createTempRow({
      defaults: { dl__status: 'draft', active_flag: true },
      generateName: () => 'New Item',
    });
    handleAddRow(newRow);
  }, [handleAddRow]);

  // Block navigation for temp rows
  const handleRowClick = useCallback((item) => {
    if (shouldBlockNavigation(item.id)) return;
    navigate(`/${entityCode}/${item.id}`);
  }, [entityCode, navigate]);

  return (
    <EntityListOfInstancesTable
      data={formattedData}
      editingRow={editingRow}
      onAddRow={handleStartAddRow}
      onSave={handleSave}
      onCancel={handleCancel}
      onRowClick={handleRowClick}
    />
  );
}
```

### What Each Layer Owns

| Layer | Owns | Example |
|-------|------|---------|
| **TanStack Query Cache** | What rows exist | `[{id: 1}, {id: 2}, {id: temp_3}]` |
| **useInlineAddRow** | Edit state + cache ops | `editingRow`, `handleAddRow`, `handleSave` |
| **Component** | Event handlers | `onClick`, `onSubmit` |

### existingTempId Pattern (Critical)

The key innovation in v11.3.1 is the `existingTempId` option passed to `createEntity()`:

```typescript
// When saving a new row that already exists in cache:
await createEntity(transformedData, { existingTempId: 'temp_123' });

// In useOptimisticMutation:
onMutate: async ({ data, existingTempId }) => {
  if (existingTempId) {
    // Row already in cache - DO NOT create another temp row
    // Just capture state for rollback
    return { entityId: existingTempId };
  }
  // Original flow: create temp row
};

onSuccess: (serverData, variables, context) => {
  // Replace temp row with real server data
  updateAllListCaches((list) =>
    list.map(item => item.id === context.entityId ? serverData : item)
  );
  // v11.3.1: SKIP refetch when existingTempId (prevents race condition)
};
```

### Manual Implementation (Alternative)

If not using the hook, implement manually:

```typescript
// UI mode state (local)
const [editingRow, setEditingRow] = useState<string | null>(null);
const [editedData, setEditedData] = useState<any>({});
const [isAddingRow, setIsAddingRow] = useState(false);

// Data comes from TanStack Query cache (single source of truth)
const { data: rawData } = useEntityInstanceData(entityCode, queryParams);
```

### Add Row Handler

```typescript
const handleAddRow = useCallback((newRow: any) => {
  // Add temp row directly to TanStack Query cache
  const queryCache = queryClient.getQueryCache();
  const matchingQueries = queryCache.findAll({
    queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
  });

  for (const query of matchingQueries) {
    queryClient.setQueryData(query.queryKey, (old: any) => {
      if (!old?.data) return old;
      return {
        ...old,
        data: [...old.data, { ...newRow, _isNew: true }],
        total: (old.total || 0) + 1,
      };
    });
  }

  setEditingRow(newRow.id);
  setEditedData(newRow);
  setIsAddingRow(true);
}, [entityCode, queryClient]);
```

### Cancel Handler (removes temp row from cache)

```typescript
const handleCancelInlineEdit = useCallback(() => {
  if (isAddingRow && editingRow) {
    // Remove temp row from ALL matching TanStack Query caches
    const queryCache = queryClient.getQueryCache();
    const matchingQueries = queryCache.findAll({
      queryKey: QUERY_KEYS.entityInstanceDataByCode(entityCode),
    });

    for (const query of matchingQueries) {
      queryClient.setQueryData(query.queryKey, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.filter((row: any) => row.id !== editingRow),
          total: Math.max(0, (old.total || 0) - 1),
        };
      });
    }
  }
  setEditingRow(null);
  setEditedData({});
  setIsAddingRow(false);
}, [isAddingRow, editingRow, entityCode, queryClient]);
```

### Save Handler (with existingTempId)

```typescript
const handleSaveInlineEdit = useCallback(async (record: any) => {
  const rawRecord = record.raw || record;
  const recordId = rawRecord.id;
  const isNewRow = isAddingRow || recordId?.startsWith('temp_') || rawRecord._isNew;

  const transformedData = transformForApi(editedData, rawRecord);
  delete transformedData._isNew;
  delete transformedData._isOptimistic;
  if (isNewRow) delete transformedData.id;

  try {
    if (isNewRow) {
      // v11.3.1: Pass existingTempId to skip duplicate temp row in onMutate
      await createEntity(transformedData, { existingTempId: recordId });
    } else {
      await updateEntity(recordId, transformedData);
    }
  } finally {
    setEditingRow(null);
    setEditedData({});
    setIsAddingRow(false);
  }
}, [editedData, isAddingRow, createEntity, updateEntity]);
```

### Anti-Pattern (Avoided)

```typescript
// ❌ WRONG: Two competing data sources (causes duplicate rows)
const [localData, setLocalData] = useState([]);           // Local state
const { data: rawData } = useEntityInstanceData(...);     // Cache

const data = localData.length > 0 ? localData : rawData;  // Which one wins?

// ❌ WRONG: No existingTempId (causes duplicate temp rows)
handleAddRow → adds temp_123 to cache
createEntity() → onMutate adds temp_456 to cache  // DUPLICATE!

// ✅ CORRECT: Single source of truth + existingTempId
const { data: rawData } = useEntityInstanceData(...);     // Cache is THE source
handleAddRow → adds temp_123 to cache
createEntity(data, { existingTempId: 'temp_123' }) → skips onMutate temp row
```

### Data Flow Comparison

| Operation | Anti-Pattern (broken) | Industry Standard (v11.3.1) |
|-----------|----------------------|----------------------------|
| Add row | `setLocalData([...])` | `queryClient.setQueryData(...)` |
| Cancel | `setLocalData(filter(...))` | `queryClient.setQueryData(filter(...))` |
| Save | `createEntity()` adds 2nd temp | `createEntity({ existingTempId })` replaces temp |
| Edit existing | Copy to local, edit, save | Edit form state, `updateEntity()` updates cache |

### Navigation Blocking for Temp Rows

```typescript
import { shouldBlockNavigation } from '@/db/cache/hooks';

const handleRowClick = (item) => {
  // Prevent navigation to temp rows (they don't exist on server)
  if (shouldBlockNavigation(item.id)) {
    return;  // Blocked - row not yet saved
  }
  navigate(`/${entityCode}/${item.id}`);
};

// shouldBlockNavigation('temp_123') → true
// shouldBlockNavigation('real-uuid') → false
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
| v11.3.1 | 2025-12-03 | **useInlineAddRow hook** - Reusable pattern with `existingTempId` to prevent duplicate temp rows. Skip refetch on save to prevent race conditions. Added `createTempRow()` factory and `shouldBlockNavigation()` utility. |
| v12.4.0 | 2025-12-03 | **Industry-standard inline edit pattern** - Single source of truth via TanStack Query cache. Removed `localData` anti-pattern. Temp rows added directly to cache. |
| v9.4.0 | 2025-12-03 | Two-query architecture |
| v9.0.0 | 2025-11-28 | TanStack Query integration |
| v1.0.0 | 2025-10-01 | Initial release |

---

**Last Updated:** 2025-12-03 | **Status:** Production Ready
