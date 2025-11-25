# Backend Formatter Service

**Version:** 10.0.0
**Location:** `apps/api/src/services/backend-formatter.service.ts`

---

## Purpose

The Backend Formatter Service generates component-aware field metadata from database column names. It serves as the **single source of truth** for all field rendering and editing behavior in the PMO platform.

**Core principle:** Backend decides HOW every field is displayed and edited. Frontend executes these instructions without pattern detection.

---

## Dataflow Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           METADATA GENERATION PIPELINE                        │
│                                                                               │
│   DATABASE COLUMN NAME (e.g., "budget_allocated_amt")                        │
│            │                                                                  │
│            ▼                                                                  │
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │  STEP 1: pattern-mapping.yaml                                          │ │
│   │  ────────────────────────────                                          │ │
│   │  Pattern Match: "*_amt" → fieldBusinessType: "currency"                │ │
│   └────────────────────────────────────────────────────────────────────────┘ │
│            │                                                                  │
│            ▼                                                                  │
│   fieldBusinessType = "currency"                                             │
│            │                                                                  │
│   ┌────────┴────────────────────────────────┐                                │
│   │                                         │                                │
│   ▼                                         ▼                                │
│   ┌───────────────────────────┐   ┌───────────────────────────┐             │
│   │  STEP 2a: view-type-      │   │  STEP 2b: edit-type-      │             │
│   │  mapping.yaml             │   │  mapping.yaml             │             │
│   │  ─────────────────────    │   │  ─────────────────────    │             │
│   │  How to DISPLAY           │   │  How to EDIT              │             │
│   │                           │   │                           │             │
│   │  Output:                  │   │  Output:                  │             │
│   │  • renderType             │   │  • inputType              │             │
│   │  • component (if custom)  │   │  • component (if custom)  │             │
│   │  • behavior               │   │  • behavior               │             │
│   │  • style                  │   │  • style                  │             │
│   │                           │   │  • validation             │             │
│   │                           │   │  • lookupSource           │             │
│   │                           │   │  • lookupEntity           │             │
│   │                           │   │  • datalabelKey           │             │
│   └───────────────────────────┘   └───────────────────────────┘             │
│            │                                │                                │
│            └────────────────┬───────────────┘                                │
│                             ▼                                                │
│   ┌────────────────────────────────────────────────────────────────────────┐ │
│   │  STEP 3: API Response                                                  │ │
│   │  ────────────────────                                                  │ │
│   │  metadata.entityDataTable.viewType.budget_allocated_amt                │ │
│   │  metadata.entityDataTable.editType.budget_allocated_amt                │ │
│   └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## File Reference

| File | Purpose | Version |
|------|---------|---------|
| `pattern-mapping.yaml` | Column name → fieldBusinessType | 2.1.0 |
| `view-type-mapping.yaml` | fieldBusinessType → VIEW config | 4.0.0 |
| `edit-type-mapping.yaml` | fieldBusinessType → EDIT config | 3.3.0 |
| `backend-formatter.service.ts` | Processing logic | 10.0.0 |

---

# Component Architecture

## Two Levels of Components

The system uses two distinct levels of components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPONENT HIERARCHY                                 │
│                                                                              │
│  PAGE-LEVEL COMPONENTS (Container Keys in YAML)                             │
│  ══════════════════════════════════════════════                             │
│  Define WHERE metadata applies - which UI container/page uses the config    │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ entityDataTable │  │entityFormContainer│ │   kanbanView    │             │
│  │   (tables)      │  │  (detail pages)  │  │  (kanban board) │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                                ▼                                            │
│  FIELD-LEVEL COMPONENTS (React Components)                                  │
│  ═════════════════════════════════════════                                  │
│  Define HOW a field renders - which React component displays the value      │
│                                                                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│  │ BadgeCell │ │EntitySelect│ │JsonEditor │ │  Toggle   │ │EntityLookup│   │
│  │           │ │           │ │           │ │           │ │   Cell    │    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Page-Level Components

**Location in YAML:** Top-level keys under `fieldBusinessTypes.<type>`

**Purpose:** Define which UI container/page the configuration applies to. Each page-level component can have different visibility, behavior, and styling for the same field.

| Page-Level Key | React Component | Purpose | Used For |
|----------------|-----------------|---------|----------|
| `entityDataTable` | `EntityDataTable.tsx` | Main entity list tables | `/project`, `/task`, `/employee` |
| `entityFormContainer` | `EntityFormContainer.tsx` | Detail page views & forms | `/project/:id`, `/task/:id` |
| `kanbanView` | `KanbanView.tsx` | Kanban board cards | Kanban view of entities |
| `gridView` | `GridView.tsx` | Grid/card layout | Card-based entity views |
| `calendarView` | `CalendarView.tsx` | Calendar event display | Calendar views |
| `dagView` | `DAGVisualizer.tsx` | Workflow DAG nodes | Stage/status workflows |

**YAML Structure:**

```yaml
fieldBusinessTypes:
  currency:
    dtype: float

    # Page-level component 1: Table configuration
    entityDataTable:
      renderType: currency
      behavior: { visible: true, sortable: true, filterable: true }
      style: { width: "140px", align: right, symbol: "$" }

    # Page-level component 2: Detail/form configuration
    entityFormContainer:
      renderType: currency
      behavior: { visible: true }
      style: { symbol: "$", decimals: 2 }

    # Page-level component 3: Kanban card configuration
    kanbanView:
      renderType: currency
      behavior: { visible: false }  # Hide currency on kanban cards
```

## Field-Level Components

**Location in YAML:** The `component` property within a page-level component config

**Purpose:** Specify which React component renders the field value. Only used when `renderType: component` (view) or `inputType: component|select` (edit).

### View Mode (renderTypes - inline rendering)

All view rendering is done INLINE by `formatDataset()`. No separate cell components are used.

