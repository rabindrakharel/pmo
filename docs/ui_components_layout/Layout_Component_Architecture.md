# Frontend Architecture - Component, Page & State Design

> **React 19, TypeScript, Backend-Driven Metadata, Zero Pattern Detection**
> Universal page system with 3 pages handling 27+ entity types dynamically

**Version:** 4.3.0 | **Last Updated:** 2025-11-22

---

## Semantics

The PMO frontend uses a **three-layer component architecture** (Base → Domain → Application) with universal pages that render any entity type using backend-driven metadata. No entity-specific pages or components exist.

**Core Principle:** Base = UI only. Domain = Data-aware. Application = Business logic. Backend metadata drives all rendering.

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      THREE-LAYER COMPONENT HIERARCHY                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    APPLICATION LAYER                             │    │
│  │  EntityDataTable, EntityFormContainer, FilteredDataTable        │    │
│  │  KanbanView, CalendarView, GridView, DAGVisualizer              │    │
│  │  HierarchyGraphView, DynamicChildEntityTabs                     │    │
│  │  (Business logic, state management, API integration)            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │ composes                                 │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      DOMAIN LAYER                                │    │
│  │  EntitySelect, EntityMultiSelect, DataLabelSelect               │    │
│  │  EntitySelectDropdown, EntityMultiSelectTags                    │    │
│  │  (Data-aware components with useQuery hooks)                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │ wraps                                    │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       BASE LAYER                                 │    │
│  │  Select, MultiSelect, SearchableMultiSelect, ColoredDropdown    │    │
│  │  (Generic, reusable, no business logic, props-driven)           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Layer Summary

### Base Layer (No Data Dependencies)

| Component | File | Purpose |
|-----------|------|---------|
| Select | `ui/Select.tsx` | Single dropdown (static options) |
| SearchableMultiSelect | `ui/SearchableMultiSelect.tsx` | Multi-select with tags |
| ColoredDropdown | `ui/ColoredDropdown.tsx` | Dropdown with colored badges |

### Domain Layer (Data-Aware)

| Component | File | Purpose | API |
|-----------|------|---------|-----|
| EntitySelect | `ui/EntitySelect.tsx` | Entity reference picker | `/entity/{code}/entity-instance-lookup` |
| EntityMultiSelect | `ui/EntityMultiSelect.tsx` | Multiple entity refs | `/entity/{code}/entity-instance-lookup` |
| DataLabelSelect | `ui/DataLabelSelect.tsx` | Settings dropdown | `/setting?datalabel={name}` |

### Application Layer (Business Logic)

| Component | File | Purpose |
|-----------|------|---------|
| EntityDataTable | `ui/EntityDataTable.tsx` | Universal data table (backend metadata-driven) |
| EntityFormContainer | `entity/EntityFormContainer.tsx` | Universal form (backend metadata-driven) |
| FilteredDataTable | `dataTable/FilteredDataTable.tsx` | Routing wrapper + own data fetching |
| KanbanView | `ui/KanbanView.tsx` | Kanban board with drag-drop |
| CalendarView | `ui/CalendarView.tsx` | Calendar event view |
| GridView | `ui/GridView.tsx` | Card grid view |
| DAGVisualizer | `workflow/DAGVisualizer.tsx` | Workflow/stage graph view |
| HierarchyGraphView | `hierarchy/HierarchyGraphView.tsx` | Parent-child hierarchy graph |
| DynamicChildEntityTabs | `entity/DynamicChildEntityTabs.tsx` | Dynamic child tabs |

---

## 1. Architecture Overview

### Core Principle: Universal Pages + Backend Metadata

The PMO platform uses a **universal page architecture** where 3 main pages handle all 27+ entity types dynamically using **backend-generated metadata**. No entity-specific pages or components.

```
┌─────────────────────────────────────────────────────────────────┐
│                     UNIVERSAL PAGE SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EntityListOfInstancesPage.tsx        → Handles ALL entity list views     │
│    ├── /project             (projects list)                    │
│    ├── /task                (tasks list)                       │
│    ├── /employee            (employees list)                   │
│    └── ... 27+ entities                                        │
│                                                                 │
│  EntitySpecificInstancePage.tsx      → Handles ALL entity detail views   │
│    ├── /project/:id         (project detail + child tabs)     │
│    ├── /task/:id            (task detail + child tabs)        │
│    ├── /employee/:id        (employee detail + child tabs)    │
│    └── ... 27+ entities                                        │
│                                                                 │
│  EntityFormPage.tsx        → Handles ALL entity forms          │
│    ├── /project/new         (create project)                  │
│    ├── /project/:id/edit    (edit project)                    │
│    └── ... 27+ entities                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                   Backend Metadata Drives
                   ALL Rendering Decisions
```

---

## 2. Page Architecture

### 2.1 EntityListOfInstancesPage.tsx

**Purpose**: List/grid/kanban views for any entity type

**Location**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

**Responsibilities**:
1. Fetch entity data via `useEntityInstanceList` hook (non-table views)
2. Receive backend metadata and datalabels in API response
3. Pass metadata to view components (FilteredDataTable, KanbanView, etc.)
4. Handle view mode switching (table/kanban/grid/calendar/graph)
5. Handle pagination with "Load More" pattern
6. Handle entity creation navigation
7. Prefetch entity data on row hover via `usePrefetch`
8. Handle optimistic updates for kanban card moves via `useEntityMutation`

