# Frontend Architecture - Component, Page & State Design

> **React 19, TypeScript, Backend-Driven Metadata, Zero Pattern Detection**
> Universal page system with 3 pages handling 27+ entity types dynamically
> Real-time sync via WebSocket invalidation (v8.4.0)

**Version:** 8.4.0 | **Last Updated:** 2025-11-27

---

## Semantics

The PMO frontend uses a **three-layer component architecture** (Base → Domain → Application) with universal pages that render any entity type using backend-driven metadata. All components use the v8.2.0 `{ viewType, editType }` structure via `extractViewType()` and `extractEditType()` helpers.

**Core Principle:** Backend sends complete `{ viewType, editType }` per component. Frontend is a pure renderer. No pattern detection.

---

## End-to-End Data Request Flow (v8.4.0)

The following diagrams show the complete data flow from user action through the system and back.

### 1. Initial Page Load (Cold Start)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         INITIAL LOAD (No Cache)                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

User visits /projects
        │
        ▼
┌──────────────────┐
│ ProjectListPage  │
│                  │
│ useFormattedList │
│ ('project')      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ useEntityInstanceList Hook                                                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. queryFn: apiClient.get('/api/v1/project', { params })                        │
│     ─────────────────────────────────────────────────────────────────────►       │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  HTTP GET /api/v1/project?limit=50
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Fastify API Server (Port 4000)                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. JWT Auth middleware → Extract userId                                         │
│                                                                                   │
│  2. RBAC Check:                                                                  │
│     entityInfra.get_entity_rbac_where_condition(userId, 'project', VIEW)         │
│                                                                                   │
│  3. Query PostgreSQL:                                                            │
│     SELECT * FROM app.project WHERE {rbacCondition} LIMIT 50                     │
│                                                                                   │
│  4. Build ref_data_entityInstance:                                               │
│     entityInfra.build_ref_data_entityInstance(data, 'project')                   │
│     └── { employee: { "uuid-1": "James Miller", "uuid-2": "..." } }              │
│                                                                                   │
│  5. Generate metadata:                                                           │
│     getEntityMetadata('project', data[0])                                        │
│     └── { entityDataTable: { viewType: {...}, editType: {...} } }                │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  HTTP 200 Response
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ API Response                                                                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│  {                                                                                │
│    "data": [                                                                      │
│      { "id": "uuid-1", "name": "Kitchen Renovation", "budget_allocated_amt": 50000,
│        "manager__employee_id": "uuid-james" }                                    │
│    ],                                                                             │
│    "ref_data_entityInstance": {                                                  │
│      "employee": { "uuid-james": "James Miller" }                                │
│    },                                                                             │
│    "metadata": {                                                                  │
│      "entityDataTable": {                                                        │
│        "viewType": {                                                             │
│          "budget_allocated_amt": { "renderType": "currency", ... },              │
│          "manager__employee_id": { "renderType": "entityInstanceId",             │
│                                     "lookupEntity": "employee" }                 │
│        },                                                                        │
│        "editType": { ... }                                                       │
│      }                                                                           │
│    },                                                                             │
│    "total": 25, "limit": 50, "offset": 0                                         │
│  }                                                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ React Query Cache + WebSocket Subscribe                                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. Cache RAW response:                                                          │
│     queryClient.setQueryData(['entity-instance-list', 'project', params], data)  │
│                                                                                   │
│  2. useAutoSubscribe sends WebSocket SUBSCRIBE:                                  │
│     ws.send({ type: 'SUBSCRIBE', payload: { entityCode: 'project',               │
│                                              entityIds: ['uuid-1', ...] } })      │
│     ─────────────────────────────────────────────────────────────────────►       │
│     PubSub stores in app.rxdb_subscription table                                 │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Format-at-Read (select transform)                                                 │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  select: (response) => formatDataset(response.data, response.metadata,           │
│                                       response.ref_data_entityInstance)          │
│                       │                                                          │
│                       ▼                                                          │
│  FormattedRow[] = [                                                              │
│    {                                                                             │
│      raw: { budget_allocated_amt: 50000, manager__employee_id: 'uuid-james' },   │
│      display: { budget_allocated_amt: '$50,000.00',                              │
│                 manager__employee_id: 'James Miller' },  // ← Resolved via refData
│      styles: { dl__project_stage: 'bg-blue-100 text-blue-700' }                  │
│    }                                                                             │
│  ]                                                                               │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Component        │
│ re-renders with  │
│ formattedData[]  │
│ isLoading: false │
└──────────────────┘
```

### 2. Subsequent Load (Warm Cache)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SUBSEQUENT LOAD (Cached)                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

User returns to /projects (or navigates from another page)
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ React Query Cache Check                                                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  queryClient.getQueryData(['entity-instance-list', 'project', params])           │
│                                                                                   │
│  Cache Status Check:                                                             │
│  ├── Data Age < 30s (staleTime): Return cached, no refetch                       │
│  └── Data Age > 30s: Return cached immediately, refetch in background            │
│                                                                                   │
│  ✓ INSTANT UI render (no loading spinner!)                                       │
│  ✓ Background refetch if stale                                                   │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ UI renders       │
│ IMMEDIATELY      │ ◄─── Stale-while-revalidate pattern
│ with cached data │
└──────────────────┘
```

