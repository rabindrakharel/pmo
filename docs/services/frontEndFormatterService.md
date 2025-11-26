# Frontend Formatter Service

**Version:** 8.2.0 | **Location:** `apps/web/src/lib/` | **Updated:** 2025-11-26

---

## Overview

The frontend formatter is a **pure renderer** that executes backend instructions. It contains **zero pattern detection logic** - all rendering decisions come from the backend's `viewType` and `editType` metadata.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND FORMATTER ARCHITECTURE                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Backend Metadata                      Frontend Renderer                     │
│  ─────────────────                     ─────────────────                     │
│                                                                              │
│  { viewType: {                         formatDataset(data, metadata)         │
│      budget: {                          └── formatRow(row, metadata)         │
│        renderType: 'currency',              └── formatValue()                │
│        style: { decimals: 2 }                   └── formatCurrency(50000)    │
│      }                                              └── "$50,000.00"         │
│    },                                                                        │
│    editType: {                         renderEditModeFromMetadata()          │
│      budget: {                          └── switch(editType[key].inputType)  │
│        inputType: 'number'                  └── <input type="number" />      │
│      }                                                                       │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/formatters/types.ts` | TypeScript types for ComponentMetadata |
| `lib/formatters/datasetFormatter.ts` | formatDataset, formatRow, formatValue |
| `lib/formatters/valueFormatters.ts` | Currency, date, badge formatters |
| `lib/frontEndFormatterService.tsx` | renderViewModeFromMetadata, renderEditModeFromMetadata |
| `lib/formatters/labelMetadataLoader.ts` | Datalabel color lookup |

---

## Core Types (v8.2.0)

```typescript
// ComponentMetadata - Required structure from backend
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

// FormattedRow - Output of formatDataset
interface FormattedRow<T> {
  raw: T;                           // Original values (for mutations)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (badges only)
}

// Validation helper
function isValidComponentMetadata(metadata: any): boolean {
  return metadata && 'viewType' in metadata && typeof metadata.viewType === 'object';
}
```

---

## Data Flow

### Format-at-Read Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FORMAT-AT-READ FLOW                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. React Query Cache (RAW)                                                  │
│     queryKey: ['entity-list', 'project', params]                             │
│     data: { data: [...], metadata: {...} }                                   │
│                       │                                                      │
│                       ▼ `select` option (ON READ)                            │
│                                                                              │
│  2. formatDataset(raw.data, raw.metadata.entityDataTable)                    │
│                       │                                                      │
│                       ├── Loop: formatRow(row, viewType)                     │
│                       │                                                      │
│                       ├── Per field: formatValue(value, key, viewType[key])  │
│                       │    └── Switch on viewType[key].renderType            │
│                       │        ├── 'currency' → formatCurrency()             │
│                       │        ├── 'date' → formatDate()                     │
│                       │        ├── 'badge' → formatBadge() + style lookup    │
│                       │        └── 'text' → String(value)                    │
│                       │                                                      │
│                       └── Returns: FormattedRow[]                            │
│                                                                              │
│  3. Component receives FormattedRow[]                                        │
│     {                                                                        │
│       raw: { budget_allocated_amt: 50000 },                                  │
│       display: { budget_allocated_amt: '$50,000.00' },                       │
│       styles: {}                                                             │
│     }                                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Badge Formatting with Datalabels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BADGE FORMATTING FLOW                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  viewType.dl__project_stage = {                                              │
│    renderType: 'badge',                                                      │
│    datalabelKey: 'project_stage'                                             │
│  }                                                                           │
│                       │                                                      │
│                       ▼                                                      │
│  formatBadge('planning', viewType.dl__project_stage)                         │
│                       │                                                      │
│                       ▼                                                      │
│  datalabelMetadataStore.getDatalabel('project_stage')                        │
│    → { options: [{ name: 'planning', label: 'Planning', color_code: 'blue' }] }
│                       │                                                      │
│                       ▼                                                      │
│  colorCodeToTailwindClass('blue')                                            │
│    → 'bg-blue-100 text-blue-700'                                             │
│                       │                                                      │
│                       ▼                                                      │
│  FormattedRow = {                                                            │
│    raw: { dl__project_stage: 'planning' },                                   │
│    display: { dl__project_stage: 'Planning' },     // Label                  │
│    styles: { dl__project_stage: 'bg-blue-100 text-blue-700' }  // CSS        │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Rendering

### View Mode

```tsx
// EntityDataTable cell rendering (VIEW MODE)
// Zero function calls per cell - direct property access

const formattedRecord = row as FormattedRow<any>;

if (formattedRecord.display && formattedRecord.styles !== undefined) {
  const displayValue = formattedRecord.display[column.key];
  const styleClass = formattedRecord.styles[column.key];

  // Badge field (has style)
  if (styleClass) {
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styleClass}`}>
        {displayValue}
      </span>
    );
  }

  // Regular field
  return <span>{displayValue}</span>;
}
```

### Edit Mode

```tsx
// EntityDataTable cell rendering (EDIT MODE)
// Uses backend metadata for input type

import { renderEditModeFromMetadata } from '../lib/frontEndFormatterService';

const editType = extractEditType(metadata);  // { viewType, editType } → editType

// Backend decides input type
renderEditModeFromMetadata(
  row.raw[key],           // Raw value for editing
  editType[key],          // { inputType: 'number', validation: {...} }
  (val) => onChange(id, key, val)
);
```

### renderEditModeFromMetadata Switch

```tsx
switch (metadata.inputType) {
  case 'currency':
  case 'number':
    return <input type="number" step={metadata.inputType === 'currency' ? '0.01' : '1'} />;

  case 'text':
    return <input type="text" />;

  case 'date':
    return <input type="date" />;

  case 'datetime':
    return <input type="datetime-local" />;

  case 'checkbox':
    return <input type="checkbox" />;

  case 'select':
    // Lookup options from datalabelMetadataStore
    return <select>{options}</select>;

  case 'textarea':
    return <textarea />;

  default:
    return <input type="text" />;
}
```

---

## Formatter Functions

### formatValue

```typescript
function formatValue(
  value: any,
  key: string,
  metadata: ViewFieldMetadata | undefined
): FormattedValue {
  if (!metadata) {
    return { display: String(value ?? ''), style: '' };
  }

  switch (metadata.renderType) {
    case 'currency':
      return formatCurrency(value, metadata.style);
    case 'date':
      return formatDate(value);
    case 'timestamp':
      return formatTimestamp(value);
    case 'badge':
      return formatBadge(value, metadata);
    case 'boolean':
      return formatBoolean(value);
    case 'array':
      return formatArray(value);
    case 'percentage':
      return formatPercentage(value);
    default:
      return { display: String(value ?? ''), style: '' };
  }
}
```

### formatDataset

```typescript
function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | null
): FormattedRow<T>[] {
  if (!data || !Array.isArray(data)) return [];

  const viewType = extractViewType(metadata);

  return data.map(row => formatRow(row, viewType));
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Pattern detection in frontend | Duplicates backend logic | Read from `viewType[key].renderType` |
| Formatting during render | Slow scroll performance | Format-at-read via `select` |
| Hardcoded field types | Maintenance burden | Backend metadata driven |
| Accessing flat metadata | Removed in v8.2.0 | Use `extractViewType()`/`extractEditType()` |
| Fallback inline formatting | Silent failure, inconsistent | Error if metadata missing |
| Field name pattern checks | `_amt`, `_date` detection | Backend provides `renderType` |

---

## Strict Requirements (v8.2.0)

### No Fallback Formatting

Components MUST NOT implement fallback formatting when metadata is missing:

```typescript
// WRONG: Silent fallback
if (formattedData?.display?.[field.key]) {
  displayValue = formattedData.display[field.key];
} else {
  // Fallback: inline formatting for backwards compatibility
  if (field.key.includes('_amt')) displayValue = formatCurrency(value);
}

// CORRECT: Require metadata, error if missing
if (!formattedData?.display) {
  console.error(`[EntityFormContainer] formattedData required for ${field.key}`);
  return <span className="text-red-500">Missing formatted data</span>;
}
return <span>{formattedData.display[field.key]}</span>;
```

### No Pattern Detection

Components MUST NOT detect field types by name patterns:

```typescript
// WRONG: Pattern detection
if (field.key.includes('_amt') || field.key.includes('_price')) {
  return formatCurrency(value);
}

// CORRECT: Use backend metadata
if (viewType[field.key]?.renderType === 'currency') {
  return formatCurrency(value);
}
```

### Datalabel Options Required

Select fields MUST have options pre-loaded from datalabelMetadataStore:

```typescript
// WRONG: Empty fallback select
if (!options || options.length === 0) {
  return <select><option>Select...</option></select>;
}

// CORRECT: Error if options not loaded
const options = datalabelMetadataStore.getDatalabel(datalabelKey);
if (!options) {
  console.error(`[Select] Datalabel not cached: ${datalabelKey}`);
  return <span className="text-red-500">Options not loaded</span>;
}
```

---

## Helper Functions

```typescript
// Extract viewType from ComponentMetadata
function extractViewType(metadata: ComponentMetadata | null): Record<string, ViewFieldMetadata> | null {
  if (!metadata || !isValidComponentMetadata(metadata)) {
    console.error('[formatters] Invalid metadata structure');
    return null;
  }
  return metadata.viewType;
}

// Extract editType from ComponentMetadata
function extractEditType(metadata: ComponentMetadata | null): Record<string, EditFieldMetadata> | null {
  if (!metadata || !isValidComponentMetadata(metadata)) {
    console.error('[formatters] Invalid metadata structure');
    return null;
  }
  return metadata.editType;
}

// Validate ComponentMetadata has required structure
function isValidComponentMetadata(metadata: any): boolean {
  return metadata && 'viewType' in metadata && typeof metadata.viewType === 'object';
}

// Check if data is already formatted
function isFormattedData(data: any): data is FormattedRow<any> {
  return data && typeof data === 'object' && 'raw' in data && 'display' in data;
}
```

---

## Performance Optimizations

| Optimization | Impact |
|--------------|--------|
| Format-at-read (select) | Cache stores small RAW data |
| Memoization | React Query auto-memoizes select |
| Direct property access | Zero function calls during scroll |
| Pre-computed styles | Badge CSS computed once at format time |
| Virtualization compatible | Works with @tanstack/react-virtual |

---

**Version:** 8.2.0 | **Updated:** 2025-11-26
