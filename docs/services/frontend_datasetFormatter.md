# Frontend Formatter Service

**Version:** 9.6.0 | **Location:** `apps/web/src/lib/` | **Updated:** 2025-12-01

> **Note:** As of v9.6.0, the frontend uses TanStack Query + Dexie v4 (IndexedDB) for offline-first data storage. Metadata and data are fetched separately (two-query architecture). The formatter service works with data from TanStack Query hooks, formatting on read via `useMemo`. Pages construct appropriate metadata structures for each component.

---

## Overview

The frontend formatter is a **pure renderer** that executes backend instructions. It contains **zero pattern detection logic** - all rendering decisions come from the backend's `viewType` and `editType` metadata.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND FORMATTER ARCHITECTURE (v9.6.0)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TWO-QUERY ARCHITECTURE                                                      │
│  ──────────────────────                                                      │
│  Query 1: useEntityInstanceData() → { data, refData }  (5-min cache)        │
│  Query 2: useEntityInstanceMetadata() → { viewType, editType } (30-min)     │
│                                                                              │
│  PAGE CONSTRUCTS METADATA STRUCTURES:                                        │
│  ────────────────────────────────────                                        │
│  For EntityListOfInstancesTable:                                             │
│    metadata = { viewType, editType }                                         │
│                                                                              │
│  For EntityInstanceFormContainer:                                            │
│    backendMetadata = { entityInstanceFormContainer: { viewType, editType } } │
│                                                                              │
│  FORMATTER FUNCTIONS (Pure Renderers):                                       │
│  ─────────────────────────────────────                                       │
│  formatDataset(data, metadata, refData) → FormattedRow[]                    │
│    └── formatRow(row, viewType, refData)                                    │
│        └── formatValue(value, key, viewType[key])                           │
│            └── switch on renderType                                          │
│                └── 'currency' → formatCurrency()                            │
│                └── 'badge' → formatBadge() + getDatalabelSync()             │
│                └── 'entityInstanceId' → refData[lookupEntity][uuid]         │
│                                                                              │
│  renderEditModeFromMetadata(value, editType[key], onChange)                 │
│    └── switch on inputType                                                   │
│        └── 'number' → <input type="number" />                               │
│        └── 'BadgeDropdownSelect' → <BadgeDropdownSelect />                  │
│        └── 'entityInstanceId' → <EntityInstanceNameLookup />                │
│                                                                              │
│  ✗ NO pattern detection (_id suffix, _amt suffix, etc.)                      │
│  ✓ All decisions from metadata.renderType/inputType/lookupEntity             │
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
| `lib/refDataResolver.ts` | Entity reference resolution utilities (v8.3.1) |
| `lib/hooks/useRefData.ts` | Reference resolution hook (v8.3.0) |
| `components/shared/ui/BadgeDropdownSelect.tsx` | Badge dropdown component for datalabel fields (v8.3.2) |

---

## Core Types (v8.3.1)

```typescript
// ComponentMetadata - Required structure from backend
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

// ViewFieldMetadata - includes lookupEntity for references
interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType?: string;              // 'entityInstanceId' for references
  lookupSource?: 'entityInstance' | 'datalabel';
  lookupEntity?: string;            // Entity code (e.g., 'employee')
  behavior: { visible?: boolean; sortable?: boolean };
  style: Record<string, any>;
}

// FormattedRow - Output of formatDataset
interface FormattedRow<T> {
  raw: T;                           // Original values (for mutations)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (badges only)
}

// FieldMetadata for refDataResolver (v8.3.1)
interface FieldMetadata {
  key: string;
  renderType?: string;
  inputType?: string;
  lookupSource?: 'entityInstance' | 'datalabel';
  lookupEntity?: string;
  dtype?: string;
}

// EntityInstanceFormContainer_viz_container (v8.3.2)
// Supports separate view/edit components for form fields
interface VizContainer {
  view?: string;   // Component name for view mode (e.g., 'DAGVisualizer')
  edit?: string;   // Component name for edit mode (optional, falls through to inputType)
}

// Validation helper
function isValidComponentMetadata(metadata: any): boolean {
  return metadata && 'viewType' in metadata && typeof metadata.viewType === 'object';
}
```

---

## Entity Reference Resolution (v8.3.1)

### Metadata-Based Resolution

