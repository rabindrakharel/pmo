# YAML-Based Pattern Detection System (v11.0.0+)

**Version**: 11.0.0+
**Status**: Production (YAML is sole source of truth)
**Files**: 3 YAML config files + TypeScript loader
**Total Patterns**: 100+ column patterns, 80+ fieldBusinessTypes

---

## Executive Summary

As of **v11.0.0**, the PMO platform uses a **3-step YAML-based pipeline** for field metadata generation:

```
Column Name → Pattern Matching → Field Business Type → View/Edit Config → API Response
```

**Legacy Code Removed**:
- ❌ ~900 lines of hardcoded `PATTERN_RULES` (deleted in v11.0.0)
- ❌ Hardcoded `if/else` pattern detection functions
- ❌ Per-field component logic in TypeScript

**Current Architecture**:
- ✅ **3 YAML files** define ALL pattern rules and metadata
- ✅ **Zero code changes** needed for new field types
- ✅ **Component-specific overrides** (table vs form can differ)
- ✅ **Runtime YAML loading** with in-memory caching

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                  3-STEP YAML PATTERN PIPELINE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: Column Name → fieldBusinessType                            │
│  ────────────────────────────────────────────────────────           │
│  File: pattern-mapping.yaml (466 lines, 100+ patterns)              │
│                                                                      │
│  Input:  "budget_allocated_amt"                                     │
│  Match:  pattern: "*_amt" → fieldBusinessType: "currency"           │
│  Output: "currency"                                                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ # pattern-mapping.yaml                                    │      │
│  │ patterns:                                                 │      │
│  │   - { pattern: "*_amt", exact: false, fieldBusinessType: currency }│  │
│  │   - { pattern: "dl__*", exact: false, fieldBusinessType: datalabel }│  │
│  │   - { pattern: "*__*_id", exact: false, fieldBusinessType: entityInstance_Id }│ │
│  │ defaultFieldBusinessType: text                            │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 2a: fieldBusinessType → VIEW Config                           │
│  ────────────────────────────────────────────────────────           │
│  File: view-type-mapping.yaml (1720 lines, 80+ types)               │
│                                                                      │
│  Input:  "currency"                                                 │
│  Output: renderType: "currency", style: {symbol:"$", decimals:2}   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ # view-type-mapping.yaml                                  │      │
│  │ fieldBusinessTypes:                                       │      │
│  │   currency:                                               │      │
│  │     dtype: float                                          │      │
│  │     entityListOfInstancesTable:                                  │      │
│  │       renderType: currency                                │      │
│  │       style: { align: right, symbol: "$", decimals: 2 }   │      │
│  │     entityInstanceFormContainer:                                 │      │
│  │       renderType: currency                                │      │
│  │       style: { symbol: "$", decimals: 2 }                 │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 2b: fieldBusinessType → EDIT Config                           │
│  ────────────────────────────────────────────────────────           │
│  File: edit-type-mapping.yaml (1419 lines, 80+ types)               │
│                                                                      │
│  Input:  "currency"                                                 │
│  Output: inputType: "number", validation: {min:0}                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ # edit-type-mapping.yaml                                  │      │
│  │ fieldBusinessTypes:                                       │      │
│  │   currency:                                               │      │
│  │     dtype: float                                          │      │
│  │     entityListOfInstancesTable:                                  │      │
│  │       inputType: number                                   │      │
│  │       validation: { min: 0 }                              │      │
│  │     entityInstanceFormContainer:                                 │      │
│  │       inputType: number                                   │      │
│  │       style: { symbol: "$", decimals: 2 }                 │      │
│  │       validation: { min: 0 }                              │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

