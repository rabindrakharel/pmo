## Documentation Index

1. RBAC_INFRASTRUCTURE.md
Path: docs/rbac/RBAC_INFRASTRUCTURE.md Unified RBAC documentation covering all 4 infrastructure tables (entity, entity_instance, entity_instance_link, entity_rbac). Used by API routes for permission checking and by LLMs when implementing RBAC features. Keywords: RBAC, permissions, entity_rbac, entity_instance_link, entity_instance, Permission enum, VIEW, COMMENT, CONTRIBUTE, EDIT, SHARE, DELETE, CREATE, OWNER, ALL_ENTITIES_ID, check_entity_rbac, set_entity_rbac_owner, get_entity_rbac_where_condition, hard delete, soft delete, person-based RBAC, role-based permissions
2. entity-infrastructure.service.md
Path: docs/services/entity-infrastructure.service.md Core service documentation for centralized entity infrastructure management. Used by all entity route handlers for registry operations, linkage, and RBAC enforcement. Keywords: EntityInfrastructureService, set_entity_instance_registry, update_entity_instance_registry, delete_entity_instance_registry, set_entity_instance_link, get_entity_instance_link_children, delete_entity_instance_link, Permission levels 0-7, parent_entity_code, child_entity_code, idempotent, transactional methods, create_entity, update_entity, delete_entity
3. STATE_MANAGEMENT.md
Path: docs/state_management/STATE_MANAGEMENT.md Zustand + React Query hybrid architecture for client-side state management and caching. Used by frontend components for data fetching, caching, and edit state tracking. Keywords: Zustand, React Query, 9 stores, session-level cache, URL-bound cache, 30 min TTL, 5 min TTL, globalSettingsMetadataStore, datalabelMetadataStore, entityCodeMetadataStore, EntityListOfInstancesDataStore, EntitySpecificInstanceDataStore, entityComponentMetadataStore, editStateStore, dirtyFields, optimistic updates, cache invalidation, field-level tracking, minimal PATCH, prefetching
4. PAGE_ARCHITECTURE.md
Path: docs/pages/PAGE_ARCHITECTURE.md Comprehensive page and component architecture documentation. Used by LLMs when implementing new pages, understanding navigation flow, or modifying existing components. Keywords: EntityListOfInstancesPage, EntitySpecificInstancePage, EntityCreatePage, SettingsOverviewPage, SettingDetailPage, WikiViewPage, WikiEditorPage, FormBuilderPage, EntityDataTable, EntityFormContainer, LabelsDataTable, WikiDesigner, DynamicChildEntityTabs, Layout, ViewSwitcher, KanbanView, GridView, CalendarView, FilePreview, DragDropFileUpload, InteractiveForm, entityConfig.ts, universal pages, config-driven, Create-Link-Redirect, parent context, child entity tabs, datalabel URL conversion, position-based IDs, block editor, Notion-style

5. FORMAT_AT_FETCH (v7.0.0)
Path: apps/web/src/lib/formatters/ Performance optimization module that formats data once at fetch time instead of per-cell at render time. Used by useEntityInstanceList hook and EntityDataTable for optimal scroll performance. Keywords: formatDataset, formatRow, FormattedRow, valueFormatters, format-at-fetch, display, styles, currency formatting, badge formatting, date formatting, render optimization, scroll performance, pre-formatted data, datasetFormatter

---

