# AI-FIRST PROCESS OPERATING SYSTEM

**Version:** 8.1.0 | **Last Updated:** 2025-11-24

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, @tanstack/react-virtual |
| **State** | Zustand (client) + TanStack Query (server) |
| **Backend** | Fastify v5, TypeScript ESM, Drizzle ORM |
| **Database** | PostgreSQL 14+ (50 tables, 46 DDL files) |
| **Auth** | JWT + Person-based RBAC (7 permission levels) |
| **Infra** | AWS EC2/S3/Lambda, Terraform, Docker |

---

## Tooling

```bash
./tools/start-all.sh          # Start platform (Docker + API + Web)
./tools/db-import.sh          # Import/reset database
./tools/test-api.sh GET /api/v1/project  # Test endpoints
./tools/logs-api.sh -f        # Monitor API logs
./tools/logs-web.sh -f        # Monitor Web logs
./tools/restart-api.sh        # Restart API server
```

**Test Credentials:** `james.miller@huronhome.ca` / `password123`

---

## Documentation Index

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 1 | RBAC_INFRASTRUCTURE.md | `docs/rbac/` | RBAC tables, permissions, entity_rbac patterns |
| 2 | entity-infrastructure.service.md | `docs/services/` | Entity infrastructure service API |
| 3 | STATE_MANAGEMENT.md | `docs/state_management/` | Zustand + React Query architecture |
| 4 | PAGE_ARCHITECTURE.md | `docs/pages/` | Page components and routing |
| 5 | frontEndFormatterService.md | `docs/services/` | Frontend formatter + format-at-read |
| 6 | backend-formatter.service.md | `docs/services/` | Backend metadata generation |

---