**State Management** (React Query + Zustand):
```typescript
// Server state via React Query (useEntityInstanceList hook)
const queryParams = useMemo(() => ({
  page: currentPage,
  pageSize: 100,
  view: view,  // 'table' | 'kanban' | 'grid' | 'calendar' | 'graph'
}), [currentPage, view]);

const {
  data: queryResult,
  isLoading: loading,
  error: queryError,
  refetch,
} = useEntityInstanceList(entityCode, queryParams, {
  enabled: view !== 'table' && !!config,  // Table uses FilteredDataTable's own fetching
});

// Extract data from React Query result
const data = queryResult?.data || [];
const metadata = queryResult?.metadata || null;
const datalabels = queryResult?.datalabels || [];
const totalRecords = queryResult?.total || 0;

// Client state via useState (UI only)
const [view, setView] = useViewMode(entityCode, defaultView);  // Persisted view preference
const [currentPage, setCurrentPage] = useState(1);
```

**Data Flow**:
```
1. URL: /project
   ↓
2. EntityListOfInstancesPage receives entityCode as prop
   ↓
3. For TABLE view: FilteredDataTable handles its own data fetching
   For OTHER views: useEntityInstanceList(entityCode, queryParams) triggers React Query
   ↓
4. React Query: GET /api/v1/project?page=1&pageSize=100&view=kanban
   ↓
5. Backend returns: { data: [...], fields: [...], metadata: {...}, datalabels: [...], total, limit, offset }
   ↓
6. React Query caches response (2-min staleTime for lists)
   ↓
7. Pass to view component (FilteredDataTable, KanbanView, GridView, CalendarView, DAGVisualizer)
   ↓
8. View component renders using backend metadata + datalabels
```

**Key Props**:
```typescript
interface EntityListOfInstancesPageProps {
  entityCode: string;      // 'project', 'task', etc.
  defaultView?: ViewMode;  // Optional default view override
}
```

**Supported Views**: table, kanban, grid, calendar, graph

### 2.2 EntitySpecificInstancePage.tsx

**Purpose**: Detail view with child entity tabs for any entity type

**Location**: `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

**Responsibilities**:
1. Fetch single entity record (`GET /api/v1/{entity}/{id}`)
2. Receive backend metadata for field rendering
3. Render detail fields via `EntityFormContainer` using backend metadata
4. Display child entity tabs dynamically via `useDynamicChildEntityTabs`
5. Handle inline editing with Zustand edit store
6. Handle keyboard shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Shift+Z, Escape)
7. Handle entity sharing via `ShareModal`
8. Handle entity linkages via `UnifiedLinkageModal`
9. Handle file uploads for artifact/cost/revenue entities

**State Management** (React Query + Zustand):
```typescript
// Server state via React Query
const { data: queryResult, isLoading, error, refetch } = useEntityInstance(entityCode, id);
const data = queryResult?.data || null;
const backendMetadata = queryResult?.metadata || null;

// Client edit state via Zustand (with useShallow for batched subscriptions)
const {
  isEditing, currentData: editedData, dirtyFields,
  startEdit, updateField, saveChanges, cancelEdit,
  undo, redo, canUndo, canRedo
} = useEntityEditStore(useShallow(state => ({
  isEditing: state.isEditing,
  currentData: state.currentData,
  dirtyFields: state.dirtyFields,
  // ... other selectors
})));

// Display data: editedData during edit, data in view mode
const displayData = isEditing ? editedData : data;
```

**Child Tabs (Dynamic)**:
```typescript
// DynamicChildEntityTabs.tsx reads entity.child_entity_codes
// Example for project:
child_entity_codes: ['task', 'artifact', 'wiki', 'cost']

// Renders tabs:
<Tabs>
  <Tab key="overview">Overview</Tab>
  <Tab key="task">Tasks</Tab>        {/* /project/:id/task */}
  <Tab key="artifact">Artifacts</Tab>
  <Tab key="wiki">Wiki</Tab>
  <Tab key="cost">Costs</Tab>
</Tabs>
```

**Data Flow (View Mode)**:
```
1. URL: /project/abc123
   ↓
2. EntitySpecificInstancePage extracts entityCode + id
   ↓
3. useEntityInstance(entityCode, id) triggers React Query
   ↓
4. React Query: GET /api/v1/project/abc123?view=entityFormContainer
   ↓
5. Backend returns: { data: {...}, fields: [...], metadata: {...} }
   ↓
6. React Query caches response (5-min staleTime)
   ↓
7. EntityFormContainer renders fields from metadata.entityFormContainer
   ↓
8. DynamicChildEntityTabs renders child tabs from entity.child_entity_codes
```

**Data Flow (Edit Mode)**:
```
1. User clicks Edit button
   ↓
2. startEdit(entityCode, id, data) → Zustand store
   ↓
3. Zustand: isEditing=true, currentData=data copy
   ↓
4. EntityFormContainer receives editedData (from Zustand)
   ↓
5. User types → DebouncedInput (local state, instant feedback)
   ↓
6. 300ms debounce → updateField(fieldKey, value) → Zustand
   ↓
7. Zustand: updates currentData, tracks dirtyFields
   ↓
8. User clicks Save → saveChanges() → PATCH /api/v1/project/abc123
   ↓
9. React Query cache invalidated → refetch fresh data
```

### 2.3 EntityFormPage.tsx

**Purpose**: Create/edit forms for any entity type

**Location**: `apps/web/src/pages/shared/EntityFormPage.tsx`

**Responsibilities**:
1. Fetch entity metadata (create mode) or record + metadata (edit mode)
2. Render form fields using `renderEditModeFromMetadata`
3. Handle form submission
4. Handle validation errors
5. Redirect after save

**State Management** (React Query + Local State):
```typescript
// Server state via React Query (for edit mode)
const { data: queryResult, isLoading } = useEntityInstance(entityCode, id);

// Local form state (not Zustand - standalone page)
const [formData, setFormData] = useState<Record<string, any>>({});
const [errors, setErrors] = useState<Record<string, string>>({});