API Response Output:
────────────────────
{
  "data": [{"budget_allocated_amt": 50000}],
  "metadata": {
    "entityListOfInstancesTable": {
      "viewType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "renderType": "currency",
          "style": { "symbol": "$", "decimals": 2, "align": "right" }
        }
      },
      "editType": {
        "budget_allocated_amt": {
          "dtype": "float",
          "label": "Budget Allocated",
          "inputType": "number",
          "validation": { "min": 0 }
        }
      }
    }
  }
}
```

---

## File 1: pattern-mapping.yaml

**Purpose**: Map column names to semantic field business types

**Location**: `apps/api/src/services/pattern-mapping.yaml`

**Size**: 466 lines, 100+ patterns

### Pattern Syntax

| Pattern Type | Syntax | Example Column | Matches? |
|--------------|--------|----------------|----------|
| **Exact** | `exact: true` | `name` matches column `name` | ✅ Yes |
| **Exact** | `exact: true` | `name` matches column `first_name` | ❌ No |
| **Wildcard Suffix** | `*_amt` | `budget_allocated_amt` | ✅ Yes |
| **Wildcard Suffix** | `*_amt` | `total_cost_amt` | ✅ Yes |
| **Wildcard Prefix** | `dl__*` | `dl__project_stage` | ✅ Yes |
| **Wildcard Prefix** | `dl__*` | `dl__customer_status` | ✅ Yes |
| **Wildcard Both** | `*__*_id` | `manager__employee_id` | ✅ Yes |
| **Wildcard Both** | `*__*_id` | `sponsor__client_id` | ✅ Yes |

### Pattern Matching Rules

1. **First Match Wins** - Patterns are evaluated in order from top to bottom
2. **Specific Before Generic** - Place more specific patterns BEFORE generic ones
3. **Exact Before Wildcard** - Exact matches should come before wildcard matches

### Example Patterns (Top 20)

```yaml
# IDENTITY & CORE
  - { pattern: "id", exact: true, fieldBusinessType: uuid }
  - { pattern: "code", exact: true, fieldBusinessType: code }
  - { pattern: "name", exact: true, fieldBusinessType: name }
  - { pattern: "descr", exact: true, fieldBusinessType: description }

# CONTACT
  - { pattern: "email", exact: true, fieldBusinessType: email }
  - { pattern: "*_email", exact: false, fieldBusinessType: email }
  - { pattern: "phone", exact: true, fieldBusinessType: phone }
  - { pattern: "*_phone", exact: false, fieldBusinessType: phone }

# CURRENCY
  - { pattern: "*_amt", exact: false, fieldBusinessType: currency }
  - { pattern: "*_price", exact: false, fieldBusinessType: currency }
  - { pattern: "*_cost", exact: false, fieldBusinessType: currency }

# PERCENTAGE
  - { pattern: "*_pct", exact: false, fieldBusinessType: percentage }
  - { pattern: "*_percent", exact: false, fieldBusinessType: percentage }

# DATE & TIME
  - { pattern: "*_date", exact: false, fieldBusinessType: date }
  - { pattern: "created_ts", exact: true, fieldBusinessType: systemInternal_ts }
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
  - { pattern: "*_ids", exact: false, fieldBusinessType: entityInstance_Ids }

# Default fallback
defaultFieldBusinessType: text
```

### All Field Business Types (80+)

```yaml
# IDENTITY & CORE
uuid, code, name, title, subject, description, summary

# CONTACT
email, phone, url

# ADDRESS
address, country, postal_code

# CURRENCY & NUMBERS
currency, currency_cents, percentage
quantity, count, number, sort_order

# DATE & TIME
date, timestamp, timestamp_readonly, time
duration, duration_minutes, duration_hours, duration_seconds, duration_ms

# BOOLEAN
boolean, status_flag

# DATALABEL & REFERENCES
datalabel, datalabel_dag
entityInstance_Id, entityInstance_Ids

# MEASUREMENTS
area_sqft, volume_m3, dimension_cm, weight_kg, file_size, capacity

# RATING & SCORE
rating, score

# COORDINATES
latitude, longitude, geolocation

# TEXT CONTENT
text, text_long, rich_text

# JSON & STRUCTURED
json, json_schema, tags

# FILE & MEDIA
file, image, avatar, signature, video

# S3/STORAGE
s3_bucket, s3_key, s3_url, s3_region, hash, mime_type, file_extension

# BARCODE
barcode, sku, upc

# COLOR
color

# STATUS & STATE
status, state_workflow, stage

# CATEGORY & TYPE
type, category

# IDENTIFICATION
sensitive_id, tax_id, reference_number, invoice_number, order_number, po_number, tracking_number

# SECURITY
username, password_hash, token, ip_address, user_agent

# UI
icon, label

