# State Management Architecture

**Version:** 6.0.0 | **Location:** `apps/web/src/stores/` | **Last Updated:** 2025-11-23

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Store Catalog](#3-store-catalog)
4. [Page-by-Page State Flow](#4-page-by-page-state-flow)
5. [Component State Interactions](#5-component-state-interactions)
6. [CRUD Operation Flows](#6-crud-operation-flows)
7. [Industry Standard Patterns](#7-industry-standard-patterns)
8. [Anti-Patterns & Solutions](#8-anti-patterns--solutions)
9. [Cache Strategy](#9-cache-strategy)
10. [Debugging Guide](#10-debugging-guide)
11. [Performance Metrics](#11-performance-metrics)

---

## 1. Overview

The PMO platform uses a **hybrid state management architecture** combining:

| Technology | Purpose | Scope |
|------------|---------|-------|
| **Zustand** | Client-side caching & UI state | 8 specialized stores |
| **React Query** | Server state synchronization | API data fetching |
| **React Context** | Auth & global providers | Cross-cutting concerns |

### Design Principles

1. **Single Source of Truth**: Backend metadata drives all rendering
2. **Separation of Concerns**: Server state (React Query) vs. client state (Zustand)
3. **Minimal Re-renders**: `getState()` for imperative access, `useShallow` for selective subscriptions
4. **TTL-based Caching**: Session-level (30 min) vs. short-lived (5 min)
5. **Optimistic Updates**: Immediate UI feedback with rollback on failure

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          STATE MANAGEMENT ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         ZUSTAND STORES (8 Total)                             │    │
│  ├───────────────────────┬───────────────────────┬─────────────────────────────┤    │
│  │   SESSION-LEVEL       │    URL-BOUND          │         MEMORY              │    │
│  │   (30 min TTL)        │    (5 min TTL)        │       (No persist)          │    │
│  ├───────────────────────┼───────────────────────┼─────────────────────────────┤    │
│  │ globalSettingsMeta    │ entityInstanceList    │ entityEditStore             │    │
│  │ datalabelMeta         │ entityInstanceData    │                             │    │
│  │ entityCodeMeta        │                       │                             │    │
│  │ entityComponentMeta   │                       │                             │    │
│  └───────────────────────┴───────────────────────┴─────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         REACT QUERY                                          │    │
│  │  • useEntityInstanceList() - Entity list fetching                            │    │
│  │  • useEntityInstance() - Single entity fetching                              │    │
│  │  • useEntityMutation() - CRUD with optimistic updates                        │    │
│  │  • useEntityCodes() - Entity type metadata                                   │    │
│  │  • useDatalabels() - Dropdown options                                        │    │
│  │  • useGlobalSettings() - Formatting settings                                 │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         REACT CONTEXT                                        │    │
│  │  • AuthContext - JWT token, user session                                     │    │
│  │  • SidebarContext - Navigation state                                         │    │
│  │  • EntityMetadataContext - Entity type registry (wraps Zustand)              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Store Catalog

### 3.1 Session-Level Stores (30 min TTL)

#### `globalSettingsMetadataStore`

**Purpose:** Cache global formatting settings
**File:** `stores/globalSettingsMetadataStore.ts`
**Source:** `GET /api/v1/settings/global`

```typescript
interface GlobalSettings {
  currency: { symbol: string; decimals: number; locale: string; position: string };
  date: { style: string; locale: string; format: string };
  timestamp: { style: string; locale: string; includeSeconds: boolean };
  boolean: { trueLabel: string; falseLabel: string; trueColor: string; falseColor: string };
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `setGlobalSettings(settings)` | Store settings from API |
| `getGlobalSettings()` | Retrieve cached settings (checks TTL) |
| `isExpired()` | Check if cache is stale |
| `clear()` | Invalidate cache |

**Consumers:** `frontEndFormatterService.tsx`, `EntityFormContainer`, `EntityDataTable`

---

#### `datalabelMetadataStore`

**Purpose:** Cache dropdown options for `dl__*` fields
**File:** `stores/datalabelMetadataStore.ts`
**Source:** `GET /api/v1/settings/datalabels/all` or `GET /api/v1/datalabel?name=<key>`

```typescript
interface DatalabelOption {
  id: number;
  name: string;
  descr?: string;
  parent_id: number | null;
  sort_order: number;
  color_code?: string;
  active_flag?: boolean;
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `setDatalabel(name, options)` | Store single datalabel |
| `setAllDatalabels(datalabels[])` | Store all datalabels at once |
| `getDatalabel(name)` | Get options for field (checks TTL) |
| `getAllDatalabels()` | Get all cached datalabels |
| `invalidate(name)` | Invalidate specific datalabel |
| `clear()` | Invalidate all datalabels |

**Consumers:** `EntityFormContainer`, `KanbanView`, `DAGVisualizer`

---

#### `entityCodeMetadataStore`

**Purpose:** Cache entity type definitions for sidebar navigation
**File:** `stores/entityCodeMetadataStore.ts`
**Source:** `GET /api/v1/entity/types`

```typescript
interface EntityCodeData {
  code: string;
  name: string;
  label: string;
  icon: string | null;
  descr?: string;
  child_entity_codes?: string[];
  parent_entity_codes?: string[];
  active_flag: boolean;
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `setEntityCodes(entities[])` | Store entity types (builds Map) |
| `getEntityCodes()` | Get array of entity types |
| `getEntityCodesMap()` | Get Map for O(1) lookup |
| `getEntityByCode(code)` | Get single entity by code |
| `isExpired()` | Check if cache is stale |
| `clear()` | Invalidate cache |

**Consumers:** `Sidebar`, `DynamicChildEntityTabs`, `EntityMetadataContext`

---

#### `entityComponentMetadataStore`

**Purpose:** Cache field metadata per entity:component pair
**File:** `stores/entityComponentMetadataStore.ts`
**Source:** Piggybacks on entity API responses (metadata field)

**Cache Key Format:** `"project:entityDataTable"`, `"task:entityFormContainer"`

```typescript
interface FieldMetadata {
  dtype: string;
  format: string;
  visible: boolean;
  filterable: boolean;
  sortable: boolean;
  editable: boolean;
  viewType: string;
  editType: string;
  label: string;
  // ... additional rendering hints
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `setComponentMetadata(entity, component, metadata)` | Store for specific component |
| `setAllComponentMetadata(entity, allMetadata)` | Store all components at once |
| `getComponentMetadata(entity, component)` | Get specific component metadata |
| `getAllComponentMetadata(entity)` | Get all components for entity |
| `invalidateEntity(entityCode)` | Invalidate all for entity |
| `clear()` | Invalidate all |

**Consumers:** `EntityDataTable`, `EntityFormContainer`, `KanbanView`, `GridView`

---

### 3.2 URL-Bound Stores (5 min TTL)

#### `entityInstanceListDataStore`

**Purpose:** Cache entity list data for tables/grids
**File:** `stores/entityInstanceListDataStore.ts`
**Source:** `GET /api/v1/{entity}?page=&pageSize=`

**Cache Key Format:** `"project:page=1&pageSize=100"`

```typescript
interface ListData {
  data: EntityInstance[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `setList(entityCode, queryHash, data)` | Store paginated list |
| `getList(entityCode, queryHash)` | Retrieve cached list (checks TTL) |
| `appendToList(entityCode, queryHash, items)` | Append for infinite scroll |
| `updateItemInList(entityCode, id, changes)` | Optimistic update |
| `removeFromList(entityCode, id)` | Optimistic delete |
| `invalidate(entityCode, queryHash?)` | Invalidate specific or all |
| `clear()` | Invalidate all |

**Consumers:** `EntityListOfInstancesPage`, `useEntityInstanceList`

---

#### `entityInstanceDataStore`

**Purpose:** Cache single entity instances for optimistic updates
**File:** `stores/entityInstanceDataStore.ts`
**Source:** `GET /api/v1/{entity}/{id}`

**Cache Key Format:** `"project:uuid-123"`

```typescript
interface CacheEntry {
  data: EntityInstance;
  timestamp: number;
  ttl: number;
  entityCode: string;
  isDirty: boolean;  // Has local changes not synced
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `setInstance(entityCode, id, data)` | Store entity data |
| `getInstance(entityCode, id)` | Retrieve cached data (checks TTL) |
| `updateInstance(entityCode, id, changes)` | Optimistic update |
| `markSynced(entityCode, id)` | Clear dirty flag after save |
| `isDirty(entityCode, id)` | Check for unsaved changes |
| `invalidate(entityCode, id)` | Invalidate specific instance |
| `invalidateEntity(entityCode)` | Invalidate all for entity |
| `clear()` | Invalidate all |

**Consumers:** `EntitySpecificInstancePage`, `useEntityInstance`, `useEntityMutation`

---

### 3.3 Memory Stores (No persistence)

#### `useEntityEditStore`

**Purpose:** Track dirty fields during inline editing
**File:** `stores/useEntityEditStore.ts`
**Source:** Local state only

```typescript
interface EditState {
  entityType: string | null;
  entityId: string | null;
  originalData: Record<string, any> | null;
  currentData: Record<string, any> | null;
  dirtyFields: Set<string>;
  isEditing: boolean;
  isSaving: boolean;
  saveError: string | null;
  undoStack: Array<{ field: string; value: any }>;
  redoStack: Array<{ field: string; value: any }>;
}
```

**Methods:**
| Method | Purpose |
|--------|---------|
| `startEdit(type, id, data)` | Initialize editing session |
| `updateField(key, value)` | Track field change |
| `updateMultipleFields(updates)` | Batch field updates |
| `saveChanges()` | PATCH only dirty fields |
| `cancelEdit()` | Revert to original |
| `undo()` / `redo()` | Navigation in change history |
| `hasChanges()` | Check if dirty |
| `getChanges()` | Get dirty field values |
| `reset()` | Clear all edit state |

**Consumers:** `EntitySpecificInstancePage`, `EntityFormContainerWithStore`, `useKeyboardShortcuts`

---

## 4. Page-by-Page State Flow

### 4.1 EntityListOfInstancesPage

**File:** `pages/shared/EntityListOfInstancesPage.tsx`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EntityListOfInstancesPage State Flow                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Mount] ──────────────────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. useEntityInstanceList(entityCode, params)                         │
│     │      ├── React Query checks cache → MISS → API fetch                   │
│     │      ├── API Response: { data, metadata, total }                       │
│     │      ├── Store data → entityInstanceListDataStore (5 min TTL)          │
│     │      └── Store metadata → entityComponentMetadataStore (30 min TTL)    │
│     │                                                                        │
│     ├── 2. useEntityMutation(entityCode)                                     │
│     │      └── Provides: updateEntity, deleteEntity, createEntity            │
│     │                                                                        │
│     └── 3. Local State                                                       │
│            ├── currentPage (pagination)                                      │
│            ├── editingRow (inline edit tracking)                             │
│            ├── editedData (inline edit values)                               │
│            └── localData (optimistic list updates)                           │
│                                                                              │
│  [User Clicks Row] ────────────────────────────────────────────────────────│
│     │                                                                        │
│     └── navigate(`/${entityCode}/${id}`)                                     │
│                                                                              │
│  [User Moves Kanban Card] ─────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. Optimistic UI update (local state)                                │
│     ├── 2. updateEntity({ id, data: { stage: newStage } })                   │
│     ├── 3. On success: React Query refetch                                   │
│     └── 4. On error: Rollback + refetch                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Console Log Sequence:**
```
[RENDER #1] 🖼️ EntityListOfInstancesPage: office
[API FETCH] 📡 useEntityInstanceList: office
[API FETCH] ✅ Received 5 items for office
[ListDataStore] Storing: office:page=1&pageSize=100
[EntityComponentStore] Storing: office:entityDataTable
[CACHE MISS] 💾 useEntityInstanceList: office
```

---

### 4.2 EntitySpecificInstancePage

**File:** `pages/shared/EntitySpecificInstancePage.tsx`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   EntitySpecificInstancePage State Flow                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Mount] ──────────────────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. useEntityInstance(entityCode, id)                                 │
│     │      ├── React Query checks cache → MISS → API fetch                   │
│     │      ├── API Response: { data, metadata, fields }                      │
│     │      └── Store data → entityInstanceDataStore (5 min TTL)              │
│     │                                                                        │
│     ├── 2. useDynamicChildEntityTabs(entityCode, id)                         │
│     │      ├── Access entityCodeMetadataStore.getState().getEntityByCode()   │
│     │      ├── Get child_entity_codes from cached entity type                │
│     │      └── Build tabs: [{ code, label, icon }, ...]                      │
│     │                                                                        │
│     ├── 3. useEntityEditStore (via useShallow selector)                      │
│     │      └── Select: { isEditing, dirtyFields, currentData }               │
│     │                                                                        │
│     ├── 4. useKeyboardShortcuts({ onSave, onCancel })                        │
│     │      └── Refs for callbacks to avoid re-renders                        │
│     │                                                                        │
│     └── 5. Child Tab Data (conditional)                                      │
│            └── useEntityChildList(entityCode, id, activeChildTab)            │
│                                                                              │
│  [User Clicks Edit] ───────────────────────────────────────────────────────│
│     │                                                                        │
│     └── useEntityEditStore.getState().startEdit(type, id, data)              │
│                                                                              │
│  [User Edits Field] ───────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. useEntityEditStore.getState().updateField(key, value)             │
│     ├── 2. Store adds to dirtyFields Set                                     │
│     └── 3. Store pushes to undoStack                                         │
│                                                                              │
│  [User Saves (Ctrl+S)] ────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. useEntityEditStore.getState().saveChanges()                       │
│     │      ├── Get only dirty fields via getChanges()                        │
│     │      └── PATCH /api/v1/{entity}/{id} with minimal payload              │
│     ├── 2. On success: Clear edit state, invalidate caches                   │
│     └── 3. On error: Keep edit state, show error                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Console Log Sequence:**
```
[RENDER #1] 🖼️ EntitySpecificInstancePage: office/uuid
[API FETCH] 📡 useEntityInstance: office/uuid
[EntityCodeStore] Cache HIT: office
[DynamicChildEntityTabs] Cache HIT for office
[API FETCH] ✅ Received entity office/uuid
[InstanceDataStore] Storing: office:uuid
[RENDER] EntityFormContainer: 19 fields from BACKEND METADATA
[CACHE MISS] 💾 useEntityInstance: office/uuid
```

---

### 4.3 EntityCreatePage

**File:** `pages/shared/EntityCreatePage.tsx`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EntityCreatePage State Flow                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Mount] ──────────────────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. useEntityMetadata(entityCode, 'entityFormContainer')              │
│     │      └── Access entityComponentMetadataStore.getState()                │
│     │                                                                        │
│     ├── 2. useAllDatalabels()                                                │
│     │      └── Prefetch all dropdown options                                 │
│     │                                                                        │
│     └── 3. Local State                                                       │
│            └── formData: {} (user input)                                     │
│                                                                              │
│  [User Submits Form] ──────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. POST /api/v1/{entity}                                             │
│     ├── 2. On success: navigate(`/${entity}/${newId}`)                       │
│     └── 3. Invalidate list caches via useCacheInvalidation()                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 SettingsOverviewPage / SettingDetailPage

**File:** `pages/setting/SettingsOverviewPage.tsx`, `pages/setting/SettingDetailPage.tsx`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Settings Page State Flow                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [SettingsOverviewPage] ───────────────────────────────────────────────────│
│     │                                                                        │
│     └── useAllDatalabels()                                                   │
│            ├── Fetches all datalabel categories                              │
│            └── Caches in datalabelMetadataStore (30 min TTL)                 │
│                                                                              │
│  [SettingDetailPage] ──────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. useDatalabels(settingName)                                        │
│     │      └── Get specific datalabel options                                │
│     │                                                                        │
│     └── 2. useDatalabelMutation(settingName)                                 │
│            ├── addItem(), updateItem(), deleteItem(), reorderItems()         │
│            └── Auto-invalidates both React Query + Zustand caches            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Component State Interactions

### 5.1 EntityDataTable

**File:** `components/shared/ui/EntityDataTable.tsx`

**State Sources:**
- Props: `data`, `metadata`, `pagination`, `editingRow`, `editedData`
- No direct store subscriptions (pure props-driven)

**Data Flow:**
```typescript
const columns = useMemo(() => {
  const componentMetadata = metadata?.entityDataTable;
  if (componentMetadata) {
    return Object.entries(componentMetadata)
      .filter(([_, meta]) => meta.visible)
      .map(([key, meta]) => ({
        key,
        title: meta.label,
        render: createRenderer(meta)
      }));
  }
  return [];
}, [metadata]);
```

---

### 5.2 EntityFormContainer

**File:** `components/shared/entity/EntityFormContainer.tsx`

**State Sources:**
- Props: `data`, `metadata`, `isEditing`, `onChange`, `datalabels`
- No direct store subscriptions (pure props-driven)

**Pattern:** `React.memo` with custom comparison to prevent re-renders during editing.

```typescript
const EntityFormContainer = React.memo(
  EntityFormContainerInner,
  (prev, next) => {
    if (prev.isEditing !== next.isEditing) return false;
    if (prev.metadata !== next.metadata) return false;
    // Only re-render if structure changes, not values during editing
    return true;
  }
);
```

---

### 5.3 EntityFormContainerWithStore

**File:** `components/shared/entity/EntityFormContainerWithStore.tsx`

**State Sources:**
- `useEntityEditStore` via `useShallow` selector (reactive)
- Props: `entityData`, `entityMetadata`, `entityType`, `entityId`

**Pattern:** Selective subscription to avoid full-store re-renders.

```typescript
const {
  currentData,
  dirtyFields,
  isEditing,
  updateField,
} = useEntityEditStore(useShallow(state => ({
  currentData: state.currentData,
  dirtyFields: state.dirtyFields,
  isEditing: state.isEditing,
  updateField: state.updateField,
})));

// Derive primitives from complex values
const hasChanges = dirtyFields.size > 0;
```

---

### 5.4 DynamicChildEntityTabs

**File:** `components/shared/entity/DynamicChildEntityTabs.tsx`

**State Sources:**
- `entityCodeMetadataStore` via `getState()` (imperative)
- Props: `parentType`, `parentId`

**Pattern:** `getState()` for one-time cache lookup, no subscription.

```typescript
export function useDynamicChildEntityTabs(parentType, parentId) {
  const [tabs, setTabs] = useState([]);

  // ✅ Imperative access via ref - no subscription
  const getEntityByCodeRef = useRef(
    useEntityCodeMetadataStore.getState().getEntityByCode
  );

  useEffect(() => {
    const getEntityByCode = getEntityByCodeRef.current;
    const cachedEntity = getEntityByCode(parentType);

    if (cachedEntity?.child_entity_codes) {
      const enrichedTabs = cachedEntity.child_entity_codes
        .map(code => getEntityByCode(code))
        .filter(Boolean);
      setTabs(enrichedTabs);
    }
  }, [parentType, parentId]);
}
```

---

### 5.5 useKeyboardShortcuts

**File:** `lib/hooks/useKeyboardShortcuts.ts`

**State Sources:**
- `useEntityEditStore` via `useShallow` selector (reactive)
- Props: `onSave`, `onCancel` stored in refs

**Pattern:** Ref pattern for callbacks to avoid dependency array changes.

```typescript
const onSaveRef = useRef(onSave);
const onCancelRef = useRef(onCancel);

useEffect(() => {
  onSaveRef.current = onSave;
  onCancelRef.current = onCancel;
}, [onSave, onCancel]);

const handleKeyDown = useCallback((event) => {
  if (event.key === 's' && modifier) {
    onSaveRef.current?.();  // Stable ref - no re-render
  }
}, [/* no callback deps */]);
```

---

## 6. CRUD Operation Flows

### 6.1 READ (List)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              READ (List) Flow                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Component                    Hook                      API / Store          │
│  ─────────                    ────                      ───────────          │
│  EntityListOfInstancesPage    useEntityInstanceList()   GET /api/v1/{entity} │
│                                                                              │
│  1. Component mounts                                                         │
│  2. Hook creates queryKey: ['entity-instance-list', entityCode, params]      │
│  3. React Query checks cache:                                                │
│     ├── HIT (< 5 min) → Return cached data                                   │
│     └── MISS → Fetch from API                                                │
│  4. API returns: { data, metadata, total, fields }                           │
│  5. Hook stores in Zustand:                                                  │
│     ├── entityInstanceListDataStore.setList()                                │
│     └── entityComponentMetadataStore.setComponentMetadata()                  │
│  6. Component receives data + metadata                                       │
│  7. EntityDataTable renders using metadata                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 READ (Single)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             READ (Single) Flow                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Component                     Hook                   API / Store            │
│  ─────────                     ────                   ───────────            │
│  EntitySpecificInstancePage    useEntityInstance()    GET /api/v1/{e}/{id}   │
│                                                                              │
│  1. Component mounts with id from URL params                                 │
│  2. Hook creates queryKey: ['entity-instance', entityCode, id]               │
│  3. React Query checks cache:                                                │
│     ├── HIT (< 5 min) → Return cached data                                   │
│     └── MISS → Fetch from API                                                │
│  4. API returns: { data, metadata, fields }                                  │
│  5. Hook stores in Zustand:                                                  │
│     └── entityInstanceDataStore.setInstance()                                │
│  6. Component receives entity data + metadata                                │
│  7. EntityFormContainer renders using metadata                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 CREATE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               CREATE Flow                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Component            Hook                  API / Store                      │
│  ─────────            ────                  ───────────                      │
│  EntityCreatePage     useEntityMutation()   POST /api/v1/{entity}            │
│                                                                              │
│  1. User fills form fields                                                   │
│  2. User clicks "Create"                                                     │
│  3. createEntity(formData) called                                            │
│  4. POST /api/v1/{entity} with formData                                      │
│  5. On success:                                                              │
│     ├── Invalidate React Query: ['entity-instance-list', entityCode]         │
│     ├── Invalidate Zustand: entityInstanceListDataStore.invalidate()         │
│     └── Navigate to detail page: navigate(`/${entity}/${newId}`)             │
│  6. On error: Show error message, keep form state                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 UPDATE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               UPDATE Flow                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Component                     Store                    API                  │
│  ─────────                     ─────                    ───                  │
│  EntitySpecificInstancePage    entityEditStore          PATCH /api/v1/{e}/{id}│
│                                                                              │
│  1. User clicks "Edit"                                                       │
│     └── startEdit(entityType, entityId, data)                                │
│  2. User modifies fields                                                     │
│     └── updateField(key, value) → adds to dirtyFields Set                    │
│  3. User saves (Ctrl+S or Save button)                                       │
│     ├── saveChanges() → getChanges() → only dirty fields                     │
│     └── PATCH /api/v1/{entity}/{id} with minimal payload                     │
│  4. On success:                                                              │
│     ├── Update originalData with server response                             │
│     ├── Clear dirtyFields Set                                                │
│     ├── Set isEditing = false                                                │
│     └── Invalidate ALL caches:                                               │
│           ├── React Query: invalidateQueries(entityInstance, entityList)     │
│           ├── entityInstanceDataStore.invalidate()                           │
│           └── entityInstanceListDataStore.invalidate()                       │
│  5. On error:                                                                │
│     ├── Keep edit state                                                      │
│     └── Display saveError                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 DELETE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               DELETE Flow                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Component                    Hook                   API / Store             │
│  ─────────                    ────                   ───────────             │
│  EntityListOfInstancesPage    useEntityMutation()    DELETE /api/v1/{e}/{id} │
│                                                                              │
│  1. User clicks "Delete" on row                                              │
│  2. Confirmation dialog shown                                                │
│  3. deleteEntity(id) called                                                  │
│  4. DELETE /api/v1/{entity}/{id}                                             │
│  5. On success:                                                              │
│     ├── Invalidate React Query: ['entity-instance', entityCode, id]          │
│     ├── Invalidate React Query: ['entity-instance-list', entityCode]         │
│     ├── Invalidate Zustand: entityInstanceDataStore.invalidate()             │
│     └── Invalidate Zustand: entityInstanceListDataStore.invalidate()         │
│  6. On error: Show error message                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Industry Standard Patterns

### 7.1 Server State vs. Client State Separation

| Category | Technology | Purpose |
|----------|------------|---------|
| **Server State** | React Query | Data that exists on server, needs syncing |
| **Client State** | Zustand | UI state, edit tracking, navigation |
| **Derived State** | useMemo | Computed from server/client state |

### 7.2 Selective Store Subscription (useShallow)

```typescript
// ✅ CORRECT: Only subscribe to needed slices
const { isEditing, dirtyFields } = useEntityEditStore(
  useShallow(state => ({
    isEditing: state.isEditing,
    dirtyFields: state.dirtyFields,
  }))
);

// ❌ WRONG: Subscribes to ALL state changes
const store = useEntityEditStore();
```

### 7.3 Imperative Store Access (getState())

```typescript
// ✅ CORRECT: No subscription in callbacks/effects
const invalidate = useCallback(() => {
  useEntityInstanceDataStore.getState().invalidate(entityCode, id);
}, [entityCode, id]);

// ❌ WRONG: Creates subscription that causes re-renders
const store = useEntityInstanceDataStore();
const invalidate = useCallback(() => {
  store.invalidate(entityCode, id);  // store in deps = re-renders
}, [store, entityCode, id]);
```

### 7.4 Ref Pattern for Callbacks

```typescript
// ✅ CORRECT: Store callbacks in refs
const onSaveRef = useRef(onSave);
useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

const handler = useCallback(() => {
  onSaveRef.current?.();  // No dependency on onSave
}, []);

// ❌ WRONG: Callback in dependency array
const handler = useCallback(() => {
  onSave?.();  // onSave changes every render = infinite loop
}, [onSave]);
```

### 7.5 Stable Array/Object References

```typescript
// ✅ CORRECT: useMemo for stable reference
const childData = useMemo(
  () => queryResult?.data || [],
  [queryResult?.data]
);

// ❌ WRONG: Creates new array every render
const childData = queryResult?.data || [];
```

### 7.6 Optimistic Updates with Rollback

```typescript
const updateMutation = useMutation({
  mutationFn: async ({ id, data }) => api.update(id, data),

  onMutate: async ({ id, data }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey });

    // Snapshot previous value
    const previousData = queryClient.getQueryData(queryKey);

    // Optimistically update cache
    queryClient.setQueryData(queryKey, (old) => ({
      ...old, data: { ...old.data, ...data }
    }));

    return { previousData };
  },

  onError: (error, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(queryKey, context.previousData);
  },

  onSettled: () => {
    // Always refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey });
  },
});
```

---

## 8. Anti-Patterns & Solutions

### 8.1 Full Store Subscription

```typescript
// ❌ ANTI-PATTERN: Re-renders on ANY store change
const store = useEntityEditStore();
const { isEditing } = store;

// ✅ SOLUTION: Selective subscription
const isEditing = useEntityEditStore(state => state.isEditing);

// ✅ SOLUTION (multiple values): useShallow
const { isEditing, dirtyFields } = useEntityEditStore(
  useShallow(state => ({
    isEditing: state.isEditing,
    dirtyFields: state.dirtyFields,
  }))
);
```

### 8.2 Unstable Default Values

```typescript
// ❌ ANTI-PATTERN: New array reference every render
const data = queryResult?.data || [];
useEffect(() => processData(data), [data]);  // Runs every render!

// ✅ SOLUTION: useMemo for stable reference
const data = useMemo(() => queryResult?.data || [], [queryResult?.data]);
```

### 8.3 Callback Props in Dependencies

```typescript
// ❌ ANTI-PATTERN: onSave changes every render
useKeyboardShortcuts({ onSave: () => saveData() });

// Inside hook:
const handler = useCallback(() => {
  onSave?.();
}, [onSave]);  // Infinite loop!

// ✅ SOLUTION: Ref pattern
const onSaveRef = useRef(onSave);
useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

const handler = useCallback(() => {
  onSaveRef.current?.();
}, []);  // Stable!
```

### 8.4 Selecting Functions from Stores

```typescript
// ❌ ANTI-PATTERN: Functions compared by reference
const { hasChanges, canUndo } = useEntityEditStore(state => ({
  hasChanges: state.hasChanges,  // New function ref each time
  canUndo: state.canUndo,
}));

// ✅ SOLUTION: Select primitives, derive booleans
const { dirtyFieldsSize, undoStackLength } = useEntityEditStore(
  useShallow(state => ({
    dirtyFieldsSize: state.dirtyFields.size,
    undoStackLength: state.undoStack.length,
  }))
);

const hasChanges = dirtyFieldsSize > 0;
const canUndo = undoStackLength > 0;
```

---

## 9. Cache Strategy

### 9.1 Cache Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CACHE HIERARCHY                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Layer 1: React Query Cache (Automatic)                                       │
│  ├── staleTime: 5 min (lists/details), 30 min (metadata)                      │
│  ├── gcTime: 2x staleTime                                                     │
│  └── refetchOnWindowFocus: false (disabled for stability)                     │
│                                                                               │
│  Layer 2: Zustand Session Cache (Manual)                                      │
│  ├── TTL: 30 minutes                                                          │
│  ├── Storage: sessionStorage (persists across page reloads)                   │
│  ├── Stores: globalSettings, datalabel, entityCode, entityComponent           │
│  └── Clear: On logout                                                         │
│                                                                               │
│  Layer 3: Zustand URL Cache (Manual)                                          │
│  ├── TTL: 5 minutes                                                           │
│  ├── Key: entityCode + queryHash                                              │
│  ├── Stores: entityInstanceList, entityInstance                               │
│  └── Clear: On entity mutation                                                │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Cache Invalidation Rules

| Event | Actions |
|-------|---------|
| **Create entity** | Invalidate list cache |
| **Update entity** | Invalidate instance + list caches |
| **Delete entity** | Invalidate instance + list caches |
| **Update datalabel** | Invalidate datalabel + React Query |
| **Navigation away** | React Query handles via queryKey |
| **Logout** | Clear all stores |

### 9.3 Cache TTL Constants

```typescript
export const CACHE_TTL = {
  // Session-level (30 minutes)
  SESSION: 30 * 60 * 1000,
  ENTITY_TYPES: 30 * 60 * 1000,
  DATALABELS: 30 * 60 * 1000,
  GLOBAL_SETTINGS: 30 * 60 * 1000,
  ENTITY_METADATA: 30 * 60 * 1000,

  // Short-lived (5 minutes)
  ENTITY_LIST: 5 * 60 * 1000,
  ENTITY_DETAIL: 5 * 60 * 1000,
};
```

---

## 10. Debugging Guide

### 10.1 Console Log Color Coding

| Color | Category | Example |
|-------|----------|---------|
| `#748ffc` (Blue) | Page Render | `[RENDER #1] 🖼️ EntityListOfInstancesPage` |
| `#ff6b6b` (Red) | API Fetch | `[API FETCH] 📡 useEntityInstanceList` |
| `#51cf66` (Green) | Cache HIT | `[CACHE HIT] 💾 useEntityInstance` |
| `#fcc419` (Yellow) | Cache MISS | `[CACHE MISS] 💾 useEntityInstanceList` |
| `#be4bdb` (Purple) | Store Update | `[EntityCodeStore] Storing 23 entity types` |
| `#4dabf7` (Cyan) | Store Cache | `[InstanceDataStore] Storing: office:uuid` |
| `#f783ac` (Pink) | Navigation | `[NAVIGATION] 🚀 Row clicked` |

### 10.2 Render Counter Pattern

```typescript
let renderCount = 0;

function MyComponent() {
  renderCount++;
  const renderIdRef = React.useRef(renderCount);

  console.log(
    `%c[RENDER #${renderIdRef.current}] MyComponent`,
    'color: #748ffc; font-weight: bold',
    { timestamp: new Date().toLocaleTimeString() }
  );

  // If renderCount exceeds 10 rapidly, you have a loop
}
```

### 10.3 Infinite Loop Diagnosis

**Symptoms:**
- Console logs repeating rapidly
- "Maximum update depth exceeded" error
- Browser tab unresponsive

**Common Causes:**
1. Full store subscription: `const store = useStore()`
2. Unstable reference: `|| []` without useMemo
3. Callback in deps: Function prop in useCallback/useEffect dependencies
4. Missing deps: useEffect without proper dependency array

**Diagnosis Steps:**
1. Add render counter to suspect component
2. Check useEffect dependencies for functions/objects
3. Look for store subscriptions without selectors
4. Check for `|| []` or `|| {}` without useMemo

---

## 11. Performance Metrics

### 11.1 Render Budget

| Page | Expected Renders | Cause |
|------|------------------|-------|
| EntityListOfInstancesPage | 4-6 | Mount + loading + data + metadata |
| EntitySpecificInstancePage | 6-8 | Mount + loading + entity + tabs + form |
| EntityCreatePage | 2-4 | Mount + metadata loading |
| EntityFormContainer | 1-2 | Only on metadata/editing change |

### 11.2 Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| First Load (cold) | < 500ms | Session cache prefetch |
| Navigation (warm) | < 100ms | URL cache hit |
| Edit Save | < 50ms perceived | Optimistic update |
| Render Count | < 10 per page | Proper memoization |

### 11.3 Optimization Checklist

- [ ] Use `useShallow` for multi-value store subscriptions
- [ ] Use `getState()` in callbacks/effects
- [ ] Wrap `|| []` with useMemo
- [ ] Store callback props in refs
- [ ] Derive booleans from primitives
- [ ] Use React.memo with custom comparison for form components

---

## Summary

The PMO state management architecture follows industry best practices:

| Pattern | Implementation | Benefit |
|---------|----------------|---------|
| **Server/Client Separation** | React Query + Zustand | Clear boundaries, appropriate tools |
| **Tiered Caching** | 30 min (session) + 5 min (URL) | Optimal freshness per data type |
| **Selective Subscription** | useShallow + getState() | Minimal re-renders |
| **Optimistic Updates** | Mutation with rollback | Instant UI feedback |
| **Ref Pattern** | Refs for callback props | Stable dependency arrays |
| **Backend-Driven Metadata** | API returns field definitions | Single source of truth |

---

**Version History:**
- v6.0.0 (2025-11-23): Complete rewrite with comprehensive CRUD flows, component interactions, industry patterns
- v5.1.0 (2025-11-23): Added anti-patterns, page flow analysis, debugging guide
- v5.0.0 (2025-11-22): Initial hybrid architecture documentation
