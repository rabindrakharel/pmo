# Backend Formatter Service

**Version:** 10.1.0
**Location:** `apps/api/src/services/backend-formatter.service.ts`

---

## Purpose

The Backend Formatter Service generates component-aware field metadata from database column names. It serves as the **single source of truth** for all field rendering and editing behavior in the PMO platform.

**Core principle:** Backend decides HOW every field is displayed and edited. Frontend executes these instructions without pattern detection.

---

## Quick Reference

| File | Purpose | Step |
|------|---------|------|
| `pattern-mapping.yaml` | Column name → fieldBusinessType | Step 1 |
| `view-type-mapping.yaml` | fieldBusinessType → VIEW config | Step 2a |
| `edit-type-mapping.yaml` | fieldBusinessType → EDIT config | Step 2b |
| `backend-formatter.service.ts` | Processing logic | Orchestrator |

---

# Section 1: Decision Flow Architecture

## 1.1 Streamlined Dataflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    METADATA GENERATION PIPELINE                              │
│                                                                              │
│   INPUT: Database Column Name                                                │
│   ════════════════════════════                                               │
│   "budget_allocated_amt"                                                     │
│            │                                                                 │
│            ▼                                                                 │
│   ┌────────────────────────────────────────────────────────────────┐        │
│   │  STEP 1: pattern-mapping.yaml                                  │        │
│   │  ──────────────────────────────                                │        │
│   │  Question: "What BUSINESS TYPE is this field?"                 │        │
│   │                                                                │        │
│   │  Process:                                                      │        │
│   │    1. Check explicit config (entity-field-config.ts)          │        │
│   │    2. Match against patterns (first match wins)               │        │
│   │    3. Fall back to "text" if no match                         │        │
│   │                                                                │        │
│   │  Match: "*_amt" → currency                                    │        │
│   └────────────────────────────────────────────────────────────────┘        │
│            │                                                                 │
│            ▼                                                                 │
│   fieldBusinessType = "currency"                                             │
│            │                                                                 │
│   ┌────────┴────────────────────────────────┐                               │
│   │                                         │                               │
│   ▼                                         ▼                               │
│   ┌─────────────────────────┐   ┌─────────────────────────┐                 │
│   │  STEP 2a: view-type-    │   │  STEP 2b: edit-type-    │                 │
│   │  mapping.yaml           │   │  mapping.yaml           │                 │
│   │  ───────────────────    │   │  ───────────────────    │                 │
│   │  Question: "How to      │   │  Question: "How to      │                 │
│   │  DISPLAY this field?"   │   │  EDIT this field?"      │                 │
│   │                         │   │                         │                 │
│   │  Output per component:  │   │  Output per component:  │                 │
│   │  • renderType           │   │  • inputType            │                 │
│   │  • component (optional) │   │  • component (optional) │                 │
│   │  • behavior             │   │  • behavior             │                 │
│   │  • style                │   │  • style                │                 │
│   │                         │   │  • validation           │                 │
│   │                         │   │  • lookupSource         │                 │
│   └─────────────────────────┘   └─────────────────────────┘                 │
│            │                                │                               │
│            └────────────────┬───────────────┘                               │
│                             ▼                                               │
│   ┌────────────────────────────────────────────────────────────────┐        │
│   │  STEP 3: Generate API Response                                 │        │
│   │  ──────────────────────────────                                │        │
│   │  Combine into metadata.{component}.viewType/editType           │        │
│   └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│   OUTPUT: Component-Specific Metadata                                        │
│   ═══════════════════════════════════                                        │
│   metadata.entityDataTable.viewType.budget_allocated_amt                     │
│   metadata.entityDataTable.editType.budget_allocated_amt                     │
│   metadata.entityFormContainer.viewType.budget_allocated_amt                 │
│   metadata.entityFormContainer.editType.budget_allocated_amt                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1.2 Decision Priority Order

The service checks configurations in this order (first match wins):

