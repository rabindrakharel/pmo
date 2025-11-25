# YAML Schema Standardization Plan

## Goal
Standardize the YAML mapping files by:
1. Keep `dtype` as-is (matches API response format)
2. Adding `renderType` to view-type-mapping.yaml
3. Adding `lookupSource` to edit-type-mapping.yaml (replaces `loadFromDataLabels`/`loadFromEntity`)

---

## view-type-mapping.yaml Description

Each fieldBusinessType entry defines how a field is **displayed** across different UI contexts.

**Required fields:**
- `dtype`: The data storage type (str, int, float, bool, uuid, date, timestamp, jsonb, array[str], array[uuid])
- `renderType`: How to render the value
  - HTML5 types: `text`, `email`, `date`, `number`, `tel`, `url`, `time`, `checkbox`
  - Custom: `component` (when using a React component)

**Conditional fields:**
- `component`: Required only when `renderType: component`. Specifies the default React component name (e.g., `DatalabelDAG`)

**Per-context configs:**
Each entry has context-specific configs (entityDataTable, entityFormContainer, kanbanView, gridView, calendarView, dagView) that define:
- `visible`: Whether to show in this context
- `component`: Only needed when `renderType: component` - specifies which component for each context
- `format: {}`: All CSS/styling properties (width, align, style, locale, symbol, decimals, etc.)

**Rule:** HTML5 renderTypes (text, email, date, number, etc.) do NOT need `component` anywhere. Only `renderType: component` needs components.

---

## view-type-mapping.yaml Examples

### Example 1: HTML5 text type (no component needed)
```yaml
first_name:
  dtype: str
  renderType: text
  entityDataTable: { <<: *table_default, format: { width: "120px" } }
  entityFormContainer: { <<: *form_default }
  kanbanView: *hidden
  gridView: { visible: true }
```

### Example 2: HTML5 email type (no component needed)
```yaml
email:
  dtype: str
  renderType: email
  entityDataTable: { <<: *table_default, format: { width: "200px", linkable: true, icon: mail } }
  entityFormContainer: { <<: *form_default, format: { linkable: true } }
  kanbanView: *hidden
  gridView: { visible: true }
```

### Example 3: HTML5 date type (no component needed)
```yaml
date:
  dtype: date
  renderType: date
  entityDataTable: { <<: *table_default, format: { width: "120px", style: short, locale: en-CA } }
  entityFormContainer: { <<: *form_default, format: { style: medium } }
  kanbanView: { visible: true }
  gridView: { visible: true }
  calendarView: { visible: true }
```

### Example 4: HTML5 number type (no component needed)
```yaml
currency:
  dtype: float
  renderType: number
  entityDataTable: { <<: *table_default, format: { width: "140px", align: right, symbol: "$", decimals: 2, locale: en-CA } }
  entityFormContainer: { <<: *form_default, format: { symbol: "$", decimals: 2 } }
  kanbanView: { visible: true, format: { compact: true } }
  gridView: { visible: true }
```

### Example 5: Custom component (datalabel - component required)
```yaml
datalabel:
  dtype: str
  renderType: component
  component: DatalabelDAG
  entityDataTable: { <<: *table_default, component: BadgeCell, format: { width: "140px", colorFromData: true } }
  entityFormContainer: { <<: *form_default, component: DatalabelDAG, format: { showHierarchy: true } }
  kanbanView: { visible: true, component: Badge }
  gridView: { visible: true, component: Badge }
  calendarView: { visible: true, component: EventBadge }
  dagView: { visible: true, component: DAGNode }
```

---

## edit-type-mapping.yaml Description

Each fieldBusinessType entry defines how a field is **edited/input** across different UI contexts.

**Required fields:**
- `dtype`: The data storage type (str, int, float, bool, uuid, date, timestamp, jsonb, array[str], array[uuid])
- `editable`: Whether the field can be edited (true/false)

**Conditional fields:**
- `lookupSource`: Required when the field needs dropdown options
  - `datalabel`: Fetch options from datalabel_* tables
  - `entityInstance`: Fetch options from entity_instance registry
  - Omit or `null` for fields that don't need lookup

**Per-context configs:**
Each entry has context-specific configs (entityDataTable, entityFormContainer, kanbanView) that define:
- `inputType`: The input method (text, email, select, checkbox, date, etc.)
- `component`: Only needed when `lookupSource` is set - specifies which component for each context
- `validation: {}`: Validation rules (required, min, max, pattern)
- `format: {}`: All CSS/styling properties (autocomplete, symbol, decimals, locale, etc.)