DATA FLOW / REQUEST - RESPONSE FLOW (v7.0.0 Format-at-Fetch):
 ┌─────────────────────────────────────────────────────────────────────────┐
  │ BACKEND (apps/api)                                                      │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                         │
  │  project/routes.ts:387                                                  │
  │  └── generateEntityResponse(ENTITY_CODE, data, { components })          │
  │       │                                                                 │
  │       └── backend-formatter.service.ts:1741                             │
  │            └── generateFieldMetadataForComponent(fieldName, component)  │
  │                 │                                                       │
  │                 ├── Checks YAML mappings (pattern-mapping.yaml)         │
  │                 ├── Returns: { format: 'entityInstance_Id', ... }       │
  │                 │                                                       │
  │                 └── API Response:                                       │
  │                      {                                                  │
  │                        data: [...projects...],                          │
  │                        fields: ['id', 'name', 'manager__employee_id'],  │
  │                        metadata: {                                      │
  │                          entityDataTable: {                             │
  │                            manager__employee_id: {                      │
  │                              format: 'entityInstance_Id',               │
  │                              viewType: 'entityInstance_Id',             │
  │                              loadFromEntity: 'employee'                 │
  │                            }                                            │
  │                          }                                              │
  │                        }                                                │
  │                      }                                                  │
  └─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼ HTTP Response
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ FRONTEND (apps/web) - v7.0.0 FORMAT-AT-FETCH OPTIMIZATION               │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                                         │
  │  useEntityQuery.ts:189                                                  │
  │  └── useEntityInstanceList('project', { view: 'entityDataTable' })      │
  │       │                                                                 │
  │       ├── React Query fetches API                                       │
  │       │                                                                 │
  │       ├── ✨ NEW: formatDataset() called ONCE at fetch time             │
  │       │    └── lib/formatters/datasetFormatter.ts                       │
  │       │         ├── Formats ALL rows in single pass                     │
  │       │         └── Returns: FormattedRow[] with display/styles         │
  │       │                                                                 │
  │       └── Returns: { data, formattedData, metadata, total }             │
  │                                                                         │
  │  EntityListOfInstancesPage.tsx:127                                      │
  │  └── const { data, formattedData, metadata } = queryResult;             │
  │       │                                                                 │
  │       └── <EntityDataTable data={formattedData} metadata={metadata} />  │
  │                                                                         │
  │  EntityDataTable.tsx:1724 (VIEW MODE - Optimized)                       │
  │  └── For each cell:                                                     │
  │       │                                                                 │
  │       ├── IF row.display exists (FormattedRow):                         │
  │       │    └── Use pre-formatted: row.display[key], row.styles[key]     │
  │       │         (Zero function calls per cell!)                         │
  │       │                                                                 │
  │       └── ELSE (fallback for unformatted data):                         │
  │            └── renderViewModeFromMetadata(value, fieldMeta)             │
  │                                                                         │
  └─────────────────────────────────────────────────────────────────────────┘

FORMAT-AT-FETCH PERFORMANCE GAINS:
┌─────────────────────────────────────────────────────────────────────────┐
│  BEFORE (v6.x): Per-cell formatting during render                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  100 rows × 10 columns = 1,000 formatValue() calls PER RENDER           │
│  Each scroll/re-render triggers 1,000+ function calls                   │
│                                                                         │
│  AFTER (v7.0.0): Pre-formatted at fetch time                            │
│  ─────────────────────────────────────────────────────────────────────  │
│  formatDataset() called ONCE when data arrives                          │
│  Cell rendering = simple property access: row.display[key]              │
│  Scrolling triggers ZERO formatting function calls                      │
└─────────────────────────────────────────────────────────────────────────┘



COMPONENT HIERARCHY:

┌─────────────────────────────────────────────────────────────────────────┐
│                      THREE-LAYER COMPONENT HIERARCHY                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    APPLICATION LAYER                             │    │
│  │  EntityDataTable, EntityFormContainer, LabelsDataTable          │    │
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
| LabelsDataTable | `ui/LabelsDataTable.tsx` | Labels/datalabel table (fixed schema) |
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


## 6. Page-by-Page State Flow

### 6.1 EntityListOfInstancesPage

**File:** `pages/shared/EntityListOfInstancesPage.tsx`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EntityListOfInstancesPage State Flow                      │
│                    (v7.0.0 Format-at-Fetch Optimization)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Mount] ──────────────────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── 1. useEntityInstanceList(entityCode, params)                         │
│     │      ├── React Query checks cache → MISS → API fetch                   │
│     │      ├── API Response: { data, metadata, total }                       │
│     │      ├── ✨ formatDataset(data, metadata) → formattedData              │
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
│  [Table Rendering] ────────────────────────────────────────────────────────│
│     │                                                                        │
│     ├── IF localData.length > 0 (editing mode):                              │
│     │    └── Pass raw data to EntityDataTable                                │
│     │                                                                        │
│     └── ELSE (view mode):                                                    │
│          └── Pass formattedData to EntityDataTable (optimal performance)     │
│               └── Cell rendering uses row.display[key] directly              │
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
[FORMAT] Formatting 5 rows                          ← v7.0.0 format-at-fetch
[FORMAT] Formatted in 0.42ms                        ← one-time cost
[ListDataStore] Storing: office:page=1&pageSize=100
[EntityComponentStore] Storing: office:entityDataTable
[CACHE MISS] 💾 useEntityInstanceList: office
```

---

### 6.2 EntitySpecificInstancePage

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

### 6.3 EntityCreatePage

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

### 6.4 SettingsOverviewPage / SettingDetailPage

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