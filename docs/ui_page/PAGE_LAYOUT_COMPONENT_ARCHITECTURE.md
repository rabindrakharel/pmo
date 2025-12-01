# Page, Layout & Component Architecture

> **Version:** 9.4.0 | PMO Enterprise Platform
> **Status:** Production Ready
> **Updated:** 2025-12-01

## Executive Summary

This document describes the complete frontend architecture including:
- **3 Universal Pages** that handle 27+ entity types dynamically
- **Two-Query Data Flow** where metadata and data are fetched separately
- **Three-Layer Component Hierarchy** with backend-driven rendering
- **Settings System** for runtime datalabel management

**Core Principles:**
- **Config-driven, not code-driven** - Entity behavior defined in `entityConfig.ts`
- **Backend sends metadata** - `{ viewType, editType }` defines all field rendering
- **Two-query architecture** - Metadata cached 30 min, data cached 5 min
- **Format-at-read** - Raw data cached, transformation happens via `useMemo`

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Two-Query Data Flow](#2-two-query-data-flow)
3. [Universal Entity Pages](#3-universal-entity-pages)
4. [Component Hierarchy](#4-component-hierarchy)
5. [Cache Integration](#5-cache-integration)
6. [Settings Pages](#6-settings-pages)
7. [Special Entity Pages](#7-special-entity-pages)
8. [Routing Structure](#8-routing-structure)
9. [API Response Structures](#9-api-response-structures)
10. [Quick Reference](#10-quick-reference)

---

## 1. System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PAGE ARCHITECTURE (v9.4.0)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    3 UNIVERSAL ENTITY PAGES                           │  │
│  ├───────────────────┬─────────────────────┬─────────────────────────────┤  │
│  │ EntityListOfInst  │ EntitySpecificInst  │  EntityCreatePage           │  │
│  │    Page           │     Page            │                             │  │
│  │ (List/Kanban/Grid)│ (Detail + Tabs)     │  (Create Form)              │  │
│  └───────────────────┴─────────────────────┴─────────────────────────────┘  │
│                              │                                              │
│                              v                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    ENTITY CONFIG                                      │  │
│  │             apps/web/src/lib/entityConfig.ts                          │  │
│  │    - columns, fields, supportedViews, kanban, grid, children          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Three-Layer Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THREE-LAYER COMPONENT HIERARCHY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  APPLICATION LAYER (Business Logic)                                         │
│  ──────────────────────────────────                                         │
│  EntityListOfInstancesTable, EntityInstanceFormContainer, KanbanView,       │
│  CalendarView, GridView, DAGVisualizer, DynamicChildEntityTabs,             │
│  HierarchyGraphView                                                         │
│                                                                              │
│  Props: data (FormattedRow[]), metadata ({ viewType, editType })            │
│                                                                              │
│  DOMAIN LAYER (Data-Aware)                                                  │
│  ─────────────────────────                                                  │
│  EntityInstanceNameLookup, EntityMultiSelect, DataLabelSelect,              │
│  BadgeDropdownSelect                                                        │
│                                                                              │
│  Props: Uses editType.lookupSource, editType.datalabelKey                   │
│                                                                              │
│  BASE LAYER (No Data Dependencies)                                          │
│  ─────────────────────────────────                                          │
│  Select, MultiSelect, DebouncedInput, DebouncedTextarea,                    │
│  SearchableMultiSelect, Button, Modal, Badge                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Two-Query Data Flow

### Architecture Overview

Metadata and data are fetched separately, enabling faster perceived load times:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TWO-QUERY ARCHITECTURE (v9.4.0)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  QUERY 1: METADATA (Hot Path)              QUERY 2: DATA (Standard Path)    │
│  ─────────────────────────────             ─────────────────────────────    │
│  Hook: useEntityInstanceMetadata()         Hook: useEntityInstanceData()    │
│  API:  GET /api/v1/{entity}?content=metadata   API:  GET /api/v1/{entity}   │
│  Cache: 30 minutes (session-level)         Cache: 5 minutes (on-demand)     │
│  Returns: fields, viewType, editType       Returns: data[], refData, total  │
│                                                                              │
│  Purpose: Render table columns/structure   Purpose: Populate table rows     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Complete Cache Store Architecture

All cached stores showing TanStack Query (memory), Dexie (IndexedDB), and API layers:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE CACHE STORE ARCHITECTURE (v9.4.0)                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │ SESSION-LEVEL STORES (Hydrated at Login, 30-min stale)                                          ││
│  ├─────────────────────────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                                                  ││
│  │  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐                   ││
│  │  │ globalSettingsStore  │  │   datalabelStore     │  │  entityCodesStore    │                   ││
│  │  ├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤                   ││
│  │  │ Hook:                │  │ Hook:                │  │ Hook:                │                   ││
│  │  │ useGlobalSettings()  │  │ useDatalabel(key)    │  │ useEntityCodes()     │                   ││
│  │  │                      │  │                      │  │                      │                   ││
│  │  │ Sync:                │  │ Sync:                │  │ Sync:                │                   ││
│  │  │ getSettingSync()     │  │ getDatalabelSync()   │  │ getEntityCodesSync() │                   ││
│  │  │                      │  │                      │  │ getEntityCodeSync()  │                   ││
│  │  │ API:                 │  │ API:                 │  │ API:                 │                   ││
│  │  │ /api/v1/setting/     │  │ /api/v1/datalabel    │  │ /api/v1/entity/types │                   ││
│  │  │ global               │  │ ?name=dl__*          │  │                      │                   ││
│  │  │                      │  │                      │  │                      │                   ││
│  │  │ Dexie Table:         │  │ Dexie Table:         │  │ Dexie Table:         │                   ││
│  │  │ globalSettings       │  │ datalabel            │  │ entityCode           │                   ││
│  │  │                      │  │                      │  │                      │                   ││
│  │  │ Stale: 30 min        │  │ Stale: 30 min        │  │ Stale: 30 min        │                   ││
│  │  │ TTL: 24 hours        │  │ TTL: 24 hours        │  │ TTL: 24 hours        │                   ││
│  │  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘                   ││
│  │                                                                                                  ││
│  │  ┌──────────────────────┐  ┌──────────────────────┐                                             ││
│  │  │entityInstMetaStore   │  │entityInstNamesStore  │                                             ││
│  │  ├──────────────────────┤  ├──────────────────────┤                                             ││
│  │  │ Hook:                │  │ Hook:                │                                             ││
│  │  │useEntityInstance     │  │useEntityInstance     │                                             ││
│  │  │  Metadata()          │  │  Names()             │                                             ││
│  │  │                      │  │                      │                                             ││
│  │  │ Sync:                │  │ Sync:                │                                             ││
│  │  │getEntityInstance     │  │getEntityInstance     │                                             ││
│  │  │  MetadataSync()      │  │  NameSync()          │                                             ││
│  │  │                      │  │                      │                                             ││
│  │  │ API:                 │  │ API:                 │                                             ││
│  │  │/api/v1/{entity}      │  │/api/v1/entity/       │                                             ││
│  │  │  ?content=metadata   │  │  {code}/entity-      │                                             ││
│  │  │                      │  │  instance            │                                             ││
│  │  │                      │  │                      │                                             ││
│  │  │ Dexie Table:         │  │ Dexie Table:         │                                             ││
│  │  │entityInstanceMeta    │  │entityInstanceName    │                                             ││
│  │  │                      │  │                      │                                             ││
│  │  │ Stale: 30 min        │  │ Stale: 10 min        │                                             ││
│  │  │ TTL: 24 hours        │  │ TTL: 24 hours        │                                             ││
│  │  └──────────────────────┘  └──────────────────────┘                                             ││
│  │                                                                                                  ││
│  └─────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐│
│  │ ON-DEMAND STORES (Fetched when needed, 5-min stale)                                             ││
│  ├─────────────────────────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                                                  ││
│  │  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐                   ││
│  │  │entityInstDataStore   │  │  entityLinksStore    │  │    draftStore        │                   ││
│  │  ├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤                   ││
│  │  │ Hook:                │  │ Hook:                │  │ Hook:                │                   ││
│  │  │useEntityInstance     │  │ useEntityLinks()     │  │ useDraft()           │                   ││
│  │  │  Data()              │  │                      │  │                      │                   ││
│  │  │                      │  │                      │  │                      │                   ││
│  │  │ API:                 │  │ API:                 │  │ API: None            │                   ││
│  │  │/api/v1/{entity}      │  │/api/v1/entity/       │  │ (Dexie only)         │                   ││
│  │  │  ?limit=N            │  │  {id}/children       │  │                      │                   ││
│  │  │                      │  │                      │  │                      │                   ││
│  │  │ Dexie Table:         │  │ Dexie Tables:        │  │ Dexie Table:         │                   ││
│  │  │entityInstanceData    │  │entityLinkForward     │  │ draft                │                   ││
│  │  │                      │  │entityLinkReverse     │  │                      │                   ││
│  │  │                      │  │                      │  │                      │                   ││
│  │  │ Stale: 5 min         │  │ Stale: 5 min         │  │ Stale: Never         │                   ││
│  │  │ TTL: 30 min          │  │ TTL: 30 min          │  │ TTL: Until saved     │                   ││
│  │  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘                   ││
│  │                                                                                                  ││
│  └─────────────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cache Store Summary Table

| Store | Hook | Sync Function | API Endpoint | Dexie Table | Stale | TTL | Hydration |
|-------|------|---------------|--------------|-------------|-------|-----|-----------|
| **globalSettings** | `useGlobalSettings()` | `getSettingSync()` | `/api/v1/setting/global` | `globalSettings` | 30m | 24h | Login |
| **datalabel** | `useDatalabel(key)` | `getDatalabelSync(key)` | `/api/v1/datalabel?name=dl__*` | `datalabel` | 30m | 24h | Login |
| **entityCodes** | `useEntityCodes()` | `getEntityCodesSync()` | `/api/v1/entity/types` | `entityCode` | 30m | 24h | Login |
| **entityInstMetadata** | `useEntityInstanceMetadata()` | `getEntityInstanceMetadataSync()` | `/api/v1/{entity}?content=metadata` | `entityInstanceMeta` | 30m | 24h | On-demand |
| **entityInstNames** | `useEntityInstanceNames()` | `getEntityInstanceNameSync()` | `/api/v1/entity/{code}/entity-instance` | `entityInstanceName` | 10m | 24h | Login (common) |
| **entityInstData** | `useEntityInstanceData()` | - | `/api/v1/{entity}?limit=N` | `entityInstanceData` | 5m | 30m | On-demand |
| **entityLinks** | `useEntityLinks()` | `getChildIdsSync()` | `/api/v1/entity/{id}/children` | `entityLinkForward/Reverse` | 5m | 30m | On-demand |
| **draft** | `useDraft()` | - | None (local only) | `draft` | Never | Until saved | Never |

### Data Flow Per Store

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW: WHERE EACH STORE IS USED                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│  LOGIN EVENT                                                                                         │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────│
│  prefetchAllMetadata() hydrates:                                                                     │
│    ├── globalSettings     → App config, feature flags, date formats                                 │
│    ├── datalabel (all)    → 58 datalabel sets (dl__project_stage, dl__task_priority, etc.)         │
│    ├── entityCodes        → 23 entity types with child_entity_codes                                 │
│    └── entityInstNames    → employee, project, business, office, role, cust (300+ names)           │
│                                                                                                      │
│  PAGE NAVIGATION: /project                                                                           │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────│
│  EntityListOfInstancesPage uses:                                                                     │
│    ├── entityInstMetadata → Table columns, field types, render config                               │
│    ├── entityInstData     → Project records (5 projects)                                            │
│    └── ref_data_entity... → Inline with data response (manager names)                               │
│                                                                                                      │
│  RENDERING: Table Cells                                                                              │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────│
│  formatDataset() reads from sync stores:                                                             │
│    ├── getDatalabelSync('project_stage') → Badge colors                                             │
│    ├── ref_data_entityInstance           → Employee names (from API response)                       │
│    └── viewType metadata                  → Currency format, date format                            │
│                                                                                                      │
│  DETAIL PAGE: /project/:id                                                                           │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────│
│  EntitySpecificInstancePage uses:                                                                    │
│    ├── entityInstData     → Single project record                                                   │
│    ├── entityLinks        → Child entity tabs (tasks, wikis, artifacts)                             │
│    └── entityCodes        → child_entity_codes for DynamicChildEntityTabs                           │
│                                                                                                      │
│  EDIT MODE                                                                                           │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────│
│  useDraft() creates local draft:                                                                     │
│    ├── draft store        → Tracks dirty fields, undo/redo history                                  │
│    └── Persists to Dexie  → Survives page refresh, browser restart                                  │
│                                                                                                      │
│  DROPDOWNS & SELECTS                                                                                 │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────│
│    ├── DataLabelSelect     → useDatalabel('project_stage') → options with colors                   │
│    ├── EntityInstanceName  → useEntityInstanceNames('employee') → employee dropdown                 │
│    └── BadgeDropdownSelect → getDatalabelSync('task_priority') → inline badge picker               │
│                                                                                                      │
│  CHILD ENTITY TABS                                                                                   │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────│
│  DynamicChildEntityTabs:                                                                             │
│    ├── getEntityCodeSync('project')     → child_entity_codes: ['task', 'wiki', 'artifact']         │
│    └── useEntityInstanceMetadata('task') → Tab table column config                                  │
│                                                                                                      │
│  WEBSOCKET INVALIDATION                                                                              │
│  ───────────────────────────────────────────────────────────────────────────────────────────────────│
│  wsManager.handleInvalidate({ entityCode: 'project', entityId: 'uuid' }):                           │
│    ├── invalidateEntityQueries('project') → TanStack marks stale                                    │
│    ├── Active components auto-refetch     → Fresh data from API                                     │
│    └── Dexie updated                       → IndexedDB synced                                       │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Why Two Queries?

| Aspect | Single Query | Two-Query (Current) |
|--------|--------------|---------------------|
| **Cache Efficiency** | Metadata re-fetched with every data request | Metadata cached 30 min, data cached 5 min |
| **Perceived Performance** | Wait for data + metadata | Show columns immediately from cache |
| **Network Overhead** | Large response every time | Metadata request is tiny, cached longer |
| **Schema Changes** | Data + metadata bundled | Invalidate metadata cache only when schema changes |

### Render Sequence Timeline

```
Time ──────────────────────────────────────────────────────────────────────────►

USER NAVIGATES TO /project
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Component Mount                                                       │
│ ────────────────────────                                                       │
│                                                                                │
│   EntityListOfInstancesPage mounts                                             │
│   ├── useEntityInstanceMetadata('project', 'entityListOfInstancesTable')      │
│   │   └── Check TanStack cache → MISS (first visit) or HIT (subsequent)       │
│   │                                                                            │
│   └── useEntityInstanceData('project', { limit: 20000 })                      │
│       └── Starts immediately (no dependency on metadata)                       │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Metadata Loading (metadataLoading = true)                            │
│ ──────────────────────────────────────────────────                            │
│                                                                                │
│   UI State: Show skeleton/spinner                                              │
│                                                                                │
│   CACHE HIT (subsequent visits):                                               │
│   └── Instant return from TanStack Query cache                                │
│   └── Skip to Phase 3 immediately                                              │
│                                                                                │
│   CACHE MISS (first visit):                                                    │
│   └── API Call: GET /api/v1/project?content=metadata                          │
│   └── Response: { data: [], fields: [...], metadata: { viewType, editType } } │
│   └── Store in TanStack cache + Dexie (IndexedDB)                             │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Columns Render (metadataLoading = false, dataLoading = true/false)   │
│ ───────────────────────────────────────────────────────────────────────────   │
│                                                                                │
│   UI State: Table structure visible with column headers                        │
│                                                                                │
│   EntityListOfInstancesTable receives metadata:                                │
│   └── metadata = { viewType: {...}, editType: {...} }                         │
│   └── Generates columns from viewType                                          │
│   └── Renders table header with column names, widths, sortable indicators     │
│                                                                                │
│   If dataLoading = true:                                                       │
│   └── Show loading indicator in table body                                     │
│   └── Or show skeleton rows                                                    │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Data Arrives (dataLoading = false)                                   │
│ ───────────────────────────────────────────                                   │
│                                                                                │
│   API Response: { data: [...], ref_data_entityInstance: {...}, total, ... }   │
│                                                                                │
│   Data Processing:                                                             │
│   └── formatDataset(rawData, metadata, refData) - format at read              │
│   └── Returns FormattedRow[] with raw values + display strings                │
│                                                                                │
│   UI State: Full table with data rows                                          │
│   └── Rows render with formatted values                                        │
│   └── Badge colors from datalabel cache                                        │
│   └── Entity names from ref_data_entityInstance                               │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### State Transitions

```typescript
// Phase 1: Mount
metadataLoading: true
dataLoading: true
UI: <Skeleton />

// Phase 2: Metadata arrives (or from cache)
metadataLoading: false
dataLoading: true (or false if data is faster)
UI: <Table columns={columns}><LoadingRows /></Table>

// Phase 3: Data arrives
metadataLoading: false
dataLoading: false
UI: <Table columns={columns}><DataRows data={formattedData} /></Table>
```

### Format-at-Read Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FORMAT-AT-READ PATTERN                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: CACHE HOOK (Raw Data Storage)                                     │
│  ───────────────────────────────────────                                    │
│  useEntityInstanceData(entityCode, params)                                  │
│  └── Returns: { data: T[], metadata, refData, isLoading, ... }             │
│  └── Stores RAW data in TanStack Query + Dexie                             │
│  └── NO formatting happens here                                             │
│                              │                                              │
│                              v                                              │
│  LAYER 2: PAGE (Transform via useMemo)                                      │
│  ─────────────────────────────────────                                      │
│  const formattedData = useMemo(() => {                                      │
│    return formatDataset(rawData, componentMetadata, refData);               │
│  }, [rawData, metadata, refData]);                                          │
│  └── Memoized transformation                                                │
│  └── Only recalculates when dependencies change                             │
│                              │                                              │
│                              v                                              │
│  LAYER 3: COMPONENT (Pure Renderer)                                         │
│  ──────────────────────────────────                                         │
│  <EntityListOfInstancesTable data={formattedData} metadata={metadata} />    │
│  └── Receives FormattedRow[] for viewing                                    │
│  └── Uses row.display[key] for pre-formatted strings                        │
│  └── Uses row.styles[key] for CSS classes (badges)                          │
│  └── Uses row.raw[key] for edit mode values                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

SEPARATION OF CONCERNS:
• Cache (hook)    = Stores raw data, handles persistence & sync
• Page (useMemo)  = Transforms raw → formatted (format-at-read)
• Component       = Pure renderer, consumes FormattedRow[]
```

---

## 3. Universal Entity Pages

### 3.1 EntityListOfInstancesPage

**Route:** `/:entityCode` (e.g., `/project`, `/task`, `/employee`)

**Purpose:** Displays entity list with multiple view modes (table, kanban, grid, calendar, graph)

**Component Architecture:**
```
EntityListOfInstancesPage
├── Layout                           // App shell with sidebar
├── ViewSwitcher                     // Toggle between view modes
├── useEntityInstanceMetadata()      // TanStack Query hook (metadata, 30-min cache)
├── useEntityInstanceData()          // TanStack Query hook (data, 5-min cache)
├── useMemo(formatDataset)           // Format-at-read transformation
├── EntityListOfInstancesTable       // Table view (default)
│   ├── Pagination                   // Client-side pagination
│   └── InlineEdit                   // Direct cell editing
├── KanbanView                       // Kanban board
│   └── KanbanColumn[]               // Status columns
├── GridView                         // Card grid
├── CalendarView                     // Event calendar
└── HierarchyGraphView / DAGVisualizer  // Graph views
```

**Key Code Pattern:**
```typescript
// EntityListOfInstancesPage.tsx

// ============================================================================
// QUERY 1: METADATA (30-min cache) - renders table columns first
// ============================================================================
const {
  viewType,
  editType,
  fields: metadataFields,
  isLoading: metadataLoading,
} = useEntityInstanceMetadata(entityCode, mappedView);

// Combine into metadata structure for EntityListOfInstancesTable
const metadata = useMemo(() => {
  if (!viewType || Object.keys(viewType).length === 0) return undefined;
  return { viewType, editType };
}, [viewType, editType]);

// ============================================================================
// QUERY 2: DATA (5-min cache) - populates rows after metadata ready
// ============================================================================
const queryParams = useMemo(() => ({
  limit: 20000,
  offset: (currentPage - 1) * 20000,
}), [currentPage]);

const {
  data: rawData,
  refData,
  total: totalRecords,
  isLoading: dataLoading,
  refetch,
} = useEntityInstanceData(entityCode, queryParams);

// Combined loading state: show skeleton until metadata is ready
const loading = metadataLoading;

// Format data on read (memoized)
const formattedData = useMemo(() => {
  if (!rawData || rawData.length === 0) return [];
  return formatDataset(rawData, metadata, refData);
}, [rawData, metadata, refData]);

// Dual data paths for view vs edit mode
const tableData = editingRow || isAddingRow
  ? rawData          // Raw data for editing (form inputs)
  : formattedData;   // Formatted data for viewing (display)
```

### 3.2 EntitySpecificInstancePage

**Route:** `/:entityCode/:id` (e.g., `/project/uuid`, `/task/uuid`)

**Purpose:** Detail view with dynamic child entity tabs, edit mode, and entity-specific renderers

**Component Architecture:**
```
EntitySpecificInstancePage
├── Layout
├── EntityMetadataRow              // Name, code, ID, timestamps
│   └── EntityMetadataField[]      // Copyable inline fields (debounced)
├── DynamicChildEntityTabs         // Tab navigation
│   └── useEntityChildren()        // Fetch tabs from entity.child_entity_codes
├── EntityInstanceFormContainer    // Overview tab content
│   └── frontEndFormatterService   // Field renderers
├── WikiContentRenderer            // Wiki entity special view
├── InteractiveForm                // Form entity special view
├── EmailTemplateRenderer          // Marketing entity special view
├── TaskDataContainer              // Task updates/comments
├── FilePreview                    // Artifact/cost/revenue preview
├── ShareModal                     // Sharing dialog
└── UnifiedLinkageModal            // Entity relationships
```

**Edit Mode Integration (Dexie Drafts):**
```typescript
const {
  hasDraft: isEditing,
  currentData,
  dirtyFields,
  startEdit,
  updateField,
  discardDraft,
  getChanges,
  undo, redo,
  canUndo, canRedo,
  hasChanges
} = useDraft(entityCode, entityId);
```

**Tab System:**
1. Overview tab (always first) → Shows `EntityInstanceFormContainer`
2. Child tabs from `child_entity_codes` → Shows `EntityListOfInstancesTable` directly
3. Special tabs for form entity (`Form Data`, `Edit Submission`)

### 3.3 EntityCreatePage

**Route:** `/:entityCode/new` (e.g., `/project/new`, `/task/new`)

**Purpose:** Universal entity creation form with file upload support

**Component Architecture:**
```
EntityCreatePage
├── Layout
├── DragDropFileUpload             // For artifact/cost/revenue
│   └── useS3Upload()              // Presigned URL upload
├── EntityInstanceFormContainer    // Form fields from config
│   └── Fields auto-generated      // Based on entityConfig.fields
└── Button (Save/Cancel)
```

**Parent Context (Child Creation):**
```typescript
interface ParentContext {
  parentType?: string;   // Parent entity code
  parentId?: string;     // Parent entity ID
  returnTo?: string;     // Return URL after creation
}

// After create → Link to parent via linkage API
await createParentChildLinkage(parentType, parentId, entityCode, createdId);
```

---

## 4. Component Hierarchy

### Core Types

```typescript
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

interface ViewFieldMetadata {
  dtype: 'str' | 'float' | 'int' | 'bool' | 'uuid' | 'date' | 'timestamp' | 'jsonb';
  label: string;
  renderType: string;     // 'text', 'currency', 'date', 'badge', 'boolean', etc.
  component?: string;     // Component name when renderType='component'
  behavior: {
    visible?: boolean;
    sortable?: boolean;
    filterable?: boolean;
    searchable?: boolean;
  };
  style: {
    width?: string;
    align?: 'left' | 'center' | 'right';
    symbol?: string;
    decimals?: number;
  };
  lookupEntity?: string;  // For entity reference fields
  datalabelKey?: string;  // For badge/select fields
}

interface EditFieldMetadata {
  dtype: string;
  label: string;
  inputType: string;      // 'text', 'number', 'select', 'date', 'checkbox', etc.
  behavior: { editable?: boolean };
  validation: { required?: boolean; min?: number; max?: number };
  lookupSource?: 'datalabel' | 'entityInstance';
  datalabelKey?: string;
  lookupEntity?: string;
}

interface FormattedRow<T = Record<string, any>> {
  raw: T;                           // Original values (for mutations, editing)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (for badges)
}
```

### Application Layer Components

| Component | File | Purpose |
|-----------|------|---------|
| `EntityListOfInstancesTable` | `ui/EntityListOfInstancesTable.tsx` | Table with sorting, filtering, inline edit |
| `EntityInstanceFormContainer` | `entity/EntityInstanceFormContainer.tsx` | Universal form renderer |
| `KanbanView` | `ui/KanbanView.tsx` | Drag-drop kanban board |
| `CalendarView` | `ui/CalendarView.tsx` | Event calendar |
| `GridView` | `ui/GridView.tsx` | Card grid layout |
| `DAGVisualizer` | `workflow/DAGVisualizer.tsx` | Workflow stage visualization |
| `DynamicChildEntityTabs` | `entity/DynamicChildEntityTabs.tsx` | Auto-generated child tabs |

### Domain Layer Components

| Component | File | Purpose |
|-----------|------|---------|
| `EntityInstanceNameLookup` | `ui/EntityInstanceNameLookup.tsx` | UUID → name resolution |
| `DataLabelSelect` | `ui/DataLabelSelect.tsx` | Dropdown from datalabel |
| `EntityMultiSelect` | `ui/EntityMultiSelect.tsx` | Multi-select entities |
| `BadgeDropdownSelect` | `ui/BadgeDropdownSelect.tsx` | Colored badge dropdown |

### Base Layer Components

| Component | File | Purpose |
|-----------|------|---------|
| `Select` | `ui/Select.tsx` | Generic dropdown |
| `DebouncedInput` | `ui/DebouncedInput.tsx` | Input with debounce |
| `DebouncedTextarea` | `ui/DebouncedTextarea.tsx` | Textarea with debounce |
| `Button` | `ui/Button.tsx` | Styled button |
| `Modal` | `ui/Modal.tsx` | Dialog component |

---

## 5. Cache Integration

### Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              CACHE HIERARCHY                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: TanStack Query (In-Memory)                                        │
│  ────────────────────────────────────                                        │
│  • Fastest access (microseconds)                                             │
│  • Lost on page refresh                                                      │
│  • Automatic stale-while-revalidate                                          │
│                                                                              │
│         ↓ cache miss                                                         │
│                                                                              │
│  LAYER 2: Dexie (IndexedDB)                                                  │
│  ──────────────────────────                                                  │
│  • Persistent across sessions                                                │
│  • Survives page refresh/browser restart                                     │
│  • Hydrated into TanStack on app start                                       │
│                                                                              │
│         ↓ cache miss or stale                                                │
│                                                                              │
│  LAYER 3: API (Network)                                                      │
│  ──────────────────────                                                      │
│  • Source of truth                                                           │
│  • Updates both Layer 1 and Layer 2                                          │
│                                                                              │
│  Bundle Size: ~25KB (TanStack + Dexie)                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cache Hooks

| Hook | Purpose | Store | Stale Time |
|------|---------|-------|------------|
| `useEntityInstanceMetadata()` | Field metadata only | Session | 30 min |
| `useEntityInstanceData()` | Entity list with pagination | On-demand | 5 min |
| `useDatalabel()` | Dropdown options | Session | 30 min |
| `useEntityCodes()` | Entity type definitions | Session | 30 min |
| `useGlobalSettings()` | App settings | Session | 30 min |
| `useDraft()` | Persist unsaved edits | Dexie only | Until saved |
| `useEntityMutation()` | CRUD operations | N/A | N/A |

### Cache Timing

| Cache Type | TanStack StaleTime | Dexie TTL | Rationale |
|------------|-------------------|-----------|-----------|
| **Metadata** | 30 minutes | 24 hours | Schema rarely changes |
| **Data** | 5 minutes | 30 minutes | Data changes more frequently |
| **Datalabels** | 10 minutes | 24 hours | Settings change occasionally |
| **Entity Codes** | 30 minutes | 24 hours | Entity types rarely change |

### Sync Stores (Non-Hook Access)

For formatters and utilities that can't use hooks:

```typescript
import { getDatalabelSync, getEntityCodesSync, getEntityInstanceNameSync } from '@/db/tanstack-index';

const options = getDatalabelSync('project_stage');
const codes = getEntityCodesSync();
const name = getEntityInstanceNameSync('employee', 'uuid-here');
```

### WebSocket Invalidation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME INVALIDATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. API writes to database (INSERT/UPDATE/DELETE)                           │
│                    ↓                                                         │
│  2. PostgreSQL trigger fires                                                 │
│                    ↓                                                         │
│  3. PubSub broadcasts via WebSocket (port 4001)                              │
│     { type: 'INVALIDATE', payload: { entityCode: 'project', entityId: ... }}│
│                    ↓                                                         │
│  4. wsManager.handleInvalidate()                                             │
│     └── invalidateEntityQueries('project', entityId)                        │
│                    ↓                                                         │
│  5. TanStack marks query as stale                                            │
│                    ↓                                                         │
│  6. Active components auto-refetch                                           │
│                    ↓                                                         │
│  7. Dexie updated with fresh data                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Settings Pages

### 6.1 SettingsOverviewPage

**Route:** `/setting/overview`

**Purpose:** Central hub for all system configuration with 5 main tabs

**Component Architecture:**
```
SettingsOverviewPage
├── Layout
├── Header
│   ├── Exit button → exitSettingsMode()
│   ├── Settings icon
│   └── Title/description
├── Tab Navigation
│   ├── [Entities] → Entity type management
│   ├── [Entity Mapping] → Linkage configuration
│   ├── [Secrets Vault] → Credentials (placeholder)
│   ├── [Integrations] → External services (placeholder)
│   └── [Access Control] → RBAC management
├── Entities Tab Content
│   ├── Search input
│   ├── Entity table (Code, Name, Icon, Status)
│   ├── ChildEntitiesModal
│   └── Add Entity row (inline)
├── Access Control Tab Content
│   ├── Roles Management card → /role
│   ├── Permission Management card
│   └── EntityListOfInstancesTable (rbac entity)
└── Modals
    ├── AddDatalabelModal
    ├── ChildEntitiesModal
    └── EntityConfigurationModal
```

### 6.2 SettingDetailPage

**Route:** `/setting/:category` (e.g., `/setting/projectStage`, `/setting/taskPriority`)

**Purpose:** CRUD for datalabel items within a specific datalabel type

**URL Conversion:**
```typescript
// URL param (camelCase) → datalabel name (snake_case with prefix)
// /setting/projectStage → dl__project_stage
// /setting/taskPriority → dl__task_priority

function datalabelToCamelCase(datalabelName: string): string {
  const withoutPrefix = datalabelName.replace(/^dl__/, '');
  const parts = withoutPrefix.split('_');
  return parts[0] + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join('');
}
```

### Datalabel Database Schema

```sql
CREATE TABLE app.datalabel (
    datalabel_name VARCHAR(100) PRIMARY KEY,  -- dl__{entity}_{label}
    ui_label VARCHAR(100) NOT NULL,
    ui_icon VARCHAR(50),
    metadata JSONB NOT NULL,                  -- [{id, name, descr, parent_id, color_code}]
    updated_ts TIMESTAMPTZ DEFAULT now()
);
```

### Datalabel API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/setting/categories` | List all datalabels |
| GET | `/api/v1/datalabel?name=dl__*` | Get datalabel items |
| POST | `/api/v1/setting/category` | Create new datalabel |
| POST | `/api/v1/setting/:datalabel` | Add item |
| PUT | `/api/v1/setting/:datalabel/:id` | Update item |
| PUT | `/api/v1/setting/:datalabel/reorder` | Reorder items |
| DELETE | `/api/v1/setting/:datalabel/:id` | Delete item |

### Position-Based IDs (Critical)

**IDs are NOT permanent** - they equal array position and reassign after mutations:

```typescript
// Before delete: [0: A, 1: B, 2: C]
deleteItem(1);  // Delete B
// After delete: [0: A, 1: C]  ← C's ID changed from 2 to 1!

// ✅ ALWAYS refetch after mutations
await deleteItem(1);
const fresh = await fetchItems();
setData(fresh);
```

---

## 7. Special Entity Pages

### 7.1 Wiki Pages

**WikiViewPage:** `/wiki/:id` - Read-only wiki display with cover image
**WikiEditorPage:** `/wiki/:id/edit` or `/wiki/new` - Notion-style block editor

### 7.2 Form Pages

**FormBuilderPage:** `/form/:id/edit` - Drag-and-drop form schema editor
**FormViewPage:** `/form/:id` - Render form for submission
**PublicFormPage:** `/form/public/:shareId` - Public shareable form

---

## 8. Routing Structure

```typescript
// App.tsx route structure

// Entity routes
<Route path="/:entityCode" element={<EntityListOfInstancesPage />} />
<Route path="/:entityCode/new" element={<EntityCreatePage />} />
<Route path="/:entityCode/:id/*" element={<EntitySpecificInstancePage />} />

// Settings routes
<Route path="/setting/overview" element={<SettingsOverviewPage />} />
<Route path="/setting/:category" element={<SettingDetailPage />} />

// Special entity routes
<Route path="/wiki/:id/edit" element={<WikiEditorPage />} />
<Route path="/form/:id/edit" element={<FormBuilderPage />} />
<Route path="/form/public/:shareId" element={<PublicFormPage />} />
```

### Navigation Flow

```
User clicks sidebar → EntityListOfInstancesPage (/:entityCode)
       │
       ├── [Row Click] → EntitySpecificInstancePage (/:entityCode/:id)
       │                        │
       │                        ├── [Tab Click] → EntityListOfInstancesTable (inline)
       │                        │                        │
       │                        │                        └── [Create] → Create-Link-Redirect
       │                        │
       │                        └── [Edit Button] → Edit mode (same page)
       │
       └── [Create Button] → EntityCreatePage (/:entityCode/new)
```

---

## 9. API Response Structures

### Metadata Request

```
GET /api/v1/project?content=metadata
```

```json
{
  "data": [],
  "fields": ["id", "code", "name", "dl__project_stage", "budget_allocated_amt"],
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "name": {
          "dtype": "str",
          "label": "Name",
          "renderType": "text",
          "behavior": { "visible": true, "sortable": true },
          "style": { "width": "200px" }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "behavior": { "visible": true }
        }
      },
      "editType": {
        "name": { "inputType": "text", "behavior": { "editable": true } },
        "dl__project_stage": {
          "inputType": "BadgeDropdownSelect",
          "lookupSource": "datalabel",
          "datalabelKey": "dl__project_stage"
        }
      }
    }
  },
  "ref_data_entityInstance": {},
  "total": 0
}
```

### Data Request

```
GET /api/v1/project?limit=20
```

```json
{
  "data": [
    {
      "id": "uuid-1",
      "code": "PROJ-001",
      "name": "Kitchen Renovation",
      "dl__project_stage": "Execution",
      "budget_allocated_amt": 50000,
      "manager__employee_id": "uuid-james"
    }
  ],
  "fields": [],
  "metadata": {},
  "ref_data_entityInstance": {
    "employee": { "uuid-james": "James Miller" }
  },
  "total": 5
}
```

---

## 10. Quick Reference

### Page-Component Matrix

| Page | Primary Components | View Modes |
|------|-------------------|------------|
| EntityListOfInstancesPage | EntityListOfInstancesTable, KanbanView, GridView, CalendarView | table, kanban, grid, calendar, graph |
| EntitySpecificInstancePage | EntityInstanceFormContainer, DynamicChildEntityTabs | - |
| EntityCreatePage | EntityInstanceFormContainer, DragDropFileUpload | - |
| SettingsOverviewPage | Entity table, EntityListOfInstancesTable (rbac), Modals | 5 tabs |
| SettingDetailPage | LabelsDataTable (drag-to-reorder) | - |

### Hook Usage

```typescript
import {
  useEntityInstanceMetadata,
  useEntityInstanceData
} from '@/db/tanstack-index';

// Get metadata (columns, field config) - 30 min cache
const { viewType, editType, fields, isLoading } = useEntityInstanceMetadata('project');

// Get data (rows) - 5 min cache
const { data, total, refData, isLoading } = useEntityInstanceData('project', { limit: 20 });
```

### Cache Keys

```typescript
// Metadata
QUERY_KEYS.entityInstanceMetadata(entityCode, component)
// → ['entityInstanceMetadata', 'project', 'entityListOfInstancesTable']

// Data
QUERY_KEYS.entityInstanceData(entityCode, params)
// → ['entityInstanceData', 'project', { limit: 20, offset: 0 }]
```

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Creating entity-specific pages | Use universal pages with entityConfig |
| Formatting in cache hook | Format in page via `useMemo(formatDataset)` |
| Direct `metadata.viewType` access | Use `extractViewType(metadata)` |
| Pattern detection in frontend | Backend sends complete metadata |
| Manual cache management | Let TanStack Query + WebSocket handle it |
| Hardcoding columns | Use `viewType` from backend |

### File Structure

```
apps/web/src/
├── pages/
│   └── shared/
│       ├── EntityListOfInstancesPage.tsx
│       ├── EntitySpecificInstancePage.tsx
│       └── EntityCreatePage.tsx
├── components/
│   └── shared/
│       ├── ui/
│       │   ├── EntityListOfInstancesTable.tsx
│       │   ├── KanbanView.tsx
│       │   ├── GridView.tsx
│       │   ├── Select.tsx
│       │   └── Modal.tsx
│       ├── entity/
│       │   ├── EntityInstanceFormContainer.tsx
│       │   └── DynamicChildEntityTabs.tsx
│       └── workflow/
│           └── DAGVisualizer.tsx
├── db/
│   ├── tanstack-index.ts
│   └── cache/hooks/
│       ├── useEntityInstanceData.ts
│       └── useEntityInstanceMetadata.ts
└── lib/
    ├── entityConfig.ts
    └── formatters/
        ├── datasetFormatter.ts
        └── types.ts
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [NORMALIZED_CACHE_ARCHITECTURE.md](../caching-frontend/NORMALIZED_CACHE_ARCHITECTURE.md) | Cache system details |
| [STATE_MANAGEMENT.md](../state_management/STATE_MANAGEMENT.md) | TanStack + Dexie state |
| [backend-formatter.service.md](../services/backend-formatter.service.md) | Backend metadata generation |
| [frontend_datasetFormatter.md](../services/frontend_datasetFormatter.md) | Frontend rendering |

---

**Version:** 9.4.0
**Last Updated:** 2025-12-01
**Status:** Production Ready

**Version History:**
| Version | Date | Changes |
|---------|------|---------|
| 9.4.0 | 2025-12-01 | Two-query architecture (metadata + data separate) |
| 9.3.0 | 2025-12-01 | Format-at-read pattern, TanStack Query + Dexie |
| 9.2.0 | 2025-11-30 | Redis field caching, content=metadata API |
| 9.1.0 | 2025-11-28 | RxDB removed, TanStack Query + Dexie only |
| 4.0 | 2025-10-31 | Settings runtime datalabel creation |