**Rule:** HTML5 inputTypes (text, email, date, number, checkbox, etc.) do NOT need `component`. Only fields with `lookupSource` (datalabel, entityInstance) need components.

---

## edit-type-mapping.yaml Examples

### Example 1: HTML5 text input (no lookup, no component)
```yaml
first_name:
  dtype: str
  editable: true
  entityDataTable: { inputType: text }
  entityFormContainer: { inputType: text, format: { autocomplete: given-name } }
```

### Example 2: HTML5 email input (no lookup, no component)
```yaml
email:
  dtype: str
  editable: true
  entityDataTable: { inputType: email }
  entityFormContainer: { inputType: email, validation: { pattern: "^[^@]+@[^@]+\\.[^@]+$" }, format: { autocomplete: email } }
```

### Example 3: HTML5 number input (no lookup, no component)
```yaml
currency:
  dtype: float
  editable: true
  entityDataTable: { inputType: number }
  entityFormContainer: { inputType: number, validation: { min: 0 }, format: { symbol: "$", decimals: 2, locale: en-CA } }
```

### Example 4: Datalabel select (lookupSource: datalabel, component required)
```yaml
datalabel:
  dtype: str
  editable: true
  lookupSource: datalabel
  entityDataTable: { inputType: select, component: DatalabelSelect }
  entityFormContainer: { inputType: select, component: DatalabelSelect, format: { showColor: true, searchable: true } }
  kanbanView: { inputType: select, component: InlineSelect }
  dagView: { inputType: select, component: DAGNodeSelect }
```

### Example 5: Entity reference (lookupSource: entityInstance, component required)
```yaml
entityInstance_Id:
  dtype: uuid
  editable: true
  lookupSource: entityInstance
  entityDataTable: { inputType: entity_select, component: EntitySelect }
  entityFormContainer: { inputType: entity_select, component: EntitySelect, format: { searchable: true, clearable: true, displayField: name } }
  kanbanView: { inputType: entity_select, component: InlineEntitySelect }
```

---

## Guide: Creating New YAML Entries

### Step 1: Add Pattern to pattern-mapping.yaml

When you have a new field naming convention, add a pattern entry. Patterns are matched in order - more specific patterns should come before generic ones.

**Exact match** - Use when the field name is always the same:
```yaml
- { pattern: "email", exact: true, fieldBusinessType: email }
- { pattern: "phone", exact: true, fieldBusinessType: phone }
- { pattern: "created_ts", exact: true, fieldBusinessType: timestamp_readonly }
```

**Wildcard match** - Use when field names follow a pattern:
```yaml
- { pattern: "*_amt", exact: false, fieldBusinessType: currency }        # budget_amt, total_amt
- { pattern: "*_date", exact: false, fieldBusinessType: date }           # start_date, end_date
- { pattern: "*_pct", exact: false, fieldBusinessType: percentage }      # completion_pct, margin_pct
- { pattern: "dl__*", exact: false, fieldBusinessType: datalabel }       # dl__project_stage, dl__status
- { pattern: "*_id", exact: false, fieldBusinessType: entityInstance_Id } # office_id, employee_id
- { pattern: "*__*_id", exact: false, fieldBusinessType: entityInstance_Id } # manager__employee_id
```

**Pattern priority example:**
```yaml
# More specific patterns FIRST
- { pattern: "created_ts", exact: true, fieldBusinessType: timestamp_readonly }  # Exact match wins
- { pattern: "updated_ts", exact: true, fieldBusinessType: timestamp_readonly }
- { pattern: "*_ts", exact: false, fieldBusinessType: timestamp }                 # Generic fallback
```

---

### Step 2: Add View Config to view-type-mapping.yaml

Define how the field is **displayed** in different UI contexts.

**Decision tree:**
1. Is it a simple HTML5 type (text, email, date, number, checkbox)? → Use `renderType: <html5-type>`, no component needed
2. Does it need a custom React component? → Use `renderType: component` + `component: <ComponentName>`

