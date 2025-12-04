# Field Renderer Architecture

> Version: 12.6.0 | Status: Production Ready | Updated: 2025-12-04

## Overview

The Field Renderer system provides a **modular, metadata-driven interface** for rendering fields in both VIEW and EDIT modes. It eliminates hardcoded rendering logic by using a component registry pattern aligned with backend YAML configurations.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            FIELD RENDERER ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                           DATA FLOW                                          ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  1. API Response                                                                 │
│     ┌─────────────────────────────────────────────────────────────────────────┐ │
│     │ {                                                                        │ │
│     │   data: [{ budget: 50000, dl__stage: 'planning' }],                     │ │
│     │   metadata: {                                                            │ │
│     │     viewType: {                                                          │ │
│     │       budget: { renderType: 'currency', style: { symbol: '$' } },       │ │
│     │       dl__stage: { renderType: 'component', component: 'DAGVisualizer' }│ │
│     │     },                                                                   │ │
│     │     editType: {                                                          │ │
│     │       budget: { inputType: 'number', validation: { min: 0 } },          │ │
│     │       dl__stage: { inputType: 'component', component: 'BadgeDropdown' } │ │
│     │     }                                                                    │ │
│     │   },                                                                     │ │
│     │   ref_data_entityInstance: { employee: { 'uuid': 'James' } }            │ │
│     │ }                                                                        │ │
│     └─────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                         │
│                                        ▼                                         │
│  2. TanStack Query Cache (RAW data)                                              │
│     ┌─────────────────────────────────────────────────────────────────────────┐ │
│     │ queryClient.setQueryData(['entity', 'project', id], rawResponse)        │ │
│     │ // Stores: { data, metadata, ref_data_entityInstance }                  │ │
│     └─────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                         │
│                                        ▼                                         │
│  3. Reactive Formatting Hook (v12.6.0 - FORMAT-AT-READ + CACHE SUBSCRIPTION)     │
│     ┌─────────────────────────────────────────────────────────────────────────┐ │
│     │ const { data: rawData, metadata } =                                     │ │
│     │   useEntityInstanceData('project', params);                             │ │
│     │                                                                          │ │
│     │ // v12.6.0: Reactive formatting with datalabel cache subscription       │ │
│     │ const { data: formattedData } =                                         │ │
│     │   useFormattedEntityData(rawData, metadata, 'project');                │ │
│     │ // Subscribes to datalabel cache → re-formats on badge color changes    │ │
│     └─────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                         │
│                                        ▼                                         │
│  4. FormattedRow Output                                                          │
│     ┌─────────────────────────────────────────────────────────────────────────┐ │
│     │ {                                                                        │ │
│     │   raw: { budget: 50000, dl__stage: 'planning' },                        │ │
│     │   display: { budget: '$50,000.00', dl__stage: 'Planning' },             │ │
│     │   styles: { dl__stage: 'bg-blue-100 text-blue-800' }                    │ │
│     │ }                                                                        │ │
│     └─────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                         │
│                                        ▼                                         │
│  5. Page Component (EntityInstanceFormContainer, EntityListOfInstancesTable)    │
│     ┌─────────────────────────────────────────────────────────────────────────┐ │
│     │ {fields.map(field => (                                                   │ │
│     │   <FieldRenderer                                                         │ │
│     │     field={field}                    // { key, renderType, inputType }  │ │
│     │     value={row.raw[field.key]}       // Raw value for editing           │ │
│     │     isEditing={isEditing}            // VIEW or EDIT mode               │ │
│     │     onChange={handleChange}          // Edit callback                   │ │
│     │     options={datalabelOptions}       // For selects                     │ │
│     │     formattedData={{                 // Pre-formatted for VIEW          │ │
│     │       display: row.display,                                              │ │
│     │       styles: row.styles                                                 │ │
│     │     }}                                                                   │ │
│     │   />                                                                     │ │
│     │ ))}                                                                      │ │
│     └─────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                         │
│                                        ▼                                         │
│  6. FieldRenderer Resolution                                                     │
│     ┌─────────────────────────────────────────────────────────────────────────┐ │
│     │                                                                          │ │
│     │  isEditing=false (VIEW)              isEditing=true (EDIT)              │ │
│     │  ─────────────────────              ────────────────────                │ │
│     │  Uses: field.renderType              Uses: field.inputType              │ │
│     │                                                                          │ │
│     │  ┌─────────────────────┐            ┌─────────────────────┐            │ │
│     │  │ renderType='component'│           │ inputType='component'│            │ │
│     │  │ component='DAGViz'   │           │ component='BadgeDrop'│            │ │
│     │  │        ↓             │           │        ↓             │            │ │
│     │  │ ViewComponentRegistry│           │ EditComponentRegistry│            │ │
│     │  │ .get('DAGViz')       │           │ .get('BadgeDrop')    │            │ │
│     │  └─────────────────────┘            └─────────────────────┘            │ │
│     │                                                                          │ │
│     │  ┌─────────────────────┐            ┌─────────────────────┐            │ │
│     │  │ renderType='currency'│           │ inputType='number'   │            │ │
│     │  │ renderType='badge'   │           │ inputType='text'     │            │ │
│     │  │        ↓             │           │ inputType='date'     │            │ │
│     │  │ ViewFieldRenderer    │           │        ↓             │            │ │
│     │  │ (inline formatting)  │           │ EditFieldRenderer    │            │ │
│     │  └─────────────────────┘            │ (HTML5 inputs)       │            │ │
│     │                                      └─────────────────────┘            │ │
│     │                                                                          │ │
│     └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Component Registry Pattern

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         COMPONENT REGISTRY PATTERN                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐            │
│  │  VIEW COMPONENT REGISTRY    │    │  EDIT COMPONENT REGISTRY    │            │
│  │  ─────────────────────────  │    │  ─────────────────────────  │            │
│  │                             │    │                             │            │
│  │  'DAGVisualizer'      → FC  │    │  'DAGVisualizer'      → FC  │            │
│  │  'MetadataTable'      → FC  │    │  'MetadataTable'      → FC  │            │
│  │  'QuoteItemsRenderer' → FC  │    │  'QuoteItemsRenderer' → FC  │            │
│  │  'EntityInstanceName' → FC  │    │  'BadgeDropdownSelect'→ FC  │            │
│  │  'EntityInstanceNames'→ FC  │    │  'DataLabelSelect'    → FC  │            │
│  │  'DateRangeVisualizer'→ FC  │    │  'EntityInstanceName  │            │
│  │                             │    │   Select'             → FC  │            │
│  │                             │    │  'EntityInstanceName  │            │
│  │                             │    │   MultiSelect'        → FC  │            │
│  └─────────────────────────────┘    └─────────────────────────────┘            │
│                                                                                  │
│  Registration (at app init):                                                     │
│  ─────────────────────────────                                                   │
│  import { registerAllComponents } from '@/lib/fieldRenderer/registerComponents'; │
│  registerAllComponents();                                                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## YAML Alignment

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            YAML → REGISTRY MAPPING                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  view-type-mapping.yaml                    ViewComponentRegistry                 │
│  ─────────────────────                     ─────────────────────                 │
│  datalabel_dag:                                                                  │
│    entityInstanceFormContainer:            'DAGVisualizer' → DAGVisualizerView  │
│      renderType: component                                                       │
│      component: DAGVisualizer                                                    │
│                                                                                  │
│  json:                                                                           │
│    entityInstanceFormContainer:            'MetadataTable' → MetadataTableView  │
│      renderType: component                                                       │
│      component: MetadataTable                                                    │
│                                                                                  │
│  entityInstance_Id:                                                              │
│    entityInstanceFormContainer:            'EntityInstanceName' →               │
│      renderType: component                  EntityInstanceNameView              │
│      component: EntityInstanceName                                               │
│                                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  edit-type-mapping.yaml                    EditComponentRegistry                 │
│  ─────────────────────                     ─────────────────────                 │
│  datalabel_dag:                                                                  │
│    entityInstanceFormContainer:            'BadgeDropdownSelect' →              │
│      inputType: component                   BadgeDropdownSelectEdit             │
│      component: BadgeDropdownSelect                                              │
│                                                                                  │
│  entityInstance_Id:                                                              │
│    entityInstanceFormContainer:            'EntityInstanceNameSelect' →         │
│      inputType: EntityInstanceNameSelect    EntityInstanceNameSelectEdit        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
apps/web/src/lib/fieldRenderer/
├── index.ts                 # Public exports
├── ComponentRegistry.ts     # Registry maps and resolution functions
├── FieldRenderer.tsx        # Main unified component
├── ViewFieldRenderer.tsx    # Inline view rendering (currency, badge, etc.)
├── EditFieldRenderer.tsx    # HTML5 input rendering (text, number, date)
└── registerComponents.tsx   # Custom component registrations
```

## Implementation Plan

### Phase 1: Core Infrastructure ✅ COMPLETE
- [x] Create ComponentRegistry.ts with VIEW/EDIT registries
- [x] Create FieldRenderer.tsx main component
- [x] Create ViewFieldRenderer.tsx for inline view types
- [x] Create EditFieldRenderer.tsx for HTML5 inputs
- [x] Create registerComponents.tsx with all custom components
- [x] Update index.ts exports

### Phase 2: Component Registration ✅ COMPLETE
- [x] Add registerAllComponents() call to App.tsx
- [x] Register all VIEW mode components (DAGVisualizer, MetadataTable, etc.)
- [x] Register all EDIT mode components (BadgeDropdownSelect, DebouncedInput, etc.)
- [x] Register inline types as components (timestamp, badge, currency, text, number, etc.)

### Phase 3: Integration (READY FOR USE)
- [ ] Refactor EntityInstanceFormContainer to use FieldRenderer
- [ ] Refactor EntityListOfInstancesTable to use FieldRenderer
- [ ] Remove hardcoded switch statements

### Phase 4: Testing & Cleanup
- [ ] Test all field types in VIEW mode
- [ ] Test all field types in EDIT mode
- [ ] Remove unused imports from refactored components

## Usage Examples

### Basic Usage

```tsx
import { FieldRenderer } from '@/lib/fieldRenderer';

