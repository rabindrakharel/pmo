# PMO Unified Design Pattern - Document Outline

**Version**: 1.0.0
**Date**: 2025-12-04
**Purpose**: Comprehensive design pattern documentation for UI/UX, rendering, cache, state management, and interaction flows

---

## Executive Summary

- **6 Core Principles** (single source of truth, format-at-read, etc.)
- **7-Layer Architecture** overview
- **Key Technologies** (TanStack Query, Dexie, React 19)
- **Target Audience** (developers, architects, LLMs)
- **Document Navigation Guide**

---

## Section 1: Architecture Overview

### 1.1 Platform Architecture
- Technology stack diagram
- Frontend-Backend-Database layers
- WebSocket PubSub service (port 4001)
- API service (port 4000)
- Web application (port 5173)

### 1.2 Seven-Layer System Architecture
```
┌────────────────────────────────────────────────────────┐
│ Layer 1: Database Schema & DDL                         │
│ Layer 2: Backend API & Metadata Generation (BFF)       │
│ Layer 3: State Management & Caching (TanStack + Dexie) │
│ Layer 4: Component Registry & Field Renderer           │
│ Layer 5: UI Components & Containers                    │
│ Layer 6: Pages & Routing                               │
│ Layer 7: User Interaction & Event Handling             │
└────────────────────────────────────────────────────────┘
```

### 1.3 Design Principles
- Backend as single source of truth
- Metadata-driven rendering
- Config-driven components
- Optimistic updates
- Offline-first architecture

### 1.4 Key Architectural Decisions
- Why TanStack Query over Redux
- Why Dexie over RxDB
- Why format-at-read over format-at-fetch
- Why portal rendering for dropdowns

---

## Section 2: State Management & Cache Lifecycle

### 2.1 TanStack Query Architecture
- **Query key structure**
  - `['entity-list', entityCode, params]`
  - `['entity-instance', entityCode, entityId]`
  - `['entity-metadata', entityCode, metadataType]`
  - `['datalabel', datalabelField]`
  - `['entity-codes']`
  - `['global-settings']`

- **Cache configuration**
  - `staleTime` values per data type (2min, 5min, 10min, 30min)
  - `gcTime` (garbage collection time)
  - `refetchOnWindowFocus` behavior
  - `refetchOnMount` behavior

- **Query states**
  - `isLoading` vs `isFetching`
  - `isStale` vs `isError`
  - `data` vs `placeholderData`

### 2.2 Dexie IndexedDB Schema (v4)
- **8 Core Tables**
  - `datalabel` - Settings dropdowns
  - `entityCode` - Entity type metadata
  - `globalSetting` - Application settings
  - `entityInstanceData` - Entity list data
  - `entityInstanceMetadata` - Field metadata
  - `entityInstance` - Entity references
  - `entityLink` - Parent-child links
  - `draft` - Unsaved changes

- **Unified Naming Convention**
  - TanStack Query keys match Dexie table names
  - `createDatalabelKey()`, `createEntityInstanceKey()`, etc.

- **Schema Versioning**
  - Version upgrade strategy
  - Migration patterns

### 2.3 Cache Lifecycle State Machine

```
┌──────────────────────────────────────────────────────────┐
│                  Cache Lifecycle States                   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  [EMPTY] → [LOADING] → [FRESH] → [STALE] → [REVALIDATING]│
│              ↓           ↓         ↓          ↓           │
│            [ERROR]    [FRESH]   [FRESH]   [ERROR/FRESH]  │
│                                                           │
│  INVALIDATE event → Force [STALE] → Auto [REVALIDATING]  │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

- **State transitions**
  - Initial load: EMPTY → LOADING → FRESH
  - Background refetch: FRESH → STALE → REVALIDATING → FRESH
  - Manual invalidation: ANY → STALE → REVALIDATING
  - Error handling: ANY → ERROR (with retry logic)

- **Dexie sync points**
  - When TanStack Query writes to Dexie
  - When Dexie data hydrates TanStack Query
  - Multi-tab sync behavior

### 2.4 WebSocket Real-Time Sync

- **PubSub Service Architecture**
  - LogWatcher polling `app.system_logging` (60s interval)
  - `app.system_cache_subscription` table
  - SUBSCRIBE/UNSUBSCRIBE messages
  - INVALIDATE messages

- **Cache Invalidation Flow**
```
Database Change → Trigger → system_logging → LogWatcher →
WebSocket INVALIDATE → WebSocketManager → queryClient.invalidateQueries() →
TanStack Query refetch → Dexie update → Component re-render
```

- **Multi-tab coordination**
  - Dexie multi-tab sync
  - BroadcastChannel pattern

### 2.5 Sync vs Async Cache Access

- **Sync Cache Pattern** (for non-hook contexts)
  - `getDatalabelSync(field)` - Returns cached data or null
  - `getEntityCodesSync()` - Returns cached data or null
  - Use cases: formatters, utilities, transformers

- **Hook Cache Pattern** (for components)
  - `useDatalabel(field)` - Returns query state
  - `useEntityCodes()` - Returns query state
  - Auto-subscribes to updates

- **Prefetch Strategy**
  - `prefetchAllMetadata()` at login
  - Populates sync cache for non-hook access

---

## Section 3: Data Flow Pipeline

### 3.1 Complete Request Flow (LIST Endpoint)

```
USER ACTION: Navigate to /project
  ↓