# SYSTEM
version
systemInternal_ts, systemInternal_SCD2_ts, systemInternal_flag
```

---

## File 2: view-type-mapping.yaml

**Purpose**: Define how each fieldBusinessType renders in VIEW mode

**Location**: `apps/api/src/services/view-type-mapping.yaml`

**Size**: 1720 lines, 80+ fieldBusinessTypes

### Structure

Each `fieldBusinessType` defines component-specific VIEW configs:

```yaml
fieldBusinessTypes:
  <fieldBusinessType>:
    dtype: <data_type>                    # REQUIRED - Only at root level
    inherit: <other_type>                 # Optional - Inherit settings

    # Component-specific VIEW config:
    entityListOfInstancesTable:
      renderType: <type>                  # How to display (text, currency, badge, etc.)
      behavior: { visible, sortable, filterable, searchable }
      style: { width, align, symbol, decimals, ... }

    entityInstanceFormContainer:
      renderType: <type>
      behavior: { visible }
      style: { ... }

    kanbanView:
      renderType: <type>
      behavior: { visible }
      style: { ... }

    gridView: ...
    calendarView: ...
    dagView: ...
```

### renderType Values (Native Inline Rendering)

All rendering is done INLINE by `formatDataset()` - **no separate cell components**:

| renderType | Description | Example Output |
|------------|-------------|----------------|
| `text` | Plain text | "Kitchen Renovation" |
| `number` | Numeric | "1,250" |
| `currency` | Currency | "$50,000.00" |
| `percentage` | Percentage | "85%" |
| `date` | Date | "01/15/2025" |
| `timestamp` | DateTime | "2 hours ago" |
| `time` | Time | "14:30" |
| `duration` | Duration | "2h 30m" |
| `boolean` | Boolean | "Yes" / "No" |
| `filesize` | File size | "2.5 MB" |
| `badge` | Colored badge | <span style="bg-blue-100">Planning</span> |
| `entityLink` | Entity link | "James Miller →" |
| `entityLinks` | Multi-links | "John, Sarah, +2" |
| `tags` | Tag chips | "urgent priority" |
| `file` | File link | "document.pdf 📄" |
| `image` | Image | 🖼️ thumbnail |
| `avatar` | Avatar | 👤 circular image |
| `color` | Color swatch | 🟦 #3B82F6 |
| `icon` | Icon | 📁 folder icon |
| `json` | JSON preview | `{...}` collapsed |

### Example: Currency Field

```yaml
currency:
  dtype: float
  entityListOfInstancesTable:
    renderType: currency
    behavior: { visible: true, sortable: true, filterable: true }
    style: { align: right, width: "140px", symbol: "$", decimals: 2, locale: en-CA }
  entityInstanceFormContainer:
    renderType: currency
    behavior: { visible: true }
    style: { symbol: "$", decimals: 2 }
  kanbanView:
    renderType: currency
    behavior: { visible: true }
    style: { compact: true }
```

### Example: Datalabel Field (Badge)

```yaml
datalabel:
  dtype: str
  entityListOfInstancesTable:
    renderType: badge
    behavior: { visible: true, sortable: true, filterable: true }
    style: { width: "140px", colorFromData: true }
  entityInstanceFormContainer:
    renderType: badge
    behavior: { visible: true }
    style: { showHierarchy: false }
  kanbanView:
    renderType: badge
    behavior: { visible: true }
```

### Example: Entity Reference Field

```yaml
entityInstance_Id:
  dtype: uuid
  entityListOfInstancesTable:
    renderType: component
    component: EntityInstanceName
    behavior: { visible: true, sortable: false }
    style: { displayField: name, linkToEntity: true }
  entityInstanceFormContainer:
    renderType: component
    component: EntityInstanceName
    behavior: { visible: true }
