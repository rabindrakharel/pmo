# Format-at-Fetch Implementation Plan

> **Version:** 1.1.0
> **Date:** 2025-11-23
> **Status:** Planning
> **Goal:** Optimize rendering performance for 100K+ records by formatting data once at fetch time instead of per-cell at render time

---

## Executive Summary

**Current State:** Data is fetched raw, formatting happens per-cell at render time via `renderViewModeFromMetadata()`.

**Target State:** Data is formatted once when fetched, cells render pre-formatted strings directly.

**Performance Gain:** Eliminates formatting logic during scroll/render cycles.

---

## Architecture Comparison

### Current Architecture (Format at Render)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CURRENT: Format at Render Time                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  API Response                                                        │
│  { data: [{ budget: 50000, stage: "planning" }], metadata: {...} }  │
│                              │                                       │
│                              ▼                                       │
│  useEntityInstanceList                                               │
│  └── Returns: { data (raw), metadata }                              │
│                              │                                       │
│                              ▼                                       │
│  EntityDataTable                                                     │
│  └── For each cell:                                                 │
│      └── renderViewModeFromMetadata(value, metadata)  ← EVERY RENDER│
│          └── switch(viewType)                                       │
│          └── formatCurrency() / formatDate() / lookupColor()        │
│          └── return <JSX/>                                          │
│                                                                      │
│  Problem: 100 rows × 50 cols × 60fps scroll = 300,000 format calls  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Target Architecture (Format at Fetch)