PAGE MOUNT: EntityListOfInstancesPage.tsx
  ├─ useEntityInstanceMetadata('project', 'entityListOfInstancesTable')
  │   ├─ Check TanStack Query cache
  │   │   ├─ CACHE HIT → Return cached metadata
  │   │   └─ CACHE MISS → Fetch from API
  │   │       └─ GET /api/v1/project?content=metadata
  │   │           └─ Backend: generateEntityResponse(metadataOnly=true)
  │   │               ├─ Redis field cache lookup
  │   │               └─ Returns { metadata } only (no data)
  │   └─ Store in TanStack Query + Dexie
  │
  └─ useFormattedEntityList('project', { limit: 50 })
      ├─ Check TanStack Query cache
      │   ├─ CACHE HIT → Format-at-read using select
      │   └─ CACHE MISS → Fetch from API
      │       └─ GET /api/v1/project?limit=50
      │           └─ Backend: Routes owns query
      │               ├─ RBAC filtering
      │               ├─ Auto-filters (buildAutoFilters)
      │               ├─ SQL query execution
      │               ├─ build_ref_data_entityInstance()
      │               └─ generateEntityResponse(data, metadata)
      └─ Format-at-read (select):
          ├─ Input: [{ dl__project_stage: 'planning', budget_allocated_amt: 50000 }]
          └─ Output: { raw, display, styles }
              ├─ raw: { dl__project_stage: 'planning', budget_allocated_amt: 50000 }
              ├─ display: { dl__project_stage: 'Planning', budget_allocated_amt: '$50,000.00' }
              └─ styles: { dl__project_stage: 'bg-blue-100 text-blue-800' }
  ↓
COMPONENT RENDER: EntityListOfInstancesTable
  └─ Receives formattedData = { raw, display, styles }
```

### 3.2 Complete Request Flow (GET Single Instance)

```
USER ACTION: Click on project row
  ↓
NAVIGATION: /project/{id}
  ↓
PAGE MOUNT: EntitySpecificInstancePage.tsx
  ├─ useEntityInstanceMetadata('project', 'entityInstanceFormContainer')
  │   └─ (Same metadata fetch as above, different metadataType)
  │
  └─ useEntity('project', id)
      ├─ Check TanStack Query cache
      │   ├─ CACHE HIT → Return cached instance
      │   └─ CACHE MISS → Fetch from API
      │       └─ GET /api/v1/project/{id}
      │           └─ Backend: RBAC check + SQL query + generateEntityResponse()
      └─ Store in TanStack Query + Dexie
  ↓
COMPONENT RENDER: EntityInstanceFormContainer
  ├─ Render view mode fields using FieldRenderer
  └─ Wait for user interaction
```

### 3.3 Complete Update Flow (Inline Edit)

```
USER ACTION: Long-press field (500ms)
  ↓
ENTER EDIT MODE: EntityInstanceFormContainer.enterInlineEditMode()
  ├─ Set inlineEditingField = fieldKey
  ├─ Set inlineEditValue = currentValue
  └─ editingFieldRef.current = field container
  ↓
RENDER EDIT COMPONENT: FieldRenderer (isEditing=true)
  ├─ Lookup field.inputType in EditComponentRegistry
  │   ├─ 'EntityInstanceNameSelect' → EntityInstanceNameSelectEdit
  │   ├─ 'BadgeDropdownSelect' → BadgeDropdownSelectEdit
  │   └─ 'currency' → CurrencyInputEdit
  │
  └─ Component mounts with portal rendering (if dropdown)
      └─ createPortal(<div data-dropdown-portal ref={dropdownRef}>...</div>, document.body)
  ↓
USER ACTION: Select dropdown option
  ↓
COMPONENT CALLBACK: EntityInstanceNameSelect.selectOption()
  ├─ Update local state (instant UI feedback)
  └─ Call onChange(uuid, label)
  ↓
REGISTRY WRAPPER: EntityInstanceNameSelectEdit.onChange()
  └─ Call parent onChange(uuid)
  ↓
FIELD RENDERER: FieldRenderer.onChange() router
  └─ Call parent onChange(uuid)
  ↓
FORM CONTAINER: EntityInstanceFormContainer.handleInlineValueChange()
  └─ Set inlineEditValue = uuid
  ↓
USER ACTION: Click outside OR press Enter
  ↓
CLICK-OUTSIDE HANDLER: EntityInstanceFormContainer.handleClickOutside()
  ├─ Check if click inside editingFieldRef → NO
  ├─ Check if click inside [data-dropdown-portal] → NO
  └─ Call handleInlineSave()
  ↓
SAVE HANDLER: EntityInstanceFormContainer.handleInlineSave()
  ├─ Compare inlineEditValue vs formData[fieldKey]
  ├─ If different → Call onInlineSave(fieldKey, inlineEditValue)
  └─ Clear inlineEditingField (exit edit mode)
  ↓
PAGE HANDLER: EntitySpecificInstancePage.handleInlineSave()
  └─ Call optimisticUpdateEntity(id, { [fieldKey]: newValue })
  ↓
