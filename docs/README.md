# PMO Platform Documentation

**Version:** 7.0.0 | **Last Updated:** 2025-11-24

---

## Documentation Index

| # | Document | Path | Purpose |
|---|----------|------|---------|
| 1 | RBAC_INFRASTRUCTURE.md | `docs/rbac/` | RBAC tables, permissions, entity_rbac patterns |
| 2 | entity-infrastructure.service.md | `docs/services/` | Entity infrastructure service API |
| 3 | STATE_MANAGEMENT.md | `docs/state_management/` | Zustand + React Query architecture |
| 4 | PAGE_ARCHITECTURE.md | `docs/pages/` | Page components and routing |
| 5 | frontEndFormatterService.md | `docs/services/` | Frontend formatter + format-at-fetch |
| 6 | backend-formatter.service.md | `docs/services/` | Backend metadata generation |

---

## Data Flow Architecture (v7.0.0)

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
│  │    data: [...],                                                    │     │
│  │    fields: ['id', 'name', 'budget_allocated_amt'],                 │     │
│  │    metadata: {                                                     │     │
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
│                   FRONTEND (apps/web) - v7.0.0 FORMAT-AT-FETCH              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  useEntityQuery.ts                                                          │
│  └── useEntityInstanceList('project', { view: 'entityDataTable' })          │
│       │                                                                     │
│       ├── React Query fetches API                                           │
│       │                                                                     │
│       ├── ✨ formatDataset() called ONCE at fetch time                      │
│       │    └── lib/formatters/datasetFormatter.ts                           │
│       │         ├── Formats ALL rows in single pass                         │
│       │         └── Returns: FormattedRow[] with display/styles             │
│       │                                                                     │
│       └── Returns: { data, formattedData, metadata, total }                 │
│                                                                             │
│  EntityListOfInstancesPage.tsx                                              │
│  └── const { data, formattedData, metadata } = queryResult;                 │
│       │                                                                     │
│       └── <EntityDataTable data={formattedData} metadata={metadata} />      │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  EntityDataTable Cell Rendering (Optimized)                        │     │
│  ├────────────────────────────────────────────────────────────────────┤     │
│  │  IF row.display exists (FormattedRow):                             │     │
│  │    └── row.display[key], row.styles[key]                           │     │
│  │        (Zero function calls per cell!)                             │     │
│  │                                                                    │     │
│  │  ELSE (fallback):                                                  │     │
│  │    └── renderViewModeFromMetadata(value, fieldMeta)                │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Format-at-Fetch Performance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE COMPARISON                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BEFORE (v6.x): Per-cell formatting during render                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • 100 rows × 10 columns = 1,000 formatValue() calls PER RENDER             │
│  • Each scroll/re-render triggers 1,000+ function calls                     │
│  • Result: Laggy scrolling, frame drops                                     │
│                                                                             │
│  AFTER (v7.0.0): Pre-formatted at fetch time                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • formatDataset() called ONCE when data arrives                            │
│  • Cell rendering = simple property access: row.display[key]                │
│  • Scrolling triggers ZERO formatting function calls                        │
│  • Result: Smooth 60fps scrolling                                           │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │  BENCHMARKS (100 rows × 10 columns)                               │      │
│  │  ─────────────────────────────────────────────────────────────    │      │
│  │  v6.x render time:    ~45ms per scroll frame                      │      │
│  │  v7.0.0 render time:  ~3ms per scroll frame                       │      │
│  │  Format time (once):  ~1-2ms                                      │      │
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
| EntityDataTable | `ui/EntityDataTable.tsx` | Universal data table (backend metadata-driven) |
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

### EntityListOfInstancesPage (v7.0.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EntityListOfInstancesPage State Flow                     │
│                    (Format-at-Fetch Optimization)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Mount]                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  │                                                                          │
│  ├─► useEntityInstanceList(entityCode, params)                              │
│  │   ├── React Query: cache check → MISS → API fetch                        │
│  │   ├── API Response: { data, metadata, total }                            │
│  │   ├── ✨ formatDataset(data, metadata) → formattedData                   │
│  │   ├── Store → entityInstanceListDataStore (5 min TTL)                    │
│  │   └── Store → entityComponentMetadataStore (30 min TTL)                  │
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
│  ├─► IF editing: Pass raw data to EntityDataTable                           │
│  │                                                                          │
│  └─► ELSE: Pass formattedData (optimal performance)                         │
│            └── Cell rendering: row.display[key] directly                    │
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

**Last Updated:** 2025-11-24 | **Version:** 7.0.0