| renderType | Purpose | Used For Fields |
|------------|---------|-----------------|
| `text` | Plain text display | Default, `name`, `code` |
| `number` | Numeric display | `sort_order`, `quantity` |
| `currency` | Currency with symbol | `*_amt`, `*_price` |
| `percentage` | Percentage display | `*_pct` |
| `date` | Date display | `*_date` |
| `timestamp` | DateTime display | `*_ts` |
| `boolean` | Yes/No display | `is_*`, `*_flag` |
| `badge` | Colored status badge | `dl__*` (datalabel fields) |
| `entityLink` | Clickable entity reference | `*__*_id`, `*_id` |
| `entityLinks` | Multiple entity references | `*__*_ids`, `*_ids` |
| `tags` | Tag/chip display | `tags`, `keywords` |
| `avatar` | Avatar image (circular) | `avatar_url` |
| `file` | File link/preview | `attachment`, `*_file` |
| `image` | Image thumbnail | `*_image` |
| `color` | Color swatch | `color`, `*_color` |
| `icon` | Icon display | `icon` |
| `json` | JSON preview | `metadata`, `*_data` |

### Edit Mode Components (inputType: component or select)

These are ACTUAL React components that exist in the codebase:

| Component | Purpose | Used For Fields | Location |
|-----------|---------|-----------------|----------|
| `DataLabelSelect` | Dropdown with colors | `dl__*` (datalabel fields) | `components/shared/ui/DataLabelSelect.tsx` |
| `EntitySelect` | Entity search dropdown | `*__*_id`, `*_id` | `components/shared/ui/EntitySelect.tsx` |
| `EntityMultiSelect` | Multi-entity selection | `*__*_ids`, `*_ids` | `components/shared/ui/EntityMultiSelect.tsx` |
| `EditableTags` | Tag entry input | `tags`, `keywords` | `components/shared/ui/EditableTags.tsx` |
| `DAGVisualizer` | Stage/state/status workflow | `dl__*_stage`, `dl__*_state`, `dl__*_status` | `components/workflow/DAGVisualizer.tsx` |

For other field types, native HTML5 inputs are used (text, number, date, checkbox, textarea, file, color).

### Detail View Rendering

Detail views use the same inline rendering as tables, EXCEPT for `datalabel_dag` fields which use the `DAGVisualizer` component:

| renderType | Purpose | Used For Fields |
|------------|---------|-----------------|
| `badge` | Simple datalabel | `dl__priority`, `dl__tier` (non-DAG) |
| `component` (DAGVisualizer) | Stage/state/status workflow | `dl__*_stage`, `dl__*_state`, `dl__*_status` |
| `entityLink` | Entity reference with details | `*__*_id`, `*_id` |
| `entityLinks` | Entity list with details | `*__*_ids`, `*_ids` |
| `json` | Expandable JSON tree | `metadata`, `*_data` |

## YAML Structure Examples

### View Type Mapping (view-type-mapping.yaml)

```yaml
fieldBusinessTypes:
  # Native type - inline rendering
  currency:
    dtype: float
    entityDataTable:                    # ← Page-level component
      renderType: currency              # ← Native type (inline rendering)
      style: { symbol: "$" }
    entityFormContainer:                # ← Different page-level component
      renderType: currency
      style: { decimals: 2 }

  # Badge type for datalabels - inline rendering
  datalabel:
    dtype: str
    entityDataTable:                    # ← Page-level component
      renderType: badge                 # ← Badge type (inline rendering)
      style: { colorFromData: true }
    entityFormContainer:                # ← Different page-level component
      renderType: badge
      style: { showHierarchy: true }
```

### Edit Type Mapping (edit-type-mapping.yaml)

```yaml
fieldBusinessTypes:
  # HTML5 native input - NO component field
  currency:
    dtype: float
    entityDataTable:                    # ← Page-level component
      inputType: number                 # ← HTML5 native input
      validation: { min: 0 }
    entityFormContainer:                # ← Different page-level component
      inputType: number
      style: { symbol: "$" }

  # Custom select - uses DataLabelSelect component
  datalabel:
    dtype: str
    lookupSource: datalabel
    entityDataTable:                    # ← Page-level component
      inputType: select
      component: DataLabelSelect        # ← Actual component (apps/web/src/components/shared/ui/DataLabelSelect.tsx)
    entityFormContainer:                # ← Different page-level component
      inputType: select
      component: DataLabelSelect
      style: { showColor: true }

  # Entity reference - uses EntitySelect component
  entityInstance_Id:
    dtype: uuid
    lookupSource: entityInstance
    entityDataTable:                    # ← Page-level component
      inputType: select
      component: EntitySelect           # ← Actual component (apps/web/src/components/shared/ui/EntitySelect.tsx)
    entityFormContainer:                # ← Different page-level component
      inputType: select
      component: EntitySelect
      style: { searchable: true }
```

## Component Rules Summary

| Scenario | renderType/inputType | component Field |
|----------|---------------------|-----------------|
| View: Native types | `text`, `currency`, `date`, `timestamp`, `boolean`, `percentage` | **NOT used** - inline rendering |
| View: Badge/status | `badge` | **NOT used** - inline rendering |
| View: Entity refs | `entityLink`, `entityLinks` | **NOT used** - inline rendering |
| View: Media | `file`, `image`, `avatar`, `color`, `icon` | **NOT used** - inline rendering |
| View: Structured | `tags`, `json` | **NOT used** - inline rendering |
| View: DAG (form only) | `component` | **REQUIRED**: `DAGVisualizer` |
| Edit: HTML5 inputs | `text`, `textarea`, `number`, `date`, `checkbox`, `email`, `file`, `color` | **NOT used** |
| Edit: Datalabel select | `select` | **REQUIRED**: `DataLabelSelect` |
| Edit: Datalabel DAG (form only) | `component` | **REQUIRED**: `DAGVisualizer` |
| Edit: Entity select | `select` | **REQUIRED**: `EntitySelect` or `EntityMultiSelect` |
| Edit: Tags | `select` | **REQUIRED**: `EditableTags` |

## API Response Mapping

The API response nests field-level metadata under page-level keys:

```json
{
  "metadata": {
    "entityDataTable": {           // ← Page-level component
      "viewType": {
        "dl__project_stage": {
          "type": "badge",         // ← renderType from YAML (inline rendering)
          "style": { "colorFromData": true }
        }
      },
      "editType": {
        "dl__project_stage": {
          "type": "select",        // ← inputType from YAML
          "component": "DataLabelSelect"  // ← Actual React component
        }
      }
    },
    "entityFormContainer": {       // ← Different page-level component
      "viewType": {
        "dl__project_stage": {
          "type": "badge",         // ← Same inline rendering
          "style": { "showHierarchy": true }
        }
      }
    }
  }
}
```

---

# YAML File: pattern-mapping.yaml

**Purpose:** Step 1 of the pipeline - maps database column names to semantic `fieldBusinessType` identifiers using pattern matching.