MUTATION: useEntityMutation.optimisticUpdateEntity()
  ├─ OPTIMISTIC UPDATE:
  │   ├─ queryClient.setQueryData(['entity-instance', 'project', id], newData)
  │   ├─ Update Dexie immediately
  │   └─ Component re-renders with new value ✅ INSTANT UI UPDATE
  │
  └─ API CALL:
      ├─ PATCH /api/v1/project/{id}
      │   ├─ RBAC check (Permission.EDIT)
      │   ├─ Transactional update_entity()
      │   │   ├─ UPDATE app.project
      │   │   └─ UPDATE entity_instance (if name/code changed)
      │   └─ Return updated entity
      │
      ├─ ON SUCCESS:
      │   ├─ Invalidate queries: ['entity-instance', 'project', id]
      │   ├─ Invalidate queries: ['entity-list', 'project']
      │   ├─ Background refetch updates cache
      │   └─ Dexie updated with server response
      │
      └─ ON ERROR:
          ├─ Rollback optimistic update
          ├─ queryClient.setQueryData (restore old value)
          ├─ Show error toast
          └─ Component re-renders with old value
```

### 3.4 Complete Create Flow (Add New Entity)

```
USER ACTION: Click "Add Project" button
  ↓
NAVIGATION: /project/create?parent_code=business&parent_id={uuid}
  ↓
PAGE MOUNT: EntityCreatePage.tsx
  ├─ Extract parent context from URL
  └─ useEntityInstanceMetadata('project', 'entityInstanceFormContainer')
  ↓
COMPONENT RENDER: EntityInstanceFormContainer (mode='create')
  ├─ Initialize formData = {}
  └─ Render all editable fields
  ↓
USER ACTION: Fill form fields
  ↓
FIELD CHANGES: FieldRenderer.onChange() → handleFieldChange()
  └─ Update formData state
  ↓
USER ACTION: Click "Save" button
  ↓
VALIDATION: EntityInstanceFormContainer.handleSubmit()
  ├─ Validate required fields
  ├─ Transform data: transformForApi(formData)
  └─ Call onSubmit(transformedData)
  ↓
PAGE HANDLER: EntityCreatePage.handleSubmit()
  └─ Call createEntity(transformedData, { parent_code, parent_id })
  ↓
MUTATION: useEntityMutation.createEntity()
  └─ API CALL:
      └─ POST /api/v1/project?parent_code=business&parent_id={uuid}
          ├─ RBAC check (Permission.CREATE on 'project')
          ├─ RBAC check (Permission.EDIT on parent)
          ├─ Transactional create_entity()
          │   ├─ INSERT app.project
          │   ├─ INSERT entity_instance
          │   ├─ INSERT entity_rbac (OWNER for creator)
          │   └─ INSERT entity_instance_link (parent → child)
          └─ Return created entity with ID
  ↓
ON SUCCESS:
  ├─ Invalidate queries: ['entity-list', 'project']
  ├─ Invalidate queries: ['entity-list', 'business', parent_id, 'children']
  ├─ Navigate to: /project/{new_id}
  └─ Show success toast
```

### 3.5 Response Structure Evolution

```
API Response v8.3.2:
{
  "data": [
    {
      "id": "uuid",
      "manager__employee_id": "uuid-james",
      "dl__project_stage": "planning",
      "budget_allocated_amt": 50000
    }
  ],
  "ref_data_entityInstance": {
    "employee": { "uuid-james": "James Miller" }
  },
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": { /* field metadata */ },
      "editType": { /* field metadata */ }
    }
  },
  "total": 42,
  "limit": 50,
  "offset": 0
}

Format-at-Read Output (Frontend):
{
  "raw": {
    "id": "uuid",
    "manager__employee_id": "uuid-james",
    "dl__project_stage": "planning",
    "budget_allocated_amt": 50000
  },
  "display": {
    "manager__employee_id": "James Miller",  ← Resolved from ref_data_entityInstance
    "dl__project_stage": "Planning",         ← Formatted from datalabel cache
    "budget_allocated_amt": "$50,000.00"     ← Formatted using metadata.renderType
  },
  "styles": {
    "dl__project_stage": "bg-blue-100 text-blue-800"  ← Badge color from settings
  }
}
```

---

## Section 4: UI/UX Interaction Patterns

### 4.1 Five Core Interaction Patterns

#### Pattern 1: View Mode (Read-Only Display)
- **Trigger**: Page load, navigation
- **State**: `isEditing = false`, no edit state
- **Rendering**: FieldRenderer uses ViewComponentRegistry
- **Components**:
  - Currency → `<span className="font-mono">$50,000.00</span>`
  - Badge → `<span className="badge bg-blue-100">Planning</span>`
  - Entity Reference → `<span>James Miller</span>`
- **User Actions**: Click field for context menu, long-press for inline edit

#### Pattern 2: Inline Edit Mode (Quick Edit)
- **Trigger**: Long-press field (500ms hold)
- **State**: `inlineEditingField = fieldKey`, `inlineEditValue = currentValue`
- **Rendering**: FieldRenderer switches to EditComponentRegistry
- **Save Triggers**:
  - Click outside (with portal detection)
  - Press Enter key
  - Press Escape (cancel)
- **Components**: Same as full edit mode
- **Optimistic Update**: Yes (instant UI feedback)

#### Pattern 3: Full Edit Mode (Form Edit)
- **Trigger**: Click pencil icon
- **State**: `isFullEditMode = true`, all fields editable
- **Rendering**: All fields use EditComponentRegistry
- **Save Triggers**: Click "Save" button, Press Ctrl+S
- **Validation**: Full form validation before save
- **Optimistic Update**: Yes

#### Pattern 4: Table Cell Edit (Data Table)
- **Trigger**: Click on editable cell
- **State**: `editingCell = { rowId, columnKey }`, `editedData = {}`
- **Rendering**: FieldRenderer in table cell context
- **Save Triggers**:
  - Immediate save on dropdown selection (onCellSave callback)
  - Click outside for text fields
  - Press Enter
- **Two Save Modes**:
  - Cell-level save: `onCellSave(rowId, columnKey, value, record)`
  - Row-level save: `onSaveInlineEdit(record)`

#### Pattern 5: Add Row (Table Inline Create)
- **Trigger**: Click "Add Row" button
- **State**: New empty row added, auto-focus first field
- **Rendering**: All cells in edit mode
- **Save Triggers**: Same as cell edit
- **API Call**: POST /api/v1/{entity} with parent context

### 4.2 Portal-Safe Click-Outside Pattern

**The Problem**:
```
Component Tree (DOM):
  <div ref={editingFieldRef}>
    <FieldRenderer>
      <EntityInstanceNameSelect>
        <button ref={buttonRef}>Select...</button>
      </EntityInstanceNameSelect>
    </FieldRenderer>
  </div>