### 3. Real-Time Update (Another User Edits)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         REAL-TIME SYNC (WebSocket)                               │
└─────────────────────────────────────────────────────────────────────────────────┘

User B edits project "Kitchen Renovation" (while User A is viewing)
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ User B's Browser                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  PATCH /api/v1/project/uuid-1                                                    │
│  Body: { "budget_allocated_amt": 75000 }                                         │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Fastify API Server                                                                │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. RBAC Check (EDIT permission)                                                 │
│  2. entityInfra.update_entity({ entity_code: 'project', ... })                   │
│                                                                                   │
│  3. TRANSACTION:                                                                 │
│     ├── UPDATE app.project SET budget_allocated_amt = 75000                      │
│     ├── UPDATE app.entity_instance (sync display name if changed)                │
│     └── Database TRIGGER fires:                                                  │
│         INSERT INTO app.logging (entity_code, entity_id, action, sync_status)   │
│         VALUES ('project', 'uuid-1', 1, 'pending')  -- action=1 is EDIT          │
│                                                                                   │
│  4. Return 200 OK to User B                                                      │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │ (up to 60 seconds later)
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PubSub Service - LogWatcher (Port 4001)                                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. Poll app.logging (every 60s):                                                │
│     SELECT * FROM app.logging WHERE sync_status = 'pending' AND action != 0     │
│     └── Found: { entity_code: 'project', entity_id: 'uuid-1', action: 1 }        │
│                                                                                   │
│  2. Query subscribers:                                                           │
│     SELECT * FROM app.rxdb_subscription                                          │
│     WHERE entity_code = 'project' AND entity_id = 'uuid-1'                       │
│     └── Found: User A (connection_id: 'conn-abc')                                │
│                                                                                   │
│  3. Push INVALIDATE via WebSocket:                                               │
│     connectionManager.getSocket('conn-abc').send(...)                            │
│                                                                                   │
│  4. Mark logs as sent:                                                           │
│     UPDATE app.logging SET sync_status = 'sent' WHERE id = ...                   │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  WebSocket message
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ User A's Browser - SyncProvider                                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  WebSocket receives:                                                             │
│  {                                                                                │
│    "type": "INVALIDATE",                                                         │
│    "payload": {                                                                   │
│      "entityCode": "project",                                                    │
│      "changes": [{ "entityId": "uuid-1", "action": "UPDATE", "version": 2 }]    │
│    }                                                                              │
│  }                                                                                │
│                                                                                   │
│  handleInvalidate():                                                             │
│  1. Check version (skip if already processed)                                    │
│  2. queryClient.invalidateQueries({                                              │
│       queryKey: ['entity-instance', 'project', 'uuid-1']                         │
│     })                                                                           │
│  3. queryClient.invalidateQueries({                                              │
│       queryKey: ['entity-instance-list', 'project'],                             │
│       exact: false  // Invalidate all project list queries                       │
│     })                                                                           │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         │  React Query auto-refetch
         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ REST API Refetch → Format-at-Read → Re-render                                     │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. GET /api/v1/project → Fresh data with budget = 75000                         │