**Version:** 2.1.0

## Structure

```yaml
patterns:
  - { pattern: "<pattern>", exact: <boolean>, fieldBusinessType: "<type>" }
  # ... more patterns

defaultFieldBusinessType: text
```

## Pattern Matching

### Match Modes

| Mode | `exact` | Description | Example |
|------|---------|-------------|---------|
| **Exact** | `true` | Literal string match only | `pattern: "name"` matches `name` only |
| **Wildcard** | `false` | `*` matches any characters | `pattern: "*_amt"` matches `budget_amt`, `total_amt` |

### Wildcard Syntax

| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `*_amt` | `budget_amt`, `total_amt`, `discount_amt` | `amount` |
| `dl__*` | `dl__project_stage`, `dl__status` | `datalabel` |
| `*__*_id` | `manager__employee_id`, `sponsor__client_id` | `employee_id` |
| `*_id` | `office_id`, `project_id` | `id` |
| `is_*` | `is_active`, `is_published` | `active_flag` |

### Order Matters

**First matching pattern wins.** Organize patterns in this order:

1. Exact matches (`exact: true`) first
2. More specific wildcards (`created_ts` before `*_ts`)
3. Generic wildcards (`*_amt`, `*_date`)

```yaml
# CORRECT ORDER:
- { pattern: "created_ts", exact: true, fieldBusinessType: timestamp_readonly }  # Specific
- { pattern: "updated_ts", exact: true, fieldBusinessType: timestamp_readonly }  # Specific
- { pattern: "*_ts", exact: false, fieldBusinessType: timestamp }                 # Generic

# WRONG ORDER (generic first would match created_ts as 'timestamp' instead of 'timestamp_readonly'):
- { pattern: "*_ts", exact: false, fieldBusinessType: timestamp }
- { pattern: "created_ts", exact: true, fieldBusinessType: timestamp_readonly }
```

## Pattern Categories

### Identity & Core

```yaml
- { pattern: "id", exact: true, fieldBusinessType: uuid }
- { pattern: "code", exact: true, fieldBusinessType: code }
- { pattern: "name", exact: true, fieldBusinessType: name }
- { pattern: "descr", exact: true, fieldBusinessType: description }
- { pattern: "title", exact: true, fieldBusinessType: title }
- { pattern: "*_name", exact: false, fieldBusinessType: name }
```

### Contact

```yaml
- { pattern: "email", exact: true, fieldBusinessType: email }
- { pattern: "*_email", exact: false, fieldBusinessType: email }
- { pattern: "phone", exact: true, fieldBusinessType: phone }
- { pattern: "*_phone", exact: false, fieldBusinessType: phone }
- { pattern: "website", exact: true, fieldBusinessType: url }
- { pattern: "*_url", exact: false, fieldBusinessType: url }
```

### Currency (CAD)

```yaml
- { pattern: "*_amt", exact: false, fieldBusinessType: currency }
- { pattern: "*_amount", exact: false, fieldBusinessType: currency }
- { pattern: "*_price", exact: false, fieldBusinessType: currency }
- { pattern: "*_cost", exact: false, fieldBusinessType: currency }
- { pattern: "*_cents", exact: false, fieldBusinessType: currency_cents }
```

### Date & Time

```yaml
- { pattern: "*_date", exact: false, fieldBusinessType: date }
- { pattern: "created_ts", exact: true, fieldBusinessType: timestamp_readonly }
- { pattern: "updated_ts", exact: true, fieldBusinessType: timestamp_readonly }
- { pattern: "*_ts", exact: false, fieldBusinessType: timestamp }
- { pattern: "*_time", exact: false, fieldBusinessType: time }
```

### Boolean

```yaml
- { pattern: "active_flag", exact: true, fieldBusinessType: status_flag }
- { pattern: "*_flag", exact: false, fieldBusinessType: boolean }
- { pattern: "is_*", exact: false, fieldBusinessType: boolean }
```

### Datalabel (Settings Dropdowns)

```yaml
- { pattern: "dl__*", exact: false, fieldBusinessType: datalabel }
```

### Entity References

```yaml
# Prefixed references: manager__employee_id, sponsor__client_id
- { pattern: "*__*_id", exact: false, fieldBusinessType: entityInstance_Id }
- { pattern: "*__*_ids", exact: false, fieldBusinessType: entityInstance_Ids }

# Simple references: office_id, project_id
- { pattern: "*_id", exact: false, fieldBusinessType: entityInstance_Id }
- { pattern: "*_ids", exact: false, fieldBusinessType: entityInstance_Ids }
```

### Structured Data

```yaml
- { pattern: "metadata", exact: true, fieldBusinessType: json }
- { pattern: "*_metadata", exact: false, fieldBusinessType: json }
- { pattern: "tags", exact: true, fieldBusinessType: tags }
```

## fieldBusinessType Reference

| Category | Types |
|----------|-------|
| **Identity** | `uuid`, `code`, `name`, `title`, `description`, `summary`, `subject` |
| **Contact** | `email`, `phone`, `url`, `address`, `country`, `postal_code` |
| **Financial** | `currency`, `currency_cents`, `percentage` |
| **Temporal** | `date`, `timestamp`, `timestamp_readonly`, `time`, `duration`, `duration_hours`, `duration_minutes`, `duration_seconds`, `duration_ms` |
| **Boolean** | `boolean`, `status_flag` |
| **References** | `datalabel`, `entityInstance_Id`, `entityInstance_Ids` |
| **Numeric** | `quantity`, `count`, `number`, `sort_order`, `rating`, `score` |
| **Measurement** | `area_sqft`, `volume_m3`, `dimension_cm`, `weight_kg`, `file_size`, `latitude`, `longitude`, `geolocation`, `capacity` |
| **Content** | `text`, `text_long`, `rich_text` |
| **Structured** | `json`, `json_schema`, `tags` |
| **Media** | `file`, `image`, `avatar`, `signature`, `video`, `barcode`, `sku`, `upc`, `color`, `icon` |
| **Storage** | `s3_bucket`, `s3_key`, `s3_url`, `s3_region`, `hash`, `mime_type`, `file_extension` |
| **Status** | `status`, `state_workflow`, `stage`, `type`, `category` |
| **Security** | `username`, `password_hash`, `token`, `ip_address`, `user_agent`, `sensitive_id`, `tax_id` |
| **Reference Numbers** | `reference_number`, `invoice_number`, `order_number`, `po_number`, `tracking_number` |
| **UI** | `icon`, `label` |
| **System** | `version` |

