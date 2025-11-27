# PMO Platform - End-to-End Architecture

**Version:** 8.3.2 | **Last Updated:** 2025-11-27

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
| entity-infrastructure.service.md | `docs/services/` | Entity CRUD + ref_data_entityInstance |
| RBAC_INFRASTRUCTURE.md | `docs/rbac/` | Permissions |
| RefData README.md | `docs/refData/` | Entity reference resolution pattern |

---

## End-to-End Data Flow (v8.3.2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (BFF Layer)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  routes.ts                                                                   │
│  └── generateEntityResponse(entityCode, data, { components })                │
│       │                                                                      │
│       ├── backend-formatter.service.ts                                       │
│       │    ├── pattern-mapping.yaml     → fieldBusinessType                  │
│       │    ├── view-type-mapping.yaml   → renderType per component           │
│       │    └── edit-type-mapping.yaml   → inputType per component            │
│       │                                                                      │
│       └── entity-infrastructure.service.ts                                   │
│            └── build_ref_data_entityInstance()  → UUID→name lookup table     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐      │
│  │  API Response Structure (v8.3.2)                                   │      │
│  ├────────────────────────────────────────────────────────────────────┤      │
│  │  {                                                                 │      │
│  │    "data": [...],                    // RAW entity data            │      │
│  │    "fields": ["id", "name", "manager__employee_id"],               │      │
│  │    "ref_data_entityInstance": {      // Entity reference lookup    │      │
│  │      "employee": { "uuid-james": "James Miller" }                  │      │
│  │    },                                                              │      │
│  │    "metadata": {                                                   │      │
│  │      "entityDataTable": {            // Component-specific         │      │
│  │        "viewType": {                 // Display rendering          │      │
│  │          "manager__employee_id": {                                 │      │
│  │            "dtype": "uuid",                                        │      │
│  │            "label": "Manager",                                     │      │
│  │            "renderType": "entityInstanceId",                       │      │
│  │            "lookupSource": "entityInstance",                       │      │
│  │            "lookupEntity": "employee"                              │      │
│  │          }                                                         │      │
│  │        },                                                          │      │
│  │        "editType": {                 // Input rendering            │      │
│  │          "manager__employee_id": {                                 │      │
│  │            "dtype": "uuid",                                        │      │
│  │            "label": "Manager",                                     │      │
│  │            "inputType": "entityInstanceId",                        │      │
│  │            "lookupSource": "entityInstance",                       │      │
│  │            "lookupEntity": "employee"                              │      │
│  │          }                                                         │      │
│  │        }                                                           │      │
│  │      },                                                            │      │
│  │      "entityFormContainer": { "viewType": {...}, "editType": {...} }      │
│  │    },                                                              │      │
│  │    "datalabels": { "project_stage": [...] }                        │      │
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
│  │  useEntityInstanceList()     → Caches RAW data + ref_data_entityInstance  │
│  │                                                                     │     │
│  │  useFormattedEntityList()    → RAW cache + select transform         │     │
│  │    └── select: (raw) => {                                           │     │
│  │          const viewType = raw.metadata.entityDataTable.viewType;    │     │
│  │          const refData = raw.ref_data_entityInstance;               │     │
│  │          return formatDataset(raw.data, { viewType }, refData);     │     │
│  │        }                                                            │     │
│  │        └── Returns: FormattedRow[] (memoized by React Query)        │     │
│  │                                                                     │     │
│  │  useRefData(refData)         → Entity reference resolution hook     │     │
│  │    └── resolveFieldDisplay(fieldMeta, uuid)  → "James Miller"       │     │
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
│                         RESPONSIBILITY MATRIX (v8.3.2)                       │
├───────────────────────┬─────────────────────────────────────────────────────┤
│  LAYER                │  RESPONSIBILITY                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  Backend Formatter    │  • Pattern detection (column name → field type)      │
│  (BFF)                │  • Generate viewType/editType per component          │
│                       │  • Extract lookupEntity from field names             │
│                       │  • YAML-driven configuration (no hardcoding)         │
│                       │  • Single source of truth for rendering behavior     │
│                       │                                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  Entity Infra Service │  • build_ref_data_entityInstance() for reference resolution  │
│                       │  • Transactional CRUD (create/update/delete_entity)  │
│                       │  • RBAC permission checking                          │
│                       │                                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  React Query          │  • SOLE data cache (RAW data + ref_data_entityInstance)      │
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
│  useRefData Hook      │  • Resolve UUIDs → names via ref_data_entityInstance         │
│                       │  • Metadata-based field detection (NO patterns)      │
│                       │  • O(1) hash lookup                                  │
│                       │                                                      │
├───────────────────────┼─────────────────────────────────────────────────────┤
│                       │                                                      │
│  datasetFormatter     │  • Transform raw → FormattedRow in select            │
│                       │  • Access datalabelStore for badge colors            │
│                       │  • Resolve entity refs via ref_data_entityInstance           │
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

## ref_data_entityInstance Pattern (v8.3.0+)

Entity references are resolved via a response-level lookup table instead of per-row embedded objects:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ref_data_entityInstance Flow                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Backend scans data for *_id and *_ids fields                            │
│  2. Extracts UUIDs and entity codes (e.g., manager__employee_id → employee) │
│  3. Batch queries entity_instance table for display names                   │
│  4. Returns ref_data_entityInstance: { employee: { "uuid": "James Miller" } }            │
│                                                                              │
│  Frontend:                                                                   │
│  • Uses metadata.lookupEntity to determine entity code (NOT field patterns) │
│  • Looks up: ref_data_entityInstance[entityCode][uuid] → display name               │
│  • O(1) hash lookup vs N+1 API calls                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
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
│    manager__employee_id: 'uuid-james',                                       │
│    dl__project_stage: 'planning'                                             │
│  }                                                                           │
│                                                                              │
│  display: {                                                                  │
│    id: 'uuid-123',                                                           │
│    budget_allocated_amt: '$50,000.00',        // ← Formatted at read         │
│    manager__employee_id: 'James Miller',      // ← Resolved via ref_data_entityInstance  │
│    dl__project_stage: 'Planning'              // ← Label from datalabel      │
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
│  BadgeDropdownSelect  │                        │                             │
│                                                                              │
│  • Fetch lookup data via dedicated hooks                                     │
│  • Map entity references to display labels                                   │
│                       │                                                      │
│                       ▼                                                      │
│  BASE LAYER (Pure UI)                                                        │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Select               │ Input                  │ DebouncedInput              │
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
│    const { data, metadata, ref_data_entityInstance } = useFormattedEntityList(       │
│      'project', { view: 'entityDataTable' }                                  │
│    );                                                                        │
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
│    2. Cache RAW response + ref_data_entityInstance in React Query                    │
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
│      const refData = raw.ref_data_entityInstance;                                    │
│      return {                                                                │
│        ...raw,                                                               │
│        formattedData: formatDataset(raw.data, { viewType }, refData)         │
│      };                                                                      │
│    }                                                                         │
│                                                                              │
│  formatDataset:                                                              │
│    • Reads viewType[field].renderType                                        │
│    • Formats currency: 50000 → "$50,000.00"                                  │
│    • Resolves entity refs: ref_data_entityInstance[lookupEntity][uuid]               │
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
| Entity Lists + ref_data_entityInstance | React Query | 30s stale, 5m cache | Stale-while-revalidate |
| Entity Details + ref_data_entityInstance | React Query | 10s stale, 2m cache | Near real-time |
| Component Metadata | Zustand | 15 min | Session-level |
| Datalabels | Zustand | 1 hour | Reference data |
| Global Settings | Zustand | 1 hour | Reference data |
| Entity Types | Zustand | 1 hour | Sidebar navigation |