Portal Rendering (document.body):
  <div data-dropdown-portal ref={dropdownRef}>
    <div onClick={selectOption}>James Miller</div>  ← Click here
  </div>

RACE CONDITION:
1. User clicks dropdown option
2. mousedown event fires
3. Parent's handleClickOutside() checks editingFieldRef.contains(target)
4. Returns FALSE (portal is outside editingFieldRef)
5. Calls handleInlineSave() → exits edit mode
6. Component unmounts
7. click event never fires → onChange never called ❌
```

**The Solution**:
```typescript
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;

  // Check 1: Inside editing container?
  if (editingFieldRef.current?.contains(target)) return;

  // Check 2: Inside ANY portal dropdown? ✅ CRITICAL
  const isClickInsideDropdown = (target as Element).closest?.('[data-dropdown-portal]');
  if (isClickInsideDropdown) {
    console.log('🎯 Click inside dropdown portal detected, ignoring');
    return;
  }

  // Truly outside - save and close
  handleInlineSave();
};

// IMPORTANT: Use mousedown (fires BEFORE click)
document.addEventListener('mousedown', handleClickOutside);
```

**Required Attributes**:
```typescript
// All portal dropdowns MUST have this attribute
<div
  ref={dropdownRef}
  data-dropdown-portal=""  // ✅ CRITICAL for portal detection
  style={{ position: 'absolute', zIndex: 9999 }}
>
  {options.map(opt => <div onClick={selectOption}>{opt.label}</div>)}
</div>

// Created via portal
{createPortal(dropdownContent, document.body)}
```

### 4.3 Event Handling Hierarchy

```
Event Order (Browser):
1. mousedown → Fires first, used for click-outside detection
2. focus → Fires if clicking focusable element
3. click → Fires last, used for selection/action

Click-Outside Handlers (Execution Order):
1. Parent container handler (EntityInstanceFormContainer / EntityListOfInstancesTable)
   └─ Checks: editingFieldRef + [data-dropdown-portal]
2. Dropdown component handler (EntityInstanceNameSelect / BadgeDropdownSelect)
   └─ Checks: buttonRef + dropdownRef

Both handlers MUST return early if click is inside their respective boundaries.
```

### 4.4 Keyboard Navigation

- **Enter Key**:
  - View mode → Enter inline edit mode
  - Edit mode (text) → Save and close
  - Edit mode (dropdown open) → Select highlighted option
  - Edit mode (dropdown closed) → Save and close

- **Escape Key**:
  - Edit mode → Cancel changes, revert to original value
  - Dropdown open → Close dropdown without selecting

- **Tab Key**:
  - Edit mode → Save current field, move to next field

- **Arrow Keys**:
  - Dropdown open → Navigate options (highlight)
  - View mode → Navigate between fields

### 4.5 Loading States & Skeletons

```
┌────────────────────────────────────────────────────────┐
│              Loading State Hierarchy                   │
├────────────────────────────────────────────────────────┤
│                                                         │
│  1. METADATA LOADING (High Priority)                   │
│     - Show: Spinner or "Loading metadata..."           │
│     - Blocks: Entire page render                       │
│     - Pattern: if (!viewType) return <LoadingSpinner />│
│                                                         │
│  2. DATA LOADING (Medium Priority)                     │
│     - Show: Skeleton rows in table                     │
│     - Blocks: Data display only                        │
│     - Pattern: if (isLoading) return <SkeletonTable /> │
│                                                         │
│  3. BACKGROUND REFETCH (Low Priority)                  │
│     - Show: Small spinner in corner OR nothing         │
│     - Blocks: Nothing (shows stale data)               │
│     - Pattern: {isFetching && <SmallSpinner />}        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## Section 5: Component Rendering Architecture

### 5.1 Reactive Entity Field Pattern (5 Layers)