// Mutation for create/update
const { createEntity, updateEntity, isCreating, isUpdating } = useEntityMutation(entityCode);
```

**Data Flow (Create)**:
```
1. URL: /project/new
   ↓
2. EntityFormPage extracts entityCode, mode='create'
   ↓
3. Fetch metadata: GET /api/v1/project?limit=0&view=entityFormContainer
   ↓
4. Backend returns: { data: [], metadata: {...} }
   ↓
5. EntityFormContainer renders empty form from metadata.entityFormContainer
   ↓
6. User fills form → DebouncedInput → local formData state
   ↓
7. Submit: createEntity(formData) → POST /api/v1/project
   ↓
8. React Query cache invalidated → Redirect: /project/:id
```

**Data Flow (Edit via Dedicated Page)**:
```
1. URL: /project/abc123/edit
   ↓
2. useEntityInstance(entityCode, id) → React Query fetch
   ↓
3. Backend returns: { data: {...}, metadata: {...} }
   ↓
4. EntityFormContainer pre-fills form from data
   ↓
5. User edits → DebouncedInput → local formData state
   ↓
6. Submit: updateEntity(id, formData) → PATCH /api/v1/project/abc123
   ↓
7. React Query cache invalidated → Redirect: /project/abc123
```

**Note**: Most edits happen inline via EntitySpecificInstancePage (Zustand), not this page.

---

## 3. Component Architecture

### 3.1 Component Hierarchy

```
┌────────────────────────────────────────────────────────────────┐
│                         APP LEVEL                              │
├────────────────────────────────────────────────────────────────┤
│  App.tsx                                                       │
│    ├── Router (React Router v6)                               │
│    ├── AuthProvider (Authentication context)                  │
│    ├── EntityMetadataProvider (Entity metadata cache)         │
│    └── ToastProvider (Notifications)                          │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                       LAYOUT LEVEL                             │
├────────────────────────────────────────────────────────────────┤
│  Layout.tsx                                                    │
│    ├── Sidebar (Navigation)                                   │
│    ├── Topbar (User menu, search)                            │
│    └── <Outlet /> (Page content)                             │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                        PAGE LEVEL                              │
├────────────────────────────────────────────────────────────────┤
│  EntityListOfInstancesPage / EntitySpecificInstancePage / EntityFormPage           │
│    ├── Breadcrumbs                                            │
│    ├── ActionButtons (Create, Edit, Delete)                  │
│    └── Content Container                                      │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                     CONTAINER LEVEL                            │
├────────────────────────────────────────────────────────────────┤
│  FilteredDataTable (Routing + wrapper)                        │
│    ├── EntityDataTable (Entity data)                         │
│    └── SettingsDataTable (Datalabel data)                    │
│                                                                │
│  EntityFormContainer (Form rendering)                         │
│    ├── renderEditModeFromMetadata for each field             │
│    └── Form validation                                        │
│                                                                │
│  DynamicChildEntityTabs (Child entity tabs)                  │
│    └── FilteredDataTable per tab                             │
└────────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────────┐
│                       UI COMPONENT LEVEL                       │
├────────────────────────────────────────────────────────────────┤
│  DataTableBase (Pure base table)                             │
│    ├── Table structure                                        │
│    ├── Sorting UI                                             │
│    ├── Inline editing pattern                                │
│    └── NO formatting logic                                    │
│                                                                │
│  EntityDataTable (Entity data extension)                     │
│    ├── Extends DataTableBase                                 │
│    ├── Uses renderViewModeFromMetadata                       │
│    ├── Uses renderEditModeFromMetadata                       │
│    └── Backend metadata-driven                               │
│                                                                │
│  SettingsDataTable (Settings extension)                      │
│    ├── Extends DataTableBase                                 │
│    ├── Uses renderDataLabelBadge                             │
│    └── Reorderable rows                                       │
│                                                                │
│  ColoredDropdown (Dropdown with badges)                      │
│    ├── Portal rendering (no clipping)                        │
│    ├── Colored options                                        │
│    └── Smart positioning                                      │
│                                                                │
│  KanbanView (Kanban view)                                     │
│    ├── Column-based card view                                │
│    └── Drag & drop with optimistic updates                    │
│                                                                │
│  CalendarView (Calendar view)                                 │
│    ├── Date-based event view                                 │
│    └── Person-filterable calendar grid                        │
│                                                                │
│  GridView (Card grid view)                                    │
│    └── Responsive card layout                                 │
│                                                                │
│  DAGVisualizer (Workflow graph view)                          │
│    └── Stage-based workflow for dl__*_stage fields            │
│                                                                │
│  HierarchyGraphView (Hierarchy view)                          │
│    └── Parent-child relationship graph                        │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Components

#### FilteredDataTable

**Purpose**: Routing wrapper that delegates to correct table type

**Location**: `apps/web/src/components/shared/dataTable/FilteredDataTable.tsx`

**Props**:
```typescript
interface FilteredDataTableProps {
  entityType: string;           // 'project', 'task', etc.
  parentCode?: string;          // For child entity filtering
  parentId?: string;            // Parent UUID
  inlineEditable?: boolean;     // Enable inline editing
  selectable?: boolean;         // Enable row selection
}
```

**Key Logic**:
```typescript
// Route to correct table type
if (entityType.startsWith('setting_')) {
  return <SettingsDataTable ... />;
}
return <EntityDataTable metadata={metadata} data={data} ... />;
```

#### EntityDataTable

**Purpose**: Universal data table for all entity types (backend metadata-driven)

**Location**: `apps/web/src/components/shared/ui/EntityDataTable.tsx`