```
1. Explicit Config    → entity-field-config.ts     (highest priority)
2. YAML Mappings      → pattern → view/edit YAML   (preferred method)
3. Legacy Pattern     → PATTERN_RULES object       (fallback)
4. Default            → Plain text field           (lowest priority)
```

## 1.3 Example Decision Flow

**Input Column:** `manager__employee_id`

| Step | Source | Question | Answer |
|------|--------|----------|--------|
| 1 | pattern-mapping.yaml | Pattern match? | `*__*_id` → `entityInstance_Id` |
| 2a | view-type-mapping.yaml | How to display? | `renderType: entityLink` |
| 2b | edit-type-mapping.yaml | How to edit? | `inputType: select`, `component: EntitySelect` |
| 3 | Auto-detection | Which entity? | `employee` (from field name) |

**Output:** Field renders as clickable link, edits via searchable dropdown.

---

# Section 2: YAML Files - Format & Standards

## 2.1 pattern-mapping.yaml

### Purpose
Maps column names to semantic fieldBusinessType identifiers using pattern matching.

### Structure

```yaml
# Pattern list - ORDER MATTERS (first match wins)
patterns:
  # Exact matches (most specific)
  - { pattern: "created_ts", exact: true, fieldBusinessType: timestamp_readonly }
  - { pattern: "name", exact: true, fieldBusinessType: name }

  # Wildcard matches (specific patterns first)
  - { pattern: "dl__*_stage", exact: false, fieldBusinessType: datalabel_dag }
  - { pattern: "dl__*", exact: false, fieldBusinessType: datalabel }

  # Generic patterns (least specific)
  - { pattern: "*_amt", exact: false, fieldBusinessType: currency }
  - { pattern: "*_id", exact: false, fieldBusinessType: entityInstance_Id }

# Fallback for unmatched columns
defaultFieldBusinessType: text
```

### Pattern Matching Rules

| Mode | `exact` | Wildcard | Example Pattern | Matches | Does NOT Match |
|------|---------|----------|-----------------|---------|----------------|
| Exact | `true` | No | `name` | `name` | `first_name` |
| Prefix | `false` | Start | `dl__*` | `dl__project_stage` | `datalabel` |
| Suffix | `false` | End | `*_amt` | `budget_amt` | `amount` |
| Double | `false` | Both | `*__*_id` | `manager__employee_id` | `employee_id` |

### Guidelines for pattern-mapping.yaml

1. **Order by specificity**: Exact matches → specific wildcards → generic wildcards
2. **Group by domain**: Contact fields, currency fields, date fields, etc.
3. **Use semantic names**: `currency` not `money_field`, `datalabel` not `dropdown`
4. **Avoid conflicts**: Test new patterns don't accidentally match existing columns

### Adding a New Pattern

```yaml
# Adding support for discount fields
# Place in CURRENCY section, before generic *_amt pattern

# WRONG - too late in order, *_amt already matched it
- { pattern: "*_amt", exact: false, fieldBusinessType: currency }
- { pattern: "*_discount", exact: false, fieldBusinessType: discount }  # Never reached!

# CORRECT - specific pattern before generic
- { pattern: "*_discount", exact: false, fieldBusinessType: discount }
- { pattern: "*_amt", exact: false, fieldBusinessType: currency }
```

---

## 2.2 view-type-mapping.yaml

### Purpose
Defines how each fieldBusinessType is DISPLAYED (read-only view) across UI components.

### Structure

```yaml
# Reusable defaults (YAML anchors)
defaults:
  table: &table_default
    visible: true
    sortable: true
    filterable: true
    searchable: false
    width: auto
    align: left

  form: &form_default
    visible: true
    editable: true

  hidden: &hidden
    visible: false
    sortable: false
    filterable: false

# Field business type definitions
fieldBusinessTypes:
  currency:
    dtype: float                    # REQUIRED: data type (root level only)

    entityDataTable:                # Page-level component
      <<: *table_default            # Inherit defaults
      renderType: currency          # How to render
      style:                        # Visual options
        width: "140px"
        align: right
        symbol: "$"
        decimals: 2
        locale: en-CA

    entityFormContainer:            # Different page component
      <<: *form_default
      renderType: currency
      style:
        symbol: "$"
        decimals: 2

    kanbanView:
      renderType: currency
      behavior: { visible: true }
      style: { compact: true }
```

