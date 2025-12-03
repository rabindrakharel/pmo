# Datalabel System - End-to-End Data Flow

**Version:** 12.2.0 | **Updated:** 2025-12-02

> **v12.2.0 Updates:**
> - FieldRenderer integration - datalabel components registered in component registries
> - `BadgeDropdownSelect` registered in `EditComponentRegistry`
> - `badge` renderType handled by `ViewFieldRenderer` inline
> - See [FIELD_RENDERER_ARCHITECTURE.md](../design_pattern/FIELD_RENDERER_ARCHITECTURE.md)
>
> **v12.0.0 Breaking Changes:**
> - `lookupSource` → `lookupSourceTable`
> - `datalabelKey` → `lookupField`
> - Cache: TanStack Query + Dexie (replaced RxDB)
> - Access: `useDatalabel()` hook or `getDatalabelSync()` for non-hook contexts

---

## Architectural Truth

### Terminology Clarification

**Container vs Property:**

| Term | Type | Description |
|------|------|-------------|
| `viewType` | **Container** | Object holding all VIEW mode metadata for a field |
| `editType` | **Container** | Object holding all EDIT mode metadata for a field |
| `renderType` | **Property** | Property INSIDE `viewType` - controls view rendering |
| `inputType` | **Property** | Property INSIDE `editType` - controls edit rendering |

**API Response Structure:**
```
metadata.entityListOfInstancesTable
├── viewType                          ← CONTAINER for view metadata
│   └── dl__project_stage
│       ├── renderType: "badge"       ← PROPERTY (how to render in view mode)
│       ├── lookupField: "..."
│       └── ...
└── editType                          ← CONTAINER for edit metadata
    └── dl__project_stage
        ├── inputType: "component"    ← PROPERTY (how to render in edit mode)
        ├── component: "DataLabelSelect"
        └── ...
```

### Metadata Properties

| Container | Property | Purpose |
|-----------|----------|---------|
| **viewType** | `renderType` + `component` | Controls WHICH component renders (view mode) |
| **viewType** | `lookupField` | Field name for badge color lookup (v12.0.0) |
| **editType** | `inputType` + `component` (when needed) | Controls WHICH component renders (edit mode) |
| **editType** | `lookupSourceTable` + `lookupField` | Controls WHERE data comes from (v12.0.0) |

### inputType Values (property inside editType)

`inputType` can be either a **standard HTML5 input type** OR `"component"`:

| inputType | component field | What Renders |
|-----------|-----------------|--------------|
| `text` | - | `<input type="text">` |
| `number` | - | `<input type="number">` |
| `date` | - | `<input type="date">` |
| `datetime-local` | - | `<input type="datetime-local">` |
| `checkbox` | - | `<input type="checkbox">` |
| `email` | - | `<input type="email">` |
| `textarea` | - | `<textarea>` |
| `component` | **REQUIRED** | Component from registry (e.g., `DataLabelSelect`) |

**Rule:** If `component` has a value, `inputType` MUST be `"component"`.

### renderType Values (property inside viewType)

`renderType` controls VIEW mode rendering. Can be **inline types** OR `"component"`:

| renderType | component field | What Renders |
|------------|-----------------|--------------|
| `text` | - | Plain text display |
| `badge` | - | Colored badge (uses `lookupField` for color) |
| `currency` | - | Formatted currency (e.g., `$50,000.00`) |
| `date` | - | Formatted date |
| `timestamp` | - | Formatted datetime |
| `boolean` | - | Yes/No or checkmark |
| `entityLink` | - | Clickable entity link |
| `component` | **REQUIRED** | Component from registry (e.g., `DAGVisualizer`) |

**Rule:** If `component` has a value for view mode, `renderType` MUST be `"component"`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATALABEL FIELD RENDERING ARCHITECTURE (v12.0.0)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  viewType.dl__project_stage:                                                 │
│  ┌────────────────────────────────────────┐                                  │
│  │ renderType: "badge"                    │──► Badge with color from cache  │
│  │ lookupField: "dl__project_stage"       │──► Key for getDatalabelSync()   │
│  └────────────────────────────────────────┘                                  │
│                    │                                                         │
│                    ▼                                                         │
│  formatBadge() reads lookupField → getDatalabelSync(lookupField)            │
│  → finds matching option → applies color_code style                          │
│                                                                              │
│  editType.dl__project_stage:                                                 │
│  ┌────────────────────────────────────────┐                                  │
│  │ inputType: "component"                 │──► Custom component rendering   │
│  │ component: "DataLabelSelect"           │──► Colored badge dropdown       │
│  │ lookupSourceTable: "datalabel"         │──► Load from datalabel cache    │
│  │ lookupField: "dl__project_stage"       │──► Key for useDatalabel()       │
│  └────────────────────────────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Property Naming (v12.0.0)