**Props**:
```typescript
interface EntityDataTableProps<T> {
  data: T[];                    // Entity records
  metadata?: EntityMetadata;    // Backend metadata (PRIORITY 1)
  columns?: Column[];           // Fallback columns
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  inlineEditable?: boolean;
  selectable?: boolean;
  loading?: boolean;
}
```

**Column Generation** (Backend Metadata Priority):
```typescript
const columns = useMemo(() => {
  // PRIORITY 1: Backend Metadata (100% backend-driven)
  if (metadata?.fields) {
    return metadata.fields
      .filter(f => f.visible.EntityDataTable === true)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        title: fieldMeta.label,
        width: fieldMeta.width,
        align: fieldMeta.align,
        backendMetadata: fieldMeta,  // Store for rendering
        // Backend tells frontend how to render
        render: (value, record) =>
          renderViewModeFromMetadata(value, fieldMeta, record)
      }));
  }

  // PRIORITY 2: Fallback columns (for non-integrated routes)
  if (columns) {
    return columns.map(col => ({
      ...col,
      render: (value, record) => {
        const fallbackMeta = createFallbackMetadata(col.key);
        return renderViewModeFromMetadata(value, fallbackMeta, record);
      }
    }));
  }

  return [];
}, [metadata, columns]);
```

**Edit Mode Rendering**:
```typescript
// Get backend metadata for field
const backendMeta = column.backendMetadata as BackendFieldMetadata | undefined;
const fieldEditable = backendMeta?.editable ?? column.editable ?? false;
const editType = backendMeta?.inputType ?? column.editType ?? 'text';

// Render based on backend instructions
if (isEditing && fieldEditable) {
  if (editType === 'file') {
    return <InlineFileUploadCell accept={backendMeta?.accept} ... />;
  } else if (editType === 'select' && hasSettingOptions) {
    return <ColoredDropdown options={settingsOptions} ... />;
  } else {
    // ALL OTHER FIELDS - Backend metadata-driven
    return renderEditModeFromMetadata(
      value,
      backendMeta || createFallbackMetadata(column.key),
      onChange
    );
  }
}
```

#### EntityFormContainer

**Purpose**: Universal form for create/edit any entity type

**Location**: `apps/web/src/components/shared/entity/EntityFormContainer.tsx`

**Props**:
```typescript
interface EntityFormContainerProps {
  entityType: string;
  entityId?: string;           // For edit mode
  initialData?: any;           // Pre-fill data
  metadata?: EntityMetadata;   // Backend metadata
  onSave?: (data: any) => void;
  onCancel?: () => void;
}
```

**Field Rendering**:
```typescript
// Get backend metadata for field
const fieldMeta = metadata?.fields.find(f => f.key === fieldKey);

// Render based on backend inputType
return renderEditModeFromMetadata(
  formData[fieldKey],
  fieldMeta,
  (newValue) => setFormData({ ...formData, [fieldKey]: newValue })
);
```

#### DynamicChildEntityTabs

**Purpose**: Render child entity tabs based on entity.child_entity_codes

**Location**: `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

**Props**:
```typescript
interface DynamicChildEntityTabsProps {
  parentEntityType: string;    // 'project'
  parentEntityId: string;      // UUID
}
```

**Tab Generation**:
```typescript
// Fetch entity metadata to get child_entity_codes
const entityMeta = await fetch(`/api/v1/entity/codes/${parentEntityType}`);
const childCodes = entityMeta.child_entity_codes; // ['task', 'artifact', 'wiki']

// Render tab for each child
childCodes.map(childCode => (
  <Tab key={childCode} label={childCode}>
    <FilteredDataTable
      entityType={childCode}
      parentCode={parentEntityType}
      parentId={parentEntityId}
    />
  </Tab>
));
```

---

## 4. State Management

### 4.1 State Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT LAYERS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              SERVER STATE (React Query)                  │    │
│  │  • Entity data (lists, instances)                        │    │
│  │  • Metadata (field definitions)                          │    │
│  │  • Datalabels, settings                                  │    │
│  │  • 5-min staleTime, background refetch                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              CLIENT STATE (Zustand)                      │    │
│  │  • Edit mode (isEditing, currentData, dirtyFields)      │    │
│  │  • Undo/redo history                                     │    │
│  │  • UI preferences                                        │    │
│  │  • useShallow for batched subscriptions                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              LOCAL STATE (useState/useRef)               │    │
│  │  • View mode (table/kanban/calendar)                     │    │
│  │  • Modal open/close                                      │    │
│  │  • DebouncedInput local value                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Server State (React Query)

**Custom Hooks** in `apps/web/src/lib/hooks/useEntityQuery.ts`:

| Hook | Purpose | Cache TTL |
|------|---------|-----------|
| `useEntityInstanceList(entityCode, params, options)` | Fetch entity list with pagination | 2 min |
| `useEntityInstance(entityCode, id, options)` | Fetch single entity with metadata | 5 min |
| `useEntityMutation(entityCode)` | Create/update/delete with cache invalidation | N/A |
| `useCacheInvalidation()` | Manual cache invalidation helpers | N/A |
| `usePrefetch()` | Prefetch entity data on hover | N/A |
| `useDynamicChildEntityTabs(entityCode, id)` | Fetch child entity tabs | 5 min |

**Usage**:
```typescript
// List page (non-table views)
const { data: queryResult, isLoading, error, refetch } = useEntityInstanceList('project', {
  page: 1, pageSize: 100, view: 'kanban'
});
const data = queryResult?.data || [];
const metadata = queryResult?.metadata || null;

// Detail page
const { data: queryResult, isLoading, refetch } = useEntityInstance('project', id);
const data = queryResult?.data || null;
const backendMetadata = queryResult?.metadata || null;