│  2. Cache updated with new RAW data                                              │
│  3. select: formatDataset() transforms to FormattedRow[]                         │
│  4. Component re-renders automatically                                           │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ User A's UI      │
│ auto-updates!    │ ◄─── Budget now shows $75,000
│ No refresh needed│
└──────────────────┘
```

### 4. Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DATA FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │   User A    │         │   User B    │         │   User C    │
    │  (Browser)  │         │  (Browser)  │         │  (Browser)  │
    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
           │                       │                       │
    ┌──────▼──────┐         ┌──────▼──────┐         ┌──────▼──────┐
    │ React Query │         │ React Query │         │ React Query │
    │  (In-Memory │         │  (In-Memory │         │  (In-Memory │
    │   Cache)    │         │   Cache)    │         │   Cache)    │
    │             │         │             │         │             │
    │ + Zustand   │         │ + Zustand   │         │ + Zustand   │
    │  (metadata) │         │  (metadata) │         │  (metadata) │
    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
           │                       │                       │
           │ WebSocket             │ REST API              │ WebSocket
           │                       │                       │
           ▼                       ▼                       ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                     PubSub Service (4001)                        │
    │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
    │  │ Connection  │    │ Subscription│    │ LogWatcher  │          │
    │  │ Manager     │◄──►│ Manager     │◄──►│ (60s poll)  │          │
    │  └─────────────┘    └─────────────┘    └──────┬──────┘          │
    └─────────────────────────────────────────────────┼────────────────┘
                                                      │
    ┌─────────────────────────────────────────────────┼────────────────┐
    │                      REST API (4000)            │                │
    │  ┌─────────────┐    ┌─────────────┐    ┌───────▼───────┐        │
    │  │ Auth        │───►│ RBAC Check  │───►│ Entity Routes │        │
    │  │ Middleware  │    │             │    │               │        │
    │  └─────────────┘    └─────────────┘    └───────┬───────┘        │
    └─────────────────────────────────────────────────┼────────────────┘
                                                      │
    ┌─────────────────────────────────────────────────▼────────────────┐
    │                        PostgreSQL                                 │
    │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐   │
    │  │ app.project │    │ app.logging │    │ app.rxdb_subscription│   │
    │  │ app.task    │    │ (triggers)  │    │ (live subscriptions) │   │
    │  │ app.employee│    │             │    │                      │   │
    │  └─────────────┘    └─────────────┘    └─────────────────────┘   │
    └──────────────────────────────────────────────────────────────────┘
```

### 5. Cache TTL Configuration

| Layer | TTL | Purpose |
|-------|-----|---------|
| **Tier 2 - Reference Data** | 1 hour | Entity types, datalabels, global settings |
| **Tier 3 - Metadata** | 15 min | Field definitions, component schemas |
| **Tier 4 - Entity Lists** | 30s stale, 5m gc | Stale-while-revalidate for lists |
| **Tier 5 - Entity Details** | 10s stale, 2m gc | Near real-time for active editing |
| **Tier 6 - Reference Lookups** | 1 hour | ref_data_entityInstance name lookups |

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      THREE-LAYER COMPONENT HIERARCHY                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    APPLICATION LAYER                             │    │
│  │  EntityDataTable, EntityFormContainer, LabelsDataTable          │    │
│  │  KanbanView, CalendarView, GridView, DAGVisualizer              │    │
│  │  HierarchyGraphView, DynamicChildEntityTabs                     │    │
│  │                                                                  │    │
│  │  Props: data (FormattedRow[]), metadata ({ viewType, editType })│    │
│  │  Uses: extractViewType(), extractEditType()                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │ composes                                 │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      DOMAIN LAYER                                │    │
│  │  EntitySelect, EntityMultiSelect, DataLabelSelect               │    │
│  │  EntitySelectDropdown, EntityMultiSelectTags                    │    │
│  │                                                                  │    │
│  │  Props: Uses editType.lookupSource, editType.datalabelKey       │    │
│  │  Data: datalabelMetadataStore, entity-instance API              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │ wraps                                    │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       BASE LAYER                                 │    │
│  │  Select, MultiSelect, SearchableMultiSelect, BadgeDropdownSelect│    │
│  │  DebouncedInput, DebouncedTextarea                              │    │
│  │                                                                  │    │
│  │  Props: Generic value/onChange, no business logic               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Types (v8.2.0)

