# Frontend Component Architecture & Cache Lifecycle

**Version**: 1.0.0
**Date**: 2025-12-04
**Status**: Production
**Scope**: Frontend Only (React + TanStack Query + Dexie)

---

## Executive Summary

This document explains **frontend component architecture** and how **cache lifecycle integrates with each page and component**. This is a **pure frontend architecture guide** - backend metadata generation is documented separately.

### Core Frontend Principles

1. **Backend Metadata Drives Everything** - Frontend receives complete metadata from API, zero pattern detection
2. **Format-at-Read** - Cache stores raw data, formatting happens during render (current state)
3. **TanStack Query + Dexie** - In-memory cache + IndexedDB persistence (RxDB removed)
4. **Component Registry** - Metadata-driven component resolution, zero hardcoded logic
5. **Optimistic Updates** - Instant UI feedback with automatic rollback

---

## Table of Contents

1. [Component Hierarchy](#1-component-hierarchy)
2. [Cache Integration by Component Type](#2-cache-integration-by-component-type)
3. [Page Components with Cache Lifecycle](#3-page-components-with-cache-lifecycle)
4. [Container Components with Cache Lifecycle](#4-container-components-with-cache-lifecycle)
5. [UI Components with Cache Lifecycle](#5-ui-components-with-cache-lifecycle)
6. [FieldRenderer Architecture](#6-fieldrenderer-architecture)
7. [Complete Component Flows](#7-complete-component-flows)

---

## 1. Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Component Tree                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  App.tsx (Root)                                                  │
│  ├─ TanstackCacheProvider (Query Client)                        │
│  │   └─ WebSocketManager (Cache invalidation)                   │
│  │                                                               │
│  └─ Router                                                       │
│      │                                                           │
│      ├─ PAGE LAYER (/:entityCode, /:entityCode/:id)             │
│      │   ├─ EntityListOfInstancesPage                           │
│      │   │   └─ Uses: useEntityInstanceMetadata()               │
│      │   │   └─ Uses: useFormattedEntityList()                  │
│      │   │                                                       │
│      │   ├─ EntitySpecificInstancePage                          │
│      │   │   └─ Uses: useEntityInstanceMetadata()               │
│      │   │   └─ Uses: useEntity()                               │
│      │   │                                                       │
│      │   └─ EntityCreatePage                                    │
│      │       └─ Uses: useEntityInstanceMetadata()               │
│      │       └─ Uses: useEntityMutation()                       │
│      │                                                           │
│      ├─ CONTAINER LAYER                                         │
│      │   ├─ EntityListOfInstancesTable                          │
│      │   │   └─ Receives: formattedData from parent             │
│      │   │   └─ Uses: Local state for edit mode                 │
│      │   │                                                       │
│      │   ├─ EntityInstanceFormContainer                         │
│      │   │   └─ Receives: metadata + formData from parent       │
│      │   │   └─ Uses: Local state for inline edit               │
│      │   │                                                       │
│      │   └─ DynamicChildEntityTabs                              │
│      │       └─ Uses: useEntityCodes() for tab generation       │
│      │       └─ Uses: useFormattedEntityList() per tab          │
│      │                                                           │
│      ├─ UI COMPONENT LAYER                                      │
│      │   ├─ BadgeDropdownSelect                                 │
│      │   │   └─ Uses: useDatalabel() for options                │
│      │   │                                                       │
│      │   ├─ EntityInstanceNameSelect                            │
│      │   │   └─ Uses: useEntityList() for options               │
│      │   │                                                       │
│      │   └─ FieldRenderer (Central Hub)                         │
│      │       └─ Routes to ViewComponentRegistry or              │
│      │          EditComponentRegistry                           │
│      │                                                           │
│      └─ REGISTRY LAYER (No Cache Access)                        │
│          ├─ ViewComponentRegistry (15+ components)              │
│          │   ├─ CurrencyDisplay                                 │
│          │   ├─ BadgeDisplay                                    │
│          │   ├─ EntityInstanceDisplay                           │
│          │   └─ ...                                             │
│          │                                                       │
│          └─ EditComponentRegistry (20+ components)              │
│              ├─ CurrencyInputEdit                               │
│              ├─ BadgeDropdownSelectEdit                         │
│              ├─ EntityInstanceNameSelectEdit                    │
│              └─ ...                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Principles**:
- **Pages** own cache queries (useQuery hooks)
- **Containers** receive data as props, manage local UI state only
- **UI Components** may have their own cache queries (dropdowns)
- **Registry Components** are pure - receive everything via props

---

## 2. Cache Integration by Component Type

### 2.1 Page Components (Cache Owners)

**Responsibility**: Fetch data from API via TanStack Query hooks

```typescript
// Page Component Pattern
const EntityListOfInstancesPage = () => {
  // METADATA QUERY (Separate from data)
  const { viewType, editType, isLoading: metadataLoading } =
    useEntityInstanceMetadata('project', 'entityListOfInstancesTable');

  // DATA QUERY (Separate from metadata)
  const { data: formattedProjects, isLoading: dataLoading } =
    useFormattedEntityList('project', { limit: 50, offset: 0 });

  // MUTATION (For updates)
  const { updateEntity, deleteEntity } = useEntityMutation('project');

  // Wait for metadata before rendering
  if (!viewType) return <LoadingSpinner />;

  // Pass everything down to containers
  return (
    <EntityListOfInstancesTable
      data={formattedProjects}
      metadata={{ viewType, editType }}
      onCellSave={handleCellSave}
    />
  );
};
```

**Cache Keys Used**:
```typescript
['entity-metadata', 'project', 'entityListOfInstancesTable']  // Metadata
['entity-list', 'project', { limit: 50, offset: 0 }]          // Data
```

### 2.2 Container Components (Data Receivers)

**Responsibility**: Receive data/metadata as props, manage UI state

```typescript
// Container Component Pattern
interface EntityListOfInstancesTableProps {
  data: FormattedRow[];           // From parent's useFormattedEntityList()
  metadata: {
    viewType: Record<string, FieldMetadata>;
    editType: Record<string, FieldMetadata>;
  };
  onCellSave: (rowId, columnKey, value, record) => void;
}

const EntityListOfInstancesTable: React.FC<EntityListOfInstancesTableProps> = ({
  data,
  metadata,
  onCellSave
}) => {
  // LOCAL UI STATE (not cache)
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnKey: string } | null>(null);
  const [editedData, setEditedData] = useState<Record<string, any>>({});

  // NO CACHE QUERIES - everything comes from props

  return (
    <table>
      {data.map(row => (
        <tr key={row.raw.id}>
          {columns.map(col => (
            <td key={col.key}>
              <FieldRenderer
                field={metadata.viewType[col.key]}
                value={row.raw[col.key]}
                isEditing={editingCell?.rowId === row.raw.id && editingCell?.columnKey === col.key}
                formattedData={{ display: row.display, styles: row.styles }}
              />
            </td>
          ))}
        </tr>
      ))}
    </table>
  );
};
```

**Cache Interaction**: NONE - Pure props-in, callbacks-out

### 2.3 UI Components (Selective Cache Access)

**Responsibility**: Some UI components fetch their own options from cache

```typescript
// UI Component with Cache Access
const BadgeDropdownSelect: React.FC<BadgeDropdownSelectProps> = ({
  value,
  field,
  onChange
}) => {
  // UI COMPONENT FETCHES ITS OWN OPTIONS
  const { data: options, isLoading } = useDatalabel(field.lookupField);

  // Local dropdown state
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) return <Spinner />;

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>
        {options.find(o => o.code === value)?.label || value}
      </button>
      {isOpen && createPortal(
        <div data-dropdown-portal>
          {options.map(opt => (
            <div onClick={() => onChange(opt.code)}>{opt.label}</div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
```

**Cache Keys Used**:
```typescript
['datalabel', 'dl__project_stage']  // Dropdown options
```

### 2.4 Registry Components (Pure Presentational)

**Responsibility**: Render data with zero cache access

```typescript
// Pure Registry Component (NO CACHE)
const CurrencyDisplay: React.FC<ComponentRendererProps> = ({ value, field }) => {
  // NO HOOKS - Pure rendering
  const formatted = formatCurrency(value, field.style);
  return <span className="font-mono">{formatted}</span>;
};

// Registered in ViewComponentRegistry
ViewComponentRegistry.set('currency', CurrencyDisplay);
```

**Cache Interaction**: NONE - Completely stateless

---

## 3. Page Components with Cache Lifecycle

### 3.1 EntityListOfInstancesPage

**File**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

**Purpose**: Universal list page for all entity types

#### Cache Lifecycle

```typescript
const EntityListOfInstancesPage = () => {
  const { entityCode } = useParams();  // 'project', 'task', etc.
  const [filters, setFilters] = useState({});

  // ===== CACHE QUERY 1: METADATA =====
  const {
    viewType,      // Field metadata for VIEW mode
    editType,      // Field metadata for EDIT mode
    fields,        // Field names array
    isLoading: metadataLoading,
    isError: metadataError
  } = useEntityInstanceMetadata(entityCode, 'entityListOfInstancesTable');

  // Query Key: ['entity-metadata', 'project', 'entityListOfInstancesTable']
  // Cache TTL: 30 minutes (metadata rarely changes)
  // Dexie: Persisted in entityInstanceMetadata table

  // ===== CACHE QUERY 2: LIST DATA =====
  const {
    data: formattedData,  // { raw, display, styles }[]
    total,
    isLoading: dataLoading,
    isFetching: dataRefetching
  } = useFormattedEntityList(entityCode, {
    limit: 50,
    offset: 0,
    ...filters
  });

  // Query Key: ['entity-list', 'project', { limit: 50, offset: 0, ...filters }]
  // Cache TTL: 2 minutes (data changes frequently)
  // Dexie: Persisted in entityInstanceData table
  // FORMAT-AT-READ: TanStack Query select() transforms raw → formatted

  // ===== CACHE MUTATION: UPDATE/DELETE =====
  const {
    updateEntity,      // Optimistic update
    deleteEntity,      // Optimistic delete
    isUpdating
  } = useEntityMutation(entityCode);

  // ===== RENDER GUARD: WAIT FOR METADATA =====
  if (!viewType) {
    return <LoadingSpinner message="Loading metadata..." />;
  }

  // ===== CALLBACKS: TRIGGER MUTATIONS =====
  const handleCellSave = async (rowId: string, columnKey: string, value: any, record: any) => {
    // Optimistic update pattern
    await updateEntity(rowId, { [columnKey]: value });
  };

  const handleDeleteRow = async (rowId: string) => {
    await deleteEntity(rowId);
  };

  // ===== RENDER: PASS CACHE DATA TO CONTAINERS =====
  return (
    <div>
      <EntityListOfInstancesTable
        data={formattedData}             // From cache query
        metadata={{ viewType, editType }} // From cache query
        onCellSave={handleCellSave}       // Triggers mutation
        onDeleteRow={handleDeleteRow}     // Triggers mutation
      />
    </div>
  );
};
```

#### Cache Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│        EntityListOfInstancesPage Cache Lifecycle                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MOUNT                                                           │
│  ──────                                                          │
│  1. useEntityInstanceMetadata('project', 'entityListOfInstancesTable')│
│     ├─ Check TanStack Query cache                               │
│     │   └─ Key: ['entity-metadata', 'project', 'entityListOfInstancesTable']│
│     ├─ CACHE HIT (< 30min) → Return immediately                 │
│     └─ CACHE MISS → Fetch from API                              │
│         ├─ GET /api/v1/project?content=metadata                 │
│         ├─ Store in TanStack Query (memory)                     │
│         └─ Store in Dexie (entityInstanceMetadata table)        │
│                                                                  │
│  2. useFormattedEntityList('project', { limit: 50, offset: 0 })│
│     ├─ Check TanStack Query cache                               │
│     │   └─ Key: ['entity-list', 'project', { limit: 50 }]      │
│     ├─ CACHE HIT (< 2min)                                       │
│     │   ├─ Return RAW data from cache                           │
│     │   └─ FORMAT-AT-READ (select):                             │
│     │       ├─ Subscribe to datalabel cache (reactive)          │
│     │       ├─ Transform: raw → { raw, display, styles }        │
│     │       └─ Return formatted data                            │
│     └─ CACHE MISS → Fetch from API                              │
│         ├─ GET /api/v1/project?limit=50                         │
│         ├─ Store RAW data in TanStack Query                     │
│         ├─ Store RAW data in Dexie (entityInstanceData)         │
│         └─ FORMAT-AT-READ executes                              │
│                                                                  │
│  3. Component renders with formatted data                       │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  USER EDITS CELL                                                │
│  ─────────────────                                              │
│  handleCellSave(rowId, 'budget_allocated_amt', 75000)           │
│  └─ updateEntity(rowId, { budget_allocated_amt: 75000 })       │
│      │                                                           │
│      ├─ OPTIMISTIC UPDATE (Instant)                             │
│      │   ├─ queryClient.setQueryData(['entity-instance', ...], newData)│
│      │   ├─ Dexie.entityInstance.put(newData)                   │
│      │   └─ Component re-renders with new value ✅              │
│      │                                                           │
│      └─ API CALL (Background)                                   │
│          ├─ PATCH /api/v1/project/{id}                          │
│          ├─ SUCCESS:                                             │
│          │   ├─ invalidateQueries(['entity-instance', ...])     │
│          │   ├─ invalidateQueries(['entity-list', ...])         │
│          │   └─ Background refetch updates cache                │
│          └─ ERROR:                                               │
│              ├─ Rollback optimistic update                      │
│              └─ Show error toast                                │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  WEBSOCKET INVALIDATE (Real-Time)                               │
│  ──────────────────────────────────                             │
│  WebSocketManager receives: { type: 'INVALIDATE', entity_code: 'project' }│
│  └─ queryClient.invalidateQueries(['entity-list', 'project'])   │
│      ├─ Mark cache as STALE                                     │
│      ├─ Background refetch executes                             │
│      ├─ Update TanStack Query + Dexie                           │
│      └─ Component re-renders with fresh data                    │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  UNMOUNT                                                         │
│  ────────                                                        │
│  - TanStack Query cache remains in memory (gcTime: 10min)       │
│  - Dexie data persists (survives browser restart)               │
│  - WebSocket subscriptions cleaned up                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 EntitySpecificInstancePage

**File**: `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

**Purpose**: Universal detail/edit page for single entity instance

#### Cache Lifecycle

```typescript
const EntitySpecificInstancePage = () => {
  const { entityCode, id } = useParams();  // 'project', 'uuid'

  // ===== CACHE QUERY 1: METADATA (Form View) =====
  const {
    viewType,
    editType,
    isLoading: metadataLoading
  } = useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');

  // Query Key: ['entity-metadata', 'project', 'entityInstanceFormContainer']
  // Cache TTL: 30 minutes
  // NOTE: Different metadataType than list page!

  // ===== CACHE QUERY 2: SINGLE INSTANCE =====
  const {
    data: entity,       // Single entity object
    isLoading: dataLoading
  } = useEntity(entityCode, id);

  // Query Key: ['entity-instance', 'project', 'uuid']
  // Cache TTL: 5 minutes (single entities change less frequently than lists)
  // Dexie: Persisted in entityInstance table

  // ===== CACHE QUERY 3: CHILD ENTITY CODES =====
  const { entityCodes } = useEntityCodes();

  // Query Key: ['entity-codes']
  // Used by DynamicChildEntityTabs to generate tabs
  // Prefetched at login

  // ===== CACHE MUTATION =====
  const { optimisticUpdateEntity } = useEntityMutation(entityCode);

  // ===== RENDER GUARD =====
  if (!viewType || !entity) {
    return <LoadingSpinner />;
  }

  // ===== CALLBACKS =====
  const handleInlineSave = async (fieldKey: string, value: any) => {
    await optimisticUpdateEntity(id, { [fieldKey]: value });
  };

  // ===== RENDER =====
  return (
    <div>
      {/* Header Section */}
      <EntityDetailHeader entity={entity} onEdit={...} onDelete={...} />

      {/* Form Container - Inline Edit */}
      <EntityInstanceFormContainer
        formData={entity.raw}
        metadata={{ viewType, editType }}
        mode="view"
        onInlineSave={handleInlineSave}
      />

      {/* Child Entity Tabs - Separate Cache Queries */}
      <DynamicChildEntityTabs
        parentEntityCode={entityCode}
        parentEntityId={id}
        childEntityCodes={entityCodes[entityCode]?.child_entity_codes || []}
      />
    </div>
  );
};
```

#### Cache Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│       EntitySpecificInstancePage Cache Lifecycle                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MOUNT                                                           │
│  ──────                                                          │
│  1. useEntityInstanceMetadata('project', 'entityInstanceFormContainer')│
│     └─ Key: ['entity-metadata', 'project', 'entityInstanceFormContainer']│
│     └─ Returns: { viewType, editType } for FORM layout          │
│                                                                  │
│  2. useEntity('project', 'uuid-123')                             │
│     ├─ Key: ['entity-instance', 'project', 'uuid-123']          │
│     ├─ CACHE HIT (< 5min) → Return immediately                  │
│     └─ CACHE MISS                                                │
│         ├─ GET /api/v1/project/uuid-123                         │
│         ├─ Store in TanStack Query + Dexie                      │
│         └─ Return entity                                         │
│                                                                  │
│  3. useEntityCodes()                                             │
│     └─ Key: ['entity-codes']                                    │
│     └─ Already in cache (prefetched at login)                   │
│                                                                  │
│  4. Component renders with entity data                           │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  USER INLINE EDITS FIELD (Long-Press 500ms)                     │
│  ────────────────────────────────────────────                   │
│  handleInlineSave('manager__employee_id', 'uuid-sarah')          │
│  └─ optimisticUpdateEntity('uuid-123', { manager__employee_id: 'uuid-sarah' })│
│      │                                                           │
│      ├─ OPTIMISTIC UPDATE                                       │
│      │   ├─ Update cache: ['entity-instance', 'project', 'uuid-123']│
│      │   ├─ Update Dexie                                        │
│      │   └─ UI updates instantly ✅                             │
│      │                                                           │
│      └─ API CALL                                                │
│          ├─ PATCH /api/v1/project/uuid-123                      │
│          └─ Invalidate & refetch on success                     │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  CHILD TAB CLICKED (Lazy Load)                                  │
│  ───────────────────────────                                    │
│  DynamicChildEntityTabs switches to "task" tab                  │
│  └─ useFormattedEntityList('task', {                            │
│        parent_code: 'project',                                  │
│        parent_id: 'uuid-123'                                    │
│      })                                                          │
│      ├─ Key: ['entity-list', 'project', 'uuid-123', 'task']    │
│      ├─ CACHE MISS (first tab click)                            │
│      └─ GET /api/v1/project/uuid-123/task                       │
│          └─ Store in TanStack Query + Dexie                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 EntityCreatePage

**File**: `apps/web/src/pages/shared/EntityCreatePage.tsx`

**Purpose**: Universal create page with parent context

#### Cache Lifecycle

```typescript
const EntityCreatePage = () => {
  const { entityCode } = useParams();
  const [searchParams] = useSearchParams();
  const parent_code = searchParams.get('parent_code');
  const parent_id = searchParams.get('parent_id');

  // ===== CACHE QUERY: METADATA ONLY =====
  const {
    editType,
    isLoading
  } = useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');

  // Query Key: ['entity-metadata', 'project', 'entityInstanceFormContainer']
  // Only need editType (no viewType for creation)

  // ===== CACHE MUTATION: CREATE =====
  const { createEntity } = useEntityMutation(entityCode);

  // ===== NO DATA QUERY - Creating new entity =====

  // ===== RENDER GUARD =====
  if (!editType) return <LoadingSpinner />;

  // ===== CALLBACKS =====
  const handleSubmit = async (formData: any) => {
    const created = await createEntity(formData, { parent_code, parent_id });

    // Navigate to new entity
    navigate(`/${entityCode}/${created.id}`);
  };

  // ===== RENDER =====
  return (
    <EntityInstanceFormContainer
      formData={{}}                      // Empty for creation
      metadata={{ editType }}            // Only editType needed
      mode="create"
      onSubmit={handleSubmit}
    />
  );
};
```

---

## 4. Container Components with Cache Lifecycle

### 4.1 EntityListOfInstancesTable

**File**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

**Cache Interaction**: NONE - Pure props receiver

```typescript
interface EntityListOfInstancesTableProps {
  data: FormattedRow[];           // Already formatted by parent
  metadata: {
    viewType: Record<string, FieldMetadata>;
    editType: Record<string, FieldMetadata>;
  };
  onCellSave: (rowId: string, columnKey: string, value: any, record: any) => void;
  onSaveInlineEdit?: (record: any) => void;
  columns?: string[];
}

const EntityListOfInstancesTable: React.FC<EntityListOfInstancesTableProps> = ({
  data,
  metadata,
  onCellSave,
  columns: columnsProp
}) => {
  // ===== LOCAL UI STATE (Not Cache) =====
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnKey: string } | null>(null);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const editingCellRef = useRef<HTMLDivElement | null>(null);

  // ===== NO CACHE QUERIES =====
  // All data comes from props!

  // ===== PORTAL-AWARE CLICK-OUTSIDE HANDLER =====
  useEffect(() => {
    if (!editingCell) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Skip if clicking inside editing cell
      if (editingCellRef.current?.contains(target)) return;

      // Skip if clicking inside dropdown portal
      if (target.closest('[data-dropdown-portal]')) return;

      // Truly outside - save and close
      const record = data.find(r => getRowKey(r) === editingCell.rowId);
      if (record) {
        handleCellSave(editingCell.rowId, editingCell.columnKey, record);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCell, data]);

  // ===== CELL SAVE HANDLER =====
  const handleCellSave = (rowId: string, columnKey: string, record: any) => {
    const newValue = editedData[`${rowId}_${columnKey}`];
    const oldValue = record.raw[columnKey];

    if (newValue !== oldValue) {
      onCellSave(rowId, columnKey, newValue, record);  // Calls parent's mutation
    }

    setEditingCell(null);
    setEditedData({});
  };

  // ===== RENDER =====
  return (
    <table>
      <thead>
        {columns.map(col => (
          <th key={col}>{metadata.viewType[col]?.label || col}</th>
        ))}
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={getRowKey(row, idx)}>
            {columns.map(col => {
              const fieldMeta = metadata.viewType[col];
              const isEditing = editingCell?.rowId === getRowKey(row, idx) &&
                               editingCell?.columnKey === col;

              return (
                <td
                  key={col}
                  onClick={() => setEditingCell({ rowId: getRowKey(row, idx), columnKey: col })}
                  ref={isEditing ? editingCellRef : null}
                >
                  <FieldRenderer
                    field={isEditing ? metadata.editType[col] : fieldMeta}
                    value={row.raw[col]}
                    isEditing={isEditing}
                    onChange={(v) => {
                      setEditedData(prev => ({
                        ...prev,
                        [`${getRowKey(row, idx)}_${col}`]: v
                      }));
                    }}
                    formattedData={{ display: row.display, styles: row.styles }}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

**Key Points**:
- ✅ Receives formatted data from parent (no cache query)
- ✅ Manages local edit state only
- ✅ Calls parent's `onCellSave` which triggers mutation
- ✅ Portal-aware click-outside handler

### 4.2 EntityInstanceFormContainer

**File**: `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`

**Cache Interaction**: NONE - Pure props receiver

```typescript
interface EntityInstanceFormContainerProps {
  formData: Record<string, any>;   // Entity data from parent
  metadata: {
    viewType?: Record<string, FieldMetadata>;
    editType: Record<string, FieldMetadata>;
  };
  mode: 'view' | 'create' | 'edit';
  onInlineSave?: (fieldKey: string, value: any) => void;
  onSubmit?: (formData: any) => void;
}

const EntityInstanceFormContainer: React.FC<EntityInstanceFormContainerProps> = ({
  formData,
  metadata,
  mode,
  onInlineSave,
  onSubmit
}) => {
  // ===== LOCAL UI STATE (Not Cache) =====
  const [inlineEditingField, setInlineEditingField] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<any>(null);
  const [isFullEditMode, setIsFullEditMode] = useState(mode !== 'view');
  const editingFieldRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // ===== NO CACHE QUERIES =====

  // ===== LONG-PRESS HANDLER (500ms) =====
  const handleLongPressStart = (event: React.MouseEvent, fieldKey: string) => {
    event.preventDefault();

    longPressTimer.current = setTimeout(() => {
      enterInlineEditMode(fieldKey);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ===== INLINE EDIT MODE =====
  const enterInlineEditMode = (fieldKey: string) => {
    setInlineEditingField(fieldKey);
    setInlineEditValue(formData[fieldKey]);
  };

  // ===== PORTAL-AWARE CLICK-OUTSIDE HANDLER =====
  useEffect(() => {
    if (!inlineEditingField) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't trigger if clicking inside editing field
      if (editingFieldRef.current?.contains(target)) return;

      // Don't trigger if clicking inside dropdown portal
      const isClickInsideDropdown = (target as Element).closest?.('[data-dropdown-portal]');
      if (isClickInsideDropdown) return;

      // Truly outside - save and close
      handleInlineSave();
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inlineEditingField]);

  // ===== INLINE SAVE HANDLER =====
  const handleInlineSave = () => {
    if (!inlineEditingField) return;

    const fieldKey = inlineEditingField;
    const newValue = inlineEditValue;
    const oldValue = formData[fieldKey];

    // Only save if changed
    if (newValue !== oldValue) {
      onInlineSave?.(fieldKey, newValue);  // Calls parent's mutation
    }

    // Clear editing state
    setInlineEditingField(null);
    setInlineEditValue(null);
  };

  // ===== RENDER =====
  const { viewType, editType } = metadata;
  const isViewMode = mode === 'view' && !isFullEditMode;

  return (
    <div className="form-container">
      {Object.entries(editType).map(([key, fieldMeta]) => {
        const isInlineEditing = inlineEditingField === key;

        return (
          <div
            key={key}
            className="field-container"
            onMouseDown={(e) => isViewMode && handleLongPressStart(e, key)}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            ref={isInlineEditing ? editingFieldRef : null}
          >
            <label>{fieldMeta.label}</label>

            <FieldRenderer
              field={isInlineEditing || !isViewMode ? fieldMeta : viewType?.[key]}
              value={isInlineEditing ? inlineEditValue : formData[key]}
              isEditing={isInlineEditing || !isViewMode}
              onChange={(v) => {
                if (isInlineEditing) {
                  setInlineEditValue(v);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
```

**Key Points**:
- ✅ Receives formData and metadata from parent (no cache query)
- ✅ Manages inline edit state locally
- ✅ Long-press detection (500ms)
- ✅ Portal-aware click-outside handler (CRITICAL FIX)
- ✅ Calls parent's `onInlineSave` which triggers mutation

### 4.3 DynamicChildEntityTabs

**File**: `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

**Cache Interaction**: YES - Fetches child data when tab clicked (lazy loading)

```typescript
interface DynamicChildEntityTabsProps {
  parentEntityCode: string;
  parentEntityId: string;
  childEntityCodes: string[];  // From parent
}

const DynamicChildEntityTabs: React.FC<DynamicChildEntityTabsProps> = ({
  parentEntityCode,
  parentEntityId,
  childEntityCodes
}) => {
  const [activeTab, setActiveTab] = useState<string>(childEntityCodes[0]);

  // ===== CACHE QUERY: ACTIVE TAB ONLY (Lazy Loading) =====
  const { data: childData, isLoading } = useFormattedEntityList(
    activeTab,  // e.g., 'task'
    {
      parent_code: parentEntityCode,
      parent_id: parentEntityId,
      limit: 50
    },
    {
      enabled: !!activeTab  // Only fetch when tab is active
    }
  );

  // Query Key: ['entity-list', 'project', 'uuid-parent', 'task']
  // Cache TTL: 2 minutes
  // Lazy loading: Only fetches when tab becomes active

  return (
    <div>
      <div className="tabs">
        {childEntityCodes.map(code => (
          <button
            key={code}
            onClick={() => setActiveTab(code)}
            className={activeTab === code ? 'active' : ''}
          >
            {code}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {isLoading ? (
          <Spinner />
        ) : (
          <EntityListOfInstancesTable
            data={childData}
            metadata={...}  // Fetch metadata separately if needed
          />
        )}
      </div>
    </div>
  );
};
```

**Key Points**:
- ✅ Receives child entity codes from parent
- ✅ Lazy loads child data when tab clicked (own cache query)
- ✅ Each tab has separate cache key

---

## 5. UI Components with Cache Lifecycle

### 5.1 BadgeDropdownSelect

**File**: `apps/web/src/components/shared/ui/BadgeDropdownSelect.tsx`

**Cache Interaction**: YES - Fetches datalabel options

```typescript
interface BadgeDropdownSelectProps {
  value: string;
  field: FieldMetadata;  // Contains lookupField
  onChange: (value: string) => void;
  disabled?: boolean;
}

const BadgeDropdownSelect: React.FC<BadgeDropdownSelectProps> = ({
  value,
  field,
  onChange,
  disabled
}) => {
  // ===== CACHE QUERY: DATALABEL OPTIONS =====
  const { data: options, isLoading } = useDatalabel(field.lookupField);

  // Query Key: ['datalabel', 'dl__project_stage']
  // Cache TTL: 10 minutes
  // Prefetched at login
  // Dexie: Persisted in datalabel table

  // ===== LOCAL UI STATE =====
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ===== BADGE COLORS FROM GLOBAL SETTINGS =====
  const { settings } = useGlobalSettings();
  const badgeColors = settings?.badge_colors || {};

  // Query Key: ['global-settings']
  // Prefetched at login

  if (isLoading) return <Spinner />;

  const selectedOption = options?.find(opt => opt.code === value);
  const badgeColor = badgeColors[value] || selectedOption?.badge_color || 'bg-gray-100';

  // ===== PORTAL-AWARE CLICK-OUTSIDE =====
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;

      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ===== SELECT OPTION =====
  const selectOption = (optionCode: string) => {
    setLocalValue(optionCode);
    onChange(optionCode);
    setIsOpen(false);
  };

  // ===== RENDER =====
  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`badge ${badgeColor}`}
      >
        {selectedOption?.label || value}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          data-dropdown-portal=""  // CRITICAL for portal detection
          style={{
            position: 'absolute',
            top: buttonRef.current.getBoundingClientRect().bottom + 4,
            left: buttonRef.current.getBoundingClientRect().left,
            zIndex: 9999
          }}
        >
          {options.map(opt => (
            <div
              key={opt.code}
              onClick={() => selectOption(opt.code)}
              className={`option ${badgeColors[opt.code] || opt.badge_color}`}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
```

**Key Points**:
- ✅ Fetches datalabel options from cache
- ✅ Fetches badge colors from global settings
- ✅ Portal rendering with `data-dropdown-portal` attribute
- ✅ Portal-aware click-outside handler

### 5.2 EntityInstanceNameSelect

**File**: `apps/web/src/components/shared/ui/EntityInstanceNameSelect.tsx`

**Cache Interaction**: YES - Fetches entity instance list

```typescript
interface EntityInstanceNameSelectProps {
  entityCode: string;  // 'employee', 'business', etc.
  value: string;       // UUID
  onChange: (uuid: string, label: string) => void;
  disabled?: boolean;
}

const EntityInstanceNameSelect: React.FC<EntityInstanceNameSelectProps> = ({
  entityCode,
  value,
  onChange,
  disabled
}) => {
  // ===== CACHE QUERY: ENTITY INSTANCE LIST =====
  const { data: options, isLoading } = useEntityList(entityCode, { limit: 100 });

  // Query Key: ['entity-list', 'employee', { limit: 100 }]
  // Cache TTL: 2 minutes
  // Dexie: Persisted in entityInstanceData table

  // ===== LOCAL UI STATE =====
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [localValue, setLocalValue] = useState(value);
  const [localLabel, setLocalLabel] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ===== FILTERED OPTIONS =====
  const filteredOptions = useMemo(() => {
    if (!options) return [];
    if (!searchTerm) return options;

    return options.filter(opt =>
      opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  if (isLoading) return <Spinner />;

  // ===== PORTAL-AWARE CLICK-OUTSIDE =====
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;

      setIsOpen(false);
      setSearchTerm('');
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ===== SELECT OPTION =====
  const selectOption = (uuid: string, label: string) => {
    setLocalValue(uuid);
    setLocalLabel(label);
    onChange(uuid, label);
    setIsOpen(false);
    setSearchTerm('');
  };

  // ===== RENDER =====
  const selectedOption = options?.find(opt => opt.id === value);

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {selectedOption?.name || localLabel || 'Select...'}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          data-dropdown-portal=""  // CRITICAL
          style={{
            position: 'absolute',
            top: buttonRef.current.getBoundingClientRect().bottom + 4,
            left: buttonRef.current.getBoundingClientRect().left,
            zIndex: 9999
          }}
        >
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
          />
          {filteredOptions.map(opt => (
            <div
              key={opt.id}
              onClick={() => selectOption(opt.id, opt.name)}
            >
              {opt.name}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
```

**Key Points**:
- ✅ Fetches entity instance list from cache
- ✅ Search filtering (client-side)
- ✅ Portal rendering
- ✅ Portal-aware click-outside handler

---

## 6. FieldRenderer Architecture

**File**: `apps/web/src/lib/fieldRenderer/FieldRenderer.tsx`

**Cache Interaction**: NONE - Pure routing component

```typescript
interface FieldRendererProps {
  field: FieldMetadata;   // From backend metadata (NOT detected!)
  value: any;
  isEditing: boolean;
  onChange?: (value: any) => void;
  formattedData?: {
    display: Record<string, string>;
    styles: Record<string, string>;
  };
  options?: OptionItem[];
  disabled?: boolean;
  readonly?: boolean;
}

const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  isEditing,
  onChange,
  formattedData,
  options,
  disabled,
  readonly
}) => {
  // ===== NO CACHE ACCESS - Pure routing logic =====

  if (isEditing) {
    // EDIT MODE: Resolve from EditComponentRegistry
    const EditComponent = EditComponentRegistry.get(field.inputType);

    if (!EditComponent) {
      console.warn(`No edit component for inputType: ${field.inputType}`);
      return <span>{value}</span>;
    }

    return (
      <EditComponent
        value={value}
        field={field}
        onChange={onChange}
        options={options}
        disabled={disabled || readonly}
      />
    );
  } else {
    // VIEW MODE: Resolve from ViewComponentRegistry
    const ViewComponent = ViewComponentRegistry.get(field.renderType);

    if (!ViewComponent) {
      console.warn(`No view component for renderType: ${field.renderType}`);
      return <span>{value}</span>;
    }

    return (
      <ViewComponent
        value={value}
        field={field}
        formattedData={formattedData}
      />
    );
  }
};
```

**Metadata Structure (From Backend)**:
```json
{
  "dl__project_stage": {
    "dtype": "str",
    "label": "Project Stage",
    "renderType": "badge",           // ← VIEW component
    "inputType": "BadgeDropdownSelect", // ← EDIT component
    "lookupSourceTable": "datalabel",
    "lookupField": "dl__project_stage"
  },
  "manager__employee_id": {
    "dtype": "uuid",
    "label": "Manager",
    "renderType": "entityInstanceId",        // ← VIEW component
    "inputType": "EntityInstanceNameSelect", // ← EDIT component
    "lookupEntity": "employee",
    "lookupSourceTable": "entityInstance"
  },
  "budget_allocated_amt": {
    "dtype": "float",
    "label": "Budget Allocated",
    "renderType": "currency",  // ← VIEW component
    "inputType": "currency",   // ← EDIT component
    "style": { "symbol": "$", "decimals": 2 }
  }
}
```

**Component Registry Maps**:
```typescript
// apps/web/src/lib/fieldRenderer/registerComponents.tsx

// VIEW COMPONENTS (15+ registered)
export const ViewComponentRegistry = new Map<string, React.FC<ComponentRendererProps>>([
  ['text', TextDisplay],
  ['currency', CurrencyDisplay],
  ['date', DateDisplay],
  ['timestamp', TimestampDisplay],
  ['boolean', BooleanDisplay],
  ['badge', BadgeDisplay],
  ['entityInstanceId', EntityInstanceDisplay],
  ['array', ArrayDisplay],
  ['json', JsonDisplay],
  // ... 7 more
]);

// EDIT COMPONENTS (20+ registered)
export const EditComponentRegistry = new Map<string, React.FC<ComponentRendererProps>>([
  ['text', TextInputEdit],
  ['currency', CurrencyInputEdit],
  ['date', DatePickerEdit],
  ['datetime', DateTimePickerEdit],
  ['checkbox', CheckboxEdit],
  ['BadgeDropdownSelect', BadgeDropdownSelectEdit],
  ['EntityInstanceNameSelect', EntityInstanceNameSelectEdit],
  ['tags', TagsInputEdit],
  ['json', JsonEditorEdit],
  // ... 11 more
]);
```

---

## 7. Complete Component Flows

### 7.1 List Page → Table Cell Edit → Optimistic Update

```
USER: Navigate to /project
  ↓
EntityListOfInstancesPage mounts
  ├─ useEntityInstanceMetadata('project', 'entityListOfInstancesTable')
  │   └─ Checks cache: ['entity-metadata', 'project', 'entityListOfInstancesTable']
  │   └─ CACHE HIT → Returns { viewType, editType }
  │
  └─ useFormattedEntityList('project', { limit: 50 })
      ├─ Checks cache: ['entity-list', 'project', { limit: 50 }]
      └─ CACHE HIT → Returns RAW data
          └─ FORMAT-AT-READ (select) transforms → { raw, display, styles }[]
  ↓
Page renders <EntityListOfInstancesTable
  data={formattedProjects}
  metadata={{ viewType, editType }}
  onCellSave={handleCellSave}
/>
  ↓
USER: Click cell "Budget Allocated"
  ↓
EntityListOfInstancesTable
  ├─ setEditingCell({ rowId: 'uuid-1', columnKey: 'budget_allocated_amt' })
  └─ Re-renders cell with isEditing=true
      └─ FieldRenderer
          ├─ field.inputType = 'currency'
          └─ Renders <CurrencyInputEdit value={50000} onChange={...} />
  ↓
USER: Type "75000" + click outside
  ↓
EntityListOfInstancesTable.handleClickOutside()
  ├─ Checks: editingCellRef.contains(target)? NO
  ├─ Checks: target.closest('[data-dropdown-portal]')? NO
  └─ Calls handleCellSave('uuid-1', 'budget_allocated_amt', 75000, record)
      └─ Calls props.onCellSave(...)
          ↓
EntityListOfInstancesPage.handleCellSave()
  └─ updateEntity('uuid-1', { budget_allocated_amt: 75000 })
      ├─ OPTIMISTIC UPDATE:
      │   ├─ queryClient.setQueryData(['entity-instance', 'project', 'uuid-1'], newData)
      │   ├─ pmoDb.entityInstance.put(newData)
      │   └─ UI updates instantly ✅
      │
      └─ API CALL:
          ├─ PATCH /api/v1/project/uuid-1
          ├─ SUCCESS: invalidateQueries(['entity-list', 'project'])
          └─ ERROR: Rollback optimistic update
```

### 7.2 Detail Page → Inline Edit → Dropdown Selection → Optimistic Update

```
USER: Navigate to /project/uuid-1
  ↓
EntitySpecificInstancePage mounts
  ├─ useEntityInstanceMetadata('project', 'entityInstanceFormContainer')
  │   └─ Returns { viewType, editType }
  │
  └─ useEntity('project', 'uuid-1')
      └─ Returns entity data
  ↓
Page renders <EntityInstanceFormContainer
  formData={entity.raw}
  metadata={{ viewType, editType }}
  mode="view"
  onInlineSave={handleInlineSave}
/>
  ↓
USER: Long-press "Manager Employee Name" (500ms)
  ↓
EntityInstanceFormContainer.handleLongPressStart()
  └─ setTimeout(() => enterInlineEditMode('manager__employee_id'), 500)
      ↓
EntityInstanceFormContainer.enterInlineEditMode()
  ├─ setInlineEditingField('manager__employee_id')
  ├─ setInlineEditValue('uuid-james')
  └─ Re-renders field with isEditing=true
      └─ FieldRenderer
          ├─ field.inputType = 'EntityInstanceNameSelect'
          └─ Renders <EntityInstanceNameSelectEdit
              value="uuid-james"
              field={{ lookupEntity: 'employee' }}
              onChange={(uuid) => setInlineEditValue(uuid)}
            />
              └─ Wraps <EntityInstanceNameSelect
                  entityCode="employee"
                  onChange={(uuid, label) => props.onChange(uuid)}
                />
                  ├─ useEntityList('employee', { limit: 100 })
                  │   └─ Fetches employee options from cache
                  └─ Renders dropdown button
  ↓
USER: Click dropdown button
  ↓
EntityInstanceNameSelect
  ├─ setIsOpen(true)
  └─ createPortal(<div data-dropdown-portal ref={dropdownRef}>...</div>, document.body)
  ↓
USER: Click "Sarah Johnson" option
  ↓
EntityInstanceNameSelect.selectOption('uuid-sarah', 'Sarah Johnson')
  ├─ Event: mousedown
  │   ├─ EntityInstanceFormContainer.handleClickOutside() executes:
  │   │   ├─ Check: editingFieldRef.contains(target)? NO
  │   │   ├─ Check: target.closest('[data-dropdown-portal]')? YES ✅
  │   │   └─ RETURN EARLY (does not call handleInlineSave)
  │   │
  │   └─ EntityInstanceNameSelect.handleClickOutside() executes:
  │       ├─ Check: dropdownRef.contains(target)? YES ✅
  │       └─ RETURN EARLY (does not close dropdown)
  │
  └─ Event: click
      └─ selectOption() executes:
          ├─ setLocalValue('uuid-sarah')
          ├─ onChange('uuid-sarah', 'Sarah Johnson')
          │   └─ EntityInstanceNameSelectEdit.onChange('uuid-sarah')
          │       └─ FieldRenderer.onChange('uuid-sarah')
          │           └─ EntityInstanceFormContainer.handleInlineValueChange()
          │               └─ setInlineEditValue('uuid-sarah') ✅
          │
          ├─ setIsOpen(false)
          └─ setSearchTerm('')
  ↓
USER: Click outside field
  ↓
EntityInstanceFormContainer.handleClickOutside()
  ├─ Check: editingFieldRef.contains(target)? NO
  ├─ Check: target.closest('[data-dropdown-portal]')? NO
  └─ Calls handleInlineSave()
      ├─ Compare: inlineEditValue ('uuid-sarah') !== formData['manager__employee_id'] ('uuid-james')
      ├─ Calls props.onInlineSave('manager__employee_id', 'uuid-sarah')
      │   ↓
      │   EntitySpecificInstancePage.handleInlineSave()
      │   └─ optimisticUpdateEntity('uuid-1', { manager__employee_id: 'uuid-sarah' })
      │       ├─ OPTIMISTIC UPDATE:
      │       │   ├─ queryClient.setQueryData(['entity-instance', 'project', 'uuid-1'], newData)
      │       │   ├─ pmoDb.entityInstance.put(newData)
      │       │   └─ UI updates instantly ✅
      │       │
      │       └─ API CALL:
      │           ├─ PATCH /api/v1/project/uuid-1
      │           ├─ SUCCESS: invalidateQueries + refetch
      │           └─ ERROR: Rollback
      │
      └─ Clear editing state:
          ├─ setInlineEditingField(null)
          └─ setInlineEditValue(null)
```

---

## Summary: Component → Cache Mapping

| Component Type | Cache Access | Cache Keys Used |
|----------------|--------------|-----------------|
| **Page Components** | YES (owns queries) | `['entity-metadata', ...]`, `['entity-list', ...]`, `['entity-instance', ...]` |
| **Container Components** | NO (props only) | N/A - Receives data from parent |
| **UI Components** (dropdowns) | YES (own queries) | `['datalabel', ...]`, `['entity-list', ...]`, `['global-settings']` |
| **Registry Components** | NO (pure render) | N/A - Stateless |

**Key Frontend Architecture Principles**:
1. ✅ **Backend metadata drives everything** - No frontend pattern detection
2. ✅ **Format-at-read** - Current state (format-at-fetch removed)
3. ✅ **TanStack Query + Dexie** - Current state (RxDB removed)
4. ✅ **Pages own cache queries** - Containers receive props
5. ✅ **Portal-aware click-outside** - Defense in depth
6. ✅ **Optimistic updates** - Instant UI feedback

---

## Section 7: Inline Editing Patterns

### 7.1 Form Inline Edit (Long-Press Pattern)

**Component**: EntityInstanceFormContainer
**Trigger**: Long-press (500ms hold)
**Use Case**: Detail page field editing

#### Implementation

```typescript
const EntityInstanceFormContainer = ({ formData, metadata, onInlineSave }) => {
  const [inlineEditingField, setInlineEditingField] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<any>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const editingFieldRef = useRef<HTMLDivElement | null>(null);

  // STEP 1: Long-press detection
  const handleLongPressStart = (event: React.MouseEvent, fieldKey: string) => {
    event.preventDefault();

    longPressTimer.current = setTimeout(() => {
      enterInlineEditMode(fieldKey);
    }, 500);  // 500ms threshold
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // STEP 2: Enter edit mode
  const enterInlineEditMode = (fieldKey: string) => {
    setInlineEditingField(fieldKey);
    setInlineEditValue(formData[fieldKey]);  // Capture current value
  };

  // STEP 3: Portal-aware click-outside handler
  useEffect(() => {
    if (!inlineEditingField) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't save if clicking inside editing field
      if (editingFieldRef.current?.contains(target)) return;

      // CRITICAL: Don't save if clicking inside dropdown portal
      if ((target as Element).closest?.('[data-dropdown-portal]')) return;

      // Truly outside - save and close
      handleInlineSave();
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inlineEditingField]);

  // STEP 4: Save handler
  const handleInlineSave = () => {
    if (!inlineEditingField) return;

    const newValue = inlineEditValue;
    const oldValue = formData[inlineEditingField];

    // Only save if changed
    if (newValue !== oldValue) {
      onInlineSave(inlineEditingField, newValue);
    }

    // Clear editing state
    setInlineEditingField(null);
    setInlineEditValue(null);
  };

  // STEP 5: Render
  return (
    <div>
      {Object.entries(metadata.editType).map(([key, fieldMeta]) => {
        const isInlineEditing = inlineEditingField === key;

        return (
          <div
            key={key}
            onMouseDown={(e) => handleLongPressStart(e, key)}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
            onTouchStart={(e) => handleLongPressStart(e, key)}
            onTouchEnd={handleLongPressEnd}
            ref={isInlineEditing ? editingFieldRef : null}
          >
            <label>{fieldMeta.label}</label>
            <FieldRenderer
              field={isInlineEditing ? fieldMeta : metadata.viewType[key]}
              value={isInlineEditing ? inlineEditValue : formData[key]}
              isEditing={isInlineEditing}
              onChange={(v) => setInlineEditValue(v)}
            />
          </div>
        );
      })}
    </div>
  );
};
```

**Key Points**:
- ✅ 500ms hold threshold prevents accidental edits
- ✅ Mouse + Touch support for mobile
- ✅ Portal-aware click-outside (THE CRITICAL FIX)
- ✅ Only saves if value changed

### 7.2 Table Cell Edit (Click Pattern)

**Component**: EntityListOfInstancesTable
**Trigger**: Single click on cell
**Use Case**: List page inline editing

#### Implementation

```typescript
const EntityListOfInstancesTable = ({ data, metadata, onCellSave }) => {
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnKey: string } | null>(null);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const editingCellRef = useRef<HTMLDivElement | null>(null);

  // STEP 1: Portal-aware click-outside handler
  useEffect(() => {
    if (!editingCell) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Don't save if clicking inside editing cell
      if (editingCellRef.current?.contains(target)) return;

      // CRITICAL: Don't save if clicking inside dropdown portal
      if (target.closest('[data-dropdown-portal]')) return;

      // Truly outside - save and close
      const record = data.find(r => getRowKey(r) === editingCell.rowId);
      if (record) {
        handleCellSave(editingCell.rowId, editingCell.columnKey, record);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCell, data]);

  // STEP 2: Save handler
  const handleCellSave = (rowId: string, columnKey: string, record: any) => {
    const newValue = editedData[`${rowId}_${columnKey}`];
    const oldValue = record.raw[columnKey];

    if (newValue !== undefined && newValue !== oldValue) {
      onCellSave(rowId, columnKey, newValue, record);
    }

    setEditingCell(null);
    setEditedData({});
  };

  // STEP 3: Render
  return (
    <table>
      <tbody>
        {data.map((row, idx) => (
          <tr key={getRowKey(row, idx)}>
            {columns.map(col => {
              const isEditing = editingCell?.rowId === getRowKey(row, idx) &&
                               editingCell?.columnKey === col;

              return (
                <td
                  key={col}
                  onClick={() => {
                    if (!isEditing) {
                      setEditingCell({ rowId: getRowKey(row, idx), columnKey: col });
                    }
                  }}
                  ref={isEditing ? editingCellRef : null}
                >
                  <FieldRenderer
                    field={isEditing ? metadata.editType[col] : metadata.viewType[col]}
                    value={row.raw[col]}
                    isEditing={isEditing}
                    onChange={(v) => {
                      setEditedData(prev => ({
                        ...prev,
                        [`${getRowKey(row, idx)}_${col}`]: v
                      }));
                    }}
                    formattedData={{ display: row.display, styles: row.styles }}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

**Key Points**:
- ✅ Single click to edit (faster than long-press)
- ✅ Portal-aware click-outside (same pattern as form)
- ✅ Tracks edits per cell using compound key `${rowId}_${columnKey}`

### 7.3 Optimistic Update Strategy

**Hook**: useEntityMutation
**Purpose**: Instant UI feedback with automatic rollback

#### Implementation

```typescript
// apps/web/src/db/cache/hooks/useEntityMutation.ts

export function useEntityMutation(entityCode: string) {
  const queryClient = useQueryClient();

  const updateEntity = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return await api.patch(`/api/v1/${entityCode}/${id}`, updates);
    },

    // PHASE 1: OPTIMISTIC UPDATE (Instant)
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['entity-instance', entityCode, id] });

      // Snapshot previous value (for rollback)
      const previousData = queryClient.getQueryData(['entity-instance', entityCode, id]);

      // Optimistically update cache
      queryClient.setQueryData(['entity-instance', entityCode, id], (old: any) => ({
        ...old,
        ...updates
      }));

      // Optimistically update Dexie
      await pmoDb.entityInstance.put({
        entityCode,
        entityId: id,
        data: { ...previousData, ...updates },
        updatedAt: Date.now()
      });

      // Return context for rollback
      return { previousData };
    },

    // PHASE 2: SUCCESS (Background refetch)
    onSuccess: (data, { id }) => {
      // Invalidate queries to trigger background refetch
      queryClient.invalidateQueries({ queryKey: ['entity-instance', entityCode, id] });
      queryClient.invalidateQueries({ queryKey: ['entity-list', entityCode] });

      toast.success('Updated successfully');
    },

    // PHASE 3: ERROR (Rollback)
    onError: (error, { id }, context) => {
      // Rollback cache
      if (context?.previousData) {
        queryClient.setQueryData(
          ['entity-instance', entityCode, id],
          context.previousData
        );
      }

      // Rollback Dexie
      if (context?.previousData) {
        pmoDb.entityInstance.put({
          entityCode,
          entityId: id,
          data: context.previousData,
          updatedAt: Date.now()
        });
      }

      toast.error(`Failed to update: ${error.message}`);
    }
  });

  return { updateEntity: updateEntity.mutate };
}
```

**Optimistic Update Flow**:
```
1. User makes change
   ↓
2. Update TanStack Query cache (instant UI update)
   ↓
3. Update Dexie (persist optimistic change)
   ↓
4. Component re-renders with new value ✅
   ↓
5. API call in background
   ├─ SUCCESS:
   │   ├─ Invalidate queries
   │   ├─ Background refetch
   │   └─ Update cache with server truth
   │
   └─ ERROR:
       ├─ Rollback TanStack Query cache
       ├─ Rollback Dexie
       ├─ Component re-renders with old value
       └─ Show error toast
```

### 7.4 Error Handling & Rollback

**Three-Tier Error Handling**:

1. **Optimistic Update Rollback** (Automatic):
```typescript
onError: (error, variables, context) => {
  // Restore previous cache state
  queryClient.setQueryData(queryKey, context.previousData);

  // Restore previous Dexie state
  pmoDb.entityInstance.put(context.previousData);

  // UI automatically reverts
}
```

2. **Validation Errors** (Before API call):
```typescript
const handleInlineSave = () => {
  const newValue = inlineEditValue;

  // Client-side validation
  if (metadata.editType[fieldKey].required && !newValue) {
    toast.error('This field is required');
    return;  // Don't trigger mutation
  }

  if (metadata.editType[fieldKey].pattern) {
    const regex = new RegExp(metadata.editType[fieldKey].pattern);
    if (!regex.test(newValue)) {
      toast.error('Invalid format');
      return;
    }
  }

  // Validation passed - trigger mutation
  onInlineSave(fieldKey, newValue);
};
```

3. **Network Errors** (With retry):
```typescript
const updateEntity = useMutation({
  mutationFn: async ({ id, updates }) => {
    return await api.patch(`/api/v1/${entityCode}/${id}`, updates);
  },

  retry: 3,  // Retry 3 times
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),  // Exponential backoff

  onError: (error) => {
    if (error.response?.status === 403) {
      toast.error('You do not have permission to edit this field');
    } else if (error.response?.status === 409) {
      toast.error('This record was modified by another user. Please refresh.');
    } else if (error.message === 'Network Error') {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('Failed to save changes');
    }
  }
});
```

### 7.5 Validation Patterns

**Validation Sources**:
1. Backend metadata (field.required, field.pattern)
2. Component-level validation (min/max, regex)
3. Server-side validation (API response)

#### Client-Side Validation

```typescript
// apps/web/src/lib/validation/fieldValidation.ts

export function validateField(value: any, fieldMeta: FieldMetadata): ValidationResult {
  const errors: string[] = [];

  // Required check
  if (fieldMeta.required && (value === null || value === undefined || value === '')) {
    errors.push(`${fieldMeta.label} is required`);
  }

  // Type-specific validation
  if (fieldMeta.dtype === 'float' && isNaN(Number(value))) {
    errors.push(`${fieldMeta.label} must be a number`);
  }

  if (fieldMeta.dtype === 'uuid' && value && !isValidUUID(value)) {
    errors.push(`${fieldMeta.label} must be a valid UUID`);
  }

  // Pattern validation
  if (fieldMeta.pattern && value) {
    const regex = new RegExp(fieldMeta.pattern);
    if (!regex.test(value)) {
      errors.push(`${fieldMeta.label} format is invalid`);
    }
  }

  // Min/Max validation
  if (fieldMeta.min !== undefined && Number(value) < fieldMeta.min) {
    errors.push(`${fieldMeta.label} must be at least ${fieldMeta.min}`);
  }

  if (fieldMeta.max !== undefined && Number(value) > fieldMeta.max) {
    errors.push(`${fieldMeta.label} must be at most ${fieldMeta.max}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
```

#### Usage in Form

```typescript
const handleInlineSave = () => {
  const fieldMeta = metadata.editType[inlineEditingField];
  const validation = validateField(inlineEditValue, fieldMeta);

  if (!validation.isValid) {
    toast.error(validation.errors[0]);  // Show first error
    return;  // Don't save
  }

  // Validation passed
  onInlineSave(inlineEditingField, inlineEditValue);
};
```

---

## Section 8: Add Row Pattern

### 8.1 Table Add Row Flow

**Component**: EntityListOfInstancesTable with Add Row capability
**Pattern**: Inline row creation

#### Implementation

```typescript
const EntityListOfInstancesTable = ({ data, metadata, onAddRow }) => {
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});

  // STEP 1: Add Row button click
  const handleAddRowClick = () => {
    setIsAddingRow(true);
    setNewRowData({});  // Empty row
  };

  // STEP 2: Save new row
  const handleSaveNewRow = async () => {
    // Validate required fields
    const validation = validateNewRow(newRowData, metadata.editType);
    if (!validation.isValid) {
      toast.error(validation.errors[0]);
      return;
    }

    // Call parent's create mutation
    await onAddRow(newRowData);

    // Reset state
    setIsAddingRow(false);
    setNewRowData({});
  };

  // STEP 3: Cancel
  const handleCancelAddRow = () => {
    setIsAddingRow(false);
    setNewRowData({});
  };

  return (
    <table>
      <thead>
        <tr>
          <th colSpan={columns.length}>
            <button onClick={handleAddRowClick}>+ Add Row</button>
          </th>
        </tr>
      </thead>
      <tbody>
        {/* New row (if adding) */}
        {isAddingRow && (
          <tr className="new-row">
            {columns.map(col => (
              <td key={col}>
                <FieldRenderer
                  field={metadata.editType[col]}
                  value={newRowData[col]}
                  isEditing={true}
                  onChange={(v) => setNewRowData(prev => ({ ...prev, [col]: v }))}
                />
              </td>
            ))}
            <td>
              <button onClick={handleSaveNewRow}>Save</button>
              <button onClick={handleCancelAddRow}>Cancel</button>
            </td>
          </tr>
        )}

        {/* Existing rows */}
        {data.map(row => (
          <tr key={row.raw.id}>...</tr>
        ))}
      </tbody>
    </table>
  );
};
```

### 8.2 Create-Link-Redirect Pattern

**Pattern**: Create entity → Link to parent → Redirect to detail page

#### Flow

```typescript
// Page: EntityListOfInstancesPage (with parent context)
const EntityListOfInstancesPage = () => {
  const { entityCode } = useParams();
  const [searchParams] = useSearchParams();
  const parent_code = searchParams.get('parent_code');
  const parent_id = searchParams.get('parent_id');
  const navigate = useNavigate();

  const { createEntity } = useEntityMutation(entityCode);

  const handleAddRow = async (rowData: any) => {
    // STEP 1: Create entity (with parent context)
    const created = await createEntity(rowData, { parent_code, parent_id });

    // Backend handles:
    // - INSERT INTO app.project
    // - INSERT INTO entity_instance
    // - INSERT INTO entity_rbac (OWNER for creator)
    // - INSERT INTO entity_instance_link (if parent_code + parent_id provided)

    // STEP 2: Redirect to detail page
    navigate(`/${entityCode}/${created.id}`);
  };

  return (
    <EntityListOfInstancesTable
      data={data}
      metadata={metadata}
      onAddRow={handleAddRow}
    />
  );
};
```

### 8.3 Parent Context Propagation

**URL Pattern**: `/project?parent_code=business&parent_id=uuid-123`

#### How Parent Context Flows

```
1. User clicks "Add Project" button on Business detail page
   ↓
2. Navigate to: /project/create?parent_code=business&parent_id=uuid-123
   ↓
3. EntityCreatePage extracts parent context from URL:
   const parent_code = searchParams.get('parent_code');  // 'business'
   const parent_id = searchParams.get('parent_id');      // 'uuid-123'
   ↓
4. User fills form and clicks "Save"
   ↓
5. createEntity(formData, { parent_code, parent_id })
   ↓
6. Backend creates entity + link:
   POST /api/v1/project?parent_code=business&parent_id=uuid-123
   ↓
7. Backend creates:
   - INSERT INTO app.project (new project)
   - INSERT INTO entity_instance_link (business → project link)
   - INSERT INTO entity_rbac (creator gets OWNER permission)
   ↓
8. Navigate to: /project/{new-id}
```

### 8.4 Draft Persistence

**Hook**: useDraft
**Purpose**: Persist unsaved form data across page refreshes

#### Implementation

```typescript
// apps/web/src/db/cache/hooks/useDraft.ts

export function useDraft(entityCode: string, entityId: string) {
  const queryClient = useQueryClient();

  // Load draft from Dexie
  const { data: draft } = useQuery({
    queryKey: ['draft', entityCode, entityId],
    queryFn: async () => {
      const draft = await pmoDb.draft
        .where('[entityCode+entityId]')
        .equals([entityCode, entityId])
        .first();

      return draft?.data || null;
    },
    staleTime: Infinity  // Never stale
  });

  // Save draft to Dexie
  const saveDraft = useMutation({
    mutationFn: async (data: any) => {
      await pmoDb.draft.put({
        entityCode,
        entityId,
        data,
        updatedAt: Date.now()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', entityCode, entityId] });
    }
  });

  // Clear draft
  const clearDraft = useMutation({
    mutationFn: async () => {
      await pmoDb.draft
        .where('[entityCode+entityId]')
        .equals([entityCode, entityId])
        .delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', entityCode, entityId] });
    }
  });

  return {
    draft,
    saveDraft: saveDraft.mutate,
    clearDraft: clearDraft.mutate,
    hasDraft: !!draft
  };
}
```

#### Usage in Form

```typescript
const EntityInstanceFormContainer = ({ formData, metadata, mode, onSubmit }) => {
  const { entityCode, id } = useParams();
  const [currentData, setCurrentData] = useState(formData);
  const { draft, saveDraft, clearDraft, hasDraft } = useDraft(entityCode, id);

  // Auto-save draft every 2 seconds
  useEffect(() => {
    if (mode === 'create' || mode === 'edit') {
      const timer = setTimeout(() => {
        if (JSON.stringify(currentData) !== JSON.stringify(formData)) {
          saveDraft(currentData);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [currentData, formData, mode]);

  // Restore draft on mount
  useEffect(() => {
    if (hasDraft && mode === 'create') {
      const shouldRestore = confirm('You have unsaved changes. Restore draft?');
      if (shouldRestore) {
        setCurrentData(draft);
      } else {
        clearDraft();
      }
    }
  }, [hasDraft, draft, mode]);

  const handleSubmit = async () => {
    await onSubmit(currentData);
    clearDraft();  // Clear draft after successful save
  };

  return (
    <form onSubmit={handleSubmit}>
      {hasDraft && <div className="draft-indicator">Draft auto-saved</div>}
      {/* Form fields */}
    </form>
  );
};
```

---

## Section 9: Cache Invalidation & Synchronization

### 9.1 WebSocket Cache Invalidation

**Service**: WebSocketManager (port 4001)
**Purpose**: Real-time cache invalidation across clients

#### Architecture

```typescript
// apps/web/src/lib/websocket/WebSocketManager.ts

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private queryClient: QueryClient) {}

  // STEP 1: Connect to WebSocket server
  connect() {
    this.ws = new WebSocket('ws://localhost:4001');

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');

      // Resubscribe to all previous subscriptions
      this.subscriptions.forEach(sub => {
        const [entityCode, entityId] = sub.split(':');
        this.subscribe(entityCode, entityId);
      });
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'INVALIDATE') {
        this.handleInvalidate(message);
      }
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };
  }

  // STEP 2: Subscribe to entity changes
  subscribe(entityCode: string, entityId?: string) {
    const subKey = entityId ? `${entityCode}:${entityId}` : entityCode;
    this.subscriptions.add(subKey);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        entity_code: entityCode,
        entity_id: entityId
      }));
    }
  }

  // STEP 3: Unsubscribe
  unsubscribe(entityCode: string, entityId?: string) {
    const subKey = entityId ? `${entityCode}:${entityId}` : entityCode;
    this.subscriptions.delete(subKey);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        entity_code: entityCode,
        entity_id: entityId
      }));
    }
  }

  // STEP 4: Handle invalidation messages
  private handleInvalidate(message: InvalidateMessage) {
    const { entity_code, entity_id } = message;

    // Invalidate specific instance
    if (entity_id) {
      this.queryClient.invalidateQueries({
        queryKey: ['entity-instance', entity_code, entity_id]
      });
    }

    // Invalidate all lists of this entity type
    this.queryClient.invalidateQueries({
      queryKey: ['entity-list', entity_code]
    });

    // TanStack Query automatically triggers background refetch
    // → Updates Dexie → Components re-render
  }

  // STEP 5: Reconnect on disconnect
  private reconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      console.log('[WebSocket] Reconnecting...');
      this.connect();
      this.reconnectTimer = null;
    }, 5000);  // Retry after 5 seconds
  }

  disconnect() {
    this.ws?.close();
    this.subscriptions.clear();
  }
}
```

#### Usage in Components

```typescript
// Page component subscribes to entity changes
const EntitySpecificInstancePage = () => {
  const { entityCode, id } = useParams();
  const wsManager = useWebSocketManager();

  useEffect(() => {
    // Subscribe to this specific entity
    wsManager.subscribe(entityCode, id);

    // Subscribe to entity type (for list updates)
    wsManager.subscribe(entityCode);

    return () => {
      wsManager.unsubscribe(entityCode, id);
      wsManager.unsubscribe(entityCode);
    };
  }, [entityCode, id]);

  // Component automatically re-renders when cache is invalidated
};
```

### 9.2 Manual Invalidation Patterns

**When to manually invalidate**:
1. After successful mutation
2. After external data change
3. On navigation between related entities

#### Pattern 1: Invalidate After Mutation

```typescript
const { updateEntity } = useEntityMutation('project');

const handleUpdate = async (id: string, updates: any) => {
  await updateEntity(id, updates);

  // Mutation hook already invalidates:
  // - ['entity-instance', 'project', id]
  // - ['entity-list', 'project']

  // Manual invalidation for related entities
  queryClient.invalidateQueries({ queryKey: ['entity-list', 'task'] });  // Tasks might show parent project name
};
```

#### Pattern 2: Invalidate on Navigation

```typescript
const handleNavigateToParent = (parentCode: string, parentId: string) => {
  // Invalidate parent entity to ensure fresh data
  queryClient.invalidateQueries({
    queryKey: ['entity-instance', parentCode, parentId]
  });

  navigate(`/${parentCode}/${parentId}`);
};
```

#### Pattern 3: Selective Invalidation

```typescript
// Invalidate all projects
queryClient.invalidateQueries({ queryKey: ['entity-list', 'project'] });

// Invalidate specific project lists (with filters)
queryClient.invalidateQueries({
  queryKey: ['entity-list', 'project'],
  predicate: (query) => {
    const params = query.queryKey[2] as any;
    return params?.dl__project_stage === 'planning';  // Only invalidate "planning" lists
  }
});

// Invalidate all entity instances (across all types)
queryClient.invalidateQueries({ queryKey: ['entity-instance'] });
```

### 9.3 Multi-Tab Sync (Dexie)

**Purpose**: Keep multiple browser tabs in sync

#### Implementation

```typescript
// apps/web/src/db/dexie/sync.ts

export class DexieMultiTabSync {
  constructor(private queryClient: QueryClient) {
    this.setupSyncListener();
  }

  private setupSyncListener() {
    // Listen to Dexie storage events
    pmoDb.on('changes', (changes) => {
      changes.forEach(change => {
        if (change.table === 'entityInstance') {
          const { entityCode, entityId } = change.obj;

          // Invalidate TanStack Query cache in THIS tab
          this.queryClient.invalidateQueries({
            queryKey: ['entity-instance', entityCode, entityId]
          });
        }

        if (change.table === 'entityInstanceData') {
          const { entityCode } = change.obj;

          this.queryClient.invalidateQueries({
            queryKey: ['entity-list', entityCode]
          });
        }

        if (change.table === 'datalabel') {
          const { field } = change.obj;

          this.queryClient.invalidateQueries({
            queryKey: ['datalabel', field]
          });
        }
      });
    });
  }
}
```

#### Flow

```
TAB A: User edits project
  ↓
TAB A: Optimistic update
  ├─ Update TanStack Query cache
  └─ Update Dexie
      ↓
      Dexie fires storage event
      ↓
TAB B: Dexie listener receives event
  ↓
TAB B: Invalidate TanStack Query cache
  ↓
TAB B: Background refetch executes
  ↓
TAB B: UI updates with new data ✅
```

### 9.4 Optimistic Update + Refetch Pattern

**Pattern**: Update cache immediately, refetch in background

```typescript
// Standard optimistic update with refetch
const updateEntity = useMutation({
  mutationFn: async ({ id, updates }) => {
    return await api.patch(`/api/v1/${entityCode}/${id}`, updates);
  },

  onMutate: async ({ id, updates }) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries({ queryKey: ['entity-instance', entityCode, id] });

    // Snapshot old value
    const previous = queryClient.getQueryData(['entity-instance', entityCode, id]);

    // Optimistic update
    queryClient.setQueryData(['entity-instance', entityCode, id], (old: any) => ({
      ...old,
      ...updates
    }));

    return { previous };
  },

  onSuccess: (data, { id }) => {
    // Invalidate to trigger background refetch
    queryClient.invalidateQueries({ queryKey: ['entity-instance', entityCode, id] });

    // OR set data directly (skip refetch if server returns updated entity)
    queryClient.setQueryData(['entity-instance', entityCode, id], data);
  },

  onError: (error, { id }, context) => {
    // Rollback on error
    queryClient.setQueryData(
      ['entity-instance', entityCode, id],
      context.previous
    );
  }
});
```

### 9.5 Cache Key Patterns

**Consistent key structure across the app**:

```typescript
// Entity metadata (per metadataType)
['entity-metadata', entityCode, metadataType]
['entity-metadata', 'project', 'entityListOfInstancesTable']
['entity-metadata', 'project', 'entityInstanceFormContainer']

// Entity lists (with params)
['entity-list', entityCode, params]
['entity-list', 'project', { limit: 50, offset: 0 }]
['entity-list', 'project', { limit: 50, dl__project_stage: 'planning' }]

// Entity instances
['entity-instance', entityCode, entityId]
['entity-instance', 'project', 'uuid-123']

// Child entity lists (filtered by parent)
['entity-list', parentEntityCode, parentEntityId, childEntityCode]
['entity-list', 'project', 'uuid-parent', 'task']

// Datalabels
['datalabel', field]
['datalabel', 'dl__project_stage']

// Entity codes (type metadata)
['entity-codes']

// Global settings
['global-settings']

// Drafts
['draft', entityCode, entityId]
['draft', 'project', 'uuid-123']
```

**Invalidation Strategies**:

```typescript
// Invalidate ALL entity instances of a type
queryClient.invalidateQueries({ queryKey: ['entity-instance', 'project'] });

// Invalidate specific instance
queryClient.invalidateQueries({ queryKey: ['entity-instance', 'project', 'uuid-123'] });

// Invalidate ALL lists of a type (regardless of params)
queryClient.invalidateQueries({ queryKey: ['entity-list', 'project'] });

// Invalidate specific parameterized list
queryClient.invalidateQueries({
  queryKey: ['entity-list', 'project', { limit: 50, offset: 0 }]
});

// Invalidate all metadata
queryClient.invalidateQueries({ queryKey: ['entity-metadata'] });

// Invalidate all datalabels
queryClient.invalidateQueries({ queryKey: ['datalabel'] });
```

---

## Section 10: Complete Interaction Flows

### 10.1 Project List → View → Edit → Save Flow

```
USER: Navigate to /project
  ↓
EntityListOfInstancesPage mounts
  ├─ useEntityInstanceMetadata('project', 'entityListOfInstancesTable')
  │   ├─ Cache key: ['entity-metadata', 'project', 'entityListOfInstancesTable']
  │   └─ Returns: { viewType, editType }
  │
  └─ useFormattedEntityList('project', { limit: 50 })
      ├─ Cache key: ['entity-list', 'project', { limit: 50 }]
      ├─ Returns: RAW data from cache/API
      └─ FORMAT-AT-READ: Transform to { raw, display, styles }[]
  ↓
Page renders table with 50 projects
  ↓
USER: Click row "Kitchen Renovation"
  ↓
Navigate to /project/uuid-123
  ↓
EntitySpecificInstancePage mounts
  ├─ useEntityInstanceMetadata('project', 'entityInstanceFormContainer')
  │   └─ Returns: { viewType, editType } for FORM layout
  │
  └─ useEntity('project', 'uuid-123')
      ├─ Cache key: ['entity-instance', 'project', 'uuid-123']
      └─ Returns: Single project entity
  ↓
Page renders form in VIEW mode
  ↓
USER: Long-press "Budget Allocated" field (500ms)
  ↓
EntityInstanceFormContainer.enterInlineEditMode('budget_allocated_amt')
  ├─ setInlineEditingField('budget_allocated_amt')
  ├─ setInlineEditValue(50000)
  └─ Re-render field in EDIT mode
      └─ FieldRenderer
          ├─ field.inputType = 'currency'
          └─ Renders: <CurrencyInputEdit value={50000} />
  ↓
USER: Type "75000" + click outside
  ↓
EntityInstanceFormContainer.handleClickOutside()
  └─ handleInlineSave()
      ├─ Compare: 75000 !== 50000 (changed)
      └─ onInlineSave('budget_allocated_amt', 75000)
          ↓
          EntitySpecificInstancePage.handleInlineSave()
          └─ optimisticUpdateEntity('uuid-123', { budget_allocated_amt: 75000 })
              ├─ OPTIMISTIC UPDATE (instant):
              │   ├─ queryClient.setQueryData(['entity-instance', 'project', 'uuid-123'], newData)
              │   ├─ pmoDb.entityInstance.put(newData)
              │   └─ UI shows "$75,000.00" immediately ✅
              │
              └─ API CALL (background):
                  ├─ PATCH /api/v1/project/uuid-123
                  ├─ Backend: RBAC check + transactional update
                  ├─ Backend: Trigger INSERT INTO app.system_logging
                  ├─ SUCCESS:
                  │   ├─ invalidateQueries(['entity-instance', 'project', 'uuid-123'])
                  │   ├─ invalidateQueries(['entity-list', 'project'])
                  │   ├─ Background refetch updates cache
                  │   └─ Toast: "Updated successfully"
                  │
                  └─ ERROR:
                      ├─ Rollback: queryClient.setQueryData (restore 50000)
                      ├─ Rollback: pmoDb.entityInstance.put (restore 50000)
                      ├─ UI reverts to "$50,000.00"
                      └─ Toast: "Failed to update"
  ↓
60 seconds later: LogWatcher polls app.system_logging
  ↓
WebSocket INVALIDATE message sent to all clients
  ↓
Other users' browsers:
  ├─ WebSocketManager.handleInvalidate()
  ├─ queryClient.invalidateQueries(['entity-instance', 'project', 'uuid-123'])
  ├─ Background refetch
  └─ Their UI updates to show $75,000 ✅
```

### 10.2 Badge Color Change → Real-Time Update Flow

```
USER: Navigate to /settings/dl__project_stage
  ↓
SettingDetailPage mounts
  └─ useDatalabel('dl__project_stage')
      ├─ Cache key: ['datalabel', 'dl__project_stage']
      └─ Returns: [{ code: 'planning', label: 'Planning', badge_color: 'bg-blue-100' }, ...]
  ↓
Page renders datalabel options with color pickers
  ↓
USER: Change "Planning" color from blue → green
  ↓
handleColorChange('planning', 'bg-green-100')
  └─ updateDatalabel('dl__project_stage', 'planning', { badge_color: 'bg-green-100' })
      ├─ OPTIMISTIC UPDATE:
      │   ├─ queryClient.setQueryData(['datalabel', 'dl__project_stage'], newOptions)
      │   ├─ pmoDb.datalabel.put(newOption)
      │   └─ Color picker shows green immediately ✅
      │
      └─ API CALL:
          ├─ PATCH /api/v1/datalabel/dl__project_stage/planning
          ├─ Backend updates database
          └─ SUCCESS:
              └─ invalidateQueries(['datalabel', 'dl__project_stage'])
  ↓
Settings page shows updated color ✅
  ↓
USER: Navigate back to /project
  ↓
EntityListOfInstancesPage mounts
  └─ useFormattedEntityList('project', { limit: 50 })
      ├─ Returns RAW data from cache
      └─ FORMAT-AT-READ:
          ├─ Subscribe to datalabel cache (reactive)
          ├─ useDatalabel('dl__project_stage') returns NEW colors
          ├─ Format badge: 'planning' → 'bg-green-100' (NEW!)
          └─ Return formatted data
  ↓
Table renders with NEW badge colors ✅
  ↓
ALL project badges with "Planning" now show green (no page refresh needed!)
```

**Key Point**: Format-at-read makes badge color changes reactive across the entire app!

### 10.3 Create New Project with Parent Flow

```
USER: Navigate to /business/uuid-parent
  ↓
EntitySpecificInstancePage shows business detail
  ↓
USER: Click "Add Project" button in child tabs
  ↓
Navigate to: /project/create?parent_code=business&parent_id=uuid-parent
  ↓
EntityCreatePage mounts
  ├─ Extract from URL:
  │   ├─ parent_code = 'business'
  │   └─ parent_id = 'uuid-parent'
  │
  └─ useEntityInstanceMetadata('project', 'entityInstanceFormContainer')
      └─ Returns: { editType } (only need edit metadata for creation)
  ↓
Page renders empty form
  ↓
USER: Fill form:
  ├─ name: "Office Renovation"
  ├─ code: "PROJ-2025-001"
  ├─ manager__employee_id: "uuid-james"
  └─ budget_allocated_amt: 50000
  ↓
USER: Click "Save"
  ↓
handleSubmit(formData)
  └─ createEntity(formData, { parent_code: 'business', parent_id: 'uuid-parent' })
      ├─ API CALL:
      │   POST /api/v1/project?parent_code=business&parent_id=uuid-parent
      │
      │   Backend (transactional):
      │   ├─ RBAC check: Can user CREATE projects?
      │   ├─ RBAC check: Can user EDIT parent business?
      │   ├─ BEGIN transaction:
      │   │   ├─ INSERT INTO app.project (new project)
      │   │   ├─ INSERT INTO entity_instance (registry)
      │   │   ├─ INSERT INTO entity_rbac (OWNER for creator)
      │   │   └─ INSERT INTO entity_instance_link (business → project)
      │   └─ COMMIT
      │
      │   Returns: { id: 'uuid-new', name: 'Office Renovation', ... }
      │
      └─ SUCCESS:
          ├─ Store in cache: ['entity-instance', 'project', 'uuid-new']
          ├─ Invalidate: ['entity-list', 'project']
          ├─ Invalidate: ['entity-list', 'business', 'uuid-parent', 'project']
          └─ Navigate to: /project/uuid-new
  ↓
EntitySpecificInstancePage shows new project ✅
  ↓
USER: Navigate back to /business/uuid-parent
  ↓
Business detail page shows new project in "Projects" tab ✅
```

### 10.4 Table Inline Edit → Dropdown Selection Flow

```
USER: Navigate to /project
  ↓
EntityListOfInstancesPage renders table
  ↓
USER: Click cell "Project Stage" for row "Kitchen Renovation"
  ↓
EntityListOfInstancesTable
  ├─ setEditingCell({ rowId: 'uuid-123', columnKey: 'dl__project_stage' })
  └─ Re-render cell in EDIT mode
      └─ FieldRenderer
          ├─ field.inputType = 'BadgeDropdownSelect'
          └─ Renders: <BadgeDropdownSelectEdit />
              └─ Wraps: <BadgeDropdownSelect
                  value="planning"
                  field={{ lookupField: 'dl__project_stage' }}
                  onChange={...}
                />
                  ├─ useDatalabel('dl__project_stage')
                  │   └─ Returns: [{ code: 'planning', label: 'Planning' }, ...]
                  └─ Renders dropdown button
  ↓
USER: Click dropdown button
  ↓
BadgeDropdownSelect
  ├─ setIsOpen(true)
  └─ createPortal(
      <div data-dropdown-portal ref={dropdownRef}>
        <div onClick={() => selectOption('in_progress')}>In Progress</div>
        <div onClick={() => selectOption('completed')}>Completed</div>
      </div>,
      document.body
    )
  ↓
USER: Click "In Progress" option
  ↓
BadgeDropdownSelect.selectOption('in_progress')
  ├─ Event: mousedown
  │   ├─ EntityListOfInstancesTable.handleClickOutside() executes:
  │   │   ├─ Check: editingCellRef.contains(target)? NO
  │   │   ├─ Check: target.closest('[data-dropdown-portal]')? YES ✅
  │   │   └─ RETURN EARLY (does not save)
  │   │
  │   └─ BadgeDropdownSelect.handleClickOutside() executes:
  │       ├─ Check: dropdownRef.contains(target)? YES ✅
  │       └─ RETURN EARLY (does not close)
  │
  └─ Event: click
      └─ selectOption() executes:
          ├─ setLocalValue('in_progress')
          ├─ onChange('in_progress')
          │   └─ EntityListOfInstancesTable updates editedData
          ├─ setIsOpen(false)
          └─ Auto-trigger save:
              └─ onCellSave('uuid-123', 'dl__project_stage', 'in_progress', record)
                  ↓
                  EntityListOfInstancesPage.handleCellSave()
                  └─ updateEntity('uuid-123', { dl__project_stage: 'in_progress' })
                      ├─ OPTIMISTIC UPDATE:
                      │   └─ Badge changes to "In Progress" instantly ✅
                      │
                      └─ API CALL:
                          └─ PATCH /api/v1/project/uuid-123
```

**Key Difference from Form Inline Edit**:
- Table: Dropdown selection triggers IMMEDIATE save
- Form: Dropdown selection updates state, save on click-outside

### 10.5 Multi-Tab Sync Flow

```
USER has TWO browser tabs open:
  - Tab A: /project (list page)
  - Tab B: /project/uuid-123 (detail page)
  ↓
TAB A: User clicks cell "Budget Allocated" for project uuid-123
  ↓
TAB A: User types "75000" + clicks outside
  ↓
TAB A: EntityListOfInstancesPage.handleCellSave()
  └─ updateEntity('uuid-123', { budget_allocated_amt: 75000 })
      ├─ OPTIMISTIC UPDATE:
      │   ├─ Update TanStack Query cache in TAB A
      │   ├─ Update Dexie: pmoDb.entityInstance.put(...)
      │   └─ TAB A shows "$75,000.00" ✅
      │
      └─ Dexie fires storage event
          ↓
          TAB B: Dexie listener receives event
          ↓
          TAB B: DexieMultiTabSync.handleChange()
          └─ queryClient.invalidateQueries(['entity-instance', 'project', 'uuid-123'])
              ↓
              TAB B: Background refetch executes
              ├─ GET /api/v1/project/uuid-123
              ├─ Update TanStack Query cache in TAB B
              ├─ Update Dexie (confirm sync)
              └─ TAB B re-renders ✅
  ↓
TAB B now shows "$75,000.00" WITHOUT user action!
  ↓
TAB A: API call completes (SUCCESS)
  ├─ invalidateQueries(['entity-instance', 'project', 'uuid-123'])
  ├─ invalidateQueries(['entity-list', 'project'])
  └─ Background refetch ensures server truth
  ↓
BOTH tabs now have latest data from server ✅
```

---

**End of Frontend Component Architecture Document**