// Mutations (with automatic cache invalidation)
const { updateEntity, createEntity, deleteEntity, isUpdating } = useEntityMutation('project');
await updateEntity({ id, data: { name: 'New Name' } });

// Prefetch on hover (for instant navigation)
const { prefetchEntity } = usePrefetch();
prefetchEntity('project', id);
```

### 4.3 Client State (Zustand)

**useEntityEditStore** in `apps/web/src/stores/useEntityEditStore.ts`:

```typescript
// Always use useShallow for multiple selectors!
const {
  isEditing,
  currentData,
  dirtyFields,
  startEdit,
  updateField,
  cancelEdit,
  saveChanges,
  undo, redo, canUndo, canRedo
} = useEntityEditStore(useShallow(state => ({
  isEditing: state.isEditing,
  currentData: state.currentData,
  dirtyFields: state.dirtyFields,
  startEdit: state.startEdit,
  updateField: state.updateField,
  cancelEdit: state.cancelEdit,
  saveChanges: state.saveChanges,
  undo: state.undo,
  redo: state.redo,
  canUndo: state.canUndo,
  canRedo: state.canRedo,
})));
```

**Store Actions**:
- `startEdit(entityCode, id, data)` - Enter edit mode with data copy
- `updateField(key, value)` - Update single field (tracks dirty)
- `updateMultipleFields(updates)` - Batch field updates
- `cancelEdit()` - Discard changes, exit edit mode
- `saveChanges()` - Persist changes via API
- `undo()` / `redo()` - History navigation

### 4.4 Context State (Global)

#### AuthContext
**Purpose**: Authentication state and user info

```typescript
const { login, logout, user, isAuthenticated } = useAuth();
```

#### EntityMetadataContext
**Purpose**: Entity type metadata (icons, labels, child_entity_codes)

```typescript
const { getEntity, entities } = useEntityMetadata();
const projectEntity = getEntity('project');
// { code: 'project', label: 'Projects', icon: 'Briefcase', child_entity_codes: [...] }
```

### 4.5 Local State (Component-Level)

**UI-only state via useState**:
```typescript
// View mode, modals, UI feedback
const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'calendar'>('table');
const [isModalOpen, setIsModalOpen] = useState(false);
const [copiedField, setCopiedField] = useState<string | null>(null);
```

**DebouncedInput local state** (handles typing lag):
```typescript
// Inside DebouncedInput component
const [localValue, setLocalValue] = useState(value);  // Instant feedback
// Parent only updated after 300ms debounce
```

### 4.6 URL State (React Router)

**Route Params**:
```typescript
// /project/abc123/task
const { entityType, entityId, childEntityType } = useParams();
// entityType: 'project'
// entityId: 'abc123'
// childEntityType: 'task'
```

**Query Params**:
```typescript
// /project?page=2&search=kitchen&dl__project_stage=planning
const [searchParams, setSearchParams] = useSearchParams();

const page = searchParams.get('page');           // '2'
const search = searchParams.get('search');       // 'kitchen'
const stage = searchParams.get('dl__project_stage'); // 'planning'
```

---

## 5. Custom Hooks

### 5.1 Data Fetching Hooks

#### useEntityInstanceList (React Query)

**Purpose**: Fetch entity list with pagination, filtering, caching

**Location**: `apps/web/src/lib/hooks/useEntityQuery.ts`

**Usage**:
```typescript
const queryParams = useMemo(() => ({
  page: currentPage,
  pageSize: 100,
  view: 'kanban',  // Optional: affects metadata filtering
  parentCode: 'project',  // Optional: for child entity filtering
  parentId: 'abc123',
}), [currentPage]);

const {
  data: queryResult,  // { data: [], metadata: {}, datalabels: [], total, limit, offset, hasMore }
  isLoading,
  error,
  refetch
} = useEntityInstanceList(entityCode, queryParams, {
  enabled: view !== 'table' && !!config,  // Optional: conditional fetching
});

const data = queryResult?.data || [];
const metadata = queryResult?.metadata || null;
const datalabels = queryResult?.datalabels || [];
const totalRecords = queryResult?.total || 0;
```

**Key Features**:
- 2-minute staleTime for list queries
- Automatic metadata caching in Zustand store
- Integrates with specialized Zustand stores for cross-component reuse

#### useEntityInstance (React Query)

**Purpose**: Fetch single entity record with backend metadata

**Location**: `apps/web/src/lib/hooks/useEntityQuery.ts`

**Usage**:
```typescript
const {
  data: queryResult,  // { data: {...}, fields: [...], metadata: {...} }
  isLoading: loading,
  error: queryError,
  refetch,
} = useEntityInstance(entityCode, id);

// Extract data from React Query result
const data = queryResult?.data || null;
const backendMetadata = queryResult?.metadata || null;
const error = queryError?.message || null;
```

**Key Features**:
- 5-minute staleTime for instance queries
- Automatic metadata caching in Zustand store
- Datalabels fetched via dedicated `useDatalabels()` hook, not from entity response

#### useEntityMutation (React Query)

**Purpose**: Create, update, delete operations with automatic cache invalidation

**Location**: `apps/web/src/lib/hooks/useEntityQuery.ts`

**Usage**:
```typescript
const {
  updateEntity,
  createEntity,
  deleteEntity,
  isUpdating,
  isCreating,
  isDeleting
} = useEntityMutation(entityCode);

// Update (triggers comprehensive cache invalidation)
await updateEntity({ id, data: { name: 'Updated Name' } });

// Create
await createEntity({ name: 'New Project', code: 'PRJ-001' });

