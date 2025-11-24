# Frontend Formatter Service

**Version:** 7.0.0 | **Location:** `apps/web/src/lib/frontEndFormatterService.tsx`

---

## Documentation Index Entry

**Path:** `docs/services/frontEndFormatterService.md`

Frontend formatter service documentation for backend-driven metadata rendering and format-at-fetch optimization. Used by EntityDataTable, EntityFormContainer, and all view components for rendering field values.

**Keywords:** `frontEndFormatterService`, `renderViewModeFromMetadata`, `renderEditModeFromMetadata`, `formatDataset`, `formatRow`, `FormattedRow`, `format-at-fetch`, `valueFormatters`, `BackendFieldMetadata`, `EntityMetadata`, `datalabel badge`, `currency formatting`, `date formatting`, `DebouncedInput`, `metadata-driven`, `zero pattern detection`, `pure renderer`

---

## Semantics

The Frontend Formatter Service is a **pure renderer** that consumes backend metadata and renders React elements. It contains **zero pattern detection logic** - all rendering decisions come from the backend.

**v7.0.0 Architecture Change:** Format-at-fetch optimization moves formatting from render time to fetch time for improved scroll performance.

**Core Principle:** Frontend executes backend instructions exactly. No logic, no decisions, no pattern detection.

---

## System Design Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    v7.0.0 FORMAT-AT-FETCH ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Backend API Response                          │   │
│  │  { data: [...], metadata: { entityDataTable: {...} } }          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼ ONCE at fetch time                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            lib/formatters/datasetFormatter.ts                     │   │
│  │  formatDataset(data, metadata) → FormattedRow[]                  │   │
│  │  ├── formatRow() per row                                          │   │
│  │  └── formatValue() per field (using valueFormatters)              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            FormattedRow Structure (Cached)                        │   │
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
v7.0.0 FORMAT-AT-FETCH FLOW:
─────────────────────────────

API Response                 Hook (once)                    Component (fast)
─────────────────            ────────────                   ─────────────────

{ data, metadata }  ───>   useEntityInstanceList()
                              │
                              ├── formatDataset(data, metadata)  ← ONE-TIME
                              │   └── Returns FormattedRow[]
                              │
                              └── Returns { data, formattedData, metadata }
                                                    │
                                                    ▼
                           EntityDataTable receives formattedData
                              │
                              └── Cell: row.display[key]  ← ZERO function calls


LEGACY FLOW (deprecated):
─────────────────────────

API Response              Component (slow)
─────────────             ────────────────

{ data, metadata }  ───>  EntityDataTable
                            │
                            └── Per cell: renderViewModeFromMetadata(value, meta)
                                          └── 1,000+ function calls per render!
```

---

## Architecture Overview

### Primary API (v7.0.0 Format-at-Fetch)

**Location:** `apps/web/src/lib/formatters/`

| Module | Purpose | File |
|--------|---------|------|
| `formatDataset()` | Format entire dataset once | `datasetFormatter.ts` |
| `formatRow()` | Format single row | `datasetFormatter.ts` |
| `formatValue()` | Format single value | `datasetFormatter.ts` |
| `valueFormatters` | Type-specific formatters | `valueFormatters.ts` |
| `FormattedRow` | Result type definition | `types.ts` |

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

### v7.0.0 Usage (Recommended)

```typescript
// In useEntityInstanceList hook (automatic):
import { formatDataset } from '@/lib/formatters';

const queryFn = async () => {
  const response = await api.get(`/api/v1/${entityCode}`);
  const formattedData = formatDataset(response.data, response.metadata?.entityDataTable);
  return { ...response, formattedData };
};

// In component (optimized rendering):
const { formattedData, metadata } = useEntityInstanceList(entityCode, params);

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
import { hasBackendMetadata } from '@/lib/frontEndFormatterService';

const response = await api.get('/api/v1/project');

if (hasBackendMetadata(response.data)) {
  // Use metadata-driven rendering
  const columns = response.data.metadata.fields;
} else {
  // Fallback (should not occur in production)
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

## Performance Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BEFORE (v6.x): Per-cell formatting during render                       │
├─────────────────────────────────────────────────────────────────────────┤
│  100 rows × 10 columns = 1,000 formatValue() calls PER RENDER           │
│  Each scroll/re-render triggers 1,000+ function calls                   │
│  Datalabel color lookups: 1,000 store.getState() calls per render       │
│                                                                         │
│  Result: Laggy scrolling, frame drops, poor UX                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  AFTER (v7.0.0): Pre-formatted at fetch time                            │
├─────────────────────────────────────────────────────────────────────────┤
│  formatDataset() called ONCE when data arrives                          │
│  Cell rendering = simple property access: row.display[key]              │
│  Scrolling triggers ZERO formatting function calls                      │
│  Datalabel colors: Resolved once at format time, cached in styles       │
│                                                                         │
│  Result: Smooth 60fps scrolling, instant renders                        │
└─────────────────────────────────────────────────────────────────────────┘

BENCHMARKS (100 rows × 10 columns):
  v6.x render time: ~45ms per scroll frame
  v7.0.0 render time: ~3ms per scroll frame
  Format time (once): ~1-2ms
```

---

## Database/API/UI Mapping

### Metadata to Component Mapping

| Backend Metadata | View (v7.0.0) | Edit Component |
|------------------|---------------|----------------|
| `viewType: 'currency'` | `row.display[key]` | `<DebouncedInput type="number">` |
| `viewType: 'datalabel'` | `<span className={row.styles[key]}>` | `<DataLabelSelect>` |
| `viewType: 'date'` | `row.display[key]` | `<input type="date">` |
| `viewType: 'boolean'` | `row.display[key]` (✓/✗) | `<input type="checkbox">` |
| `viewType: 'reference'` | `row.display[key]` | `<EntitySelect>` |
| `viewType: 'json'` | `row.display[key]` | `<textarea>` |

### Component Integration Points

| Component | Uses format-at-fetch | Uses renderEditMode |
|-----------|---------------------|---------------------|
| EntityDataTable | Yes (formattedData) | Yes (inline edit) |
| EntityFormContainer | No (form layout) | Yes (form fields) |
| KanbanView | Yes (card content) | No |
| CalendarView | Yes (event display) | No |
| GridView | Yes (card display) | No |

---

## Migration Guide (v6.x → v7.0.0)

### Step 1: Update Data Fetching

```typescript
// BEFORE (v6.x): Raw data passed to component
const { data, metadata } = useEntityInstanceList(entityCode, params);
return <EntityDataTable data={data} metadata={metadata} />;

// AFTER (v7.0.0): Use formattedData
const { data, formattedData, metadata } = useEntityInstanceList(entityCode, params);
return <EntityDataTable data={formattedData} metadata={metadata} />;
```

### Step 2: Update Cell Rendering

```typescript
// BEFORE (v6.x): Per-cell formatting
const cell = renderViewModeFromMetadata(value, fieldMeta, record);

// AFTER (v7.0.0): Property access
const cell = row.display[key];
const badgeStyle = row.styles[key]; // For badges only
```

### Step 3: Keep Edit Mode Unchanged

```typescript
// Edit mode still uses renderEditModeFromMetadata
// No changes needed for edit functionality
```

---

## Critical Considerations

### Design Principles

1. **Pure Renderer** - No business logic, no pattern detection
2. **Metadata-Driven** - All decisions from backend metadata
3. **Type-Safe** - Full TypeScript support
4. **Format Once** - Data formatted at fetch time, not render time
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
```

---

**Last Updated:** 2025-11-24 | **Version:** 7.0.0 | **Status:** Production Ready