| Old Name (< v12.0.0) | New Name (v12.0.0+) | Location | Purpose |
|----------------------|---------------------|----------|---------|
| `lookupSource` | `lookupSourceTable` | editType | Where to load options: `'datalabel'` or `'entityInstance'` |
| `datalabelKey` | `lookupField` | viewType + editType | Field name for lookup (e.g., `'dl__project_stage'`) |

**Why both viewType and editType need `lookupField`:**
- **viewType**: Badge color resolution via `getDatalabelSync(lookupField)`
- **editType**: Dropdown options loading via `useDatalabel(lookupField)`

---

## Phase 1: Database Schema

```sql
-- Entity table stores the current stage value
app.project
├── id: UUID
├── dl__project_stage: VARCHAR ──────► "Execution" (stage name)
└── ...other fields

-- Datalabel table stores stage definitions + hierarchy
app.datalabel_project_stage
├── id: INTEGER
├── name: VARCHAR ──────────────────► "Execution"
├── parent_ids: INTEGER[] ──────────► [2] (Planning's ID)
├── color_code: VARCHAR ────────────► "green"
├── sort_order: INTEGER
└── active_flag: BOOLEAN
```

---

## Phase 2: Backend Metadata Generation

### Pattern Detection (pattern-mapping.yaml)

```yaml
# Specific patterns BEFORE generic
- { pattern: "dl__*_stage", fieldBusinessType: datalabel_dag }
- { pattern: "dl__*_state", fieldBusinessType: datalabel_dag }
- { pattern: "dl__*_status", fieldBusinessType: datalabel_dag }
- { pattern: "dl__*", fieldBusinessType: datalabel }
```

### YAML Configuration (view-type-mapping.yaml)

```yaml
datalabel:
  dtype: str
  entityListOfInstancesTable:
    renderType: badge
    behavior: { visible: true, filterable: true, sortable: true }
    style: { colorFromData: true }
  # lookupField is auto-set by entity-component-metadata.service.ts
```

### YAML Configuration (edit-type-mapping.yaml)

```yaml
datalabel:
  dtype: str
  lookupSourceTable: datalabel           # ← v12.0.0: WHERE data comes from
  entityListOfInstancesTable:
    inputType: component                 # ← MUST be "component" when component is specified
    component: DataLabelSelect
    behavior: { editable: true, filterable: true }
  # lookupField is auto-set by entity-component-metadata.service.ts
```

### Backend Auto-Population (entity-component-metadata.service.ts)

```typescript
// v12.0.0: Auto-set lookupField for datalabel fields
if (edit.lookupSourceTable === 'datalabel') {
  edit.lookupField = fieldName;  // e.g., "dl__project_stage"
  view.lookupField = fieldName;  // Set on BOTH for badge color resolution
}
```

---

## Phase 3: API Response

```json
{
  "data": {
    "dl__project_stage": "Execution"
  },
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "lookupField": "dl__project_stage",
          "behavior": { "visible": true, "filterable": true },
          "style": { "colorFromData": true }
        }
      },
      "editType": {
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "component",
          "component": "DataLabelSelect",
          "lookupSourceTable": "datalabel",
          "lookupField": "dl__project_stage",
          "behavior": { "editable": true }
        }
      }
    }
  }
}
```

---

## Phase 4: Login-Time Caching (v12.0.0 - TanStack Query + Dexie)