**HTML5 types - No component needed:**
```yaml
# Text field
text:
  dtype: str
  renderType: text
  entityDataTable: { <<: *table_default }
  entityFormContainer: { <<: *form_default }
  kanbanView: { visible: true }
  gridView: { visible: true }

# Email with mailto link
email:
  dtype: str
  renderType: email
  entityDataTable: { <<: *table_default, format: { width: "200px", linkable: true } }
  entityFormContainer: { <<: *form_default, format: { linkable: true } }
  kanbanView: *hidden
  gridView: { visible: true }

# Phone with tel link
phone:
  dtype: str
  renderType: tel
  entityDataTable: { <<: *table_default, format: { width: "140px", linkable: true } }
  entityFormContainer: { <<: *form_default, format: { countryCode: CA } }
  kanbanView: *hidden
  gridView: { visible: true }

# URL with hyperlink
url:
  dtype: str
  renderType: url
  entityDataTable: { <<: *table_default, format: { width: "200px", truncate: true } }
  entityFormContainer: { <<: *form_default }
  kanbanView: *hidden
  gridView: { visible: true }

# Date display
date:
  dtype: date
  renderType: date
  entityDataTable: { <<: *table_default, format: { width: "120px", style: short, locale: en-CA } }
  entityFormContainer: { <<: *form_default, format: { style: medium } }
  kanbanView: { visible: true }
  gridView: { visible: true }
  calendarView: { visible: true }

# Timestamp display
timestamp:
  dtype: timestamp
  renderType: datetime
  entityDataTable: { <<: *table_default, format: { width: "160px", style: datetime } }
  entityFormContainer: { <<: *form_default }
  kanbanView: *hidden
  gridView: *hidden

# Number display
quantity:
  dtype: int
  renderType: number
  entityDataTable: { <<: *table_default, format: { width: "100px", align: right } }
  entityFormContainer: { <<: *form_default }
  kanbanView: *hidden
  gridView: { visible: true }

# Currency display (formatted number)
currency:
  dtype: float
  renderType: number
  entityDataTable: { <<: *table_default, format: { width: "140px", align: right, symbol: "$", decimals: 2, locale: en-CA } }
  entityFormContainer: { <<: *form_default, format: { symbol: "$", decimals: 2 } }
  kanbanView: { visible: true, format: { compact: true } }
  gridView: { visible: true }

# Percentage display
percentage:
  dtype: float
  renderType: number
  entityDataTable: { <<: *table_default, format: { width: "100px", align: right, suffix: "%" } }
  entityFormContainer: { <<: *form_default, format: { showBar: true } }
  kanbanView: { visible: true }
  gridView: { visible: true }

# Boolean display
boolean:
  dtype: bool
  renderType: checkbox
  entityDataTable: { <<: *table_default, format: { width: "80px", align: center } }
  entityFormContainer: { <<: *form_default }
  kanbanView: { visible: true }
  gridView: { visible: true }
```

**Custom component types - Component required:**
```yaml
# Datalabel (settings dropdown) - needs DAGVisualizer
datalabel:
  dtype: str
  renderType: component
  component: DatalabelDAG
  entityDataTable: { <<: *table_default, component: BadgeCell, format: { width: "140px", colorFromData: true } }
  entityFormContainer: { <<: *form_default, component: DatalabelDAG, format: { showHierarchy: true } }
  kanbanView: { visible: true, component: Badge }
  gridView: { visible: true, component: Badge }
  calendarView: { visible: true, component: EventBadge }
  dagView: { visible: true, component: DAGNode }

# Entity reference - needs EntityLookupCell
entityInstance_Id:
  dtype: uuid
  renderType: component
  component: EntityLookupCell
  entityDataTable: { <<: *table_default, component: EntityLookupCell, format: { width: "150px", displayField: name, linkToEntity: true } }
  entityFormContainer: { <<: *form_default, component: EntityLookupField, format: { displayField: name } }
  kanbanView: { visible: true, component: EntityBadge }
  gridView: { visible: true, component: EntityLink }

# Tags array - needs TagsList
tags:
  dtype: array[str]
  renderType: component
  component: TagsList
  entityDataTable: { <<: *hidden, component: TagsCell, format: { maxDisplay: 3 } }
  entityFormContainer: { <<: *form_default, component: TagsList }
  kanbanView: { visible: true, component: TagsCompact, format: { max: 2 } }
  gridView: { visible: true, component: TagsWrap }

# JSON metadata - needs JsonViewer
json:
  dtype: jsonb
  renderType: component
  component: JsonViewer
  entityDataTable: { <<: *hidden, component: JsonPreviewCell }
  entityFormContainer: { <<: *form_default, component: JsonViewer, format: { collapsed: true } }
  kanbanView: *hidden
  gridView: *hidden

# Rating stars - needs RatingStars
rating:
  dtype: float
  renderType: component
  component: RatingStars
  entityDataTable: { <<: *table_default, component: RatingCell, format: { width: "120px", max: 5 } }
  entityFormContainer: { <<: *form_default, component: RatingStars, format: { max: 5 } }
  kanbanView: { visible: true, component: RatingCompact }
  gridView: { visible: true, component: RatingStars }

# Avatar image - needs AvatarCell
avatar:
  dtype: str
  renderType: component
  component: AvatarCell
  entityDataTable: { <<: *table_default, component: AvatarCell, format: { width: "60px", align: center, size: sm } }
  entityFormContainer: { <<: *form_default, component: AvatarField, format: { size: lg } }
  kanbanView: { visible: true, component: Avatar, format: { size: sm } }
  gridView: { visible: true, component: Avatar, format: { size: md } }

# File attachment - needs FileCell
file:
  dtype: str
  renderType: component
  component: FileCell
  entityDataTable: { <<: *table_default, component: FileCell, format: { width: "150px" } }
  entityFormContainer: { <<: *form_default, component: FileField }
  kanbanView: *hidden
  gridView: *hidden

# Rich text content - needs RichTextViewer
rich_text:
  dtype: str
  renderType: component
  component: RichTextViewer
  entityDataTable: { <<: *hidden, component: RichTextPreview }
  entityFormContainer: { <<: *form_default, component: RichTextViewer }
  kanbanView: *hidden
  gridView: *hidden

# Color swatch - needs ColorCell
color:
  dtype: str
  renderType: component
  component: ColorCell
  entityDataTable: { <<: *table_default, component: ColorCell, format: { width: "100px", showHex: true } }
  entityFormContainer: { <<: *form_default, component: ColorSwatch }
  kanbanView: { visible: true, component: ColorDot }
  gridView: { visible: true, component: ColorDot }
```

