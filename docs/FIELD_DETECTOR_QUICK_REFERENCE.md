# Field Detector - Quick Reference Guide

## Pattern Detection Summary (802 Columns Analyzed)

### Implemented Patterns ✅

| Pattern | Regex | Count | Status |
|---------|-------|-------|--------|
| **Timestamps** | `_(ts\|at\|timestamp)$` | 30 | ✅ Working |
| **Dates** | `_date$` | 47 | ✅ Working |
| **Foreign Keys** | `_id$` | 59 | ⚠️ Marked readonly (should be FK selector) |
| **Currency** | `_amt$\|_price$\|_cost$` | 16 | ✅ Working via isCurrencyField() |
| **Booleans** | `_flag$\|^is_\|^has_` | 39 | ❌ **CRITICAL BUG: Marked readonly!** |
| **Counts** | `_count$\|_qty$\|_hours$` | 29 | ⚠️ Regex too broad (includes _id) |
| **Percentages** | `_pct$\|_percent$` | 6 | ❌ **MISSING - Not implemented!** |
| **Datalabels** | `^dl__` | 19 | ✅ Working via loadOptionsFromSettings |
| **Standard** | name, code, descr | 5 | ✅ Working |
| **JSONB** | Data type check | 38 | ❌ **MISSING - No editor!** |
| **Arrays** | Data type check `[]` | 28 | ⚠️ Partial (tags only) |
| **Other** | Context-dependent | 486 | ⚠️ Requires manual config |

### Critical Issues Found

#### 1. **BOOLEAN FIELDS MARKED READONLY** ❌❌❌
- **File:** `apps/web/src/lib/data_transform_render.tsx` (line 421)
- **Problem:** Pattern `/^(is_|has_|flag|_flag)/` includes booleans in readonly set
- **Impact:** 39 boolean fields cannot be edited inline
- **Fix:** Move to separate boolean pattern, mark as editable=true

```typescript
// WRONG (current)
FIELD_PATTERNS.readonly: /^(is_|has_|flag|_flag).*|.*_flag$/i

// RIGHT (should be)
FIELD_PATTERNS.boolean: /^(is_|has_).*|.*_flag$/i
// Then in getFieldCapability():
if (FIELD_PATTERNS.boolean.test(key)) {
  return { inlineEditable: true, editType: 'checkbox' };
}
```

#### 2. **PERCENTAGE FIELDS NOT DETECTED** ❌
- **Missing 6 columns:** discount_pct, margin_percent, tax_pct, etc.
- **Fix:** Add to FIELD_PATTERNS

```typescript
FIELD_PATTERNS.percentage: /(_pct|_percent)$/i
```

#### 3. **JSONB FIELDS NOT HANDLED** ❌
- **Missing 38 columns:** metadata, form_schema, workflow_graph, etc.
- **No editor for JSON content**
- **Fix:** Add JSON modal editor

```typescript
// Detect by dataType, not name
if (column.dataType?.includes('jsonb')) {
  return { editType: 'jsonb', editor: 'json-modal' };
}
```

#### 4. **QUANTITY PATTERN TOO BROAD** ⚠️
- **Current:** `/(_count|_qty|_hours|_minutes|_seconds)$/`
- **Problem:** Conflicts with _id pattern
- **Should prioritize:** FK detection before quantity

#### 5. **ARRAY FIELDS PARTIALLY HANDLED** ⚠️
- **Detected:** tags field only
- **Missing:** 27 other array columns (email_subscribers, attachment_ids, etc.)
- **Fix:** Detect all `column_type[]` patterns

---

## Field Pattern Registry

### 1. TIMESTAMPS (30 columns) ✅

**Pattern:** `_ts`, `_at`, `_timestamp`  
**Data Type:** `timestamptz`, `TIMESTAMP`  
**Detection:** Working

```typescript
// Current code (good)
FIELD_PATTERNS.date: /_(date|ts)$|^date_/i

// Output
formatRelativeTime(value)  // "3 days ago"
```

**Improvements needed:**
- Separate business vs system timestamps
- `created_at`, `updated_at` alias support

---

### 2. DATES (47 columns) ✅

**Pattern:** `_date`, `date_`  
**Data Type:** `date`, `DATE`  
**Detection:** Working

```typescript
// Current code (good)
FIELD_PATTERNS.date: /_(date|ts)$|^date_/i

// Output
formatFriendlyDate(value)  // "Oct 28, 2024"
<input type="date" />
```

**Improvements needed:**
- Detect date ranges (start_date + end_date pairs)
- Virtual field detection (v_*_date)
- Progress bar for active date ranges

---

### 3. FOREIGN KEYS (59 columns) ⚠️

**Pattern:** `_id`  
**Data Type:** `uuid`, `UUID`, `text`, `int4`  
**Detection:** Partially working

```typescript
// Current code (problematic)
FIELD_PATTERNS.number: /_(amt|amount|count|qty|quantity|price|cost|revenue|id|level_id|stage_id|sort_order)$/i
// ^^ Too broad, treats _id as number!

// Should be:
FIELD_PATTERNS.foreignKey: /^(project|task|employee|office|product)_id$/i
```

