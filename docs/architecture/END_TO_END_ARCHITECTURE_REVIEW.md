# PMO Platform - End-to-End Architecture Review

> Comprehensive analysis of Entity Component Architecture, CAS Chain, and Metadata-Driven Rendering
> Version: 12.2.0 | Date: 2025-12-02

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [End-to-End Logical Flow](#2-end-to-end-logical-flow)
3. [End-to-End Data Flow](#3-end-to-end-data-flow)
4. [End-to-End Sequence Flow](#4-end-to-end-sequence-flow)
5. [CAS Chain Architecture](#5-cas-chain-architecture)
6. [FieldRenderer Architecture](#6-fieldrenderer-architecture)
7. [Plumbing Issues & Critique](#7-plumbing-issues--critique)

---

## 1. Executive Summary

The PMO platform implements a **metadata-driven rendering architecture** where:
- **Backend** generates field metadata from column name patterns via YAML files
- **Caching layer** (TanStack Query + Dexie) manages data with two-query architecture
- **Frontend** renders fields using a FieldRenderer component registry pattern

### Architecture Layers

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE OVERVIEW                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 1: BACKEND (Source of Truth)                                  │ │
│  │  ─────────────────────────────────────────────────────────────────  │ │
│  │  pattern-mapping.yaml → Column → fieldBusinessType                  │ │
│  │  view-type-mapping.yaml → fieldBusinessType → renderType/behavior   │ │
│  │  edit-type-mapping.yaml → fieldBusinessType → inputType/validation  │ │
│  │  backend-formatter.service.ts → Generates API metadata              │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                      │                                    │
│                                      ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 2: CAS CHAIN (Cache-API-Store)                                │ │
│  │  ─────────────────────────────────────────────────────────────────  │ │
│  │  TanStack Query (In-Memory) ← 5 min staleTime                       │ │
│  │       ↓ miss                                                        │ │
│  │  Dexie (IndexedDB) ← 30 min TTL                                     │ │
│  │       ↓ miss                                                        │ │
│  │  API Call → Persist to both layers                                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                      │                                    │
│                                      ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  LAYER 3: FRONTEND RENDERING                                         │ │
│  │  ─────────────────────────────────────────────────────────────────  │ │
│  │  formatDataset() → Transforms raw → FormattedRow                    │ │
│  │  FieldRenderer → Resolves component by renderType/inputType         │ │
│  │  ViewFieldRenderer/EditFieldRenderer → Inline rendering             │ │
│  │  ComponentRegistry → Custom component lookup                        │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Logical Flow

### 2.1 High-Level Logical Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LOGICAL FLOW DIAGRAM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   DATABASE SCHEMA              YAML PATTERNS              METADATA OUTPUT    │
│   ──────────────────           ─────────────              ───────────────    │
│                                                                              │
│   Column: budget_allocated_amt                                               │
│          │                                                                   │
│          ▼                                                                   │
│   Pattern Match: *_amt → fieldBusinessType: "currency"                       │
│          │                                                                   │
│          ├─────────────────────────┬─────────────────────────┐               │
│          ▼                         ▼                         ▼               │
│   view-type-mapping.yaml    edit-type-mapping.yaml    Backend Service        │
│   ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────┐   │
│   │ renderType: currency │   │ inputType: number   │   │ Combine into    │   │
│   │ style: { $ symbol }  │   │ validation: min: 0  │   │ API response    │   │
│   └─────────────────────┘   └─────────────────────┘   └─────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  API RESPONSE STRUCTURE                                              │   │
│   │  ────────────────────────                                           │   │
│   │  {                                                                   │   │
│   │    "data": [...],                                                   │   │
│   │    "metadata": {                                                    │   │
│   │      "entityListOfInstancesTable": {                                │   │
│   │        "viewType": { "budget_allocated_amt": { renderType, style }},│   │
│   │        "editType": { "budget_allocated_amt": { inputType, validation}}│  │
│   │      }                                                              │   │
│   │    },                                                               │   │
│   │    "ref_data_entityInstance": { "employee": { "uuid": "Name" }}     │   │
│   │  }                                                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  FRONTEND CONSUMPTION                                                │   │
│   │  ────────────────────                                               │   │
│   │  1. useEntityInstanceMetadata() → Fetch metadata (30-min cache)     │   │
│   │  2. useEntityInstanceData() → Fetch data (5-min cache)              │   │
│   │  3. formatDataset() → Transform raw → FormattedRow                  │   │
│   │  4. FieldRenderer → Render based on renderType/inputType            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Decision Tree

```
FIELD RENDERING DECISION TREE
═══════════════════════════════

                    isEditing?
                        │
         ┌──────────────┴──────────────┐
         ▼                              ▼
     EDIT MODE                      VIEW MODE
         │                              │
         ▼                              ▼
   inputType from                 renderType from
   editType metadata              viewType metadata
         │                              │
    ┌────┴────┐                    ┌────┴────┐
    │         │                    │         │
    ▼         ▼                    ▼         ▼
'component'  HTML5             'component'  Inline
    │       native                 │        types
    │         │                    │         │
    ▼         ▼                    ▼         ▼
EditComponent EditField       ViewComponent ViewField
Registry     Renderer         Registry      Renderer
    │         │                    │         │
    ▼         ▼                    ▼         ▼
BadgeDropdown <input>         DAGVisualizer formatCurrency
EntitySelect  <textarea>      MetadataTable formatBadge
MultiSelect   <checkbox>      EntityName    formatDate
```

---

## 3. End-to-End Data Flow

### 3.1 Data Flow from Database to Screen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW DIAGRAM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STAGE 1: DATABASE → API                                                     │
│  ═══════════════════════                                                     │
│                                                                              │
│  PostgreSQL                  Backend Service                   Redis         │
│  ┌───────────────┐          ┌──────────────────────┐          ┌───────────┐ │
│  │ SELECT * FROM │ ────────▶│ generateEntityResponse│─────────▶│ Cache     │ │
│  │ app.project   │          │ ─────────────────────│          │ fields    │ │
│  │ WHERE ...     │          │ • Pattern match cols │          │ 24h TTL   │ │
│  └───────────────┘          │ • Generate viewType  │          └───────────┘ │
│                             │ • Generate editType  │                        │
│                             │ • Build ref_data     │                        │
│                             └──────────────────────┘                        │
│                                       │                                      │
│                                       ▼                                      │
│  STAGE 2: API → TANSTACK QUERY                                               │
│  ══════════════════════════════                                              │
│                                                                              │
│  API Response                 TanStack Query                   Dexie         │
│  ┌───────────────┐          ┌──────────────────────┐          ┌───────────┐ │
│  │ { data,       │          │ useEntityInstanceData │─────────▶│ IndexedDB │ │
│  │   metadata,   │ ────────▶│ ─────────────────────│          │ Persist   │ │
│  │   ref_data }  │          │ • 5 min staleTime    │          │ 30 min TTL│ │
│  └───────────────┘          │ • Cache in memory    │          └───────────┘ │
│                             │ • WebSocket subscribe│                        │
│                             └──────────────────────┘                        │
│                                       │                                      │
│                                       ▼                                      │
│  STAGE 3: TANSTACK → COMPONENT                                               │
│  ══════════════════════════════                                              │
│                                                                              │
│  TanStack Cache               Page Component                  Table/Form     │
│  ┌───────────────┐          ┌──────────────────────┐          ┌───────────┐ │
│  │ { data: [],   │          │ EntityListOfInstances │─────────▶│ Formatted │ │
│  │   metadata }  │ ────────▶│ ─────────────────────│          │ Rows      │ │
│  └───────────────┘          │ formatDataset(data,  │          │ {raw,     │ │
│                             │   metadata) = [      │          │  display, │ │
│                             │   { raw, display,    │          │  styles}  │ │
│                             │     styles }         │          └───────────┘ │
│                             │ ]                    │                        │
│                             └──────────────────────┘                        │
│                                       │                                      │
│                                       ▼                                      │
│  STAGE 4: COMPONENT → FIELDRENDERER                                          │
│  ═══════════════════════════════════                                         │
│                                                                              │
│  FormattedRow                 FieldRenderer                    Screen        │
│  ┌───────────────┐          ┌──────────────────────┐          ┌───────────┐ │
│  │ raw: {        │          │ <FieldRenderer       │          │ Rendered  │ │
│  │   budget: 50K │ ────────▶│   field={...}        │─────────▶│ Cell/     │ │
│  │ },            │          │   value={50000}      │          │ Field     │ │
│  │ display: {    │          │   isEditing={false}  │          │           │ │
│  │   budget:     │          │   formattedData={    │          │ $50,000   │ │
│  │   "$50,000"   │          │     display, styles  │          └───────────┘ │
│  │ }             │          │   }                  │                        │
│  └───────────────┘          │ />                   │                        │
│                             └──────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Metadata Flow Detail

```
METADATA FLOW (Two-Query Architecture)
══════════════════════════════════════

QUERY 1: METADATA (30-min cache, fetched first)
─────────────────────────────────────────────────

  GET /api/v1/project?content=metadata
          │
          ▼
  ┌────────────────────────────────────────┐
  │ Response: {                            │
  │   data: [],                            │
  │   fields: ["id", "name", "budget_..."],│
  │   metadata: {                          │
  │     entityListOfInstancesTable: {      │
  │       viewType: { ... },               │
  │       editType: { ... }                │
  │     }                                  │
  │   }                                    │
  │ }                                      │
  └────────────────────────────────────────┘
          │
          ▼
  useEntityInstanceMetadata()
  → Returns { viewType, editType, fields }
  → Table columns render immediately


QUERY 2: DATA (5-min cache, fetched after metadata)
────────────────────────────────────────────────────

  GET /api/v1/project?limit=20000
          │
          ▼
  ┌────────────────────────────────────────┐
  │ Response: {                            │
  │   data: [{ id, name, budget... }],     │
  │   ref_data_entityInstance: {           │
  │     employee: { "uuid": "Name" }       │
  │   },                                   │
  │   total: 45                            │
  │ }                                      │
  └────────────────────────────────────────┘
          │
          ▼
  useEntityInstanceData()
  → Returns { data, total, refData }
  → formatDataset(data, metadata)
  → Table rows populate
```

---

## 4. End-to-End Sequence Flow

### 4.1 Page Load Sequence

```
SEQUENCE DIAGRAM: Page Load
════════════════════════════

Browser          Page            Hooks           TanStack        Dexie          API
   │               │               │               │               │              │
   │──navigate────▶│               │               │               │              │
   │               │               │               │               │              │
   │               │──useEntityInstanceMetadata────▶│               │              │
   │               │               │               │──check cache──▶│              │
   │               │               │               │               │──check TTL──▶│
   │               │               │               │               │◀──miss/stale─│
   │               │               │               │               │              │
   │               │               │               │──GET ?content=metadata──────▶│
   │               │               │               │◀──{ fields, metadata }───────│
   │               │               │               │               │              │
   │               │               │               │──persist──────▶│              │
   │               │◀──{ viewType, editType }──────│               │              │
   │               │                               │               │              │
   │               │──RENDER COLUMNS (empty)───────│               │              │
   │               │                               │               │              │
   │               │──useEntityInstanceData────────▶│               │              │
   │               │               │               │──check cache──▶│              │
   │               │               │               │               │──check TTL──▶│
   │               │               │               │               │◀──miss───────│
   │               │               │               │               │              │
   │               │               │               │──GET ?limit=20000───────────▶│
   │               │               │               │◀──{ data, ref_data }─────────│
   │               │               │               │               │              │
   │               │               │               │──persist──────▶│              │
   │               │◀──{ data, refData }───────────│               │              │
   │               │                               │               │              │
   │               │──formatDataset(data, meta)────│               │              │
   │               │                               │               │              │
   │               │──RENDER ROWS─────────────────│               │              │
   │◀──display────│                               │               │              │
```

### 4.2 Edit Mode Sequence

```
SEQUENCE DIAGRAM: Edit Mode
════════════════════════════

User            Page          FormContainer    FieldRenderer    EditRegistry
 │               │                 │                │                │
 │──click Edit──▶│                 │                │                │
 │               │──setIsEditing(true)──────────────│                │
 │               │                 │                │                │
 │               │──render─────────▶│                │                │
 │               │                 │                │                │
 │               │                 │──<FieldRenderer isEditing={true}>│
 │               │                 │                │                │
 │               │                 │                │──resolveEditComponent()
 │               │                 │                │                │
 │               │                 │                │──lookup inputType────▶│
 │               │                 │                │◀──Component or null───│
 │               │                 │                │                │
 │               │                 │                │──render edit input───│
 │               │◀─────────────────────────────────│                │
 │               │                 │                │                │
 │──type value──▶│                 │                │                │
 │               │──onChange(field, value)─────────▶│                │
 │               │                 │                │                │
 │               │                 │──updateDraftField(field, value)─│
 │               │                 │                │                │
 │               │                 │──persist to Dexie (async)──────│
 │               │                 │                │                │
 │               │──re-render with new value───────│                │
 │◀─────────────│                 │                │                │
```

---

## 5. CAS Chain Architecture

### 5.1 Cache Layer Hierarchy

```
CAS CHAIN: Cache-API-Store
═══════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: TanStack Query (In-Memory)                                         │
│  ───────────────────────────────────                                        │
│  • Purpose: Server state management                                         │
│  • Stale Time: 5 min (entityInstanceData), 30 min (metadata)                │
│  • GC Time: 30 min                                                          │
│  • Features: Auto-refetch, stale-while-revalidate, optimistic updates       │
│                                                                              │
│  Query Keys:                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ['entityInstanceData', 'project', { limit: 20 }]                       │ │
│  │ ['entityInstanceMetadata', 'project', 'entityListOfInstancesTable']    │ │
│  │ ['datalabel', 'project_stage']                                         │ │
│  │ ['entityCodes']                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  LAYER 2: Dexie (IndexedDB)                                                  │
│  ────────────────────────────                                               │
│  • Purpose: Persistent cache, offline-first                                 │
│  • Database: pmo-cache-v5                                                   │
│  • Tables: 8 unified tables                                                 │
│  • Max Age: 30 min (data), 24 hours (metadata)                              │
│                                                                              │
│  Tables:                                                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ datalabel          - Settings dropdown options                         │ │
│  │ entityCode         - Entity type definitions                           │ │
│  │ globalSetting      - App-wide settings                                 │ │
│  │ entityInstanceData - Query results cache                               │ │
│  │ entityInstanceMetadata - Field metadata cache                          │ │
│  │ entityInstance     - Entity instance names                             │ │
│  │ entityLink         - Parent-child relationships                        │ │
│  │ draft              - Unsaved edit state (survives refresh)             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: API                                                                │
│  ─────────                                                                   │
│  • Called when both caches miss or data is stale                            │
│  • Returns: { data, metadata, ref_data_entityInstance }                     │
│  • Populates both cache layers on response                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Cache Resolution Flow

```
CACHE RESOLUTION ALGORITHM
══════════════════════════

useEntityInstanceData('project', { limit: 20 })
        │
        ▼
┌───────────────────────────────────────┐
│ STEP 1: Check TanStack Query Cache    │
│ queryClient.getQueryData(queryKey)    │
│                                       │
│ HIT? ─────▶ Return immediately        │
│ MISS? ────▶ Continue to Step 2        │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ STEP 2: Check Dexie (IndexedDB)       │
│ getEntityInstanceData(entityCode,     │
│   params)                             │
│                                       │
│ HIT + FRESH? ─────▶ Return + Populate │
│                     TanStack          │
│ MISS/STALE? ──────▶ Continue to API   │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│ STEP 3: Fetch from API                │
│ GET /api/v1/project?limit=20          │
│                                       │
│ Response: { data, metadata, ref_data }│
│                                       │
│ Actions:                              │
│ • persistToEntityInstanceData(...)    │
│ • persistToEntityInstanceNames(...)   │
│ • upsertRefDataEntityInstance(...)    │
│ • Return to component                 │
└───────────────────────────────────────┘
```

---

## 6. FieldRenderer Architecture

### 6.1 Component Registry Pattern

```
FIELDRENDERER ARCHITECTURE (v12.2.0)
════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  <FieldRenderer                                                              │
│    field={{ key: 'budget', renderType: 'currency', inputType: 'number' }}   │
│    value={50000}                                                             │
│    isEditing={false}                                                         │
│    formattedData={{ display: { budget: '$50,000' }, styles: {} }}           │
│  />                                                                          │
│                                                                              │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  DECISION: isEditing?                                                 │   │
│  │  ─────────────────────                                               │   │
│  │                                                                       │   │
│  │      isEditing=false                    isEditing=true                │   │
│  │           │                                  │                        │   │
│  │           ▼                                  ▼                        │   │
│  │  ┌──────────────────┐              ┌──────────────────┐               │   │
│  │  │ VIEW MODE        │              │ EDIT MODE        │               │   │
│  │  │                  │              │                  │               │   │
│  │  │ Uses: renderType │              │ Uses: inputType  │               │   │
│  │  │                  │              │                  │               │   │
│  │  │ Resolution:      │              │ Resolution:      │               │   │
│  │  │ 1. vizContainer  │              │ 1. vizContainer  │               │   │
│  │  │    .view         │              │    .edit         │               │   │
│  │  │ 2. ViewComponent │              │ 2. EditComponent │               │   │
│  │  │    Registry      │              │    Registry      │               │   │
│  │  │ 3. ViewField     │              │ 3. EditField     │               │   │
│  │  │    Renderer      │              │    Renderer      │               │   │
│  │  └──────────────────┘              └──────────────────┘               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Registered Components

```
COMPONENT REGISTRIES
════════════════════

VIEW COMPONENT REGISTRY (renderType → Component)
─────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────────────┐
│ CUSTOM COMPONENTS (renderType: 'component' + component: 'Name')              │
│ ─────────────────────────────────────────────────────────────               │
│ 'DAGVisualizer'       → DAGVisualizerView (workflow stages)                 │
│ 'MetadataTable'       → MetadataTableView (JSON key-value)                  │
│ 'QuoteItemsRenderer'  → QuoteItemsView (line items)                         │
│ 'EntityInstanceName'  → EntityInstanceNameView (UUID → Name)                │
│ 'EntityInstanceNames' → EntityInstanceNamesView (UUID[] → Chips)            │
│ 'DateRangeVisualizer' → DateRangeVisualizerView (start-end bar)             │
│                                                                              │
│ INLINE TYPES (renderType maps directly)                                      │
│ ───────────────────────────────────────                                      │
│ 'timestamp' → TimestampView (relative time)                                  │
│ 'date'      → DateView (formatted date)                                      │
│ 'badge'     → BadgeView (colored badge)                                      │
│ 'currency'  → CurrencyView ($ formatted)                                     │
│ 'tags'      → TagsView (chip list)                                           │
│ 'json'      → JsonView (pretty print)                                        │
└─────────────────────────────────────────────────────────────────────────────┘

EDIT COMPONENT REGISTRY (inputType → Component)
───────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────────────┐
│ CUSTOM COMPONENTS (inputType: 'component' + component: 'Name')               │
│ ─────────────────────────────────────────────────────────────               │
│ 'DAGVisualizer'               → DAGVisualizerEdit (click-to-select)         │
│ 'MetadataTable'               → MetadataTableEdit (editable table)          │
│ 'BadgeDropdownSelect'         → BadgeDropdownSelectEdit (colored dropdown)  │
│ 'DataLabelSelect'             → DataLabelSelectEdit (alias)                 │
│ 'EntityInstanceNameSelect'    → EntityInstanceNameSelectEdit (search)       │
│ 'EntityInstanceNameMultiSelect' → EntityInstanceNameMultiSelectEdit         │
│                                                                              │
│ DEBOUNCED INPUTS (inputType maps directly)                                   │
│ ──────────────────────────────────────────                                   │
│ 'text'      → DebouncedTextInputEdit (300ms debounce)                       │
│ 'number'    → DebouncedNumberInputEdit                                       │
│ 'email'     → DebouncedEmailInputEdit                                        │
│ 'textarea'  → DebouncedTextareaInputEdit                                     │
│ 'multiselect' → MultiSelectEdit                                              │
└─────────────────────────────────────────────────────────────────────────────┘

UNREGISTERED TYPES (Handled by inline renderers)
────────────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────────────┐
│ EditFieldRenderer handles these with native HTML5 <input> elements:          │
│ • date, time, datetime-local, checkbox, color, file, range, hidden          │
│                                                                              │
│ ViewFieldRenderer handles these inline:                                      │
│ • number, percentage, boolean, entityLink, entityLinks, filesize, etc.      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Plumbing Issues & Critique

### 7.1 Critical Plumbing Issues

#### **ISSUE 1: Misleading Documentation in Backend Service**

**Location:**
- Backend: `backend-formatter.service.ts:62-64` (documentation example)
- Actual YAML: `edit-type-mapping.yaml:520-524`

**Problem:**
```typescript
// backend-formatter.service.ts:62 shows this MISLEADING example:
"inputType": "currency",  // ← Documentation says 'currency'
```

**Reality:** The actual YAML uses `inputType: number`:
```yaml
# edit-type-mapping.yaml:517-524 (ACTUAL)
currency:
  dtype: float
  entityListOfInstancesTable:
    inputType: number  # ← Correctly uses 'number', not 'currency'
```

**Impact:** LOW - The code works correctly, but documentation is misleading. Developers reading the backend-formatter.service.ts header comments might think 'currency' is a valid inputType when it's not.

**Recommendation:** Update the documentation example in backend-formatter.service.ts to show `inputType: number` for currency fields.

---

#### **ISSUE 2: Inconsistent renderType/inputType Naming**

**Location:** Multiple files

**Problem:** Backend YAML uses some types that don't align with frontend registry:

| Backend renderType | Frontend Registered? | Issue |
|-------------------|---------------------|-------|
| `entityInstanceId` | No (uses formatReference) | Inline fallback works, but VIEW registry has 'EntityInstanceName' |
| `entityInstanceIds` | No | Falls through to inline rendering |
| `entityLink` | No | Falls through - shows truncated UUID |

**Evidence:**
```typescript
// ViewFieldRenderer.tsx:169-176
case 'entityLink':
case 'entityInstanceId':
  // Should be resolved via refData, fallback to UUID display
  return (
    <span className="text-blue-600 ${className || ''}">
      {String(value).slice(0, 8)}...  // ← Showing truncated UUID is bad UX
    </span>
  );
```

---

#### **ISSUE 3: format-at-read vs FieldRenderer Double Formatting**

**Location:**
- `EntityListOfInstancesPage.tsx:153-161` - calls formatDataset()
- `FieldRenderer.tsx` - also calls formatters

**Problem:** Data is formatted twice in some code paths:
1. `formatDataset()` is called in page component (format-at-read pattern)
2. `ViewFieldRenderer.tsx:40-61` prefers formattedData.display if available
3. But if formattedData is not passed, ViewFieldRenderer formats AGAIN

**Redundancy:**
```typescript
// EntityListOfInstancesPage.tsx:153
const formattedData = useMemo(() => {
  return formatDataset(rawData, metadata as ComponentMetadata | undefined);
}, [rawData, metadata, entityCode]);

// But EntityInstanceFormContainer doesn't always pass formattedData
// ViewFieldRenderer.tsx:78-104 has inline formatting as "fallback"
// This means some fields get formatted twice in different code paths
```

---

#### **ISSUE 4: Missing Component Registration for view-type-mapping.yaml Types**

**Location:** `registerComponents.tsx` vs `view-type-mapping.yaml`

**Problem:** YAML defines many renderTypes that have no registered component:

| YAML renderType | Registered? | Handling |
|----------------|-------------|----------|
| `duration` | No | Falls to ViewFieldRenderer inline |
| `filesize` | No | Falls to ViewFieldRenderer inline |
| `avatar` | No | Falls to ViewFieldRenderer inline |
| `color` | No | Falls to ViewFieldRenderer inline |
| `icon` | No | Falls to ViewFieldRenderer inline |
| `file` | No | Falls to ViewFieldRenderer inline |
| `image` | No | Falls to ViewFieldRenderer inline |

This is **by design** (inline rendering), but:
- Documentation doesn't clearly state which types are "inline by design"
- Component resolution logs might show confusing "not found" messages

---

#### **ISSUE 5: lookupField vs lookupEntity Inconsistency**

**Location:**
- Backend: `backend-formatter.service.ts:1047-1061`
- Frontend: `EntityInstanceFormContainer.tsx:136-137`

**Problem:** Field metadata uses different property names:
- `lookupField` - for datalabel key (e.g., 'dl__project_stage')
- `lookupEntity` - for entity code (e.g., 'employee')
- `lookupSourceTable` - for source ('datalabel' or 'entityInstance')

**Evidence of confusion:**
```typescript
// EntityInstanceFormContainer.tsx:136-137
lookupEntity: (viewMeta as any)?.lookupEntity || editMeta?.lookupEntity,
lookupField: editMeta?.lookupField,
// Note: casting to 'any' suggests type mismatch
```

---

#### **ISSUE 6: editType vs viewType Metadata Extraction Fragility**

**Location:** `EntityInstanceFormContainer.tsx:97-105`

**Problem:** Component assumes specific metadata structure but doesn't validate:

```typescript
// EntityInstanceFormContainer.tsx:97-98
const componentMetadata = (metadata as any)?.viewType ? metadata
  : (metadata as any)?.entityInstanceFormContainer;
```

**Issues:**
1. Uses `as any` cast - no type safety
2. Falls back silently without warning
3. Multiple metadata shapes supported, but no validation
4. If metadata is `{ entityListOfInstancesTable: { viewType, editType } }` but component expects `{ viewType, editType }`, extraction fails silently

---

#### **ISSUE 7: RegisterAllComponents() Auto-Call Pattern** *(VERIFIED - NOT A BUG)*

**Location:** `registerComponents.tsx:642-643` and `App.tsx:15-18`

**Finding:**
```typescript
// registerComponents.tsx:642-643
// Auto-register on module load (optional - can also call explicitly)
// registerAllComponents();  // ← COMMENTED OUT (intentional)

// App.tsx:15-18 - EXPLICIT CALL EXISTS
import { registerAllComponents } from './lib/fieldRenderer/registerComponents';
registerAllComponents();  // ← Called at app initialization ✓
```

**Status:** This is NOT a bug. The component registration is correctly called in App.tsx during app initialization. The commented-out auto-register is intentional to give developers explicit control.

**Note:** This pattern is correct - explicit registration at app entry point is better than auto-registration on module load.

---

#### **ISSUE 8: Dexie Hydration Race Condition**

**Location:** `useEntityInstanceData.ts:171-187`

**Problem:** When Dexie cache is fresh but TanStack Query cache is empty, data is loaded from Dexie but ref_data_entityInstance might not be populated in TanStack Query cache:

```typescript
// useEntityInstanceData.ts:171-187
if (!isStale) {
  // v11.0.0: Upsert to TanStack Query cache for edit mode
  if (cached.refData) {
    upsertRefDataEntityInstance(queryClient, cached.refData);
  }
  return { ... };
}
```

**Risk:** If `cached.refData` is undefined (Dexie record from before refData was added), entity reference fields won't resolve names in edit mode.

---

#### **ISSUE 9: WebSocket Pre-Subscribe vs Data Load Race**

**Location:** `useEntityInstanceData.ts:122-132`

**Problem:** WebSocket subscription happens in useEffect, but queryFn runs immediately:

```typescript
useEffect(() => {
  if (isQueryEnabled && !hasSubscribedRef.current) {
    wsManager.subscribe(entityCode, []);
    hasSubscribedRef.current = true;
  }
  // ...
}, [entityCode, isQueryEnabled]);
```

**Race Condition:**
1. Component mounts
2. useQuery starts fetching (queryFn runs)
3. useEffect runs (WebSocket subscribes)
4. If WebSocket message arrives BEFORE queryFn completes, it might invalidate stale cache

This is documented as "pre-subscribe to close race window" but the implementation subscribes AFTER query starts.

---

#### **ISSUE 10: Two-Query Architecture Metadata/Data Mismatch**

**Location:**
- `EntityListOfInstancesPage.tsx:98-131`
- Two separate hooks: `useEntityInstanceMetadata` and `useEntityInstanceData`

**Problem:** Metadata and data are fetched separately with different cache TTLs:
- Metadata: 30-min cache
- Data: 5-min cache

**Risk Scenario:**
1. Page loads, metadata cached for 30 min
2. Backend YAML updated (new field added)
3. After 5 min, data refetches with new field
4. Old metadata (25 min remaining) doesn't include new field
5. New field renders with no metadata → default 'text' renderType

---

### 7.2 Minor Issues

#### **ISSUE 11: Empty Array Handling in ViewFieldRenderer**

```typescript
// ViewFieldRenderer.tsx:68-74
if (value === null || value === undefined || value === '') {
  const emptyValue = style?.emptyValue || '—';
  return <span className="text-gray-400">{emptyValue}</span>;
}
```

**Issue:** Empty arrays `[]` are truthy, so they pass this check but then fail rendering for array-expecting types like 'tags'.

---

#### **ISSUE 12: formattedData Type in FieldRenderer**

```typescript
// FieldRenderer.tsx:77-80
formattedData?: {
  display: Record<string, string>;
  styles: Record<string, string>;
};
```

**Issue:** This type doesn't include `raw`, which is part of `FormattedRow<T>`. Components might expect the full FormattedRow but only receive partial data.

---

#### **ISSUE 13: Date Timezone Handling**

```typescript
// EditFieldRenderer.tsx:328-329
const date = new Date(value);
return date.toISOString().split('T')[0];
```

**Issue:** `toISOString()` converts to UTC. A date entered as "2024-01-15" in EST might display as "2024-01-14" in the input.

---

### 7.3 Architectural Recommendations

1. **Create Type Guards** for metadata structure validation
2. **Auto-register components** on module import (uncomment line 642-643)
3. **Unify format-at-read** - either always pass formattedData or remove ViewFieldRenderer inline formatting
4. **Add 'currency' to EditComponentRegistry** or ensure backend sends 'number'
5. **Add debug logging** for component resolution failures
6. **Implement metadata version tracking** to detect stale metadata after backend updates
7. **Document "inline by design" types** in view-type-mapping.yaml

---

## Summary

The PMO platform implements a sophisticated metadata-driven architecture with:
- **3-tier caching** (TanStack Query → Dexie → API)
- **YAML-driven field metadata** (pattern-mapping → view/edit type mapping)
- **Component registry pattern** for modular rendering

### Issue Severity Classification

| Issue | Severity | Status |
|-------|----------|--------|
| #1 Misleading documentation | LOW | Documentation bug only |
| #2 Inconsistent renderType naming | MEDIUM | Entity references may show truncated UUIDs |
| #3 Format-at-read double formatting | LOW | Performance inefficiency |
| #4 Missing component registrations | LOW | By-design inline rendering |
| #5 lookupField/lookupEntity confusion | MEDIUM | Type safety issue |
| #6 Metadata extraction fragility | MEDIUM | Silent failures possible |
| #7 RegisterAllComponents | N/A | VERIFIED NOT A BUG |
| #8 Dexie hydration race | MEDIUM | Edit mode name resolution |
| #9 WebSocket pre-subscribe race | LOW | Documented limitation |
| #10 Metadata/data TTL mismatch | HIGH | Schema changes cause rendering issues |

### Critical Issues to Address

1. **Metadata/data cache TTL mismatch (ISSUE #10)** - Backend schema changes can cause 25+ minutes of stale metadata
2. **Entity reference truncation (ISSUE #2)** - `entityLink` renderType shows truncated UUIDs
3. **lookupField vs lookupEntity (ISSUE #5)** - Type confusion between datalabel and entity lookups
4. **Metadata extraction fragility (ISSUE #6)** - Multiple metadata shapes handled without validation

### What Works Well

1. ✅ Component registration is correctly called at app initialization
2. ✅ Currency fields use correct `inputType: number` (not 'currency')
3. ✅ Format-at-read pattern correctly implemented with formattedData fallback
4. ✅ Inline types (duration, filesize, etc.) handled by ViewFieldRenderer by design

The architecture is well-designed for scale (27+ entity types, single codebase) with clear separation between backend metadata generation and frontend rendering. The main gaps are around edge cases in type handling and cache synchronization.
