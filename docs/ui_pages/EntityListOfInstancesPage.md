# EntityListOfInstancesPage

**Version:** 14.3.0 | **Location:** `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx` | **Updated:** 2025-12-11

---

## Overview

EntityListOfInstancesPage is a universal listing page that renders the main list view for ANY entity type in the system. It's one of the "3 Universal Pages" that power the entire application, dynamically supporting table, kanban, grid, calendar, DAG, and hierarchy views.

**Core Principles:**
- Single component renders 27+ entity types
- Config-driven view switching
- Two-query architecture (metadata → data)
- Format-at-read pattern for display values
- **v14.3.0:** Multi-select (Ctrl+Click/Ctrl+Shift+Arrow) with Delete key batch operations
- **v10.1.0:** Default sort/pagination from `app.entity.config_datatable` (DB-driven)

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
│  │  ┌─────────────────────────────────────────────────────────────────────┐││
│  │  │  DeleteOrUnlinkModal (standalone mode - delete only)                │││
│  │  │  - No parentContext = delete confirmation only                      │││
│  │  │  - v14.3.0: Supports batch mode via entityIds prop                 │││
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

## State Management

### Internal State

```typescript
// View & Pagination
const [view, setView] = useViewMode(entityCode, defaultView);  // Persisted per entity
const [currentPage, setCurrentPage] = useState(1);
const [appendedData, setAppendedData] = useState<any[]>([]);
const [clientPageSize, setClientPageSize] = useState(500);

// Inline Editing (TanStack Query = single source of truth)
const [editingRow, setEditingRow] = useState<string | null>(null);
const [editedData, setEditedData] = useState<any>({});
const [isAddingRow, setIsAddingRow] = useState(false);

// Delete Modal
const [deleteModalOpen, setDeleteModalOpen] = useState(false);
const [deleteModalRecord, setDeleteModalRecord] = useState<any>(null);
```

### TanStack Query Integration

```typescript
// QUERY 1: METADATA (30-min cache)
const { viewType, editType, fields, isLoading: metadataLoading } =
  useEntityInstanceMetadata(entityCode, mappedView);

// QUERY 2: DATA (5-min cache)
const { data: rawData, total, isLoading, isFetching, refetch } =
  useEntityInstanceData(entityCode, queryParams);

// OPTIMISTIC MUTATIONS
const { updateEntity, createEntity, deleteEntity } = useOptimisticMutation(entityCode, {
  listQueryParams: queryParams,
  refetchOnSuccess: false,  // v11.4.2: Disabled for better performance
});
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
│  → GET /api/v1/{entity}?limit=1000&offset=0                                │
│  → Returns: { data, total }                                                 │
│  → Purpose: Populate rows AFTER metadata ready                              │
│                                                                              │
│  RENDER SEQUENCE:                                                           │
│  1. Metadata loading → Show skeleton with column headers                    │
│  2. Metadata ready → Render columns structure                               │
│  3. Data loading → Show row skeletons                                       │
│  4. Data ready → Populate formatted rows                                    │
│                                                                              │
│  PAGINATION STRATEGY (v9.4.1):                                              │
│  - API fetches 1000 records per request                                     │
│  - Client renders 500 at a time (pagination slider)                         │
│  - Search/filter works against all 1000 fetched records                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## View Components

| View | Component | When Used | Features |
|------|-----------|-----------|----------|
| `table` | `EntityListOfInstancesTable` | Default | Full CRUD, inline edit, multi-select, batch delete |
| `kanban` | `KanbanView` | Status-based grouping | Drag & drop cards, optimistic moves |
| `grid` | `GridView` | Card-based layout | Image support, responsive columns |
| `calendar` | `CalendarView` | Date-based entities | Person filtering, slot grid |
| `dag` | `DAGVisualizer` | Workflow stages | Node connections, level layout |
| `hierarchy` | `HierarchyGraphView` | Parent-child trees | Collapsible nodes |

---

## Key Features

### 1. Dynamic Entity Configuration

```typescript
const config = getEntityConfig(entityCode);
// Returns: { label, labelPlural, icon, columns, defaultSort, searchFields,
//           supportedViews, kanban, grid, calendar }
```

### 2. View Mode Persistence

```typescript
const [view, setView] = useViewMode(entityCode, defaultView);
// Persists view selection per entity in localStorage
// Key format: `viewMode_${entityCode}`
```

### 3. Reactive Formatting Pattern (v12.6.0)

```typescript
// Uses useFormattedEntityData hook with cache subscription
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
```

### 4. Sidebar Auto-Collapse

```typescript
useEffect(() => {
  collapseSidebar();  // Maximize content area on page load
}, []);
```

---

## Inline Editing System

### State Flow (v11.3.0 - Single Source of Truth)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INLINE EDIT STATE MANAGEMENT                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PRINCIPLE: TanStack Query cache is the ONLY data source                    │
│  No localData copying - all mutations go directly to cache                  │
│                                                                              │
│  ADD ROW FLOW:                                                              │
│  ─────────────                                                              │
│  1. User clicks "Add Row" → handleAddRow(newRow)                            │
│  2. queryClient.setQueryData() → Add temp row to cache                      │
│  3. setEditingRow(tempId) → Enter edit mode                                 │
│  4. User fills fields → handleInlineEdit() → editedData updated             │
│  5. User saves → createEntity(data, { existingTempId })                     │
│  6. API returns real ID → Cache updated with server data                    │
│                                                                              │
│  CELL EDIT FLOW (v12.5.0):                                                  │
│  ─────────────────────────                                                  │
│  1. User holds cell 500ms → setEditingCell({ rowId, columnKey })            │
│  2. User edits value → DebouncedInput local state                           │
│  3. User clicks outside/Enter → handleCellSave(rowId, columnKey, value)     │
│  4. updateEntity(rowId, { [columnKey]: value }) → Optimistic update         │
│                                                                              │
│  CANCEL FLOW:                                                               │
│  ────────────                                                               │
│  1. User cancels → handleCancelInlineEdit()                                 │
│  2. If temp row: queryClient.setQueryData() → Remove from cache             │
│  3. Clear edit state: setEditingRow(null), setEditedData({})                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Handlers

| Handler | Purpose | Used By |
|---------|---------|---------|
| `handleInlineEdit` | Update `editedData` state | Cell changes during row edit |
| `handleCellSave` | Save single cell (v12.5.0) | Auto-save on blur/Enter |
| `handleSaveInlineEdit` | Save entire row | Explicit Save button |
| `handleCancelInlineEdit` | Cancel + remove temp row | Cancel button, Escape key |
| `handleAddRow` | Add temp row to cache | "Add Row" button |

---

## Delete System

### Single Delete (v9.5.1)

```typescript
// Standalone page (no parentContext) = Delete confirmation only
const handleDeleteClick = useCallback((record: any) => {
  setDeleteModalRecord(record);
  setDeleteModalOpen(true);
}, []);