### ComponentMetadata Structure

```typescript
// v8.2.0: REQUIRED structure from backend
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

// ViewFieldMetadata - rendering instructions
interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', 'component', etc.
  component?: string;     // Component name when renderType='component' (e.g., 'DAGVisualizer')
  behavior: {
    visible?: boolean;    // Show in component
    sortable?: boolean;   // Allow sorting (tables)
    filterable?: boolean; // Show filter (tables)
    searchable?: boolean; // Include in search
  };
  style: {
    width?: string;
    align?: 'left' | 'center' | 'right';
    symbol?: string;      // Currency symbol
    decimals?: number;    // Decimal places
  };
  datalabelKey?: string;  // For badge fields
}

// EditFieldMetadata - input instructions
interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', etc.
  behavior: {
    editable?: boolean;   // Allow editing
  };
  validation: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  lookupSource?: 'datalabel' | 'entityInstance';
  datalabelKey?: string;  // For select fields
  lookupEntity?: string;  // For entity reference fields
}
```

### FormattedRow Structure

```typescript
// Output of formatDataset() via format-at-read
interface FormattedRow<T = Record<string, any>> {
  raw: T;                           // Original values (for mutations)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (for badges)
}
```

### Helper Functions

```typescript
// lib/formatters/index.ts

// Extract viewType from ComponentMetadata (REQUIRED)
function extractViewType(metadata: ComponentMetadata | null): Record<string, ViewFieldMetadata> | null {
  if (!metadata || !isValidComponentMetadata(metadata)) {
    console.error('[formatters] Invalid metadata - backend must send { viewType, editType }');
    return null;
  }
  return metadata.viewType;
}

// Extract editType from ComponentMetadata (REQUIRED)
function extractEditType(metadata: ComponentMetadata | null): Record<string, EditFieldMetadata> | null {
  if (!metadata || !isValidComponentMetadata(metadata)) {
    console.error('[formatters] Invalid metadata structure');
    return null;
  }
  return metadata.editType;
}

// Validate ComponentMetadata has required structure
function isValidComponentMetadata(metadata: any): boolean {
  return metadata && 'viewType' in metadata && typeof metadata.viewType === 'object';
}

// Check if data is already formatted
function isFormattedData(data: any): data is FormattedRow<any> {
  return data && typeof data === 'object' && 'raw' in data && 'display' in data;
}
```

---

## Component Layer Summary

### Application Layer (Business Logic)

| Component | File | Props (v8.2.0) |
|-----------|------|----------------|
| EntityDataTable | `ui/EntityDataTable.tsx` | `data: FormattedRow[]`, `metadata: { entityDataTable: ComponentMetadata }` |
| EntityFormContainer | `entity/EntityFormContainer.tsx` | `data`, `metadata: { entityFormContainer: ComponentMetadata }`, `formattedData?: FormattedRow` |
| KanbanView | `ui/KanbanView.tsx` | `data: FormattedRow[]`, `metadata`, `config.kanban.datalabelKey` |
| DAGVisualizer | `workflow/DAGVisualizer.tsx` | `nodes: DAGNode[]`, `currentNodeId?: number`, `onNodeClick?: (nodeId) => void` |
| DynamicChildEntityTabs | `entity/DynamicChildEntityTabs.tsx` | `parentEntityType`, `parentEntityId` |

### Domain Layer (Data-Aware)