## Data Flow Architecture (v8.1.0 - Format-at-Read + Virtualization)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (apps/api)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  routes.ts                                                                  │
│  └── generateEntityResponse(ENTITY_CODE, data, { components })             │
│       │                                                                     │
│       └── backend-formatter.service.ts                                      │
│            └── generateFieldMetadataForComponent(fieldName, component)      │
│                 │                                                           │
│                 ├── Checks YAML mappings (pattern-mapping.yaml)             │
│                 └── Returns: { viewType, editType, format, ... }            │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  API Response Structure                                            │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │  {                                                                 │     │
│  │    data: [...],              // RAW data (cached as-is)            │     │
│  │    fields: ['id', 'name', 'budget_allocated_amt'],                 │     │
│  │    metadata: {               // Rendering instructions             │     │
│  │      entityDataTable: {                                            │     │
│  │        budget_allocated_amt: {                                     │     │
│  │          viewType: 'currency',                                     │     │
│  │          symbol: '$', decimals: 2                                  │     │
│  │        }                                                           │     │
│  │      }                                                             │     │
│  │    }                                                               │     │
│  │  }                                                                 │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP Response
┌─────────────────────────────────────────────────────────────────────────────┐
│                   FRONTEND (apps/web) - v8.0.0 FORMAT-AT-READ               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  useEntityQuery.ts                                                          │
│  └── useFormattedEntityList('project', { view: 'entityDataTable' })         │
│       │                                                                     │
│       ├── React Query fetches API → caches RAW data                         │
│       │                                                                     │
│       ├── ✨ `select` option transforms raw → formatted ON READ             │
│       │    └── lib/formatters/datasetFormatter.ts                           │
│       │         ├── formatDataset(data, metadata) called by select          │
│       │         └── Returns: FormattedRow[] with display/styles             │
│       │                                                                     │
│       └── Returns: { data: FormattedRow[], formattedData, metadata }        │
│                                                                             │
│  EntityListOfInstancesPage.tsx                                              │
│  └── const { data: formattedData, metadata } = queryResult;                 │
│       │                                                                     │
│       └── <EntityDataTable data={formattedData} metadata={metadata} />      │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  EntityDataTable Cell Rendering (Optimized v8.1.0)                 │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │  ✅ Virtualization: Only render visible rows (DOM: ~20 vs 1000)    │     │
│  │  ✅ Overscan: 3 rows (reduced from 10)                             │     │
│  │  ✅ Passive Listeners: Non-blocking scroll (60fps)                 │     │
│  │  ✅ Pre-computed Styles: Map<string, CSSProperties> (zero alloc)   │     │
│  │  ✅ Stable Keys: getItemKey for React reconciliation               │     │
│  │                                                                    │     │
│  │  IF row.display exists (FormattedRow):                             │     │
│  │    └── row.display[key], row.styles[key]                           │     │
│  │        (Zero function calls per cell!)                             │     │
│  │                                                                    │     │
│  │  ELSE (fallback for raw data):                                     │     │
│  │    └── Simple String(value) display                                │     │
│  │                                                                    │     │
│  │  Result: 98% fewer DOM nodes, 60fps scrolling, 90% less memory     │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Format-at-Read Architecture (v8.0.0+)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE (v8.1.0)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  v8.0.0: Format-at-Read Pattern                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Cache stores RAW data only (smaller, canonical)                          │
│  • `select` option transforms raw → formatted on each read                  │
│  • React Query memoizes select - only re-formats when raw data changes      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  FORMAT-AT-READ BENEFITS                                          │      │
│  │  ─────────────────────────────────────────────────────────────    │      │
│  │  • Smaller cache (raw data only, not formatted strings)           │      │
│  │  • Always fresh formatting (datalabel colors updated instantly)   │      │
│  │  • Same cache, different formats (table vs kanban vs grid)        │      │
│  │  • Memoized by React Query (zero unnecessary re-formats)          │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│  v8.1.0: Virtualization + Performance (current)                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • @tanstack/react-virtual for DOM virtualization (threshold: 50 rows)      │
│  • Overscan: 3 rows (reduced from 10)                                       │
│  • Passive scroll listeners (non-blocking, 60fps)                           │
│  • Pre-computed styles via useMemo Map (zero allocations during scroll)     │
│  • Stable keys via getItemKey (better React reconciliation)                 │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  PERFORMANCE GAINS                                                │      │
│  │  ─────────────────────────────────────────────────────────────    │      │
│  │  • 98% fewer DOM nodes (1000 rows: 10,000 → 200 nodes)            │      │
│  │  • 60fps consistent scrolling (from 30-45fps legacy)              │      │
│  │  • 90% memory reduction for large datasets                        │      │
│  │  • Instant scroll response (from ~16ms latency legacy)            │      │
│  │  • Threshold: >50 rows → virtualized, ≤50 → regular rendering     │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Three-Layer Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPONENT ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        APPLICATION LAYER                              │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  EntityDataTable    EntityFormContainer    LabelsDataTable            │  │
│  │  KanbanView         CalendarView           GridView                   │  │
│  │  DAGVisualizer      HierarchyGraphView     DynamicChildEntityTabs     │  │
│  │                                                                       │  │
│  │  (Business logic, state management, API integration)                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    │ composes                               │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          DOMAIN LAYER                                 │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  EntitySelect       EntityMultiSelect      DataLabelSelect            │  │
│  │  EntitySelectDropdown                      EntityMultiSelectTags      │  │
│  │                                                                       │  │
│  │  (Data-aware components with useQuery hooks)                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    │ wraps                                  │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           BASE LAYER                                  │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  Select             MultiSelect            SearchableMultiSelect      │  │
│  │  ColoredDropdown    Button                 Input                      │  │
│  │                                                                       │  │
│  │  (Generic, reusable, no business logic, props-driven)                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
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
| EntityDataTable | `ui/EntityDataTable.tsx` | Universal data table (backend metadata-driven, virtualized >50 rows) |
| EntityFormContainer | `entity/EntityFormContainer.tsx` | Universal form (backend metadata-driven) |
| LabelsDataTable | `ui/LabelsDataTable.tsx` | Labels/datalabel table (fixed schema) |
| KanbanView | `ui/KanbanView.tsx` | Kanban board with drag-drop |
| CalendarView | `ui/CalendarView.tsx` | Calendar event view |
| GridView | `ui/GridView.tsx` | Card grid view |
| DAGVisualizer | `workflow/DAGVisualizer.tsx` | Workflow/stage graph view |
| HierarchyGraphView | `hierarchy/HierarchyGraphView.tsx` | Parent-child hierarchy graph |
| DynamicChildEntityTabs | `entity/DynamicChildEntityTabs.tsx` | Dynamic child tabs |

---