```

---

## File 3: edit-type-mapping.yaml

**Purpose**: Define how each fieldBusinessType renders in EDIT mode

**Location**: `apps/api/src/services/edit-type-mapping.yaml`

**Size**: 1419 lines, 80+ fieldBusinessTypes

### Structure

```yaml
fieldBusinessTypes:
  <fieldBusinessType>:
    dtype: <data_type>                    # REQUIRED - Only at root level
    lookupSourceTable: <source>           # For select fields: "datalabel" or "entityInstance"
    inherit: <other_type>                 # Optional - Inherit settings

    # Component-specific EDIT config:
    entityListOfInstancesTable:
      inputType: <type>                   # HTML5 input or "component"
      component: <name>                   # ONLY when inputType is "component"
      behavior: { editable, filterable, sortable, visible }
      style: { ... }
      validation: { required, min, max, pattern, ... }

    entityInstanceFormContainer:
      inputType: <type>
      component: <name>
      behavior: { editable }
      style: { ... }
      validation: { ... }

    kanbanView: ...
    gridView: ...
```

### inputType Values

#### HTML5 Native Input Types (NO component field!)

| inputType | HTML Element | Example Use |
|-----------|--------------|-------------|
| `text` | `<input type="text">` | Name, code fields |
| `textarea` | `<textarea>` | Description, notes |
| `email` | `<input type="email">` | Email validation |
| `tel` | `<input type="tel">` | Phone numbers |
| `url` | `<input type="url">` | Website URLs |
| `number` | `<input type="number">` | Quantities, amounts |
| `date` | `<input type="date">` | Date picker |
| `time` | `<input type="time">` | Time picker |
| `datetime-local` | `<input type="datetime-local">` | DateTime picker |
| `checkbox` | `<input type="checkbox">` | Boolean toggles |
| `color` | `<input type="color">` | Color picker |
| `file` | `<input type="file">` | File upload |
| `range` | `<input type="range">` | Slider (percentage) |
| `hidden` | `<input type="hidden">` | Hidden fields |
| `readonly` | Display only | Non-editable |

#### Custom Component Types (WITH component field!)

| inputType | component | Example Use |
|-----------|-----------|-------------|
| `component` | `DataLabelSelect` | Datalabel dropdowns |
| `component` | `BadgeDropdownSelect` | DAG datalabel dropdowns |
| `component` | `EntityInstanceNameSelect` | Entity reference select |
| `component` | `EntityInstanceNameMultiSelect` | Multi-entity select |
| `component` | `EditableTags` | Tag input |
| `component` | `MetadataTable` | JSON editor |
| `component` | `StatusSelect` | Status dropdown |

### CRITICAL RULE: inputType vs component

```yaml
# ✅ CORRECT (HTML5 input - NO component)
currency:
  entityListOfInstancesTable:
    inputType: number
    validation: { min: 0 }

# ✅ CORRECT (Custom component)
datalabel:
  lookupSourceTable: datalabel
  entityListOfInstancesTable:
    inputType: component
    component: DataLabelSelect

# ❌ WRONG (HTML5 input WITH component - INVALID!)
currency:
  entityListOfInstancesTable:
    inputType: number
    component: CurrencyInput  # ERROR! Cannot mix HTML5 inputType with component
```

### Example: Currency Field

```yaml
currency:
  dtype: float
  entityListOfInstancesTable:
    inputType: number
    behavior: { editable: true, filterable: true, sortable: true }
    validation: { min: 0 }
  entityInstanceFormContainer:
    inputType: number
    behavior: { editable: true }
    style: { symbol: "$", decimals: 2, locale: en-CA }
    validation: { min: 0 }
```

### Example: Datalabel Field (Dropdown)

```yaml
datalabel:
  dtype: str
  lookupSourceTable: datalabel
  entityListOfInstancesTable:
    inputType: component
    component: DataLabelSelect
    behavior: { editable: true, filterable: true }
  entityInstanceFormContainer:
    inputType: component
    component: DataLabelSelect
    behavior: { editable: true }
    style: { showColor: true, searchable: true }
```

### Example: Entity Reference Field

```yaml
entityInstance_Id:
  dtype: uuid
  lookupSourceTable: entityInstance
  entityListOfInstancesTable:
    inputType: EntityInstanceNameSelect
    behavior: { editable: true, filterable: true }
  entityInstanceFormContainer:
    inputType: EntityInstanceNameSelect
    behavior: { editable: true }
```

---

## TypeScript Implementation

### Loading YAML Files

```typescript
// apps/api/src/services/entity-component-metadata.service.ts

import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

// In-memory cache (loaded once per server start)
let _patternMapping: PatternMappingYaml | null = null;
let _viewTypeMapping: ViewTypeMappingYaml | null = null;
let _editTypeMapping: EditTypeMappingYaml | null = null;

