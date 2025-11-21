# PMO Platform Architecture Summary

**Version:** 3.1.0 | **Last Updated:** 2025-01-21

---

## 1. Layout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        App Shell                                 │
│  ┌──────────┬──────────────────────────────────────────────┐   │
│  │ Sidebar  │              Main Content                     │   │
│  │          │  ┌────────────────────────────────────────┐  │   │
│  │ Entity   │  │ Header (Breadcrumbs, Actions)          │  │   │
│  │ Nav      │  ├────────────────────────────────────────┤  │   │
│  │          │  │                                        │  │   │
│  │ - Office │  │ Route Content (Dynamic)                │  │   │
│  │ - Project│  │ • EntityListOfInstancesPage (list/kanban/grid)    │  │   │
│  │ - Task   │  │ • EntitySpecificInstancePage (tabs, forms)       │  │   │
│  │ - ...    │  │ • EntityFormPage (create/edit)         │  │   │
│  │          │  │                                        │  │   │
│  └──────────┴──┴────────────────────────────────────────┴──┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Sidebar populated from `entityCodeMetadataStore` (30 min cache)
- 3 universal pages handle all 27+ entity types dynamically
- Route pattern: `/:entityCode` (list) → `/:entityCode/:id` (detail)

---

## 2. Component Architecture

```
Route Components (Pages)
    │
    ├── EntityPage ──────────► EntityDataTable / KanbanBoard / CalendarView
    │
    ├── EntitySpecificInstancePage ────► EntityFormContainer + DynamicChildEntityTabs
    │
    └── EntityFormPage ──────► EntityFormContainer (create mode)

Container Components
    │
    ├── EntityDataTable ─────► Table rows, sorting, filtering
    ├── EntityFormContainer ──► Form fields, validation
    └── DynamicChildEntityTabs► Child entity lists

Presentation Components (Pure)
    │
    ├── DAGVisualizer ───────► Stage workflow visualization
    ├── Badge ───────────────► Status indicators
    ├── FormField ───────────► Input rendering
    └── frontEndFormatterService► Renders based on backend metadata
```

**Key Points:**
- Zero frontend pattern detection - backend controls all rendering
- `frontEndFormatterService` is a pure renderer consuming backend metadata
- Components receive `data` + `metadata` props, render exactly as instructed

---

## 3. Backend Services

### Entity Infrastructure Service
**File:** `apps/api/src/services/entity-infrastructure.service.ts`

| Responsibility | Methods |
|----------------|---------|
| RBAC checks | `check_entity_rbac()`, `get_entity_rbac_where_condition()` |
| Instance registry | `set_entity_instance_registry()`, `update_entity_instance_registry()` |
| Parent-child links | `set_entity_instance_link()` |
| Permissions | `set_entity_rbac_owner()` |
| Cleanup | `delete_all_entity_infrastructure()` |

**Pattern:** Add-On Helper - Routes own queries, service provides infrastructure helpers.

### Backend Formatter Service
**File:** `apps/api/src/services/backend-formatter.service.ts`

| Responsibility | Output |
|----------------|--------|
| Metadata generation | 35+ pattern rules (e.g., `*_amt` → currency) |
| Datalabel fetching | Dropdown options for `dl__*` fields |
| Global settings | Currency, date, timestamp formatting |

**Pattern:** Single Source of Truth - Backend controls ALL field rendering decisions.

---

## 4. API Response Structure

Every entity endpoint returns:

```typescript
{
  data: [...],           // Entity instances (RBAC-filtered)
  fields: [...],         // Column names from SQL
  metadata: {            // Component-keyed field configs
    entityDataTable: { budget_amt: { viewType: 'currency', ... } },
    entityFormContainer: { ... }
  },
  datalabels: [...],     // Dropdown options for dl__* fields
  globalSettings: {...}, // App-wide formatting config
  total, limit, offset   // Pagination
}
```

---

## 5. Zustand Store Architecture (7 Stores)

### Session-Level Stores (30 min TTL, sessionStorage)

Refreshed only on **login** - cached for entire session.

| Store | Endpoint | Purpose |
|-------|----------|---------|
| `globalSettingsMetadataStore` | `GET /api/v1/settings/global` | Currency, date, timestamp formatting |
| `datalabelMetadataStore` | `GET /api/v1/settings/datalabels/all` | Dropdown options |
| `entityCodeMetadataStore` | `GET /api/v1/entity/codes` | Sidebar navigation |