## Universal Page System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          UNIVERSAL PAGE SYSTEM                              │
│                    (3 pages handle 27+ entity types)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  EntityListOfInstancesPage.tsx                                        │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  Handles ALL entity list views                                        │  │
│  │                                                                       │  │
│  │  /project          → projects list                                    │  │
│  │  /task             → tasks list                                       │  │
│  │  /employee         → employees list                                   │  │
│  │  /...              → 27+ entities                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  EntitySpecificInstancePage.tsx                                       │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  Handles ALL entity detail views                                      │  │
│  │                                                                       │  │
│  │  /project/:id      → project detail + child tabs                      │  │
│  │  /task/:id         → task detail + child tabs                         │  │
│  │  /employee/:id     → employee detail + child tabs                     │  │
│  │  /...              → 27+ entities                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  EntityFormPage.tsx                                                   │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │  Handles ALL entity forms                                             │  │
│  │                                                                       │  │
│  │  /project/new      → create project                                   │  │
│  │  /project/:id/edit → edit project                                     │  │
│  │  /...              → 27+ entities                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                    │                                        │
│                                    ▼                                        │
│                    Backend Metadata Drives ALL Rendering                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Page State Flows

### EntityListOfInstancesPage (v8.1.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EntityListOfInstancesPage State Flow                     │
│           (Format-at-Read + Virtualization for >50 rows)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Mount]                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  ├─► useFormattedEntityList(entityCode, params)                             │
│  │   ├── React Query: cache check → MISS → API fetch                        │
│  │   ├── API Response: { data, metadata, total } → cached RAW               │
│  │   ├── ✨ `select` transforms raw → formatted ON READ                     │
│  │   │    └── formatDataset(data, metadata) in select callback              │
│  │   └── Returns: FormattedRow[] with display/styles                        │
│  │                                                                          │
│  ├─► useEntityMutation(entityCode)                                          │
│  │   └── Provides: updateEntity, deleteEntity, createEntity                 │
│  │                                                                          │
│  └─► Local State                                                            │
│      ├── currentPage (pagination)                                           │
│      ├── editingRow (inline edit tracking)                                  │
│      └── localData (optimistic updates)                                     │
│                                                                             │
│  [Table Rendering]                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  ├─► IF data.length > 50: Use @tanstack/react-virtual                       │
│  │   ├── Render only visible rows (~20) + overscan (3)                      │
│  │   ├── Pre-computed styles (Map<string, CSSProperties>)                   │
│  │   ├── Passive scroll listeners (non-blocking)                            │
│  │   └── Stable keys via getItemKey                                         │
│  │                                                                          │
│  ├─► ELSE: Regular rendering (all rows)                                     │
│  │                                                                          │
│  ├─► IF editing: Use row.raw for edit inputs                                │
│  │                                                                          │
│  └─► ELSE: Use row.display[key] for view (zero function calls)              │
│                                                                             │
│  Performance: 98% fewer DOM nodes, 60fps scrolling, 90% memory reduction    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### EntitySpecificInstancePage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EntitySpecificInstancePage State Flow                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Mount]                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  ├─► useEntityInstance(entityCode, id)                                      │
│  │   ├── React Query: cache check → MISS → API fetch                        │
│  │   ├── API Response: { data, metadata, fields }                           │
│  │   └── Store → entityInstanceDataStore (5 min TTL)                        │
│  │                                                                          │
│  ├─► useDynamicChildEntityTabs(entityCode, id)                              │
│  │   ├── Access entityCodeMetadataStore → child_entity_codes                │
│  │   └── Build tabs: [{ code, label, icon }, ...]                           │
│  │                                                                          │
│  ├─► useEntityEditStore (via useShallow)                                    │
│  │   └── { isEditing, dirtyFields, currentData }                            │
│  │                                                                          │
│  └─► useKeyboardShortcuts                                                   │
│      └── Ctrl+S (save), Ctrl+Z (undo), Escape (cancel)                      │
│                                                                             │
│  [Edit Flow]                                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  ├─► Click Edit → startEdit(entityCode, id, data)                           │
│  ├─► Type → updateField(key, value) → dirtyFields.add(key)                  │
│  └─► Save → PATCH /api/v1/{entity}/{id} (minimal payload)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### EntityCreatePage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EntityCreatePage State Flow                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Mount]                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  ├─► useEntityMetadata(entityCode, 'entityFormContainer')                   │
│  │   └── Access entityComponentMetadataStore                                │
│  │                                                                          │
│  ├─► useAllDatalabels()                                                     │
│  │   └── Prefetch all dropdown options                                      │
│  │                                                                          │
│  └─► Local State: formData: {}                                              │
│                                                                             │
│  [Submit]                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  ├─► POST /api/v1/{entity}                                                  │
│  ├─► Success → navigate(`/${entity}/${newId}`)                              │
│  └─► Invalidate list caches                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### SettingsPage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Settings Page State Flow                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [SettingsOverviewPage]                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  └─► useAllDatalabels()                                                     │
│      ├── Fetches all datalabel categories                                   │
│      └── Caches in datalabelMetadataStore (30 min TTL)                      │
│                                                                             │
│  [SettingDetailPage]                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  ├─► useDatalabels(settingName)                                             │
│  │   └── Get specific datalabel options                                     │
│  │                                                                          │
│  └─► useDatalabelMutation(settingName)                                      │
│      ├── addItem(), updateItem(), deleteItem(), reorderItems()              │
│      └── Auto-invalidates React Query + Zustand caches                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FormattedRow Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FormattedRow Type                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  interface FormattedRow<T> {                                                │
│    raw: T;                        // Original values (mutations, sorting)   │
│    display: Record<string, string>; // Pre-formatted display strings        │
│    styles: Record<string, string>;  // CSS classes (badges only)            │
│  }                                                                          │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Example                                                              │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │                                                                       │  │
│  │  raw: {                                                               │  │
│  │    id: 'uuid-123',                                                    │  │
│  │    budget_allocated_amt: 50000,                                       │  │
│  │    dl__project_stage: 'planning'                                      │  │
│  │  }                                                                    │  │
│  │                                                                       │  │
│  │  display: {                                                           │  │
│  │    id: 'uuid-123...',                                                 │  │
│  │    budget_allocated_amt: '$50,000.00',                                │  │
│  │    dl__project_stage: 'Planning'                                      │  │
│  │  }                                                                    │  │
│  │                                                                       │  │
│  │  styles: {                                                            │  │
│  │    dl__project_stage: 'bg-blue-100 text-blue-700'                     │  │
│  │  }                                                                    │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