```
┌─────────────────────────────────────────────────────────────────────┐
│  TARGET: Format at Fetch Time                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  API Response                                                        │
│  { data: [{ budget: 50000, stage: "planning" }], metadata: {...} }  │
│                              │                                       │
│                              ▼                                       │
│  useEntityInstanceList                                               │
│  └── formatDataset(data, metadata)  ← ONCE at fetch                 │
│  └── Returns: { data (raw), formattedData, metadata }               │
│                              │                                       │
│                              ▼                                       │
│  EntityDataTable                                                     │
│  └── For each cell:                                                 │
│      └── <span>{row.display[key]}</span>  ← Just string render      │
│      └── <span className={row.styles[key]}>...</span>               │
│                                                                      │
│  Result: 0 format calls during scroll, only string interpolation    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE DATA FLOW                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ 1. BACKEND (No Changes)                                              │     │
│  │                                                                      │     │
│  │    GET /api/v1/project?limit=100                                    │     │
│  │                                                                      │     │
│  │    Response:                                                         │     │
│  │    {                                                                 │     │
│  │      data: [                                                         │     │
│  │        { id: "uuid-1", budget_allocated_amt: 50000,                 │     │
│  │          dl__project_stage: "planning", created_ts: "2024-..." }    │     │
│  │      ],                                                              │     │
│  │      metadata: {                                                     │     │
│  │        entityDataTable: {                                           │     │
│  │          budget_allocated_amt: { viewType: "currency", ... },       │     │
│  │          dl__project_stage: { viewType: "badge", datalabelKey: "dl__project_stage" },│
│  │          created_ts: { viewType: "relative-time", ... }             │     │
│  │        }                                                             │     │
│  │      },                                                              │     │
│  │      total: 1000                                                     │     │
│  │    }                                                                 │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                        │                                      │
│                                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ 2. useEntityInstanceList (MODIFIED)                                  │     │
│  │                                                                      │     │
│  │    // Existing: fetch data                                          │     │
│  │    const response = await api.list(params);                         │     │
│  │                                                                      │     │
│  │    // NEW: Format once at fetch time                                │     │
│  │    const formattedData = formatDataset(                             │     │
│  │      response.data,                                                  │     │
│  │      response.metadata?.entityDataTable                              │     │
│  │    );                                                                │     │
│  │                                                                      │     │
│  │    return {                                                          │     │
│  │      data: response.data,           // Raw (for mutations)          │     │
│  │      formattedData,                  // NEW: Pre-formatted          │     │
│  │      metadata: response.metadata,                                    │     │
│  │      total, page, pageSize, hasMore                                 │     │
│  │    };                                                                │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                        │                                      │
│                                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ 3. FormattedRow Structure (NEW)                                      │     │
│  │                                                                      │     │
│  │    formattedData = [                                                 │     │
│  │      {                                                               │     │
│  │        raw: {                         // Original values            │     │
│  │          id: "uuid-1",                                              │     │
│  │          budget_allocated_amt: 50000,                               │     │
│  │          dl__project_stage: "planning",                             │     │
│  │          created_ts: "2024-01-15T10:30:00Z"                        │     │
│  │        },                                                            │     │
│  │        display: {                     // Formatted strings          │     │
│  │          id: "uuid-1",                                              │     │
│  │          budget_allocated_amt: "$50,000.00",                        │     │
│  │          dl__project_stage: "Planning",                             │     │
│  │          created_ts: "2 days ago"                                   │     │
│  │        },                                                            │     │
│  │        styles: {                      // CSS classes (badges only)  │     │
│  │          dl__project_stage: "bg-blue-100 text-blue-700"            │     │
│  │        }                                                             │     │
│  │      },                                                              │     │
│  │      // ... more rows                                                │     │
│  │    ]                                                                 │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                        │                                      │
│                                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ 4. Page Component (MINIMAL CHANGE)                                   │     │
│  │                                                                      │     │
│  │    function EntityListOfInstancesPage({ entityCode }) {             │     │
│  │      const {                                                         │     │
│  │        data,              // Raw                                     │     │
│  │        formattedData,     // Pre-formatted (NEW)                    │     │
│  │        metadata,                                                     │     │
│  │        isLoading                                                     │     │
│  │      } = useEntityInstanceList(entityCode, params);                 │     │
│  │                                                                      │     │
│  │      return (                                                        │     │
│  │        <EntityDataTable                                              │     │
│  │          data={formattedData}      // ← Changed from data           │     │
│  │          rawData={data}            // ← NEW: for edit mode          │     │
│  │          metadata={metadata}                                         │     │
│  │          entityCode={entityCode}                                     │     │
│  │        />                                                            │     │
│  │      );                                                              │     │
│  │    }                                                                 │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                        │                                      │
│                                        ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │ 5. EntityDataTable (MODIFIED)                                        │     │
│  │                                                                      │     │
│  │    // VIEW MODE: Direct string render (no formatting)               │     │
│  │    {columns.map(col => (                                            │     │
│  │      <td key={col.key}>                                             │     │
│  │        {row.styles?.[col.key] ? (                                   │     │
│  │          <span className={`badge ${row.styles[col.key]}`}>         │     │
│  │            {row.display[col.key]}                                   │     │
│  │          </span>                                                     │     │
│  │        ) : (                                                         │     │
│  │          row.display[col.key]                                       │     │
│  │        )}                                                            │     │
│  │      </td>                                                           │     │
│  │    ))}                                                               │     │
│  │                                                                      │     │
│  │    // EDIT MODE: Use raw values + metadata (unchanged complexity)   │     │
│  │    {isEditing && (                                                   │     │
│  │      <EditCell                                                       │     │
│  │        value={row.raw[col.key]}                                     │     │
│  │        metadata={col.metadata}                                       │     │
│  │        onChange={(v) => onUpdate(row.raw.id, col.key, v)}          │     │
│  │      />                                                              │     │
│  │    )}                                                                │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

### New Files (Create)

| File | Purpose | Lines (Est.) |
|------|---------|--------------|
| `apps/web/src/lib/formatters/index.ts` | Export all formatters | ~20 |
| `apps/web/src/lib/formatters/types.ts` | Type definitions | ~50 |
| `apps/web/src/lib/formatters/datasetFormatter.ts` | Main formatting logic | ~200 |
| `apps/web/src/lib/formatters/valueFormatters.ts` | Individual value formatters | ~150 |

### Modified Files

| File | Changes | Impact |
|------|---------|--------|
| `apps/web/src/lib/hooks/useEntityQuery.ts` | Add `formatDataset()` call, return `formattedData` | Medium |
| `apps/web/src/components/shared/ui/EntityDataTable.tsx` | Use `row.display` and `row.styles` for view mode | Medium |
| `apps/web/src/pages/entity/EntityListOfInstancesPage.tsx` | Pass `formattedData` to table | Low |
| `apps/web/src/pages/entity/EntitySpecificInstancePage.tsx` | Pass `formattedData` to detail view | Low |

### Deprecated (Mark for Removal)

| File/Function | Reason | Action |
|---------------|--------|--------|
| `frontEndFormatterService.tsx: renderViewModeFromMetadata()` | Replaced by pre-formatted data | Deprecate, remove after migration |
| `frontEndFormatterService.tsx: renderDataLabelBadge()` | Color resolved at fetch time | Deprecate, remove after migration |
| `frontEndFormatterService.tsx: formatValueFromMetadata()` | Replaced by valueFormatters | Deprecate, remove after migration |

### Keep (No Changes)

| File | Reason |
|------|--------|
| `apps/api/src/services/backend-formatter.service.ts` | Backend unchanged |
| `apps/web/src/stores/datalabelMetadataStore.ts` | Still used for color lookup at fetch time |
| `apps/web/src/lib/frontEndFormatterService.tsx: renderEditModeFromMetadata()` | Edit mode unchanged |
| All DAG/complex input components | Edit mode unchanged |

---

## Detailed Implementation

### Phase 1: Create Formatter Module (New Files)

#### 1.1 Type Definitions

```typescript
// apps/web/src/lib/formatters/types.ts