---

# YAML File: view-type-mapping.yaml

**Purpose:** Step 2a of the pipeline - defines how each `fieldBusinessType` should be DISPLAYED in read-only view mode.

**Version:** 4.0.0

## Structure

```yaml
defaults:
  table: &table_default
    visible: true
    sortable: true
    filterable: true
    width: auto
    align: left

  form: &form_default
    visible: true
    editable: true

  hidden: &hidden
    visible: false
    sortable: false
    filterable: false

fieldBusinessTypes:
  <fieldBusinessType>:
    dtype: <data_type>            # REQUIRED - only root-level field
    inherit: <other_type>         # Optional - inherit from another type

    entityDataTable:              # Table view config
      renderType: <type>          # REQUIRED
      component: <ComponentName>  # ONLY when renderType is "component"
      behavior:
        visible: <bool>
        sortable: <bool>
        filterable: <bool>
        searchable: <bool>
      style:
        width: "<value>"
        align: left|center|right
        # ... style options

    entityFormContainer:          # Detail/form view config
    kanbanView:                   # Kanban card config
    gridView:                     # Grid card config
    calendarView:                 # Calendar event config
    dagView:                      # DAG workflow config
```

## renderType Rules

All VIEW rendering is done INLINE by `formatDataset()`. No separate cell components are used.

| Category | renderType Values | component Field |
|----------|-------------------|-----------------|
| **Native Types** | `text`, `number`, `currency`, `percentage`, `date`, `timestamp`, `time`, `duration`, `boolean`, `filesize` | **NOT used** |
| **Badge/Status** | `badge` | **NOT used** |
| **Entity References** | `entityLink`, `entityLinks` | **NOT used** |
| **Media/Files** | `file`, `image`, `avatar`, `color`, `icon` | **NOT used** |
| **Structured Data** | `tags`, `json` | **NOT used** |

### Correct Examples

```yaml
# Native type - no component
currency:
  entityDataTable:
    renderType: currency
    style: { symbol: "$", decimals: 2, align: right }

# Badge type for datalabels - no component
datalabel:
  entityDataTable:
    renderType: badge
    style: { colorFromData: true }

# Entity link - no component
entityInstance_Id:
  entityDataTable:
    renderType: entityLink
    style: { displayField: name, linkToEntity: true }
```

## dtype Values

| dtype | Description | Example Fields |
|-------|-------------|----------------|
| `str` | String/text | `name`, `code`, `email` |
| `int` | Integer | `sort_order`, `version`, `count` |
| `float` | Decimal | `budget_amt`, `percentage` |
| `bool` | Boolean | `active_flag`, `is_published` |
| `uuid` | UUID identifier | `id`, `*_id` |
| `date` | Date (YYYY-MM-DD) | `start_date`, `due_date` |
| `timestamp` | DateTime | `created_ts`, `from_ts` |
| `jsonb` | JSON object | `metadata`, `settings` |
| `array[str]` | String array | `tags`, `keywords` |
| `array[uuid]` | UUID array | `employee_ids`, `*_ids` |

## behavior Properties

| Property | Applies To | Description |
|----------|------------|-------------|
| `visible` | All components | Show/hide the field |
| `sortable` | Tables only | Enable column sorting |
| `filterable` | Tables only | Show in filter panel |
| `searchable` | Tables only | Include in text search |

## style Properties

| Property | Type | Description |
|----------|------|-------------|
| `width` | `string` | Column width: `"80px"`, `"140px"`, `"auto"` |
| `align` | `string` | Text alignment: `left`, `center`, `right` |
| `symbol` | `string` | Currency symbol: `"$"`, `"€"` |
| `decimals` | `number` | Decimal places: `0`, `2` |
| `locale` | `string` | Formatting locale: `"en-CA"` |
| `format` | `string` | Date format: `short`, `medium`, `relative` |
| `truncate` | `number` | Max characters before truncation |
| `monospace` | `bool` | Use monospace font |
| `bold` | `bool` | Bold text |
| `linkable` | `bool` | Render as clickable link |
| `linkToDetail` | `bool` | Link to entity detail page |
| `colorFromData` | `bool` | Badge color from datalabel data |
| `showFlag` | `bool` | Show country flag |
| `compact` | `bool` | Compact display mode |
| `unit` | `string` | Unit suffix: `"minutes"`, `"kg"` |
| `trueLabel` | `string` | Boolean true text |
| `falseLabel` | `string` | Boolean false text |
| `trueColor` | `string` | Boolean true color |
| `falseColor` | `string` | Boolean false color |

## UI Components (Page-Level Containers)

| Key | React Component | Purpose |
|-----|-----------------|---------|
| `entityDataTable` | `EntityDataTable.tsx` | Main entity list tables |
| `entityFormContainer` | `EntityFormContainer.tsx` | Detail/form views |
| `kanbanView` | `KanbanView.tsx` | Kanban board cards |
| `gridView` | `GridView.tsx` | Grid/card layout |
| `calendarView` | `CalendarView.tsx` | Calendar events |
| `dagView` | `DAGVisualizer.tsx` | Workflow DAG |

## Common Patterns

```yaml
# Text with search and link to detail
name:
  dtype: str
  entityDataTable:
    <<: *table_default
    renderType: text
    behavior: { visible: true, sortable: true, filterable: true, searchable: true }
    style: { width: "250px", bold: true, linkToDetail: true }
  entityFormContainer:
    <<: *form_default
    renderType: text
    style: { size: lg }

# Currency with locale
currency:
  dtype: float
  entityDataTable:
    <<: *table_default
    renderType: currency
    style: { align: right, width: "140px", symbol: "$", decimals: 2, locale: en-CA }
  entityFormContainer:
    <<: *form_default
    renderType: currency
    style: { symbol: "$", decimals: 2 }

# Datalabel badge with color
datalabel:
  dtype: str
  entityDataTable:
    <<: *table_default
    renderType: component
    component: BadgeCell
    style: { width: "140px", colorFromData: true }
  entityFormContainer:
    <<: *form_default
    renderType: component
    component: DatalabelDAG
    style: { showHierarchy: true }

# Readonly system timestamp
timestamp_readonly:
  dtype: timestamp
  entityDataTable:
    <<: *table_default
    renderType: timestamp
    behavior: { visible: true, sortable: true, filterable: false }
    style: { width: "140px", format: relative }
  entityFormContainer:
    <<: *form_default
    renderType: timestamp
    style: { showAbsolute: true, format: relative }

# Hidden field
version:
  dtype: int
  entityDataTable: *hidden
  entityFormContainer:
    <<: *form_default
    renderType: number
    behavior: { editable: false }

# Inheritance
title:
  dtype: str
  inherit: name    # Gets all of name's configuration
```