Frontend uses backend metadata to determine if a field is an entity reference - **NO pattern matching**:

```typescript
import {
  isEntityReferenceField,
  getEntityCodeFromMetadata,
  resolveFieldDisplayWithMetadata
} from '@/lib/refDataResolver';

const fieldMeta = metadata.viewType.manager__employee_id;
// { renderType: 'entityInstanceId', lookupEntity: 'employee' }

// Check using metadata (NOT field name pattern)
if (isEntityReferenceField(fieldMeta)) {
  const entityCode = getEntityCodeFromMetadata(fieldMeta);  // "employee"
  const displayName = resolveFieldDisplayWithMetadata(fieldMeta, uuid, refData);
  // → "James Miller"
}

// ✗ REMOVED (v8.3.1): Pattern detection
// if (fieldName.endsWith('_id')) { ... }  // WRONG
// if (fieldName.match(/^.*__(\w+)_id$/)) { ... }  // WRONG
```

### useRefData Hook

```typescript
import { useRefData } from '@/lib/hooks';

// Get ref_data_entityInstance from API response
const { data } = useEntityInstance('project', projectId);
const { resolveFieldDisplay, isRefField, getEntityCode } = useRefData(data?.ref_data_entityInstance);

// Resolve using field metadata
const fieldMeta = metadata.viewType.manager__employee_id;
const displayValue = resolveFieldDisplay(fieldMeta, project.manager__employee_id);
// → "James Miller"

// Hook interface (v8.3.1)
interface UseRefDataResult {
  refData: RefData | undefined;
  hasRefData: boolean;

  // Direct resolution (requires entityCode)
  resolveName(uuid, entityCode): string | undefined;
  resolveNames(uuids, entityCode): string[];

  // Metadata-based resolution (recommended)
  resolveField(fieldMeta, value): string | string[] | undefined;
  resolveFieldDisplay(fieldMeta, value, fallback?): string;
  resolveRow(row, fieldMetadataMap): Record<string, string>;

  // Metadata utilities
  isRefField(fieldMeta): boolean;
  getEntityCode(fieldMeta): string | null;
  isArrayRef(fieldMeta): boolean;
}
```

---

## Data Flow

### Format-at-Read Pattern with ref_data_entityInstance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FORMAT-AT-READ FLOW (v9.6.0 - Two-Query Architecture)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PAGE LEVEL (EntityListOfInstancesPage or EntitySpecificInstancePage)        │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  // QUERY 1: Metadata (30-min cache)                                         │
│  const { viewType, editType } = useEntityInstanceMetadata(entityCode);      │
│  const metadata = useMemo(() => ({ viewType, editType }), [...]);           │
│                                                                              │
│  // QUERY 2: Data (5-min cache)                                              │
│  const { data: rawData, refData } = useEntityInstanceData(entityCode);      │
│                                                                              │
│  // FORMAT-AT-READ (via useMemo, NOT select)                                 │
│  const formattedData = useMemo(() => {                                      │
│    return formatDataset(rawData, metadata, refData);                        │
│  }, [rawData, metadata, refData]);                                          │
│                                                                              │
│  FORMATTER EXECUTION:                                                        │
│  ────────────────────                                                        │
│  formatDataset(rawData, metadata, refData)                                  │
│    └── Loop: formatRow(row, viewType, refData)                              │
│        └── Per field: formatValue(value, key, viewType[key])                │
│            └── Switch on viewType[key].renderType                            │
│                ├── 'currency' → formatCurrency()                            │
│                ├── 'date' → formatDate()                                    │
│                ├── 'badge' → formatBadge() + getDatalabelSync()             │
│                ├── 'entityInstanceId' → refData[lookupEntity][uuid]         │
│                └── 'text' → String(value)                                   │
│                                                                              │
│  COMPONENT RECEIVES FormattedRow[]:                                          │
│  ──────────────────────────────────                                          │
│  {                                                                           │
│    raw: { budget: 50000, manager__employee_id: 'uuid-james' },              │
│    display: { budget: '$50,000.00', manager__employee_id: 'James Miller'},  │
│    styles: { dl__project_stage: 'bg-blue-100 text-blue-700' }               │
│  }                                                                           │
│                                                                              │
│  WebSocket INVALIDATE → TanStack invalidates → auto-refetch → useMemo runs  │
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
│  getDatalabelSync('project_stage')   // From Dexie sync cache (v9.3.0)       │
│    → [{ name: 'planning', label: 'Planning', color_code: 'blue' }]           │
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
// EntityListOfInstancesTable cell rendering (VIEW MODE)
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

  // Regular field (including resolved entity references)
  return <span>{displayValue}</span>;
}
```

### Edit Mode

```tsx
// EntityListOfInstancesTable cell rendering (EDIT MODE)
// Uses backend metadata for input type