| Component | File | Props |
|-----------|------|-------|
| EntitySelect | `ui/EntitySelect.tsx` | `entityCode` (from `editType.lookupEntity`) |
| DataLabelSelect | `ui/DataLabelSelect.tsx` | `datalabelKey` (from `editType.datalabelKey`) |
| EntityMultiSelect | `ui/EntityMultiSelect.tsx` | `entityCode` |

### Base Layer (No Data Dependencies)

| Component | File | Props |
|-----------|------|-------|
| Select | `ui/Select.tsx` | `options`, `value`, `onChange` |
| DebouncedInput | `ui/DebouncedInput.tsx` | `value`, `onChange`, `debounceMs` |
| BadgeDropdownSelect | `ui/BadgeDropdownSelect.tsx` | `options`, `value`, `onChange`, `disabled` |

---

## Page Architecture

### Universal Page System

```
┌─────────────────────────────────────────────────────────────────┐
│                     UNIVERSAL PAGE SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EntityListOfInstancesPage.tsx      → Handles ALL entity lists  │
│    ├── /project             (projects list)                    │
│    ├── /task                (tasks list)                       │
│    └── ... 27+ entities                                        │
│                                                                 │
│    Data: useFormattedEntityList(entityCode) → FormattedRow[]   │
│    Metadata: { entityDataTable: { viewType, editType } }        │
│                                                                 │
│  EntitySpecificInstancePage.tsx    → Handles ALL entity details │
│    ├── /project/:id         (project detail + child tabs)     │
│    ├── /task/:id            (task detail + child tabs)        │
│    └── ... 27+ entities                                        │
│                                                                 │
│    Data: useEntityInstance(entityCode, id)                      │
│    Metadata: { entityFormContainer: { viewType, editType } }    │
│                                                                 │
│  EntityFormPage.tsx                → Handles ALL entity forms   │
│    ├── /project/new         (create project)                  │
│    ├── /project/:id/edit    (edit project)                    │
│    └── ... 27+ entities                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Page to Component Data Flow

```
EntityListOfInstancesPage
─────────────────────────

1. useFormattedEntityList(entityCode, { limit: 1000 })
   │
2. Returns: { formattedData: FormattedRow[], metadata }
   │
3. Pass to view component based on viewMode:
   ├── 'table'    → <EntityDataTable data={formattedData} metadata={metadata} />
   ├── 'kanban'   → <KanbanView data={formattedData} metadata={metadata} />
   ├── 'grid'     → <GridView data={formattedData} metadata={metadata} />
   └── 'calendar' → <CalendarView data={formattedData} metadata={metadata} />

4. Component extracts metadata:
   const viewType = extractViewType(metadata.entityDataTable);
   const editType = extractEditType(metadata.entityDataTable);


EntitySpecificInstancePage
──────────────────────────

1. useEntityInstance(entityCode, id)
   │
2. Returns: { data, metadata }
   │
3. Pass to form container:
   <EntityFormContainer
     data={data}
     metadata={metadata}
     isEditing={isEditing}
     onChange={handleChange}
   />

4. Component extracts metadata:
   const viewType = extractViewType(metadata.entityFormContainer);
   const editType = extractEditType(metadata.entityFormContainer);
