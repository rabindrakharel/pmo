# PMO Platform - End-to-End Architecture

**Version:** 8.2.0 | **Last Updated:** 2025-11-26

---

## Quick Reference

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 | UI rendering |
| **State** | React Query (data) + Zustand (metadata) | Hybrid caching |
| **Backend** | Fastify v5, TypeScript ESM | API + BFF |
| **Database** | PostgreSQL 14+ (50 tables) | Persistence |

```bash
./tools/start-all.sh          # Start platform
./tools/test-api.sh GET /api/v1/project  # Test API
./tools/logs-api.sh -f        # Monitor logs
```

**Test Credentials:** `james.miller@huronhome.ca` / `password123`

---

## Documentation Index

| Doc | Path | Purpose |
|-----|------|---------|
| STATE_MANAGEMENT.md | `docs/state_management/` | React Query + Zustand |
| frontEndFormatterService.md | `docs/services/` | Frontend rendering |
| backend-formatter.service.md | `docs/services/` | BFF metadata |
| RBAC_INFRASTRUCTURE.md | `docs/rbac/` | Permissions |

---

## End-to-End Data Flow (v8.2.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (BFF Layer)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  routes.ts                                                                   │
│  └── generateEntityResponse(entityCode, data, { components })                │
│       │                                                                      │
│       └── backend-formatter.service.ts                                       │
│            ├── pattern-mapping.yaml     → fieldBusinessType                  │
│            ├── view-type-mapping.yaml   → renderType per component           │
│            └── edit-type-mapping.yaml   → inputType per component            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │  API Response Structure (v8.2.0)                                   │      │
│  ├────────────────────────────────────────────────────────────────────┤      │
│  │  {                                                                 │      │
│  │    "data": [...],                    // RAW entity data            │      │
│  │    "fields": ["id", "name", "budget_allocated_amt"],               │      │
│  │    "metadata": {                                                   │      │
│  │      "entityDataTable": {            // Component-specific         │      │
│  │        "viewType": {                 // Display rendering          │      │
│  │          "budget_allocated_amt": {                                 │      │
│  │            "dtype": "float",                                       │      │
│  │            "label": "Budget Allocated",                            │      │
│  │            "renderType": "currency",                               │      │
│  │            "style": { "symbol": "$", "decimals": 2 }               │      │
│  │          }                                                         │      │
│  │        },                                                          │      │
│  │        "editType": {                 // Input rendering            │      │
│  │          "budget_allocated_amt": {                                 │      │
│  │            "dtype": "float",                                       │      │
│  │            "label": "Budget Allocated",                            │      │
│  │            "inputType": "number"                                   │      │
│  │          }                                                         │      │
│  │        }                                                           │      │
│  │      },                                                            │      │
│  │      "entityFormContainer": { "viewType": {...}, "editType": {...} }      │
│  │    },                                                              │      │
│  │    "datalabels": { "dl__project_stage": [...] }                    │      │
│  │  }                                                                 │      │
│  └────────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP Response
┌─────────────────────────────────────────────────────────────────────────────┐
│                   FRONTEND - Format-at-Read Architecture                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  useEntityQuery.ts - React Query Hooks                              │     │
│  ├─────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  useEntityInstanceList()     → Caches RAW data only                 │     │
│  │                                                                     │     │
│  │  useFormattedEntityList()    → RAW cache + select transform         │     │
│  │    └── select: (raw) => {                                           │     │
│  │          const viewType = raw.metadata.entityDataTable.viewType;    │     │
│  │          return formatDataset(raw.data, { viewType, editType });    │     │
│  │        }                                                            │     │
│  │        └── Returns: FormattedRow[] (memoized by React Query)        │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Zustand Stores (Metadata Only)                                     │     │
│  ├─────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  entityComponentMetadataStore   → { viewType, editType } per entity │     │
│  │  datalabelMetadataStore         → Dropdown options with colors      │     │
│  │  globalSettingsMetadataStore    → Currency/date formats             │     │
│  │  entityCodeMetadataStore        → Entity type definitions           │     │
│  │                                                                     │     │
│  │  ✗ NO entity data stored here (React Query only)                    │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Component Rendering (Zero Per-Cell Formatting)                     │     │
│  ├─────────────────────────────────────────────────────────────────────┤     │
│  │                                                                     │     │
│  │  EntityDataTable receives FormattedRow[]:                           │     │
│  │                                                                     │     │
│  │    VIEW MODE:  {row.display[key]}      // Pre-formatted string      │     │
│  │                {row.styles[key]}       // Pre-computed CSS class    │     │
│  │                                                                     │     │
│  │    EDIT MODE:  renderEditModeFromMetadata(row.raw[key], editType)   │     │
│  │                                                                     │     │
│  │  Zero function calls per cell during scroll (virtualized)           │     │
│  │                                                                     │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RESPONSIBILITY MATRIX                                │
├───────────────────────┬─────────────────────────────────────────────────────┤
│  LAYER                │  RESPONSIBILITY                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  Backend Formatter    │  • Pattern detection (column name → field type)      │
│  (BFF)                │  • Generate viewType/editType per component          │
│                       │  • YAML-driven configuration (no hardcoding)         │
│                       │  • Single source of truth for rendering behavior     │
│                       │                                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  React Query          │  • SOLE data cache (RAW data only)                   │
│                       │  • Stale-while-revalidate fetching                   │
│                       │  • Format-at-read via select option                  │
│                       │  • Optimistic updates with rollback                  │
│                       │                                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  Zustand Stores       │  • Metadata caching (15m-1h TTL)                     │
│                       │  • UI state (edit mode, dirty fields)                │
│                       │  • NO entity data (React Query only)                 │
│                       │                                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  datasetFormatter     │  • Transform raw → FormattedRow in select            │
│                       │  • Access datalabelStore for badge colors            │
│                       │  • Pure function (deterministic)                     │
│                       │                                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  Components           │  • Render FormattedRow.display/styles                │
│                       │  • Use FormattedRow.raw for edit inputs              │
│                       │  • ZERO pattern detection                            │
│                       │  • ZERO formatting logic                             │
│                       │                                                      │
└───────────────────────┴─────────────────────────────────────────────────────┘
```

---

## FormattedRow Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FormattedRow<T>                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  {                                                                           │
│    raw: T;                          // Original values (for mutations)       │
│    display: Record<string, string>; // Pre-formatted display strings         │
│    styles: Record<string, string>;  // CSS classes (badges only)             │
│  }                                                                           │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  EXAMPLE:                                                                    │
│                                                                              │
│  raw: {                                                                      │
│    id: 'uuid-123',                                                           │
│    budget_allocated_amt: 50000,                                              │
│    dl__project_stage: 'planning'                                             │
│  }                                                                           │
│                                                                              │
│  display: {                                                                  │
│    id: 'uuid-123',                                                           │
│    budget_allocated_amt: '$50,000.00',    // ← Formatted at read             │
│    dl__project_stage: 'Planning'          // ← Label from datalabel          │
│  }                                                                           │
│                                                                              │
│  styles: {                                                                   │
│    dl__project_stage: 'bg-blue-100 text-blue-700'  // ← Badge CSS            │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THREE-LAYER COMPONENT SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  APPLICATION LAYER (Business Logic)                                          │
│  ─────────────────────────────────────────────────────────────────────────   │
│  EntityDataTable      │ EntityFormContainer    │ KanbanView                  │
│  CalendarView         │ GridView               │ DAGVisualizer               │
│                                                                              │
│  • Consumes FormattedRow[] from useFormattedEntityList                       │
│  • Passes editType to renderEditModeFromMetadata                             │
│  • Delegates rendering decisions to metadata                                 │
│                       │                                                      │
│                       ▼                                                      │
│  DOMAIN LAYER (Data-Aware Components)                                        │
│  ─────────────────────────────────────────────────────────────────────────   │
│  EntitySelect         │ EntityMultiSelect      │ DataLabelSelect             │
│                                                                              │
│  • Fetch lookup data via dedicated hooks                                     │
│  • Map entity references to display labels                                   │
│                       │                                                      │
│                       ▼                                                      │
│  BASE LAYER (Pure UI)                                                        │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Select               │ Input                  │ BadgeDropdownSelect         │
│  Button               │ DatePicker             │ SearchableMultiSelect       │
│                                                                              │
│  • Props-driven, no business logic                                           │
│  • Reusable across application                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Example Flow: Project List Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Page Mount                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntityListOfInstancesPage.tsx:                                              │
│                                                                              │
│    const { data, metadata } = useFormattedEntityList('project', {            │
│      view: 'entityDataTable'                                                 │
│    });                                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: React Query Fetch + Cache                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  useFormattedEntityList hook:                                                │
│                                                                              │
│    1. Check cache → MISS → fetch GET /api/v1/project?view=entityDataTable    │
│    2. Cache RAW response in React Query                                      │
│    3. Store metadata in Zustand (entityComponentMetadataStore)               │
│    4. Store datalabels in Zustand (datalabelMetadataStore)                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Format-at-Read (select transform)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  React Query select option:                                                  │
│                                                                              │
│    select: (raw) => {                                                        │
│      const { viewType, editType } = raw.metadata.entityDataTable;            │
│      return {                                                                │
│        ...raw,                                                               │
│        formattedData: formatDataset(raw.data, { viewType, editType })        │
│      };                                                                      │
│    }                                                                         │
│                                                                              │
│  formatDataset:                                                              │
│    • Reads viewType[field].renderType                                        │
│    • Formats currency: 50000 → "$50,000.00"                                  │
│    • Looks up badge colors from datalabelMetadataStore                       │
│    • Returns FormattedRow[] (memoized by React Query)                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Component Render                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EntityDataTable receives:                                                   │
│    data: FormattedRow[]                                                      │
│    metadata: { viewType, editType }                                          │
│                                                                              │
│  Cell rendering (view mode):                                                 │
│    <span className={row.styles[key]}>{row.display[key]}</span>               │
│                                                                              │
│  Cell rendering (edit mode):                                                 │
│    renderEditModeFromMetadata(row.raw[key], editType[key], onChange)         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cache Strategy

| Data Type | Store | TTL | Strategy |
|-----------|-------|-----|----------|
| Entity Lists | React Query | 30s stale, 5m cache | Stale-while-revalidate |
| Entity Details | React Query | 10s stale, 2m cache | Near real-time |
| Component Metadata | Zustand | 15 min | Session-level |
| Datalabels | Zustand | 1 hour | Reference data |
| Global Settings | Zustand | 1 hour | Reference data |
| Entity Types | Zustand | 1 hour | Sidebar navigation |

---

## Key Files Reference

| Purpose | Backend | Frontend |
|---------|---------|----------|
| Metadata Generation | `backend-formatter.service.ts` | - |
| Pattern Config | `pattern-mapping.yaml` | - |
| View Config | `view-type-mapping.yaml` | - |
| Edit Config | `edit-type-mapping.yaml` | - |
| Data Hooks | - | `useEntityQuery.ts` |
| Dataset Formatting | - | `datasetFormatter.ts` |
| Edit Rendering | - | `frontEndFormatterService.tsx` |
| Type Definitions | - | `lib/formatters/types.ts` |
| Metadata Store | - | `entityComponentMetadataStore.ts` |

---

**Version:** 8.2.0 | **Updated:** 2025-11-26