### URL-Bound Stores (5 min TTL + URL invalidation, memory)

Invalidated immediately when URL changes. Fetched fresh on URL entry.

| Store | Populated By | Purpose |
|-------|--------------|---------|
| `entityComponentMetadataStore` | Entity API responses (`metadata`) | Field metadata per component |
| `EntityListOfInstancesDataStore` | `GET /api/v1/{entity}` | Table/list data |
| `EntitySpecificInstanceDataStore` | `GET /api/v1/{entity}/{id}` | Single entity detail + optimistic updates |

### Other Stores

| Store | Purpose |
|-------|---------|
| `useEntityEditStore` | Edit state, dirty tracking, undo/redo |

---

## 6. Caching Strategy

### Cache Rules

| Cache Type | TTL | Invalidation |
|------------|-----|--------------|
| Session-level | 30 min | On login only (refreshed each login) |
| URL-bound | 5 min | URL change (immediate) |

### Session-Level Cache Behavior

- Fetched once on **login**
- Cached for entire session (30 min TTL)
- Refreshed on next login
- Includes: `globalSettingsMetadataStore`, `datalabelMetadataStore`, `entityCodeMetadataStore`

### URL-Bound Cache Behavior

1. **Fetch on URL entry** - Data fetched only when navigating to that URL
2. **Invalidate on URL exit** - Cache cleared immediately when navigating away
3. **5 min TTL fallback** - Also invalidates if user stays >5 min on same page
4. **Optimistic updates** - `isDirty` flag tracks local changes until sync
5. **Includes:** `entityComponentMetadataStore`, `EntityListOfInstancesDataStore`, `EntitySpecificInstanceDataStore`

---

## 7. Data Flow (End-to-End)

```
┌─────────────┐    ┌─────────────────────────────────────┐    ┌─────────────────┐
│  PostgreSQL │───►│         Fastify API                 │───►│  Frontend       │
│  Database   │    │  ┌─────────────┬─────────────────┐  │    │  Zustand Stores │
│             │    │  │ Entity      │ Backend         │  │    │                 │
│  50+ tables │    │  │ Infra       │ Formatter       │  │    │  7 specialized  │
│             │    │  │ Service     │ Service         │  │    │  stores         │
└─────────────┘    │  └─────────────┴─────────────────┘  │    └────────┬────────┘
                   │         │                           │             │
                   │         ▼                           │             ▼
                   │  { data, metadata, datalabels,     │    ┌─────────────────┐
                   │    globalSettings }                 │    │  React          │
                   └─────────────────────────────────────┘    │  Components     │
                                                              └─────────────────┘
```

### API Response → Store Mapping

| Response Property | Frontend Store |
|-------------------|----------------|
| `data` (list) | `EntityListOfInstancesDataStore` |
| `data` (single) | `EntitySpecificInstanceDataStore` |
| `metadata` | `entityComponentMetadataStore` (piggyback) |
| `datalabels` | `datalabelMetadataStore` |
| `globalSettings` | `globalSettingsMetadataStore` |

---

## 8. Key Architecture Principles

| Principle | Implementation |
|-----------|----------------|
| **Zero Frontend Config** | Add DB column → backend auto-generates metadata |
| **Backend is Truth** | All rendering decisions made server-side |
| **URL-Bound Caching** | Fresh data guaranteed on navigation |
| **Session Caching** | Metadata cached 30 min for performance |
| **Add-On Pattern** | Routes own queries, services provide helpers |
| **No Foreign Keys** | Relationships via `entity_instance_link` table |

---

## Documentation Links

| Topic | Document |
|-------|----------|
| Backend Formatter Service | [backend-formatter.service.md](services/backend-formatter.service.md) |
| Entity Infrastructure Service | [entity-infrastructure.service.md](services/entity-infrastructure.service.md) |
| State Management | [state_management/README.md](state_management/README.md) |
| Data Flow Architecture | [state_management/data-flow-architecture.md](state_management/data-flow-architecture.md) |
| Zustand Integration | [state_management/zustand-integration-guide.md](state_management/zustand-integration-guide.md) |

---

**Performance Results:**
- 70% reduction in API calls (session caching)
- 81% faster page loads (cached metadata)
- 99% smaller edit payloads (field-level PATCH)
- <50ms navigation (URL-bound cache)