const handleDeleteConfirm = useCallback(async () => {
  const rawRecord = deleteModalRecord.raw || deleteModalRecord;
  const recordId = rawRecord.id;

  // Temp row: Remove from cache only (no API call)
  if (recordId?.startsWith('temp_') || rawRecord._isNew) {
    queryClient.setQueryData(...);  // Remove temp row
    return;
  }

  // Real record: Optimistic delete
  await deleteEntity(rawRecord.id);
}, [deleteModalRecord, deleteEntity, queryClient]);
```

### Modal Integration

```tsx
<DeleteOrUnlinkModal
  isOpen={deleteModalOpen}
  onClose={() => { setDeleteModalOpen(false); setDeleteModalRecord(null); }}
  entityCode={entityCode}
  entityLabel={config?.displayName}
  entityName={deleteModalRecord?.raw?.name || deleteModalRecord?.name || 'this record'}
  // No parentContext = standalone mode (delete confirmation only)
  onDelete={handleDeleteConfirm}
/>
```

**Note:** Multi-select batch delete is available via `EntityListOfInstancesTable`'s internal selection system with Delete key trigger. See [EntityListOfInstancesTable.md](../ui_components/EntityListOfInstancesTable.md) for batch delete documentation.

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
│     useEntityInstanceData('project', { limit: 1000 })                       │
│     → Returns raw entity data                                               │
│                                                                              │
│  5. Format (via useFormattedEntityData):                                    │
│     formatDataset(rawData, metadata)                                        │
│     → Returns FormattedRow[] with display values                            │
│     → Reactive to datalabel cache changes                                   │
│                                                                              │
│  6. Render:                                                                 │
│     <EntityListOfInstancesTable                                             │
│       data={formattedData}                                                  │
│       metadata={metadata}                                                   │
│       selectable={true}      // Multi-select enabled                        │
│       inlineEditable={true}  // Cell-level editing                          │
│       allowAddRow={true}     // Inline add row                              │
│     />                                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Row Actions

```typescript
const rowActions: RowAction[] = useMemo(() => [
  {
    key: 'edit',
    label: 'Edit',
    icon: <Edit className="h-4 w-4" />,
    variant: 'default',
    onClick: (record) => {
      const rawRecord = record.raw || record;
      setEditingRow(rawRecord.id);
      setEditedData(transformFromApi({ ...rawRecord }));
    }
  },
  {
    key: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-4 w-4" />,
    variant: 'danger',
    onClick: handleDeleteClick
  }
], [handleDeleteClick]);
```

---

## Table View Configuration

```tsx
<EntityListOfInstancesTable
  // Data
  data={tableData}
  metadata={metadata}
  loading={loading}
  pagination={pagination}

  // Navigation
  onRowClick={handleRowClick}

  // Features
  searchable={true}
  filterable={true}
  columnSelection={true}
  rowActions={rowActions}
  selectable={true}  // v14.3.0: Enables Ctrl+Click multi-select

  // Inline Editing
  inlineEditable={true}
  editingRow={editingRow}
  editedData={editedData}
  onInlineEdit={handleInlineEdit}
  onCellSave={handleCellSave}
  onSaveInlineEdit={handleSaveInlineEdit}
  onCancelInlineEdit={handleCancelInlineEdit}

  // Add Row
  allowAddRow={true}
  onAddRow={handleAddRow}

  // Loading Indicators (v13.1.0)
  isFetchingNextPage={isFetching && !dataLoading}
  hasNextPage={hasMore}

  // Entity Context (standalone mode)
  entityCode={entityCode}
  // Note: No parentContext = standalone list page
  // Delete action shows confirmation only (no Unlink option)