```
┌────────────────────────────────────────────────────────┐
│        Layer 1: Metadata Fetching (Nullable Types)     │
├────────────────────────────────────────────────────────┤
│  useEntityInstanceMetadata(entityCode, metadataType)   │
│  Returns: { viewType: undefined, editType: undefined } │
│  Consumer: if (!viewType) return null; ← CRITICAL      │
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│        Layer 2: Reactive Formatting (Format-at-Read)   │
├────────────────────────────────────────────────────────┤
│  useFormattedEntityData(rawData, metadata)             │
│  Input:  [{ dl__stage: 'planning' }]                   │
│  Output: { raw, display, styles }                      │
│  Cache: Stores RAW data only                           │
│  Format: On every read, subscribes to datalabel cache  │
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│        Layer 3: Component Registry (Metadata-Driven)   │
├────────────────────────────────────────────────────────┤
│  FieldRenderer receives metadata:                      │
│  {                                                      │
│    renderType: 'badge',        ← VIEW mode             │
│    inputType: 'BadgeDropdownSelect', ← EDIT mode       │
│    lookupSourceTable: 'datalabel',                     │
│    lookupField: 'dl__project_stage'                    │
│  }                                                      │
│                                                         │
│  View: ViewComponentRegistry.get('badge')              │
│  Edit: EditComponentRegistry.get('BadgeDropdownSelect')│
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│        Layer 4: Portal Rendering (React Portal)        │
├────────────────────────────────────────────────────────┤
│  BadgeDropdownSelect / EntityInstanceNameSelect        │
│  {createPortal(                                        │
│    <div data-dropdown-portal ref={dropdownRef}>       │
│      {options.map(...)}                                │
│    </div>,                                             │
│    document.body                                       │
│  )}                                                    │
└────────────────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────────────────┐
│   Layer 5: Portal-Aware Handlers (Defense in Depth)   │
├────────────────────────────────────────────────────────┤
│  Parent Handler:                                       │
│  if (target.closest('[data-dropdown-portal]')) return; │
│                                                         │
│  Dropdown Handler:                                     │
│  if (buttonRef.contains(target)) return;               │
│  if (dropdownRef.contains(target)) return;             │
└────────────────────────────────────────────────────────┘
```

### 5.2 FieldRenderer Architecture

```typescript
// apps/web/src/lib/fieldRenderer/FieldRenderer.tsx

interface FieldRendererProps {
  field: FieldMetadata;      // From metadata.viewType or metadata.editType
  value: any;                // Raw value
  isEditing: boolean;        // View vs Edit mode
  onChange?: (value: any) => void;  // Edit mode callback
  formattedData?: {          // Pre-formatted data (format-at-read)
    display: Record<string, string>;
    styles: Record<string, string>;
  };
  disabled?: boolean;
  readonly?: boolean;
  options?: OptionItem[];    // For dropdowns (datalabel cache)
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field, value, isEditing, ... }) => {
  if (isEditing) {
    // EDIT MODE: Use EditComponentRegistry
    const EditComponent = EditComponentRegistry.get(field.inputType);
    return <EditComponent value={value} field={field} onChange={onChange} options={options} />;
  } else {
    // VIEW MODE: Use ViewComponentRegistry
    const ViewComponent = ViewComponentRegistry.get(field.renderType);
    return <ViewComponent value={value} field={field} formattedData={formattedData} />;
  }
};
```

### 5.3 Component Registry Maps

```typescript
// EditComponentRegistry (apps/web/src/lib/fieldRenderer/registerComponents.tsx)

const EditComponentRegistry = new Map<string, React.FC<ComponentRendererProps>>([
  ['text', TextInputEdit],
  ['textarea', TextareaEdit],
  ['number', NumberInputEdit],
  ['currency', CurrencyInputEdit],
  ['date', DatePickerEdit],
  ['datetime', DateTimePickerEdit],
  ['checkbox', CheckboxEdit],
  ['select', SelectEdit],
  ['multiselect', MultiSelectEdit],
  ['BadgeDropdownSelect', BadgeDropdownSelectEdit],  // Portal dropdown
  ['EntityInstanceNameSelect', EntityInstanceNameSelectEdit],  // Portal dropdown
  ['tags', TagsInputEdit],
  ['json', JsonEditorEdit],
  // ... 20+ registered components
]);

// ViewComponentRegistry

const ViewComponentRegistry = new Map<string, React.FC<ComponentRendererProps>>([
  ['text', TextDisplay],
  ['currency', CurrencyDisplay],  // $50,000.00
  ['date', DateDisplay],          // 2025-12-04
  ['timestamp', TimestampDisplay], // 2025-12-04 10:30 AM
  ['boolean', BooleanDisplay],    // ✓ / ✗
  ['badge', BadgeDisplay],        // <span className="badge bg-blue-100">Planning</span>
  ['entityInstanceId', EntityInstanceDisplay],  // James Miller (resolved from ref_data)
  ['array', ArrayDisplay],        // [Tag1] [Tag2] [Tag3]
  ['json', JsonDisplay],          // <pre>{JSON.stringify(value, null, 2)}</pre>
  // ... 15+ registered components
]);
```

### 5.4 Metadata Resolution Flow