function loadPatternMapping(): PatternMappingYaml {
  if (!_patternMapping) {
    const filePath = join(__dirname, 'pattern-mapping.yaml');
    const content = readFileSync(filePath, 'utf-8');
    _patternMapping = yaml.load(content) as PatternMappingYaml;
  }
  return _patternMapping;
}

function loadViewTypeMapping(): ViewTypeMappingYaml {
  if (!_viewTypeMapping) {
    const filePath = join(__dirname, 'view-type-mapping.yaml');
    const content = readFileSync(filePath, 'utf-8');
    _viewTypeMapping = yaml.load(content) as ViewTypeMappingYaml;
  }
  return _viewTypeMapping;
}

function loadEditTypeMapping(): EditTypeMappingYaml {
  if (!_editTypeMapping) {
    const filePath = join(__dirname, 'edit-type-mapping.yaml');
    const content = readFileSync(filePath, 'utf-8');
    _editTypeMapping = yaml.load(content) as EditTypeMappingYaml;
  }
  return _editTypeMapping;
}
```

### Pattern Matching

```typescript
/**
 * Match column name to fieldBusinessType using pattern-mapping.yaml
 */
function matchFieldBusinessType(fieldName: string): string {
  const mapping = loadPatternMapping();

  // First match wins - order matters!
  for (const pattern of mapping.patterns) {
    if (pattern.exact) {
      // Exact match: "name" matches "name" only
      if (pattern.pattern === fieldName) {
        return pattern.fieldBusinessType;
      }
    } else {
      // Wildcard match: "*_amt" matches "budget_amt", "total_amt", etc.
      if (wildcardMatch(fieldName, pattern.pattern)) {
        return pattern.fieldBusinessType;
      }
    }
  }

  // No match found - use default
  return mapping.defaultFieldBusinessType; // "text"
}

/**
 * Wildcard matching: * matches any characters
 */
function wildcardMatch(str: string, pattern: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(str);
}
```

### Metadata Generation

```typescript
/**
 * Generate complete entity response with metadata
 */
export async function generateEntityResponse(
  entityCode: string,
  data: any[],
  pagination: { total: number; limit: number; offset: number }
): Promise<EntityResponse> {
  // Step 1: Get field names (from Redis cache or data)
  const fields = await getCachedFieldNames(entityCode) || extractFieldNames(data);

  // Step 2: Load YAML mappings
  const viewMapping = loadViewTypeMapping();
  const editMapping = loadEditTypeMapping();

  // Step 3: Generate metadata for each field
  const metadata: EntityMetadata = {
    entityListOfInstancesTable: {
      viewType: {},
      editType: {}
    }
  };

  for (const fieldName of fields) {
    // Step 3a: Match field name to businessType
    const businessType = matchFieldBusinessType(fieldName);

    // Step 3b: Get VIEW config from YAML
    const viewConfig = viewMapping.fieldBusinessTypes[businessType];
    metadata.entityListOfInstancesTable.viewType[fieldName] = {
      dtype: viewConfig.dtype,
      label: humanizeLabel(fieldName),
      ...viewConfig.entityListOfInstancesTable
    };

    // Step 3c: Get EDIT config from YAML
    const editConfig = editMapping.fieldBusinessTypes[businessType];
    metadata.entityListOfInstancesTable.editType[fieldName] = {
      dtype: editConfig.dtype,
      label: humanizeLabel(fieldName),
      ...editConfig.entityListOfInstancesTable
    };

    // Step 3d: For datalabel fields, add lookupField
    if (businessType === 'datalabel' || businessType === 'datalabel_dag') {
      metadata.entityListOfInstancesTable.viewType[fieldName].lookupField = fieldName;
      metadata.entityListOfInstancesTable.editType[fieldName].lookupField = fieldName;
    }

    // Step 3e: For entity reference fields, add lookupEntity
    if (businessType === 'entityInstance_Id' || businessType === 'entityInstance_Ids') {
      const entityName = extractEntityName(fieldName); // "manager__employee_id" → "employee"
      metadata.entityListOfInstancesTable.viewType[fieldName].lookupEntity = entityName;
      metadata.entityListOfInstancesTable.editType[fieldName].lookupEntity = entityName;
    }
  }

  // Step 4: Return complete response
  return {
    data,
    fields,
    metadata,
    total: pagination.total,
    limit: pagination.limit,
    offset: pagination.offset
  };
}
```

---

## Adding New Field Types

### Example: Add "phone_extension" field type

**Step 1: Add pattern to pattern-mapping.yaml**

```yaml
# After the existing phone patterns
  - { pattern: "*_phone", exact: false, fieldBusinessType: phone }
  - { pattern: "*_extension", exact: false, fieldBusinessType: phone_extension }  # NEW