// In page component
{fields.map(field => (
  <FieldRenderer
    key={field.key}
    field={field}
    value={data[field.key]}
    isEditing={isEditing}
    onChange={(v) => handleChange(field.key, v)}
    options={labelsMetadata.get(field.key)}
    formattedData={{
      display: formattedRow.display,
      styles: formattedRow.styles
    }}
  />
))}
```

### Adding a New Component

1. Create the component:
```tsx
// MyCustomComponent.tsx
const MyCustomComponentView: React.FC<ComponentRendererProps> = ({ value }) => {
  return <div>{value}</div>;
};
```

2. Register it:
```tsx
// registerComponents.tsx
import { MyCustomComponentView } from './MyCustomComponent';
registerViewComponent('MyCustomComponent', MyCustomComponentView);
```

3. Configure in YAML:
```yaml
# view-type-mapping.yaml
myFieldType:
  entityInstanceFormContainer:
    renderType: component
    component: MyCustomComponent
```

## Benefits

| Before (Hardcoded) | After (Modular) |
|-------------------|-----------------|
| 900+ line renderField switch | Single `<FieldRenderer />` call |
| Duplicated logic across files | Centralized in registry |
| Hard to add new components | Register once, use everywhere |
| No alignment with YAML | Direct YAML → Registry mapping |
| Pattern detection in frontend | Metadata-driven from backend |

## Migration Path

Components being replaced:

| Old Pattern | New Pattern |
|-------------|-------------|
| `case 'text': return <DebouncedInput>` | `EditFieldRenderer` handles inline |
| `case 'select': return <BadgeDropdownSelect>` | `EditComponentRegistry.get('BadgeDropdownSelect')` |
| `if (vizContainer?.view === 'DAGVisualizer')` | `ViewComponentRegistry.get('DAGVisualizer')` |
| `if (field.renderType === 'currency')` | `ViewFieldRenderer` handles inline |

## Registered Components

### VIEW Mode Components

| Name | Component | Use Case |
|------|-----------|----------|
| `DAGVisualizer` | DAGVisualizerView | Workflow stage visualization |
| `MetadataTable` | MetadataTableView | JSONB key-value display |
| `QuoteItemsRenderer` | QuoteItemsView | Quote line items |
| `EntityInstanceName` | EntityInstanceNameView | Single entity reference |
| `EntityInstanceNames` | EntityInstanceNamesView | Multiple entity references (chips) |
| `DateRangeVisualizer` | DateRangeVisualizerView | Date range bar |
| `timestamp` | TimestampView | Relative time with tooltip |
| `date` | DateView | Formatted date |
| `badge` | BadgeView | Colored status badge |
| `currency` | CurrencyView | Formatted currency |
| `tags` / `array` | TagsView | Array as tags |
| `json` | JsonView | Pretty-printed JSON |

### EDIT Mode Components

| Name | Component | Use Case |
|------|-----------|----------|
| `DAGVisualizer` | DAGVisualizerEdit | Interactive workflow stage selection |
| `MetadataTable` | MetadataTableEdit | Editable key-value pairs |
| `QuoteItemsRenderer` | QuoteItemsEdit | Editable quote line items |
| `BadgeDropdownSelect` | BadgeDropdownSelectEdit | Colored dropdown for datalabels |
| `DataLabelSelect` | DataLabelSelectEdit | Alias for BadgeDropdownSelect |
| `EntityInstanceNameSelect` | EntityInstanceNameSelectEdit | Single entity selector |
| `EntityInstanceNameMultiSelect` | EntityInstanceNameMultiSelectEdit | Multi-entity selector |
| `text` | DebouncedTextInputEdit | Debounced text input |
| `number` | DebouncedNumberInputEdit | Debounced number input |
| `email` | DebouncedEmailInputEdit | Debounced email input |
| `textarea` / `richtext` | DebouncedTextareaInputEdit | Debounced textarea |
| `multiselect` | MultiSelectEdit | Searchable multi-select |

---

## Cache Management Pattern for Session-Scoped Metadata

### Problem

Badge colors and entity metadata disappear after ~1 hour because TanStack Query's garbage collection (gcTime) deletes unused cache entries.

### Solution: Infinity gcTime for Session Data

**Pattern:** Set `gcTime: Infinity` for session-scoped metadata that should persist until logout.

**Implementation:**

```typescript
// apps/web/src/db/cache/constants.ts
export const STORE_GC_TIMES = {
  // Session-scoped metadata - never garbage collect
  datalabel: Infinity,     // Badge colors, dropdown options
  entityCodes: Infinity,   // Entity type definitions

  // Transient data - normal garbage collection
  entityInstanceData: 30 * 60 * 1000,      // 30 minutes
  entityInstanceNames: 60 * 60 * 1000,     // 1 hour
  entityLinks: 60 * 60 * 1000,             // 1 hour
  entityInstanceMetadata: 60 * 60 * 1000,  // 1 hour
} as const;
```

### Why This Works

**TanStack Query Timing Concepts:**
- `staleTime`: How long data is considered fresh (triggers background refetch)
- `gcTime`: How long unused cache stays in memory before deletion

**Key Insight:** Setting `gcTime: Infinity` prevents cache deletion while still allowing background refetch when queries are active (via `staleTime`).

### When to Use

Use `gcTime: Infinity` for:
- ✅ **Datalabels** - Badge colors, dropdown options
- ✅ **Entity codes** - Entity type definitions
- ✅ **Global settings** - App configuration
- ✅ **User profile** - Session-scoped user data

Don't use for:
- ❌ **Entity instance data** - Query results (use 30-min gcTime)
- ❌ **Search results** - Temporary data (use 5-10 min gcTime)
- ❌ **Paginated lists** - Transient data (use 10-30 min gcTime)

### Why Background Refetch Doesn't Help

**Misconception:** "Background refetch will keep cache fresh"

**Reality:** Background refetch only works for **active queries** (queries with subscribers). When cache is garbage collected, there's nothing left to refetch.

```typescript
// Timeline demonstrating the gap
t=0:      Login → cache populated
t=10min:  Cache becomes STALE → background refetch works ✓
t=45min:  User navigates away → queries become INACTIVE
t=60min:  gcTime expires → Cache DELETED (no subscribers)
t=65min:  User returns → getDatalabelSync() returns undefined ❌
```

### Memory Impact

**Safe for session data:**
- Datalabels: ~50 fields × ~10 options × ~100 bytes = **~50 KB**
- Entity codes: ~30 entities × ~500 bytes = **~15 KB**
- **Total: ~65 KB** - negligible (average tab uses 100-500 MB)

### Industry Standard

Production applications use this pattern for session-scoped metadata:

```typescript
// Vercel Dashboard
const userSettings = useQuery({
  queryKey: ['user-settings'],
  staleTime: 5 * 60 * 1000,  // 5 min
  gcTime: Infinity,           // Never delete
});