import { renderEditModeFromMetadata } from '../lib/frontEndFormatterService';

const editType = extractEditType(metadata);  // { viewType, editType } → editType
const fieldMeta = editType[key];

// Check if it's an entity reference using metadata (NOT pattern)
if (fieldMeta.inputType === 'entityInstanceId') {
  const entityCode = fieldMeta.lookupEntity;  // 'employee'
  return (
    <EntityDropdown
      entityCode={entityCode}
      value={row.raw[key]}
      onChange={(val) => onChange(id, key, val)}
    />
  );
}

// Other field types
renderEditModeFromMetadata(
  row.raw[key],           // Raw value for editing
  fieldMeta,              // { inputType: 'number', validation: {...} }
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

  // Entity reference (v8.3.0)
  case 'entityInstanceId':
    const entityCode = metadata.lookupEntity;
    return <EntityDropdown entityCode={entityCode} />;

  // Badge dropdown for datalabel fields (v8.3.2)
  case 'BadgeDropdownSelect':
    // Colored badge dropdown with portal rendering
    const options = datalabelMetadataStore.getDatalabel(metadata.datalabelKey);
    return <BadgeDropdownSelect options={options} value={value} onChange={onChange} />;

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
  metadata: ViewFieldMetadata | undefined,
  refData?: RefData
): FormattedValue {
  if (!metadata) {
    return { display: String(value ?? ''), style: '' };
  }

  // Entity reference (v8.3.1 - uses metadata, not pattern)
  if (metadata.renderType === 'entityInstanceId' && metadata.lookupEntity && refData) {
    const entityCode = metadata.lookupEntity;
    const resolved = refData[entityCode]?.[value];
    return { display: resolved ?? value ?? '', style: '' };
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
  metadata: ComponentMetadata | null,
  refData?: RefData
): FormattedRow<T>[] {
  if (!data || !Array.isArray(data)) return [];

  const viewType = extractViewType(metadata);

  return data.map(row => formatRow(row, viewType, refData));
}
```

---

## Anti-Patterns (v8.3.1)

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Pattern detection in frontend | Duplicates backend logic | Read from `metadata.viewType` |
| Field name `_id` suffix check | Hardcoded pattern | Use `metadata.lookupEntity` |
| Formatting during render | Slow scroll performance | Format-at-read via `select` |
| Hardcoded field types | Maintenance burden | Backend metadata driven |
| Accessing flat metadata | Removed in v8.2.0 | Use `extractViewType()`/`extractEditType()` |
| Fallback inline formatting | Silent failure, inconsistent | Error if metadata missing |

---

## Strict Requirements (v8.3.1)

### No Pattern Detection

Components MUST NOT detect field types by name patterns:

```typescript
// ✗ WRONG: Pattern detection (REMOVED in v8.3.1)
if (field.key.endsWith('_id')) {
  // Assume it's an entity reference
}
if (field.key.includes('_amt') || field.key.includes('_price')) {
  return formatCurrency(value);
}

// ✓ CORRECT: Use backend metadata
if (metadata.renderType === 'entityInstanceId') {
  const entityCode = metadata.lookupEntity;  // Backend tells us
  return refData[entityCode][value];
}
if (metadata.renderType === 'currency') {
  return formatCurrency(value);
}
```

### No Fallback Formatting

Components MUST NOT implement fallback formatting when metadata is missing:

```typescript
// ✗ WRONG: Silent fallback
if (formattedData?.display?.[field.key]) {
  displayValue = formattedData.display[field.key];
} else {
  // Fallback: inline formatting for backwards compatibility
  if (field.key.includes('_amt')) displayValue = formatCurrency(value);
}

// ✓ CORRECT: Require metadata, error if missing
if (!formattedData?.display) {
  console.error(`[EntityInstanceFormContainer] formattedData required for ${field.key}`);
  return <span className="text-red-500">Missing formatted data</span>;
}
return <span>{formattedData.display[field.key]}</span>;
```

### Metadata-Based Entity Detection

```typescript
// ✗ WRONG: Pattern-based detection (REMOVED)
import { parseReferenceField } from '@/lib/refDataResolver';  // Removed in v8.3.1
const parsed = parseReferenceField('manager__employee_id');

// ✓ CORRECT: Metadata-based detection (v8.3.1)
import { isEntityReferenceField, getEntityCodeFromMetadata } from '@/lib/refDataResolver';

const fieldMeta = metadata.viewType[fieldKey];
if (isEntityReferenceField(fieldMeta)) {
  const entityCode = getEntityCodeFromMetadata(fieldMeta);
  // Use entityCode for resolution
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

// Check if field is entity reference (v8.3.1 - metadata-based)
function isEntityReferenceField(fieldMeta: FieldMetadata | undefined): boolean {
  if (!fieldMeta) return false;
  return (
    fieldMeta.renderType === 'entityInstanceId' ||
    fieldMeta.inputType === 'entityInstanceId' ||
    fieldMeta.lookupSource === 'entityInstance'
  );
}

// Get entity code from metadata (v8.3.1)
function getEntityCodeFromMetadata(fieldMeta: FieldMetadata | undefined): string | null {
  if (!fieldMeta) return null;
  return fieldMeta.lookupEntity ?? null;
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
| ref_data_entityInstance O(1) lookup | Entity names resolved instantly |

---

## Integration with Real-Time Sync (v9.3.0)

The frontend formatter integrates seamlessly with the WebSocket sync system via TanStack Query + Dexie:

1. **WebSocket INVALIDATE** → WebSocketManager receives message
2. **TanStack Invalidate** → `queryClient.invalidateQueries()` marks stale
3. **Auto Refetch** → TanStack Query fetches fresh data from REST API
4. **Dexie Update** → `db.entityInstance.put()` updates IndexedDB
5. **Format-at-Read** → formatDataset() applies via `select` transform
6. **Component Re-render** → Updated FormattedRow[] displayed automatically

This ensures that when another user modifies an entity, subscribers see fresh, correctly formatted data within ~60 seconds (LogWatcher polling interval).

See `docs/caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md` for full sync architecture details.

### Dexie v4 Tables Used

| Table | Purpose | TanStack Query Key |
|-------|---------|-------------------|
| `entityInstanceData` | Entity list data | `['entityInstanceData', entityCode, params]` |
| `entityInstanceMetadata` | Field metadata | `['entityInstanceMetadata', entityCode]` |
| `entityInstance` | Single entity records | `['entityInstance', entityCode, id]` |
| `datalabel` | Badge/dropdown options | `['datalabel', key]` |

---

**Version:** 9.6.0 | **Updated:** 2025-12-01

**Recent Updates:**
- v9.6.0 (2025-12-01):
  - **Two-Query Architecture** - Metadata and data fetched separately
  - `useEntityInstanceMetadata()` returns `{ viewType, editType }` directly (30-min cache)
  - `useEntityInstanceData()` returns `{ data, refData }` (5-min cache)
  - Page constructs metadata structure for each component:
    - `EntityListOfInstancesTable`: `{ viewType, editType }`
    - `EntityInstanceFormContainer`: `{ entityInstanceFormContainer: { viewType, editType } }`
  - Format-at-read via `useMemo` at page level (not TanStack `select`)
  - Updated architecture diagrams
- v9.3.0 (2025-11-30):
  - **TanStack Query + Dexie v4** - Replaced RxDB with TanStack Query + Dexie
  - Added Dexie v4 table reference (8 unified tables)
  - WebSocketManager replaces ReplicationManager
- v9.1.0 (2025-11-28):
  - Removed RxDB completely (TanStack Query + Dexie migration)
- v8.3.2 (2025-11-27):
  - Renamed ColoredDropdown → BadgeDropdownSelect
  - Added `BadgeDropdownSelect` as valid inputType
- v8.3.1 (2025-11-26): Removed all pattern detection, enforced metadata as source of truth
- v8.3.0 (2025-11-26): Added ref_data_entityInstance resolution, useRefData hook