```

---

## State Management

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT (v8.4.0)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  REACT QUERY - Sole Data Cache + Real-Time Sync            │  │
│  │  ─────────────────────────────────────────────────────     │  │
│  │  • Stores RAW entity data only (no formatted strings)      │  │
│  │  • Format-at-read via `select` option (memoized)           │  │
│  │  • Stale-while-revalidate pattern                          │  │
│  │  • Automatic cache invalidation on mutations               │  │
│  │  • WebSocket-triggered invalidation (v8.4.0)               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SYNC PROVIDER - WebSocket Real-Time Sync (v8.4.0)         │  │
│  │  ─────────────────────────────────────────────────────     │  │
│  │  • Manages WebSocket connection to PubSub service (:4001)  │  │
│  │  • Auto-subscribe to loaded entity IDs                     │  │
│  │  • INVALIDATE messages trigger cache invalidation          │  │
│  │  • Exponential backoff reconnection                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ZUSTAND STORES - Metadata + UI State Only                 │  │
│  │  ─────────────────────────────────────────────────────     │  │
│  │  • entityComponentMetadataStore (15m TTL)                  │  │
│  │  • datalabelMetadataStore (1h TTL)                         │  │
│  │  • globalSettingsMetadataStore (1h TTL)                    │  │
│  │  • entityEditStore (no TTL) - UI state                     │  │
│  │                                                            │  │
│  │  ✗ NO entity data stored here (React Query only)           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useFormattedEntityList(entityCode, params)` | List with format-at-read + auto-subscribe | `{ formattedData: FormattedRow[], metadata }` |
| `useEntityInstance(entityCode, id)` | Single entity + auto-subscribe | `{ data, metadata }` |
| `useEntityMutation(entityCode)` | CRUD operations | `{ updateEntity, deleteEntity }` |
| `useSync()` | WebSocket sync context (v8.4.0) | `{ status, subscribe, unsubscribe }` |
| `useAutoSubscribe(entityCode, entityIds)` | Auto-manage subscriptions (v8.4.0) | `void` |
| `extractViewType(metadata)` | Get viewType from ComponentMetadata | `Record<string, ViewFieldMetadata>` |
| `extractEditType(metadata)` | Get editType from ComponentMetadata | `Record<string, EditFieldMetadata>` |

---

## Rendering Patterns

### View Mode Rendering

```typescript
// EntityDataTable cell rendering (VIEW MODE)
// Zero function calls per cell - direct property access

const formattedRecord = record as FormattedRow<any>;

if (formattedRecord.display && formattedRecord.styles !== undefined) {
  const displayValue = formattedRecord.display[column.key];
  const styleClass = formattedRecord.styles[column.key];

  // Badge field (has style)
  if (styleClass) {
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styleClass}`}>
        {displayValue}
      </span>
    );
  }

  // Regular field
  return <span>{displayValue}</span>;
}
```

### Edit Mode Rendering

```typescript
// EntityDataTable cell rendering (EDIT MODE)
// Uses backend metadata for input type

const editType = extractEditType(metadata.entityDataTable);
const editMeta = editType[column.key];

// v8.2.0: Backend metadata required - minimal fallback for text input
const metadata = editMeta || { inputType: 'text', label: column.key };