```
Backend: generateEntityResponse()
  ├─ Field: 'dl__project_stage'
  │   ├─ Pattern Detection: dl__* → Datalabel
  │   ├─ viewType: {
  │   │   dtype: 'str',
  │   │   label: 'Project Stage',
  │   │   renderType: 'badge',  ← Controls VIEW component
  │   │   lookupField: 'dl__project_stage'
  │   │ }
  │   └─ editType: {
  │       inputType: 'BadgeDropdownSelect',  ← Controls EDIT component
  │       lookupSourceTable: 'datalabel',
  │       lookupField: 'dl__project_stage'
  │     }
  │
  ├─ Field: 'manager__employee_id'
  │   ├─ Pattern Detection: *__employee_id → Entity Reference
  │   ├─ viewType: {
  │   │   dtype: 'uuid',
  │   │   label: 'Manager',
  │   │   renderType: 'entityInstanceId',  ← Resolves from ref_data_entityInstance
  │   │   lookupEntity: 'employee',
  │   │   lookupSourceTable: 'entityInstance'
  │   │ }
  │   └─ editType: {
  │       inputType: 'EntityInstanceNameSelect',
  │       lookupEntity: 'employee',
  │       lookupSourceTable: 'entityInstance'
  │     }
  │
  └─ Field: 'budget_allocated_amt'
      ├─ Pattern Detection: *_amt → Currency
      ├─ viewType: {
      │   dtype: 'float',
      │   label: 'Budget Allocated',
      │   renderType: 'currency',
      │   style: { symbol: '$', decimals: 2 }
      │ }
      └─ editType: {
          inputType: 'currency'
        }

Frontend: FieldRenderer resolution
  ├─ isEditing = false
  │   └─ ViewComponentRegistry.get(field.renderType)
  │       ├─ 'badge' → BadgeDisplay.tsx
  │       ├─ 'entityInstanceId' → EntityInstanceDisplay.tsx
  │       └─ 'currency' → CurrencyDisplay.tsx
  │
  └─ isEditing = true
      └─ EditComponentRegistry.get(field.inputType)
          ├─ 'BadgeDropdownSelect' → BadgeDropdownSelectEdit
          ├─ 'EntityInstanceNameSelect' → EntityInstanceNameSelectEdit
          └─ 'currency' → CurrencyInputEdit
```

### 5.5 Format-at-Read Implementation

```typescript
// apps/web/src/lib/hooks/useFormattedEntityData.ts

export function useFormattedEntityData<T>(
  rawData: T[],
  metadata: EntityMetadata | undefined,
  entityCode: string
) {
  // Subscribe to datalabel cache for reactive formatting
  const datalabelCache = useDatalabelCache();
  const settingsCache = useGlobalSettings();

  return useMemo(() => {
    if (!metadata?.viewType) return { data: [] };

    const formatted = rawData.map(row => {
      const display: Record<string, string> = {};
      const styles: Record<string, string> = {};

      Object.entries(metadata.viewType).forEach(([key, fieldMeta]) => {
        const rawValue = row[key];

        // Badge fields: Look up display + style from datalabel cache
        if (fieldMeta.renderType === 'badge' && fieldMeta.lookupField) {
          const options = datalabelCache[fieldMeta.lookupField] || [];
          const option = options.find(opt => opt.code === rawValue);
          display[key] = option?.label || rawValue;
          styles[key] = option?.badge_color || 'bg-gray-100';
        }

        // Entity reference: Look up from ref_data_entityInstance
        else if (fieldMeta.renderType === 'entityInstanceId') {
          const refData = (rawData as any).ref_data_entityInstance?.[fieldMeta.lookupEntity];
          display[key] = refData?.[rawValue] || rawValue;
        }

        // Currency: Format with symbol + decimals
        else if (fieldMeta.renderType === 'currency') {
          display[key] = formatCurrency(rawValue, fieldMeta.style);
        }

        // Default: toString()
        else {
          display[key] = String(rawValue ?? '');
        }
      });

      return { raw: row, display, styles };
    });

    return { data: formatted };
  }, [rawData, metadata, datalabelCache, settingsCache]);
}

// Usage in component
const { data: formattedProjects } = useFormattedEntityData(
  projects,
  metadata?.entityListOfInstancesTable,
  'project'
);

// Result:
formattedProjects[0] = {
  raw: { dl__project_stage: 'planning', budget_allocated_amt: 50000 },
  display: { dl__project_stage: 'Planning', budget_allocated_amt: '$50,000.00' },
  styles: { dl__project_stage: 'bg-blue-100 text-blue-800' }
}
```

### 5.6 Container Component Patterns

#### EntityListOfInstancesPage.tsx
- Fetches: `useEntityInstanceMetadata()`, `useFormattedEntityList()`
- Renders: `<EntityListOfInstancesTable />`, `<KanbanView />`, `<CalendarView />`
- Handles: Pagination, filtering, view switching, cell save callbacks

#### EntitySpecificInstancePage.tsx
- Fetches: `useEntityInstanceMetadata()`, `useEntity()`
- Renders: `<EntityInstanceFormContainer />`, `<DynamicChildEntityTabs />`
- Handles: Inline edit, full edit mode toggle, child entity navigation

#### EntityListOfInstancesTable.tsx
- Receives: `formattedData = { raw, display, styles }[]`
- Renders: Table rows with FieldRenderer per cell
- Handles: Cell edit mode, portal-aware click-outside, keyboard navigation

#### EntityInstanceFormContainer.tsx
- Receives: `formData`, `metadata`, callbacks
- Renders: FieldRenderer per field (view/edit mode)
- Handles: Inline edit state, full edit state, portal-aware click-outside

---

## Section 6: Request Flow & API Integration

### 6.1 API Endpoint Patterns

```
Standard CRUD Endpoints:
  GET    /api/v1/{entity}              - List with RBAC + auto-filters
  GET    /api/v1/{entity}/{id}         - Get single instance
  POST   /api/v1/{entity}              - Create with parent link
  PATCH  /api/v1/{entity}/{id}         - Update instance
  DELETE /api/v1/{entity}/{id}         - Soft delete

Factory-Generated Endpoints:
  GET    /api/v1/{parent}/{id}/{child} - Filtered children (RBAC-enforced)

Metadata Endpoints:
  GET    /api/v1/{entity}?content=metadata       - Metadata only (no data query)
  GET    /api/v1/{entity}/{id}?content=metadata  - Metadata only

Settings Endpoints:
  GET    /api/v1/datalabel/{field}     - Get dropdown options
  GET    /api/v1/entity/types          - Get all entity types
  GET    /api/v1/settings              - Get global settings
```

