# Page & Component Architecture

> Universal page pattern with 3 core pages handling 27+ entity types dynamically

**Version**: 9.3.0
**Date**: 2025-12-01
**Status**: Production

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Universal Pages](#universal-pages)
3. [Core Components](#core-components)
4. [Data Flow Patterns](#data-flow-patterns)
5. [Cache Integration](#cache-integration)
6. [Component Hierarchy](#component-hierarchy)
7. [Custom Entity Pages](#custom-entity-pages)
8. [View Modes](#view-modes)

---

## Architecture Overview

The PMO platform uses a **config-driven, universal page architecture** where 3 core pages dynamically render 27+ entity types based on configuration from the `entity` table and `entityConfig.ts`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      UNIVERSAL PAGE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  3 Universal Pages (handle ALL entities dynamically):                        │
│  ════════════════════════════════════════════════════                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ EntityListOfInstancesPage.tsx                                            ││
│  │ Route: /:entityCode                                                      ││
│  │ Purpose: List view of any entity type                                    ││
│  │ Views: Table | Grid | Kanban | Calendar                                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ EntitySpecificInstancePage.tsx                                           ││
│  │ Route: /:entityCode/:entityId                                            ││
│  │ Purpose: Detail view of single entity instance                           ││
│  │ Components: Header + Fields + Child Entity Tabs                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ EntityCreatePage.tsx                                                     ││
│  │ Route: /:entityCode/new                                                  ││
│  │ Purpose: Create new entity instance with optional parent linking         ││
│  │ Features: Parent context | Auto-generated form | Draft persistence       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  Data Source:                                                               │
│  • Entity metadata from `d_entity` table (child_entity_codes, ui_icon, etc.)│
│  • Frontend config from `entityConfig.ts` (columns, searchFields, views)    │
│  • Field metadata from backend formatter (viewType, editType)               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Config-driven** | No entity-specific pages (except wiki, form, workflow) |
| **Metadata-first** | Backend generates field metadata, frontend renders |
| **Unified state** | Single cache layer (TanStack Query + Dexie) |
| **Offline-first** | All entity data persisted in IndexedDB |
| **View switching** | Table/Grid/Kanban/Calendar without page reload |

---

## Universal Pages

### 1. EntityListOfInstancesPage

**Location**: `apps/web/src/pages/shared/EntityListOfInstancesPage.tsx`

**Route**: `/:entityCode` (e.g., `/project`, `/task`, `/employee`)

**Purpose**: Display list of entity instances with multiple view modes.

```typescript
// Route examples:
/project                 → List all projects
/task                    → List all tasks
/employee                → List all employees
/project?dl__status=active → Filtered list
```

**Component Tree**:
```
EntityListOfInstancesPage
├── Layout (navigation, sidebar)
├── ViewSwitcher (table/grid/kanban/calendar toggle)
├── [Table View] → EntityListOfInstancesTable
│   ├── DataTableBase (headers, sorting, pagination)
│   └── Cell renderers (from frontEndFormatterService)
├── [Grid View] → GridView
├── [Kanban View] → KanbanView (groups by dl__*_status field)
└── [Calendar View] → CalendarView (shows date-based entities)
```

**Cache Pattern**:
```typescript
// Query key: ['entityInstanceData', entityCode, params]
const { data, metadata, total, isLoading } = useEntityInstanceData('project', {
  limit: 20,
  offset: 0,
  dl__project_stage: 'planning',  // Auto-filter from URL
});
```

### 2. EntitySpecificInstancePage

**Location**: `apps/web/src/pages/shared/EntitySpecificInstancePage.tsx`

**Route**: `/:entityCode/:entityId` (e.g., `/project/uuid-123`)

**Purpose**: Display single entity detail with child entity tabs.

```typescript
// Route examples:
/project/uuid-123        → Project detail view
/task/uuid-456           → Task detail view
/employee/uuid-789       → Employee detail view
```

**Component Tree**:
```
EntitySpecificInstancePage
├── Layout
├── EntityDetailView
│   ├── Header (name, status badge, action buttons)
│   ├── MetadataTable (all entity fields)
│   └── EntityInstanceFormContainer (inline edit mode)
├── DynamicChildEntityTabs
│   ├── Tab 1: Tasks (from entity.child_entity_codes)
│   ├── Tab 2: Employees
│   ├── Tab 3: Artifacts
│   └── Tab N: ... (dynamic from entity metadata)
└── ActionButtons (edit, delete, share, link)
```

**Cache Pattern**:
```typescript
// Single entity: ['entity', entityCode, entityId]
const { data: project, isLoading } = useEntity<Project>('project', projectId);

// Child tabs: ['entityInstanceData', childCode, { parent_entity_code, parent_entity_instance_id }]
const { data: tasks } = useEntityInstanceData('task', {
  parent_entity_code: 'project',
  parent_entity_instance_id: projectId,
});
```

### 3. EntityCreatePage

**Location**: `apps/web/src/pages/shared/EntityCreatePage.tsx`

**Route**: `/:entityCode/new` (e.g., `/project/new`)

**Purpose**: Create new entity instance with optional parent context.

```typescript
// Route examples:
/project/new                           → Create project (no parent)
/task/new?parent_code=project&parent_id=uuid-123  → Create task under project
```

**Component Tree**:
```
EntityCreatePage
├── Layout
├── EntityInstanceFormContainer
│   ├── Auto-generated form fields (from metadata.editType)
│   ├── Datalabel dropdowns (from datalabelStore)
│   ├── Entity reference pickers (from entityInstanceNamesStore)
│   └── Draft persistence (useDraft hook)
└── ActionButtons (save, cancel)
```

**Create-Link-Redirect Pattern**:
```
1. Parse parent_code and parent_id from URL query
2. Create entity via POST /api/v1/{entity}
3. Backend creates entity_instance_link to parent
4. Redirect to /:entityCode/:newId
```

---

## Core Components

### EntityListOfInstancesTable

**Location**: `apps/web/src/components/shared/ui/EntityListOfInstancesTable.tsx`

**Purpose**: Render entity data in a table with sorting, filtering, pagination.

**Features**:
- Column visibility (user preferences via localStorage)
- Auto-filter from URL query params
- Click row to navigate to detail
- Bulk selection support

```typescript
<EntityListOfInstancesTable
  entityCode="project"
  data={projects}
  metadata={metadata}
  refData={ref_data_entityInstance}
  onRowClick={(project) => navigate(`/project/${project.id}`)}
/>
```

### EntityInstanceFormContainer

**Location**: `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx`

**Purpose**: Auto-generate forms from backend metadata.

**Features**:
- Field types from `metadata.editType`
- Datalabel dropdowns for `dl__*` fields
- Entity reference pickers for `*__entity_id` fields
- Draft persistence (survives page refresh)
- Undo/redo support

```typescript
<EntityInstanceFormContainer
  entityCode="project"
  entityId={projectId}
  data={project}
  metadata={metadata}
  onSave={handleSave}
/>
```

### DynamicChildEntityTabs

**Location**: `apps/web/src/components/shared/entity/DynamicChildEntityTabs.tsx`

**Purpose**: Render tabs for child entities based on `entity.child_entity_codes`.

**Features**:
- Tabs from `child_entity_codes` array
- Lazy loading (fetch on tab click)
- Count badges per tab
- "Add child" button per tab

```typescript
<DynamicChildEntityTabs
  parentCode="project"
  parentId={projectId}
  childCodes={['task', 'employee', 'artifact']}
/>
```

### MetadataTable

**Location**: `apps/web/src/components/shared/entity/MetadataTable.tsx`

**Purpose**: Render entity fields in view mode using metadata.

```typescript
<MetadataTable
  data={project}
  metadata={metadata.viewType}
  refData={ref_data_entityInstance}
/>
```

### BadgeDropdownSelect

**Location**: `apps/web/src/components/shared/ui/BadgeDropdownSelect.tsx`

**Purpose**: Render colored dropdown for datalabel fields.

```typescript
<BadgeDropdownSelect
  datalabelKey="project_stage"
  value={project.dl__project_stage}
  onChange={handleChange}
/>
```

---

## Data Flow Patterns

### List Page Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LIST PAGE DATA FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User navigates to /project                                              │
│     └── EntityListOfInstancesPage mounts                                    │
│                                                                              │
│  2. useEntityInstanceData('project', { limit: 20 })                         │
│     └── Check TanStack Query cache                                          │
│     └── If MISS → Check Dexie (IndexedDB)                                   │
│     └── If MISS → GET /api/v1/project?limit=20                              │
│                                                                              │
│  3. API Response:                                                           │
│     {                                                                        │
│       data: [...],                                                          │
│       fields: [...],                                                        │
│       ref_data_entityInstance: { employee: { uuid: "James" } },             │
│       metadata: { entityListOfInstancesTable: { viewType, editType } }      │
│     }                                                                        │
│                                                                              │
│  4. Cache updated:                                                          │
│     └── TanStack Query in-memory cache                                      │
│     └── Dexie entityInstanceData table                                      │
│     └── entityInstanceNamesStore (from ref_data)                            │
│                                                                              │
│  5. EntityListOfInstancesTable renders:                                     │
│     └── Columns from metadata.viewType                                      │
│     └── Cell values from data[]                                             │
│     └── Entity names from ref_data_entityInstance                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detail Page Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DETAIL PAGE DATA FLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. User navigates to /project/uuid-123                                     │
│     └── EntitySpecificInstancePage mounts                                   │
│                                                                              │
│  2. Parallel fetches:                                                       │
│     └── useEntity('project', 'uuid-123')                                    │
│     └── useEntityCodes() → get child_entity_codes                           │
│                                                                              │
│  3. Render header + MetadataTable with project data                         │
│                                                                              │
│  4. DynamicChildEntityTabs mounts:                                          │
│     └── Tabs from child_entity_codes: ['task', 'employee', 'artifact']      │
│     └── Each tab shows count (parallel count queries)                       │
│                                                                              │
│  5. User clicks "Tasks" tab:                                                │
│     └── useEntityInstanceData('task', {                                     │
│           parent_entity_code: 'project',                                    │
│           parent_entity_instance_id: 'uuid-123'                             │
│         })                                                                  │
│     └── Renders EntityListOfInstancesTable with filtered tasks              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cache Integration

### Component → Cache Mapping

| Component | TanStack Query Key | Hook |
|-----------|-------------------|------|
| EntityListOfInstancesPage | `['entityInstanceData', code, params]` | `useEntityInstanceData` |
| EntitySpecificInstancePage | `['entity', code, id]` | `useEntity` |
| EntityCreatePage | Dexie `draft` table | `useDraft` |
| EntityListOfInstancesTable | (uses parent's data) | N/A |
| EntityInstanceFormContainer | `['entity', code, id]` + drafts | `useEntity` + `useDraft` |
| DynamicChildEntityTabs | `['entityInstanceData', childCode, ...]` | `useEntityInstanceData` |
| BadgeDropdownSelect | `['datalabel', key]` | `useDatalabel` |
| EntitySelect | `entityInstanceNamesStore` | `useEntityInstanceNames` |

### Session-Level Prefetch (Login)

```typescript
// Prefetched at login, available immediately
useDatalabel(key)           // All datalabels
useEntityCodes()            // All entity types
useGlobalSettings()         // App settings
useEntityInstanceNames(code)  // Entity name lookups
```

### On-Demand Fetch (Component Mount)

```typescript
// Fetched when component mounts
useEntity(code, id)         // Single entity
useEntityInstanceData(code, params)  // Entity list
useEntityLinks(parent, id)   // Parent-child links
```

---

## Component Hierarchy

```
App.tsx
├── TanstackCacheProvider (cache layer)
├── AuthProvider (authentication)
├── EntityMetadataProvider (entity types)
└── Router
    ├── /login → LoginForm
    ├── /welcome → WelcomePage
    │
    ├── /:entityCode → EntityListOfInstancesPage (protected)
    │   ├── ViewSwitcher
    │   ├── EntityListOfInstancesTable (table view)
    │   ├── GridView (grid view)
    │   ├── KanbanView (kanban view)
    │   └── CalendarView (calendar view)
    │
    ├── /:entityCode/:id → EntitySpecificInstancePage (protected)
    │   ├── EntityDetailView
    │   │   ├── Header
    │   │   └── MetadataTable
    │   ├── DynamicChildEntityTabs
    │   │   └── EntityListOfInstancesTable (per tab)
    │   └── ActionButtons
    │
    ├── /:entityCode/new → EntityCreatePage (protected)
    │   └── EntityInstanceFormContainer
    │
    ├── /wiki/:id → WikiViewPage (custom)
    ├── /wiki/:id/edit → WikiEditorPage (custom)
    ├── /form/:id → FormViewPage (custom)
    ├── /form/:id/builder → FormBuilderPage (custom)
    └── /settings → SettingsOverviewPage
```

---

## Custom Entity Pages

Some entities have custom pages due to specialized functionality:

| Entity | Custom Pages | Reason |
|--------|-------------|--------|
| **wiki** | WikiViewPage, WikiEditorPage | Block editor, version history |
| **form** | FormBuilderPage, FormViewPage, FormDataPreviewPage | Drag-drop builder, submissions |
| **workflow** | WorkflowDetailPage | DAG visualization, step execution |
| **artifact** | (uses EntityCreatePage) | File upload handled by EntityCreatePage |
| **marketing** | EmailDesignerPage | Visual email template builder |

### Custom Route Configuration

```typescript
// App.tsx
const customRouteEntities = ['artifact', 'form', 'wiki', 'marketing', 'workflow'];

// These entities have custom routes, not auto-generated
```

---

## View Modes

### ViewSwitcher Component

**Location**: `apps/web/src/components/shared/view/ViewSwitcher.tsx`

Toggles between view modes without page reload:

| Mode | Component | Best For |
|------|-----------|----------|
| **Table** | EntityListOfInstancesTable | Data-dense views, sorting |
| **Grid** | GridView | Visual cards, images |
| **Kanban** | KanbanView | Status-based workflows |
| **Calendar** | CalendarView | Date-based entities |

### View Mode Selection

```typescript
// From entityConfig.ts
export const entityConfigs = {
  project: {
    label: 'Project',
    defaultView: 'table',
    availableViews: ['table', 'grid', 'kanban'],
    kanbanField: 'dl__project_stage',  // For kanban grouping
  },
  event: {
    label: 'Event',
    defaultView: 'calendar',
    availableViews: ['table', 'calendar'],
    dateField: 'event_date',  // For calendar positioning
  },
};
```

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| `docs/state_management/STATE_MANAGEMENT.md` | TanStack Query + Dexie architecture |
| `docs/caching-frontend/NORMALIZED_CACHE_ARCHITECTURE.md` | Unified cache layer |
| `docs/services/backend-formatter.service.md` | Backend metadata generation |
| `docs/ui_components/EntityListOfInstancesTable.md` | Table component details |
| `docs/ui_components/EntityInstanceFormContainer.md` | Form component details |
| `CLAUDE.md` | Main codebase reference |

---

**Version**: 9.3.0 | **Updated**: 2025-12-01 | **Status**: Production
