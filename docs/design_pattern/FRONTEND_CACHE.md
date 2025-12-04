# Component Architecture & Cache Lifecycle Integration

**Version**: 1.0.0
**Date**: 2025-12-04
**Purpose**: Comprehensive guide to how components integrate with TanStack Query + Dexie cache lifecycle

---

## Table of Contents

1. [Component Hierarchy Overview](#component-hierarchy-overview)
2. [Page-Level Components](#page-level-components)
3. [Container Components](#container-components)
4. [Presentation Components](#presentation-components)
5. [Cache Lifecycle by Component](#cache-lifecycle-by-component)
6. [Data Flow Patterns](#data-flow-patterns)
7. [Component State Management](#component-state-management)
8. [Real-World Component Examples](#real-world-component-examples)

---

## Component Hierarchy Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                    Component Architecture Layers                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Layer 1: PAGES (Route-Driven, Cache Orchestrators)                │
│  ────────────────────────────────────────────────                  │
│  • EntityListOfInstancesPage        → List view                    │
│  • EntitySpecificInstancePage        → Detail view                 │
│  • EntityCreatePage                  → Create form                 │
│  • EntityChildListPage               → Filtered child list         │
│  • SettingsOverviewPage              → Datalabel management        │
│                                                                     │
│  Role: Orchestrate multiple cache queries, manage page-level state │
│  Cache Access: Direct hooks (useEntityInstanceMetadata,            │
│                useFormattedEntityList, useEntity)                  │
│                                                                     │
│  ↓ Pass data + metadata + callbacks                                │
│                                                                     │
│  Layer 2: CONTAINERS (State Managers, Event Coordinators)          │
│  ──────────────────────────────────────────────────────            │
│  • EntityListOfInstancesTable        → Table + inline edit         │
│  • EntityInstanceFormContainer       → Form + inline edit          │
│  • DynamicChildEntityTabs            → Tab navigation              │
│  • KanbanBoard                       → Kanban view                 │
│  • CalendarView                      → Calendar view               │
│                                                                     │
│  Role: Manage local UI state (editing, sorting, filtering),        │
│        coordinate user interactions, delegate to renderers         │
│  Cache Access: Receive pre-fetched data from pages, may use        │
│                useDatalabel for dropdown options                   │
│                                                                     │
│  ↓ Iterate over data, render fields                                │
│                                                                     │
│  Layer 3: FIELD RENDERER (Component Resolver)                      │
│  ──────────────────────────────────────────                        │
│  • FieldRenderer                     → Central rendering hub       │
│                                                                     │
│  Role: Resolve view/edit components based on metadata,             │
│        route onChange events, apply formatting                     │
│  Cache Access: Receives formattedData from parent                  │
│                                                                     │
│  ↓ Resolve component from registry                                 │
│                                                                     │
│  Layer 4: PRESENTATION COMPONENTS (Pure Renderers)                 │
│  ───────────────────────────────────────────────────               │
│  VIEW COMPONENTS:                                                  │
│  • BadgeDisplay                      → Colored badge               │
│  • EntityInstanceDisplay             → Resolved name               │
│  • CurrencyDisplay                   → $50,000.00                  │
│  • DateDisplay                       → Dec 4, 2025                 │
│                                                                     │
│  EDIT COMPONENTS:                                                  │
│  • BadgeDropdownSelect               → Portal dropdown             │
│  • EntityInstanceNameSelect          → Entity reference dropdown   │
│  • CurrencyInputEdit                 → Currency input              │
│  • DatePickerEdit                    → Date picker                 │
│                                                                     │
│  Role: Render UI elements, handle user input, fire onChange        │
│  Cache Access: useDatalabel (BadgeDropdownSelect),                 │
│                useEntityList (EntityInstanceNameSelect)            │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Page-Level Components

Pages are **cache orchestrators** - they fetch multiple pieces of data in parallel and coordinate the cache lifecycle.

### EntityListOfInstancesPage

**File**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

**Purpose**: Universal list view for all entity types (projects, tasks, employees, etc.)

**Cache Lifecycle Integration**:

```typescript
const EntityListOfInstancesPage: React.FC = () => {
  const { entityCode } = useParams<{ entityCode: string }>();

  // ═══════════════════════════════════════════════════════════════════
  // CACHE QUERY 1: METADATA FETCH
  // ═══════════════════════════════════════════════════════════════════
  // TanStack Query Key: ['entity-metadata', 'project', 'entityListOfInstancesTable']
  // Cache Config: staleTime 30min, gcTime 60min
  // Dexie Table: entityInstanceMetadata
  const {
    viewType: tableViewType,
    editType: tableEditType,
    isLoading: metadataLoading,
  } = useEntityInstanceMetadata(entityCode, 'entityListOfInstancesTable');

  // Cache Flow:
  // 1. Check TanStack Query in-memory cache
  //    - If FRESH (< 30min) → Return immediately
  //    - If STALE (> 30min) → Return stale data + background refetch
  //    - If MISS → Show loading, fetch from API
  //
  // 2. API: GET /api/v1/project?content=metadata
  //    - Backend returns { metadata } only (no data query!)
  //    - Response size: ~5KB
  //
  // 3. Store in TWO places:
  //    - TanStack Query: queryClient.setQueryData(['entity-metadata', ...], data)
  //    - Dexie: pmoDb.entityInstanceMetadata.put({ entityCode, metadataType, ...data })
  //
  // 4. Component re-renders with metadata

  // ═══════════════════════════════════════════════════════════════════
  // EARLY RETURN: Metadata Loading Guard
  // ═══════════════════════════════════════════════════════════════════
  // CRITICAL: Check for undefined (nullable types pattern v1.1.0)
  const tableMetadata = useMemo(() => {
    if (!tableViewType) {
      console.log('[EntityListOfInstancesPage] Metadata still loading');
      return null;
    }
    return { viewType: tableViewType, editType: tableEditType };
  }, [tableViewType, tableEditType]);

  if (!tableMetadata) {
    return <LoadingSpinner />;  // Blocks entire page until metadata available
  }

  // ═══════════════════════════════════════════════════════════════════
  // CACHE QUERY 2: DATA FETCH (Format-at-Read)
  // ═══════════════════════════════════════════════════════════════════
  // TanStack Query Key: ['entity-list', 'project', { limit: 50, offset: 0 }]
  // Cache Config: staleTime 2min, gcTime 10min
  // Dexie Table: entityInstanceData
  const [params, setParams] = useState({ limit: 50, offset: 0 });

  const { data: formattedData, isLoading, isFetching } = useFormattedEntityList(
    entityCode,
    params
  );

  // Cache Flow:
  // 1. Check TanStack Query cache
  //    - If FRESH (< 2min) → Format-at-read (select) → Return
  //    - If STALE (> 2min) → Format-at-read stale data + background refetch
  //    - If MISS → Show loading, fetch from API
  //
  // 2. API: GET /api/v1/project?limit=50&offset=0
  //    - Backend: RBAC filter + SQL query + generateEntityResponse()
  //    - Response: { data: [...], ref_data_entityInstance: {...}, metadata: {...} }
  //    - Response size: ~50KB for 50 rows
  //
  // 3. Store RAW data in cache:
  //    - TanStack Query: queryClient.setQueryData(['entity-list', ...], rawData)
  //    - Dexie: pmoDb.entityInstanceData.put({ entityCode, params, data: rawData })
  //
  // 4. Format-at-read (select function):
  //    - useFormattedEntityData(rawData, tableMetadata, entityCode)
  //    - Subscribes to datalabel cache (reactive!)
  //    - For each row:
  //        dl__project_stage: 'planning' → { display: 'Planning', styles: 'bg-blue-100' }
  //        budget_allocated_amt: 50000 → { display: '$50,000.00' }
  //    - Output: { raw, display, styles }[]
  //
  // 5. Component receives formatted data

  // ═══════════════════════════════════════════════════════════════════
  // MUTATION HANDLERS (Optimistic Updates)
  // ═══════════════════════════════════════════════════════════════════
  const { optimisticUpdateEntity } = useEntityMutation(entityCode);

  const handleCellSave = useCallback(async (
    rowId: string,
    columnKey: string,
    value: any,
    record: any
  ) => {
    console.log('[EntityListOfInstancesPage] handleCellSave:', { rowId, columnKey, value });

    // Transform for API (handle datalabel fields, etc.)
    const changeData = { [columnKey]: value };
    const transformedData = transformForApi(changeData, record.raw || record);

    // Optimistic update flow:
    // 1. INSTANT: Update TanStack Query cache
    //    queryClient.setQueryData(['entity-instance', entityCode, rowId], newData)
    //
    // 2. INSTANT: Update Dexie
    //    pmoDb.entityInstance.put({ entityCode, entityId: rowId, data: newData })
    //
    // 3. INSTANT: Component re-renders with new value (via cache update)
    //
    // 4. BACKGROUND: API call
    //    await api.patch(`/api/v1/${entityCode}/${rowId}`, transformedData)
    //
    // 5. SUCCESS:
    //    - Invalidate queries → background refetch → cache updated with server truth
    //    - Show success toast
    //
    // 6. ERROR:
    //    - Rollback cache to old value
    //    - Component re-renders with old value
    //    - Show error toast
    await optimisticUpdateEntity(rowId, transformedData);
  }, [entityCode, optimisticUpdateEntity]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER CONTAINER (Pass Data + Metadata + Callbacks)
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="page-container">
      <PageHeader title={entityConfig[entityCode]?.labelPlural || entityCode} />

      {/* Loading State: Show stale data with spinner */}
      {isFetching && !isLoading && <SmallSpinner />}

      {/* First Load: Show skeleton */}
      {isLoading && <SkeletonTable />}

      {/* Data Loaded: Render table */}
      {!isLoading && (
        <EntityListOfInstancesTable
          data={formattedData}              // { raw, display, styles }[]
          metadata={tableMetadata}          // { viewType, editType }
          entityCode={entityCode}
          onCellSave={handleCellSave}       // Optimistic update handler
          onRowClick={(row) => navigate(`/${entityCode}/${row.raw.id}`)}
        />
      )}
    </div>
  );
};
```

**Cache Dependencies**:

```typescript
// What this page depends on in cache:
[
  ['entity-metadata', 'project', 'entityListOfInstancesTable'],  // Field metadata
  ['entity-list', 'project', { limit: 50, offset: 0 }],         // List data
  ['datalabel', 'dl__project_stage'],                           // Badge options (indirect)
  ['entity-codes'],                                              // Entity types (indirect)
]

// Cache invalidation triggers re-render:
queryClient.invalidateQueries(['entity-list', 'project']);
// → Background refetch
// → formattedData updates
// → Table re-renders
```

**Cache Lifecycle Events**:

```
MOUNT:
  ↓
Check cache for metadata
  ├─ HIT → Render immediately
  └─ MISS → Fetch → Store → Render
  ↓
Check cache for data
  ├─ HIT → Format-at-read → Render
  └─ MISS → Fetch → Store → Format → Render
  ↓
RENDERED (user sees table)
  ↓
User edits cell → handleCellSave()
  ↓
Optimistic update (cache + Dexie)
  ↓
Table re-renders instantly
  ↓
Background API call
  ↓
SUCCESS → Invalidate → Refetch → Cache updated
  ↓
UNMOUNT:
  ↓
Cache remains in memory (gcTime: 10min)
Cache persists in Dexie (survives browser restart)
```

---

### EntitySpecificInstancePage

**File**: `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

**Purpose**: Universal detail view for single entity instance with child tabs

**Cache Lifecycle Integration**:

```typescript
const EntitySpecificInstancePage: React.FC = () => {
  const { entityCode, id } = useParams<{ entityCode: string; id: string }>();

  // ═══════════════════════════════════════════════════════════════════
  // CACHE QUERY 1: METADATA FETCH (Form View)
  // ═══════════════════════════════════════════════════════════════════
  // Different metadataType than list page!
  const {
    viewType: formViewType,
    editType: formEditType,
    isLoading: metadataLoading,
  } = useEntityInstanceMetadata(entityCode, 'entityInstanceFormContainer');

  // TanStack Query Key: ['entity-metadata', 'project', 'entityInstanceFormContainer']
  // This is SEPARATE from table metadata - different field order, labels, etc.

  const formMetadata = useMemo(() => {
    if (!formViewType) return null;
    return { viewType: formViewType, editType: formEditType };
  }, [formViewType, formEditType]);

  if (!formMetadata) {
    return <LoadingSpinner />;
  }

  // ═══════════════════════════════════════════════════════════════════
  // CACHE QUERY 2: INSTANCE DATA FETCH
  // ═══════════════════════════════════════════════════════════════════
  // TanStack Query Key: ['entity-instance', 'project', 'uuid-123']
  // Cache Config: staleTime 5min, gcTime 30min
  // Dexie Table: entityInstance
  const { data: entity, isLoading, isFetching } = useEntity(entityCode, id);

  // Cache Flow:
  // 1. Check TanStack Query cache
  //    - If FRESH (< 5min) → Return immediately
  //    - If STALE (> 5min) → Return stale + background refetch
  //    - If MISS → Fetch from API
  //
  // 2. API: GET /api/v1/project/{id}
  //    - RBAC check (Permission.VIEW)
  //    - SQL query with joins
  //    - build_ref_data_entityInstance()
  //    - generateEntityResponse()
  //
  // 3. Store in cache:
  //    - TanStack Query: ['entity-instance', 'project', 'uuid-123']
  //    - Dexie: pmoDb.entityInstance.put({ entityCode, entityId, data })
  //
  // 4. Component re-renders with entity data

  // ═══════════════════════════════════════════════════════════════════
  // CACHE QUERY 3: CHILD ENTITY CODES (For Tabs)
  // ═══════════════════════════════════════════════════════════════════
  // TanStack Query Key: ['entity-codes']
  // Cache Config: staleTime 30min, gcTime 60min
  const { getEntityByCode } = useEntityCodes();

  const entityMeta = getEntityByCode(entityCode);
  const childEntityCodes = entityMeta?.child_entity_codes || [];

  // Used by DynamicChildEntityTabs to know which tabs to render
  // Example: ['task', 'cost', 'attachment']

  // ═══════════════════════════════════════════════════════════════════
  // MUTATION HANDLER (Inline Edit)
  // ═══════════════════════════════════════════════════════════════════
  const { optimisticUpdateEntity } = useEntityMutation(entityCode);

  const handleInlineSave = useCallback(async (fieldKey: string, value: any) => {
    console.log('[EntitySpecificInstancePage] handleInlineSave:', { fieldKey, value });

    // Optimistic update (same flow as list page)
    await optimisticUpdateEntity(id, { [fieldKey]: value });

    // Cache update flow:
    // 1. Update ['entity-instance', entityCode, id]
    // 2. EntityInstanceFormContainer re-renders with new value
    // 3. Background API call
    // 4. Success → Invalidate → Refetch → Confirm update
    // 5. Error → Rollback → Form shows old value + error toast
  }, [id, optimisticUpdateEntity, entityCode]);

  // ═══════════════════════════════════════════════════════════════════
  // WEBSOCKET SUBSCRIPTION (Real-Time Updates)
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Subscribe to changes for this specific instance
    const ws = WebSocketManager.getInstance();
    ws.subscribe(entityCode, id);

    // When other users edit this entity:
    // 1. WebSocket INVALIDATE message received
    // 2. queryClient.invalidateQueries(['entity-instance', entityCode, id])
    // 3. Background refetch
    // 4. Cache updated
    // 5. Component re-renders with new data
    // 6. User sees update without page refresh!

    return () => {
      ws.unsubscribe(entityCode, id);
    };
  }, [entityCode, id]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER FORM + CHILD TABS
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="page-container">
      <PageHeader
        title={entity?.name || 'Loading...'}
        breadcrumbs={[
          { label: entityConfig[entityCode]?.labelPlural, path: `/${entityCode}` },
          { label: entity?.name || id }
        ]}
      />

      {isLoading && <SkeletonForm />}

      {!isLoading && entity && (
        <>
          {/* Form Container */}
          <EntityInstanceFormContainer
            formData={entity}                // Raw entity data
            metadata={formMetadata}          // { viewType, editType }
            mode="view"                      // View mode (long-press to edit)
            onInlineSave={handleInlineSave}  // Inline edit handler
          />

          {/* Child Entity Tabs */}
          <DynamicChildEntityTabs
            parentEntityCode={entityCode}
            parentEntityId={id}
            childEntityCodes={childEntityCodes}  // ['task', 'cost', 'attachment']
          />
        </>
      )}
    </div>
  );
};
```

**Cache Dependencies**:

```typescript
// Multiple cache queries in parallel:
[
  ['entity-metadata', 'project', 'entityInstanceFormContainer'],  // Form metadata
  ['entity-instance', 'project', 'uuid-123'],                     // Entity data
  ['entity-codes'],                                                // For child tabs
  ['datalabel', 'dl__project_stage'],                             // For badge fields
  ['entity-list', 'employee'],                                     // For manager dropdown
]

// Cache invalidation chain:
queryClient.invalidateQueries(['entity-instance', 'project', 'uuid-123']);
// → Refetch entity data
// → Form re-renders with new values
// → Child tabs may also refetch if invalidated
```

**Cache Lifecycle Events**:

```
MOUNT:
  ↓
Parallel fetch: metadata + entity data + entity codes
  ↓
All three cache hits/misses resolved
  ↓
RENDERED (user sees form + tabs)
  ↓
User long-presses field → Enter inline edit
  ↓
User selects dropdown option → handleInlineSave()
  ↓
Optimistic update → Cache updated instantly
  ↓
Form re-renders with new value (instant feedback)
  ↓
Background API call
  ↓
SUCCESS → Invalidate → Refetch
  ↓
WebSocket broadcast to other users
  ↓
Other users' caches invalidate → They see update too
  ↓
UNMOUNT:
  ↓
WebSocket unsubscribe
  ↓
Cache remains in memory + Dexie
```

---

## Container Components

Containers manage **local UI state** and **coordinate interactions** between presentation components. They receive pre-fetched data from pages but may fetch their own dropdown options.

### EntityListOfInstancesTable

**File**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

**Purpose**: Data table with sorting, filtering, pagination, inline cell editing

**Cache Lifecycle Integration**:

```typescript
interface EntityListOfInstancesTableProps {
  data: FormattedRow[];           // Pre-fetched by parent page
  metadata: {
    viewType: Record<string, FieldMetadata>;
    editType: Record<string, FieldMetadata>;
  };
  entityCode: string;
  onCellSave: (rowId: string, columnKey: string, value: any, record: any) => void;
}

const EntityListOfInstancesTable: React.FC<EntityListOfInstancesTableProps> = ({
  data,
  metadata,
  entityCode,
  onCellSave
}) => {
  // ═══════════════════════════════════════════════════════════════════
  // LOCAL STATE (Not in Cache)
  // ═══════════════════════════════════════════════════════════════════
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    columnKey: string;
  } | null>(null);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [sortConfig, setSortConfig] = useState({ field: 'created_ts', order: 'desc' });
  const [filters, setFilters] = useState<Record<string, any>>({});

  // These are UI-only state - NOT persisted in cache
  // When component unmounts, this state is lost (intentional)

  // ═══════════════════════════════════════════════════════════════════
  // CACHE ACCESS: Datalabel Options (for Dropdowns)
  // ═══════════════════════════════════════════════════════════════════
  // When user enters edit mode on a badge field, we need dropdown options
  const fieldKey = editingCell?.columnKey;
  const fieldMeta = fieldKey ? metadata.editType[fieldKey] : null;

  const shouldFetchOptions = (
    editingCell &&
    fieldMeta?.inputType === 'BadgeDropdownSelect' &&
    fieldMeta?.lookupField
  );

  // Conditional cache query (only when editing badge field)
  const { data: datalabelOptions } = useDatalabel(
    fieldMeta?.lookupField || '',
    { enabled: shouldFetchOptions }
  );

  // Cache Flow:
  // 1. User clicks cell with dl__project_stage
  // 2. setEditingCell({ rowId, columnKey: 'dl__project_stage' })
  // 3. Component re-renders
  // 4. shouldFetchOptions = true
  // 5. useDatalabel('dl__project_stage', { enabled: true }) executes
  // 6. Check cache:
  //    - HIT → Return options immediately
  //    - MISS → Fetch from API → Store in cache
  // 7. BadgeDropdownSelect receives options
  // 8. Dropdown renders with colored badges

  // ═══════════════════════════════════════════════════════════════════
  // CELL EDIT HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  const handleCellEdit = (rowIndex: number, columnKey: string, value: any) => {
    console.log('[EntityListOfInstancesTable] handleCellEdit:', { rowIndex, columnKey, value });

    // Update local edited data state
    setEditedData(prev => ({ ...prev, [columnKey]: value }));
  };

  const handleCellSave = (rowId: string, columnKey: string, record: any) => {
    console.log('[EntityListOfInstancesTable] handleCellSave:', { rowId, columnKey });

    // Get edited value from local state
    const value = editedData[columnKey];

    // Call parent's onCellSave (which triggers optimistic update)
    // Parent (EntityListOfInstancesPage) handles cache updates
    onCellSave(rowId, columnKey, value, record);

    // Clear local state
    setEditingCell(null);
    setEditedData({});

    // Component re-renders with new data from cache (via parent)
  };

  // ═══════════════════════════════════════════════════════════════════
  // PORTAL-AWARE CLICK-OUTSIDE HANDLER
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!editingCell) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check 1: Inside editing cell?
      if (editingCellRef.current?.contains(target)) return;

      // Check 2: Inside ANY portal dropdown? (CRITICAL!)
      if (target.closest('[data-dropdown-portal]')) {
        console.log('[EntityListOfInstancesTable] Click inside portal, ignoring');
        return;
      }

      // Truly outside - save and close
      const record = data.find(r => r.raw.id === editingCell.rowId);
      if (record) {
        handleCellSave(editingCell.rowId, editingCell.columnKey, record);
      }
    };

    // Use mousedown (fires BEFORE click)
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCell, data]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER TABLE ROWS
  // ═══════════════════════════════════════════════════════════════════
  return (
    <table className="entity-table">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key} onClick={() => handleSort(col.key)}>
              {col.label}
              {sortConfig.field === col.key && (
                <span>{sortConfig.order === 'asc' ? '↑' : '↓'}</span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={row.raw.id}>
            {columns.map(col => {
              const fieldMeta = metadata.viewType[col.key];
              const isEditing = (
                editingCell?.rowId === row.raw.id &&
                editingCell?.columnKey === col.key
              );

              return (
                <td
                  key={col.key}
                  onClick={() => {
                    // Enter edit mode on click
                    setEditingCell({ rowId: row.raw.id, columnKey: col.key });
                  }}
                >
                  {/* FieldRenderer delegates to view/edit components */}
                  <FieldRenderer
                    field={fieldMeta}
                    value={isEditing ? editedData[col.key] : row.raw[col.key]}
                    isEditing={isEditing}
                    onChange={(value) => handleCellEdit(rowIndex, col.key, value)}
                    formattedData={{
                      display: row.display,
                      styles: row.styles
                    }}
                    options={
                      isEditing && fieldMeta.inputType === 'BadgeDropdownSelect'
                        ? datalabelOptions
                        : undefined
                    }
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

**Cache Dependencies**:

```typescript
// Receives from parent:
data: FormattedRow[]  // Already fetched + formatted by parent page

// May fetch conditionally:
['datalabel', 'dl__project_stage']  // Only when editing badge cell

// Does NOT fetch:
- Entity instance data (parent provides)
- Metadata (parent provides)
```

**Cache Lifecycle Events**:

```
MOUNT:
  ↓
Receives data from parent (already cached)
  ↓
RENDERED (table displays)
  ↓
User clicks cell → Enter edit mode
  ↓
If badge field:
  ├─ useDatalabel enabled → Check cache
  ├─ HIT → Dropdown renders immediately
  └─ MISS → Fetch → Store → Dropdown renders
  ↓
User selects option → handleCellEdit (local state)
  ↓
User clicks outside → handleCellSave
  ↓
Call parent's onCellSave → Optimistic update
  ↓
Parent's cache updated → data prop changes
  ↓
Table re-renders with new data
  ↓
UNMOUNT:
  ↓
Local state (editingCell, editedData) lost
  ↓
Datalabel cache persists for next edit
```

---

### EntityInstanceFormContainer

**File**: `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`

**Purpose**: Universal form renderer with inline field editing (long-press 500ms)

**Cache Lifecycle Integration**:

```typescript
interface EntityInstanceFormContainerProps {
  formData: Record<string, any>;  // Pre-fetched entity data
  metadata: {
    viewType: Record<string, FieldMetadata>;
    editType: Record<string, FieldMetadata>;
  };
  mode: 'view' | 'edit' | 'create';
  onInlineSave?: (fieldKey: string, value: any) => void;
  onSubmit?: (data: Record<string, any>) => void;
}

const EntityInstanceFormContainer: React.FC<EntityInstanceFormContainerProps> = ({
  formData,
  metadata,
  mode,
  onInlineSave,
  onSubmit
}) => {
  // ═══════════════════════════════════════════════════════════════════
  // LOCAL STATE (Not in Cache)
  // ═══════════════════════════════════════════════════════════════════
  const [inlineEditingField, setInlineEditingField] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState<any>(null);
  const [isFullEditMode, setIsFullEditMode] = useState(mode === 'edit' || mode === 'create');
  const [localFormData, setLocalFormData] = useState(formData);

  // Local state for UI interactions - not persisted

  // ═══════════════════════════════════════════════════════════════════
  // DRAFT PERSISTENCE (Survives Page Refresh!)
  // ═══════════════════════════════════════════════════════════════════
  // TanStack Query Key: ['draft', 'project', 'uuid-123']
  // Dexie Table: draft
  const entityCode = 'project';  // From props or context
  const entityId = formData.id;

  const { currentData, updateField, hasChanges } = useDraft(entityCode, entityId);

  // Cache Flow:
  // 1. User edits field in full edit mode
  // 2. setLocalFormData(newData)
  // 3. updateField(fieldKey, value) called
  // 4. Store in Dexie: pmoDb.draft.put({ entityCode, entityId, data: { [fieldKey]: value } })
  // 5. User refreshes page
  // 6. useDraft reads from Dexie
  // 7. currentData = { [fieldKey]: value }
  // 8. Form shows unsaved changes!
  // 9. User clicks "Discard" → Clear draft from Dexie
  // 10. User clicks "Save" → Submit → Clear draft

  // ═══════════════════════════════════════════════════════════════════
  // INLINE EDIT: LONG-PRESS HANDLER
  // ═══════════════════════════════════════════════════════════════════
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLongPressStart = (fieldKey: string, currentValue: any) => {
    console.log('[EntityInstanceFormContainer] Long-press started:', fieldKey);

    longPressTimer.current = setTimeout(() => {
      console.log('[EntityInstanceFormContainer] Long-press activated (500ms)');
      enterInlineEditMode(fieldKey, currentValue);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const enterInlineEditMode = (fieldKey: string, currentValue: any) => {
    setInlineEditingField(fieldKey);
    setInlineEditValue(currentValue);
    console.log('[EntityInstanceFormContainer] Entered inline edit mode:', { fieldKey, currentValue });
  };

  // ═══════════════════════════════════════════════════════════════════
  // INLINE EDIT: VALUE CHANGE HANDLER
  // ═══════════════════════════════════════════════════════════════════
  const handleInlineValueChange = (value: any) => {
    console.log('[EntityInstanceFormContainer] Inline value changed:', value);
    setInlineEditValue(value);
    // Value stored in local state, not yet saved to cache
  };

  // ═══════════════════════════════════════════════════════════════════
  // INLINE EDIT: SAVE HANDLER
  // ═══════════════════════════════════════════════════════════════════
  const handleInlineSave = useCallback(() => {
    if (!inlineEditingField) return;

    const oldValue = formData[inlineEditingField];
    const newValue = inlineEditValue;

    console.log('[EntityInstanceFormContainer] handleInlineSave:', {
      field: inlineEditingField,
      oldValue,
      newValue
    });

    // Check if value actually changed
    if (newValue === oldValue) {
      console.log('[EntityInstanceFormContainer] No change, skipping save');
      setInlineEditingField(null);
      setInlineEditValue(null);
      return;
    }

    // Call parent's onInlineSave (which triggers optimistic update)
    if (onInlineSave) {
      onInlineSave(inlineEditingField, newValue);
    }

    // Clear inline edit state
    setInlineEditingField(null);
    setInlineEditValue(null);

    // Parent updates cache → formData prop changes → Form re-renders
  }, [inlineEditingField, inlineEditValue, formData, onInlineSave]);

  // ═══════════════════════════════════════════════════════════════════
  // PORTAL-AWARE CLICK-OUTSIDE HANDLER
  // ═══════════════════════════════════════════════════════════════════
  const editingFieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!inlineEditingField) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check 1: Inside editing field container?
      if (editingFieldRef.current?.contains(target)) {
        return;
      }

      // Check 2: Inside ANY portal dropdown? (CRITICAL FIX!)
      const isClickInsideDropdown = (target as Element).closest?.('[data-dropdown-portal]');
      if (isClickInsideDropdown) {
        console.log('[EntityInstanceFormContainer] Click inside portal, ignoring');
        return;
      }

      // Truly outside - save and close
      console.log('[EntityInstanceFormContainer] Click outside, triggering save');
      handleInlineSave();
    };

    // Delay to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inlineEditingField, handleInlineSave]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER FIELDS
  // ═══════════════════════════════════════════════════════════════════
  return (
    <form onSubmit={handleSubmit} className="entity-form">
      {Object.entries(metadata.viewType).map(([fieldKey, fieldMeta]) => {
        const isInlineEditing = inlineEditingField === fieldKey;
        const isFieldEditable = !isFullEditMode;  // Inline edit only in view mode
        const currentValue = isInlineEditing
          ? inlineEditValue
          : (currentData?.[fieldKey] ?? formData[fieldKey]);

        return (
          <div
            key={fieldKey}
            ref={isInlineEditing ? editingFieldRef : null}
            className="field-container"
            onMouseDown={() => {
              if (isFieldEditable) {
                handleLongPressStart(fieldKey, currentValue);
              }
            }}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
          >
            <label>{fieldMeta.label}</label>

            {/* FieldRenderer handles view/edit mode switching */}
            <FieldRenderer
              field={fieldMeta}
              value={currentValue}
              isEditing={isInlineEditing || isFullEditMode}
              onChange={(value) => {
                if (isInlineEditing) {
                  handleInlineValueChange(value);
                } else if (isFullEditMode) {
                  handleFullEditChange(fieldKey, value);
                }
              }}
              formattedData={{
                display: formData._display || {},
                styles: formData._styles || {}
              }}
            />

            {/* Draft indicator */}
            {currentData?.[fieldKey] && (
              <span className="draft-indicator">Unsaved changes</span>
            )}
          </div>
        );
      })}

      {/* Full edit mode: Show save/cancel buttons */}
      {isFullEditMode && (
        <div className="form-actions">
          <button type="submit">Save</button>
          <button type="button" onClick={handleCancel}>Cancel</button>
          {hasChanges && (
            <button type="button" onClick={clearDraft}>Discard Draft</button>
          )}
        </div>
      )}
    </form>
  );
};
```

**Cache Dependencies**:

```typescript
// Receives from parent:
formData: Record<string, any>  // Already fetched entity data
metadata: { viewType, editType }  // Already fetched metadata

// Manages in cache:
['draft', 'project', 'uuid-123']  // Draft persistence (Dexie)

// May trigger parent to update:
onInlineSave() → Parent calls optimisticUpdateEntity()
  → Updates ['entity-instance', 'project', 'uuid-123']
```

**Cache Lifecycle Events**:

```
MOUNT:
  ↓
Receive formData from parent (cached)
  ↓
Check draft cache:
  ├─ HIT → Merge with formData → Show "Unsaved changes"
  └─ MISS → Use formData as-is
  ↓
RENDERED (form displays)
  ↓
User long-presses field (500ms)
  ↓
Enter inline edit mode
  ↓
User selects dropdown option → handleInlineValueChange
  ↓
Value stored in local state (inlineEditValue)
  ↓
User clicks outside → handleInlineSave
  ↓
Call parent's onInlineSave → Optimistic update
  ↓
Parent updates cache:
  ├─ TanStack Query: ['entity-instance', ...]
  └─ Dexie: entityInstance table
  ↓
formData prop changes → Form re-renders
  ↓
Field shows new value instantly
  ↓
UNMOUNT:
  ↓
Local state lost (inlineEditingField, inlineEditValue)
  ↓
Draft persists in Dexie (if full edit mode)
```

---

## Presentation Components

Presentation components are **pure renderers** with minimal cache access. They focus on UI rendering and user input handling.

### BadgeDropdownSelect

**File**: `apps/web/src/components/shared/ui/BadgeDropdownSelect.tsx`

**Purpose**: Colored dropdown for datalabel fields (project stage, priority, status)

**Cache Lifecycle Integration**:

```typescript
interface BadgeDropdownSelectProps {
  field: string;           // 'dl__project_stage'
  value: string;           // 'planning'
  onChange: (value: string) => void;
  disabled?: boolean;
}

const BadgeDropdownSelect: React.FC<BadgeDropdownSelectProps> = ({
  field,
  value,
  onChange,
  disabled
}) => {
  // ═══════════════════════════════════════════════════════════════════
  // CACHE QUERY: Datalabel Options
  // ═══════════════════════════════════════════════════════════════════
  // TanStack Query Key: ['datalabel', 'dl__project_stage']
  // Cache Config: staleTime 10min, gcTime 30min
  // Dexie Table: datalabel
  const { data: options, isLoading } = useDatalabel(field);

  // Cache Flow:
  // 1. Component mounts
  // 2. useDatalabel('dl__project_stage') executes
  // 3. Check cache:
  //    - HIT → Return options immediately
  //    - MISS → Fetch from API
  //
  // 4. API: GET /api/v1/datalabel/dl__project_stage
  //    - Backend queries datalabel_project_stage table
  //    - Returns: [{ code: 'planning', label: 'Planning', badge_color: 'bg-blue-100', ... }]
  //
  // 5. Store in cache:
  //    - TanStack Query: ['datalabel', 'dl__project_stage']
  //    - Dexie: pmoDb.datalabel.bulkPut(options)
  //    - Sync cache: setDatalabelSync('dl__project_stage', options)
  //
  // 6. Component re-renders with options

  // ═══════════════════════════════════════════════════════════════════
  // CACHE QUERY: Global Settings (Badge Colors)
  // ═══════════════════════════════════════════════════════════════════
  // TanStack Query Key: ['global-settings']
  // Cache Config: staleTime 30min, gcTime 60min
  const { settings } = useGlobalSettings();

  // Used to override badge_color from datalabel options
  // Example: User changes "Planning" badge from blue to green in settings
  // settings.badge_colors['planning'] = 'bg-green-100'

  // ═══════════════════════════════════════════════════════════════════
  // LOCAL STATE
  // ═══════════════════════════════════════════════════════════════════
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ═══════════════════════════════════════════════════════════════════
  // REACTIVE FORMATTING (Subscribes to Cache Changes!)
  // ═══════════════════════════════════════════════════════════════════
  const selectedOption = useMemo(() => {
    if (!options) return null;

    const option = options.find(opt => opt.code === value);
    if (!option) return null;

    // Check if badge color overridden in settings
    const badgeColor = settings?.badge_colors?.[value] || option.badge_color;

    return { ...option, badge_color: badgeColor };
  }, [options, value, settings]);

  // REACTIVE: When settings.badge_colors changes:
  // 1. queryClient.invalidateQueries(['global-settings'])
  // 2. Background refetch
  // 3. settings updates
  // 4. useMemo re-executes
  // 5. selectedOption.badge_color changes
  // 6. Component re-renders with new color!
  //
  // This is FORMAT-AT-READ in action!

  // ═══════════════════════════════════════════════════════════════════
  // SELECTION HANDLER
  // ═══════════════════════════════════════════════════════════════════
  const selectOption = (optionValue: string) => {
    console.log('[BadgeDropdownSelect] selectOption:', optionValue);

    // Call parent's onChange
    onChange(optionValue);

    // Parent may trigger optimistic update:
    // - EntityInstanceFormContainer.handleInlineValueChange()
    // - EntityListOfInstancesTable.handleCellEdit()
    // These update local state, NOT cache yet

    // Close dropdown
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  // ═══════════════════════════════════════════════════════════════════
  // PORTAL-AWARE CLICK-OUTSIDE HANDLER
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is inside button OR dropdown
      if (
        (buttonRef.current && buttonRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        return;
      }

      // Outside both - close dropdown
      setIsOpen(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  if (isLoading) return <Spinner />;

  return (
    <div className="badge-dropdown">
      {/* Dropdown button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`badge ${selectedOption?.badge_color || 'bg-gray-100'}`}
      >
        {selectedOption?.label || value}
        <span className="arrow">▼</span>
      </button>

      {/* Portal dropdown menu */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          data-dropdown-portal=""  // CRITICAL for portal detection!
          style={{
            position: 'absolute',
            top: buttonRect.bottom + 4,
            left: buttonRect.left,
            zIndex: 9999
          }}
          className="dropdown-menu"
        >
          {/* Search input */}
          <input
            type="search"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="dropdown-search"
          />

          {/* Options list */}
          {filteredOptions.map((option, index) => {
            const badgeColor = settings?.badge_colors?.[option.code] || option.badge_color;

            return (
              <div
                key={option.code}
                onClick={() => selectOption(option.code)}
                className={`dropdown-option ${index === highlightedIndex ? 'highlighted' : ''}`}
              >
                <span className={`badge ${badgeColor}`}>
                  {option.label}
                </span>
              </div>
            );
          })}
        </div>,
        document.body  // Render at root
      )}
    </div>
  );
};
```

**Cache Dependencies**:

```typescript
// Direct cache access:
['datalabel', 'dl__project_stage']  // Dropdown options
['global-settings']                  // Badge color overrides

// Cache invalidation triggers re-render:
queryClient.invalidateQueries(['datalabel', 'dl__project_stage']);
// → Refetch options
// → Dropdown re-renders with new options

queryClient.invalidateQueries(['global-settings']);
// → Refetch settings
// → Badge colors update
// → All badges re-render with new colors (format-at-read!)
```

**Cache Lifecycle Events**:

```
MOUNT:
  ↓
useDatalabel('dl__project_stage')
  ├─ Check cache
  │   ├─ HIT → Render immediately
  │   └─ MISS → Fetch → Store → Render
  ↓
useGlobalSettings()
  ├─ Check cache (prefetched at login)
  ├─ HIT → Use immediately
  └─ MISS → Fetch → Store
  ↓
RENDERED (button shows current value with color)
  ↓
User clicks button → setIsOpen(true)
  ↓
Portal dropdown renders
  ↓
User clicks option → selectOption()
  ↓
Call parent onChange
  ↓
Parent updates state (local or cache)
  ↓
Parent passes new value prop
  ↓
Component re-renders with new selected option
  ↓
UNMOUNT:
  ↓
Local state lost (isOpen, searchTerm)
  ↓
Datalabel cache persists
```

**Real-Time Color Update Example**:

```
User A (on project detail page):
  ↓
Sees badge: "Planning" (bg-blue-100)
  ↓
User B (on settings page):
  ↓
Changes "Planning" badge color: blue → green
  ↓
PATCH /api/v1/datalabel/dl__project_stage
  ↓
Database trigger → INSERT app.system_logging
  ↓
WebSocket INVALIDATE broadcast
  ↓
User A receives WebSocket message
  ↓
queryClient.invalidateQueries(['global-settings'])
  ↓
Background refetch → settings.badge_colors updated
  ↓
useMemo re-executes (reactive!)
  ↓
selectedOption.badge_color = 'bg-green-100'
  ↓
Badge re-renders with green color ✅
  ↓
User A sees color change without page refresh!
```

---

## Cache Lifecycle by Component

### Summary Table

| Component | Cache Queries | Cache Writes | Cache Invalidations Listened To |
|-----------|---------------|--------------|----------------------------------|
| **EntityListOfInstancesPage** | `entity-metadata`, `entity-list` | None (via mutations) | `entity-list`, `entity-metadata` |
| **EntitySpecificInstancePage** | `entity-metadata`, `entity-instance`, `entity-codes` | None (via mutations) | `entity-instance`, `entity-metadata` |
| **EntityListOfInstancesTable** | `datalabel` (conditional) | None | `datalabel` |
| **EntityInstanceFormContainer** | `draft` | `draft` (on edit) | `entity-instance`, `draft` |
| **BadgeDropdownSelect** | `datalabel`, `global-settings` | None | `datalabel`, `global-settings` |
| **EntityInstanceNameSelect** | `entity-list` | None | `entity-list` |
| **DynamicChildEntityTabs** | `entity-list` (per tab) | None (via mutations) | `entity-list` |

### Cache Flow Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                     Component → Cache Flow                             │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  PAGE MOUNTS (EntitySpecificInstancePage)                             │
│  ──────────────────────────────────────                               │
│  ├─ useEntityInstanceMetadata('project', 'form')                      │
│  │   └─ TanStack Query: ['entity-metadata', 'project', 'form']        │
│  │       ├─ Check in-memory cache                                     │
│  │       └─ Check Dexie: entityInstanceMetadata table                 │
│  │                                                                     │
│  ├─ useEntity('project', 'uuid-123')                                  │
│  │   └─ TanStack Query: ['entity-instance', 'project', 'uuid-123']   │
│  │       ├─ Check in-memory cache                                     │
│  │       └─ Check Dexie: entityInstance table                         │
│  │                                                                     │
│  └─ useEntityCodes()                                                  │
│      └─ TanStack Query: ['entity-codes']                              │
│          ├─ Check in-memory cache                                     │
│          └─ Check Dexie: entityCode table                             │
│                                                                        │
│  ↓                                                                     │
│                                                                        │
│  PAGE RENDERS → Pass to FORM CONTAINER                                │
│  ──────────────────────────────────────────                           │
│  <EntityInstanceFormContainer                                         │
│    formData={entity}          ← From cache                            │
│    metadata={formMetadata}    ← From cache                            │
│    onInlineSave={...}         ← Callback                              │
│  />                                                                    │
│                                                                        │
│  ↓                                                                     │
│                                                                        │
│  FORM RENDERS → Iterate fields                                        │
│  ────────────────────────────                                         │
│  {Object.entries(viewType).map(([key, fieldMeta]) => (                │
│    <FieldRenderer                                                     │
│      field={fieldMeta}                                                │
│      value={formData[key]}                                            │
│      isEditing={inlineEditingField === key}                           │
│      onChange={handleInlineValueChange}                               │
│    />                                                                  │
│  ))}                                                                   │
│                                                                        │
│  ↓                                                                     │
│                                                                        │
│  FIELD RENDERER → Resolve component                                   │
│  ─────────────────────────────────                                    │
│  if (field.inputType === 'BadgeDropdownSelect') {                     │
│    return <BadgeDropdownSelectEdit ... />                             │
│  }                                                                     │
│                                                                        │
│  ↓                                                                     │
│                                                                        │
│  BADGE DROPDOWN MOUNTS                                                │
│  ─────────────────────                                                │
│  ├─ useDatalabel('dl__project_stage')                                 │
│  │   └─ TanStack Query: ['datalabel', 'dl__project_stage']            │
│  │       ├─ Check in-memory cache                                     │
│  │       └─ Check Dexie: datalabel table                              │
│  │                                                                     │
│  └─ useGlobalSettings()                                               │
│      └─ TanStack Query: ['global-settings']                           │
│          ├─ Check in-memory cache                                     │
│          └─ Check Dexie: globalSetting table                          │
│                                                                        │
│  ↓                                                                     │
│                                                                        │
│  BADGE DROPDOWN RENDERS                                               │
│  ───────────────────────                                              │
│  <button className="badge bg-blue-100">Planning ▼</button>            │
│                                                                        │
│  ↓                                                                     │
│                                                                        │
│  USER INTERACTION                                                     │
│  ────────────────                                                     │
│  User clicks button → Portal dropdown opens                           │
│  User clicks "In Progress" → selectOption('in_progress')              │
│  ├─ onChange('in_progress') ← Call parent                             │
│  │                                                                     │
│  │   FieldRenderer.onChange() ← Route to parent                       │
│  │   ├─ EntityInstanceFormContainer.handleInlineValueChange()         │
│  │   │   └─ setInlineEditValue('in_progress')  // Local state         │
│  │   └─ User clicks outside → handleInlineSave()                      │
│  │       └─ onInlineSave('dl__project_stage', 'in_progress')          │
│  │           └─ EntitySpecificInstancePage.handleInlineSave()         │
│  │               └─ optimisticUpdateEntity(id, { dl__project_stage })  │
│  │                                                                     │
│  └─ Optimistic Update Flow:                                           │
│      ├─ TanStack Query: setQueryData(['entity-instance', ...], newData)│
│      ├─ Dexie: entityInstance.put({ data: newData })                  │
│      ├─ Component re-renders INSTANTLY ✅                             │
│      └─ Background API call → Invalidate → Refetch                    │
│                                                                        │
│  ↓                                                                     │
│                                                                        │
│  CACHE INVALIDATION                                                   │
│  ──────────────────                                                   │
│  queryClient.invalidateQueries(['entity-instance', 'project', 'uuid'])│
│  ├─ Mark query as STALE                                               │
│  ├─ Trigger background refetch                                        │
│  ├─ GET /api/v1/project/uuid-123                                      │
│  ├─ Response received                                                 │
│  ├─ Update TanStack Query cache                                       │
│  ├─ Update Dexie                                                      │
│  └─ Components using this query re-render                             │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Patterns

### Pattern 1: Metadata-First Loading

**Problem**: Can't render fields without metadata

**Solution**: Load metadata BEFORE data, early return on loading

```typescript
// ✅ CORRECT: Metadata-first with nullable types
const { viewType, editType, isLoading } = useEntityInstanceMetadata(...);

if (!viewType) {
  return <LoadingSpinner />;  // Blocks until metadata available
}

// Now safe to fetch data (metadata needed for formatting)
const { data } = useFormattedEntityList(...);
```

```typescript
// ❌ WRONG: Load data without metadata
const { data } = useEntityList(...);  // No metadata!
// Can't format data without knowing field types
```

### Pattern 2: Format-at-Read with Cache Subscription

**Problem**: Badge colors change in settings, cached data becomes stale

**Solution**: Store RAW data in cache, format during render, subscribe to datalabel cache

```typescript
// ✅ CORRECT: Format-at-read
const { data: rawData } = useQuery({
  queryKey: ['entity-list', 'project'],
  queryFn: fetchProjects,
  // Cache stores: [{ dl__project_stage: 'planning' }]
});

const formattedData = useMemo(() => {
  const datalabelOptions = getDatalabelSync('dl__project_stage');
  // Reactive: Re-runs when datalabelOptions change!

  return rawData.map(row => ({
    raw: row,
    display: {
      dl__project_stage: datalabelOptions.find(o => o.code === row.dl__project_stage)?.label
    },
    styles: {
      dl__project_stage: datalabelOptions.find(o => o.code === row.dl__project_stage)?.badge_color
    }
  }));
}, [rawData, datalabelOptions]);  // Re-runs when EITHER changes!
```

```typescript
// ❌ WRONG: Format-at-fetch
const { data } = useQuery({
  queryKey: ['entity-list', 'project'],
  queryFn: async () => {
    const rawData = await fetchProjects();
    // Format and cache formatted data
    return rawData.map(row => ({
      ...row,
      _formatted: formatBadge(row.dl__project_stage)  // Frozen in cache!
    }));
  }
});
// If badge color changes, cache is stale - must invalidate + refetch!
```

### Pattern 3: Optimistic Updates with Rollback

**Problem**: API call takes time, user expects instant feedback

**Solution**: Update cache immediately, rollback on error

```typescript
// ✅ CORRECT: Optimistic update with rollback
const mutation = useMutation({
  mutationFn: (updates) => api.patch(`/api/v1/project/${id}`, updates),
  onMutate: async (updates) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['entity-instance', 'project', id]);

    // Snapshot current value
    const previousData = queryClient.getQueryData(['entity-instance', 'project', id]);

    // Optimistically update cache
    queryClient.setQueryData(['entity-instance', 'project', id], (old) => ({
      ...old,
      ...updates
    }));

    // Return context with snapshot
    return { previousData };
  },
  onError: (err, updates, context) => {
    // Rollback to snapshot
    queryClient.setQueryData(['entity-instance', 'project', id], context.previousData);
    toast.error('Update failed');
  },
  onSuccess: () => {
    // Invalidate to refetch and confirm
    queryClient.invalidateQueries(['entity-instance', 'project', id]);
    toast.success('Updated successfully');
  }
});
```

### Pattern 4: Conditional Cache Queries

**Problem**: Don't want to fetch dropdown options until user clicks field

**Solution**: Use `enabled` option to conditionally execute query

```typescript
// ✅ CORRECT: Conditional query
const [isEditing, setIsEditing] = useState(false);

const { data: options } = useDatalabel('dl__project_stage', {
  enabled: isEditing  // Only fetch when editing!
});

// User clicks field → setIsEditing(true) → Query executes
```

```typescript
// ❌ WRONG: Always fetch
const { data: options } = useDatalabel('dl__project_stage');
// Fetches even if user never edits field (wasteful)
```

### Pattern 5: Parallel Cache Queries

**Problem**: Page needs multiple pieces of data (metadata + data + entity codes)

**Solution**: Use all hooks in parallel, render when ALL ready

```typescript
// ✅ CORRECT: Parallel queries
const metadataQuery = useEntityInstanceMetadata('project', 'form');
const dataQuery = useEntity('project', id);
const entityCodesQuery = useEntityCodes();

// All three execute in parallel!

if (metadataQuery.isLoading || dataQuery.isLoading || entityCodesQuery.isLoading) {
  return <LoadingSpinner />;
}

// Render when ALL ready
```

```typescript
// ❌ WRONG: Sequential queries
const metadataQuery = useEntityInstanceMetadata('project', 'form');
if (metadataQuery.isLoading) return <LoadingSpinner />;

const dataQuery = useEntity('project', id);  // Waits for metadata first!
if (dataQuery.isLoading) return <LoadingSpinner />;

// Slower: Sequential = 100ms + 100ms = 200ms
// Parallel = max(100ms, 100ms) = 100ms
```

---

## Component State Management

### Three Types of State

```typescript
┌─────────────────────────────────────────────────────────────────┐
│                    State Management Layers                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SERVER STATE (Managed by TanStack Query + Dexie)            │
│  ──────────────────────────────────────────────────            │
│  • Entity instances (projects, tasks, employees)                │
│  • Field metadata (viewType, editType)                          │
│  • Datalabel options (dropdown choices)                         │
│  • Entity codes (entity type list)                              │
│  • Global settings (badge colors, feature flags)                │
│                                                                  │
│  Characteristics:                                               │
│  - Fetched from API                                             │
│  - Cached in-memory (TanStack Query)                            │
│  - Persisted to IndexedDB (Dexie)                               │
│  - Synced across tabs (Dexie storage events)                    │
│  - Invalidated via WebSocket                                    │
│  - Survives browser restart                                     │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  2. DRAFT STATE (Managed by useDraft + Dexie)                   │
│  ────────────────────────────────────────────                   │
│  • Unsaved form edits                                           │
│  • Partial entity updates                                       │
│  • Work-in-progress data                                        │
│                                                                  │
│  Characteristics:                                               │
│  - Persisted to IndexedDB (Dexie draft table)                   │
│  - Survives page refresh                                        │
│  - Cleared on save or discard                                   │
│  - User can see "Unsaved changes" indicator                     │
│  - Merged with server state on render                           │
│                                                                  │
│  ↓                                                               │
│                                                                  │
│  3. UI STATE (Managed by React useState)                        │
│  ──────────────────────────────────────                         │
│  • Dropdown open/closed (isOpen)                                │
│  • Editing cell (editingCell)                                   │
│  • Search term (searchTerm)                                     │
│  • Highlighted index (highlightedIndex)                         │
│  • Sort config (sortConfig)                                     │
│  • Filter state (filters)                                       │
│  • Inline editing field (inlineEditingField)                    │
│                                                                  │
│  Characteristics:                                               │
│  - Local to component                                           │
│  - Lost on unmount                                              │
│  - NOT persisted                                                │
│  - Fast, synchronous updates                                    │
│  - No network calls                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### State Decision Tree

```
Need to store this data?
  ↓
Does it come from API?
  ├─ YES → Use TanStack Query
  │   ├─ Needs offline support? → Also store in Dexie ✓
  │   └─ Needs real-time sync? → Subscribe to WebSocket ✓
  │
  └─ NO → Is it form data?
      ├─ YES → Needs to survive page refresh?
      │   ├─ YES → Use useDraft (Dexie draft table)
      │   └─ NO → Use useState (local state)
      │
      └─ NO → Is it UI interaction state?
          └─ YES → Use useState (local state)
```

---

This comprehensive document explains how every component integrates with the cache lifecycle. The key insight is that **pages orchestrate cache**, **containers manage UI state**, and **presentation components are pure renderers** with minimal cache access.

The format-at-read pattern ensures that when badge colors change, ALL components reactively update without needing to invalidate entity data caches!