---

# YAML File: edit-type-mapping.yaml

**Purpose:** Step 2b of the pipeline - defines how each `fieldBusinessType` should be EDITED with input controls.

**Version:** 3.3.0

## Structure

```yaml
fieldBusinessTypes:
  <fieldBusinessType>:
    dtype: <data_type>            # REQUIRED - only root-level field
    lookupSource: <source>        # For select fields: "datalabel" or "entityInstance"
    inherit: <other_type>         # Optional - inherit from another type

    entityDataTable:              # Inline table editing
      inputType: <type>           # REQUIRED
      component: <ComponentName>  # ONLY when inputType is "component" or "select"
      behavior:
        editable: <bool>
        filterable: <bool>
        sortable: <bool>
        visible: <bool>
      style:
        # ... style options
      validation:
        required: <bool>
        min: <number>
        max: <number>
        pattern: "<regex>"

    entityFormContainer:          # Form editing
    kanbanView:                   # Kanban card editing
    calendarView:                 # Calendar event editing
    dagView:                      # DAG node editing

formFieldTypeMapping:             # Maps FormBuilder types to fieldBusinessTypes
  text: text
  textarea: notes
  # ...
```

## inputType Rules

For EDIT mode, component field is only used for select dropdowns that need custom components.

| Category | inputType Values | component Field |
|----------|------------------|-----------------|
| **HTML5 Native** | `text`, `textarea`, `email`, `tel`, `url`, `number`, `date`, `time`, `datetime-local`, `checkbox`, `color`, `file`, `range`, `hidden`, `readonly` | **NOT used** |
| **Select with DataLabelSelect** | `select` (for `dl__*` fields) | **REQUIRED**: `DataLabelSelect` |
| **Select with EntitySelect** | `select` (for `*_id` fields) | **REQUIRED**: `EntitySelect` |
| **Select with EntityMultiSelect** | `select` (for `*_ids` fields) | **REQUIRED**: `EntityMultiSelect` |
| **Tags with EditableTags** | `select` (for `tags` fields) | **REQUIRED**: `EditableTags` |

### Correct Examples

```yaml
# HTML5 native input - no component
currency:
  entityDataTable:
    inputType: number
    behavior: { editable: true, filterable: true }
    style: { step: 0.01 }
    validation: { min: 0 }

# Datalabel select - uses DataLabelSelect
datalabel:
  entityDataTable:
    inputType: select
    component: DataLabelSelect
    behavior: { editable: true, filterable: true }

# Entity select - uses EntitySelect
entityInstance_Id:
  entityDataTable:
    inputType: select
    component: EntitySelect
    behavior: { editable: true, filterable: true }
```

## lookupSource Property

For dropdown/select fields, `lookupSource` indicates where to fetch options:

| lookupSource | Description | Auto-Set Property |
|--------------|-------------|-------------------|
| `datalabel` | Load from datalabel settings table | `datalabelKey` (set to field name) |
| `entityInstance` | Load from entity instance lookup | `lookupEntity` (detected from field name) |

```yaml
datalabel:
  dtype: str
  lookupSource: datalabel         # Options from datalabel table
  entityDataTable:
    inputType: select
    component: DatalabelSelect
    # datalabelKey auto-set to field name (e.g., "dl__project_stage")

entityInstance_Id:
  dtype: uuid
  lookupSource: entityInstance    # Options from entity lookup
  entityDataTable:
    inputType: select
    component: EntitySelect
    # lookupEntity auto-detected from field name (e.g., "office_id" → "office")
```

## behavior Properties

| Property | Applies To | Description |
|----------|------------|-------------|
| `editable` | All components | Allow field editing |
| `filterable` | Tables only | Show in filter panel |
| `sortable` | Tables only | Enable column sorting |
| `visible` | Tables only | Show column by default |

## style Properties

| Property | Type | Description |
|----------|------|-------------|
| `step` | `number` | Number input step increment |
| `symbol` | `string` | Currency symbol |
| `decimals` | `number` | Decimal places |
| `size` | `string` | Input size: `sm`, `md`, `lg` |
| `rows` | `number` | Textarea row count |
| `resizable` | `bool` | Allow textarea resize |
| `placeholder` | `string` | Input placeholder text |
| `autocomplete` | `string` | HTML autocomplete attribute |
| `mask` | `string` | Input mask pattern |
| `showColor` | `bool` | Show color in select |
| `searchable` | `bool` | Enable search in select |
| `clearable` | `bool` | Allow clearing value |
| `displayField` | `string` | Field to display for lookups |
| `maxSelections` | `number` | Max items for multi-select |
| `accept` | `string` | File types for upload |
| `maxSize` | `number` | Max file size in bytes |
| `preview` | `bool` | Show file preview |

## validation Properties

| Property | Type | Description |
|----------|------|-------------|
| `required` | `bool` | Field is required |
| `min` | `number` | Minimum value (numbers) |
| `max` | `number` | Maximum value (numbers) |
| `minLength` | `number` | Minimum string length |
| `maxLength` | `number` | Maximum string length |
| `pattern` | `string` | Regex pattern for validation |

## Common Patterns