**Smart FK Handling (Already implemented!):**
- Hide FK column (visible=false) in tables
- Auto-generate *_name column (visible=true) showing entity name
- Dropdown select with entity options API

**Improvements needed:**
- Polymorphic FKs (entity_id in d_entity_id_map)
- System FKs (user_id, session_id)
- Hierarchical FKs (parent_id)

---

### 4. CURRENCY (16 columns) ✅

**Pattern:** `_amt`, `_price`, `_cost`, `_rate`  
**Data Type:** `decimal(15,2)`, `numeric`  
**Detection:** Working via isCurrencyField()

```typescript
// Current code (good)
function isCurrencyField(key: string): boolean {
  return currencyPatterns.some(pattern => key.includes(pattern));
}

// Output
formatCurrency(value, 'CAD')  // "$1,234.56"
```

**Properties:**
- Format: Currency with $ prefix, 2 decimals
- Alignment: Right
- Width: 120px
- Validation: Positive numbers, max 2 decimals

---

### 5. BOOLEANS (39 columns) ❌ **BUG**

**Pattern:** `_flag`, `is_`, `has_`  
**Data Type:** `boolean`, `BOOLEAN`  
**Detection:** ❌ BROKEN - Currently marked readonly!

```typescript
// WRONG (current code)
FIELD_PATTERNS.readonly: /^(is_|has_|flag|_flag).*|.*_flag$/i
// ^^^ Marks all booleans as readonly!

// RIGHT (what it should be)
FIELD_PATTERNS.boolean: /^(is_|has_).*|.*_flag$/i
// Then:
// if (FIELD_PATTERNS.boolean.test(key)) {
//   return { inlineEditable: true, editType: 'checkbox' };
// }
```

**Properties:**
- Editable: ✅ YES (currently broken)
- Display: Checkbox in forms, toggle in tables
- Storage: PostgreSQL boolean (true/false)
- Default: Varies by category (active=true, flags=false)

**Subcategories:**
```
Permission flags    - background_check_required, licensing_required
Status flags        - active_flag (35+ tables!)
Feature flags       - remote_work_eligible, auto_refresh_enabled
Tracking flags      - confirmation_sent, reminder_sent
Capability flags    - office_space, equipment_storage
```

---

### 6. COUNTS/QUANTITIES (29 columns) ⚠️

**Pattern:** `_count`, `_qty`, `_hours`, `_minutes`, `_seconds`  
**Data Type:** `integer`, `numeric`, `decimal`  
**Detection:** Partial (pattern too broad)

```typescript
// Current code (TOO BROAD)
FIELD_PATTERNS.number: /_(amt|amount|count|qty|...|_id|...)/i

// Better:
FIELD_PATTERNS.quantity: /(_count|_qty|_hours|_minutes|_seconds)$/i
```

**Subcategories:**
- **Counts:** attachment_count, tasks_completed_qty
- **Duration/Hours:** actual_hours, estimated_hours, labor_hours
- **Duration/Minutes:** reading_time_minutes, sla_target_minutes
- **Duration/Seconds:** duration_seconds, hold_time_seconds
- **Metrics:** failure_count, retry_count

**Properties:**
- Format: Integer for counts, decimal for hours
- Decimals: 0 for counts, 2 for durations
- Width: 100px (right-aligned)
- Non-negative: Always

---

### 7. PERCENTAGES (6 columns) ❌ **MISSING**

**Pattern:** `_pct`, `_percent`  
**Data Type:** `decimal(5,2)`, `numeric(5,2)`  
**Detection:** ❌ NOT IMPLEMENTED

**Fields:**
```
discount_pct
discount_percent
margin_percent
data_completeness_percent
success_rate_pct
tax_pct
```

**Need to implement:**
```typescript
// Add to FIELD_PATTERNS
FIELD_PATTERNS.percentage: /(_pct|_percent)$/i,

// In getFieldCapability()
if (FIELD_PATTERNS.percentage.test(key)) {
  return {
    inlineEditable: true,
    editType: 'number',
    metadata: {
      min: 0,
      max: 100,
      decimals: 2,
      visualization: 'progress-bar'
    }
  };
}
```

---

### 8. DATALABELS (19 columns) ✅

**Pattern:** `dl__` (data label prefix)  
**Data Type:** `text`  
**Source:** `setting_datalabel` table  
**Detection:** Working via loadOptionsFromSettings

```typescript
// Already implemented
if (column.loadOptionsFromSettings) {
  return {
    editType: 'select',
    settingsDatalabel: extractSettingsDatalabel(key)
  };
}

// Smart rendering
renderSettingBadge(value, { datalabel: 'project_stage' })
// Shows colored badge from settings.metadata.color_code
```

**Special Handling:**
- Stage/funnel fields → DAGVisualizer (workflow visualization)
- Regular dl__ fields → Dropdown select
- Colors from `setting_datalabel.metadata.color_code`