### Root-Level vs Component-Level Fields

**CRITICAL:** Only `dtype` and `inherit` belong at root level!

```yaml
# CORRECT
currency:
  dtype: float                      # Root level - data type
  inherit: number                   # Root level - inheritance (optional)
  entityDataTable:                  # Component level - all config here
    renderType: currency
    style: { symbol: "$" }

# WRONG - renderType and style don't belong at root
currency:
  dtype: float
  renderType: currency              # ERROR! Not root-level
  style: { symbol: "$" }            # ERROR! Not root-level
  entityDataTable: { ... }
```

### renderType Reference (View Mode)

All view rendering is done INLINE by `formatDataset()`. No separate cell components.

| Category | renderType | Display | Example Fields |
|----------|------------|---------|----------------|
| **Text** | `text` | Plain text | `name`, `code` |
| **Numbers** | `number` | Formatted number | `sort_order`, `quantity` |
| **Numbers** | `currency` | $50,000.00 | `*_amt`, `*_price` |
| **Numbers** | `percentage` | 75% | `*_pct` |
| **Dates** | `date` | Nov 25, 2025 | `*_date` |
| **Dates** | `timestamp` | 5 minutes ago | `*_ts` |
| **Dates** | `time` | 2:30 PM | `*_time` |
| **Dates** | `duration` | 2h 30m | `duration_*` |
| **Boolean** | `boolean` | Yes/No badge | `is_*`, `*_flag` |
| **Status** | `badge` | Colored badge | `dl__*` |
| **References** | `entityLink` | Clickable name | `*_id` |
| **References** | `entityLinks` | Multiple links | `*_ids` |
| **Arrays** | `tags` | Tag chips | `tags` |
| **Media** | `file` | File link | `attachment` |
| **Media** | `image` | Thumbnail | `*_image` |
| **Media** | `avatar` | Circular image | `avatar_url` |
| **Media** | `color` | Color swatch | `*_color` |
| **Media** | `icon` | Icon display | `icon` |
| **Data** | `json` | Collapsible JSON | `metadata` |
| **Data** | `filesize` | 2.5 MB | `*_bytes` |

### Guidelines for view-type-mapping.yaml

1. **Use YAML anchors** for common defaults (`<<: *table_default`)
2. **renderType is required** for each component
3. **No component field** for native types (inline rendering)
4. **style contains formatting** - not just visual but also format options

---

## 2.3 edit-type-mapping.yaml

### Purpose
Defines how each fieldBusinessType is EDITED (input controls) across UI components.

### Structure

```yaml
fieldBusinessTypes:
  currency:
    dtype: float                    # REQUIRED: data type

    entityDataTable:
      inputType: number             # HTML5 input type
      behavior:                     # Interaction settings
        editable: true
        filterable: true
        sortable: true
        visible: true
      style:                        # Input styling
        step: 0.01
      validation:                   # Validation rules
        min: 0

    entityFormContainer:
      inputType: number
      behavior:
        editable: true
      style:
        symbol: "$"
        decimals: 2
        locale: en-CA
      validation:
        min: 0

  # Datalabel - uses custom component
  datalabel:
    dtype: str
    lookupSource: datalabel         # Where to fetch options

    entityDataTable:
      inputType: select             # Custom select
      component: DataLabelSelect    # React component name
      behavior:
        editable: true
        filterable: true
        sortable: true
        visible: true

    entityFormContainer:
      inputType: select
      component: DataLabelSelect
      behavior:
        editable: true
      style:
        showColor: true
        searchable: true
```

### inputType Rules

**CRITICAL:** HTML5 inputType = NO component field!