// Delete
await deleteEntity(id);
```

**Key Features**:
- Automatic cache invalidation across React Query and Zustand stores
- Integrates with `useEntityEditStore` for field-level tracking
- Optimistic updates for immediate UI feedback

### 5.2 Zustand Store Hooks

#### useEntityEditStore

**Purpose**: Edit mode state, dirty tracking, undo/redo

**Location**: `apps/web/src/stores/useEntityEditStore.ts`

**Usage** (always use with `useShallow`):
```typescript
const {
  isEditing,
  currentData,
  dirtyFields,
  startEdit,
  updateField,
  cancelEdit,
  saveChanges,
  undo, redo, canUndo, canRedo
} = useEntityEditStore(useShallow(state => ({
  isEditing: state.isEditing,
  currentData: state.currentData,
  dirtyFields: state.dirtyFields,
  startEdit: state.startEdit,
  updateField: state.updateField,
  cancelEdit: state.cancelEdit,
  saveChanges: state.saveChanges,
  undo: state.undo,
  redo: state.redo,
  canUndo: state.canUndo,
  canRedo: state.canRedo,
})));

// Enter edit mode
startEdit(entityCode, id, data);

// Update a field (debounced by DebouncedInput)
updateField('name', 'New Name');

// Save or cancel
await saveChanges();  // PATCH API call
cancelEdit();         // Discard changes
```

### 5.3 Additional Specialized Hooks

#### usePrefetch

**Purpose**: Prefetch entity data on hover for instant navigation

**Location**: `apps/web/src/lib/hooks/useEntityQuery.ts`

**Usage**:
```typescript
const { prefetchEntity } = usePrefetch();

// On row hover in list page
const handleRowHover = (item: any) => {
  prefetchEntity(entityCode, item.id);
};
```

#### useDynamicChildEntityTabs

**Purpose**: Fetch child entity tabs configuration for detail pages

**Location**: `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

**Usage**:
```typescript
const { tabs, loading: tabsLoading } = useDynamicChildEntityTabs(entityCode, id);
// tabs: [{ id: 'task', label: 'Tasks', path: '/project/:id/task' }, ...]
```

#### useKeyboardShortcuts

**Purpose**: Handle keyboard shortcuts for save, undo, redo, cancel

**Location**: `apps/web/src/lib/hooks/useKeyboardShortcuts.ts`

**Usage**:
```typescript
useKeyboardShortcuts({
  enableUndo: true,
  enableRedo: true,
  enableSave: true,
  enableEscape: true,
  onSave: handleCustomSave,
  onCancel: handleCustomCancel,
  activeWhenEditing: true,
});

// Get shortcut hints for UI
const { shortcuts } = useShortcutHints();
// shortcuts: { save: 'Ctrl+S', undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z', cancel: 'Escape' }
```

### 5.4 UI Hooks

#### useColumnVisibility

**Purpose**: Manage table column visibility

**Location**: `apps/web/src/lib/hooks/useColumnVisibility.ts`

**Usage**:
```typescript
const {
  visibleColumns,
  toggleColumn,
  showAll,
  hideAll
} = useColumnVisibility(columns);
```

#### useViewMode

**Purpose**: Persist view mode preference per entity type

**Location**: `apps/web/src/lib/hooks/useViewMode.ts`

**Usage**:
```typescript
// Returns [currentView, setView] - persists to localStorage
const [view, setView] = useViewMode(entityCode, defaultView);
// view: 'table' | 'kanban' | 'grid' | 'calendar' | 'graph'
```

---

## 6. Rendering Patterns

### 6.1 Backend Metadata-Driven Rendering

**Core Principle**: Backend generates complete metadata, frontend executes instructions exactly

**View Mode**:
```typescript
import { renderViewModeFromMetadata } from '@/lib/frontEndFormatterService';

// Backend metadata
const fieldMeta: BackendFieldMetadata = {
  key: 'budget_allocated_amt',
  renderType: 'currency',
  format: { symbol: '$', decimals: 2 }
};

// Frontend renders
const rendered = renderViewModeFromMetadata(50000, fieldMeta);
// Returns: <span className="font-mono">$50,000.00</span>
```

**Edit Mode**:
```typescript
import { renderEditModeFromMetadata } from '@/lib/frontEndFormatterService';

// Backend metadata
const fieldMeta: BackendFieldMetadata = {
  key: 'budget_allocated_amt',
  inputType: 'currency',
  format: { symbol: '$', decimals: 2 }
};

// Frontend renders
const rendered = renderEditModeFromMetadata(50000, fieldMeta, onChange);
// Returns: <input type="number" step="0.01" value={50000} onChange={onChange} />
```

### 6.2 Conditional Rendering

**Metadata Availability**:
```typescript
// Priority 1: Backend metadata (preferred)
if (metadata?.fields) {
  return renderWithBackendMetadata(metadata);
}

// Priority 2: EntityConfig (fallback)
if (config?.columns) {
  return renderWithEntityConfig(config);
}

// Priority 3: Empty state
return <EmptyState />;
```

**Permission-Based**:
```typescript
// Check user permissions
if (canEdit(entityType, entityId)) {
  return <EditButton />;
}

if (canDelete(entityType, entityId)) {
  return <DeleteButton />;
}
```

### 6.3 Loading States

**Skeleton Loading**:
```typescript
if (loading) {
  return <TableSkeleton rows={10} columns={6} />;
}

if (error) {
  return <ErrorState message={error} onRetry={refetch} />;
}

return <EntityDataTable data={data} metadata={metadata} />;
```

---

## 7. Performance Optimizations

### 7.1 Memoization

**Component Memoization**:
```typescript
import { memo } from 'react';

export const EntityDataTable = memo(function EntityDataTable(props) {
  // Component implementation
}, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data
    && prevProps.metadata === nextProps.metadata;
});
```