```typescript
// AuthContext.tsx - On successful login
import { prefetchAllMetadata } from '@/db/tanstack-index';

// Prefetch ALL metadata into TanStack Query + Dexie (IndexedDB)
await prefetchAllMetadata();

// This populates:
// 1. TanStack Query cache (in-memory, auto-refetch)
// 2. Dexie IndexedDB (persistent, survives browser restart)
// 3. Sync cache (in-memory for non-hook access)

// Access in components via hook:
const { options, isLoading } = useDatalabel('dl__project_stage');

// Access in formatters/utilities via sync cache:
const options = getDatalabelSync('dl__project_stage');

// Cache structure:
// TanStack Query key: ['datalabel', 'dl__project_stage']
// Dexie table: 'datalabel' with key 'dl__project_stage'
{
  "dl__project_stage": [
    { id: 1, name: "Initiation", parent_ids: [], color_code: "gray" },
    { id: 2, name: "Planning", parent_ids: [1], color_code: "blue" },
    { id: 3, name: "Execution", parent_ids: [2], color_code: "green" },
    { id: 4, name: "Monitoring", parent_ids: [3], color_code: "yellow" },
    { id: 5, name: "Closed", parent_ids: [4], color_code: "gray" }
  ]
}
```

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATALABEL CACHING ARCHITECTURE (v12.0.0)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  API Response:                          Frontend Cache:                      │
│  ┌─────────────────────────────┐        ┌─────────────────────────────────┐ │
│  │ GET /api/v1/datalabel/all   │        │  TanStack Query (in-memory)     │ │
│  │                             │        │  ├── ['datalabel-all']          │ │
│  │ { data: [                   │──────► │  └── auto-refetch on stale      │ │
│  │   { name: "dl__project_stage",       │                                  │ │
│  │     options: [...] },       │        │  Dexie IndexedDB (persistent)   │ │
│  │   { name: "dl__task_status",│        │  ├── datalabel table            │ │
│  │     options: [...] }        │        │  └── survives browser restart   │ │
│  │ ] }                         │        │                                  │ │
│  └─────────────────────────────┘        │  Sync Cache (in-memory)          │ │
│                                         │  └── getDatalabelSync() access   │ │
│  queryFn transforms array to record:    └─────────────────────────────────┘ │
│  { "dl__project_stage": [...options] }                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FieldRenderer Integration (v12.2.0)

### Datalabel Field Resolution

With v12.2.0, datalabel fields are rendered via FieldRenderer, which resolves components automatically:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATALABEL FIELDRENDERER RESOLUTION (v12.2.0)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Field: dl__project_stage = "Execution"                                      │
│                                                                              │
│  VIEW MODE (isEditing=false):                                                │
│  ─────────────────────────────                                              │
│  1. FieldRenderer receives field with renderType='badge'                     │
│  2. resolveViewComponent('badge') → null (inline type)                       │
│  3. ViewFieldRenderer handles inline:                                        │
│     - Uses formattedData.display['dl__project_stage'] = "Execution"          │
│     - Uses formattedData.styles['dl__project_stage'] = "bg-green-100..."     │
│     - Renders: <span className={style}>{display}</span>                      │
│                                                                              │
│  EDIT MODE (isEditing=true):                                                 │
│  ────────────────────────────                                               │
│  1. FieldRenderer receives field with:                                       │
│     - inputType='component'                                                  │
│     - component='DataLabelSelect'                                            │
│     - lookupField='dl__project_stage'                                        │
│  2. resolveEditComponent('component', 'DataLabelSelect')                     │
│     → EditComponentRegistry.get('DataLabelSelect')                           │
│  3. Renders: <DataLabelSelect value={...} options={...} />          │
│                                                                              │
│  OPTIONS LOADING:                                                            │
│  ─────────────────                                                          │
│  const options = getDatalabelSync('dl__project_stage');                      │
│  // Passed to FieldRenderer as props.options                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### FieldRenderer Usage for Datalabel Fields

```typescript
// EntityInstanceFormContainer.tsx (v12.2.0)
import { FieldRenderer } from '@/lib/fieldRenderer';
import { getDatalabelSync } from '@/db/tanstack-index';

// Pre-load datalabel options for fields
const labelsMetadata = useMemo(() => {
  const map = new Map<string, DatalabelOption[]>();
  fields.forEach(field => {
    if (field.lookupSourceTable === 'datalabel' && field.lookupField) {
      const options = getDatalabelSync(field.lookupField);
      if (options) map.set(field.key, options);
    }
  });
  return map;
}, [fields]);

// Render fields via FieldRenderer
{fields.map(field => (
  <FieldRenderer
    key={field.key}
    field={field}                    // { renderType: 'badge', inputType: 'component', component: 'DataLabelSelect', lookupField: 'dl__...' }
    value={data[field.key]}          // "Execution"
    isEditing={isEditing}
    onChange={(v) => handleChange(field.key, v)}
    options={labelsMetadata.get(field.key)}  // DatalabelOption[] from cache
    formattedData={{                 // Pre-formatted for VIEW mode
      display: formattedRow.display,
      styles: formattedRow.styles,
    }}
  />
))}
```

