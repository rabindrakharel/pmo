# Field Renderer Architecture - Future State

> Version: 12.2.0 | Status: Implementation In Progress

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
│  3. useQuery with `select` (FORMAT-AT-READ)                                      │
│     ┌─────────────────────────────────────────────────────────────────────────┐ │
│     │ useQuery({                                                               │ │
│     │   queryKey: ['entity', 'project', id],                                  │ │
│     │   select: (response) => ({                                              │ │
│     │     ...response,                                                         │ │
│     │     formattedData: formatDataset(response.data, response.metadata)      │ │
│     │   })                                                                     │ │
│     │ })                                                                       │ │
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

## Related Documentation

- [STATE_MANAGEMENT.md](../state_management/STATE_MANAGEMENT.md) - TanStack Query + Dexie architecture
- [entity-component-metadata.service.md](../services/entity-component-metadata.service.md) - Backend metadata generation
- [view-type-mapping.yaml](../../apps/api/src/services/view-type-mapping.yaml) - VIEW mode configuration
- [edit-type-mapping.yaml](../../apps/api/src/services/edit-type-mapping.yaml) - EDIT mode configuration