---

### Step 3: Add Edit Config to edit-type-mapping.yaml

Define how the field is **edited/input** in different UI contexts.

**Decision tree:**
1. Does it need dropdown options from database? → Add `lookupSource: datalabel` or `lookupSource: entityInstance`
2. Is it a simple HTML5 input (text, email, date, number, checkbox)? → Use `inputType: <html5-type>`, no component needed
3. Does it need a custom input component? → Add `component: <ComponentName>`

**HTML5 inputs - No component, no lookup:**
```yaml
# Text input
text:
  dtype: str
  editable: true
  entityDataTable: { inputType: text }
  entityFormContainer: { inputType: text }
  kanbanView: { inputType: text }

# Email input
email:
  dtype: str
  editable: true
  entityDataTable: { inputType: email }
  entityFormContainer: { inputType: email, validation: { pattern: "^[^@]+@[^@]+\\.[^@]+$" }, format: { autocomplete: email } }

# Phone input
phone:
  dtype: str
  editable: true
  entityDataTable: { inputType: tel }
  entityFormContainer: { inputType: tel, format: { countryCode: CA, mask: "(###) ###-####" } }

# URL input
url:
  dtype: str
  editable: true
  entityDataTable: { inputType: url }
  entityFormContainer: { inputType: url, validation: { pattern: "^https?://" }, format: { placeholder: "https://..." } }

# Date picker
date:
  dtype: date
  editable: true
  entityDataTable: { inputType: date }
  entityFormContainer: { inputType: date, format: { locale: en-CA, clearable: true } }
  kanbanView: { inputType: date }
  calendarView: { inputType: date }

# Datetime picker
timestamp:
  dtype: timestamp
  editable: true
  entityDataTable: { inputType: datetime-local }
  entityFormContainer: { inputType: datetime-local, format: { locale: en-CA } }
  calendarView: { inputType: datetime-local }

# Time picker
time:
  dtype: str
  editable: true
  entityDataTable: { inputType: time }
  entityFormContainer: { inputType: time, format: { step: 15 } }

# Number input
quantity:
  dtype: int
  editable: true
  entityDataTable: { inputType: number }
  entityFormContainer: { inputType: number, validation: { min: 0 }, format: { step: 1 } }

# Currency input
currency:
  dtype: float
  editable: true
  entityDataTable: { inputType: number }
  entityFormContainer: { inputType: number, validation: { min: 0 }, format: { symbol: "$", decimals: 2, locale: en-CA } }

# Percentage input
percentage:
  dtype: float
  editable: true
  entityDataTable: { inputType: number }
  entityFormContainer: { inputType: number, validation: { min: 0, max: 100 }, format: { suffix: "%" } }

# Checkbox
boolean:
  dtype: bool
  editable: true
  entityDataTable: { inputType: checkbox }
  entityFormContainer: { inputType: checkbox }
  kanbanView: { inputType: checkbox }

# Textarea
description:
  dtype: str
  editable: true
  entityDataTable: { inputType: textarea }
  entityFormContainer: { inputType: textarea, format: { rows: 4, resizable: true } }

# Readonly (system fields)
timestamp_readonly:
  dtype: timestamp
  editable: false
  entityDataTable: { inputType: readonly }
  entityFormContainer: { inputType: readonly }
```

