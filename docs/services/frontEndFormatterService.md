# Frontend Formatter Service

**Version:** 8.0.0 | **Location:** `apps/web/src/lib/frontEndFormatterService.tsx`

---

## Documentation Index Entry

**Path:** `docs/services/frontEndFormatterService.md`

Frontend formatter service documentation for backend-driven metadata rendering and format-at-read optimization. Used by EntityDataTable, EntityFormContainer, and all view components for rendering field values.

**Keywords:** `frontEndFormatterService`, `renderViewModeFromMetadata`, `renderEditModeFromMetadata`, `formatDataset`, `formatRow`, `FormattedRow`, `format-at-read`, `valueFormatters`, `BackendFieldMetadata`, `EntityMetadata`, `datalabel badge`, `currency formatting`, `date formatting`, `DebouncedInput`, `metadata-driven`, `zero pattern detection`, `pure renderer`, `React Query select`

---

## Semantics

The Frontend Formatter Service is a **pure renderer** that consumes backend metadata and renders React elements. It contains **zero pattern detection logic** - all rendering decisions come from the backend.

**v8.0.0 Architecture Change:** Format-at-read optimization using React Query's `select` option. Cache stores raw data; formatting happens on read via memoized select.

**Core Principle:** Frontend executes backend instructions exactly. No logic, no decisions, no pattern detection.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    v8.0.0 FORMAT-AT-READ ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Backend API Response                          │   │
│  │  { data: [...], metadata: { entityDataTable: {...} } }          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼ Cached as RAW data                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            React Query Cache                                      │   │
│  │  queryKey: ['entity-list', entityCode, params]                   │   │
│  │  data: RAW response (not formatted)                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼ On READ via `select` option              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            lib/formatters/datasetFormatter.ts                     │   │
│  │  formatDataset(data, metadata) → FormattedRow[]                  │   │
│  │  ├── formatRow() per row                                          │   │
│  │  └── formatValue() per field (using valueFormatters)              │   │
│  │                                                                   │   │
│  │  React Query memoizes this - only runs when cache changes         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            FormattedRow Structure (Returned to Component)         │   │
│  │  {                                                                │   │
│  │    raw: { budget: 50000 },         // Original for mutations     │   │
│  │    display: { budget: '$50,000' },  // Pre-formatted strings     │   │
│  │    styles: { status: 'bg-blue-...' } // Badge CSS classes        │   │
│  │  }                                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼ At render time (fast!)                   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            EntityDataTable Cell Rendering                         │   │
│  │  row.display[key]  → Direct property access (zero function calls)│   │
│  │  row.styles[key]   → Badge styling (zero lookups)                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
v8.0.0 FORMAT-AT-READ FLOW:
───────────────────────────

API Response         React Query Cache        Hook select             Component
─────────────        ─────────────────        ───────────             ─────────

{ data,         →    Stores RAW data    →    useFormattedEntityList()
  metadata }         (canonical)               │
                                               ├── select: formatDataset()  ← ON READ
                                               │   └── React Query memoizes this
                                               │
                                               └── Returns FormattedRow[]
                                                              │
                                                              ▼
                                         EntityDataTable receives formattedData
                                              │
                                              └── Cell: row.display[key]  ← ZERO calls


v7.0.0 FORMAT-AT-FETCH (deprecated):
────────────────────────────────────

API Response              Hook (at fetch)           Component
─────────────             ────────────              ─────────

{ data, metadata }  →   formatDataset()       →   formattedData
                        in queryFn                 (already formatted)
                        │
                        └── Cached formatted data (larger cache, stale colors)


v6.x LEGACY FLOW (deprecated):
──────────────────────────────

API Response              Component (slow)
─────────────             ────────────────

{ data, metadata }  →     EntityDataTable
                            │
                            └── Per cell: renderViewModeFromMetadata(value, meta)
                                          └── 1,000+ function calls per render!