```yaml
# Text input with validation
name:
  dtype: str
  entityDataTable:
    inputType: text
    behavior: { editable: true, filterable: true, sortable: true, visible: true }
    validation: { maxLength: 255 }
  entityFormContainer:
    inputType: text
    behavior: { editable: true }
    validation: { required: true, minLength: 1, maxLength: 255 }
    style: { size: lg }

# Number input with min
currency:
  dtype: float
  entityDataTable:
    inputType: number
    behavior: { editable: true, filterable: true, sortable: true, visible: true }
    validation: { min: 0 }
  entityFormContainer:
    inputType: number
    behavior: { editable: true }
    style: { symbol: "$", decimals: 2, locale: en-CA }
    validation: { min: 0 }

# Datalabel select
datalabel:
  dtype: str
  lookupSource: datalabel
  entityDataTable:
    inputType: select
    component: DatalabelSelect
    behavior: { editable: true, filterable: true, sortable: true, visible: true }
  entityFormContainer:
    inputType: select
    component: DatalabelSelect
    behavior: { editable: true }
    style: { showColor: true, searchable: true }

# Entity reference select
entityInstance_Id:
  dtype: uuid
  lookupSource: entityInstance
  entityDataTable:
    inputType: select
    component: EntitySelect
    behavior: { editable: true, filterable: true, sortable: true, visible: true }
  entityFormContainer:
    inputType: select
    component: EntitySelect
    behavior: { editable: true }
    style: { searchable: true, clearable: true, displayField: name }

# Readonly field
timestamp_readonly:
  dtype: timestamp
  entityDataTable:
    inputType: readonly
    behavior: { editable: false, filterable: false, sortable: true, visible: true }
  entityFormContainer:
    inputType: readonly
    behavior: { editable: false }
```

## FormBuilder Type Mapping

The `formFieldTypeMapping` section maps FormBuilder field types to `fieldBusinessType`:

```yaml
formFieldTypeMapping:
  text: text
  textarea: notes
  number: quantity
  email: email
  phone: phone
  url: url
  address: address
  select: datalabel
  select_multiple: entityInstance_Ids
  radio: datalabel
  checkbox: boolean
  taskcheck: boolean
  datetime: timestamp
  date: date
  time: time
  duration: duration
  file: file
  image_capture: image
  video_capture: video
  signature: signature
  range: percentage
  currency: currency
  percentage: percentage
  rating: rating
  geolocation: geolocation
  qr_scanner: barcode
  barcode_scanner: barcode
```

---

# Service Logic (backend-formatter.service.ts)

## Processing Flow

```typescript
// 1. Load YAML files (cached on first load)
const patternMapping = loadPatternMapping();      // pattern-mapping.yaml
const viewTypeMapping = loadViewTypeMapping();    // view-type-mapping.yaml
const editTypeMapping = loadEditTypeMapping();    // edit-type-mapping.yaml

// 2. Determine fieldBusinessType from column name
function getFieldBusinessType(fieldName: string): string {
  for (const entry of patternMapping.patterns) {
    if (matchYamlPattern(fieldName, entry.pattern, entry.exact)) {
      return entry.fieldBusinessType;
    }
  }
  return patternMapping.defaultFieldBusinessType;  // "text"
}

// 3. Get VIEW metadata from view-type-mapping.yaml
function getViewMetadataFromYaml(fieldBusinessType, component): ViewMetadata

// 4. Get EDIT metadata from edit-type-mapping.yaml
function getEditMetadataFromYaml(fieldBusinessType, component): EditMetadata

// 5. Generate complete entity response
function generateEntityResponse(entityCode, data, options): EntityResponse
```

## Priority Order

The service checks configurations in this order:

1. **Explicit Config** - `entity-field-config.ts` (highest priority)
2. **YAML Mappings** - pattern-mapping → view/edit-type-mapping
3. **Legacy Pattern Rules** - Hardcoded `PATTERN_RULES` object (fallback)
4. **Default** - Plain text field (lowest priority)

## Auto-Detection Features

### Entity Reference Detection

For `*_id` and `*_ids` fields, the service auto-detects the entity:

```typescript
// Pattern: *__entity_id → entity
// "manager__employee_id" → lookupEntity: "employee"

// Pattern: entity_id → entity
// "office_id" → lookupEntity: "office"

// Pattern: entity_ids → entity
// "project_ids" → lookupEntity: "project"
```

### Datalabel Key Detection

For `dl__*` fields, `datalabelKey` is set to the field name:

```typescript
// "dl__project_stage" → datalabelKey: "dl__project_stage"
```

### Label Generation

Labels are auto-generated from field names:

```typescript
// "budget_allocated_amt" → "Budget Allocated"
// "manager__employee_id" → "Manager Employee Name"
// "dl__project_stage" → "Project Stage"
// "office_id" → "Office Name"
```

---

# API Output Structure

## Response Format (v10.0.0)

**Endpoint:** `GET /api/v1/project?limit=1`