| Category | inputType | component | Use Case |
|----------|-----------|-----------|----------|
| **HTML5 Native** | `text` | — | Text input |
| **HTML5 Native** | `number` | — | Numeric input |
| **HTML5 Native** | `email` | — | Email with validation |
| **HTML5 Native** | `tel` | — | Phone number |
| **HTML5 Native** | `url` | — | URL with validation |
| **HTML5 Native** | `date` | — | Date picker |
| **HTML5 Native** | `time` | — | Time picker |
| **HTML5 Native** | `datetime-local` | — | DateTime picker |
| **HTML5 Native** | `checkbox` | — | Boolean toggle |
| **HTML5 Native** | `color` | — | Color picker |
| **HTML5 Native** | `file` | — | File upload |
| **HTML5 Native** | `range` | — | Slider |
| **HTML5 Native** | `textarea` | — | Multi-line text |
| **Special** | `readonly` | — | Display only |
| **Special** | `hidden` | — | Not rendered |
| **Custom** | `select` | REQUIRED | Dropdown (DataLabelSelect, EntitySelect) |
| **Custom** | `component` | REQUIRED | Custom React component |

### lookupSource Property

For dropdown fields, indicates where to fetch options:

| lookupSource | Description | Auto-Set |
|--------------|-------------|----------|
| `datalabel` | Load from settings table | `datalabelKey` = field name |
| `entityInstance` | Load from entity lookup | `lookupEntity` = detected from field name |

### Guidelines for edit-type-mapping.yaml

1. **HTML5 inputType = no component**: Browser renders natively
2. **Custom rendering = inputType: select or component**: Must specify component name
3. **validation can apply to ANY component**: Not just forms
4. **lookupSource for dropdowns**: Auto-populates lookup keys

---

# Section 3: Three Categories - behavior, style, validation

## 3.1 behavior - Interaction Settings

Controls HOW users interact with the field.

### entityDataTable behavior

| Property | Type | Description |
|----------|------|-------------|
| `visible` | bool | Column shown by default |
| `sortable` | bool | Can sort by this column |
| `filterable` | bool | Appears in filter panel |
| `searchable` | bool | Included in text search |
| `editable` | bool | Can edit inline |

### entityFormContainer behavior

| Property | Type | Description |
|----------|------|-------------|
| `visible` | bool | Field shown in form |
| `editable` | bool | Field is editable |

### Other components (kanbanView, gridView, etc.)

| Property | Type | Description |
|----------|------|-------------|
| `visible` | bool | Field shown on card/item |
| `editable` | bool | Can edit in this view |

## 3.2 style - Visual Presentation & Formatting

Controls HOW the field looks AND how values are formatted.

### Common style Properties

| Property | Type | Example | Used For |
|----------|------|---------|----------|
| `width` | string | `"140px"`, `"auto"` | Column width |
| `align` | string | `left`, `center`, `right` | Text alignment |
| `bold` | bool | `true` | Bold text |
| `monospace` | bool | `true` | Code-like font |
| `truncate` | number | `80` | Max chars before ... |

### Format-Specific style Properties

| Property | Type | Example | Used For |
|----------|------|---------|----------|
| `symbol` | string | `"$"`, `"€"` | Currency symbol |
| `decimals` | number | `2` | Decimal places |
| `locale` | string | `"en-CA"` | Number/date locale |
| `format` | string | `"short"`, `"relative"` | Date/time format |
| `unit` | string | `"minutes"`, `"kg"` | Unit suffix |
| `colorFromData` | bool | `true` | Badge color from datalabel |
| `linkToDetail` | bool | `true` | Name links to detail page |
| `linkToEntity` | bool | `true` | Reference links to entity |
| `displayField` | string | `"name"` | Which field to show for lookups |

### Edit-Specific style Properties

| Property | Type | Example | Used For |
|----------|------|---------|----------|
| `step` | number | `0.01` | Number input increment |
| `rows` | number | `4` | Textarea rows |
| `resizable` | bool | `true` | Allow textarea resize |
| `placeholder` | string | `"Enter..."` | Placeholder text |
| `mask` | string | `"(###) ###-####"` | Input mask |
| `searchable` | bool | `true` | Search in dropdown |
| `clearable` | bool | `true` | Can clear value |
| `maxSelections` | number | `5` | Multi-select limit |
| `accept` | string | `"image/*"` | File types |
| `maxSize` | number | `5242880` | Max file size (bytes) |
| `preview` | bool | `true` | Show file preview |