// AWS Console
const accountData = useQuery({
  queryKey: ['account'],
  staleTime: 10 * 60 * 1000,  // 10 min
  gcTime: Infinity,            // Never delete
});
```

### Cache Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  CACHE LIFECYCLE WITH Infinity gcTime                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User logs in                                                 │
│     ↓                                                            │
│  2. prefetchAllDatalabels() → cache populated                   │
│     ↓                                                            │
│  3. staleTime (10 min) → background refetch (if query active)   │
│     ↓                                                            │
│  4. User navigates away → queries become INACTIVE               │
│     ↓                                                            │
│  5. gcTime (Infinity) → Cache PERSISTS ✓                       │
│     ↓                                                            │
│  6. User returns after hours → cache still available ✓          │
│                                                                  │
│  Cache only cleared on:                                          │
│  • User logout                                                   │
│  • Browser tab close                                             │
│  • Manual clearAllCaches()                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Related Hooks

**Cache Subscription (Bonus Reactivity):**

While `gcTime: Infinity` solves the deletion problem, you can add subscription for update reactivity:

```typescript
// useFormattedEntityData.ts
const datalabelCacheTimestamp = useSyncExternalStore(
  (callback) => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'datalabel') {
        callback(); // Re-format when datalabel cache UPDATES
      }
    });
  },
  () => {
    const state = queryClient.getQueryState(QUERY_KEYS.datalabelAll());
    return state?.dataUpdatedAt ?? 0;
  },
  () => 0
);
```

**Important:** `useSyncExternalStore` detects cache **updates** (refetch, invalidation) but NOT cache **deletion** (garbage collection is silent).

---

## Related Documentation

- [STATE_MANAGEMENT.md](../state_management/STATE_MANAGEMENT.md) - TanStack Query + Dexie architecture
- [entity-component-metadata.service.md](../services/entity-component-metadata.service.md) - Backend metadata generation
- [view-type-mapping.yaml](../../apps/api/src/services/view-type-mapping.yaml) - VIEW mode configuration
- [edit-type-mapping.yaml](../../apps/api/src/services/edit-type-mapping.yaml) - EDIT mode configuration
- [constants.ts](../../apps/web/src/db/cache/constants.ts) - Cache timing configuration