### Component Resolution Matrix

| renderType/inputType | component | Registry | Resolved Component |
|----------------------|-----------|----------|-----------|
| `badge` | - | Inline | `ViewFieldRenderer` (uses formattedData) |
| `component` | `DAGVisualizer` | VIEW | `ViewComponentRegistry.get('DAGVisualizer')` |
| `component` | `DataLabelSelect` | EDIT | `EditComponentRegistry.get('DataLabelSelect')` |
| `component` | `BadgeDropdownSelect` | EDIT | `EditComponentRegistry.get('BadgeDropdownSelect')` |

---

## Phase 5: Frontend Rendering (Legacy)

> **Note:** v12.2.0 uses FieldRenderer. This section documents the underlying formatters that FieldRenderer calls.

### Badge Color Resolution (viewType)

```typescript
// valueFormatters.ts - formatBadge()
export function formatBadge(
  value: string | null | undefined,
  key: string,
  metadata?: ViewFieldMetadata
): FormattedValue {
  if (!value) return { display: '-', style: '' };

  // v12.0.0: Use lookupField for datalabel color lookup
  const lookupField = metadata?.lookupField;
  if (lookupField) {
    const options = getDatalabelSync(lookupField);
    if (options) {
      const option = options.find(opt => opt.name === value);
      if (option?.color_code) {
        return {
          display: value,
          style: `bg-${option.color_code}-100 text-${option.color_code}-800`
        };
      }
    }
  }

  return { display: value, style: 'bg-gray-100 text-gray-800' };
}
```

### Dropdown Options (editType)

```typescript
// EntityListOfInstancesTable.tsx - Column definition
const datalabelColumns = columns.filter(
  col => col.editMeta?.lookupSourceTable === 'datalabel'
);

// For each datalabel column, fetch options
datalabelColumns.forEach(col => {
  const lookupField = col.editMeta?.lookupField;
  if (lookupField) {
    const { options } = useDatalabel(lookupField);
    // options = [{ id, name, color_code, ... }]
  }
});
```

### EntityInstanceFormContainer Field Building

```typescript
const fields = useMemo(() => {
  return Object.entries(viewType).map(([fieldKey, viewMeta]) => {
    const editMeta = editType?.[fieldKey];

    // v12.0.0: Read lookupField from metadata
    const lookupSourceTable = editMeta?.lookupSourceTable;  // "datalabel"
    const lookupField = editMeta?.lookupField;              // "dl__project_stage"

    return {
      key: fieldKey,
      lookupSourceTable,
      lookupField,
      viewMeta,
      editMeta,
    };
  });
}, [metadata]);
```

### Datalabel Loading for Forms

```typescript
const { labelsMetadata, dagNodes } = useMemo(() => {
  // v12.0.0: Filter by lookupSourceTable instead of lookupSource
  const fieldsNeedingDatalabels = fields.filter(
    field => field.lookupSourceTable === 'datalabel'
  );

  fieldsNeedingDatalabels.forEach((field) => {
    // v12.0.0: Use lookupField instead of datalabelKey
    const lookupField = field.lookupField || field.key;
    const cachedOptions = getDatalabelSync(lookupField);

    if (cachedOptions) {
      labelsMap.set(field.key, cachedOptions);
    }
  });
}, [fields]);
```

### View Mode Rendering (Badge)

```typescript
// Using formatBadge with metadata containing lookupField
if (viewMeta.renderType === 'badge') {
  const formatted = formatBadge(value, field.key, viewMeta);
  return (
    <span className={formatted.style}>
      {formatted.display}
    </span>
  );
}
```

### Edit Mode Rendering (DataLabelSelect)