**Examples:**
- dl__project_stage → initiation → planning → execution
- dl__task_priority → High (red), Medium (yellow), Low (green)
- dl__customer_tier → Premium, Standard, Basic

---

### 9. STANDARD FIELDS (5 columns) ✅

**Pattern:** `name`, `code`, `descr`, `description`, `title`  
**Data Type:** `text`, `varchar`  
**Detection:** Working via explicit match

```typescript
// Current code (good)
const isSimpleTextField = /^(name|descr|description|title|notes)$/i.test(key);

// Output
inlineEditable = true
editType = 'text'
```

**Display Order:** Always show first
- name (300px)
- code (150px)
- descr (300px+)
- description
- title

---

### 10. JSONB (38 columns) ❌ **MISSING**

**Data Type:** `jsonb`, `JSONB`  
**Detection:** ❌ Not implemented

**Fields (by purpose):**
```
Schemas         - form_schema, workflow_graph, query_definition
Content         - content, submission_data, content_metadata
State/Session   - session_context, input_state, output_state
Metadata        - metadata (30 tables!), event_metadata
```

**Need to implement:**
```typescript
// Detect by data type, not by name
if (column.dataType?.includes('jsonb')) {
  return {
    editType: 'jsonb',
    editor: 'json-modal',
    validation: schema => validateJson(value, schema)
  };
}
```

---

### 11. ARRAYS (28 columns) ⚠️ **PARTIAL**

**Data Type:** `uuid[]`, `text[]`, `varchar[]`, `integer[]`  
**Detection:** Only tags field handled

**Fields:**
```
UUID Arrays     - tags, assigned_technician_ids, stakeholder_employee_ids
Text Arrays     - skills_service_categories, keywords, external_links
Varchar Arrays  - edit_access_groups, read_access_groups
```

**Current implementation:**
```typescript
// Only handles 'tags' field
if (key === 'tags' || key.endsWith('_tags')) {
  return { editType: 'tags' };
}
```

**Need to enhance:**
```typescript
// Detect all array types
if (column.dataType?.includes('[]')) {
  return {
    editType: 'tags',  // Multi-select input
    elementType: detectArrayElementType(column)
  };
}
```

---

### 12. OTHER/CONTEXT-DEPENDENT (486 columns) ⚠️

**61% of columns require semantic understanding**

**Examples:**
- Contact fields: address_line1, address_line2, city, phone, email
- Business: business_type, client_tier, supplier_name
- Status: approval_status, payment_status, fulfillment_status
- Identifiers: cost_code, billing_cycle, bill_of_lading
- Technical: channel, content_format, agent_role

**Strategy:**
- Add to entityConfig with explicit field definitions
- Use loadOptionsFromSettings for dropdown fields
- Use loadOptionsFromEntity for entity references
- Document in field definitions

---

## Current Implementation Status

### Working ✅
- Timestamps: formatRelativeTime()
- Dates: formatFriendlyDate(), date picker
- Currency: formatCurrency()
- Datalabels: Dropdown with colors, DAG visualization
- Standard fields: Text editing
- Tags: Multi-value support

### Broken ❌
- **Booleans:** Marked readonly (should be editable)

### Missing ❌
- Percentages: No detection or rendering
- JSONB: No editor
- Arrays: Only tags handled

### Partial ⚠️
- Foreign Keys: Detected but wrong behavior
- Quantities: Pattern too broad, conflicts with _id
- Virtual Fields: No v_* detection

---

## Recommended Implementation Order

### Phase 1 (Critical - 1 day)
1. [ ] Fix boolean fields - remove from readonly
2. [ ] Add percentage detection and rendering
3. [ ] Add JSONB field handling

### Phase 2 (High - 2 days)
4. [ ] Enhance FK detection (polymorphic, hierarchy)
5. [ ] Implement array field detection
6. [ ] Add virtual field detection (v_* prefix)

### Phase 3 (Medium - 3 days)
7. [ ] Implement date range pair detection
8. [ ] Add DAG visualization for stages
9. [ ] Improve quantity subcategories

### Phase 4 (Nice-to-have - 2 days)
10. [ ] Add contact field specialization
11. [ ] Business field metadata
12. [ ] Field validation rules

---

## Files to Modify

```
apps/web/src/lib/data_transform_render.tsx
  - Fix boolean pattern (line 421)
  - Add percentage pattern
  - Add JSONB detection
  - Add array detection
  - Fix quantity pattern

apps/web/src/lib/fieldDetection.ts
  - NEW FILE: Pattern registry

apps/web/src/lib/entityConfig.ts
  - Use field detector for auto-config

apps/api/src/lib/data-transformers.ts
  - Add percentage validation
  - Add JSONB validation
  - Add array validation
```

---

**Document Generated:** 2025-11-12  
**Analysis Scope:** 802 columns × 47 tables × 49 DDL files  
**Status:** Ready for implementation