/**
 * Metadata for a single field (from backend)
 */
export interface FieldMetadata {
  viewType?: string;
  editType?: string;
  datalabelKey?: string;
  loadFromEntity?: string;
  currencySymbol?: string;
  decimals?: number;
  dateFormat?: string;
  locale?: string;
  label?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  visible?: boolean;
  editable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
}

/**
 * Component metadata from backend (keyed by field name)
 */
export interface ComponentMetadata {
  [fieldName: string]: FieldMetadata;
}

/**
 * Formatted value result
 */
export interface FormattedValue {
  display: string;      // Formatted display string
  style?: string;       // CSS classes (for badges)
}

/**
 * Single formatted row
 */
export interface FormattedRow<T = Record<string, any>> {
  raw: T;                              // Original values (for editing, mutations, sorting)
  display: Record<string, string>;     // Formatted display strings
  styles: Record<string, string>;      // CSS classes (badges only)
}

/**
 * Formatter function signature
 */
export type ValueFormatter = (
  value: any,
  key: string,
  metadata: FieldMetadata | undefined
) => FormattedValue;
```

#### 1.2 Value Formatters

```typescript
// apps/web/src/lib/formatters/valueFormatters.ts

import { useDatalabelMetadataStore } from '../../stores/datalabelMetadataStore';
import type { FieldMetadata, FormattedValue } from './types';

/**
 * Format currency values
 */
export function formatCurrency(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) {
    return { display: '—' };
  }

  const symbol = metadata?.currencySymbol || '$';
  const decimals = metadata?.decimals ?? 2;
  const locale = metadata?.locale || 'en-CA';

  const formatted = num.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return { display: `${symbol}${formatted}` };
}

/**
 * Format badge/datalabel values with color lookup
 */
export function formatBadge(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const displayValue = String(value);
  let color = 'bg-gray-100 text-gray-600'; // Default

  // Look up color from datalabel store
  if (metadata?.datalabelKey) {
    const options = useDatalabelMetadataStore.getState().getDatalabel(metadata.datalabelKey);
    if (options) {
      const match = options.find(opt => opt.name === value);
      if (match?.color_code) {
        color = match.color_code;
      }
    }
  }

  return { display: displayValue, style: color };
}

/**
 * Format date values
 */
export function formatDate(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { display: '—' };
    }

    const locale = metadata?.locale || 'en-CA';
    return { display: date.toLocaleDateString(locale) };
  } catch {
    return { display: String(value) };
  }
}

/**
 * Format timestamp as relative time
 */
export function formatRelativeTime(
  value: any,
  _metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { display: '—' };
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    if (diffSec < 60) return { display: 'just now' };
    if (diffMin < 60) return { display: `${diffMin}m ago` };
    if (diffHour < 24) return { display: `${diffHour}h ago` };
    if (diffDay < 7) return { display: `${diffDay}d ago` };
    if (diffWeek < 4) return { display: `${diffWeek}w ago` };
    if (diffMonth < 12) return { display: `${diffMonth}mo ago` };
    return { display: date.toLocaleDateString('en-CA') };
  } catch {
    return { display: String(value) };
  }
}

/**
 * Format boolean values
 */
export function formatBoolean(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined) {
    return { display: '—' };
  }

  const isTrue = value === true || value === 'true' || value === 1;
  return { display: isTrue ? '✓' : '✗' };
}