## 3.3 validation - Input Constraints

Controls WHAT values are acceptable. Only in edit-type-mapping.yaml.

| Property | Type | Example | Description |
|----------|------|---------|-------------|
| `required` | bool | `true` | Must have value |
| `min` | number | `0` | Minimum value |
| `max` | number | `100` | Maximum value |
| `minLength` | number | `1` | Min string length |
| `maxLength` | number | `255` | Max string length |
| `pattern` | string | `"^[A-Z]+"` | Regex pattern |

---

# Section 4: Page-Level & Field-Level Components

## 4.1 Page-Level Components (Containers)

These are React components that orchestrate multiple fields. They're the KEYS in YAML files.

| Key | React Component | Location | Purpose |
|-----|-----------------|----------|---------|
| `entityDataTable` | `EntityDataTable.tsx` | Entity list pages | Sortable/filterable table |
| `entityFormContainer` | `EntityFormContainer.tsx` | Detail pages | Notion-style property list |
| `kanbanView` | `KanbanView.tsx` | Kanban mode | Draggable cards by status |
| `gridView` | `GridView.tsx` | Grid mode | Responsive card grid |
| `calendarView` | `CalendarView.tsx` | Calendar mode | Monthly/weekly calendar |
| `dagView` | `DAGVisualizer.tsx` | Workflow view | Connected DAG nodes |
| `hierarchyGraphView` | `HierarchyGraphView.tsx` | Hierarchy view | Organization/tree graphs |

### Page-Level Component Routes

```
entityDataTable      → /project, /task, /employee (list views)
entityFormContainer  → /project/:id, /task/:id (detail views)
kanbanView           → /project?view=kanban
gridView             → /project?view=grid
calendarView         → /event?view=calendar
dagView              → Workflow visualization
hierarchyGraphView   → Organization charts, entity hierarchies
```

## 4.2 Field-Level Components (Input/Display)

These are actual React components that render specific field types.

### View Mode - Inline Rendering

All view rendering is done INLINE by `formatDataset()`. No separate cell components needed.

```typescript
// formatDataset() returns:
{
  raw: { budget_allocated_amt: 50000 },
  display: { budget_allocated_amt: "$50,000.00" },  // Pre-formatted string
  styles: { budget_allocated_amt: "text-right font-mono" }  // CSS classes
}
```

### Edit Mode - Input Components

| Component | Location | inputType | Used For |
|-----------|----------|-----------|----------|
| `DataLabelSelect` | `components/shared/ui/` | `select` | `dl__*` datalabel dropdowns |
| `EntitySelect` | `components/shared/ui/` | `select` | `*_id` entity references |
| `EntityMultiSelect` | `components/shared/ui/` | `select` | `*_ids` multi-entity |
| `EditableTags` | `components/shared/ui/` | `select` | `tags` field |
| `DAGVisualizer` | `components/workflow/` | `component` | `dl__*_stage` workflows |
| `DebouncedInput` | `components/shared/ui/` | `text`, `number` | Generic inputs |
| `DebouncedTextarea` | `components/shared/ui/` | `textarea` | Multi-line text |
| `ColoredDropdown` | `components/shared/ui/` | `select` | Colored options |

---

# Section 5: Service Code Structure

## 5.1 File Organization

```
apps/api/src/services/
├── backend-formatter.service.ts    # Main service (1985 lines)
├── pattern-mapping.yaml            # Step 1: Column → fieldBusinessType
├── view-type-mapping.yaml          # Step 2a: VIEW config
└── edit-type-mapping.yaml          # Step 2b: EDIT config

apps/api/src/config/
└── entity-field-config.ts          # Explicit field overrides
```

## 5.2 Code Structure Overview