### 6.2 Auto-Filter Builder

```typescript
// apps/api/src/lib/universal-filter-builder.ts

export function buildAutoFilters(
  tableAlias: string,
  queryParams: Record<string, any>,
  options?: { searchFields?: string[] }
): SQL[] {
  const filters: SQL[] = [];

  Object.entries(queryParams).forEach(([key, value]) => {
    // Skip pagination params
    if (['limit', 'offset', 'search', 'content'].includes(key)) return;

    // Datalabel dropdown: ?dl__project_stage=planning
    if (key.startsWith('dl__')) {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}`);
    }

    // UUID reference: ?manager__employee_id=uuid
    else if (key.endsWith('_id') && isUUID(value)) {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}::uuid`);
    }

    // Currency/Number: ?budget_allocated_amt=50000
    else if (key.endsWith('_amt') || key.endsWith('_qty') || key.endsWith('_pct')) {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${parseFloat(value)}`);
    }

    // Boolean: ?active_flag=true
    else if (key.endsWith('_flag') || key.startsWith('is_')) {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value === 'true'}`);
    }

    // Date: ?created_date=2025-12-04
    else if (key.endsWith('_date')) {
      filters.push(sql`${sql.raw(tableAlias)}.${sql.raw(key)} = ${value}::date`);
    }

    // Multi-field search: ?search=kitchen
    if (key === 'search' && options?.searchFields) {
      const searchConditions = options.searchFields.map(field =>
        sql`${sql.raw(tableAlias)}.${sql.raw(field)} ILIKE ${'%' + value + '%'}`
      );
      filters.push(sql`(${sql.join(searchConditions, sql` OR `)})`);
    }
  });

  return filters;
}

// Usage in routes
const autoFilters = buildAutoFilters(TABLE_ALIAS, request.query, {
  searchFields: ['name', 'code', 'descr']
});
conditions.push(...autoFilters);
```

### 6.3 RBAC Integration

```typescript
// Entity Infrastructure Service integration

const entityInfra = getEntityInfrastructure(db);

// LIST endpoint - Filter by RBAC
const rbacCondition = await entityInfra.get_entity_rbac_where_condition(
  userId,
  'project',
  Permission.VIEW,
  'e'  // table alias
);

const projects = await db.execute(sql`
  SELECT e.* FROM app.project e
  WHERE ${rbacCondition}
    AND e.active_flag = true
    AND ${sql.join(autoFilters, sql` AND `)}
`);

// GET single - Check permission
const canView = await entityInfra.check_entity_rbac(
  userId,
  'project',
  projectId,
  Permission.VIEW
);
if (!canView) return reply.status(403).send({ error: 'Forbidden' });

// CREATE - Check type-level permission + parent permission
const canCreate = await entityInfra.check_entity_rbac(
  userId,
  'project',
  ALL_ENTITIES_ID,
  Permission.CREATE
);

const canEditParent = await entityInfra.check_entity_rbac(
  userId,
  parent_code,
  parent_id,
  Permission.EDIT
);

// UPDATE - Check edit permission
const canEdit = await entityInfra.check_entity_rbac(
  userId,
  'project',
  projectId,
  Permission.EDIT
);

// DELETE - Check delete permission
const canDelete = await entityInfra.check_entity_rbac(
  userId,
  'project',
  projectId,
  Permission.DELETE
);
```

### 6.4 Transactional CRUD Pattern

```typescript
// CREATE - Atomic operation
const result = await entityInfra.create_entity({
  entity_code: 'project',
  creator_id: userId,
  parent_entity_code: parent_code,
  parent_entity_id: parent_id,
  primary_table: 'app.project',
  primary_data: {
    code: data.code,
    name: data.name,
    descr: data.descr,
    manager__employee_id: data.manager__employee_id,
    dl__project_stage: data.dl__project_stage,
    budget_allocated_amt: data.budget_allocated_amt
  }
});

// Transaction includes:
// 1. INSERT INTO app.project
// 2. INSERT INTO entity_instance (registry)
// 3. INSERT INTO entity_rbac (OWNER permission)
// 4. INSERT INTO entity_instance_link (parent-child)

// UPDATE - Atomic operation
const result = await entityInfra.update_entity({
  entity_code: 'project',
  entity_id: projectId,
  primary_table: 'app.project',
  primary_updates: {
    name: 'Updated Project Name',
    dl__project_stage: 'in_progress'
  }
});

// Transaction includes:
// 1. UPDATE app.project SET ...
// 2. UPDATE entity_instance SET entity_instance_name (if name changed)

// DELETE - Atomic operation
const result = await entityInfra.delete_entity({
  entity_code: 'project',
  entity_id: projectId,
  user_id: userId,
  primary_table: 'app.project',
  hard_delete: false  // Soft delete (active_flag = false)
});

// Transaction includes:
// 1. UPDATE app.project SET active_flag = false (if hard_delete=false)
//    OR DELETE FROM app.project (if hard_delete=true)
// 2. DELETE FROM entity_instance (always hard delete)
// 3. DELETE FROM entity_instance_link WHERE parent OR child (always hard delete)
// 4. DELETE FROM entity_rbac (always hard delete)
```

