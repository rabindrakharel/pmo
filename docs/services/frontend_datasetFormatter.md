# Frontend Formatter Service

**Version:** 11.0.0 | **Location:** `apps/web/src/lib/` | **Updated:** 2025-12-02

> **Note:** As of v11.0.0, the frontend uses TanStack Query + Dexie v4 (IndexedDB) for offline-first data storage. Metadata and data are fetched separately (two-query architecture). The formatter service works with data from TanStack Query hooks, formatting on read via `useMemo`. Pages construct appropriate metadata structures for each component.
>
> **v11.0.0 Key Change:** Entity reference resolution now uses **TanStack Query cache** via `getEntityInstanceNameSync()` instead of passing `ref_data_entityInstance` through the component tree. The `refData` parameter is deprecated and ignored. Formatters read directly from `queryClient.getQueryData(['entityInstanceNames', entityCode])`.

---

## Overview

The frontend formatter is a **pure renderer** that executes backend instructions. It contains **zero pattern detection logic** - all rendering decisions come from the backend's `viewType` and `editType` metadata.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND FORMATTER ARCHITECTURE (v11.0.0)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TWO-QUERY ARCHITECTURE                                                      │
│  ──────────────────────                                                      │
│  Query 1: useEntityInstanceData() → { data }  (5-min cache)                 │
│  Query 2: useEntityInstanceMetadata() → { viewType, editType } (30-min)     │
│                                                                              │
│  ENTITY REFERENCE CACHE (v11.0.0)                                            │
│  ─────────────────────────────────                                           │
│  TanStack Query: ['entityInstanceNames', entityCode] → { uuid: name }       │
│  Populated at login via prefetchRefDataEntityInstances()                    │
│  Accessed sync via getEntityInstanceNameSync(entityCode, uuid)              │
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
│  formatDataset(data, metadata) → FormattedRow[]                             │
│    └── formatRow(row, viewType)                                             │
│        └── formatValue(value, key, viewType[key])                           │
│            └── switch on renderType                                          │
│                └── 'currency' → formatCurrency()                            │
│                └── 'badge' → formatBadge() + getDatalabelSync()             │
│                └── 'entityInstanceId' → getEntityInstanceNameSync()         │
│                └── 'entityInstanceIds' → getEntityInstanceNameSync() (each) │
│                                                                              │
│  renderEditModeFromMetadata(value, editType[key], onChange)                 │
│    └── switch on inputType                                                   │
│        └── 'number' → <input type="number" />                               │
│        └── 'BadgeDropdownSelect' → <BadgeDropdownSelect />                  │
│        └── 'EntityInstanceNameSelect' → <EntityInstanceNameSelect />        │
│        └── 'EntityInstanceNameMultiSelect' → <EntityInstanceNameMultiSelect/>│
│                                                                              │
│  ✗ NO pattern detection (_id suffix, _amt suffix, etc.)                      │
│  ✗ NO refData prop drilling (deprecated in v11.0.0)                          │
│  ✓ All decisions from metadata.renderType/inputType/lookupEntity             │
│  ✓ Entity names from TanStack Query cache (sync access)                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/formatters/types.ts` | TypeScript types for ComponentMetadata |
| `lib/formatters/datasetFormatter.ts` | formatDataset, formatRow, formatValue |
| `lib/formatters/valueFormatters.ts` | Currency, date, badge, reference formatters |
| `lib/frontEndFormatterService.tsx` | renderViewModeFromMetadata, renderEditModeFromMetadata |
| `db/cache/stores.ts` | Sync accessors: getEntityInstanceNameSync, getDatalabelSync |
| `db/tanstack-index.ts` | Re-exports for sync cache access |
| `components/shared/ui/BadgeDropdownSelect.tsx` | Badge dropdown component for datalabel fields |
| `components/shared/ui/EntityInstanceNameSelect.tsx` | Single entity reference dropdown |
| `components/shared/ui/EntityInstanceNameMultiSelect.tsx` | Multi-select entity reference dropdown |

---

## Core Types (v11.0.0)

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
  renderType?: string;              // 'entityInstanceId', 'badge', 'currency', etc.
  component?: string;               // 'EntityInstanceName' or 'EntityInstanceNames'
  lookupSource?: 'entityInstance' | 'datalabel';
  lookupEntity?: string;            // Entity code (e.g., 'employee') - used by getEntityInstanceNameSync
  datalabelKey?: string;            // Datalabel key (e.g., 'project_stage') - used by getDatalabelSync
  behavior: { visible?: boolean; sortable?: boolean };
  style: Record<string, any>;
}

// FormattedRow - Output of formatDataset
interface FormattedRow<T> {
  raw: T;                           // Original values (for mutations)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (badges only)
}

// FieldMetadata for valueFormatters (v11.0.0)
interface FieldMetadata {
  renderType?: string;
  inputType?: string;
  lookupSource?: 'entityInstance' | 'datalabel';
  lookupEntity?: string;            // For entity reference resolution
  datalabelKey?: string;            // For badge color lookup
  dtype?: string;
}

// Validation helper
function isValidComponentMetadata(metadata: any): boolean {
  return metadata && 'viewType' in metadata && typeof metadata.viewType === 'object';
}
```