---

## Key Files Reference

| Purpose | Backend | Frontend |
|---------|---------|----------|
| Metadata Generation | `backend-formatter.service.ts` | - |
| Entity Reference Lookup | `entity-infrastructure.service.ts` | - |
| Pattern Config | `pattern-mapping.yaml` | - |
| View Config | `view-type-mapping.yaml` | - |
| Edit Config | `edit-type-mapping.yaml` | - |
| Data Hooks | - | `useEntityQuery.ts` |
| RefData Hook | - | `useRefData.ts` |
| RefData Resolver | - | `refDataResolver.ts` |
| Dataset Formatting | - | `datasetFormatter.ts` |
| Edit Rendering | - | `frontEndFormatterService.tsx` |
| Type Definitions | - | `lib/formatters/types.ts` |
| Metadata Store | - | `entityComponentMetadataStore.ts` |

---

## Anti-Patterns (v8.3.2)

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Frontend pattern detection | Duplicates backend logic | Use `metadata.lookupEntity` |
| Field name `_id` suffix check | Brittle, hardcoded | Use `isEntityReferenceField(fieldMeta)` |
| Per-row `_ID`/`_IDS` objects | N+1 payload bloat | Use `ref_data_entityInstance` lookup table |
| Hardcoded field types | Maintenance burden | Backend metadata driven |
| Formatting during render | Slow scroll | Format-at-read via `select` |
| Direct metadata.viewType access | Wrong structure | Use `extractViewType(metadata)` |

---

**Version:** 8.3.2 | **Updated:** 2025-11-27

**Recent Updates:**
- v8.3.2 (2025-11-27): Added `BadgeDropdownSelect` component, `vizContainer: { view, edit }` structure
- v8.3.1 (2025-11-26): Removed all frontend pattern detection, metadata as source of truth
- v8.3.0 (2025-11-26): Added `ref_data_entityInstance` pattern for entity reference resolution
- v8.2.0 (2025-11-25): Component-specific viewType/editType metadata structure
- v8.0.0 (2025-11-23): Format-at-read pattern with React Query `select`