```json
{
  "data": [
    {
      "id": "50192aab-000a-17c5-6904-1065b04a0a0b",
      "code": "CSE-2024-001",
      "name": "Customer Service Excellence Initiative",
      "descr": "Comprehensive program to enhance customer satisfaction...",
      "metadata": {
        "priority": "high",
        "complexity": "medium",
        "risk_level": "low",
        "project_type": "service_improvement",
        "customer_facing": true
      },
      "dl__project_stage": "Execution",
      "budget_allocated_amt": 200000,
      "budget_spent_amt": 80000,
      "planned_start_date": "2024-08-01T00:00:00.000Z",
      "planned_end_date": "2024-12-15T00:00:00.000Z",
      "actual_start_date": "2024-08-05T00:00:00.000Z",
      "actual_end_date": "",
      "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "sponsor__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
      "stakeholder__employee_ids": ["8260b1b0-5efc-4611-ad33-ee76c0cf7f13"],
      "from_ts": "2025-11-25T03:37:51.658Z",
      "to_ts": "",
      "active_flag": true,
      "created_ts": "2025-11-25T03:37:51.658Z",
      "updated_ts": "2025-11-25T03:37:51.658Z",
      "version": 1,
      "_ID": {
        "manager": {
          "entity_code": "employee",
          "manager__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
          "manager": "James Miller"
        },
        "sponsor": {
          "entity_code": "employee",
          "sponsor__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
          "sponsor": "James Miller"
        }
      },
      "_IDS": {
        "stakeholder": [
          {
            "entity_code": "employee",
            "stakeholder__employee_id": "8260b1b0-5efc-4611-ad33-ee76c0cf7f13",
            "stakeholder": "James Miller"
          }
        ]
      }
    }
  ],
  "fields": [
    "id", "code", "name", "descr", "metadata", "dl__project_stage",
    "budget_allocated_amt", "budget_spent_amt", "planned_start_date",
    "planned_end_date", "actual_start_date", "actual_end_date",
    "manager__employee_id", "sponsor__employee_id", "stakeholder__employee_ids",
    "active_flag", "from_ts", "to_ts", "created_ts", "updated_ts", "version",
    "_ID", "_IDS"
  ],
  "metadata": {
    "entityDataTable": {
      "viewType": {
        "id": {
          "dtype": "uuid",
          "label": "Id",
          "type": "text",
          "behavior": { "visible": false, "sortable": false, "filterable": false, "searchable": false },
          "style": {}
        },
        "code": {
          "dtype": "str",
          "label": "Code",
          "type": "text",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "140px", "align": "left", "monospace": true }
        },
        "name": {
          "dtype": "str",
          "label": "Name",
          "type": "text",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": true },
          "style": { "width": "250px", "align": "left", "bold": true, "linkToDetail": true }
        },
        "descr": {
          "dtype": "str",
          "label": "Description",
          "type": "text",
          "behavior": { "visible": false, "sortable": false, "filterable": false, "searchable": false },
          "style": { "truncate": 100 }
        },
        "metadata": {
          "dtype": "jsonb",
          "label": "Metadata",
          "type": "component",
          "component": "JsonPreviewCell",
          "behavior": { "visible": false, "sortable": false, "filterable": false, "searchable": false },
          "style": {}
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "type": "component",
          "component": "BadgeCell",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "140px", "align": "left", "colorFromData": true }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "type": "currency",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2, "locale": "en-CA" }
        },
        "budget_spent_amt": {
          "dtype": "float",
          "label": "Budget Spent",
          "type": "currency",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2, "locale": "en-CA" }
        },
        "planned_start_date": {
          "dtype": "date",
          "label": "Planned Start",
          "type": "date",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "120px", "align": "left", "format": "short", "locale": "en-CA" }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "type": "component",
          "component": "EntityLookupCell",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "150px", "align": "left", "displayField": "name", "linkToEntity": true }
        },
        "active_flag": {
          "dtype": "bool",
          "label": "Active",
          "type": "boolean",
          "behavior": { "visible": true, "sortable": true, "filterable": true, "searchable": false },
          "style": { "width": "100px", "align": "center", "trueLabel": "Active", "falseLabel": "Inactive", "trueColor": "green", "falseColor": "red" }
        },
        "created_ts": {
          "dtype": "timestamp",
          "label": "Created",
          "type": "timestamp",
          "behavior": { "visible": true, "sortable": true, "filterable": false, "searchable": false },
          "style": { "width": "140px", "align": "left", "format": "relative" }
        },
        "version": {
          "dtype": "int",
          "label": "Version",
          "type": "version",
          "behavior": { "visible": false, "sortable": false, "filterable": false, "searchable": false },
          "style": {}
        }
      },
      "editType": {
        "id": {
          "dtype": "uuid",
          "label": "Id",
          "type": "readonly",
          "behavior": { "editable": false },
          "style": {},
          "validation": {}
        },
        "code": {
          "dtype": "str",
          "label": "Code",
          "type": "text",
          "behavior": { "editable": true },
          "style": {},
          "validation": { "pattern": "^[A-Za-z0-9-_]+$" }
        },
        "name": {
          "dtype": "str",
          "label": "Name",
          "type": "text",
          "behavior": { "editable": true },
          "style": {},
          "validation": { "maxLength": 255 }
        },
        "descr": {
          "dtype": "str",
          "label": "Description",
          "type": "textarea",
          "behavior": { "editable": true },
          "style": {},
          "validation": {}
        },
        "metadata": {
          "dtype": "jsonb",
          "label": "Metadata",
          "type": "component",
          "component": "JsonEditor",
          "behavior": { "editable": true },
          "style": {},
          "validation": {}
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "type": "select",
          "component": "DatalabelSelect",
          "behavior": { "editable": true },
          "style": {},
          "validation": {},
          "lookupSource": "datalabel",
          "datalabelKey": "dl__project_stage"
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "type": "number",
          "behavior": { "editable": true },
          "style": {},
          "validation": { "min": 0 }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "type": "select",
          "component": "EntitySelect",
          "behavior": { "editable": true },
          "style": {},
          "validation": {},
          "lookupSource": "entityInstance",
          "lookupEntity": "employee"
        },
        "stakeholder__employee_ids": {
          "dtype": "array[uuid]",
          "label": "Stakeholder Employee Ids",
          "type": "select",
          "component": "EntityMultiSelect",
          "behavior": { "editable": true },
          "style": {},
          "validation": {},
          "lookupSource": "entityInstance",
          "lookupEntity": "employee"
        },
        "active_flag": {
          "dtype": "bool",
          "label": "Active",
          "type": "component",
          "component": "Toggle",
          "behavior": { "editable": true },
          "style": {},
          "validation": {}
        },
        "created_ts": {
          "dtype": "timestamp",
          "label": "Created",
          "type": "readonly",
          "behavior": { "editable": false },
          "style": {},
          "validation": {}
        },
        "version": {
          "dtype": "int",
          "label": "Version",
          "type": "readonly",
          "behavior": { "editable": false },
          "style": {},
          "validation": {}
        }
      }
    },
    "entityFormContainer": {
      "viewType": {
        "name": {
          "dtype": "str",
          "label": "Name",
          "type": "text",
          "behavior": { "visible": true, "sortable": false, "filterable": false, "searchable": false },
          "style": { "size": "lg" }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "type": "component",
          "component": "DatalabelDAG",
          "behavior": { "visible": true, "sortable": false, "filterable": false, "searchable": false },
          "style": { "showHierarchy": true }
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "type": "currency",
          "behavior": { "visible": true, "sortable": false, "filterable": false, "searchable": false },
          "style": { "symbol": "$", "decimals": 2 }
        },
        "manager__employee_id": {
          "dtype": "uuid",
          "label": "Manager Employee Name",
          "type": "component",
          "component": "EntityLookupField",
          "behavior": { "visible": true, "sortable": false, "filterable": false, "searchable": false },
          "style": { "displayField": "name" }
        }
      },
      "editType": {
        "name": {
          "dtype": "str",
          "label": "Name",
          "type": "text",
          "behavior": { "editable": true },
          "style": { "size": "lg" },
          "validation": { "required": true, "minLength": 1, "maxLength": 255 }
        },
        "dl__project_stage": {
          "dtype": "str",
          "label": "Project Stage",
          "type": "select",
          "component": "DatalabelSelect",
          "behavior": { "editable": true },
          "style": { "showColor": true, "searchable": true },
          "validation": {},
          "lookupSource": "datalabel",
          "datalabelKey": "dl__project_stage"
        },
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "type": "number",
          "behavior": { "editable": true },
          "style": { "symbol": "$", "decimals": 2, "locale": "en-CA" },
          "validation": { "min": 0 }
        }
      }
    }
  },
  "total": 5,
  "limit": 1,
  "offset": 0
}
```

