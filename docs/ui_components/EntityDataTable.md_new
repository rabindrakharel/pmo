# EntityDataTable Component

**Version:** 4.0.0 | **Location:** `apps/web/src/components/shared/ui/EntityDataTable.tsx`

---

## Semantics

EntityDataTable is a universal data table component with inline editing, sorting, filtering, and pagination. It uses backend metadata to determine column configuration and rendering, following the principle of **100% metadata-driven rendering**.

**Core Principle:** Backend metadata controls all columns, rendering, and edit behavior. Frontend is a pure renderer.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ENTITY DATA TABLE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    API Response                                  │    │
│  │  { data: [...], metadata: { fields: [...] }, datalabels }       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                          │
│                              v                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    EntityDataTable                               │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  Header Row                                              │    │    │
│  │  │  [Column titles from metadata.fields]                    │    │    │
│  │  │  [Sort indicators, filter icons]                         │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  Data Rows                                               │    │    │
│  │  │  ┌─────────────────────────────────────────────────┐    │    │    │
│  │  │  │ VIEW MODE: renderViewModeFromMetadata()          │    │    │    │
│  │  │  └─────────────────────────────────────────────────┘    │    │    │
│  │  │  ┌─────────────────────────────────────────────────┐    │    │    │
│  │  │  │ EDIT MODE: renderEditModeFromMetadata()          │    │    │    │
│  │  │  └─────────────────────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                  │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  Pagination                                              │    │    │
│  │  │  [Page numbers, page size selector]                      │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
Column Generation Flow
──────────────────────

Backend Metadata                  Column Config                   Rendered Column
────────────────                  ─────────────                   ───────────────

metadata.fields: [         →      columns: [              →       ┌──────────┐
  {                                 {                              │ Budget   │
    key: "budget_amt",               key: "budget_amt",           ├──────────┤
    label: "Budget",                 title: "Budget",             │$50,000.00│
    renderType: "currency",          width: "140px",              │$25,000.00│
    align: "right"                   align: "right",              │$75,000.00│
  }                                  render: (val) =>             └──────────┘
]                                      renderViewMode(val, meta)
                                   }
                                 ]


Inline Edit Flow
────────────────

User clicks Edit         Row enters Edit Mode         User saves
─────────────────        ──────────────────           ──────────

  [Edit Icon]      →     renderEditModeFromMetadata()    →     PATCH /api/v1/project/:id
      │                         │                                     │
      v                         v                                     v
  editingRowId = id      ┌────────────────┐                    Refetch + Re-render
                         │ $|50000.00   |│
                         │ input field  |│
                         └────────────────┘
```

---

## Architecture Overview

### Component Features

| Feature | Description |
|---------|-------------|
| Column Generation | From `metadata.fields` array |
| View Mode | `renderViewModeFromMetadata()` for display |
| Edit Mode | `renderEditModeFromMetadata()` for inputs |
| Sorting | Click column header to sort |
| Pagination | Page numbers, configurable page size |
| Row Actions | Edit, Delete icons per row |

### Rendering Modes

| Mode | Trigger | Renderer |
|------|---------|----------|
| View | Default state | `renderViewModeFromMetadata(value, fieldMeta)` |
| Edit | editingRowId === row.id | `renderEditModeFromMetadata(value, fieldMeta, onChange)` |

### Column Configuration

| Source | Field | Usage |
|--------|-------|-------|
| metadata.fields | key | Column data accessor |
| metadata.fields | label | Column header text |
| metadata.fields | renderType | View mode rendering |
| metadata.fields | inputType | Edit mode rendering |
| metadata.fields | width | Column width |
| metadata.fields | align | Text alignment |
| metadata.fields | editable | Can edit inline |

---

## Tooling Overview

### Basic Usage

```typescript
<EntityDataTable
  entityCode="project"
  data={projects}
  metadata={metadata}
  loading={isLoading}
  onRowClick={handleRowClick}
  onInlineEdit={handleInlineEdit}
  pagination={{
    page: currentPage,
    pageSize: 20,
    total: totalCount,
    onPageChange: setCurrentPage
  }}