**Value Memoization**:
```typescript
const columns = useMemo(() => {
  if (metadata?.fields) {
    return metadata.fields
      .filter(f => f.visible.EntityDataTable === true)
      .map(fieldMeta => ({
        key: fieldMeta.key,
        title: fieldMeta.label,
        render: (value, record) =>
          renderViewModeFromMetadata(value, fieldMeta, record)
      }));
  }
  return [];
}, [metadata]);
```

**Callback Memoization**:
```typescript
const handleEdit = useCallback((id: string) => {
  navigate(`/${entityType}/${id}/edit`);
}, [entityType, navigate]);
```

### 7.2 Lazy Loading

**Code Splitting**:
```typescript
// React.lazy for route-level splitting
const EntityListOfInstancesPage = lazy(() => import('./pages/shared/EntityListOfInstancesPage'));
const EntitySpecificInstancePage = lazy(() => import('./pages/shared/EntitySpecificInstancePage'));
const EntityFormPage = lazy(() => import('./pages/shared/EntityFormPage'));

// Routes
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/:entityType" element={<EntityListOfInstancesPage />} />
    <Route path="/:entityType/:id" element={<EntitySpecificInstancePage />} />
    <Route path="/:entityType/:id/edit" element={<EntityFormPage />} />
  </Routes>
</Suspense>
```

**Component Lazy Loading**:
```typescript
const KanbanBoard = lazy(() => import('./components/KanbanBoard'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const DAGVisualizer = lazy(() => import('./components/DAGVisualizer'));
```

### 7.3 Data Caching

**Entity Metadata Cache**:
```typescript
// EntityMetadataContext caches all entity metadata
// 5-minute TTL, avoids redundant API calls
const { getEntity } = useEntityMetadata();
const projectEntity = getEntity('project'); // O(1) lookup from cache
```

**Settings Color Cache**:
```typescript
// loadSettingsColors caches datalabel colors
await loadSettingsColors(['project_stage', 'task_priority']);
// Subsequent calls use cache (no API requests)
const color = getSettingColor('project_stage', 'planning');
```

---

## 8. Industry-Standard Rendering & State Patterns

### 8.1 State Management Architecture

**React Query + Zustand Hybrid**:
- **React Query**: Server state (API data fetching, caching, background refetch)
- **Zustand**: Client state (edit mode, UI state, form tracking)
- **Separation of concerns**: Server data vs UI state never mixed

**Zustand with `useShallow`**:
- Batches multiple selector subscriptions into single update
- Reduces re-renders from 16+ to ~3 per state change
- Required when selecting multiple properties from store

```typescript
// ✅ CORRECT: useShallow batches subscriptions
const { isEditing, currentData, dirtyFields } = useEntityEditStore(
  useShallow(state => ({
    isEditing: state.isEditing,
    currentData: state.currentData,
    dirtyFields: state.dirtyFields,
  }))
);

// ❌ WRONG: Multiple subscriptions cause excessive re-renders
const isEditing = useEntityEditStore(state => state.isEditing);
const currentData = useEntityEditStore(state => state.currentData);
```

### 8.2 Debounced Input Pattern

**Industry-standard pattern for form inputs**:
- Each input manages its own local state for instant UI feedback
- Debounces parent state updates (300ms default)
- Zero re-renders of parent during typing
- Commits immediately on blur

**Components**: `DebouncedInput`, `DebouncedTextarea` in `components/shared/ui/DebouncedInput.tsx`

```typescript
// Input handles its own state, debounces parent updates
<DebouncedInput
  value={data[field.key] ?? ''}
  onChange={(value) => handleFieldChange(field.key, value)}
  debounceMs={300}
  onBlurCommit={true}
/>
```

**Data Flow**:
```
User Types → DebouncedInput (local state) → 300ms debounce → Zustand store
              ↓ instant feedback                              ↓ batched updates
              No parent re-renders                            Minimal API calls
```

### 8.3 React.memo with Custom Comparison

**When to use**:
- Components receiving frequently-changing props
- Components with expensive render cycles
- Form containers during edit mode

**Custom `arePropsEqual` pattern**:
```typescript
function arePropsEqual(prevProps, nextProps): boolean {
  // Re-render on mode change
  if (prevProps.isEditing !== nextProps.isEditing) return false;

  // Re-render on metadata change (structure)
  if (prevProps.metadata !== nextProps.metadata) return false;

  // Only check keys, not values (DebouncedInput handles values)
  const prevKeys = Object.keys(prevProps.data || {}).sort().join(',');
  const nextKeys = Object.keys(nextProps.data || {}).sort().join(',');
  if (prevKeys !== nextKeys) return false;

  // In view mode, also check value changes
  if (!nextProps.isEditing && prevProps.data !== nextProps.data) return false;

  return true;
}

export const EntityFormContainer = React.memo(EntityFormContainerInner, arePropsEqual);
```

### 8.4 Stable Default Props

**Problem**: Default array/object props create new references every render
**Solution**: Define constants outside component

```typescript
// ✅ CORRECT: Stable references
const EMPTY_ARRAY: string[] = [];
const EMPTY_DATALABELS: DatalabelData[] = [];

function EntityFormContainer({
  requiredFields = EMPTY_ARRAY,      // Stable
  datalabels = EMPTY_DATALABELS,     // Stable
}: Props) { ... }

// ❌ WRONG: New reference every render
function EntityFormContainer({
  requiredFields = [],               // New array each render!
  datalabels = [],                   // Triggers unnecessary updates
}: Props) { ... }
```

### 8.5 useMemo Dependency Optimization

**Problem**: Object references change even when values don't
**Solution**: Use primitive comparisons (strings) for stability