/**
 * Format percentage values
 */
export function formatPercentage(
  value: any,
  metadata?: FieldMetadata
): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }

  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) {
    return { display: '—' };
  }

  const decimals = metadata?.decimals ?? 0;
  return { display: `${num.toFixed(decimals)}%` };
}

/**
 * Format text values (default)
 */
export function formatText(value: any): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }
  return { display: String(value) };
}

/**
 * Format UUID (truncated for display)
 */
export function formatUuid(value: any): FormattedValue {
  if (value === null || value === undefined || value === '') {
    return { display: '—' };
  }
  const str = String(value);
  // Show first 8 chars of UUID
  return { display: str.length > 8 ? `${str.substring(0, 8)}...` : str };
}

/**
 * Format JSON (prettified preview)
 */
export function formatJson(value: any): FormattedValue {
  if (value === null || value === undefined) {
    return { display: '—' };
  }
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return { display: str.length > 50 ? `${str.substring(0, 50)}...` : str };
  } catch {
    return { display: '[JSON]' };
  }
}

/**
 * Format array values
 */
export function formatArray(value: any): FormattedValue {
  if (!Array.isArray(value) || value.length === 0) {
    return { display: '—' };
  }
  return { display: `[${value.length} items]` };
}
```

#### 1.3 Dataset Formatter

```typescript
// apps/web/src/lib/formatters/datasetFormatter.ts

import type { FieldMetadata, ComponentMetadata, FormattedRow, FormattedValue } from './types';
import {
  formatCurrency,
  formatBadge,
  formatDate,
  formatRelativeTime,
  formatBoolean,
  formatPercentage,
  formatText,
  formatUuid,
  formatJson,
  formatArray,
} from './valueFormatters';

/**
 * Formatter registry - maps viewType to formatter function
 */
const FORMATTERS: Record<string, (value: any, meta?: FieldMetadata) => FormattedValue> = {
  // Currency
  'currency': formatCurrency,

  // Badges/Datalabels
  'badge': formatBadge,
  'datalabel': formatBadge,
  'dag': formatBadge,
  'select': formatBadge,

  // Dates
  'date': formatDate,
  'date_readonly': formatDate,

  // Timestamps
  'timestamp': formatRelativeTime,
  'timestamp_readonly': formatRelativeTime,
  'relative-time': formatRelativeTime,

  // Boolean
  'boolean': formatBoolean,

  // Percentage
  'percentage': formatPercentage,

  // Special types
  'uuid': formatUuid,
  'json': formatJson,
  'jsonb': formatJson,
  'array': formatArray,

  // Default
  'text': formatText,
};

/**
 * Format a single value based on metadata
 */
export function formatValue(
  value: any,
  key: string,
  metadata: FieldMetadata | undefined
): FormattedValue {
  const viewType = metadata?.viewType || 'text';
  const formatter = FORMATTERS[viewType] || formatText;
  return formatter(value, metadata);
}

/**
 * Format a single row
 */
export function formatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | null
): FormattedRow<T> {
  const display: Record<string, string> = {};
  const styles: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    const fieldMeta = metadata?.[key];
    const formatted = formatValue(value, key, fieldMeta);

    display[key] = formatted.display;
    if (formatted.style) {
      styles[key] = formatted.style;
    }
  }

  return { raw: row, display, styles };
}

/**
 * Format entire dataset (call ONCE at fetch time)
 *
 * @param data - Raw data array from API
 * @param metadata - Component metadata (e.g., entityDataTable)
 * @returns Array of formatted rows with raw, display, and styles
 *
 * @example
 * const formattedData = formatDataset(response.data, response.metadata?.entityDataTable);
 */
export function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | null
): FormattedRow<T>[] {
  console.log(`%c[FORMAT] Formatting ${data.length} rows`, 'color: #be4bdb; font-weight: bold');
  const startTime = performance.now();

  const result = data.map(row => formatRow(row, metadata));

  const duration = performance.now() - startTime;
  console.log(`%c[FORMAT] ✅ Formatted in ${duration.toFixed(2)}ms`, 'color: #be4bdb');

  return result;
}

/**
 * Re-format a single row after update (for optimistic updates)
 */