```typescript
// ============================================================================
// TYPE DEFINITIONS (Lines 100-286)
// ============================================================================
type ComponentName = 'entityDataTable' | 'entityFormContainer' | 'kanbanView' |
                     'calendarView' | 'gridView' | 'dagView' | 'hierarchyGraphView'
interface ViewMetadata { renderType, component?, behavior, style }
interface EditMetadata { inputType, component?, behavior, style, validation, lookupSource? }
interface FieldMetadataBase { dtype, label, view, edit }
interface EntityMetadata { entityDataTable?, entityFormContainer?, kanbanView?, ... }
interface EntityResponse { data, fields, metadata, total, limit, offset }

// ============================================================================
// GLOBAL SETTINGS (Lines 291-318)
// ============================================================================
export const GLOBAL_SETTINGS = {
  currency: { symbol: '$', decimals: 2, locale: 'en-CA', ... },
  date: { style: 'short', locale: 'en-US', ... },
  timestamp: { style: 'relative', ... },
  boolean: { trueLabel: 'Yes', falseLabel: 'No', ... }
}

// ============================================================================
// YAML MAPPING LOADER (Lines 320-436)
// ============================================================================
function loadPatternMapping(): PatternMappingYaml        // Cached on first load
function loadViewTypeMapping(): ViewTypeMappingYaml      // Cached on first load
function loadEditTypeMapping(): EditTypeMappingYaml      // Cached on first load
function matchYamlPattern(fieldName, pattern, exact): boolean
function getFieldBusinessType(fieldName): string

// ============================================================================
// YAML METADATA EXTRACTORS (Lines 438-616)
// ============================================================================
function resolveInheritance(businessType, mapping): Record<string, any>
function deepMerge(target, source): any
function getViewMetadataFromYaml(fieldBusinessType, component): ViewMetadata
function getEditMetadataFromYaml(fieldBusinessType, component): EditMetadata

// ============================================================================
// LEGACY PATTERN RULES (Lines 618-1504) - Fallback
// ============================================================================
const PATTERN_RULES: Record<string, PatternRule> = {
  'id': { entityDataTable: {...}, entityFormContainer: {...} },
  'name': { ... },
  '*_amt': { ... },
  'dl__*': { ... },
  // ... 30+ patterns
}

// ============================================================================
// UTILITY FUNCTIONS (Lines 1506-1629)
// ============================================================================
function matchPattern(fieldName, pattern): boolean
function findMatchingRule(fieldName): PatternRule | null
function generateLabel(fieldName): string               // Auto-generate labels
function detectEntityFromFieldName(fieldName): string   // Auto-detect entity
const COMPONENT_INHERITANCE: Record<ComponentName, ComponentName | null>

// ============================================================================
// METADATA GENERATION (Lines 1634-1927)
// ============================================================================
function convertExplicitConfigToMetadata(config, component, fieldName): FieldMetadataBase
function generateFieldMetadataForComponent(fieldName, component, entityCode?): FieldMetadataBase
export function generateMetadataForComponents(fieldNames, components, entityCode?): EntityMetadata

// ============================================================================
// PUBLIC API (Lines 1929-1985)
// ============================================================================
export function extractDatalabelKeys(metadata): string[]
export function generateEntityResponse(entityCode, data, options): EntityResponse
```

## 5.3 Key Functions

### generateEntityResponse() - Main Entry Point

```typescript
// Usage in route handlers
import { generateEntityResponse } from '@/services/backend-formatter.service.js';

const response = generateEntityResponse('project', projects, {
  components: ['entityDataTable', 'entityFormContainer'],
  total: 100,
  limit: 20,
  offset: 0
});
return reply.send(response);
```

### generateFieldMetadataForComponent() - Per-Field Logic

```typescript
// Priority order:
// 1. Explicit config (entity-field-config.ts)
// 2. YAML mappings
// 3. Legacy PATTERN_RULES
// 4. Default text field
```

---

# Section 6: Sample API Response

## 6.1 Complete Response Structure

**Endpoint:** `GET /api/v1/project?limit=1`