**Lookup fields - Need lookupSource + component:**
```yaml
# Datalabel dropdown (settings table lookup)
datalabel:
  dtype: str
  editable: true
  lookupSource: datalabel
  entityDataTable: { inputType: select, component: DatalabelSelect }
  entityFormContainer: { inputType: select, component: DatalabelSelect, format: { showColor: true, searchable: true } }
  kanbanView: { inputType: select, component: InlineSelect }
  dagView: { inputType: select, component: DAGNodeSelect }

# Entity reference dropdown (entity instance lookup)
entityInstance_Id:
  dtype: uuid
  editable: true
  lookupSource: entityInstance
  entityDataTable: { inputType: entity_select, component: EntitySelect }
  entityFormContainer: { inputType: entity_select, component: EntitySelect, format: { searchable: true, clearable: true, displayField: name } }
  kanbanView: { inputType: entity_select, component: InlineEntitySelect }

# Multi-entity reference (multiple entity instances)
entityInstance_Ids:
  dtype: array[uuid]
  editable: true
  lookupSource: entityInstance
  entityDataTable: { inputType: entity_multiselect, component: EntityMultiSelect }
  entityFormContainer: { inputType: entity_multiselect, component: EntityMultiSelect, format: { searchable: true, displayField: name, maxSelections: null } }
```