export function reformatRow<T extends Record<string, any>>(
  row: T,
  metadata: ComponentMetadata | null
): FormattedRow<T> {
  return formatRow(row, metadata);
}
```

#### 1.4 Index Export

```typescript
// apps/web/src/lib/formatters/index.ts

export * from './types';
export * from './valueFormatters';
export * from './datasetFormatter';
```

---

### Phase 2: Modify useEntityQuery

```typescript
// apps/web/src/lib/hooks/useEntityQuery.ts

// ADD: Import at top of file
import { formatDataset, type FormattedRow } from '../formatters';

// MODIFY: Update EntityInstanceListResult type
export interface EntityInstanceListResult<T = any> {
  data: T[];
  formattedData: FormattedRow<T>[];  // ← ADD THIS
  metadata: EntityMetadata | null;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// MODIFY: In useEntityInstanceList queryFn, after existing code:

queryFn: async () => {
  // ... existing fetch code ...

  const response = await api.list(normalizedParams);

  // ... existing metadata handling ...

  // ═══════════════════════════════════════════════════════════════
  // NEW: Format data ONCE at fetch time
  // ═══════════════════════════════════════════════════════════════
  const componentMetadata = metadataWithFields?.entityDataTable || null;
  const formattedData = formatDataset(response.data || [], componentMetadata);

  const result: EntityInstanceListResult<T> = {
    data: response.data || [],
    formattedData,                    // ← ADD THIS
    metadata: metadataWithFields,
    total: response.total || 0,
    page: normalizedParams.page,
    pageSize: normalizedParams.pageSize,
    hasMore: (response.data?.length || 0) === normalizedParams.pageSize,
  };

  // ... rest of existing code ...

  return result;
},
```

---

### Phase 3: Modify EntityDataTable

```typescript
// apps/web/src/components/shared/ui/EntityDataTable.tsx

// MODIFY: Props interface
interface EntityDataTableProps<T> {
  data: FormattedRow<T>[];           // ← Change type
  rawData?: T[];                      // ← ADD: for edit mode
  metadata: EntityMetadata | null;
  // ... rest of existing props
}

// MODIFY: Cell rendering in VIEW mode
// Find the cell render logic and replace:

// BEFORE:
render: (value: any, record: any) => renderViewModeFromMetadata(value, enrichedMeta, record)

// AFTER:
render: (value: any, record: FormattedRow<T>) => {
  const key = column.key;

  // Check if this cell has a style (badge)
  if (record.styles?.[key]) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${record.styles[key]}`}>
        {record.display[key]}
      </span>
    );
  }

  // Default: render display string
  return <span>{record.display[key]}</span>;
}

// KEEP: Edit mode logic unchanged
// Edit mode still uses row.raw[key] and full metadata
```

---

### Phase 4: Update Page Components

```typescript
// apps/web/src/pages/entity/EntityListOfInstancesPage.tsx

function EntityListOfInstancesPage({ entityCode }: Props) {
  const {
    data,              // Raw data (for mutations)
    formattedData,     // Pre-formatted (for display)  ← USE THIS
    metadata,
    isLoading,
    // ...
  } = useEntityInstanceList(entityCode, params);

  return (
    <EntityDataTable
      data={formattedData}           // ← CHANGE: was data
      rawData={data}                 // ← ADD: for edit mode
      metadata={metadata}
      entityCode={entityCode}
      // ... rest of props
    />
  );
}
```

---

### Phase 5: Deprecate Old Functions

```typescript
// apps/web/src/lib/frontEndFormatterService.tsx

// ADD deprecation notices:

/**
 * @deprecated Use pre-formatted data from useEntityInstanceList instead.
 * This function will be removed in v7.0.0.
 *
 * Migration:
 * - View mode: Use row.display[key] from formattedData
 * - Badges: Use row.styles[key] from formattedData
 */
export function renderViewModeFromMetadata(...) {
  console.warn('[DEPRECATED] renderViewModeFromMetadata - use formattedData instead');
  // ... existing implementation for backward compatibility
}

/**
 * @deprecated Color is now resolved at fetch time in formatDataset().
 * This function will be removed in v7.0.0.
 */
export function renderDataLabelBadge(...) {
  console.warn('[DEPRECATED] renderDataLabelBadge - use row.styles[key] instead');
  // ... existing implementation
}
```

---

## Migration Checklist

### Pre-Migration

- [ ] Ensure all datalabels are cached before first entity fetch
- [ ] Verify `useAllDatalabels()` is called at app startup
- [ ] Run existing tests to establish baseline

### Phase 1: Formatter Module

- [ ] Create `apps/web/src/lib/formatters/` directory
- [ ] Create `types.ts` with type definitions
- [ ] Create `valueFormatters.ts` with individual formatters
- [ ] Create `datasetFormatter.ts` with main logic
- [ ] Create `index.ts` with exports
- [ ] Unit test formatters with various inputs

### Phase 2: useEntityQuery

- [ ] Add import for formatters
- [ ] Update `EntityInstanceListResult` type
- [ ] Add `formatDataset()` call in `queryFn`
- [ ] Add `formattedData` to return object
- [ ] Test that existing functionality still works

### Phase 3: EntityDataTable

- [ ] Update props interface
- [ ] Modify cell rendering for view mode
- [ ] Ensure edit mode still uses raw values
- [ ] Test table with new data structure

### Phase 4: Page Components

- [ ] Update `EntityListOfInstancesPage`
- [ ] Update `EntitySpecificInstancePage`
- [ ] Update any other pages using entity data
- [ ] Test all pages render correctly

### Phase 5: Deprecation

- [ ] Add deprecation warnings to old functions
- [ ] Update documentation
- [ ] Schedule removal for next major version

### Post-Migration

- [ ] Performance benchmarking (scroll performance)
- [ ] Memory usage comparison
- [ ] Remove deprecation warnings from console in production
- [ ] Update team documentation

---

## Rollback Plan

If issues arise, rollback is simple:

1. In page components, change `data={formattedData}` back to `data={data}`
2. In EntityDataTable, revert cell rendering to use `renderViewModeFromMetadata()`
3. Keep formatter module for future use (no harm)

---

## Performance Expectations

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Format calls per scroll | 500-1000 | 0 | 100% reduction |
| Initial render (100 rows) | ~50ms | ~60ms | -20% (one-time cost) |
| Scroll render (10 new rows) | ~30ms | ~5ms | 83% faster |
| Memory (100 rows) | ~2MB | ~2.5MB | +25% (store formatted) |

---

## Questions to Resolve

1. **Virtualization:** Should we add virtualization in the same PR or separate?
2. **Edit mode:** Should edit mode also use pre-formatted display until user clicks to edit?
3. **Real-time updates:** How should WebSocket updates trigger re-formatting?
4. **Memory limit:** At what row count should we switch to virtual scrolling only (no formatting)?

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Formatter Module | 2-3 hours | None |
| Phase 2: useEntityQuery | 1 hour | Phase 1 |
| Phase 3: EntityDataTable | 2-3 hours | Phase 2 |
| Phase 4: Page Components | 1 hour | Phase 3 |
| Phase 5: Deprecation | 30 min | Phase 4 |
| Testing & QA | 2-3 hours | All phases |
| **Total** | **8-11 hours** | |

---

## Appendix: Full FormattedRow Example

```json
{
  "raw": {
    "id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
    "code": "PROJ-001",
    "name": "Kitchen Renovation",
    "descr": "Complete kitchen remodel for Smith residence",
    "dl__project_stage": "planning",
    "budget_allocated_amt": 50000,
    "budget_spent_amt": 12500,
    "planned_start_date": "2024-02-01",
    "planned_end_date": "2024-04-30",
    "manager__employee_id": "uuid-manager",
    "active_flag": true,
    "created_ts": "2024-01-15T10:30:00Z",
    "updated_ts": "2024-01-20T14:45:00Z"
  },
  "display": {
    "id": "8260b1b0...",
    "code": "PROJ-001",
    "name": "Kitchen Renovation",
    "descr": "Complete kitchen remodel for Smith residence",
    "dl__project_stage": "Planning",
    "budget_allocated_amt": "$50,000.00",
    "budget_spent_amt": "$12,500.00",
    "planned_start_date": "2024-02-01",
    "planned_end_date": "2024-04-30",
    "manager__employee_id": "uuid-mana...",
    "active_flag": "✓",
    "created_ts": "5 days ago",
    "updated_ts": "2 hours ago"
  },
  "styles": {
    "dl__project_stage": "bg-blue-100 text-blue-700"
  }
}
```