```

**Step 2: Add VIEW config to view-type-mapping.yaml**

```yaml
fieldBusinessTypes:
  # ... existing types

  phone_extension:
    dtype: str
    entityListOfInstancesTable:
      renderType: text
      behavior: { visible: true, sortable: true, filterable: true }
      style: { width: "80px", monospace: true }
    entityInstanceFormContainer:
      renderType: text
      behavior: { visible: true }
      style: { monospace: true, maxLength: 10 }
```

**Step 3: Add EDIT config to edit-type-mapping.yaml**

```yaml
fieldBusinessTypes:
  # ... existing types

  phone_extension:
    dtype: str
    entityListOfInstancesTable:
      inputType: text
      behavior: { editable: true, filterable: true, sortable: true }
      validation: { pattern: "^[0-9]{1,10}$" }
    entityInstanceFormContainer:
      inputType: text
      behavior: { editable: true }
      style: { placeholder: "1234", mask: "####" }
      validation: { pattern: "^[0-9]{1,10}$", maxLength: 10 }
```

**Done!** No TypeScript code changes needed. Restart API server and all `*_extension` fields will automatically use the new type.

---

## Benefits of YAML-Based System

| Aspect | YAML-Based (v11.0.0+) | Legacy Hardcoded (v10.x) |
|--------|-----------------------|--------------------------|
| **Add new field type** | Edit 3 YAML files | Edit TypeScript, rebuild, test, deploy |
| **Change render config** | Edit YAML, restart | Edit code, rebuild, test, deploy |
| **Component-specific overrides** | Separate sections per component | Complex conditional logic |
| **Pattern visibility** | All patterns in one file | Scattered across multiple functions |
| **Testing** | YAML validation, pattern testing | Unit tests, integration tests |
| **Deployment** | Hot-reload YAML (future) | Full rebuild + deploy |
| **Non-technical updates** | Yes (edit YAML) | No (requires developer) |
| **Pattern conflicts** | First-match-wins (predictable) | Hidden in code logic |
| **Documentation** | Self-documenting YAML | Requires code comments |

---

## Migration Notes (v10.x → v11.0.0)

**Removed**:
- ❌ `PATTERN_RULES` object (~900 lines)
- ❌ `detectFieldType()` function with hardcoded if/else
- ❌ Per-field component logic in routes

**Added**:
- ✅ `pattern-mapping.yaml` (466 lines)
- ✅ `view-type-mapping.yaml` (1720 lines)
- ✅ `edit-type-mapping.yaml` (1419 lines)
- ✅ YAML loader functions with caching

**Migration Impact**:
- **Zero breaking changes** - API responses identical
- **Same metadata structure** - Frontend unchanged
- **Performance improvement** - In-memory YAML cache faster than complex conditionals

---

## Performance

| Metric | Value |
|--------|-------|
| YAML Load Time | ~5ms (first load) |
| YAML Cache Time | ∞ (in-memory until server restart) |
| Pattern Match Time | ~0.1ms per field |
| Metadata Generation | ~1ms per entity response |
| Memory Usage | ~500KB for all 3 YAML files |

---

## Related Documentation

- [entity-component-metadata.service.md](../services/entity-component-metadata.service.md) - Service API
- [ENTITY_METADATA_CACHING.md](../caching-backend/ENTITY_METADATA_CACHING.md) - Redis field cache
- [frontEndFormatterService.md](../services/frontEndFormatterService.md) - Frontend rendering

---

**Last Updated**: 2025-12-09
**Version**: 11.0.0+
**Status**: Production - YAML is sole source of truth
**Legacy Code**: Fully removed in v11.0.0