---

## Entity Reference Resolution (v11.0.0)

### TanStack Query Cache Pattern

v11.0.0 uses **TanStack Query cache** for entity reference resolution. No more passing `refData` through component tree.

```typescript
// valueFormatters.ts - formatReference() implementation
import { getEntityInstanceNameSync } from '@/db/tanstack-index';

export function formatReference(value: any, metadata?: FieldMetadata): FormattedValue {
  if (!value) return { display: '—' };

  const entityCode = metadata?.lookupEntity;  // From backend metadata
  const uuid = String(value);

  // v11.0.0: Read from TanStack Query cache (SYNC)
  if (entityCode) {
    const name = getEntityInstanceNameSync(entityCode, uuid);
    // Reads from: queryClient.getQueryData(['entityInstanceNames', entityCode])
    if (name) return { display: name };
  }

  // Fallback: truncated UUID
  return { display: uuid.substring(0, 8) + '...' };
}
```

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ENTITY REFERENCE RESOLUTION (v11.0.0)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. LOGIN: prefetchRefDataEntityInstances()                                  │
│     └── Populates: queryClient.setQueryData(                                │
│           ['entityInstanceNames', 'employee'], { 'uuid-123': 'James' }      │
│         )                                                                    │
│                                                                              │
│  2. API RESPONSE: upsertRefDataEntityInstance()                             │
│     └── Merges API's ref_data_entityInstance into cache                     │
│     └── Incremental updates for new UUIDs                                   │
│                                                                              │
│  3. FORMATTER: formatReference(uuid, { lookupEntity: 'employee' })          │
│     └── getEntityInstanceNameSync('employee', uuid)                         │
│     └── queryClient.getQueryData(['entityInstanceNames', 'employee'])       │
│     └── Returns 'James Miller' (or truncated UUID if not found)             │
│                                                                              │
│  ✓ Sync access - no promises, no async                                       │
│  ✓ Populated at login - instant resolution                                   │
│  ✓ Incrementally updated by API responses                                    │
│  ✓ No prop drilling through component tree                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sync Accessors (Non-Hook Context)

```typescript
import { getEntityInstanceNameSync, getDatalabelSync } from '@/db/tanstack-index';

// Entity reference resolution
const employeeName = getEntityInstanceNameSync('employee', 'uuid-123');
// → 'James Miller' (from cache) or null (cache miss)

// Datalabel color lookup
const options = getDatalabelSync('project_stage');
// → [{ name: 'planning', label: 'Planning', color_code: 'blue' }]

// These read directly from queryClient.getQueryData() - SYNCHRONOUS
// Populated at login via prefetchAllMetadata()
```

---

## Data Flow