### 6.5 Metadata Generation (Backend BFF)

```typescript
// apps/api/src/services/entity-component-metadata.service.ts

export async function generateEntityResponse(
  entityCode: string,
  data: any[],
  paginationInfo?: { total: number; limit: number; offset: number; resultFields?: Array<{ name: string }> },
  metadataTypes: string[] = ['entityListOfInstancesTable'],
  metadataOnly: boolean = false  // NEW: v9.3.0 content=metadata support
) {
  // If metadata-only request (content=metadata query param)
  if (metadataOnly) {
    // Get field names from Redis cache OR PostgreSQL columns
    const fieldNames = await getCachedFieldNames(entityCode, paginationInfo?.resultFields);

    const metadata = await generateMetadataForFields(entityCode, fieldNames, metadataTypes);

    return {
      metadata,
      // No data, no pagination, no ref_data
    };
  }

  // Regular data request
  const fieldNames = data.length > 0
    ? Object.keys(data[0])
    : await getCachedFieldNames(entityCode, paginationInfo?.resultFields);

  // Cache field names in Redis (24-hour TTL)
  if (fieldNames.length > 0) {
    await cacheFieldNames(entityCode, fieldNames);
  }

  const metadata = await generateMetadataForFields(entityCode, fieldNames, metadataTypes);
  const ref_data_entityInstance = await build_ref_data_entityInstance(data, metadata);

  return {
    data,
    ref_data_entityInstance,
    metadata,
    ...paginationInfo
  };
}

// Pattern Detection (35+ rules)
function detectFieldType(fieldName: string): FieldMetadata {
  if (fieldName.endsWith('_amt') || fieldName.endsWith('_price')) {
    return {
      dtype: 'float',
      renderType: 'currency',
      inputType: 'currency',
      style: { symbol: '$', decimals: 2 }
    };
  }

  if (fieldName.startsWith('dl__')) {
    return {
      dtype: 'str',
      renderType: 'badge',
      inputType: 'BadgeDropdownSelect',
      lookupSourceTable: 'datalabel',
      lookupField: fieldName
    };
  }

  if (fieldName.endsWith('__employee_id')) {
    return {
      dtype: 'uuid',
      renderType: 'entityInstanceId',
      inputType: 'EntityInstanceNameSelect',
      lookupEntity: 'employee',
      lookupSourceTable: 'entityInstance'
    };
  }

  // ... 32 more patterns
}
```

### 6.6 Redis Field Caching (v9.2.0)

```typescript
// Cache Structure
Redis Key: entity:fields:{entityCode}
Value: JSON.stringify(fieldNames)
TTL: 24 hours

// 3-Tier Fallback
export async function getCachedFieldNames(
  entityCode: string,
  resultFields?: Array<{ name: string }>
): Promise<string[]> {
  // Tier 1: Redis cache (fastest)
  const cached = await redis.get(`entity:fields:${entityCode}`);
  if (cached) return JSON.parse(cached);

  // Tier 2: PostgreSQL columns (resultFields from postgres.js)
  if (resultFields && resultFields.length > 0) {
    const fields = resultFields.map(f => f.name);
    await cacheFieldNames(entityCode, fields);  // Cache for next time
    return fields;
  }

  // Tier 3: Empty (graceful degradation)
  console.warn(`No field names available for ${entityCode}`);
  return [];
}

// Cache Invalidation
export async function invalidateFieldCache(entityCode: string) {
  await redis.del(`entity:fields:${entityCode}`);
}

// Used when DDL changes or new columns added
```

---

## Section 7: Inline Editing Patterns

### 7.1 Form Inline Edit (Long-Press Pattern)

### 7.2 Table Cell Edit (Click Pattern)

### 7.3 Optimistic Update Strategy

### 7.4 Error Handling & Rollback

### 7.5 Validation Patterns

---

## Section 8: Add Row Pattern

### 8.1 Table Add Row Flow

### 8.2 Create-Link-Redirect Pattern

### 8.3 Parent Context Propagation

### 8.4 Draft Persistence

---

## Section 9: Cache Invalidation & Synchronization

### 9.1 WebSocket Cache Invalidation

### 9.2 Manual Invalidation Patterns

### 9.3 Multi-Tab Sync (Dexie)

### 9.4 Optimistic Update + Refetch Pattern

### 9.5 Cache Key Patterns

---

## Section 10: Complete Interaction Flows

### 10.1 Project List → View → Edit → Save Flow

### 10.2 Badge Color Change → Real-Time Update Flow

### 10.3 Create New Project with Parent Flow

### 10.4 Table Inline Edit → Dropdown Selection Flow

### 10.5 Multi-Tab Sync Flow

---

## Appendices

### Appendix A: Component Index
- Complete list of all UI components with file paths

### Appendix B: Hook Reference
- All TanStack Query hooks with signatures

### Appendix C: API Endpoint Matrix
- All API endpoints with RBAC requirements

### Appendix D: Database Schema
- Entity table structures and relationships

### Appendix E: Migration Guides
- Upgrading from format-at-fetch to format-at-read
- Migrating from RxDB to Dexie

### Appendix F: Troubleshooting
- Common issues and solutions
- Debug logging patterns

### Appendix G: Performance Optimization
- Bundle size optimization
- Query optimization patterns
- Caching strategies

---

**Document Status**: OUTLINE DRAFT
**Next Steps**: User approval → Expand each section with detailed content