// Backend decides input type
renderEditModeFromMetadata(
  formattedRecord.raw[column.key],  // Raw value for editing
  metadata,
  (val) => onChange(id, column.key, val)
);
```

### renderEditModeFromMetadata Switch

```typescript
switch (metadata.inputType) {
  case 'currency':
  case 'number':
    return <input type="number" step={metadata.inputType === 'currency' ? '0.01' : '1'} />;

  case 'text':
    return <input type="text" />;

  case 'date':
    return <input type="date" />;

  case 'datetime':
    return <input type="datetime-local" />;

  case 'checkbox':
    return <input type="checkbox" />;

  case 'select':
    // Lookup options from datalabelMetadataStore or entity-instance API
    if (metadata.lookupSource === 'datalabel') {
      return <DataLabelSelect datalabelKey={metadata.datalabelKey} />;
    }
    if (metadata.lookupSource === 'entityInstance') {
      return <EntitySelect entityCode={metadata.lookupEntity} />;
    }
    return <select>{options}</select>;

  case 'textarea':
    return <textarea />;

  default:
    return <input type="text" />;
}
```

---

## Performance Optimizations

### Virtualization (EntityDataTable)

| Metric | Without Virtualization | With Virtualization (v8.2.0) |
|--------|------------------------|-------------------------------|
| DOM Nodes (1000 rows) | 10,000-23,000 | ~200-300 |
| Scroll FPS | 30-45fps | 60fps |
| Memory Usage | Baseline | -90% |
| Threshold | N/A | >50 rows |

### Format-at-Read Benefits

| Benefit | Description |
|---------|-------------|
| **Smaller Cache** | RAW data only (not formatted strings) |
| **Fresh Formatting** | Datalabel colors always current |
| **Multiple Views** | Same cache serves table, kanban, grid |
| **Memoization** | React Query auto-memoizes select transform |

### Optimization Patterns

| Pattern | Purpose | Location |
|---------|---------|----------|
| **extractViewType()** | Safe metadata access | `lib/formatters` |
| **FormattedRow** | Pre-computed display values | `select` transform |
| **Pre-computed Styles** | Zero allocations during scroll | `columnStylesMap` |
| **Passive Listeners** | Non-blocking scroll | `{ passive: true }` |
| **Stable Keys** | Better React reconciliation | `getItemKey` |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Direct `metadata.viewType` access | May fail on invalid structure | Use `extractViewType(metadata)` |
| Frontend pattern detection | Duplicates backend logic | Backend sends complete metadata |
| Storing entity data in Zustand | Dual cache, stale data | Use React Query only |
| Formatting in queryFn | Bloated cache | Use `select` option |
| Hardcoded field configs | Maintenance burden | Use backend metadata |
| Flat metadata structure | Removed in v8.2.0 | Use nested `{ viewType, editType }` |

---

## Component Checklist (v8.2.0)

When implementing a new component that consumes metadata:

- [ ] Import `extractViewType`, `extractEditType` from `@/lib/formatters`
- [ ] Extract metadata: `const viewType = extractViewType(metadata.entityDataTable)`
- [ ] Handle null case: `if (!viewType) return null` with error log
- [ ] Use `row.display[key]` for view mode rendering
- [ ] Use `row.styles[key]` for badge CSS classes
- [ ] Use `row.raw[key]` for edit mode values
- [ ] Use `editType[key].inputType` for input component selection
- [ ] Use `editType[key].lookupSource` for data-aware inputs

---

## File Reference

| File | Purpose |
|------|---------|
| `lib/formatters/types.ts` | ComponentMetadata, ViewFieldMetadata, EditFieldMetadata types |
| `lib/formatters/index.ts` | extractViewType, extractEditType, isValidComponentMetadata |
| `lib/formatters/datasetFormatter.ts` | formatDataset, formatRow, formatValue |
| `stores/entityComponentMetadataStore.ts` | Component metadata cache |
| `stores/datalabelMetadataStore.ts` | Dropdown options cache |
| `lib/hooks/useEntityQuery.ts` | React Query hooks + auto-subscribe integration |
| `lib/frontEndFormatterService.tsx` | renderViewModeFromMetadata, renderEditModeFromMetadata |
| `db/sync/SyncProvider.tsx` | WebSocket connection + cache invalidation (v8.4.0) |
| `db/sync/useAutoSubscribe.ts` | Automatic entity subscription (v8.4.0) |
| `db/sync/types.ts` | WebSocket message type definitions (v8.4.0) |

---

**Version:** 8.4.0 | **Last Updated:** 2025-11-27 | **Status:** Production Ready

**Recent Updates:**
- v8.4.0 (2025-11-27): **Real-Time WebSocket Sync**
  - Added `SyncProvider` to provider hierarchy (wraps EntityMetadataProvider)
  - Entity hooks (`useEntityInstanceList`, `useEntityInstance`) now auto-subscribe
  - Added `useSync()` and `useAutoSubscribe()` hooks
  - WebSocket connection to PubSub service (port 4001)
  - See `docs/caching/RXDB_SYNC_ARCHITECTURE.md` for full sync architecture
- v8.3.3 (2025-11-27):
  - Updated DAGVisualizer props: `nodes: DAGNode[]`, `currentNodeId?: number`, `onNodeClick?`
  - Added `component` property to ViewFieldMetadata for `renderType: 'component'` pattern
  - DAGVisualizer now uses `renderType: 'component'` + `component: 'DAGVisualizer'` (not `renderType: 'dag'`)
- v8.3.2 (2025-11-27): Renamed ColoredDropdown → BadgeDropdownSelect