entity data table inline edit feature: 

 ┌──────────────────────────────────────────────────────────┐
  │           INLINE EDIT FLOW (Fixed)                       │
  ├──────────────────────────────────────────────────────────┤
  │                                                           │
  │  1. User clicks Edit icon (✏️)                           │
  │     └── onClick extracts: record.raw.id ✅                │
  │     └── setEditingRow(recordId) → Edit mode ON           │
  │                                                           │
  │  2. Fields become editable                                │
  │     └── Shows input fields, dropdowns, date pickers      │
  │                                                           │
  │  3. User edits values                                     │
  │     └── onInlineEdit updates editedData state            │
  │                                                           │
  │  4. User clicks Save (✓)                                  │
  │     └── handleSaveInlineEdit extracts: record.raw.id ✅   │
  │     └── PATCH /api/v1/project/{id} with changes          │
  │     └── Refetches data, exits edit mode                  │
  │                                                           │
  │  5. User clicks Cancel (✗)                                │
  │     └── handleCancelInlineEdit clears state              │
  │     └── Exits edit mode without saving                   │
  │                                                           │
  └──────────────────────────────────────────────────────────┘


 Complete Data Flow (Fixed)

  ┌─────────────────────────────────────────────────────────────────────┐
  │  API Response                                                        │
  │  {                                                                   │
  │    data: [{ dl__project_stage: 'planning' }],                       │
  │    metadata: {                                                       │
  │      dl__project_stage: {                                            │
  │        viewType: 'badge',           ← formatBadge() will be called  │
  │        datalabelKey: 'dl__project_stage'                             │
  │      }                                                               │
  │    },                                                                │
  │    datalabels: [                                                     │
  │      {                                                               │
  │        name: 'dl__project_stage',                                    │
  │        options: [                                                    │
  │          { name: 'planning', color_code: 'blue' }  ← Database value │
  │        ]                                                             │
  │      }                                                               │
  │    ]                                                                 │
  │  }                                                                   │
  └─────────────────────────────────────────────────────────────────────┘
                                │
                                ├──────────────────────────────────┐
                                ▼                                  ▼
                 ┌───────────────────────────┐   ┌─────────────────────────┐
                 │  datalabelMetadataStore   │   │  React Query Cache      │
                 │  (Zustand)                │   │  (RAW data)             │
                 ├───────────────────────────┤   └─────────────────────────┘
                 │  'dl__project_stage' →    │                │
                 │  [{ name: 'planning',     │                │
                 │     color_code: 'blue' }] │                │
                 └───────────────────────────┘                │
                                │                             │
                                │                             ▼
                                │              ┌──────────────────────────┐
                                │              │  select: formatDataset() │
                                │              │  (format-at-read)        │
                                │              └──────────────────────────┘
                                │                             │
                                │                             ▼
                                │              ┌──────────────────────────┐
                                │              │  formatRow()             │
                                │              └──────────────────────────┘
                                │                             │
                                │                             ▼
                                │              ┌──────────────────────────┐
                                │              │  formatValue()           │
                                │              │  (detects viewType)      │
                                │              └──────────────────────────┘
                                │                             │
                                │              viewType = 'badge'
                                │                             │
                                │                             ▼
                                └──────────────►┌──────────────────────────┐
                                                │  formatBadge()           │
                                                │  1. Lookup datalabel     │
                                                │  2. Find color_code      │
                                                │  3. ✅ Convert to CSS    │
                                                │     colorCodeToTailwind  │
                                                │     ("blue" → classes)   │
                                                └──────────────────────────┘
                                                               │
                                                               ▼
                                ┌──────────────────────────────────────────┐
                                │  FormattedRow                            │
                                │  {                                       │
                                │    raw: { dl__project_stage: 'planning' }│
                                │    display: { dl__project_stage: 'Plann' }│
                                │    styles: {                             │
                                │      dl__project_stage:                  │
                                │        'bg-blue-100 text-blue-700' ✅    │
                                │    }                                     │
                                │  }                                       │
                                └──────────────────────────────────────────┘
                                                               │
                                                               ▼
                                ┌──────────────────────────────────────────┐
                                │  Component Rendering                     │
                                │  <span className={row.styles[key]}>      │
                                │    {row.display[key]}                    │
                                │  </span>                                 │
                                │                                          │
                                │  → Blue badge with proper styling! ✅    │
                                └──────────────────────────────────────────┘

  1. Updated BackendFieldMetadata Interface (frontEndFormatterService.tsx)
  // Added component-specific rendering fields (backend-driven)
  EntityFormContainer_viz_container?: 'DAGVisualizer' | 'MetadataTable' | 'ProgressBar' | 'DateRangeVisualizer';
  EntityDataTable_edit_component?: 'ColoredDropdown' | 'select' | 'input';

  2. EntityFormContainer.tsx - Added metadata conversion logic
  // Convert viewType to viz_container (backend-driven visualization)
  let vizContainer = fieldMeta.EntityFormContainer_viz_container;
  if (!vizContainer && fieldMeta.viewType === 'dag') {
    vizContainer = 'DAGVisualizer';
  } else if (!vizContainer && fieldKey === 'metadata') {
    vizContainer = 'MetadataTable';
  }

  3. EntityFormContainerWithStore.tsx - Same conversion logic for store-based form

  How It Works Now

  Backend Sends Component-Specific Metadata:
  {
    "metadata": {
      "entityDataTable": {
        "dl__project_stage": {
          "viewType": "badge",     // Shows badge in table
          "editType": "select"     // Shows dropdown in table
        }
      },
      "entityFormContainer": {
        "dl__project_stage": {
          "viewType": "dag",       // Shows DAG in form
          "editType": "select"     // Interactive DAG in edit mode
        }
      }
    }
  }

  Frontend Rendering:

  | Component           | DAG Fields View Mode | DAG Fields Edit Mode      |
  |---------------------|----------------------|---------------------------|
  | EntityDataTable     | Badge (colored chip) | ColoredDropdown           |
  | EntityFormContainer | DAGVisualizer        | Interactive DAGVisualizer |

  Backend-Driven Flow

  Backend Formatter Service
  ├── For entityDataTable: sets viewType: 'badge'
  └── For entityFormContainer: sets viewType: 'dag'
           ↓
  Frontend EntityFormContainer
  ├── Reads metadata.entityFormContainer
  ├── Converts viewType: 'dag' → EntityFormContainer_viz_container: 'DAGVisualizer'
  └── Renders DAGVisualizer component
           ↓
  Frontend EntityDataTable
  ├── Reads metadata.entityDataTable (viewType: 'badge')
  ├── Uses renderEditModeFromMetadata() for inline editing
  └── Shows ColoredDropdown (not DAG)
  

**Last Updated:** 2025-11-24 | **Version:** 8.1.0