### Format-at-Read Pattern (v11.0.0)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FORMAT-AT-READ FLOW (v11.0.0 - TanStack Query Cache)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CASE 1: Main Entity List Page (EntityListOfInstancesPage)                   │
│  ──────────────────────────────────────────────────────────                  │
│                                                                              │
│  // QUERY 1: Metadata (30-min cache)                                         │
│  const { viewType, editType } = useEntityInstanceMetadata(entityCode);      │
│  const metadata = useMemo(() => ({ viewType, editType }), [...]);           │
│                                                                              │
│  // QUERY 2: Data (5-min cache)                                              │
│  const { data: rawData } = useEntityInstanceData(entityCode);               │
│                                                                              │
│  // FORMAT-AT-READ (via useMemo)                                             │
│  const formattedData = useMemo(() => {                                      │
│    return formatDataset(rawData, metadata);  // v11.0.0: No refData param   │
│  }, [rawData, metadata]);                                                    │
│                                                                              │
│                                                                              │
│  CASE 2: Child Entity Tab (EntitySpecificInstancePage)                       │
│  ─────────────────────────────────────────────────────                       │
│  Route: /project/:id/task                                                    │
│                                                                              │
│  // QUERY 1: Child Data (5-min cache) - with parent filtering               │
│  const { data: childData } = useEntityInstanceData('task', {                │
│    parent_entity_code: 'project',                                           │
│    parent_entity_instance_id: projectId,                                    │
│    limit: 50                                                                 │
│  });                                                                         │
│                                                                              │
│  // QUERY 2: Child Metadata (30-min cache)                                   │
│  const { viewType, editType } = useEntityInstanceMetadata('task');          │
│  const childMetadata = useMemo(() => ({ viewType, editType }), [...]);      │
│                                                                              │
│  // FORMAT-AT-READ (via useMemo)                                             │
│  const formattedData = useMemo(() => {                                      │
│    return formatDataset(childData, childMetadata);  // No refData param     │
│  }, [childData, childMetadata]);                                            │
│                                                                              │
│                                                                              │
│  FORMATTER EXECUTION (v11.0.0):                                              │
│  ──────────────────────────────                                              │
│  formatDataset(rawData, metadata)   // refData deprecated                   │
│    └── Loop: formatRow(row, viewType)                                       │
│        └── Per field: formatValue(value, key, viewType[key])                │
│            └── Switch on viewType[key].renderType                            │
│                ├── 'currency' → formatCurrency()                            │
│                ├── 'date' → formatDate()                                    │
│                ├── 'badge' → formatBadge() + getDatalabelSync()             │
│                ├── 'entityInstanceId' → getEntityInstanceNameSync()         │
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
// v9.8.0: inputType is now EntityInstanceNameSelect or EntityInstanceNameMultiSelect
if (fieldMeta.inputType === 'EntityInstanceNameSelect') {
  const entityCode = fieldMeta.lookupEntity;  // 'employee'
  return (
    <EntityInstanceNameSelect
      entityCode={entityCode}
      value={row.raw[key]}
      onChange={(uuid, label) => onChange(id, key, uuid)}
    />
  );
}
if (fieldMeta.inputType === 'EntityInstanceNameMultiSelect') {
  const entityCode = fieldMeta.lookupEntity;  // 'employee'
  return (
    <EntityInstanceNameMultiSelect
      entityCode={entityCode}
      value={row.raw[key] || []}
      onChange={(uuids) => onChange(id, key, uuids)}
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

  // Entity reference (v9.8.0 - renamed from entityInstanceId)
  case 'EntityInstanceNameSelect':
    const entityCode = metadata.lookupEntity;
    return <EntityInstanceNameSelect entityCode={entityCode} />;

  case 'EntityInstanceNameMultiSelect':
    const entityCodeMulti = metadata.lookupEntity;
    return <EntityInstanceNameMultiSelect entityCode={entityCodeMulti} />;

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

### formatValue (v11.0.0)

```typescript
// valueFormatters.ts + datasetFormatter.ts
function formatValue(
  value: any,
  key: string,
  metadata: ViewFieldMetadata | undefined,
  _refData?: RefData  // DEPRECATED: Kept for backward compatibility, ignored
): FormattedValue {
  if (!metadata) {
    return { display: String(value ?? ''), style: '' };
  }

  const renderType = metadata.renderType || 'text';

  // v11.0.0: Entity references use TanStack Query cache
  if (renderType === 'entityInstanceId' || renderType === 'reference') {
    return formatReference(value, metadata);  // Uses getEntityInstanceNameSync()
  }

  // Array entity reference
  if (renderType === 'entityInstanceIds') {
    return formatReference(value, metadata);  // Handles arrays internally
  }

  // Component-based rendering
  if (renderType === 'component' && metadata.component) {
    if (metadata.component === 'EntityInstanceName' ||
        metadata.component === 'EntityInstanceNames') {
      return formatReference(value, metadata);  // Uses getEntityInstanceNameSync()
    }
    return formatText(value);
  }

  switch (renderType) {
    case 'currency':
      return formatCurrency(value, metadata);
    case 'date':
      return formatDate(value);
    case 'timestamp':
      return formatRelativeTime(value);
    case 'badge':
    case 'datalabel':
      return formatBadge(value, metadata);  // Uses getDatalabelSync()
    case 'boolean':
      return formatBoolean(value);
    case 'array':
      return formatArray(value);
    case 'percentage':
      return formatPercentage(value);
    default:
      return formatText(value);
  }
}
```

### formatReference (v11.0.0)

```typescript
// valueFormatters.ts - uses TanStack Query cache
import { getEntityInstanceNameSync } from '@/db/tanstack-index';

function formatReference(
  value: any,
  metadata?: FieldMetadata,
  _refData?: RefData  // DEPRECATED: ignored
): FormattedValue {
  if (!value) return { display: '—' };

  const entityCode = metadata?.lookupEntity;

  // Handle array of UUIDs
  if (Array.isArray(value)) {
    if (value.length === 0) return { display: '—' };
    const names = value.map(uuid => {
      if (entityCode) {
        const name = getEntityInstanceNameSync(entityCode, uuid);
        if (name) return name;
      }
      return String(uuid).substring(0, 8) + '...';
    });
    return { display: names.join(', ') };
  }

  // Single UUID
  const uuid = String(value);
  if (entityCode) {
    const name = getEntityInstanceNameSync(entityCode, uuid);
    if (name) return { display: name };
  }

  // Fallback: truncated UUID
  return { display: uuid.length > 8 ? uuid.substring(0, 8) + '...' : uuid };
}
```

### formatDataset (v11.0.0)

```typescript
// datasetFormatter.ts
function formatDataset<T extends Record<string, any>>(
  data: T[],
  metadata: ComponentMetadata | null,
  _refData?: RefData  // DEPRECATED: Kept for backward compatibility, ignored
): FormattedRow<T>[] {
  if (!data || data.length === 0) return [];

  // v11.0.0: refData parameter ignored - uses TanStack Query cache internally
  return data.map(row => formatRow(row, metadata));
}
```

---

## Anti-Patterns (v11.0.0)

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Pattern detection in frontend | Duplicates backend logic | Read from `metadata.viewType` |
| Field name `_id` suffix check | Hardcoded pattern | Use `metadata.lookupEntity` |
| Formatting during render | Slow scroll performance | Format-at-read via `useMemo` |
| Hardcoded field types | Maintenance burden | Backend metadata driven |
| Passing refData through props | Deprecated in v11.0.0 | Use `getEntityInstanceNameSync()` |
| Direct cache writes | Bypasses TanStack Query | Use `upsertRefDataEntityInstance()` |
| Creating sync stores | Redundant in v11.0.0 | Use `queryClient.getQueryData()` |

---

## Strict Requirements (v11.0.0)

### No Pattern Detection

Components MUST NOT detect field types by name patterns:

```typescript
// ✗ WRONG: Pattern detection
if (field.key.endsWith('_id')) {
  // Assume it's an entity reference
}
if (field.key.includes('_amt') || field.key.includes('_price')) {
  return formatCurrency(value);
}

// ✓ CORRECT: Use backend metadata (v11.0.0 - TanStack Query cache)
if (metadata.renderType === 'entityInstanceId') {
  // formatReference uses getEntityInstanceNameSync internally
  return formatReference(value, metadata);
}
if (metadata.renderType === 'currency') {
  return formatCurrency(value);
}
```

### No RefData Prop Drilling (v11.0.0)

Components MUST NOT pass refData through props:

```typescript
// ✗ WRONG: Passing refData through component tree (deprecated)
<EntityListOfInstancesTable
  data={rawData}
  ref_data_entityInstance={refData}  // Don't do this
/>

// ✓ CORRECT: formatDataset reads from TanStack Query cache internally
const formattedData = useMemo(() => {
  return formatDataset(rawData, metadata);  // No refData param needed
}, [rawData, metadata]);

<EntityListOfInstancesTable data={formattedData} />
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
  console.error(`[Component] formattedData required for ${field.key}`);
  return <span className="text-red-500">Missing formatted data</span>;
}
return <span>{formattedData.display[field.key]}</span>;
```

### Entity Reference Detection

```typescript
// ✗ WRONG: Pattern-based detection
const isRef = fieldName.endsWith('_id');
const entityCode = fieldName.match(/^.*__(\w+)_id$/)?.[1];

// ✓ CORRECT: Metadata-based detection (v11.0.0)
const isRef = metadata.renderType === 'entityInstanceId' ||
              metadata.renderType === 'reference' ||
              metadata.renderType === 'entityInstanceIds';
const entityCode = metadata.lookupEntity;  // From backend metadata
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

// Check if field is entity reference (v11.0.0)
function isEntityReferenceField(fieldMeta: FieldMetadata | undefined): boolean {
  if (!fieldMeta) return false;
  return (
    fieldMeta.renderType === 'entityInstanceId' ||
    fieldMeta.renderType === 'reference' ||
    fieldMeta.renderType === 'entityInstanceIds' ||
    (fieldMeta.renderType === 'component' &&
      (fieldMeta.component === 'EntityInstanceName' || fieldMeta.component === 'EntityInstanceNames')) ||
    fieldMeta.inputType === 'EntityInstanceNameSelect' ||
    fieldMeta.inputType === 'EntityInstanceNameMultiSelect' ||
    fieldMeta.lookupSource === 'entityInstance'
  );
}

// Get entity code from metadata
function getEntityCodeFromMetadata(fieldMeta: FieldMetadata | undefined): string | null {
  if (!fieldMeta) return null;
  return fieldMeta.lookupEntity ?? null;
}

// Sync cache accessors (v11.0.0)
import { getEntityInstanceNameSync, getDatalabelSync } from '@/db/tanstack-index';

// Resolve entity name from cache
const name = getEntityInstanceNameSync('employee', 'uuid-123');  // → 'James Miller' or null

// Resolve datalabel options from cache
const options = getDatalabelSync('project_stage');  // → [{ name, label, color_code }] or null
```

---

## Performance Optimizations

| Optimization | Impact |
|--------------|--------|
| Format-at-read (useMemo) | Cache stores small RAW data |
| TanStack Query cache | Entity names O(1) lookup via `getQueryData()` |
| Sync cache access | No async/await in formatters |
| Direct property access | Zero function calls during scroll |
| Pre-computed styles | Badge CSS computed once at format time |
| Virtualization compatible | Works with @tanstack/react-virtual |
| Login prefetch | 250+ entity names cached before render |

---

## Integration with Real-Time Sync (v11.0.0)

The frontend formatter integrates seamlessly with the WebSocket sync system via TanStack Query + Dexie:

1. **WebSocket INVALIDATE** → WebSocketManager receives message
2. **TanStack Invalidate** → `queryClient.invalidateQueries()` marks stale
3. **Auto Refetch** → TanStack Query fetches fresh data from REST API
4. **Dexie Update** → `db.entityInstance.put()` updates IndexedDB
5. **Cache Update** → `upsertRefDataEntityInstance()` updates entity name cache
6. **Format-at-Read** → `formatDataset()` resolves names via `getEntityInstanceNameSync()`
7. **Component Re-render** → Updated FormattedRow[] displayed automatically

This ensures that when another user modifies an entity, subscribers see fresh, correctly formatted data within ~60 seconds (LogWatcher polling interval).

See `docs/caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md` for full sync architecture details.

### TanStack Query Cache Keys (v11.0.0)

| Cache | Query Key | Purpose |
|-------|-----------|---------|
| Entity Instance Names | `['entityInstanceNames', entityCode]` | UUID → name resolution |
| Entity Instance Data | `['entityInstanceData', entityCode, params]` | Entity list data |
| Entity Instance Metadata | `['entityInstanceMetadata', entityCode]` | Field metadata |
| Single Entity | `['entityInstance', entityCode, id]` | Single entity record |
| Datalabel | `['datalabel', key]` | Badge/dropdown options |

---

**Version:** 11.0.0 | **Updated:** 2025-12-02

**Recent Updates:**
- v11.0.0 (2025-12-02):
  - **TanStack Query cache for entity references** - Removed redundant sync stores
  - `formatReference()` now uses `getEntityInstanceNameSync()` (reads from `queryClient.getQueryData()`)
  - `refData` parameter deprecated and ignored in all formatter functions
  - No more prop drilling `ref_data_entityInstance` through component tree
  - Single source of truth: TanStack Query cache
  - Updated all architecture diagrams and code examples
- v9.8.0 (2025-12-01):
  - **Standardized entity reference components**:
    - VIEW: `renderType: 'entityInstanceId'` or `component: 'EntityInstanceName'`
    - EDIT: `inputType: 'EntityInstanceNameSelect'` (single) / `'EntityInstanceNameMultiSelect'` (array)
- v9.7.0 (2025-12-01):
  - **Child entity tabs two-query architecture** - Child tabs now use:
    - `useEntityInstanceData()` with `parent_entity_code` + `parent_entity_instance_id` params
    - `useEntityInstanceMetadata()` for metadata (separate query, 30-min cache)
- v9.6.0 (2025-12-01):
  - **Two-Query Architecture** - Metadata and data fetched separately
  - Format-at-read via `useMemo` at page level
- v9.3.0 (2025-11-30):
  - **TanStack Query + Dexie v4** - Replaced RxDB with TanStack Query + Dexie
- v8.3.2 (2025-11-27):
  - Added `BadgeDropdownSelect` component for colored datalabel dropdowns
- v8.3.1 (2025-11-26): Removed all pattern detection, enforced metadata as source of truth