```json
{
  "data": [
    {
      "id": "50192aab-000a-17c5-6904-1065b04a0a0b",
      "code": "CSE-2024-001",
      "name": "Customer Service Excellence Initiative",
      "descr": "Comprehensive program to enhance customer satisfaction...",
      "dl__project_stage": "Execution",
      "budget_allocated_amt": 200000,
      "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "active_flag": true,
      "created_ts": "2025-11-25T03:37:51.658Z",
      "_ID": {
        "manager": {
          "entity_code": "employee",
          "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
          "manager": "James Miller"
        }
      }
    }
  ],
  "fields": [
    "id", "code", "name", "descr", "dl__project_stage",
    "budget_allocated_amt", "manager__employee_id", "active_flag",
    "created_ts", "_ID"
  ],
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "name": {
          "dtype": "str",
          "label": "Name",
          "renderType": "text",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": true },
          "style": { "width": "250px", "bold": true, "linkToDetail": true }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "renderType": "badge",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "140px", "colorFromData": true }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2, "locale": "en-CA" }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "renderType": "entityLink",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "150px", "displayField": "name", "linkToEntity": true }
        }
      },
      "editType": {
        "name": {
          "dtype": "str",
          "label": "Name",
          "inputType": "text",
          "behavior": { "editable": true },
          "style": {},
          "validation": { "maxLength": 255 }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "inputType": "select",
          "component": "DataLabelSelect",
          "behavior": { "editable": true },
          "style": {},
          "validation": {},
          "lookupSource": "datalabel",
          "datalabelKey": "dl__project_stage"
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "style": {},
          "validation": { "min": 0 }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "inputType": "select",
          "component": "EntitySelect",
          "behavior": { "editable": true },
          "style": {},
          "validation": {},
          "lookupSource": "entityInstance",
          "lookupEntity": "employee"
        }
      }
    },
    "entityFormContainer": {
      "viewType": { /* ... */ },
      "editType": { /* ... */ }
    }
  },
  "total": 5,
  "limit": 1,
  "offset": 0
}
```

## 6.2 Response Key Points

| Key | Description |
|-----|-------------|
| `data` | Raw database records (unformatted) |
| `fields` | List of field names in data |
| `metadata.{component}.viewType` | How to DISPLAY each field |
| `metadata.{component}.editType` | How to EDIT each field |
| `renderType` | How to render in view mode (in viewType container) |
| `inputType` | Input control type in edit mode (in editType container) |
| `component` | React component (only for select/component inputTypes) |
| `lookupSource` | Where to fetch dropdown options |
| `datalabelKey` | Specific datalabel to query |
| `lookupEntity` | Entity type for EntitySelect |
| `_ID` | Resolved entity names for reference fields |

---

# Section 7: How to Add a New Column Type

## 7.1 Step-by-Step Process

### Step 1: Add Pattern (pattern-mapping.yaml)

```yaml
# Add to appropriate section based on domain
# Example: Adding support for "priority_score" fields

# Find the correct location (RATING & SCORE section)
patterns:
  # ... existing patterns ...

  # ADD HERE - specific pattern before generic
  - { pattern: "*_priority_score", exact: false, fieldBusinessType: priority_score }

  # ... more patterns ...
```

### Step 2: Add View Config (view-type-mapping.yaml)

```yaml
fieldBusinessTypes:
  # ... existing types ...

  priority_score:
    dtype: int

    entityDataTable:
      <<: *table_default
      renderType: number
      style:
        width: "100px"
        align: center
        suffix: "/10"

    entityFormContainer:
      <<: *form_default
      renderType: number
      style:
        max: 10
        suffix: "/10"

    kanbanView:
      renderType: number
      behavior: { visible: true }
```

### Step 3: Add Edit Config (edit-type-mapping.yaml)

```yaml
fieldBusinessTypes:
  # ... existing types ...

  priority_score:
    dtype: int

    entityDataTable:
      inputType: number
      behavior: { editable: true, filterable: true, sortable: true, visible: true }
      style: { step: 1 }
      validation: { min: 1, max: 10 }

    entityFormContainer:
      inputType: range
      behavior: { editable: true }
      style: { min: 1, max: 10, step: 1, showValue: true }
      validation: { min: 1, max: 10 }
```