```

---

## Architecture Overview

### Primary API (v8.0.0 Format-at-Read)

**Location:** `apps/web/src/lib/formatters/`

| Module | Purpose | File |
|--------|---------|------|
| `formatDataset()` | Format entire dataset (via select) | `datasetFormatter.ts` |
| `formatRow()` | Format single row | `datasetFormatter.ts` |
| `formatValue()` | Format single value | `datasetFormatter.ts` |
| `valueFormatters` | Type-specific formatters | `valueFormatters.ts` |
| `FormattedRow` | Result type definition | `types.ts` |

### Hooks (v8.0.0)

**Location:** `apps/web/src/lib/hooks/useEntityQuery.ts`

| Hook | Purpose |
|------|---------|
| `useEntityInstanceList()` | Returns RAW data (for components that need raw) |
| `useFormattedEntityList()` | Returns formatted data via select (recommended) |

### Legacy API (Deprecated)

| Function | Status | Migration |
|----------|--------|-----------|
| `renderViewModeFromMetadata()` | **Deprecated** | Use `row.display[key]` |
| `renderEditModeFromMetadata()` | Active | Still used for edit mode |
| `formatValueFromMetadata()` | **Deprecated** | Use `formatValue()` |

### Supported View Types (12)

| viewType | Formatter | Output Example |
|----------|-----------|----------------|
| `currency` | `formatCurrency` | `$50,000.00` |
| `badge` / `datalabel` | `formatBadge` | `Planning` + style |
| `date` / `date_readonly` | `formatDate` | `2025-01-15` |
| `timestamp` / `timestamp_readonly` | `formatRelativeTime` | `2h ago` |
| `boolean` | `formatBoolean` | `✓` / `✗` |
| `percentage` | `formatPercentage` | `75%` |
| `uuid` | `formatUuid` | `abc12345...` |
| `json` / `jsonb` | `formatJson` | `{"key": "va...` |
| `array` | `formatArray` | `[3 items]` |
| `reference` / `entityInstance_Id` | `formatReference` | `abc12345...` |
| `text` | `formatText` | Raw string |

### Input Types (11)

| inputType | Edit Component | Description |
|-----------|----------------|-------------|
| `currency` | `<DebouncedInput type="number">` | Currency input |
| `number` | `<DebouncedInput type="number">` | Numeric input |
| `date` | `<input type="date">` | Date picker |
| `datetime` | `<input type="datetime-local">` | DateTime picker |
| `checkbox` | `<input type="checkbox">` | Toggle checkbox |
| `select` | `<select>` | Dropdown selector |
| `textarea` | `<DebouncedTextarea>` | Multi-line text |
| `text` | `<DebouncedInput type="text">` | Default text input |

---

## Tooling Overview

### v8.0.0 Usage (Recommended)

```typescript
// In useFormattedEntityList hook (automatic):
// lib/hooks/useEntityQuery.ts

export function useFormattedEntityList(entityCode: string, params: Params) {
  return useQuery({
    queryKey: ['entity-list', entityCode, params],
    queryFn: () => api.get(`/api/v1/${entityCode}`, { params }),
    // select transforms raw → formatted ON READ (memoized by React Query)
    select: (response) => ({
      ...response,
      data: formatDataset(response.data, response.metadata?.entityDataTable)
    })
  });
}

// In component (optimized rendering):
const { data: formattedData, metadata } = useFormattedEntityList(entityCode, params);

{formattedData.map(row => (
  <tr key={row.raw.id}>
    {columns.map(col => (
      <td key={col.key}>
        {row.styles[col.key] ? (
          <span className={row.styles[col.key]}>{row.display[col.key]}</span>
        ) : (
          row.display[col.key]
        )}
      </td>
    ))}
  </tr>
))}
```

### Edit Mode Rendering (Active)

```typescript
import { renderEditModeFromMetadata } from '@/lib/frontEndFormatterService';

// Edit mode still uses the legacy function
{metadata.fields.map(fieldMeta => (
  <div key={fieldMeta.key}>
    {renderEditModeFromMetadata(data[fieldMeta.key], fieldMeta, handleChange)}
  </div>
))}
```

### Type Guard Usage

```typescript
import { isFormattedData } from '@/lib/formatters';

// Check if data is already formatted (has FormattedRow structure)
if (isFormattedData(data)) {
  // Use row.display[key] for rendering
} else {
  // Use raw values (shouldn't happen with useFormattedEntityList)
}
```

---

## FormattedRow Type Definition

```typescript
// apps/web/src/lib/formatters/types.ts

interface FormattedRow<T = Record<string, any>> {
  raw: T;                              // Original values (for editing, mutations, sorting)
  display: Record<string, string>;     // Pre-formatted display strings
  styles: Record<string, string>;      // CSS classes (badges only)
}

// Example:
const row: FormattedRow = {
  raw: {
    id: 'uuid-123',
    budget_allocated_amt: 50000,
    dl__project_stage: 'planning'
  },
  display: {
    id: 'uuid-123...',
    budget_allocated_amt: '$50,000.00',
    dl__project_stage: 'Planning'
  },
  styles: {
    dl__project_stage: 'bg-blue-100 text-blue-700'
  }
};
```

---

## Format-at-Read vs Format-at-Fetch

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FORMAT-AT-FETCH (v7.0.0) - DEPRECATED                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  formatDataset() called in queryFn at fetch time                         │
│  Cache stores: { data: FormattedRow[], metadata }                        │
│                                                                         │
│  Problems:                                                               │
│  • Cache stores formatted strings (larger)                               │
│  • Datalabel color changes require cache invalidation                    │
│  • Multiple views need separate caches                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  FORMAT-AT-READ (v8.0.0) - CURRENT                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  formatDataset() called in select option ON READ                         │
│  Cache stores: RAW response only                                         │
│                                                                         │
│  Benefits:                                                               │
│  • Smaller cache (raw data only)                                        │
│  • Datalabel colors always fresh (reformatted on read)                   │
│  • Same cache, different formats (table vs kanban vs grid)              │
│  • React Query memoizes select - zero unnecessary re-formats            │
└─────────────────────────────────────────────────────────────────────────┘

BENCHMARKS (100 rows × 10 columns):
  v6.x render time: ~45ms per scroll frame (1,000 formatValue calls)
  v7.0.0/v8.0.0 render time: ~3ms per scroll frame (property access)
  Format time (once per cache): ~1-2ms
```

---

## Database/API/UI Mapping

### Metadata to Component Mapping

| Backend Metadata | View (v8.0.0) | Edit Component |
|------------------|---------------|----------------|
| `viewType: 'currency'` | `row.display[key]` | `<DebouncedInput type="number">` |
| `viewType: 'datalabel'` | `<span className={row.styles[key]}>` | `<DataLabelSelect>` |
| `viewType: 'date'` | `row.display[key]` | `<input type="date">` |
| `viewType: 'boolean'` | `row.display[key]` (✓/✗) | `<input type="checkbox">` |
| `viewType: 'reference'` | `row.display[key]` | `<EntitySelect>` |
| `viewType: 'json'` | `row.display[key]` | `<textarea>` |

### Component Integration Points

| Component | Uses format-at-read | Uses renderEditMode |
|-----------|---------------------|---------------------|
| EntityDataTable | Yes (via useFormattedEntityList) | Yes (inline edit) |
| EntityFormContainer | No (form layout) | Yes (form fields) |
| KanbanView | Yes (card content) | No |
| CalendarView | Yes (event display) | No |
| GridView | Yes (card display) | No |

---

## Migration Guide (v7.0.0 → v8.0.0)

### No Code Changes Required

The v8.0.0 format-at-read pattern is implemented in `useFormattedEntityList`. If you're using this hook, you're already using the new pattern.

### Understanding the Change

```typescript
// v7.0.0: formatDataset in queryFn (format-at-fetch)
useQuery({
  queryKey: [...],
  queryFn: async () => {
    const response = await api.get(...);
    const formattedData = formatDataset(response.data, response.metadata);
    return { ...response, formattedData };  // ← Formatted data cached
  }
});

// v8.0.0: formatDataset in select (format-at-read)
useQuery({
  queryKey: [...],
  queryFn: () => api.get(...),  // ← RAW data cached
  select: (response) => ({
    ...response,
    data: formatDataset(response.data, response.metadata)  // ← Format on read
  })
});
```

### Benefits You Get Automatically

1. **Smaller cache** - Only raw data stored
2. **Fresh colors** - Datalabel updates reflect immediately
3. **Memoized** - React Query only re-runs select when data changes

---

## Critical Considerations

### Design Principles

1. **Pure Renderer** - No business logic, no pattern detection
2. **Metadata-Driven** - All decisions from backend metadata
3. **Type-Safe** - Full TypeScript support
4. **Format on Read** - Data formatted via select, cached raw
5. **Stateless** - No internal state management in formatters

### What This Service Does NOT Do

| Responsibility | Where It Lives |
|----------------|----------------|
| Pattern detection | Backend Formatter Service |
| Field visibility decisions | Backend metadata |
| Validation rules | Backend metadata |
| Dropdown options | Backend datalabels |
| Entity reference resolution | Backend API |

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Unknown viewType | Returns raw value as string |
| Missing value | Returns `—` (em-dash) |
| Invalid metadata | Falls back to text formatting |
| Missing datalabels | Shows value without badge color |
| NaN currency | Returns `—` |

### Color Resolution Order

For badge/datalabel fields:
1. Look up `color_code` from datalabel store (by matching value → option.name)
2. Use `metadata.color` if explicitly provided
3. Fallback to default gray (`bg-gray-100 text-gray-600`)

---

## File Structure

```
apps/web/src/lib/
├── frontEndFormatterService.tsx    # Legacy renderers (edit mode active)
├── formatters/
│   ├── index.ts                    # Public exports
│   ├── types.ts                    # Type definitions (FormattedRow, etc.)
│   ├── datasetFormatter.ts         # formatDataset(), formatRow()
│   └── valueFormatters.ts          # Type-specific formatters
├── hooks/
│   └── useEntityQuery.ts           # useFormattedEntityList (format-at-read)
```

---

**Last Updated:** 2025-11-23 | **Version:** 8.0.0 | **Status:** Production Ready