**Custom input components - No lookup:**
```yaml
# Tags input
tags:
  dtype: array[str]
  editable: true
  entityDataTable: { inputType: tags, component: TagsInput }
  entityFormContainer: { inputType: tags, component: TagsInput, format: { allowCreate: true, maxTags: null } }

# JSON editor
json:
  dtype: jsonb
  editable: true
  entityDataTable: { inputType: json, component: JsonEditor }
  entityFormContainer: { inputType: json, component: JsonEditor, format: { mode: tree, validateSchema: false } }

# Rating input
rating:
  dtype: float
  editable: true
  entityDataTable: { inputType: rating, component: RatingInput }
  entityFormContainer: { inputType: rating, component: RatingInput, format: { max: 5, allowHalf: true, clearable: true } }

# Color picker
color:
  dtype: str
  editable: true
  entityDataTable: { inputType: color, component: ColorPicker }
  entityFormContainer: { inputType: color, component: ColorPicker, format: { presets: true, allowCustom: true, outputFormat: hex } }

# File upload
file:
  dtype: str
  editable: true
  entityDataTable: { inputType: file, component: FileUpload }
  entityFormContainer: { inputType: file, component: FileUpload, format: { accept: "*/*", maxSize: 10485760 } }

# Image upload
image:
  dtype: str
  editable: true
  entityDataTable: { inputType: image, component: ImageUpload }
  entityFormContainer: { inputType: image, component: ImageUpload, format: { accept: "image/*", maxSize: 5242880, preview: true } }

# Avatar upload
avatar:
  dtype: str
  editable: true
  entityDataTable: { inputType: image, component: ImageUpload }
  entityFormContainer: { inputType: avatar, component: AvatarUpload, format: { accept: "image/*", maxSize: 2097152, crop: true, aspectRatio: 1 } }

# Signature pad
signature:
  dtype: str
  editable: true
  entityFormContainer: { inputType: signature, component: SignaturePad, format: { width: 400, height: 200 } }

# Rich text editor
rich_text:
  dtype: str
  editable: true
  entityDataTable: { inputType: textarea }
  entityFormContainer: { inputType: richtext, component: RichTextEditor, format: { toolbar: [bold, italic, link, list], minHeight: 200 } }

# Address autocomplete
address:
  dtype: str
  editable: true
  entityDataTable: { inputType: text }
  entityFormContainer: { inputType: address, component: AddressAutocomplete, format: { country: CA, showMap: false } }

# Geolocation picker
geolocation:
  dtype: str
  editable: true
  entityDataTable: { inputType: geolocation, component: GeolocationInput }
  entityFormContainer: { inputType: geolocation, component: GeolocationPicker, format: { showMap: true, allowManual: true } }

# Duration picker
duration:
  dtype: int
  editable: true
  entityDataTable: { inputType: number }
  entityFormContainer: { inputType: duration, component: DurationPicker, format: { units: [hours, minutes], defaultUnit: minutes } }
  calendarView: { inputType: duration, component: DurationPicker }

# Barcode scanner
barcode:
  dtype: str
  editable: true
  entityDataTable: { inputType: text }
  entityFormContainer: { inputType: barcode, component: BarcodeScanner, format: { type: code128, allowManual: true } }
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| **pattern-mapping.yaml** | NO CHANGES |
| **view-type-mapping.yaml** | Keep `dtype`, add `renderType` (+ `component` if renderType is `component`) |
| **edit-type-mapping.yaml** | Keep `dtype`, replace `loadFromDataLabels`/`loadFromEntity` with `lookupSource` |

### Implementation Status: ✅ COMPLETED

Changes applied on 2025-11-25:
- `view-type-mapping.yaml`: Added `renderType` field to all 80+ fieldBusinessType entries
- `edit-type-mapping.yaml`: Replaced `loadFromDataLabels: true` → `lookupSource: datalabel`, `loadFromEntity: true` → `lookupSource: entityInstance`
- `dtype` kept as-is (matches API response format)

---

## Component Architecture: Page-Level vs Field-Level

This section explains the difference between **page-level (container) components** that render large data sets and **field-level (cell/input) components** that render individual field values.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PAGE-LEVEL COMPONENTS                                   │
│        (Container components that render entire data views)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  EntityDataTable    │  KanbanView    │  GridView    │  CalendarView         │
│  (Table rows/cols)  │  (Kanban cols) │  (Card grid) │  (Calendar events)   │
└──────────┬──────────┴───────┬────────┴──────┬───────┴──────────┬────────────┘
           │                  │               │                  │
           ▼                  ▼               ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FIELD-LEVEL COMPONENTS                                  │
│        (Individual cell/input components for each field)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  VIEW Components          │  EDIT Components                                │
│  ─────────────────────────│──────────────────────────────────────────────── │
│  TextCell, BadgeCell      │  TextInput, DatalabelSelect                    │
│  CurrencyCell, DateCell   │  CurrencyInput, DatePicker                     │
│  EntityLookupCell         │  EntitySelect, EntityMultiSelect               │
│  AvatarCell, FileCell     │  ImageUpload, FileUpload                       │
│  RatingCell, ColorCell    │  RatingInput, ColorPicker                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Page-Level Components (Container/Layout Components)

These are the **major UI components** that render entire data views. They define the UI contexts that CONSUME field-level components based on YAML configs.

| Component | File Location | Purpose | UI Context |
|-----------|---------------|---------|------------|
| **EntityDataTable** | `components/shared/ui/EntityDataTable.tsx` | Renders tabular data with columns, rows, sorting, filtering, pagination. Uses virtualization for large datasets. | `entityDataTable` |
| **KanbanView** | `components/shared/ui/KanbanView.tsx` | Renders cards in draggable columns grouped by a status/stage field (e.g., project stages). | `kanbanView` |
| **GridView** | `components/shared/ui/GridView.tsx` | Renders entity cards in a responsive grid layout. Good for visual browsing. | `gridView` |
| **EntityFormContainer** | `components/shared/entity/EntityFormContainer.tsx` | Renders entity create/edit forms with all fields. | `entityFormContainer` |

**Key insight:** These components iterate over field metadata and render the appropriate field-level component for each field based on YAML configs.

---

### Field-Level Visualization Components

These are **specialized visualizers** that can render specific field types with rich visualization. They appear in YAML configs as `component` values.

| Component | File Location | Purpose | Used In Context |
|-----------|---------------|---------|-----------------|
| **CalendarView** | `components/shared/ui/CalendarView.tsx` | Renders date fields as calendar events | `calendarView` |
| **DAGVisualizer** | `components/workflow/DAGVisualizer.tsx` | Renders datalabel hierarchies as workflow stage graphs | `dagView`, `entityFormContainer` |

**Key insight:** These components visualize specific field data (dates for CalendarView, datalabel stages for DAGVisualizer) rather than entire entity lists.

---

### Field-Level View Components (Display Components)

**Key principle:** HTML5 renderTypes handle formatting via `format: {}` - NO custom components needed.

#### HTML5 renderTypes (NO component needed)

These use `renderType` + `format: {}` for display. Browser handles rendering.

| renderType | format options | Used For |
|------------|----------------|----------|
| `text` | `{ bold, truncate, monospace }` | name, code, description |
| `email` | `{ linkable }` | email, primary_email |
| `tel` | `{ linkable, countryCode }` | phone, mobile |
| `url` | `{ truncate, showIcon }` | website, profile_url |
| `date` | `{ style, locale }` | start_date, end_date |
| `datetime` | `{ style, locale }` | created_ts, updated_ts |
| `time` | `{ style }` | scheduled_time |
| `number` | `{ align, symbol, decimals, suffix, locale }` | budget_amt, quantity, completion_pct |
| `checkbox` | `{ trueLabel, falseLabel }` | is_active, completed_flag |

#### Custom components (ONLY when renderType: component)

These require `renderType: component` + `component: <name>`. Used for rich visualization.

| Component | Purpose | Used For |
|-----------|---------|----------|
| `BadgeCell` | Colored badge from datalabel | dl__project_stage, dl__status |
| `EntityLookupCell` | Entity name with link | office_id, employee_id |
| `EntityArrayCell` | Multiple entity references | team_member_ids |
| `AvatarStack` | Stacked avatar images | assignee_ids |
| `AvatarCell` | Circular avatar image | avatar_url |
| `ImageCell` | Thumbnail image preview | photo, product_image |
| `FileCell` | File icon with download link | attachment, document |
| `TagsCell` | Tag chips | tags, keywords |
| `ColorCell` | Color swatch | color, theme_color |
| `RatingCell` | Star rating display | rating, score |
| `JsonPreviewCell` | JSON preview | metadata, config |
| `DAGVisualizer` | Workflow stage graph | dl__workflow_stage |

---

### Field-Level Edit Components (Input Components)

These components render individual field **inputs for editing**. Listed in `edit-type-mapping.yaml`.

#### Text Inputs

| Component | inputType | Purpose | Used For |
|-----------|-----------|---------|----------|
| `TextInput` | `text` | Single-line text | name, code, title |
| `TextareaInput` | `textarea` | Multi-line text | description, notes |
| `EmailInput` | `email` | Email with validation | email, primary_email |
| `PhoneInput` | `tel` | Phone with mask | phone, mobile |
| `UrlInput` | `url` | URL with validation | website, profile_url |
| `MaskedInput` | `text` | Input with pattern mask | postal_code, sin |

#### Number Inputs

| Component | inputType | Purpose | Used For |
|-----------|-----------|---------|----------|
| `NumberInput` | `number` | Integer/decimal input | quantity, sort_order |
| `CurrencyInput` | `currency` | Currency with symbol | budget_amt, price |
| `PercentageInput` | `number` | Percentage (0-100) | completion_pct |
| `MeasurementInput` | `number` | Number with unit suffix | area_sqft, weight_kg |

#### Date & Time

| Component | inputType | Purpose | Used For |
|-----------|-----------|---------|----------|
| `DatePicker` | `date` | Date selection | start_date, end_date |
| `DateTimePicker` | `datetime-local` | Date + time | scheduled_ts |
| `TimePicker` | `time` | Time only | scheduled_time |
| `DurationPicker` | `duration` | Hours/minutes picker | estimated_duration |

#### Dropdown Selects

| Component | inputType | lookupSource | Purpose |
|-----------|-----------|--------------|---------|
| `DatalabelSelect` | `select` | `datalabel` | Settings dropdown with colors |
| `EntitySelect` | `entity_select` | `entityInstance` | Entity reference picker |
| `EntityMultiSelect` | `entity_multiselect` | `entityInstance` | Multiple entities |
| `InlineSelect` | `select` | varies | Compact inline dropdown |
| `StateSelect` | `select` | static | US states |
| `ProvinceSelect` | `select` | static | Canadian provinces |
| `CountrySelect` | `select` | static | Countries |

#### Boolean & Toggle

| Component | inputType | Purpose | Used For |
|-----------|-----------|---------|----------|
| `Checkbox` | `checkbox` | Checkmark toggle | is_active, completed |
| `Toggle` | `toggle` | On/off switch | active_flag |

#### File & Media

| Component | inputType | Purpose | Used For |
|-----------|-----------|---------|----------|
| `FileUpload` | `file` | File selection | attachment |
| `ImageUpload` | `image` | Image with preview | photo, logo |
| `AvatarUpload` | `avatar` | Avatar with crop | avatar_url |
| `SignaturePad` | `signature` | Drawing signature | signature |
| `VideoCapture` | `video` | Video recording | video_message |

#### Special Inputs

| Component | inputType | Purpose | Used For |
|-----------|-----------|---------|----------|
| `TagsInput` | `tags` | Tag chip editor | tags, keywords |
| `JsonEditor` | `json` | JSON tree editor | metadata, config |
| `RatingInput` | `rating` | Star rating selector | rating |
| `ColorPicker` | `color` | Color selection | color, theme_color |
| `RichTextEditor` | `richtext` | WYSIWYG editor | content, body |
| `AddressAutocomplete` | `address` | Address with Google | address |
| `GeolocationPicker` | `geolocation` | Map coordinate picker | geo_coordinates |
| `BarcodeScanner` | `barcode` | Camera barcode scan | barcode, sku |
| `DAGNodeSelect` | `select` | DAG-aware stage picker | dl__workflow_stage |

---

### Component Decision Matrix

Use this matrix to determine which component to specify:

#### For View (view-type-mapping.yaml)

**HTML5 renderTypes (NO component needed):**
| Field Type | renderType | Notes |
|------------|------------|-------|
| Simple text | `text` | Browser native |
| Email | `email` | Renders mailto link |
| Phone | `tel` | Renders tel link |
| URL | `url` | Renders hyperlink |
| Date | `date` | Localized date |
| Number | `number` | Right-aligned |
| Boolean | `checkbox` | Shows ✓ or ✗ |

**Custom renderTypes (component REQUIRED):**
| Field Type | renderType | component | Notes |
|------------|------------|-----------|-------|
| Datalabel | `component` | `BadgeCell` | Colored badge |
| Entity ref | `component` | `EntityLookupCell` | Name lookup |
| Tags | `component` | `TagsCell` | Chip rendering |
| Rating | `component` | `RatingCell` | Star display |
| Avatar | `component` | `AvatarCell` | Image rendering |
| JSON | `component` | `JsonPreviewCell` | Collapsible tree |
| DAG stage | `component` | `DAGVisualizer` | Workflow graph |

#### For Edit (edit-type-mapping.yaml)

**HTML5 inputTypes (NO component, NO lookupSource):**
| Field Type | inputType | Notes |
|------------|-----------|-------|
| Simple text | `text` | Browser native |
| Email | `email` | Browser native |
| Phone | `tel` | Browser native |
| URL | `url` | Browser native |
| Date | `date` | Browser native |
| Time | `time` | Browser native |
| Datetime | `datetime-local` | Browser native |
| Number | `number` | Browser native |
| Checkbox | `checkbox` | Browser native |
| Textarea | `textarea` | Browser native |

**Lookup fields (lookupSource + component REQUIRED):**
| Field Type | inputType | lookupSource | component |
|------------|-----------|--------------|-----------|
| Datalabel | `select` | `datalabel` | `DatalabelSelect` |
| Entity ref | `entity_select` | `entityInstance` | `EntitySelect` |
| Multi-entity | `entity_multiselect` | `entityInstance` | `EntityMultiSelect` |

**Custom inputs (component REQUIRED, no lookupSource):**
| Field Type | inputType | component | Notes |
|------------|-----------|-----------|-------|
| Tags | `tags` | `TagsInput` | Chip input |
| Rating | `rating` | `RatingInput` | Star input |
| Color | `color` | `ColorPicker` | Color wheel |
| File | `file` | `FileUpload` | Upload UI |
| Image | `image` | `ImageUpload` | With preview |
| Rich text | `richtext` | `RichTextEditor` | WYSIWYG |
| JSON | `json` | `JsonEditor` | Tree editor |
| DAG stage | `select` | `DAGNodeSelect` | Workflow picker |

---

### Summary: When Components Are Required

**View components** are required when:
- The field needs special rendering beyond browser-native display
- Examples: colored badges, entity name lookups, image thumbnails, rating stars

**Edit components** are required when:
- `lookupSource` is set (needs dropdown with loaded options)
- The input needs special UI beyond HTML5 inputs (file upload, color picker, rating stars, etc.)

**No component needed when:**
- Using HTML5 native input types (text, email, tel, url, date, time, number, checkbox, textarea)
- The browser can render the value directly with optional formatting
