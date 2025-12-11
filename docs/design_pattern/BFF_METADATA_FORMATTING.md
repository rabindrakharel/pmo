# Frontend Metadata & Formatting System

**Version:** 12.7.0 | **Updated:** 2025-12-11

> Complete documentation for the PMO platform's metadata-driven field rendering pipeline. Covers the backend YAML pattern detection system, metadata composition logic, and frontend formatting/rendering architecture.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Metadata Composition Logic Flow](#metadata-composition-logic-flow)
   - [Step-by-Step Resolution](#step-by-step-resolution)
   - [Resolution Priority](#resolution-priority)
   - [Worked Example](#worked-example-budget_allocated_amt)
4. [Backend: YAML Pattern Detection System](#backend-yaml-pattern-detection-system)
   - [Pattern Mapping](#file-1-pattern-mappingyaml)
   - [View Type Mapping](#file-2-view-type-mappingyaml)
   - [Edit Type Mapping](#file-3-edit-type-mappingyaml)
   - [Width Constants](#width-constants)
5. [Frontend: Formatter Service](#frontend-formatter-service)
   - [Core Types](#core-types)
   - [Data Flow](#data-flow)
   - [FieldRenderer Architecture](#fieldrenderer-architecture)
6. [Entity Reference Resolution](#entity-reference-resolution)
7. [Adding New Field Types](#adding-new-field-types)
8. [Anti-Patterns & Best Practices](#anti-patterns--best-practices)
9. [Performance & Caching](#performance--caching)

---

## Executive Summary

The PMO platform uses a **metadata-driven rendering pipeline** where:

1. **Backend** (YAML): Detects field types from column names and generates `viewType`/`editType` metadata
2. **Frontend** (TypeScript): Pure renderer that executes backend instructions with **zero pattern detection**

```
Column Name → Pattern Matching → fieldBusinessType → View/Edit Config → API Response → Frontend Render
```

**Key Principles:**
- Backend is single source of truth for all field rendering decisions
- Frontend contains zero pattern detection logic (`_id`, `_amt`, etc.)
- YAML configuration allows adding new field types without code changes
- TanStack Query cache provides sync access to entity names and datalabel colors

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    METADATA-DRIVEN RENDERING PIPELINE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BACKEND (Node.js + YAML)                                                    │
│  ────────────────────────                                                    │
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │ pattern-mapping.yaml│ →  │view-type-mapping.yaml│ →  │ API Response    │  │
│  │ (column → type)     │    │edit-type-mapping.yaml│    │ { viewType,     │  │
│  │                     │    │ (type → renderType)  │    │   editType }    │  │
│  └─────────────────────┘    └─────────────────────┘    └────────┬────────┘  │
│                                                                  │           │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ │
│                                                                  │           │
│  FRONTEND (React + TanStack Query)                               │           │
│  ─────────────────────────────────                               ▼           │
│                                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │ useEntityMetadata() │ →  │ formatDataset()     │ →  │ FieldRenderer   │  │
│  │ (fetch metadata)    │    │ (format-at-read)    │    │ (VIEW/EDIT)     │  │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘  │
│                                                                              │
│  ✓ Zero pattern detection                                                    │
│  ✓ All decisions from metadata.renderType/inputType                          │
│  ✓ Entity names from TanStack Query cache (sync)                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Metadata Composition Logic Flow

**Location:** `apps/api/src/services/entity-component-metadata.service.ts`

The metadata service generates field rendering instructions through a **4-step resolution process**.

### Step-by-Step Resolution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    METADATA RESOLUTION PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUT: Column name (e.g., "budget_allocated_amt")                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 1: EXPLICIT CONFIG CHECK                                           ││
│  │ ─────────────────────────────                                           ││
│  │ File: config/entity-field-config.ts                                     ││
│  │                                                                          ││
│  │ if (hasExplicitConfig(entityCode, fieldName)) {                         ││
│  │   return convertExplicitConfigToMetadata(config);  // HIGHEST PRIORITY  ││
│  │ }                                                                        ││
│  │                                                                          ││
│  │ Use case: Non-standard naming, special formatting requirements           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                               │
│                              ▼ (no explicit config)                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 2: PATTERN MATCHING → fieldBusinessType                            ││
│  │ ──────────────────────────────────────────────                          ││
│  │ File: pattern-mapping.yaml                                              ││
│  │ Function: getFieldBusinessType(fieldName)                               ││
│  │                                                                          ││
│  │ for (pattern in patterns) {                                             ││
│  │   if (matchYamlPattern(fieldName, pattern)) {                           ││
│  │     return pattern.fieldBusinessType;  // e.g., "currency"              ││
│  │   }                                                                      ││
│  │ }                                                                        ││
│  │ return defaultFieldBusinessType;  // "text"                             ││
│  │                                                                          ││
│  │ Pattern types:                                                           ││
│  │   exact: true  → "name" matches "name" only                             ││
│  │   exact: false → "*_amt" matches "budget_allocated_amt"                 ││
│  │                                                                          ││
│  │ FIRST MATCH WINS - order matters!                                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                               │
│                              ▼ fieldBusinessType = "currency"                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 3: RESOLVE INHERITANCE                                             ││
│  │ ─────────────────────────────                                           ││
│  │ Function: resolveInheritance(businessType, mapping)                     ││
│  │                                                                          ││
│  │ Example inheritance chain:                                               ││
│  │   title → (inherit: name) → name config                                 ││
│  │   duration_minutes → (inherit: duration) → duration config              ││
│  │                                                                          ││
│  │ Deep merge: child properties override parent                            ││
│  │ Circular reference protection via visited Set                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                               │
│                              ▼ resolved config for "currency"                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ STEP 4: EXTRACT COMPONENT-SPECIFIC METADATA                             ││
│  │ ──────────────────────────────────────────────                          ││
│  │ Functions: getViewMetadataFromYaml(), getEditMetadataFromYaml()         ││
│  │                                                                          ││
│  │ For each component (entityListOfInstancesTable, entityInstanceFormContainer, etc.):     ││
│  │                                                                          ││
│  │ VIEW METADATA (from view-type-mapping.yaml):                            ││
│  │ ┌─────────────────────────────────────────────────────────────────────┐ ││
│  │ │ {                                                                    │ ││
│  │ │   dtype: "float",                                                    │ ││
│  │ │   label: "Budget Allocated",        // generateLabel()               │ ││
│  │ │   renderType: "currency",           // from YAML                     │ ││
│  │ │   behavior: {                                                        │ ││
│  │ │     visible: true,                  // from YAML behavior            │ ││
│  │ │     sortable: true,                                                  │ ││
│  │ │     filterable: true                                                 │ ││
│  │ │   },                                                                 │ ││
│  │ │   style: {                                                           │ ││
│  │ │     width: "140px",                 // from *width_xl anchor         │ ││
│  │ │     align: "right",                                                  │ ││
│  │ │     symbol: "$",                                                     │ ││
│  │ │     decimals: 2                                                      │ ││
│  │ │   }                                                                  │ ││
│  │ │ }                                                                    │ ││
│  │ └─────────────────────────────────────────────────────────────────────┘ ││
│  │                                                                          ││
│  │ EDIT METADATA (from edit-type-mapping.yaml):                            ││
│  │ ┌─────────────────────────────────────────────────────────────────────┐ ││
│  │ │ {                                                                    │ ││
│  │ │   dtype: "float",                                                    │ ││
│  │ │   label: "Budget Allocated",                                         │ ││
│  │ │   inputType: "number",              // HTML5 input type              │ ││
│  │ │   behavior: { editable: true },                                      │ ││
│  │ │   style: { step: "0.01" },                                           │ ││
│  │ │   validation: { min: 0 }                                             │ ││
│  │ │ }                                                                    │ ││
│  │ └─────────────────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                              │                                               │
│                              ▼                                               │
│  OUTPUT: metadata.entityListOfInstancesTable.viewType.budget_allocated_amt  │
│          metadata.entityListOfInstancesTable.editType.budget_allocated_amt  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Resolution Priority

| Priority | Source | Use Case |
|----------|--------|----------|
| 1 (Highest) | `entity-field-config.ts` | Non-standard naming, special formatting |
| 2 | YAML pattern matching | Standard naming conventions (95% of fields) |
| 3 | YAML inheritance | Types that share behavior (`title` → `name`) |
| 4 (Lowest) | Default text field | Unknown patterns, fallback |

### Worked Example: `budget_allocated_amt`

```
INPUT: "budget_allocated_amt" (for entityListOfInstancesTable component)

STEP 1: Explicit Config Check
────────────────────────────
hasExplicitConfig('project', 'budget_allocated_amt') → false
// No explicit config found, continue to pattern matching

STEP 2: Pattern Matching
────────────────────────
patterns:
  - { pattern: "*_amt", exact: false, fieldBusinessType: currency }
  - { pattern: "*_price", exact: false, fieldBusinessType: currency }
  - { pattern: "*_cost", exact: false, fieldBusinessType: currency }

matchYamlPattern("budget_allocated_amt", "*_amt", false)
  → regex: /^.*_amt$/
  → "budget_allocated_amt".match(/^.*_amt$/) → TRUE
  → return "currency"

fieldBusinessType = "currency"

STEP 3: Resolve Inheritance
───────────────────────────
currency:
  dtype: float
  entityListOfInstancesTable:
    renderType: currency
    ...

// No "inherit:" key, use config directly

STEP 4: Extract Component Metadata
──────────────────────────────────
view-type-mapping.yaml → entityListOfInstancesTable:
  currency:
    dtype: float
    entityListOfInstancesTable:
      <<: *table_default          // Merge defaults
      renderType: currency
      style: { align: right, width: *width_xl, symbol: "$", decimals: 2 }

edit-type-mapping.yaml → entityListOfInstancesTable:
  currency:
    dtype: float
    entityListOfInstancesTable:
      inputType: number
      behavior: { editable: true }
      style: { step: "0.01" }
      validation: { min: 0 }

OUTPUT:
{
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "behavior": { "visible": true, "sortable": true, "filterable": true },
          "style": { "width": "140px", "align": "right", "symbol": "$", "decimals": 2 }
        }
      },
      "editType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "behavior": { "editable": true },
          "style": { "step": "0.01" },
          "validation": { "min": 0 }
        }
      }
    }
  }
}
```

### Worked Example: `manager__employee_id` (Entity Reference)

```
INPUT: "manager__employee_id"

STEP 2: Pattern Matching
────────────────────────
patterns:
  - { pattern: "*__*_id", exact: false, fieldBusinessType: entityInstance_Id }

matchYamlPattern("manager__employee_id", "*__*_id", false)
  → regex: /^.*__.*_id$/
  → "manager__employee_id".match(/^.*__.*_id$/) → TRUE
  → return "entityInstance_Id"

fieldBusinessType = "entityInstance_Id"

STEP 3: Resolve Inheritance
───────────────────────────
entityInstance_Id:
  dtype: uuid
  entityListOfInstancesTable:
    renderType: entityInstanceId
    behavior: { visible: true, sortable: true, filterable: true }
    style: { linkToEntity: true }

STEP 4: Extract + Enrich
────────────────────────
// detect lookupEntity from field name
detectEntityFromFieldName("manager__employee_id")
  → match: /^(.*)__(\w+)_id$/ → ["employee"]
  → return "employee"

// Add lookupEntity to BOTH view and edit metadata
view.lookupEntity = "employee"
edit.lookupEntity = "employee"
edit.lookupSourceTable = "entityInstance"

OUTPUT:
{
  "viewType": {
    "manager__employee_id": {
      "dtype": "uuid",
      "label": "Manager Employee Name",
      "renderType": "entityInstanceId",
      "lookupEntity": "employee",           // ← For ref_data_entityInstance resolution
      "behavior": { "visible": true, "sortable": true },
      "style": { "linkToEntity": true }
    }
  },
  "editType": {
    "manager__employee_id": {
      "dtype": "uuid",
      "label": "Manager Employee Name",
      "inputType": "select",
      "component": "EntityInstanceSelect",
      "lookupSourceTable": "entityInstance",
      "lookupEntity": "employee",
      "behavior": { "editable": true }
    }
  }
}
```

### Worked Example: `dl__project_stage` (Datalabel)

```
INPUT: "dl__project_stage"

STEP 2: Pattern Matching
────────────────────────
patterns:
  - { pattern: "dl__*_stage", exact: false, fieldBusinessType: datalabel_dag }
  - { pattern: "dl__*", exact: false, fieldBusinessType: datalabel }

matchYamlPattern("dl__project_stage", "dl__*_stage", false)
  → regex: /^dl__.*_stage$/
  → "dl__project_stage".match(/^dl__.*_stage$/) → TRUE
  → return "datalabel_dag"  // Matched first, more specific pattern

fieldBusinessType = "datalabel_dag"

STEP 4: Extract + Enrich
────────────────────────
// datalabel_dag has lookupSourceTable: datalabel
// Set lookupField to the field name for badge color resolution

view.lookupField = "dl__project_stage"
edit.lookupField = "dl__project_stage"
edit.lookupSourceTable = "datalabel"

OUTPUT:
{
  "viewType": {
    "dl__project_stage": {
      "dtype": "str",
      "label": "Project Stage",
      "renderType": "badge",
      "lookupField": "dl__project_stage",   // ← For badge color from datalabel
      "behavior": { "visible": true, "sortable": true },
      "style": { "colorFromData": true }
    }
  },
  "editType": {
    "dl__project_stage": {
      "dtype": "str",
      "label": "Project Stage",
      "inputType": "component",
      "component": "BadgeDropdownSelect",
      "lookupSourceTable": "datalabel",
      "lookupField": "dl__project_stage",
      "behavior": { "editable": true }
    }
  }
}
```

---

## Backend: YAML Pattern Detection System

**Location:** `apps/api/src/services/`

The backend uses a **3-step YAML pipeline** to generate field metadata:

| Step | File | Purpose |
|------|------|---------|
| 1 | `pattern-mapping.yaml` | Column name → fieldBusinessType |
| 2a | `view-type-mapping.yaml` | fieldBusinessType → VIEW config (renderType, style) |
| 2b | `edit-type-mapping.yaml` | fieldBusinessType → EDIT config (inputType, validation) |

### File 1: pattern-mapping.yaml

**Purpose:** Map column names to semantic field business types

**Size:** ~466 lines, 100+ patterns

#### Pattern Syntax

| Pattern Type | Syntax | Example Column | Matches? |
|--------------|--------|----------------|----------|
| **Exact** | `exact: true` | `name` matches `name` | Yes |
| **Wildcard Suffix** | `*_amt` | `budget_allocated_amt` | Yes |
| **Wildcard Prefix** | `dl__*` | `dl__project_stage` | Yes |
| **Wildcard Both** | `*__*_id` | `manager__employee_id` | Yes |

#### Pattern Matching Rules

1. **First Match Wins** - Patterns evaluated top to bottom
2. **Specific Before Generic** - Place specific patterns before generic ones
3. **Exact Before Wildcard** - Exact matches come first

#### Core Patterns

```yaml
patterns:
  # IDENTITY & CORE
  - { pattern: "id", exact: true, fieldBusinessType: uuid }
  - { pattern: "code", exact: true, fieldBusinessType: code }
  - { pattern: "name", exact: true, fieldBusinessType: name }
  - { pattern: "descr", exact: true, fieldBusinessType: description }

  # CURRENCY
  - { pattern: "*_amt", exact: false, fieldBusinessType: currency }
  - { pattern: "*_price", exact: false, fieldBusinessType: currency }
  - { pattern: "*_cost", exact: false, fieldBusinessType: currency }

  # DATE & TIME
  - { pattern: "*_date", exact: false, fieldBusinessType: date }
  - { pattern: "created_ts", exact: true, fieldBusinessType: systemInternal_ts }
  - { pattern: "updated_ts", exact: true, fieldBusinessType: systemInternal_ts }
  - { pattern: "*_ts", exact: false, fieldBusinessType: timestamp }

  # BOOLEAN
  - { pattern: "active_flag", exact: true, fieldBusinessType: systemInternal_flag }
  - { pattern: "*_flag", exact: false, fieldBusinessType: boolean }
  - { pattern: "is_*", exact: false, fieldBusinessType: boolean }

  # DATALABEL (Settings Dropdowns)
  - { pattern: "dl__*_stage", exact: false, fieldBusinessType: datalabel_dag }
  - { pattern: "dl__*_state", exact: false, fieldBusinessType: datalabel_dag }
  - { pattern: "dl__*_status", exact: false, fieldBusinessType: datalabel_dag }
  - { pattern: "dl__*", exact: false, fieldBusinessType: datalabel }

  # ENTITY REFERENCES
  - { pattern: "*__*_id", exact: false, fieldBusinessType: entityInstance_Id }
  - { pattern: "*__*_ids", exact: false, fieldBusinessType: entityInstance_Ids }
  - { pattern: "*_id", exact: false, fieldBusinessType: entityInstance_Id }

defaultFieldBusinessType: text
```

#### All Field Business Types (80+)

```
IDENTITY: uuid, code, name, title, subject, description, summary
CONTACT: email, phone, url
ADDRESS: address, country, postal_code
CURRENCY: currency, currency_cents, percentage
NUMBERS: quantity, count, number, sort_order
DATE/TIME: date, timestamp, time, duration, duration_minutes, duration_hours
BOOLEAN: boolean, status_flag
DATALABEL: datalabel, datalabel_dag
REFERENCES: entityInstance_Id, entityInstance_Ids
MEASUREMENTS: area_sqft, volume_m3, weight_kg, file_size
SYSTEM: systemInternal_ts, systemInternal_flag, version
```

---

### File 2: view-type-mapping.yaml

**Purpose:** Define how each fieldBusinessType renders in VIEW mode

**Size:** ~1750 lines, 80+ fieldBusinessTypes

#### Structure

```yaml
# Width constants at top
widths:
  xs: &width_xs "60px"
  sm: &width_sm "80px"
  # ...

# Component defaults
defaults:
  table: &table_default
    visible: true
    sortable: true
    filterable: true
  # ...

fieldBusinessTypes:
  <fieldBusinessType>:
    dtype: <data_type>           # REQUIRED - Database/JS data type
    inherit: <other_type>        # Optional - Inherit from another type

    entityListOfInstancesTable:
      renderType: <type>         # How to display (text, currency, badge, etc.)
      behavior: { visible, sortable, filterable, searchable }
      style: { width, align, symbol, decimals, ... }

    entityInstanceFormContainer:
      renderType: <type>
      behavior: { visible }
      style: { ... }

    kanbanView: ...
    gridView: ...
    calendarView: ...
```

#### renderType Values

| renderType | Description | Example Output |
|------------|-------------|----------------|
| `text` | Plain text | "Kitchen Renovation" |
| `number` | Numeric | "1,250" |
| `currency` | Currency | "$50,000.00" |
| `percentage` | Percentage | "85%" |
| `date` | Date | "Jan 15, 2025" |
| `timestamp` | DateTime | "2 hours ago" |
| `boolean` | Boolean | "Yes" / "No" |
| `badge` | Colored badge | Planning |
| `entityInstanceId` | Entity link | "James Miller" |
| `entityInstanceIds` | Multi-links | "John, Sarah, +2" |
| `tags` | Tag chips | "urgent" "priority" |

#### Example: Currency Field

```yaml
currency:
  dtype: float
  entityListOfInstancesTable:
    <<: *table_default
    renderType: currency
    style: { align: right, width: *width_xl, symbol: "$", decimals: 2, locale: en-CA }
  entityInstanceFormContainer:
    <<: *form_default
    renderType: currency
    style: { symbol: "$", decimals: 2 }
```

#### Example: System Timestamp (Read-Only)

```yaml
systemInternal_ts:
  dtype: timestamp
  entityListOfInstancesTable:
    <<: *hidden
    renderType: timestamp
    style: { width: *width_xl, format: relative }
  entityInstanceFormContainer:
    <<: *form_default
    renderType: timestamp
    behavior: { editable: false }
```

---

### File 3: edit-type-mapping.yaml

**Purpose:** Define how each fieldBusinessType renders in EDIT mode

**Size:** ~1419 lines, 80+ fieldBusinessTypes

#### inputType Values

**HTML5 Native (NO component field):**

| inputType | HTML Element |
|-----------|--------------|
| `text` | `<input type="text">` |
| `textarea` | `<textarea>` |
| `number` | `<input type="number">` |
| `date` | `<input type="date">` |
| `checkbox` | `<input type="checkbox">` |
| `readonly` | Display only |
| `hidden` | `<input type="hidden">` |

**Custom Components (WITH component field):**

| inputType | component | Use Case |
|-----------|-----------|----------|
| `component` | `DataLabelSelect` | Datalabel dropdowns |
| `component` | `BadgeDropdownSelect` | DAG workflow stages |
| `component` | `EntityInstanceSelect` | Entity reference select |
| `component` | `EntityInstanceMultiSelect` | Multi-entity select |

#### Critical Rule: inputType vs component

```yaml
# CORRECT (HTML5 input - NO component)
currency:
  entityListOfInstancesTable:
    inputType: number
    validation: { min: 0 }

# CORRECT (Custom component)
datalabel:
  lookupSourceTable: datalabel
  entityListOfInstancesTable:
    inputType: component
    component: DataLabelSelect

# WRONG (Cannot mix HTML5 inputType with component!)
currency:
  entityListOfInstancesTable:
    inputType: number
    component: CurrencyInput  # ERROR!
```

---

### Width Constants

**Location:** `view-type-mapping.yaml` (lines 471-480)

Centralized column width definitions using YAML anchors for consistent table layouts:

```yaml
widths:
  xs: &width_xs "60px"      # avatar, tiny indicators
  sm: &width_sm "80px"      # boolean, icon, sort_order, file_extension
  md: &width_md "100px"     # duration, percentage, quantity, time, score
  lg: &width_lg "120px"     # date, country, measurements, rating, status
  xl: &width_xl "140px"     # currency, code, datalabel, phone, reference
  xxl: &width_2xl "160px"   # timestamp, tracking_number
  wide: &width_wide "200px" # email, url
  xwide: &width_xwide "250px" # name, address
  file: &width_file "150px" # file, barcode
```

**Usage:**
```yaml
currency:
  entityListOfInstancesTable:
    style: { width: *width_xl, align: right }  # Resolves to "140px"

name:
  entityListOfInstancesTable:
    style: { width: *width_xwide, bold: true }  # Resolves to "250px"
```

**Benefits:**
- Single source of truth for column widths
- Self-documenting (`*width_xl` vs magic string `"140px"`)
- Easy responsive design updates
- Consistent sizing across field types

---

## Frontend: Formatter Service

**Location:** `apps/web/src/lib/`

The frontend is a **pure renderer** that executes backend instructions with **zero pattern detection**.

### Core Types

```typescript
// ComponentMetadata - Required structure from backend
interface ComponentMetadata {
  viewType: Record<string, ViewFieldMetadata>;
  editType: Record<string, EditFieldMetadata>;
}

// ViewFieldMetadata
interface ViewFieldMetadata {
  dtype: string;
  label: string;
  renderType?: string;              // 'entityInstanceId', 'badge', 'currency', etc.
  component?: string;               // 'EntityInstanceName', 'DAGVisualizer'
  lookupSourceTable?: 'entityInstance' | 'datalabel';
  lookupEntity?: string;            // Entity code for entity references
  lookupField?: string;             // Field name for datalabel lookup
  behavior: { visible?: boolean; sortable?: boolean };
  style: Record<string, any>;
}

// FormattedRow - Output of formatDataset
interface FormattedRow<T> {
  raw: T;                           // Original values (for mutations)
  display: Record<string, string>;  // Pre-formatted display strings
  styles: Record<string, string>;   // CSS classes (badges only)
}
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/formatters/types.ts` | TypeScript types for ComponentMetadata |
| `lib/formatters/datasetFormatter.ts` | formatDataset, formatRow, formatValue |
| `lib/formatters/valueFormatters.ts` | Currency, date, badge, reference formatters |
| `lib/frontEndFormatterService.tsx` | renderEditModeFromMetadata |
| `lib/fieldRenderer/FieldRenderer.tsx` | Unified VIEW/EDIT component |
| `lib/fieldRenderer/ComponentRegistry.ts` | VIEW/EDIT component registries |
| `db/tanstack-index.ts` | Sync cache accessors |

---

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REACTIVE FORMATTING FLOW (v12.6.0)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  // QUERY 1: Metadata (30-min cache)                                         │
│  const { viewType, editType } = useEntityInstanceMetadata(entityCode);      │
│  const metadata = useMemo(() => ({ viewType, editType }), [...]);           │
│                                                                              │
│  // QUERY 2: Data (5-min cache)                                              │
│  const { data: rawData } = useEntityInstanceData(entityCode);               │
│                                                                              │
│  // FORMAT-AT-READ (with cache subscription)                                 │
│  const { data: formattedData } = useFormattedEntityData(                    │
│    rawData, metadata, entityCode                                            │
│  );                                                                          │
│                                                                              │
│  FORMATTER EXECUTION:                                                        │
│  ────────────────────                                                        │
│  formatDataset(rawData, metadata)                                           │
│    └── formatRow(row, viewType)                                             │
│        └── formatValue(value, key, viewType[key])                           │
│            └── switch on renderType                                          │
│                ├── 'currency' → formatCurrency()                            │
│                ├── 'badge' → formatBadge() + getDatalabelSync()             │
│                ├── 'entityInstanceId' → getEntityInstanceNameSync()         │
│                └── 'text' → String(value)                                   │
│                                                                              │
│  OUTPUT FormattedRow:                                                        │
│  ────────────────────                                                        │
│  {                                                                           │
│    raw: { budget: 50000, manager__employee_id: 'uuid-james' },              │
│    display: { budget: '$50,000.00', manager__employee_id: 'James Miller'},  │
│    styles: { dl__project_stage: 'bg-blue-100 text-blue-700' }               │
│  }                                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### FieldRenderer Architecture

The FieldRenderer system provides **modular, metadata-driven** field rendering via component registries.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FIELDRENDERER RESOLUTION (v12.2.0)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FieldRenderer receives:                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ field: { key, renderType, inputType, vizContainer, lookupEntity, ... }  ││
│  │ value: row.raw[key]                                                      ││
│  │ formattedData: { display, styles }                                       ││
│  │ isEditing: boolean                                                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                        │                                     │
│                    ┌───────────────────┴───────────────────┐                │
│                    │                                       │                │
│                    ▼                                       ▼                │
│          ┌─────────────────────┐             ┌─────────────────────┐       │
│          │ VIEW MODE           │             │ EDIT MODE           │       │
│          │ Uses: renderType    │             │ Uses: inputType     │       │
│          └─────────┬───────────┘             └─────────┬───────────┘       │
│                    │                                   │                    │
│       ┌────────────┼────────────┐         ┌────────────┼────────────┐      │
│       ▼            ▼            ▼         ▼            ▼            ▼      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │component│ │ badge   │ │currency │ │component│ │ select  │ │ text    │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       ▼           ▼           ▼           ▼           ▼           ▼        │
│  ViewComponent  ViewField   ViewField  EditComponent EditField  EditField │
│  Registry       Renderer    Renderer   Registry      Renderer   Renderer  │
│  (DAGVisualizer)(badge)    (currency) (BadgeDropdown)(select)   (input)   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Component Registries

| Registry | Mode | Resolution |
|----------|------|------------|
| `ViewComponentRegistry` | VIEW | `renderType='component'` → lookup by component name |
| `EditComponentRegistry` | EDIT | `inputType='component'` → lookup by component name |
| `ViewFieldRenderer` | VIEW | Inline types (`currency`, `badge`, `timestamp`) |
| `EditFieldRenderer` | EDIT | HTML5 inputs (`text`, `number`, `date`) |

#### Registered Components

**VIEW Mode:**

| Component | Use Case |
|-----------|----------|
| `DAGVisualizer` | Workflow stage visualization |
| `MetadataTable` | JSONB key-value display |
| `EntityInstanceName` | Single entity reference |
| `timestamp` | Relative time with tooltip |
| `badge` | Colored status badge |

**EDIT Mode:**

| Component | Use Case |
|-----------|----------|
| `BadgeDropdownSelect` | Colored dropdown for datalabels |
| `EntityInstanceSelect` | Single entity selector |
| `EntityInstanceMultiSelect` | Multi-entity selector |

---

## Entity Reference Resolution

The frontend uses **TanStack Query cache** for sync entity name resolution - no prop drilling required.

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
│                                                                              │
│  3. FORMATTER: formatReference(uuid, { lookupEntity: 'employee' })          │
│     └── getEntityInstanceNameSync('employee', uuid)                         │
│     └── Returns 'James Miller' (or truncated UUID if not found)             │
│                                                                              │
│  ✓ Sync access - no promises, no async                                       │
│  ✓ Populated at login - instant resolution                                   │
│  ✓ No prop drilling through component tree                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sync Accessors

```typescript
import { getEntityInstanceNameSync, getDatalabelSync } from '@/db/tanstack-index';

// Entity reference resolution
const employeeName = getEntityInstanceNameSync('employee', 'uuid-123');
// → 'James Miller' (from cache) or null

// Datalabel color lookup
const options = getDatalabelSync('dl__project_stage');
// → [{ name: 'planning', label: 'Planning', color_code: 'blue' }]
```

---

## Adding New Field Types

Adding a new field type requires **zero TypeScript code changes** - just edit 3 YAML files.

### Example: Add "phone_extension" Field Type

**Step 1: pattern-mapping.yaml**

```yaml
- { pattern: "*_extension", exact: false, fieldBusinessType: phone_extension }
```

**Step 2: view-type-mapping.yaml**

```yaml
phone_extension:
  dtype: str
  entityListOfInstancesTable:
    <<: *table_default
    renderType: text
    style: { width: *width_sm, monospace: true }
  entityInstanceFormContainer:
    <<: *form_default
    renderType: text
```

**Step 3: edit-type-mapping.yaml**

```yaml
phone_extension:
  dtype: str
  entityListOfInstancesTable:
    inputType: text
    behavior: { editable: true }
    validation: { pattern: "^[0-9]{1,10}$", maxLength: 10 }
  entityInstanceFormContainer:
    inputType: text
    behavior: { editable: true }
    style: { placeholder: "1234" }
    validation: { pattern: "^[0-9]{1,10}$", maxLength: 10 }
```

**Done!** Restart API server - all `*_extension` fields automatically use the new type.

---

## Anti-Patterns & Best Practices

### Frontend Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Pattern detection | Duplicates backend logic | Use `metadata.renderType` |
| `_id` suffix check | Hardcoded pattern | Use `metadata.lookupEntity` |
| Formatting during render | Slow scroll | Format-at-read via `useMemo` |
| Passing refData props | Deprecated | Use `getEntityInstanceNameSync()` |

### No Pattern Detection

```typescript
// WRONG: Pattern detection
if (field.key.endsWith('_id')) {
  // Assume it's an entity reference
}

// CORRECT: Use backend metadata
if (metadata.renderType === 'entityInstanceId') {
  return formatReference(value, metadata);
}
```

### No Fallback Formatting

```typescript
// WRONG: Silent fallback
if (!formattedData?.display) {
  if (field.key.includes('_amt')) displayValue = formatCurrency(value);
}

// CORRECT: Require metadata
if (!formattedData?.display) {
  console.error(`Missing formatted data for ${field.key}`);
  return <span className="text-red-500">Missing data</span>;
}
```

### Backend Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Adding renderType at root level | Invalid YAML structure | Put in component section |
| Mixing inputType with component | Ambiguous rendering | Use `inputType: component` for custom |
| Generic patterns first | Wrong match | Specific patterns first |
| Magic width strings | Hard to maintain | Use `*width_xl` anchors |

---

## Performance & Caching

### Backend (YAML)

| Metric | Value |
|--------|-------|
| YAML Load Time | ~5ms (first load) |
| YAML Cache Time | In-memory until restart |
| Pattern Match Time | ~0.1ms per field |
| Metadata Generation | ~1ms per entity |
| Memory Usage | ~500KB for 3 YAML files |

### Redis Caching

| Cache | Key Pattern | TTL |
|-------|-------------|-----|
| Field Names | `entity:fields:{entityCode}` | 24 hours |
| Metadata Response | `api:metadata:{apiPath}` | 3 seconds |

```typescript
// Field cache functions
getCachedFieldNames(entityCode)      // Redis lookup
cacheFieldNames(entityCode, fields)  // Redis store
invalidateFieldCache(entityCode)     // Clear on schema change
clearAllFieldCache()                 // Maintenance

// Metadata cache functions
getCachedMetadataResponse(apiPath)
cacheMetadataResponse(apiPath, response)
invalidateMetadataCache(entityCode)
clearAllMetadataCache()
```

### Frontend (Formatter)

| Optimization | Impact |
|--------------|--------|
| Format-at-read (useMemo) | Cache stores small RAW data |
| TanStack Query cache | Entity names O(1) lookup |
| Sync cache access | No async/await in formatters |
| Direct property access | Zero function calls during scroll |
| Pre-computed styles | Badge CSS computed once |
| Virtualization compatible | Works with @tanstack/react-virtual |

### TanStack Query Cache Keys

| Cache | Query Key | TTL |
|-------|-----------|-----|
| Entity Names | `['entityInstanceNames', entityCode]` | Login prefetch |
| Entity Data | `['entityInstanceData', entityCode, params]` | 5 min |
| Metadata | `['entityInstanceMetadata', entityCode]` | 30 min |
| Datalabel | `['datalabel', key]` | 10 min |

---

## Related Documentation

- [entity-component-metadata.service.md](../services/entity-component-metadata.service.md) - Backend service API
- [ENTITY_METADATA_CACHING.md](../caching-backend/ENTITY_METADATA_CACHING.md) - Redis field cache
- [TANSTACK_DEXIE_SYNC_ARCHITECTURE.md](../caching/TANSTACK_DEXIE_SYNC_ARCHITECTURE.md) - Real-time sync
- [BadgeDropdownSelect.md](../ui_components/BadgeDropdownSelect.md) - Badge dropdown component

---

**Version:** 12.7.0 | **Updated:** 2025-12-11

**Recent Updates:**
- v12.7.0: Added comprehensive metadata composition logic flow with step-by-step resolution, worked examples, and width constants documentation
- v12.6.0: Reactive formatting with cache subscription, useFormattedEntityData hook
- v12.2.0: FieldRenderer architecture with component registries
- v11.0.0: TanStack Query cache for entity references, removed refData prop drilling
- v11.0.0: YAML-based pattern detection (replaced ~900 lines of hardcoded rules)