```typescript
// When inputType === 'component', render the component from editMeta.component
if (editMeta?.inputType === 'component' && editMeta?.component) {
  const lookupField = editMeta.lookupField;
  const options = getDatalabelSync(lookupField) || [];
  const Component = EditComponentRegistry.get(editMeta.component);

  return (
    <Component
      value={value}
      options={options.map(opt => ({
        value: opt.name,
        label: opt.name,
        color: opt.color_code
      }))}
      onChange={(v) => handleFieldChange(field.key, v)}
    />
  );
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/src/services/pattern-mapping.yaml` | Field pattern → fieldBusinessType |
| `apps/api/src/services/view-type-mapping.yaml` | viewType metadata (renderType, lookupField) |
| `apps/api/src/services/edit-type-mapping.yaml` | editType metadata (inputType, lookupSourceTable, lookupField) |
| `apps/api/src/services/entity-component-metadata.service.ts` | Generates API response metadata, auto-sets lookupField |
| `apps/web/src/db/cache/hooks/useDatalabel.ts` | TanStack Query hooks for datalabel access |
| `apps/web/src/db/tanstack-index.ts` | Exports `getDatalabelSync()`, `prefetchAllMetadata()` |
| `apps/web/src/lib/formatters/valueFormatters.ts` | `formatBadge()` uses lookupField for color |
| `apps/web/src/lib/formatters/types.ts` | ViewFieldMetadata, EditFieldMetadata types |
| `apps/web/src/components/shared/entity/EntityInstanceFormContainer.tsx` | Field rendering with datalabel support |
| `apps/web/src/components/shared/ui/BadgeDropdownSelect.tsx` | Colored dropdown component |

---

## API Transform Pattern (v12.0.0)

The API returns datalabels as an array, but the frontend cache stores them as a record:

```typescript
// useDatalabel.ts - useAllDatalabels()
queryFn: async () => {
  // API returns: { data: [{ name, options }, { name, options }, ...] }
  const response = await apiClient.get('/api/v1/datalabel/all');

  // Transform to record in queryFn (format-at-fetch boundary)
  const allDatalabels: Record<string, DatalabelOption[]> = {};
  for (const item of response.data?.data || []) {
    allDatalabels[item.name] = item.options;
  }

  // Store per-key in TanStack Query + Dexie
  for (const [key, options] of Object.entries(allDatalabels)) {
    queryClient.setQueryData(['datalabel', key], options);
    await dexieDb.datalabel.put({ key, options, updatedAt: Date.now() });
  }

  return allDatalabels;
}
```

---

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Pattern detection in frontend (checking `dl__*`) | Use `viewType.lookupField` or `editType.lookupSourceTable` |
| Using old property names (`lookupSource`, `datalabelKey`) | Use v12.0.0 names: `lookupSourceTable`, `lookupField` |
| Fetching datalabels per field | Use login-time cache via `getDatalabelSync()` or `useDatalabel()` |
| Hardcoded component names | Read from `viewType.component` or `editType.component` |
| Only setting `lookupField` on editType | Backend sets on BOTH viewType and editType for badge colors |
| Transforming API response in component | Transform in `queryFn` at the fetch boundary |

---

## Migration from v8.x to v12.0.0

```typescript
// Before (v8.x)
const lookupSource = editMeta?.lookupSource;      // ❌ Old name
const datalabelKey = editMeta?.datalabelKey;      // ❌ Old name
const options = useRxDatalabel(datalabelKey);     // ❌ RxDB hook

// After (v12.0.0)
const lookupSourceTable = editMeta?.lookupSourceTable;  // ✅ New name
const lookupField = editMeta?.lookupField;              // ✅ New name
const { options } = useDatalabel(lookupField);          // ✅ TanStack Query hook

// Sync access (for formatters)
const options = getDatalabelSync(lookupField);          // ✅ Sync cache
```

---

**Version:** 12.2.0 | **Updated:** 2025-12-02 | **Status:** Production Ready

**Recent Updates:**
- v12.2.0 (2025-12-02):
  - FieldRenderer integration for datalabel fields
  - `BadgeDropdownSelect` registered in EditComponentRegistry
  - `badge` renderType handled by ViewFieldRenderer inline
  - Added FieldRenderer resolution flow diagram
  - Added Component Resolution Matrix
- v12.0.0 (2025-12-02):
  - Renamed `lookupSource` → `lookupSourceTable`
  - Renamed `datalabelKey` → `lookupField`
  - Backend auto-sets `lookupField` on BOTH viewType and editType
  - Migrated from RxDB to TanStack Query + Dexie
  - API response array-to-record transform in `queryFn`
  - Updated all code examples and documentation