/>
```

---

## Keyboard Shortcuts (v14.3.0)

The table view supports these keyboard shortcuts (handled by `EntityListOfInstancesTable`):

| Shortcut | Action |
|----------|--------|
| `Ctrl+Click` | Toggle row selection, set anchor |
| `Ctrl+Shift+Arrow Up/Down` | Extend/contract selection from anchor |
| `Delete` / `Backspace` | Open delete modal for selected rows |
| `Arrow Up/Down` | Navigate between rows |
| `E` | Enter edit mode on focused row |
| `Tab` | Navigate to next editable cell |
| `Enter` | Save current cell |
| `Escape` | Cancel edit |
| `Ctrl+Z` | Undo last cell edit |

**Note:** Multi-select and batch delete are handled internally by `EntityListOfInstancesTable`. This page does not need additional batch delete handlers since it operates in standalone mode (single delete via modal).

---

## Kanban View Integration

```typescript
// Optimistic card move
const handleCardMove = useCallback(async (itemId: string, fromColumn: string, toColumn: string) => {
  if (!config?.kanban) return;

  try {
    await updateEntity(itemId, { [config.kanban.groupByField]: toColumn });
  } catch (err) {
    // Error handling and rollback by useOptimisticMutation
  }
}, [config, updateEntity]);

// Render
<KanbanView
  config={config}
  data={data}
  onCardClick={handleRowClick}
  onCardMove={handleCardMove}
  emptyMessage={`No ${config.pluralName.toLowerCase()} found`}
/>
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

// Row click navigation
const handleRowClick = useCallback((item: any) => {
  const rawItem = item.raw || item;
  const id = rawItem.id;

  // Block navigation for temp rows
  if (id?.toString().startsWith('temp_')) return;

  // Clean up empty temp row if exists
  if (isAddingRow && editingRow?.toString().startsWith('temp_')) {
    // Remove empty temp row from cache...
  }

  navigate(`/${entityCode}/${id}`);
}, [config, entityCode, navigate, isAddingRow, editingRow]);
```

---

## Related Components

| Component | Relationship |
|-----------|--------------|
| [Layout](./Layout.md) | Wraps page with sidebar/header |
| [EntityListOfInstancesTable](../ui_components/EntityListOfInstancesTable.md) | Table view with multi-select, batch delete |
| [DeleteOrUnlinkModal](../ui_components/DeleteOrUnlinkModal.md) | Delete confirmation modal |
| [KanbanBoard](./KanbanBoard.md) | Kanban view component |
| [ViewSwitcher](./ViewSwitcher.md) | View mode selector |
| [DAGVisualizer](./DAGVisualizer.md) | Workflow visualization |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [EntityListOfInstancesTable.md](../ui_components/EntityListOfInstancesTable.md) | Table component with multi-select system |
| [DeleteOrUnlinkModal.md](../ui_components/DeleteOrUnlinkModal.md) | Delete/Unlink modal component |
| [STATE_MANAGEMENT.md](../state_management/STATE_MANAGEMENT.md) | TanStack Query + Dexie architecture |
| [BADGE_COLOR_SOLUTION_ARCHITECTURE.md](../BADGE_COLOR_SOLUTION_ARCHITECTURE.md) | Reactive formatting pattern |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v14.3.0 | 2025-12-11 | Multi-select support via EntityListOfInstancesTable (Ctrl+Click, Ctrl+Shift+Arrow, Delete key) |
| v12.6.0 | 2025-12-04 | Reactive formatting with cache subscription (fixes badge color bug) |
| v12.5.0 | 2025-12-03 | Cell-level save via `handleCellSave` callback |
| v11.4.2 | 2025-12-02 | Disabled `refetchOnSuccess` for better performance |
| v11.4.1 | 2025-12-02 | Auto-cleanup empty temp rows on navigation |
| v11.3.0 | 2025-11-30 | TanStack Query single source of truth (no localData copying) |
| v9.5.1 | 2025-11-28 | DeleteOrUnlinkModal integration (replaces window.confirm) |
| v9.5.0 | 2025-11-28 | Optimistic mutations for instant UI feedback |
| v9.4.1 | 2025-11-27 | Client-side pagination (1000 fetch, 500 render) |
| v9.4.0 | 2025-11-27 | Two-query architecture (metadata → data separation) |
| v9.0.0 | 2025-11-28 | TanStack Query + Dexie migration |
| v8.0.0 | 2025-11-23 | Format-at-read pattern |

---

**Last Updated:** 2025-12-11 | **Status:** Production Ready