### Step 4: Test

```bash
# Verify pattern matching
./tools/test-api.sh GET /api/v1/task?limit=1

# Check metadata includes your new field with correct config
```

## 7.2 Checklist for New Columns

- [ ] Pattern added to `pattern-mapping.yaml` in correct order
- [ ] fieldBusinessType name is semantic (describes business meaning)
- [ ] View config added to `view-type-mapping.yaml`
- [ ] Edit config added to `edit-type-mapping.yaml`
- [ ] dtype is correct (str, int, float, bool, uuid, date, timestamp, jsonb, array[])
- [ ] Each page component has appropriate config (entityDataTable, entityFormContainer, kanbanView)
- [ ] behavior settings appropriate for each component
- [ ] style settings include formatting options
- [ ] validation rules make sense for the data type
- [ ] Tested with actual API call

---

# Section 8: Design Principles

## 8.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Zero Frontend Config** | Add column, backend auto-generates metadata |
| **Single Source of Truth** | Backend YAML controls ALL rendering |
| **Component-Aware** | Different UI components can show/hide fields independently |
| **Convention over Config** | Naming patterns drive behavior automatically |
| **View/Edit Separation** | Clear separation between display and input |

## 8.2 Anti-Patterns to Avoid

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Frontend pattern detection | Use backend metadata exclusively |
| Hardcoded field configs in frontend | Add patterns to YAML files |
| Manual dropdown options | Use `lookupSource: datalabel` or `entityInstance` |
| Visibility logic in frontend | Use `behavior.visible` from metadata |
| HTML5 inputType with component | Use `inputType: select/component` for custom UI |
| Duplicate configurations | Use YAML `inherit:` for similar field types |
| Root-level renderType/style | Put all config INSIDE component sections |

---

# Section 9: Auto-Detection Features

## 9.1 Entity Reference Detection

For `*_id` and `*_ids` fields, the service auto-detects the referenced entity:

| Field Pattern | Detected Entity | Example |
|---------------|-----------------|---------|
| `manager__employee_id` | `employee` | EntitySelect with employee options |
| `sponsor__client_id` | `client` | EntitySelect with client options |
| `office_id` | `office` | EntitySelect with office options |
| `project_ids` | `project` | EntityMultiSelect with project options |

## 9.2 Datalabel Key Detection

For `dl__*` fields, `datalabelKey` is auto-set to the field name:

| Field | datalabelKey |
|-------|--------------|
| `dl__project_stage` | `dl__project_stage` |
| `dl__task_priority` | `dl__task_priority` |

## 9.3 Label Generation

Labels are auto-generated from field names:

| Field Name | Generated Label |
|------------|-----------------|
| `budget_allocated_amt` | Budget Allocated |
| `manager__employee_id` | Manager Employee Name |
| `dl__project_stage` | Project Stage |
| `office_id` | Office Name |

---

# Section 10: Global Settings

```typescript
export const GLOBAL_SETTINGS = {
  currency: {
    symbol: '$',
    decimals: 2,
    locale: 'en-CA',
    position: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  date: {
    style: 'short',      // Nov 25, 2025
    locale: 'en-US',
    format: 'MM/DD/YYYY'
  },
  timestamp: {
    style: 'relative',   // "5 minutes ago"
    locale: 'en-US',
    includeSeconds: false
  },
  boolean: {
    trueLabel: 'Yes',
    falseLabel: 'No',
    trueColor: 'green',
    falseColor: 'gray',
    trueIcon: 'check',
    falseIcon: 'x'
  }
};
```

---

**Last Updated:** 2025-11-25
**Status:** Production Ready

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 10.1.0 | 2025-11-25 | Documented frontend property naming alignment (`lookupSource`, `lookupEntity`) |
| 10.0.0 | 2025-11-25 | Complete YAML-based metadata generation with component-aware configs |