```typescript
// ✅ CORRECT: Stable string comparison
const dataKeysString = Object.keys(data || {}).sort().join(',');
const fieldKeys = useMemo(() => {
  return Object.keys(data || {}).sort();
}, [dataKeysString]);  // Primitive comparison

// ❌ WRONG: Object reference comparison
const fieldKeys = useMemo(() => {
  return Object.keys(data || {}).sort();
}, [data]);  // Recalculates on every value change!
```

### 8.6 Summary: Render Optimization Checklist

| Pattern | Purpose | Location |
|---------|---------|----------|
| **React Query** | Server state caching | `useEntityInstance`, `useEntityMutation` |
| **Zustand + useShallow** | Client state batching | `useEntityEditStore` |
| **DebouncedInput** | Zero parent re-renders during typing | `ui/DebouncedInput.tsx` |
| **React.memo + custom compare** | Skip renders when props equivalent | `EntityFormContainer` |
| **Stable default props** | Prevent reference changes | Constants outside component |
| **useMemo with primitives** | Stable derived values | String key comparisons |

---

## 9. Key Design Patterns

### 9.1 Composition over Inheritance

**Base Component + Extensions**:
```
DataTableBase (pure base)
    ├── EntityDataTable (entity extension)
    └── SettingsDataTable (settings extension)
```

### 9.2 Render Props

**Flexible Cell Rendering**:
```typescript
<EntityDataTable
  data={data}
  columns={columns}
  renderCell={(value, column, record) => {
    if (column.key === 'custom_field') {
      return <CustomRenderer value={value} />;
    }
    return renderViewModeFromMetadata(value, column.backendMetadata, record);
  }}
/>
```

### 9.3 Portal Rendering

**Dropdowns in Tables**:
```typescript
import { createPortal } from 'react-dom';

// Render dropdown to document.body (avoids clipping)
{isOpen && createPortal(
  <div style={{ position: 'absolute', zIndex: 9999 }}>
    {/* Dropdown content */}
  </div>,
  document.body
)}
```

### 9.4 Controlled Components

**Form Inputs**:
```typescript
<input
  type="text"
  value={formData.name}
  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
/>
```

---

## 10. Error Handling

### 10.1 Error Boundaries

**Component Error Boundary**:
```typescript
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onReset={() => window.location.reload()}
>
  <EntityDataTable ... />
</ErrorBoundary>
```

### 10.2 API Error Handling

**Standard Pattern**:
```typescript
try {
  const response = await fetch('/api/v1/project');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  setData(data.data);
} catch (error) {
  setError(error.message);
  toast.error(`Failed to load projects: ${error.message}`);
}
```

---

## 11. Testing Strategy

### 11.1 Component Tests

**Unit Test Example**:
```typescript
import { render, screen } from '@testing-library/react';
import { EntityDataTable } from './EntityDataTable';

test('renders table with backend metadata', () => {
  const metadata: EntityMetadata = {
    entity: 'project',
    fields: [
      { key: 'name', label: 'Name', renderType: 'text', ... }
    ]
  };

  render(<EntityDataTable data={[]} metadata={metadata} />);
  expect(screen.getByText('Name')).toBeInTheDocument();
});
```

### 11.2 Integration Tests

**Page Test Example**:
```typescript
test('EntityListOfInstancesPage loads and displays data', async () => {
  render(<EntityListOfInstancesPage />, { wrapper: RouterWrapper });

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  // Check data is rendered
  expect(screen.getByText('Project List')).toBeInTheDocument();
});
```

---

## Summary

**Architecture**: Universal Pages + Backend Metadata + Zero Frontend Pattern Detection

**Key Components**:
- **3 Universal Pages**: EntityListOfInstancesPage, EntitySpecificInstancePage, EntityFormPage
- **5 View Modes**: Table, Kanban, Grid, Calendar, Graph
- **2 Data Tables**: EntityDataTable (backend metadata), SettingsDataTable (datalabels)
- **1 Form Container**: EntityFormContainer (backend metadata-driven)
- **Dynamic Child Tabs**: DynamicChildEntityTabs (from entity.child_entity_codes)
- **Debounced Inputs**: DebouncedInput, DebouncedTextarea (industry-standard pattern)

**State Management**:
- **React Query**: Server state (`useEntityInstanceList`, `useEntityInstance`, `useEntityMutation`)
- **Zustand + useShallow**: Client state (`useEntityEditStore` with batched subscriptions)
- **Component-level**: useState for local UI state (view mode, modals)
- **URL State**: React Router params and search params

**Key Hooks**:
- `useEntityInstanceList` - List queries with 2-min cache
- `useEntityInstance` - Single entity with 5-min cache
- `useEntityMutation` - CRUD with automatic cache invalidation
- `usePrefetch` - Prefetch entity data on hover
- `useDynamicChildEntityTabs` - Child tabs configuration
- `useKeyboardShortcuts` - Ctrl+S, Ctrl+Z, Escape handlers

**Rendering**:
- **Backend-Driven**: `renderViewModeFromMetadata`, `renderEditModeFromMetadata`
- **Zero Pattern Detection**: Frontend is pure renderer executing backend instructions
- **Debounced Inputs**: Local state per input, 300ms debounce, blur commit

**Performance**:
- **Code Splitting**: Lazy loading routes and heavy components
- **Memoization**: React.memo with custom arePropsEqual, useMemo with primitives
- **Stable Props**: Constants outside components for default arrays/objects
- **Prefetching**: Entity data prefetched on hover for instant navigation
- **Caching**: React Query + Zustand specialized stores

**Status**: ✅ Production Ready - v4.3 Backend Metadata + Industry-Standard State Management