/>
```

### Column Override

```typescript
// Custom column render (rare - prefer metadata)
<EntityDataTable
  columnOverrides={{
    special_field: {
      render: (value, record) => <CustomComponent value={value} />
    }
  }}
/>
```

---

## Database/API/UI Mapping

### Field Type to Table Cell

| renderType | View Display | Edit Component |
|------------|--------------|----------------|
| `currency` | `$50,000.00` (right-aligned) | `<input type="number">` |
| `badge` | `<Badge color="blue">` | `<DataLabelSelect>` |
| `date` | `Jan 15, 2025` | `<input type="date">` |
| `boolean` | Check/X icon | `<input type="checkbox">` |
| `reference` | Entity name | `<EntitySelect>` |
| `text` | Plain text | `<input type="text">` |

### Hidden Fields

| Field | Reason |
|-------|--------|
| `id` | Internal identifier |
| `metadata` | Complex JSON |
| `active_flag` | System field |
| `from_ts`, `to_ts` | Temporal fields |
| `version` | Optimistic locking |

---

## User Interaction Flow

```
Table Load Flow
───────────────

1. Page component mounts
   │
2. useQuery fetches GET /api/v1/project?view=entityDataTable
   │
3. API returns { data, metadata, datalabels }
   │
4. EntityDataTable receives props
   │
5. Generate columns from metadata.fields:
   columns = metadata.fields
     .filter(f => f.visible.entityDataTable)
     .map(fieldMeta => ({
       key: fieldMeta.key,
       title: fieldMeta.label,
       render: (val) => renderViewModeFromMetadata(val, fieldMeta)
     }))
   │
6. Render table with columns and data


Inline Edit Flow
────────────────

1. User clicks Edit icon on row
   │
2. setEditingRowId(row.id)
   │
3. Row re-renders in edit mode:
   renderEditModeFromMetadata(value, fieldMeta, onChange)
   │
4. User modifies values
   │
5. User clicks Save
   │
6. onInlineEdit(rowId, changedFields)
   │
7. PATCH /api/v1/project/:id
   │
8. Query invalidation, table refetches
   │
9. setEditingRowId(null)


Sort Flow
─────────

1. User clicks column header
   │
2. setSortConfig({ key: column.key, direction: 'asc' })
   │
3. Request: GET /api/v1/project?sort=budget_amt&order=asc
   │
4. Table re-renders with sorted data
```

---

## Critical Considerations

### Design Principles

1. **Metadata-Driven** - All column config from backend
2. **Pure Rendering** - No field type logic in component
3. **Inline Edit** - Edit without navigating away
4. **Optimistic Updates** - Immediate UI feedback
5. **RBAC Aware** - Edit/Delete based on permissions

### Column Visibility

| Field Pattern | EntityDataTable | Reason |
|---------------|-----------------|--------|
| `id` | Hidden | Internal ID |
| `code` | Visible | Business identifier |
| `name` | Visible | Primary display |
| `*_amt` | Visible (right) | Currency values |
| `dl__*` | Visible (badge) | Status/stage |
| `metadata` | Hidden | Too complex |
| `*_ts` | Visible (readonly) | Audit trail |

### Performance

| Optimization | Implementation |
|--------------|----------------|
| Virtual scrolling | For 1000+ rows |
| Debounced search | 300ms delay |
| Memoized columns | useMemo on metadata |
| Lazy load cells | Complex renders |

### Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Hardcoded columns | Use metadata.fields |
| Custom render per field | Use formatter service |
| Frontend field detection | Use backend metadata |
| Inline edit for all fields | Respect editable flag |

---

**Last Updated:** 2025-11-21 | **Status:** Production Ready