## Field Metadata Summary

| Field | viewType.type | editType.type | Component (edit only) |
|-------|---------------|---------------|----------------------|
| `id` | `text` | `readonly` | — |
| `code` | `text` | `text` | — |
| `name` | `text` | `text` | — |
| `descr` | `text` | `textarea` | — |
| `metadata` | `json` | `textarea` | — |
| `dl__project_stage` | `badge` | `select` | `DataLabelSelect` |
| `budget_allocated_amt` | `currency` | `number` | — |
| `manager__employee_id` | `entityLink` | `select` | `EntitySelect` |
| `stakeholder__employee_ids` | `entityLinks` | `select` | `EntityMultiSelect` |
| `active_flag` | `boolean` | `checkbox` | — |
| `created_ts` | `timestamp` | `readonly` | — |
| `version` | `number` | `readonly` | — |

## Key Observations

1. **`type` field in JSON** = `renderType` (view) or `inputType` (edit) from YAML
2. **VIEW rendering** is all INLINE (no `component` field for view) - uses `badge`, `entityLink`, `entityLinks`, etc.
3. **`component` field** only present for EDIT mode when `type: "select"` (uses `DataLabelSelect`, `EntitySelect`, `EntityMultiSelect`, `EditableTags`)
4. **`_ID` / `_IDS` objects** provide resolved entity names for reference fields
5. **`lookupSource`** indicates where dropdown options come from (`datalabel` or `entityInstance`)
6. **`datalabelKey`** / **`lookupEntity`** specify which datalabel or entity to query

---

# Usage Examples

## Route Handler Integration

```typescript
import { generateEntityResponse } from '@/services/backend-formatter.service.js';

fastify.get('/api/v1/project', async (request, reply) => {
  const { limit = 20, offset = 0 } = request.query;

  // Query database
  const projects = await db.execute(sql`
    SELECT * FROM app.project
    WHERE active_flag = true
    ORDER BY created_ts DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  // Generate response with metadata
  const response = generateEntityResponse('project', projects, {
    components: ['entityDataTable', 'entityFormContainer', 'kanbanView'],
    total,
    limit,
    offset
  });

  return reply.send(response);
});
```

## Extract Datalabel Keys

```typescript
import { generateMetadataForComponents, extractDatalabelKeys } from '@/services/backend-formatter.service.js';

// Generate metadata
const metadata = generateMetadataForComponents(fieldNames, ['entityDataTable'], 'project');

// Extract datalabel keys for prefetching
const datalabelKeys = extractDatalabelKeys(metadata);
// Returns: ["dl__project_stage", "dl__project_priority"]
```

---

# Pattern Detection Reference

| Column Name | Matched Pattern | fieldBusinessType | viewType.type | editType.type |
|-------------|-----------------|-------------------|---------------|---------------|
| `id` | exact: `id` | `uuid` | `text` | `readonly` |
| `name` | exact: `name` | `name` | `text` | `text` |
| `budget_allocated_amt` | wildcard: `*_amt` | `currency` | `currency` | `number` |
| `dl__project_stage` | wildcard: `dl__*_stage` | `datalabel_dag` | `badge` / `component` (form) | `select` / `component` (form) |
| `dl__task_state` | wildcard: `dl__*_state` | `datalabel_dag` | `badge` / `component` (form) | `select` / `component` (form) |
| `dl__approval_status` | wildcard: `dl__*_status` | `datalabel_dag` | `badge` / `component` (form) | `select` / `component` (form) |
| `dl__priority` | wildcard: `dl__*` | `datalabel` | `badge` | `select` |
| `manager__employee_id` | wildcard: `*__*_id` | `entityInstance_Id` | `entityLink` | `select` |
| `office_id` | wildcard: `*_id` | `entityInstance_Id` | `entityLink` | `select` |
| `employee_ids` | wildcard: `*_ids` | `entityInstance_Ids` | `entityLinks` | `select` |
| `start_date` | wildcard: `*_date` | `date` | `date` | `date` |
| `created_ts` | exact: `created_ts` | `timestamp_readonly` | `timestamp` | `readonly` |
| `is_active` | wildcard: `is_*` | `boolean` | `boolean` | `checkbox` |
| `active_flag` | exact: `active_flag` | `status_flag` | `boolean` | `checkbox` |
| `metadata` | exact: `metadata` | `json` | `json` | `textarea` |
| `tags` | exact: `tags` | `tags` | `tags` | `select` |
| `completion_pct` | wildcard: `*_pct` | `percentage` | `percentage` | `number` |

**Note:** `datalabel_dag` fields use `DAGVisualizer` component in `entityFormContainer` for both view and edit modes.

---

# Global Settings

The service exposes global formatting defaults:

```typescript
export const GLOBAL_SETTINGS: GlobalSettings = {
  currency: {
    symbol: '$',
    decimals: 2,
    locale: 'en-CA',
    position: 'prefix',
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  date: {
    style: 'short',
    locale: 'en-US',
    format: 'MM/DD/YYYY'
  },
  timestamp: {
    style: 'relative',         // "5 minutes ago"
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

# Design Principles

1. **Zero Frontend Configuration** - Add a database column, backend automatically generates metadata
2. **Single Source of Truth** - Backend YAML files control ALL rendering decisions
3. **Component-Aware** - Different UI components can show/hide fields independently
4. **Type/Component Separation** - Native types (browser renders) vs custom types (React components)
5. **View/Edit Separation** - Clear separation between display and input concerns
6. **Convention over Configuration** - Naming patterns drive behavior

---

# Anti-Patterns

| Anti-Pattern | Correct Approach |
|--------------|------------------|
| Frontend pattern detection | Use backend metadata exclusively |
| Hardcoded field configs in frontend | Add patterns to YAML files |
| Manual dropdown options | Use `lookupSource: datalabel` or `entityInstance` |
| Visibility logic in frontend | Use `metadata.*.viewType.*.behavior.visible` |
| Native type with component | Use `renderType/inputType: "component"` for custom rendering |
| Duplicate configurations | Use YAML `inherit:` for similar field types |

---

**Last Updated:** 2025-11-25
**Status:** Production Ready
